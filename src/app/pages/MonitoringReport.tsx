import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Calendar,
  Building,
  User,
  Star,
  Printer,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  MapPin,
  FileText,
  AlertTriangle,
  Award,
  ChevronRight,
  TrendingUp,
  X,
  Edit3,
  Trash2,
  Check,
  Info,
  ShieldCheck,
  Send,
  Eye,
  BookOpen,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { MonitoringReport as IMonitoringReport, MonitoringPeriodType, MonitoringQuestionnaire } from '../types';
import { MonitoringReportPrintView } from '../components/MonitoringReportPrintView';
import { UserAvatar } from '../components/UserAvatar';

const PERIOD_CONFIG: Record<
  MonitoringPeriodType,
  { label: string; title: string; desc: string; badgeClass: string; borderClass: string; bgClass: string; defaultHours: number }
> = {
  weekly: {
    label: 'Weekly',
    title: 'Weekly Monitoring Report',
    desc: 'Weekly progress, tasks performed, and workplace evaluation reflection',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    borderClass: 'border-blue-500',
    bgClass: 'from-blue-500/10 to-indigo-500/10',
    defaultHours: 40,
  },
  monthly: {
    label: 'Monthly',
    title: 'Monthly Monitoring Report',
    desc: 'Comprehensive monthly training assessment and HTE feedback',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    borderClass: 'border-purple-500',
    bgClass: 'from-purple-500/10 to-pink-500/10',
    defaultHours: 160,
  },
  midterm: {
    label: 'MidTerm',
    title: 'Mid-Term Monitoring Report',
    desc: 'Mid-practicum progress review & intermediate milestone evaluation (300 Hours)',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    borderClass: 'border-amber-500',
    bgClass: 'from-amber-500/10 to-orange-500/10',
    defaultHours: 300,
  },
  endterm: {
    label: 'EndTerm',
    title: 'End-Term Monitoring Report',
    desc: 'Final practicum completion evaluation, HTE rating, and exit feedback (600 Hours)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    borderClass: 'border-emerald-500',
    bgClass: 'from-emerald-500/10 to-teal-500/10',
    defaultHours: 600,
  },
};

const QUESTIONNAIRE_CRITERIA = [
  {
    key: 'attendanceScore' as const,
    title: '1. Work Environment & Safety',
    desc: 'Cleanliness, ergonomics, workplace safety standards, and welcoming atmosphere.',
  },
  {
    key: 'performanceScore' as const,
    title: '2. Mentorship & Supervision',
    desc: 'Quality of supervisor guidance, constructive feedback, and availability for questions.',
  },
  {
    key: 'attitudeScore' as const,
    title: '3. Learning & Skill Acquisition',
    desc: 'Alignment of tasks with your field of study, hands-on learning, and practical training.',
  },
  {
    key: 'communicationScore' as const,
    title: '4. Workplace Culture & Professionalism',
    desc: 'Respectful treatment, inclusivity, team dynamics, and professional workplace values.',
  },
  {
    key: 'teamworkScore' as const,
    title: '5. Resources & Equipment Support',
    desc: 'Adequacy of tools, computer hardware/software, and necessary working materials.',
  },
];

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement (Poor)',
  2: 'Fair (Below Average)',
  3: 'Good (Average)',
  4: 'Very Good (Above Average)',
  5: 'Excellent (Outstanding)',
};

