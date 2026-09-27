"""
=============================================================================
White-Box Testing of the Alpha Testing of Authentication Error Handling Case
=============================================================================
Tested Code Segments (error paths and exception handling):
  - auth_views.login()                  -> JSON parse error, method not allowed,
                                           invalid credentials, disabled account,
                                           unhandled database/server exceptions
  - auth_views.request_otp()            -> Missing email, duplicate user,
                                           malformed JSON, email send failure
  - auth_views.verify_otp()             -> Missing fields, expired/invalid OTP,
                                           JSON decode error
  - auth_views.register_student()       -> Missing required fields, unverified email,
                                           duplicate email, short password,
                                           JSON parse error, DB transaction error
  - auth_views._error_response()        -> Debug/traceback payload structure & status

Run with:
    python manage.py test security.tests.test_auth_error_handling_whitebox -v 2
=============================================================================
"""

import json
from unittest.mock import patch
from datetime import timedelta

from django.test import TestCase, Client, RequestFactory
from django.contrib.auth.models import User
from django.utils import timezone

from security.models import UserRole, Student, OTPVerification
from security import auth_views


class AuthErrorHandlingWhiteBoxTests(TestCase):
    """
    White-Box Tests covering negative paths, error handling, edge cases,
    and exception handlers across the authentication endpoints.
    """

    LOGIN_URL = "/api/auth/login/"
    REQUEST_OTP_URL = "/api/auth/request-otp/"
    VERIFY_OTP_URL = "/api/auth/verify-otp/"
    REGISTER_STUDENT_URL = "/api/auth/register-student/"

    def setUp(self):
        self.client = Client()
        self.factory = RequestFactory()

        # Pre-existing test user
        self.active_user = User.objects.create_user(
            username="active_user@test.com",
            email="active_user@test.com",
            password="Password123!"
        )
        UserRole.objects.create(user=self.active_user, role="student", is_verified=True)

        # Deactivated user
        self.disabled_user = User.objects.create_user(
            username="disabled_user@test.com",
            email="disabled_user@test.com",
            password="Password123!",
            is_active=False
        )
        UserRole.objects.create(user=self.disabled_user, role="student", is_verified=True)

    # -------------------------------------------------------------------------
    # TC-AuthErr001: Malformed JSON payload on login
    # -------------------------------------------------------------------------
    def test_TC_AuthErr001_login_malformed_json(self):
        """
        TC-AuthErr001: Login with malformed JSON body
        Tested Code Segment: auth_views.login() -> except Exception as e (json.JSONDecodeError)
        Expected: Status 500 with error details
        """
        request = self.factory.post(
            self.LOGIN_URL,
            data=b"{malformed_json: true,",
            content_type="application/json"
        )
        response = auth_views.login(request)
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.content.decode("utf-8"))
        self.assertIn("error", data)

    # -------------------------------------------------------------------------
    # TC-AuthErr002: Unsupported HTTP method on login (GET instead of POST)
    # -------------------------------------------------------------------------
    def test_TC_AuthErr002_login_unsupported_method_get(self):
        """
        TC-AuthErr002: Login with HTTP GET method
        Tested Code Segment: @require_http_methods(["POST"])
        Expected: Status 405 Method Not Allowed
        """
        response = self.client.get(self.LOGIN_URL)
        self.assertEqual(response.status_code, 405)

    # -------------------------------------------------------------------------
    # TC-AuthErr003: Non-existent user email
    # -------------------------------------------------------------------------
    def test_TC_AuthErr003_login_user_not_found(self):
        """
        TC-AuthErr003: Login with non-existent user email
        Tested Code Segment: auth_views.login() -> if not user
        Expected: Status 401 "Invalid credentials"
        """
        payload = {"email": "nonexistent_404@test.com", "password": "AnyPassword"}
        response = self.client.post(self.LOGIN_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json().get("error"), "Invalid credentials")

    # -------------------------------------------------------------------------
    # TC-AuthErr004: Incorrect password for existing user
    # -------------------------------------------------------------------------
    def test_TC_AuthErr004_login_incorrect_password(self):
        """
        TC-AuthErr004: Login with correct email but invalid password
        Tested Code Segment: auth_views.login() -> if not user.check_password()
        Expected: Status 401 "Invalid credentials"
        """
        payload = {"email": "active_user@test.com", "password": "WrongPassword999!"}
        response = self.client.post(self.LOGIN_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json().get("error"), "Invalid credentials")

    # -------------------------------------------------------------------------
    # TC-AuthErr005: Deactivated account access rejection
    # -------------------------------------------------------------------------
    def test_TC_AuthErr005_login_deactivated_account(self):
        """
        TC-AuthErr005: Login with correct credentials for inactive user
        Tested Code Segment: auth_views.login() -> if not user.is_active
        Expected: Status 401 "Account disabled"
        """
        payload = {"email": "disabled_user@test.com", "password": "Password123!"}
        response = self.client.post(self.LOGIN_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json().get("error"), "Account disabled")

    # -------------------------------------------------------------------------
    # TC-AuthErr006: Unexpected runtime exception during login
    # -------------------------------------------------------------------------
    def test_TC_AuthErr006_login_unexpected_exception(self):
        """
        TC-AuthErr006: Unexpected database/server error during login
        Tested Code Segment: auth_views.login() -> except Exception as e
        Expected: Status 500 with exception message
        """
        with patch("django.contrib.auth.models.User.objects.filter", side_effect=RuntimeError("Database failure simulated")):
            request = self.factory.post(
                self.LOGIN_URL,
                data=json.dumps({"email": "active_user@test.com", "password": "Password123!"}).encode("utf-8"),
                content_type="application/json"
            )
            response = auth_views.login(request)
            self.assertEqual(response.status_code, 500)
            data = json.loads(response.content.decode("utf-8"))
            self.assertIn("error", data)
            self.assertIn("Database failure simulated", data["error"])

    # -------------------------------------------------------------------------
    # TC-AuthErr007: Request OTP with missing/blank email
    # -------------------------------------------------------------------------
    def test_TC_AuthErr007_request_otp_missing_email(self):
        """
        TC-AuthErr007: Request OTP without providing email
        Tested Code Segment: auth_views.request_otp() -> if not email
        Expected: Status 400 "Email is required"
        """
        payload = {"email": ""}
        response = self.client.post(self.REQUEST_OTP_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "Email is required")

    # -------------------------------------------------------------------------
    # TC-AuthErr008: Request OTP for already registered email
    # -------------------------------------------------------------------------
    def test_TC_AuthErr008_request_otp_already_registered(self):
        """
        TC-AuthErr008: Request OTP for email already tied to an existing user
        Tested Code Segment: auth_views.request_otp() -> if User.objects.filter(email__iexact=email).exists()
        Expected: Status 400 "Email already registered"
        """
        payload = {"email": "active_user@test.com"}
        response = self.client.post(self.REQUEST_OTP_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "Email already registered")

    # -------------------------------------------------------------------------
    # TC-AuthErr009: Email service failure during OTP dispatch
    # -------------------------------------------------------------------------
    def test_TC_AuthErr009_request_otp_email_send_failure(self):
        """
        TC-AuthErr009: Mail service returns failure when sending OTP
        Tested Code Segment: auth_views.request_otp() -> if send_verification_email() is False
        Expected: Status 500 "Failed to send OTP email"
        """
        with patch("security.auth_views.send_verification_email", return_value=False):
            request = self.factory.post(
                self.REQUEST_OTP_URL,
                data=json.dumps({"email": "brand_new_unregistered@test.com"}).encode("utf-8"),
                content_type="application/json"
            )
            response = auth_views.request_otp(request)
            self.assertEqual(response.status_code, 500)
            data = json.loads(response.content.decode("utf-8"))
            self.assertEqual(data.get("error"), "Failed to send OTP email")

    # -------------------------------------------------------------------------
    # TC-AuthErr010: Verify OTP with missing fields
    # -------------------------------------------------------------------------
    def test_TC_AuthErr010_verify_otp_missing_fields(self):
        """
        TC-AuthErr010: Verify OTP without code or email
        Tested Code Segment: auth_views.verify_otp() -> if not email or not otp_code
        Expected: Status 400 "Email and OTP code required"
        """
        payload = {"email": "some_email@test.com", "otp_code": ""}
        response = self.client.post(self.VERIFY_OTP_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "Email and OTP code required")

    # -------------------------------------------------------------------------
    # TC-AuthErr011: Verify OTP with non-existent or wrong code
    # -------------------------------------------------------------------------
    def test_TC_AuthErr011_verify_otp_invalid_code(self):
        """
        TC-AuthErr011: Verify OTP with mismatched code
        Tested Code Segment: auth_views.verify_otp() -> if otp.otp_code != otp_code
        Expected: Status 400 "Invalid or expired OTP"
        """
        OTPVerification.objects.create(
            email="otp_test@test.com",
            otp_code="123456",
            expires_at=timezone.now() + timedelta(minutes=10),
            is_verified=False
        )
        payload = {"email": "otp_test@test.com", "otp_code": "999999"}
        response = self.client.post(self.VERIFY_OTP_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "Invalid or expired OTP")

    # -------------------------------------------------------------------------
    # TC-AuthErr012: Verify expired OTP
    # -------------------------------------------------------------------------
    def test_TC_AuthErr012_verify_otp_expired(self):
        """
        TC-AuthErr012: Verify OTP created more than 10 minutes ago
        Tested Code Segment: auth_views.verify_otp() -> if not otp.is_valid()
        Expected: Status 400 "Invalid or expired OTP"
        """
        expired_otp = OTPVerification.objects.create(
            email="expired_otp@test.com",
            otp_code="555555",
            expires_at=timezone.now() - timedelta(minutes=5),
            is_verified=False
        )

        payload = {"email": "expired_otp@test.com", "otp_code": "555555"}
        response = self.client.post(self.VERIFY_OTP_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "Invalid or expired OTP")

    # -------------------------------------------------------------------------
    # TC-AuthErr013: Register student with missing required fields
    # -------------------------------------------------------------------------
    def test_TC_AuthErr013_register_student_missing_fields(self):
        """
        TC-AuthErr013: Student registration missing password or name
        Tested Code Segment: auth_views.register_student() -> if not all([email, password, first_name, last_name])
        Expected: Status 400 "Required fields missing"
        """
        payload = {"email": "student_missing@test.com", "first_name": "Test"}
        response = self.client.post(self.REGISTER_STUDENT_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "Required fields missing")

    # -------------------------------------------------------------------------
    # TC-AuthErr014: Register student with unverified email
    # -------------------------------------------------------------------------
    def test_TC_AuthErr014_register_student_unverified_email(self):
        """
        TC-AuthErr014: Registration before verifying email via OTP
        Tested Code Segment: auth_views.register_student() -> if not OTPVerification.objects.filter(email=email, is_verified=True).exists()
        Expected: Status 400 "Email not verified"
        """
        payload = {
            "email": "unverified_student@test.com",
            "password": "Password123!",
            "first_name": "John",
            "last_name": "Doe",
            "student_id": "STUD-001",
            "course": "BSIT",
            "year_level": "4th Year"
        }
        response = self.client.post(self.REGISTER_STUDENT_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "Email not verified")

    # -------------------------------------------------------------------------
    # TC-AuthErr015: Register student with password length < 8 chars
    # -------------------------------------------------------------------------
    def test_TC_AuthErr015_register_student_password_too_short(self):
        """
        TC-AuthErr015: Password failing length validation
        Tested Code Segment: auth_views.register_student() -> validate_registration_data()
        Expected: Status 400 validation error
        """
        OTPVerification.objects.create(
            email="short_pw@test.com",
            otp_code="123456",
            expires_at=timezone.now() + timedelta(minutes=10),
            is_verified=True
        )
        payload = {
            "email": "short_pw@test.com",
            "password": "short",
            "first_name": "Short",
            "last_name": "Pass",
            "student_id": "STUD-002",
            "course": "BSIT",
            "year_level": "4th Year"
        }
        response = self.client.post(self.REGISTER_STUDENT_URL, json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    # -------------------------------------------------------------------------
    # TC-AuthErr016: Internal server error helper function _error_response()
    # -------------------------------------------------------------------------
    def test_TC_AuthErr016_error_response_helper_structure(self):
        """
        TC-AuthErr016: Helper function _error_response structure and status code
        Tested Code Segment: auth_views._error_response()
        Expected: Correct status code, error message, detail and exception type
        """
        exc = ValueError("Test simulated exception")
        resp = auth_views._error_response("Custom error occurred", exc=exc, status=503)
        self.assertEqual(resp.status_code, 503)
        content = json.loads(resp.content.decode("utf-8"))
        self.assertEqual(content.get("error"), "Custom error occurred")
        self.assertEqual(content.get("exception_type"), "ValueError")
        self.assertIn("Test simulated exception", content.get("detail"))
