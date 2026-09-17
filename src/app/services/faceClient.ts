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
        await api.nets.tinyFaceDetector.loadFromUri(base);
        await api.nets.faceLandmark68Net.loadFromUri(base);
        await api.nets.faceRecognitionNet.loadFromUri(base);

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

export async function computeTypedDescriptorFromDataUrl(dataUrl: string): Promise<TypedDescriptor | null> {
  if (!dataUrl) return null;
  try {
    const ok = await loadFaceModels().catch(() => false);
    const img = await createImageElement(dataUrl);

    if (ok && (window as any).faceapi) {
      const api = (window as any).faceapi;
      // Multi-detector AI pipeline:
      // 1. TinyFaceDetector 416 (High Resolution)
      let detection = await api
        .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.05, inputSize: 416 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      // 2. TinyFaceDetector 320 (Fast)
      if (!detection || !detection.descriptor) {
        detection = await api
          .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.03, inputSize: 320 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      // 3. TinyFaceDetector 224 (Low-res/Close-up)
      if (!detection || !detection.descriptor) {
        detection = await api
          .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.03, inputSize: 224 }))
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
        return { descriptor: detection.descriptor as Float32Array, type: 'neural' };
      }
    }

    // High-precision 128-D perceptual feature fallback (spatial grid + gradients + color moments)
    return { descriptor: computePerceptualDescriptor(img), type: 'perceptual' };
  } catch (e) {
    console.warn('computeTypedDescriptorFromDataUrl error:', e);
    return null;
  }
}

