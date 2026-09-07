import {
  CheckCircle,
  XCircle,
  Camera,
  RefreshCw,
  AlertCircle,
  Sun,
  Eye,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useRef, useEffect, useState, useCallback } from 'react';

import {
  loadFaceModels,
  detectFaceInDataUrl,
  computeDescriptorFromDataUrl,
  strictBiometricVerify,
  inspectFaceQuality,
  type FaceQualityReport,
} from '../services/faceClient';
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
  const animFrameRef = useRef<number | null>(null);
  const scanLineRef = useRef<number>(0);
  const [state, setState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<FaceQualityReport | null>(null);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  const stateRef = useRef<ScanState>(state);
  const qualityReportRef = useRef<FaceQualityReport | null>(qualityReport);
  const mismatchErrorRef = useRef<string | null>(mismatchError);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    qualityReportRef.current = qualityReport;
  }, [qualityReport]);

  useEffect(() => {
    mismatchErrorRef.current = mismatchError;
  }, [mismatchError]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
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

  /**
   * Render custom human head-to-neck silhouette with oval face framing
   * Optimized to avoid canvas buffer resets and eliminate all flickering/flashing
   */
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const targetW = video.videoWidth || 320;
      const targetH = video.videoHeight || 420;
      if (canvas.width !== targetW) canvas.width = targetW;
      if (canvas.height !== targetH) canvas.height = targetH;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height * 0.40;
      const headRadiusX = canvas.width * 0.26;
      const headRadiusY = headRadiusX * 1.30;
      const neckTopY = cy + headRadiusY * 0.70;
      const neckWidth = headRadiusX * 0.65;
      const shoulderBottomY = canvas.height;
      const shoulderWidth = canvas.width * 0.85;

      const currentState = stateRef.current;
      const currentQuality = qualityReportRef.current;
      const currentMismatch = mismatchErrorRef.current;

      // 1. Dark Backdrop Outside Human Silhouette
      ctx.fillStyle = 'rgba(10, 15, 29, 0.65)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Cutout Human Head-to-Neck Silhouette
      ctx.save();
      ctx.beginPath();
      // Head Oval
      ctx.ellipse(cx, cy, headRadiusX, headRadiusY, 0, 0, Math.PI * 2);
      // Neck & Shoulders
      ctx.moveTo(cx - neckWidth / 2, neckTopY);
      ctx.lineTo(cx - neckWidth / 2, neckTopY + 35);
      ctx.bezierCurveTo(
        cx - neckWidth / 2 - 20,
        neckTopY + 55,
        cx - shoulderWidth / 2 + 30,
        shoulderBottomY - 20,
        cx - shoulderWidth / 2,
        shoulderBottomY
      );
      ctx.lineTo(cx + shoulderWidth / 2, shoulderBottomY);
      ctx.bezierCurveTo(
        cx + shoulderWidth / 2 - 30,
        shoulderBottomY - 20,
        cx + neckWidth / 2 + 20,
        neckTopY + 55,
        cx + neckWidth / 2,
        neckTopY + 35
      );
      ctx.lineTo(cx + neckWidth / 2, neckTopY);
      ctx.clip();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 3. Scanning Laser Line within silhouette
      const lineColor =
        currentState === 'success'
          ? '#22c55e'
          : currentState === 'failed' || currentMismatch
            ? '#ef4444'
            : currentQuality && !currentQuality.ok
              ? '#f59e0b'
              : '#00e5ff';

      const scanRange = headRadiusY * 2.2;
      scanLineRef.current = (scanLineRef.current + 2.5) % scanRange;
      const currentScanY = cy - headRadiusY + scanLineRef.current;

      const laserGrad = ctx.createLinearGradient(0, currentScanY - 16, 0, currentScanY + 16);
      laserGrad.addColorStop(0, 'transparent');
      laserGrad.addColorStop(0.5, lineColor + 'aa');
      laserGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = laserGrad;
      ctx.fillRect(0, currentScanY - 16, canvas.width, 32);

      // Laser thin bright center line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - headRadiusX - 10, currentScanY);
      ctx.lineTo(cx + headRadiusX + 10, currentScanY);
      ctx.stroke();

      ctx.restore();

      // 4. Glowing Head-to-Neck Silhouette Contour Border
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;

      // Draw Head Oval Outline
      ctx.beginPath();
      ctx.ellipse(cx, cy, headRadiusX, headRadiusY, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Neck & Shoulders Outline
      ctx.beginPath();
      ctx.moveTo(cx - neckWidth / 2, neckTopY);
      ctx.lineTo(cx - neckWidth / 2, neckTopY + 35);
      ctx.bezierCurveTo(
        cx - neckWidth / 2 - 20,
        neckTopY + 55,
        cx - shoulderWidth / 2 + 30,
        shoulderBottomY - 20,
        cx - shoulderWidth / 2,
        shoulderBottomY
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + neckWidth / 2, neckTopY);
      ctx.lineTo(cx + neckWidth / 2, neckTopY + 35);
      ctx.bezierCurveTo(
        cx + neckWidth / 2 + 20,
        neckTopY + 55,
        cx + shoulderWidth / 2 - 30,
        shoulderBottomY - 20,
        cx + shoulderWidth / 2,
        shoulderBottomY
      );
      ctx.stroke();

      // Chin alignment notch
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + headRadiusY + 2);
      ctx.lineTo(cx + 15, cy + headRadiusY + 2);
      ctx.stroke();

      // Forehead alignment notch
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - headRadiusY - 2);
      ctx.lineTo(cx + 15, cy - headRadiusY - 2);
      ctx.stroke();

      ctx.restore();

      // 5. Success Glow
      if (currentState === 'success') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, headRadiusX, headRadiusY, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
        ctx.fill();
        ctx.restore();
      }

      if (currentState === 'scanning' || currentState === 'analyzing' || currentState === 'verifying') {
        animFrameRef.current = requestAnimationFrame(drawOverlay);
      }
    } catch {
      // silent overlay catch
    }
  }, []);

  const captureFrame = (): string | undefined => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxWidth = 640;
    const ratio = Math.min(maxWidth / (video.videoWidth || 640), 1);
    const cap = document.createElement('canvas');
    cap.width = (video.videoWidth || 640) * ratio;
    cap.height = (video.videoHeight || 480) * ratio;
    cap.getContext('2d')?.drawImage(video, 0, 0, cap.width, cap.height);
    return cap.toDataURL('image/jpeg', 0.90);
  };

  const startScan = useCallback(async () => {
    stopCamera();
    setState('requesting');
    setMismatchError(null);
    setQualityReport(null);
    setScanMessage('Requesting camera access...');

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();
          videoRef.current.onloadedmetadata = () => resolve();
          setTimeout(resolve, 800);
        });
        await videoRef.current.play().catch(() => {});
      }

      setState('scanning');
      setScanMessage('Position your head inside the silhouette guide...');
      setProgress(15);

      // Pre-load biometric recognition models in parallel
      loadFaceModels().catch(() => {});

      let detectedSuccess = false;
      let lastCaptured: string | undefined = undefined;

      // Continuous scanning loop: inspect frame every 400ms for up to 25 attempts (~10 seconds)
      for (let attempt = 1; attempt <= 25; attempt++) {
        if (!streamRef.current || !videoRef.current) break;

        const currentFrame = captureFrame();
        if (!currentFrame) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        lastCaptured = currentFrame;

        // Visual progress update
        setProgress(Math.min(20 + attempt * 3, 85));

        // 1. Comprehensive Face Quality & Obstruction Inspection
        const quality = await inspectFaceQuality(currentFrame);
        setQualityReport(quality);

        if (!quality.ok) {
          if (quality.tooDark) {
            setScanMessage('⚠️ Too dark! Move to a well-lit area.');
          } else if (quality.tooBright) {
            setScanMessage('⚠️ Too bright! Avoid harsh glare on face.');
          } else if (quality.capDetected) {
            setScanMessage('⚠️ Cap / hat detected! Please remove headwear.');
          } else if (quality.glassesDetected) {
            setScanMessage('⚠️ Glasses detected! Please remove eyeglasses.');
          } else if (quality.blurry) {
            setScanMessage('⚠️ Blurry! Hold still and face the camera directly.');
          } else if (!quality.faceDetected) {
            setScanMessage('Align face & shoulders inside the silhouette...');
          }
          await new Promise((r) => setTimeout(r, 450));
          continue;
        }

        // Quality is OK! Face is clear, well-lit, unobstructed
        setScanMessage(
          mode === 'verify' ? 'Biometrics detected. Verifying trainee identity...' : 'Encoding biometric facial template...'
        );

        if (mode === 'register') {
          const hasFace = await detectFaceInDataUrl(currentFrame).catch(() => true);
          if (hasFace) {
            detectedSuccess = true;
            break;
          }
        } else {
          // Verify mode: strict biometric matching against enrolled image
          if (registeredImage) {
            const bio = await strictBiometricVerify(registeredImage, currentFrame, 0.48);
            if (bio.matched) {
              setMismatchError(null);
              detectedSuccess = true;
              break;
            } else {
              setMismatchError(`Biometric Mismatch: Face does not match registered profile.`);
              setScanMessage(`❌ Face mismatch! Distance: ${bio.distance.toFixed(2)} (Must be ≤ 0.48)`);
            }
          } else {
            // First time enrollment check
            detectedSuccess = true;
            break;
          }
        }

        await new Promise((r) => setTimeout(r, 450));
      }

      if (detectedSuccess && lastCaptured) {
        setCapturedImage(lastCaptured);
        setProgress(100);
        setState('success');
        setScanMessage(mode === 'verify' ? '✓ Identity Verified! Timestamp Saved.' : '✓ Face Biometrics Registered!');
        stopCamera();
        setTimeout(() => onSuccess(lastCaptured), 800);
        return;
      }

      // If loop ended without match or obstruction resolved
      setProgress(90);
      setState('scanning');
      if (mismatchError) {
        setScanMessage('Identity mismatch. Please look straight into camera or tap Take Photo.');
      } else {
        setScanMessage('Remove caps/glasses, ensure good lighting, and tap Take Photo.');
      }
    } catch (err) {
      console.warn('FaceCapture error:', err);
      setState('no-camera');
      setScanMessage('Camera unavailable. Please allow camera permissions.');
    }
  }, [mode, stopCamera, onSuccess, registeredImage]);

  useEffect(() => {
    if (state === 'scanning' || state === 'analyzing' || state === 'verifying') {
      animFrameRef.current = requestAnimationFrame(drawOverlay);
    }
  }, [state, drawOverlay]);

  const handleManualSnap = useCallback(async () => {
    if (state === 'success') return;

    const img = captureFrame();
    if (!img) {
      setState('failed');
      setScanMessage('Failed to capture frame. Please try again.');
      return;
    }

    setState('verifying');
    setScanMessage('Checking lighting, obstructions, and biometric match...');
    setProgress(75);

    // 1. Check Quality & Obstructions
    const quality = await inspectFaceQuality(img);
    setQualityReport(quality);

    if (!quality.ok) {
      setState('scanning');
      if (quality.tooDark) {
        setScanMessage('❌ Rejected: Environment is too dark. Please move to a brighter location.');
      } else if (quality.capDetected) {
        setScanMessage('❌ Rejected: Cap / hat detected. Please remove headwear.');
      } else if (quality.glassesDetected) {
        setScanMessage('❌ Rejected: Glasses detected. Please remove glasses for facial scan.');
      } else if (quality.blurry) {
        setScanMessage('❌ Rejected: Face is blurry. Hold camera steady.');
      } else {
        setScanMessage('❌ Rejected: ' + quality.issues.join('; '));
      }
      return;
    }

    // 2. Strict Biometric Match in Verify Mode
    if (mode === 'verify') {
      if (registeredImage) {
        const bio = await strictBiometricVerify(registeredImage, img, 0.48);
        if (!bio.matched) {
          setState('failed');
          setMismatchError(`Face does not match registered biometrics for ${employeeName || 'this student'}.`);
          setScanMessage(`❌ Access Denied: Biometrics mismatch (Distance: ${bio.distance.toFixed(2)})`);
          return;
        }
      }

      // Check backend security API if available
      if (isSecurityApiConfigured() && (employeeId || registeredImage)) {
        try {
          const payload: { employee_id?: string; registered_image?: string; captured_image: string } = {
            captured_image: img,
          };
          if (employeeId) payload.employee_id = employeeId;
          else if (registeredImage) payload.registered_image = registeredImage;

          const response = await verifyFace(payload);
          if (!response.matched) {
            setState('failed');
            setMismatchError('Server facial recognition rejected verification.');
            setScanMessage('❌ Server verification: Identity mismatch.');
            return;
          }
        } catch {
          // fallback to client-verified descriptor
        }
      }
    }

    // Success!
    stopCamera();
    setCapturedImage(img);
    setProgress(100);
    setState('success');
    setScanMessage(mode === 'verify' ? '✓ Identity Verified! Timestamp Saved.' : '✓ Face Registered Successfully!');
    setTimeout(() => onSuccess(img), 800);
  }, [state, mode, employeeId, registeredImage, employeeName, stopCamera, onSuccess]);

  useEffect(() => {
    if (autoStart) {
      startScan();
    }
    return () => {
      stopCamera();
    };
  }, [autoStart, startScan, stopCamera]);

  const handleRetry = () => {
    setRetryCount((p) => p + 1);
    setProgress(0);
    setCapturedImage(null);
    setMismatchError(null);
    startScan();
  };

  const stateColor =
    state === 'success'
      ? 'text-emerald-500'
      : state === 'failed' || mismatchError
        ? 'text-red-500'
        : qualityReport && !qualityReport.ok
          ? 'text-amber-500'
          : 'text-sky-400';

  const isScanning = state === 'scanning' || state === 'analyzing' || state === 'verifying' || state === 'requesting';

  return (
    <div className="flex flex-col items-center gap-3.5 w-full">
      {/* Real-time Environment & Obstruction Badges */}
      <div className="flex items-center justify-center gap-2 flex-wrap w-full max-w-[340px] text-[10px] font-bold">
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all ${
            qualityReport?.tooDark
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          <Sun size={11} />
          <span>{qualityReport?.tooDark ? 'Too Dark' : 'Lighting OK'}</span>
        </div>

        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all ${
            qualityReport?.capDetected
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          <Sparkles size={11} />
          <span>{qualityReport?.capDetected ? 'Cap Detected' : 'No Cap'}</span>
        </div>

        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all ${
            qualityReport?.glassesDetected
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          <Eye size={11} />
          <span>{qualityReport?.glassesDetected ? 'Glasses Detected' : 'No Glasses'}</span>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="relative w-full max-w-[340px] aspect-[3/4] rounded-3xl overflow-hidden bg-slate-950 shadow-2xl border-2 border-slate-800">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: 'scaleX(-1)' }} />

        {/* Silhouette overlay instruction note */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-[10px] font-bold text-center whitespace-nowrap shadow-sm z-20">
          👤 Center Head to Neck in Silhouette
        </div>

        {/* Idle / No Camera State */}
        {(state === 'idle' || state === 'no-camera' || state === 'requesting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-4 z-30">
            <Camera size={44} className="text-slate-600 mb-2.5 animate-pulse" />
            <p className="text-slate-300 text-xs font-semibold text-center">
              {state === 'no-camera'
                ? 'Camera access denied or unavailable'
                : state === 'requesting'
                  ? 'Initializing biometric scanner...'
                  : 'Scanner ready'}
            </p>
            {state === 'requesting' && (
              <button
                onClick={() => {
                  stopCamera();
                  setTimeout(startScan, 400);
                }}
                className="mt-3 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl hover:bg-blue-700"
              >
                Retry Camera
              </button>
            )}
          </div>
        )}

        {/* Success animation overlay */}
        <AnimatePresence>
          {state === 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/70 backdrop-blur-sm z-30"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 350 }}>
                <CheckCircle size={68} className="text-emerald-400 drop-shadow-lg" />
              </motion.div>
              <p className="text-white text-sm font-bold mt-2">Biometrics Verified</p>
            </motion.div>
          )}
          {state === 'failed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/70 backdrop-blur-sm z-30 p-4 text-center"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <XCircle size={68} className="text-red-400 drop-shadow-lg" />
              </motion.div>
              <p className="text-white text-xs font-bold mt-2">{mismatchError || 'Facial verification rejected'}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode badge */}
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md rounded-full px-3 py-1 flex items-center gap-1.5 border border-white/10 z-20">
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-cyan-400 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-white text-[10px] font-extrabold tracking-wider">
            {mode === 'register' ? 'ENROLL FACE' : 'BIOMETRIC VERIFY'}
          </span>
        </div>

        {/* Employee name badge */}
        {employeeName && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md rounded-full px-3 py-1 border border-white/10 z-20">
            <span className="text-white text-[10px] font-semibold truncate max-w-[120px] block">{employeeName}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="w-full max-w-[340px]">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                state === 'success'
                  ? 'bg-emerald-500'
                  : state === 'failed' || mismatchError
                    ? 'bg-red-500'
                    : 'bg-cyan-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Status message banner */}
      <div
        className={`flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold w-full max-w-[340px] ${
          state === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : state === 'failed' || mismatchError
              ? 'bg-red-50 text-red-800 border-red-200'
              : qualityReport && !qualityReport.ok
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-slate-50 text-slate-800 border-slate-200'
        }`}
      >
        {isScanning && !qualityReport?.ok && <AlertTriangle size={15} className="text-amber-600 shrink-0" />}
        {isScanning && qualityReport?.ok && <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />}
        {state === 'success' && <CheckCircle size={15} className="text-emerald-600 shrink-0" />}
        {(state === 'failed' || mismatchError) && <ShieldAlert size={15} className="text-red-600 shrink-0" />}
        {state === 'no-camera' && <AlertCircle size={15} className="text-amber-500 shrink-0" />}
        <span className="leading-tight flex-1">{scanMessage}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2.5 w-full max-w-[340px]">
        {(state === 'failed' || mismatchError) && (
          <button
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        )}
        {['scanning', 'analyzing', 'verifying'].includes(state) && (
          <button
            onClick={handleManualSnap}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Camera size={14} />
            Scan & Capture Now
          </button>
        )}
        {!['success'].includes(state) && (
          <button
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
