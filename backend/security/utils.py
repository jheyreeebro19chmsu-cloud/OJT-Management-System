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


def validate_image_brightness(image_path: str, min_brightness: int = 60, max_brightness: int = 200) -> Dict[str, any]:
    """
    Validate that an image has acceptable brightness for face recognition.
    
    Args:
        image_path: Path to the image file
        min_brightness: Minimum acceptable brightness (0-255), default 60 (too dark threshold)
        max_brightness: Maximum acceptable brightness (0-255), default 200 (too bright threshold)
    
    Returns:
        dict: {
            'valid': bool,
            'brightness': float,
            'status': 'dark' | 'good' | 'bright',
            'message': str,
            'recommendations': list[str]
        }
    """
    try:
        from PIL import Image
        import numpy as np
        
        # Open image
        img = Image.open(image_path)
        
        # Convert to RGB if needed
        if img.mode not in ['RGB', 'L']:
            img = img.convert('RGB')
        
        # Convert to numpy array
        img_array = np.array(img)
        
        # Convert to grayscale if RGB
        if len(img_array.shape) == 3:
            # Standard luminosity formula
            gray = 0.299 * img_array[:,:,0] + 0.587 * img_array[:,:,1] + 0.114 * img_array[:,:,2]
        else:
            gray = img_array
        
        # Calculate average brightness
        avg_brightness = float(np.mean(gray))
        
        # Determine status
        if avg_brightness < min_brightness:
            status = 'dark'
            valid = False
            message = f"Image too dark (brightness: {avg_brightness:.1f}/{min_brightness})"
            recommendations = [
                "Turn on more lights",
                "Move to a well-lit area",
                "Move closer to a window",
                "Increase device brightness"
            ]
        elif avg_brightness > max_brightness:
            status = 'bright'
            valid = False
            message = f"Image too bright (brightness: {avg_brightness:.1f}/{max_brightness})"
            recommendations = [
                "Move away from direct light",
                "Reduce screen brightness",
                "Adjust position to reduce glare"
            ]
        else:
            status = 'good'
            valid = True
            message = f"Brightness acceptable ({avg_brightness:.1f})"
            recommendations = []
        
        logger.info(f"Brightness validation - Image: {image_path}, Brightness: {avg_brightness:.1f}, Status: {status}")
        
        return {
            'valid': valid,
            'brightness': avg_brightness,
            'status': status,
            'message': message,
            'recommendations': recommendations
        }
        
    except Exception as e:
        logger.error(f"Brightness validation error for {image_path}: {e}")
        return {
            'valid': False,
            'brightness': 128,
            'status': 'unknown',
            'message': f'Failed to validate image brightness: {str(e)}',
            'recommendations': ['Please try again with a different image']
        }


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
