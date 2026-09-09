import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { biometricService } from '../services/biometricService';

const BRIDGE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biometric Engine</title>
  <script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.min.js"></script>
  <style>body { margin: 0; padding: 0; background: transparent; }</style>
</head>
<body>
  <canvas id="offscreenCanvas" width="160" height="120" style="display:none;"></canvas>
  <script>
    let modelsReady = false;

    function sendToNative(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    async function initModels() {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        modelsReady = true;
        sendToNative({ type: 'BRIDGE_READY', success: true });
      } catch (err) {
        console.warn('Model init error, retrying...', err);
        // Retry once after 2 seconds
        setTimeout(async () => {
          try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
            await Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
              faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
              faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            modelsReady = true;
            sendToNative({ type: 'BRIDGE_READY', success: true });
          } catch (e2) {
            sendToNative({ type: 'BRIDGE_READY', success: false, error: e2.message });
          }
        }, 2000);
      }
    }

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error('Failed to load image for biometrics'));
        img.src = src;
      });
    }

    function calculateEuclideanDistance(desc1, desc2) {
      if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
      let sum = 0;
      for (let i = 0; i < desc1.length; i++) {
        const diff = desc1[i] - desc2[i];
        sum += diff * diff;
      }
      return Math.sqrt(sum);
    }

    async function handleVerify(req) {
      const { id, registered, live, threshold = 0.55 } = req;
      try {
        if (!modelsReady) {
          sendToNative({ id, success: false, matched: false, distance: Infinity, confidence: 0, error: 'Models still initializing' });
          return;
        }

        const [img1, img2] = await Promise.all([loadImage(registered), loadImage(live)]);
        const detectorOpts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.15, inputSize: 320 });

        const [d1, d2] = await Promise.all([
          faceapi.detectSingleFace(img1, detectorOpts).withFaceLandmarks().withFaceDescriptor(),
          faceapi.detectSingleFace(img2, detectorOpts).withFaceLandmarks().withFaceDescriptor()
        ]);

        if (!d1 || !d1.descriptor) {
          sendToNative({
            id,
            success: false,
            matched: false,
            distance: Infinity,
            confidence: 0,
            error: 'No face detected in registered profile photo. Please re-enroll in profile.'
          });
          return;
        }

        if (!d2 || !d2.descriptor) {
          sendToNative({
            id,
            success: false,
            matched: false,
            distance: Infinity,
            confidence: 0,
            error: 'No face detected in live photo. Please position your face inside the oval and hold steady.'
          });
          return;
        }

        const distance = calculateEuclideanDistance(d1.descriptor, d2.descriptor);
        const matched = distance <= threshold;
        const confidence = Math.max(0, Math.min(100, Math.round((1 - distance / 0.68) * 100)));

        sendToNative({
          id,
          success: true,
          matched,
          distance: parseFloat(distance.toFixed(3)),
          confidence,
          threshold
        });
      } catch (err) {
        sendToNative({
          id,
          success: false,
          matched: false,
          distance: Infinity,
          confidence: 0,
          error: err.message || 'Error processing face biometrics'
        });
      }
    }

    async function handleInspect(req) {
      const { id, photo } = req;
      try {
        const img = await loadImage(photo);
        const canvas = document.getElementById('offscreenCanvas');
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let totalLum = 0;
        const totalPixels = canvas.width * canvas.height;
        for (let i = 0; i < imgData.length; i += 4) {
          totalLum += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
        }
        const avgLum = Math.round(totalLum / totalPixels);

        let hasFace = true;
        if (modelsReady) {
          const detectorOpts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.12, inputSize: 224 });
          const det = await faceapi.detectSingleFace(img, detectorOpts);
          hasFace = !!det;
        }

        sendToNative({
          id,
          hasFace,
          tooDark: avgLum < 30,
          tooBright: avgLum > 240,
          brightness: avgLum
        });
      } catch (err) {
        sendToNative({ id, hasFace: true, tooDark: false, tooBright: false, brightness: 128 });
      }
    }

    function processMessage(raw) {
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (data.action === 'VERIFY') {
          handleVerify(data);
        } else if (data.action === 'INSPECT') {
          handleInspect(data);
        }
      } catch (e) {
        console.error('Bridge message parse error', e);
      }
    }

    window.addEventListener('message', (e) => processMessage(e.data));
    document.addEventListener('message', (e) => processMessage(e.data));

    // Start loading models as soon as page loads
    window.onload = initModels;
  </script>
</body>
</html>
`;

export default function BiometricBridge() {
  const webViewRef = useRef<WebView | null>(null);

  useEffect(() => {
    biometricService.registerBridge((msg: any) => {
      if (webViewRef.current) {
        const payload = JSON.stringify(msg);
        webViewRef.current.postMessage(payload);
      }
    });
  }, []);

  function handleMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      biometricService.handleBridgeMessage(data);
    } catch (e) {
      console.warn('BiometricBridge handleMessage parse notice:', e);
    }
  }

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: BRIDGE_HTML }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        style={styles.hiddenWebView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 0,
    height: 0,
    opacity: 0,
    position: 'absolute',
    left: -1000,
    top: -1000,
    overflow: 'hidden',
  },
  hiddenWebView: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
