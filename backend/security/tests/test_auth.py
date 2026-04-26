from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone
from security.models import OTPVerification, UserRole
from django.contrib.auth.models import User

class AuthTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.email = 'test.student@example.com'
        self.full_name = 'Test Student'

    def test_request_and_verify_otp(self):
        # Request OTP
        resp = self.client.post('/api/auth/request-otp/', data={'email': self.email, 'full_name': self.full_name}, content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))

        # Check OTP record exists
        otp = OTPVerification.objects.filter(email=self.email).order_by('-created_at').first()
        self.assertIsNotNone(otp)
        self.assertFalse(otp.is_verified)

        # Verify OTP with correct code
        resp_verify = self.client.post('/api/auth/verify-otp/', data={'email': self.email, 'otp_code': otp.otp_code}, content_type='application/json')
        self.assertEqual(resp_verify.status_code, 200)
        data2 = resp_verify.json()
        self.assertTrue(data2.get('success'))

        otp.refresh_from_db()
        self.assertTrue(otp.is_verified)

    def test_register_student_after_otp(self):
        # Request OTP
        resp = self.client.post('/api/auth/request-otp/', data={'email': self.email, 'full_name': self.full_name}, content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        otp = OTPVerification.objects.filter(email=self.email).order_by('-created_at').first()
        # Verify OTP
        resp_verify = self.client.post('/api/auth/verify-otp/', data={'email': self.email, 'otp_code': otp.otp_code}, content_type='application/json')
        self.assertEqual(resp_verify.status_code, 200)

        # Register student
        payload = {
            'email': self.email,
            'password': 'securepass123',
            'first_name': 'Test',
            'last_name': 'Student',
            'middle_initial': 'A',
            'age': 20,
            'address': '123 Test St'
        }
        resp_reg = self.client.post('/api/auth/register-student/', data=payload, content_type='application/json')
        self.assertEqual(resp_reg.status_code, 201)
        data = resp_reg.json()
        self.assertTrue(data.get('success'))
        self.assertIn('tokens', data)
        self.assertIn('user', data)

        # User exists in DB
        user = User.objects.filter(email=self.email).first()
        self.assertIsNotNone(user)
        role = UserRole.objects.filter(user=user).first()
        self.assertEqual(role.role, 'student')
*** End Patch