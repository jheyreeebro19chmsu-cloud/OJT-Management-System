export const GEOFENCE_RADIUS_METERS = 100;

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinGeofence(
  userLat: number,
  userLng: number,
  zoneLat: number,
  zoneLng: number,
  radiusMeters: number,
  accuracyMeters?: number
): boolean {
  const distance = calculateDistance(userLat, userLng, zoneLat, zoneLng);
  // If the device reports an accuracy, we tighten the acceptance criteria.
  // We consider the user inside only if the *worst‑case* distance (distance + accuracy)
  // is still within the allowed radius. This prevents false positives when GPS
  // jitter is large relative to the geofence size.
  const buffer = typeof accuracyMeters === 'number' ? Math.min(5, accuracyMeters) : 5; // 5 m default drift
  const effectiveRadius = radiusMeters - buffer;
  if (effectiveRadius <= 0) return false; // guard against overly small zones
  return distance <= effectiveRadius;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// Using `any` here to avoid depending on DOM lib types in environments
export function getCurrentLocation(): Promise<any> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
}

export function isGeolocationPositionError(err: unknown): err is any {
  return (
    typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: unknown }).code === 'number'
  );
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function calculateTotalHours(timeIn: string, timeOut: string): number {
  const [inH, inM] = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);
  const inTotal = inH * 60 + inM;
  const outTotal = outH * 60 + outM;
  return parseFloat(((outTotal - inTotal) / 60).toFixed(2));
}

export function getAttendanceStatus(
  timeIn: string,
  workStartTime: string,
  lateThresholdMinutes: number
): 'present' | 'late' {
  const [inH, inM] = timeIn.split(':').map(Number);
  const [startH, startM] = workStartTime.split(':').map(Number);
  const inTotal = inH * 60 + inM;
  const startTotal = startH * 60 + startM;
  return inTotal <= startTotal + lateThresholdMinutes ? 'present' : 'late';
}