export function MonitoringReport() {
  const {
    currentUser,
    getCurrentEmployee,
    timeRecords,
    monitoringReports,
    addMonitoringReport,
    updateMonitoringReport,
    deleteMonitoringReport,
  } = useApp();

  const currentEmp = getCurrentEmployee();

  // Active period tab: 'all' | 'weekly' | 'monthly' | 'midterm' | 'endterm'
  const [activePeriodTab, setActivePeriodTab] = useState<'all' | MonitoringPeriodType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [editingReport, setEditingReport] = useState<IMonitoringReport | null>(null);
  const [viewingReport, setViewingReport] = useState<IMonitoringReport | null>(null);
  const [printReport, setPrintReport] = useState<IMonitoringReport | null>(null);

  // Form states
  const [formType, setFormType] = useState<MonitoringPeriodType>('weekly');
  const [formPeriodCovered, setFormPeriodCovered] = useState('');
  const [formHoursRendered, setFormHoursRendered] = useState<number>(40);
  const [formTasks, setFormTasks] = useState('');
  const [formSkills, setFormSkills] = useState('');
  const [formChallenges, setFormChallenges] = useState('');

  // Questionnaire form states
  const [qAttendance, setQAttendance] = useState<number>(5);
  const [qPerformance, setQPerformance] = useState<number>(5);
  const [qAttitude, setQAttitude] = useState<number>(5);
  const [qCommunication, setQCommunication] = useState<number>(5);
  const [qTeamwork, setQTeamwork] = useState<number>(5);
  const [qStrengths, setQStrengths] = useState('');
  const [qAreasForImprovement, setQAreasForImprovement] = useState('');
  const [qRecommendation, setQRecommendation] = useState<
    'Highly Recommended' | 'Recommended' | 'For Improvement' | 'Not Recommended'
  >('Highly Recommended');

  // Hours rendered calculation for current trainee
  const totalRenderedHours = useMemo(() => {
    if (!currentEmp) return 0;
    const empId = currentEmp.id;
    const empCode = currentEmp.employeeId;
    return (timeRecords || [])
      .filter(
        (r) =>
          (r.employeeId === empId || (empCode && r.employeeId === empCode)) &&
          r.approvalStatus !== 'disapproved'
      )
      .reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);
  }, [timeRecords, currentEmp]);

  const requiredHours = currentEmp?.requiredHours || 600;
  const remainingHours = Math.max(0, requiredHours - totalRenderedHours);
  const progressPercentage = Math.min(100, Math.round((totalRenderedHours / requiredHours) * 100));

  // Trainee's reports
  const myReports = useMemo(() => {
    if (!currentEmp && !currentUser) return [];
    const empId = currentEmp?.id?.toLowerCase();
    const empCode = (currentEmp?.employeeId || (currentEmp as any)?.studentId || '').toLowerCase();
    const empName = (currentEmp?.name || currentUser?.name || '').toLowerCase();

    return monitoringReports
      .filter((r) => {
        if (empId && (r.traineeId?.toLowerCase() === empId || r.studentId?.toLowerCase() === empId)) return true;
        if (empCode && (r.traineeId?.toLowerCase() === empCode || r.studentId?.toLowerCase() === empCode)) return true;
        if (empName && r.traineeName?.toLowerCase() === empName) return true;
        return false;
      })
      .map((r) => ({
        ...r,
        reportType: (r.reportType || 'monthly') as MonitoringPeriodType,
      }));
  }, [monitoringReports, currentEmp, currentUser]);

  // Counts per period
  const periodCounts = useMemo(() => {
    return {
      all: myReports.length,
      weekly: myReports.filter((r) => r.reportType === 'weekly').length,
      monthly: myReports.filter((r) => r.reportType === 'monthly').length,
      midterm: myReports.filter((r) => r.reportType === 'midterm').length,
      endterm: myReports.filter((r) => r.reportType === 'endterm').length,
    };
  }, [myReports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    let list = myReports;
    if (activePeriodTab !== 'all') {
      list = list.filter((r) => r.reportType === activePeriodTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.reportNumber?.toLowerCase().includes(q) ||
          r.periodCovered?.toLowerCase().includes(q) ||
          r.tasksAccomplished?.toLowerCase().includes(q) ||
          r.hteCompanyName?.toLowerCase().includes(q) ||
          r.instructorRemarks?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [myReports, activePeriodTab, searchQuery]);

  // Live questionnaire score calculation
  const overallScorePercent = Math.round(
    ((qAttendance + qPerformance + qAttitude + qCommunication + qTeamwork) / 25) * 100
  );

  const getScoreGrade = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (score >= 80) return { label: 'Very Good', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (score >= 70) return { label: 'Good', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
    if (score >= 60) return { label: 'Fair', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Needs Improvement', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  const openCreateModal = (type?: MonitoringPeriodType) => {
    const selectedType = type || (activePeriodTab !== 'all' ? activePeriodTab : 'weekly');
    setEditingReport(null);
    setFormType(selectedType);
    setFormPeriodCovered(
      selectedType === 'weekly'
        ? `Week ${periodCounts.weekly + 1}`
        : selectedType === 'monthly'
        ? `Month ${periodCounts.monthly + 1}`
        : selectedType === 'midterm'
        ? 'Mid-Term Evaluation (300 Hours Milestone)'
        : 'End-Term Final Completion (600 Hours Milestone)'
    );
    setFormHoursRendered(PERIOD_CONFIG[selectedType].defaultHours);
    setFormTasks('');
    setFormSkills('');
    setFormChallenges('');
    setQAttendance(5);
    setQPerformance(5);
    setQAttitude(5);
    setQCommunication(5);
    setQTeamwork(5);
    setQStrengths('');
    setQAreasForImprovement('');
    setQRecommendation('Highly Recommended');
    setShowSubmitModal(true);
  };

  const openEditModal = (report: IMonitoringReport) => {
    setEditingReport(report);
    setFormType(report.reportType || 'weekly');
    setFormPeriodCovered(report.periodCovered || '');
    setFormHoursRendered(report.hoursRenderedThisPeriod || 40);
    setFormTasks(report.tasksAccomplished || report.tasksObserved || '');
    setFormSkills(report.skillsApplied || '');
    setFormChallenges(report.challengesEncountered || '');

    const q = report.questionnaire || {
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: '',
      areasForImprovement: '',
      recommendation: 'Highly Recommended',
    };
    setQAttendance(q.attendanceScore || 5);
    setQPerformance(q.performanceScore || 5);
    setQAttitude(q.attitudeScore || 5);
    setQCommunication(q.communicationScore || 5);
    setQTeamwork(q.teamworkScore || 5);
    setQStrengths(q.strengths || '');
    setQAreasForImprovement(q.areasForImprovement || '');
    setQRecommendation(q.recommendation || 'Highly Recommended');
    setShowSubmitModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmp) {
      toast.error('Trainee profile not found. Please log in.');
      return;
    }
    if (!formPeriodCovered.trim()) {
      toast.error('Please enter the period covered (e.g., Week 1, October 2026).');
      return;
    }
    if (!formTasks.trim()) {
      toast.error('Please describe the tasks and assignments performed.');
      return;
    }

    const questionnairePayload: MonitoringQuestionnaire = {
      attendanceScore: qAttendance,
      performanceScore: qPerformance,
      attitudeScore: qAttitude,
      communicationScore: qCommunication,
      teamworkScore: qTeamwork,
      overallScore: overallScorePercent,
      strengths: qStrengths.trim() || 'Supportive mentorship and hands-on learning environment.',
      areasForImprovement: qAreasForImprovement.trim() || 'Continue providing real-world technical assignments.',
      recommendation: qRecommendation,
    };

    if (editingReport) {
      await updateMonitoringReport(editingReport.id, {
        reportType: formType,
        periodCovered: formPeriodCovered.trim(),
        hoursRenderedThisPeriod: Number(formHoursRendered) || 0,
        tasksAccomplished: formTasks.trim(),
        skillsApplied: formSkills.trim(),
        challengesEncountered: formChallenges.trim(),
        questionnaire: questionnairePayload,
      });
      toast.success('Monitoring report updated successfully!');
    } else {
      await addMonitoringReport({
        reportType: formType,
        traineeId: currentEmp.id,
        traineeName: currentEmp.name,
        studentId: currentEmp.employeeId,
        course: currentEmp.course || currentEmp.department,
        department: currentEmp.department,
        campus: currentEmp.campus || 'Talisay (Main Campus)',
        academicYear: currentEmp.academicYear || '2026-2027',
        hteCompanyName: currentEmp.companyName || 'Host Training Establishment',
        hteAddress: currentEmp.companyAddress || currentEmp.registrationAddress,
        supervisorName: currentEmp.supervisorName || 'HTE Supervisor',
        periodCovered: formPeriodCovered.trim(),
        dateSubmitted: new Date().toISOString().split('T')[0],
        hoursRenderedThisPeriod: Number(formHoursRendered) || 0,
        totalCumulativeHours: totalRenderedHours,
        requiredHours: 600,
        remainingHours: Math.max(0, 600 - totalRenderedHours),
        tasksAccomplished: formTasks.trim(),
        skillsApplied: formSkills.trim(),
        challengesEncountered: formChallenges.trim(),
        questionnaire: questionnairePayload,
        status: 'submitted',
        instructorRemarks: '',
      });
      toast.success(`✓ ${PERIOD_CONFIG[formType].label} Monitoring Report submitted to Instructor!`);
    }

    setShowSubmitModal(false);
  };

  const handleDelete = async (id: string, label: string) => {
    if (window.confirm(`Are you sure you want to delete this ${label}?`)) {
      await deleteMonitoringReport(id);
      toast.success('Report deleted.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-[#152B4D] via-[#1E3A66] to-[#0A1A30] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-xs font-semibold backdrop-blur-xs border border-white/10">
              <ClipboardCheck size={14} /> Official OJT Monitoring System
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Trainee Monitoring & Host Feedback
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Submit periodic monitoring reports and complete the official Host Feedback questionnaire for Weekly, Monthly, MidTerm, and EndTerm milestones. Reviewed by your OJT Instructor.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer shrink-0"
          >
            <Plus size={18} /> Submit Monitoring Report
          </button>
        </div>

        {/* Trainee OJT Overview Metrics */}
        {currentEmp && (
          <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <p className="text-[11px] font-medium text-slate-300">Trainee Name</p>
              <p className="text-sm font-bold text-white truncate">{currentEmp.name}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{currentEmp.employeeId || 'ID Pending'}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <p className="text-[11px] font-medium text-slate-300">Host Training Establishment</p>
              <p className="text-sm font-bold text-white truncate">{currentEmp.companyName || 'Assigned HTE'}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{currentEmp.supervisorName || 'Supervisor Pending'}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <p className="text-[11px] font-medium text-slate-300">Total Hours Rendered</p>
              <p className="text-base font-black text-emerald-400">{totalRenderedHours.toFixed(1)} / {requiredHours} hrs</p>
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-1 overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full transition-all" style={{ width: `${progressPercentage}%` }} />
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <p className="text-[11px] font-medium text-slate-300">Remaining Hours</p>
              <p className="text-base font-black text-amber-300">{remainingHours.toFixed(1)} hrs</p>
              <p className="text-[10px] text-slate-300 mt-0.5">{progressPercentage}% Completed</p>
            </div>
          </div>
        )}
      </div>

      {/* The 4 Report Period Tabs (Weekly, Monthly, MidTerm, EndTerm) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-2 sm:p-3 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActivePeriodTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activePeriodTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Reports ({periodCounts.all})
          </button>

          {(['weekly', 'monthly', 'midterm', 'endterm'] as MonitoringPeriodType[]).map((type) => {
            const cfg = PERIOD_CONFIG[type];
            const isActive = activePeriodTab === type;
            const count = periodCounts[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActivePeriodTab(type)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{cfg.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, periods..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
          />
        </div>
      </div>

      {/* Active Tab Explanatory Card */}
      {activePeriodTab !== 'all' && (
        <div className={`rounded-2xl p-4 bg-gradient-to-r ${PERIOD_CONFIG[activePeriodTab].bgClass} border border-slate-200/80 flex items-center justify-between gap-4`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${PERIOD_CONFIG[activePeriodTab].badgeClass}`}>
                {PERIOD_CONFIG[activePeriodTab].label} Period
              </span>
              <h3 className="font-bold text-slate-900 text-sm">{PERIOD_CONFIG[activePeriodTab].title}</h3>
            </div>
            <p className="text-xs text-slate-600 mt-1">{PERIOD_CONFIG[activePeriodTab].desc}</p>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal(activePeriodTab)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            + New {PERIOD_CONFIG[activePeriodTab].label} Report
          </button>
        </div>
      )}

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <ClipboardCheck size={32} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-800">No Monitoring Reports Found</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {activePeriodTab === 'all'
                ? 'You have not submitted any monitoring reports yet. Click below to submit your Weekly, Monthly, MidTerm, or EndTerm report.'
                : `No reports submitted for the ${PERIOD_CONFIG[activePeriodTab].label} period yet.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal(activePeriodTab !== 'all' ? activePeriodTab : 'weekly')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus size={16} /> Submit {activePeriodTab !== 'all' ? PERIOD_CONFIG[activePeriodTab].label : ''} Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((report) => {
            const periodCfg = PERIOD_CONFIG[report.reportType] || PERIOD_CONFIG.monthly;
            const q = report.questionnaire;
            const avgRating = q
              ? ((q.attendanceScore + q.performanceScore + q.attitudeScore + q.communicationScore + q.teamworkScore) / 5).toFixed(1)
              : '5.0';
            const grade = getScoreGrade(q?.overallScore || 100);
            const isReviewed = report.status === 'reviewed' || report.status === 'acknowledged';

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${periodCfg.badgeClass}`}>
                        {periodCfg.label}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{report.reportNumber}</span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                        isReviewed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {isReviewed ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Clock size={13} />}
                      {isReviewed ? 'Reviewed by Instructor' : 'Awaiting Review'}
                    </span>
                  </div>

                  {/* Title & Period Covered */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">{report.periodCovered}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>Submitted: {report.dateSubmitted || report.createdAt.split('T')[0]}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">{report.hoursRenderedThisPeriod} hrs rendered</span>
                    </p>
                  </div>

                  {/* Tasks Preview */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-700 space-y-1">
                    <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">Tasks Performed:</p>
                    <p className="line-clamp-2 leading-relaxed">{report.tasksAccomplished}</p>
                  </div>

                  {/* Host Feedback Questionnaire Mini Summary */}
                  {q && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Star size={13} className="text-amber-500 fill-amber-500" /> Host Feedback Rating:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900">{avgRating} / 5.0</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${grade.color}`}>
                            {grade.label}
                          </span>
                        </div>
                      </div>

                      {q.recommendation && (
                        <p className="text-[11px] text-slate-600">
                          <span className="text-slate-400 font-medium">HTE Recommendation:</span>{' '}
                          <span className="font-semibold text-slate-800">{q.recommendation}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Instructor Remarks Banner (If Reviewed) */}
                  {isReviewed && report.instructorRemarks && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
                      <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-emerald-600" /> Instructor Remarks:
                      </p>
                      <p className="text-emerald-800 leading-relaxed italic">"{report.instructorRemarks}"</p>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingReport(report)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye size={13} /> View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintReport(report)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Printer size={13} /> Print / PDF
                    </button>
                  </div>

                  {!isReviewed && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(report)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit report draft"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(report.id, `${periodCfg.label} Report`)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete report"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* SUBMISSION / EDIT MODAL (WITH FULL HOST FEEDBACK QUESTIONNAIRE) */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-4"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {editingReport ? 'Edit Monitoring Report' : 'Submit OJT Monitoring Report'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Includes training accomplishments & Host Feedback Questionnaire
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/50 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form Body */}
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
                {/* 1. Report Period Type Selector (4 Types) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    1. Select Monitoring Report Period
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(['weekly', 'monthly', 'midterm', 'endterm'] as MonitoringPeriodType[]).map((type) => {
                      const cfg = PERIOD_CONFIG[type];
                      const isSelected = formType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setFormType(type);
                            if (!editingReport) {
                              setFormHoursRendered(cfg.defaultHours);
                              setFormPeriodCovered(
                                type === 'weekly'
                                  ? `Week ${periodCounts.weekly + 1}`
                                  : type === 'monthly'
                                  ? `Month ${periodCounts.monthly + 1}`
                                  : type === 'midterm'
                                  ? 'Mid-Term Evaluation (300 Hours Milestone)'
                                  : 'End-Term Final Completion (600 Hours Milestone)'
                              );
                            }
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border mb-1 ${cfg.badgeClass}`}>
                            {cfg.label}
                          </span>
                          <p className="font-bold text-xs text-slate-900 leading-tight">{cfg.title}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Period Identification & Hours Rendered */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Period Title / Label <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formPeriodCovered}
                      onChange={(e) => setFormPeriodCovered(e.target.value)}
                      placeholder="e.g., Week 3 (Oct 5 - Oct 9), October 2026, Midterm"
                      required
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hours Rendered in This Period (hrs) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={formHoursRendered}
                      onChange={(e) => setFormHoursRendered(Number(e.target.value) || 0)}
                      required
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                {/* 3. Tasks & Assignments Performed */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tasks / Assignments Performed <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formTasks}
                    onChange={(e) => setFormTasks(e.target.value)}
                    placeholder="Enumerate the key responsibilities, software systems, workstations, or technical duties handled during this period..."
                    required
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                  />
                </div>

                {/* 4. Skills Applied & Challenges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Skills Applied / Tools Used
                    </label>
                    <textarea
                      rows={2}
                      value={formSkills}
                      onChange={(e) => setFormSkills(e.target.value)}
                      placeholder="e.g. Cisco Packet Tracer, React, Python, Excel, Structured Cabling..."
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Challenges Encountered & Solution
                    </label>
                    <textarea
                      rows={2}
                      value={formChallenges}
                      onChange={(e) => setFormChallenges(e.target.value)}
                      placeholder="Bottlenecks faced and how you overcame them with your mentor..."
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                {/* 5. THE QUESTIONNAIRE IN HOST FEEDBACK */}
                <div className="border-t-2 border-slate-200 pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                        <Star size={12} className="fill-amber-500 text-amber-500" /> Host Feedback Questionnaire
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        Host Training Establishment (HTE) Evaluation
                      </h4>
                      <p className="text-xs text-slate-500">
                        Rate each criterion based on your actual experience during this {PERIOD_CONFIG[formType].label} period.
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-medium text-slate-400">Calculated Score</span>
                      <p className="text-base font-black text-slate-900">{overallScorePercent}%</p>
                    </div>
                  </div>

                  {/* 5 Rating Criteria */}
                  <div className="space-y-3 bg-slate-50/80 rounded-2xl p-4 border border-slate-200">
                    {QUESTIONNAIRE_CRITERIA.map((crit) => {
                      const currentRating =
                        crit.key === 'attendanceScore'
                          ? qAttendance
                          : crit.key === 'performanceScore'
                          ? qPerformance
                          : crit.key === 'attitudeScore'
                          ? qAttitude
                          : crit.key === 'communicationScore'
                          ? qCommunication
                          : qTeamwork;

                      const setRatingFn = (val: number) => {
                        if (crit.key === 'attendanceScore') setQAttendance(val);
                        else if (crit.key === 'performanceScore') setQPerformance(val);
                        else if (crit.key === 'attitudeScore') setQAttitude(val);
                        else if (crit.key === 'communicationScore') setQCommunication(val);
                        else if (crit.key === 'teamworkScore') setQTeamwork(val);
                      };

                      return (
                        <div key={crit.key} className="bg-white rounded-xl p-3 border border-slate-200/80 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <p className="font-bold text-xs text-slate-900">{crit.title}</p>
                              <p className="text-[11px] text-slate-500 leading-tight">{crit.desc}</p>
                            </div>
                            <span className="text-xs font-bold text-blue-700 sm:text-right shrink-0">
                              {RATING_LABELS[currentRating]}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            {[1, 2, 3, 4, 5].map((starVal) => (
                              <button
                                key={starVal}
                                type="button"
                                onClick={() => setRatingFn(starVal)}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
                                  starVal <= currentRating
                                    ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-2xs'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <Star
                                  size={15}
                                  className={starVal <= currentRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}
                                />
                                <span>{starVal}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Qualitative Feedback Questions */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Key Strengths Observed in Host Training Establishment
                      </label>
                      <textarea
                        rows={2}
                        value={qStrengths}
                        onChange={(e) => setQStrengths(e.target.value)}
                        placeholder="What specific mentoring, tools, environment, or culture did you find most commendable?"
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Areas for Improvement or Recommendations for HTE
                      </label>
                      <textarea
                        rows={2}
                        value={qAreasForImprovement}
                        onChange={(e) => setQAreasForImprovement(e.target.value)}
                        placeholder="Suggestions for future intern training flow, task rotation, or tools..."
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Overall HTE Recommendation
                      </label>
                      <select
                        value={qRecommendation}
                        onChange={(e) => setQRecommendation(e.target.value as any)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                      >
                        <option value="Highly Recommended">Highly Recommended (Premier Training Partner)</option>
                        <option value="Recommended">Recommended (Standard Practicum Site)</option>
                        <option value="For Improvement">For Improvement (Requires Follow-Up Coordination)</option>
                        <option value="Not Recommended">Not Recommended</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-2">
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <Send size={14} /> {editingReport ? 'Update Report' : `Submit ${PERIOD_CONFIG[formType].label} Report`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW DETAILS MODAL */}
      <AnimatePresence>
        {viewingReport && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-4"
            >
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${PERIOD_CONFIG[viewingReport.reportType]?.badgeClass || 'bg-slate-100'}`}>
                    {PERIOD_CONFIG[viewingReport.reportType]?.label || 'Report'}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {viewingReport.reportNumber} — {viewingReport.periodCovered}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingReport(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 font-medium">Date Submitted:</span>
                    <p className="font-bold text-slate-900">{viewingReport.dateSubmitted}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Hours Rendered:</span>
                    <p className="font-bold text-slate-900">{viewingReport.hoursRenderedThisPeriod} Hours</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">HTE Company:</span>
                    <p className="font-bold text-slate-900">{viewingReport.hteCompanyName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Review Status:</span>
                    <p className="font-bold text-slate-900 capitalize">{viewingReport.status}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">Tasks & Accomplishments</span>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-100 leading-relaxed text-slate-800">
                    {viewingReport.tasksAccomplished}
                  </p>
                </div>

                {viewingReport.skillsApplied && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">Skills Applied / Developed</span>
                    <p className="p-3 bg-slate-50 rounded-xl border border-slate-100 leading-relaxed text-slate-800">
                      {viewingReport.skillsApplied}
                    </p>
                  </div>
                )}

                {/* Questionnaire Breakdown */}
                {viewingReport.questionnaire && (
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center gap-1">
                        <Star size={13} className="text-amber-500 fill-amber-500" /> Host Feedback Ratings
                      </span>
                      <span className="font-black text-sm text-slate-900">
                        Score: {viewingReport.questionnaire.overallScore}%
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-slate-500">Work Environment:</span>{' '}
                        <span className="font-bold text-slate-800">{viewingReport.questionnaire.attendanceScore} / 5</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Mentorship & Supervision:</span>{' '}
                        <span className="font-bold text-slate-800">{viewingReport.questionnaire.performanceScore} / 5</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Learning & Skills:</span>{' '}
                        <span className="font-bold text-slate-800">{viewingReport.questionnaire.attitudeScore} / 5</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Workplace Culture:</span>{' '}
                        <span className="font-bold text-slate-800">{viewingReport.questionnaire.communicationScore} / 5</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-500">Resources Support:</span>{' '}
                        <span className="font-bold text-slate-800">{viewingReport.questionnaire.teamworkScore} / 5</span>
                      </div>
                    </div>

                    {viewingReport.questionnaire.strengths && (
                      <div className="space-y-1">
                        <span className="text-slate-500 font-medium">HTE Strengths:</span>
                        <p className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-800">
                          {viewingReport.questionnaire.strengths}
                        </p>
                      </div>
                    )}

                    {viewingReport.questionnaire.areasForImprovement && (
                      <div className="space-y-1">
                        <span className="text-slate-500 font-medium">Areas for Improvement:</span>
                        <p className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-800">
                          {viewingReport.questionnaire.areasForImprovement}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Instructor Remarks */}
                {viewingReport.instructorRemarks && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
                    <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-emerald-600" /> Instructor Feedback & Remarks:
                    </p>
                    <p className="text-emerald-800 leading-relaxed italic">"{viewingReport.instructorRemarks}"</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const r = viewingReport;
                    setViewingReport(null);
                    setPrintReport(r);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} /> Print Report
                </button>
                <button
                  type="button"
                  onClick={() => setViewingReport(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT VIEW MODAL */}
      {printReport && (
        <MonitoringReportPrintView
          report={printReport}
          onClose={() => setPrintReport(null)}
        />
      )}
    </div>
  );
}
