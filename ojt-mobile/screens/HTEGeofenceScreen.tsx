import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  MapPin,
  ArrowLeft,
  Navigation,
  ShieldCheck,
  CheckCircle2,
  Building,
  Save,
  Compass,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { mobileDb } from '../lib/supabaseService';

interface HTEGeofenceScreenProps {
  onBack: () => void;
  profile: any;
}

const RADIUS_OPTIONS = [50, 100, 150, 200, 300, 500];

export default function HTEGeofenceScreen({ onBack, profile }: HTEGeofenceScreenProps) {
  const [loading, setLoading] = useState(false);
  const [locDetecting, setLocDetecting] = useState(false);
  const [companyName, setCompanyName] = useState(profile?.companyName || 'Host Training Establishment');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [radius, setRadius] = useState<number>(300);
  const [address, setAddress] = useState<string>('');
  const [currentGps, setCurrentGps] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    loadExistingGeofence();
  }, [profile]);

  async function loadExistingGeofence() {
    setLoading(true);
    try {
      const regLoc = profile?.registration_location || profile?.registrationLocation;
      if (regLoc?.lat && regLoc?.lng) {
        setLatitude(String(regLoc.lat));
        setLongitude(String(regLoc.lng));
        if (regLoc.address) setAddress(regLoc.address);
      } else if (profile?.registration_lat && profile?.registration_lng) {
        setLatitude(String(profile.registration_lat));
        setLongitude(String(profile.registration_lng));
        if (profile.registration_address) setAddress(profile.registration_address);
      } else {
        // Fallback: search geofence_zones for company name
        const zones = await mobileDb.getGeofenceZones();
        const found = zones.find((z) => z.name && z.name.toLowerCase().includes(companyName.toLowerCase()));
        if (found) {
          setLatitude(String(found.lat));
          setLongitude(String(found.lng));
          setRadius(found.radius || 300);
          if (found.address) setAddress(found.address);
        }
      }
    } catch (e) {
      console.warn('Error loading existing geofence:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDetectLocation() {
    setLocDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location permissions in device settings to detect GPS.');
        setLocDetecting(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentGps(loc);
      setLatitude(loc.coords.latitude.toFixed(6));
      setLongitude(loc.coords.longitude.toFixed(6));

      try {
        const rev = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (rev && rev.length > 0) {
          const item = rev[0];
          const parts = [item.name, item.street, item.city, item.region].filter(Boolean);
          if (parts.length > 0) setAddress(parts.join(', '));
        }
      } catch {}

      Alert.alert('GPS Location Locked', 'Your current physical coordinates have been captured successfully.');
    } catch (e: any) {
      Alert.alert('Location Error', e?.message || 'Failed to detect current GPS location.');
    } finally {
      setLocDetecting(false);
    }
  }

  async function handleSaveGeofence() {
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum) || latNum === 0 || lngNum === 0) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude and longitude coordinates, or use GPS detection.');
      return;
    }

    setLoading(true);
    try {
      const zoneId = `geo-hte-${profile?.id || profile?.employeeId || 'office'}`;
      const zonePayload = {
        id: zoneId,
        name: `${companyName} Office`,
        address: address || `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`,
        lat: latNum,
        lng: lngNum,
        radius: radius,
        active: true,
      };

      // 1. Save into geofence_zones table
      await supabase.from('geofence_zones').upsert(zonePayload);

      // 2. Update supervisor profile registration_location in employees table
      const empId = profile?.id || profile?.employeeId;
      if (empId) {
        await supabase
          .from('employees')
          .update({
            registration_lat: latNum,
            registration_lng: lngNum,
            registration_address: address || `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`,
            registration_location: {
              lat: latNum,
              lng: lngNum,
              address: address,
              radius: radius,
            },
          })
          .eq('id', empId);
      }

      // 3. Update host_supervisors if present
      try {
        await supabase
          .from('host_supervisors')
          .update({
            company_address: address,
          })
          .eq('id', empId);
      } catch {}

      Alert.alert(
        'Geofence Boundary Saved!',
        `Your company workplace coordinates (${latNum.toFixed(4)}, ${lngNum.toFixed(4)}) with ${radius}m radius have been set.\n\nAll trainees assigned to ${companyName} will now be verified against this perimeter during Clock In and Clock Out.`,
        [{ text: 'OK', onPress: onBack }]
      );
    } catch (e: any) {
      Alert.alert('Save Error', e?.message || 'Failed to save geofence settings.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft size={20} color="#64748b" />
        <Text style={styles.backBtnText}>HTE Dashboard</Text>
      </TouchableOpacity>

      {/* Header Banner */}
      <View style={styles.headerCard}>
        <View style={styles.iconCircle}>
          <Building size={26} color="#059669" />
        </View>
        <Text style={styles.headerTitle}>Workplace Geofence Setup</Text>
        <Text style={styles.headerSub}>
          Configure your company physical perimeter so trainees can accurately clock in on-site.
        </Text>
      </View>

      {/* Quick GPS Lock Button */}
      <TouchableOpacity
        style={styles.detectGpsBtn}
        onPress={handleDetectLocation}
        disabled={locDetecting}
      >
        {locDetecting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Navigation size={20} color="#ffffff" />
            <Text style={styles.detectGpsBtnText}>Lock Current GPS as Office Location</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Form Card */}
      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Company / Office Name</Text>
        <TextInput
          style={styles.input}
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Company Name"
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={latitude}
              onChangeText={setLatitude}
              placeholder="e.g. 10.7412"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.fieldLabel}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={longitude}
              onChangeText={setLongitude}
              placeholder="e.g. 122.9691"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Physical Street Address / Description</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. Lacson Street, Bacolod City"
          placeholderTextColor="#94a3b8"
        />

        {/* Radius Selector */}
        <Text style={styles.fieldLabel}>Allowed Geofence Radius (Meters)</Text>
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusChip, radius === r && styles.radiusChipActive]}
              onPress={() => setRadius(r)}
            >
              <Text style={[styles.radiusChipText, radius === r && styles.radiusChipTextActive]}>
                {r}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Live Status Preview */}
        {latitude && longitude ? (
          <View style={styles.previewBox}>
            <View style={styles.previewHeader}>
              <MapPin size={16} color="#059669" />
              <Text style={styles.previewTitle}>Boundary Summary</Text>
            </View>
            <Text style={styles.previewCoords}>
              Coordinates: {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
            </Text>
            <Text style={styles.previewRadius}>Perimeter: Within {radius} meters</Text>
            <View style={styles.compliancePill}>
              <ShieldCheck size={14} color="#16a34a" />
              <Text style={styles.compliancePillText}>Trainees must be within this circle to clock in</Text>
            </View>
          </View>
        ) : null}

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSaveGeofence}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Save size={18} color="#ffffff" />
              <Text style={styles.saveBtnText}>Save Workplace Geofence</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, paddingTop: 50 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18 },
  detectGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  detectGpsBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  row: { flexDirection: 'row' },
  radiusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radiusChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  radiusChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  radiusChipTextActive: { color: '#059669' },
  previewBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  previewTitle: { fontSize: 13, fontWeight: '800', color: '#166534' },
  previewCoords: { fontSize: 12, color: '#15803d', fontWeight: '600' },
  previewRadius: { fontSize: 12, color: '#15803d', marginTop: 2 },
  compliancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
  },
  compliancePillText: { fontSize: 11, color: '#166534', fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
  },
  saveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
