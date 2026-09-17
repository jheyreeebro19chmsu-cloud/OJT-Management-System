import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, RequestFactory
from django.conf import settings
from .. import views


class VerifyFaceSecurityTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.api_key = getattr(settings, 'SECURITY_API_KEY', 'default-key')

    @staticmethod
    def _create_valid_test_image_b64():
        from PIL import Image, ImageDraw
        import io, base64
        img = Image.new('RGB', (200, 200), color=(180, 180, 180))
        draw = ImageDraw.Draw(img)
        draw.rectangle([40, 40, 160, 160], fill=(120, 120, 120))
        draw.ellipse([60, 60, 90, 90], fill=(50, 50, 50))
        draw.ellipse([110, 60, 140, 90], fill=(50, 50, 50))
        draw.line([(70, 130), (130, 130)], fill=(30, 30, 30), width=4)
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

    def _post(self, payload):
        req = self.factory.post(
            '/api/security/face/verify/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        req.META['HTTP_X_API_KEY'] = self.api_key
        req.META['HTTP_AUTHORIZATION'] = f'Bearer {self.api_key}'
        return req

    def test_constants_defined_at_module_level(self):
        """Confirm security constants exist at module level with expected values."""
        self.assertEqual(views.SECURE_MODEL_NAME, "VGG-Face")
        self.assertEqual(views.SECURE_DETECTOR_BACKEND, "retinaface")
        self.assertEqual(views.SECURE_DISTANCE_METRIC, "cosine")
        self.assertEqual(views.SECURE_DLIB_TOLERANCE, 0.6)

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    @patch('security.views.verify_server_liveness')
    @patch('face_recognition.face_distance')
    def test_client_tolerance_bypass_is_ignored(self, mock_face_distance, mock_liveness, mock_encode, mock_load):
        """Sending tolerance=999 in request must NOT override server tolerance (0.6)."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_liveness.return_value = {'verified': True, 'status': 'verified'}
        # Set distance to 0.75: would match under 999, but must FAIL under fixed 0.6
        mock_face_distance.return_value = [0.75]

        img_b64 = self._create_valid_test_image_b64()
        payload = {
            'registered_image': img_b64,
            'captured_image': img_b64,
            'blink_image': img_b64,
            'tolerance': 999.0  # Attacker attempts to bypass threshold
        }

        req = self._post(payload)
        resp = views.verify_face(req)
        self.assertEqual(resp.status_code, 200)

        data = json.loads(resp.content.decode())
        self.assertEqual(data.get('tolerance'), 0.6)
        self.assertFalse(data.get('matched'), "Distance 0.75 must reject under fixed 0.6 tolerance")

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    @patch('security.views.verify_server_liveness')
    def test_deepface_invoked_with_secure_parameters_and_enforce_detection(self, mock_liveness, mock_encode, mock_load):
        """DeepFace must be called with hardcoded retinaface, VGG-Face, cosine, and enforce_detection=True."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_liveness.return_value = {'verified': True, 'status': 'verified'}

        img_b64 = self._create_valid_test_image_b64()
        payload = {
            'registered_image': img_b64,
            'captured_image': img_b64,
            'blink_image': img_b64,
            # Attacker attempts to force a weak model and detector
            'model_name': 'WeakModel',
            'detector_backend': 'opencv',
            'distance_metric': 'euclidean'
        }

        mock_verify_pair = MagicMock(return_value={
            'success': True,
            'matched': True,
            'distance': 0.15,
            'threshold': 0.40,
            'model': 'VGG-Face',
            'detector_backend': 'retinaface'
        })

        with patch.dict('sys.modules', {'deepface_service': MagicMock(verify_face_pair=mock_verify_pair, is_deepface_available=lambda: True)}):
            req = self._post(payload)
            resp = views.verify_face(req)
            self.assertEqual(resp.status_code, 200)

            # Assert verify_face_pair was called with hardcoded parameters, ignoring client values
            mock_verify_pair.assert_called_once()
            _, kwargs = mock_verify_pair.call_args
            self.assertEqual(kwargs.get('model_name'), 'VGG-Face')
            self.assertEqual(kwargs.get('detector_backend'), 'retinaface')
            self.assertEqual(kwargs.get('distance_metric'), 'cosine')
            self.assertEqual(kwargs.get('enforce_detection'), True)

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    @patch('security.views.verify_server_liveness')
    def test_deepface_no_face_detected_returns_422_cleanly(self, mock_liveness, mock_encode, mock_load):
        """When DeepFace returns 'No face detected', return 422 directly instead of silently falling to dlib."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_liveness.return_value = {'verified': True, 'status': 'verified'}

        img_b64 = self._create_valid_test_image_b64()
        payload = {
            'registered_image': img_b64,
            'captured_image': img_b64,
            'blink_image': img_b64,
        }

        mock_verify_pair = MagicMock(return_value={
            'success': False,
            'matched': False,
            'message': 'No face detected in image. Please center your face in good lighting.',
            'error': 'Face could not be detected with retinaface'
        })

        with patch.dict('sys.modules', {'deepface_service': MagicMock(verify_face_pair=mock_verify_pair, is_deepface_available=lambda: True)}):
            req = self._post(payload)
            resp = views.verify_face(req)
            self.assertEqual(resp.status_code, 422)
            data = json.loads(resp.content.decode())
            self.assertIn('No face detected', data.get('message', ''))

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    @patch('security.views.verify_server_liveness')
    def test_multiple_faces_detected_returns_422(self, mock_liveness, mock_encode, mock_load):
        """Multiple faces in captured image strictly returns 422."""
        mock_load.return_value = MagicMock()
        # First call encodes registered image (1 face), second call encodes captured image (2 faces)
        mock_encode.side_effect = [[MagicMock()], [MagicMock(), MagicMock()]]
        mock_liveness.return_value = {'verified': True, 'status': 'verified'}

        img_b64 = self._create_valid_test_image_b64()
        payload = {
            'registered_image': img_b64,
            'captured_image': img_b64,
            'blink_image': img_b64,
        }

        # Force dlib fallback path
        with patch.dict('sys.modules', {'deepface_service': MagicMock(verify_face_pair=None, is_deepface_available=lambda: False)}):
            req = self._post(payload)
            resp = views.verify_face(req)
            self.assertEqual(resp.status_code, 422)
            data = json.loads(resp.content.decode())
            self.assertIn('Multiple faces detected', data.get('message', ''))
            self.assertEqual(data.get('faces_detected'), 2)

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_verify_face_rejects_low_resolution_image(self, mock_encode, mock_load):
        """Low-resolution images (<160px) must be rejected with HTTP 422 and status 'low_resolution'."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        png_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
        payload = {
            'registered_image': self._create_valid_test_image_b64(),
            'captured_image': f'data:image/png;base64,{png_1x1}',
        }
        req = self._post(payload)
        resp = views.verify_face(req)
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertEqual(data.get('status'), 'low_resolution')
        self.assertFalse(data.get('success'))

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_verify_face_rejects_dark_image(self, mock_encode, mock_load):
        """Dark images (<30 avg brightness) must be rejected with HTTP 422 and status 'dark'."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        from PIL import Image
        import io, base64
        # Completely dark image (all black 200x200)
        img = Image.new('RGB', (200, 200), color=(5, 5, 5))
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        dark_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

        payload = {
            'registered_image': self._create_valid_test_image_b64(),
            'captured_image': dark_b64,
        }
        req = self._post(payload)
        resp = views.verify_face(req)
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertEqual(data.get('status'), 'dark')
        self.assertFalse(data.get('success'))

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_verify_face_rejects_low_contrast_image(self, mock_encode, mock_load):
        """Low-contrast / flat images must be rejected with HTTP 422 and status 'low_contrast'."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        from PIL import Image
        import io, base64
        # Completely uniform gray image (std dev < 16)
        img = Image.new('RGB', (200, 200), color=(128, 128, 128))
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        flat_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

        payload = {
            'registered_image': self._create_valid_test_image_b64(),
            'captured_image': flat_b64,
        }
        req = self._post(payload)
        resp = views.verify_face(req)
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertEqual(data.get('status'), 'low_contrast')
        self.assertFalse(data.get('success'))

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_verify_face_rejects_missing_liveness_unconditionally(self, mock_encode, mock_load):
        """Missing blink_image must return HTTP 422 unconditionally (no opt-in flag required)."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        img_b64 = self._create_valid_test_image_b64()

        payload = {
            'registered_image': img_b64,
            'captured_image': img_b64,
            'require_liveness': True,
        }
        req = self._post(payload)
        resp = views.verify_face(req)
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertEqual(data.get('status'), 'liveness_required')
        self.assertIn('Server-side liveness proof', data.get('message', ''))

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    @patch('security.views.verify_server_liveness')
    def test_verify_face_rejects_invalid_liveness_proof(self, mock_liveness, mock_encode, mock_load):
        """When blink proof does not show eye closure, server rejects with HTTP 422."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_liveness.return_value = {
            'verified': False,
            'status': 'no_blink',
            'message': 'Liveness check failed: No eye closure detected.'
        }
        img_b64 = self._create_valid_test_image_b64()

        payload = {
            'registered_image': img_b64,
            'captured_image': img_b64,
            'blink_image': img_b64,  # Static photo passed as fake blink proof
        }
        req = self._post(payload)
        resp = views.verify_face(req)
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertEqual(data.get('status'), 'liveness_failed')
        self.assertIn('No eye closure detected', data.get('message', ''))

    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    @patch('security.views.verify_server_liveness')
    @patch('face_recognition.face_distance')
    def test_verify_face_accepts_valid_server_liveness_proof(self, mock_face_distance, mock_liveness, mock_encode, mock_load):
        """When genuine blink proof is provided and verified by server, response has liveness_verified=True."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_face_distance.return_value = [0.25]
        mock_liveness.return_value = {
            'verified': True,
            'status': 'verified',
            'open_ear': 0.32,
            'blink_ear': 0.14,
            'message': 'Server liveness verified.'
        }
        img_b64 = self._create_valid_test_image_b64()

        payload = {
            'registered_image': img_b64,
            'captured_image': img_b64,
            'blink_image': img_b64,
        }
        req = self._post(payload)
        resp = views.verify_face(req)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content.decode())
        self.assertTrue(data.get('matched'))
        self.assertTrue(data.get('liveness_verified'))


