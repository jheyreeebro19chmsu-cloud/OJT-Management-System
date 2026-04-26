import json
import base64
import uuid
from typing import Any, Dict, List

from django.conf import settings
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.core.files.base import ContentFile
import os
import urllib.request
import urllib.parse

from .api_auth import require_security_api_key
from .utils import decode_base64_image, find_nearest_zone, safe_float
from .models import FaceRegistration, AttendancePhoto


def _face_backend_available() -> bool:
    try:
        import face_recognition  # noqa: F401
        return True
    except BaseException:
        return False


def _json_body(request: HttpRequest) -> Dict[str, Any]:
    try:
        if request.body:
            return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}
    return {}


def health(_: HttpRequest) -> JsonResponse:
    return JsonResponse(
        {
            "status": "ok",
            "face_recognition_installed": _face_backend_available(),
            "geofence_advisory": True,
            "note": "Geofence checks use client-reported GPS; treat as advisory, not cryptographic proof of location.",
        }
    )


def _content_file_from_base64(data: str, prefix: str) -> ContentFile:
    ext = "jpg"
    if data.startswith("data:image/"):
        try:
            ext = data.split("data:image/")[1].split(";")[0] or "jpg"
        except Exception:
            ext = "jpg"
    payload = data.split(",", 1)[1] if "," in data else data
    return ContentFile(base64.b64decode(payload), name=f"{prefix}.{ext}")


def _employee_id_from_request(request: HttpRequest, data: Dict[str, Any]):
    return request.POST.get("employee_id") or data.get("employee_id")


