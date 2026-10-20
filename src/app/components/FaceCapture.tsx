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
  Move,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import { isSecurityApiConfigured, verifyFace, registerFace } from '../services/securityApi';

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

// Normalized 68-point anatomical facial landmark template (proportional to standard face geometry)
const NORMALIZED_68_LANDMARKS: Array<{ x: number; y: number }> = [
  // Jaw Outline (0-16)
  { x: -0.66, y: -0.28 }, { x: -0.64, y: -0.12 }, { x: -0.61, y: 0.05 }, { x: -0.56, y: 0.22 },
  { x: -0.48, y: 0.38 },  { x: -0.36, y: 0.52 },  { x: -0.24, y: 0.65 }, { x: -0.12, y: 0.74 },
  { x: 0.00,  y: 0.78 },  { x: 0.12,  y: 0.74 },  { x: 0.24,  y: 0.65 }, { x: 0.36,  y: 0.52 },
  { x: 0.48,  y: 0.38 },  { x: 0.56,  y: 0.22 },  { x: 0.61,  y: 0.05 }, { x: 0.64,  y: -0.12 },
  { x: 0.66,  y: -0.28 },
  // Right Eyebrow (17-21)
  { x: -0.52, y: -0.42 }, { x: -0.42, y: -0.48 }, { x: -0.30, y: -0.50 }, { x: -0.18, y: -0.46 }, { x: -0.09, y: -0.40 },
  // Left Eyebrow (22-26)
  { x: 0.09,  y: -0.40 }, { x: 0.18,  y: -0.46 }, { x: 0.30,  y: -0.50 }, { x: 0.42,  y: -0.48 }, { x: 0.52,  y: -0.42 },
  // Nose Bridge (27-30)
  { x: 0.00,  y: -0.32 }, { x: 0.00,  y: -0.18 }, { x: 0.00,  y: -0.05 }, { x: 0.00,  y: 0.08 },
  // Nostrils / Base (31-35)
  { x: -0.17, y: 0.12 },  { x: -0.08, y: 0.15 },  { x: 0.00,  y: 0.16 },  { x: 0.08,  y: 0.15 },  { x: 0.17,  y: 0.12 },
  // Right Eye (36-41)
  { x: -0.45, y: -0.26 }, { x: -0.36, y: -0.32 }, { x: -0.24, y: -0.32 }, { x: -0.17, y: -0.26 }, { x: -0.24, y: -0.22 }, { x: -0.36, y: -0.22 },
  // Left Eye (42-47)
  { x: 0.17,  y: -0.26 }, { x: 0.24,  y: -0.32 }, { x: 0.36,  y: -0.32 }, { x: 0.45,  y: -0.26 }, { x: 0.36,  y: -0.22 }, { x: 0.24,  y: -0.22 },
  // Outer Lips (48-59)
  { x: -0.26, y: 0.38 },  { x: -0.17, y: 0.32 },  { x: -0.08, y: 0.30 },  { x: 0.00,  y: 0.31 },  { x: 0.08,  y: 0.30 },  { x: 0.17,  y: 0.32 },
  { x: 0.26,  y: 0.38 },  { x: 0.17,  y: 0.46 },  { x: 0.08,  y: 0.50 },  { x: 0.00,  y: 0.51 },  { x: -0.08, y: 0.50 },  { x: -0.17, y: 0.46 },
  // Inner Lips (60-67)
  { x: -0.21, y: 0.38 },  { x: -0.08, y: 0.35 },  { x: 0.00,  y: 0.35 },  { x: 0.08,  y: 0.35 },  { x: 0.21,  y: 0.38 },  { x: 0.08,  y: 0.42 },
  { x: 0.00,  y: 0.43 },  { x: -0.08, y: 0.42 },
];

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

  // Live 68-point landmark tracking refs
  const liveLandmarksRef = useRef<Array<{ x: number; y: number }> | null>(null);
  const smoothedLandmarksRef = useRef<Array<{ x: number; y: number }> | null>(null);
  const lastLandmarkDetectionTimeRef = useRef<number>(0);

  const [state, setState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<FaceQualityReport | null>(null);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  // Movable facial recognition grid state & refs
  const [gridOffset, setGridOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const gridOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showMoveControls, setShowMoveControls] = useState<boolean>(false);

  const nudgeGrid = useCallback((dx: number, dy: number) => {
    const newX = Math.max(-130, Math.min(130, gridOffsetRef.current.x + dx));
    const newY = Math.max(-150, Math.min(150, gridOffsetRef.current.y + dy));
    gridOffsetRef.current = { x: newX, y: newY };
    setGridOffset({ x: newX, y: newY });
  }, []);

  const resetGrid = useCallback(() => {
    gridOffsetRef.current = { x: 0, y: 0 };
    setGridOffset({ x: 0, y: 0 });
  }, []);

  const stateRef = useRef<ScanState>(state);
  const qualityReportRef = useRef<FaceQualityReport | null>(qualityReport);
  const mismatchErrorRef = useRef<string | null>(mismatchError);
  const hasFiredSuccessRef = useRef(false);

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const fireSuccessOnce = useCallback((img?: string) => {
    if (hasFiredSuccessRef.current) return; // guard: only the first success wins
    hasFiredSuccessRef.current = true;
    onSuccessRef.current?.(img);
  }, []);

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
   * Draw the 68-point biometric facial landmark mesh, wireframe interconnects,
   * scanning beam, and biometric HUD target framing on the canvas overlay
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

      const currentState = stateRef.current;
      const currentMismatch = mismatchErrorRef.current;
      const isSuccess = currentState === 'success';
      const isFailed = currentState === 'failed' || Boolean(currentMismatch);

      // Calculate user's movable grid offset in canvas coordinates
      // Note: canvas has CSS scaleX(-1) mirror effect, so screen +X corresponds to -X in internal canvas coordinates
      const canvasOffsetX = displayW > 0 ? -(gridOffsetRef.current.x / displayW) * canvas.width : 0;
      const canvasOffsetY = displayH > 0 ? (gridOffsetRef.current.y / displayH) * canvas.height : 0;

      // Determine 68 landmark points (live face tracked or anatomical template)
      let targetPts: Array<{ x: number; y: number }>;
      const isLiveTracked = Boolean(
        liveLandmarksRef.current &&
        liveLandmarksRef.current.length >= 68 &&
        Date.now() - lastLandmarkDetectionTimeRef.current < 650
      );

      if (isLiveTracked && liveLandmarksRef.current && video.videoWidth > 0) {
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;
        targetPts = liveLandmarksRef.current.map((p) => ({
          x: p.x * scaleX,
          y: p.y * scaleY,
        }));
      } else {
        // Ideal anatomical biometric mesh template centered in scanner with soft breathing pulse + user movable offset
        const cx = canvas.width / 2 + canvasOffsetX;
        const cy = canvas.height * 0.48 + canvasOffsetY;
        const breathe = Math.sin(Date.now() / 600) * 0.015;
        const faceW = canvas.width * (0.35 + breathe);
        const faceH = canvas.height * (0.35 + breathe);
        targetPts = NORMALIZED_68_LANDMARKS.map((p) => ({
          x: cx + p.x * faceW,
          y: cy + p.y * faceH,
        }));
      }

      // Smooth points with lerp for fluid 60fps tracking (instant 1.0 when dragging for real-time responsiveness)
      if (!smoothedLandmarksRef.current || smoothedLandmarksRef.current.length !== targetPts.length) {
        smoothedLandmarksRef.current = targetPts.map((p) => ({ ...p }));
      } else {
        const smoothRate = isDraggingRef.current ? 1.0 : isLiveTracked ? 0.38 : 0.20;
        for (let i = 0; i < targetPts.length; i++) {
          smoothedLandmarksRef.current[i].x += (targetPts[i].x - smoothedLandmarksRef.current[i].x) * smoothRate;
          smoothedLandmarksRef.current[i].y += (targetPts[i].y - smoothedLandmarksRef.current[i].y) * smoothRate;
        }
      }

      const pts = smoothedLandmarksRef.current;
      if (!pts || pts.length < 68) return;

      // 1. Calculate Face Bounding Box & HUD Corners
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const padX = 18 * dpr;
      const padY = 22 * dpr;
      const boxLeft = Math.max(8 * dpr, minX - padX);
      const boxRight = Math.min(canvas.width - 8 * dpr, maxX + padX);
      const boxTop = Math.max(12 * dpr, minY - padY);
      const boxBottom = Math.min(canvas.height - 12 * dpr, maxY + padY);
      const boxW = boxRight - boxLeft;
      const boxH = boxBottom - boxTop;

      // 1.5. Draw Movable Biometric Matrix Grid (Rule of Thirds Matrix + Targeting Reticle)
      ctx.save();
      const gridColor = isSuccess
        ? 'rgba(34, 197, 94, 0.25)'
        : isFailed
          ? 'rgba(239, 68, 68, 0.25)'
          : isDraggingRef.current
            ? 'rgba(0, 229, 255, 0.45)'
            : 'rgba(56, 189, 248, 0.22)';
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([3 * dpr, 4 * dpr]); // Dashed biometric matrix grid lines

      // Horizontal matrix division lines
      const h1 = boxTop + boxH * 0.333;
      const h2 = boxTop + boxH * 0.666;
      ctx.beginPath();
      ctx.moveTo(boxLeft, h1); ctx.lineTo(boxRight, h1);
      ctx.moveTo(boxLeft, h2); ctx.lineTo(boxRight, h2);

      // Vertical matrix division lines
      const v1 = boxLeft + boxW * 0.333;
      const v2 = boxLeft + boxW * 0.666;
      ctx.moveTo(v1, boxTop); ctx.lineTo(v1, boxBottom);
      ctx.moveTo(v2, boxTop); ctx.lineTo(v2, boxBottom);
      ctx.stroke();

      // Center crosshair reticle (+)
      const midX = (boxLeft + boxRight) / 2;
      const midY = (boxTop + boxBottom) / 2;
      const crossSize = 9 * dpr;
      ctx.setLineDash([]);
      ctx.strokeStyle = isSuccess
        ? 'rgba(34, 197, 94, 0.70)'
        : isFailed
          ? 'rgba(239, 68, 68, 0.70)'
          : isDraggingRef.current
            ? 'rgba(0, 229, 255, 0.90)'
            : 'rgba(0, 229, 255, 0.60)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.moveTo(midX - crossSize, midY); ctx.lineTo(midX + crossSize, midY);
      ctx.moveTo(midX, midY - crossSize); ctx.lineTo(midX, midY + crossSize);
      ctx.stroke();

      // Center targeting circle
      ctx.beginPath();
      ctx.arc(midX, midY, 15 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = isSuccess
        ? 'rgba(34, 197, 94, 0.35)'
        : isFailed
          ? 'rgba(239, 68, 68, 0.35)'
          : isDraggingRef.current
            ? 'rgba(0, 229, 255, 0.60)'
            : 'rgba(0, 229, 255, 0.30)';
      ctx.stroke();

      // Top drag grip dots (shows the grid is draggable)
      const handleColor = isDraggingRef.current ? '#00e5ff' : 'rgba(255, 255, 255, 0.55)';
      ctx.fillStyle = handleColor;
      const handleY = Math.max(6 * dpr, boxTop - 6 * dpr);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(midX + i * (5 * dpr), handleY, 1.4 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Animated Scanning Laser Beam across face zone (soft holographic opacity)
      ctx.save();
      const scanRange = boxH;
      scanLineRef.current = (scanLineRef.current + (2.5 * dpr)) % scanRange;
      const currentScanY = boxTop + scanLineRef.current;

      const laserThickness = 14 * dpr;
      const laserColor = isSuccess ? '#22c55e' : isFailed ? '#ef4444' : '#00e5ff';
      const laserGrad = ctx.createLinearGradient(0, currentScanY - laserThickness, 0, currentScanY + laserThickness);
      laserGrad.addColorStop(0, 'transparent');
      laserGrad.addColorStop(0.5, laserColor + '30'); // soft, low opacity
      laserGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = laserGrad;
      ctx.fillRect(boxLeft, currentScanY - laserThickness, boxW, laserThickness * 2);

      // Thin bright laser beam line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
      ctx.lineWidth = 1.0 * dpr;
      ctx.beginPath();
      ctx.moveTo(boxLeft + (8 * dpr), currentScanY);
      ctx.lineTo(boxRight - (8 * dpr), currentScanY);
      ctx.stroke();
      ctx.restore();

      // 3. Biometric HUD Target Corner Brackets
      ctx.save();
      const cornerColor = isSuccess ? '#22c55e' : isFailed ? '#ef4444' : '#38bdf8';
      ctx.strokeStyle = cornerColor;
      ctx.globalAlpha = isSuccess ? 0.90 : isFailed ? 0.90 : 0.55;
      ctx.lineWidth = 2.0 * dpr;
      ctx.shadowColor = cornerColor;
      ctx.shadowBlur = 4 * dpr;
      const cLen = 16 * dpr;

      // Top-Left ┌
      ctx.beginPath();
      ctx.moveTo(boxLeft, boxTop + cLen);
      ctx.lineTo(boxLeft, boxTop);
      ctx.lineTo(boxLeft + cLen, boxTop);
      ctx.stroke();

      // Top-Right ┐
      ctx.beginPath();
      ctx.moveTo(boxRight - cLen, boxTop);
      ctx.lineTo(boxRight, boxTop);
      ctx.lineTo(boxRight, boxTop + cLen);
      ctx.stroke();

      // Bottom-Left └
      ctx.beginPath();
      ctx.moveTo(boxLeft, boxBottom - cLen);
      ctx.lineTo(boxLeft, boxBottom);
      ctx.lineTo(boxLeft + cLen, boxBottom);
      ctx.stroke();

      // Bottom-Right ┘
      ctx.beginPath();
      ctx.moveTo(boxRight - cLen, boxBottom);
      ctx.lineTo(boxRight, boxBottom);
      ctx.lineTo(boxRight, boxBottom - cLen);
      ctx.stroke();
      ctx.restore();

      // 4. Subtle Triangulated 3D Facial Mesh Interconnects (low opacity)
      ctx.save();
      ctx.strokeStyle = isSuccess ? 'rgba(34, 197, 94, 0.40)' : isFailed ? 'rgba(239, 68, 68, 0.40)' : 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 0.9 * dpr;
      const meshPairs: Array<[number, number]> = [
        // Eyebrows to nose bridge
        [21, 27], [22, 27], [20, 27], [23, 27],
        // Inner eye corners to nose bridge
        [39, 27], [42, 27], [39, 28], [42, 28],
        // Eyebrow outer to temples
        [17, 0], [26, 16], [36, 0], [45, 16],
        // Nose base to upper lip
        [33, 51], [31, 48], [35, 54], [32, 50], [34, 52],
        // Mouth corners to jawline
        [48, 4], [54, 12], [48, 5], [54, 11],
        // Chin to bottom lip
        [8, 57], [7, 58], [9, 56],
      ];
      ctx.beginPath();
      for (const [a, b] of meshPairs) {
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
      }
      ctx.stroke();
      ctx.restore();

      // Helpers to draw anatomical landmark groups with low translucent opacity (soft holographic mesh)
      const meshAlpha = isSuccess ? 0.90 : isFailed ? 0.90 : 0.38;

      const drawPolyline = (indices: number[], color: string, width = 1.4, close = false) => {
        ctx.save();
        ctx.beginPath();
        const strokeColor = isSuccess ? '#22c55e' : isFailed ? '#ef4444' : color;
        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = meshAlpha;
        ctx.lineWidth = width * dpr;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 3 * dpr;
        ctx.moveTo(pts[indices[0]].x, pts[indices[0]].y);
        for (let i = 1; i < indices.length; i++) {
          ctx.lineTo(pts[indices[i]].x, pts[indices[i]].y);
        }
        if (close) ctx.closePath();
        ctx.stroke();
        ctx.restore();
      };

      const drawNodes = (indices: number[], fillColor: string, strokeColor: string, radius = 2.0) => {
        ctx.save();
        ctx.globalAlpha = isSuccess ? 0.92 : isFailed ? 0.92 : 0.42;
        for (const idx of indices) {
          const p = pts[idx];
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * dpr, 0, Math.PI * 2);
          ctx.fillStyle = isSuccess ? '#22c55e' : isFailed ? '#ef4444' : fillColor;
          ctx.fill();
          ctx.lineWidth = 0.8 * dpr;
          ctx.strokeStyle = isSuccess ? '#15803d' : isFailed ? '#b91c1c' : strokeColor;
          ctx.stroke();
        }
        ctx.restore();
      };

      // 5. Draw Groups matching user's reference photo (at low opacity):
      // A. Jawline (0..16) -> Royal Blue
      const jawIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
      drawPolyline(jawIndices, '#2563eb', 1.5);
      drawNodes(jawIndices, '#3b82f6', '#1d4ed8', 2.1);

      // B. Eyebrows (17..21 & 22..26) -> Cyan / Sky Blue
      const rBrowIndices = [17, 18, 19, 20, 21];
      const lBrowIndices = [22, 23, 24, 25, 26];
      drawPolyline(rBrowIndices, '#0284c7', 1.5);
      drawPolyline(lBrowIndices, '#0284c7', 1.5);
      drawNodes(rBrowIndices, '#38bdf8', '#0369a1', 2.0);
      drawNodes(lBrowIndices, '#38bdf8', '#0369a1', 2.0);

      // C. Nose Bridge & Nostril Base (27..35) -> Mint / Teal
      const noseBridgeIndices = [27, 28, 29, 30];
      const noseBaseIndices = [31, 32, 33, 34, 35];
      drawPolyline(noseBridgeIndices, '#0d9488', 1.5);
      drawPolyline(noseBaseIndices, '#0d9488', 1.5);
      drawNodes(noseBridgeIndices, '#2dd4bf', '#0f766e', 2.0);
      drawNodes(noseBaseIndices, '#2dd4bf', '#0f766e', 2.0);

      // D. Eyes (36..41 & 42..47) -> Amber / Yellow
      const rEyeIndices = [36, 37, 38, 39, 40, 41];
      const lEyeIndices = [42, 43, 44, 45, 46, 47];
      drawPolyline(rEyeIndices, '#ca8a04', 1.5, true);
      drawPolyline(lEyeIndices, '#ca8a04', 1.5, true);
      drawNodes(rEyeIndices, '#facc15', '#a16207', 2.0);
      drawNodes(lEyeIndices, '#facc15', '#a16207', 2.0);

      // Eye pupil center dots
      const rPupilX = (pts[37].x + pts[38].x + pts[40].x + pts[41].x) / 4;
      const rPupilY = (pts[37].y + pts[38].y + pts[40].y + pts[41].y) / 4;
      const lPupilX = (pts[43].x + pts[44].x + pts[46].x + pts[47].x) / 4;
      const lPupilY = (pts[43].y + pts[44].y + pts[46].y + pts[47].y) / 4;
      ctx.save();
      ctx.globalAlpha = isSuccess ? 0.90 : 0.40;
      ctx.fillStyle = isSuccess ? '#22c55e' : '#fef08a';
      ctx.beginPath();
      ctx.arc(rPupilX, rPupilY, 1.8 * dpr, 0, Math.PI * 2);
      ctx.arc(lPupilX, lPupilY, 1.8 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // E. Mouth - Outer & Inner Lips (48..67) -> Vivid Red / Coral
      const outerLipIndices = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59];
      const innerLipIndices = [60, 61, 62, 63, 64, 65, 66, 67];
      drawPolyline(outerLipIndices, '#e11d48', 1.5, true);
      drawPolyline(innerLipIndices, '#f43f5e', 1.2, true);
      drawNodes(outerLipIndices, '#f43f5e', '#be123c', 2.0);
      drawNodes(innerLipIndices, '#fb7185', '#e11d48', 1.7);

      // 6. Success biometric illumination
      if (currentState === 'success') {
        ctx.save();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
        ctx.fillRect(boxLeft, boxTop, boxW, boxH);
        ctx.restore();
      }

      if (currentState === 'scanning' || currentState === 'analyzing' || currentState === 'verifying') {
        animFrameRef.current = requestAnimationFrame(drawOverlay);
      }
    } catch {
      // silent catch for overlay
    }
  }, []);

  // Background 68-point live face landmark detection on live video element
  useEffect(() => {
    if (state !== 'scanning' && state !== 'analyzing' && state !== 'verifying') {
      liveLandmarksRef.current = null;
      return;
    }

    let active = true;
    let timer: any = null;

    const track = async () => {
      if (!active) return;
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && !video.paused && !video.ended) {
        try {
          if (typeof window !== 'undefined' && (window as any).faceapi) {
            const api = (window as any).faceapi;
            if (api.nets?.tinyFaceDetector?.params && api.nets?.faceLandmark68Net?.params) {
              const res = await api
                .detectSingleFace(video, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.12 }))
                .withFaceLandmarks();
              if (res?.landmarks?.positions && active) {
                liveLandmarksRef.current = res.landmarks.positions.map((p: any) => ({
                  x: Number(p.x),
                  y: Number(p.y),
                }));
                lastLandmarkDetectionTimeRef.current = Date.now();
              }
            }
          }
        } catch {
          // silent landmark track error
        }
      }
      if (active) {
        timer = setTimeout(track, 60);
      }
    };

    track();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [state]);

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

    // Target dimensions (400x533 portrait) - optimized client-side compression
    const targetW = 400;
    const targetH = Math.round(targetW / containerAspect);

    const cap = document.createElement('canvas');
    cap.width = targetW;
    cap.height = targetH;
    const ctx = cap.getContext('2d');
    if (!ctx) return undefined;

    // Draw the cropped viewport from the live camera stream
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
    // 0.80 JPEG compression provides high biometric fidelity with 70% smaller payload for instant verification
    return cap.toDataURL('image/jpeg', 0.80);
  }, []);

  /**
   * Acquire live camera hardware stream and begin facial scanning
   */
  const startScan = useCallback(async () => {
    stopCamera();
    hasFiredSuccessRef.current = false;
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
        ? 'Align your face with the biometric landmark mesh...'
        : 'Align your face with the biometric landmark mesh...'
    );
    setProgress(20);

    // Pre-load biometric recognition models in the background
    loadFaceModels().catch(() => {});

    try {
      // REGISTRATION MODE: instant scan when face is detected
      if (currentMode === 'register') {
        while (streamRef.current && stateRef.current === 'scanning') {
          const currentFrame = captureFrame();
          if (currentFrame) {
            const quality = await inspectFaceQuality(currentFrame).catch(() => null);
            if (quality) {
              setQualityReport(quality);

              // Soft advisory cues — never block scanning
              if (quality.glassesDetected) {
                setScanMessage('⚠️ Warning: Glasses detected. Please remove glasses for clear facial recognition.');
              } else if (quality.capDetected) {
                setScanMessage('⚠️ Warning: Hat/cap detected. Please remove headwear for clear facial recognition.');
              } else if (quality.maskDetected) {
                setScanMessage('⚠️ Warning: Face mask detected. Please remove mask for clear facial recognition.');
              }
              if (quality.tooDark && (quality.brightness ?? 100) < 20) {
                setProgress(15);
                setScanMessage('⚠️ Too dark! Move to a brighter area.');
                await new Promise((r) => setTimeout(r, 150));
                continue;
              }
              if (quality.tooBright && (quality.brightness ?? 100) > 250) {
                setProgress(15);
                setScanMessage('⚠️ Too bright! Avoid direct glare.');
                await new Promise((r) => setTimeout(r, 150));
                continue;
              }

              if (quality.faceDetected) {
                stopCamera();
                setCapturedImage(currentFrame);
                setProgress(100);
                setState('success');
                setScanMessage('✓ Face Recognized & Enrolled!');
                fireSuccessOnce(currentFrame);
                return;
              } else {
                setProgress(35);
                setScanMessage('Align your face with the biometric landmark mesh...');
              }
            } else {
              // Fallback if inspection unavailable: register frame immediately
              stopCamera();
              setCapturedImage(currentFrame);
              setProgress(100);
              setState('success');
              setScanMessage('✓ Face Recognized & Enrolled!');
              fireSuccessOnce(currentFrame);
              return;
            }
          }
          await new Promise((r) => setTimeout(r, 100));
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
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        lastCaptured = currentFrame;

        const quality = await inspectFaceQuality(currentFrame).catch(() => null);
        if (quality) {
          setQualityReport(quality);

          // Soft advisory cues — do not block capture
          if (quality.glassesDetected) {
            setScanMessage('⚠️ Warning: Glasses detected. Please remove glasses for clear facial recognition.');
          } else if (quality.capDetected) {
            setScanMessage('⚠️ Warning: Hat/cap detected. Please remove headwear for clear facial recognition.');
          } else if (quality.maskDetected) {
            setScanMessage('⚠️ Warning: Face mask detected. Please remove mask for clear facial recognition.');
          }

          if (quality.faceDetected) {
            const enrolledImage = registeredImageRef.current;
            if (!enrolledImage) {
              setScanMessage('❌ Missing registered face biometrics.');
              break;
            }

            matchAttempts++;
            setProgress(Math.min(50 + matchAttempts * 10, 95));
            setScanMessage('Scanning face biometrics with AI...');

            const bio = await strictBiometricVerify(enrolledImage, currentFrame, 0.58, true);
            if (bio.matched) {
              setMismatchError(null);
              detectedSuccess = true;
              break;
            } else {
              setScanMessage(
                bio.distance < 0.68
                  ? 'Hold still... Verifying face...'
                  : matchAttempts > 6
                    ? 'Hold still or tap "Scan & Verify Now"'
                    : `⚠️ Face does not match registered biometrics for ${employeeNameRef.current || 'this trainee'}.`
              );
            }
          } else {
            setProgress(20);
            setScanMessage('Align your face with the biometric landmark mesh...');
          }
        }

        await new Promise((r) => setTimeout(r, 100));
      }

      if (detectedSuccess && lastCaptured) {
        setCapturedImage(lastCaptured);
        setProgress(100);
        setState('success');
        setScanMessage('✓ Identity Verified! Timestamp Saved.');
        stopCamera();
        setTimeout(() => fireSuccessOnce(lastCaptured), 600);
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
          setScanMessage('⚠️ No face detected. Please align your face with the biometric mesh.');
          return;
        }
      }
    }

    // When registering: enforce quality, lighting, and presence
    if (modeRef.current === 'register') {
      const hasAnyFace = await detectFaceInDataUrl(img).catch(() => true);
      if (!hasAnyFace) {
        setScanMessage('❌ No face detected. Please align your face with the biometric mesh.');
        return;
      }

      stopCamera();
      setCapturedImage(img);
      setProgress(100);
      setState('success');
      setScanMessage('✓ Face Biometrics Enrolled Successfully!');
      fireSuccessOnce(img);
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
        } = {
          captured_image: img,
        };
        if (empId) payload.employee_id = empId;
        if (enrolledImage) payload.registered_image = enrolledImage;

        let response: any;
        try {
          response = await verifyFace(payload);
        } catch (initialErr: any) {
          const errStr = String(initialErr?.message || initialErr || '');
          // If the backend has not yet enrolled this employee, auto-register using the enrolled image if available
          if ((errStr.includes('No registered face found') || errStr.includes('registered_image or employee_id is required')) && empId && enrolledImage) {
            console.log('[FaceCapture] Auto-registering face on security backend for employee:', empId);
            try {
              await registerFace({ employee_id: empId, image: enrolledImage });
              response = await verifyFace(payload);
            } catch (autoErr) {
              console.warn('[FaceCapture] Auto-registration or retry failed:', autoErr);
              throw initialErr;
            }
          } else {
            throw initialErr;
          }
        }

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
    setTimeout(() => fireSuccessOnce(img), 300);
  }, [stopCamera, captureFrame]);

  const handleConfirmPhoto = useCallback(() => {
    if (!capturedImage) return;
    setState('success');
    setScanMessage(modeRef.current === 'register' ? '✓ Face Photo Saved for Account Profile!' : '✓ Identity Verified!');
    fireSuccessOnce(capturedImage);
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
            setScanMessage('⚠️ Warning: Glasses detected. Please remove glasses for clear facial recognition.');
          } else if (quality.capDetected) {
            setScanMessage('⚠️ Warning: Hat/cap detected. Please remove headwear for clear facial recognition.');
          } else if (quality.maskDetected) {
            setScanMessage('⚠️ Warning: Face mask detected. Please remove mask for clear facial recognition.');
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
          fireSuccessOnce(img);
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
    hasFiredSuccessRef.current = false; // allow a new scan attempt to fire onSuccess again
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
      <div
        className={`relative w-full max-w-[340px] aspect-[3/4] rounded-3xl overflow-hidden bg-slate-950 shadow-2xl border-2 border-slate-800 touch-none ${
          isScanning ? (isDragging ? 'cursor-grabbing select-none' : 'cursor-grab select-none') : ''
        }`}
        onPointerDown={(e) => {
          if (state !== 'scanning' && state !== 'analyzing' && state !== 'verifying') return;
          if ((e.target as HTMLElement).closest('button, input, a')) return;
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {}
          isDraggingRef.current = true;
          setIsDragging(true);
          dragStartPos.current = { x: e.clientX, y: e.clientY };
          initialOffset.current = { ...gridOffsetRef.current };
        }}
        onPointerMove={(e) => {
          if (!isDraggingRef.current) return;
          const dx = e.clientX - dragStartPos.current.x;
          const dy = e.clientY - dragStartPos.current.y;
          const newX = Math.max(-130, Math.min(130, Math.round(initialOffset.current.x + dx)));
          const newY = Math.max(-150, Math.min(150, Math.round(initialOffset.current.y + dy)));
          gridOffsetRef.current = { x: newX, y: newY };
          setGridOffset({ x: newX, y: newY });
        }}
        onPointerUp={(e) => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
          }
        }}
        onPointerCancel={(e) => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
          }
        }}
      >
        {state === 'preview' && capturedImage ? (
          <div className="relative w-full h-full">
            <img
              src={capturedImage}
              alt="Captured Biometric Preview"
              className="w-full h-full object-cover"
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

            {/* Movable Face Grid Guide & Control Bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-20">
              <div
                className={`px-3 py-1 rounded-full backdrop-blur-md text-[10px] font-bold flex items-center gap-1.5 shadow-sm transition-all ${
                  isDragging
                    ? 'bg-cyan-500/95 text-slate-950 shadow-cyan-500/40 scale-105'
                    : (gridOffset.x !== 0 || gridOffset.y !== 0)
                      ? 'bg-cyan-950/85 border border-cyan-500/60 text-cyan-300'
                      : 'bg-black/65 border border-white/10 text-white'
                }`}
              >
                <Move size={11} className={isDragging ? 'text-slate-950 animate-spin' : 'text-cyan-400'} />
                <span>
                  {isDragging
                    ? 'Dragging Face Grid...'
                    : (gridOffset.x !== 0 || gridOffset.y !== 0)
                      ? `Grid: ${gridOffset.x > 0 ? '+' : ''}${gridOffset.x}, ${gridOffset.y > 0 ? '+' : ''}${gridOffset.y}`
                      : 'Drag Face Grid to Move'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {(gridOffset.x !== 0 || gridOffset.y !== 0) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetGrid();
                    }}
                    className="px-2.5 py-1 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 hover:text-white text-[10px] font-bold backdrop-blur-md flex items-center gap-1 shadow-md transition-all cursor-pointer"
                    title="Reset grid to center"
                  >
                    <RotateCcw size={10} className="text-cyan-400" />
                    <span>Center</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveControls((prev) => !prev);
                  }}
                  className={`px-2 py-1 rounded-full backdrop-blur-md border text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    showMoveControls
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-md'
                      : 'bg-black/60 border-white/10 text-slate-300 hover:text-white'
                  }`}
                  title="Toggle move controls"
                >
                  <Move size={11} />
                  <span>D-Pad</span>
                </button>
              </div>
            </div>

            {/* Floating Precision D-Pad Nudge Controls */}
            {showMoveControls && isScanning && (
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute bottom-12 right-3 bg-slate-950/90 backdrop-blur-md p-2 rounded-2xl border border-cyan-500/50 shadow-2xl z-30 flex flex-col items-center gap-1 pointer-events-auto select-none"
              >
                <div className="text-[9px] font-extrabold text-cyan-400 tracking-wider mb-0.5">MOVE GRID</div>
                <button
                  type="button"
                  onClick={() => nudgeGrid(0, -15)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 hover:bg-cyan-600 active:scale-95 text-white transition-all cursor-pointer shadow-sm"
                  title="Nudge Up"
                >
                  <ChevronUp size={15} />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => nudgeGrid(-15, 0)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 hover:bg-cyan-600 active:scale-95 text-white transition-all cursor-pointer shadow-sm"
                    title="Nudge Left"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={resetGrid}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-cyan-400 text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                    title="Center Grid"
                  >
                    ●
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeGrid(15, 0)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 hover:bg-cyan-600 active:scale-95 text-white transition-all cursor-pointer shadow-sm"
                    title="Nudge Right"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => nudgeGrid(0, 15)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/90 hover:bg-cyan-600 active:scale-95 text-white transition-all cursor-pointer shadow-sm"
                  title="Nudge Down"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
            )}

            {/* Obstruction warning banner within viewport (clean warning text, no intrusive indicator overlays) */}
            {qualityReport && (qualityReport.faceObscured || qualityReport.glassesDetected || qualityReport.capDetected || qualityReport.maskDetected || qualityReport.poorBackgroundLighting || qualityReport.tooDark) && (
              <div className="absolute top-11 left-3 right-3 bg-slate-900/90 border border-amber-500/70 text-white rounded-2xl p-2.5 text-center backdrop-blur-md z-30 shadow-xl">
                <p className="text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1.5">
                  <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                  <span>
                    {qualityReport.glassesDetected
                      ? '⚠️ Warning: Glasses Detected — Please remove glasses'
                      : qualityReport.capDetected
                        ? '⚠️ Warning: Hat / Cap Detected — Please remove headwear'
                        : qualityReport.maskDetected
                          ? '⚠️ Warning: Face Mask Detected — Please remove mask'
                          : qualityReport.poorBackgroundLighting
                            ? '⚠️ Warning: Dark Background — Move to light area'
                            : qualityReport.tooDark
                              ? '⚠️ Warning: Dim Lighting — Move to bright light'
                              : '⚠️ Warning: Please ensure your face is clear'}
                  </span>
                </p>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  Ensure face, eyes, and forehead are fully visible without accessories.
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
              disabled={state === 'verifying' || state === 'analyzing'}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs shadow-md transition-all ${
                state === 'verifying' || state === 'analyzing'
                  ? 'bg-blue-600 text-white cursor-wait animate-pulse'
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
                    {mode === 'register'
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
