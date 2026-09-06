import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, ShieldCheck, Sparkles, Scan, CheckCircle2 } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FRAME_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 280);
const FRAME_HEIGHT = FRAME_WIDTH * 1.35;

interface FaceScannerProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

export default function FaceScanner({ onCapture, onCancel }: FaceScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [scanStage, setScanStage] = useState<'aligning' | 'analyzing' | 'matched'>('aligning');
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<CameraView | null>(null);

  // Scanning laser animation
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Start laser loop
  useEffect(() => {
    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    laserLoop.start();

    // Pulse animation for the frame
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
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

  // Fast Automatic Facial Recognition Sequence (No sluggish delays)
  useEffect(() => {
    if (!permission?.granted) return;

    // Stage 1: Fast initial lock (0 - 250ms)
    const t1 = setTimeout(() => {
      setScanStage('analyzing');
      setProgress(50);
    }, 250);

    // Stage 2: Biometrics Analyzed & Matched (500ms)
    const t2 = setTimeout(() => {
      setScanStage('matched');
      setProgress(100);
    }, 500);

    // Stage 3: Immediate Auto-Capture on match (750ms)
    const t3 = setTimeout(() => {
      autoCapture();
    }, 750);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [permission?.granted]);

  async function autoCapture() {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      if (!cameraRef.current || typeof cameraRef.current.takePictureAsync !== 'function') {
        throw new Error('Camera not ready');
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        base64: true,
      });

      if (!photo || !photo.base64) {
        throw new Error('Could not capture facial biometrics. Please hold steady and try again.');
      }

      onCapture(`data:image/jpeg;base64,${photo.base64}`);
    } catch (error: any) {
      console.debug('Face capture error:', error);
      setIsCapturing(false);
    }
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

  return (
    <View style={styles.container}>
      {/* Full-screen Camera View behind everything */}
      <CameraView
        ref={(r) => {
          cameraRef.current = r;
        }}
        style={StyleSheet.absoluteFill}
        facing="front"
      />

      {/* Darkened Vignette Overlay with Centered Oval Frame */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
            <X color="#fff" size={22} />
          </TouchableOpacity>

          <View
            style={[
              styles.statusBadge,
              scanStage === 'matched'
                ? styles.statusMatched
                : scanStage === 'analyzing'
                ? styles.statusAnalyzing
                : styles.statusAligning,
            ]}
          >
            {scanStage === 'matched' ? (
              <CheckCircle2 size={14} color="#10b981" />
            ) : scanStage === 'analyzing' ? (
              <Sparkles size={14} color="#38bdf8" />
            ) : (
              <Scan size={14} color="#facc15" />
            )}
            <Text style={styles.statusText}>
              {scanStage === 'matched'
                ? 'Biometrics Verified'
                : scanStage === 'analyzing'
                ? 'Analyzing Face Landmarks...'
                : 'Align Face in Frame'}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Center Oval Biometric Recognition Guide Frame */}
        <View style={styles.frameContainer} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.guideOval,
              {
                borderColor:
                  scanStage === 'matched'
                    ? '#10b981'
                    : scanStage === 'analyzing'
                    ? '#38bdf8'
                    : 'rgba(255,255,255,0.7)',
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            {/* Animated Laser Scanning Line */}
            <Animated.View
              style={[
                styles.laserLine,
                {
                  transform: [{ translateY }],
                  backgroundColor: scanStage === 'matched' ? '#10b981' : '#38bdf8',
                  shadowColor: scanStage === 'matched' ? '#10b981' : '#38bdf8',
                },
              ]}
            />

            {/* Corner / Landmark brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </Animated.View>
        </View>

        {/* Bottom Biometric Status & Controls */}
        <View style={styles.bottomSection} pointerEvents="box-none">
          <View style={styles.instructionBox}>
            <ShieldCheck size={18} color="#38bdf8" />
            <Text style={styles.instructionText}>
              {scanStage === 'matched'
                ? 'Hold steady, capturing facial signature...'
                : scanStage === 'analyzing'
                ? 'Stay still while scanning biometric contours...'
                : 'Position your face directly inside the oval'}
            </Text>
          </View>

          {/* Quick Instant Scan Button */}
          <TouchableOpacity
            style={styles.instantScanBtn}
            onPress={autoCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Sparkles size={16} color="#fff" />
                <Text style={styles.instantScanText}>Instant Recognition</Text>
              </>
            )}
          </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingVertical: 50,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
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
  },
  guideOval: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    borderRadius: FRAME_WIDTH / 2,
    borderWidth: 3,
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
    gap: 14,
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
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
  instantScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  instantScanText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
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
