import {
  Star,
  Building,
  CheckCircle2,
  Archive,
  Filter,
  Sparkles,
  ThumbsUp,
  AlertCircle,
  Calendar,
  Printer,
  FileText,
  ArrowLeft,
  Award,
  Clock,
  Eye,
  User,
  GraduationCap,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';
import { CHMSUEvaluationSheet } from '../../components/CHMSUEvaluationSheet';
import { CHMSU_EVALUATION_CATEGORIES, Employee, Evaluation, HostFeedback } from '../../types';
import { getPhotoUrl } from '../../services/config';

const STATUS_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  submitted: { bg: 'bg-amber-50 text-amber-700', border: 'border-amber-200/60', text: 'Needs Review' },
  reviewed: { bg: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200/60', text: 'Reviewed' },
  archived: { bg: 'bg-slate-100 text-slate-600', border: 'border-slate-200', text: 'Archived' },
};

const GRADE_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  Excellent: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Excellent / Outstanding (90-100%)' },
  'Very Good': { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Very Good / Above Average (80-89%)' },
  Good: { color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', label: 'Good / Average (70-79%)' },
  Satisfactory: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Satisfactory / Fair (60-69%)' },
  'Needs Improvement': { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Needs Improvement / Poor (<60%)' },
};

export interface UnifiedFeedbackItem {
  id: string;
  sourceId: string;
  sourceType: 'feedback' | 'evaluation' | 'both';
  employeeId: string;
  hostName: string;
  hostCompany: string;
  hostPosition?: string;
  hostEmail?: string;
  attendanceScore: number;
  performanceScore: number;
  attitudeScore: number;
  communicationScore: number;
  teamworkScore: number;
  overallScore: number;
  grade: 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Needs Improvement';
  strengths: string;
  areasForImprovement: string;
  recommendation: string;
  submittedAt: string;
  status: 'submitted' | 'reviewed' | 'archived';
  rawStatus?: string;
  academicYear?: string;
  evalRef?: Evaluation;
  feedbackRef?: HostFeedback;
}

export function AdminHostFeedback() {
  const {
    hostFeedback,
    evaluations,
    employees,
    updateHostFeedback,
    updateEvaluation,
    settings,
    currentUser,
  } = useApp();

  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(settings?.activeAcademicYear || 'all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItemForView, setSelectedItemForView] = useState<UnifiedFeedbackItem | null>(null);

  // Compute Instructor Name for official sheet signature
  const instructorName = useMemo(() => {
    if (currentUser?.name && (currentUser.role === 'admin' || (currentUser as any).position === 'OJT Instructor')) {
      return currentUser.name;
    }
    const anyInst = employees.find(
      (e) => e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor'))
    );
    if (anyInst?.name) return anyInst.name;
    return 'OJT INSTRUCTOR';
  }, [employees, currentUser]);

  // Unified HTE Submissions: Combines hostFeedback and evaluations submitted by HTE
  const unifiedItems = useMemo(() => {
    const list: UnifiedFeedbackItem[] = [];
    const handledEmployeeIds = new Set<string>();

    // 1. Process hostFeedback table entries
    hostFeedback.forEach((hf) => {
      handledEmployeeIds.add(hf.employeeId);
      const ev = evaluations.find((e) => e.employeeId === hf.employeeId);
      const emp = employees.find((e) => e.id === hf.employeeId);

      const overall = hf.overallScore || (ev ? ev.overallScore : 0);
      const grade: 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Needs Improvement' =
        ev?.grade ||
        (overall >= 90
          ? 'Excellent'
          : overall >= 80
          ? 'Very Good'
          : overall >= 70
          ? 'Good'
          : overall >= 60
          ? 'Satisfactory'
          : 'Needs Improvement');

      const status: 'submitted' | 'reviewed' | 'archived' =
        hf.status === 'archived'
          ? 'archived'
          : hf.status === 'reviewed' || ev?.status === 'reviewed_by_instructor'
          ? 'reviewed'
          : 'submitted';

      list.push({
        id: hf.id,
        sourceId: hf.id,
        sourceType: ev ? 'both' : 'feedback',
        employeeId: hf.employeeId,
        hostName: hf.hostName || emp?.supervisorName || 'HTE Supervisor',
        hostCompany: hf.hostCompany || emp?.companyName || 'Host Training Establishment',
        hostPosition: hf.hostPosition || 'Supervisor',
        hostEmail: hf.hostEmail,
        attendanceScore: hf.attendanceScore ?? ev?.attendanceScore ?? 85,
        performanceScore: hf.performanceScore ?? ev?.performanceScore ?? 85,
        attitudeScore: hf.attitudeScore ?? ev?.attitudeScore ?? 85,
        communicationScore: hf.communicationScore ?? ev?.communicationScore ?? 85,
        teamworkScore: hf.teamworkScore ?? ev?.punctualityScore ?? 85,
        overallScore: overall,
        grade,
        strengths: hf.strengths || ev?.strengths || 'Exemplary dedication and competence.',
        areasForImprovement: hf.areasForImprovement || ev?.areasForImprovement || 'Continue active growth.',
        recommendation: hf.recommendation || ev?.recommendations || 'Recommended for completion',
        submittedAt: hf.submittedAt || ev?.evaluatedAt || new Date().toISOString(),
        status,
        rawStatus: hf.status,
        academicYear: hf.academicYear || emp?.academicYear || settings.activeAcademicYear,
        evalRef: ev,
        feedbackRef: hf,
      });
    });

    // 2. Include evaluations submitted by HTE that may not yet have a separate host_feedback row
    evaluations.forEach((ev) => {
      if (handledEmployeeIds.has(ev.employeeId)) return;
      if (ev.status === 'draft') return; // Exclude non-submitted drafts

      const emp = employees.find((e) => e.id === ev.employeeId);
      const overall = ev.overallScore;

      const status: 'submitted' | 'reviewed' | 'archived' =
        ev.status === 'reviewed_by_instructor' ? 'reviewed' : 'submitted';

      list.push({
        id: `eval-hf-${ev.id}`,
        sourceId: ev.id,
        sourceType: 'evaluation',
        employeeId: ev.employeeId,
        hostName: ev.evaluatedBy || emp?.supervisorName || 'HTE Supervisor',
        hostCompany: emp?.companyName || 'Host Training Establishment',
        hostPosition: 'Supervisor',
        hostEmail: undefined,
        attendanceScore: ev.attendanceScore,
        performanceScore: ev.performanceScore,
        attitudeScore: ev.attitudeScore,
        communicationScore: ev.communicationScore,
        teamworkScore: ev.punctualityScore,
        overallScore: overall,
        grade: ev.grade,
        strengths: ev.strengths || 'Consistent performance and dedicated engagement.',
        areasForImprovement: ev.areasForImprovement || 'Continue developing technical problem-solving skills.',
        recommendation: ev.recommendations || 'Recommended for completion',
        submittedAt: ev.evaluatedAt || new Date().toISOString(),
        status,
        rawStatus: ev.status,
        academicYear: ev.academicYear || emp?.academicYear || settings.activeAcademicYear,
        evalRef: ev,
      });
    });

    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [hostFeedback, evaluations, employees, settings.activeAcademicYear]);

  // Filter based on selected toolbar dropdowns
  const filtered = useMemo(() => {
    return unifiedItems.filter((item) => {
      const trainee = employees.find((e) => e.id === item.employeeId);
      if (selectedAcademicYear !== 'all') {
        const itemYear = item.academicYear || trainee?.academicYear || settings.activeAcademicYear;
        if (itemYear && itemYear !== selectedAcademicYear) return false;
      }
      if (employeeFilter !== 'all' && item.employeeId !== employeeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    });
  }, [unifiedItems, employeeFilter, statusFilter, selectedAcademicYear, employees, settings.activeAcademicYear]);

  // Dynamic KPI summary calculations
  const summary = useMemo(() => {
    if (unifiedItems.length === 0) return { avg: 0, submitted: 0, reviewed: 0, archived: 0 };
    const total = unifiedItems.reduce((sum, f) => sum + f.overallScore, 0);
    return {
      avg: Math.round(total / unifiedItems.length),
      submitted: unifiedItems.filter((f) => f.status === 'submitted').length,
      reviewed: unifiedItems.filter((f) => f.status === 'reviewed').length,
      archived: unifiedItems.filter((f) => f.status === 'archived').length,
    };
  }, [unifiedItems]);

  const getTrainee = (id: string) => employees.find((e) => e.id === id || e.employeeId === id);

  const handleMarkReviewed = (item: UnifiedFeedbackItem) => {
    if (item.feedbackRef) {
      updateHostFeedback(item.feedbackRef.id, { status: 'reviewed' });
    }
    if (item.evalRef) {
      updateEvaluation(item.evalRef.id, {
        status: 'reviewed_by_instructor',
        instructorViewedAt: new Date().toISOString(),
        instructorViewedBy: instructorName,
      });
    }
    setSelectedItemForView((prev) => (prev ? { ...prev, status: 'reviewed' } : null));
    toast.success('✓ Evaluation reviewed and acknowledged! Results confirmed.');
  };

  const handleArchive = (item: UnifiedFeedbackItem) => {
    if (item.feedbackRef) {
      updateHostFeedback(item.feedbackRef.id, { status: 'archived' });
    }
    toast.success('Evaluation archived.');
  };

  const handleRestore = (item: UnifiedFeedbackItem) => {
    if (item.feedbackRef) {
      updateHostFeedback(item.feedbackRef.id, { status: 'reviewed' });
    }
    toast.success('Evaluation restored.');
  };

  // If viewing the official printable sheet for an evaluation
  if (selectedItemForView) {
    return (
      <HostFeedbackOfficialSheet
        item={selectedItemForView}
        instructorName={instructorName}
        employees={employees}
        settings={settings}
        onClose={() => setSelectedItemForView(null)}
        onMarkReviewed={handleMarkReviewed}
      />
    );
  }

  // ── Main Submissions Feed ──────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Modern Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-emerald-900/15"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Star className="w-6 h-6 text-amber-300 fill-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Host Establishment Feedback</h1>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white border border-white/20">
                  A.Y. {settings.activeAcademicYear || '2026-2027'}
                </span>
              </div>
              <p className="text-sm text-emerald-100/90 mt-1 max-w-2xl leading-relaxed">
                Trainee evaluations and performance reports submitted by their Host Training Establishment (HTE) placement supervisors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-xs text-white">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{unifiedItems.length} Total Submissions</span>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
      </motion.div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Score</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">{summary.avg}%</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
              Overall Rating
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg border border-amber-100">
            ★
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Needs Review</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">{summary.submitted}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Pending evaluation</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Reviewed</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1">{summary.reviewed}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Acknowledged</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Archived</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-600 mt-1">{summary.archived}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Saved records</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-200">
            <Archive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
            <Filter size={14} className="text-blue-600" />
            Filters
          </div>

          <select
            value={selectedAcademicYear}
            onChange={(e) => setSelectedAcademicYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Academic Years</option>
            {settings.academicYears.map((ay) => (
              <option key={ay} value={ay}>
                A.Y. {ay} {ay === settings.activeAcademicYear ? '(Active)' : ''}
              </option>
            ))}
          </select>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Trainees</option>
            {employees
              .filter((e) => e.active && e.position !== 'OJT Instructor' && e.position !== 'HTE Representative')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="submitted">Needs Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const csvRows = [
                [
                  'Trainee Name',
                  'Student ID',
                  'HTE Company',
                  'HTE Supervisor',
                  'Attendance Score',
                  'Performance Score',
                  'Attitude Score',
                  'Communication Score',
                  'Teamwork Score',
                  'Overall Score',
                  'Grade',
                  'Status',
                  'Submitted At',
                ],
              ];
              filtered.forEach((item) => {
                const tr = getTrainee(item.employeeId);
                csvRows.push([
                  tr?.name || 'Trainee',
                  tr?.employeeId || '',
                  item.hostCompany,
                  item.hostName,
                  `${item.attendanceScore}%`,
                  `${item.performanceScore}%`,
                  `${item.attitudeScore}%`,
                  `${item.communicationScore}%`,
                  `${item.teamworkScore}%`,
                  `${item.overallScore}%`,
                  item.grade,
                  item.status,
                  item.submittedAt,
                ]);
              });
              const csvContent = csvRows.map((e) => e.join(',')).join('\n');
              const url = URL.createObjectURL(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }));
              const link = document.createElement('a');
              link.href = url;
              link.download = `HTE_Feedback_Summary_${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              toast.success('HTE feedback exported to CSV!');
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <Download size={13} />
            Export CSV
          </button>

          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filtered.length}</strong> submission
            {filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Submissions List */}
      <div className="space-y-4">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl p-12 border border-dashed border-slate-300 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-blue-500 stroke-1" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Feedback Records Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                There are currently no trainee feedback or evaluation submissions matching the selected filters.
              </p>
            </motion.div>
          ) : (
            filtered.map((item) => {
              const badge = STATUS_BADGES[item.status] || STATUS_BADGES.submitted;
              const trainee = getTrainee(item.employeeId);
              const initials = trainee?.name
                ? trainee.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                : 'ST';
              const gc = GRADE_CONFIG[item.grade] || GRADE_CONFIG['Very Good'];

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Top Bar: Trainee Info + Status + Grade */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3.5">
                      {(() => {
                        const photoUrl = getPhotoUrl(trainee?.photo);
                        return (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0 overflow-hidden relative select-none">
                            <span>{initials}</span>
                            {photoUrl && (
                              <img
                                src={photoUrl}
                                alt=""
                                className="w-full h-full object-cover absolute inset-0 z-10"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                        );
                      })()}
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900 leading-snug">
                            {trainee?.name || 'Student Trainee'}
                          </h2>
                          <span className="text-[11px] font-mono text-slate-400">
                            {trainee?.employeeId}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span>{trainee?.course || 'OJT Trainee'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <Building size={12} className="text-blue-600" />
                            {item.hostCompany}
                          </span>
                          {item.hostName && (
                            <>
                              <span>•</span>
                              <span>Supervisor: <strong>{item.hostName}</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className={`inline-block text-xs font-extrabold px-3 py-1 rounded-full border ${gc.bg} ${gc.color} ${gc.border}`}>
                        {item.grade} ({item.overallScore}%)
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.border}`}>
                        {badge.text}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(item.submittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Rating Category Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-5">
                    <ScoreCard label="Attendance" score={item.attendanceScore} />
                    <ScoreCard label="Performance" score={item.performanceScore} />
                    <ScoreCard label="Attitude" score={item.attitudeScore} />
                    <ScoreCard label="Communication" score={item.communicationScore} />
                    <ScoreCard label="Punctuality / Teamwork" score={item.teamworkScore} />
                  </div>

                  {/* Written Feedback Sections */}
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4">
                      <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                        <ThumbsUp size={13} className="text-emerald-600" />
                        Key Strengths Identified
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {item.strengths || 'No specific strengths noted.'}
                      </p>
                    </div>

                    <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4">
                      <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                        <Star size={13} className="text-blue-600" />
                        Areas for Improvement / Notes
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {item.areasForImprovement || 'None noted.'}
                      </p>
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-400">Recommendation:</span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                        {item.recommendation || 'Standard Placement'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedItemForView(item)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors flex items-center gap-1.5 border border-blue-200/60 cursor-pointer"
                      >
                        <FileText size={14} />
                        View Official Form
                      </button>

                      {item.status !== 'reviewed' && (
                        <button
                          type="button"
                          onClick={() => handleMarkReviewed(item)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-600/10 cursor-pointer"
                        >
                          <CheckCircle2 size={14} />
                          Mark as Reviewed
                        </button>
                      )}

                      {item.status !== 'archived' ? (
                        <button
                          type="button"
                          onClick={() => handleArchive(item)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Archive size={14} />
                          Archive
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestore(item)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const getBadgeColor = (val: number) => {
    if (val >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200/70';
    if (val >= 75) return 'text-blue-700 bg-blue-50 border-blue-200/70';
    return 'text-amber-700 bg-amber-50 border-amber-200/70';
  };

  return (
    <div className={`p-3 rounded-2xl border ${getBadgeColor(score)} flex flex-col justify-between`}>
      <p className="text-[11px] font-medium opacity-85 truncate">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-lg font-extrabold">{score}</span>
        <span className="text-[10px] font-bold opacity-75">%</span>
      </div>
    </div>
  );
}

function HostFeedbackOfficialSheet({
  item,
  instructorName,
  employees,
  settings,
  onClose,
  onMarkReviewed,
}: {
  item: UnifiedFeedbackItem;
  instructorName: string;
  employees: Employee[];
  settings: any;
  onClose: () => void;
  onMarkReviewed: (item: UnifiedFeedbackItem) => void;
}) {
  const trainee: Employee = useMemo(() => {
    const found = employees.find(
      (e) => e.id === item.employeeId || e.employeeId === item.employeeId
    );
    if (found) return found;
    return {
      id: item.employeeId,
      name: item.employeeId,
      employeeId: item.employeeId,
      email: '',
      department: 'College of Computer Studies',
      position: 'OJT Trainee',
      role: 'employee' as const,
      status: 'active' as const,
      companyName: item.hostCompany,
      supervisorName: item.hostName,
      schoolName: 'Carlos Hilado Memorial State University',
      campus: 'Talisay (Main) Campus',
      course: 'Bachelor of Science in Information Systems',
      startDate: '',
      endDate: '',
      requiredHours: 486,
      faceRegistered: false,
      createdAt: new Date().toISOString(),
      active: true,
      academicYear: item.academicYear || settings?.activeAcademicYear,
    };
  }, [employees, item.employeeId, item.hostCompany, item.hostName, item.academicYear, settings?.activeAcademicYear]);

  const ratings = useMemo(() => {
    if (item.evalRef?.ratings && Object.keys(item.evalRef.ratings).length > 0) {
      return item.evalRef.ratings;
    }
    const scoreToRating = (sc?: number) => {
      if (sc === undefined || sc === null) return 4;
      return Math.max(1, Math.min(5, Math.round(sc / 20)));
    };
    const wh = scoreToRating(item.attendanceScore || item.overallScore);
    const ws = scoreToRating(item.performanceScore || item.overallScore);
    const ss = scoreToRating(item.communicationScore || item.attitudeScore || item.overallScore);

    const synth: Record<string, number> = {};
    CHMSU_EVALUATION_CATEGORIES.forEach((cat) => {
      cat.items.forEach((crit) => {
        if (cat.id === 'workHabits') synth[crit.id] = wh;
        else if (cat.id === 'workSkills') synth[crit.id] = ws;
        else if (cat.id === 'socialSkills') synth[crit.id] = ss;
        else synth[crit.id] = 4;
      });
    });
    return synth;
  }, [item]);

  const ratingComments = useMemo(() => {
    if (item.evalRef?.ratingComments && Object.keys(item.evalRef.ratingComments).length > 0) {
      return item.evalRef.ratingComments;
    }
    return {
      workHabits: item.strengths || 'Consistently punctual and reliable in reporting for duty.',
      workSkills: item.recommendation || 'Handles assigned tasks with technical accuracy and initiative.',
      socialSkills: item.areasForImprovement || 'Shows courtesy, emotional maturity, and teamwork with peers.',
    };
  }, [item]);

  const commentsSuggestions =
    item.evalRef?.commentsSuggestions ||
    item.recommendation ||
    item.strengths ||
    'The student demonstrated commendable competence, professional conduct, and dedication throughout the internship.';

  const overallRating =
    item.evalRef?.overallRating || (item.overallScore ? Number((item.overallScore / 20).toFixed(2)) : 4.25);

  const questionnaire = item.evalRef?.questionnaire || {
    companyAddress: trainee.department || '',
    contactPerson: item.hostName || trainee.supervisorName || 'HTE Supervisor',
    dateOfEvaluation: item.submittedAt ? item.submittedAt.split('T')[0] : new Date().toISOString().split('T')[0],
    employabilityStatus: 'OJT Trainee',
    telephoneNo: trainee.phone || '',
    department: trainee.department || 'IT Department',
    position: 'ON - THE - JOB TRAINEE',
  };

  const status =
    item.evalRef?.status ||
    (item.status === 'reviewed' ? 'reviewed_by_instructor' : 'submitted_to_instructor');

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <CHMSUEvaluationSheet
        trainee={trainee}
        companyName={item.hostCompany || trainee.companyName || 'Host Training Establishment'}
        supervisorName={item.hostName || trainee.supervisorName || 'HTE Supervisor'}
        instructorName={instructorName}
        evaluationDate={item.submittedAt}
        ratings={ratings}
        ratingComments={ratingComments}
        commentsSuggestions={commentsSuggestions}
        overallRating={overallRating}
        grade={item.grade}
        questionnaire={questionnaire}
        isReadOnly={true}
        status={status}
        role="instructor"
        initialPageTab="page1"
        onClose={onClose}
        onMarkDoneViewed={() => onMarkReviewed(item)}
      />
    </div>
  );
}
