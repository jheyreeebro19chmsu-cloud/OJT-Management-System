import React, { useEffect, useState, useRef } from 'react';
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
import { X, ShieldCheck, Sparkles, Scan, CheckCircle2, Camera, RefreshCw, FlipHorizontal, Check } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Vertical oval (ellipse): ~60–65% screen height, ~1.38:1 height-to-width ratio, min 10% edge padding
const FRAME_HEIGHT = Math.min(SCREEN_HEIGHT * 0.62, 430);
const FRAME_WIDTH = Math.min(FRAME_HEIGHT / 1.38, SCREEN_WIDTH * 0.80);

interface FaceScannerProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

export default function FaceScanner({ onCapture, onCancel }: FaceScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  // Scanning laser animation
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Start smooth laser loop (no pulsing scaling to avoid flicker)
  useEffect(() => {
    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    laserLoop.start();

    return () => {
      laserLoop.stop();
    };
  }, []);

  async function handleTakePicture() {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      if (typeof cameraRef.current.takePictureAsync !== 'function') {
        throw new Error('Camera is still warming up. Please hold steady.');
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      });

      if (!photo || !photo.base64) {
        throw new Error('No image captured. Please try again.');
      }

      const base64Data = `data:image/jpeg;base64,${photo.base64}`;
      setCapturedPhoto(base64Data);
    } catch (error: any) {
      console.warn('Face capture notice:', error?.message || error);
    } finally {
      setIsCapturing(false);
    }
  }

  function handleConfirmPhoto() {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
    }
  }

  function handleRetake() {
    setCapturedPhoto(null);
  }

  function toggleFacing() {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
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
          Please grant camera permission for biometric face verification and attendance recognition.
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
    outputRange: [10, FRAME_HEIGHT - 20],
  });

  // Photo Preview Screen after capture
  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeBtn} onPress={handleRetake}>
              <X color="#fff" size={22} />
            </TouchableOpacity>
            <View style={[styles.statusBadge, styles.statusMatched]}>
              <CheckCircle2 size={14} color="#10b981" />
              <Text style={styles.statusText}>Face Captured</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.previewBottomSection}>
            <Text style={styles.previewHeading}>Review Your Face Photo</Text>
            <Text style={styles.previewSubtitle}>Ensure your face is well-lit, clearly visible, and centered.</Text>

            <View style={styles.previewBtnRow}>
              <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                <RefreshCw size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.retakeButtonText}>Retake Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPhoto}>
                <Check size={20} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.confirmButtonText}>Confirm & Use</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full-screen Camera View */}
      <CameraView
        ref={(r) => {
          cameraRef.current = r;
        }}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Darkened Vignette Overlay with Centered Oval Frame */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
            <X color="#fff" size={22} />
          </TouchableOpacity>

          <View style={[styles.statusBadge, cameraReady ? styles.statusAnalyzing : styles.statusAligning]}>
            {cameraReady ? <Sparkles size={14} color="#38bdf8" /> : <Scan size={14} color="#facc15" />}
            <Text style={styles.statusText}>{cameraReady ? 'Align Face in Oval' : 'Starting Camera...'}</Text>
          </View>

          <TouchableOpacity style={styles.flipBtn} onPress={toggleFacing}>
            <FlipHorizontal color="#fff" size={20} />
          </TouchableOpacity>
        </View>

        {/* Center Oval Biometric Recognition Guide Frame */}
        <View style={styles.frameContainer} pointerEvents="box-none">
          <View style={styles.guideOval}>
            {/* Animated Laser Scanning Line */}
            <Animated.View
              style={[
                styles.laserLine,
                {
                  transform: [{ translateY }],
                  backgroundColor: '#38bdf8',
                  shadowColor: '#38bdf8',
                },
              ]}
            />

            {/* Corner Landmark brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        {/* Bottom Biometric Status & Controls */}
        <View style={styles.bottomSection} pointerEvents="box-none">
          <View style={styles.instructionBox}>
            <ShieldCheck size={18} color="#38bdf8" />
            <Text style={styles.instructionText}>Position your face inside the oval and tap Capture</Text>
          </View>

          {/* Primary Manual Shutter Button */}
          <TouchableOpacity
            style={[styles.captureShutterBtn, isCapturing && { opacity: 0.6 }]}
            onPress={handleTakePicture}
            disabled={isCapturing}
          >
            <View style={styles.captureShutterInner}>
              {isCapturing ? (
                <ActivityIndicator color="#0284c7" size="small" />
              ) : (
                <Camera size={26} color="#0284c7" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.shutterHintText}>Tap to Capture Face Photo</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    paddingVertical: Platform.OS === 'ios' ? 60 : 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
  },
  statusAligning: {
    borderColor: 'rgba(250, 204, 21, 0.5)',
  },
  statusAnalyzing: {
    borderColor: 'rgba(56, 189, 248, 0.6)',
  },
  statusMatched: {
    borderColor: 'rgba(16, 185, 129, 0.8)',
    backgroundColor: 'rgba(6, 78, 59, 0.9)',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  frameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20, // slightly above center to accommodate chin/neck
  },
  guideOval: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    borderRadius: FRAME_WIDTH / 2,
    borderWidth: 3,
    borderColor: 'rgba(56, 189, 248, 0.9)',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  laserLine: {
    width: '100%',
    height: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: '#38bdf8',
  },
  cornerTL: { top: 20, left: 20, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 20, right: 20, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 20, left: 20, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 20, right: 20, borderBottomWidth: 3, borderRightWidth: 3 },
  bottomSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  instructionText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  captureShutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#38bdf8',
  },
  captureShutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterHintText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  previewBottomSection: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  previewHeading: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  previewSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  previewBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 14,
  },
  retakeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
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
    color: '#fff',
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
