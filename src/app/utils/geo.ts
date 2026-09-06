export const GEOFENCE_RADIUS_METERS = 150;

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
  // Allow a realistic GPS variance margin based on device-reported accuracy
  const accuracyAllowance = typeof accuracyMeters === 'number' && accuracyMeters > 0 ? Math.min(accuracyMeters, 80) : 30;
  const maxAllowedDistance = Math.max(radiusMeters, 100) + accuracyAllowance;
  return distance <= maxAllowedDistance;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// Multi-tiered high-res GPS locator with instant fallback for desktop browsers & Windows Location Services
export function getCurrentLocation(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return fallbackIpLocation().then(resolve).catch(reject);
    }

    // Step 1: Try high accuracy GPS (mobile / GPS chip)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          localStorage.setItem('ojt_last_coords', JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            time: Date.now()
          }));
        } catch {}
        resolve(pos);
      },
      (err1) => {
        if (err1.code === 1) {
          // Permission denied explicitly by user
          return reject(err1);
        }

        // Step 2: Try standard network/Wi-Fi geolocation (works reliably on PC/Windows)
        navigator.geolocation.getCurrentPosition(
          (pos2) => {
            try {
              localStorage.setItem('ojt_last_coords', JSON.stringify({
                lat: pos2.coords.latitude,
                lng: pos2.coords.longitude,
                accuracy: pos2.coords.accuracy,
                time: Date.now()
              }));
            } catch {}
            resolve(pos2);
          },
          async (err2) => {
            if (err2.code === 1) return reject(err2);

            // Step 3: Fall back to IP-based real-time geolocation service
            try {
              const ipPos = await fallbackIpLocation();
              resolve(ipPos);
            } catch {
              // Step 4: Check if we have recent cached coordinates from current session
              try {
                const cached = localStorage.getItem('ojt_last_coords');
                if (cached) {
                  const parsed = JSON.parse(cached);
                  if (parsed.lat && parsed.lng) {
                    return resolve({
                      coords: {
                        latitude: parsed.lat,
                        longitude: parsed.lng,
                        accuracy: parsed.accuracy || 50,
                      },
                      timestamp: parsed.time || Date.now(),
                    });
                  }
                }
              } catch {}
              reject(err2);
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 5000 }
    );
  });
}

// Fallback real-time IP Geolocation for desktop browsers where GPS hardware is unavailable
async function fallbackIpLocation(): Promise<any> {
  const providers = [
    'https://freeipapi.com/api/json',
    'https://ipapi.co/json/',
  ];

  for (const url of providers) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const lat = data.latitude || data.lat;
        const lng = data.longitude || data.lon || data.lng;
        if (typeof lat === 'number' && typeof lng === 'number') {
          return {
            coords: {
              latitude: lat,
              longitude: lng,
              accuracy: 100,
            },
            timestamp: Date.now(),
          };
        }
      }
    } catch {
      // try next provider
    }
  }
  throw new Error('IP geolocation unavailable');
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
