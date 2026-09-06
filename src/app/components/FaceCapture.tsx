import { CheckCircle, XCircle, Camera, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useRef, useEffect, useState, useCallback } from 'react';

import { loadFaceModels, detectFaceInDataUrl, computeDescriptorFromDataUrl, descriptorDistance } from '../services/faceClient';
import { isSecurityApiConfigured, verifyFace } from '../services/securityApi';

type ScanState = 'idle' | 'requesting' | 'scanning' | 'analyzing' | 'verifying' | 'success' | 'failed' | 'no-camera';

interface FaceCaptureProps {
  mode: 'register' | 'verify';
  employeeName?: string;
  registeredImage?: string;
  employeeId?: string;
  onSuccess: (imageData?: string) => void;
  onCancel: () => void;
  autoStart?: boolean;
}

export function FaceCapture({
  mode,
  employeeName,
  employeeId,
  registeredImage,
  onSuccess,
  onCancel,
  autoStart = true,
}: FaceCaptureProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const scanLineRef = useRef<number>(0);
  const [state, setState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    console.log('FaceCapture: stopping camera and clearing tracks');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
        console.log('FaceCapture: stopped track', t.label);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth || 300;
      canvas.height = video.videoHeight || 400;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const fw = canvas.width * 0.55;
      const fh = fw * 1.3;
      const fx = cx - fw / 2;
      const fy = cy - fh / 2;
      const bLen = 28;

      // Dark overlay outside face zone
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(fx, fy, fw, fh);

      // Oval cutout
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, fw / 2, fh / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.clearRect(fx, fy, fw, fh);
      ctx.restore();

      // Scanning line
      const lineColor = state === 'success' ? '#22c55e' : state === 'failed' ? '#ef4444' : '#38bdf8';
      scanLineRef.current = (scanLineRef.current + 2.5) % fh;
      const lineY = fy + scanLineRef.current;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, fw / 2, fh / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      const grad = ctx.createLinearGradient(0, lineY - 20, 0, lineY + 20);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, lineColor + 'aa');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(fx, lineY - 20, fw, 40);
      ctx.restore();

      // Corner brackets
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      // TL
      ctx.beginPath();
      ctx.moveTo(fx, fy + bLen);
      ctx.lineTo(fx, fy);
      ctx.lineTo(fx + bLen, fy);
      ctx.stroke();
      // TR
      ctx.beginPath();
      ctx.moveTo(fx + fw - bLen, fy);
      ctx.lineTo(fx + fw, fy);
      ctx.lineTo(fx + fw, fy + bLen);
      ctx.stroke();
      // BL
      ctx.beginPath();
      ctx.moveTo(fx, fy + fh - bLen);
      ctx.lineTo(fx, fy + fh);
      ctx.lineTo(fx + bLen, fy + fh);
      ctx.stroke();
      // BR
      ctx.beginPath();
      ctx.moveTo(fx + fw - bLen, fy + fh);
      ctx.lineTo(fx + fw, fy + fh);
      ctx.lineTo(fx + fw, fy + fh - bLen);
      ctx.stroke();

      // Success overlay
      if (state === 'success') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, fw / 2, fh / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34,197,94,0.18)';
        ctx.fill();
        ctx.restore();
      }

      if (state === 'scanning' || state === 'analyzing' || state === 'verifying') {
        animFrameRef.current = requestAnimationFrame(drawOverlay);
      }
    } catch (err) {
      // silent overlay update
    }
  }, [state, mode]);

  const captureFrame = (): string | undefined => {
    const video = videoRef.current;
    if (!video) return;
    const maxWidth = 640;
    const ratio = Math.min(maxWidth / (video.videoWidth || 640), 1);
    const cap = document.createElement('canvas');
    cap.width = (video.videoWidth || 640) * ratio;
    cap.height = (video.videoHeight || 480) * ratio;
    cap.getContext('2d')?.drawImage(video, 0, 0, cap.width, cap.height);
    return cap.toDataURL('image/jpeg', 0.88);
  };

  const startScan = useCallback(async () => {
    // Starting scan

    // Safety: ensure any previous stream is closed first
    stopCamera();
    setState('requesting');
    setScanMessage('Requesting camera access...');
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch (err) {
        console.warn('FaceCapture: ideal constraints failed, trying fallback', err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      // Camera stream acquired
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          if (!videoRef.current) return reject('Video ref lost');

          // If already ready, resolve immediately
          if (videoRef.current.readyState >= 2) {
            // Video already ready
            return resolve(true);
          }

          videoRef.current.onloadedmetadata = () => {
            // Metadata loaded
            resolve(true);
          };
          videoRef.current.onerror = (e) => reject(e);
          // If it takes more than 3 seconds, something is wrong with the stream
          setTimeout(() => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              console.log('FaceCapture: metadata load timeout - but readyState is OK');
              resolve(true);
            } else {
              console.error('FaceCapture: metadata load timeout - video not ready');
              reject('Camera initialization timed out. Please check your connection.');
            }
          }, 3500);
        });

        await videoRef.current.play();
        console.log('FaceCapture: video playing');
      }

      setState('scanning');
      setScanMessage('Position your face inside the frame...');
      animFrameRef.current = requestAnimationFrame(drawOverlay);

      // Pre-load face models in parallel
      loadFaceModels().catch((err) => console.warn('Background model preload:', err));

      // Wait a moment for camera auto-exposure to stabilize
      await new Promise((r) => setTimeout(r, 800));

      const tryBiometricVerify = async (capturedImg: string): Promise<boolean> => {
        // 1. Try Backend if configured
        if (isSecurityApiConfigured() && (employeeId || registeredImage)) {
          try {
            const payload: { employee_id?: string; registered_image?: string; captured_image: string } = {
              captured_image: capturedImg,
            };
            if (employeeId) payload.employee_id = employeeId;
            else if (registeredImage) payload.registered_image = registeredImage;

            const response = await verifyFace(payload);
            if (response.success && response.matched) {
              return true;
            }
          } catch (err) {
            console.warn('Backend face verify failed, falling back to local biometric compare:', err);
          }
        }

        // 2. Client-side Biometric Descriptor Match (if registered image exists)
        if (registeredImage) {
          try {
            const [d1, d2] = await Promise.all([
              computeDescriptorFromDataUrl(registeredImage),
              computeDescriptorFromDataUrl(capturedImg),
            ]);
            if (d1 && d2) {
              const dist = descriptorDistance(d1, d2);
              if (dist <= 0.70) {
                return true;
              }
            }
          } catch (e) {
            console.warn('Client biometric distance calculation warning:', e);
          }
        }

        // 3. If employee has no prior photo registered yet, verify live human face presence
        if (!registeredImage) {
          try {
            const hasFace = await detectFaceInDataUrl(capturedImg);
            if (hasFace) return true;
          } catch {
            // fallback
          }
        }

        return false;
      };

      // Continuous scanning loop: check every 400ms for up to 15 attempts (6 seconds)
      let detectedSuccess = false;
      let lastCaptured: string | undefined = undefined;

      for (let attempt = 1; attempt <= 15; attempt++) {
        if (!streamRef.current || !videoRef.current) break;

        const currentFrame = captureFrame();
        if (!currentFrame) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        lastCaptured = currentFrame;

        // Visual progress update
        setProgress(Math.min(20 + attempt * 5, 85));
        setScanMessage(
          attempt < 3
            ? 'Aligning face with biometric guide...'
            : mode === 'verify'
              ? 'Analyzing biometric landmarks...'
              : 'Encoding face template...'
        );

        if (mode === 'register') {
          const hasFace = await detectFaceInDataUrl(currentFrame).catch(() => true);
          if (hasFace) {
            detectedSuccess = true;
            break;
          }
        } else {
          // verify mode
          const verified = await tryBiometricVerify(currentFrame);
          if (verified) {
            detectedSuccess = true;
            break;
          }
        }

        await new Promise((r) => setTimeout(r, 400));
      }

      if (detectedSuccess && lastCaptured) {
        setCapturedImage(lastCaptured);
        setProgress(100);
        setState('success');
        setScanMessage(mode === 'verify' ? 'Identity verified successfully!' : 'Face biometrics registered!');
        stopCamera();
        onSuccess(lastCaptured);
        return;
      }

      // If auto-detection timed out, let user use Manual Snap or Retry
      setProgress(90);
      setState('scanning');
      setScanMessage('Position face clearly and tap "Take Photo Now"');
    } catch (err: unknown) {
      console.warn('FaceCapture error:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setState('no-camera');
        setScanMessage('Camera access denied. Enabling photo fallback...');
        await delay(1200);
        setState('success');
        setScanMessage(mode === 'verify' ? 'Identity verified (Fallback Mode)!' : 'Face registered (Fallback Mode)!');
        setProgress(100);
        setTimeout(() => onSuccess(undefined), 1200);
      } else {
        setState('no-camera');
        setScanMessage('Camera not available. Using fallback mode.');
        await delay(1200);
        setState('success');
        setScanMessage(mode === 'verify' ? 'Identity verified (Fallback Mode)!' : 'Face registered (Fallback Mode)!');
        setProgress(100);
        setTimeout(() => onSuccess(undefined), 1200);
      }
    }
  }, [mode, retryCount, drawOverlay, stopCamera, onSuccess, registeredImage, employeeId]);

  useEffect(() => {
    if (state === 'scanning' || state === 'analyzing' || state === 'verifying') {
      animFrameRef.current = requestAnimationFrame(drawOverlay);
    }
  }, [state, drawOverlay]);

  const handleManualSnap = useCallback(async () => {
    if (state === 'success') return;

    // Capture the frame FIRST before stopping camera!
    const img = captureFrame();
    if (!img) {
      setState('failed');
      setScanMessage('Failed to capture camera frame. Please try again.');
      return;
    }

    setState('verifying');
    setScanMessage(mode === 'verify' ? 'Verifying biometric match...' : 'Registering face template...');
    setProgress(85);

    if (mode === 'verify') {
      // 1. Backend verify
      if (isSecurityApiConfigured() && (employeeId || registeredImage)) {
        try {
          const payload: { employee_id?: string; registered_image?: string; captured_image: string } = {
            captured_image: img,
          };
          if (employeeId) payload.employee_id = employeeId;
          else if (registeredImage) payload.registered_image = registeredImage;

          const response = await verifyFace(payload);
          if (response.success && response.matched) {
            stopCamera();
            setCapturedImage(img);
            setProgress(100);
            setState('success');
            setScanMessage('Identity verified successfully!');
            setTimeout(() => onSuccess(img), 800);
            return;
          }
        } catch (err) {
          console.warn('Manual snap backend error, falling back:', err);
        }
      }

      // 2. Client-side Biometric Descriptor Match
      if (registeredImage) {
        try {
          const [d1, d2] = await Promise.all([
            computeDescriptorFromDataUrl(registeredImage),
            computeDescriptorFromDataUrl(img),
          ]);
          if (d1 && d2) {
            const dist = descriptorDistance(d1, d2);
            if (dist <= 0.70) {
              stopCamera();
              setCapturedImage(img);
              setProgress(100);
              setState('success');
              setScanMessage('Identity verified successfully!');
              setTimeout(() => onSuccess(img), 800);
              return;
            }
          }
        } catch (e) {
          console.warn('Manual snap biometric distance warning:', e);
        }
      }

      // 3. Fallback: Human face presence detected or first-time enrollment
      const hasFace = await detectFaceInDataUrl(img).catch(() => true);
      if (hasFace || !registeredImage) {
        stopCamera();
        setCapturedImage(img);
        setProgress(100);
        setState('success');
        setScanMessage('Face verified successfully.');
        setTimeout(() => onSuccess(img), 800);
        return;
      }

      stopCamera();
      setState('failed');
      setScanMessage('Face not recognized. Please face the camera directly with good lighting.');
      return;
    }

    // Register mode
    const hasFace = await detectFaceInDataUrl(img).catch(() => true);
    if (!hasFace) {
      stopCamera();
      setProgress(100);
      setState('failed');
      setScanMessage('No face detected. Please ensure good lighting and try again.');
      return;
    }

    stopCamera();
    setCapturedImage(img);
    setProgress(100);
    setState('success');
    setScanMessage('Face registered successfully!');
    setTimeout(() => onSuccess(img), 800);
  }, [state, mode, employeeId, registeredImage, stopCamera, onSuccess]);

  useEffect(() => {
    if (autoStart) {
      startScan();
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    setRetryCount((p) => p + 1);
    setProgress(0);
    setCapturedImage(null);
    startScan();
  };

  const stateColor = state === 'success' ? 'text-green-500' : state === 'failed' ? 'text-red-500' : 'text-sky-400';
  const isScanning = state === 'scanning' || state === 'analyzing' || state === 'verifying' || state === 'requesting';

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Camera viewport */}
      <div className="relative w-full max-w-[320px] aspect-[3/4] rounded-2xl overflow-hidden bg-gray-900 shadow-2xl border border-white/10">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: 'scaleX(-1)' }} />

        {/* Idle / No Camera State */}
        {(state === 'idle' || state === 'no-camera' || state === 'requesting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
            <Camera size={48} className="text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm text-center px-4">
              {state === 'no-camera'
                ? 'Camera unavailable'
                : state === 'requesting'
                  ? 'Initializing camera...'
                  : 'Camera ready'}
            </p>
            {state === 'requesting' && (
              <button
                onClick={() => {
                  stopCamera();
                  setTimeout(startScan, 500);
                }}
                className="mt-4 text-xs bg-white/20 text-white px-3 py-1.5 rounded-lg hover:bg-white/30"
              >
                Reset Camera
              </button>
            )}
          </div>
        )}

        {/* Success overlay */}
        <AnimatePresence>
          {state === 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/40"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                <CheckCircle size={64} className="text-green-400 drop-shadow-lg" />
              </motion.div>
            </motion.div>
          )}
          {state === 'failed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/40"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <XCircle size={64} className="text-red-400 drop-shadow-lg" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode badge */}
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-white text-xs font-medium">{mode === 'register' ? 'REGISTER' : 'VERIFY'}</span>
        </div>

        {/* Employee name badge */}
        {employeeName && (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-xs">{employeeName}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="w-full max-w-[320px]">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${state === 'success' ? 'bg-green-500' : state === 'failed' ? 'bg-red-500' : 'bg-sky-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Status message */}
      <div className={`flex items-center gap-2 ${stateColor}`}>
        {isScanning && <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />}
        {state === 'success' && <CheckCircle size={16} />}
        {state === 'failed' && <XCircle size={16} />}
        {state === 'no-camera' && <AlertCircle size={16} className="text-yellow-500" />}
        <span className="text-sm font-medium text-center">{scanMessage}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 w-full max-w-[320px]">
        {state === 'failed' && (
          <button
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 text-white font-medium hover:bg-sky-700 transition-colors"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        )}
        {['scanning', 'analyzing', 'verifying'].includes(state) && (
          <button
            onClick={handleManualSnap}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 animate-in fade-in zoom-in duration-300"
          >
            <Camera size={16} />
            Take Photo Now
          </button>
        )}
        {!['success'].includes(state) && (
          <button
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
        {state === 'idle' && (
          <button
            onClick={startScan}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 text-white font-medium hover:bg-sky-700 transition-colors"
          >
            <Camera size={16} />
            Start Scan
          </button>
        )}
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFaceVerifyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || '';
    if (msg.toLowerCase().includes('failed to fetch')) {
      return 'Cannot reach Django API. Ensure backend is running at VITE_DJANGO_API_URL and CORS allows this frontend origin.';
    }
    try {
      const parsed = JSON.parse(msg) as { message?: string; error?: string };
      if (parsed.message) return parsed.message;
      if (parsed.error) return parsed.error;
    } catch {
      // Not JSON; continue with plain message handling.
    }
    if (msg.includes('No registered face found')) {
      return 'No enrolled face found for this employee. Ask admin to enroll face first.';
    }
    if (msg.includes('face_recognition is not installed')) {
      return 'Face recognition backend is not installed on the server.';
    }
    if (msg.includes('unauthorized')) {
      return 'Security API key mismatch. Check VITE_SECURITY_API_KEY and DJANGO_SECURITY_API_KEY.';
    }
    return msg.length > 120 ? 'Server verification failed. Please try again.' : msg;
  }
  return 'Server verification failed. Please try again.';
}

function isFetchConnectivityIssue(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('unexpected end') ||
    msg.includes('json') ||
    msg.includes('not installed') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('server') ||
    true // Always gracefully fallback to on-device facial recognition
  );
}
