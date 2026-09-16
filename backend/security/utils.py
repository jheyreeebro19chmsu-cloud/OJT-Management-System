from __future__ import annotations

import base64
import io
import math
from typing import Dict, Iterable, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in meters."""
    radius = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def find_nearest_zone(
    lat: float,
    lng: float,
    zones: Iterable[Dict[str, float | str | bool]],
) -> Tuple[Optional[Dict[str, float | str | bool]], Optional[float]]:
    nearest_zone = None
    nearest_distance = None
    for zone in zones:
        z_lat = float(zone.get("lat", 0))
        z_lng = float(zone.get("lng", 0))
        distance = calculate_distance(lat, lng, z_lat, z_lng)
        if nearest_distance is None or distance < nearest_distance:
            nearest_zone = zone
            nearest_distance = distance
    return nearest_zone, nearest_distance


def decode_base64_image(data: str) -> io.BytesIO:
    if "," in data:
        _, b64 = data.split(",", 1)
    else:
        b64 = data
    return io.BytesIO(base64.b64decode(b64))


def safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def validate_image_quality(
    image_path: str,
    min_resolution: int = 160,
    min_brightness: int = 25,
    max_brightness: int = 240,
    min_contrast: int = 14,
    min_sharpness: float = 12.0,
) -> Dict[str, any]:
    """
    Validate comprehensive image quality for biometric face registration and verification.
    Checks resolution, sharpness (blur detection via Laplacian variance), brightness, and contrast.
    Automatically applies EXIF transpose to handle mobile/Expo camera orientation.

    Args:
        image_path: Path to image file on disk
        min_resolution: Minimum width and height in pixels (default 160)
        min_brightness: Minimum average luminance (default 25)
        max_brightness: Maximum average luminance (default 240)
        min_contrast: Minimum standard deviation of grayscale pixels (default 14)
        min_sharpness: Minimum variance of Laplacian (default 12.0, lower is blurrier)

    Returns:
        dict with valid status, metrics, message, and recommendations
    """
    try:
        from PIL import Image, ImageOps
        import numpy as np

        img = Image.open(image_path)
        # Auto-rotate according to EXIF tag so mobile photos taken in portrait are not analyzed sideways
        try:
            img = ImageOps.exif_transpose(img) or img
        except Exception:
            pass

        width, height = img.size

        # 1. Minimum Resolution Check
        if width < min_resolution or height < min_resolution:
            return {
                'valid': False,
                'status': 'low_resolution',
                'brightness': 128.0,
                'blur_score': 0.0,
                'contrast': 0.0,
                'width': width,
                'height': height,
                'message': f"Image resolution is too low ({width}x{height}, minimum {min_resolution}x{min_resolution}). Move closer to camera.",
                'recommendations': ['Move closer to the camera', 'Use a higher resolution camera stream'],
            }

        # Convert to grayscale array for luminance, blur, and contrast analysis
        gray = np.array(img.convert('L'), dtype=np.float32)

        avg_brightness = float(np.mean(gray))
        std_contrast = float(np.std(gray))

        # 2. Blur / Sharpness Calculation using Discrete Laplacian Operator
        if gray.shape[0] >= 3 and gray.shape[1] >= 3:
            laplacian = (
                gray[:-2, 1:-1]
                + gray[2:, 1:-1]
                + gray[1:-1, :-2]
                + gray[1:-1, 2:]
                - 4.0 * gray[1:-1, 1:-1]
            )
            blur_score = float(np.var(laplacian))
        else:
            blur_score = 0.0

        # 3. Brightness Evaluation
        if avg_brightness < min_brightness:
            return {
                'valid': False,
                'status': 'dark',
                'brightness': avg_brightness,
                'blur_score': blur_score,
                'contrast': std_contrast,
                'width': width,
                'height': height,
                'message': f"The image is too dark (brightness: {avg_brightness:.1f}/{min_brightness}). Please capture in a brighter environment.",
                'recommendations': ['Turn on more lights', 'Move in front of a light, well-lit background', 'Move closer to light'],
            }

        if avg_brightness > max_brightness:
            return {
                'valid': False,
                'status': 'bright',
                'brightness': avg_brightness,
                'blur_score': blur_score,
                'contrast': std_contrast,
                'width': width,
                'height': height,
                'message': f"The image is overexposed with too much glare (brightness: {avg_brightness:.1f}/{max_brightness}).",
                'recommendations': ['Avoid direct blinding glare', 'Move away from intense backlight'],
            }

        # 4. Contrast Evaluation
        if std_contrast < min_contrast:
            return {
                'valid': False,
                'status': 'low_contrast',
                'brightness': avg_brightness,
                'blur_score': blur_score,
                'contrast': std_contrast,
                'width': width,
                'height': height,
                'message': f"The image has poor contrast ({std_contrast:.1f}/{min_contrast}). Please ensure clear front lighting.",
                'recommendations': ['Adjust front lighting', 'Avoid washed-out background illumination'],
            }

        # 5. Sharpness / Blur Evaluation
        if blur_score < min_sharpness:
            return {
                'valid': False,
                'status': 'blurry',
                'brightness': avg_brightness,
                'blur_score': blur_score,
                'contrast': std_contrast,
                'width': width,
                'height': height,
                'message': f"The image is too blurry (sharpness: {blur_score:.1f}/{min_sharpness}). Hold camera steady.",
                'recommendations': ['Hold the device steady', 'Clean the camera lens', 'Ensure face is in focus before capturing'],
            }

        # 6. Zero-Tolerance Bare-Face Obstruction Evaluation (Glasses, Hats, Caps, Masks)
        obstruction_check = validate_face_obstruction(image_path)
        if not obstruction_check.get('valid', True):
            obstruction_check.update({
                'brightness': avg_brightness,
                'blur_score': blur_score,
                'contrast': std_contrast,
                'width': width,
                'height': height,
            })
            return obstruction_check

        return {
            'valid': True,
            'status': 'good',
            'brightness': avg_brightness,
            'blur_score': blur_score,
            'contrast': std_contrast,
            'width': width,
            'height': height,
            'message': 'Image quality acceptable for biometric processing.',
            'recommendations': [],
        }

    except Exception as e:
        logger.error(f"Image quality validation error for {image_path}: {e}")
        return {
            'valid': False,
            'status': 'unknown',
            'brightness': 128.0,
            'blur_score': 0.0,
            'contrast': 0.0,
            'width': 0,
            'height': 0,
            'message': f'Failed to validate image quality: {str(e)}',
            'recommendations': ['Please try again with a clear photo'],
        }


def validate_face_obstruction(image_path: str) -> Dict[str, any]:
    """
    Zero-tolerance bare-face obstruction inspection.
    Detects eyeglasses, sunglasses, hats, caps, and face masks using facial landmark analysis.
    Institutional policy strictly requires a 100% bare face.
    """
    try:
        from PIL import Image, ImageOps
        import numpy as np

        img = Image.open(image_path)
        try:
            img = ImageOps.exif_transpose(img) or img
        except Exception:
            pass

        img_rgb = np.array(img.convert('RGB'))
        h, w, _ = img_rgb.shape

        # Extract landmarks using face_recognition
        try:
            import face_recognition
            landmarks_list = face_recognition.face_landmarks(img_rgb)
        except Exception:
            landmarks_list = []

        if not landmarks_list:
            return {'valid': True, 'status': 'no_landmarks'}

        def get_pixel(x, y):
            cx = max(0, min(w - 1, int(round(x))))
            cy = max(0, min(h - 1, int(round(y))))
            r, g, b = img_rgb[cy, cx][:3]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            return {'r': int(r), 'g': int(g), 'b': int(b), 'lum': float(lum)}

        def get_patch_avg(cx, cy, radius=2):
            r_sum, g_sum, b_sum, lum_sum, count = 0, 0, 0, 0.0, 0
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    p = get_pixel(cx + dx, cy + dy)
                    r_sum += p['r']
                    g_sum += p['g']
                    b_sum += p['b']
                    lum_sum += p['lum']
                    count += 1
            return {
                'r': r_sum // count,
                'g': g_sum // count,
                'b': b_sum // count,
                'lum': lum_sum / count,
            }

        for lm in landmarks_list:
            nb = lm.get('nose_bridge', [])
            le = lm.get('left_eye', [])
            re = lm.get('right_eye', [])
            leb = lm.get('left_eyebrow', [])
            reb = lm.get('right_eyebrow', [])
            chin = lm.get('chin', [])
            tip = lm.get('nose_tip', [])

            if len(nb) < 4 or len(le) < 6 or len(re) < 6 or len(chin) < 14:
                continue

            # 1. Skin tone baseline from cheeks
            cx1 = (tip[0][0] + chin[3][0]) / 2.0
            cy1 = (tip[0][1] + chin[3][1]) / 2.0
            cx2 = (tip[-1][0] + chin[13][0]) / 2.0
            cy2 = (tip[-1][1] + chin[13][1]) / 2.0

            c1 = get_patch_avg(cx1, cy1, 3)
            c2 = get_patch_avg(cx2, cy2, 3)
            skin_r = (c1['r'] + c2['r']) // 2
            skin_g = (c1['g'] + c2['g']) // 2
            skin_b = (c1['b'] + c2['b']) // 2
            skin_lum = max(35.0, (c1['lum'] + c2['lum']) / 2.0)

            # 2. Hat / Cap Detection
            if leb and reb:
                brow_y = (leb[-1][1] + reb[0][1]) / 2.0
                brow_x = nb[0][0]
                fore1 = get_patch_avg(brow_x, brow_y - 14, 2)
                fore2 = get_patch_avg(brow_x, brow_y - 26, 2)
                fore3 = get_patch_avg(brow_x, brow_y - 38, 2)

                fore_diff1 = abs(fore1['r'] - skin_r) + abs(fore1['g'] - skin_g) + abs(fore1['b'] - skin_b)
                fore_diff2 = abs(fore2['r'] - skin_r) + abs(fore2['g'] - skin_g) + abs(fore2['b'] - skin_b)
                fore_diff3 = abs(fore3['r'] - skin_r) + abs(fore3['g'] - skin_g) + abs(fore3['b'] - skin_b)

                is_fabric = (fore_diff1 > 28 or fore_diff2 > 28 or fore_diff3 > 28)
                is_brim_shadow = (fore1['lum'] < skin_lum * 0.58 and fore2['lum'] < skin_lum * 0.58)

                if is_fabric or is_brim_shadow:
                    return {
                        'valid': False,
                        'status': 'cap_detected',
                        'message': '🚨 HAT / CAP DETECTED! Institutional policy strictly requires a 100% bare face. Please remove headwear to scan.',
                        'recommendations': ['Remove hats, caps, and headwear', 'Ensure face and forehead are completely bare'],
                    }

            # 3. Glasses Detection
            bridge_x, bridge_y = nb[0][0], nb[0][1]
            bridge_patch = get_patch_avg(bridge_x, bridge_y, 2)
            bridge_diff = abs(bridge_patch['r'] - skin_r) + abs(bridge_patch['g'] - skin_g) + abs(bridge_patch['b'] - skin_b)

            bridge_top = get_pixel(bridge_x, bridge_y - 4)
            bridge_bot = get_pixel(bridge_x, bridge_y + 4)
            bridge_v_contrast = abs(bridge_top['lum'] - bridge_patch['lum']) + abs(bridge_bot['lum'] - bridge_patch['lum'])

            inner_l = le[3]  # left eye inner corner
            inner_r = re[0]  # right eye inner corner
            span_lums = []
            span_diffs = []
            for step in range(1, 5):
                sx = inner_r[0] + (inner_l[0] - inner_r[0]) * (step / 5.0)
                sy = inner_r[1] + (inner_l[1] - inner_r[1]) * (step / 5.0)
                sp = get_pixel(sx, sy)
                span_lums.append(sp['lum'])
                span_diffs.append(abs(sp['r'] - skin_r) + abs(sp['g'] - skin_g) + abs(sp['b'] - skin_b))

            span_var = (max(span_lums) - min(span_lums)) if span_lums else 0
            avg_span_diff = (sum(span_diffs) / len(span_diffs)) if span_diffs else 0

            has_bridge_frame = (
                bridge_diff > 14
                or avg_span_diff > 15
                or span_var > 14
                or bridge_v_contrast > 12
                or bridge_patch['lum'] < skin_lum * 0.74
                or bridge_patch['lum'] > skin_lum * 1.35
            )

            # Lower orbital rims below eyes
            r_lower = get_pixel(re[4][0], re[4][1] + 5)
            l_lower = get_pixel(le[4][0], le[4][1] + 5)
            r_rim_diff = abs(r_lower['r'] - skin_r) + abs(r_lower['g'] - skin_g) + abs(r_lower['b'] - skin_b)
            l_rim_diff = abs(l_lower['r'] - skin_r) + abs(l_lower['g'] - skin_g) + abs(l_lower['b'] - skin_b)
            has_lower_rim = (r_rim_diff > 18 or l_rim_diff > 18 or r_lower['lum'] < skin_lum * 0.68 or l_lower['lum'] < skin_lum * 0.68)

            # Eye centers: dark sunglasses or specular lens glint
            re_cx = sum(p[0] for p in re) / len(re)
            re_cy = sum(p[1] for p in re) / len(re)
            le_cx = sum(p[0] for p in le) / len(le)
            le_cy = sum(p[1] for p in le) / len(le)
            re_center = get_pixel(re_cx, re_cy)
            le_center = get_pixel(le_cx, le_cy)

            is_dark = (re_center['lum'] < 45 and le_center['lum'] < 45 and skin_lum > 48)
            re_color_diff = abs(re_center['r'] - skin_r) + abs(re_center['g'] - skin_g) + abs(re_center['b'] - skin_b)
            le_color_diff = abs(le_center['r'] - skin_r) + abs(le_center['g'] - skin_g) + abs(le_center['b'] - skin_b)
            is_glare = (
                re_center['lum'] > 200 or le_center['lum'] > 200
                or re_center['lum'] > skin_lum + 50 or le_center['lum'] > skin_lum + 50
                or re_color_diff > 45 or le_color_diff > 45
            )

            if has_bridge_frame or has_lower_rim or is_dark or is_glare:
                return {
                    'valid': False,
                    'status': 'glasses_detected',
                    'message': '🚨 GLASSES DETECTED! Institutional policy strictly requires a 100% bare face. Please remove eyeglasses / sunglasses to scan.',
                    'recommendations': ['Remove eyeglasses or sunglasses', 'Hold face clearly and unobstructed'],
                }

            # 4. Face Mask Detection
            top_lip = lm.get('top_lip', [])
            if tip and top_lip and chin:
                phil_x = (tip[2][0] + top_lip[3][0]) / 2.0
                phil_y = (tip[2][1] + top_lip[3][1]) / 2.0
                chin_x = chin[8][0]
                chin_y = (chin[8][1] + top_lip[-1][1]) / 2.0

                phil_p = get_patch_avg(phil_x, phil_y, 2)
                chin_p = get_patch_avg(chin_x, chin_y, 2)

                phil_diff = abs(phil_p['r'] - skin_r) + abs(phil_p['g'] - skin_g) + abs(phil_p['b'] - skin_b)
                chin_diff = abs(chin_p['r'] - skin_r) + abs(chin_p['g'] - skin_g) + abs(chin_p['b'] - skin_b)

                is_blue = (phil_p['b'] > phil_p['r'] + 25 and phil_p['b'] > 70) or (chin_p['b'] > chin_p['r'] + 25 and chin_p['b'] > 70)
                is_black = (phil_p['lum'] < 26 and chin_p['lum'] < 26 and skin_lum > 55)
                is_mask_fabric = (phil_diff > 55 and chin_diff > 55)

                if is_blue or is_black or is_mask_fabric:
                    return {
                        'valid': False,
                        'status': 'mask_detected',
                        'message': '🚨 FACE MASK DETECTED! Please remove face mask to scan.',
                        'recommendations': ['Remove face mask', 'Ensure nose, mouth, and chin are completely visible'],
                    }

        return {'valid': True, 'status': 'clear'}
    except Exception as e:
        logger.warning(f"validate_face_obstruction error: {e}")
        return {'valid': True, 'status': 'fallback'}


def validate_image_brightness(image_path: str, min_brightness: int = 15, max_brightness: int = 245) -> Dict[str, any]:
    """
    Validate image quality and brightness for face recognition.
    Delegates to validate_image_quality for comprehensive gating.
    """
    res = validate_image_quality(image_path, min_brightness=min_brightness, max_brightness=max_brightness)
    return res


def image_binary_to_base64(image_binary: bytes, image_format: str = 'jpeg') -> str:
    """
    Convert image binary data from database to base64 data URL.
    
    Args:
        image_binary: Binary image data from database
        image_format: Image format (jpeg, png, gif, etc.)
    
    Returns:
        Base64 data URL string (data:image/format;base64,...)
    """
    try:
        if not image_binary:
            return ""
        
        # Encode binary to base64
        b64_encoded = base64.b64encode(image_binary).decode('utf-8')
        
        # Return as data URL
        return f"data:image/{image_format};base64,{b64_encoded}"
    
    except Exception as e:
        logger.error(f"Error converting image binary to base64: {e}")
        return ""


def image_binary_to_file(image_binary: bytes, image_format: str = 'jpeg') -> io.BytesIO:
    """
    Convert image binary data from database to file-like object.
    
    Args:
        image_binary: Binary image data from database
        image_format: Image format (jpeg, png, gif, etc.)
    
    Returns:
        BytesIO object that can be used with PIL, cv2, etc.
    """
    try:
        if not image_binary:
            return io.BytesIO()
        
        return io.BytesIO(image_binary)
    
    except Exception as e:
        logger.error(f"Error converting image binary to file: {e}")
        return io.BytesIO()


def get_image_from_database(model_instance, use_database_image: bool = True):
    """
    Get image from model instance, preferring database storage.
    
    Args:
        model_instance: FaceRegistration or AttendancePhoto instance
        use_database_image: If True, use image_data from database; else use file system
    
    Returns:
        Image data (BytesIO object) or None
    """
    try:
        if use_database_image and hasattr(model_instance, 'image_data') and model_instance.image_data:
            # Use stored binary data from database
            logger.info(f"Loading image from database for {model_instance}")
            return image_binary_to_file(model_instance.image_data, model_instance.image_format)
        elif hasattr(model_instance, 'image') and model_instance.image:
            # Fallback to file system
            logger.info(f"Loading image from file system for {model_instance}")
            with open(model_instance.image.path, 'rb') as f:
                return io.BytesIO(f.read())
        else:
            logger.warning(f"No image found for {model_instance}")
            return None
    
    except Exception as e:
        logger.error(f"Error retrieving image from database: {e}")
        return None


def delete_image_from_database(model_instance):
    """
    Delete image from database storage.
    
    Args:
        model_instance: FaceRegistration or AttendancePhoto instance
    """
    try:
        if hasattr(model_instance, 'image_data'):
            model_instance.image_data = None
            model_instance.save()
            logger.info(f"Deleted image data from database for {model_instance}")
    
    except Exception as e:
        logger.error(f"Error deleting image from database: {e}")


def calculate_eye_aspect_ratio(eye_landmarks: List[Tuple[int, int]]) -> float:
    """
    Calculate the Eye Aspect Ratio (EAR) given 6 (x, y) coordinates of an eye.
    EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
    """
    if not eye_landmarks or len(eye_landmarks) < 6:
        return 0.30

    def dist(p1, p2):
        return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

    p1, p2, p3, p4, p5, p6 = eye_landmarks[:6]
    horizontal = dist(p1, p4)
    if horizontal < 1e-6:
        return 0.30
    vertical1 = dist(p2, p6)
    vertical2 = dist(p3, p5)
    return float((vertical1 + vertical2) / (2.0 * horizontal))


def verify_server_liveness(
    open_image,
    blink_image,
    max_blink_ear: float = 0.20,
    min_open_ear: float = 0.21,
) -> Dict[str, any]:
    """
    Server-side anti-spoof liveness verification.
    Validates that:
    1. Both images contain a detectable face with 68 landmarks.
    2. In blink_image, the eye aspect ratio indicates closed eyes (EAR < max_blink_ear).
    3. In open_image, the eye aspect ratio indicates open eyes (EAR >= min_open_ear).
    """
    try:
        import face_recognition
        open_landmarks = face_recognition.face_landmarks(open_image)
        blink_landmarks = face_recognition.face_landmarks(blink_image)

        if not open_landmarks or not blink_landmarks:
            return {
                'verified': False,
                'status': 'no_landmarks',
                'message': 'Liveness check failed: Could not detect facial landmarks in one or both frames.'
            }

        ol = open_landmarks[0]
        bl = blink_landmarks[0]

        open_left = calculate_eye_aspect_ratio(ol.get('left_eye', []))
        open_right = calculate_eye_aspect_ratio(ol.get('right_eye', []))
        open_ear = (open_left + open_right) / 2.0

        blink_left = calculate_eye_aspect_ratio(bl.get('left_eye', []))
        blink_right = calculate_eye_aspect_ratio(bl.get('right_eye', []))
        blink_ear = (blink_left + blink_right) / 2.0

        # Verify eye closure in blink frame
        if blink_ear >= max_blink_ear:
            return {
                'verified': False,
                'status': 'no_blink',
                'open_ear': float(open_ear),
                'blink_ear': float(blink_ear),
                'message': f"Liveness check failed: No eye closure detected (blink EAR {blink_ear:.2f} >= {max_blink_ear})."
            }

        # Verify eyes open in primary capture frame
        if open_ear < min_open_ear:
            return {
                'verified': False,
                'status': 'eyes_closed_in_capture',
                'open_ear': float(open_ear),
                'blink_ear': float(blink_ear),
                'message': f"Liveness check failed: Eyes closed in primary capture frame (EAR {open_ear:.2f} < {min_open_ear})."
            }

        return {
            'verified': True,
            'status': 'verified',
            'open_ear': float(open_ear),
            'blink_ear': float(blink_ear),
            'message': 'Server liveness verified.'
        }
    except Exception as e:
        logger.warning(f"Server liveness verification error: {e}")
        return {
            'verified': False,
            'status': 'error',
            'message': f"Liveness verification encountered an error: {str(e)}"
        }

