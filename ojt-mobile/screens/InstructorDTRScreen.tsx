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
import { ArrowLeft, Clock, Calendar, CheckCircle, AlertCircle, Search, ShieldCheck, MapPin, User } from 'lucide-react-native';
import { mobileDb, TimeRecord, Employee } from '../lib/supabaseService';

export default function InstructorDTRScreen({
  onBack,
  activeAcademicYear,
}: {
  onBack: () => void;
  activeAcademicYear?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, [filterDate]);

  async function loadData() {
    setLoading(true);
    try {
      const [allRecords, allEmps] = await Promise.all([
        mobileDb.getTimeRecords(),
        mobileDb.getEmployees(),
      ]);

      const empMap: Record<string, Employee> = {};
      allEmps.forEach((e) => {
        empMap[e.id] = e;
      });
      setEmployees(empMap);

      const filtered = allRecords.filter((r) => !filterDate || r.date === filterDate);
      setRecords(filtered);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load DTR records');
    } finally {
      setLoading(false);
    }
  }

  const displayedRecords = records.filter((r) => {
    const emp = employees[r.employeeId];
    const name = emp ? emp.name.toLowerCase() : '';
    const id = emp ? emp.employeeId.toLowerCase() : '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || id.includes(q);
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft color="#0f172a" size={20} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>DTR Monitoring</Text>
        <Text style={styles.subtitle}>Review trainee daily attendance logs & compliance</Text>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trainee name or ID..."
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

      {/* Record List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Fetching attendance records...</Text>
        </View>
      ) : displayedRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Clock size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No records found</Text>
          <Text style={styles.emptySubtitle}>No trainee attendance logs found for {filterDate || 'selected date'}.</Text>
        </View>
      ) : (
        <FlatList
          data={displayedRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const emp = employees[item.employeeId];
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.userRow}>
                    <View style={styles.avatar}>
                      {emp?.photo ? (
                        <Image source={{ uri: emp.photo }} style={styles.avatarImg} />
                      ) : (
                        <User size={20} color="#3b82f6" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.traineeName}>{emp ? emp.name : 'Unknown Trainee'}</Text>
                      <Text style={styles.traineeMeta}>
                        {emp?.course || 'OJT Student'} • ID: {emp?.employeeId || item.employeeId}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'present'
                        ? styles.presentBadge
                        : item.status === 'late'
                        ? styles.lateBadge
                        : styles.defaultBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.status === 'present'
                          ? styles.presentBadgeText
                          : item.status === 'late'
                          ? styles.lateBadgeText
                          : styles.defaultBadgeText,
                      ]}
                    >
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Time Grid */}
                <View style={styles.timeGrid}>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeColLabel}>Time In</Text>
                    <Text style={styles.timeColValue}>{item.timeIn || '—'}</Text>
                    {item.timeInLocation ? (
                      <Text style={styles.gpsCoordsText}>
                        {item.timeInLocation.lat.toFixed(4)}, {item.timeInLocation.lng.toFixed(4)}
                      </Text>
                    ) : null}
                    {item.timeInGeofenced ? (
                      <View style={styles.badgeSmall}>
                        <MapPin size={10} color="#16a34a" />
                        <Text style={styles.badgeSmallText}>Inside 300m</Text>
                      </View>
                    ) : item.timeInLocation ? (
                      <View style={[styles.badgeSmall, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                        <MapPin size={10} color="#dc2626" />
                        <Text style={[styles.badgeSmallText, { color: '#dc2626' }]}>Outside Geofence</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.timeCol}>
                    <Text style={styles.timeColLabel}>Time Out</Text>
                    <Text style={styles.timeColValue}>{item.timeOut || '—'}</Text>
                    {item.timeOutLocation ? (
                      <Text style={styles.gpsCoordsText}>
                        {item.timeOutLocation.lat.toFixed(4)}, {item.timeOutLocation.lng.toFixed(4)}
                      </Text>
                    ) : null}
                    {item.timeOutGeofenced ? (
                      <View style={styles.badgeSmall}>
                        <MapPin size={10} color="#16a34a" />
                        <Text style={styles.badgeSmallText}>Inside 300m</Text>
                      </View>
                    ) : item.timeOutLocation ? (
                      <View style={[styles.badgeSmall, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                        <MapPin size={10} color="#dc2626" />
                        <Text style={[styles.badgeSmallText, { color: '#dc2626' }]}>Outside Geofence</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.timeCol}>
                    <Text style={styles.timeColLabel}>Total Hours</Text>
                    <Text style={[styles.timeColValue, { color: '#2563eb', fontWeight: '800' }]}>
                      {item.totalHours ? `${item.totalHours.toFixed(1)} hrs` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Verification Flags */}
                <View style={styles.verificationRow}>
                  {item.timeInFaceVerified && (
                    <View style={styles.verifiedTag}>
                      <ShieldCheck size={14} color="#16a34a" />
                      <Text style={styles.verifiedTagText}>Face Biometrics Verified</Text>
                    </View>
                  )}
                  {emp?.companyName && (
                    <View style={[styles.verifiedTag, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
                      <MapPin size={13} color="#0284c7" />
                      <Text style={[styles.verifiedTagText, { color: '#0369a1' }]}>{emp.companyName}</Text>
                    </View>
                  )}
                  {item.notes && <Text style={styles.notesText}>Note: {item.notes}</Text>}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  traineeName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  traineeMeta: { fontSize: 12, color: '#64748b', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  presentBadge: { backgroundColor: '#dcfce7' },
  presentBadgeText: { color: '#16a34a', fontWeight: '800', fontSize: 11 },
  lateBadge: { backgroundColor: '#fef3c7' },
  lateBadgeText: { color: '#d97706', fontWeight: '800', fontSize: 11 },
  defaultBadge: { backgroundColor: '#f1f5f9' },
  defaultBadgeText: { color: '#64748b', fontWeight: '800', fontSize: 11 },
  timeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
  },
  timeCol: { alignItems: 'center', flex: 1 },
  timeColLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  timeColValue: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  gpsCoordsText: { fontSize: 9, fontFamily: 'monospace', color: '#64748b', marginTop: 2 },
  badgeSmall: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  badgeSmallText: { fontSize: 9, color: '#16a34a', fontWeight: '700' },
  verificationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  verifiedTagText: { fontSize: 11, color: '#16a34a', fontWeight: '700' },
  notesText: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  loadingText: { marginTop: 10, color: '#64748b', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
});
