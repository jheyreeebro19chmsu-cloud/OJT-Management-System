import {
  CheckCircle,
  XCircle,
  Camera,
  RefreshCw,
  AlertCircle,
  Sun,
  ShieldAlert,
  AlertTriangle,
  Upload,
  Check,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useRef, useEffect, useState, useCallback } from 'react';

import {
  loadFaceModels,
  detectFaceInDataUrl,
  strictBiometricVerify,
  inspectFaceQuality,
  type FaceQualityReport,
} from '../services/faceClient';
import { isSecurityApiConfigured, verifyFace } from '../services/securityApi';

type ScanState =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'analyzing'
  | 'verifying'
  | 'preview'
  | 'success'
  | 'failed'
  | 'no-camera'
  | 'permission-denied';

export type SimMode = 'none' | 'mask' | 'sunglasses' | 'different_person' | 'poor_lighting';

export interface FaceCaptureProps {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  const registeredImageRef = useRef(registeredImage);
  useEffect(() => {
    registeredImageRef.current = registeredImage;
  }, [registeredImage]);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const employeeNameRef = useRef(employeeName);
  useEffect(() => {
    employeeNameRef.current = employeeName;
  }, [employeeName]);

  const employeeIdRef = useRef(employeeId);
  useEffect(() => {
    employeeIdRef.current = employeeId;
  }, [employeeId]);

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
        try {
          t.stop();
        } catch {
          // ignore
        }
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
   * Draw the biometric oval framing guide, scanning beam, and alignment notches on the canvas overlay
   */
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const video = videoRef.current;
    const hasLiveVideo = Boolean(video && video.videoWidth > 0);

    if (!hasLiveVideo) {
      const curState = stateRef.current;
      if (curState === 'scanning' || curState === 'analyzing' || curState === 'verifying') {
        animFrameRef.current = requestAnimationFrame(drawOverlay);
      }
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const displayW = Math.round(rect.width) || canvas.clientWidth || 340;
      const displayH = Math.round(rect.height) || canvas.clientHeight || 453;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const targetW = Math.round(displayW * dpr);
      const targetH = Math.round(displayH * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Oval layout dimensions
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.485;

      const maxRadiusY = canvas.height * 0.35;
      const maxRadiusX = canvas.width * 0.40;

      let radiusY = canvas.height * 0.31;
      let radiusX = radiusY / 1.30;

      if (radiusY > maxRadiusY) radiusY = maxRadiusY;
      if (radiusX > maxRadiusX) {
        radiusX = maxRadiusX;
        radiusY = Math.min(radiusX * 1.30, maxRadiusY);
      }

      const currentState = stateRef.current;
      const currentQuality = qualityReportRef.current;
      const currentMismatch = mismatchErrorRef.current;
      const isObscured = Boolean(
        currentMismatch ||
        currentQuality?.faceObscured ||
        currentQuality?.maskDetected ||
        currentQuality?.glassesDetected ||
        currentQuality?.capDetected
      );

      // 1. Dark Vignette Backdrop Outside Oval using evenodd cutout
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 15, 29, 0.65)';
      ctx.fill('evenodd');
      ctx.restore();

      // 2. Animated Scanning Laser Line within oval
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.clip();

      const lineColor =
        currentState === 'success'
          ? '#22c55e'
          : currentState === 'failed' || isObscured
            ? '#ef4444'
            : currentQuality && !currentQuality.ok
              ? '#f59e0b'
              : '#00e5ff';

      const scanRange = radiusY * 2;
      scanLineRef.current = (scanLineRef.current + (2.5 * dpr)) % scanRange;
      const currentScanY = cy - radiusY + scanLineRef.current;

      const laserThickness = 16 * dpr;
      const laserGrad = ctx.createLinearGradient(0, currentScanY - laserThickness, 0, currentScanY + laserThickness);
      laserGrad.addColorStop(0, 'transparent');
      laserGrad.addColorStop(0.5, lineColor + 'aa');
      laserGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = laserGrad;
      ctx.fillRect(cx - radiusX, currentScanY - laserThickness, radiusX * 2, laserThickness * 2);

      // Laser thin center line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - radiusX + (6 * dpr), currentScanY);
      ctx.lineTo(cx + radiusX - (6 * dpr), currentScanY);
      ctx.stroke();

      ctx.restore();

      // 3. Glowing Oval Contour Border & Alignment Notches
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5 * dpr;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8 * dpr;

      // Draw Vertical Oval Outline
      ctx.beginPath();
      ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Chin alignment notch
      ctx.beginPath();
      ctx.moveTo(cx - (18 * dpr), cy + radiusY);
      ctx.lineTo(cx + (18 * dpr), cy + radiusY);
      ctx.stroke();

      // Forehead alignment notch
      ctx.beginPath();
      ctx.moveTo(cx - (18 * dpr), cy - radiusY);
      ctx.lineTo(cx + (18 * dpr), cy - radiusY);
      ctx.stroke();

      // Left cheek guide notch
      ctx.beginPath();
      ctx.moveTo(cx - radiusX, cy - (14 * dpr));
      ctx.lineTo(cx - radiusX, cy + (14 * dpr));
      ctx.stroke();

      // Right cheek guide notch
      ctx.beginPath();
      ctx.moveTo(cx + radiusX, cy - (14 * dpr));
      ctx.lineTo(cx + radiusX, cy + (14 * dpr));
      ctx.stroke();

      ctx.restore();

      // 4. Success Glow
      if (currentState === 'success') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
        ctx.fill();
        ctx.restore();
      }

