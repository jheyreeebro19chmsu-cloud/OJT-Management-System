import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera as CameraIcon, RefreshCw, X } from 'lucide-react-native';

interface FaceScannerProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

export default function FaceScanner({ onCapture, onCancel }: FaceScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState(0);
  const cameraRef = React.useRef<any>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#2563eb" /></View>;
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
    if (cameraRef.current && !isCapturing) {
      const now = Date.now();
      if (now - lastCaptureTime < 2000) return; // Debounce auto-capture
      
      setIsCapturing(true);
      setLastCaptureTime(now);
      
      try {
        // Take a low-res picture directly for maximum speed
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: true,
          shutterSound: false,
          skipProcessing: true, // Crucial for "instant" feel
        });

        if (photo.base64) {
          onCapture(`data:image/jpeg;base64,${photo.base64}`);
        }
      } catch (error) {
        console.error('Capture error:', error);
      } finally {
        setIsCapturing(false);
      }
    }
  }

  const handleFacesDetected = ({ faces }: any) => {
    if (faces.length > 0) {
      const face = faces[0];
      // Basic check if face is roughly centered and large enough
      if (face.bounds.size.width > 100) {
        setFaceDetected(true);
        // Auto-capture after a tiny delay to ensure focus
        setTimeout(() => takePicture(), 100);
      }
    } else {
      setFaceDetected(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing="user" 
        ref={cameraRef}
        onFacesDetected={handleFacesDetected}
        barcodeScannerSettings={{}} // Needed to trigger some internal optimizations
      >
        <View style={styles.overlay}>
          {/* Guide frame with color feedback */}
          <View style={[
            styles.guideFrame, 
            faceDetected && { borderColor: '#22c55e', borderStyle: 'solid', borderWidth: 3 }
          ]} />
          
          {faceDetected && (
            <Text style={styles.captureAlert}>Capturing...</Text>
          )}
          
          <View style={styles.controls}>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
              <X color="#fff" size={24} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.captureButton} 
              onPress={takePicture}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <CameraIcon color="#fff" size={32} />
              )}
            </TouchableOpacity>
            
            <View style={{ width: 48 }} /> 
          </View>
        </View>
      </CameraView>
      <View style={styles.footer}>
        <Text style={styles.hint}>Position your face inside the frame</Text>
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
  guideFrame: {
    width: 260,
    height: 360,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 130,
    borderStyle: 'dashed',
  },
  captureAlert: {
    position: 'absolute',
    top: '30%',
    color: '#22c55e',
    fontSize: 24,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
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
  }
});
