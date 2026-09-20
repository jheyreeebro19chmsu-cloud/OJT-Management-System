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
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import './geofence-map.css';
import type { GeofenceZone } from '../types';

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
  const defaultCenter = useMemo<[number, number]>(() => [14.5547, 121.0244], []);

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
              onClick={() => setRecenterTrigger((prev) => prev + 1)}
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
              pathOptions={{ color: '#0284c7', weight: 1, fillColor: '#0ea5e9', fillOpacity: 0.12 }}
            />
          )}

        {safeLiveUser && (
          <>
            <CircleMarker
              center={[safeLiveUser.lat, safeLiveUser.lng]}
              radius={14}
              pathOptions={{ stroke: false, fillColor: '#38bdf8', fillOpacity: 0.35 }}
            />
            <CircleMarker
              center={[safeLiveUser.lat, safeLiveUser.lng]}
              radius={7}
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#0ea5e9', fillOpacity: 1 }}
            />
            <Marker position={[safeLiveUser.lat, safeLiveUser.lng]} icon={liveUserIcon}>
              <Popup className="leaflet-geofence-popup">
                <div className="leaflet-popup-card">
                  <p className="leaflet-popup-title">Your Position</p>
                  <p>
                    {safeLiveUser.lat.toFixed(5)}, {safeLiveUser.lng.toFixed(5)}
                  </p>
                  {safeLiveUser.accuracy !== undefined && <p>Accuracy: ±{Math.round(safeLiveUser.accuracy)}m</p>}
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
          fittedZonesRef={fittedZonesRef}
          fittedLiveUserRef={fittedLiveUserRef}
          recenterTrigger={recenterTrigger}
        />
        <MapCustomControls
          onRecenter={() => setRecenterTrigger((prev) => prev + 1)}
        />
      </MapContainer>

      {/* Floating Control Toolbar (Top-Right of Map) */}
      <div
        className={`absolute z-[900] right-3 ${
          isFullscreen ? 'top-16' : 'top-3'
        } flex flex-col items-end gap-2 pointer-events-auto`}
      >
        {/* Height Size Adjustment Controls (when not full screen) */}
        {!isFullscreen && allowResize && (
          <div className="flex items-center bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold gap-1">
            <button
              type="button"
              onClick={() => handleSizePresetChange('compact')}
              title="Minimize Map Height (Compact)"
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                sizePreset === 'compact'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => handleSizePresetChange('normal')}
              title="Normal Height (Standard)"
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                sizePreset === 'normal'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => handleSizePresetChange('expanded')}
              title="Maximize Height (Expanded)"
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                sizePreset === 'expanded'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Expanded
            </button>
          </div>
        )}

        {/* Action Button Row */}
        <div className="flex items-center gap-1.5">
          {/* Recenter Button */}
          <button
            type="button"
            onClick={() => setRecenterTrigger((prev) => prev + 1)}
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
      </div>

      {/* Picking status badge */}
      {picking && (
        <div className="absolute bottom-3 left-3 z-[900] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 font-semibold shadow-lg border border-blue-100 dark:border-blue-900 flex items-center gap-1.5 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          Click map to position workplace geofence center
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

function MapCustomControls({ onRecenter }: { onRecenter: () => void }) {
  const map = useMap();

  return (
    <div className="leaflet-bottom leaflet-right !mb-3 !mr-3 z-[800] flex flex-col gap-1 pointer-events-auto">
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
  useEffect(() => {
    if (coords && isValidCoord(coords.lat, coords.lng)) {
      map.flyTo([coords.lat, coords.lng], 17, { duration: 1.2 });
    }
  }, [coords, map]);
  return null;
}

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function FitMapView({
  zones,
  liveUser,
  fittedZonesRef,
  fittedLiveUserRef,
  recenterTrigger,
}: {
  zones: GeofenceZone[];
  liveUser: { lat: number; lng: number; accuracy?: number } | null;
  fittedZonesRef: React.MutableRefObject<boolean>;
  fittedLiveUserRef: React.MutableRefObject<boolean>;
  recenterTrigger?: number;
}) {
  const map = useMap();

  const performFit = useCallback(() => {
    if (liveUser && isValidCoord(liveUser.lat, liveUser.lng)) {
      if (zones.length === 0) {
        map.setView([liveUser.lat, liveUser.lng], 16, { animate: true });
        map.invalidateSize();
        return;
      }
      const points = [
        [liveUser.lat, liveUser.lng] as [number, number],
        ...zones.flatMap((zone) => {
          const bounds = L.latLng(zone.lat, zone.lng).toBounds(zone.radius).getNorthEast();
          const southWest = L.latLng(zone.lat, zone.lng).toBounds(zone.radius).getSouthWest();
          return [
            [bounds.lat, bounds.lng] as [number, number],
            [southWest.lat, southWest.lng] as [number, number],
          ];
        }),
      ].filter(([lat, lng]) => isValidCoord(lat, lng));

      if (points.length > 0) {
        try {
          if (points.length === 1) {
            map.setView(points[0], 16, { animate: true });
          } else {
            map.fitBounds(points, {
              padding: [48, 48],
              maxZoom: 16,
            });
          }
        } catch {
          // fallback
        }
      }
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
            map.setView(points[0], 16, { animate: true });
          } else {
            map.fitBounds(points, {
              padding: [60, 60],
              maxZoom: 16,
            });
          }
        } catch {
          // fallback
        }
      }
    }
  }, [liveUser, map, zones]);

  // Initial fit on mount
  useEffect(() => {
    if (liveUser && isValidCoord(liveUser.lat, liveUser.lng)) {
      if (zones.length === 0) {
        map.setView([liveUser.lat, liveUser.lng], 16, { animate: false });
        map.invalidateSize();
        return;
      }
      if (!fittedLiveUserRef.current) {
        performFit();
        fittedLiveUserRef.current = true;
      }
      return;
    }

    if (!fittedZonesRef.current && zones.length > 0 && !liveUser) {
      performFit();
      fittedZonesRef.current = true;
    }
  }, [liveUser, map, zones, fittedLiveUserRef, fittedZonesRef, performFit]);

  // Explicit recenter trigger
  useEffect(() => {
    if (recenterTrigger && recenterTrigger > 0) {
      performFit();
    }
  }, [recenterTrigger, performFit]);

  return null;
}
