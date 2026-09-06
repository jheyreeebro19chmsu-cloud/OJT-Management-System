import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { Building2, Users, Clock, Star, ArrowRight, ShieldCheck, CheckCircle2, User } from 'lucide-react-native';
import { mobileDb, Employee, TimeRecord } from '../lib/supabaseService';

export default function HTEDashboardScreen({
  profile,
  activeAcademicYear,
  onNavigate,
}: {
  profile: any;
  activeAcademicYear?: string;
  onNavigate: (screen: string, params?: any) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [trainees, setTrainees] = useState<Employee[]>([]);
  const [todayRecords, setTodayRecords] = useState<TimeRecord[]>([]);

  useEffect(() => {
    loadHTEData();
  }, [profile, activeAcademicYear]);

  async function loadHTEData() {
    setLoading(true);
    try {
      const hteId = profile?.id || profile?.employeeId || '';
      const [allTrainees, allRecords] = await Promise.all([
        mobileDb.getTraineesByHte(hteId, activeAcademicYear),
        mobileDb.getTimeRecords(undefined, activeAcademicYear),
      ]);

      setTrainees(allTrainees);

      const today = new Date().toISOString().split('T')[0];
      const traineeIds = new Set(allTrainees.map((t) => t.id));
      const filteredToday = allRecords.filter((r) => r.date === today && (traineeIds.has(r.employeeId) || allTrainees.length === 0));
      setTodayRecords(filteredToday);
    } catch (e) {
      console.warn('Error loading HTE data:', e);
    } finally {
      setLoading(false);
    }
  }

  const clockedInCount = todayRecords.filter((r) => r.timeIn).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.companyIcon}>
            <Building2 size={24} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>{profile?.companyName || 'Host Training Establishment'}</Text>
            <Text style={styles.supervisorName}>Supervisor: {profile?.name || 'Supervisor'}</Text>
          </View>
        </View>
      </View>

      {/* KPI Stats Grid */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { backgroundColor: '#eff6ff' }]}>
          <Users size={20} color="#2563eb" />
          <Text style={styles.kpiValue}>{loading ? '—' : trainees.length}</Text>
          <Text style={styles.kpiLabel}>Assigned Trainees</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4' }]}>
          <Clock size={20} color="#16a34a" />
          <Text style={styles.kpiValue}>{loading ? '—' : clockedInCount}</Text>
          <Text style={styles.kpiLabel}>Clocked-In Today</Text>
        </View>
      </View>

      {/* Quick Action Navigation Buttons */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Supervisor Actions</Text>
      </View>
      <View style={styles.actionList}>
        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('hte_trainees')}>
          <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
            <Users size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Manage Trainees</Text>
            <Text style={styles.actionDesc}>View assigned students & contact info</Text>
          </View>
          <ArrowRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('hte_dtr')}>
          <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
            <Clock size={20} color="#16a34a" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Review Daily Attendance (DTR)</Text>
            <Text style={styles.actionDesc}>Verify time logs & geofence compliance</Text>
          </View>
          <ArrowRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('hte_evaluation')}>
          <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
            <Star size={20} color="#d97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Evaluate Trainees</Text>
            <Text style={styles.actionDesc}>Submit performance grades & feedback rubric</Text>
          </View>
          <ArrowRight size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Today's Active Trainees Preview */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trainee Attendance Today</Text>
        <TouchableOpacity onPress={() => onNavigate('hte_dtr')}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 20 }} />
      ) : todayRecords.length === 0 ? (
        <View style={styles.emptyCard}>
          <Clock size={32} color="#cbd5e1" />
          <Text style={styles.emptyText}>No trainees clocked in yet today.</Text>
        </View>
      ) : (
        todayRecords.map((rec) => {
          const trainee = trainees.find((t) => t.id === rec.employeeId);
          return (
            <View key={rec.id} style={styles.traineeRowCard}>
              <View style={styles.traineeAvatar}>
                {trainee?.photo ? (
                  <Image source={{ uri: trainee.photo }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <User size={18} color="#2563eb" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.traineeNameText}>{trainee?.name || 'Trainee'}</Text>
                <Text style={styles.traineeTimeText}>
                  In: {rec.timeIn || '—'} {rec.timeOut ? `| Out: ${rec.timeOut}` : ''}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{rec.status.toUpperCase()}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, paddingTop: 50 },
  header: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  companyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  supervisorName: { fontSize: 13, color: '#64748b', marginTop: 2 },
  kpiGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  kpiCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  kpiValue: { fontSize: 24, fontWeight: '900', color: '#0f172a', marginTop: 6 },
  kpiLabel: { fontSize: 12, color: '#64748b', fontWeight: '700', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  seeAll: { fontSize: 13, color: '#2563eb', fontWeight: '800' },
  actionList: { gap: 10, marginBottom: 20 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  actionDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  emptyCard: { backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyText: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
  traineeRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    gap: 10,
  },
  traineeAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  traineeNameText: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  traineeTimeText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { color: '#16a34a', fontSize: 11, fontWeight: '800' },
});
