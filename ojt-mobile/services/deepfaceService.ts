/**
 * DeepFace Facial Recognition Service for React Native Mobile App
 *
 * Connects to the DeepFace AI backend (/check-face and /api/security/face/verify/)
 * with automatic on-device biometric neural fallback when offline.
 */

export type DeepFaceModel = 'VGG-Face' | 'Facenet' | 'ArcFace' | 'SFace';
export type DeepFaceDetector = 'opencv' | 'ssd' | 'mtcnn' | 'retinaface';

export interface DeepFaceVerifyOptions {
  modelName?: DeepFaceModel;
  detectorBackend?: DeepFaceDetector;
  distanceMetric?: 'cosine' | 'euclidean';
  employeeId?: string;
  timeoutMs?: number;
  blinkImage?: string;
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
  detector_backend: string;    // Detector used: 'retinaface', etc.
  similarity_metric: string;   // 'cosine' | 'euclidean'
  backend: 'deepface' | 'on-device-fallback';
  liveness_verified?: boolean;
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
  private defaultDetector: DeepFaceDetector = 'retinaface';

  public getDefaultModel(): DeepFaceModel {
    return this.defaultModel;
  }

  public setDefaultModel(model: DeepFaceModel) {
    this.defaultModel = model;
  }

  /**
   * Verify face pair using server-authoritative DeepFace AI models.
   * Compares registered template photo against live captured photo.
   * Fails closed if the backend is unreachable (no silent bypass to spoofable local fallback).
   */
  public async verifyFace(
    registeredImageBase64: string,
    capturedImageBase64: string,
    options: DeepFaceVerifyOptions = {}
  ): Promise<DeepFaceVerifyResult> {
    const timeout = options.timeoutMs || 7000;

    if (!registeredImageBase64 || !capturedImageBase64) {
      return {
        success: false,
        matched: false,
        verified: false,
        confidence: 0,
        similarity_percent: 0,
        distance: 1.0,
        threshold: 0.6,
        model: 'VGG-Face',
        detector_backend: 'retinaface',
        similarity_metric: 'cosine',
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

        if (options.blinkImage) {
          formData.append('blink_image', {
            uri: options.blinkImage.startsWith('data:')
              ? options.blinkImage
              : `data:image/jpeg;base64,${options.blinkImage}`,
            name: 'blink.jpg',
            type: 'image/jpeg',
          } as any);
        }

        // Server is authoritative: model_name, detector_backend, and distance_metric
        // are hardcoded server-side and no longer sent by the client.

        const res = await fetch(`${baseUrl}/check-face`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok || res.status === 422 || res.status === 400 || res.status === 404) {
          deepFaceResponse = await res.json();
          if (deepFaceResponse) {
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

        // Server is authoritative: only send images, employee_id, and server-side liveness proof.
        // model_name, detector_backend, distance_metric, and tolerance are enforced server-side.
        const res = await fetch(`${baseUrl}/api/security/face/verify/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registered_image: registeredImageBase64,
            captured_image: capturedImageBase64,
            employee_id: options.employeeId,
            blink_image: options.blinkImage,
            require_liveness: Boolean(options.blinkImage),
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok || res.status === 422 || res.status === 400 || res.status === 404) {
          deepFaceResponse = await res.json();
          if (deepFaceResponse) {
            break;
          }
        }
      } catch (djangoErr) {
        // Try next candidate URL
      }
    }

    // If DeepFace backend responded, parse authoritative response
    if (deepFaceResponse) {
      const isSuccess = deepFaceResponse.success !== false;
      const isMatched = Boolean(deepFaceResponse.matched || deepFaceResponse.verified);
      const dist = typeof deepFaceResponse.distance === 'number' ? deepFaceResponse.distance : (isMatched ? 0.25 : 0.85);
      const thresh = typeof deepFaceResponse.threshold === 'number' ? deepFaceResponse.threshold : (deepFaceResponse.tolerance || 0.6);
      const conf =
        typeof deepFaceResponse.confidence === 'number'
          ? deepFaceResponse.confidence
          : isMatched
          ? Math.max(0.7, 1.0 - dist / (thresh * 2))
          : 0.1;
      const simPercent =
        typeof deepFaceResponse.similarity_percent === 'number'
          ? deepFaceResponse.similarity_percent
          : Math.round(conf * 100);

      // If backend explicitly rejected (e.g., 422 No face detected, multiple faces, too dark, or mismatch)
      if (!isSuccess || !isMatched) {
        const errorMsg = deepFaceResponse.message || deepFaceResponse.error || 'Face verification failed.';
        return {
          success: isSuccess,
          matched: false,
          verified: false,
          confidence: Number(conf.toFixed(4)),
          similarity_percent: simPercent,
          distance: Number(dist.toFixed(4)),
          threshold: Number(thresh.toFixed(4)),
          model: deepFaceResponse.model || 'VGG-Face',
          detector_backend: deepFaceResponse.detector_backend || 'retinaface',
          similarity_metric: deepFaceResponse.similarity_metric || 'cosine',
          backend: 'deepface',
          message: errorMsg,
          error: errorMsg,
        };
      }

      return {
        success: true,
        matched: true,
        verified: true,
        confidence: Number(conf.toFixed(4)),
        similarity_percent: simPercent,
        distance: Number(dist.toFixed(4)),
        threshold: Number(thresh.toFixed(4)),
        model: deepFaceResponse.model || 'VGG-Face',
        detector_backend: deepFaceResponse.detector_backend || 'retinaface',
        similarity_metric: deepFaceResponse.similarity_metric || 'cosine',
        backend: 'deepface',
        message: `Biometric Verified: ${simPercent}% Match (Distance: ${dist.toFixed(2)} <= ${thresh})`,
      };
    }

    // 3. Fail-Closed: Do NOT silently fallback to on-device biometrics.
    // If every backend URL fails or times out, attendance is blocked with a clear message.
    console.warn('[DeepFace] Server unreachable. Blocking verification with fail-closed security.');
    return {
      success: false,
      matched: false,
      verified: false,
      confidence: 0,
      similarity_percent: 0,
      distance: 1.0,
      threshold: 0.60,
      model: 'Server Biometrics',
      detector_backend: 'retinaface',
      similarity_metric: 'cosine',
      backend: 'deepface',
      message: "Can't verify right now, check your connection and try again.",
      error: "Can't verify right now, check your connection and try again.",
    };
  }
}

export const deepfaceService = new DeepFaceService();
export default deepfaceService;
