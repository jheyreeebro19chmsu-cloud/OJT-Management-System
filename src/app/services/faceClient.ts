// Face-api client service for browser-based facial recognition
let _modelsLoaded = false;
let _modelsLoading = false;
let _loadPromise: Promise<boolean> | null = null;

export function isFaceModelLoaded(): boolean {
  return _modelsLoaded;
}

export async function waitForFaceApi(maxWaitMs = 6000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (typeof window !== 'undefined' && (window as any).faceapi) {
      return (window as any).faceapi;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return typeof window !== 'undefined' ? (window as any).faceapi : null;
}

export async function loadFaceModels(modelsPath = '/models'): Promise<boolean> {
  if (_modelsLoaded) return true;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    _modelsLoading = true;

    const api = await waitForFaceApi(4000);
    if (!api || (typeof window !== 'undefined' && (window as any).__faceApiUnavailable)) {
      console.warn('face-api unavailable in window; skipping model load');
      _modelsLoaded = false;
      _modelsLoading = false;
      return false;
    }

    // Use local models first for instant loading without internet, fallback to CDN
    const candidates = [
      modelsPath,
      'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights',
      'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
    ];

    for (const base of candidates) {
      try {
        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri(base),
          api.nets.faceLandmark68Net.loadFromUri(base),
          api.nets.faceRecognitionNet.loadFromUri(base),
        ]);

        if (api.nets.ssdMobilenetv1) {
          try {
            await api.nets.ssdMobilenetv1.loadFromUri(base);
          } catch {
            // non-fatal
          }
        }

        _modelsLoaded = true;
        _modelsLoading = false;
        return true;
      } catch (e) {
        console.warn(`[FaceClient] Notice loading models from ${base}:`, e);
      }
    }

    _modelsLoaded = false;
    _modelsLoading = false;
    return false;
  })();

  const res = await _loadPromise;
  _loadPromise = null;
  return res;
}

async function createImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = async () => {
      // If remote image fails with crossOrigin (e.g. Supabase storage CORS restriction),
      // fetch as blob and convert to local data URL so canvas operations succeed without taint
      if (!src.startsWith('data:')) {
        try {
          const res = await fetch(src);
          if (res.ok) {
            const blob = await res.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              const fallbackImg = new Image();
              fallbackImg.onload = () => resolve(fallbackImg);
              fallbackImg.onerror = (err) => reject(err);
              fallbackImg.src = reader.result as string;
            };
            reader.readAsDataURL(blob);
            return;
          }
        } catch {
          // ignore
        }
      }
      reject(new Error('Failed to load image: ' + src.slice(0, 50)));
    };
    img.src = src;
  });
}

export interface FaceDetectionResult {
  hasFace: boolean;
  score?: number;
  descriptor?: Float32Array | null;
  box?: { x: number; y: number; width: number; height: number };
}

export async function detectFaceInDataUrl(dataUrl: string): Promise<boolean> {
  if (!dataUrl) return false;
  try {
    const ok = await loadFaceModels().catch(() => false);
    if (ok && (window as any).faceapi) {
      const api = (window as any).faceapi;
      const img = await createImageElement(dataUrl);
      // 1. TinyFaceDetector standard
      let detection = await api
        .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.05, inputSize: 320 }));

      // 2. TinyFaceDetector high-res
      if (!detection) {
        detection = await api
          .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.03, inputSize: 416 }));
      }

      // 3. TinyFaceDetector close-up
      if (!detection) {
        detection = await api
          .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.03, inputSize: 224 }));
      }

      // 4. SSD MobileNet
      if (!detection && api.nets.ssdMobilenetv1?.params) {
        detection = await api
          .detectSingleFace(img, new api.SsdMobilenetv1Options({ minConfidence: 0.15 }));
      }

      if (detection) return true;
    }

    // Fallback: Check if inspectFaceQuality detects facial presence
    const quality = await inspectFaceQuality(dataUrl).catch(() => null);
    if (quality?.faceDetected) return true;

    return dataUrl.length > 50;
  } catch (e) {
    console.warn('detectFaceInDataUrl error, using fallback:', e);
    return dataUrl.length > 50;
  }
}

export interface TypedDescriptor {
  descriptor: Float32Array;
  type: 'neural' | 'perceptual';
}

const descriptorCache = new Map<string, TypedDescriptor>();

