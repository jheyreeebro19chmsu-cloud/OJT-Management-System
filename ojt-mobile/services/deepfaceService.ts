/**
 * DeepFace Facial Recognition Service for React Native Mobile App
 *
 * Connects to the DeepFace AI backend (/check-face and /api/security/face/verify/)
 * with automatic on-device biometric neural fallback when offline.
 */

import { biometricService, BiometricMatchResult } from './biometricService';

export type DeepFaceModel = 'VGG-Face' | 'Facenet' | 'ArcFace' | 'SFace';
export type DeepFaceDetector = 'opencv' | 'ssd' | 'mtcnn' | 'retinaface';

export interface DeepFaceVerifyOptions {
  modelName?: DeepFaceModel;
  detectorBackend?: DeepFaceDetector;
  distanceMetric?: 'cosine' | 'euclidean';
  employeeId?: string;
  timeoutMs?: number;
}

export interface DeepFaceVerifyResult {
  success: boolean;
  matched: boolean;
  verified: boolean;
  confidence: number;          // 0.0 to 1.0 (e.g. 0.954)
  similarity_percent: number;  // 0.0 to 100.0 (e.g. 95.4)
  distance: number;            // Cosine or Euclidean distance
  threshold: number;           // Rejection threshold
  model: string;               // Model used: 'VGG-Face', 'Facenet', etc.
  detector_backend: string;    // Detector used: 'opencv', etc.
  similarity_metric: string;   // 'cosine' | 'euclidean'
  backend: 'deepface' | 'on-device-fallback';
  message: string;
  error?: string;
}

function resolveBackendUrls(): string[] {
  const envUrl =
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    process.env.EXPO_PUBLIC_DJANGO_API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    '';

  const urls: string[] = [];
  if (envUrl && envUrl.startsWith('http')) {
    urls.push(envUrl.replace(/\/+$/, ''));
  }

  // Render cloud production URL
  urls.push('https://ojt-management-system-capstone-f35i.onrender.com');

  // Local development backends (Android emulator & iOS simulator/LAN)
  urls.push('http://10.0.2.2:5000'); // Flask emulator
  urls.push('http://10.0.2.2:8000'); // Django emulator
  urls.push('http://localhost:5000');
  urls.push('http://localhost:8000');

  return Array.from(new Set(urls));
}

class DeepFaceService {
  private defaultModel: DeepFaceModel = 'VGG-Face';
  private defaultDetector: DeepFaceDetector = 'opencv';

  public getDefaultModel(): DeepFaceModel {
    return this.defaultModel;
  }

  public setDefaultModel(model: DeepFaceModel) {
    this.defaultModel = model;
  }

