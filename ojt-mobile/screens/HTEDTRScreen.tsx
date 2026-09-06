import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { ArrowLeft, Clock, Calendar, CheckCircle2, Search, MapPin, User, ShieldCheck } from 'lucide-react-native';
import { mobileDb, TimeRecord, Employee } from '../lib/supabaseService';

export default function HTEDTRScreen({
  profile,
  activeAcademicYear,
  onBack,
}: {
  profile: any;
  activeAcademicYear?: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [trainees, setTrainees] = useState<Record<string, Employee>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadHTEAttendance();
  }, [filterDate, profile, activeAcademicYear]);

  async function loadHTEAttendance() {
    setLoading(true);
    try {
      const hteId = profile?.id || profile?.employeeId || '';
      const [allRecords, hteTrainees] = await Promise.all([
        mobileDb.getTimeRecords(undefined, activeAcademicYear),
        mobileDb.getTraineesByHte(hteId, activeAcademicYear),
      ]);

      const traineeMap: Record<string, Employee> = {};
      const traineeIds = new Set<string>();
      hteTrainees.forEach((t) => {
        traineeMap[t.id] = t;
        traineeIds.add(t.id);
      });
      setTrainees(traineeMap);

      const filtered = allRecords.filter(
        (r) => (!filterDate || r.date === filterDate) && (traineeIds.has(r.employeeId) || hteTrainees.length === 0)
      );
      setRecords(filtered);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }

  const displayedRecords = records.filter((r) => {
    const emp = trainees[r.employeeId];
    const name = emp ? emp.name.toLowerCase() : '';
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft color="#0f172a" size={20} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>HTE Trainee Attendance</Text>
        <Text style={styles.subtitle}>Daily check-in/out verification for {profile?.companyName || 'your company'}</Text>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trainee name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={styles.dateBar}>
          <Calendar size={16} color="#3b82f6" />
          <Text style={styles.dateLabel}>Date: </Text>
          <TextInput
            style={styles.dateInput}
            value={filterDate}
            onChangeText={setFilterDate}
            placeholder="YYYY-MM-DD"
          />
          <TouchableOpacity style={styles.todayBtn} onPress={() => setFilterDate(new Date().toISOString().split('T')[0])}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Records List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Fetching attendance records...</Text>
        </View>
      ) : displayedRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Clock size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No records found</Text>
          <Text style={styles.emptySubtitle}>No attendance logs recorded for {filterDate || 'selected date'}.</Text>
        </View>
      ) : (
        <FlatList
          data={displayedRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const trainee = trainees[item.employeeId];
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.userRow}>
                    <View style={styles.avatar}>
                      {trainee?.photo ? (
                        <Image source={{ uri: trainee.photo }} style={styles.avatarImg} />
                      ) : (
                        <User size={18} color="#2563eb" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.name}>{trainee ? trainee.name : 'Trainee'}</Text>
                      <Text style={styles.meta}>{trainee?.course || 'OJT Student'}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      item.status === 'present' ? styles.badgePresent : styles.badgeLate,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        item.status === 'present' ? styles.badgeTextPresent : styles.badgeTextLate,
                      ]}
                    >
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Time Grid */}
                <View style={styles.timeGrid}>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeLabel}>Time In</Text>
                    <Text style={styles.timeVal}>{item.timeIn || '—'}</Text>
                  </View>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeLabel}>Time Out</Text>
                    <Text style={styles.timeVal}>{item.timeOut || '—'}</Text>
                  </View>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeLabel}>Total Hours</Text>
                    <Text style={[styles.timeVal, { color: '#2563eb', fontWeight: '800' }]}>
                      {item.totalHours ? `${item.totalHours.toFixed(1)} hrs` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Compliance Tags */}
                <View style={styles.complianceRow}>
                  {item.timeInGeofenced && (
                    <View style={styles.tag}>
                      <MapPin size={12} color="#16a34a" />
                      <Text style={styles.tagText}>On-Site (Geofenced)</Text>
                    </View>
                  )}
                  {item.timeInFaceVerified && (
                    <View style={styles.tag}>
                      <ShieldCheck size={12} color="#16a34a" />
                      <Text style={styles.tagText}>Face Verified</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, paddingTop: 50 },
  header: { marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { marginLeft: 6, fontWeight: '700', color: '#0f172a', fontSize: 14 },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  filterSection: { marginBottom: 16, gap: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0f172a' },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  dateLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginLeft: 6 },
  dateInput: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '600' },
  todayBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  todayBtnText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  name: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  meta: { fontSize: 11, color: '#64748b' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgePresent: { backgroundColor: '#dcfce7' },
  badgeTextPresent: { color: '#16a34a', fontWeight: '800', fontSize: 11 },
  badgeLate: { backgroundColor: '#fef3c7' },
  badgeTextLate: { color: '#d97706', fontWeight: '800', fontSize: 11 },
  timeGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12 },
  timeCol: { alignItems: 'center', flex: 1 },
  timeLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  timeVal: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  complianceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  tagText: { fontSize: 11, color: '#16a34a', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  loadingText: { marginTop: 10, color: '#64748b', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
});
