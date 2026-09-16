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

