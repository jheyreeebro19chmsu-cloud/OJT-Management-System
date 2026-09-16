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
      const { id, registered, live, threshold = 0.52 } = req;
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
        const effectiveThreshold = isPerceptual ? Math.min(threshold, 0.35) : threshold;
        const matched = distance <= effectiveThreshold;
        const confidence = Math.max(0, Math.min(100, Math.round((1 - distance / effectiveThreshold) * 100)));

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

    function getPixel(data, width, height, x, y) {
      const cx = Math.max(0, Math.min(width - 1, Math.round(x)));
      const cy = Math.max(0, Math.min(height - 1, Math.round(y)));
      const idx = (cy * width + cx) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      return { r, g, b, lum };
    }

    function getPatchAvg(data, width, height, cx, cy, radius) {
      let rSum = 0, gSum = 0, bSum = 0, lumSum = 0, count = 0;
      const r = radius || 2;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const p = getPixel(data, width, height, cx + dx, cy + dy);
          rSum += p.r;
          gSum += p.g;
          bSum += p.b;
          lumSum += p.lum;
          count++;
        }
      }
      return {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
        lum: Math.round(lumSum / count)
      };
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
        let capDetected = false;

        if (modelsReady) {
          const detectorOpts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.14, inputSize: 224 });
          let det = null;
          try {
            det = await faceapi.detectSingleFace(img, detectorOpts).withFaceLandmarks();
          } catch (e) {
            det = await faceapi.detectSingleFace(img, detectorOpts);
          }

          if (det) {
            hasFace = true;
            const box = det.box || (det.detection ? det.detection.box : null) || { x: 40, y: 30, width: 240, height: 180 };
            const landmarks = det.landmarks ? det.landmarks.positions : null;

            const faceCx = (box.x + box.width / 2) / canvas.width;
            const faceCy = (box.y + box.height / 2) / canvas.height;
            // Face should be roughly centered within oval guide
            if (Math.abs(faceCx - 0.50) > 0.22 || Math.abs(faceCy - 0.48) > 0.25) {
              faceCentered = false;
            }

            // Background Light Sampling (Corners & Top Margin)
            let bgLumSum = 0;
            let bgSamples = 0;
            const cornerW = Math.max(8, Math.floor(canvas.width * 0.20));
            const cornerH = Math.max(8, Math.floor(canvas.height * 0.20));
            for (let y = 0; y < cornerH; y += 4) {
              for (let x = 0; x < cornerW; x += 4) {
                bgLumSum += getPixel(imgData, canvas.width, canvas.height, x, y).lum;
                bgLumSum += getPixel(imgData, canvas.width, canvas.height, canvas.width - 1 - x, y).lum;
                bgSamples += 2;
              }
            }
            const bgLum = bgSamples > 0 ? Math.round(bgLumSum / bgSamples) : avgLum;
            const poorBackgroundLighting = bgLum < 45 || avgLum < 38;

            // 1. Cheek Skin Tone Baseline Sampling
            let cx1, cy1, cx2, cy2;
            if (landmarks && landmarks.length >= 68) {
              cx1 = (landmarks[30].x + landmarks[3].x) / 2;
              cy1 = (landmarks[30].y + landmarks[3].y) / 2;
              cx2 = (landmarks[30].x + landmarks[13].x) / 2;
              cy2 = (landmarks[30].y + landmarks[13].y) / 2;
            } else {
              cx1 = box.x + box.width * 0.26;
              cy1 = box.y + box.height * 0.58;
              cx2 = box.x + box.width * 0.74;
              cy2 = box.y + box.height * 0.58;
            }
            const cheek1 = getPatchAvg(imgData, canvas.width, canvas.height, cx1, cy1, 3);
            const cheek2 = getPatchAvg(imgData, canvas.width, canvas.height, cx2, cy2, 3);
            const skinR = Math.round((cheek1.r + cheek2.r) / 2);
            const skinG = Math.round((cheek1.g + cheek2.g) / 2);
            const skinB = Math.round((cheek1.b + cheek2.b) / 2);
            const skinLum = Math.max(35, Math.round((cheek1.lum + cheek2.lum) / 2));

            // 2. HAT / CAP / HEADWEAR DETECTION
            if (landmarks && landmarks.length >= 68) {
              const browMidY = (landmarks[21].y + landmarks[22].y) / 2;
              const noseBridgeX = landmarks[27].x;

              const fore1 = getPatchAvg(imgData, canvas.width, canvas.height, noseBridgeX, browMidY - 14, 2);
              const fore2 = getPatchAvg(imgData, canvas.width, canvas.height, noseBridgeX, browMidY - 26, 2);
              const fore3 = getPatchAvg(imgData, canvas.width, canvas.height, noseBridgeX, browMidY - 38, 2);

              const foreColorDiff1 = Math.abs(fore1.r - skinR) + Math.abs(fore1.g - skinG) + Math.abs(fore1.b - skinB);
              const foreColorDiff2 = Math.abs(fore2.r - skinR) + Math.abs(fore2.g - skinG) + Math.abs(fore2.b - skinB);

              const isForeheadFabric = (foreColorDiff1 > 48 || fore1.lum < 32 || fore1.lum > skinLum + 70) &&
                                       (foreColorDiff2 > 48 || fore2.lum < 32 || fore2.lum > skinLum + 70);
              const isCapBrimShadow = fore1.lum < skinLum * 0.48 && fore2.lum < skinLum * 0.48;
              const foreheadHeight = browMidY - box.y;
              const foreheadTruncated = foreheadHeight < 16;

              if ((isForeheadFabric || isCapBrimShadow) && foreheadHeight > 18 || foreheadTruncated) {
                capDetected = true;
              }
            }

            // 3. GLASSES DETECTION (Eyeglasses, Reading Glasses, Sunglasses)
            if (landmarks && landmarks.length >= 68) {
              const bridgePoint = landmarks[27];
              const bridgePatch = getPatchAvg(imgData, canvas.width, canvas.height, bridgePoint.x, bridgePoint.y, 2);
              const bridgeColorDiff = Math.abs(bridgePatch.r - skinR) + Math.abs(bridgePatch.g - skinG) + Math.abs(bridgePatch.b - skinB);
              const bridgeTop = getPixel(imgData, canvas.width, canvas.height, bridgePoint.x, bridgePoint.y - 4);
              const bridgeBottom = getPixel(imgData, canvas.width, canvas.height, bridgePoint.x, bridgePoint.y + 4);
              const bridgeVerticalContrast = Math.abs(bridgeTop.lum - bridgePatch.lum) + Math.abs(bridgeBottom.lum - bridgePatch.lum);
              const hasBridgeFrame = (bridgeColorDiff > 40 || bridgePatch.lum < skinLum * 0.55 || bridgeVerticalContrast > 36);

              const rPupilX = (landmarks[36].x + landmarks[39].x) / 2;
              const rPupilY = (landmarks[37].y + landmarks[40].y) / 2;
              const rOuterSclera = getPixel(imgData, canvas.width, canvas.height, landmarks[36].x + 4, rPupilY);
              const rInnerSclera = getPixel(imgData, canvas.width, canvas.height, landmarks[39].x - 4, rPupilY);
              const rCenter = getPixel(imgData, canvas.width, canvas.height, rPupilX, rPupilY);

              const lPupilX = (landmarks[42].x + landmarks[45].x) / 2;
              const lPupilY = (landmarks[43].y + landmarks[46].y) / 2;
              const lInnerSclera = getPixel(imgData, canvas.width, canvas.height, landmarks[42].x + 4, lPupilY);
              const lOuterSclera = getPixel(imgData, canvas.width, canvas.height, landmarks[45].x - 4, lPupilY);
              const lCenter = getPixel(imgData, canvas.width, canvas.height, lPupilX, lPupilY);

              const rAllDark = rCenter.lum < 32 && rOuterSclera.lum < 38 && rInnerSclera.lum < 38;
              const lAllDark = lCenter.lum < 32 && lInnerSclera.lum < 38 && lOuterSclera.lum < 38;

              const rEyeColorDiff = Math.abs(rCenter.r - skinR) + Math.abs(rCenter.g - skinG) + Math.abs(rCenter.b - skinB);
              const lEyeColorDiff = Math.abs(lCenter.r - skinR) + Math.abs(lCenter.g - skinG) + Math.abs(lCenter.b - skinB);
              const mirroredSunglasses = (rEyeColorDiff > 80 && rCenter.lum > 220) && (lEyeColorDiff > 80 && lCenter.lum > 220);

              const rLowerRim = getPixel(imgData, canvas.width, canvas.height, landmarks[41].x, landmarks[41].y + 6);
              const lLowerRim = getPixel(imgData, canvas.width, canvas.height, landmarks[46].x, landmarks[46].y + 6);
              const rRimDiff = Math.abs(rLowerRim.r - skinR) + Math.abs(rLowerRim.g - skinG) + Math.abs(rLowerRim.b - skinB);
              const lRimDiff = Math.abs(lLowerRim.r - skinR) + Math.abs(lLowerRim.g - skinG) + Math.abs(lLowerRim.b - skinB);
              const hasLowerRimFrame = (rRimDiff > 42 && lRimDiff > 42) || (rLowerRim.lum < skinLum * 0.50 && lLowerRim.lum < skinLum * 0.50);

              const hasLensReflection = (rCenter.lum > 230 && rEyeColorDiff > 55) || (lCenter.lum > 230 && lEyeColorDiff > 55);

              const isGlasses = (rAllDark && lAllDark && skinLum > 48) ||
                                mirroredSunglasses ||
                                (hasBridgeFrame && (hasLowerRimFrame || hasLensReflection || bridgeColorDiff > 50));

              if (isGlasses) {
                glassesDetected = true;
              }
            }

            // 4. MASK DETECTION (Lower face nose-to-chin region)
            if (landmarks && landmarks.length >= 68) {
              const philtrumX = (landmarks[33].x + landmarks[51].x) / 2;
              const philtrumY = (landmarks[33].y + landmarks[51].y) / 2;
              const philtrumP = getPatchAvg(imgData, canvas.width, canvas.height, philtrumX, philtrumY, 2);

              const chinX = (landmarks[57].x + landmarks[8].x) / 2;
              const chinY = (landmarks[57].y + landmarks[8].y) / 2;
              const chinP = getPatchAvg(imgData, canvas.width, canvas.height, chinX, chinY, 2);

              const philColorDiff = Math.abs(philtrumP.r - skinR) + Math.abs(philtrumP.g - skinG) + Math.abs(philtrumP.b - skinB);
              const chinColorDiff = Math.abs(chinP.r - skinR) + Math.abs(chinP.g - skinG) + Math.abs(chinP.b - skinB);

              const philtrumIsSkin = philColorDiff < 60 && philtrumP.lum > skinLum * 0.45;
              const chinIsSkin = chinColorDiff < 60 && chinP.lum > skinLum * 0.45;

              const isSurgicalBlue = (philtrumP.b > philtrumP.r + 28 && philtrumP.b > 75) || (chinP.b > chinP.r + 28 && chinP.b > 75);
              const isBlackMask = (philtrumP.lum < 24 && chinP.lum < 24 && skinLum > 60);
              const isMaskFabric = (!philtrumIsSkin && !chinIsSkin && (philColorDiff > 70 && chinColorDiff > 70));

              if (isSurgicalBlue || isBlackMask || isMaskFabric) {
                maskDetected = true;
              }
            }

            // 5. EAR Liveness Anti-Spoof Detection
            let ear = 0.30;
            let eyesClosed = false;
            if (landmarks && landmarks.length >= 68) {
              const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
              const rEAR = (dist(landmarks[37], landmarks[41]) + dist(landmarks[38], landmarks[40])) / (2.0 * Math.max(1, dist(landmarks[36], landmarks[39])));
              const lEAR = (dist(landmarks[43], landmarks[47]) + dist(landmarks[44], landmarks[46])) / (2.0 * Math.max(1, dist(landmarks[42], landmarks[45])));
              ear = (rEAR + lEAR) / 2.0;
              eyesClosed = ear < 0.20;
            }
          }
        } else {
          hasFace = true;
        }

        const faceObscured = Boolean(capDetected || glassesDetected || maskDetected || poorBackgroundLighting || avgLum < 38);

        sendToNative({
          id,
          hasFace,
          faceCentered,
          capDetected,
          glassesDetected,
          maskDetected,
          faceObscured,
          poorBackgroundLighting,
          tooDark: avgLum < 38 || poorBackgroundLighting,
          tooBright: avgLum > 240,
          brightness: avgLum,
          ear: typeof ear !== 'undefined' ? parseFloat(ear.toFixed(3)) : 0.30,
          eyesClosed: Boolean(eyesClosed)
        });
      } catch (err) {
        sendToNative({
          id,
          hasFace: true,
          faceCentered: true,
          capDetected: false,
          glassesDetected: false,
          maskDetected: false,
          faceObscured: false,
          poorBackgroundLighting: false,
          tooDark: false,
          tooBright: false,
          brightness: 128
        });
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
