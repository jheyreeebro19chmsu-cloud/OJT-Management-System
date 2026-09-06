import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import { Clock, MapPin, Camera, CheckCircle, ArrowLeft, Calendar, ShieldCheck, History } from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { mobileDb, TimeRecord } from '../lib/supabaseService';
import FaceScanner from '../components/FaceScanner';

interface DTRScreenProps {
  onBack: () => void;
  profile: any;
}

function isPrivilegedRole(role?: string) {
  return role === 'admin' || role === 'instructor' || role === 'hte';
}

export default function DTRScreen({ onBack, profile }: DTRScreenProps) {
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanType, setScanType] = useState<'in' | 'out' | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [distanceToSite, setDistanceToSite] = useState<number | null>(null);
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<TimeRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');

  useEffect(() => {
    loadDTRData();
    checkGeofence();

    // Subscribe to live continuous GPS updates
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 3000,
      },
      (loc) => {
        setCurrentLocation(loc);
        evaluateGeofence(loc);
      }
    ).then((s) => {
      sub = s;
    }).catch((err) => {
      console.debug('Watch position error:', err);
    });

    return () => {
      if (sub) sub.remove();
    };
  }, [profile]);

  async function loadDTRData() {
    try {
      const empId = profile?.id || profile?.employeeId || '';
      const [today, allLogs] = await Promise.all([
        mobileDb.getTodayTimeRecord(empId),
        mobileDb.getTimeRecords(empId),
      ]);
      setTodayRecord(today);
      setHistoryRecords(allLogs);
    } catch (e) {
      console.warn('Error fetching DTR records:', e);
    }
  }

  async function evaluateGeofence(location: Location.LocationObject) {
    const targetCoords: { lat: number; lng: number; radius: number }[] = [];

    // 1. Profile registration location
    const regLoc = profile?.registration_location || profile?.registrationLocation || (profile?.registration_lat && profile?.registration_lng ? { lat: profile.registration_lat, lng: profile.registration_lng } : null);
    if (regLoc?.lat && regLoc?.lng) {
      targetCoords.push({
        lat: Number(regLoc.lat),
        lng: Number(regLoc.lng),
        radius: 300,
      });
    }

    // 2. Query geofence zones from Supabase
    try {
      const zones = await mobileDb.getGeofenceZones();
      const empId = profile?.id || profile?.employeeId || '';
      zones.forEach((z) => {
        if (z.lat && z.lng) {
          const isPersonal = z.id === `personal-${empId}` || z.id === `geo-trainee-${empId}`;
          const isCompany = profile?.companyName && z.name && z.name.toLowerCase().includes(profile.companyName.toLowerCase());
          if (isPersonal || isCompany || !profile?.companyName) {
            targetCoords.push({
              lat: z.lat,
              lng: z.lng,
              radius: z.radius || 300,
            });
          }
        }
      });
    } catch (zErr) {
      console.debug('Geofence zone fetch warning:', zErr);
    }

    if (targetCoords.length > 0) {
      let minDistance = Infinity;
      let inside = false;

      for (const target of targetCoords) {
        const dist = getDistance(
          location.coords.latitude,
          location.coords.longitude,
          target.lat,
          target.lng
        );
        if (dist < minDistance) {
          minDistance = Math.round(dist);
        }
        if (dist <= target.radius) {
          inside = true;
          break;
        }
      }

      setDistanceToSite(minDistance !== Infinity ? minDistance : null);
      setIsWithinGeofence(inside);
    } else {
      setIsWithinGeofence(true);
      setDistanceToSite(0);
    }
  }

  async function checkGeofence() {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to verify your OJT workplace geofence.');
        return;
      }

      let location: Location.LocationObject | null = null;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch {
        try {
          location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {
          location = await Location.getLastKnownPositionAsync();
        }
      }

      if (location) {
        setCurrentLocation(location);
        await evaluateGeofence(location);
      }
    } catch (e) {
      console.warn('Geofence check warning:', e);
      setIsWithinGeofence(true);
    }
  }

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function handleAction(type: 'in' | 'out') {
    if (!isWithinGeofence) {
      Alert.alert('Out of Range', 'You must be within your assigned OJT location to clock in or out.');
      return;
    }
    setScanType(type);

    if (isPrivilegedRole(profile?.role)) {
      await submitAttendance('');
      return;
    }

    setShowScanner(true);
  }

  async function submitAttendance(photo: string) {
    setLoading(true);
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

      const empId = profile?.id || profile?.employeeId || '';

      if (scanType === 'in') {
        await mobileDb.saveTimeRecord({
          employeeId: empId,
          date: today,
          timeIn: timeStr,
          timeInLocation: currentLocation
            ? { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude }
            : undefined,
          timeInGeofenced: isWithinGeofence,
          timeInFaceVerified: Boolean(photo),
          timeOutGeofenced: false,
          timeOutFaceVerified: false,
          timeInPhoto: photo,
          status: 'present',
          academicYear: profile?.academicYear || '2025-2026',
        });
      } else if (scanType === 'out' && todayRecord) {
        // Calculate total hours rendered
        let totalHours = 0;
        if (todayRecord.timeIn) {
          const inParts = todayRecord.timeIn.split(':');
          const timeInDate = new Date();
          timeInDate.setHours(parseInt(inParts[0]), parseInt(inParts[1]), parseInt(inParts[2] || '0'));
          totalHours = Math.max(0, (now.getTime() - timeInDate.getTime()) / (1000 * 60 * 60));
        }

        await mobileDb.saveTimeRecord({
          id: todayRecord.id,
          employeeId: empId,
          date: today,
          timeIn: todayRecord.timeIn,
          timeOut: timeStr,
          timeInLocation: todayRecord.timeInLocation,
          timeOutLocation: currentLocation
            ? { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude }
            : undefined,
          timeInGeofenced: todayRecord.timeInGeofenced,
          timeOutGeofenced: isWithinGeofence,
          timeInFaceVerified: todayRecord.timeInFaceVerified,
          timeOutFaceVerified: Boolean(photo),
          timeInPhoto: todayRecord.timeInPhoto,
          timeOutPhoto: photo,
          totalHours: Number(totalHours.toFixed(2)),
          status: todayRecord.status,
          academicYear: todayRecord.academicYear || profile?.academicYear || '2025-2026',
        });
      }

      // If photo was captured and trainee has no enrolled face yet, auto-enroll them
      if (photo && (!profile?.face_registered || !profile?.photo)) {
        try {
          await supabase
            .from('employees')
            .update({ face_registered: true, photo: photo })
            .eq('id', empId);
        } catch (e) {
          console.warn('Auto-enroll on mobile DTR warning:', e);
        }
      }

      Alert.alert('Attendance Recorded', `Successfully clocked ${scanType?.toUpperCase()}! Data saved to Supabase.`);
      await loadDTRData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save attendance record');
    } finally {
      setLoading(false);
      setShowScanner(false);
    }
  }

  if (showScanner) {
    return (
      <FaceScanner
        onCapture={submitAttendance}
        onCancel={() => setShowScanner(false)}
      />
    );
  }

  const totalRenderedAllTime = historyRecords.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft color="#64748b" size={20} />
        <Text style={styles.backBtnText}>Dashboard</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Daily Time Record</Text>
        <Text style={styles.subtitle}>Geofenced & Biometric Attendance Tracker</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'today' && styles.tabBtnActive]}
          onPress={() => setActiveTab('today')}
        >
          <Clock size={16} color={activeTab === 'today' ? '#2563eb' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'today' && styles.tabBtnTextActive]}>Today's Punch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
        >
          <History size={16} color={activeTab === 'history' ? '#2563eb' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
            DTR History ({historyRecords.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'today' ? (
        <>
          {/* Main Punch Clock Card */}
          <View style={styles.statusCard}>
            {/* Real-time GPS & Geofence Banner */}
            <View style={[styles.locationStatus, !isWithinGeofence && styles.locationStatusWarning]}>
              <MapPin color={isWithinGeofence ? '#16a34a' : '#dc2626'} size={18} />
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={[styles.locationText, { color: isWithinGeofence ? '#166534' : '#b91c1c' }]}>
                  {isWithinGeofence ? 'Inside OJT Workplace Geofence' : 'Outside OJT Workplace Geofence'}
                  {distanceToSite !== null ? ` (${distanceToSite}m)` : ''}
                </Text>
                <Text style={styles.locationSubText}>
                  {currentLocation
                    ? `GPS: ${currentLocation.coords.latitude.toFixed(5)}, ${currentLocation.coords.longitude.toFixed(5)} (300m limit)`
                    : 'Acquiring high-precision GPS...'}
                </Text>
              </View>
              <TouchableOpacity onPress={checkGeofence} style={styles.refreshLocBtn}>
                <Text style={styles.refreshLocBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.clockContainer}>
              <Clock color="#2563eb" size={36} />
              <Text style={styles.timeText}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>

            <View style={styles.actionRow}>
              {!todayRecord?.timeIn ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.timeInBtn]}
                  onPress={() => handleAction('in')}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnText}>TIME IN (PUNCH CLOCK)</Text>
                  )}
                </TouchableOpacity>
              ) : !todayRecord?.timeOut ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.timeOutBtn]}
                  onPress={() => handleAction('out')}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnText}>TIME OUT</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.completedBadge}>
                  <CheckCircle color="#16a34a" size={22} />
                  <Text style={styles.completedText}>Shift Completed for Today</Text>
                </View>
              )}
            </View>
          </View>

          {/* Today's Shift Breakdown */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Today's Log Summary</Text>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Time In:</Text>
              <Text style={styles.detailValue}>{todayRecord?.timeIn || 'Not Clocked In'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Time Out:</Text>
              <Text style={styles.detailValue}>{todayRecord?.timeOut || 'Not Clocked Out'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Today's Rendered Hours:</Text>
              <Text style={[styles.detailValue, { color: '#2563eb' }]}>
                {todayRecord?.totalHours ? `${todayRecord.totalHours.toFixed(2)} hrs` : '0.00 hrs'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Total All-Time Rendered:</Text>
              <Text style={[styles.detailValue, { color: '#16a34a' }]}>
                {totalRenderedAllTime.toFixed(1)} / {profile?.requiredHours || 300} hrs
              </Text>
            </View>
          </View>
        </>
      ) : (
        /* History Log List */
        <View style={styles.historyContainer}>
          <View style={styles.historySummaryCard}>
            <Text style={styles.historySummaryLabel}>Cumulative Hours Rendered</Text>
            <Text style={styles.historySummaryValue}>{totalRenderedAllTime.toFixed(1)} hrs</Text>
            <Text style={styles.historySummarySub}>Target: {profile?.requiredHours || 300} required hours</Text>
          </View>

          {historyRecords.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Clock size={32} color="#cbd5e1" />
              <Text style={styles.emptyHistoryText}>No past attendance records found.</Text>
            </View>
          ) : (
            historyRecords.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} color="#64748b" />
                    <Text style={styles.historyDate}>{item.date}</Text>
                  </View>
                  <View style={styles.historyBadge}>
                    <Text style={styles.historyBadgeText}>{item.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.historyGrid}>
                  <View style={styles.historyCol}>
                    <Text style={styles.historyColLabel}>In</Text>
                    <Text style={styles.historyColVal}>{item.timeIn || '—'}</Text>
                  </View>
                  <View style={styles.historyCol}>
                    <Text style={styles.historyColLabel}>Out</Text>
                    <Text style={styles.historyColVal}>{item.timeOut || '—'}</Text>
                  </View>
                  <View style={styles.historyCol}>
                    <Text style={styles.historyColLabel}>Hours</Text>
                    <Text style={[styles.historyColVal, { color: '#2563eb', fontWeight: '800' }]}>
                      {item.totalHours ? `${item.totalHours.toFixed(1)} h` : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50, backgroundColor: '#f8fafc', paddingBottom: 60 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtnText: { marginLeft: 8, color: '#64748b', fontWeight: '600' },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', color: '#1e293b' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  tabsRow: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabBtnActive: { backgroundColor: '#ffffff' },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabBtnTextActive: { color: '#2563eb' },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 20,
    width: '100%',
  },
  locationStatusWarning: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  locationText: { fontSize: 13, fontWeight: '800' },
  locationSubText: { fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 2 },
  refreshLocBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  refreshLocBtnText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '800',
  },
  clockContainer: { alignItems: 'center', marginBottom: 24 },
  timeText: { fontSize: 40, fontWeight: '900', color: '#1e293b', marginTop: 4 },
  dateText: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 2 },
  actionRow: { width: '100%' },
  actionBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  timeInBtn: { backgroundColor: '#2563eb' },
  timeOutBtn: { backgroundColor: '#0f172a' },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f0fdf4', padding: 14, borderRadius: 14 },
  completedText: { color: '#166534', fontWeight: '800' },
  detailsCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  detailsTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailLabel: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  detailValue: { color: '#1e293b', fontWeight: '800', fontSize: 13 },
  historyContainer: { gap: 10 },
  historySummaryCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 8 },
  historySummaryLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  historySummaryValue: { color: '#ffffff', fontSize: 32, fontWeight: '900', marginTop: 4 },
  historySummarySub: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  historyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  historyDate: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  historyBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  historyBadgeText: { color: '#2563eb', fontSize: 10, fontWeight: '800' },
  historyGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 10, borderRadius: 10 },
  historyCol: { alignItems: 'center', flex: 1 },
  historyColLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  historyColVal: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  emptyHistory: { backgroundColor: '#fff', padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyHistoryText: { color: '#94a3b8', fontSize: 13, marginTop: 10 },
});
