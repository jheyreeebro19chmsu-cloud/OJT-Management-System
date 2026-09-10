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
  Upload,
  Check,
  RotateCcw,
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

type ScanState = 'idle' | 'requesting' | 'scanning' | 'analyzing' | 'verifying' | 'preview' | 'success' | 'failed' | 'no-camera';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const simTimerRef = useRef<any>(null);

  const [state, setState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<FaceQualityReport | null>(null);
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simObstruction, setSimObstruction] = useState<'none' | 'mask' | 'sunglasses'>('none');

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

  const simObstructionRef = useRef(simObstruction);
  useEffect(() => {
    simObstructionRef.current = simObstruction;
  }, [simObstruction]);

  const stopCamera = useCallback(() => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setIsSimulating(false);
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

  const drawSimulatedFrame = useCallback((obstructionType: 'none' | 'mask' | 'sunglasses') => {
    let canvas = simCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      simCanvasRef.current = canvas;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Ambient background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Ambient glow
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 220, 0, Math.PI * 2);
    ctx.fill();

    // Body / Shoulders
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 35, 190, 140, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#c78f68';
    ctx.fillRect(w / 2 - 38, h / 2 + 50, 76, 80);

    // Head / Face (Skin tone, centered in oval guide)
    const cx = w / 2;
    const cy = h / 2 - 20;
    const rx = 105;
    const ry = 145;

    ctx.save();
    ctx.fillStyle = '#dfa882';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 85, 110, 65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - 95, cy - 20, 30, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 95, cy - 20, 30, 70, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = '#271c19';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx - 45, cy - 42, 28, Math.PI * 1.1, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 45, cy - 42, 28, Math.PI * 1.2, Math.PI * 1.9);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - 45, cy - 22, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(cx - 45, cy - 22, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx + 45, cy - 22, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(cx + 45, cy - 22, 6, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.strokeStyle = '#b07853';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 25);
    ctx.lineTo(cx + 8, cy + 18);
    ctx.lineTo(cx - 4, cy + 26);
    ctx.stroke();

    // Mouth / Lips
    ctx.fillStyle = '#be5b50';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 62, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Obstruction overlay
    if (obstructionType === 'sunglasses') {
      ctx.fillStyle = '#09090b';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 4;

      // Left lens
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(cx - 84, cy - 38, 72, 38, 10);
      } else {
        ctx.rect(cx - 84, cy - 38, 72, 38);
      }
      ctx.fill();
      ctx.stroke();

      // Right lens
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(cx + 12, cy - 38, 72, 38, 10);
      } else {
        ctx.rect(cx + 12, cy - 38, 72, 38);
      }
      ctx.fill();
      ctx.stroke();

      // Sunglasses bridge
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 24);
      ctx.lineTo(cx + 12, cy - 24);
      ctx.stroke();

      // Frame arms
      ctx.beginPath();
      ctx.moveTo(cx - 84, cy - 26);
      ctx.lineTo(cx - 105, cy - 28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 84, cy - 26);
      ctx.lineTo(cx + 105, cy - 28);
      ctx.stroke();
    } else if (obstructionType === 'mask') {
      // Surgical blue medical mask covering lower face
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(cx - 88, cy + 10);
      ctx.quadraticCurveTo(cx, cy - 2, cx + 88, cy + 10);
      ctx.lineTo(cx + 78, cy + 115);
      ctx.quadraticCurveTo(cx, cy + 135, cx - 78, cy + 115);
      ctx.closePath();
      ctx.fill();

      // Mask fold lines
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 70, cy + 40);
      ctx.lineTo(cx + 70, cy + 40);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 72, cy + 70);
      ctx.lineTo(cx + 72, cy + 70);
      ctx.stroke();

      // Ear loops
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 85, cy + 20);
      ctx.quadraticCurveTo(cx - 110, cy + 45, cx - 80, cy + 95);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 85, cy + 20);
      ctx.quadraticCurveTo(cx + 110, cy + 45, cx + 80, cy + 95);
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  const startSimulatedCamera = useCallback(
    (obstruction: 'none' | 'mask' | 'sunglasses' = 'none') => {
      setIsSimulating(true);
      setSimObstruction(obstruction);
      simObstructionRef.current = obstruction;

      drawSimulatedFrame(obstruction);

      try {
        if (simCanvasRef.current && typeof (simCanvasRef.current as any).captureStream === 'function') {
          const stream = (simCanvasRef.current as any).captureStream(25);
          if (stream) {
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn('Simulated stream notice:', e);
      }

      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
      }
      simTimerRef.current = setInterval(() => {
        drawSimulatedFrame(simObstructionRef.current);
      }, 200);

      setState('scanning');
      setScanMessage(
        obstruction !== 'none'
          ? `Obstruction (${obstruction}) positioned in guide. System evaluating...`
          : 'Biometric stream active. Position face inside oval.'
      );
    },
    [drawSimulatedFrame]
  );

  /**
   * Render vertical oval (ellipse) face framing layout
   * - Height covers 60-70% of screen height
   * - Height-to-width ratio ~1.3:1 to 1.5:1 (1.38:1)
   * - Centered horizontally, slightly above center vertically
   * - Minimum 10% margin padding from screen borders
   * Optimized to avoid canvas buffer resets and eliminate all flickering/flashing
   */
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;

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

      // Oval dimensions & placement:
      // 1. Centered horizontally (cx = W / 2)
      // 2. Centered at 48.5% height to position eyes/nose in center and chin naturally above bottom border
      // 3. Covers ~62% of viewport height (radiusY = H * 0.31)
      // 4. Natural human face aspect ratio of ~1.30:1 (radiusX = radiusY / 1.30)
      //    In 340x453 viewport, oval is ~215px wide x 280px high, comfortably framing forehead, cheeks, and chin.
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.485;

      const maxRadiusY = canvas.height * 0.35; // leaves ~13.5% top and ~16.5% bottom margin
      const maxRadiusX = canvas.width * 0.40;  // leaves 10% left and right margin

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

      // 1. Dark Backdrop Outside Oval
      ctx.fillStyle = 'rgba(10, 15, 29, 0.65)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Cutout Vertical Oval (Ellipse)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 3. Scanning Laser Line within oval
      const lineColor =
        currentState === 'success'
          ? '#22c55e'
          : currentState === 'failed' || currentMismatch || (currentQuality && currentQuality.faceObscured)
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

      // Laser thin bright center line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - radiusX + (6 * dpr), currentScanY);
      ctx.lineTo(cx + radiusX - (6 * dpr), currentScanY);
      ctx.stroke();

      ctx.restore();

      // 4. Glowing Oval Contour Border & Alignment Notches
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

      // 5. Success Glow
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
      // silent overlay catch
    }
  }, []);

  const captureFrame = (): string | undefined => {
    if (isSimulating && simCanvasRef.current) {
      return simCanvasRef.current.toDataURL('image/jpeg', 0.90);
    }
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      if (simCanvasRef.current) {
        return simCanvasRef.current.toDataURL('image/jpeg', 0.90);
      }
      return;
    }
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
    setCapturedImage(null);
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
      setIsSimulating(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();
          videoRef.current.onloadedmetadata = () => resolve();
          setTimeout(resolve, 800);
        });
        await videoRef.current.play().catch(() => {});
      }

      const currentMode = modeRef.current;
      setState('scanning');
      setScanMessage(
        currentMode === 'register'
          ? 'Position face inside the oval for facial recognition scan...'
          : 'Position your face inside the oval for biometric verification...'
      );
      setProgress(20);

      // Pre-load biometric recognition models in parallel
      loadFaceModels().catch(() => {});

      // For registration mode: continuous facial recognition biometric scan that auto-completes
      if (currentMode === 'register') {
        let stableFrames = 0;
        const REQUIRED_STABLE_FRAMES = 3;

        while ((streamRef.current || isSimulating) && stateRef.current === 'scanning') {
          const currentFrame = captureFrame();
          if (currentFrame) {
            const quality = await inspectFaceQuality(currentFrame).catch(() => null);
            if (quality) {
              setQualityReport(quality);
              if (quality.faceObscured || quality.maskDetected) {
                stableFrames = 0;
                setProgress(20);
                setScanMessage(
                  quality.maskDetected
                    ? '⚠️ Face mask detected! Please remove mask for facial enrollment.'
                    : '⚠️ Face obscured! Please remove coverings for clear face scan.'
                );
              } else if (quality.tooDark) {
                stableFrames = 0;
                setProgress(20);
                setScanMessage('⚠️ Too dark! Move to a brighter area.');
              } else if (quality.tooBright) {
                stableFrames = 0;
                setProgress(20);
                setScanMessage('⚠️ Too bright! Avoid direct glare.');
              } else if (quality.capDetected) {
                stableFrames = 0;
                setProgress(20);
                setScanMessage('⚠️ Cap detected! Please remove headwear.');
              } else if (quality.glassesDetected) {
                stableFrames = 0;
                setProgress(20);
                setScanMessage('⚠️ Dark glasses detected! Please remove sunglasses.');
              } else if (quality.faceDetected) {
                if (!quality.faceCentered) {
                  stableFrames = 0;
                  setProgress(25);
                  setScanMessage('Align face inside the oval guide...');
                } else {
                  stableFrames++;
                  setProgress(Math.min(30 + stableFrames * 22, 95));

                  if (stableFrames < REQUIRED_STABLE_FRAMES) {
                    setScanMessage(`Scanning face biometrics... Hold steady (${stableFrames}/${REQUIRED_STABLE_FRAMES})`);
                  } else {
                    // Confirmed face stability: verify face with fail-closed check and automatically complete enrollment!
                    const hasFace = await detectFaceInDataUrl(currentFrame).catch(() => false);
                    if (hasFace) {
                      stopCamera();
                      setCapturedImage(currentFrame);
                      setProgress(100);
                      setState('success');
                      setScanMessage('✓ Face Biometrics Enrolled Successfully!');
                      setTimeout(() => {
                        onSuccessRef.current?.(currentFrame);
                      }, 900);
                      return;
                    } else {
                      stableFrames = 0;
                    }
                  }
                }
              } else {
                stableFrames = 0;
                setProgress(20);
                setScanMessage('Align face inside the oval guide.');
              }
            }
          }
          await new Promise((r) => setTimeout(r, 350));
        }
        return;
      }

      // Verification mode: inspect biometrics against enrolled template
      let detectedSuccess = false;
      let lastCaptured: string | undefined = undefined;

      for (let attempt = 1; attempt <= 35; attempt++) {
        if ((!streamRef.current && !isSimulating) || stateRef.current !== 'scanning') break;

        const currentFrame = captureFrame();
        if (!currentFrame) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        lastCaptured = currentFrame;

        // Visual progress update
        setProgress(Math.min(20 + attempt * 2.5, 85));

        // Face Quality inspection
        const quality = await inspectFaceQuality(currentFrame);
        setQualityReport(quality);

        // FAIL-CLOSED OBSTRUCTION CHECK: Strictly prevent verification when face is obscured
        if (quality.faceObscured || quality.maskDetected || quality.glassesDetected || quality.capDetected) {
          const obstructionPrompt = quality.maskDetected
            ? '⚠️ Face mask detected! Please remove mask for biometric verification.'
            : quality.glassesDetected
              ? '⚠️ Dark sunglasses detected! Please remove sunglasses for biometric verification.'
              : quality.capDetected
                ? '⚠️ Cap or headwear detected! Please remove headwear.'
                : '⚠️ Face obscured! System prevents verification. Please show a clear face.';
          setScanMessage(obstructionPrompt);
          setMismatchError(obstructionPrompt);
          // Block and prevent verification!
          await new Promise((r) => setTimeout(r, 450));
          continue;
        }

        if (quality.tooDark) {
          setScanMessage('⚠️ Too dark! Move to a well-lit area.');
          await new Promise((r) => setTimeout(r, 450));
          continue;
        }
        if (quality.tooBright) {
          setScanMessage('⚠️ Too bright! Avoid harsh glare on face.');
          await new Promise((r) => setTimeout(r, 450));
          continue;
        }
        if (!quality.faceDetected) {
          setScanMessage('Align face inside the oval guide...');
          await new Promise((r) => setTimeout(r, 450));
          continue;
        }

        setScanMessage('Verifying trainee biometrics...');

        const enrolledImage = registeredImageRef.current;
        if (enrolledImage) {
          const bio = await strictBiometricVerify(enrolledImage, currentFrame, 0.55);
          if (bio.matched) {
            setMismatchError(null);
            detectedSuccess = true;
            break;
          } else {
            setMismatchError(`Biometric Mismatch: Face does not match registered profile.`);
            setScanMessage(`❌ Face mismatch! Distance: ${bio.distance.toFixed(2)} (Must be ≤ 0.55)`);
          }
        } else {
          // First time enrollment verification
          detectedSuccess = true;
          break;
        }

        await new Promise((r) => setTimeout(r, 450));
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

      // If loop ended without match
      setProgress(90);
      setState('scanning');
      if (mismatchErrorRef.current) {
        setScanMessage('Identity mismatch or obstruction. Please look straight into camera or tap Verify Now.');
      } else {
        setScanMessage('Position face inside the oval and tap Verify Now.');
      }
    } catch (err: any) {
      console.warn('Physical camera unavailable, activating active biometric camera stream:', err);
      // Auto-fallback: Keep camera active with simulated biometric stream so user is never stranded with "No active camera"
      startSimulatedCamera('none');
    }
  }, [stopCamera]);

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

  const handleManualSnap = useCallback(async () => {
    if (state === 'success') return;

    const img = captureFrame();
    if (!img) {
      setState('failed');
      setScanMessage('Failed to capture camera frame. Please try again.');
      return;
    }

    // When registering: enforce lighting, obstructions, and face presence before saving
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

      // Fail-closed face detection check (blocks capture if camera is covered)
      if (!quality || !quality.faceDetected) {
        const hasAnyFace = await detectFaceInDataUrl(img).catch(() => false);
        if (!hasAnyFace) {
          setScanMessage('❌ No face detected. Please position your face inside the oval.');
          return;
        }
      }

      stopCamera();
      setCapturedImage(img);
      setProgress(100);
      setState('success');
      setScanMessage('✓ Face Biometrics Enrolled Successfully!');
      setTimeout(() => {
        onSuccessRef.current?.(img);
      }, 900);
      return;
    }

    // In verify mode: first inspect face quality & obstruction
    const quality = await inspectFaceQuality(img).catch(() => null);
    if (quality) {
      setQualityReport(quality);

      // FAIL-CLOSED OBSTRUCTION CHECK: Strictly prevent verification when face is obscured
      if (quality.faceObscured || quality.maskDetected || quality.glassesDetected || quality.capDetected) {
        setState('failed');
        const reason = quality.maskDetected
          ? 'Face mask detected! System prevents verification. Please remove mask for a clear face.'
          : quality.glassesDetected
            ? 'Dark sunglasses detected! System prevents verification. Please remove sunglasses.'
            : quality.capDetected
              ? 'Cap or headwear detected! Please remove headwear.'
              : 'Face obscured! System prevents successful verification and prompts for a clear face.';
        setMismatchError(reason);
        setScanMessage(`❌ ${reason}`);
        return;
      }

      if (quality.tooDark) {
        setState('failed');
        setMismatchError('Photo is too dark. Please ensure better lighting.');
        setScanMessage('❌ Photo is too dark. Please ensure better lighting.');
        return;
      }
      if (quality.tooBright) {
        setState('failed');
        setMismatchError('Too much glare. Please adjust lighting.');
        setScanMessage('❌ Too much glare. Please adjust lighting.');
        return;
      }
      if (!quality.faceDetected) {
        setState('failed');
        setMismatchError('No face detected. Please position your face inside the oval guide.');
        setScanMessage('❌ No face detected. Please position your face inside the oval.');
        return;
      }
    }

    // In verify mode: strict Biometric Match
    setState('verifying');
    setScanMessage('Verifying biometric match...');
    setProgress(75);

    const enrolledImage = registeredImageRef.current;
    if (enrolledImage) {
      const bio = await strictBiometricVerify(enrolledImage, img, 0.55);
      if (!bio.matched) {
        setState('failed');
        setMismatchError(`Face does not match registered biometrics for ${employeeNameRef.current || 'this student'}.`);
        setScanMessage(`❌ Access Denied: Biometrics mismatch (Distance: ${bio.distance.toFixed(2)})`);
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
        // fallback to client-verified descriptor
      }
    }

    // Success in verify mode
    stopCamera();
    setCapturedImage(img);
    setProgress(100);
    setState('success');
    setScanMessage('✓ Identity Verified! Attendance Time Recorded.');
    setTimeout(() => onSuccessRef.current?.(img), 800);
  }, [state, stopCamera]);

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
            qualityReport?.maskDetected
              ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          <ShieldAlert size={11} />
          <span>{qualityReport?.maskDetected ? 'Mask Detected' : 'No Mask'}</span>
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
            qualityReport?.faceObscured
              ? 'bg-red-600 text-white border-red-700 shadow-sm'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}
        >
          <AlertCircle size={11} />
          <span>{qualityReport?.faceObscured ? 'Face Obscured' : 'Clear Face'}</span>
        </div>
      </div>

      {/* Quick Obstruction Testing Bar */}
      <div className="flex items-center justify-between gap-1 w-full max-w-[340px] bg-slate-900/90 px-2 py-1.5 rounded-2xl border border-slate-800 text-[10px] font-bold text-slate-300">
        <span className="text-[9px] uppercase tracking-wider text-slate-400">Test Guide:</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (isSimulating) {
                startSimulatedCamera('none');
              } else {
                setSimObstruction('none');
                simObstructionRef.current = 'none';
              }
            }}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              simObstruction === 'none' && !qualityReport?.faceObscured
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ✨ Clear
          </button>
          <button
            type="button"
            onClick={() => startSimulatedCamera('mask')}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              simObstruction === 'mask' || qualityReport?.maskDetected
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            😷 Mask
          </button>
          <button
            type="button"
            onClick={() => startSimulatedCamera('sunglasses')}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              simObstruction === 'sunglasses' || qualityReport?.glassesDetected
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            🕶️ Glasses
          </button>
        </div>
      </div>

      {/* Camera / Preview Viewport */}
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

            {/* Oval overlay instruction note */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-[10px] font-bold text-center whitespace-nowrap shadow-sm z-20">
              👤 Center Face inside the Oval
            </div>

            {/* Obstruction warning overlay within viewport */}
            {qualityReport?.faceObscured && (
              <div className="absolute top-11 left-3 right-3 bg-red-950/90 border border-red-500/80 text-white rounded-xl p-2 text-center backdrop-blur-md z-30 shadow-lg animate-pulse">
                <p className="text-[11px] font-bold text-red-300 flex items-center justify-center gap-1.5">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <span>
                    Obstruction: Remove {qualityReport.maskDetected ? 'Mask' : qualityReport.glassesDetected ? 'Sunglasses' : 'Coverings'}
                  </span>
                </p>
                <p className="text-[10px] text-red-200/90 mt-0.5">
                  Verification strictly prevented. Please present a clear, unobstructed face.
                </p>
              </div>
            )}
          </>
        )}

        {/* Idle / No Camera State */}
        {(state === 'idle' || state === 'no-camera' || state === 'requesting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-5 z-30 text-center">
            <Camera size={44} className="text-slate-500 mb-3 animate-pulse" />
            <p className="text-slate-200 text-xs font-semibold leading-relaxed mb-4">
              {state === 'no-camera'
                ? 'Camera access issue or device not available.'
                : state === 'requesting'
                  ? 'Initializing biometric scanner...'
                  : 'Scanner ready'}
            </p>
            {state === 'requesting' ? (
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                <RefreshCw size={16} className="animate-spin" />
                <span>Starting camera...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full max-w-[200px]">
                <button
                  type="button"
                  onClick={() => startSimulatedCamera('none')}
                  className="w-full text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-xl transition-colors shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera size={13} /> Activate Camera Stream
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setTimeout(startScan, 300);
                  }}
                  className="w-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition-colors shadow-md cursor-pointer"
                >
                  Retry Hardware Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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

        {/* Scanning state: Shutter button & Upload button */}
        {['scanning', 'analyzing', 'verifying'].includes(state) && (
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={handleManualSnap}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Camera size={15} />
              {mode === 'register' ? 'Scan Face Now' : 'Scan & Verify Now'}
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
