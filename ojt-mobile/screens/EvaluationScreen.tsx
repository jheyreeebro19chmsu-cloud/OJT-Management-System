import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Star,
  Award,
  X,
  Clock,
  CheckCircle2,
  Users,
  ChevronRight,
  Building,
  Send,
  ThumbsUp,
  Edit3,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { mobileDb } from '../lib/supabaseService';

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

interface HostFeedback {
  id: string;
  employee_id: string;
  host_name: string;
  host_company: string;
  host_position?: string;
  host_email?: string;
  attendance_score: number;
  performance_score: number;
  attitude_score: number;
  communication_score: number;
  teamwork_score: number;
  overall_score: number;
  strengths: string;
  areas_for_improvement: string;
  recommendation: string;
  submitted_at: string;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Excellent:           { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Very Good':         { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  Good:                { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
  Satisfactory:        { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  'Needs Improvement': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

export default function EvaluationScreen({ profile, session, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'trainee' | 'host'>('trainee');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [hostFeedback, setHostFeedback] = useState<HostFeedback | null>(null);
  const [allEvaluations, setAllEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentEmpId, setCurrentEmpId] = useState<string>('');

  // Host Evaluation Form State
  const [isEditingHost, setIsEditingHost] = useState(false);
  const [submittingHost, setSubmittingHost] = useState(false);
  const [hostCompany, setHostCompany] = useState(profile?.companyName || '');
  const [hostSupervisor, setHostSupervisor] = useState(profile?.supervisorName || '');
  const [hostEnvScore, setHostEnvScore] = useState(5);
  const [hostMentorScore, setHostMentorScore] = useState(5);
  const [hostLearningScore, setHostLearningScore] = useState(5);
  const [hostCultureScore, setHostCultureScore] = useState(5);
  const [hostResourcesScore, setHostResourcesScore] = useState(5);
  const [hostStrengths, setHostStrengths] = useState('');
  const [hostAreasForImprovement, setHostAreasForImprovement] = useState('');
  const [hostRecommendation, setHostRecommendation] = useState('Highly Recommended');

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
        const targetId = profile?.id || session?.user?.id || profile?.employeeId;
        const targetEmail = profile?.email || session?.user?.email;
        if (!targetId && !targetEmail) return;

        // First get employee record
        let empQuery = supabase.from('employees').select('id, company_name, supervisor_name, hte_id');
        if (targetId && targetEmail) {
          empQuery = empQuery.or(`id.eq.${targetId},email.ilike.${targetEmail},employee_id.ilike.${targetId}`);
        } else if (targetId) {
          empQuery = empQuery.or(`id.eq.${targetId},employee_id.ilike.${targetId}`);
        } else {
          empQuery = empQuery.ilike('email', targetEmail!);
        }

        const { data: emp } = await empQuery.limit(1).maybeSingle();

        if (emp) {
          setCurrentEmpId(emp.id);
          if (emp.company_name && !hostCompany) setHostCompany(emp.company_name);
          if (emp.supervisor_name && !hostSupervisor) setHostSupervisor(emp.supervisor_name);

          // 1. Fetch evaluation received from HTE
          const { data: evalData } = await supabase
            .from('evaluations')
            .select('*')
            .eq('employee_id', emp.id)
            .order('evaluated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setEvaluation(evalData);

          // 2. Fetch feedback trainee submitted for HTE
          const { data: hfData } = await supabase
            .from('host_feedback')
            .select('*')
            .eq('employee_id', emp.id)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (hfData) {
            setHostFeedback(hfData);
            setHostCompany(hfData.host_company || emp.company_name || '');
            setHostSupervisor(hfData.host_name || emp.supervisor_name || '');
            setHostEnvScore(Math.round(hfData.attendance_score / 20) || 5);
            setHostMentorScore(Math.round(hfData.performance_score / 20) || 5);
            setHostLearningScore(Math.round(hfData.attitude_score / 20) || 5);
            setHostCultureScore(Math.round(hfData.communication_score / 20) || 5);
            setHostResourcesScore(Math.round(hfData.teamwork_score / 20) || 5);
            setHostStrengths(hfData.strengths || '');
            setHostAreasForImprovement(hfData.areas_for_improvement || '');
            setHostRecommendation(hfData.recommendation || 'Highly Recommended');
          }
        }
      }
    } catch (err) {
      console.error('Evaluation fetch error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, session, profile]);

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

  // Submit Host Feedback
  const handleSubmitHostFeedback = async () => {
    if (!hostCompany.trim()) {
      Alert.alert('Validation Error', 'Please enter your Host Training Establishment company name.');
      return;
    }
    if (!hostSupervisor.trim()) {
      Alert.alert('Validation Error', 'Please enter your HTE supervisor name.');
      return;
    }

    setSubmittingHost(true);
    try {
      const overallAvg = Math.round(
        ((hostEnvScore + hostMentorScore + hostLearningScore + hostCultureScore + hostResourcesScore) / 5) * 20
      );

      const payload = {
        employeeId: currentEmpId || profile?.id || session?.user?.id,
        hostName: hostSupervisor.trim(),
        hostCompany: hostCompany.trim(),
        hostPosition: 'HTE Supervisor',
        hostEmail: profile?.email || '',
        attendanceScore: hostEnvScore * 20,
        performanceScore: hostMentorScore * 20,
        attitudeScore: hostLearningScore * 20,
        communicationScore: hostCultureScore * 20,
        teamworkScore: hostResourcesScore * 20,
        overallScore: overallAvg,
        strengths: hostStrengths.trim() || 'Comprehensive industry training and support.',
        areasForImprovement: hostAreasForImprovement.trim() || 'Continue providing active tasks.',
        recommendation: hostRecommendation as any,
        submittedAt: new Date().toISOString(),
        status: 'submitted' as const,
      };

      await mobileDb.saveHostFeedback(payload);

      // Sync company & supervisor to employee
      if (currentEmpId) {
        await mobileDb.updateEmployee(currentEmpId, {
          companyName: hostCompany.trim(),
          supervisorName: hostSupervisor.trim(),
        });
      }

      Alert.alert('Evaluation Submitted', 'Your Host Training Establishment evaluation has been saved and synced with university coordinators.');
      setIsEditingHost(false);
      fetchEvaluation();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit host evaluation');
    } finally {
      setSubmittingHost(false);
    }
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
            {isAdmin ? 'All Evaluations' : 'OJT Evaluations'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Trainee Segmented Navigation Tabs */}
      {!isAdmin && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => setActiveTab('trainee')}
            style={[styles.tabItem, activeTab === 'trainee' && styles.tabItemActive]}
          >
            <Award size={15} color={activeTab === 'trainee' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.tabItemText, activeTab === 'trainee' && styles.tabItemTextActive]}>
              My OJT Grade
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('host')}
            style={[styles.tabItem, activeTab === 'host' && styles.tabItemActive]}
          >
            <Building size={15} color={activeTab === 'host' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.tabItemText, activeTab === 'host' && styles.tabItemTextActive]}>
              Evaluate Host (HTE)
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
        ) : activeTab === 'trainee' ? (
          // Trainee View: Evaluation Received from HTE
          !evaluation ? (
            <View style={styles.emptyBox}>
              <Star color="#cbd5e1" size={48} />
              <Text style={styles.emptyTitle}>No Evaluation Submitted Yet</Text>
              <Text style={styles.emptyDesc}>
                Your official evaluation will appear here once your Host Training Establishment (HTE) supervisor completes and submits your performance evaluation.
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
                <ScoreBar label="Job Performance & Technical Skills" value={evaluation.performance_score} />
                <ScoreBar label="Work Conduct & Attendance" value={evaluation.attendance_score} />
                <ScoreBar label="Practical Application & Quality" value={evaluation.work_quality_score} />
                <ScoreBar label="Attitude & Work Ethic" value={evaluation.attitude_score} />
              </View>

              {/* Remarks */}
              {evaluation.remarks && (
                <View style={styles.remarksCard}>
                  <Text style={styles.cardTitle}>HTE Supervisor Remarks</Text>
                  <Text style={styles.remarksText}>"{evaluation.remarks}"</Text>
                </View>
              )}
            </>
          )
        ) : (
          // Trainee View: Evaluate Host Establishment (HTE)
          hostFeedback && !isEditingHost ? (
            <View style={styles.card}>
              <View style={styles.submittedHeader}>
                <View style={styles.checkIconBadge}>
                  <CheckCircle2 size={20} color="#15803d" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.submittedTitle}>Host Evaluation Submitted</Text>
                  <Text style={styles.submittedSubtitle}>Submitted on {formatDate(hostFeedback.submitted_at)}</Text>
                </View>
                <TouchableOpacity onPress={() => setIsEditingHost(true)} style={styles.editBtn}>
                  <Edit3 size={13} color="#2563eb" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.metricGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>HOST COMPANY</Text>
                  <Text style={styles.metricValue}>{hostFeedback.host_company}</Text>
                  <Text style={styles.metricSub}>Supervisor: {hostFeedback.host_name}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>OVERALL RATING</Text>
                  <Text style={styles.metricValue}>{hostFeedback.overall_score}%</Text>
                  <Text style={styles.metricSub}>{RATING_LABELS[Math.round(hostFeedback.overall_score / 20)] || 'Good'}</Text>
                </View>
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={styles.cardSubTitle}>Ratings Summary</Text>
                <ScoreBar label="Work Environment & Safety" value={hostFeedback.attendance_score} />
                <ScoreBar label="Mentorship & Guidance" value={hostFeedback.performance_score} />
                <ScoreBar label="Learning Experience" value={hostFeedback.attitude_score} />
                <ScoreBar label="Culture & Professionalism" value={hostFeedback.communication_score} />
                <ScoreBar label="Resources & Facilities" value={hostFeedback.teamwork_score} />
              </View>

              {hostFeedback.strengths ? (
                <View style={styles.feedbackSection}>
                  <Text style={styles.sectionLabel}>Company Strengths</Text>
                  <Text style={styles.sectionBody}>{hostFeedback.strengths}</Text>
                </View>
              ) : null}

              {hostFeedback.areas_for_improvement ? (
                <View style={styles.feedbackSection}>
                  <Text style={styles.sectionLabel}>Suggestions for Future Trainees</Text>
                  <Text style={styles.sectionBody}>{hostFeedback.areas_for_improvement}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            // Evaluation Form
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Building size={20} color="#2563eb" />
                  <Text style={styles.cardTitle}>Rate Host Company (HTE)</Text>
                </View>
                {isEditingHost && (
                  <TouchableOpacity onPress={() => setIsEditingHost(false)}>
                    <Text style={{ fontSize: 13, color: '#64748b', textDecorationLine: 'underline' }}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.inputLabel}>Host Company Name *</Text>
              <TextInput
                style={styles.textInput}
                value={hostCompany}
                onChangeText={setHostCompany}
                placeholder="e.g. Focus"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Host Supervisor Name *</Text>
              <TextInput
                style={styles.textInput}
                value={hostSupervisor}
                onChangeText={setHostSupervisor}
                placeholder="e.g. Yvonne Norte"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.cardTitle, { marginTop: 14, marginBottom: 12 }]}>Criteria Rating (1 - 5)</Text>

              <RatingSelector label="1. Work Environment & Safety" value={hostEnvScore} onChange={setHostEnvScore} />
              <RatingSelector label="2. Mentorship & Guidance" value={hostMentorScore} onChange={setHostMentorScore} />
              <RatingSelector label="3. Learning & Skill Acquisition" value={hostLearningScore} onChange={setHostLearningScore} />
              <RatingSelector label="4. Workplace Culture" value={hostCultureScore} onChange={setHostCultureScore} />
              <RatingSelector label="5. Resources & Facilities" value={hostResourcesScore} onChange={setHostResourcesScore} />

              <Text style={styles.inputLabel}>Company Strengths & Highlights</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={hostStrengths}
                onChangeText={setHostStrengths}
                placeholder="What did you like most about the internship experience?"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Suggestions for Future Trainees</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={hostAreasForImprovement}
                onChangeText={setHostAreasForImprovement}
                placeholder="What could be improved for future interns?"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                onPress={handleSubmitHostFeedback}
                disabled={submittingHost}
                style={[styles.submitBtn, submittingHost && { opacity: 0.6 }]}
              >
                {submittingHost ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {hostFeedback ? 'Update Evaluation' : 'Submit HTE Evaluation'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )
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

function RatingSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={selectorStyles.box}>
      <View style={selectorStyles.headerRow}>
        <Text style={selectorStyles.label}>{label}</Text>
        <Text style={selectorStyles.valText}>{value}/5 - {RATING_LABELS[value]}</Text>
      </View>
      <View style={selectorStyles.btnRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onChange(s)}
            style={[selectorStyles.btn, value >= s ? selectorStyles.btnActive : selectorStyles.btnInactive]}
          >
            <Text style={[selectorStyles.btnText, value >= s ? selectorStyles.btnTextActive : selectorStyles.btnTextInactive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const selectorStyles = StyleSheet.create({
  box: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  valText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  btnRow: { flexDirection: 'row', gap: 6 },
  btn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  btnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnInactive: { backgroundColor: '#fff', borderColor: '#cbd5e1' },
  btnText: { fontSize: 13, fontWeight: '800' },
  btnTextActive: { color: '#fff' },
  btnTextInactive: { color: '#64748b' },
});

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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  tabItemActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabItemTextActive: {
    color: '#2563eb',
  },
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
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  cardSubTitle: { fontSize: 13, fontWeight: '800', color: '#475569', marginBottom: 10 },
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
  submittedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  checkIconBadge: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  submittedTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  submittedSubtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#eff6ff', borderRadius: 10 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  metricGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  metricBox: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  metricLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
  metricValue: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 3 },
  metricSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  feedbackSection: { marginTop: 12, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  sectionBody: { fontSize: 13, color: '#1e293b', marginTop: 4, lineHeight: 18 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 12, marginBottom: 6 },
  textInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0f172a' },
  textArea: { height: 75, textAlignVertical: 'top' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 14, marginTop: 18 },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
