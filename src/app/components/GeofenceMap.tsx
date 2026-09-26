import L from 'leaflet';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Compass,
  Crosshair,
  X,
  Layers,
  MapPin,
  Move,
  CheckCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, Polyline, useMap, useMapEvents } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import './geofence-map.css';
import type { GeofenceZone } from '../types';
import { calculateDistance, isWithinGeofence } from '../utils/geo';

export type MapSizePreset = 'compact' | 'normal' | 'expanded';

export interface GeofenceMapProps {
  zones: GeofenceZone[];
  /** Admin: click map to set zone center */
  picking?: boolean;
  pickedCoords?: { lat: number; lng: number };
  pickedRadius?: number;
  onPick?: (lat: number, lng: number) => void;
  /** Center map on selected zone */
  focusCoords?: { lat: number; lng: number };
  /** Employee / trainee live GPS — shows position vs geofences */
  liveUser?: { lat: number; lng: number; accuracy?: number } | null;
  /** e.g. h-64 (admin) or h-72 min-h-[220px] (time record) */
  className?: string;
  /** Zone ID that is currently set to interactive draggable mode */
  draggableZoneId?: string | null;
  /** Callbacks for interactive dragging */
  onZoneDrag?: (zoneId: string, lat: number, lng: number) => void;
  onZoneDragEnd?: (zoneId: string, lat: number, lng: number) => void;
  /** Selected zone click callback */
  onZoneClick?: (zone: GeofenceZone) => void;
  /** Enable full-screen button and overlay */
  allowFullscreen?: boolean;
  /** Enable height size adjust controls */
  allowResize?: boolean;
  /** Controlled full screen mode */
  isFullscreen?: boolean;
  /** Fullscreen change listener */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Custom map title in full screen HUD */
  title?: string;
  /** Size preset */
  sizePreset?: MapSizePreset;
  /** Size preset change listener */
  onSizePresetChange?: (preset: MapSizePreset) => void;
}

