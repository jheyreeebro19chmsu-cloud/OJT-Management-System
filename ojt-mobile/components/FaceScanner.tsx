import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  Image,
  Platform,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  X,
  ShieldCheck,
  Sparkles,
  Scan,
  CheckCircle2,
  Camera,
  RefreshCw,
  FlipHorizontal,
  Check,
  AlertTriangle,
  Sun,
  Eye,
  Zap,
} from 'lucide-react-native';
import { biometricService, BiometricMatchResult, BiometricQualityResult } from '../services/biometricService';
import { deepfaceService, DeepFaceVerifyResult, DeepFaceModel } from '../services/deepfaceService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Vertical biometric oval aperture matching web proportions (~1.36:1 aspect ratio)
const FRAME_HEIGHT = Math.min(SCREEN_HEIGHT * 0.56, 400);
const FRAME_WIDTH = Math.min(FRAME_HEIGHT / 1.36, SCREEN_WIDTH * 0.78);

interface FaceScannerProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
  mode?: 'enroll' | 'clock_in' | 'clock_out' | 'verify_test' | null;
  enrolledPhoto?: string | null;
  employeeName?: string;
}

type ScanStatus = 'initializing' | 'aligning' | 'analyzing' | 'verifying' | 'success' | 'failed';

export default function FaceScanner({
  onCapture,
  onCancel,
  mode = 'enroll',
  enrolledPhoto,
  employeeName,
}: FaceScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isCapturing, setIsCapturing] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState('Position face inside the oval');
  const [matchDetails, setMatchDetails] = useState<{ confidence: number; distance: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [stableCount, setStableCount] = useState(0);
  const [deepFaceModel, setDeepFaceModel] = useState<DeepFaceModel>('VGG-Face');
  const [deepFaceResult, setDeepFaceResult] = useState<DeepFaceVerifyResult | null>(null);

  // Strict 3D Live-Face Challenge Anti-Spoof State
  const [livenessVerified, setLivenessVerified] = useState(false);
  const livenessVerifiedRef = useRef(false);
  const [livenessStepText, setLivenessStepText] = useState('🛡️ Step 1/3: Look straight ahead');
  const blinkStateRef = useRef<'calibrating' | 'turn_head' | 'blink_and_smile' | 'verified'>('calibrating');
  const blinkFrameRef = useRef<string | null>(null);
  const bestLiveFrameRef = useRef<string | null>(null);
  const scanStatusRef = useRef<ScanStatus>('initializing');
  const scanStartedAtRef = useRef<number>(Date.now());
  const noFaceSinceRef = useRef<number>(0);
  const phaseStartedAtRef = useRef<number>(Date.now());
  const spoofStreakRef = useRef<number>(0);
  const livenessStatsRef = useRef({
    calibFrames: 0,
    sumYaw: 0,
    sumAsym: 0,
    sumEAR: 0,
    sumPitch: 0,
    sumMouthToJaw: 0,
    sumMouthLift: 0,
    sumMAR: 0,
    baselineYaw: 0.5,
    baselineAsym: 1.0,
    baselineEAR: 0.28,
    peakOpenEAR: 0.28,
    minClosedEAR: 0.28,
    prevEAR: -1,
    baselinePitch: 0.52,
    baselineMouthToJaw: 0.42,
    minMouthToJaw: 0.42,
    baselineMouthLift: 0.0,
    minMouthLift: 0.0,
    baselineMAR: 0.04,
    minMAR: 0.04,
    baselineWidth: 0.35,
    sawBlinkDrop: false,
    blinkDone: false,
    smileDone: false,
    prevCx: -1,
    prevCy: -1,
    prevWidth: 0,
    missedFrames: 0,
  });

  const updateScanStatus = useCallback((next: ScanStatus) => {
    scanStatusRef.current = next;
    setScanStatus(next);
  }, []);

  const resetMobileLiveness = useCallback((badgeMsg = '🛡️ Step 1/3: Look straight ahead') => {
    livenessVerifiedRef.current = false;
    setLivenessVerified(false);
    blinkStateRef.current = 'calibrating';
    blinkFrameRef.current = null;
    phaseStartedAtRef.current = Date.now();
    setLivenessStepText(badgeMsg);
    livenessStatsRef.current = {
      calibFrames: 0,
      sumYaw: 0,
      sumAsym: 0,
      sumEAR: 0,
      sumPitch: 0,
      sumMouthToJaw: 0,
      sumMouthLift: 0,
      sumMAR: 0,
      baselineYaw: 0.5,
      baselineAsym: 1.0,
      baselineEAR: 0.28,
      peakOpenEAR: 0.28,
      minClosedEAR: 0.28,
      prevEAR: -1,
      baselinePitch: 0.52,
      baselineMouthToJaw: 0.42,
      minMouthToJaw: 0.42,
      baselineMouthLift: 0.0,
      minMouthLift: 0.0,
      baselineMAR: 0.04,
      minMAR: 0.04,
      baselineWidth: 0.35,
      sawBlinkDrop: false,
      blinkDone: false,
      smileDone: false,
      prevCx: -1,
      prevCy: -1,
      prevWidth: 0,
      missedFrames: 0,
    };
  }, []);

  const cameraRef = useRef<CameraView | null>(null);
  const isScanningRef = useRef(false);
  const isMountedRef = useRef(true);
  const hasFinishedRef = useRef(false);

  // Animated laser scanning line (vertical sweep)
  const scanAnim = useRef(new Animated.Value(0)).current;
  // Animated progress bar (0 to 1)
  const progressAnim = useRef(new Animated.Value(0.15)).current;
  // Pulsing border glow
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Haptic alarm throttling (prevents buzzer flooding)
  const lastVibrationRef = useRef(0);
  const triggerAlarmHaptic = useCallback(() => {
    const now = Date.now();
    if (now - lastVibrationRef.current > 1400) {
      lastVibrationRef.current = now;
      try {
        Vibration.vibrate([0, 300, 120, 300]);
      } catch (e) {
        // Non-fatal if platform vibration unsupported
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Laser scanning animation loop
  useEffect(() => {
    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    laserLoop.start();

    // Pulse animation for HUD border
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      laserLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  const failMobileScan = useCallback(
    (bannerMsg: string, detailMsg: string) => {
      livenessVerifiedRef.current = false;
      setLivenessVerified(false);
      updateScanStatus('failed');
      setStatusMessage(bannerMsg);
      setErrorMessage(detailMsg);
      setLivenessStepText('❌ No Face Recognized');
      Animated.timing(progressAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
      triggerAlarmHaptic();
    },
    [progressAnim, triggerAlarmHaptic, updateScanStatus]
  );

  // Handle successful biometric completion
  const handleSuccess = useCallback(
    (photo: string, confidence = 100, distance = 0.0) => {
      if (hasFinishedRef.current) return;
      hasFinishedRef.current = true;

      updateScanStatus('success');
      setCapturedPhoto(photo);
      setMatchDetails({ confidence, distance });

      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      if (mode === 'enroll') {
        setStatusMessage('✓ Face Biometrics Enrolled Successfully!');
      } else {
        setStatusMessage(`✓ Verified! ${confidence}% Match (${distance.toFixed(2)})`);
      }

      setTimeout(() => {
        if (isMountedRef.current) {
          onCapture(photo);
        }
      }, 750);
    },
    [mode, onCapture, progressAnim, updateScanStatus]
  );

  // Automated continuous biometric inspection loop
  useEffect(() => {
    if (
      !cameraReady ||
      hasFinishedRef.current ||
      scanStatus === 'success' ||
      scanStatus === 'failed'
    ) {
      return;
    }

    let scanTimer: any = null;
    let consecutiveStable = 0;

    const runAutoScan = async () => {
      if (
        !cameraRef.current ||
        isScanningRef.current ||
        hasFinishedRef.current ||
        scanStatusRef.current === 'failed' ||
        scanStatusRef.current === 'success' ||
        !isMountedRef.current
      ) {
        return;
      }

      isScanningRef.current = true;

      try {
        if (typeof cameraRef.current.takePictureAsync !== 'function') {
          return;
        }

        // Fast silent snapshot for real-time 3D liveness & landmark analysis
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.28,
          base64: true,
          shutterSound: false,
          skipProcessing: true,
        } as any);

        if (!photo || !photo.base64 || !isMountedRef.current || hasFinishedRef.current) {
          return;
        }

        const dataUrl = `data:image/jpeg;base64,${photo.base64}`;

        // 1. Quality, 68-Landmark 3D Geometry & Anti-Spoof Inspection
        const quality: BiometricQualityResult = await biometricService.inspectQuality(dataUrl);

        if (!isMountedRef.current || hasFinishedRef.current) return;

        if (quality.screenSpoofSuspected) {
          spoofStreakRef.current += 1;
          if (spoofStreakRef.current >= 3) {
            consecutiveStable = 0;
            setStableCount(0);
            resetMobileLiveness('🚨 Spoof Blocked: Show Live Face');
            failMobileScan(
              '🚨 No Live Face Recognized (Photo/Screen Blocked)',
              quality.spoofReason || 'No valid live face has been recognized — A phone screen or static photo was detected.'
            );
          }
          return;
        }
        spoofStreakRef.current = 0;

        if (quality.multipleFaces) {
          consecutiveStable = 0;
          setStableCount(0);
          resetMobileLiveness('⚠️ Only one live face allowed');
          updateScanStatus('aligning');
          setStatusMessage('⚠️ Multiple faces detected. Ensure only you are in view.');
          return;
        }

        // Severe pitch dark check only
        if (quality.tooDark) {
          consecutiveStable = 0;
          setStableCount(0);
          if (noFaceSinceRef.current === 0) noFaceSinceRef.current = Date.now();
          if (Date.now() - noFaceSinceRef.current >= 6500) {
            failMobileScan(
              '❌ Error: No face has been recognized',
              'Camera frame is too dark to recognize a face. Please move to a well-lit area and tap Retry.'
            );
            return;
          }
          updateScanStatus('aligning');
          setStatusMessage('💡 Area is dark. Move to better lighting');
          Animated.timing(progressAnim, { toValue: 0.15, duration: 150, useNativeDriver: false }).start();
          return;
        }

        if (quality.poorBackgroundLighting) {
          setStatusMessage('💡 Tip: Facing a light background works best');
        }

        if (quality.tooBright) {
          consecutiveStable = 0;
          setStableCount(0);
          updateScanStatus('aligning');
          setStatusMessage('⚠️ Too bright! Avoid direct glare');
          Animated.timing(progressAnim, { toValue: 0.2, duration: 150, useNativeDriver: false }).start();
          return;
        }

        // Soft advisory cues
        if (quality.glassesDetected) {
          setStatusMessage('⚠️ Warning: Glasses detected. Please remove glasses');
        } else if (quality.capDetected) {
          setStatusMessage('⚠️ Warning: Hat/cap detected. Please remove headwear');
        } else if (quality.maskDetected) {
          setStatusMessage('⚠️ Warning: Face mask detected. Please remove mask');
        }

        if (!quality.hasFace) {
          consecutiveStable = 0;
          setStableCount(0);
          const nowMiss = Date.now();

          // Allow AI neural bridge up to 9s to finish initial loading before counting missed frames;
          // if bridge still fails to initialize after 9s, surface an explicit scan error.
          if (!biometricService.isReady()) {
            if (nowMiss - scanStartedAtRef.current >= 9000) {
              failMobileScan(
                '❌ Error: Unable to scan face',
                'Facial recognition engine could not initialize. Please check your internet connection and tap Retry.'
              );
              return;
            }
            noFaceSinceRef.current = nowMiss;
            updateScanStatus('initializing');
            setStatusMessage('Initializing AI facial recognition...');
            return;
          }

          if (noFaceSinceRef.current === 0) {
            noFaceSinceRef.current = nowMiss;
          }
          livenessStatsRef.current.missedFrames++;
          // Generous dropout tolerance (7 missed frames / ~2.3s) so blinking or smiling squints never reset progress
          if (livenessStatsRef.current.missedFrames >= 7 && nowMiss - noFaceSinceRef.current >= 2300) {
            resetMobileLiveness('⚠️ No face detected — Align face');
          }

          const noFaceElapsed = nowMiss - noFaceSinceRef.current;
          if (noFaceElapsed >= 6500 || livenessStatsRef.current.missedFrames >= 22) {
            failMobileScan(
              '❌ Error: No face has been recognized',
              'No face has been recognized in the camera frame. Please position your face clearly inside the oval in good lighting and tap Retry.'
            );
            return;
          }

          if (noFaceElapsed >= 2400) {
            updateScanStatus('aligning');
            setStatusMessage('⚠️ No face detected — Position face inside oval');
            Animated.timing(progressAnim, { toValue: 0.15, duration: 150, useNativeDriver: false }).start();
          }
          return;
        }

        noFaceSinceRef.current = 0;
        livenessStatsRef.current.missedFrames = 0;

        // 2. Mandatory 3D Live-Face Challenge (Look -> Move Head Left/Right -> Latched Blink & Smile)
        const now = Date.now();
        const stats = livenessStatsRef.current;
        const yaw = quality.yawRatio ?? 0.5;
        const asym = quality.eyeWidthAsymmetry ?? 1.0;
        const ear = quality.ear ?? 0.28;
        const pitch = quality.pitchRatio ?? 0.52;
        const mouthToJaw = quality.mouthToJaw ?? 0.42;
        const mouthLift = quality.mouthCornerLift ?? 0.0;
        const mar = quality.mar ?? 0.04;
        const fw = quality.faceWidth ?? 0.35;
        const cx = quality.faceCx ?? 0.5;
        const cy = quality.faceCy ?? 0.5;

        // Cache clean frontal open-eye frame from this live session so mid-blink snapshots never fail enrollment/verify
        if (yaw >= 0.37 && yaw <= 0.63 && ear >= 0.19) {
          bestLiveFrameRef.current = dataUrl;
        }

        // Continuity check: only reset on extreme photo-swap teleports, never on natural head turns/smiles
        if (stats.prevCx >= 0 && stats.prevWidth > 0) {
          const jump = Math.hypot(cx - stats.prevCx, cy - stats.prevCy);
          const scaleRatio = fw / Math.max(0.05, stats.prevWidth);
          if (jump > 0.65 || scaleRatio > 2.15 || scaleRatio < 0.42) {
            resetMobileLiveness('🛡️ Hold steady — Restarting live check');
          }
        }
        stats.prevCx = cx;
        stats.prevCy = cy;
        stats.prevWidth = fw;

        if (!livenessVerifiedRef.current) {
          updateScanStatus('analyzing');

          // Detect stalled / unrecognizable live scan as an explicit error (generous 15s per step)
          const phaseElapsed = now - phaseStartedAtRef.current;
          const totalElapsed = now - scanStartedAtRef.current;
          if (phaseElapsed >= 15000 || totalElapsed >= 35000) {
            const curStep = blinkStateRef.current;
            const detail =
              curStep === 'calibrating'
                ? 'No clear face has been recognized. Please look straight at the camera without obstructions and tap Retry.'
                : curStep === 'turn_head'
                  ? 'Face could not be recognized — Could not detect live 3D head movement (left or right). Static photos cannot be scanned.'
                  : !stats.blinkDone
                    ? 'Face could not be recognized — Could not detect live eye blink. Ensure clear lighting on your face and tap Retry.'
                    : 'Face could not be recognized — Could not complete live smile check. Please center your face clearly and tap Retry.';
            failMobileScan('❌ Error: No valid live face recognized', detail);
            return;
          }

          if (blinkStateRef.current === 'calibrating') {
            if (quality.faceCentered === false) {
              setStatusMessage('Step 1/3: Center face inside the oval guide');
              return;
            }
            if (yaw >= 0.33 && yaw <= 0.67 && ear >= 0.155) {
              stats.calibFrames++;
              stats.sumYaw += yaw;
              stats.sumAsym += asym;
              stats.sumEAR += ear;
              stats.sumPitch += pitch;
              stats.sumMouthToJaw += mouthToJaw;
              stats.sumMouthLift += mouthLift;
              stats.sumMAR += mar;
              stats.baselineWidth = fw;

              setLivenessStepText('🛡️ Step 1/3: Locking Face...');
              setStatusMessage('Step 1/3: Look straight ahead...');
              Animated.timing(progressAnim, { toValue: 0.30, duration: 150, useNativeDriver: false }).start();

              if (stats.calibFrames >= 2) {
                const n = stats.calibFrames;
                stats.baselineYaw = stats.sumYaw / n;
                stats.baselineAsym = stats.sumAsym / n;
                stats.baselineEAR = stats.sumEAR / n;
                stats.peakOpenEAR = Math.max(stats.baselineEAR, ear);
                stats.minClosedEAR = stats.baselineEAR;
                stats.prevEAR = ear;
                stats.baselinePitch = stats.sumPitch / n;
                stats.baselineMouthToJaw = stats.sumMouthToJaw / n;
                stats.minMouthToJaw = stats.baselineMouthToJaw;
                stats.baselineMouthLift = stats.sumMouthLift / n;
                stats.minMouthLift = stats.baselineMouthLift;
                stats.baselineMAR = stats.sumMAR / n;
                stats.minMAR = stats.baselineMAR;
                phaseStartedAtRef.current = now;
                blinkStateRef.current = 'turn_head';
                setLivenessStepText('🛡️ Step 2/3: Move Head Left or Right');
                setStatusMessage('Step 2/3: Move your head slightly left or right');
                Animated.timing(progressAnim, { toValue: 0.50, duration: 150, useNativeDriver: false }).start();
              }
            } else {
              setStatusMessage('Step 1/3: Look straight at the camera');
            }
            return;
          }

          if (blinkStateRef.current === 'turn_head') {
            if (yaw >= 0.36 && yaw <= 0.64) {
              if (ear > stats.peakOpenEAR && ear < 0.42) {
                stats.peakOpenEAR = stats.peakOpenEAR * 0.6 + ear * 0.4;
              }
              stats.minMouthToJaw = Math.min(stats.minMouthToJaw, mouthToJaw);
              stats.minMouthLift = Math.min(stats.minMouthLift, mouthLift);
              stats.minMAR = Math.min(stats.minMAR, mar);
            }
            stats.prevEAR = ear;

            const yawDelta = Math.abs(yaw - stats.baselineYaw);
            const asymDelta = Math.abs(asym - stats.baselineAsym);
            const scaleOk = fw > stats.baselineWidth * 0.52 && fw < stats.baselineWidth * 1.70;
            if ((yawDelta >= 0.072 || (yawDelta >= 0.052 && asymDelta >= 0.14)) && scaleOk) {
              phaseStartedAtRef.current = now;
              blinkStateRef.current = 'blink_and_smile';
              setLivenessStepText('🛡️ Step 3/3: Blink & Smile');
              setStatusMessage('Step 3/3: Face forward, then blink and smile!');
              Animated.timing(progressAnim, { toValue: 0.68, duration: 150, useNativeDriver: false }).start();
            } else {
              setStatusMessage('Step 2/3: Move your head slightly left or right');
            }
            return;
          }

          if (blinkStateRef.current === 'blink_and_smile') {
            const backToCenter =
              (yaw >= 0.30 && yaw <= 0.70) || Math.abs(yaw - stats.baselineYaw) <= 0.19;
            const pitchSteady =
              Math.abs(pitch - stats.baselinePitch) / Math.max(0.15, stats.baselinePitch) <= 0.30;

            if (!backToCenter) {
              stats.prevEAR = ear;
              setStatusMessage('Step 3/3: Face forward to blink and smile');
              return;
            }

            if (!stats.smileDone && mouthToJaw < stats.minMouthToJaw) stats.minMouthToJaw = mouthToJaw;
            if (!stats.smileDone && mouthLift < stats.minMouthLift) stats.minMouthLift = mouthLift;
            if (!stats.smileDone && mar < stats.minMAR) stats.minMAR = mar;
            if (ear > stats.peakOpenEAR && ear < 0.42) {
              stats.peakOpenEAR = stats.peakOpenEAR * 0.7 + ear * 0.3;
            }

            // A. Latched Multi-Signal Blink Detector (dip OR rapid inter-frame velocity)
            if (!stats.blinkDone && pitchSteady) {
              const refEAR = Math.max(stats.baselineEAR, stats.peakOpenEAR);
              const blinkThresh = Math.min(refEAR * 0.89, refEAR - 0.022);
              const prevDrop = stats.prevEAR > 0 ? stats.prevEAR - ear : 0;
              const prevRise = stats.prevEAR > 0 ? ear - stats.prevEAR : 0;

              if (ear <= blinkThresh || prevDrop >= 0.026) {
                stats.sawBlinkDrop = true;
                stats.minClosedEAR = Math.min(stats.minClosedEAR, ear);
                blinkFrameRef.current = dataUrl;
              } else if (
                stats.sawBlinkDrop &&
                (ear >= stats.minClosedEAR + 0.018 || ear >= refEAR * 0.85)
              ) {
                stats.blinkDone = true;
                phaseStartedAtRef.current = now;
              } else if (prevRise >= 0.028 && stats.prevEAR > 0 && stats.prevEAR < refEAR * 0.92) {
                stats.blinkDone = true;
                phaseStartedAtRef.current = now;
              }
            }
            stats.prevEAR = ear;

            // B. Latched Duchenne-Safe Smile Detector (never blocked by squinting eyes!)
            if (!stats.smileDone) {
              const refMouthW = Math.min(stats.baselineMouthToJaw, stats.minMouthToJaw);
              const refLift = Math.min(stats.baselineMouthLift, stats.minMouthLift);
              const refMAR = Math.min(stats.baselineMAR, stats.minMAR);

              const isSmiling =
                mouthToJaw >= refMouthW * 1.052 ||
                mar >= refMAR + 0.050 ||
                mouthLift >= refLift + 0.018 ||
                (mouthToJaw >= 0.465 && mouthToJaw >= refMouthW * 1.025);

              if (isSmiling) {
                stats.smileDone = true;
                phaseStartedAtRef.current = now;
              }
            }

            if (stats.blinkDone && stats.smileDone) {
              phaseStartedAtRef.current = now;
              blinkStateRef.current = 'verified';
              livenessVerifiedRef.current = true;
              setLivenessVerified(true);
              setLivenessStepText('✓ Live 3D Face Verified');
              Animated.timing(progressAnim, { toValue: 0.94, duration: 150, useNativeDriver: false }).start();
            } else if (stats.blinkDone) {
              setLivenessStepText('✓ Blink • ○ Smile');
              setStatusMessage('✓ Blink detected! Now smile at the camera');
              Animated.timing(progressAnim, { toValue: 0.84, duration: 120, useNativeDriver: false }).start();
              return;
            } else if (stats.smileDone) {
              setLivenessStepText('○ Blink • ✓ Smile');
              setStatusMessage('✓ Smile detected! Now blink your eyes');
              Animated.timing(progressAnim, { toValue: 0.84, duration: 120, useNativeDriver: false }).start();
              return;
            } else {
              setLivenessStepText(stats.sawBlinkDrop ? '🛡️ Opening eyes... & Smile' : '🛡️ Step 3/3: Blink & Smile');
              setStatusMessage('Step 3/3: Blink your eyes and smile naturally');
              return;
            }
          }
        }

        if (quality.faceCentered === false) {
          setStatusMessage('Center your live face inside the oval');
          return;
        }

        // 3. Mode-Specific Evaluation (Reached ONLY after 3D live-face verification passes!)
        if (mode === 'enroll') {
          consecutiveStable++;
          setStableCount(consecutiveStable);
          updateScanStatus('analyzing');

          const candidateLiveUrl = bestLiveFrameRef.current || dataUrl;

          try {
            const finalPhoto = await cameraRef.current.takePictureAsync({
              quality: 0.85,
              base64: true,
              shutterSound: false,
            } as any);
            let finalDataUrl = finalPhoto?.base64 ? `data:image/jpeg;base64,${finalPhoto.base64}` : candidateLiveUrl;
            let finalCheck = await biometricService.inspectQuality(finalDataUrl);
            if (!finalCheck.hasFace && candidateLiveUrl !== finalDataUrl) {
              const backupCheck = await biometricService.inspectQuality(candidateLiveUrl);
              if (backupCheck.hasFace && !backupCheck.screenSpoofSuspected) {
                finalDataUrl = candidateLiveUrl;
                finalCheck = backupCheck;
              }
            }
            if (!finalCheck.hasFace || finalCheck.screenSpoofSuspected) {
              failMobileScan(
                '❌ Error: No face has been recognized',
                'No clear live face was recognized during enrollment capture. Please center your face in good lighting and tap Retry.'
              );
              return;
            }
            handleSuccess(finalDataUrl);
          } catch {
            handleSuccess(candidateLiveUrl);
          }
        } else if (mode === 'clock_in' || mode === 'clock_out' || mode === 'verify_test') {
          if (!enrolledPhoto) {
            consecutiveStable = 0;
            setStableCount(0);
            failMobileScan(
              '❌ Face not registered. Please register face first.',
              'No registered biometric facial profile found on your account. Please complete face registration before recording attendance.'
            );
            return;
          }

          updateScanStatus('verifying');
          setStatusMessage('Live face verified! Matching identity...');
          Animated.timing(progressAnim, { toValue: 0.95, duration: 150, useNativeDriver: false }).start();

          const primaryLive = bestLiveFrameRef.current || dataUrl;

          // Step A: On-Device Neural 128-D Biometric Verification (strict 0.56 threshold)
          let localBio = await biometricService.verifyBiometrics(enrolledPhoto, dataUrl, 0.56).catch(() => null);
          if ((!localBio || !localBio.matched) && primaryLive !== dataUrl) {
            const backupBio = await biometricService.verifyBiometrics(enrolledPhoto, primaryLive, 0.56).catch(() => null);
            if (backupBio && backupBio.matched) {
              localBio = backupBio;
            }
          }
          if (localBio && localBio.matched) {
            try {
              const finalPhoto = await cameraRef.current.takePictureAsync({
                quality: 0.85,
                base64: true,
                shutterSound: false,
              } as any);
              const finalDataUrl = finalPhoto?.base64 ? `data:image/jpeg;base64,${finalPhoto.base64}` : primaryLive;
              handleSuccess(finalDataUrl, localBio.confidence, localBio.distance);
            } catch {
              handleSuccess(primaryLive, localBio.confidence, localBio.distance);
            }
            return;
          }

          // Step B: Server DeepFace AI Verification (fallback)
          const dfRes: DeepFaceVerifyResult = await deepfaceService.verifyFace(
            enrolledPhoto,
            primaryLive,
            { modelName: deepFaceModel, blinkImage: blinkFrameRef.current || undefined, timeoutMs: 2500 }
          );

          if (!isMountedRef.current || hasFinishedRef.current) return;
          setDeepFaceResult(dfRes);

          if (dfRes.matched) {
            try {
              const finalPhoto = await cameraRef.current.takePictureAsync({
                quality: 0.85,
                base64: true,
                shutterSound: false,
              } as any);
              const finalDataUrl = finalPhoto?.base64 ? `data:image/jpeg;base64,${finalPhoto.base64}` : dataUrl;
              handleSuccess(finalDataUrl, dfRes.similarity_percent, dfRes.distance);
            } catch {
              handleSuccess(dataUrl, dfRes.similarity_percent, dfRes.distance);
            }
          } else {
            resetMobileLiveness('🛡️ Not Recognized — Tap Retry');
            const errText = localBio?.error || dfRes.error || '';
            const isNoFace = errText.toLowerCase().includes('no clear live human face') || errText.toLowerCase().includes('no face');
            failMobileScan(
              isNoFace ? '❌ Error: No face has been recognized' : '❌ Face not recognized against enrolled profile',
              isNoFace
                ? 'No face has been recognized in the camera frame. Please position your face clearly in good lighting and tap Retry.'
                : errText || `Face does not match enrolled template for ${employeeName || 'this trainee'}.`
            );
          }
        }
      } catch (err: any) {
        console.debug('Auto-scan step notice:', err?.message || err);
      } finally {
        isScanningRef.current = false;
      }
    };

    // Run auto-scan cycle every 220ms for high-responsiveness blink & smile capture
    scanTimer = setInterval(runAutoScan, 220);

    return () => {
      if (scanTimer) clearInterval(scanTimer);
    };
  }, [cameraReady, scanStatus, mode, enrolledPhoto, handleSuccess, progressAnim, resetMobileLiveness, failMobileScan, updateScanStatus, deepFaceModel, employeeName]);

  // Manual shutter trigger fallback (Strictly gated by 3D live-face verification!)
  async function handleManualCapture() {
    if (!cameraRef.current || isCapturing || hasFinishedRef.current) return;

    if (!livenessVerifiedRef.current) {
      if (livenessStatsRef.current.missedFrames >= 2 || noFaceSinceRef.current > 0) {
        failMobileScan(
          '❌ Error: No face has been recognized',
          'No face has been recognized in the camera frame. Please position your face clearly inside the oval in good lighting and tap Retry.'
        );
        return;
      }
      triggerAlarmHaptic();
      setStatusMessage('🛡️ Complete Steps: Look → Move Head → Blink → Smile');
      setErrorMessage(
        'Please complete all live facial recognition steps (look straight, move head left or right, blink, and smile) before capturing.'
      );
      return;
    }

    setIsCapturing(true);
    setErrorMessage(null);
    updateScanStatus('verifying');
    setStatusMessage('Capturing & analyzing live biometrics...');

    try {
      if (typeof cameraRef.current.takePictureAsync !== 'function') {
        throw new Error('Camera is warming up. Please hold steady.');
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        base64: true,
        shutterSound: false,
      } as any);

      if (!photo || !photo.base64) {
        throw new Error('No image captured. Please try again.');
      }

      const base64Data = `data:image/jpeg;base64,${photo.base64}`;
      const quality = await biometricService.inspectQuality(base64Data);

      if (quality.screenSpoofSuspected) {
        resetMobileLiveness('🚨 Spoof Blocked: Show Live Face');
        failMobileScan(
          '🚨 Photo / Screen Blocked',
          quality.spoofReason || 'No valid live face recognized — Device screen or static photo detected.'
        );
        setIsCapturing(false);
        return;
      }

      if ((quality.tooDark && quality.brightness < 20) || (quality.tooBright && quality.brightness > 248)) {
        const reason = quality.tooDark
          ? 'Lighting too dark to recognize face! Please move to a well-lit area and tap Retry.'
          : 'Harsh glare prevented face recognition! Please adjust camera away from direct light and tap Retry.';
        failMobileScan(quality.tooDark ? '❌ Too Dark — No Face Recognized' : '❌ Harsh Glare — No Face Recognized', reason);
        setIsCapturing(false);
        return;
      }

      if (!quality.hasFace) {
        failMobileScan(
          '❌ Error: No face has been recognized',
          'No face has been recognized in the captured frame. Please position your face clearly inside the oval and tap Retry.'
        );
        setIsCapturing(false);
        return;
      }

      if (mode === 'enroll') {
        handleSuccess(base64Data);
        return;
      }

      if (mode === 'clock_in' || mode === 'clock_out' || mode === 'verify_test') {
        if (!enrolledPhoto) {
          failMobileScan(
            '❌ Face not registered',
            'No registered biometric face profile found. You must complete face registration before clocking in.'
          );
          setIsCapturing(false);
          return;
        }

        setStatusMessage('Verifying live facial template...');
        const localBio = await biometricService.verifyBiometrics(enrolledPhoto, base64Data, 0.56).catch(() => null);
        if (localBio && localBio.matched) {
          handleSuccess(base64Data, localBio.confidence, localBio.distance);
          return;
        }

        const dfRes = await deepfaceService.verifyFace(enrolledPhoto, base64Data, {
          modelName: deepFaceModel,
          blinkImage: blinkFrameRef.current || undefined,
        });
        setDeepFaceResult(dfRes);
        if (dfRes.matched) {
          handleSuccess(base64Data, dfRes.similarity_percent, dfRes.distance);
          return;
        } else {
          resetMobileLiveness('🛡️ Not Recognized — Tap Retry');
          failMobileScan(
            '❌ Face not recognized',
            localBio?.error ||
              `Face not recognized: Does not match enrolled template for ${employeeName || 'this student'}.`
          );
          setIsCapturing(false);
          return;
        }
      }

      handleSuccess(base64Data);
    } catch (err: any) {
      failMobileScan('❌ Error: Facial scan failed', err?.message || 'Unable to recognize face. Please tap Retry.');
      setIsCapturing(false);
    }
  }

  function toggleFacing() {
    scanStartedAtRef.current = Date.now();
    noFaceSinceRef.current = Date.now();
    phaseStartedAtRef.current = Date.now();
    spoofStreakRef.current = 0;
    bestLiveFrameRef.current = null;
    resetMobileLiveness();
    updateScanStatus('aligning');
    setErrorMessage(null);
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }

  function handleResetScan() {
    hasFinishedRef.current = false;
    const nowReset = Date.now();
    scanStartedAtRef.current = nowReset;
    noFaceSinceRef.current = nowReset;
    phaseStartedAtRef.current = nowReset;
    spoofStreakRef.current = 0;
    bestLiveFrameRef.current = null;
    resetMobileLiveness();
    updateScanStatus('aligning');
    setStatusMessage('Step 1/3: Position your live face inside the oval');
    setErrorMessage(null);
    setCapturedPhoto(null);
    setStableCount(0);
    Animated.timing(progressAnim, { toValue: 0.2, duration: 200, useNativeDriver: false }).start();
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Scan size={56} color="#38bdf8" />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionMsg}>
          Camera permission is required for AI biometric facial recognition and attendance verification.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, FRAME_HEIGHT - 18],
  });

  const getBorderColor = () => {
    switch (scanStatus) {
      case 'success':
        return '#22c55e';
      case 'failed':
        return '#ef4444';
      case 'analyzing':
      case 'verifying':
        return '#facc15';
      default:
        return '#38bdf8';
    }
  };

  const getStatusIcon = () => {
    switch (scanStatus) {
      case 'success':
        return <CheckCircle2 size={16} color="#22c55e" />;
      case 'failed':
        return <AlertTriangle size={16} color="#ef4444" />;
      case 'verifying':
        return <ActivityIndicator size="small" color="#facc15" />;
      case 'analyzing':
        return <Sparkles size={16} color="#facc15" />;
      default:
        return <Scan size={16} color="#38bdf8" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Full-Screen Native Camera */}
      <CameraView
        ref={(r) => {
          cameraRef.current = r;
        }}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => {
          const nowReady = Date.now();
          scanStartedAtRef.current = nowReady;
          noFaceSinceRef.current = nowReady;
          phaseStartedAtRef.current = nowReady;
          setCameraReady(true);
          updateScanStatus('aligning');
          setStatusMessage('Step 1/3: Position face inside the oval');
        }}
      />

      {/* High-Tech Biometric HUD Overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleBtn} onPress={onCancel}>
            <X color="#ffffff" size={20} />
          </TouchableOpacity>

          <View style={styles.headerTitlePill}>
            <ShieldCheck size={14} color="#38bdf8" />
            <Text style={styles.headerTitleText}>
              {mode === 'enroll' ? 'Face Biometrics Enrollment' : 'Biometric Attendance Verification'}
            </Text>
          </View>

          <TouchableOpacity style={styles.circleBtn} onPress={toggleFacing}>
            <FlipHorizontal color="#ffffff" size={20} />
          </TouchableOpacity>
        </View>

        {/* Active Obstruction Alarm Banner (Only visible during an alarm or failure) */}
        {scanStatus === 'failed' && (
          <View style={styles.alarmBanner}>
            <AlertTriangle size={18} color="#ffffff" />
            <Text style={styles.alarmBannerText} numberOfLines={2}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Center Biometric Vertical Oval Frame */}
        <View style={styles.frameContainer} pointerEvents="box-none">
          {/* Dynamic AI Status Pill */}
          <View
            style={[
              styles.floatingStatusBadge,
              scanStatus === 'success' && styles.badgeSuccess,
              scanStatus === 'failed' && styles.badgeFailed,
            ]}
          >
            {getStatusIcon()}
            <Text
              style={[
                styles.floatingStatusText,
                scanStatus === 'success' && { color: '#4ade80' },
                scanStatus === 'failed' && { color: '#fca5a5' },
              ]}
              numberOfLines={1}
            >
              {statusMessage}
            </Text>
          </View>

          {/* Anti-Spoof Liveness Indicator Badge */}
          <View
            style={[
              styles.livenessBadge,
              livenessVerified ? styles.livenessBadgeVerified : styles.livenessBadgePending,
            ]}
          >
            <Eye size={12} color={livenessVerified ? '#4ade80' : '#facc15'} />
            <Text
              style={[
                styles.livenessBadgeText,
                { color: livenessVerified ? '#4ade80' : '#fef08a' },
              ]}
            >
              {livenessStepText}
            </Text>
          </View>

          {/* Biometric Oval Frame with Glow Effect */}
          <Animated.View
            style={[
              styles.guideOval,
              {
                borderColor: getBorderColor(),
                transform: [{ scale: pulseAnim }],
                backgroundColor: scanStatus === 'success' ? 'rgba(34, 197, 94, 0.20)' : 'transparent',
              },
            ]}
          >
            {/* Holographic Laser Sweep Line */}
            {scanStatus !== 'success' && (
              <Animated.View
                style={[
                  styles.laserLine,
                  {
                    transform: [{ translateY }],
                    backgroundColor: getBorderColor(),
                    shadowColor: getBorderColor(),
                  },
                ]}
              />
            )}

            {/* Success Center Checkmark Glow */}
            {scanStatus === 'success' && (
              <View style={styles.successCenterIcon}>
                <CheckCircle2 size={54} color="#22c55e" />
                <Text style={styles.successGlowText}>
                  {mode === 'enroll' ? 'ENROLLED' : `${matchDetails?.confidence || 95}% MATCH`}
                </Text>
              </View>
            )}

            {/* Corner Alignment Brackets */}
            <View style={[styles.corner, styles.cornerTL, { borderColor: getBorderColor() }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: getBorderColor() }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: getBorderColor() }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: getBorderColor() }]} />

            {/* Center Crosshair Guide Notches */}
            <View style={[styles.notch, styles.notchTop, { backgroundColor: getBorderColor() }]} />
            <View style={[styles.notch, styles.notchBottom, { backgroundColor: getBorderColor() }]} />
            <View style={[styles.notch, styles.notchLeft, { backgroundColor: getBorderColor() }]} />
            <View style={[styles.notch, styles.notchRight, { backgroundColor: getBorderColor() }]} />
          </Animated.View>

          {/* Continuous Progress Bar under Oval */}
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor:
                    scanStatus === 'success'
                      ? '#22c55e'
                      : scanStatus === 'failed'
                        ? '#ef4444'
                        : '#38bdf8',
                },
              ]}
            />
          </View>
        </View>

        {/* Bottom HUD Controls & Manual Shutter */}
        <View style={styles.bottomSection} pointerEvents="box-none">
          {errorMessage && (
            <View style={styles.errorCard}>
              <AlertTriangle size={18} color="#ef4444" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorCardTitle}>
                  {scanStatus === 'failed' ? 'Facial Recognition Error' : 'Verification Notice'}
                </Text>
                <Text style={styles.errorCardText}>{errorMessage}</Text>
              </View>
              <TouchableOpacity onPress={handleResetScan} style={styles.retryBtnSmall}>
                <RefreshCw size={14} color="#ffffff" />
                <Text style={styles.retryBtnSmallText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.shutterRow}>
            <TouchableOpacity
              style={[
                styles.captureShutterBtn,
                (isCapturing || scanStatus === 'success' || !livenessVerified) && { opacity: 0.45 },
                { borderColor: getBorderColor() },
              ]}
              onPress={handleManualCapture}
              disabled={isCapturing || scanStatus === 'success'}
            >
              <View style={styles.captureShutterInner}>
                {isCapturing ? (
                  <ActivityIndicator color="#0284c7" size="small" />
                ) : scanStatus === 'success' ? (
                  <Check size={26} color="#16a34a" />
                ) : (
                  <Camera size={26} color={livenessVerified ? '#16a34a' : '#64748b'} />
                )}
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.hudInstructionText}>
            {scanStatus === 'success'
              ? '✓ Live face authenticated. Finalizing...'
              : livenessVerified
                ? '✓ Live 3D face verified • Auto-matching or tap button'
                : 'Live 3D anti-spoofing active • Photos from other devices are blocked'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    paddingVertical: Platform.OS === 'ios' ? 56 : 36,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  headerTitleText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  frameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  floatingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.60)',
    marginBottom: 16,
    maxWidth: SCREEN_WIDTH * 0.88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  badgeSuccess: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(6, 78, 59, 0.92)',
  },
  badgeFailed: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(69, 10, 10, 0.92)',
  },
  floatingStatusText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  livenessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
  },
  livenessBadgeVerified: {
    backgroundColor: 'rgba(6, 78, 59, 0.85)',
    borderColor: '#22c55e',
  },
  livenessBadgePending: {
    backgroundColor: 'rgba(113, 63, 18, 0.85)',
    borderColor: '#facc15',
  },
  livenessBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  guideOval: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    borderRadius: FRAME_WIDTH / 2,
    borderWidth: 3.5,
    borderColor: '#38bdf8',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 8,
  },
  successCenterIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.80)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  successGlowText: {
    color: '#4ade80',
    fontWeight: '900',
    fontSize: 13,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
  },
  cornerTL: { top: 20, left: 20, borderTopWidth: 3.5, borderLeftWidth: 3.5 },
  cornerTR: { top: 20, right: 20, borderTopWidth: 3.5, borderRightWidth: 3.5 },
  cornerBL: { bottom: 20, left: 20, borderBottomWidth: 3.5, borderLeftWidth: 3.5 },
  cornerBR: { bottom: 20, right: 20, borderBottomWidth: 3.5, borderRightWidth: 3.5 },
  notch: {
    position: 'absolute',
  },
  notchTop: { top: 0, width: 28, height: 4, borderRadius: 2 },
  notchBottom: { bottom: 0, width: 28, height: 4, borderRadius: 2 },
  notchLeft: { left: 0, width: 4, height: 28, borderRadius: 2 },
  notchRight: { right: 0, width: 4, height: 28, borderRadius: 2 },
  progressBarTrack: {
    width: FRAME_WIDTH * 0.85,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    marginTop: 18,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  bottomSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.90)',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    width: '100%',
  },
  errorCardTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  errorCardText: {
    color: '#fee2e2',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  retryBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnSmallText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  shutterRow: {
    marginBottom: 8,
  },
  captureShutterBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 4,
  },
  captureShutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudInstructionText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  permissionTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionMsg: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  permissionBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 14,
  },
  alarmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  alarmBannerText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
