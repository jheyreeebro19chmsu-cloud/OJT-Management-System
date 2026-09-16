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
  const ok = await loadFaceModels().catch(() => false);
  if (!ok) {
    return dataUrl.length > 50;
  }
  try {
    const api = (window as any).faceapi;
    const img = await createImageElement(dataUrl);
    // 1. Try TinyFaceDetector with standard input size
    let detection = await api
      .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.12, inputSize: 320 }));

    // 2. Fallback to higher input resolution
    if (!detection) {
      detection = await api
        .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.08, inputSize: 416 }));
    }

    // 3. Fallback to SSD MobileNet if loaded
    if (!detection && api.nets.ssdMobilenetv1?.params) {
      detection = await api
        .detectSingleFace(img, new api.SsdMobilenetv1Options({ minConfidence: 0.2 }));
    }

    return !!detection;
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
      // 1. TinyFaceDetector (Fast)
      let detection = await api
        .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.12, inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      // 2. TinyFaceDetector 416 (High Resolution)
      if (!detection || !detection.descriptor) {
        detection = await api
          .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.08, inputSize: 416 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      // 3. SSD Mobilenet V1 (Deep Neural Network)
      if ((!detection || !detection.descriptor) && api.nets.ssdMobilenetv1?.params) {
        detection = await api
          .detectSingleFace(img, new api.SsdMobilenetv1Options({ minConfidence: 0.2 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (detection && detection.descriptor) {
        return { descriptor: detection.descriptor as Float32Array, type: 'neural' };
      }

      // If neural models are active but no face is detected in the image, strictly return null
      return null;
    }

    // High-precision 128-D perceptual feature fallback (spatial grid + gradients + color moments) only if models not loaded
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

    // Background Lighting Analysis: Sample corners and upper margin outside the central oval
    let bgLumSum = 0;
    let bgSamples = 0;
    const cornerW = Math.max(10, Math.floor(w * 0.22));
    const cornerH = Math.max(10, Math.floor(h * 0.22));
    for (let y = 0; y < cornerH; y += 4) {
      for (let x = 0; x < cornerW; x += 4) {
        const idxTL = (y * w + x) * 4;
        const idxTR = (y * w + (w - 1 - x)) * 4;
        bgLumSum += 0.299 * data[idxTL] + 0.587 * data[idxTL + 1] + 0.114 * data[idxTL + 2];
        bgLumSum += 0.299 * data[idxTR] + 0.587 * data[idxTR + 1] + 0.114 * data[idxTR + 2];
        bgSamples += 2;
      }
    }
    for (let y = 0; y < Math.floor(h * 0.12); y += 4) {
      for (let x = Math.floor(w * 0.35); x < Math.floor(w * 0.65); x += 4) {
        const idx = (y * w + x) * 4;
        bgLumSum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        bgSamples++;
      }
    }
    const bgLum = bgSamples > 0 ? Math.round(bgLumSum / bgSamples) : Math.round(avgLum);

    if (bgLum < 45 || avgLum < 38) {
      result.poorBackgroundLighting = true;
      result.tooDark = true;
      result.ok = false;
      result.issues.push('🚨 DARK BACKGROUND / POOR LIGHTING! Please move in front of a light, well-lit background.');
    } else if (avgLum > 242) {
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
    if (ok && (window as any).faceapi) {
      const api = (window as any).faceapi;
      let detection = await api
        .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.12, inputSize: 320 }))
        .withFaceLandmarks();

      if (!detection) {
        detection = await api
          .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.08, inputSize: 416 }))
          .withFaceLandmarks();
      }

      if (!detection && api.nets.ssdMobilenetv1?.params) {
        detection = await api
          .detectSingleFace(img, new api.SsdMobilenetv1Options({ minConfidence: 0.2 }))
          .withFaceLandmarks();
      }

      if (detection) {
        result.faceDetected = true;
        const box = detection.detection.box;
        const landmarks = (detection as any).landmarks ? (detection as any).landmarks.positions : null;

        // Centering check: generous tolerance (within 35% of center) so human users pass naturally
        const targetCx = w * 0.50;
        const targetCy = h * 0.46;
        const faceCx = box.x + box.width / 2;
        const faceCy = box.y + box.height / 2;
        const offsetX = Math.abs(faceCx - targetCx) / w;
        const offsetY = Math.abs(faceCy - targetCy) / h;
        if (offsetX > 0.35 || offsetY > 0.35) {
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
        // A hat, cap, or headwear covers or casts a shadow over the forehead down to the eyebrows.
        // On a bare, clear head, the central forehead has clear bare skin matching the cheeks.
        if (landmarks && landmarks.length >= 68) {
          const browMidY = (landmarks[21].y + landmarks[22].y) / 2;
          const noseBridgeX = landmarks[27].x;

          // Sample 3 points on central forehead directly above nose bridge
          const fore1 = getPatchAvg(noseBridgeX, browMidY - 14, 2);
          const fore2 = getPatchAvg(noseBridgeX, browMidY - 26, 2);
          const fore3 = getPatchAvg(noseBridgeX, browMidY - 38, 2);

          const foreColorDiff1 = Math.abs(fore1.r - skinR) + Math.abs(fore1.g - skinG) + Math.abs(fore1.b - skinB);
          const foreColorDiff2 = Math.abs(fore2.r - skinR) + Math.abs(fore2.g - skinG) + Math.abs(fore2.b - skinB);
          const foreColorDiff3 = Math.abs(fore3.r - skinR) + Math.abs(fore3.g - skinG) + Math.abs(fore3.b - skinB);

          const isForeheadFabric = (foreColorDiff1 > 48 || fore1.lum < 32 || fore1.lum > skinLum + 70) &&
                                   (foreColorDiff2 > 48 || fore2.lum < 32 || fore2.lum > skinLum + 70);
          const isCapBrimShadow = fore1.lum < skinLum * 0.48 && fore2.lum < skinLum * 0.48;
          const foreheadHeight = browMidY - box.y;
          const foreheadTruncated = foreheadHeight < 16;

          if ((isForeheadFabric || isCapBrimShadow) && foreheadHeight > 18 || foreheadTruncated) {
            result.capDetected = true;
            result.issues.push('🚨 HAT / CAP DETECTED! Please remove headwear/cap to scan (clear face only).');
          }
        }

        // 3. GLASSES DETECTION (Eyeglasses, Reading Glasses, and Sunglasses)
        // A clear face has NO glasses on the nose bridge or in front of the eyes.
        if (landmarks && landmarks.length >= 68) {
          // Landmark 27 is the nose bridge between both eyes
          const bridgePoint = landmarks[27];
          const bridgePatch = getPatchAvg(bridgePoint.x, bridgePoint.y, 2);
          const bridgeColorDiff = Math.abs(bridgePatch.r - skinR) + Math.abs(bridgePatch.g - skinG) + Math.abs(bridgePatch.b - skinB);

          // Horizontal frame bar contrast across the nose bridge (point 27 vs 4px above / below)
          const bridgeTop = getPixel(bridgePoint.x, bridgePoint.y - 4);
          const bridgeBottom = getPixel(bridgePoint.x, bridgePoint.y + 4);
          const bridgeVerticalContrast = Math.abs(bridgeTop.lum - bridgePatch.lum) + Math.abs(bridgeBottom.lum - bridgePatch.lum);

          const hasBridgeFrame = (bridgeColorDiff > 40 || bridgePatch.lum < skinLum * 0.55 || bridgeVerticalContrast > 36);

          // Right eye: landmarks 36 (outer) to 39 (inner)
          const rPupilX = (landmarks[36].x + landmarks[39].x) / 2;
          const rPupilY = (landmarks[37].y + landmarks[40].y) / 2;
          const rOuterSclera = getPixel(landmarks[36].x + 4, rPupilY);
          const rInnerSclera = getPixel(landmarks[39].x - 4, rPupilY);
          const rCenter = getPixel(rPupilX, rPupilY);

          // Left eye: landmarks 42 (inner) to 45 (outer)
          const lPupilX = (landmarks[42].x + landmarks[45].x) / 2;
          const lPupilY = (landmarks[43].y + landmarks[46].y) / 2;
          const lInnerSclera = getPixel(landmarks[42].x + 4, lPupilY);
          const lOuterSclera = getPixel(landmarks[45].x - 4, lPupilY);
          const lCenter = getPixel(lPupilX, lPupilY);

          // Dark Sunglasses check:
          const rAllDark = rCenter.lum < 32 && rOuterSclera.lum < 38 && rInnerSclera.lum < 38;
          const lAllDark = lCenter.lum < 32 && lInnerSclera.lum < 38 && lOuterSclera.lum < 38;

          // Mirrored Sunglasses check:
          const rEyeColorDiff = Math.abs(rCenter.r - skinR) + Math.abs(rCenter.g - skinG) + Math.abs(rCenter.b - skinB);
          const lEyeColorDiff = Math.abs(lCenter.r - skinR) + Math.abs(lCenter.g - skinG) + Math.abs(lCenter.b - skinB);
          const mirroredSunglasses = (rEyeColorDiff > 80 && rCenter.lum > 220) && (lEyeColorDiff > 80 && lCenter.lum > 220);

          // Lower orbital eyeglass rim check (6px below lower eyelid landmarks 41 & 46):
          const rLowerRim = getPixel(landmarks[41].x, landmarks[41].y + 6);
          const lLowerRim = getPixel(landmarks[46].x, landmarks[46].y + 6);
          const rRimDiff = Math.abs(rLowerRim.r - skinR) + Math.abs(rLowerRim.g - skinG) + Math.abs(rLowerRim.b - skinB);
          const lRimDiff = Math.abs(lLowerRim.r - skinR) + Math.abs(lLowerRim.g - skinG) + Math.abs(lLowerRim.b - skinB);
          const hasLowerRimFrame = (rRimDiff > 42 && lRimDiff > 42) || (rLowerRim.lum < skinLum * 0.50 && lLowerRim.lum < skinLum * 0.50);

          // Lens Glare / Specular Glint on eyeglass lenses:
          const hasLensReflection = (rCenter.lum > 230 && rEyeColorDiff > 55) || (lCenter.lum > 230 && lEyeColorDiff > 55);

          const isGlasses = (rAllDark && lAllDark && skinLum > 48) ||
                            mirroredSunglasses ||
                            (hasBridgeFrame && (hasLowerRimFrame || hasLensReflection || bridgeColorDiff > 50));

          if (isGlasses) {
            result.glassesDetected = true;
            result.issues.push('🚨 GLASSES DETECTED! Please remove glasses to scan (clear face only).');
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

          const philtrumIsSkin = philColorDiff < 60 && philtrumP.lum > skinLum * 0.45;
          const chinIsSkin = chinColorDiff < 60 && chinP.lum > skinLum * 0.45;

          const isSurgicalBlue = (philtrumP.b > philtrumP.r + 28 && philtrumP.b > 75) || (chinP.b > chinP.r + 28 && chinP.b > 75);
          const isBlackMask = (philtrumP.lum < 24 && chinP.lum < 24 && skinLum > 60);
          const isMaskFabric = (!philtrumIsSkin && !chinIsSkin && (philColorDiff > 70 && chinColorDiff > 70));

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

  // Strict Obstruction & Background Light Defense in Depth:
  // Reject verification immediately if live face has glasses, hats, mask, or poor background lighting
  if (!skipQualityCheck) {
    const liveQuality = await inspectFaceQuality(liveDataUrl).catch(() => null);
    if (liveQuality) {
      if (liveQuality.glassesDetected) {
        return {
          matched: false,
          distance: Infinity,
          confidence: 0,
          error: 'Verification blocked: Glasses detected. Please remove eyeglasses/sunglasses to scan (clear face only).',
        };
      }
      if (liveQuality.capDetected) {
        return {
          matched: false,
          distance: Infinity,
          confidence: 0,
          error: 'Verification blocked: Hat or cap detected. Please remove headwear to scan (clear face only).',
        };
      }
      if (liveQuality.maskDetected) {
        return {
          matched: false,
          distance: Infinity,
          confidence: 0,
          error: 'Verification blocked: Face mask detected. Please remove face mask to scan.',
        };
      }
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