  /**
   * Verify face pair using DeepFace AI models.
   * Compares registered template photo against live captured photo.
   * Falls back seamlessly to on-device biometrics if the backend is unreachable.
   */
  public async verifyFace(
    registeredImageBase64: string,
    capturedImageBase64: string,
    options: DeepFaceVerifyOptions = {}
  ): Promise<DeepFaceVerifyResult> {
    const model = options.modelName || this.defaultModel;
    const detector = options.detectorBackend || this.defaultDetector;
    const metric = options.distanceMetric || 'cosine';
    const timeout = options.timeoutMs || 7000;

    if (!registeredImageBase64 || !capturedImageBase64) {
      return {
        success: false,
        matched: false,
        verified: false,
        confidence: 0,
        similarity_percent: 0,
        distance: 1.0,
        threshold: 0.4,
        model,
        detector_backend: detector,
        similarity_metric: metric,
        backend: 'deepface',
        message: 'Missing reference or captured face photo.',
        error: 'Missing image inputs',
      };
    }

    const candidateUrls = resolveBackendUrls();
    let deepFaceResponse: any = null;

    for (const baseUrl of candidateUrls) {
      // 1. Try Flask endpoint /check-face
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const formData = new FormData();
        formData.append('registered_image', {
          uri: registeredImageBase64.startsWith('http')
            ? registeredImageBase64
            : registeredImageBase64.startsWith('data:')
            ? registeredImageBase64
            : `data:image/jpeg;base64,${registeredImageBase64}`,
          name: 'registered.jpg',
          type: 'image/jpeg',
        } as any);

        formData.append('captured_image', {
          uri: capturedImageBase64.startsWith('data:')
            ? capturedImageBase64
            : `data:image/jpeg;base64,${capturedImageBase64}`,
          name: 'captured.jpg',
          type: 'image/jpeg',
        } as any);

        formData.append('model_name', model);
        formData.append('detector_backend', detector);

        const res = await fetch(`${baseUrl}/check-face`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
          deepFaceResponse = await res.json();
          if (deepFaceResponse && (deepFaceResponse.success || deepFaceResponse.matched !== undefined)) {
            break;
          }
        }
      } catch (flaskErr) {
        // Continue to Django endpoint
      }

      // 2. Try Django endpoint /api/security/face/verify/
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const res = await fetch(`${baseUrl}/api/security/face/verify/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registered_image: registeredImageBase64,
            captured_image: capturedImageBase64,
            employee_id: options.employeeId,
            model_name: model,
            detector_backend: detector,
            distance_metric: metric,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
          deepFaceResponse = await res.json();
          if (deepFaceResponse && (deepFaceResponse.success || deepFaceResponse.matched !== undefined)) {
            break;
          }
        }
      } catch (djangoErr) {
        // Try next candidate URL
      }
    }

    // If DeepFace backend responded successfully, parse response
    if (deepFaceResponse && (deepFaceResponse.success !== false || deepFaceResponse.matched !== undefined)) {
      const isMatched = Boolean(deepFaceResponse.matched || deepFaceResponse.verified);
      const dist = typeof deepFaceResponse.distance === 'number' ? deepFaceResponse.distance : 0.25;
      const thresh = typeof deepFaceResponse.threshold === 'number' ? deepFaceResponse.threshold : 0.4;
      const conf =
        typeof deepFaceResponse.confidence === 'number'
          ? deepFaceResponse.confidence
          : isMatched
          ? Math.max(0.7, 1.0 - dist / (thresh * 2))
          : 0.2;
      const simPercent =
        typeof deepFaceResponse.similarity_percent === 'number'
          ? deepFaceResponse.similarity_percent
          : Math.round(conf * 100);

      return {
        success: true,
        matched: isMatched,
        verified: isMatched,
        confidence: Number(conf.toFixed(4)),
        similarity_percent: simPercent,
        distance: Number(dist.toFixed(4)),
        threshold: Number(thresh.toFixed(4)),
        model: deepFaceResponse.model || model,
        detector_backend: deepFaceResponse.detector_backend || detector,
        similarity_metric: deepFaceResponse.similarity_metric || metric,
        backend: 'deepface',
        message: isMatched
          ? `DeepFace Verified (${model}): ${simPercent}% Match (Cosine Dist: ${dist.toFixed(2)} < ${thresh})`
          : `DeepFace Mismatch: ${simPercent}% Similarity (Distance: ${dist.toFixed(2)} >= ${thresh})`,
      };
    }

    // 3. Seamless On-Device Fallback (face-api.js neural bridge)
    console.warn('[DeepFace] Backend unavailable, running on-device biometric neural verification...');
    const localResult: BiometricMatchResult = await biometricService.verifyBiometrics(
      registeredImageBase64,
      capturedImageBase64,
      0.62
    );

    const isLocalMatch = Boolean(localResult.matched);
    const localDist = typeof localResult.distance === 'number' && isFinite(localResult.distance)
      ? localResult.distance
      : isLocalMatch
      ? 0.35
      : 0.85;
    const localConf = localResult.confidence ? localResult.confidence / 100 : isLocalMatch ? 0.9 : 0.2;
    const localPercent = localResult.confidence || Math.round(localConf * 100);

    return {
      success: true,
      matched: isLocalMatch,
      verified: isLocalMatch,
      confidence: Number(localConf.toFixed(4)),
      similarity_percent: localPercent,
      distance: Number(localDist.toFixed(4)),
      threshold: 0.62,
      model: `${model} (On-Device Neural Engine)`,
      detector_backend: 'TinyFaceDetector',
      similarity_metric: 'euclidean',
      backend: 'on-device-fallback',
      message: isLocalMatch
        ? `Biometric Verified: ${localPercent}% Match (Neural Dist: ${localDist.toFixed(2)})`
        : `Biometric Mismatch (Dist: ${localDist.toFixed(2)} > 0.62)`,
      error: localResult.error,
    };
  }
}

export const deepfaceService = new DeepFaceService();
export default deepfaceService;