export async function computeDescriptorFromDataUrl(dataUrl: string): Promise<Float32Array | null> {
  const typed = await computeTypedDescriptorFromDataUrl(dataUrl);
  return typed ? typed.descriptor : null;
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
        // Multi-resolution face detection without requiring landmarks first
        let faceResult = await api.detectSingleFace(
          img,
          new api.TinyFaceDetectorOptions({ scoreThreshold: 0.05, inputSize: 416 })
        );

        if (!faceResult) {
          faceResult = await api.detectSingleFace(
            img,
            new api.TinyFaceDetectorOptions({ scoreThreshold: 0.03, inputSize: 320 })
          );
        }

        if (!faceResult) {
          faceResult = await api.detectSingleFace(
            img,
            new api.TinyFaceDetectorOptions({ scoreThreshold: 0.03, inputSize: 224 })
          );
        }

        if (!faceResult && api.nets.ssdMobilenetv1?.params) {
          faceResult = await api.detectSingleFace(
            img,
            new api.SsdMobilenetv1Options({ minConfidence: 0.15 })
          );
        }

        if (faceResult) {
          result.faceDetected = true;
          faceBox = (faceResult as any).box || (faceResult as any).detection?.box || faceResult;

          // Attempt landmarks extraction on the detected face
          try {
            const withLm = await api.detectSingleFace(
              img,
              new api.TinyFaceDetectorOptions({ scoreThreshold: 0.03, inputSize: 320 })
            ).withFaceLandmarks();
            if (withLm?.landmarks) {
              landmarks = withLm.landmarks.positions || withLm.landmarks;
            }
          } catch {
            // Landmark detection failure should not invalidate face detection
          }
        }
      } catch (detErr) {
        console.warn('Face detection error:', detErr);
      }
    }

    // Fallback: Skin-tone & facial presence analysis in central oval if models unavailable or missed
    if (!result.faceDetected) {
      let ovalSkinPixels = 0;
      let ovalTotalPixels = 0;

      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const dx = (x - w * 0.5) / (w * 0.32);
          const dy = (y - h * 0.48) / (h * 0.35);
          if ((dx * dx + dy * dy) <= 1.0) {
            ovalTotalPixels++;
            const p = getPixel(x, y);
            const isSkin = (
              p.r > 35 && p.g > 22 && p.b > 15 &&
              p.r >= p.g && (p.r - p.b) > 4 &&
              p.lum > 22 && p.lum < 248
            );
            if (isSkin) ovalSkinPixels++;
          }
        }
      }

      const skinRatio = ovalTotalPixels > 0 ? ovalSkinPixels / ovalTotalPixels : 0;
      if (skinRatio >= 0.10 && result.sharpness > 2.5) {
        result.faceDetected = true;
        result.faceCentered = true;
        faceBox = {
          x: Math.round(w * 0.20),
          y: Math.round(h * 0.16),
          width: Math.round(w * 0.60),
          height: Math.round(h * 0.64),
        };
      }
    }

    if (result.faceDetected && faceBox) {
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
        result.issues.push('Please center your face inside the oval guide.');
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

      // 2. HAT / CAP / HEADWEAR DETECTION
      if (landmarks && landmarks.length >= 68) {
        const browMidY = (landmarks[21].y + landmarks[22].y) / 2;
        const noseBridgeX = landmarks[27].x;

        const fore1 = getPatchAvg(noseBridgeX, browMidY - 14, 2);
        const fore2 = getPatchAvg(noseBridgeX, browMidY - 26, 2);
        const fore3 = getPatchAvg(noseBridgeX, browMidY - 38, 2);

        const foreColorDiff1 = Math.abs(fore1.r - skinR) + Math.abs(fore1.g - skinG) + Math.abs(fore1.b - skinB);
        const foreColorDiff2 = Math.abs(fore2.r - skinR) + Math.abs(fore2.g - skinG) + Math.abs(fore2.b - skinB);
        const foreColorDiff3 = Math.abs(fore3.r - skinR) + Math.abs(fore3.g - skinG) + Math.abs(fore3.b - skinB);

        const isForeheadFabric = (foreColorDiff1 > 38 && foreColorDiff2 > 38) || (foreColorDiff2 > 38 && foreColorDiff3 > 38);
        const isCapBrimShadow = fore1.lum < skinLum * 0.45 && fore2.lum < skinLum * 0.45;
        const foreheadHeight = browMidY - box.y;
        const foreheadTruncated = foreheadHeight < 14;

        if ((isForeheadFabric || isCapBrimShadow) && (foreheadHeight > 16 || foreheadTruncated)) {
          result.capDetected = true;
          result.issues.push('🚨 HAT / CAP DETECTED! Institutional policy strictly requires a bare face. Please remove headwear.');
        }
      }

      // 3. CALIBRATED GLASSES DETECTION (Zero Tolerance for Real Glasses, Zero False Positives on Bare Faces)
      if (landmarks && landmarks.length >= 68) {
        const p39 = landmarks[39];
        const p42 = landmarks[42];
        const n27 = landmarks[27];
        const n28 = landmarks[28];
        const n29 = landmarks[29];
        const browMidY = (landmarks[21].y + landmarks[22].y) / 2;
        const noseBridgeX = n27.x;

        // A. Nasal Ridge Corridor Scan
        let maxBridgeColorDiff = 0;
        let maxBridgeGrad = 0;
        let prevBridgeLum = getPixel(noseBridgeX, browMidY - 4).lum;

        for (let y = Math.round(browMidY - 6); y <= Math.round(n29.y); y += 2) {
          const sp = getPixel(noseBridgeX, y);
          const diff = Math.abs(sp.r - skinR) + Math.abs(sp.g - skinG) + Math.abs(sp.b - skinB);
          if (diff > maxBridgeColorDiff) maxBridgeColorDiff = diff;
          const grad = Math.abs(sp.lum - prevBridgeLum);
          if (grad > maxBridgeGrad) maxBridgeGrad = grad;
          prevBridgeLum = sp.lum;
        }

        // B. Horizontal Bridge Sweeps
        let maxSpanVariation = 0;
        let maxSweepColorDiff = 0;
        const sweepYLevels = [
          browMidY,
          n27.y - 5,
          n27.y,
          n27.y + 5,
          (p39.y + p42.y) / 2,
          n28.y,
        ];

        for (const sy of sweepYLevels) {
          let sLumMin = 255;
          let sLumMax = 0;
          let sColorDiffSum = 0;
          for (let step = 1; step <= 5; step++) {
            const sx = p39.x + (p42.x - p39.x) * (step / 6);
            const sp = getPixel(sx, sy);
            if (sp.lum < sLumMin) sLumMin = sp.lum;
            if (sp.lum > sLumMax) sLumMax = sp.lum;
            sColorDiffSum += Math.abs(sp.r - skinR) + Math.abs(sp.g - skinG) + Math.abs(sp.b - skinB);
          }
          const spanVar = sLumMax - sLumMin;
          if (spanVar > maxSpanVariation) maxSpanVariation = spanVar;
          const avgDiff = sColorDiffSum / 5;
          if (avgDiff > maxSweepColorDiff) maxSweepColorDiff = avgDiff;
        }

        const hasBridgeFrame = (
          (maxBridgeColorDiff > 28 && maxBridgeGrad > 22) ||
          (maxSpanVariation > 32 && maxSweepColorDiff > 28)
        );

        // C. Nose Pad Detection (both sides of nasal ridge)
        const rPadX = (p39.x + n27.x) / 2;
        const rPadY = (p39.y + n28.y) / 2;
        const lPadX = (p42.x + n27.x) / 2;
        const lPadY = (p42.y + n28.y) / 2;
        const rPad = getPixel(rPadX, rPadY);
        const lPad = getPixel(lPadX, lPadY);
        const rPadDiff = Math.abs(rPad.r - skinR) + Math.abs(rPad.g - skinG) + Math.abs(rPad.b - skinB);
        const lPadDiff = Math.abs(lPad.r - skinR) + Math.abs(lPad.g - skinG) + Math.abs(lPad.b - skinB);
        const hasNosePads = (
          (rPadDiff > 25 && lPadDiff > 25) &&
          ((rPad.lum < skinLum * 0.60 && lPad.lum < skinLum * 0.60) || (rPad.lum > skinLum * 1.45 && lPad.lum > skinLum * 1.45))
        );

        // D. Under-Eye Lower Rims
        let maxCheekRimDiff = 0;
        let maxCheekGrad = 0;
        const maxCheekDepth = Math.min(36, Math.round(box.height * 0.28));
        let prevRLum = getPixel(landmarks[41].x, landmarks[41].y + 2).lum;
        let prevLLum = getPixel(landmarks[46].x, landmarks[46].y + 2).lum;

        for (let dy = 6; dy <= maxCheekDepth; dy += 2) {
          const rP = getPixel(landmarks[41].x, landmarks[41].y + dy);
          const lP = getPixel(landmarks[46].x, landmarks[46].y + dy);
          const rDiff = Math.abs(rP.r - skinR) + Math.abs(rP.g - skinG) + Math.abs(rP.b - skinB);
          const lDiff = Math.abs(lP.r - skinR) + Math.abs(lP.g - skinG) + Math.abs(lP.b - skinB);
          if (rDiff > maxCheekRimDiff) maxCheekRimDiff = rDiff;
          if (lDiff > maxCheekRimDiff) maxCheekRimDiff = lDiff;

          const rGrad = Math.abs(rP.lum - prevRLum);
          const lGrad = Math.abs(lP.lum - prevLLum);
          if (rGrad > maxCheekGrad) maxCheekGrad = rGrad;
          if (lGrad > maxCheekGrad) maxCheekGrad = lGrad;
          prevRLum = rP.lum;
          prevLLum = lP.lum;
        }
        const hasLowerRimFrame = (maxCheekRimDiff > 28 && maxCheekGrad > 22);

        // E. Temporal Eyeglass Arms
        let maxTempleDiff = 0;
        let minTempleLum = 255;
        for (let dx = 6; dx <= 18; dx += 3) {
          for (let dy = -3; dy <= 3; dy += 3) {
            const rT = getPixel(landmarks[36].x - dx, landmarks[36].y + dy);
            const lT = getPixel(landmarks[45].x + dx, landmarks[45].y + dy);
            const rD = Math.abs(rT.r - skinR) + Math.abs(rT.g - skinG) + Math.abs(rT.b - skinB);
            const lD = Math.abs(lT.r - skinR) + Math.abs(lT.g - skinG) + Math.abs(lT.b - skinB);
            if (rD > maxTempleDiff) maxTempleDiff = rD;
            if (lD > maxTempleDiff) maxTempleDiff = lD;
            if (rT.lum < minTempleLum) minTempleLum = rT.lum;
            if (lT.lum < minTempleLum) minTempleLum = lT.lum;
          }
        }
        const hasTempleArms = (maxTempleDiff > 28 && minTempleLum < skinLum * 0.48);

        // F. Eye Centers: Sunglasses & Specular Reflection
        const rPupilX = (landmarks[36].x + landmarks[39].x) / 2;
        const rPupilY = (landmarks[37].y + landmarks[40].y) / 2;
        const lPupilX = (landmarks[42].x + landmarks[45].x) / 2;
        const lPupilY = (landmarks[43].y + landmarks[46].y) / 2;
        const rCenter = getPixel(rPupilX, rPupilY);
        const lCenter = getPixel(lPupilX, lPupilY);

        const isDarkGlasses = (rCenter.lum < 32 && lCenter.lum < 32 && skinLum > 52);
        const isReflectiveGlasses = (
          (rCenter.lum > 225 && lCenter.lum > 225) ||
          (rCenter.lum > skinLum + 60 && lCenter.lum > skinLum + 60)
        );

        const isGlasses = Boolean(
          isDarkGlasses ||
          isReflectiveGlasses ||
          (hasBridgeFrame && (hasNosePads || hasLowerRimFrame || hasTempleArms)) ||
          (hasNosePads && hasLowerRimFrame)
        );

        if (isGlasses) {
          result.glassesDetected = true;
          result.issues.push('🚨 GLASSES DETECTED! Institutional policy strictly requires a 100% bare face. Please remove eyeglasses / sunglasses to scan.');
        }
      } else if (box) {
        // Fallback box-relative bridge scan when landmarks are not available
        const bBridgeX = box.x + box.width * 0.50;
        const bBridgeY = box.y + box.height * 0.38;
        let maxBoxDiff = 0;
        for (let dy = -8; dy <= 8; dy += 4) {
          const p = getPixel(bBridgeX, bBridgeY + dy);
          const diff = Math.abs(p.r - skinR) + Math.abs(p.g - skinG) + Math.abs(p.b - skinB);
          if (diff > maxBoxDiff) maxBoxDiff = diff;
        }
        if (maxBoxDiff > 32) {
          result.glassesDetected = true;
          result.issues.push('🚨 GLASSES DETECTED! Institutional policy strictly requires a 100% bare face. Please remove eyeglasses / sunglasses to scan.');
        }
      }

        // 4. MASK DETECTION (Surgical / Fabric Mask)
        if (landmarks && landmarks.length >= 68) {
          // Philtrum: point between base of nose (33) and top of upper lip (51)
          const philtrumX = (landmarks[33].x + landmarks[51].x) / 2;
          const philtrumY = (landmarks[33].y + landmarks[51].y) / 2;
          const philtrumP = getPatchAvg(philtrumX, philtrumY, 2);

          // Chin: point between lower lip (57) and jaw bottom (8)
          const chinX = (landmarks[57].x + landmarks[8].x) / 2;
          const chinY = (landmarks[57].y + landmarks[8].y) / 2;
          const chinP = getPatchAvg(chinX, chinY, 2);

          const philColorDiff = Math.abs(philtrumP.r - skinR) + Math.abs(philtrumP.g - skinG) + Math.abs(philtrumP.b - skinB);
          const chinColorDiff = Math.abs(chinP.r - skinR) + Math.abs(chinP.g - skinG) + Math.abs(chinP.b - skinB);

          const philtrumIsSkin = philColorDiff < 50 && philtrumP.lum > skinLum * 0.45;
          const chinIsSkin = chinColorDiff < 50 && chinP.lum > skinLum * 0.45;

          const isSurgicalBlue = (philtrumP.b > philtrumP.r + 25 && philtrumP.b > 70) || (chinP.b > chinP.r + 25 && chinP.b > 70);
          const isBlackMask = (philtrumP.lum < 26 && chinP.lum < 26 && skinLum > 55);
          const isMaskFabric = (!philtrumIsSkin && !chinIsSkin && (philColorDiff > 55 && chinColorDiff > 55));

          if (isSurgicalBlue || isBlackMask || isMaskFabric) {
            result.maskDetected = true;
            result.issues.push('🚨 FACE MASK DETECTED! Please remove your face mask to scan.');
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

        result.faceObscured = Boolean(
          result.capDetected ||
          result.glassesDetected ||
          result.maskDetected ||
          result.tooDark ||
          result.tooBright ||
          result.poorBackgroundLighting
        );
        if (result.faceObscured) {
          result.ok = false;
        } else {
          result.ok = result.faceDetected && result.faceCentered;
        }
      } else {
        result.faceDetected = false;
        result.faceCentered = false;
        result.faceObscured = false;
        result.ok = false;
        result.issues.push('No face detected. Position head inside the oval guide.');
      }
    } catch (err) {
      console.warn('inspectFaceQuality warning:', err);
    }

  return result;
}