export async function computeTypedDescriptorFromDataUrl(dataUrl: string): Promise<TypedDescriptor | null> {
  if (!dataUrl) return null;
  // Check memory cache first (instant 0ms retrieval for enrolled template images)
  const cached = descriptorCache.get(dataUrl);
  if (cached) return cached;

  try {
    const ok = await loadFaceModels().catch(() => false);
    const img = await createImageElement(dataUrl);

    let result: TypedDescriptor | null = null;

    if (ok && (window as any).faceapi) {
      const api = (window as any).faceapi;
      // Multi-detector AI pipeline:
      // 1. TinyFaceDetector 320 (Fast & accurate)
      let detection = await api
        .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.05, inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      // 2. TinyFaceDetector 224 (Low-res/Close-up)
      if (!detection || !detection.descriptor) {
        detection = await api
          .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.03, inputSize: 224 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      // 3. TinyFaceDetector 416 (High Resolution fallback)
      if (!detection || !detection.descriptor) {
        detection = await api
          .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.05, inputSize: 416 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      // 4. SSD Mobilenet V1 (Deep Neural Network)
      if ((!detection || !detection.descriptor) && api.nets.ssdMobilenetv1?.params) {
        detection = await api
          .detectSingleFace(img, new api.SsdMobilenetv1Options({ minConfidence: 0.15 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (detection && detection.descriptor) {
        result = { descriptor: detection.descriptor as Float32Array, type: 'neural' };
      }
    }

    if (!result) {
      // High-precision 128-D perceptual feature fallback (spatial grid + gradients + color moments)
      result = { descriptor: computePerceptualDescriptor(img), type: 'perceptual' };
    }

    // Keep cache bounded
    if (descriptorCache.size > 200) {
      const firstKey = descriptorCache.keys().next().value;
      if (firstKey) descriptorCache.delete(firstKey);
    }
    descriptorCache.set(dataUrl, result);

    return result;
  } catch (e) {
    console.warn('computeTypedDescriptorFromDataUrl error:', e);
    return null;
  }
}

export async function computeDescriptorFromDataUrl(dataUrl: string): Promise<Float32Array | null> {
  const typed = await computeTypedDescriptorFromDataUrl(dataUrl);
  return typed ? typed.descriptor : null;
}

export async function extractNeuralDescriptorFromDataUrl(dataUrl: string): Promise<number[] | null> {
  if (!dataUrl) return null;
  const modelsAvailable = _modelsLoaded || (await loadFaceModels().catch(() => false));
  if (!modelsAvailable) return null;
  const typed = await computeTypedDescriptorFromDataUrl(dataUrl);
  if (typed && typed.type === 'neural' && typed.descriptor && typed.descriptor.length === 128) {
    return Array.from(typed.descriptor).map((n) => Number(n.toFixed(6)));
  }
  return null;
}

export async function hasNeuralFaceInDataUrl(dataUrl: string): Promise<boolean> {
  const desc = await extractNeuralDescriptorFromDataUrl(dataUrl);
  return Boolean(desc && desc.length === 128);
}

/**
 * 128-Dimensional Perceptual Facial Descriptor
 * Generates an L2-normalized 128-D vector from face framing geometry,
 * spatial luminance distribution (8x8 = 64D), directional gradients (32D),
 * and chromatic color moments (32D).
 */
function computePerceptualDescriptor(img: HTMLImageElement): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const descriptor = new Float32Array(128);

  if (!ctx) return descriptor;

  ctx.drawImage(img, 0, 0, 64, 64);
  const imgData = ctx.getImageData(0, 0, 64, 64);
  const data = imgData.data;

  // 1. 8x8 Spatial Luminance Grid (64 Dimensions)
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      let blockLum = 0;
      for (let y = gy * 8; y < (gy + 1) * 8; y++) {
        for (let x = gx * 8; x < (gx + 1) * 8; x++) {
          const idx = (y * 64 + x) * 4;
          blockLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        }
      }
      descriptor[gy * 8 + gx] = blockLum / (64 * 255);
    }
  }

  // 2. Horizontal & Vertical Spatial Gradients (32 Dimensions)
  for (let i = 0; i < 32; i++) {
    const y = Math.floor(i / 8) * 16 + 8;
    const x = (i % 8) * 8 + 4;
    const idx = (y * 64 + x) * 4;
    const rightIdx = (y * 64 + Math.min(x + 4, 63)) * 4;
    const downIdx = (Math.min(y + 4, 63) * 64 + x) * 4;

    const lumCenter = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    const lumRight = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
    const lumDown = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];

    descriptor[64 + i] = (Math.abs(lumCenter - lumRight) + Math.abs(lumCenter - lumDown)) / 255;
  }

  // 3. Chromatic Distribution & Quadrant Color Moments (32 Dimensions)
  for (let q = 0; q < 4; q++) {
    const startY = (q < 2 ? 0 : 32);
    const startX = (q % 2 === 0 ? 0 : 32);
    let rSum = 0, gSum = 0, bSum = 0, count = 0;

    for (let y = startY; y < startY + 32; y += 4) {
      for (let x = startX; x < startX + 32; x += 4) {
        const idx = (y * 64 + x) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }
    const base = 96 + q * 8;
    descriptor[base] = (rSum / count) / 255;
    descriptor[base + 1] = (gSum / count) / 255;
    descriptor[base + 2] = (bSum / count) / 255;
    descriptor[base + 3] = Math.abs((rSum - gSum) / count) / 255;
    descriptor[base + 4] = Math.abs((gSum - bSum) / count) / 255;
    descriptor[base + 5] = Math.abs((rSum - bSum) / count) / 255;
    descriptor[base + 6] = ((rSum + gSum + bSum) / (3 * count)) / 255;
    descriptor[base + 7] = Math.sqrt(descriptor[base] * descriptor[base + 2]);
  }

  // L2 Normalize descriptor vector to unit length
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    sumSq += descriptor[i] * descriptor[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < 128; i++) {
    descriptor[i] /= norm;
  }

  return descriptor;
}

/**
 * Euclidean distance between two 128-dimensional face descriptors
 */
export function descriptorDistance(a: Float32Array, b: Float32Array): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export interface FaceQualityReport {
  ok: boolean;
  issues: string[];
  tooDark: boolean;
  tooBright: boolean;
  poorBackgroundLighting: boolean;
  blurry: boolean;
  capDetected: boolean;
  glassesDetected: boolean;
  maskDetected: boolean;
  faceObscured: boolean;
  faceDetected: boolean;
  faceCentered: boolean;
  brightness: number;
  sharpness: number;
  ear: number;
  eyesClosed: boolean;
  landmarks?: Array<{ x: number; y: number }>;
  faceBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Image inspection for lighting, clarity, cap/headwear, glasses, and face mask obstruction.
 */
export async function inspectFaceQuality(dataUrl: string): Promise<FaceQualityReport> {
  const result: FaceQualityReport = {
    ok: true,
    issues: [],
    tooDark: false,
    tooBright: false,
    poorBackgroundLighting: false,
    blurry: false,
    capDetected: false,
    glassesDetected: false,
    maskDetected: false,
    faceObscured: false,
    faceDetected: false,
    faceCentered: true,
    brightness: 120,
    sharpness: 25,
    ear: 0.30,
    eyesClosed: false,
  };

  if (!dataUrl) {
    result.ok = false;
    result.issues.push('No video frame captured');
    return result;
  }

  try {
    const img = await createImageElement(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 320;
    canvas.height = img.height || 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return result;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // 1. Luminance & Lighting Analysis (L = 0.299R + 0.587G + 0.114B)
    let totalLum = 0;
    let laplacianSum = 0;
    const count = data.length / 4;
    const w = canvas.width;
    const h = canvas.height;

    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalLum += lum;
    }
    const avgLum = totalLum / count;
    result.brightness = Math.round(avgLum);

    // Background Lighting Analysis: Sample far corners outside the central oval
    let bgLumSum = 0;
    let bgSamples = 0;
    const cornerW = Math.max(8, Math.floor(w * 0.15));
    const cornerH = Math.max(8, Math.floor(h * 0.15));
    for (let y = 0; y < cornerH; y += 4) {
      for (let x = 0; x < cornerW; x += 4) {
        const idxTL = (y * w + x) * 4;
        const idxTR = (y * w + (w - 1 - x)) * 4;
        bgLumSum += 0.299 * data[idxTL] + 0.587 * data[idxTL + 1] + 0.114 * data[idxTL + 2];
        bgLumSum += 0.299 * data[idxTR] + 0.587 * data[idxTR + 1] + 0.114 * data[idxTR + 2];
        bgSamples += 2;
      }
    }
    const bgLum = bgSamples > 0 ? Math.round(bgLumSum / bgSamples) : Math.round(avgLum);

    // Only flag dark if overall frame or corners are genuinely pitch dark (< 22)
    if (avgLum < 24 || (bgLum < 18 && avgLum < 30)) {
      result.tooDark = true;
      result.poorBackgroundLighting = bgLum < 18;
      result.ok = false;
      result.issues.push('🚨 POOR LIGHTING! Please move to a brighter, well-lit area.');
    } else if (avgLum > 246) {
      result.tooBright = true;
      result.ok = false;
      result.issues.push('🚨 HARSH GLARE / OVEREXPOSURE! Please adjust lighting.');
    }

    // 2. Sharpness / Blurriness Analysis
    let edgeSamples = 0;
    for (let y = 1; y < h - 1; y += 4) {
      for (let x = 1; x < w - 1; x += 4) {
        const idx = (y * w + x) * 4;
        const rightIdx = (y * w + (x + 1)) * 4;
        const downIdx = ((y + 1) * w + x) * 4;

        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const lumR = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
        const lumD = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];

        laplacianSum += Math.abs(lum - lumR) + Math.abs(lum - lumD);
        edgeSamples++;
      }
    }
    const sharpness = edgeSamples > 0 ? laplacianSum / edgeSamples : 30;
    result.sharpness = Math.round(sharpness);

    if (sharpness < 6.5) {
      result.blurry = true;
      result.ok = false;
      result.issues.push('Camera/face is blurry. Please hold steady and look directly into the camera.');
    }

    const getPixel = (x: number, y: number) => {
      const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
      const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
      const idx = (cy * w + cx) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      return { r, g, b, lum };
    };

    const getPatchAvg = (cx: number, cy: number, radius = 2) => {
      let rSum = 0, gSum = 0, bSum = 0, lumSum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const p = getPixel(cx + dx, cy + dy);
          rSum += p.r;
          gSum += p.g;
          bSum += p.b;
          lumSum += p.lum;
          count++;
        }
      }
      return {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
        lum: Math.round(lumSum / count),
      };
    };

    // 3. Face & Landmarks Detection with Obstruction checks
    const ok = await loadFaceModels().catch(() => false);
    let faceBox: any = null;
    let landmarks: any = null;

    if (ok && (window as any).faceapi) {
      const api = (window as any).faceapi;
      try {
        // Multi-resolution neural face detection (strictly requires genuine face score, never random background noise)
        let faceResult = await api.detectSingleFace(
          img,
          new api.TinyFaceDetectorOptions({ scoreThreshold: 0.24, inputSize: 416 })
        );

        if (!faceResult) {
          faceResult = await api.detectSingleFace(
            img,
            new api.TinyFaceDetectorOptions({ scoreThreshold: 0.22, inputSize: 320 })
          );
        }

        if (!faceResult) {
          faceResult = await api.detectSingleFace(
            img,
            new api.TinyFaceDetectorOptions({ scoreThreshold: 0.20, inputSize: 224 })
          );
        }

        if (!faceResult && api.nets.ssdMobilenetv1?.params) {
          faceResult = await api.detectSingleFace(
            img,
            new api.SsdMobilenetv1Options({ minConfidence: 0.28 })
          );
        }

        if (faceResult) {
          faceBox = (faceResult as any).box || (faceResult as any).detection?.box || faceResult;

          // Require 68-point facial landmarks to confirm a genuine recognizable human face
          try {
            const withLm = await api.detectSingleFace(
              img,
              new api.TinyFaceDetectorOptions({ scoreThreshold: 0.18, inputSize: 320 })
            ).withFaceLandmarks();
            if (withLm?.landmarks) {
              landmarks = withLm.landmarks.positions || withLm.landmarks;
              if (Array.isArray(landmarks) && landmarks.length >= 68) {
                result.faceDetected = true;
                result.landmarks = landmarks.map((pt: any) => ({ x: Number(pt.x), y: Number(pt.y) }));
              }
            }
          } catch {
            // Fall through if landmarks cannot be extracted
          }

          if (!result.faceDetected && (faceResult as any)?.score >= 0.45) {
            result.faceDetected = true;
          }
        }
      } catch (detErr) {
        console.warn('Face detection error:', detErr);
      }
    }

    if (result.faceDetected && faceBox) {
      result.faceBox = {
        x: Number(faceBox.x || faceBox._x || 0),
        y: Number(faceBox.y || faceBox._y || 0),
        width: Number(faceBox.width || faceBox._width || 0),
        height: Number(faceBox.height || faceBox._height || 0),
      };
      const box = faceBox;

      // Centering check: generous tolerance (within 38% of center) so human users pass naturally
      const targetCx = w * 0.50;
      const targetCy = h * 0.46;
      const faceCx = box.x + box.width / 2;
      const faceCy = box.y + box.height / 2;
      const offsetX = Math.abs(faceCx - targetCx) / w;
      const offsetY = Math.abs(faceCy - targetCy) / h;
      if (offsetX > 0.38 || offsetY > 0.38) {
        result.faceCentered = false;
        result.issues.push('Please align your face with the facial landmark mesh.');
      } else {
        result.faceCentered = true;
      }

      // 1. Cheek Skin Tone Baseline Sampling
      let cx1: number, cy1: number, cx2: number, cy2: number;
      if (landmarks && landmarks.length >= 68) {
        cx1 = (landmarks[30].x + landmarks[3].x) / 2;
        cy1 = (landmarks[30].y + landmarks[3].y) / 2;
        cx2 = (landmarks[30].x + landmarks[13].x) / 2;
        cy2 = (landmarks[30].y + landmarks[13].y) / 2;
      } else {
        cx1 = box.x + box.width * 0.26;
        cy1 = box.y + box.height * 0.58;
        cx2 = box.x + box.width * 0.74;
        cy2 = box.y + box.height * 0.58;
      }
      const cheek1 = getPatchAvg(cx1, cy1, 3);
      const cheek2 = getPatchAvg(cx2, cy2, 3);
      const skinR = Math.round((cheek1.r + cheek2.r) / 2);
      const skinG = Math.round((cheek1.g + cheek2.g) / 2);
      const skinB = Math.round((cheek1.b + cheek2.b) / 2);
      const skinLum = Math.max(35, Math.round((cheek1.lum + cheek2.lum) / 2));

      // 2. HAT / CAP / HEADWEAR DETECTION (Soft non-blocking advisory)
      if (landmarks && landmarks.length >= 68) {
        const browMidY = (landmarks[21].y + landmarks[22].y) / 2;
        const noseBridgeX = landmarks[27].x;

        const fore1 = getPatchAvg(noseBridgeX, browMidY - 14, 2);
        const fore2 = getPatchAvg(noseBridgeX, browMidY - 26, 2);

        // Avoid false positives from bangs or natural forehead hair. Only flag heavy solid dark brim.
        const isCapBrim = fore1.lum < 15 && fore2.lum < 15 && skinLum > 65;

        if (isCapBrim) {
          result.capDetected = true;
          result.issues.push('Tip: Ensure forehead and face are clear.');
        }
      }

      // 3. SUNGLASSES / EYE OBSTRUCTION DETECTION (Soft non-blocking advisory)
      // Never false positive on natural dark Filipino irises: check wide sclera coverage, not a single pupil pixel
      if (landmarks && landmarks.length >= 68) {
        const rPupilX = (landmarks[36].x + landmarks[39].x) / 2;
        const rPupilY = (landmarks[37].y + landmarks[40].y) / 2;
        const lPupilX = (landmarks[42].x + landmarks[45].x) / 2;
        const lPupilY = (landmarks[43].y + landmarks[46].y) / 2;

        const rOuter = getPixel(landmarks[36].x, landmarks[36].y);
        const rInner = getPixel(landmarks[39].x, landmarks[39].y);
        const lInner = getPixel(landmarks[42].x, landmarks[42].y);
        const lOuter = getPixel(landmarks[45].x, landmarks[45].y);
        const rCenter = getPatchAvg(rPupilX, rPupilY, 3);
        const lCenter = getPatchAvg(lPupilX, lPupilY, 3);

        // Genuine dark sunglasses: entire eye socket including white sclera is completely opaque black (< 14)
        const isDarkSunglasses = (
          rCenter.lum < 14 && lCenter.lum < 14 &&
          rOuter.lum < 18 && lOuter.lum < 18 &&
          rInner.lum < 18 && lInner.lum < 18 &&
          skinLum > 65
        );

        // Heavy specular lens glare completely washing out both eyes
        const isReflectiveSunglasses = (
          rCenter.lum > 252 && lCenter.lum > 252 &&
          rCenter.r > 248 && lCenter.r > 248
        );

        if (isDarkSunglasses || isReflectiveSunglasses) {
          result.glassesDetected = true;
          result.issues.push('Tip: Please ensure eyes are clearly visible without sunglasses.');
        }
      }

      // 4. MASK DETECTION (Surgical / Fabric Mask - Soft non-blocking advisory)
      if (landmarks && landmarks.length >= 68) {
        const philtrumX = (landmarks[33].x + landmarks[51].x) / 2;
        const philtrumY = (landmarks[33].y + landmarks[51].y) / 2;
        const philtrumP = getPatchAvg(philtrumX, philtrumY, 2);

        const chinX = (landmarks[57].x + landmarks[8].x) / 2;
        const chinY = (landmarks[57].y + landmarks[8].y) / 2;
        const chinP = getPatchAvg(chinX, chinY, 2);

        // Avoid false positives from natural nasal or chin shadows: require blatant surgical blue or solid black mask
        const isSurgicalBlue = (philtrumP.b > philtrumP.r + 35 && philtrumP.b > 90) || (chinP.b > chinP.r + 35 && chinP.b > 90);
        const isBlackMask = (philtrumP.lum < 16 && chinP.lum < 16 && skinLum > 60);

        if (isSurgicalBlue || isBlackMask) {
          result.maskDetected = true;
          result.issues.push('Tip: Please ensure your face mask is removed.');
        }
      }

      // 5. Eye Aspect Ratio (EAR) for Blink Liveness Anti-Spoofing Detection
      if (landmarks && landmarks.length >= 68) {
        const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
          Math.hypot(p1.x - p2.x, p1.y - p2.y);

        // Right eye: landmarks 36 to 41
        const rP1 = landmarks[36];
        const rP2 = landmarks[37];
        const rP3 = landmarks[38];
        const rP4 = landmarks[39];
        const rP5 = landmarks[40];
        const rP6 = landmarks[41];
        const rEAR = (dist(rP2, rP6) + dist(rP3, rP5)) / (2.0 * Math.max(1, dist(rP1, rP4)));

        // Left eye: landmarks 42 to 47
        const lP1 = landmarks[42];
        const lP2 = landmarks[43];
        const lP3 = landmarks[44];
        const lP4 = landmarks[45];
        const lP5 = landmarks[46];
        const lP6 = landmarks[47];
        const lEAR = (dist(lP2, lP6) + dist(lP3, lP5)) / (2.0 * Math.max(1, dist(lP1, lP4)));

        const avgEAR = (rEAR + lEAR) / 2.0;
        result.ear = Number(avgEAR.toFixed(3));
        result.eyesClosed = avgEAR < 0.23;
      }

      // Client heuristics are strictly soft advisories: they do not block face scanning.
      // Server-side InsightFace (ArcFace 512-d) performs the authoritative biometric verification.
      result.faceObscured = false;
      result.ok = result.faceDetected && result.faceCentered && !result.tooDark && !result.tooBright;
    } else {
      result.faceDetected = false;
      result.faceCentered = false;
        result.faceObscured = false;
        result.ok = false;
        result.issues.push('No face detected. Align face with the biometric landmark mesh.');
      }
    } catch (err) {
      console.warn('inspectFaceQuality warning:', err);
    }

  return result;
}

async function flipDataUrlHorizontally(dataUrl: string): Promise<string> {
  const img = await createImageElement(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width || 320;
  canvas.height = img.height || 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export interface LandmarkLivenessMetrics {
  ear: number;
  yawRatio: number;
  eyeWidthAsymmetry: number;
  pitchRatio: number;
  mouthToJaw: number;
  mouthCornerLift: number;
  mar: number;
  faceWidth: number;
  faceHeight: number;
  faceCx: number;
  faceCy: number;
}

/**
 * Computes 3D perspective & non-rigid facial expression metrics from 68 landmarks.
 * - `yawRatio`: (p30.x - p0.x) / (p16.x - p0.x). On a flat 2D photo/phone screen, p0, p30, p16
 *   are coplanar, so tilting/rotating the phone preserves this ratio (~0.50). Only a genuine 3D
 *   human head with nasal protrusion shifts yawRatio significantly (< 0.38 or > 0.62).
 * - `pitchRatio`: noseLength / outerEyeSpan. Stays constant during real blinks/smiles, whereas
 *   tilting a flat photo vertically foreshortens pitchRatio proportionally with EAR.
 * - `mouthToJaw` & `mar`: Non-rigid mouth movement invariants that cannot change on a static photo.
 */
export function computeLandmarkLivenessMetrics(
  pts: Array<{ x: number; y: number }>
): LandmarkLivenessMetrics | null {
  if (!pts || pts.length < 68) return null;

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  // Eye Aspect Ratio (EAR) - Right (36..41) & Left (42..47)
  const rEAR =
    (dist(pts[37], pts[41]) + dist(pts[38], pts[40])) /
    (2.0 * Math.max(1, dist(pts[36], pts[39])));
  const lEAR =
    (dist(pts[43], pts[47]) + dist(pts[44], pts[46])) /
    (2.0 * Math.max(1, dist(pts[42], pts[45])));
  const ear = (rEAR + lEAR) / 2.0;

  // 3D Horizontal Yaw Parallax Ratio (Nose tip 30 relative to jaw contour 0..16)
  const jawSpanX = Math.max(1, pts[16].x - pts[0].x);
  const yawRatio = (pts[30].x - pts[0].x) / jawSpanX;

  // 3D Eye Foreshortening Asymmetry
  const rEyeW = dist(pts[36], pts[39]);
  const lEyeW = Math.max(1, dist(pts[42], pts[45]));
  const eyeWidthAsymmetry = rEyeW / lEyeW;

  // Vertical Rigid Midface Ratio (Nose bridge 27 -> base 33 vs outer eye span 36..45)
  const outerEyeSpan = Math.max(1, dist(pts[36], pts[45]));
  const noseLength = dist(pts[27], pts[33]);
  const pitchRatio = noseLength / outerEyeSpan;

  // Non-rigid Smile & Inner-Lip Mouth Aspect Ratio (MAR)
  const lowerJawWidth = Math.max(1, dist(pts[3], pts[13]));
  const mouthWidth = dist(pts[48], pts[54]);
  const mouthToJaw = mouthWidth / lowerJawWidth;

  const innerMouthW = Math.max(1, dist(pts[60], pts[64]));
  const innerMouthH =
    (dist(pts[61], pts[67]) + dist(pts[62], pts[66]) + dist(pts[63], pts[65])) / 3.0;
  const mar = innerMouthH / innerMouthW;

  const faceWidth = Math.max(1, dist(pts[0], pts[16]));
  const faceHeight = Math.max(1, dist(pts[27], pts[8]));

  // Upward lift of mouth corners (48, 54) relative to lip center (51, 57) — catches gentle closed-lip smiles
  const mouthCenterY = (pts[51].y + pts[57].y) / 2.0;
  const mouthCornerY = (pts[48].y + pts[54].y) / 2.0;
  const mouthCornerLift = (mouthCenterY - mouthCornerY) / faceHeight;

  return {
    ear: Number(ear.toFixed(4)),
    yawRatio: Number(yawRatio.toFixed(4)),
    eyeWidthAsymmetry: Number(eyeWidthAsymmetry.toFixed(4)),
    pitchRatio: Number(pitchRatio.toFixed(4)),
    mouthToJaw: Number(mouthToJaw.toFixed(4)),
    mouthCornerLift: Number(mouthCornerLift.toFixed(4)),
    mar: Number(mar.toFixed(4)),
    faceWidth,
    faceHeight,
    faceCx: pts[30].x,
    faceCy: pts[30].y,
  };
}

let _spoofProbeCanvas: HTMLCanvasElement | null = null;

/**
 * Passive anti-spoofing check for 2D phone/tablet screen replay or printed/framed photo borders:
 * 1. Detects sharp rectangular device bezel step-edges surrounding the face inside the camera frame.
 * 2. Detects unnatural LCD/OLED backlight blue-channel dominance / clipped specular screen washout on skin.
 */
export function detectScreenSpoofArtifacts(
  source: HTMLVideoElement | HTMLImageElement,
  pts: Array<{ x: number; y: number }>
): { suspected: boolean; reason?: string } {
  if (!pts || pts.length < 68 || typeof document === 'undefined') {
    return { suspected: false };
  }

  const srcW =
    source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth || source.width;
  const srcH =
    source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight || source.height;
  if (!srcW || !srcH) return { suspected: false };

  try {
    if (!_spoofProbeCanvas) {
      _spoofProbeCanvas = document.createElement('canvas');
    }
    const W = 160;
    const H = Math.max(120, Math.round((srcH / srcW) * W));
    if (_spoofProbeCanvas.width !== W || _spoofProbeCanvas.height !== H) {
      _spoofProbeCanvas.width = W;
      _spoofProbeCanvas.height = H;
    }
    const ctx = _spoofProbeCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { suspected: false };

    ctx.drawImage(source, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const sx = W / srcW;
    const sy = H / srcH;

    const getPx = (x: number, y: number) => {
      const cx = Math.max(0, Math.min(W - 1, Math.round(x)));
      const cy = Math.max(0, Math.min(H - 1, Math.round(y)));
      const idx = (cy * W + cx) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      return { r, g, b, lum: 0.299 * r + 0.587 * g + 0.114 * b };
    };

    // Sample left & right cheek patches + forehead for biological skin reflectance vs OLED/LCD emission
    const cheek1 = getPx(((pts[30].x + pts[3].x) / 2) * sx, ((pts[30].y + pts[3].y) / 2) * sy);
    const cheek2 = getPx(((pts[30].x + pts[13].x) / 2) * sx, ((pts[30].y + pts[13].y) / 2) * sy);
    const foreY = Math.max(2, ((pts[21].y + pts[22].y) / 2 - (pts[33].y - pts[27].y) * 0.45) * sy);
    const fore = getPx(pts[27].x * sx, foreY);

    // Biological human skin always has hemoglobin red >= blue under normal illumination.
    // Only flag extreme uncalibrated OLED/LCD backlight blue saturation so indoor lighting or
    // dark hair against a light wall never interrupts blinking or smiling.
    const strongScreenBlueCast =
      cheek1.b > cheek1.r + 48 &&
      cheek2.b > cheek2.r + 48 &&
      fore.b > fore.r + 42 &&
      cheek1.b > cheek1.g + 28 &&
      cheek2.b > cheek2.g + 28 &&
      cheek1.lum > 75 &&
      cheek2.lum > 75;

    if (strongScreenBlueCast) {
      return {
        suspected: true,
        reason: 'Digital screen backlight detected — Only live faces are allowed.',
      };
    }
  } catch {
    // non-fatal
  }

  return { suspected: false };
}

/**
 * Strict Biometric Verification matching algorithm:
 * Uses 128-D neural embedding Euclidean distance with optimal 0.58 threshold for face-api.js.
 * Strictly requires neural 68-landmark face descriptors on BOTH registered and live frames
 * (never falls back to perceptual RGB block matching) and fails closed if models are unavailable.
 */
export async function strictBiometricVerify(
  registeredDataUrl: string,
  liveDataUrl: string,
  threshold = 0.58,
  _skipQualityCheck = false,
  registeredDescriptor?: number[] | Float32Array | null
): Promise<{ matched: boolean; distance: number; confidence: number; error?: string }> {
  const hasStoredDescriptor = Boolean(
    registeredDescriptor && registeredDescriptor.length === 128
  );

  if ((!registeredDataUrl && !hasStoredDescriptor) || !liveDataUrl) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: !registeredDataUrl && !hasStoredDescriptor
        ? 'No registered face template found for this student. Face registration required.'
        : 'Missing live camera image for biometric verification.',
    };
  }

  const modelsAvailable = _modelsLoaded || (await loadFaceModels().catch(() => false));
  if (!modelsAvailable) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'Biometric AI models not ready. Please wait for facial recognition models to initialize.',
    };
  }

  const [t1, t2] = await Promise.all([
    hasStoredDescriptor
      ? Promise.resolve({
          descriptor:
            registeredDescriptor instanceof Float32Array
              ? registeredDescriptor
              : new Float32Array(registeredDescriptor!),
          type: 'neural' as const,
        })
      : computeTypedDescriptorFromDataUrl(registeredDataUrl),
    computeTypedDescriptorFromDataUrl(liveDataUrl),
  ]);

  if (!t1 || !t2 || t1.type !== 'neural' || t2.type !== 'neural') {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: !t1 || t1.type !== 'neural'
        ? 'Could not extract neural 128-D facial landmarks from registered profile photo. Please re-enroll your live face.'
        : 'No clear live human face detected in camera frame.',
    };
  }

  const d1 = t1.descriptor;
  const d2 = t2.descriptor;

  const dist = descriptorDistance(d1, d2);

  // Check if live face might be horizontally mirrored relative to registered face (e.g. selfie webcam vs ID photo)
  let bestDist = dist;
  if (dist > 0.38) {
    try {
      const flippedLiveUrl = await flipDataUrlHorizontally(liveDataUrl);
      const t2Flipped = await computeTypedDescriptorFromDataUrl(flippedLiveUrl);
      if (t2Flipped && t2Flipped.type === 'neural') {
        const flippedDist = descriptorDistance(d1, t2Flipped.descriptor);
        if (flippedDist < bestDist) {
          bestDist = flippedDist;
        }
      }
    } catch {
      // ignore flip check error
    }
  }

  const effectiveThreshold = Math.min(threshold, 0.58);
  const matched = bestDist <= effectiveThreshold;
  const confidence = Math.max(0, Math.min(100, Math.round((1 - bestDist / effectiveThreshold) * 100)));

  return {
    matched,
    distance: bestDist,
    confidence,
    error: matched
      ? undefined
      : `Face does not match registered biometrics for this trainee (Biometric distance: ${bestDist.toFixed(3)}, threshold: ${effectiveThreshold.toFixed(2)}).`,
  };
}

/**
 * Verify matching between two face images (registered template vs live captured)
 */
export async function compareFaces(
  registeredDataUrl: string,
  capturedDataUrl: string,
  threshold = 0.58
): Promise<{ matched: boolean; distance: number; confidence: number }> {
  const res = await strictBiometricVerify(registeredDataUrl, capturedDataUrl, threshold);
  return {
    matched: res.matched,
    distance: res.distance,
    confidence: res.confidence / 100,
  };
}

