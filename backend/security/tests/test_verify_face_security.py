import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, RequestFactory
from django.conf import settings
from .. import views


class VerifyFaceSecurityTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.api_key = getattr(settings, 'SECURITY_API_KEY', 'default-key')

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
    @patch('face_recognition.face_distance')
    def test_client_tolerance_bypass_is_ignored(self, mock_face_distance, mock_encode, mock_load):
        """Sending tolerance=999 in request must NOT override server tolerance (0.6)."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        # Set distance to 0.75: would match under 999, but must FAIL under fixed 0.6
        mock_face_distance.return_value = [0.75]

        png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
        payload = {
            'registered_image': f'data:image/png;base64,{png_b64}',
            'captured_image': f'data:image/png;base64,{png_b64}',
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
    def test_deepface_invoked_with_secure_parameters_and_enforce_detection(self, mock_encode, mock_load):
        """DeepFace must be called with hardcoded retinaface, VGG-Face, cosine, and enforce_detection=True."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]

        png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
        payload = {
            'registered_image': f'data:image/png;base64,{png_b64}',
            'captured_image': f'data:image/png;base64,{png_b64}',
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
    def test_deepface_no_face_detected_returns_422_cleanly(self, mock_encode, mock_load):
        """When DeepFace returns 'No face detected', return 422 directly instead of silently falling to dlib."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]

        png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
        payload = {
            'registered_image': f'data:image/png;base64,{png_b64}',
            'captured_image': f'data:image/png;base64,{png_b64}',
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
    def test_multiple_faces_detected_returns_422(self, mock_encode, mock_load):
        """Multiple faces in captured image strictly returns 422."""
        mock_load.return_value = MagicMock()
        # First call encodes registered image (1 face), second call encodes captured image (2 faces)
        mock_encode.side_effect = [[MagicMock()], [MagicMock(), MagicMock()]]

        png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
        payload = {
            'registered_image': f'data:image/png;base64,{png_b64}',
            'captured_image': f'data:image/png;base64,{png_b64}',
        }

        # Force dlib fallback path
        with patch.dict('sys.modules', {'deepface_service': MagicMock(verify_face_pair=None, is_deepface_available=lambda: False)}):
            req = self._post(payload)
            resp = views.verify_face(req)
            self.assertEqual(resp.status_code, 422)
            data = json.loads(resp.content.decode())
            self.assertIn('Multiple faces detected', data.get('message', ''))
            self.assertEqual(data.get('faces_detected'), 2)
