import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  Navigation,
  MapPin,
  Compass,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Layers,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react-native';

export interface LeafletGeofenceMapProps {
  centerLat: number;
  centerLng: number;
  radius: number;
  userLat?: number | null;
  userLng?: number | null;
  userAccuracy?: number | null;
  zoneName?: string;
  interactive?: boolean; // Can user tap/drag to change coordinates?
  height?: number;
  onLocationChange?: (location: { lat: number; lng: number; address?: string }) => void;
  style?: any;
}

export default function LeafletGeofenceMap({
  centerLat,
  centerLng,
  radius = 40,
  userLat,
  userLng,
  userAccuracy,
  zoneName = 'Workplace Geofence',
  interactive = true,
  height = 320,
  onLocationChange,
  style,
}: LeafletGeofenceMapProps) {
  const webViewRef = useRef<WebView | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentLat, setCurrentLat] = useState(centerLat || 10.7412);
  const [currentLng, setCurrentLng] = useState(centerLng || 122.9691);

  // Calculate distance between user and center in meters (Haversine)
  const distanceToCenter = useMemo(() => {
    if (!userLat || !userLng || !centerLat || !centerLng) return null;
    const R = 6371e3; // metres
    const φ1 = (userLat * Math.PI) / 180;
    const φ2 = (centerLat * Math.PI) / 180;
    const Δφ = ((centerLat - userLat) * Math.PI) / 180;
    const Δλ = ((centerLng - userLng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }, [userLat, userLng, centerLat, centerLng]);

  const isInsideGeofence = distanceToCenter !== null ? distanceToCenter <= radius : null;

  // Sync external center props into local state
  useEffect(() => {
    if (centerLat && centerLng && (centerLat !== currentLat || centerLng !== currentLng)) {
      setCurrentLat(centerLat);
      setCurrentLng(centerLng);
      if (mapLoaded && webViewRef.current) {
        const js = `if (window.updateGeofenceCenter) { window.updateGeofenceCenter(${centerLat}, ${centerLng}, ${radius}); }`;
        webViewRef.current.injectJavaScript(js);
      }
    }
  }, [centerLat, centerLng, radius, mapLoaded]);

  // Sync radius changes into map
  useEffect(() => {
    if (mapLoaded && webViewRef.current) {
      const js = `if (window.updateGeofenceRadius) { window.updateGeofenceRadius(${radius}); }`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [radius, mapLoaded]);

  // Sync user location changes into map
  useEffect(() => {
    if (mapLoaded && webViewRef.current && userLat && userLng) {
      const js = `if (window.updateUserLocation) { window.updateUserLocation(${userLat}, ${userLng}, ${userAccuracy || 0}); }`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [userLat, userLng, userAccuracy, mapLoaded]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        setMapLoaded(true);
      } else if (data.type === 'LOCATION_SELECTED') {
        setCurrentLat(data.lat);
        setCurrentLng(data.lng);
        if (onLocationChange) {
          onLocationChange({
            lat: Number(data.lat.toFixed(6)),
            lng: Number(data.lng.toFixed(6)),
            address: data.address || '',
          });
        }
      }
    } catch (e) {
      console.warn('Error parsing Leaflet map message:', e);
    }
  };

  const centerOnOffice = () => {
    if (webViewRef.current) {
      const js = `if (window.map && window.centerMarker) { window.map.flyTo([${currentLat}, ${currentLng}], 16, { animate: true }); }`;
      webViewRef.current.injectJavaScript(js);
    }
  };

  const centerOnUser = () => {
    if (userLat && userLng && webViewRef.current) {
      const js = `if (window.map) { window.map.flyTo([${userLat}, ${userLng}], 18, { animate: true }); }`;
      webViewRef.current.injectJavaScript(js);
    }
  };

  const zoomIn = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('if (window.map) { window.map.zoomIn(); }');
    }
  };

  const zoomOut = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('if (window.map) { window.map.zoomOut(); }');
    }
  };

  // Generate Leaflet HTML
  const leafletHtml = useMemo(() => {
    const initLat = centerLat || 10.7412;
    const initLng = centerLng || 122.9691;
    const initRadius = radius || 300;
    const safeZoneName = (zoneName || 'Workplace Geofence').replace(/['"\\]/g, '');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Leaflet Geofence Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background-color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    /* Custom Pin Marker */
    .custom-office-pin {
      background: none;
      border: none;
    }
    .office-pin-wrapper {
      position: relative;
      width: 40px;
      height: 48px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
      cursor: ${interactive ? 'grab' : 'default'};
    }
    .office-pin-bubble {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #ffffff;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .office-pin-icon {
      transform: rotate(45deg);
      color: #ffffff;
      font-size: 16px;
      font-weight: 800;
    }
    .office-pin-shadow {
      width: 14px;
      height: 6px;
      background: rgba(15, 23, 42, 0.25);
      border-radius: 50%;
      margin-top: 2px;
      filter: blur(1.5px);
    }

    /* Custom User Location Marker */
    .user-pulse-marker {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #2563eb;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.35);
      animation: pulse 2s infinite;
      transform: translate(-50%, -50%);
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.6); }
      70% { box-shadow: 0 0 0 12px rgba(37, 99, 235, 0); }
      100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
    }

    /* Leaflet Popup Styling */
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      font-size: 12px;
      padding: 4px 8px;
    }
    .popup-title {
      font-weight: 800;
      color: #0f172a;
      font-size: 13px;
      margin-bottom: 2px;
    }
    .popup-desc {
      color: #64748b;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    const interactive = ${interactive ? 'true' : 'false'};
    let curLat = ${initLat};
    let curLng = ${initLng};
    let curRadius = ${initRadius};
    let geofenceCircle = null;
    let centerMarker = null;
    let userMarker = null;
    let userAccCircle = null;
    let navLine = null;

    function post(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    // Initialize map - prioritize zooming in directly where user location is
    const hasUserCoords = ${Boolean(userLat && userLng) ? 'true' : 'false'};
    const initCenter = hasUserCoords ? [${userLat || 0}, ${userLng || 0}] : [curLat, curLng];
    const initZoom = hasUserCoords ? 18 : 16;

    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView(initCenter, initZoom);

    // OpenStreetMap standard tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c']
    }).addTo(map);

    // Custom Office Pin DivIcon
    const officeIcon = L.divIcon({
      className: 'custom-office-pin',
      html: '<div class="office-pin-wrapper"><div class="office-pin-bubble"><span class="office-pin-icon">🏢</span></div><div class="office-pin-shadow"></div></div>',
      iconSize: [40, 48],
      iconAnchor: [20, 48]
    });

    // Custom User Dot DivIcon
    const userIcon = L.divIcon({
      className: 'user-pin',
      html: '<div class="user-pulse-marker"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    // Create Office Marker
    centerMarker = L.marker([curLat, curLng], {
      icon: officeIcon,
      draggable: interactive
    }).addTo(map);

    centerMarker.bindPopup('<div class="popup-title">${safeZoneName}</div><div class="popup-desc">Perimeter Center (' + curLat.toFixed(4) + ', ' + curLng.toFixed(4) + ')</div>');

    // Create Geofence Perimeter Circle
    geofenceCircle = L.circle([curLat, curLng], {
      radius: curRadius,
      color: '#059669',
      weight: 2.5,
      fillColor: '#10b981',
      fillOpacity: 0.18,
      dashArray: '6, 6'
    }).addTo(map);

    // Reverse Geocoding helper via Nominatim
    async function reverseGeocode(lat, lng) {
      try {
        const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          return json.display_name || '';
        }
      } catch (err) {}
      return '';
    }

    // Handle marker drag end
    if (interactive) {
      centerMarker.on('dragend', async function(e) {
        const coord = e.target.getLatLng();
        curLat = coord.lat;
        curLng = coord.lng;
        geofenceCircle.setLatLng(coord);
        centerMarker.setPopupContent('<div class="popup-title">${safeZoneName}</div><div class="popup-desc">' + curLat.toFixed(6) + ', ' + curLng.toFixed(6) + '</div>');
        const addr = await reverseGeocode(curLat, curLng);
        post({ type: 'LOCATION_SELECTED', lat: curLat, lng: curLng, address: addr });
      });

      // Handle map click to reposition pin
      map.on('click', async function(e) {
        const coord = e.latlng;
        curLat = coord.lat;
        curLng = coord.lng;
        centerMarker.setLatLng(coord);
        geofenceCircle.setLatLng(coord);
        centerMarker.setPopupContent('<div class="popup-title">${safeZoneName}</div><div class="popup-desc">' + curLat.toFixed(6) + ', ' + curLng.toFixed(6) + '</div>');
        const addr = await reverseGeocode(curLat, curLng);
        post({ type: 'LOCATION_SELECTED', lat: curLat, lng: curLng, address: addr });
      });
    }

    // Global Functions called from React Native
    window.updateGeofenceCenter = function(lat, lng, radius) {
      curLat = lat;
      curLng = lng;
      if (radius) curRadius = radius;
      if (centerMarker) centerMarker.setLatLng([lat, lng]);
      if (geofenceCircle) {
        geofenceCircle.setLatLng([lat, lng]);
        if (radius) geofenceCircle.setRadius(radius);
      }
      map.panTo([lat, lng], { animate: true });
    };

    window.updateGeofenceRadius = function(radius) {
      curRadius = radius;
      if (geofenceCircle) geofenceCircle.setRadius(radius);
    };

    window.updateUserLocation = function(lat, lng, accuracy) {
      if (!userMarker) {
        userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
        userMarker.bindPopup('<div class="popup-title">Your Live GPS Position</div><div class="popup-desc">Movable Device Location</div>');
      } else {
        userMarker.setLatLng([lat, lng]);
      }

      if (accuracy && accuracy > 5) {
        if (!userAccCircle) {
          userAccCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#3b82f6',
            fillColor: '#60a5fa',
            fillOpacity: 0.12,
            weight: 1
          }).addTo(map);
        } else {
          userAccCircle.setLatLng([lat, lng]);
          userAccCircle.setRadius(accuracy);
        }
      }

      // Calculate distance between movable GPS and geofence center
      const dLat = (curLat - lat) * 111320;
      const dLng = (curLng - lng) * (111320 * Math.cos((lat * Math.PI) / 180));
      const dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
      const isOutside = dist > curRadius;

      // When outside the premises: draw real-time navigation line pointing to workplace
      if (isOutside) {
        if (!navLine) {
          navLine = L.polyline([[lat, lng], [curLat, curLng]], {
            color: '#ef4444',
            weight: 3,
            dashArray: '6, 6',
            opacity: 0.85
          }).addTo(map);
        } else {
          navLine.setLatLngs([[lat, lng], [curLat, curLng]]);
        }
      } else if (navLine) {
        map.removeLayer(navLine);
        navLine = null;
      }

      // Smoothly zoom in to where their location was on first lock, then smoothly pan movable GPS
      if (!window.__userLocationLocked) {
        window.__userLocationLocked = true;
        if (dist <= 650) {
          map.fitBounds([[lat, lng], [curLat, curLng]], { padding: [40, 40], maxZoom: 18 });
        } else {
          map.setView([lat, lng], 18, { animate: true });
        }
      } else {
        map.panTo([lat, lng], { animate: true, duration: 0.7 });
      }
    };

    ${userLat && userLng ? `window.updateUserLocation(${userLat}, ${userLng}, ${userAccuracy || 0});` : ''}

    window.centerMarker = centerMarker;
    window.map = map;
    post({ type: 'MAP_READY' });
  </script>
