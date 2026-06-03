import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera as CameraIcon, X } from 'lucide-react-native';

interface FaceScannerProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

export default function FaceScanner({ onCapture, onCancel }: FaceScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState(0);
  const [brightness] = useState(128);
  const [lightingStatus] = useState<'dark' | 'good' | 'bright'>('good');
  const cameraRef = React.useRef<React.ElementRef<typeof CameraView> | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function takePicture() {
    if (!cameraRef.current || isCapturing) return;

    const now = Date.now();
    if (now - lastCaptureTime < 1500) return;

    setIsCapturing(true);
    setLastCaptureTime(now);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        shutterSound: false,
        skipProcessing: true,
      });

      if (!photo.base64) {
        throw new Error('Could not capture image');
      }

      onCapture(`data:image/jpeg;base64,${photo.base64}`);

      try {
        await cameraRef.current.pausePreview();
      } catch (err) {
        console.debug('pausePreview not available:', err);
      }
    } catch (error: any) {
      Alert.alert('Capture Error', error?.message || 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        mirror
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.lightingIndicator,
              lightingStatus === 'dark' ? styles.lightingDark : lightingStatus === 'bright' ? styles.lightingBright : styles.lightingGood,
            ]}
          >
            <Text style={styles.lightingText}>✓ Ready</Text>
          </View>

          <View style={styles.guideFrame} />

          <View style={styles.controls}>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
              <X color="#fff" size={24} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={isCapturing}>
              {isCapturing ? <ActivityIndicator color="#fff" /> : <CameraIcon color="#fff" size={32} />}
            </TouchableOpacity>

            <View style={{ width: 48 }} />
          </View>
        </View>
      </CameraView>

      <View style={styles.footer}>
        <Text style={styles.hint}>Position your face inside the frame</Text>
        <Text style={styles.brightnessText}>Camera ready for capture</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#fff',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightingIndicator: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightingDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  lightingGood: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
  },
  lightingBright: {
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
  },
  lightingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  guideFrame: {
    width: 260,
    height: 360,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 130,
    borderStyle: 'dashed',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 12,
  },
  footer: {
    padding: 20,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  hint: {
    color: '#fff',
    fontSize: 14,
  },
  brightnessText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 20,
  },
  cancelButtonText: {
    color: '#94a3b8',
  },
});
