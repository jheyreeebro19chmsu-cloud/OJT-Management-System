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

        // Fast, lightweight snapshot for real-time analysis
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.65,
          base64: true,
        });

        if (!photo || !photo.base64 || !isMountedRef.current || hasFinishedRef.current) {
          return;
        }

        const dataUrl = `data:image/jpeg;base64,${photo.base64}`;

        // 1. Quality & Lighting Inspection
        const quality: BiometricQualityResult = await biometricService.inspectQuality(dataUrl);

        if (!isMountedRef.current || hasFinishedRef.current) return;

        if (quality.tooDark) {
          consecutiveStable = 0;
          setStableCount(0);
          setScanStatus('aligning');
          setStatusMessage('⚠️ Too dark! Move to a brighter area');
          Animated.timing(progressAnim, { toValue: 0.2, duration: 200, useNativeDriver: false }).start();
          return;
        }

        if (quality.tooBright) {
          consecutiveStable = 0;
          setStableCount(0);
          setScanStatus('aligning');
          setStatusMessage('⚠️ Too bright! Avoid direct glare');
          Animated.timing(progressAnim, { toValue: 0.2, duration: 200, useNativeDriver: false }).start();
          return;
        }

        if (quality.faceObscured || quality.maskDetected || quality.glassesDetected || quality.capDetected) {
          consecutiveStable = 0;
          setStableCount(0);
          setScanStatus('failed');
          const prompt = quality.maskDetected
            ? '⚠️ Face mask detected! Please remove mask for biometric scan.'
            : quality.glassesDetected
              ? '⚠️ Dark sunglasses detected! Please remove sunglasses.'
              : quality.capDetected
                ? '⚠️ Cap detected! Please remove headwear.'
                : '⚠️ Face obscured! Please ensure your full face is visible.';
          setStatusMessage(prompt);
          setErrorMessage(prompt);
          Animated.timing(progressAnim, { toValue: 0.2, duration: 200, useNativeDriver: false }).start();
          return;
        }

        if (!quality.hasFace) {
          consecutiveStable = 0;
          setStableCount(0);
          setScanStatus('aligning');
          setStatusMessage('Position face inside the oval');
          Animated.timing(progressAnim, { toValue: 0.25, duration: 200, useNativeDriver: false }).start();
          return;
        }

        if (quality.faceCentered === false) {
          consecutiveStable = 0;
          setStableCount(0);
          setScanStatus('aligning');
          setStatusMessage('Center face inside the oval guide');
          Animated.timing(progressAnim, { toValue: 0.35, duration: 200, useNativeDriver: false }).start();
          return;
        }

        // 2. Mode-Specific Evaluation
        if (mode === 'enroll') {
          // Continuous Face Enrollment: Count 3 stable frames and auto-complete
          consecutiveStable++;
          setStableCount(consecutiveStable);
          setScanStatus('analyzing');

          const progressTarget = Math.min(0.40 + consecutiveStable * 0.20, 0.95);
          Animated.timing(progressAnim, { toValue: progressTarget, duration: 200, useNativeDriver: false }).start();

          if (consecutiveStable < 3) {
            setStatusMessage(`Scanning face biometrics... Hold steady (${consecutiveStable}/3)`);
          } else {
            // Take final high-quality capture for permanent database profile photo
            try {
              const finalPhoto = await cameraRef.current.takePictureAsync({
                quality: 0.88,
                base64: true,
              });
              const finalDataUrl = finalPhoto?.base64 ? `data:image/jpeg;base64,${finalPhoto.base64}` : dataUrl;
              handleSuccess(finalDataUrl);
            } catch {
              handleSuccess(dataUrl);
            }
          }
        } else if ((mode === 'clock_in' || mode === 'clock_out' || mode === 'verify_test') && enrolledPhoto) {
          // Continuous DTR Biometric Verification: Match live frame against enrolled template
          setScanStatus('verifying');
          setStatusMessage('Verifying identity against profile...');
          Animated.timing(progressAnim, { toValue: 0.65, duration: 200, useNativeDriver: false }).start();

          const bio: BiometricMatchResult = await biometricService.verifyBiometrics(enrolledPhoto, dataUrl, 0.62);

          if (!isMountedRef.current || hasFinishedRef.current) return;

          if (bio.matched) {
            // Take high-quality snapshot for verified time record
            try {
              const finalPhoto = await cameraRef.current.takePictureAsync({
                quality: 0.85,
                base64: true,
              });
              const finalDataUrl = finalPhoto?.base64 ? `data:image/jpeg;base64,${finalPhoto.base64}` : dataUrl;
              handleSuccess(finalDataUrl, bio.confidence, bio.distance);
            } catch {
              handleSuccess(dataUrl, bio.confidence, bio.distance);
            }
          } else {
            consecutiveStable = 0;
            setStableCount(0);
            setScanStatus('failed');
            setStatusMessage(`⚠️ Biometric mismatch (Distance: ${bio.distance.toFixed(2)} > 0.62)`);
          }
        } else {
          // If no enrolled photo yet on clock-in, auto-enroll student on first punch
          consecutiveStable++;
          setStableCount(consecutiveStable);
          setScanStatus('analyzing');
          if (consecutiveStable >= 2) {
            handleSuccess(dataUrl);
          }
        }
      } catch (err: any) {
        console.debug('Auto-scan step notice:', err?.message || err);
      } finally {
        isScanningRef.current = false;
      }
    };

    // Run auto-scan cycle every 750ms
    scanTimer = setInterval(runAutoScan, 750);

    return () => {
      if (scanTimer) clearInterval(scanTimer);
    };
  }, [cameraReady, mode, enrolledPhoto, handleSuccess, progressAnim, scanStatus]);

  // Manual shutter trigger fallback
  async function handleManualCapture() {
    if (!cameraRef.current || isCapturing || hasFinishedRef.current) return;
    setIsCapturing(true);
    setErrorMessage(null);
    setScanStatus('verifying');
    setStatusMessage('Capturing & analyzing biometrics...');

    try {
      if (typeof cameraRef.current.takePictureAsync !== 'function') {
        throw new Error('Camera is warming up. Please hold steady.');
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        base64: true,
      });

      if (!photo || !photo.base64) {
        throw new Error('No image captured. Please try again.');
      }

      const base64Data = `data:image/jpeg;base64,${photo.base64}`;

      // Enforce fail-closed obstruction checks
      const quality = await biometricService.inspectQuality(base64Data);
      if (quality.faceObscured || quality.maskDetected || quality.glassesDetected || quality.capDetected) {
        setScanStatus('failed');
        const reason = quality.maskDetected
          ? 'Face mask detected! System prevents verification. Please remove mask for a clear face.'
          : quality.glassesDetected
            ? 'Dark sunglasses detected! System prevents verification. Please remove sunglasses.'
            : quality.capDetected
              ? 'Cap or headwear detected! Please remove headwear.'
              : 'Face obscured! System prevents successful verification and prompts for a clear face.';
        setErrorMessage(reason);
        setStatusMessage('⚠️ Face Obstructed');
        setIsCapturing(false);
        return;
      }

      // If in DTR verification mode, check against enrolled photo
      if ((mode === 'clock_in' || mode === 'clock_out') && enrolledPhoto) {
        setStatusMessage('Verifying biometric match...');
        const bio = await biometricService.verifyBiometrics(enrolledPhoto, base64Data, 0.62);
        if (bio.matched) {
          handleSuccess(base64Data, bio.confidence, bio.distance);
          return;
        } else {
          setScanStatus('failed');
          setErrorMessage(
            `Face Mismatch: Does not match enrolled template for ${employeeName || 'this student'} (Distance: ${bio.distance.toFixed(2)}, threshold: 0.62). Center your face and avoid glare.`
          );
          setStatusMessage('⚠️ Verification failed. Please retake.');
          setIsCapturing(false);
          return;
        }
      }

      // If in enrollment mode, inspect quality
      if (mode === 'enroll') {
        const quality = await biometricService.inspectQuality(base64Data);
        if (quality.tooDark) {
          setScanStatus('failed');
          setErrorMessage('Photo is too dark. Move to a well-lit area.');
          setStatusMessage('⚠️ Photo too dark');
          setIsCapturing(false);
          return;
        }
        if (quality.tooBright) {
          setScanStatus('failed');
          setErrorMessage('Photo has too much glare. Adjust lighting.');
          setStatusMessage('⚠️ Too much glare');
          setIsCapturing(false);
          return;
        }
        handleSuccess(base64Data);
        return;
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
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }

  function handleResetScan() {
    hasFinishedRef.current = false;
    setScanStatus('aligning');
    setStatusMessage('Position face inside the oval');
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
                (isCapturing || scanStatus === 'success') && { opacity: 0.6 },
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
                  <Camera size={26} color="#0284c7" />
                )}
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.hudInstructionText}>
            {scanStatus === 'success'
              ? '✓ Authentication complete. Finalizing...'
              : 'Automatic continuous scan active • Or tap button to capture'}
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
});
