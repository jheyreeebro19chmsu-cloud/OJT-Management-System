import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ArrowLeft, Star, Send, CheckCircle2, User, Award } from 'lucide-react-native';
import { mobileDb, Employee } from '../lib/supabaseService';

export default function HTEEvaluationScreen({
  profile,
  activeAcademicYear,
  onBack,
}: {
  profile: any;
  activeAcademicYear?: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [trainees, setTrainees] = useState<Employee[]>([]);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>('');

  // Rubric Scores (1-100)
  const [attendance, setAttendance] = useState('90');
  const [performance, setPerformance] = useState('92');
  const [attitude, setAttitude] = useState('95');
  const [punctuality, setPunctuality] = useState('90');
  const [communication, setCommunication] = useState('88');
  const [teamwork, setTeamwork] = useState('90');

  // Text qualitative feedback
  const [strengths, setStrengths] = useState('');
  const [areasForImprovement, setAreasForImprovement] = useState('');
  const [recommendations, setRecommendations] = useState('');

  useEffect(() => {
    loadTrainees();
  }, [profile, activeAcademicYear]);

  async function loadTrainees() {
    setLoading(true);
    try {
      const hteId = profile?.id || profile?.employeeId || '';
      const list = await mobileDb.getTraineesByHte(hteId, activeAcademicYear);
      setTrainees(list);
      if (list.length > 0) {
        setSelectedTraineeId(list[0].id);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load trainees');
    } finally {
      setLoading(false);
    }
  }

  // Calculate Overall Grade
  const numAttendance = Number(attendance) || 0;
  const numPerformance = Number(performance) || 0;
  const numAttitude = Number(attitude) || 0;
  const numPunctuality = Number(punctuality) || 0;
  const numCommunication = Number(communication) || 0;
  const numTeamwork = Number(teamwork) || 0;

  const overallScore = Math.round(
    (numAttendance + numPerformance + numAttitude + numPunctuality + numCommunication + numTeamwork) / 6
  );

  const gradeLetter =
    overallScore >= 95
      ? 'A+'
      : overallScore >= 90
      ? 'A'
      : overallScore >= 85
      ? 'B+'
      : overallScore >= 80
      ? 'B'
      : overallScore >= 75
      ? 'C'
      : 'F';

  async function handleSubmit() {
    if (!selectedTraineeId) {
      Alert.alert('Validation Error', 'Please select a trainee to evaluate.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Submit Evaluation
      await mobileDb.saveEvaluation({
        employeeId: selectedTraineeId,
        evaluatedBy: profile?.name || 'HTE Supervisor',
        attendanceScore: numAttendance,
        performanceScore: numPerformance,
        attitudeScore: numAttitude,
        punctualityScore: numPunctuality,
        communicationScore: numCommunication,
        overallScore: overallScore,
        grade: gradeLetter,
        strengths: strengths,
        areasForImprovement: areasForImprovement,
        recommendations: recommendations,
        evaluatedAt: new Date().toISOString(),
        status: 'submitted',
        academicYear: profile?.academicYear || '2025-2026',
      });

      // 2. Submit Host Feedback
      await mobileDb.saveHostFeedback({
        employeeId: selectedTraineeId,
        hostName: profile?.name || 'HTE Supervisor',
        hostCompany: profile?.companyName || 'Host Training Establishment',
        hostPosition: profile?.position || 'Supervisor',
        hostEmail: profile?.email || '',
        attendanceScore: numAttendance,
        performanceScore: numPerformance,
        attitudeScore: numAttitude,
        communicationScore: numCommunication,
        teamworkScore: numTeamwork,
        overallScore: overallScore,
        strengths: strengths,
        areasForImprovement: areasForImprovement,
        recommendation: recommendations,
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        academicYear: profile?.academicYear || '2025-2026',
      });

      Alert.alert('Evaluation Submitted', 'Trainee evaluation and host feedback saved directly to Supabase!', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit evaluation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft color="#0f172a" size={20} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>HTE Trainee Evaluation</Text>
        <Text style={styles.subtitle}>Submit performance grading and qualitative feedback</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : trainees.length === 0 ? (
        <View style={styles.emptyCard}>
          <User size={36} color="#94a3b8" />
          <Text style={styles.emptyText}>No trainees currently assigned to your company.</Text>
        </View>
      ) : (
        <>
          {/* Trainee Selector */}
          <Text style={styles.sectionLabel}>Select Trainee</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
            {trainees.map((t) => {
              const active = t.id === selectedTraineeId;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.traineeChip, active && styles.traineeChipActive]}
                  onPress={() => setSelectedTraineeId(t.id)}
                >
                  <Text style={[styles.traineeChipText, active && styles.traineeChipTextActive]}>{t.name}</Text>
                  <Text style={[styles.traineeChipSub, active && { color: '#bfdbfe' }]}>{t.course || 'Student'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Overall Grade Card */}
          <View style={styles.scoreBanner}>
            <View>
              <Text style={styles.scoreBannerLabel}>Calculated Average</Text>
              <Text style={styles.scoreBannerValue}>{overallScore}%</Text>
            </View>
            <View style={styles.gradeBadge}>
              <Award size={18} color="#fff" />
              <Text style={styles.gradeBadgeText}>Grade {gradeLetter}</Text>
            </View>
          </View>

          {/* Rubric Criteria Inputs */}
          <Text style={styles.sectionLabel}>Evaluation Rubric (Score 0 - 100)</Text>
          <View style={styles.formCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Attendance & Reliability (0-100)</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="numeric"
                value={attendance}
                onChangeText={setAttendance}
                maxLength={3}
              />
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Work Performance & Quality (0-100)</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="numeric"
                value={performance}
                onChangeText={setPerformance}
                maxLength={3}
              />
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Professional Attitude (0-100)</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="numeric"
                value={attitude}
                onChangeText={setAttitude}
                maxLength={3}
              />
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Punctuality (0-100)</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="numeric"
                value={punctuality}
                onChangeText={setPunctuality}
                maxLength={3}
              />
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Communication Skills (0-100)</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="numeric"
                value={communication}
                onChangeText={setCommunication}
                maxLength={3}
              />
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Teamwork & Collaboration (0-100)</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="numeric"
                value={teamwork}
                onChangeText={setTeamwork}
                maxLength={3}
              />
            </View>
          </View>

          {/* Qualitative Feedback */}
          <Text style={styles.sectionLabel}>Qualitative Feedback & Remarks</Text>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Key Strengths</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Quick learner, proactive, excellent problem solving skills..."
              multiline
              numberOfLines={3}
              value={strengths}
              onChangeText={setStrengths}
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Areas for Improvement</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Can improve on documentation formatting..."
              multiline
              numberOfLines={3}
              value={areasForImprovement}
              onChangeText={setAreasForImprovement}
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Supervisor Recommendation</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Highly recommended for future employment..."
              multiline
              numberOfLines={3}
              value={recommendations}
              onChangeText={setRecommendations}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Send size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Evaluation to Supabase</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, paddingTop: 50 },
  header: { marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { marginLeft: 6, fontWeight: '700', color: '#0f172a', fontSize: 14 },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 8, marginTop: 16 },
  selectorRow: { flexDirection: 'row', marginBottom: 12 },
  traineeChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginRight: 10,
  },
  traineeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  traineeChipText: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  traineeChipTextActive: { color: '#ffffff' },
  traineeChipSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  scoreBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreBannerLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  scoreBannerValue: { color: '#ffffff', fontSize: 28, fontWeight: '900', marginTop: 2 },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  gradeBadgeText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  scoreLabel: { fontSize: 13, fontWeight: '700', color: '#334155', flex: 1 },
  scoreInput: {
    width: 60,
    height: 38,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
    gap: 8,
  },
  submitBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  emptyCard: { backgroundColor: '#fff', padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 20 },
  emptyText: { color: '#64748b', fontSize: 13, marginTop: 10, textAlign: 'center' },
});
