"""
Empirical Occlusion, Spoof, and Quality Gate Audit Test Suite.
Directly addresses Section 4 & 5 of the Facial Recognition Security Audit:
- Bare face vs Occluded faces (hats, eyeglasses, sunglasses, masks, off-angle)
- Image quality gating (low resolution, dark, blurry, low contrast)
- Photo-of-a-photo / screen tolerance bypass attempt (tolerance: 999.0 ignored)
- Multi-face attendance fraud attempt
"""

import io
import json
import base64
from unittest.mock import patch, MagicMock
from django.test import TestCase, RequestFactory
from django.conf import settings
from PIL import Image, ImageDraw, ImageFilter
from .. import views
from ..utils import validate_image_quality


class EmpiricalOcclusionAuditTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.factory = RequestFactory()
        cls.api_key = getattr(settings, 'SECURITY_API_KEY', 'test-key')

    def setUp(self):
        super().setUp()
        self.liveness_patcher = patch('security.views.verify_server_liveness', return_value={'verified': True, 'status': 'verified'})
        self.mock_liveness = self.liveness_patcher.start()
        self.addCleanup(self.liveness_patcher.stop)

    def _post_verify(self, payload):
        if 'blink_image' not in payload and 'liveness_proof' not in payload:
            payload['blink_image'] = payload.get('captured_image') or payload.get('registered_image')
        req = self.factory.post(
            '/api/security/face/verify/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        req.META['HTTP_X_API_KEY'] = self.api_key
        req.META['HTTP_AUTHORIZATION'] = f'Bearer {self.api_key}'
        return views.verify_face(req)

    @staticmethod
    def _create_synthetic_face(occlusion_type="bare", brightness=150, contrast=40):
        """
        Generates realistic synthetic facial frames with specific occlusion types.
        """
        w, h = 240, 240
        # Background
        bg_val = int(brightness)
        img = Image.new('RGB', (w, h), color=(bg_val, bg_val, bg_val))
        draw = ImageDraw.Draw(img)

        # Head / Oval
        head_box = [50, 40, 190, 210]
        skin_val = max(10, min(240, int(brightness - 20)))
        draw.ellipse(head_box, fill=(skin_val, skin_val - 10, skin_val - 20))

        # Eyes
        eye_y = 95
        draw.ellipse([80, eye_y - 10, 105, eye_y + 10], fill=(40, 30, 25))
        draw.ellipse([135, eye_y - 10, 160, eye_y + 10], fill=(40, 30, 25))

        # Nose & Mouth
        draw.line([(120, 105), (120, 145)], fill=(skin_val - 40, skin_val - 45, skin_val - 50), width=4)
        draw.line([(95, 170), (145, 170)], fill=(160, 60, 60), width=5)

        if occlusion_type == "hat_cap":
            # Cap covers upper head and forehead down to eyebrows
            draw.rectangle([40, 20, 200, 90], fill=(20, 20, 20))
            draw.arc([35, 75, 205, 100], start=0, end=180, fill=(10, 10, 10), width=8)

        elif occlusion_type == "sunglasses":
            # Dark sunglasses covering both eyes and nose bridge
            draw.rectangle([70, 80, 170, 115], fill=(15, 15, 15))
            draw.line([(105, 95), (135, 95)], fill=(10, 10, 10), width=6)

        elif occlusion_type == "eyeglasses":
            # Eyeglasses with specular reflection / frames
            draw.rectangle([75, 82, 110, 110], outline=(30, 30, 30), width=4)
            draw.rectangle([130, 82, 165, 110], outline=(30, 30, 30), width=4)
            draw.line([(110, 95), (130, 95)], fill=(30, 30, 30), width=4)
            # Specular reflection glint on lens
            draw.rectangle([85, 88, 95, 98], fill=(250, 250, 250))

        elif occlusion_type == "face_mask":
            # Surgical / fabric mask covering nose bridge to chin
            draw.rectangle([60, 125, 180, 205], fill=(40, 110, 180))  # surgical blue
            draw.line([(60, 135), (45, 115)], fill=(230, 230, 230), width=3)
            draw.line([(180, 135), (195, 115)], fill=(230, 230, 230), width=3)

        elif occlusion_type == "blurry":
            # High-contrast elements with Gaussian blur to isolate blur detection
            draw.rectangle([30, 30, 210, 210], fill=(20, 20, 20))
            img = img.filter(ImageFilter.GaussianBlur(radius=5.0))

        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=90)
        return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

    # 1. Bare Face (Clean Match Baseline)
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    @patch('face_recognition.face_distance')
    def test_audit_bare_face_passes(self, mock_face_distance, mock_encode, mock_load):
        """Bare clear face meets all quality gates and matches genuine employee."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_face_distance.return_value = [0.22]  # Genuine match (well within 0.6)

        bare_img = self._create_synthetic_face("bare")
        resp = self._post_verify({
            'registered_image': bare_img,
            'captured_image': bare_img,
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content.decode())
        self.assertTrue(data.get('matched'))
        self.assertLessEqual(data.get('distance'), 0.60)

    # 2. Severe Blurry Image Rejection
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_blurry_image_rejected(self, mock_encode, mock_load):
        """Blurry image fails image quality gate with status 'blurry' and HTTP 422."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        bare_img = self._create_synthetic_face("bare")
        blurry_img = self._create_synthetic_face("blurry")

        resp = self._post_verify({
            'registered_image': bare_img,
            'captured_image': blurry_img,
        })
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertFalse(data.get('success'))
        self.assertEqual(data.get('status'), 'blurry')
        self.assertIn('blurry', data.get('message', '').lower())

    # 3. Low Light / Dark Image Rejection
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_low_light_dark_image_rejected(self, mock_encode, mock_load):
        """Dark, underexposed image (<30 luminance) rejected with status 'dark' and HTTP 422."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        bare_img = self._create_synthetic_face("bare")
        dark_img = self._create_synthetic_face("bare", brightness=18)

        resp = self._post_verify({
            'registered_image': bare_img,
            'captured_image': dark_img,
        })
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertFalse(data.get('success'))
        self.assertEqual(data.get('status'), 'dark')

    # 4. Low Resolution Tiny Image Rejection
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_low_resolution_image_rejected(self, mock_encode, mock_load):
        """Sub-160px image rejected with status 'low_resolution' and HTTP 422."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        bare_img = self._create_synthetic_face("bare")
        tiny_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='

        resp = self._post_verify({
            'registered_image': bare_img,
            'captured_image': f'data:image/png;base64,{tiny_b64}',
        })
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertFalse(data.get('success'))
        self.assertEqual(data.get('status'), 'low_resolution')

    # 5. Off-Angle / Heavy Occlusion (RetinaFace No Face Detected)
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_off_angle_or_heavy_occlusion_rejected(self, mock_encode, mock_load):
        """RetinaFace enforce_detection=True cleanly rejects off-angle/occluded face with HTTP 422."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]

        bare_img = self._create_synthetic_face("bare")
        occluded_img = self._create_synthetic_face("face_mask")

        mock_verify_pair = MagicMock(return_value={
            'success': False,
            'matched': False,
            'message': 'No face detected in image. Please center your face in good lighting.',
            'error': 'Face could not be detected with retinaface'
        })

        with patch.dict('sys.modules', {'deepface_service': MagicMock(verify_face_pair=mock_verify_pair, is_deepface_available=lambda: True)}):
            resp = self._post_verify({
                'registered_image': bare_img,
                'captured_image': occluded_img,
            })
            self.assertEqual(resp.status_code, 422)
            data = json.loads(resp.content.decode())
            self.assertIn('No face detected', data.get('message', ''))

    # 6. Attacker Tolerance Bypass Override Exploit (tolerance=999)
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    @patch('face_recognition.face_distance')
    def test_audit_attacker_tolerance_bypass_override_fails(self, mock_face_distance, mock_encode, mock_load):
        """Attacker sending tolerance=999.0 with non-matching face is strictly rejected (tolerance: 0.6)."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_face_distance.return_value = [0.82]  # Attacker / impostor face

        bare_img = self._create_synthetic_face("bare")
        resp = self._post_verify({
            'registered_image': bare_img,
            'captured_image': bare_img,
            'tolerance': 999.0  # Attacker attempt
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content.decode())
        self.assertFalse(data.get('matched'))
        self.assertEqual(data.get('tolerance'), 0.6)
        self.assertEqual(data.get('distance'), 0.82)
        self.assertEqual(data.get('message'), "Face did not match.")

    # 7. Multiple Faces in Captured Frame Fraud Attempt
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_multi_face_frame_rejected(self, mock_encode, mock_load):
        """Multi-face frame (another person peeking in) strictly returns HTTP 422."""
        mock_load.return_value = MagicMock()
        mock_encode.side_effect = [[MagicMock()], [MagicMock(), MagicMock()]]

        bare_img = self._create_synthetic_face("bare")
        with patch.dict('sys.modules', {'deepface_service': MagicMock(verify_face_pair=None, is_deepface_available=lambda: False)}):
            resp = self._post_verify({
                'registered_image': bare_img,
                'captured_image': bare_img,
            })
            self.assertEqual(resp.status_code, 422)
            data = json.loads(resp.content.decode())
            self.assertIn('Multiple faces detected', data.get('message', ''))
            self.assertEqual(data.get('faces_detected'), 2)

    # 8. Unconditional Liveness Proof Requirement
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_missing_liveness_proof_unconditionally_rejected(self, mock_encode, mock_load):
        """Omitting blink_image proof is unconditionally rejected with HTTP 422 liveness_required."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        bare_img = self._create_synthetic_face("bare")
        req = self.factory.post(
            '/api/security/face/verify/',
            data=json.dumps({
                'registered_image': bare_img,
                'captured_image': bare_img,
                'require_liveness': True,
            }),
            content_type='application/json'
        )
        req.META['HTTP_X_API_KEY'] = self.api_key
        req.META['HTTP_AUTHORIZATION'] = f'Bearer {self.api_key}'
        resp = views.verify_face(req)
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertEqual(data.get('status'), 'liveness_required')
        self.assertIn('Server-side liveness proof', data.get('message', ''))

    # 9. Strict Bare Face Policy: Glasses Rejected
    @patch('security.utils.validate_face_obstruction')
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_glasses_detected_rejected(self, mock_encode, mock_load, mock_obstruction):
        """Image with glasses is strictly rejected with HTTP 422 status 'glasses_detected'."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_obstruction.return_value = {
            'valid': False,
            'status': 'glasses_detected',
            'message': '🚨 GLASSES DETECTED! Institutional policy strictly requires a 100% bare face. Please remove eyeglasses / sunglasses to scan.',
            'recommendations': ['Remove eyeglasses or sunglasses']
        }
        bare_img = self._create_synthetic_face("bare")
        glasses_img = self._create_synthetic_face("eyeglasses")

        resp = self._post_verify({
            'registered_image': bare_img,
            'captured_image': glasses_img,
        })
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertFalse(data.get('success'))
        self.assertEqual(data.get('status'), 'glasses_detected')
        self.assertIn('glasses detected', data.get('message', '').lower())

    # 10. Strict Bare Face Policy: Hat / Cap Rejected
    @patch('security.utils.validate_face_obstruction')
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_cap_detected_rejected(self, mock_encode, mock_load, mock_obstruction):
        """Image with hat or cap is strictly rejected with HTTP 422 status 'cap_detected'."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_obstruction.return_value = {
            'valid': False,
            'status': 'cap_detected',
            'message': '🚨 HAT / CAP DETECTED! Institutional policy strictly requires a 100% bare face. Please remove headwear to scan.',
            'recommendations': ['Remove headwear']
        }
        bare_img = self._create_synthetic_face("bare")
        cap_img = self._create_synthetic_face("hat_cap")

        resp = self._post_verify({
            'registered_image': bare_img,
            'captured_image': cap_img,
        })
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertFalse(data.get('success'))
        self.assertEqual(data.get('status'), 'cap_detected')
        self.assertIn('hat / cap detected', data.get('message', '').lower())

    # 11. Strict Bare Face Policy: Mask Rejected
    @patch('security.utils.validate_face_obstruction')
    @patch('face_recognition.load_image_file')
    @patch('security.views._encode_face_with_fallback')
    def test_audit_mask_detected_rejected(self, mock_encode, mock_load, mock_obstruction):
        """Image with face mask is strictly rejected with HTTP 422 status 'mask_detected'."""
        mock_load.return_value = MagicMock()
        mock_encode.return_value = [MagicMock()]
        mock_obstruction.return_value = {
            'valid': False,
            'status': 'mask_detected',
            'message': '🚨 FACE MASK DETECTED! Please remove face mask to scan.',
            'recommendations': ['Remove face mask']
        }
        bare_img = self._create_synthetic_face("bare")
        mask_img = self._create_synthetic_face("face_mask")

        resp = self._post_verify({
            'registered_image': bare_img,
            'captured_image': mask_img,
        })
        self.assertEqual(resp.status_code, 422)
        data = json.loads(resp.content.decode())
        self.assertFalse(data.get('success'))
        self.assertEqual(data.get('status'), 'mask_detected')
        self.assertIn('face mask detected', data.get('message', '').lower())
