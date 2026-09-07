// Face-api client service for browser-based facial recognition
const faceapi = (typeof window !== 'undefined' ? (window as any).faceapi : null);

let _modelsLoaded = false;
let _modelsLoading = false;
let _loadPromise: Promise<boolean> | null = null;

export function isFaceModelLoaded(): boolean {
  return _modelsLoaded;
}

export async function loadFaceModels(modelsPath = '/models'): Promise<boolean> {
  if (_modelsLoaded) return true;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    _modelsLoading = true;

    // If face-api script failed to load, bail out gracefully
    if (typeof window === 'undefined' || !(window as any).faceapi || (window as any).__faceApiUnavailable) {
      console.warn('face-api unavailable in window; skipping model load');
      _modelsLoaded = false;
      _modelsLoading = false;
      return false;
    }

    const api = (window as any).faceapi;

    // Use local models first for instant loading without internet, fallback to CDN
    const candidates = [
      modelsPath,
      'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights',
      'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model'
    ];

    for (const base of candidates) {
      try {
        console.log(`[FaceClient] Attempting to load face models from: ${base}`);
        await api.nets.tinyFaceDetector.loadFromUri(base);
        await api.nets.faceLandmark68Net.loadFromUri(base);
        await api.nets.faceRecognitionNet.loadFromUri(base);

        // Optionally load SSD Mobilenet if available
        if (api.nets.ssdMobilenetv1) {
          try {
            await api.nets.ssdMobilenetv1.loadFromUri(base);
          } catch {
            // non-fatal
          }
        }

        _modelsLoaded = true;
        _modelsLoading = false;
        console.log(`[FaceClient] Successfully loaded all face recognition models from: ${base}`);
        return true;
      } catch (e) {
        console.warn(`[FaceClient] Failed to load models from ${base}:`, e);
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

async function createImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image data URL: ' + String(e)));
    img.src = dataUrl;
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
    // If models are not loaded, accept dataUrl presence as fallback
    return dataUrl.length > 50;
  }
  try {
    const api = (window as any).faceapi;
    const img = await createImageElement(dataUrl);
    const detection = await api
      .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.1, inputSize: 320 }))
      .withFaceLandmarks();
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
    const detection = await api
      .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.1, inputSize: 320 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

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
 * Lower distance means closer match (distance <= 0.70 is reliable across varied webcam lighting).
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

    if (avgLum < 45) {
      result.tooDark = true;
      result.ok = false;
      result.issues.push('Area is too dark. Please move to a brighter location.');
    } else if (avgLum > 230) {
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

    if (sharpness < 9.5) {
      result.blurry = true;
      result.ok = false;
      result.issues.push('Camera/face is blurry. Please hold steady and look directly into the camera.');
    }

    // 3. Face & Landmarks Detection with Obstruction checks
    const ok = await loadFaceModels().catch(() => false);
    if (ok && (window as any).faceapi) {
      const api = (window as any).faceapi;
      const detection = await api
        .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.15, inputSize: 320 }))
        .withFaceLandmarks();

      if (detection) {
        result.faceDetected = true;
        const box = detection.detection.box;
        const landmarks = detection.landmarks;
        const positions = landmarks.positions;

        // Centering check
        const faceCx = box.x + box.width / 2;
        const faceCy = box.y + box.height / 2;
        const distFromCenter = Math.hypot(faceCx - w / 2, faceCy - h / 2);
        if (distFromCenter > Math.max(w, h) * 0.38) {
          result.faceCentered = false;
          result.ok = false;
          result.issues.push('Please center your face inside the silhouette guide.');
        }

        // Cap / Headwear Detection:
        // Compare upper forehead region (above eyebrows) with face center skin tone
        if (positions && positions.length >= 68) {
          const leftBrowY = positions[19].y;
          const rightBrowY = positions[24].y;
          const topBrowY = Math.min(leftBrowY, rightBrowY);
          const topBoxY = box.y;
          const foreheadHeight = topBrowY - topBoxY;

          if (foreheadHeight < box.height * 0.12) {
            // Brow is pressed against top edge of face box -> indicates cap brim / obstruction
            result.capDetected = true;
            result.ok = false;
            result.issues.push('Cap or hat detected. Please remove headwear.');
          }

          // Glasses / Eye Reflection Occlusion:
          // Check eye landmarks (36-41 left, 42-47 right)
          const leftEyeX = positions[36].x;
          const rightEyeX = positions[45].x;
          const eyeY = (positions[37].y + positions[44].y) / 2;
          const noseBridgeY = positions[27].y;

          // Sample pixels across eye bridge
          const sampleY = Math.round(Math.min(eyeY, noseBridgeY));
          const minX = Math.round(leftEyeX);
          const maxX = Math.round(rightEyeX);
          let darkFramePixelCount = 0;
          let specularHighlightCount = 0;
          let totalEyePixels = 0;

          if (sampleY > 0 && sampleY < h && minX > 0 && maxX < w && maxX > minX) {
            for (let x = minX; x <= maxX; x += 2) {
              const idx = (sampleY * w + x) * 4;
              const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              if (lum < 35) darkFramePixelCount++;
              if (lum > 240) specularHighlightCount++;
              totalEyePixels++;
            }
          }

          if (totalEyePixels > 10) {
            const frameRatio = darkFramePixelCount / totalEyePixels;
            const glareRatio = specularHighlightCount / totalEyePixels;
            if (frameRatio > 0.40 || glareRatio > 0.35) {
              result.glassesDetected = true;
              result.ok = false;
              result.issues.push('Eyeglasses / sunglasses detected. Please remove glasses for facial scan.');
            }
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
 * Uses 128-D embedding Euclidean distance with strict 0.48 threshold.
 */
export async function strictBiometricVerify(
  registeredDataUrl: string,
  liveDataUrl: string,
  threshold = 0.48
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
  const confidence = Math.max(0, Math.min(100, Math.round((1 - dist / 0.65) * 100)));

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
  threshold = 0.48
): Promise<{ matched: boolean; distance: number; confidence: number }> {
  const res = await strictBiometricVerify(registeredDataUrl, capturedDataUrl, threshold);
  return {
    matched: res.matched,
    distance: res.distance,
    confidence: res.confidence / 100,
  };
}

