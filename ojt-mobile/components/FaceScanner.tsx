import React, { useState, useRef, useEffect } from 'react';
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
  const cameraRef = useRef<any>(null);

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
      setIsCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
        });

        // Resize image to be smaller for faster processing/upload
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 320 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (resized.base64) {
          onCapture(`data:image/jpeg;base64,${resized.base64}`);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to capture image');
      } finally {
        setIsCapturing(false);
      }
    }
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing="user" 
        ref={cameraRef}
      >
        <View style={styles.overlay}>
          {/* Guide frame */}
          <View style={styles.guideFrame} />
          
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
    width: 250,
    height: 350,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 125,
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