export function GeofenceMap({
  zones,
  picking = false,
  pickedCoords,
  pickedRadius = 40,
  onPick,
  focusCoords,
  liveUser = null,
  className = 'h-80',
  draggableZoneId = null,
  onZoneDrag,
  onZoneDragEnd,
  onZoneClick,
  allowFullscreen = true,
  allowResize = true,
  isFullscreen: controlledFullscreen,
  onFullscreenChange,
  title = 'Interactive Geofence Map',
  sizePreset: controlledSizePreset,
  onSizePresetChange,
}: GeofenceMapProps) {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [internalSizePreset, setInternalSizePreset] = useState<MapSizePreset>('normal');
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [userHasMovedMap, setUserHasMovedMap] = useState(false);

  const isFullscreen = controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;
  const sizePreset = controlledSizePreset !== undefined ? controlledSizePreset : internalSizePreset;

  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreen;
    if (controlledFullscreen === undefined) {
      setInternalFullscreen(next);
    }
    onFullscreenChange?.(next);
  }, [isFullscreen, controlledFullscreen, onFullscreenChange]);

  const handleSizePresetChange = useCallback(
    (nextPreset: MapSizePreset) => {
      if (controlledSizePreset === undefined) {
        setInternalSizePreset(nextPreset);
      }
      onSizePresetChange?.(nextPreset);
    },
    [controlledSizePreset, onSizePresetChange]
  );

  // Keyboard navigation: Escape key exits full screen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  // Lock body scroll when in full screen overlay mode
  useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullscreen]);

  const fittedZonesRef = useRef(false);
  const fittedLiveUserRef = useRef(false);
  // Default center: Carlos Hilado Memorial State University (CHMSU Talisay Main Campus, Negros Occidental)
  const defaultCenter = useMemo<[number, number]>(() => [10.7410, 122.9702], []);

  const zoneIcon = useMemo(
    () =>
      L.divIcon({
        className: 'leaflet-zone-marker',
        html: '<span class="leaflet-zone-dot"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    []
  );

  const inactiveZoneIcon = useMemo(
    () =>
      L.divIcon({
        className: 'leaflet-zone-marker leaflet-zone-marker-inactive',
        html: '<span class="leaflet-zone-dot"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    []
  );

  const draggableZoneIcon = useMemo(
    () =>
      L.divIcon({
        className: 'leaflet-draggable-zone-marker',
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: grab;">
            <div style="position: absolute; width: 34px; height: 34px; border-radius: 9999px; background-color: rgba(37, 99, 235, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; width: 26px; height: 26px; border-radius: 9999px; background-color: #2563eb; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold;">
              📍
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    []
  );

  const pickedIcon = useMemo(
    () =>
      L.divIcon({
        className: 'leaflet-picked-marker',
        html: '<span class="leaflet-picked-dot"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    []
  );

  const liveUserIcon = useMemo(
    () =>
      L.divIcon({
        className: 'leaflet-user-marker',
        html: '<span class="leaflet-user-dot"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    []
  );

  const safeZones = useMemo(
    () =>
      zones.filter(
        (zone) =>
          Boolean(zone) &&
          typeof zone.lat === 'number' &&
          typeof zone.lng === 'number' &&
          isValidCoord(zone.lat, zone.lng) &&
          Number.isFinite(zone.radius) &&
          zone.radius > 0
      ),
    [zones]
  );

  const safePickedCoords = pickedCoords && isValidCoord(pickedCoords.lat, pickedCoords.lng) ? pickedCoords : undefined;
  const safeLiveUser = liveUser && isValidCoord(liveUser.lat, liveUser.lng) ? liveUser : null;

  // Dynamically resolve nearest zone:
  // 1. If user is inside ANY active safeZone, that zone is the matched nearestZone and isOutsidePremises is FALSE.
  // 2. If outside all zones, find the closest zone among all safeZones so guidance line connects to the closest boundary.
  const { nearestZone, nearestZoneDistance, isOutsidePremises } = useMemo(() => {
    if (!safeLiveUser || safeZones.length === 0) {
      return { nearestZone: safeZones[0] || null, nearestZoneDistance: null, isOutsidePremises: false };
    }

    // Check if user is inside ANY zone first
    for (const zone of safeZones) {
      const dist = calculateDistance(safeLiveUser.lat, safeLiveUser.lng, zone.lat, zone.lng);
      const isInside = isWithinGeofence(
        safeLiveUser.lat,
        safeLiveUser.lng,
        zone.lat,
        zone.lng,
        zone.radius || 40,
        safeLiveUser.accuracy
      );
      if (isInside) {
        return {
          nearestZone: zone,
          nearestZoneDistance: Math.round(dist),
          isOutsidePremises: false,
        };
      }
    }

    // Outside all zones: find the closest zone to the user
    let closest = safeZones[0];
    let minDist = calculateDistance(safeLiveUser.lat, safeLiveUser.lng, closest.lat, closest.lng);

    for (let i = 1; i < safeZones.length; i++) {
      const zone = safeZones[i];
      const d = calculateDistance(safeLiveUser.lat, safeLiveUser.lng, zone.lat, zone.lng);
      if (d < minDist) {
        minDist = d;
        closest = zone;
      }
    }

    return {
      nearestZone: closest,
      nearestZoneDistance: Math.round(minDist),
      isOutsidePremises: true,
    };
  }, [safeLiveUser, safeZones]);

  const initialCenter = useMemo<[number, number]>(() => {
    if (safeLiveUser) return [safeLiveUser.lat, safeLiveUser.lng];
    if (safePickedCoords) return [safePickedCoords.lat, safePickedCoords.lng];
    if (focusCoords && isValidCoord(focusCoords.lat, focusCoords.lng)) return [focusCoords.lat, focusCoords.lng];
    if (safeZones.length > 0) return [safeZones[0].lat, safeZones[0].lng];
    return defaultCenter;
  }, [safeLiveUser, safePickedCoords, focusCoords, safeZones, defaultCenter]);

  useEffect(() => {
    if (!safeLiveUser) fittedLiveUserRef.current = false;
  }, [safeLiveUser]);

  // Compute container height & classes based on size preset and fullscreen state
  const containerHeightClass = useMemo(() => {
    if (isFullscreen) {
      return 'geofence-map-fullscreen-overlay';
    }
    if (sizePreset === 'compact') {
      return 'h-56 min-h-[220px]';
    }
    if (sizePreset === 'expanded') {
      return 'h-[560px] min-h-[440px]';
    }
    return className || 'h-80 min-h-[280px]';
  }, [isFullscreen, sizePreset, className]);

  return (
    <div
      className={`relative ${containerHeightClass} geofence-map-wrapper z-0 isolate overflow-hidden bg-slate-100 dark:bg-slate-900 transition-all duration-300`}
    >
      {/* Full-Screen Top HUD Header */}
      {isFullscreen && (
        <div className="absolute top-0 left-0 right-0 z-[1000] px-4 py-3 bg-slate-950/85 backdrop-blur-md border-b border-slate-800 text-white flex flex-wrap items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
              <MapPin size={16} className="text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white tracking-tight">{title}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Full Screen
                </span>
                <span className="text-xs text-slate-400">
                  • {safeZones.length} {safeZones.length === 1 ? 'Zone' : 'Zones'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {draggableZoneId ? 'Drag mode enabled: Move workplace pins' : 'Live full-screen perimeter visualization'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick telemetry coordinate readout */}
            {safePickedCoords && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300">
                <span className="text-slate-400 font-sans text-[11px]">Picked:</span>
                {safePickedCoords.lat.toFixed(5)}, {safePickedCoords.lng.toFixed(5)} ({Math.round(pickedRadius)}m)
              </div>
            )}
            {safeLiveUser && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-sky-300">
                <span className="text-slate-400 font-sans text-[11px]">GPS:</span>
                {safeLiveUser.lat.toFixed(5)}, {safeLiveUser.lng.toFixed(5)}
              </div>
            )}

            {/* Recenter button */}
            <button
              type="button"
              onClick={() => {
                setUserHasMovedMap(false);
                setRecenterTrigger((prev) => prev + 1);
              }}
              title="Recenter Map / Fit Bounds"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Compass size={14} className="text-blue-400" />
              <span className="hidden sm:inline">Fit Bounds</span>
            </button>

            {/* Exit Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Exit Full Screen (Esc)"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-blue-950/50 transition-colors cursor-pointer"
            >
              <Minimize2 size={14} />
              <span>Exit Fullscreen</span>
              <span className="hidden sm:inline-block text-[10px] text-blue-200 bg-blue-700/60 px-1 rounded">Esc</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive Map Container */}
      <MapContainer
        center={initialCenter}
        zoom={16}
        scrollWheelZoom
        className="w-full h-full relative z-0"
        style={{ width: '100%', height: '100%' }}
      >
        <MapAutoResizer isFullscreen={isFullscreen} sizePreset={sizePreset} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          updateWhenIdle={true}
          keepBuffer={2}
          maxZoom={19}
        />

        {safeZones.map((zone) => {
          const isDraggable = draggableZoneId === zone.id;
          return (
            <React.Fragment key={zone.id}>
              <Circle
                center={[zone.lat, zone.lng]}
                radius={Number(zone.radius) || 40}
                pathOptions={{
                  color: isDraggable ? '#2563eb' : zone.active ? '#2563eb' : '#94a3b8',
                  fillColor: isDraggable ? '#3b82f6' : zone.active ? '#3b82f6' : '#94a3b8',
                  fillOpacity: isDraggable ? 0.35 : 0.18,
                  weight: isDraggable ? 3 : 2,
                  dashArray: isDraggable ? '6, 6' : undefined,
                  interactive: false,
                }}
              />
              <Marker
                position={[zone.lat, zone.lng]}
                icon={isDraggable ? draggableZoneIcon : zone.active ? zoneIcon : inactiveZoneIcon}
                draggable={isDraggable}
                eventHandlers={{
                  drag: (e: any) => {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    onZoneDrag?.(zone.id, pos.lat, pos.lng);
                  },
                  dragend: (e: any) => {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    onZoneDragEnd?.(zone.id, pos.lat, pos.lng);
                  },
                  click: () => {
                    onZoneClick?.(zone);
                  },
                }}
              >
                <Popup className="leaflet-geofence-popup">
                  <div className="leaflet-popup-card">
                    <p className="leaflet-popup-title">{zone.name || 'Geofence Zone'}</p>
                    {isDraggable && (
                      <p style={{ color: '#2563eb', fontWeight: 800, margin: '4px 0' }}>
                        📍 Drag mode active: Drag this pin to relocate
                      </p>
                    )}
                    <p>Radius: {Math.round(zone.radius || 40)}m</p>
                    <p>
                      Coordinates: {zone.lat.toFixed(5)}, {zone.lng.toFixed(5)}
                    </p>
                    <p>Status: {zone.active ? 'Active' : 'Inactive'}</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {safePickedCoords && (
          <>
            <Circle
              center={[safePickedCoords.lat, safePickedCoords.lng]}
              radius={Number(pickedRadius) || 40}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '4, 4',
                interactive: false,
              }}
            />
            <Marker position={[safePickedCoords.lat, safePickedCoords.lng]} icon={pickedIcon}>
              <Popup className="leaflet-geofence-popup">
                <div className="leaflet-popup-card">
                  <p className="leaflet-popup-title">Picked Zone Center</p>
                  <p>Radius: {Math.round(Number(pickedRadius) || 40)}m</p>
                  <p>
                    Coordinates: {safePickedCoords.lat.toFixed(5)}, {safePickedCoords.lng.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {safeLiveUser &&
          typeof safeLiveUser.accuracy === 'number' &&
          safeLiveUser.accuracy > 5 &&
          safeLiveUser.accuracy < 5000 && (
            <Circle
              center={[safeLiveUser.lat, safeLiveUser.lng]}
              radius={safeLiveUser.accuracy}
              pathOptions={{ color: '#0284c7', weight: 1, fillColor: '#0ea5e9', fillOpacity: 0.12, interactive: false }}
            />
          )}

        {safeLiveUser && nearestZone && isOutsidePremises && (
          <Polyline
            positions={[
              [safeLiveUser.lat, safeLiveUser.lng],
              [nearestZone.lat, nearestZone.lng],
            ]}
            pathOptions={{
              color: '#ef4444',
              weight: 3,
              dashArray: '8, 8',
              opacity: 0.85,
              interactive: false,
            }}
          />
        )}

        {safeLiveUser && (
          <>
            <CircleMarker
              center={[safeLiveUser.lat, safeLiveUser.lng]}
              radius={14}
              pathOptions={{ stroke: false, fillColor: '#38bdf8', fillOpacity: 0.35, interactive: false }}
            />
            <CircleMarker
              center={[safeLiveUser.lat, safeLiveUser.lng]}
              radius={7}
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#0ea5e9', fillOpacity: 1, interactive: false }}
            />
            <Marker position={[safeLiveUser.lat, safeLiveUser.lng]} icon={liveUserIcon}>
              <Popup className="leaflet-geofence-popup">
                <div className="leaflet-popup-card">
                  <p className="leaflet-popup-title">Your Live GPS Location</p>
                  <p>
                    {safeLiveUser.lat.toFixed(6)}, {safeLiveUser.lng.toFixed(6)}
                  </p>
                  {safeLiveUser.accuracy !== undefined && <p>Accuracy: ±{Math.round(safeLiveUser.accuracy)}m</p>}
                  {nearestZoneDistance !== null && nearestZone && (
                    <p style={{ color: isOutsidePremises ? '#e11d48' : '#16a34a', fontWeight: 'bold', marginTop: '4px' }}>
                      {isOutsidePremises
                        ? `Outside: ${nearestZoneDistance}m to ${nearestZone.name}`
                        : `Inside ${nearestZone.name}`}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}

        <MapClickHandler picking={picking} onPick={onPick} />
        <MapFlyTo coords={focusCoords} />
        <FitMapView
          zones={safeZones}
          liveUser={safeLiveUser}
          nearestZone={nearestZone}
          fittedZonesRef={fittedZonesRef}
          fittedLiveUserRef={fittedLiveUserRef}
          recenterTrigger={recenterTrigger}
          onUserInteractionChange={setUserHasMovedMap}
        />
        <MapCustomControls
          onRecenter={() => {
            setUserHasMovedMap(false);
            setRecenterTrigger((prev) => prev + 1);
          }}
          onZoomUser={() => {
            if (safeLiveUser) {
              setUserHasMovedMap(false);
              setRecenterTrigger((prev) => prev + 1);
            }
          }}
          hasLiveUser={Boolean(safeLiveUser)}
        />
      </MapContainer>

      {/* Floating Control Toolbar (Top-Right of Map) */}
      <div
        className={`absolute z-[900] right-3 ${
          isFullscreen ? 'top-16' : 'top-3'
        } flex items-center gap-1.5 pointer-events-auto`}
      >
        {/* Recenter Button */}
        <button
          type="button"
          onClick={() => {
            setUserHasMovedMap(false);
            setRecenterTrigger((prev) => prev + 1);
          }}
          title="Recenter & Fit All Zones"
          className="geofence-map-ctrl-btn w-8 h-8 rounded-xl"
        >
          <Crosshair size={15} />
        </button>

        {/* Fullscreen Maximize / Minimize Button */}
        {allowFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Minimize / Exit Full Screen (Esc)' : 'Maximize Full Screen'}
            className={`geofence-map-ctrl-btn px-2.5 h-8 rounded-xl flex items-center gap-1.5 font-bold text-xs ${
              isFullscreen ? 'bg-blue-600 text-white border-blue-700' : ''
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={14} />
                <span className="hidden sm:inline">Minimize</span>
              </>
            ) : (
              <>
                <Maximize2 size={14} />
                <span className="hidden sm:inline">Maximize</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Picking status badge */}
      {picking && (
        <div className="absolute bottom-3 left-3 z-[900] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 font-semibold shadow-lg border border-blue-100 dark:border-blue-900 flex items-center gap-1.5 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          Click map to position workplace geofence center
        </div>
      )}

      {/* Floating Re-center Action Pill (appears when user manually moves map away) */}
      {userHasMovedMap && safeLiveUser && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[900] pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setUserHasMovedMap(false);
              setRecenterTrigger((prev) => prev + 1);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-full shadow-2xl border border-blue-400/50 text-xs font-bold transition-all cursor-pointer backdrop-blur-md hover:shadow-blue-500/25"
          >
            <Crosshair size={14} className="text-white" />
            <span>Re-center on My Location</span>
          </button>
        </div>
      )}

      {/* Live position badge */}
      {safeLiveUser && !picking && (
        <div className="absolute bottom-3 left-3 right-auto z-[900] flex flex-wrap gap-2 pointer-events-none">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl px-3 py-1.5 text-xs text-gray-800 dark:text-gray-200 shadow border border-sky-200 dark:border-sky-900 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
            <span className="font-semibold text-sky-700 dark:text-sky-300">Your GPS</span>
            <span className="text-gray-400 mx-0.5">·</span>
            <span className="font-mono text-gray-600 dark:text-gray-300">
              {safeLiveUser.lat.toFixed(5)}, {safeLiveUser.lng.toFixed(5)}
            </span>
            {safeLiveUser.accuracy !== undefined && (
              <span className="text-gray-400 ml-1 text-[11px]">±{Math.round(safeLiveUser.accuracy)}m</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MapCustomControls({
  onRecenter,
  onZoomUser,
  hasLiveUser,
}: {
  onRecenter: () => void;
  onZoomUser?: () => void;
  hasLiveUser?: boolean;
}) {
  const map = useMap();

  return (
    <div className="leaflet-bottom leaflet-right !mb-3 !mr-3 z-[800] flex flex-col gap-1.5 pointer-events-auto">
      {hasLiveUser && onZoomUser && (
        <button
          type="button"
          onClick={onZoomUser}
          title="Zoom to My GPS Location"
          className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <Crosshair size={16} />
        </button>
      )}
      <div className="flex flex-col bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          title="Zoom In"
          className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer border-b border-slate-200 dark:border-slate-700"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          title="Zoom Out"
          className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <ZoomOut size={15} />
        </button>
      </div>
    </div>
  );
}

function MapAutoResizer({ isFullscreen, sizePreset }: { isFullscreen?: boolean; sizePreset?: MapSizePreset }) {
  const map = useMap();

  useEffect(() => {
    // Immediate size check
    map.invalidateSize();

    // Staggered size checks to catch CSS transitions / layout shifts
    const timers = [
      setTimeout(() => map.invalidateSize(), 50),
      setTimeout(() => map.invalidateSize(), 150),
      setTimeout(() => map.invalidateSize(), 300),
      setTimeout(() => map.invalidateSize(), 600),
    ];

    // Native ResizeObserver on container to react immediately whenever its size changes
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
      // Ignore if ResizeObserver is unsupported
    }

    return () => {
      timers.forEach(clearTimeout);
      if (ro) ro.disconnect();
    };
  }, [map, isFullscreen, sizePreset]);

  return null;
}

function MapClickHandler({ picking, onPick }: { picking: boolean; onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      if (!picking || !onPick) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ coords }: { coords?: { lat: number; lng: number } }) {
  const map = useMap();
  const lastTargetRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!coords || !isValidCoord(coords.lat, coords.lng)) return;

    // Ignore if coordinates are virtually identical (< 5 meters) to prevent redundant fly animations
    if (lastTargetRef.current) {
      const dist = calculateDistance(
        lastTargetRef.current.lat,
        lastTargetRef.current.lng,
        coords.lat,
        coords.lng
      );
      if (dist < 5) return;
    }

    lastTargetRef.current = { lat: coords.lat, lng: coords.lng };
    const currentZoom = map.getZoom();
    const targetZoom = currentZoom ? Math.max(currentZoom, 17) : 17;
    map.flyTo([coords.lat, coords.lng], targetZoom, { duration: 1.0 });
  }, [coords?.lat, coords?.lng, map]);

  return null;
}

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function FitMapView({
  zones,
  liveUser,
  nearestZone,
  fittedZonesRef,
  fittedLiveUserRef,
  recenterTrigger,
  onUserInteractionChange,
}: {
  zones: GeofenceZone[];
  liveUser: { lat: number; lng: number; accuracy?: number } | null;
  nearestZone?: GeofenceZone | null;
  fittedZonesRef: React.MutableRefObject<boolean>;
  fittedLiveUserRef: React.MutableRefObject<boolean>;
  recenterTrigger?: number;
  onUserInteractionChange?: (interacted: boolean) => void;
}) {
  const map = useMap();
  const userInteractedRef = useRef(false);
  const isProgrammaticMovingRef = useRef(false);
  const lastPanCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  const markUserInteracted = useCallback(() => {
    if (!isProgrammaticMovingRef.current) {
      if (!userInteractedRef.current) {
        userInteractedRef.current = true;
        onUserInteractionChange?.(true);
      }
    }
  }, [onUserInteractionChange]);

  // Leaflet map events for dragging, panning, moving, zooming
  useMapEvents({
    movestart: (e) => {
      // If movement is triggered by user gesture or not marked programmatic, register interaction
      if (e.originalEvent || !isProgrammaticMovingRef.current) {
        markUserInteracted();
      }
    },
    dragstart: () => {
      markUserInteracted();
    },
    drag: () => {
      markUserInteracted();
    },
    zoomstart: (e) => {
      if (e.originalEvent || !isProgrammaticMovingRef.current) {
        markUserInteracted();
      }
    },
    touchstart: () => {
      markUserInteracted();
    },
  });

  // Direct DOM listeners on map container as a fail-safe for any mouse down, touch, pointer, or wheel
  useEffect(() => {
    let container: HTMLElement | null = null;
    try {
      container = map.getContainer();
    } catch {
      return;
    }
    if (!container) return;

    const handlePointerGesture = () => {
      if (!isProgrammaticMovingRef.current) {
        markUserInteracted();
      }
    };

    container.addEventListener('mousedown', handlePointerGesture);
    container.addEventListener('touchstart', handlePointerGesture, { passive: true });
    container.addEventListener('pointerdown', handlePointerGesture);
    container.addEventListener('wheel', handlePointerGesture, { passive: true });

    return () => {
      container.removeEventListener('mousedown', handlePointerGesture);
      container.removeEventListener('touchstart', handlePointerGesture);
      container.removeEventListener('pointerdown', handlePointerGesture);
      container.removeEventListener('wheel', handlePointerGesture);
    };
  }, [map, markUserInteracted]);

  const performFit = useCallback(
    (force = false) => {
      // If the user has manually moved or dragged the map, DO NOT auto-fit or pan unless explicitly forced by recenter
      if (!force && userInteractedRef.current) {
        return;
      }

      isProgrammaticMovingRef.current = true;
      if (liveUser && isValidCoord(liveUser.lat, liveUser.lng)) {
        if (!nearestZone) {
          map.setView([liveUser.lat, liveUser.lng], 17, { animate: true });
          map.invalidateSize();
          setTimeout(() => {
            isProgrammaticMovingRef.current = false;
          }, 800);
          return;
        }

        // Check distance to designated target zone
        const dist = calculateDistance(liveUser.lat, liveUser.lng, nearestZone.lat, nearestZone.lng);

        if (dist <= 1500) {
          try {
            const zoneBounds = L.latLng(nearestZone.lat, nearestZone.lng).toBounds(nearestZone.radius || 40);
            const points: [number, number][] = [
              [liveUser.lat, liveUser.lng],
              [zoneBounds.getNorthEast().lat, zoneBounds.getNorthEast().lng],
              [zoneBounds.getSouthWest().lat, zoneBounds.getSouthWest().lng],
            ];
            map.fitBounds(points, { padding: [45, 45], maxZoom: 18 });
          } catch {
            map.setView([liveUser.lat, liveUser.lng], 17, { animate: true });
          }
        } else {
          // Outside or calibrating: center cleanly at zoom 17
          map.setView([liveUser.lat, liveUser.lng], 17, { animate: true });
        }
        map.invalidateSize();
        setTimeout(() => {
          isProgrammaticMovingRef.current = false;
        }, 800);
        return;
      }

      if (zones.length > 0) {
        const points = zones
          .flatMap((zone) => {
            const zoneBounds = L.latLng(zone.lat, zone.lng).toBounds(zone.radius);
            return [zoneBounds.getNorthEast(), zoneBounds.getSouthWest()].map(
              (point) => [point.lat, point.lng] as [number, number]
            );
          })
          .filter(([lat, lng]) => isValidCoord(lat, lng));

        if (points.length > 0) {
          try {
            if (points.length === 1) {
              map.setView(points[0], 17, { animate: true });
            } else {
              map.fitBounds(points, {
                padding: [60, 60],
                maxZoom: 17,
              });
            }
          } catch {
            // fallback
          }
        }
      }
      setTimeout(() => {
        isProgrammaticMovingRef.current = false;
      }, 800);
    },
    [liveUser, map, zones, nearestZone]
  );

  // Initial fit on mount only
  useEffect(() => {
    if (userInteractedRef.current) return;

    if (liveUser && isValidCoord(liveUser.lat, liveUser.lng)) {
      if (!fittedLiveUserRef.current) {
        performFit(false);
        fittedLiveUserRef.current = true;
        lastPanCenterRef.current = { lat: liveUser.lat, lng: liveUser.lng };
      }
      return;
    }

    if (!fittedZonesRef.current && zones.length > 0 && !liveUser) {
      performFit(false);
      fittedZonesRef.current = true;
    }
  }, [liveUser, zones, fittedLiveUserRef, fittedZonesRef, performFit]);

  // Real-time GPS tracking:
  // 1. If user has dragged, moved, or zoomed, DO NOT pan or zoom (gives user complete freedom)
  // 2. Only pan if device has moved > 15m (eliminates stationary GPS jitter / drift)
  useEffect(() => {
    if (!liveUser || !isValidCoord(liveUser.lat, liveUser.lng)) return;

    if (userInteractedRef.current) return;

    if (lastPanCenterRef.current) {
      const dist = calculateDistance(
        lastPanCenterRef.current.lat,
        lastPanCenterRef.current.lng,
        liveUser.lat,
        liveUser.lng
      );
      if (dist < 15) return;
    }

    lastPanCenterRef.current = { lat: liveUser.lat, lng: liveUser.lng };
    isProgrammaticMovingRef.current = true;
    map.panTo([liveUser.lat, liveUser.lng], { animate: true, duration: 0.8 });
    setTimeout(() => {
      isProgrammaticMovingRef.current = false;
    }, 900);
  }, [liveUser?.lat, liveUser?.lng, map]);

  // Explicit recenter trigger (e.g. user clicks recenter button / crosshair / action pill)
  useEffect(() => {
    if (recenterTrigger && recenterTrigger > 0) {
      userInteractedRef.current = false;
      onUserInteractionChange?.(false);
      if (liveUser && isValidCoord(liveUser.lat, liveUser.lng)) {
        lastPanCenterRef.current = { lat: liveUser.lat, lng: liveUser.lng };
      }
      performFit(true);
    }
  }, [recenterTrigger, performFit, liveUser, onUserInteractionChange]);

  return null;
}