@csrf_exempt
@require_security_api_key
def check_geofence(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data = _json_body(request)
    lat = data.get("lat")
    lng = data.get("lng")

    if lat is None or lng is None:
        return JsonResponse({"error": "lat and lng are required"}, status=400)

    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return JsonResponse({"error": "lat and lng must be numbers"}, status=400)

    zones: List[Dict[str, Any]] = data.get("zones") or getattr(settings, "DEFAULT_GEOFENCE_ZONES", [])
    active_zones = [z for z in zones if z.get("active", True)]

    if not active_zones:
        return JsonResponse(
            {
                "inside": True,
                "reason": "no_active_zones",
                "distance_m": None,
                "zone": None,
                "geofence_advisory": True,
            }
        )

    nearest_zone, nearest_distance = find_nearest_zone(lat_f, lng_f, active_zones)
    if nearest_zone is None:
        return JsonResponse({"inside": False, "reason": "no_zones"}, status=400)

    radius = safe_float(nearest_zone.get("radius"), 0.0)
    # Consider client-reported accuracy if provided. Be conservative: treat user as outside unless
    # (distance + accuracy) <= radius.
    accuracy = safe_float(data.get("accuracy"), 0.0)
    inside = nearest_distance is not None and (nearest_distance + (accuracy or 0.0)) <= radius

    return JsonResponse(
        {
            "inside": inside,
            "distance_m": nearest_distance,
            "zone": {
                "name": nearest_zone.get("name"),
                "lat": safe_float(nearest_zone.get("lat")),
                "lng": safe_float(nearest_zone.get("lng")),
                "radius": radius,
            },
            "accuracy_m": accuracy,
            "geofence_advisory": True,
            "advisory_note": "Server recomputed distance from reported coordinates; GPS can be inaccurate or spoofed.",
        }
    )


@csrf_exempt
@require_security_api_key
def register_face(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data = _json_body(request)
    employee_id = _employee_id_from_request(request, data)

    if not employee_id:
        return JsonResponse({"error": "employee_id is required"}, status=400)

    image_file = request.FILES.get("image") or request.FILES.get("registered_image")
    image_b64 = data.get("image") or data.get("registered_image")

    if not image_file and not image_b64:
        return JsonResponse({"error": "image is required"}, status=400)

    registration, _ = FaceRegistration.objects.get_or_create(employee_id=employee_id)
    if registration.image:
        registration.image.delete(save=False)

    if image_file:
        registration.image.save(image_file.name, image_file, save=True)
    else:
        content = _content_file_from_base64(str(image_b64), f"{employee_id}_{uuid.uuid4().hex}")
        registration.image.save(content.name, content, save=True)

    image_url = request.build_absolute_uri(registration.image.url)
    return JsonResponse({"success": True, "image_url": image_url})


@csrf_exempt
@require_security_api_key
def verify_face(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        import face_recognition  # type: ignore
    except BaseException:
        return JsonResponse(
            {
                "success": False,
                "message": "face_recognition is not installed on the server.",
            },
            status=501,
        )

    data = _json_body(request)
    employee_id = _employee_id_from_request(request, data)

    registered_file = request.FILES.get("registered_image")
    captured_file = request.FILES.get("captured_image")
    default_tol = float(getattr(settings, "FACE_RECOGNITION_TOLERANCE", 0.6))
    tolerance = default_tol

    if employee_id:
        registration = FaceRegistration.objects.filter(employee_id=employee_id).first()
        if not registration or not registration.image:
            return JsonResponse(
                {"success": False, "message": "No registered face found for this employee."},
                status=404,
            )
        known_image = face_recognition.load_image_file(registration.image.path)
    elif registered_file:
        known_image = face_recognition.load_image_file(registered_file)
    else:
        registered_b64 = data.get("registered_image")
        if not registered_b64:
            return JsonResponse(
                {"success": False, "message": "registered_image or employee_id is required."},
                status=400,
            )
        known_image = face_recognition.load_image_file(decode_base64_image(registered_b64))

    if captured_file:
        unknown_image = face_recognition.load_image_file(captured_file)
        tol_raw = request.POST.get("tolerance")
        if tol_raw is not None:
            tolerance = safe_float(tol_raw, tolerance)
    else:
        captured_b64 = data.get("captured_image")
        tolerance = safe_float(data.get("tolerance", tolerance), tolerance)
        if not captured_b64:
            return JsonResponse(
                {"success": False, "message": "captured_image is required."},
                status=400,
            )
        unknown_image = face_recognition.load_image_file(decode_base64_image(captured_b64))

    known_encodings = face_recognition.face_encodings(known_image)
    unknown_encodings = face_recognition.face_encodings(unknown_image)

    if not known_encodings:
        return JsonResponse(
            {"success": False, "message": "No face found in registered image."},
            status=422,
        )

    if not unknown_encodings:
        return JsonResponse(
            {"success": False, "message": "No face found in captured image."},
            status=422,
        )

    distance = face_recognition.face_distance([known_encodings[0]], unknown_encodings[0])[0]
    matched = distance <= tolerance
    confidence = max(0.0, 1.0 - float(distance))

    return JsonResponse(
        {
            "success": True,
            "matched": matched,
            "distance": float(distance),
            "tolerance": float(tolerance),
            "confidence": confidence,
            "message": "Face matched." if matched else "Face did not match.",
        }
    )


@csrf_exempt
@require_security_api_key
def save_attendance_photo(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data = _json_body(request)
    employee_id = _employee_id_from_request(request, data)
    action = request.POST.get("action") or data.get("action")

    if not employee_id or not action:
        return JsonResponse({"error": "employee_id and action are required"}, status=400)

    if action not in ("in", "out"):
        return JsonResponse({"error": "action must be 'in' or 'out'"}, status=400)

    image_file = request.FILES.get("image") or request.FILES.get("photo")
    image_b64 = data.get("image") or data.get("photo")

    if not image_file and not image_b64:
        return JsonResponse({"error": "image is required"}, status=400)

    record = AttendancePhoto(employee_id=employee_id, action=action)
    if image_file:
        record.image.save(image_file.name, image_file, save=True)
    else:
        content = _content_file_from_base64(str(image_b64), f"{employee_id}_{action}_{uuid.uuid4().hex}")
        record.image.save(content.name, content, save=True)

    image_url = request.build_absolute_uri(record.image.url)
    return JsonResponse({"success": True, "image_url": image_url})


def geonames_proxy(request: HttpRequest) -> JsonResponse:
    """Proxy Geonames requests through the server so the username stays secret.

    Accepts GET parameters:
    - q: search query (uses searchJSON)
    - geonameId: numeric id (uses getJSON)
    - maxRows: optional for search
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    username = getattr(settings, "GEONAMES_USERNAME", None) or os.environ.get("GEONAMES_USERNAME")
    if not username:
        return JsonResponse({"error": "GEONAMES_USERNAME not configured on server"}, status=500)

    q = request.GET.get("q")
    geoname_id = request.GET.get("geonameId") or request.GET.get("id")
    try:
        if geoname_id:
            url = f"http://api.geonames.org/getJSON?geonameId={urllib.parse.quote(str(geoname_id))}&username={urllib.parse.quote(username)}"
        elif q:
            maxRows = request.GET.get("maxRows", "10")
            url = f"http://api.geonames.org/searchJSON?q={urllib.parse.quote(q)}&maxRows={urllib.parse.quote(str(maxRows))}&username={urllib.parse.quote(username)}"
        else:
            return JsonResponse({"error": "q or geonameId is required"}, status=400)

        with urllib.request.urlopen(url, timeout=8) as resp:
            body = resp.read()
            data = json.loads(body.decode("utf-8"))
            return JsonResponse(data)
    except Exception as exc:
        return JsonResponse({"error": "geonames_proxy_failed", "detail": str(exc)}, status=502)


@csrf_exempt
def geonames_countries(request: HttpRequest) -> JsonResponse:
    """Return list of countries from Geonames countryInfoJSON"""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    username = getattr(settings, "GEONAMES_USERNAME", None) or os.environ.get("GEONAMES_USERNAME")
    if not username:
        return JsonResponse({"error": "GEONAMES_USERNAME not configured on server"}, status=500)
    try:
        url = f"http://api.geonames.org/countryInfoJSON?username={urllib.parse.quote(username)}"
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return JsonResponse(data)
    except Exception as exc:
        return JsonResponse({"error": "geonames_countries_failed", "detail": str(exc)}, status=502)


@csrf_exempt
def geonames_cities(request: HttpRequest) -> JsonResponse:
    """Search cities using Geonames searchJSON. Query params: q, country (ISO code), maxRows"""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    username = getattr(settings, "GEONAMES_USERNAME", None) or os.environ.get("GEONAMES_USERNAME")
    if not username:
        return JsonResponse({"error": "GEONAMES_USERNAME not configured on server"}, status=500)
    q = request.GET.get("q") or request.GET.get("query")
    country = request.GET.get("country")
    maxRows = request.GET.get("maxRows", "50")
    if not q:
        return JsonResponse({"geonames": []})
    try:
        url = f"http://api.geonames.org/searchJSON?q={urllib.parse.quote(q)}&maxRows={urllib.parse.quote(str(maxRows))}&username={urllib.parse.quote(username)}&featureClass=P"
        if country:
            url += f"&country={urllib.parse.quote(country)}"
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return JsonResponse(data)
    except Exception as exc:
        return JsonResponse({"error": "geonames_cities_failed", "detail": str(exc)}, status=502)


@csrf_exempt
def osm_streets(request: HttpRequest) -> JsonResponse:
    """Search streets using Nominatim. Query params: street (q), city, country"""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    street = request.GET.get("street") or request.GET.get("q")
    city = request.GET.get("city")
    country = request.GET.get("country")
    limit = request.GET.get("limit", "50")
    if not street:
        return JsonResponse({"results": []})
    try:
        params = {
            "street": street,
            "format": "json",
            "addressdetails": 1,
            "limit": limit,
        }
        if city:
            params["city"] = city
        if country:
            params["country"] = country
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
        # Nominatim requires a proper User-Agent
        req = urllib.request.Request(url, headers={"User-Agent": "OJTSys/1.0 (contact@example.com)"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return JsonResponse({"results": data})
    except Exception as exc:
        return JsonResponse({"error": "osm_streets_failed", "detail": str(exc)}, status=502)
