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

  // Blink Liveness Anti-Spoof State
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [blinkStep, setBlinkStep] = useState<'looking' | 'eyes_closed' | 'verified'>('looking');
  const livenessVerifiedRef = useRef(false);
  const blinkStateRef = useRef<'looking' | 'eyes_closed' | 'verified'>('looking');
  const blinkFrameRef = useRef<string | null>(null);
  const baselineOpenEarRef = useRef<number>(0);

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
        currentQuality?.capDetected ||
        currentQuality?.poorBackgroundLighting ||
        currentQuality?.tooDark
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
   * Capture a pristine JPEG snapshot from the live physical camera video,
   * accurately cropped to match the exact 3:4 aspect-ratio viewport visible to the user.
   */
  const captureFrame = useCallback((): string | undefined => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return undefined;
    }

    // Determine target container aspect ratio (standard 3/4 from UI aspect-[3/4])
    let containerAspect = 3 / 4;
    const container = video.parentElement;
    if (container && container.clientWidth && container.clientHeight) {
      containerAspect = container.clientWidth / container.clientHeight;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const videoAspect = vw / vh;

    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;

    // Calculate source crop rectangle matching CSS object-cover
    if (videoAspect > containerAspect) {
      // Video is wider than viewport (e.g. 16:9 mobile camera): crop horizontal sides
      sw = vh * containerAspect;
      sh = vh;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      // Video is taller than viewport: crop vertical sides
      sw = vw;
      sh = vw / containerAspect;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    // Target dimensions (480x640 portrait)
    const targetW = 480;
    const targetH = Math.round(targetW / containerAspect);

    const cap = document.createElement('canvas');
    cap.width = targetW;
    cap.height = targetH;
    const ctx = cap.getContext('2d');
    if (!ctx) return undefined;

    // Draw the cropped viewport from the live camera stream
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
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

    // Reset blink state for fresh scan session
    blinkStateRef.current = 'looking';
    blinkFrameRef.current = null;
    baselineOpenEarRef.current = 0;
    livenessVerifiedRef.current = false;
    setLivenessVerified(false);
    setBlinkStep('looking');

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

              // Soft advisory cues — never block scanning or reset stableFrames
              if (quality.glassesDetected) {
                setScanMessage('Tip: Ensure eyes are clear and unobstructed.');
              } else if (quality.capDetected) {
                setScanMessage('Tip: Ensure forehead is clear.');
              } else if (quality.maskDetected) {
                setScanMessage('Tip: Ensure lower face is clear.');
              }
              if (quality.tooDark && (quality.brightness ?? 100) < 22) {
                stableFrames = 0;
                setProgress(15);
                setScanMessage('⚠️ Too dark! Move to a brighter area.');
                await new Promise((r) => setTimeout(r, 350));
                continue;
              }
              if (quality.tooBright) {
                stableFrames = 0;
                setProgress(15);
                setScanMessage('⚠️ Too bright! Avoid direct glare.');
                await new Promise((r) => setTimeout(r, 350));
                continue;
              }

              if (quality.faceDetected) {
                const ear = quality.ear ?? 0.28;

                // Adaptive baseline tracking for open eyes
                if (ear >= 0.22 && ear > baselineOpenEarRef.current) {
                  baselineOpenEarRef.current = ear;
                }

                // Real-time Blink Liveness Anti-Spoofing check
                if (!livenessVerifiedRef.current) {
                  if (blinkStateRef.current === 'looking') {
                    const isClosed = quality.eyesClosed || ear < 0.23 || (baselineOpenEarRef.current > 0.22 && ear <= baselineOpenEarRef.current * 0.80);
                    if (isClosed) {
                      blinkStateRef.current = 'eyes_closed';
                      blinkFrameRef.current = currentFrame;
                      setBlinkStep('eyes_closed');
                      setScanMessage('✓ Eyes closed detected! Now open your eyes...');
                      setProgress(55);
                      await new Promise((r) => setTimeout(r, 200));
                      continue;
                    }
                  } else if (blinkStateRef.current === 'eyes_closed') {
                    const isReopened = !quality.eyesClosed && (ear >= 0.21 || (baselineOpenEarRef.current > 0.22 && ear >= baselineOpenEarRef.current * 0.88));
                    if (isReopened) {
                      blinkStateRef.current = 'verified';
                      livenessVerifiedRef.current = true;
                      setLivenessVerified(true);
                      setBlinkStep('verified');
                      setScanMessage('✓ Liveness verified! Stabilizing biometric photo...');
                      setProgress(75);
                    }
                  }

                  if (!livenessVerifiedRef.current) {
                    stableFrames = 0;
                    setProgress(30);
                    setScanMessage(
                      blinkStateRef.current === 'eyes_closed'
                        ? '✓ Eyes closed detected! Now open your eyes...'
                        : '👁️ Blink your eyes (close for 1 sec, then open) to verify liveness'
                    );
                    await new Promise((r) => setTimeout(r, 250));
                    continue;
                  }
                }

                stableFrames++;
                setProgress(Math.min(75 + stableFrames * 12, 95));

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
                    }, 600);
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
          await new Promise((r) => setTimeout(r, 250));
        }
        return;
      }

      // VERIFICATION MODE: continuous matching live camera stream against registered student photo
      let detectedSuccess = false;
      let lastCaptured: string | undefined = undefined;

      // Fail-closed biometric guard: If verify mode has no template photo registered, fail immediately
      const initialTemplate = registeredImageRef.current;
      if (!initialTemplate) {
        setState('failed');
        setMismatchError(
          `No registered face biometrics found on file for ${employeeNameRef.current || 'this trainee'}. Please register your face photo first in Profile or Registration.`
        );
        setScanMessage('❌ Missing registered face template. Attendance blocked.');
        return;
      }

      let frameCounter = 0;
      let matchAttempts = 0;

      // Continuous loop: keeps running as long as user is on screen and camera is active
      while (streamRef.current && (stateRef.current === 'scanning' || stateRef.current === 'verifying')) {
        frameCounter++;
        const currentFrame = captureFrame();
        if (!currentFrame) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        lastCaptured = currentFrame;

        const quality = await inspectFaceQuality(currentFrame).catch(() => null);
        if (quality) {
          setQualityReport(quality);

          // Soft advisory cues — do not block capture
          if (quality.glassesDetected) {
            setScanMessage('Tip: Ensure eyes are clear and unobstructed.');
          } else if (quality.capDetected) {
            setScanMessage('Tip: Ensure forehead is clear.');
          } else if (quality.maskDetected) {
            setScanMessage('Tip: Ensure lower face is clear.');
          }

          if (quality.faceDetected) {
            const ear = quality.ear ?? 0.28;

            // Adaptive baseline tracking for open eyes
            if (ear >= 0.22 && ear > baselineOpenEarRef.current) {
              baselineOpenEarRef.current = ear;
            }

            // Real-time Blink Liveness Anti-Spoofing check
            if (!livenessVerifiedRef.current) {
              if (blinkStateRef.current === 'looking') {
                const isClosed = quality.eyesClosed || ear < 0.23 || (baselineOpenEarRef.current > 0.22 && ear <= baselineOpenEarRef.current * 0.80);
                if (isClosed) {
                  blinkStateRef.current = 'eyes_closed';
                  blinkFrameRef.current = currentFrame;
                  setBlinkStep('eyes_closed');
                  setScanMessage('✓ Eyes closed detected! Now open your eyes...');
                  setProgress(55);
                  await new Promise((r) => setTimeout(r, 200));
                  continue;
                }
              } else if (blinkStateRef.current === 'eyes_closed') {
                const isReopened = !quality.eyesClosed && (ear >= 0.21 || (baselineOpenEarRef.current > 0.22 && ear >= baselineOpenEarRef.current * 0.88));
                if (isReopened) {
                  blinkStateRef.current = 'verified';
                  livenessVerifiedRef.current = true;
                  setLivenessVerified(true);
                  setBlinkStep('verified');
                  setScanMessage('✓ Liveness verified! Matching biometrics...');
                  setProgress(75);
                }
              }

              if (!livenessVerifiedRef.current) {
                setProgress(Math.min(30 + ((frameCounter * 2) % 25), 50));
                setScanMessage(
                  blinkStateRef.current === 'eyes_closed'
                    ? '✓ Eyes closed detected! Now open your eyes...'
                    : '👁️ Blink your eyes (close for 1 sec, then open) to verify liveness'
                );
                await new Promise((r) => setTimeout(r, 250));
                continue;
              }
            }

            // Liveness is verified! Now match biometrics against enrolled photo
            const enrolledImage = registeredImageRef.current;
            if (!enrolledImage) {
              setScanMessage('❌ Missing registered face biometrics.');
              break;
            }

            matchAttempts++;
            setProgress(Math.min(75 + matchAttempts * 3, 95));
            setScanMessage('Verifying facial biometrics with AI...');

            // Notice: skipQualityCheck = true because inspectFaceQuality already verified above!
            const bio = await strictBiometricVerify(enrolledImage, currentFrame, 0.58, true);
            if (bio.matched) {
              setMismatchError(null);
              detectedSuccess = true;
              break;
            } else {
              setScanMessage(
                bio.distance < 0.68
                  ? 'Hold still... Verifying face biometrics...'
                  : matchAttempts > 6
                    ? 'Hold still or tap "Scan & Verify Now"'
                    : `⚠️ Face does not match registered biometrics for ${employeeNameRef.current || 'this trainee'}.`
              );
            }
          } else {
            setProgress(20);
            setScanMessage('Position face inside the oval guide...');
          }
        }

        await new Promise((r) => setTimeout(r, 250));
      }

      if (detectedSuccess && lastCaptured) {
        setCapturedImage(lastCaptured);
        setProgress(100);
        setState('success');
        setScanMessage('✓ Identity Verified! Timestamp Saved.');
        stopCamera();
        setTimeout(() => onSuccessRef.current?.(lastCaptured), 600);
        return;
      }
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
  const handleManualSnap = useCallback(async (customImg?: string) => {
    if (stateRef.current === 'success' || stateRef.current === 'verifying') return;

    const img = customImg || captureFrame();
    if (!img) {
      setState('failed');
      setScanMessage('Failed to capture camera frame. Please ensure camera is active.');
      return;
    }

    const manualQuality = await inspectFaceQuality(img).catch(() => null);
    if (manualQuality) {
      setQualityReport(manualQuality);
      // Quality hints are advisory — only reject if pitch black or heavily blown out
      if (manualQuality.tooDark && (manualQuality.brightness ?? 100) < 20) {
        setState('failed');
        setMismatchError('Lighting too dark. Please move to a brighter, well-lit area.');
        setScanMessage('❌ Lighting too dark.');
        return;
      }
      if (manualQuality.tooBright && (manualQuality.brightness ?? 100) > 248) {
        setState('failed');
        setMismatchError('Harsh glare on face! Please adjust lighting.');
        setScanMessage('❌ Harsh glare detected.');
        return;
      }
      if (!manualQuality.faceDetected) {
        const doubleCheck = await detectFaceInDataUrl(img).catch(() => false);
        if (!doubleCheck) {
          setScanMessage('⚠️ No face detected. Please position your face inside the oval.');
          return;
        }
      }
    }

    // Manual blink liveness check
    if (!livenessVerifiedRef.current) {
      if (manualQuality?.eyesClosed) {
        blinkStateRef.current = 'eyes_closed';
        blinkFrameRef.current = img;
        setBlinkStep('eyes_closed');
        setScanMessage('✓ Eyes closed captured! Now open your eyes and tap "Scan & Verify Now".');
        return;
      } else if (blinkStateRef.current === 'eyes_closed') {
        blinkStateRef.current = 'verified';
        livenessVerifiedRef.current = true;
        setLivenessVerified(true);
        setBlinkStep('verified');
        setScanMessage('✓ Liveness verified! Verifying biometrics...');
      } else {
        setScanMessage('👁️ Blink your eyes (close for 1s, then open) to verify liveness.');
        return;
      }
    }

    // When registering: enforce quality, lighting, and presence
    if (modeRef.current === 'register') {
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
      }, 600);
      return;
    }

    // In verify mode: strict Biometric Match using AI algorithms
    setState('verifying');
    setScanMessage('Verifying face biometrics with AI...');
    setProgress(80);

    const enrolledImage = registeredImageRef.current;
    if (!enrolledImage) {
      setState('failed');
      setMismatchError(
        `No registered face biometric template on file for ${employeeNameRef.current || 'this trainee'}. Attendance scan blocked.`
      );
      setScanMessage('❌ Missing registered face biometrics.');
      return;
    }

    // Notice: skipQualityCheck = true because manualQuality already inspected above
    const bio = await strictBiometricVerify(enrolledImage, img, 0.58, true);
    if (!bio.matched) {
      setState('failed');
      setMismatchError(`Face does not match registered biometrics for ${employeeNameRef.current || 'this trainee'}.`);
      setScanMessage(`❌ Face mismatch (Biometric distance: ${bio.distance.toFixed(2)} > 0.58)`);
      return;
    }

    // Check backend security API if available
    const empId = employeeIdRef.current;
    if (isSecurityApiConfigured() && (empId || enrolledImage)) {
      try {
        const payload: {
          employee_id?: string;
          registered_image?: string;
          captured_image: string;
          blink_image?: string;
          require_liveness?: boolean;
        } = {
          captured_image: img,
          blink_image: blinkFrameRef.current || undefined,
          require_liveness: Boolean(blinkFrameRef.current),
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
      } catch (serverErr) {
        // SECURITY: fail CLOSED, not open. If the server verification call
        // itself fails (network error, server down, timeout), do NOT treat
        // the earlier client-only descriptor match as sufficient -- that
        // reopens the exact "spoofable on-device decision" hole that was
        // already fixed on the mobile app. Block the clock-in instead and
        // ask the person to retry once connectivity is back.
        console.warn('Server verification unreachable:', serverErr);
        setState('failed');
        setMismatchError("Can't verify right now — check your connection and try again.");
        setScanMessage('❌ Verification server unreachable.');
        return;
      }
    }

    // Success in verify mode
    stopCamera();
    setCapturedImage(img);
    setProgress(100);
    setState('success');
    setScanMessage('✓ Identity Verified! Attendance Time Recorded.');
    setTimeout(() => onSuccessRef.current?.(img), 600);
  }, [stopCamera, captureFrame]);

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
    reader.onload = async (evt) => {
      const img = evt.target?.result as string;
      if (img) {
        stopCamera();
        // Strict bare-face obstruction inspection on uploaded photo
        const quality = await inspectFaceQuality(img).catch(() => null);
        if (quality) {
          setQualityReport(quality);
          // Non-blocking advisory cues for photo upload
          if (quality.glassesDetected) {
            setScanMessage('Tip: Ensure eyes are clear and unobstructed.');
          } else if (quality.capDetected) {
            setScanMessage('Tip: Ensure forehead is clear.');
          } else if (quality.maskDetected) {
            setScanMessage('Tip: Ensure lower face is clear.');
          }
          if (quality.poorBackgroundLighting || quality.tooDark) {
            setState('failed');
            setMismatchError('Upload rejected: Dark background or poor lighting. Please upload a well-lit photo with a light background.');
            setScanMessage('❌ Dark background / poor lighting.');
            return;
          }
          if (!quality.faceDetected) {
            setState('failed');
            setMismatchError('Upload rejected: No clear face detected in uploaded photo.');
            setScanMessage('❌ No face detected.');
            return;
          }
        }

        setCapturedImage(img);
        if (mode === 'register') {
          setState('success');
          setScanMessage('✓ Photo uploaded and biometrics enrolled!');
          setTimeout(() => {
            onSuccessRef.current?.(img);
          }, 900);
        } else {
          setCapturedImage(img);
          handleManualSnap(img);
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
    livenessVerifiedRef.current = false;
    setLivenessVerified(false);
    blinkStateRef.current = 'looking';
    blinkFrameRef.current = null;
    baselineOpenEarRef.current = 0;
    setBlinkStep('looking');
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

            {/* Anti-Spoof Liveness Indicator Badge */}
            <div
              className={`absolute top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full border text-[10px] font-bold text-center whitespace-nowrap shadow-sm z-20 flex items-center gap-1.5 transition-colors ${
                livenessVerified || blinkStep === 'verified'
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : blinkStep === 'eyes_closed'
                    ? 'bg-sky-950/80 border-sky-500/60 text-sky-300 animate-bounce'
                    : 'bg-amber-950/80 border-amber-500/60 text-amber-300 animate-pulse'
              }`}
            >
              <span>
                {livenessVerified || blinkStep === 'verified'
                  ? '✓ Liveness Verified (Anti-Spoof)'
                  : blinkStep === 'eyes_closed'
                    ? '✓ Eyes Closed Detected — Open Eyes Now!'
                    : '👁️ Blink to Verify Liveness'}
              </span>
            </div>

            {/* Obstruction warning banner within viewport */}
            {qualityReport && (qualityReport.faceObscured || qualityReport.glassesDetected || qualityReport.capDetected || qualityReport.maskDetected || qualityReport.poorBackgroundLighting || qualityReport.tooDark) && (
              <div className="absolute top-11 left-3 right-3 bg-red-950/90 border border-red-500/80 text-white rounded-xl p-2 text-center backdrop-blur-md z-30 shadow-lg animate-pulse">
                <p className="text-[11px] font-bold text-red-300 flex items-center justify-center gap-1.5">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <span>
                    {qualityReport.glassesDetected
                      ? '🚨 GLASSES DETECTED: Remove Glasses'
                      : qualityReport.capDetected
                        ? '🚨 HAT / CAP DETECTED: Remove Headwear'
                        : qualityReport.maskDetected
                          ? '🚨 FACE MASK DETECTED: Remove Mask'
                          : qualityReport.poorBackgroundLighting
                            ? '🚨 DARK BACKGROUND: Move to Light Area'
                            : qualityReport.tooDark
                              ? '🚨 LIGHTING TOO DIM: Move to Bright Light'
                              : '🚨 CLEAR FACE REQUIRED'}
                  </span>
                </p>
                <p className="text-[10px] text-red-200/90 mt-0.5">
                  Only an unobstructed clear face against a light, well-lit background is accepted.
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
              onClick={() => handleManualSnap()}
              disabled={
                state === 'verifying' ||
                state === 'analyzing' ||
                Boolean(
                  qualityReport?.glassesDetected ||
                  qualityReport?.capDetected ||
                  qualityReport?.maskDetected
                )
              }
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs shadow-md transition-all ${
                state === 'verifying' || state === 'analyzing'
                  ? 'bg-blue-600 text-white cursor-wait animate-pulse'
                  : qualityReport?.glassesDetected || qualityReport?.capDetected || qualityReport?.maskDetected
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white shadow-indigo-600/25 cursor-pointer'
              }`}
            >
              {state === 'verifying' || state === 'analyzing' ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Verifying Face Biometrics...</span>
                </>
              ) : (
                <>
                  <Camera size={15} />
                  <span>
                    {qualityReport?.glassesDetected
                      ? 'Glasses Detected (Remove Glasses)'
                      : qualityReport?.capDetected
                        ? 'Hat/Cap Detected (Remove Headwear)'
                        : qualityReport?.maskDetected
                          ? 'Mask Detected (Remove Mask)'
                          : mode === 'register'
                            ? 'Scan Face Now'
                            : 'Scan & Verify Now'}
                  </span>
                </>
              )}
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
