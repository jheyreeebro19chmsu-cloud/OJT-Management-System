from __future__ import annotations

import base64
import io
import math
from typing import Dict, Iterable, List, Optional, Tuple


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
