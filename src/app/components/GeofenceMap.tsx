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
  /** Employee / trainee live GPS — shows position vs geofences */
  liveUser?: { lat: number; lng: number; accuracy?: number } | null;
  /** e.g. h-64 (admin) or h-72 min-h-[220px] (time record) */
  className?: string;
}

export function GeofenceMap({
  zones,
  picking = false,
  pickedCoords,
  onPick,
  liveUser = null,
  className = 'h-64',
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

  useEffect(() => {
    if (!safeLiveUser) fittedLiveUserRef.current = false;
  }, [safeLiveUser]);

  return (
    <div className={`relative ${className} min-h-[200px]`}>
      <MapContainer center={defaultCenter} zoom={13} scrollWheelZoom className="absolute inset-0 z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {safeZones.map((zone) => (
          <React.Fragment key={zone.id}>
            <Circle
              center={[zone.lat, zone.lng]}
              radius={zone.radius}
              pathOptions={{
                color: zone.active ? '#2563eb' : '#94a3b8',
                fillColor: zone.active ? '#3b82f6' : '#94a3b8',
                fillOpacity: 0.18,
                weight: 2,
              }}
            />
            <Marker position={[zone.lat, zone.lng]} icon={zone.active ? zoneIcon : inactiveZoneIcon}>
              <Popup className="leaflet-geofence-popup">
                <div className="leaflet-popup-card">
                  <p className="leaflet-popup-title">{zone.name || 'Geofence Zone'}</p>
                  <p>Radius: {Math.round(zone.radius)}m</p>
                  <p>Status: {zone.active ? 'Active' : 'Inactive'}</p>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}

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

function MapClickHandler({ picking, onPick }: { picking: boolean; onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      if (!picking || !onPick) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
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
    if (liveUser && !fittedLiveUserRef.current) {
      const points = [
        [liveUser.lat, liveUser.lng] as [number, number],
        ...zones.map((zone) => [zone.lat, zone.lng] as [number, number]),
      ].filter(([lat, lng]) => isValidCoord(lat, lng));
      if (points.length > 0) {
        try {
          const targetZoom = liveUser.accuracy && liveUser.accuracy > 200 ? 14 : 17;
          if (points.length === 1) {
            map.setView(points[0], targetZoom);
          } else {
            map.fitBounds(points, {
              padding: [48, 48],
              maxZoom: targetZoom,
            });
          }
          fittedLiveUserRef.current = true;
        } catch {
          // Keep map usable even if a malformed coordinate slips through.
        }
      }
      return;
    }

    if (!fittedZonesRef.current && zones.length > 0 && !liveUser) {
      const points = zones
        .map((zone) => [zone.lat, zone.lng] as [number, number])
        .filter(([lat, lng]) => isValidCoord(lat, lng));
      if (points.length > 0) {
        try {
          if (points.length === 1) {
            map.setView(points[0], 16);
          } else {
            map.fitBounds(points, { padding: [80, 80] });
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
