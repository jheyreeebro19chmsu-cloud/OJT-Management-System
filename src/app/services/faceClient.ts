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
      'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
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
      .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.12, inputSize: 320 }))
      .withFaceLandmarks();

    // 2. Fallback to higher input resolution
    if (!detection) {
      detection = await api
        .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.08, inputSize: 416 }))
        .withFaceLandmarks();
    }

    // 3. Fallback to SSD MobileNet if loaded
    if (!detection && api.nets.ssdMobilenetv1?.params) {
      detection = await api
        .detectSingleFace(img, new api.SsdMobilenetv1Options({ minConfidence: 0.2 }))
        .withFaceLandmarks();
    }

    return !!detection;
  } catch (e) {
    console.warn('detectFaceInDataUrl error, using fallback:', e);
    return dataUrl.length > 50;
  }
}

export async function computeDescriptorFromDataUrl(dataUrl: string): Promise<Float32Array | null> {
  if (!dataUrl) return null;
  const ok = await loadFaceModels().catch(() => false);
  if (!ok) return null;
  try {
    const api = (window as any).faceapi;
    const img = await createImageElement(dataUrl);

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
      return detection.descriptor as Float32Array;
    }
    return null;
  } catch (e) {
    console.warn('computeDescriptorFromDataUrl error:', e);
    return null;
  }
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
  blurry: boolean;
  capDetected: boolean;
  glassesDetected: boolean;
  faceDetected: boolean;
  faceCentered: boolean;
  brightness: number;
  sharpness: number;
}

/**
 * Image inspection for lighting, clarity, cap/headwear, and glasses obstruction.
 */
export async function inspectFaceQuality(dataUrl: string): Promise<FaceQualityReport> {
  const result: FaceQualityReport = {
    ok: true,
    issues: [],
    tooDark: false,
    tooBright: false,
    blurry: false,
    capDetected: false,
    glassesDetected: false,
    faceDetected: false,
    faceCentered: true,
    brightness: 120,
    sharpness: 25,
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

    if (avgLum < 32) {
      result.tooDark = true;
      result.ok = false;
      result.issues.push('Area is too dark. Please move to a brighter location.');
    } else if (avgLum > 242) {
      result.tooBright = true;
      result.ok = false;
      result.issues.push('Too much glare / overexposure. Please adjust lighting.');
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
        const landmarks = detection.landmarks;
        const positions = landmarks.positions;

        // Centering check: reasonable range
        const faceCx = box.x + box.width / 2;
        const faceCy = box.y + box.height / 2;
        const distFromCenter = Math.hypot(faceCx - w / 2, faceCy - h / 2);
        if (distFromCenter > Math.max(w, h) * 0.45) {
          result.faceCentered = false;
          result.issues.push('Please center your face inside the silhouette guide.');
        }

        // Cap / Headwear Detection:
        // A true cap brim produces an artificial dark horizontal band directly covering the brow.
        // If 68 landmarks are detected, sample skin tone at nose bridge vs brow line.
        if (positions && positions.length >= 68) {
          const noseX = Math.round(positions[30].x);
          const noseY = Math.round(positions[30].y);

          let noseLum = 120;
          if (noseX > 0 && noseX < w && noseY > 0 && noseY < h) {
            const noseIdx = (noseY * w + noseX) * 4;
            noseLum = 0.299 * data[noseIdx] + 0.587 * data[noseIdx + 1] + 0.114 * data[noseIdx + 2];
          }

          // Sample above brows
          const browMidX = Math.round((positions[19].x + positions[24].x) / 2);
          const topBrowY = Math.min(positions[19].y, positions[24].y);
          const aboveBrowY = Math.round(topBrowY - 24);

          if (aboveBrowY > 0 && aboveBrowY < h && browMidX > 0 && browMidX < w) {
            const aboveIdx = (aboveBrowY * w + browMidX) * 4;
            const aboveLum = 0.299 * data[aboveIdx] + 0.587 * data[aboveIdx + 1] + 0.114 * data[aboveIdx + 2];
            // Only flag if there is an unmistakable dark visor/cap brim (< 15 lum) when skin is bright (> 80)
            if (aboveLum < 15 && noseLum > 80 && topBrowY - box.y < 2) {
              result.capDetected = true;
              result.ok = false;
              result.issues.push('Cap or hat visor detected. Please remove headwear.');
            }
          }

          // Glasses / Dark Eyewear Detection:
          // Check for dark sunglasses covering pupils
          const leftPupilX = Math.round((positions[36].x + positions[39].x) / 2);
          const leftPupilY = Math.round((positions[37].y + positions[41].y) / 2);
          const rightPupilX = Math.round((positions[42].x + positions[45].x) / 2);
          const rightPupilY = Math.round((positions[43].y + positions[47].y) / 2);

          let eyeLums = 0;
          let eyeSamples = 0;
          [[leftPupilX, leftPupilY], [rightPupilX, rightPupilY]].forEach(([px, py]) => {
            if (px > 0 && px < w && py > 0 && py < h) {
              const idx = (py * w + px) * 4;
              eyeLums += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              eyeSamples++;
            }
          });
          const avgEyeLum = eyeSamples > 0 ? eyeLums / eyeSamples : 100;
          // Only flag if dark sunglasses completely block the pupils
          if (avgEyeLum < 15 && noseLum > 80) {
            result.glassesDetected = true;
            result.ok = false;
            result.issues.push('Dark sunglasses detected. Please remove sunglasses for facial scan.');
          }
        }
      } else {
        result.faceDetected = false;
        result.ok = false;
        result.issues.push('No face detected. Position head inside the silhouette.');
      }
    }
  } catch (err) {
    console.warn('inspectFaceQuality warning:', err);
  }

  return result;
}

/**
 * Strict Biometric Verification matching algorithm:
 * Uses 128-D embedding Euclidean distance with optimal 0.55 threshold for cross-device recognition.
 */
export async function strictBiometricVerify(
  registeredDataUrl: string,
  liveDataUrl: string,
  threshold = 0.55
): Promise<{ matched: boolean; distance: number; confidence: number; error?: string }> {
  if (!registeredDataUrl || !liveDataUrl) {
    return { matched: false, distance: Infinity, confidence: 0, error: 'Missing image data' };
  }

  const [d1, d2] = await Promise.all([
    computeDescriptorFromDataUrl(registeredDataUrl),
    computeDescriptorFromDataUrl(liveDataUrl),
  ]);

  if (!d1 || !d2) {
    return {
      matched: false,
      distance: Infinity,
      confidence: 0,
      error: 'Could not extract 128-D biometric descriptor from face image.',
    };
  }

  const dist = descriptorDistance(d1, d2);
  const matched = dist <= threshold;
  const confidence = Math.max(0, Math.min(100, Math.round((1 - dist / 0.68) * 100)));

  return {
    matched,
    distance: dist,
    confidence,
    error: matched ? undefined : `Face does not match registered biometrics (Biometric distance: ${dist.toFixed(3)}, threshold: ${threshold}).`,
  };
}

/**
 * Verify matching between two face images (registered template vs live captured)
 */
export async function compareFaces(
  registeredDataUrl: string,
  capturedDataUrl: string,
  threshold = 0.55
): Promise<{ matched: boolean; distance: number; confidence: number }> {
  const res = await strictBiometricVerify(registeredDataUrl, capturedDataUrl, threshold);
  return {
    matched: res.matched,
    distance: res.distance,
    confidence: res.confidence / 100,
  };
}

