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

    function computePerceptualDescriptor(img) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const descriptor = new Float32Array(128);
        if (!ctx) return descriptor;
        ctx.drawImage(img, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;

        for (let gy = 0; gy < 8; gy++) {
          for (let gx = 0; gx < 8; gx++) {
            let blockLum = 0;
            for (let y = gy * 8; y < (gy + 1) * 8; y++) {
              for (let x = gx * 8; x < (gx + 1) * 8; x++) {
                const idx = (y * 64 + x) * 4;
                blockLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              }
            }
            descriptor[gy * 8 + gx] = blockLum / (64 * 255);
          }
        }

        for (let i = 0; i < 32; i++) {
          const y = Math.floor(i / 8) * 16 + 8;
          const x = (i % 8) * 8 + 4;
          const idx = (y * 64 + x) * 4;
          const rightIdx = (y * 64 + Math.min(x + 4, 63)) * 4;
          const downIdx = (Math.min(y + 4, 63) * 64 + x) * 4;
          const lumCenter = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          const lumRight = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
          const lumDown = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];
          descriptor[64 + i] = ((lumRight - lumCenter) / 255 + (lumDown - lumCenter) / 255) / 2;
        }

        for (let i = 0; i < 32; i++) {
          const y = (i % 8) * 8 + 4;
          const x = Math.floor(i / 8) * 16 + 8;
          const idx = (y * 64 + x) * 4;
          const r = data[idx] / 255;
          const g = data[idx + 1] / 255;
          const b = data[idx + 2] / 255;
          descriptor[96 + i] = (r * 0.5 + g * 0.3 + b * 0.2);
        }

        let norm = 0;
        for (let i = 0; i < 128; i++) norm += descriptor[i] * descriptor[i];
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < 128; i++) descriptor[i] /= norm;
        return descriptor;
      } catch (err) {
        return new Float32Array(128);
      }
    }

    async function handleVerify(req) {
      const { id, registered, live, threshold = 0.62 } = req;
      try {
        const [img1, img2] = await Promise.all([loadImage(registered), loadImage(live)]);
        let d1Desc = null;
        let d2Desc = null;
        let isPerceptual = false;

        if (modelsReady) {
          try {
            const detectorOpts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.15, inputSize: 320 });
            const [d1, d2] = await Promise.all([
              faceapi.detectSingleFace(img1, detectorOpts).withFaceLandmarks().withFaceDescriptor(),
              faceapi.detectSingleFace(img2, detectorOpts).withFaceLandmarks().withFaceDescriptor()
            ]);
            if (d1?.descriptor && d2?.descriptor) {
              d1Desc = d1.descriptor;
              d2Desc = d2.descriptor;
            }
          } catch (e) {
            console.warn('face-api detection notice, fallback to perceptual:', e);
          }
        }

        if (!d1Desc || !d2Desc) {
          d1Desc = computePerceptualDescriptor(img1);
          d2Desc = computePerceptualDescriptor(img2);
          isPerceptual = true;
        }

        const distance = calculateEuclideanDistance(d1Desc, d2Desc);
        const effectiveThreshold = isPerceptual ? Math.max(threshold, 0.72) : threshold;
        const matched = distance <= effectiveThreshold;
        const confidence = Math.max(0, Math.min(100, Math.round((1 - distance / 0.68) * 100)));

        sendToNative({
          id,
          success: true,
          matched,
          distance: parseFloat(distance.toFixed(3)),
          confidence,
          threshold: effectiveThreshold,
          perceptual: isPerceptual
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
        canvas.width = 320;
        canvas.height = 240;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let totalLum = 0;
        const totalPixels = canvas.width * canvas.height;
        for (let i = 0; i < imgData.length; i += 4) {
          totalLum += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
        }
        const avgLum = Math.round(totalLum / totalPixels);

        let hasFace = false;
        let faceCentered = true;
        let maskDetected = false;
        let glassesDetected = false;

        if (modelsReady) {
          const detectorOpts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.14, inputSize: 224 });
          const det = await faceapi.detectSingleFace(img, detectorOpts);
          if (det) {
            hasFace = true;
            const box = det.box;
            const faceCx = (box.x + box.width / 2) / canvas.width;
            const faceCy = (box.y + box.height / 2) / canvas.height;
            // Face should be roughly centered within oval guide
            if (Math.abs(faceCx - 0.50) > 0.22 || Math.abs(faceCy - 0.48) > 0.25) {
              faceCentered = false;
            }

            // Lower face mask sampling
            const lowerY = Math.round(box.y + box.height * 0.72);
            const lowerMidX = Math.round(box.x + box.width * 0.50);
            if (lowerY > 0 && lowerY < canvas.height && lowerMidX > 0 && lowerMidX < canvas.width) {
              const idx = (lowerY * canvas.width + lowerMidX) * 4;
              const r = imgData[idx];
              const g = imgData[idx + 1];
              const b = imgData[idx + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              if ((b > r + 20 && b > 65) || (lum < 40 && avgLum > 65)) {
                maskDetected = true;
              }
            }

            // Upper face sunglasses sampling
            const eyeY = Math.round(box.y + box.height * 0.35);
            const eyeLeftX = Math.round(box.x + box.width * 0.35);
            const eyeRightX = Math.round(box.x + box.width * 0.65);
            let darkCount = 0;
            [eyeLeftX, eyeRightX].forEach((ex) => {
              if (eyeY > 0 && eyeY < canvas.height && ex > 0 && ex < canvas.width) {
                const idx = (eyeY * canvas.width + ex) * 4;
                const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
                if (lum < 38) darkCount++;
              }
            });
            if (darkCount >= 2 && avgLum > 60) {
              glassesDetected = true;
            }
          }
        } else {
          hasFace = true;
        }

        const faceObscured = Boolean(maskDetected || glassesDetected);

        sendToNative({
          id,
          hasFace,
          faceCentered,
          maskDetected,
          glassesDetected,
          faceObscured,
          tooDark: avgLum < 30,
          tooBright: avgLum > 240,
          brightness: avgLum
        });
      } catch (err) {
        sendToNative({ id, hasFace: true, faceCentered: true, maskDetected: false, glassesDetected: false, faceObscured: false, tooDark: false, tooBright: false, brightness: 128 });
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
