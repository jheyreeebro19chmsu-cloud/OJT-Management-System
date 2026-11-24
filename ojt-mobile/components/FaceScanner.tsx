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
  const [livenessStepText, setLivenessStepText] = useState('🛡️ Live Check: Look straight ahead');
  const blinkStateRef = useRef<'calibrating' | 'turn_head' | 'blink_or_smile' | 'verified'>('calibrating');
  const blinkFrameRef = useRef<string | null>(null);
  const livenessStatsRef = useRef({
    calibFrames: 0,
    sumYaw: 0,
    sumEAR: 0,
    sumPitch: 0,
    sumMouthToJaw: 0,
    sumMAR: 0,
    baselineYaw: 0.5,
    baselineEAR: 0.28,
    baselinePitch: 0.52,
    baselineMouthToJaw: 0.42,
    baselineMAR: 0.04,
    baselineWidth: 0.35,
    sawBlinkDrop: false,
    prevCx: -1,
    prevCy: -1,
    prevWidth: 0,
    missedFrames: 0,
  });

  const resetMobileLiveness = useCallback((badgeMsg = '🛡️ Live Check: Look straight ahead') => {
    livenessVerifiedRef.current = false;
    setLivenessVerified(false);
    blinkStateRef.current = 'calibrating';
    blinkFrameRef.current = null;
    setLivenessStepText(badgeMsg);
    livenessStatsRef.current = {
      calibFrames: 0,
      sumYaw: 0,
      sumEAR: 0,
      sumPitch: 0,
      sumMouthToJaw: 0,
      sumMAR: 0,
      baselineYaw: 0.5,
      baselineEAR: 0.28,
      baselinePitch: 0.52,
      baselineMouthToJaw: 0.42,
      baselineMAR: 0.04,
      baselineWidth: 0.35,
      sawBlinkDrop: false,
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

  // Handle successful biometric completion
  const handleSuccess = useCallback(
    (photo: string, confidence = 100, distance = 0.0) => {
      if (hasFinishedRef.current) return;
      hasFinishedRef.current = true;

      setScanStatus('success');
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
    [mode, onCapture, progressAnim]
  );

  // Automated continuous biometric inspection loop
  useEffect(() => {
    if (!cameraReady || hasFinishedRef.current || scanStatus === 'success') return;

    let scanTimer: any = null;
    let consecutiveStable = 0;

    const runAutoScan = async () => {
      if (
        !cameraRef.current ||
        isScanningRef.current ||
        hasFinishedRef.current ||
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
          quality: 0.35,
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
          consecutiveStable = 0;
          setStableCount(0);
          resetMobileLiveness('🚨 Spoof Blocked: Show Live Face');
          setScanStatus('failed');
          setStatusMessage(quality.spoofReason || '🚨 Phone screen / photo detected! Live face required.');
          triggerAlarmHaptic();
          return;
        }

        if (quality.multipleFaces) {
          consecutiveStable = 0;
          setStableCount(0);
          resetMobileLiveness('⚠️ Only one live face allowed');
          setScanStatus('aligning');
          setStatusMessage('⚠️ Multiple faces detected. Ensure only you are in view.');
          return;
        }

        // Severe pitch dark check only
        if (quality.tooDark) {
          consecutiveStable = 0;
          setStableCount(0);
          setScanStatus('aligning');
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
          setScanStatus('aligning');
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
          livenessStatsRef.current.missedFrames++;
          if (livenessStatsRef.current.missedFrames >= 2) {
            resetMobileLiveness('🛡️ Live Check: Center live face');
          }
          setScanStatus('aligning');
          setStatusMessage('Position your live face inside the oval');
          Animated.timing(progressAnim, { toValue: 0.15, duration: 150, useNativeDriver: false }).start();
          return;
        }

        livenessStatsRef.current.missedFrames = 0;

        // 2. Mandatory 3D Live-Face Challenge (Blocks static photos & screen replays)
        const stats = livenessStatsRef.current;
        const yaw = quality.yawRatio ?? 0.5;
        const ear = quality.ear ?? 0.28;
        const pitch = quality.pitchRatio ?? 0.52;
        const mouthToJaw = quality.mouthToJaw ?? 0.42;
        const mar = quality.mar ?? 0.04;
        const fw = quality.faceWidth ?? 0.35;
        const cx = quality.faceCx ?? 0.5;
        const cy = quality.faceCy ?? 0.5;

        // Continuity check: reset if photo was swapped or jumped abruptly
        if (stats.prevCx >= 0 && stats.prevWidth > 0) {
          const jump = Math.hypot(cx - stats.prevCx, cy - stats.prevCy);
          const scaleRatio = fw / Math.max(0.05, stats.prevWidth);
          if (jump > 0.22 || scaleRatio > 1.38 || scaleRatio < 0.68) {
            resetMobileLiveness('🛡️ Hold steady — Restarting live check');
          }
        }
        stats.prevCx = cx;
        stats.prevCy = cy;
        stats.prevWidth = fw;

        if (!livenessVerifiedRef.current) {
          setScanStatus('analyzing');

          if (blinkStateRef.current === 'calibrating') {
            if (quality.faceCentered === false) {
              setStatusMessage('Center face inside the oval guide');
              return;
            }
            if (yaw >= 0.36 && yaw <= 0.64 && ear >= 0.175) {
              stats.calibFrames++;
              stats.sumYaw += yaw;
              stats.sumEAR += ear;
              stats.sumPitch += pitch;
              stats.sumMouthToJaw += mouthToJaw;
              stats.sumMAR += mar;
              stats.baselineWidth = fw;

              setLivenessStepText('🛡️ Calibrating 3D Face Mesh...');
              setStatusMessage('Look straight ahead with eyes open...');
              Animated.timing(progressAnim, { toValue: 0.30, duration: 150, useNativeDriver: false }).start();

              if (stats.calibFrames >= 2) {
                const n = stats.calibFrames;
                stats.baselineYaw = stats.sumYaw / n;
                stats.baselineEAR = stats.sumEAR / n;
                stats.baselinePitch = stats.sumPitch / n;
                stats.baselineMouthToJaw = stats.sumMouthToJaw / n;
                stats.baselineMAR = stats.sumMAR / n;
                blinkStateRef.current = 'turn_head';
                setLivenessStepText('🛡️ Step 1/2: Turn Head Slightly Left or Right');
                setStatusMessage('Turn your head slightly left or right');
                Animated.timing(progressAnim, { toValue: 0.45, duration: 150, useNativeDriver: false }).start();
              }
            } else {
              setStatusMessage('Look straight at the camera with eyes open');
            }
            return;
          }

          if (blinkStateRef.current === 'turn_head') {
            // Flat 2D photos on another phone preserve nose-to-jaw collinear ratio (~0.50) when tilted!
            const yawDelta = Math.abs(yaw - stats.baselineYaw);
            const scaleOk = fw > stats.baselineWidth * 0.62 && fw < stats.baselineWidth * 1.48;
            if (yawDelta >= 0.11 && scaleOk) {
              blinkStateRef.current = 'blink_or_smile';
              setLivenessStepText('🛡️ Step 2/2: Face Forward & Smile or Blink');
              setStatusMessage('Now look straight ahead and smile or blink slowly');
              Animated.timing(progressAnim, { toValue: 0.72, duration: 150, useNativeDriver: false }).start();
            } else {
              setStatusMessage('Step 1/2: Slowly turn your head left or right');
            }
            return;
          }

          if (blinkStateRef.current === 'blink_or_smile') {
            const backToCenter = Math.abs(yaw - stats.baselineYaw) <= 0.115;
            const pitchSteady =
              Math.abs(pitch - stats.baselinePitch) / Math.max(0.15, stats.baselinePitch) <= 0.15;

            if (!backToCenter) {
              setStatusMessage('Return face to center, then smile or blink');
              return;
            }

            if (pitchSteady) {
              const blinkThresh = Math.min(stats.baselineEAR * 0.79, stats.baselineEAR - 0.042);
              if (ear <= blinkThresh) {
                stats.sawBlinkDrop = true;
                blinkFrameRef.current = dataUrl;
                setStatusMessage('Good! Now open eyes & look straight ahead...');
                Animated.timing(progressAnim, { toValue: 0.88, duration: 120, useNativeDriver: false }).start();
                return;
              }

              const blinkCompleted = stats.sawBlinkDrop && ear >= stats.baselineEAR * 0.87;
              const smileCompleted =
                ear >= 0.18 &&
                (mouthToJaw >= stats.baselineMouthToJaw * 1.12 || mar >= stats.baselineMAR + 0.14);

              if (blinkCompleted || smileCompleted) {
                blinkStateRef.current = 'verified';
                livenessVerifiedRef.current = true;
                setLivenessVerified(true);
                setLivenessStepText('✓ Live 3D Face Verified');
                Animated.timing(progressAnim, { toValue: 0.92, duration: 150, useNativeDriver: false }).start();
              } else {
                setStatusMessage('Step 2/2: Blink slowly or smile at the camera');
                return;
              }
            } else {
              setStatusMessage('Keep phone level and blink or smile');
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
          setScanStatus('analyzing');

          try {
            const finalPhoto = await cameraRef.current.takePictureAsync({
              quality: 0.85,
              base64: true,
              shutterSound: false,
            } as any);
            const finalDataUrl = finalPhoto?.base64 ? `data:image/jpeg;base64,${finalPhoto.base64}` : dataUrl;
            handleSuccess(finalDataUrl);
          } catch {
            handleSuccess(dataUrl);
          }
        } else if (mode === 'clock_in' || mode === 'clock_out' || mode === 'verify_test') {
          if (!enrolledPhoto) {
            consecutiveStable = 0;
            setStableCount(0);
            setScanStatus('failed');
            setStatusMessage('❌ Face not registered. Please register face first.');
            setErrorMessage('No registered biometric facial profile found on your account. Please complete face registration before recording attendance.');
            return;
          }

          setScanStatus('verifying');
          setStatusMessage('Live face verified! Matching identity...');
          Animated.timing(progressAnim, { toValue: 0.95, duration: 150, useNativeDriver: false }).start();

          // Step A: On-Device Neural 128-D Biometric Verification (strict 0.56 threshold)
          const localBio = await biometricService.verifyBiometrics(enrolledPhoto, dataUrl, 0.56).catch(() => null);
          if (localBio && localBio.matched) {
            try {
              const finalPhoto = await cameraRef.current.takePictureAsync({
                quality: 0.85,
                base64: true,
                shutterSound: false,
              } as any);
              const finalDataUrl = finalPhoto?.base64 ? `data:image/jpeg;base64,${finalPhoto.base64}` : dataUrl;
              handleSuccess(finalDataUrl, localBio.confidence, localBio.distance);
            } catch {
              handleSuccess(dataUrl, localBio.confidence, localBio.distance);
            }
            return;
          }

          // Step B: Server DeepFace AI Verification (fallback)
          const dfRes: DeepFaceVerifyResult = await deepfaceService.verifyFace(
            enrolledPhoto,
            dataUrl,
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
            resetMobileLiveness('🛡️ Mismatch — Repeat Live Check');
            setScanStatus('failed');
            setStatusMessage('❌ Identity mismatch against enrolled face');
            setErrorMessage(
              localBio?.error ||
                `Face does not match enrolled template for ${employeeName || 'this trainee'}.`
            );
          }
        }
      } catch (err: any) {
        console.debug('Auto-scan step notice:', err?.message || err);
      } finally {
        isScanningRef.current = false;
      }
    };

    // Run auto-scan cycle every 340ms for responsive 3D head-turn & blink/smile detection
    scanTimer = setInterval(runAutoScan, 340);

    return () => {
      if (scanTimer) clearInterval(scanTimer);
    };
  }, [cameraReady, mode, enrolledPhoto, handleSuccess, progressAnim, resetMobileLiveness, triggerAlarmHaptic, deepFaceModel, employeeName]);

  // Manual shutter trigger fallback (Strictly gated by 3D live-face verification!)
  async function handleManualCapture() {
    if (!cameraRef.current || isCapturing || hasFinishedRef.current) return;

    if (!livenessVerifiedRef.current) {
      triggerAlarmHaptic();
      setStatusMessage('🛡️ Complete Live Check First (Turn Head & Smile/Blink)');
      setErrorMessage(
        'Static photos and phone screens are blocked. Please complete Step 1 (turn head slightly) and Step 2 (smile or blink) before capturing.'
      );
      return;
    }

    setIsCapturing(true);
    setErrorMessage(null);
    setScanStatus('verifying');
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
        setScanStatus('failed');
        setErrorMessage(quality.spoofReason || 'Device screen or photo spoof detected. Only live faces are allowed.');
        setStatusMessage('🚨 Photo / Screen Blocked');
        setIsCapturing(false);
        return;
      }

      if ((quality.tooDark && quality.brightness < 20) || (quality.tooBright && quality.brightness > 248)) {
        setScanStatus('failed');
        triggerAlarmHaptic();
        const reason = quality.tooDark ? '🚨 Lighting too dark! Please move to a well-lit area.' : '🚨 Harsh glare! Please adjust camera away from direct lights.';
        setErrorMessage(reason);
        setStatusMessage(quality.tooDark ? '⚠️ Too Dark' : '⚠️ Harsh Glare');
        setIsCapturing(false);
        return;
      }

      if (!quality.hasFace) {
        setScanStatus('failed');
        setErrorMessage('No clear live face detected in capture. Please position face clearly inside the oval.');
        setStatusMessage('⚠️ No face detected');
        setIsCapturing(false);
        return;
      }

      if (mode === 'enroll') {
        handleSuccess(base64Data);
        return;
      }

      if (mode === 'clock_in' || mode === 'clock_out' || mode === 'verify_test') {
        if (!enrolledPhoto) {
          setScanStatus('failed');
          setErrorMessage('No registered biometric face profile found. You must complete face registration before clocking in.');
          setStatusMessage('❌ Face not registered');
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
          resetMobileLiveness('🛡️ Mismatch — Repeat Live Check');
          setScanStatus('failed');
          setErrorMessage(
            localBio?.error ||
              `Facial Mismatch: Does not match enrolled template for ${employeeName || 'this student'}.`
          );
          setStatusMessage('⚠️ Verification failed. Please retake.');
          setIsCapturing(false);
          return;
        }
      }

      handleSuccess(base64Data);
    } catch (err: any) {
      setScanStatus('failed');
      setErrorMessage(err?.message || 'Failed to capture photo');
      setStatusMessage('⚠️ Capture error');
      setIsCapturing(false);
    }
  }

  function toggleFacing() {
    resetMobileLiveness();
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }

  function handleResetScan() {
    hasFinishedRef.current = false;
    resetMobileLiveness();
    setScanStatus('aligning');
    setStatusMessage('Position your live face inside the oval');
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
          setCameraReady(true);
          setScanStatus('aligning');
          setStatusMessage('Position face inside the oval');
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
                  backgroundColor: scanStatus === 'success' ? '#22c55e' : '#38bdf8',
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
                <Text style={styles.errorCardTitle}>Verification Notice</Text>
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