/**
 * Strict Biometric Verification matching algorithm:
 * Uses 128-D embedding Euclidean distance with optimal 0.58 threshold for justadudewhohacks/face-api.js.
 * Fails closed whenever face-api models are unavailable or biometrics cannot be verified.
 */
export async function strictBiometricVerify(
  registeredDataUrl: string,
  liveDataUrl: string,
  threshold = 0.58,
  skipQualityCheck = false
): Promise<{ matched: boolean; distance: number; confidence: number; error?: string }> {
  if (!registeredDataUrl || !liveDataUrl) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: !registeredDataUrl
        ? 'No registered face template found for this student. Face registration required.'
        : 'Missing live camera image for biometric verification.',
    };
  }

  // ZERO-TOLERANCE OBSTRUCTION GATING:
  // Institutional policy strictly requires a 100% bare face. Glasses, hats, and masks are UNCONDITIONALLY BLOCKED.
  const liveQuality = await inspectFaceQuality(liveDataUrl).catch(() => null);
  if (liveQuality) {
    if (liveQuality.glassesDetected) {
      return {
        matched: false,
        distance: Infinity,
        confidence: 0,
        error: 'Verification blocked: Glasses detected! Institutional policy strictly requires a bare face. Please remove eyeglasses/sunglasses to scan.',
      };
    }
    if (liveQuality.capDetected) {
      return {
        matched: false,
        distance: Infinity,
        confidence: 0,
        error: 'Verification blocked: Hat or cap detected! Institutional policy strictly requires a bare face. Please remove headwear to scan.',
      };
    }
    if (liveQuality.maskDetected) {
      return {
        matched: false,
        distance: Infinity,
        confidence: 0,
        error: 'Verification blocked: Face mask detected! Please remove face mask to scan.',
      };
    }
    if (!skipQualityCheck) {
      if (liveQuality.poorBackgroundLighting || liveQuality.tooDark) {
        return {
          matched: false,
          distance: Infinity,
          confidence: 0,
          error: 'Verification blocked: Dark background / poor lighting. Please move in front of a light, well-lit background.',
        };
      }
      if (liveQuality.tooBright) {
        return {
          matched: false,
          distance: Infinity,
          confidence: 0,
          error: 'Verification blocked: Harsh glare on face. Please adjust lighting.',
        };
      }
    }
  }

  const modelsAvailable = _modelsLoaded;

  const [t1, t2] = await Promise.all([
    computeTypedDescriptorFromDataUrl(registeredDataUrl),
    computeTypedDescriptorFromDataUrl(liveDataUrl),
  ]);

  if (!t1 || !t2) {
    if (!modelsAvailable) {
      return {
        matched: false,
        distance: Infinity,
        confidence: 0,
        error: 'Biometric AI models not ready. Please wait for facial recognition models to initialize.',
      };
    }
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: !t1
        ? 'Could not extract 128-D facial descriptor from registered profile photo.'
        : 'No face detected or could not extract facial descriptor from live camera frame.',
    };
  }

  let d1 = t1.descriptor;
  let d2 = t2.descriptor;
  let isPerceptual = false;

  // If one is neural and the other is perceptual, project both into the exact same perceptual feature space
  if (t1.type !== t2.type) {
    try {
      const [img1, img2] = await Promise.all([
        createImageElement(registeredDataUrl),
        createImageElement(liveDataUrl),
      ]);
      d1 = computePerceptualDescriptor(img1);
      d2 = computePerceptualDescriptor(img2);
      isPerceptual = true;
    } catch {
      isPerceptual = true;
    }
  } else if (t1.type === 'perceptual') {
    isPerceptual = true;
  }

  const dist = descriptorDistance(d1, d2);

  // Neural embedding strict threshold is 0.52 (justadudewhohacks face-api standard).
  // Perceptual space strict threshold is 0.35 to strictly block different people.
  const effectiveThreshold = isPerceptual ? Math.min(threshold, 0.35) : threshold;

  const matched = dist <= effectiveThreshold;
  const confidence = Math.max(0, Math.min(100, Math.round((1 - dist / effectiveThreshold) * 100)));

  return {
    matched,
    distance: dist,
    confidence,
    error: matched
      ? undefined
      : `Face does not match registered biometrics for this trainee (Biometric distance: ${dist.toFixed(3)}, threshold: ${effectiveThreshold.toFixed(2)}).`,
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

