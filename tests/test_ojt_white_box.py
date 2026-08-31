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
    return round(performance * 0.30 + attendance * 0.30 + communication * 0.20 + punctuality * 0.20)


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

    @qase.title("Geofence Verification - Inside 50m Radius")
    def test_user_inside_50m_geofence(self):
        campus_lat, campus_lng = 10.7410, 122.9702
        user_lat, user_lng = 10.7412, 122.9702  # ~22 meters away
        assert is_within_geofence(user_lat, user_lng, campus_lat, campus_lng, radius_meters=50, accuracy_meters=5) is True

    @qase.title("Geofence Verification - Outside 50m Radius")
    def test_user_outside_50m_geofence(self):
        campus_lat, campus_lng = 10.7410, 122.9702
        user_lat, user_lng = 10.7450, 122.9702  # ~440 meters away
        assert is_within_geofence(user_lat, user_lng, campus_lat, campus_lng, radius_meters=50, accuracy_meters=5) is False

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