      if (currentState === 'scanning' || currentState === 'analyzing' || currentState === 'verifying') {
        animFrameRef.current = requestAnimationFrame(drawOverlay);
      }
    } catch {
      // silent catch for overlay
    }
  }, []);

  /**
   * Capture a pristine JPEG snapshot from the live physical camera video
   */
  const captureFrame = useCallback((): string | undefined => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return undefined;
    }
    const maxWidth = 640;
    const ratio = Math.min(maxWidth / video.videoWidth, 1);
    const cap = document.createElement('canvas');
    cap.width = Math.round(video.videoWidth * ratio);
    cap.height = Math.round(video.videoHeight * ratio);
    const ctx = cap.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, cap.width, cap.height);
    return cap.toDataURL('image/jpeg', 0.92);
  }, []);

  /**
   * Acquire live camera hardware stream and begin facial scanning
   */
  const startScan = useCallback(async () => {
    stopCamera();
    setState('requesting');
    setMismatchError(null);
    setQualityReport(null);
    setCapturedImage(null);
    setScanMessage('Requesting camera access...');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState('no-camera');
      setScanMessage('Camera API is not supported on this browser or device.');
      return;
    }

    let stream: MediaStream | null = null;
    try {
      // Attempt 1: Optimal front/user-facing camera with ideal resolution
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Initial camera constraint failed, trying facingMode fallback:', err1);
        // Attempt 2: Simple user-facing camera without resolution constraints
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          });
        } catch (err2) {
          console.warn('FacingMode fallback failed, trying basic video device:', err2);
          // Attempt 3: Any available video device
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }
    } catch (err: any) {
      console.warn('Camera stream request error:', err);
      const isPermissionDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        String(err?.message || '').toLowerCase().includes('denied') ||
        String(err?.message || '').toLowerCase().includes('permission');

      if (isPermissionDenied) {
        setState('permission-denied');
        setScanMessage('⚠️ Camera access denied. Please enable camera permission in your browser settings.');
        setMismatchError('Camera access was denied. Facial recognition requires camera access to proceed.');
      } else {
        setState('no-camera');
        setScanMessage('⚠️ Unable to access camera. Please ensure a camera is connected and not used by another application.');
        setMismatchError('No camera feed available. Please check your camera connection.');
      }
      return;
    }

    if (!stream) {
      setState('no-camera');
      setScanMessage('No camera stream could be started.');
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((playErr) => console.warn('Video play error:', playErr));
      };
      try {
        await videoRef.current.play();
      } catch {
        // Autoplay policy catch
      }
    }

    const currentMode = modeRef.current;
    setState('scanning');
    setScanMessage(
      currentMode === 'register'
        ? 'Position face inside the oval for biometric scan...'
        : 'Align your face inside the oval for biometric verification...'
    );
    setProgress(20);

    // Pre-load biometric recognition models in the background
    loadFaceModels().catch(() => {});

    try {
      // REGISTRATION MODE: continuous scan until stable clear face is detected
      if (currentMode === 'register') {
        let stableFrames = 0;

        while (streamRef.current && stateRef.current === 'scanning') {
          const currentFrame = captureFrame();
          if (currentFrame) {
            const quality = await inspectFaceQuality(currentFrame).catch(() => null);
            if (quality) {
              setQualityReport(quality);
              if (quality.tooDark) {
                stableFrames = 0;
                setProgress(20);
                setScanMessage('⚠️ Too dark! Move to a brighter area.');
              } else if (quality.tooBright) {
                stableFrames = 0;
                setProgress(20);
                setScanMessage('⚠️ Too bright! Avoid direct glare.');
              } else if (quality.faceDetected) {
                stableFrames++;
                setProgress(Math.min(35 + stableFrames * 30, 95));

                if (stableFrames < 2) {
                  setScanMessage('Analyzing face biometrics... Hold steady');
                } else {
                  const hasFace = await detectFaceInDataUrl(currentFrame).catch(() => true);
                  if (hasFace) {
                    stopCamera();
                    setCapturedImage(currentFrame);
                    setProgress(100);
                    setState('success');
                    setScanMessage('✓ Face Recognized & Enrolled!');
                    setTimeout(() => {
                      onSuccessRef.current?.(currentFrame);
                    }, 800);
                    return;
                  } else {
                    stableFrames = 0;
                  }
                }
              } else {
                stableFrames = 0;
                setProgress(20);
                setScanMessage('Position face inside the oval guide...');
              }
            }
          }
          await new Promise((r) => setTimeout(r, 300));
        }
        return;
      }

      // VERIFICATION MODE: match live camera stream against registered student photo
      let detectedSuccess = false;
      let lastCaptured: string | undefined = undefined;

      for (let attempt = 1; attempt <= 45; attempt++) {
        if (!streamRef.current || stateRef.current !== 'scanning') break;

        const currentFrame = captureFrame();
        if (!currentFrame) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }
        lastCaptured = currentFrame;

        setProgress(Math.min(20 + attempt * 2, 85));

        const quality = await inspectFaceQuality(currentFrame).catch(() => null);
        if (quality) {
          setQualityReport(quality);

          if (quality.tooDark) {
            setScanMessage('⚠️ Too dark! Move to a well-lit area.');
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          if (quality.tooBright) {
            setScanMessage('⚠️ Too bright! Avoid harsh glare on face.');
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
        }

        const enrolledImage = registeredImageRef.current;
        if (enrolledImage) {
          setScanMessage('Verifying facial biometrics with AI...');
          const bio = await strictBiometricVerify(enrolledImage, currentFrame, 0.65);
          if (bio.matched) {
            setMismatchError(null);
            detectedSuccess = true;
            break;
          } else {
            setScanMessage('Align face inside the oval guide...');
          }
        } else {
          // If no template image yet, any verified clear face passes
          if (quality?.faceDetected) {
            detectedSuccess = true;
            break;
          }
        }

        await new Promise((r) => setTimeout(r, 350));
      }

      if (detectedSuccess && lastCaptured) {
        setCapturedImage(lastCaptured);
        setProgress(100);
        setState('success');
        setScanMessage('✓ Identity Verified! Timestamp Saved.');
        stopCamera();
        setTimeout(() => onSuccessRef.current?.(lastCaptured), 800);
        return;
      }

      // If loop completed without match, ready for manual verification
      setProgress(90);
      setState('scanning');
      setScanMessage('Position face inside the oval and tap "Scan & Verify Now".');
    } catch (loopErr) {
      console.warn('Biometric scan loop error:', loopErr);
    }
  }, [stopCamera, captureFrame]);

  useEffect(() => {
    if (state === 'scanning' || state === 'analyzing' || state === 'verifying') {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      animFrameRef.current = requestAnimationFrame(drawOverlay);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state, drawOverlay]);

  /**
   * Manual snapshot trigger
   */
  const handleManualSnap = useCallback(async () => {
    if (state === 'success') return;

    const img = captureFrame();
    if (!img) {
      setState('failed');
      setScanMessage('Failed to capture camera frame. Please ensure camera is active.');
      return;
    }

    // When registering: enforce quality, lighting, and presence
    if (modeRef.current === 'register') {
      const quality = await inspectFaceQuality(img).catch(() => null);
      if (quality) {
        setQualityReport(quality);
        if (quality.faceObscured || quality.maskDetected) {
          setScanMessage('❌ Face mask or obstruction detected. Please remove coverings.');
          return;
        }
        if (quality.tooDark) {
          setScanMessage('❌ Photo is too dark. Please ensure better lighting before saving.');
          return;
        }
        if (quality.tooBright) {
          setScanMessage('❌ Too much glare. Please adjust lighting.');
          return;
        }
        if (quality.capDetected) {
          setScanMessage('❌ Cap or hat detected. Please remove headwear.');
          return;
        }
        if (quality.glassesDetected) {
          setScanMessage('❌ Dark sunglasses detected. Please remove sunglasses.');
          return;
        }
      }

      const hasAnyFace = await detectFaceInDataUrl(img).catch(() => true);
      if (!hasAnyFace) {
        setScanMessage('❌ No face detected. Please position your face inside the oval.');
        return;
      }

      stopCamera();
      setCapturedImage(img);
      setProgress(100);
      setState('success');
      setScanMessage('✓ Face Biometrics Enrolled Successfully!');
      setTimeout(() => {
        onSuccessRef.current?.(img);
      }, 800);
      return;
    }

    // In verify mode: strict Biometric Match using AI algorithms
    setState('verifying');
    setScanMessage('Verifying face biometrics with AI...');
    setProgress(75);

    const enrolledImage = registeredImageRef.current;
    if (enrolledImage) {
      const bio = await strictBiometricVerify(enrolledImage, img, 0.65);
      if (!bio.matched) {
        setState('failed');
        setMismatchError(`Face does not match registered biometrics for ${employeeNameRef.current || 'this student'}.`);
        setScanMessage(`❌ Face mismatch (Distance: ${bio.distance.toFixed(2)} > 0.65)`);
        return;
      }
    }

    // Check backend security API if available
    const empId = employeeIdRef.current;
    if (isSecurityApiConfigured() && (empId || enrolledImage)) {
      try {
        const payload: { employee_id?: string; registered_image?: string; captured_image: string } = {
          captured_image: img,
        };
        if (empId) payload.employee_id = empId;
        else if (enrolledImage) payload.registered_image = enrolledImage;

        const response = await verifyFace(payload);
        if (!response.matched) {
          setState('failed');
          setMismatchError('Server facial recognition rejected verification.');
          setScanMessage('❌ Server verification: Identity mismatch.');
          return;
        }
      } catch {
        // client-verified descriptor fallback
      }
    }

    // Success in verify mode
    stopCamera();
    setCapturedImage(img);
    setProgress(100);
    setState('success');
    setScanMessage('✓ Identity Verified! Attendance Time Recorded.');
    setTimeout(() => onSuccessRef.current?.(img), 800);
  }, [state, stopCamera, captureFrame]);

  const handleConfirmPhoto = useCallback(() => {
    if (!capturedImage) return;
    setState('success');
    setScanMessage(modeRef.current === 'register' ? '✓ Face Photo Saved for Account Profile!' : '✓ Identity Verified!');
    setTimeout(() => {
      onSuccessRef.current?.(capturedImage);
    }, 400);
  }, [capturedImage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = evt.target?.result as string;
      if (img) {
        stopCamera();
        setCapturedImage(img);
        if (mode === 'register') {
          setState('success');
          setScanMessage('✓ Photo uploaded and biometrics enrolled!');
          setTimeout(() => {
            onSuccessRef.current?.(img);
          }, 900);
        } else {
          setCapturedImage(img);
          handleManualSnap();
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !hasStartedRef.current) {
      hasStartedRef.current = true;
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
    hasStartedRef.current = false;
    startScan();
  };

  const isScanning = state === 'scanning' || state === 'analyzing' || state === 'verifying' || state === 'requesting';

  return (
    <div className="flex flex-col items-center gap-3.5 w-full">
      {/* Hidden file upload fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileUpload}
        className="hidden"
      />



      {/* Camera / Live Viewport */}
      <div className="relative w-full max-w-[340px] aspect-[3/4] rounded-3xl overflow-hidden bg-slate-950 shadow-2xl border-2 border-slate-800">
        {state === 'preview' && capturedImage ? (
          <div className="relative w-full h-full">
            <img
              src={capturedImage}
              alt="Captured Biometric Preview"
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/50 text-emerald-300 text-[10px] font-bold text-center whitespace-nowrap shadow-md z-20">
              ✓ Photo Captured — Ready to Confirm
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: 'scaleX(-1)' }} />

            {/* Center face guide banner */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-[10px] font-bold text-center whitespace-nowrap shadow-sm z-20">
              👤 Center Face inside the Oval
            </div>

            {/* Obstruction warning banner within viewport */}
            {qualityReport?.faceObscured && (
              <div className="absolute top-11 left-3 right-3 bg-red-950/90 border border-red-500/80 text-white rounded-xl p-2 text-center backdrop-blur-md z-30 shadow-lg animate-pulse">
                <p className="text-[11px] font-bold text-red-300 flex items-center justify-center gap-1.5">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <span>
                    Obstruction: Remove {qualityReport.maskDetected ? 'Mask' : qualityReport.glassesDetected ? 'Sunglasses' : 'Coverings'}
                  </span>
                </p>
                <p className="text-[10px] text-red-200/90 mt-0.5">
                  Verification requires an unobstructed, clear view of your face.
                </p>
              </div>
            )}
          </>
        )}

        {/* Camera Permission Denied Screen */}
        {state === 'permission-denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 z-30 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-red-900/50 text-red-400 border border-red-500/40 flex items-center justify-center shadow-lg">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Camera Permission Required</h4>
              <p className="text-xs text-red-300 mt-1 leading-relaxed max-w-[280px]">
                Camera access was blocked by your browser. Please allow camera access to scan your face.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] text-slate-300 text-left w-full max-w-[280px] space-y-1">
              <p className="font-bold text-slate-200">How to enable camera:</p>
              <p>1. Tap the lock 🔒 or camera 📷 icon in your browser address bar</p>
              <p>2. Set Camera permission to <strong>Allow</strong></p>
              <p>3. Tap "Grant Permission & Try Again" below</p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setTimeout(startScan, 300);
              }}
              className="w-full max-w-[280px] py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera size={14} />
              <span>Grant Permission & Try Again</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-[280px] py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload size={13} /> Upload Face Photo Instead
            </button>
          </div>
        )}

        {/* Idle / No Camera / Requesting State */}
        {(state === 'idle' || state === 'no-camera' || state === 'requesting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-5 z-30 text-center">
            <Camera size={44} className="text-slate-500 mb-3 animate-pulse" />
            <p className="text-slate-200 text-xs font-semibold leading-relaxed mb-4">
              {state === 'no-camera'
                ? 'Camera device not available or not detected.'
                : state === 'requesting'
                  ? 'Requesting camera access...'
                  : 'Scanner ready'}
            </p>
            {state === 'requesting' ? (
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                <RefreshCw size={16} className="animate-spin" />
                <span>Starting camera...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full max-w-[220px]">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setTimeout(startScan, 300);
                  }}
                  className="w-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-xl transition-colors shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera size={14} /> Start Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload size={13} /> Upload Photo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Success animation overlay */}
        <AnimatePresence>
          {state === 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/80 backdrop-blur-sm z-30"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 350 }}>
                <CheckCircle size={68} className="text-emerald-400 drop-shadow-lg" />
              </motion.div>
              <p className="text-white text-sm font-bold mt-2">
                {mode === 'register' ? 'Face Enrolled Successfully' : 'Biometrics Verified'}
              </p>
            </motion.div>
          )}
          {state === 'failed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-sm z-30 p-4 text-center"
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
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-cyan-400 animate-pulse' : state === 'preview' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
          <span className="text-white text-[10px] font-extrabold tracking-wider">
            {mode === 'register' ? 'ACCOUNT FACE REGISTRATION' : 'BIOMETRIC VERIFY'}
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
                state === 'success' || state === 'preview'
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
          state === 'success' || state === 'preview'
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
        {(state === 'success' || state === 'preview') && <CheckCircle size={15} className="text-emerald-600 shrink-0" />}
        {(state === 'failed' || mismatchError) && <ShieldAlert size={15} className="text-red-600 shrink-0" />}
        {state === 'no-camera' && <AlertCircle size={15} className="text-amber-500 shrink-0" />}
        <span className="leading-tight flex-1">{scanMessage}</span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 w-full max-w-[340px]">
        {/* Preview state: Confirm & Use or Retake */}
        {state === 'preview' && (
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={handleConfirmPhoto}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Check size={15} />
              Confirm & Use Photo
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              Retake
            </button>
          </div>
        )}

        {/* Failed state: Retry button */}
        {(state === 'failed' || mismatchError) && (
          <button
            type="button"
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        )}

        {/* Scanning state: Manual Snap button & Upload button */}
        {['scanning', 'analyzing', 'verifying'].includes(state) && (
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={handleManualSnap}
              disabled={Boolean(
                qualityReport?.faceObscured ||
                qualityReport?.maskDetected ||
                qualityReport?.glassesDetected
              )}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs shadow-md transition-all ${
                qualityReport?.faceObscured ||
                qualityReport?.maskDetected ||
                qualityReport?.glassesDetected
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 cursor-pointer'
              }`}
            >
              <Camera size={15} />
              {qualityReport?.faceObscured ||
              qualityReport?.maskDetected ||
              qualityReport?.glassesDetected
                ? 'Face Obscured (Remove Coverings)'
                : mode === 'register'
                  ? 'Scan Face Now'
                  : 'Scan & Verify Now'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo from device"
              className="px-3.5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center"
            >
              <Upload size={15} />
            </button>
          </div>
        )}

        {/* Cancel button */}
        {!['success', 'preview'].includes(state) && (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