</body>
</html>
    `;
  }, [centerLat, centerLng, radius, userLat, userLng, userAccuracy, zoneName, interactive]);

  return (
    <View style={[styles.container, { height }, style]}>
      {/* Interactive Leaflet WebView */}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml }}
        style={styles.webView}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Loading Interactive Leaflet Map...</Text>
          </View>
        )}
      />

      {/* Floating Header Info Pill */}
      <View style={styles.headerPillContainer} pointerEvents="box-none">
        <View style={styles.headerPill}>
          <View
            style={[
              styles.dotIndicator,
              { backgroundColor: isInsideGeofence === false ? '#ef4444' : '#10b981' },
            ]}
          />
          <Text style={styles.headerPillText} numberOfLines={1}>
            {zoneName}
          </Text>
          <View style={styles.radiusBadge}>
            <Text style={styles.radiusBadgeText}>{radius}m radius</Text>
          </View>
        </View>

        {distanceToCenter !== null && (
          <View
            style={[
              styles.distancePill,
              isInsideGeofence ? styles.distancePillInside : styles.distancePillOutside,
            ]}
          >
            {isInsideGeofence ? (
              <ShieldCheck size={12} color="#15803d" style={{ marginRight: 4 }} />
            ) : (
              <AlertTriangle size={12} color="#b91c1c" style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.distancePillText,
                isInsideGeofence ? { color: '#15803d' } : { color: '#b91c1c' },
              ]}
            >
              {distanceToCenter}m away • {isInsideGeofence ? 'Inside Zone' : 'Outside Perimeter'}
            </Text>
          </View>
        )}
      </View>

      {/* Map Control Overlay Buttons */}
      <View style={styles.controlsContainer} pointerEvents="box-none">
        {/* Maximize to Full Screen */}
        <TouchableOpacity
          style={[styles.controlBtn, styles.fullscreenTriggerBtn]}
          onPress={() => setIsFullScreen(true)}
          activeOpacity={0.8}
        >
          <Maximize2 size={16} color="#2563eb" />
        </TouchableOpacity>

        {/* Recenter on Office Pin */}
        <TouchableOpacity style={styles.controlBtn} onPress={centerOnOffice} activeOpacity={0.8}>
          <MapPin size={17} color="#059669" />
        </TouchableOpacity>

        {/* Center on User GPS */}
        {Boolean(userLat && userLng) && (
          <TouchableOpacity style={styles.controlBtn} onPress={centerOnUser} activeOpacity={0.8}>
            <Navigation size={17} color="#2563eb" />
          </TouchableOpacity>
        )}

        {/* Zoom In / Zoom Out */}
        <View style={styles.zoomButtonGroup}>
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn} activeOpacity={0.8}>
            <ZoomIn size={16} color="#334155" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut} activeOpacity={0.8}>
            <ZoomOut size={16} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Touch instruction hint when interactive */}
      {interactive && (
        <View style={styles.footerHint} pointerEvents="none">
          <Compass size={12} color="#64748b" style={{ marginRight: 4 }} />
          <Text style={styles.footerHintText}>
            Tap anywhere or drag pin to set workplace coordinates
          </Text>
        </View>
      )}

      {/* Fullscreen Mobile Modal */}
      <Modal
        visible={isFullScreen}
        animationType="slide"
        onRequestClose={() => setIsFullScreen(false)}
      >
        <SafeAreaView style={styles.fullscreenModalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#090d16" />

          {/* Fullscreen Header */}
          <View style={styles.fullscreenHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.fullscreenTitle} numberOfLines={1}>
                  {zoneName}
                </Text>
                <View style={styles.fullscreenBadge}>
                  <Text style={styles.fullscreenBadgeText}>Full Screen</Text>
                </View>
              </View>
              <Text style={styles.fullscreenSubtitle}>
                Perimeter: {radius}m • Lat: {Number(currentLat).toFixed(5)}, Lng: {Number(currentLng).toFixed(5)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setIsFullScreen(false)}
              activeOpacity={0.8}
            >
              <Minimize2 size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.fullscreenCloseBtnText}>Exit</Text>
            </TouchableOpacity>
          </View>

          {/* Fullscreen Map Body */}
          <View style={styles.fullscreenMapBody}>
            <WebView
              originWhitelist={['*']}
              source={{ html: leafletHtml }}
              style={styles.webView}
              onMessage={handleMessage}
              scrollEnabled={false}
              bounces={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />

            {/* Controls Overlay in Fullscreen */}
            <View style={styles.controlsContainer} pointerEvents="box-none">
              <TouchableOpacity style={styles.controlBtn} onPress={centerOnOffice} activeOpacity={0.8}>
                <MapPin size={17} color="#059669" />
              </TouchableOpacity>

              {Boolean(userLat && userLng) && (
                <TouchableOpacity style={styles.controlBtn} onPress={centerOnUser} activeOpacity={0.8}>
                  <Navigation size={17} color="#2563eb" />
                </TouchableOpacity>
              )}

              <View style={styles.zoomButtonGroup}>
                <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn} activeOpacity={0.8}>
                  <ZoomIn size={16} color="#334155" />
                </TouchableOpacity>
                <View style={styles.zoomDivider} />
                <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut} activeOpacity={0.8}>
                  <ZoomOut size={16} color="#334155" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer hint in fullscreen */}
            {interactive && (
              <View style={styles.footerHint} pointerEvents="none">
                <Compass size={12} color="#64748b" style={{ marginRight: 4 }} />
                <Text style={styles.footerHintText}>
                  Tap anywhere or drag pin to set workplace coordinates
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  headerPillContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 54,
    gap: 6,
    zIndex: 5,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  headerPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  radiusBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginLeft: 6,
  },
  radiusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  distancePillInside: {
    backgroundColor: 'rgba(240, 253, 244, 0.94)',
    borderColor: '#bbf7d0',
  },
  distancePillOutside: {
    backgroundColor: 'rgba(254, 242, 242, 0.94)',
    borderColor: '#fecaca',
  },
  distancePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  controlsContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 8,
    zIndex: 5,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  zoomButtonGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    width: '100%',
  },
  footerHint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 5,
  },
  footerHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  fullscreenTriggerBtn: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  fullscreenModalContainer: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  fullscreenTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  fullscreenSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  fullscreenBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  fullscreenBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60a5fa',
  },
  fullscreenCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 12,
  },
  fullscreenCloseBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  fullscreenMapBody: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#e2e8f0',
  },
});
