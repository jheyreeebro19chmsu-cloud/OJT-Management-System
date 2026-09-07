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
  // Allow a realistic GPS variance margin based on device-reported accuracy
  const accuracyAllowance = typeof accuracyMeters === 'number' && accuracyMeters > 0 ? Math.min(accuracyMeters, 80) : 30;
  const maxAllowedDistance = Math.max(radiusMeters, 100) + accuracyAllowance;
  return distance <= maxAllowedDistance;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// Real-time reverse geocoding via OpenStreetMap Nominatim
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.display_name) {
        return data.display_name;
      }
      const addr = data?.address;
      if (addr) {
        const parts = [
          addr.road || addr.suburb || addr.neighbourhood,
          addr.village || addr.quarter || addr.city_district || addr.barangay,
          addr.city || addr.town || addr.municipality,
          addr.state || addr.province || addr.region,
          addr.country,
        ].filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
      }
    }
  } catch (e) {
    console.warn('reverseGeocode failed:', e);
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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

/**
 * Daily 6:00 AM Reset:
 * Any attendance session before 06:00 AM belongs to the prior day's cycle.
 * At 06:00 AM, the daily record resets for the new day.
 */
export function getDTRSessionDate(date = new Date()): string {
  const currentHour = date.getHours();
  if (currentHour < 6) {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
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

/**
 * Attendance evaluation:
 * - Official start: 08:00 AM (8:00am)
 * - Official end: 17:00 (5:00pm)
 * - Clock-in after 08:00 AM (or after lateThresholdMinutes) is marked 'late'.
 * - Clock-in after 17:00 (5:00 PM) is also strictly marked 'late'.
 */
export function getAttendanceStatus(
  timeIn: string,
  workStartTime = '08:00',
  lateThresholdMinutes = 0
): 'present' | 'late' {
  const [inH, inM] = timeIn.split(':').map(Number);
  const inTotal = inH * 60 + inM;

  const [startH, startM] = (workStartTime || '08:00').split(':').map(Number);
  const startTotal = startH * 60 + startM;

  // 5:00 PM cutoff = 17:00 = 1020 minutes
  const cutoff5pm = 17 * 60;

  // If clocking in after 5:00 PM -> marked late
  if (inTotal >= cutoff5pm) {
    return 'late';
  }

  // If clocking in after start time (08:00) + grace threshold -> marked late
  if (inTotal > startTotal + (lateThresholdMinutes || 0)) {
    return 'late';
  }

  return 'present';
}
