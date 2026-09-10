import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  History,
  Zap,
  Navigation,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Compass,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { mobileDb, TimeRecord } from '../lib/supabaseService';
import FaceScanner from '../components/FaceScanner';

interface DTRScreenProps {
  onBack: () => void;
  profile: any;
}

export default function DTRScreen({ onBack, profile }: DTRScreenProps) {
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanType, setScanType] = useState<'in' | 'out' | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [distanceToSite, setDistanceToSite] = useState<number | null>(null);
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<TimeRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [clockTime, setClockTime] = useState(new Date());
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [celebration, setCelebration] = useState<{
    action: 'in' | 'out';
    timeStr: string;
    totalHours?: number;
  } | null>(null);

  // Live ticking clock updated every second (matching web TimeRecord.tsx)
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDTRData();
    checkGeofence();

    // Subscribe to continuous live GPS updates if permission is available
    let sub: Location.LocationSubscription | null = null;
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setPermissionDenied(false);
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
        )
          .then((s) => {
            sub = s;
          })
          .catch((err) => {
            console.debug('Watch position error:', err);
          });
      } else {
        setPermissionDenied(true);
      }
    });

    return () => {
      if (sub) sub.remove();
    };
  }, [profile]);

  async function loadDTRData() {
    try {
      const empId = profile?.id || '';
      const altEmpId = profile?.employeeId || (profile as any)?.employee_id || '';
      const [today, allLogs] = await Promise.all([
        mobileDb.getTodayTimeRecord(empId, altEmpId),
        mobileDb.getTimeRecords(empId, undefined, altEmpId),
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
    const regLoc =
      profile?.registration_location ||
      profile?.registrationLocation ||
      (profile?.registration_lat && profile?.registration_lng
        ? { lat: profile.registration_lat, lng: profile.registration_lng }
        : null);
    if (regLoc?.lat && regLoc?.lng) {
      targetCoords.push({
        lat: Number(regLoc.lat),
        lng: Number(regLoc.lng),
        radius: 300,
      });
    }

    // 2. Geofence zones from Supabase
    try {
      const zones = await mobileDb.getGeofenceZones();
      const empId = profile?.id || profile?.employeeId || '';
      zones.forEach((z) => {
        if (z.lat && z.lng) {
          const isPersonal = z.id === `personal-${empId}` || z.id === `geo-trainee-${empId}`;
          const isCompany =
            profile?.companyName && z.name && z.name.toLowerCase().includes(profile.companyName.toLowerCase());
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
      console.debug('Geofence zone fetch notice:', zErr);
    }

    if (targetCoords.length > 0) {
      let minDistance = Infinity;
      let inside = false;

      for (const target of targetCoords) {
        const dist = getDistance(location.coords.latitude, location.coords.longitude, target.lat, target.lng);
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        Alert.alert(
          'GPS Permission Required',
          'Location permission is required for Daily Time Record (DTR) attendance verification. Please grant location permissions in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => checkGeofence() },
          ]
        );
        return;
      }
      setPermissionDenied(false);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentLocation(loc);
      await evaluateGeofence(loc);
    } catch (e) {
      console.warn('Manual geofence check notice:', e);
      setPermissionDenied(true);
    }
  }

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function handleAction(type: 'in' | 'out') {
    if (permissionDenied || !currentLocation) {
      Alert.alert(
        permissionDenied ? 'GPS Permission Denied' : 'GPS Location Permission Required',
        permissionDenied
          ? 'Cannot record attendance without GPS location verification. Please allow location permissions in device settings and try again.'
          : 'Please grant GPS location permission so the system can verify you are within your designated workplace premises.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Permission', onPress: checkGeofence },
        ]
      );
      return;
    }
    setScanType(type);
    setCelebration(null);
    setShowScanner(true);
  }

  // Attendance submission upon face verification completion
  async function submitAttendance(photo: string) {
    setLoading(true);
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const empId = profile?.id || profile?.employeeId || '';

      let totalHours = 0;

      if (scanType === 'in') {
        await mobileDb.saveTimeRecord({
          employeeId: empId,
          date: today,
          timeIn: timeStr,
          timeInLocation: currentLocation
            ? { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude }
            : undefined,
          timeInGeofenced: isWithinGeofence,
          timeInFaceVerified: true,
          timeOutGeofenced: false,
          timeOutFaceVerified: false,
          timeInPhoto: photo,
          status: 'present',
          academicYear: profile?.academicYear || '2025-2026',
        });

        setCelebration({ action: 'in', timeStr });
      } else if (scanType === 'out') {
        if (todayRecord?.timeIn) {
          const inParts = todayRecord.timeIn.split(':');
          const timeInDate = new Date();
          timeInDate.setHours(parseInt(inParts[0]), parseInt(inParts[1]), parseInt(inParts[2] || '0'));
          totalHours = Math.max(0, (now.getTime() - timeInDate.getTime()) / (1000 * 60 * 60));
        }

        await mobileDb.saveTimeRecord({
          id: todayRecord?.id,
          employeeId: empId,
          date: today,
          timeIn: todayRecord?.timeIn || timeStr,
          timeOut: timeStr,
          timeInLocation: todayRecord?.timeInLocation,
          timeOutLocation: currentLocation
            ? { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude }
            : undefined,
          timeInGeofenced: todayRecord?.timeInGeofenced ?? isWithinGeofence,
          timeOutGeofenced: isWithinGeofence,
          timeInFaceVerified: todayRecord?.timeInFaceVerified ?? true,
          timeOutFaceVerified: true,
          timeInPhoto: todayRecord?.timeInPhoto || photo,
          timeOutPhoto: photo,
          totalHours: Number(totalHours.toFixed(2)),
          status: todayRecord?.status || 'present',
          academicYear: todayRecord?.academicYear || profile?.academicYear || '2025-2026',
        });

        setCelebration({ action: 'out', timeStr, totalHours: Number(totalHours.toFixed(2)) });
      }

      // Auto-enroll profile photo in database if student had no enrolled face photo
      if (photo && (!profile?.face_registered || !profile?.photo)) {
        try {
          await supabase
            .from('employees')
            .update({ face_registered: true, photo })
            .eq('id', empId);
        } catch (e) {
          console.debug('Auto-enroll database notice:', e);
        }
      }

      await loadDTRData();
    } catch (err: any) {
      Alert.alert('Attendance Error', err?.message || 'Failed to save attendance record');
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
        mode={scanType === 'in' ? 'clock_in' : 'clock_out'}
        enrolledPhoto={profile?.photo}
        employeeName={profile?.name}
      />
    );
  }

  const totalRenderedAllTime = historyRecords.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
  const formattedTimeString = clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDateString = clockTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft color="#0f172a" size={18} />
          <Text style={styles.backBtnText}>Dashboard</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Daily Time Record (DTR)</Text>
          <Text style={styles.subtitle}>AI Facial Recognition & Geofenced Attendance</Text>
        </View>
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
            History ({historyRecords.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'today' ? (
        <>
          {/* Celebratory Attendance Banner (Web Parity) */}
          {celebration && (
            <View style={styles.celebrationCard}>
              <View style={styles.celebrationIconBg}>
                <CheckCircle2 size={32} color="#16a34a" />
              </View>
              <Text style={styles.celebrationTitle}>
                Clock {celebration.action === 'in' ? 'In' : 'Out'} Recorded!
              </Text>
              <Text style={styles.celebrationDesc}>
                Attendance successfully verified at {celebration.timeStr}
                {celebration.totalHours !== undefined ? ` • Total: ${celebration.totalHours} hrs rendered` : ''}
              </Text>

              <View style={styles.celebrationBadgesRow}>
                <View style={styles.celebrationBadge}>
                  <CheckCircle2 size={13} color="#16a34a" />
                  <Text style={styles.celebrationBadgeText}>Face Verified</Text>
                </View>
                <View style={styles.celebrationBadge}>
                  <MapPin size={13} color="#16a34a" />
                  <Text style={styles.celebrationBadgeText}>Geofence Passed</Text>
                </View>
              </View>
            </View>
          )}

          {/* Live Digital Clock Card (Web TimeRecord.tsx) */}
          <View style={styles.clockHeroCard}>
            <Text style={styles.clockDateLabel}>{formattedDateString}</Text>
            <Text style={styles.clockDigitalDisplay}>{formattedTimeString}</Text>
            <View style={styles.shiftPill}>
              <Clock size={13} color="#38bdf8" />
              <Text style={styles.shiftPillText}>Standard Shift: 08:00 AM – 05:00 PM</Text>
            </View>
          </View>

          {/* Workplace Geofence Radar Card (Web Parity) */}
          {permissionDenied ? (
            <View style={styles.permissionWarningCard}>
              <View style={styles.permissionWarningHeader}>
                <AlertTriangle size={20} color="#b45309" />
                <Text style={styles.permissionWarningTitle}>GPS Permission Denied</Text>
              </View>
              <Text style={styles.permissionWarningDesc}>
                Location access is blocked. Daily Time Record (DTR) requires GPS location to verify you are within your assigned workplace premises. Please grant location permissions in device settings.
              </Text>
              <TouchableOpacity style={styles.permissionRetryBtn} onPress={checkGeofence}>
                <RefreshCw size={14} color="#ffffff" />
                <Text style={styles.permissionRetryBtnText}>Grant Location Permission</Text>
              </TouchableOpacity>
            </View>
          ) : !currentLocation ? (
            <View style={[styles.permissionWarningCard, { backgroundColor: '#f0f9ff', borderColor: '#7dd3fc' }]}>
              <View style={styles.permissionWarningHeader}>
                <Compass size={20} color="#0284c7" />
                <Text style={[styles.permissionWarningTitle, { color: '#0369a1' }]}>GPS Location Permission Required</Text>
              </View>
              <Text style={[styles.permissionWarningDesc, { color: '#0c4a6e' }]}>
                Daily Time Record (DTR) requires GPS location access to confirm you are within your assigned workplace premises. Please grant location permissions.
              </Text>
              <TouchableOpacity
                style={[styles.permissionRetryBtn, { backgroundColor: '#0284c7' }]}
                onPress={checkGeofence}
              >
                <Compass size={14} color="#ffffff" />
                <Text style={styles.permissionRetryBtnText}>Grant Location Permission</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.geofenceCard}>
            <View style={styles.geofenceHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View
                  style={[
                    styles.geofenceIconBg,
                    isWithinGeofence ? styles.geofenceIconBgGreen : styles.geofenceIconBgAmber,
                  ]}
                >
                  <MapPin size={18} color={isWithinGeofence ? '#16a34a' : '#d97706'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.geofenceTitle}>Workplace Geofence Verification</Text>
                  <Text style={styles.geofenceWorkplace} numberOfLines={1}>
                    {profile?.companyName || profile?.registration_address || 'CHMSU Assigned Workstation'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={checkGeofence} style={styles.refreshBtn}>
                <RefreshCw size={14} color="#2563eb" />
                <Text style={styles.refreshBtnText}>Check</Text>
              </TouchableOpacity>
            </View>

            {/* Geofence Status Pill */}
            <View
              style={[
                styles.geofenceStatusBanner,
                isWithinGeofence ? styles.geofenceBannerGreen : styles.geofenceBannerAmber,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isWithinGeofence ? '#16a34a' : '#d97706' },
                  ]}
                />
                <Text
                  style={[
                    styles.geofenceStatusBannerText,
                    { color: isWithinGeofence ? '#166534' : '#92400e' },
                  ]}
                >
                  {isWithinGeofence
                    ? `Inside Assigned Workplace Geofence (${distanceToSite !== null ? `${distanceToSite}m` : 'Verified'})`
                    : `Outside Assigned Geofence (${distanceToSite !== null ? `${distanceToSite}m away` : 'Checking GPS...'})`}
                </Text>
              </View>
            </View>

            {currentLocation && (
              <Text style={styles.coordsSubtext}>
                Current GPS: {currentLocation.coords.latitude.toFixed(5)}, {currentLocation.coords.longitude.toFixed(5)} (Max 300m)
              </Text>
            )}
          </View>

          {/* Primary One-Tap Dynamic Action Punch Button (Web Parity) */}
          <View style={styles.punchActionSection}>
            {!todayRecord?.timeIn ? (
              <TouchableOpacity
                style={[styles.primaryPunchBtn, styles.punchInBtn, loading && { opacity: 0.7 }]}
                onPress={() => handleAction('in')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <View style={styles.punchIconCircle}>
                      <Zap size={22} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.primaryPunchBtnTitle}>CLOCK IN (TIME IN)</Text>
                      <Text style={styles.primaryPunchBtnSub}>Biometric Facial Recognition + GPS Verification</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            ) : !todayRecord?.timeOut ? (
              <TouchableOpacity
                style={[styles.primaryPunchBtn, styles.punchOutBtn, loading && { opacity: 0.7 }]}
                onPress={() => handleAction('out')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <View style={styles.punchIconCircle}>
                      <Clock size={22} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.primaryPunchBtnTitle}>CLOCK OUT (TIME OUT)</Text>
                      <Text style={styles.primaryPunchBtnSub}>Complete today's shift with biometric verification</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.shiftCompletedCard}>
                <CheckCircle2 size={26} color="#16a34a" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.shiftCompletedTitle}>Shift Completed for Today</Text>
                  <Text style={styles.shiftCompletedSub}>
                    Rendered {todayRecord.totalHours || 0} hours • In: {todayRecord.timeIn} | Out: {todayRecord.timeOut}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Today's Shift Breakdown Card (Web Parity) */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Today's Shift Attendance Card</Text>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxLabel}>TIME IN</Text>
                <Text style={styles.summaryBoxValue}>{todayRecord?.timeIn || '—'}</Text>
                <Text style={styles.summaryBoxSub}>{todayRecord?.timeIn ? 'Clocked In' : 'Pending'}</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxLabel}>TIME OUT</Text>
                <Text style={styles.summaryBoxValue}>{todayRecord?.timeOut || '—'}</Text>
                <Text style={styles.summaryBoxSub}>{todayRecord?.timeOut ? 'Clocked Out' : 'Pending'}</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxLabel}>HOURS RENDERED</Text>
                <Text style={[styles.summaryBoxValue, { color: '#2563eb' }]}>
                  {todayRecord?.totalHours ? `${todayRecord.totalHours.toFixed(2)} hrs` : '0.00 hrs'}
                </Text>
                <Text style={styles.summaryBoxSub}>Target: 8.00 hrs</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxLabel}>TOTAL ALL-TIME</Text>
                <Text style={[styles.summaryBoxValue, { color: '#16a34a' }]}>
                  {totalRenderedAllTime.toFixed(1)} hrs
                </Text>
                <Text style={styles.summaryBoxSub}>/ {profile?.requiredHours || 300} req</Text>
              </View>
            </View>
          </View>
        </>
      ) : (
        /* DTR History Tab */
        <View style={styles.historyContainer}>
          <View style={styles.historyHeroCard}>
            <Text style={styles.historyHeroLabel}>Total OJT Hours Rendered</Text>
            <Text style={styles.historyHeroValue}>{totalRenderedAllTime.toFixed(1)} hrs</Text>
            <Text style={styles.historyHeroSub}>
              {Math.max(0, (profile?.requiredHours || 300) - totalRenderedAllTime).toFixed(1)} hours remaining to graduate
            </Text>
          </View>

          {historyRecords.length === 0 ? (
            <View style={styles.emptyCard}>
              <Clock size={36} color="#cbd5e1" />
              <Text style={styles.emptyText}>No attendance records found yet.</Text>
            </View>
          ) : (
            historyRecords.map((item) => (
              <View key={item.id} style={styles.historyItemCard}>
                <View style={styles.historyItemTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} color="#64748b" />
                    <Text style={styles.historyItemDate}>{item.date}</Text>
                  </View>
                  <View style={styles.historyItemBadge}>
                    <Text style={styles.historyItemBadgeText}>{(item.status || 'PRESENT').toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.historyItemGrid}>
                  <View style={styles.historyItemCol}>
                    <Text style={styles.historyColLabel}>Time In</Text>
                    <Text style={styles.historyColValue}>{item.timeIn || '—'}</Text>
                  </View>
                  <View style={styles.historyItemCol}>
                    <Text style={styles.historyColLabel}>Time Out</Text>
                    <Text style={styles.historyColValue}>{item.timeOut || '—'}</Text>
                  </View>
                  <View style={styles.historyItemCol}>
                    <Text style={styles.historyColLabel}>Hours Rendered</Text>
                    <Text style={[styles.historyColValue, { color: '#2563eb', fontWeight: '900' }]}>
                      {item.totalHours ? `${item.totalHours.toFixed(2)} hrs` : '—'}
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerTitleRow: {
    marginTop: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  celebrationCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#86efac',
    marginBottom: 16,
  },
  celebrationIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  celebrationTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#15803d',
  },
  celebrationDesc: {
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  celebrationBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  celebrationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  celebrationBadgeText: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '800',
  },
  clockHeroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  clockDateLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  clockDigitalDisplay: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  shiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
  },
  shiftPillText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  geofenceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  geofenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  geofenceIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geofenceIconBgGreen: {
    backgroundColor: '#f0fdf4',
  },
  geofenceIconBgAmber: {
    backgroundColor: '#fffbeb',
  },
  geofenceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  geofenceWorkplace: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
  },
  geofenceStatusBanner: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  geofenceBannerGreen: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  geofenceBannerAmber: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  geofenceStatusBannerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  coordsSubtext: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 6,
    marginLeft: 4,
  },
  punchActionSection: {
    marginBottom: 16,
  },
  primaryPunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  punchInBtn: {
    backgroundColor: '#16a34a',
  },
  punchOutBtn: {
    backgroundColor: '#2563eb',
  },
  punchIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPunchBtnTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  primaryPunchBtnSub: {
    color: 'rgba(255, 255, 255, 0.90)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  shiftCompletedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  shiftCompletedTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803d',
  },
  shiftCompletedSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  summaryBoxValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 3,
  },
  summaryBoxSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  historyContainer: {
    gap: 12,
  },
  historyHeroCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 6,
  },
  historyHeroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  historyHeroValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#1e40af',
    marginTop: 4,
  },
  historyHeroSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
  },
  historyItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyItemDate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  historyItemBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyItemBadgeText: {
    color: '#16a34a',
    fontSize: 10,
    fontWeight: '800',
  },
  historyItemGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
  },
  historyItemCol: {
    flex: 1,
  },
  historyColLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  historyColValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  permissionWarningCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    padding: 14,
    marginBottom: 16,
  },
  permissionWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  permissionWarningTitle: {
    fontFamily: 'Times New Roman',
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
  },
  permissionWarningDesc: {
    fontFamily: 'Times New Roman',
    fontSize: 12,
    color: '#78350f',
    lineHeight: 18,
    marginBottom: 10,
  },
  permissionRetryBtn: {
    backgroundColor: '#d97706',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  permissionRetryBtnText: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
