"""
Unit and Integration Tests for InsightFace Biometric Facial Recognition Engine.
Tests ArcFace buffalo_s 512-d embedding extraction, cosine similarity matching (threshold: 0.45),
and Django view endpoints (/security/face/verify/ and /security/face/register/).
"""

import os
import sys
import json
import base64
import numpy as np
from io import BytesIO
from PIL import Image, ImageDraw
from unittest.mock import patch

from django.test import TestCase, RequestFactory, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from security.models import FaceRegistration
from security import views
from insightface_service import (
    is_insightface_available,
    get_face_analysis_app,
    get_face_embedding,
    verify_attendance,
    compare_faces,
)

User = get_user_model()


class InsightFaceBiometricTests(TestCase):
    """Test suite for InsightFace backend integration."""

    @classmethod
    def setUpTestData(cls):
        cls.factory = RequestFactory()
        cls.user = User.objects.create_user(
            username="trainee_insightface",
            email="trainee_if@test.com",
            password="Password123!",
        )

        # Locate a real face image from the backend media if present, or create synthetic
        cls.real_face_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "media", "face_registrations", "emp-1776094014232_bc8c41903f34428dad73643aecfbaa28.jpeg"
        )
        cls.has_real_face = os.path.exists(cls.real_face_path)

    def _create_blank_image_b64(self, width=200, height=200, color=(128, 128, 128)):
        img = Image.new("RGB", (width, height), color)
        buf = BytesIO()
        img.save(buf, format="JPEG")
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    def test_insightface_is_available_and_initialized(self):
        """InsightFace and buffalo_s app must be available in environment."""
        self.assertTrue(is_insightface_available(), "InsightFace should be available in backend environment")
        app = get_face_analysis_app()
        self.assertIsNotNone(app, "FaceAnalysis ('buffalo_s') singleton must initialize successfully")

    def test_extract_512d_normalized_embedding_from_real_face(self):
        """InsightFace extracts 512-d unit-normalized float32 vectors from real face."""
        if not self.has_real_face:
            self.skipTest("No real face photo present in media directory")

        emb = get_face_embedding(self.real_face_path)
        self.assertIsNotNone(emb, "Embedding extraction failed on real face photo")
        self.assertEqual(len(emb), 512, "ArcFace embedding must be exactly 512 dimensions")
        self.assertEqual(emb.dtype, np.float32, "Embedding dtype must be float32")

        # Verify unit normalization: ||v|| == 1.0
        norm = np.linalg.norm(emb)
        self.assertAlmostEqual(norm, 1.0, places=4, msg="Embedding vector must be unit-normalized")

    def test_verify_attendance_identical_face_matches(self):
        """Attendance verification of the same face achieves similarity near 1.0 (>= 0.45)."""
        if not self.has_real_face:
            self.skipTest("No real face photo present in media directory")

        result = verify_attendance(self.real_face_path, self.real_face_path, match_threshold=0.45)
        self.assertTrue(result.get("success"))
        self.assertTrue(result.get("matched"))
        self.assertTrue(result.get("match"))
        self.assertGreaterEqual(result.get("similarity"), 0.95)
        self.assertEqual(result.get("message"), "Face verified successfully")
        self.assertIn("InsightFace-ArcFace", result.get("model", ""))

    def test_verify_attendance_with_precomputed_512d_vector(self):
        """Attendance verification accepts precomputed 512-d vectors without re-extracting profile photo."""
        if not self.has_real_face:
            self.skipTest("No real face photo present in media directory")

        emb = get_face_embedding(self.real_face_path)
        self.assertIsNotNone(emb)

        # Pass 512-d list as registered_profile_img_or_emb
        emb_list = [float(x) for x in emb]
        result = verify_attendance(self.real_face_path, emb_list, match_threshold=0.45)

        self.assertTrue(result.get("success"))
        self.assertTrue(result.get("matched"))
        self.assertGreaterEqual(result.get("similarity"), 0.95)
        self.assertEqual(result.get("message"), "Face verified successfully")

    def test_verify_attendance_blank_image_returns_clean_error(self):
        """Images without detected faces return match=False and descriptive message."""
        blank_b64 = self._create_blank_image_b64()
        result = verify_attendance(blank_b64, blank_b64, match_threshold=0.45)
        self.assertFalse(result.get("success"))
        self.assertFalse(result.get("matched"))
        self.assertFalse(result.get("match"))
        self.assertIn("could not be detected", result.get("message", "").lower())

    def test_compare_faces_drop_in_compatibility(self):
        """compare_faces wrapper returns proper structure with match_threshold=0.45."""
        if not self.has_real_face:
            self.skipTest("No real face photo present in media directory")

        res = compare_faces(self.real_face_path, self.real_face_path, match_threshold=0.45)
        self.assertTrue(res.get("success"))
        self.assertTrue(res.get("matched"))
        self.assertGreaterEqual(res.get("similarity"), 0.45)

    @patch('security.views.validate_image_brightness')
    def test_register_face_precomputes_and_saves_512d_encoding(self, mock_bright):
        """register_face view precomputes and stores 512-d InsightFace embedding in FaceRegistration."""
        mock_bright.return_value = {'valid': True, 'brightness': 120.0, 'status': 'valid', 'recommendations': []}
        if not self.has_real_face:
            self.skipTest("No real face photo present in media directory")

        with open(self.real_face_path, "rb") as f:
            file_data = f.read()

        b64_img = "data:image/jpeg;base64," + base64.b64encode(file_data).decode("utf-8")
        from django.conf import settings
        api_key = getattr(settings, 'SECURITY_API_KEY', '') or 'default-key'
        req = self.factory.post(
            "/security/face/register/",
            data=json.dumps({"employee_id": "test_emp_insightface_01", "image": b64_img}),
            content_type="application/json",
        )
        req.META['HTTP_X_API_KEY'] = api_key
        req.META['HTTP_AUTHORIZATION'] = f'Bearer {api_key}'

        resp = views.register_face(req)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content.decode())
        self.assertTrue(data.get("success"))

        # Verify database record has 512 floats in face_encoding
        reg = FaceRegistration.objects.get(employee_id="test_emp_insightface_01")
        self.assertIsNotNone(reg.face_encoding)
        self.assertEqual(len(reg.face_encoding), 512)
        # Verify valid floats and non-zero norm
        arr = np.array(reg.face_encoding)
        self.assertAlmostEqual(np.linalg.norm(arr), 1.0, places=4)
