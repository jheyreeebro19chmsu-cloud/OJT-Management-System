import L from 'leaflet';
import React, { useEffect, useMemo, useRef } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import './geofence-map.css';
import type { GeofenceZone } from '../types';

export interface GeofenceMapProps {
  zones: GeofenceZone[];
  /** Admin: click map to set zone center */
  picking?: boolean;
  pickedCoords?: { lat: number; lng: number };
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
}

export function GeofenceMap({
  zones,
  picking = false,
  pickedCoords,
  onPick,
  focusCoords,
  liveUser = null,
  className = 'h-64',
  draggableZoneId = null,
  onZoneDrag,
  onZoneDragEnd,
  onZoneClick,
}: GeofenceMapProps) {
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

  return (
    <div className={`relative ${className} min-h-[200px] z-0 isolate overflow-hidden`}>
      <MapContainer
        center={initialCenter}
        zoom={16}
        scrollWheelZoom
        className="w-full h-full relative z-0"
        style={{ width: '100%', height: '100%' }}
      >
        <MapAutoResizer />
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
                radius={Number(zone.radius) || 100}
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
                    <p>Radius: {Math.round(zone.radius)}m</p>
                    <p>Coordinates: {zone.lat.toFixed(5)}, {zone.lng.toFixed(5)}</p>
                    <p>Status: {zone.active ? 'Active' : 'Inactive'}</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {safePickedCoords && (
          <Marker position={[safePickedCoords.lat, safePickedCoords.lng]} icon={pickedIcon}>
            <Popup className="leaflet-geofence-popup">
              <div className="leaflet-popup-card">
                <p className="leaflet-popup-title">Picked Zone Center</p>
                <p>A pretty CSS popup.</p>
                <p>Easily customizable.</p>
              </div>
            </Popup>
          </Marker>
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
        />
      </MapContainer>
      {picking && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs text-gray-700 shadow">
          Click the map to set the zone center
        </div>
      )}
      {safeLiveUser && !picking && (
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs text-gray-800 shadow border border-sky-100">
            <span className="font-semibold text-sky-700">Your position</span>
            <span className="text-gray-500 mx-1">·</span>
            <span className="font-mono text-gray-600">
              {safeLiveUser.lat.toFixed(5)}, {safeLiveUser.lng.toFixed(5)}
            </span>
            {safeLiveUser.accuracy !== undefined && (
              <span className="text-gray-500 ml-1">±{Math.round(safeLiveUser.accuracy)}m</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MapAutoResizer() {
  const map = useMap();

  useEffect(() => {
    // Immediate size check
    map.invalidateSize();

    // Staggered size checks to catch CSS transitions / Framer Motion expansion
    const timers = [
      setTimeout(() => map.invalidateSize(), 80),
      setTimeout(() => map.invalidateSize(), 200),
      setTimeout(() => map.invalidateSize(), 400),
      setTimeout(() => map.invalidateSize(), 800),
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
      // Ignore if ResizeObserver is unsupported or throws
    }

    return () => {
      timers.forEach(clearTimeout);
      if (ro) ro.disconnect();
    };
  }, [map]);

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
}: {
  zones: GeofenceZone[];
  liveUser: { lat: number; lng: number; accuracy?: number } | null;
  fittedZonesRef: React.MutableRefObject<boolean>;
  fittedLiveUserRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();

  useEffect(() => {
    if (liveUser && isValidCoord(liveUser.lat, liveUser.lng)) {
      if (zones.length === 0) {
        // In registration / single live GPS tracking mode, constantly center to live GPS
        map.setView([liveUser.lat, liveUser.lng], 16, { animate: false });
        map.invalidateSize();
        return;
      }
      if (!fittedLiveUserRef.current) {
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
              map.setView(points[0], 16);
            } else {
              map.fitBounds(points, {
                padding: [48, 48],
                maxZoom: 16,
              });
            }
            fittedLiveUserRef.current = true;
          } catch {
            // Keep map usable even if a malformed coordinate slips through.
          }
        }
        return;
      }
    }

    if (!fittedZonesRef.current && zones.length > 0 && !liveUser) {
      const points = zones
        .flatMap((zone) => {
          const zoneBounds = L.latLng(zone.lat, zone.lng).toBounds(zone.radius);
          return [zoneBounds.getNorthEast(), zoneBounds.getSouthWest()].map((point) => [point.lat, point.lng] as [number, number]);
        })
        .filter(([lat, lng]) => isValidCoord(lat, lng));
      if (points.length > 0) {
        try {
          if (points.length === 1) {
            map.setView(points[0], 16);
          } else {
            map.fitBounds(points, {
              padding: [80, 80],
              maxZoom: 16,
            });
          }
          fittedZonesRef.current = true;
        } catch {
          // Keep map usable even if a malformed coordinate slips through.
        }
      }
    }
  }, [liveUser, map, zones, fittedLiveUserRef, fittedZonesRef]);

  return null;
}
