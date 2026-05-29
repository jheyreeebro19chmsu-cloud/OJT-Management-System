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
  const [brightness, setBrightness] = useState(128);
  const [lightingStatus, setLightingStatus] = useState<'dark' | 'good' | 'bright'>('good');
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
      
      // Check lighting before capturing
      if (lightingStatus === 'dark') {
        Alert.alert('Poor Lighting', 'The environment is too dark. Please move to a brighter area with good lighting and try again.');
        return;
      }
      
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
          // Pause camera preview to effectively 'turn off' camera after successful capture
          try {
            if (cameraRef.current && typeof cameraRef.current.pausePreview === 'function') {
              cameraRef.current.pausePreview();
            }
          } catch (err) {
            // ignore if method not available for this platform
            console.debug('pausePreview not available:', err);
          }
        }
      } catch (error) {
        console.error('Capture error:', error);
      } finally {
        setIsCapturing(false);
      }
    }
  }

  // Function to calculate brightness from image data
  const calculateBrightness = async () => {
    if (!cameraRef.current) return;
    
    try {
      // Take a photo in the background to check brightness
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.1, // Very low quality for speed
        base64: true,
        skipProcessing: true,
      });

      if (photo.base64) {
        // Convert base64 to number array and calculate average brightness
        const binaryString = atob(photo.base64);
        let brightness = 0;
        let pixelCount = 0;

        // Sample every Nth pixel for speed
        for (let i = 0; i < binaryString.length; i += 4) {
          const r = binaryString.charCodeAt(i) || 0;
          const g = binaryString.charCodeAt(i + 1) || 0;
          const b = binaryString.charCodeAt(i + 2) || 0;
          brightness += (r * 0.299 + g * 0.587 + b * 0.114); // Standard luminosity formula
          pixelCount++;
        }

        const avgBrightness = Math.floor(brightness / pixelCount);
        setBrightness(avgBrightness);

        // Determine lighting status
        if (avgBrightness < 60) {
          setLightingStatus('dark');
        } else if (avgBrightness > 200) {
          setLightingStatus('bright');
        } else {
          setLightingStatus('good');
        }
      }
    } catch (error) {
      // Silently fail - brightness check is non-critical
      console.debug('Brightness calculation error:', error);
    }
  };

  // Check brightness periodically
  useEffect(() => {
    const interval = setInterval(() => {
      calculateBrightness();
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  const handleFacesDetected = ({ faces }: any) => {
    try {
      if (faces && faces.length > 0) {
        const face = faces[0];
        const size = face && face.bounds && face.bounds.size && face.bounds.size.width ? face.bounds.size.width : 0;
        if (size > 100) {
          setFaceDetected(true);
          // Auto-capture after a tiny delay to ensure focus
          setTimeout(() => takePicture(), 120);
        }
      } else {
        setFaceDetected(false);
      }
    } catch (err) {
      console.debug('Error in face detection handler:', err);
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
          {/* Lighting Status Indicator */}
          <View style={[
            styles.lightingIndicator,
            lightingStatus === 'dark' ? styles.lightingDark : 
            lightingStatus === 'bright' ? styles.lightingBright : 
            styles.lightingGood
          ]}>
            <Text style={styles.lightingText}>
              {lightingStatus === 'dark' ? '🌙 Too Dark' : 
               lightingStatus === 'bright' ? '☀️ Too Bright' : 
               '✓ Good Lighting'}
            </Text>
          </View>

          {/* Lighting Warning Message */}
          {lightingStatus === 'dark' && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠️ Poor Lighting Detected</Text>
              <Text style={styles.warningMessage}>
                The environment is too dark. Please move to a place with better lighting.{'\n'}
                • Turn on lights{'\n'}
                • Move to a window{'\n'}
                • Increase brightness
              </Text>
            </View>
          )}

          {lightingStatus === 'bright' && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠️ Overexposed Lighting</Text>
              <Text style={styles.warningMessage}>
                The lighting is too bright. Please reduce glare.{'\n'}
                • Adjust your position{'\n'}
                • Reduce screen brightness{'\n'}
                • Move away from direct sunlight
              </Text>
            </View>
          )}

          {/* Guide frame with color feedback */}
          <View style={[
            styles.guideFrame, 
            faceDetected && { borderColor: '#22c55e', borderStyle: 'solid', borderWidth: 3 }
          ]} />
          
          {faceDetected && lightingStatus !== 'dark' && (
            <Text style={styles.captureAlert}>Capturing...</Text>
          )}
          
          <View style={styles.controls}>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
              <X color="#fff" size={24} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.captureButton,
                lightingStatus === 'dark' && { opacity: 0.5 }
              ]}
              onPress={takePicture}
              disabled={isCapturing || lightingStatus === 'dark'}
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
        <Text style={styles.brightnessText}>Brightness: {brightness}/255</Text>
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
  warningBox: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
  },
  warningTitle: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  warningMessage: {
    color: '#f5f5f5',
    fontSize: 12,
    lineHeight: 18,
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
  }
});
