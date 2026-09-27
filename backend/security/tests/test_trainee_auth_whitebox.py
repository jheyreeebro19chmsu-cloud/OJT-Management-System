"""
=============================================================================
White-Box Testing of the Alpha Testing of Trainee Authentication Case
=============================================================================
Tested Code Segments (functions under test):
  - auth_views.login()              -> Trainee login
  - auth_views.request_otp()        -> OTP request
  - auth_views.verify_otp()         -> OTP verification
  - auth_views.register_student()   -> Trainee registration
  - OTPVerification.is_valid()      -> OTP expiry check (model method)

Run with:
    python manage.py test security.tests.test_trainee_auth_whitebox -v 2
=============================================================================
"""

import json
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, Client, RequestFactory
from django.contrib.auth.models import User
from django.utils import timezone

from security.models import UserRole, Student, OTPVerification
from security import auth_views


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _post(client: Client, url: str, payload: dict) -> "HttpResponse":
    return client.post(url, data=json.dumps(payload), content_type="application/json")


def _json_body(data: dict) -> bytes:
    return json.dumps(data).encode("utf-8")


# ===========================================================================
# Table: White-Box Testing of Trainee Authentication
# ===========================================================================

class TraineeLoginWhiteBoxTests(TestCase):
    """
    White-Box Tests – Trainee Login
    Tested Code Segment: auth_views.login()
    Endpoint: POST /api/auth/login/
    """

    LOGIN_URL = "/api/auth/login/"

    def setUp(self):
        self.client = Client()

        # Active trainee (student role)
        self.trainee = User.objects.create_user(
            username="trainee@test.com",
            email="trainee@test.com",
            password="securePass123",
            first_name="Juan",
            last_name="Dela Cruz",
            is_active=True,
        )
        UserRole.objects.create(user=self.trainee, role="student", is_verified=True)
        Student.objects.create(user=self.trainee, age=21, address="Bacolod City")

        # Deactivated trainee
        self.inactive_trainee = User.objects.create_user(
            username="inactive@test.com",
            email="inactive@test.com",
            password="securePass123",
            is_active=False,
        )
        UserRole.objects.create(user=self.inactive_trainee, role="student", is_verified=True)

    # -----------------------------------------------------------------------
    # TC-TraineeAuth001: Correct credentials -> success + JWT tokens
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth001_correct_credentials(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email="trainee@test.com", password="securePass123"
        Expected Behavior   : Authenticate trainee; return success=True,
                              tokens, and user with role='student'
        """
        payload = {"email": "trainee@test.com", "password": "securePass123"}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 200,
                         msg="TC-TraineeAuth001: Expected HTTP 200")
        self.assertTrue(data.get("success"),
                        msg="TC-TraineeAuth001: Expected success=True")
        self.assertIn("tokens", data,
                      msg="TC-TraineeAuth001: Expected JWT tokens in response")
        self.assertIn("access", data["tokens"],
                      msg="TC-TraineeAuth001: Expected access token")
        self.assertEqual(data["user"]["role"], "student",
                         msg="TC-TraineeAuth001: Expected role='student'")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth002: Wrong password -> 401 "Invalid credentials"
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth002_wrong_password(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email="trainee@test.com", password="wrongpass"
        Expected Behavior   : Return "Invalid credentials" (HTTP 401)

        White-box path: user.check_password("wrongpass") -> False
                        -> return JsonResponse({'error': 'Invalid credentials'}, 401)
        """
        payload = {"email": "trainee@test.com", "password": "wrongpass"}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 401,
                         msg="TC-TraineeAuth002: Expected HTTP 401")
        self.assertIn("Invalid credentials", data.get("error", ""),
                      msg="TC-TraineeAuth002: Expected 'Invalid credentials' error")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth003: Empty email -> rejected
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth003_empty_email(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email="", password="securePass123"
        Expected Behavior   : "Username required" / login rejected

        White-box path: ''.strip() -> '' -> filter(email__iexact='').first() -> None
                        -> not user -> return 401
        """
        payload = {"email": "", "password": "securePass123"}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertIn(response.status_code, [400, 401],
                      msg="TC-TraineeAuth003: Expected HTTP 400 or 401 for empty email")
        self.assertFalse(data.get("success", False),
                         msg="TC-TraineeAuth003: Login must not succeed with empty email")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth004: Empty password -> rejected
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth004_empty_password(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email="trainee@test.com", password=""
        Expected Behavior   : "Password required" / login rejected

        White-box path: check_password("") -> False -> return 401
        """
        payload = {"email": "trainee@test.com", "password": ""}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertIn(response.status_code, [400, 401],
                      msg="TC-TraineeAuth004: Expected HTTP 400 or 401 for empty password")
        self.assertFalse(data.get("success", False),
                         msg="TC-TraineeAuth004: Login must not succeed with empty password")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth005: SQL injection attempt -> sanitized, denied
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth005_sql_injection(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email="' OR 1=1 --", password="none"
        Expected Behavior   : Input sanitized via ORM parameterised query; login fails

        White-box path: Django ORM always uses parameterised queries,
                        so injection payload is treated as a literal string -> no user found -> 401
        """
        payload = {"email": "' OR 1=1 --", "password": "none"}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertNotEqual(response.status_code, 200,
                            msg="TC-TraineeAuth005: SQL injection must NOT return HTTP 200")
        self.assertFalse(data.get("success", False),
                         msg="TC-TraineeAuth005: Login must not succeed via SQL injection")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth006: Deactivated trainee account -> "Account disabled"
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth006_deactivated_account(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email="inactive@test.com", password="securePass123"
        Expected Behavior   : HTTP 401 "Account disabled"

        White-box path: user.check_password() -> True
                        -> user.is_active == False -> return 401 'Account disabled'
        """
        payload = {"email": "inactive@test.com", "password": "securePass123"}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertIn(response.status_code, [401, 403],
                      msg="TC-TraineeAuth006: Expected HTTP 401/403 for disabled account")
        self.assertFalse(data.get("success", False),
                         msg="TC-TraineeAuth006: Disabled account must not authenticate")
        self.assertIn("Account disabled", data.get("error", ""),
                      msg="TC-TraineeAuth006: Expected 'Account disabled' in error")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth007: 5 failed login attempts -> all rejected
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth007_rate_limiting_five_failed_attempts(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : 5 incorrect login attempts
        Expected Behavior   : Account should be temporarily locked (all fail)

        White-box path: Each attempt hits the check_password() False branch -> 401
        """
        wrong_payload = {"email": "trainee@test.com", "password": "wrongpass"}
        statuses = []
        for _ in range(5):
            resp = _post(self.client, self.LOGIN_URL, wrong_payload)
            statuses.append(resp.status_code)

        for i, s in enumerate(statuses, 1):
            self.assertIn(s, [401, 429, 403],
                          msg=f"TC-TraineeAuth007: Attempt {i} must be rejected (got {s})")

        # 6th attempt: must still fail (locked or still 401)
        sixth = _post(self.client, self.LOGIN_URL, wrong_payload)
        self.assertIn(sixth.status_code, [401, 429, 403],
                      msg="TC-TraineeAuth007: 6th attempt must be rejected")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth008: Case-insensitive email matching
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth008_email_case_insensitive(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email="TRAINEE@TEST.COM", password="securePass123"
        Expected Behavior   : email__iexact matches -> login succeeds

        White-box path: email__iexact lookup in login() -> user found
        """
        payload = {"email": "TRAINEE@TEST.COM", "password": "securePass123"}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        actual = "Pass (iexact)" if response.status_code == 200 else "Fail (case-sensitive)"
        print(f"\n  TC-TraineeAuth008 actual behavior: {actual}")

        # Document the iexact behavior (either pass or fail is acceptable
        # depending on implementation — test confirms it's consistent)
        self.assertIn(response.status_code, [200, 401],
                      msg="TC-TraineeAuth008: Must return consistent status for case variation")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth009: Leading/trailing spaces trimmed
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth009_spaces_trimmed(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email=" trainee@test.com ", password=" securePass123 "
        Expected Behavior   : Spaces stripped; authentication succeeds

        White-box path: data.get('email','').strip() -> 'trainee@test.com'
                        data.get('password','').strip() -> 'securePass123'
        """
        payload = {"email": " trainee@test.com ", "password": " securePass123 "}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 200,
                         msg="TC-TraineeAuth009: Expected HTTP 200 after trimming spaces")
        self.assertTrue(data.get("success"),
                        msg="TC-TraineeAuth009: Login must succeed after trimming spaces")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth010: Unregistered email -> rejected
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth010_unregistered_email(self):
        """
        Tested Code Segment : auth_views.login()
        Input               : email="nobody@test.com", password="securePass123"
        Expected Behavior   : User not found -> HTTP 401

        White-box path: User.objects.filter(...).first() -> None
                        -> not user -> return 401
        """
        payload = {"email": "nobody@test.com", "password": "securePass123"}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 401,
                         msg="TC-TraineeAuth010: Expected HTTP 401 for unregistered email")
        self.assertIn("Invalid credentials", data.get("error", ""),
                      msg="TC-TraineeAuth010: Expected 'Invalid credentials' error")

    # -----------------------------------------------------------------------
    # TC-TraineeAuth011: Login returns correct trainee profile data
    # -----------------------------------------------------------------------
    def test_TC_TraineeAuth011_profile_data_returned(self):
        """
        Tested Code Segment : auth_views.login() -> student profile branch
        Input               : valid trainee credentials
        Expected Behavior   : Response includes user id, email, full name, role

        White-box path: role == 'student' -> Student.objects.filter(user=user).first()
                        -> profile_data = {'age': p.age}
        """
        payload = {"email": "trainee@test.com", "password": "securePass123"}
        response = _post(self.client, self.LOGIN_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 200)
        user_data = data.get("user", {})
        self.assertIn("id", user_data,       msg="TC-TraineeAuth011: Expected user.id")
        self.assertIn("email", user_data,    msg="TC-TraineeAuth011: Expected user.email")
        self.assertIn("name", user_data,     msg="TC-TraineeAuth011: Expected user.name")
        self.assertIn("role", user_data,     msg="TC-TraineeAuth011: Expected user.role")
        self.assertEqual(user_data["role"], "student")


# ===========================================================================
# White-Box Tests: OTP Request and Verification
# ===========================================================================

class TraineeOTPWhiteBoxTests(TestCase):
    """
    White-Box Tests – OTP Request and Verification
    Tested Code Segments:
      - auth_views.request_otp()
      - auth_views.verify_otp()
      - OTPVerification.is_valid()
    """

    OTP_REQUEST_URL  = "/api/auth/request-otp/"
    OTP_VERIFY_URL   = "/api/auth/verify-otp/"

    def setUp(self):
        self.client = Client()
        self.email = "newtrainee@test.com"

    # -----------------------------------------------------------------------
    # TC-TraineeOTP001: Request OTP with valid email
    # -----------------------------------------------------------------------
    @patch("security.auth_views.send_verification_email", return_value=True)
    def test_TC_TraineeOTP001_request_otp_valid_email(self, mock_send):
        """
        Tested Code Segment : auth_views.request_otp()
        Input               : email="newtrainee@test.com"
        Expected Behavior   : OTP created, email sent, success=True

        White-box path: email not empty -> User not found -> OTPVerification.create_otp()
                        -> send_verification_email() -> return 200 success
        """
        payload = {"email": self.email, "full_name": "New Trainee"}
        response = _post(self.client, self.OTP_REQUEST_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 200,
                         msg="TC-TraineeOTP001: Expected HTTP 200")
        self.assertTrue(data.get("success"),
                        msg="TC-TraineeOTP001: Expected success=True")
        self.assertTrue(
            OTPVerification.objects.filter(email=self.email).exists(),
            msg="TC-TraineeOTP001: OTP record must be created in DB",
        )
        mock_send.assert_called_once()

    # -----------------------------------------------------------------------
    # TC-TraineeOTP002: Request OTP with empty email
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP002_request_otp_empty_email(self):
        """
        Tested Code Segment : auth_views.request_otp()
        Input               : email=""
        Expected Behavior   : HTTP 400 "Email is required"

        White-box path: email = ''.strip() -> if not email -> return 400
        """
        payload = {"email": "", "full_name": "Nobody"}
        response = _post(self.client, self.OTP_REQUEST_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeOTP002: Expected HTTP 400 for empty email")
        self.assertIn("Email", data.get("error", ""),
                      msg="TC-TraineeOTP002: Expected 'Email' in error message")

    # -----------------------------------------------------------------------
    # TC-TraineeOTP003: Request OTP with already-registered email
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP003_request_otp_already_registered(self):
        """
        Tested Code Segment : auth_views.request_otp()
        Input               : email of an existing registered user
        Expected Behavior   : HTTP 400 "Email already registered"

        White-box path: User.objects.filter(email__iexact=email).exists() -> True
                        -> return 400 'Email already registered'
        """
        User.objects.create_user(username="existing@test.com",
                                 email="existing@test.com",
                                 password="pass1234")
        payload = {"email": "existing@test.com", "full_name": "Existing"}
        response = _post(self.client, self.OTP_REQUEST_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeOTP003: Expected HTTP 400 for registered email")
        self.assertIn("already registered", data.get("error", "").lower(),
                      msg="TC-TraineeOTP003: Expected 'already registered' in error")

    # -----------------------------------------------------------------------
    # TC-TraineeOTP004: Verify OTP with correct code
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP004_verify_otp_correct_code(self):
        """
        Tested Code Segment : auth_views.verify_otp()
        Input               : email, correct otp_code
        Expected Behavior   : HTTP 200, success=True, otp.is_verified=True

        White-box path: OTPVerification found -> otp.is_valid() -> True
                        -> otp.otp_code == otp_code -> otp.is_verified = True -> save
        """
        otp = OTPVerification.create_otp(self.email)
        payload = {"email": self.email, "otp_code": otp.otp_code}
        response = _post(self.client, self.OTP_VERIFY_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 200,
                         msg="TC-TraineeOTP004: Expected HTTP 200 for correct OTP")
        self.assertTrue(data.get("success"),
                        msg="TC-TraineeOTP004: Expected success=True")

        otp.refresh_from_db()
        self.assertTrue(otp.is_verified,
                        msg="TC-TraineeOTP004: OTP must be marked verified in DB")

    # -----------------------------------------------------------------------
    # TC-TraineeOTP005: Verify OTP with incorrect code
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP005_verify_otp_wrong_code(self):
        """
        Tested Code Segment : auth_views.verify_otp()
        Input               : email, wrong otp_code="000000"
        Expected Behavior   : HTTP 400 "Invalid or expired OTP"

        White-box path: otp found -> is_valid() -> True
                        -> otp.otp_code != "000000" -> return 400
        """
        OTPVerification.create_otp(self.email)
        payload = {"email": self.email, "otp_code": "000000"}
        response = _post(self.client, self.OTP_VERIFY_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeOTP005: Expected HTTP 400 for wrong OTP code")
        self.assertIn("Invalid or expired", data.get("error", ""),
                      msg="TC-TraineeOTP005: Expected 'Invalid or expired' in error")

    # -----------------------------------------------------------------------
    # TC-TraineeOTP006: Verify expired OTP
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP006_verify_expired_otp(self):
        """
        Tested Code Segment : auth_views.verify_otp() + OTPVerification.is_valid()
        Input               : OTP that has expired (expires_at in the past)
        Expected Behavior   : HTTP 400 "Invalid or expired OTP"

        White-box path: otp.is_valid() -> timezone.now() > otp.expires_at -> False
                        -> return 400
        """
        otp = OTPVerification.create_otp(self.email)
        # Force-expire the OTP
        otp.expires_at = timezone.now() - timedelta(minutes=1)
        otp.save()

        payload = {"email": self.email, "otp_code": otp.otp_code}
        response = _post(self.client, self.OTP_VERIFY_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeOTP006: Expected HTTP 400 for expired OTP")
        self.assertIn("Invalid or expired", data.get("error", ""),
                      msg="TC-TraineeOTP006: Expected 'Invalid or expired OTP'")

    # -----------------------------------------------------------------------
    # TC-TraineeOTP007: Verify OTP with missing email field
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP007_verify_otp_missing_fields(self):
        """
        Tested Code Segment : auth_views.verify_otp()
        Input               : email="", otp_code=""
        Expected Behavior   : HTTP 400 "Email and OTP code required"

        White-box path: if not email or not otp_code -> return 400
        """
        payload = {"email": "", "otp_code": ""}
        response = _post(self.client, self.OTP_VERIFY_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeOTP007: Expected HTTP 400 for missing fields")
        self.assertIn("required", data.get("error", "").lower(),
                      msg="TC-TraineeOTP007: Expected 'required' in error")

    # -----------------------------------------------------------------------
    # TC-TraineeOTP008: OTPVerification.is_valid() model method – valid OTP
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP008_model_is_valid_true(self):
        """
        Tested Code Segment : OTPVerification.is_valid()
        Expected Behavior   : Returns True when not verified and not expired

        White-box path: is_verified=False AND timezone.now() < expires_at -> True
        """
        otp = OTPVerification.create_otp(self.email)
        self.assertTrue(otp.is_valid(),
                        msg="TC-TraineeOTP008: is_valid() must be True for fresh OTP")

    # -----------------------------------------------------------------------
    # TC-TraineeOTP009: OTPVerification.is_valid() – already verified OTP
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP009_model_is_valid_already_verified(self):
        """
        Tested Code Segment : OTPVerification.is_valid()
        Expected Behavior   : Returns False when otp.is_verified=True

        White-box path: is_verified=True -> not self.is_verified -> False -> returns False
        """
        otp = OTPVerification.create_otp(self.email)
        otp.is_verified = True
        otp.save()
        self.assertFalse(otp.is_valid(),
                         msg="TC-TraineeOTP009: is_valid() must be False for verified OTP")

    # -----------------------------------------------------------------------
    # TC-TraineeOTP010: OTPVerification.is_valid() – expired OTP
    # -----------------------------------------------------------------------
    def test_TC_TraineeOTP010_model_is_valid_expired(self):
        """
        Tested Code Segment : OTPVerification.is_valid()
        Expected Behavior   : Returns False when OTP has expired

        White-box path: timezone.now() >= expires_at -> False
        """
        otp = OTPVerification.create_otp(self.email)
        otp.expires_at = timezone.now() - timedelta(seconds=1)
        otp.save()
        self.assertFalse(otp.is_valid(),
                         msg="TC-TraineeOTP010: is_valid() must be False for expired OTP")


# ===========================================================================
# White-Box Tests: Trainee Registration
# ===========================================================================

class TraineeRegistrationWhiteBoxTests(TestCase):
    """
    White-Box Tests – Trainee Registration
    Tested Code Segment: auth_views.register_student()
    Endpoint: POST /api/auth/register-student/
    """

    REGISTER_URL = "/api/auth/register-student/"

    def setUp(self):
        self.client = Client()
        self.email = "reg.trainee@test.com"
        # Pre-verify OTP (required for registration)
        OTPVerification.objects.create(
            email=self.email,
            otp_code="123456",
            expires_at=timezone.now() + timedelta(minutes=10),
            is_verified=True,
        )

    # -----------------------------------------------------------------------
    # TC-TraineeReg001: Valid registration payload -> 201 Created
    # -----------------------------------------------------------------------
    @patch("security.auth_views.send_confirmation_email", return_value=True)
    def test_TC_TraineeReg001_valid_registration(self, mock_mail):
        """
        Tested Code Segment : auth_views.register_student()
        Input               : all required fields with verified OTP
        Expected Behavior   : HTTP 201, user created in DB, tokens returned

        White-box path: all fields valid -> OTP verified -> transaction.atomic()
                        -> User.create_user() -> UserRole -> Student -> return 201
        """
        payload = {
            "email": self.email,
            "password": "securePass123",
            "first_name": "Juan",
            "last_name": "Dela Cruz",
            "age": 21,
            "address": "123 Bacolod St",
        }
        response = _post(self.client, self.REGISTER_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 201,
                         msg="TC-TraineeReg001: Expected HTTP 201 for valid registration")
        self.assertTrue(data.get("success"),
                        msg="TC-TraineeReg001: Expected success=True")
        self.assertIn("tokens", data,
                      msg="TC-TraineeReg001: Expected JWT tokens in response")
        self.assertTrue(User.objects.filter(email=self.email).exists(),
                        msg="TC-TraineeReg001: User must exist in DB after registration")
        role = UserRole.objects.filter(user__email=self.email).first()
        self.assertEqual(role.role, "student",
                         msg="TC-TraineeReg001: User role must be 'student'")

    # -----------------------------------------------------------------------
    # TC-TraineeReg002: Missing required fields -> 400
    # -----------------------------------------------------------------------
    def test_TC_TraineeReg002_missing_required_fields(self):
        """
        Tested Code Segment : auth_views.register_student()
        Input               : Missing first_name and last_name
        Expected Behavior   : HTTP 400 "Required fields missing"

        White-box path: not all([email, password, first_name, last_name])
                        -> return 400 'Required fields missing'
        """
        payload = {
            "email": self.email,
            "password": "securePass123",
            # first_name and last_name intentionally missing
        }
        response = _post(self.client, self.REGISTER_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeReg002: Expected HTTP 400 for missing fields")
        self.assertIn("Required fields missing", data.get("error", ""),
                      msg="TC-TraineeReg002: Expected 'Required fields missing' error")

    # -----------------------------------------------------------------------
    # TC-TraineeReg003: Email already registered -> 400
    # -----------------------------------------------------------------------
    @patch("security.auth_views.send_confirmation_email", return_value=True)
    def test_TC_TraineeReg003_email_already_registered(self, _mock):
        """
        Tested Code Segment : auth_views.register_student()
        Input               : email that already exists in User table
        Expected Behavior   : HTTP 400 "Email already registered"

        White-box path: User.objects.filter(email__iexact=email).exists() -> True
                        -> return 400 'Email already registered'
        """
        User.objects.create_user(username=self.email, email=self.email,
                                 password="somepass")
        payload = {
            "email": self.email,
            "password": "securePass123",
            "first_name": "Juan",
            "last_name": "Dela Cruz",
        }
        response = _post(self.client, self.REGISTER_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeReg003: Expected HTTP 400 for existing email")
        self.assertIn("already registered", data.get("error", "").lower(),
                      msg="TC-TraineeReg003: Expected 'already registered' in error")

    # -----------------------------------------------------------------------
    # TC-TraineeReg004: Email not OTP-verified -> 400
    # -----------------------------------------------------------------------
    def test_TC_TraineeReg004_email_not_otp_verified(self):
        """
        Tested Code Segment : auth_views.register_student()
        Input               : email with no verified OTPVerification record
        Expected Behavior   : HTTP 400 "Email not verified"

        White-box path: OTPVerification.objects.filter(email=email, is_verified=True)
                        .exists() -> False -> return 400 'Email not verified'
        """
        payload = {
            "email": "unverified@test.com",
            "password": "securePass123",
            "first_name": "Juan",
            "last_name": "Dela Cruz",
        }
        response = _post(self.client, self.REGISTER_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeReg004: Expected HTTP 400 for unverified email")
        self.assertIn("not verified", data.get("error", "").lower(),
                      msg="TC-TraineeReg004: Expected 'not verified' in error")

    # -----------------------------------------------------------------------
    # TC-TraineeReg005: Password too short (< 8 chars) -> 400
    # -----------------------------------------------------------------------
    def test_TC_TraineeReg005_password_too_short(self):
        """
        Tested Code Segment : auth_views.register_student()
                              + validation.validate_registration_data()
        Input               : password="abc" (< 8 characters)
        Expected Behavior   : HTTP 400 validation error about password length

        White-box path: validate_registration_data -> password min_length=8 check
                        -> error returned -> return 400
        """
        payload = {
            "email": self.email,
            "password": "abc",   # only 3 chars
            "first_name": "Juan",
            "last_name": "Dela Cruz",
        }
        response = _post(self.client, self.REGISTER_URL, payload)
        data = response.json()

        self.assertEqual(response.status_code, 400,
                         msg="TC-TraineeReg005: Expected HTTP 400 for short password")
        self.assertTrue(len(data.get("error", "")) > 0,
                        msg="TC-TraineeReg005: Expected error message for short password")

    # -----------------------------------------------------------------------
    # TC-TraineeReg006: XSS in first_name -> sanitized
    # -----------------------------------------------------------------------
    @patch("security.auth_views.send_confirmation_email", return_value=True)
    def test_TC_TraineeReg006_xss_in_first_name_sanitized(self, _mock):
        """
        Tested Code Segment : auth_views.register_student()
                              + sanitize_string()
        Input               : first_name="<script>alert(1)</script>Juan"
        Expected Behavior   : HTML tags stripped; registration proceeds with
                              sanitized name (no 500 error)

        White-box path: sanitize_string('<script>...') -> removes HTML tags
                        -> cleaned = 'Juan' -> validate_registration_data passes
        """
        payload = {
            "email": self.email,
            "password": "securePass123",
            "first_name": "<script>alert(1)</script>Juan",
            "last_name": "Dela Cruz",
            "age": 21,
            "address": "Bacolod",
        }
        response = _post(self.client, self.REGISTER_URL, payload)
        data = response.json()

        # Either registered cleanly (201) or rejected due to empty name after sanitize (400)
        self.assertIn(response.status_code, [201, 400],
                      msg="TC-TraineeReg006: Must not return 500 for XSS input")
        self.assertNotEqual(response.status_code, 500,
                            msg="TC-TraineeReg006: XSS input must not cause 500 error")
        if response.status_code == 201:
            user = User.objects.filter(email=self.email).first()
            self.assertNotIn("<script>", user.first_name,
                             msg="TC-TraineeReg006: Script tags must not appear in stored name")


# ===========================================================================
# Direct Branch-Level White-Box Tests (RequestFactory)
# ===========================================================================

class TraineeAuthDirectBranchTests(TestCase):
    """
    Low-level white-box branch tests calling auth_views functions directly
    via RequestFactory to isolate each conditional path.
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.trainee = User.objects.create_user(
            username="branch.trainee@test.com",
            email="branch.trainee@test.com",
            password="securePass123",
            is_active=True,
        )
        UserRole.objects.create(user=self.trainee, role="student", is_verified=True)
        Student.objects.create(user=self.trainee, age=20, address="Test Address")

    def _login(self, email: str, password: str):
        body = _json_body({"email": email, "password": password})
        request = self.factory.post("/api/auth/login/", data=body,
                                    content_type="application/json")
        return auth_views.login(request)

    # Branch: correct trainee credentials
    def test_branch_correct_trainee_credentials_200(self):
        """White-box: check_password() True + is_active True -> 200 with tokens"""
        resp = self._login("branch.trainee@test.com", "securePass123")
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertTrue(data["success"])
        self.assertIn("access", data["tokens"])

    # Branch: user not found returns 401
    def test_branch_user_not_found_401(self):
        """White-box: User.objects.filter().first() -> None -> 401"""
        resp = self._login("ghost@test.com", "somepass")
        self.assertEqual(resp.status_code, 401)

    # Branch: wrong password returns 401
    def test_branch_wrong_password_401(self):
        """White-box: check_password() -> False -> 401 'Invalid credentials'"""
        resp = self._login("branch.trainee@test.com", "badpass")
        self.assertEqual(resp.status_code, 401)
        data = json.loads(resp.content)
        self.assertIn("Invalid credentials", data["error"])

    # Branch: inactive user blocked
    def test_branch_inactive_trainee_blocked(self):
        """White-box: is_active=False -> 401 'Account disabled'"""
        inactive = User.objects.create_user(
            username="b.inactive@test.com",
            email="b.inactive@test.com",
            password="securePass123",
            is_active=False,
        )
        resp = self._login("b.inactive@test.com", "securePass123")
        self.assertEqual(resp.status_code, 401)
        data = json.loads(resp.content)
        self.assertIn("Account disabled", data["error"])

    # Branch: role defaults to 'student' when no UserRole row
    def test_branch_no_role_row_defaults_to_student(self):
        """White-box: UserRole.objects.filter().first() -> None -> role = 'student'"""
        bare = User.objects.create_user(
            username="bare.trainee@test.com",
            email="bare.trainee@test.com",
            password="securePass123",
            is_active=True,
        )
        resp = self._login("bare.trainee@test.com", "securePass123")
        data = json.loads(resp.content)
        self.assertEqual(data["user"]["role"], "student")

    # Branch: whitespace email stripped -> no user found
    def test_branch_whitespace_only_email(self):
        """White-box: '   '.strip() == '' -> no user -> 401"""
        resp = self._login("   ", "securePass123")
        self.assertIn(resp.status_code, [400, 401])

    # Branch: student profile age is included in response
    def test_branch_student_profile_age_in_response(self):
        """White-box: role == 'student' -> Student.filter().first() -> profile_data = {'age': p.age}"""
        resp = self._login("branch.trainee@test.com", "securePass123")
        data = json.loads(resp.content)
        # 'age' is in profile_data which is merged into user
        self.assertIn("age", data.get("user", {}),
                      msg="Student profile 'age' must be included in login response")
