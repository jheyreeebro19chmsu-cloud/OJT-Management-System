import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Star, Award, X, Clock, CheckCircle2, Users, ChevronRight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

interface Props {
  profile: any;
  session: any;
  onBack: () => void;
}

interface Evaluation {
  id: string;
  employee_id: string;
  overall_score: number;
  grade: string;
  status: string;
  evaluated_at: string;
  performance_score?: number;
  attendance_score?: number;
  work_quality_score?: number;
  attitude_score?: number;
  remarks?: string;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Excellent:           { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Very Good':         { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  Good:                { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
  Satisfactory:        { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  'Needs Improvement': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

export default function EvaluationScreen({ profile, session, onBack }: Props) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [allEvaluations, setAllEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'instructor';

  const fetchEvaluation = useCallback(async () => {
    try {
      if (isAdmin) {
        const { data } = await supabase
          .from('evaluations')
          .select('*, employees(name, employee_id, company_name)')
          .order('evaluated_at', { ascending: false });
        setAllEvaluations(data || []);
      } else {
        const empId = session?.user?.id;
        if (!empId) return;
        // First get employee record
        const { data: emp } = await supabase
          .from('employees')
          .select('id')
          .or(`id.eq.${empId},email.eq.${session.user.email}`)
          .maybeSingle();

        if (emp) {
          const { data: evalData } = await supabase
            .from('evaluations')
            .select('*')
            .eq('employee_id', emp.id)
            .order('evaluated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setEvaluation(evalData);
        }
      }
    } catch (err) {
      console.error('Evaluation fetch error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, session]);

  useEffect(() => {
    fetchEvaluation();
  }, [fetchEvaluation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvaluation();
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return d; }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading evaluation...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <X color="#374151" size={20} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Star color="#d97706" size={22} />
          <Text style={styles.headerText}>
            {isAdmin ? 'All Evaluations' : 'My Evaluation'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isAdmin ? (
          // Admin View — list all trainees' evaluations
          allEvaluations.length === 0 ? (
            <View style={styles.emptyBox}>
              <Star color="#cbd5e1" size={48} />
              <Text style={styles.emptyTitle}>No Evaluations Yet</Text>
              <Text style={styles.emptyDesc}>Trainee evaluations will appear here once submitted.</Text>
            </View>
          ) : allEvaluations.map((ev) => {
            const colors = GRADE_COLORS[ev.grade] || GRADE_COLORS['Good'];
            return (
              <View key={ev.id} style={[styles.card, { borderColor: colors.border }]}>
                <View style={[styles.gradeBadge, { backgroundColor: colors.bg }]}>
                  <Award color={colors.text} size={14} />
                  <Text style={[styles.gradeBadgeText, { color: colors.text }]}>{ev.grade}</Text>
                </View>
                <Text style={styles.traineeName}>{ev.employees?.name || 'Unknown'}</Text>
                <Text style={styles.traineeId}>{ev.employees?.employee_id} · {ev.employees?.company_name}</Text>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Overall Score</Text>
                  <Text style={[styles.scoreValue, { color: colors.text }]}>{ev.overall_score}%</Text>
                </View>
                {ev.remarks && <Text style={styles.remarks}>"{ev.remarks}"</Text>}
                <Text style={styles.dateText}>{formatDate(ev.evaluated_at)}</Text>
              </View>
            );
          })
        ) : !evaluation ? (
          <View style={styles.emptyBox}>
            <Star color="#cbd5e1" size={48} />
            <Text style={styles.emptyTitle}>No Evaluation Submitted Yet</Text>
            <Text style={styles.emptyDesc}>
              Your evaluation will appear here after your Host Training Establishment (HTE) supervisor completes and submits your official OJT performance evaluation.
            </Text>
          </View>
        ) : (
          <>
            {/* Grade Hero */}
            {(() => {
              const colors = GRADE_COLORS[evaluation.grade] || GRADE_COLORS['Good'];
              return (
                <View style={[styles.gradeHero, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Award color={colors.text} size={56} />
                  <Text style={[styles.gradeTitle, { color: colors.text }]}>{evaluation.grade}</Text>
                  <Text style={[styles.gradeScore, { color: colors.text }]}>{evaluation.overall_score}%</Text>
                  <Text style={styles.gradeDate}>Evaluated {formatDate(evaluation.evaluated_at)}</Text>
                  <View style={[styles.statusPill, evaluation.status === 'final' ? styles.finalPill : styles.draftPill]}>
                    <CheckCircle2 color={evaluation.status === 'final' ? '#16a34a' : '#d97706'} size={14} />
                    <Text style={[styles.statusPillText, { color: evaluation.status === 'final' ? '#15803d' : '#d97706' }]}>
                      {evaluation.status === 'final' ? 'Official HTE Evaluation' : 'Verified'}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Score Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Score Breakdown</Text>
              <ScoreBar label="Performance / Work Quality" value={evaluation.performance_score} />
              <ScoreBar label="Attendance & Punctuality" value={evaluation.attendance_score} />
              <ScoreBar label="Work Quality" value={evaluation.work_quality_score} />
              <ScoreBar label="Attitude & Behavior" value={evaluation.attitude_score} />
            </View>

            {/* Remarks */}
            {evaluation.remarks && (
              <View style={styles.remarksCard}>
                <Text style={styles.cardTitle}>HTE Supervisor Remarks</Text>
                <Text style={styles.remarksText}>"{evaluation.remarks}"</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ScoreBar({ label, value }: { label: string; value?: number }) {
  const pct = value ?? 0;
  return (
    <View style={barStyles.row}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={barStyles.value}>{pct}%</Text>
      </View>
      <View style={barStyles.barBg}>
        <View style={[barStyles.barFill, { width: `${pct}%` as any }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 13, color: '#475569', fontWeight: '600', flex: 1, paddingRight: 8 },
  value: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  barBg: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 999 },
});

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
  gradeHero: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  gradeTitle: { fontSize: 28, fontWeight: '900', marginTop: 12, marginBottom: 4 },
  gradeScore: { fontSize: 48, fontWeight: '900' },
  gradeDate: { fontSize: 13, color: '#64748b', marginTop: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 14,
  },
  finalPill: { backgroundColor: '#f0fdf4' },
  draftPill: { backgroundColor: '#fffbeb' },
  statusPillText: { fontSize: 13, fontWeight: '700' },
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
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  remarksCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  remarksText: { fontSize: 15, color: '#475569', lineHeight: 24, fontStyle: 'italic' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#334155', marginTop: 16 },
  emptyDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 6, lineHeight: 22 },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  gradeBadgeText: { fontSize: 12, fontWeight: '800' },
  traineeName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  traineeId: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 10 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: 13, color: '#64748b' },
  scoreValue: { fontSize: 22, fontWeight: '900' },
  remarks: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 8 },
  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
});
