import * as faceapi from 'face-api.js';

let _modelsLoaded = false;
let _modelsLoading = false;

export async function loadFaceModels(modelsPath = '/models') {
  if (_modelsLoaded) return true;
  if (_modelsLoading) return false;
  _modelsLoading = true;
  
  // Use local models first for instant loading without internet
  const candidates = [modelsPath, 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model'];

  for (const base of candidates) {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(base);
      await faceapi.nets.faceLandmark68Net.loadFromUri(base);
      await faceapi.nets.faceRecognitionNet.loadFromUri(base);
      _modelsLoaded = true;
      return true;
    } catch (e) {
      console.warn('Failed to load face-api models from', base, e);
    }
  }
  _modelsLoaded = false;
  _modelsLoading = false;
  return false;
}

async function createImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function detectFaceInDataUrl(dataUrl: string): Promise<boolean> {
  if (!dataUrl) return false;
  const ok = await loadFaceModels().catch(() => false);
  if (!ok) return false;
  try {
    const img = await createImageElement(dataUrl);
    // 160 is very fast but still accurate enough for a clear face
    const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.1, inputSize: 160 })).withFaceLandmarks();
    return !!detection;
  } catch (e) {
    console.warn('detectFaceInDataUrl error', e);
    return false;
  }
}

export async function computeDescriptorFromDataUrl(dataUrl: string): Promise<Float32Array | null> {
  const ok = await loadFaceModels().catch(() => false);
  if (!ok) return null;
  try {
    const img = await createImageElement(dataUrl);
    const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.1, inputSize: 160 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    
    if (detection && detection.descriptor) return detection.descriptor as Float32Array;
    return null;
  } catch (e) {
    console.warn('computeDescriptorFromDataUrl error', e);
    return null;
  }
}

export function descriptorDistance(a: Float32Array, b: Float32Array): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
