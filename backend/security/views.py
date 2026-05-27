import json
import base64
import uuid
from typing import Any, Dict, List
import logging

# `resend` is an optional dependency used for transactional emails.
# Import it lazily and handle the case where it's not installed so
# `manage.py check` and other import-time operations don't fail.
try:
    import resend  # type: ignore
    RESEND_AVAILABLE = True
except Exception:
    resend = None  # type: ignore
    RESEND_AVAILABLE = False

from django.conf import settings
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.core.files.base import ContentFile
import os
import urllib.request
import urllib.parse

from .api_auth import require_security_api_key
from .utils import decode_base64_image, find_nearest_zone, safe_float, validate_image_brightness
from .models import FaceRegistration, AttendancePhoto

logger = logging.getLogger(__name__)


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
def send_email(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data = _json_body(request)
    to_email = data.get("to")
    subject = data.get("subject")
    html_content = data.get("html")

    if not to_email or not subject or not html_content:
        return JsonResponse({"error": "to, subject, and html are required"}, status=400)

    # Use API key from settings or env
    api_key = getattr(settings, "RESEND_API_KEY", os.environ.get("VITE_RESEND_API_KEY"))
    if not api_key:
        return JsonResponse({"error": "Resend API key not configured on server"}, status=500)

    if not RESEND_AVAILABLE:
        return JsonResponse({"error": "Resend package is not installed on the server. Install `resend` or configure an alternate email sender."}, status=500)

    # Configure resend client and send
    try:
        resend.api_key = api_key
        params = {
            "from": "OJT System <onboarding@resend.dev>",
            "to": to_email if isinstance(to_email, list) else [to_email],
            "subject": subject,
            "html": html_content,
        }
        r = resend.Emails.send(params)
        return JsonResponse({"success": True, "data": r})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


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

    # Extract image binary data and format
    image_binary_data = None
    image_format = 'jpeg'
    
    if image_file:
        # Extract binary data from uploaded file
        image_binary_data = image_file.read()
        # Determine format from filename
        filename_lower = image_file.name.lower()
        if filename_lower.endswith('.png'):
            image_format = 'png'
        elif filename_lower.endswith('.jpg') or filename_lower.endswith('.jpeg'):
            image_format = 'jpeg'
        elif filename_lower.endswith('.gif'):
            image_format = 'gif'
        
        # Save to file system (for backward compatibility)
        image_file.seek(0)  # Reset file pointer
        registration.image.save(image_file.name, image_file, save=False)
    else:
        # Extract binary data from base64
        b64_string = str(image_b64)
        if "," in b64_string:
            # data:image/jpeg;base64,... format
            header, b64_data = b64_string.split(",", 1)
            # Extract format from header (e.g., data:image/jpeg;base64)
            if "image/" in header:
                image_format = header.split("image/")[1].split(";")[0]
        else:
            b64_data = b64_string
        
        # Decode base64 to binary
        image_binary_data = base64.b64decode(b64_data)
        
        # Save to file system (for backward compatibility)
        content = _content_file_from_base64(b64_string, f"{employee_id}_{uuid.uuid4().hex}")
        registration.image.save(content.name, content, save=False)
    
    # Store binary data in database
    registration.image_data = image_binary_data
    registration.image_format = image_format
    registration.save()

    # Validate brightness before processing
    brightness_check = validate_image_brightness(registration.image.path)
    if not brightness_check['valid']:
        # Delete poor image and return error
        registration.image.delete(save=False)
        registration.image_data = None
        registration.save()
        logger.warning(f"Face registration rejected for {employee_id}: {brightness_check['message']}")
        return JsonResponse(
            {
                "success": False,
                "message": brightness_check['message'],
                "status": brightness_check['status'],
                "brightness": brightness_check['brightness'],
                "recommendations": brightness_check['recommendations']
            },
            status=422
        )

    image_url = request.build_absolute_uri(registration.image.url) if registration.image else None

    # Pre-compute and save face encoding for faster future verification
    try:
        import face_recognition # type: ignore
        img = face_recognition.load_image_file(registration.image.path)
        encodings = face_recognition.face_encodings(img)
        if encodings:
            registration.face_encoding = list(encodings[0])
            registration.save()
            logger.info(f"Face registration successful for {employee_id} with brightness {brightness_check['brightness']:.1f} - Image stored in database")
        else:
            logger.warning(f"No face detected in registered image for {employee_id}")
            return JsonResponse({
                "success": False,
                "message": "No face detected in the image. Please try again with a clear photo."
            }, status=422)
    except Exception as e:
        # Don't fail the whole registration if encoding fails, but log it
        logger.error(f"Encoding extraction failed for {employee_id}: {e}")

    return JsonResponse({
        "success": True,
        "image_url": image_url,
        "brightness": brightness_check['brightness'],
        "status": brightness_check['status']
    })


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

    known_encoding = None
    if employee_id:
        registration = FaceRegistration.objects.filter(employee_id=employee_id).first()
        if not registration or not registration.image:
            return JsonResponse(
                {"success": False, "message": "No registered face found for this employee."},
                status=404,
            )
        
        # Use stored encoding if available (Much faster!)
        if registration.face_encoding:
            import numpy as np # type: ignore
            known_encoding = np.array(registration.face_encoding)
        else:
            known_image = face_recognition.load_image_file(registration.image.path)
            known_encodings = face_recognition.face_encodings(known_image)
            if known_encodings:
                known_encoding = known_encodings[0]
                # Cache it for next time
                registration.face_encoding = list(known_encoding)
                registration.save()
    elif registered_file:
        known_image = face_recognition.load_image_file(registered_file)
        known_encodings = face_recognition.face_encodings(known_image)
        if known_encodings: known_encoding = known_encodings[0]
    else:
        registered_b64 = data.get("registered_image")
        if not registered_b64:
            return JsonResponse(
                {"success": False, "message": "registered_image or employee_id is required."},
                status=400,
            )
        known_image = face_recognition.load_image_file(decode_base64_image(registered_b64))
        known_encodings = face_recognition.face_encodings(known_image)
        if known_encodings: known_encoding = known_encodings[0]

    if known_encoding is None:
        return JsonResponse(
            {"success": False, "message": "No face found in registered image/data."},
            status=422,
        )

    if captured_file:
        unknown_image = face_recognition.load_image_file(captured_file)
        tol_raw = request.POST.get("tolerance")
        if tol_raw is not None:
            tolerance = safe_float(tol_raw, tolerance)
        capture_image_path = captured_file.temporary_file_path()
    else:
        captured_b64 = data.get("captured_image")
        tolerance = safe_float(data.get("tolerance", tolerance), tolerance)
        if not captured_b64:
            return JsonResponse(
                {"success": False, "message": "captured_image is required."},
                status=400,
            )
        unknown_image = face_recognition.load_image_file(decode_base64_image(captured_b64))
        # For base64 images, we need to save temporarily to check brightness
        import tempfile
        temp_fd, capture_image_path = tempfile.mkstemp(suffix='.jpg')
        try:
            from PIL import Image as PILImage
            pil_img = PILImage.fromarray(unknown_image)
            pil_img.save(capture_image_path, 'JPEG')
        except Exception as e:
            logger.warning(f"Could not save temporary image for brightness check: {e}")
            capture_image_path = None
        finally:
            try:
                os.close(temp_fd)
            except:
                pass

    # NEW: Check brightness of captured image
    if capture_image_path:
        brightness_check = validate_image_brightness(capture_image_path)
        if brightness_check['status'] == 'dark':
            logger.warning(f"Captured image too dark for {employee_id}: brightness {brightness_check['brightness']:.1f}")
            return JsonResponse(
                {
                    "success": False,
                    "message": "The image is too dark. Please capture in a brighter environment.",
                    "status": brightness_check['status'],
                    "brightness": brightness_check['brightness'],
                    "recommendations": brightness_check['recommendations']
                },
                status=422
            )

    unknown_encodings = face_recognition.face_encodings(unknown_image)

    if not unknown_encodings:
        return JsonResponse(
            {"success": False, "message": "No face found in captured image."},
            status=422,
        )

    distance = face_recognition.face_distance([known_encoding], unknown_encodings[0])[0]
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
    
    # Extract image binary data and format
    image_binary_data = None
    image_format = 'jpeg'
    
    if image_file:
        # Extract binary data from uploaded file
        image_binary_data = image_file.read()
        # Determine format from filename
        filename_lower = image_file.name.lower()
        if filename_lower.endswith('.png'):
            image_format = 'png'
        elif filename_lower.endswith('.jpg') or filename_lower.endswith('.jpeg'):
            image_format = 'jpeg'
        elif filename_lower.endswith('.gif'):
            image_format = 'gif'
        
        # Save to file system (for backward compatibility)
        image_file.seek(0)  # Reset file pointer
        record.image.save(image_file.name, image_file, save=False)
    else:
        # Extract binary data from base64
        b64_string = str(image_b64)
        if "," in b64_string:
            # data:image/jpeg;base64,... format
            header, b64_data = b64_string.split(",", 1)
            # Extract format from header (e.g., data:image/jpeg;base64)
            if "image/" in header:
                image_format = header.split("image/")[1].split(";")[0]
        else:
            b64_data = b64_string
        
        # Decode base64 to binary
        image_binary_data = base64.b64decode(b64_data)
        
        # Save to file system (for backward compatibility)
        content = _content_file_from_base64(b64_string, f"{employee_id}_{action}_{uuid.uuid4().hex}")
        record.image.save(content.name, content, save=False)
    
    # Store binary data in database
    record.image_data = image_binary_data
    record.image_format = image_format
    record.save()
    
    logger.info(f"Attendance photo saved for {employee_id} ({action}) - Image stored in database with format {image_format}")

    image_url = request.build_absolute_uri(record.image.url) if record.image else None
    return JsonResponse({
        "success": True,
        "image_url": image_url,
        "image_stored_in_database": True,
        "image_format": image_format
    })


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


@csrf_exempt
def mobile_register(request: HttpRequest) -> JsonResponse:
    """Simple receiver endpoint for mobile app prototype.

    Accepts a multipart POST with:
    - payload: JSON string containing fullName, age, email, address, location (optional)
    - photo: optional uploaded image file

    Creates a Django User + Student profile and stores photo as FaceRegistration for testing.
    This endpoint is intentionally permissive for prototype/testing only.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    # API key check (if configured). Accept header `X-OJT-API-KEY` or `X-API-KEY`.
    expected_key = getattr(settings, "SECURITY_API_KEY", "")
    logger = logging.getLogger(__name__)
    if expected_key:
        provided = None
        # Django exposes headers in META as HTTP_<HEADER_NAME_UPPER>
        provided = request.META.get("HTTP_X_OJT_API_KEY") or request.META.get("HTTP_X_API_KEY")
        # Also try common access via request.headers if available
        try:
            provided = provided or request.headers.get("X-OJT-API-KEY") or request.headers.get("X-API-KEY")
        except Exception:
            pass
        if not provided or str(provided).strip() != str(expected_key).strip():
            # Log the failed attempt with remote addr and provided header (do not log expected key)
            remote = request.META.get("REMOTE_ADDR") or request.META.get("HTTP_X_FORWARDED_FOR") or "unknown"
            logger.warning("mobile_register: invalid api key from %s (provided=%s) path=%s", remote, provided, request.path)
            return JsonResponse({"error": "invalid_api_key"}, status=403)

    payload_raw = request.POST.get("payload")
    data = {}
    try:
        if payload_raw:
            data = json.loads(payload_raw)
        else:
            # fallback: try JSON body
            data = _json_body(request)
    except Exception:
        data = {}

    full_name = data.get("fullName") or data.get("name") or ''
    age = data.get("age")
    email = data.get("email")
    address = data.get("address") or ''

    if not full_name or not email:
        return JsonResponse({"error": "fullName and email are required"}, status=400)

    # split full name into first/last
    parts = full_name.strip().split()
    first_name = parts[0] if parts else ''
    last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

    from django.contrib.auth.models import User
    # create or get user by email
    user, created = User.objects.get_or_create(username=email, defaults={
        'email': email,
        'first_name': first_name,
        'last_name': last_name,
    })

    # create Student profile if not exists
    student = None
    try:
        student = user.student_profile
    except Exception:
        student = None

    if not student:
        # create a Student record
        from .models import Student
        student = Student.objects.create(user=user, age=(int(age) if age else None), address=address)
    else:
        # update fields
        student.age = int(age) if age else student.age
        if address:
            student.address = address
        student.save()

    # Save attached photo (if provided) to FaceRegistration for quick testing
    photo = request.FILES.get('photo')
    if photo:
        try:
            from .models import FaceRegistration
            emp_id = f"mobile-{int(uuid.uuid4().int >> 64)}"
            reg = FaceRegistration.objects.create(employee_id=emp_id)
            reg.image.save(photo.name, photo, save=True)
            image_url = request.build_absolute_uri(reg.image.url)
        except Exception:
            image_url = None
    else:
        image_url = None

    return JsonResponse({
        "success": True,
        "user_id": user.id,
        "created": created,
        "student_id": student.id if student else None,
        "face_image_url": image_url,
    })
