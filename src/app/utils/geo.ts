export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
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
  const effectiveAccuracy = typeof accuracyMeters === 'number' && accuracyMeters > 0 ? accuracyMeters : 0;
  // Conservative check: user's reported position may be off by `accuracy`; require distance + accuracy <= radius
  return distance + effectiveAccuracy <= radiusMeters;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export function isGeolocationPositionError(err: unknown): err is GeolocationPositionError {
  return typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: unknown }).code === 'number';
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
