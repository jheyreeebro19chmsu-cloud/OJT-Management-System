import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import {
  ArrowLeft,
  Users,
  Clock,
  QrCode,
  Bell,
  Award,
  Calendar,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  MapPin,
} from 'lucide-react-native';
import { mobileDb, Employee, TimeRecord } from '../lib/supabaseService';

export default function InstructorDashboard({
  profile,
  activeAcademicYear,
  onNavigate,
  onBack,
}: {
  profile: any;
  activeAcademicYear?: string;
  onNavigate: (screen: string, params?: any) => void;
  onBack?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [trainees, setTrainees] = useState<Employee[]>([]);
  const [todayRecords, setTodayRecords] = useState<TimeRecord[]>([]);
  const [pendingApplications, setPendingApplications] = useState<Employee[]>([]);

  useEffect(() => {
    loadDashboardMetrics();
  }, [profile, activeAcademicYear]);

  async function loadDashboardMetrics() {
    setLoading(true);
    try {
      const instructorId = profile?.id || profile?.employeeId || '';
      const [allTrainees, allRecords] = await Promise.all([
        mobileDb.getTraineesByInstructor(instructorId, activeAcademicYear),
        mobileDb.getTimeRecords(undefined, activeAcademicYear),
      ]);

      setTrainees(allTrainees);

      const pending = allTrainees.filter((t) => t.applicationStatus === 'pending');
      setPendingApplications(pending);

      const today = new Date().toISOString().split('T')[0];
      const todayLogs = allRecords.filter((r) => r.date === today);
      setTodayRecords(todayLogs);
    } catch (e: any) {
      console.warn('Error loading instructor dashboard:', e);
    } finally {
      setLoading(false);
    }
  }

  const activeTodayCount = todayRecords.filter((r) => r.timeIn).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <ArrowLeft color="#0f172a" size={18} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Instructor Portal</Text>
            <Text style={styles.subtitle}>
              {profile?.name || 'OJT Instructor'} • AY {activeAcademicYear || '2025-2026'}
            </Text>
          </View>
        </View>
      </View>

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { backgroundColor: '#eff6ff' }]}>
          <Users size={22} color="#2563eb" />
          <Text style={styles.kpiValue}>{loading ? '—' : trainees.length}</Text>
          <Text style={styles.kpiLabel}>Total Trainees</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4' }]}>
          <Clock size={22} color="#16a34a" />
          <Text style={styles.kpiValue}>{loading ? '—' : activeTodayCount}</Text>
          <Text style={styles.kpiLabel}>Clocked-In Today</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#fef3c7' }]}>
          <ShieldCheck size={22} color="#d97706" />
          <Text style={styles.kpiValue}>{loading ? '—' : pendingApplications.length}</Text>
          <Text style={styles.kpiLabel}>Pending Approvals</Text>
        </View>
      </View>

      {/* Quick Action Navigation Buttons */}
      <Text style={styles.sectionTitle}>Management Modules</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('instructor_trainees')}>
          <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
            <Users size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Trainees Roster</Text>
            <Text style={styles.actionDesc}>Manage students, enrollments & status</Text>
          </View>
          <ArrowRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('instructor_dtr')}>
          <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
            <Clock size={20} color="#16a34a" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>DTR Live Monitor</Text>
            <Text style={styles.actionDesc}>Real-time attendance & time logs</Text>
          </View>
          <ArrowRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('instructor_trainees')}>
          <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
            <MapPin size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Trainee Geofencing & GPS</Text>
            <Text style={styles.actionDesc}>Monitor workplace coordinates & location radius</Text>
          </View>
          <ArrowRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('instructor_qr')}>
          <View style={[styles.actionIcon, { backgroundColor: '#fdf4ff' }]}>
            <QrCode size={20} color="#c026d3" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Enrollment QR Code</Text>
            <Text style={styles.actionDesc}>Generate link code for new students</Text>
          </View>
          <ArrowRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('announcements')}>
          <View style={[styles.actionIcon, { backgroundColor: '#f8fafc' }]}>
            <Bell size={20} color="#475569" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Announcements & Tasks</Text>
            <Text style={styles.actionDesc}>Post bulletins, student tasks & discussions</Text>
          </View>
          <ArrowRight size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Trainees List Summary */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Enrolled Trainees</Text>
        <TouchableOpacity onPress={() => onNavigate('instructor_trainees')}>
          <Text style={styles.seeAllText}>View All ({trainees.length})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 20 }} />
      ) : trainees.length === 0 ? (
        <View style={styles.emptyCard}>
          <Users size={32} color="#cbd5e1" />
          <Text style={styles.emptyText}>No trainees enrolled yet. Share your QR code to get started.</Text>
        </View>
      ) : (
        trainees.slice(0, 5).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.traineeItem}
            onPress={() => onNavigate('instructor_trainees', { selectedId: t.id })}
          >
            <View style={styles.traineeAvatar}>
              <Users size={16} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.traineeName}>{t.name}</Text>
              <Text style={styles.traineeMeta}>
                {t.course || 'OJT Student'} • {t.requiredHours} Required Hours
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                t.applicationStatus === 'approved' ? styles.statusApproved : styles.statusPending,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  t.applicationStatus === 'approved' ? styles.statusTextApproved : styles.statusTextPending,
                ]}
              >
                {t.applicationStatus?.toUpperCase() || 'REGISTERED'}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, paddingTop: 50 },
  header: { marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { marginLeft: 6, fontWeight: '700', color: '#0f172a', fontSize: 14 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  kpiCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  kpiValue: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginTop: 4 },
  kpiLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 12 },
  actionGrid: { gap: 10, marginBottom: 20 },
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
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  seeAllText: { fontSize: 13, color: '#2563eb', fontWeight: '800' },
  emptyCard: { backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyText: { color: '#94a3b8', fontSize: 13, marginTop: 8, textAlign: 'center' },
  traineeItem: {
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
  traineeName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  traineeMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  statusApproved: { backgroundColor: '#dcfce7' },
  statusTextApproved: { color: '#16a34a', fontSize: 10, fontWeight: '800' },
  statusPending: { backgroundColor: '#fef3c7' },
  statusTextPending: { color: '#d97706', fontSize: 10, fontWeight: '800' },
});
