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
  if (!ok) return false;
  try {
    const api = (window as any).faceapi;
    const img = await createImageElement(dataUrl);
    const detection = await api
      .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.15, inputSize: 224 }))
      .withFaceLandmarks();
    return !!detection;
  } catch (e) {
    console.warn('detectFaceInDataUrl error', e);
    return false;
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
      .detectSingleFace(img, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.15, inputSize: 224 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection && detection.descriptor) {
      return detection.descriptor as Float32Array;
    }
    return null;
  } catch (e) {
    console.warn('computeDescriptorFromDataUrl error', e);
    return null;
  }
}

/**
 * Euclidean distance between two 128-dimensional face descriptors
 * Lower distance means closer match (distance <= 0.6 is a standard match threshold).
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

/**
 * Verify matching between two face images (registered template vs live captured)
 */
export async function compareFaces(
  registeredDataUrl: string,
  capturedDataUrl: string,
  threshold = 0.6
): Promise<{ matched: boolean; distance: number; confidence: number }> {
  const [d1, d2] = await Promise.all([
    computeDescriptorFromDataUrl(registeredDataUrl),
    computeDescriptorFromDataUrl(capturedDataUrl),
  ]);

  if (!d1 || !d2) {
    return { matched: false, distance: Infinity, confidence: 0 };
  }

  const dist = descriptorDistance(d1, d2);
  const matched = dist <= threshold;
  const confidence = Math.max(0, Math.min(1, 1 - dist));

  return { matched, distance: dist, confidence };
}

