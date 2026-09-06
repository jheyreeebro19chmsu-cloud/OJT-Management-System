import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  User,
  Building,
  GraduationCap,
  Clock,
  CheckCircle,
  Star,
  Award,
  ChevronRight,
  X,
  MapPin,
  Phone,
  Mail,
  Camera,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';

interface Props {
  profile: any;
  session: any;
  onBack: () => void;
  onEnrollFace?: () => void;
}

export default function ProfileScreen({ profile, session, onBack, onEnrollFace }: Props) {
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [timeRecords, setTimeRecords] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('*')
        .or(`id.eq.${session.user.id},email.eq.${session.user.email}`)
        .maybeSingle();
      if (emp) {
        setEmployeeData(emp);
        // Fetch time records for hours calculation
        const { data: records } = await supabase
          .from('time_records')
          .select('*')
          .eq('employee_id', emp.id);
        setTimeRecords(records || []);

        // Fetch evaluation
        const { data: evalData } = await supabase
          .from('evaluations')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('status', 'final')
          .maybeSingle();
        setEvaluation(evalData);
      }
    } catch (err) {
      console.error('Profile fetch error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Calculate total hours from time records
  const totalHours = timeRecords.reduce((sum, r) => {
    if (r.time_in && r.time_out) {
      const hours = (new Date(r.time_out).getTime() - new Date(r.time_in).getTime()) / 3600000;
      return sum + Math.max(0, hours);
    }
    return sum;
  }, 0);

  const requiredHours = employeeData?.required_hours || employeeData?.requiredHours || 600;
  const progress = Math.min(100, Math.round((totalHours / requiredHours) * 100));

  const gradeColors: Record<string, { bg: string; text: string }> = {
    Excellent: { bg: '#f0fdf4', text: '#15803d' },
    'Very Good': { bg: '#eff6ff', text: '#1d4ed8' },
    Good: { bg: '#f0f9ff', text: '#0369a1' },
    Satisfactory: { bg: '#fffbeb', text: '#d97706' },
    'Needs Improvement': { bg: '#fef2f2', text: '#dc2626' },
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const data = employeeData || profile;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <X color="#374151" size={20} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <User color="#2563eb" size={22} />
          <Text style={styles.headerText}>My Profile</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Hero */}
        <View style={styles.profileHero}>
          {data?.photo ? (
            <Image source={{ uri: data.photo }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User color="#2563eb" size={40} />
            </View>
          )}
          <Text style={styles.profileName}>{data?.name || 'Unknown'}</Text>
          <Text style={styles.profileRole}>
            {data?.position || data?.role === 'admin' ? 'OJT Instructor / Admin' : data?.role === 'hte' ? 'HTE Supervisor' : 'OJT Trainee'}
          </Text>
          <View style={styles.statusBadge}>
            <View style={[
              styles.statusDot,
              { backgroundColor: data?.application_status === 'approved' ? '#22c55e' : '#f59e0b' },
            ]} />
            <Text style={styles.statusText}>
              {data?.application_status === 'approved' ? 'Active Trainee' : data?.application_status === 'pending' ? 'Pending Approval' : 'Not Enrolled'}
            </Text>
          </View>
        </View>

        {/* OJT Progress */}
        {data?.role !== 'admin' && data?.role !== 'hte' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Clock color="#2563eb" size={18} />
              <Text style={styles.cardTitle}>OJT Progress</Text>
            </View>
            <View style={styles.hoursRow}>
              <View style={styles.hoursStat}>
                <Text style={styles.hoursValue}>{totalHours.toFixed(0)}</Text>
                <Text style={styles.hoursLabel}>Hours Rendered</Text>
              </View>
              <View style={styles.hoursDivider} />
              <View style={styles.hoursStat}>
                <Text style={styles.hoursValue}>{requiredHours}</Text>
                <Text style={styles.hoursLabel}>Required Hours</Text>
              </View>
              <View style={styles.hoursDivider} />
              <View style={styles.hoursStat}>
                <Text style={[styles.hoursValue, { color: '#16a34a' }]}>{progress}%</Text>
                <Text style={styles.hoursLabel}>Completed</Text>
              </View>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` as any }]} />
            </View>
          </View>
        )}

        {/* Evaluation Result */}
        {evaluation && (
          <View style={[styles.card, { backgroundColor: gradeColors[evaluation.grade]?.bg || '#f8fafc' }]}>
            <View style={styles.cardHeader}>
              <Star color="#d97706" size={18} />
              <Text style={styles.cardTitle}>Evaluation Result</Text>
            </View>
            <View style={styles.evalRow}>
              <View>
                <Text style={[styles.evalGrade, { color: gradeColors[evaluation.grade]?.text || '#374151' }]}>
                  {evaluation.grade}
                </Text>
                <Text style={styles.evalScore}>Score: {evaluation.overall_score}%</Text>
              </View>
              <Award color={gradeColors[evaluation.grade]?.text || '#374151'} size={40} />
            </View>
          </View>
        )}

        {/* Personal Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <User color="#2563eb" size={18} />
            <Text style={styles.cardTitle}>Personal Information</Text>
          </View>
          <InfoRow icon={<Mail color="#64748b" size={15} />} label="Email" value={data?.email} />
          <InfoRow icon={<Phone color="#64748b" size={15} />} label="Phone" value={data?.phone || 'Not set'} />
          <InfoRow icon={<User color="#64748b" size={15} />} label="Student ID" value={data?.employee_id || data?.employeeId || 'N/A'} />
          <InfoRow icon={<MapPin color="#64748b" size={15} />} label="Address" value={data?.address || 'Not set'} />
        </View>

        {/* Academic Info */}
        {data?.role !== 'admin' && data?.role !== 'hte' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <GraduationCap color="#7c3aed" size={18} />
              <Text style={styles.cardTitle}>Academic & OJT Info</Text>
            </View>
            <InfoRow icon={<GraduationCap color="#64748b" size={15} />} label="School" value={data?.school_name || data?.schoolName || 'N/A'} />
            <InfoRow icon={<Building color="#64748b" size={15} />} label="Department" value={data?.department || 'N/A'} />
            <InfoRow icon={<Building color="#64748b" size={15} />} label="Company" value={data?.company_name || data?.companyName || 'N/A'} />
            <InfoRow icon={<Clock color="#64748b" size={15} />} label="Required Hours" value={`${requiredHours} hours`} />
          </View>
        )}

        {/* Face Recognition Status */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CheckCircle color={data?.face_registered ? '#16a34a' : '#94a3b8'} size={18} />
            <Text style={styles.cardTitle}>Face Recognition</Text>
          </View>
          <View style={[styles.faceStatusRow, { backgroundColor: data?.face_registered ? '#f0fdf4' : '#fafafa' }]}>
            <Text style={[styles.faceStatusText, { color: data?.face_registered ? '#15803d' : '#64748b' }]}>
              {data?.face_registered ? '✓ Face Enrolled — Biometric time-in enabled' : '✗ Not enrolled — Face recognition unavailable'}
            </Text>
          </View>
          {onEnrollFace && (
            <TouchableOpacity
              style={styles.enrollFaceBtn}
              onPress={onEnrollFace}
            >
              <Camera color="#fff" size={16} />
              <Text style={styles.enrollFaceBtnText}>
                {data?.face_registered ? 'Retake Biometric Face Scan' : 'Scan & Enroll Face Now'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <View style={styles.infoRow}>
      {icon}
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  backBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 12 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748b' },
  content: { padding: 16, gap: 16 },
  profileHero: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 14 },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#bfdbfe',
  },
  profileName: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  profileRole: { fontSize: 14, color: '#64748b', fontWeight: '600', marginBottom: 10 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  hoursStat: { flex: 1, alignItems: 'center' },
  hoursValue: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  hoursLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2, textAlign: 'center' },
  hoursDivider: { width: 1, height: 40, backgroundColor: '#e2e8f0' },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 999,
  },
  evalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  evalGrade: { fontSize: 24, fontWeight: '900', marginBottom: 4 },
  evalScore: { fontSize: 14, color: '#64748b', fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: '#0f172a', fontWeight: '600' },
  faceStatusRow: { borderRadius: 12, padding: 14 },
  faceStatusText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  enrollFaceBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  enrollFaceBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
