import { MapPin, CheckCircle, XCircle, Loader, AlertTriangle, Navigation, ShieldOff, RefreshCw, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import { checkGeofence as checkGeofenceApi, isSecurityApiConfigured } from '../services/securityApi';
import { useApp } from '../store/AppContext';
import {
  calculateDistance,
  formatDistance,
  getCurrentLocation,
  isGeolocationPositionError,
  isWithinGeofence,
  GEOFENCE_RADIUS_METERS,
} from '../utils/geo';

export type GeoState = 'idle' | 'checking' | 'inside' | 'outside' | 'denied' | 'error' | 'demo';

export interface GeofenceResult {
  state: GeoState;
  distance?: number;
  zoneName?: string;
  coords?: { lat: number; lng: number; accuracy?: number };
  accuracy?: number;
  verifiedBy?: 'server' | 'local';
  errorMessage?: string;
}

export interface GeofenceCheckerProps {
  onResult: (passed: boolean, coords?: { lat: number; lng: number }, state?: GeoState, message?: string) => void;
  autoCheck?: boolean;
}

export function GeofenceChecker({ onResult, autoCheck = true }: GeofenceCheckerProps) {
  const { geofenceZones, settings, getCurrentEmployee } = useApp();
  const [result, setResult] = useState<GeofenceResult>({ state: 'idle' });
  const [watchCoords, setWatchCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');

  // Stable ref for onResult callback to avoid unnecessary interval restarts & re-renders
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const employee = getCurrentEmployee();

  const activeZones = React.useMemo(() => {
    const zones = [...geofenceZones].filter(
      (z) =>
        Boolean(z) &&
        z.active &&
        Number.isFinite(z.lat) &&
        Number.isFinite(z.lng) &&
        Math.abs(z.lat) <= 90 &&
        Math.abs(z.lng) <= 180 &&
        Number.isFinite(z.radius) &&
        z.radius > 0
    );

    // Add employee's custom registration location if it exists at the top priority
    const regLat = employee?.registrationLocation?.lat ?? (employee as any)?.registration_lat ?? (employee as any)?.latitude;
    const regLng = employee?.registrationLocation?.lng ?? (employee as any)?.registration_lng ?? (employee as any)?.longitude;
    if (regLat && regLng && Number.isFinite(Number(regLat)) && Number.isFinite(Number(regLng))) {
      zones.unshift({
        id: `personal-${employee?.id || 'trainee'}`,
        name: employee?.companyName ? `${employee.companyName} (Designated Workplace)` : (employee?.registrationAddress || 'Assigned Establishment Premises'),
        address: employee?.registrationAddress || employee?.companyAddress || '',
        lat: Number(regLat),
        lng: Number(regLng),
        radius: Math.max(Number((employee as any)?.geofenceRadius || (employee as any)?.radius || 250), 200),
        active: true,
      });
    }
    return zones;
  }, [geofenceZones, employee]);

  // Stable ref for activeZones to prevent any possible interval restart loops
  const activeZonesRef = useRef(activeZones);
  activeZonesRef.current = activeZones;

  const checkGeofence = useCallback(async () => {
    const currentZones = activeZonesRef.current;

    setResult((prev) => ({ ...prev, state: 'checking' }));

    try {
      // Actively request the user's location via browser GPS (triggers browser permission prompt)
      const position = await getCurrentLocation();
      const { latitude, longitude, accuracy } = position.coords;
      const coords = { lat: latitude, lng: longitude };

      if (!settings.geofenceEnabled) {
        setResult({
          state: 'inside',
          zoneName: 'Geofence Disabled (All Locations Allowed)',
          coords: { ...coords, accuracy },
          accuracy,
          verifiedBy: 'local',
        });
        onResultRef.current(true, coords, 'inside');
        return;
      }

      if (currentZones.length === 0) {
        setResult({
          state: 'inside',
          zoneName: 'No Active Zones Configured (Attendance Allowed)',
          coords: { ...coords, accuracy },
          accuracy,
          verifiedBy: 'local',
        });
        onResultRef.current(true, coords, 'inside');
        return;
      }

      // 1. Immediate priority check: Evaluate trainee's permanent registered location
      const personalZone = currentZones.find((z) => z.id.startsWith('personal-'));
      if (personalZone) {
        const isInsidePersonal = isWithinGeofence(
          latitude,
          longitude,
          personalZone.lat,
          personalZone.lng,
          personalZone.radius,
          accuracy
        );
        if (isInsidePersonal) {
          const personalDist = calculateDistance(latitude, longitude, personalZone.lat, personalZone.lng);
          setResult({
            state: 'inside',
            distance: personalDist,
            zoneName: personalZone.name,
            coords: { ...coords, accuracy },
            accuracy,
            verifiedBy: 'local',
          });
          onResultRef.current(true, coords, 'inside');
          return;
        }
      }

      let closestZone = currentZones[0];
      let minDistance = calculateDistance(latitude, longitude, closestZone.lat, closestZone.lng);

      for (const zone of currentZones.slice(1)) {
        const dist = calculateDistance(latitude, longitude, zone.lat, zone.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestZone = zone;
        }
      }

      if (isSecurityApiConfigured()) {
        try {
          const apiResult = await checkGeofenceApi({
            lat: latitude,
            lng: longitude,
            accuracy: accuracy,
            zones: currentZones.map((z) => ({
              name: z.name,
              lat: z.lat,
              lng: z.lng,
              radius: z.radius,
              active: z.active,
            })),
          });

          const inside = apiResult.inside;
          const distance = typeof apiResult.distance_m === 'number' ? apiResult.distance_m : minDistance;
          const zoneName = apiResult.zone?.name || closestZone.name;

          setResult({
            state: inside ? 'inside' : 'outside',
            distance,
            zoneName,
            coords: { ...coords, accuracy },
            accuracy,
            verifiedBy: 'server',
          });
          onResultRef.current(inside, coords, inside ? 'inside' : 'outside');
          return;
        } catch {
          // Fall back to local calculation below
        }
      }

      const inside = isWithinGeofence(
        latitude,
        longitude,
        closestZone.lat,
        closestZone.lng,
        closestZone.radius,
        accuracy
      );

      setResult({
        state: inside ? 'inside' : 'outside',
        distance: minDistance,
        zoneName: closestZone.name,
        coords: { ...coords, accuracy },
        accuracy,
        verifiedBy: 'local',
      });
      onResultRef.current(inside, coords, inside ? 'inside' : 'outside');
    } catch (err: unknown) {
      const isPermissionDenied =
        (isGeolocationPositionError(err) && err.code === 1) ||
        (err as any)?.code === 1 ||
        (typeof (err as any)?.message === 'string' && (err as any).message.toLowerCase().includes('denied'));

      if (isPermissionDenied) {
        setResult({
          state: 'denied',
          zoneName: 'Location Access Denied',
          errorMessage: 'GPS permission was denied by the user or browser. Location permission is required to record attendance.',
        });
        onResultRef.current(false, undefined, 'denied', 'GPS location permission denied');
      } else {
        if (!settings.geofenceEnabled) {
          setResult({ state: 'inside', zoneName: 'Geofence Disabled (All Locations Allowed)' });
          onResultRef.current(true, undefined, 'inside');
          return;
        }
        setResult({
          state: 'error',
          zoneName: 'Location Service Unavailable',
          errorMessage: (err as any)?.message || 'Unable to determine device location.',
        });
        onResultRef.current(false, undefined, 'error', 'Location service unavailable');
      }
    }
  }, [settings.geofenceEnabled]);

  // Monitor browser permission state transitions
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          setPermissionState(status.state);
          if (status.state === 'denied') {
            setResult({
              state: 'denied',
              zoneName: 'Location Access Denied',
              errorMessage: 'GPS access is blocked by your browser for this site.',
            });
            onResultRef.current(false, undefined, 'denied', 'GPS location permission denied');
          }
          status.onchange = () => {
            setPermissionState(status.state);
            if (status.state === 'granted') {
              checkGeofence();
            } else if (status.state === 'denied') {
              setResult({
                state: 'denied',
                zoneName: 'Location Access Denied',
                errorMessage: 'GPS access is blocked by your browser for this site.',
              });
              onResultRef.current(false, undefined, 'denied', 'GPS location permission denied');
            }
          };
        })
        .catch(() => {
          setPermissionState('unsupported');
        });
    }
  }, [checkGeofence]);

  useEffect(() => {
    if (autoCheck) checkGeofence();
  }, []);

  useEffect(() => {
    if (!autoCheck) return;
    const intervalId = window.setInterval(() => {
      checkGeofence();
    }, 5000); // Increased frequency to 5 seconds
    return () => window.clearInterval(intervalId);
  }, [autoCheck, checkGeofence]);

  useEffect(() => {
    if (!navigator.geolocation?.watchPosition) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (!isValidCoord(lat, lng)) return;
        setWatchCoords({
          lat,
          lng,
          accuracy: position.coords.accuracy,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const getStatusConfig = () => {
    switch (result.state) {
      case 'checking':
        return {
          icon: <Loader size={20} className="animate-spin text-sky-500" />,
          color: 'bg-sky-50 border-sky-200',
          label: 'Checking your location...',
          labelColor: 'text-sky-700',
        };
      case 'inside':
        return {
          icon: <CheckCircle size={20} className="text-green-500" />,
          color: 'bg-green-50 border-green-200',
          label: 'Within geofence zone ✓',
          labelColor: 'text-green-700',
        };
      case 'outside':
        return {
          icon: <ShieldOff size={20} className="text-red-600" />,
          color: 'bg-red-50 border-red-300',
          label: 'NOT within the designated work premises',
          labelColor: 'text-red-700',
        };
      case 'denied':
        return {
          icon: <AlertTriangle size={20} className="text-yellow-500" />,
          color: 'bg-yellow-50 border-yellow-200',
          label: 'Location permission denied',
          labelColor: 'text-yellow-700',
        };
      case 'demo':
        return {
          icon: <Navigation size={20} className="text-purple-500" />,
          color: 'bg-purple-50 border-purple-200',
          label: 'Demo Mode Active',
          labelColor: 'text-purple-700',
        };
      case 'error':
        return {
          icon: <AlertTriangle size={20} className="text-orange-500" />,
          color: 'bg-orange-50 border-orange-200',
          label: 'Location error occurred',
          labelColor: 'text-orange-700',
        };
      default:
        return {
          icon: <MapPin size={20} className="text-gray-400" />,
          color: 'bg-gray-50 border-gray-200',
          label: 'Location not checked',
          labelColor: 'text-gray-600',
        };
    }
  };

  const config = getStatusConfig();
  const liveCoords =
    watchCoords && isValidCoord(watchCoords.lat, watchCoords.lng)
      ? watchCoords
      : result.coords && isValidCoord(result.coords.lat, result.coords.lng)
        ? result.coords
        : null;
  const mapCenter = liveCoords
    ? ([liveCoords.lat, liveCoords.lng] as [number, number])
    : activeZones.length > 0
      ? ([activeZones[0].lat, activeZones[0].lng] as [number, number])
      : null;
  const nearestZone = result.zoneName ? activeZones.find((z) => z.name === result.zoneName) : activeZones[0];

  return (
    <div className="w-full space-y-3">
      {/* Outside premises — prominent alert */}
      <AnimatePresence>
        {result.state === 'outside' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border-2 border-red-400 bg-red-50 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center shrink-0">
                <ShieldOff size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-red-700 text-sm">⛔ Outside Work Premises</p>
                <p className="text-xs text-red-600">You are NOT in the right location of the establishment</p>
              </div>
            </div>
            <div className="bg-red-100 rounded-xl p-3 text-xs text-red-700 space-y-1">
              <p className="font-semibold">You cannot record your attendance from this location.</p>
              <p>
                Please move to the designated work area: <span className="font-bold">{result.zoneName}</span>
              </p>
              {result.distance !== undefined && (
                <p className="flex items-center gap-1 mt-1">
                  <MapPin size={11} />
                  You are <span className="font-bold">{formatDistance(result.distance)}</span> away from the nearest
                  zone
                </p>
              )}
            </div>
            <button
              onClick={checkGeofence}
              className="mt-3 w-full text-xs bg-red-600 text-white py-2 px-3 rounded-xl hover:bg-red-700 transition-colors font-medium"
            >
              Recheck My Location
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GPS Permission Prompt Helper */}
      <AnimatePresence>
        {(permissionState === 'prompt' || result.state === 'checking') && result.state !== 'inside' && result.state !== 'denied' && permissionState !== 'denied' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Compass size={18} className="animate-spin" />
              </div>
              <div className="text-xs text-sky-950 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sky-900 text-sm">System Requesting GPS Location Permission</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-200 text-sky-800 border border-sky-300">
                    Prompt Active
                  </span>
                </div>
                <p className="mt-1 text-sky-800 leading-relaxed">
                  Please click <strong>"Allow"</strong> or <strong>"While using the site"</strong> on your browser's location prompt popup to confirm you are within your designated workplace premises.
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={checkGeofence}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Compass size={13} />
                    Grant Location Permission
                  </button>
                  <span className="text-[11px] text-sky-700">Click to prompt browser if not visible</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GPS Permission Denied — Prominent Warning Card */}
      <AnimatePresence>
        {(result.state === 'denied' || permissionState === 'denied') && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-amber-200">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-amber-950 text-sm">GPS Permission Denied</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
                  Daily Time Record (DTR) requires GPS location access to confirm that you are physically present at your assigned OJT workplace premises before clocking in or out.
                </p>

                {/* Step-by-step unblock instructions */}
                <div className="mt-3 bg-white/90 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 space-y-2">
                  <p className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span>⚙️</span> How to allow location permission in your browser:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-900">
                    <li>Click the <strong>Lock (🔒)</strong> or <strong>Site Settings (🎛️)</strong> icon in your browser address bar (top of screen).</li>
                    <li>Find <strong>Location</strong> and switch it from <strong>"Block"</strong> to <strong>"Allow"</strong>.</li>
                    <li>If using Windows or a smartphone, verify that system <strong>Location Services</strong> are enabled.</li>
                    <li>Click the <strong>"Request GPS Permission / Retry"</strong> button below.</li>
                  </ol>
                </div>

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={checkGeofence}
                    className="flex-1 flex items-center justify-center gap-2 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors"
                  >
                    <RefreshCw size={14} />
                    Request GPS Permission / Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex items-center justify-center gap-1 text-xs bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-medium py-2.5 px-3 rounded-xl transition-colors"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standard status card */}
      {result.state !== 'outside' && result.state !== 'denied' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-4 ${config.color}`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{config.icon}</div>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${config.labelColor}`}>{config.label}</div>
              {result.zoneName && (
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <MapPin size={10} />
                  {result.zoneName}
                </div>
              )}
              {result.distance !== undefined && (
                <div className="text-xs text-gray-500 mt-1">
                  Distance: <span className="font-medium">{formatDistance(result.distance)}</span>
                  {result.accuracy !== undefined && (
                    <span className="ml-2">±{Math.round(result.accuracy)}m accuracy</span>
                  )}
                </div>
              )}
              {result.coords && (
                <div className="text-xs text-gray-400 mt-0.5 font-mono">
                  {result.coords.lat.toFixed(5)}, {result.coords.lng.toFixed(5)}
                </div>
              )}
            </div>
            {result.state !== 'checking' && result.state !== 'idle' && (
              <button onClick={checkGeofence} className="text-xs text-sky-600 hover:text-sky-800 font-medium shrink-0">
                Recheck
              </button>
            )}
          </div>

          {/* Radar animation for "inside" state */}
          <AnimatePresence>
            {result.state === 'inside' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex justify-center">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <motion.div
                    className="absolute w-16 h-16 rounded-full border-2 border-green-400 opacity-30"
                    animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute w-16 h-16 rounded-full border-2 border-green-400 opacity-30"
                    animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
                  />
                  <div className="w-5 h-5 rounded-full bg-green-500 shadow-lg shadow-green-300" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {mapCenter && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm relative z-0 isolate">
          <div className="px-3 py-2 border-b border-gray-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-800">Live location map (Leaflet)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {result.verifiedBy === 'server'
                ? 'Checked by Django backend geofence API.'
                : 'Showing device GPS with local geofence fallback.'}
            </p>
            {liveCoords && (
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {liveCoords.lat.toFixed(5)}, {liveCoords.lng.toFixed(5)}
                {liveCoords.accuracy !== undefined ? ` (±${Math.round(liveCoords.accuracy)}m)` : ''}
              </p>
            )}
          </div>
          <div className="h-64 relative z-0 isolate overflow-hidden">
            <MapContainer
              center={mapCenter}
              zoom={16}
              scrollWheelZoom
              className="h-full w-full relative z-0"
              style={{ width: '100%', height: '100%' }}
            >
              <MapAutoResizer />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {liveCoords && <LiveMapFollow liveCoords={liveCoords} />}
              {nearestZone && (
                <Circle
                  center={[nearestZone.lat, nearestZone.lng]}
                  radius={nearestZone.radius}
                  pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.16, weight: 2 }}
                />
              )}
              {liveCoords &&
                typeof liveCoords.accuracy === 'number' &&
                liveCoords.accuracy > 5 &&
                liveCoords.accuracy < 3000 && (
                  <Circle
                    center={[liveCoords.lat, liveCoords.lng]}
                    radius={liveCoords.accuracy}
                    pathOptions={{ color: '#0284c7', fillColor: '#38bdf8', fillOpacity: 0.12, weight: 1 }}
                  />
                )}
              {liveCoords && isValidCoord(liveCoords.lat, liveCoords.lng) && (
                <>
                  <CircleMarker
                    center={[liveCoords.lat, liveCoords.lng]}
                    radius={12}
                    pathOptions={{ stroke: false, fillColor: '#38bdf8', fillOpacity: 0.32 }}
                  />
                  <CircleMarker
                    center={[liveCoords.lat, liveCoords.lng]}
                    radius={6}
                    pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#0ea5e9', fillOpacity: 1 }}
                  />
                </>
              )}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function LiveMapFollow({ liveCoords }: { liveCoords: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (!isValidCoord(liveCoords.lat, liveCoords.lng)) return;
    map.setView([liveCoords.lat, liveCoords.lng], map.getZoom(), { animate: true });
  }, [liveCoords, map]);
  return null;
}

function MapAutoResizer() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    const timers = [
      setTimeout(() => map.invalidateSize(), 80),
      setTimeout(() => map.invalidateSize(), 200),
      setTimeout(() => map.invalidateSize(), 400),
      setTimeout(() => map.invalidateSize(), 800),
    ];

    let ro: ResizeObserver | null = null;
    try {
      const container = map.getContainer();
      if (typeof ResizeObserver !== 'undefined' && container) {
        ro = new ResizeObserver(() => {
          map.invalidateSize();
        });
        ro.observe(container);
        if (container.parentElement) {
          ro.observe(container.parentElement);
        }
      }
    } catch {
      // Ignore if ResizeObserver is unsupported or throws
    }

    return () => {
      timers.forEach(clearTimeout);
      if (ro) ro.disconnect();
    };
  }, [map]);

  return null;
}
