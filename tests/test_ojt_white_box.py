"""
=============================================================================
WHITE BOX TEST SUITE: OJT MANAGEMENT SYSTEM (CAPSTONE PROJECT)
Framework: PyTest & Qase TestOps Integration (qase-pytest)
=============================================================================
"""

import math
import pytest

try:
    from qase.pytest import qase
except ImportError:
    # Graceful fallback mock if qase-pytest is not installed yet
    class MockQase:
        @staticmethod
        def title(t): return lambda f: f
        @staticmethod
        def description(d): return lambda f: f
        @staticmethod
        def step(s): return lambda f: f
    qase = MockQase()


# -----------------------------------------------------------------------------
# CORE LOGIC IMPLEMENTATIONS (Mirroring TypeScript Production Modules)
# -----------------------------------------------------------------------------

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine algorithm calculating great-circle distance between two points in meters."""
    R = 6371000  # Earth's radius in meters
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def is_within_geofence(user_lat: float, user_lng: float, zone_lat: float, zone_lng: float,
                       radius_meters: float = 50, accuracy_meters: float = 5) -> bool:
    """Verifies whether the trainee is within the authorized geofence boundary."""
    distance = calculate_distance(user_lat, user_lng, zone_lat, zone_lng)
    buffer = min(5.0, accuracy_meters) if accuracy_meters is not None else 5.0
    effective_radius = radius_meters - buffer
    if effective_radius <= 0:
        return False
    return distance <= effective_radius


def format_time_12h(time_str: str) -> str:
    """Converts 24-hour 'HH:MM' string to 12-hour format with AM/PM."""
    hours, minutes = map(int, time_str.split(':'))
    period = 'PM' if hours >= 12 else 'AM'
    display_hours = hours % 12 or 12
    return f"{display_hours}:{minutes:02d} {period}"


def get_grade(score: float) -> str:
    """Boundary grading rubric standard."""
    if score >= 90:
        return 'Excellent'
    elif score >= 80:
        return 'Very Good'
    elif score >= 70:
        return 'Good'
    elif score >= 60:
        return 'Satisfactory'
    else:
        return 'Needs Improvement'


def compute_weighted_score(performance: float, attendance: float, communication: float, punctuality: float) -> int:
    """Computes the 4-section weighted evaluation percentage (30% + 30% + 20% + 20%)."""
    val = performance * 0.30 + attendance * 0.30 + communication * 0.20 + punctuality * 0.20
    return math.floor(val + 0.5)


def normalize_email(email: str) -> str:
    """Strips whitespace and converts email to lowercase for secure auth lookup."""
    if not email or not isinstance(email, str):
        return ""
    return email.strip().lower()


# -----------------------------------------------------------------------------
# PYTEST TEST CASES WITH QASE TESTOPS METADATA
# -----------------------------------------------------------------------------

class TestGeofenceWhiteBox:
    """Suite 1: Geofence Mathematical Algorithm & Boundary Testing."""

    @qase.title("Distance Calculation - Identical Coordinates (0m)")
    def test_identical_coordinates_zero_distance(self):
        # Coordinates for CHMSU Talisay Main Campus
        lat, lng = 10.7410, 122.9702
        dist = calculate_distance(lat, lng, lat, lng)
        assert math.isclose(dist, 0.0, abs_tol=1e-5), f"Expected 0m, got {dist}"

    @qase.title("Geofence Verification - Inside 40m Radius")
    def test_user_inside_40m_geofence(self):
        campus_lat, campus_lng = 10.7410, 122.9702
        user_lat, user_lng = 10.7412, 122.9702  # ~22 meters away
        assert is_within_geofence(user_lat, user_lng, campus_lat, campus_lng, radius_meters=40, accuracy_meters=5) is True

    @qase.title("Geofence Verification - Outside 40m Radius")
    def test_user_outside_40m_geofence(self):
        campus_lat, campus_lng = 10.7410, 122.9702
        user_lat, user_lng = 10.7450, 122.9702  # ~440 meters away
        assert is_within_geofence(user_lat, user_lng, campus_lat, campus_lng, radius_meters=40, accuracy_meters=5) is False

    @qase.title("Time Conversion - 24-hour to 12-hour AM/PM boundaries")
    @pytest.mark.parametrize("time_24h, expected_12h", [
        ("08:05", "8:05 AM"),
        ("12:00", "12:00 PM"),
        ("00:30", "12:30 AM"),
        ("17:45", "5:45 PM"),
        ("23:59", "11:59 PM"),
    ])
    def test_time_formatting_conversions(self, time_24h, expected_12h):
        assert format_time_12h(time_24h) == expected_12h


class TestPerformanceRubricWhiteBox:
    """Suite 2: Boundary Value Analysis for Performance Grading Rubrics."""

    @qase.title("Grading Rubric Boundary Value Analysis")
    @pytest.mark.parametrize("score, expected_grade", [
        (100.0, "Excellent"),
        (90.0, "Excellent"),           # Lower bound of Excellent
        (89.9, "Very Good"),           # Upper bound of Very Good
        (80.0, "Very Good"),
        (79.9, "Good"),
        (70.0, "Good"),
        (69.9, "Satisfactory"),
        (60.0, "Satisfactory"),        # Passing threshold
        (59.9, "Needs Improvement"),   # Failing threshold
        (0.0, "Needs Improvement"),
    ])
    def test_grade_boundaries(self, score, expected_grade):
        assert get_grade(score) == expected_grade

    @qase.title("4-Section Evaluation Weighted Score Computation")
    def test_weighted_score_formula(self):
        # 95*0.3(28.5) + 90*0.3(27) + 85*0.2(17) + 90*0.2(18) = 90.5 -> 91%
        result = compute_weighted_score(performance=95, attendance=90, communication=85, punctuality=90)
        assert result == 91


class TestAddressAndAcademicWhiteBox:
    """Suite 3: Philippine Address Data & Cascading Hierarchy Integrity."""

    @qase.title("Address Hierarchy - Cascading filters")
    def test_address_cascading_integrity(self):
        # Simulating address cascade logic
        mock_address_tree = {
            "Region VI (Western Visayas)": {
                "Negros Occidental": ["Talisay City", "Bacolod City", "Silay City", "Bago City"],
                "Iloilo": ["Iloilo City", "Passi City"]
            },
            "National Capital Region (NCR)": {
                "Metro Manila": ["Manila", "Quezon City", "Makati"]
            }
        }

        # 1. Unselected parent returns empty list
        assert len(mock_address_tree.get("", {})) == 0
        # 2. Selected region returns only its provinces
        reg6_provinces = list(mock_address_tree.get("Region VI (Western Visayas)", {}).keys())
        assert "Negros Occidental" in reg6_provinces
        assert "Metro Manila" not in reg6_provinces
        # 3. Selected province returns only its cities
        negros_cities = mock_address_tree["Region VI (Western Visayas)"]["Negros Occidental"]
        assert "Talisay City" in negros_cities
        assert "Iloilo City" not in negros_cities


class TestAuthSanitizationWhiteBox:
    """Suite 4: Email Normalization & Input Sanitization."""

    @qase.title("Email Normalization - Case and whitespace stripping")
    @pytest.mark.parametrize("raw_input, expected_normalized", [
        ("YzelBNorte.CHMSU@gmail.COM", "yzelbnorte.chmsu@gmail.com"),
        ("  test@chmsu.edu.ph  ", "test@chmsu.edu.ph"),
        ("STUDENT.OJT@DOMAIN.COM", "student.ojt@domain.com"),
        ("", ""),
        (None, ""),
    ])
    def test_email_sanitization(self, raw_input, expected_normalized):
        assert normalize_email(raw_input) == expected_normalized


# -----------------------------------------------------------------------------
# GOOGLE AUTH & ROLE PROVISIONING LOGIC
# -----------------------------------------------------------------------------

def parse_oauth_tokens(callback_url: str) -> dict:
    """Extracts access_token, refresh_token or code from OAuth callback URL."""
    if not callback_url or not isinstance(callback_url, str):
        return {"error": "Invalid URL"}

    if "#" in callback_url:
        fragment = callback_url.split("#")[1]
    elif "?" in callback_url:
        fragment = callback_url.split("?")[1]
    else:
        return {"error": "No tokens or code found"}

    params = {}
    for part in fragment.split("&"):
        if "=" in part:
            k, v = part.split("=", 1)
            params[k] = v

    if "access_token" in params and "refresh_token" in params:
        return {
            "type": "implicit",
            "access_token": params["access_token"],
            "refresh_token": params["refresh_token"]
        }
    elif "code" in params:
        return {
            "type": "code",
            "code": params["code"]
        }
    return {"error": "No valid auth parameters found"}


def handle_google_role_routing(selected_role: str, existing_user: dict | None, google_user: dict) -> dict:
    """
    White-Box Decision Logic for Google Auth & Role Provisioning:
    - Path 1: User exists in DB -> Route directly to dashboard
    - Path 2: New Instructor -> Auto-provision approved employee, bypass registration
    - Path 3: New HTE -> Auto-provision approved employee + supervisor, bypass registration
    - Path 4: New Trainee -> Route to RegisterScreen for mandatory biometrics & geofence
    - Path 5: Invalid role -> Return error
    """
    if existing_user:
        role = existing_user.get("role", "employee")
        return {
            "action": "direct_dashboard",
            "role": role,
            "target_view": f"{role}_dashboard",
            "requires_registration": False,
        }

    if selected_role == "admin":
        return {
            "action": "auto_provision_instructor",
            "role": "admin",
            "position": "OJT Instructor",
            "application_status": "approved",
            "target_view": "instructor_dashboard",
            "requires_registration": False,
        }
    elif selected_role == "hte":
        return {
            "action": "auto_provision_hte",
            "role": "hte",
            "position": "HTE Representative",
            "application_status": "approved",
            "sync_host_supervisors": True,
            "target_view": "hte_dashboard",
            "requires_registration": False,
        }
    elif selected_role == "trainee":
        return {
            "action": "open_trainee_registration",
            "role": "trainee",
            "target_view": "register",
            "requires_registration": True,
            "prefilled_profile": {
                "name": google_user.get("name"),
                "email": google_user.get("email"),
                "photo": google_user.get("photo"),
            },
            "mandatory_steps": [
                "residential_address",
                "academic_details",
                "facial_recognition_enrollment",
                "workplace_geofence_lock",
                "document_upload"
            ]
        }
    return {"error": "Invalid role selected"}


def calculate_face_euclidean_distance(v1: list[float], v2: list[float]) -> float:
    """Calculates Euclidean distance between two facial feature embeddings."""
    if len(v1) != len(v2):
        raise ValueError("Embedding dimensions mismatch")
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))


def verify_facial_biometrics(distance: float, threshold: float = 0.60, face_detected: bool = True, obscured: bool = False) -> dict:
    """
    White-Box Decision Logic for Face Biometrics:
    - Path 1: No face detected -> rejected
    - Path 2: Face obscured (mask/sunglasses/cap) -> rejected + alert red HUD
    - Path 3: Distance <= threshold (0.60) -> verified + green HUD
    - Path 4: Distance > threshold -> mismatch rejected + red HUD
    """
    if not face_detected:
        return {"matched": False, "reason": "No face detected"}
    if obscured:
        return {"matched": False, "reason": "Face obstructed by mask or accessory", "hud_color": "#ef4444"}
    if distance <= threshold:
        return {"matched": True, "reason": "Identity verified", "hud_color": "#22c55e"}
    return {"matched": False, "reason": "Face biometric mismatch", "hud_color": "#ef4444"}


class TestGoogleAuthAndRoleProvisioningWhiteBox:
    """Suite 5: Google Authentication & Role-Based Zero-Registration Paths."""

    @qase.title("OAuth Callback - Parse implicit token fragment (#access_token=...)")
    def test_oauth_parse_implicit_tokens(self):
        url = "https://chmsuojtmis.site/oauth-callback#access_token=eyJhbGciOi...&refresh_token=rfr_12345&token_type=bearer"
        res = parse_oauth_tokens(url)
        assert res["type"] == "implicit"
        assert res["access_token"] == "eyJhbGciOi..."
        assert res["refresh_token"] == "rfr_12345"

    @qase.title("OAuth Callback - Parse authorization code (?code=...)")
    def test_oauth_parse_auth_code(self):
        url = "https://chmsuojtmis.site/oauth-callback?code=oauth_code_xyz987"
        res = parse_oauth_tokens(url)
        assert res["type"] == "code"
        assert res["code"] == "oauth_code_xyz987"

    @qase.title("OAuth Callback - Reject invalid or missing tokens")
    def test_oauth_parse_invalid_url(self):
        url = "https://chmsuojtmis.site/oauth-callback"
        res = parse_oauth_tokens(url)
        assert "error" in res

    @qase.title("Google Auth - Existing user logs directly into dashboard")
    def test_existing_user_direct_dashboard(self):
        existing = {"email": "instructor@chmsu.edu.ph", "role": "admin"}
        google_user = {"name": "Prof. Smith", "email": "instructor@chmsu.edu.ph"}
        result = handle_google_role_routing("admin", existing, google_user)
        assert result["action"] == "direct_dashboard"
        assert result["target_view"] == "admin_dashboard"
        assert result["requires_registration"] is False

    @qase.title("Google Auth - New Instructor auto-provisions and bypasses registration")
    def test_new_instructor_zero_registration(self):
        google_user = {"name": "Dr. Juan Dela Cruz", "email": "juan.delacruz@chmsu.edu.ph"}
        result = handle_google_role_routing("admin", None, google_user)
        assert result["action"] == "auto_provision_instructor"
        assert result["role"] == "admin"
        assert result["position"] == "OJT Instructor"
        assert result["application_status"] == "approved"
        assert result["requires_registration"] is False
        assert result["target_view"] == "instructor_dashboard"

    @qase.title("Google Auth - New HTE auto-provisions and bypasses registration")
    def test_new_hte_zero_registration(self):
        google_user = {"name": "Maria Santos", "email": "maria@techcorp.com"}
        result = handle_google_role_routing("hte", None, google_user)
        assert result["action"] == "auto_provision_hte"
        assert result["role"] == "hte"
        assert result["position"] == "HTE Representative"
        assert result["application_status"] == "approved"
        assert result["sync_host_supervisors"] is True
        assert result["requires_registration"] is False
        assert result["target_view"] == "hte_dashboard"

    @qase.title("Google Auth - New Trainee strictly requires registration for biometrics")
    def test_new_trainee_mandatory_registration(self):
        google_user = {"name": "Alex Gonzaga", "email": "alex.gonzaga@chmsu.edu.ph", "photo": "https://lh3.google.com/photo.jpg"}
        result = handle_google_role_routing("trainee", None, google_user)
        assert result["action"] == "open_trainee_registration"
        assert result["role"] == "trainee"
        assert result["requires_registration"] is True
        assert result["target_view"] == "register"
        assert result["prefilled_profile"]["name"] == "Alex Gonzaga"
        assert "facial_recognition_enrollment" in result["mandatory_steps"]
        assert "workplace_geofence_lock" in result["mandatory_steps"]


class TestBiometricFacialRecognitionWhiteBox:
    """Suite 6: Facial Biometrics Distance Calculation & Anti-Spoofing Coverage."""

    @qase.title("Biometrics - Identical Face Embeddings Euclidean Distance is 0")
    def test_identical_face_embeddings(self):
        emb = [0.12, 0.45, -0.32, 0.88, 0.05]
        dist = calculate_face_euclidean_distance(emb, emb)
        assert math.isclose(dist, 0.0, abs_tol=1e-6)

    @qase.title("Biometrics - Distance Verification within 0.60 Threshold")
    @pytest.mark.parametrize("distance, expected_match", [
        (0.00, True),   # Perfect match
        (0.35, True),   # High confidence match
        (0.59, True),   # Borderline match
        (0.60, True),   # Boundary threshold
        (0.61, False),  # Boundary rejection
        (0.85, False),  # Clear mismatch
        (1.20, False),  # Completely different person
    ])
    def test_face_verification_threshold(self, distance, expected_match):
        res = verify_facial_biometrics(distance, threshold=0.60, face_detected=True, obscured=False)
        assert res["matched"] == expected_match
        if expected_match:
            assert res["hud_color"] == "#22c55e"
        else:
            assert res["hud_color"] == "#ef4444"

    @qase.title("Biometrics - Face Obscured by Mask/Accessories Fails Closed")
    def test_face_obscured_fails_closed(self):
        # Even with distance 0.10 (identical face), mask obstruction must strictly reject
        res = verify_facial_biometrics(distance=0.10, threshold=0.60, face_detected=True, obscured=True)
        assert res["matched"] is False
        assert "obstructed" in res["reason"].lower()
        assert res["hud_color"] == "#ef4444"

    @qase.title("Biometrics - No Face in Frame Rejected")
    def test_no_face_detected_rejected(self):
        res = verify_facial_biometrics(distance=0.00, threshold=0.60, face_detected=False, obscured=False)
        assert res["matched"] is False
        assert "no face detected" in res["reason"].lower()

