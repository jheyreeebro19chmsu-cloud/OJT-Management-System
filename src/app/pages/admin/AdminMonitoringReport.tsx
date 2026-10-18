import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  Calendar,
  Building,
  User,
  Star,
  Printer,
  Download,
  Eye,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Phone,
  MapPin,
  RefreshCw,
  FileText,
  Users,
  Check,
  X,
  ChevronRight,
  TrendingUp,
  Award,
  BookOpen,
  Send,
  MessageSquare,
  ShieldCheck,
  CheckSquare,
  Square,
  Lightbulb,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';
import {
  MonitoringReport,
  MonitoringPeriodType,
  MonitoringTermType,
  MonitoringFrequencyType,
  MonitoringQuestionnaire,
  Employee,
  EmployabilityStatus,
} from '../../types';
import { MonitoringReportPrintView } from '../../components/MonitoringReportPrintView';
import { UserAvatar } from '../../components/UserAvatar';

export function getReportTerm(report: MonitoringReport): MonitoringTermType {
  if (report.term) return report.term;
  if (
    report.reportType === 'endterm' ||
    (report.reportNumber || '').toUpperCase().includes('END') ||
    (report.periodCovered || '').toLowerCase().includes('end-term') ||
    (report.totalCumulativeHours || 0) > 300
  ) {
    return 'endterm';
  }
  return 'midterm';
}

export function getReportFrequency(report: MonitoringReport): MonitoringFrequencyType {
  if (report.frequency) return report.frequency;
  if (report.reportType === 'midterm' || report.reportType === 'endterm') return 'evaluation';
  if (report.reportType === 'monthly' || (report.periodCovered || '').toLowerCase().includes('month')) return 'monthly';
  return 'weekly';
}

const PERIOD_CONFIG: Record<
  MonitoringPeriodType,
  { label: string; badgeColor: string; bgSoft: string; border: string; desc: string }
> = {
  weekly: {
    label: 'Weekly',
    badgeColor: 'bg-blue-600 text-white',
    bgSoft: 'bg-blue-50/70',
    border: 'border-blue-200',
    desc: 'Weekly progress and training reflection',
  },
  monthly: {
    label: 'Monthly',
    badgeColor: 'bg-emerald-600 text-white',
    bgSoft: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    desc: 'Monthly comprehensive training assessment',
  },
  midterm: {
    label: 'Mid-Term',
    badgeColor: 'bg-purple-600 text-white',
    bgSoft: 'bg-purple-50/70',
    border: 'border-purple-200',
    desc: '300-hour midpoint milestone evaluation',
  },
  endterm: {
    label: 'End-Term',
    badgeColor: 'bg-amber-600 text-white',
    bgSoft: 'bg-amber-50/70',
    border: 'border-amber-200',
    desc: '600-hour final practicum exit & completion',
  },
};

const CHMSU_QUESTIONS = [
  { key: 'q1_dutiesBriefly' as const, num: 1, prompt: '1. Describe your duties briefly:' },
  { key: 'q2_strongestPerformanceArea' as const, num: 2, prompt: '2. What do you consider your strongest area of performance?' },
  { key: 'q3_areasImprovedMost' as const, num: 3, prompt: '3. In what areas do you feel you have improved the most?' },
  { key: 'q4_areasNeedImprovement' as const, num: 4, prompt: '4. In what areas do you feel need the most improvement?' },
  { key: 'q5_situationChallengedMost' as const, num: 5, prompt: '5. What situation challenged you the most?' },
  { key: 'q6_howOvercameChallenge' as const, num: 6, prompt: '6. How did you overcome this challenge or situation?' },
  { key: 'q7_whatLearnedFromExperience' as const, num: 7, prompt: '7. What did you learn from your overall training experience?' },
  { key: 'q8_isQualifiedLinkage' as const, num: 8, prompt: '8. Is this training establishment well-qualified for student OJT placement?' },
  { key: 'q9_ojtSuggestionsRecommendations' as const, num: 9, prompt: '9. Other comments, suggestions, and recommendations:' },
];

export function AdminMonitoringReport() {
  const {
    currentUser,
    getCurrentEmployee,
    employees,
    timeRecords,
    monitoringReports,
    addMonitoringReport,
    deleteMonitoringReport,
    reviewMonitoringReport,
  } = useApp();

  const currentEmp = getCurrentEmployee();
  const instructorName = currentUser?.name || currentEmp?.name || 'Prof. Ma. Cristina Ramos, MIT';

  // Active tab filter: 'all' | 'midterm' | 'endterm' | 'roster'
  const [activeTab, setActiveTab] = useState<'all' | 'midterm' | 'endterm' | 'roster'>('all');
  const [activeSubFilter, setActiveSubFilter] = useState<'all' | 'weekly' | 'monthly' | 'evaluation'>('all');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'reviewed'>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterTrainee, setFilterTrainee] = useState<string>('all');

  // Modal states
  const [reviewReport, setReviewReport] = useState<MonitoringReport | null>(null);
  const [reviewRemarksInput, setReviewRemarksInput] = useState('');
  const [printReport, setPrintReport] = useState<MonitoringReport | null>(null);
  const [viewDetailsReport, setViewDetailsReport] = useState<MonitoringReport | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Form State
  const [createTraineeId, setCreateTraineeId] = useState('');
  const [createTerm, setCreateTerm] = useState<MonitoringTermType>('midterm');
  const [createFrequency, setCreateFrequency] = useState<MonitoringFrequencyType>('weekly');
  const [createReportType, setCreateReportType] = useState<MonitoringPeriodType>('weekly');
  const [createPeriodCovered, setCreatePeriodCovered] = useState('');
  const [createHoursThisPeriod, setCreateHoursThisPeriod] = useState(40);
  const [createEmployability, setCreateEmployability] = useState<EmployabilityStatus | string>('OJT Trainee');
  const [createAllowance, setCreateAllowance] = useState('None / Stipend');
  const [createTelephone, setCreateTelephone] = useState('N/A');
  const [createQAnswers, setCreateQAnswers] = useState({
    q1_dutiesBriefly: '',
    q2_strongestPerformanceArea: '',
    q3_areasImprovedMost: '',
    q4_areasNeedImprovement: '',
    q5_situationChallengedMost: '',
    q6_howOvercameChallenge: '',
    q7_whatLearnedFromExperience: '',
    q8_isQualifiedLinkage: '',
    q9_ojtSuggestionsRecommendations: '',
  });
  const [createInstructorRemarks, setCreateInstructorRemarks] = useState('');

  // Trainee student accounts only
  const allTrainees = useMemo(() => {
    return employees.filter((emp) => {
      const pos = (emp.position || '').toLowerCase();
      const role = ((emp as any).role || '').toLowerCase();
      return (
        role !== 'admin' &&
        role !== 'instructor' &&
        role !== 'hte' &&
        pos !== 'administrator' &&
        !pos.includes('instructor') &&
        !pos.includes('faculty') &&
        !pos.includes('hte') &&
        !pos.includes('host')
      );
    });
  }, [employees]);

  // Available courses
  const availableCourses = useMemo(() => {
    const set = new Set<string>();
    allTrainees.forEach((t) => {
      if (t.course) set.add(t.course);
    });
    return Array.from(set).sort();
  }, [allTrainees]);

  // Compute rendered hours
  const getRenderedHoursForTrainee = (traineeId: string, employeeIdCode?: string) => {
    return (timeRecords || [])
      .filter(
        (r) =>
          (r.employeeId === traineeId || (employeeIdCode && r.employeeId === employeeIdCode)) &&
          r.approvalStatus !== 'disapproved'
      )
      .reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);
  };

  // Metrics
  const metrics = useMemo(() => {
    const midtermReports = monitoringReports.filter((r) => getReportTerm(r) === 'midterm');
    const endtermReports = monitoringReports.filter((r) => getReportTerm(r) === 'endterm');

    return {
      total: monitoringReports.length,
      midterm: {
        all: midtermReports.length,
        weekly: midtermReports.filter((r) => getReportFrequency(r) === 'weekly').length,
        monthly: midtermReports.filter((r) => getReportFrequency(r) === 'monthly').length,
        evaluation: midtermReports.filter((r) => getReportFrequency(r) === 'evaluation').length,
      },
      endterm: {
        all: endtermReports.length,
        weekly: endtermReports.filter((r) => getReportFrequency(r) === 'weekly').length,
        monthly: endtermReports.filter((r) => getReportFrequency(r) === 'monthly').length,
        evaluation: endtermReports.filter((r) => getReportFrequency(r) === 'evaluation').length,
      },
      totalWeekly: monitoringReports.filter((r) => getReportFrequency(r) === 'weekly').length,
      totalMonthly: monitoringReports.filter((r) => getReportFrequency(r) === 'monthly').length,
      totalEvaluation: monitoringReports.filter((r) => getReportFrequency(r) === 'evaluation').length,
      pendingCount: monitoringReports.filter((r) => r.status === 'submitted').length,
      reviewedCount: monitoringReports.filter((r) => r.status === 'reviewed').length,
    };
  }, [monitoringReports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return monitoringReports.filter((r) => {
      const term = getReportTerm(r);
      const freq = getReportFrequency(r);

      if (activeTab !== 'all' && activeTab !== 'roster') {
        if (term !== activeTab) return false;
      }
      if (activeTab !== 'roster' && activeSubFilter !== 'all') {
        if (freq !== activeSubFilter) return false;
      }
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterCourse !== 'all' && r.course !== filterCourse) return false;
      if (filterTrainee !== 'all') {
        const matchesTrainee = r.traineeId === filterTrainee || r.studentId === filterTrainee;
        if (!matchesTrainee) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.traineeName || '').toLowerCase().includes(q);
        const matchId = (r.studentId || r.traineeId || '').toLowerCase().includes(q);
        const matchHte = (r.hteCompanyName || '').toLowerCase().includes(q);
        const matchPeriod = (r.periodCovered || '').toLowerCase().includes(q);
        const matchNum = (r.reportNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchHte && !matchPeriod && !matchNum) return false;
      }

      return true;
    });
  }, [monitoringReports, activeTab, activeSubFilter, filterStatus, filterCourse, filterTrainee, searchQuery]);

  // Handle opening Review Modal
  const openReviewModal = (report: MonitoringReport) => {
    setReviewReport(report);
    setReviewRemarksInput(report.instructorRemarks || '');
  };

  // Handle submitting instructor review
  const handleSubmitReview = async () => {
    if (!reviewReport) return;
    try {
      await reviewMonitoringReport(reviewReport.id, reviewRemarksInput, 'reviewed');
      toast.success(`Monitoring report for ${reviewReport.traineeName} reviewed and endorsed successfully!`);
      setReviewReport(null);
      setReviewRemarksInput('');
    } catch {
      toast.error('Failed to submit review remarks.');
    }
  };

  // Handle Deleting a report
  const handleDeleteReport = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete this monitoring report for ${name}?`)) {
      try {
        await deleteMonitoringReport(id);
        toast.success('Monitoring report deleted.');
      } catch {
        toast.error('Failed to delete report.');
      }
    }
  };

  // Create Modal Auto-populate
  const handleSelectCreateTrainee = (id: string) => {
    setCreateTraineeId(id);
    const emp = allTrainees.find((t) => t.id === id || t.employeeId === id);
    if (!emp) return;
    if (!createPeriodCovered) {
      const termPrefix = createTerm === 'midterm' ? 'Mid-Term' : 'End-Term';
      if (createFrequency === 'weekly') {
        setCreatePeriodCovered(`${termPrefix} Week ${createTerm === 'endterm' ? 9 : 1} Progress Review`);
      } else if (createFrequency === 'monthly') {
        setCreatePeriodCovered(`${termPrefix} Month ${createTerm === 'endterm' ? 3 : 1} Comprehensive Assessment`);
      } else {
        setCreatePeriodCovered(
          createTerm === 'midterm'
            ? 'Mid-Term (300h Milestone Evaluation)'
            : 'End-Term (600h Exit & Practicum Completion)'
        );
      }
    }
  };

  const handleTermChange = (term: MonitoringTermType) => {
    setCreateTerm(term);
    const termPrefix = term === 'midterm' ? 'Mid-Term' : 'End-Term';
    if (createFrequency === 'weekly') {
      setCreatePeriodCovered(`${termPrefix} Week ${term === 'endterm' ? 9 : 1} Progress Review`);
      setCreateHoursThisPeriod(40);
    } else if (createFrequency === 'monthly') {
      setCreatePeriodCovered(`${termPrefix} Month ${term === 'endterm' ? 3 : 1} Comprehensive Assessment`);
      setCreateHoursThisPeriod(160);
    } else {
      setCreatePeriodCovered(
        term === 'midterm'
          ? 'Mid-Term (300h Milestone Evaluation)'
          : 'End-Term (600h Exit & Practicum Completion)'
      );
      setCreateHoursThisPeriod(300);
    }
  };

  const handleFrequencyChange = (freq: MonitoringFrequencyType) => {
    setCreateFrequency(freq);
    const termPrefix = createTerm === 'midterm' ? 'Mid-Term' : 'End-Term';
    if (freq === 'weekly') {
      setCreatePeriodCovered(`${termPrefix} Week ${createTerm === 'endterm' ? 9 : 1} Progress Review`);
      setCreateHoursThisPeriod(40);
    } else if (freq === 'monthly') {
      setCreatePeriodCovered(`${termPrefix} Month ${createTerm === 'endterm' ? 3 : 1} Comprehensive Assessment`);
      setCreateHoursThisPeriod(160);
    } else {
      setCreatePeriodCovered(
        createTerm === 'midterm'
          ? 'Mid-Term (300h Milestone Evaluation)'
          : 'End-Term (600h Exit & Practicum Completion)'
      );
      setCreateHoursThisPeriod(300);
    }
  };

  // Handle Creating a Report as Instructor
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = allTrainees.find((t) => t.id === createTraineeId || t.employeeId === createTraineeId);
    if (!emp) {
      toast.error('Please select an active student intern.');
      return;
    }
    if (!createQAnswers.q1_dutiesBriefly.trim()) {
      toast.error('Please input Question 1: Describe duties briefly.');
      return;
    }

    const questionnaire: MonitoringQuestionnaire = {
      employabilityStatus: createEmployability,
      allowanceSalary: createAllowance,
      telephoneNo: createTelephone,
      department: emp.department || 'COLLEGE OF COMPUTER STUDIES',
      position: 'ON - THE - JOB TRAINEE',
      otherDeptAssigned: 'None',
      ...createQAnswers,
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: createQAnswers.q2_strongestPerformanceArea,
      areasForImprovement: createQAnswers.q4_areasNeedImprovement,
      recommendation: 'Highly Recommended',
    };

    const rendered = getRenderedHoursForTrainee(emp.id, emp.employeeId);
    const required = emp.requiredHours || 600;
    const derivedReportType: MonitoringPeriodType =
      createFrequency === 'evaluation' ? createTerm : createFrequency;

    try {
      await addMonitoringReport({
        term: createTerm,
        frequency: createFrequency,
        reportType: derivedReportType,
        traineeId: emp.id,
        traineeName: emp.name,
        studentId: emp.employeeId || emp.id,
        course: emp.course || 'BS Information Technology',
        department: emp.department || 'College of Computer Studies',
        campus: emp.campus || 'Talisay (Main Campus)',
        academicYear: '2026-2027',
        hteCompanyName: emp.companyName || 'Host Training Establishment',
        hteAddress: emp.address || emp.residentialAddress || 'Official Assigned Workplace Station',
        supervisorName: emp.supervisorName || 'Department Mentor',
        supervisorContact: emp.contactPhone || emp.phone || '+63 917 555 4321',
        supervisorDesignation: 'OJT Mentor / Supervisor',
        instructorName,
        periodCovered: createPeriodCovered || `${createTerm === 'midterm' ? 'Mid-Term' : 'End-Term'} ${createFrequency.toUpperCase()} Period`,
        dateSubmitted: new Date().toISOString().split('T')[0],
        hoursRenderedThisPeriod: Number(createHoursThisPeriod) || 40,
        totalCumulativeHours: Math.round(rendered),
        requiredHours: required,
        remainingHours: Math.max(0, required - Math.round(rendered)),
        tasksAccomplished: createQAnswers.q1_dutiesBriefly,
        skillsApplied: createQAnswers.q3_areasImprovedMost,
        challengesEncountered: createQAnswers.q5_situationChallengedMost,
        questionnaire,
        status: createInstructorRemarks.trim() ? 'reviewed' : 'submitted',
        instructorRemarks: createInstructorRemarks,
        reviewedByInstructorAt: createInstructorRemarks.trim() ? new Date().toISOString() : undefined,
      });

      toast.success(`${createTerm === 'midterm' ? 'Mid-Term' : 'End-Term'} ${createFrequency.toUpperCase()} Report successfully logged!`);
      setShowCreateModal(false);
      setCreateTraineeId('');
      setCreateQAnswers({
        q1_dutiesBriefly: '',
        q2_strongestPerformanceArea: '',
        q3_areasImprovedMost: '',
        q4_areasNeedImprovement: '',
        q5_situationChallengedMost: '',
        q6_howOvercameChallenge: '',
        q7_whatLearnedFromExperience: '',
        q8_isQualifiedLinkage: '',
        q9_ojtSuggestionsRecommendations: '',
      });
      setCreateInstructorRemarks('');
    } catch {
      toast.error('Failed to create monitoring report.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-emerald-100 to-blue-100 rounded-full blur-2xl opacity-60 pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold mb-2">
            <ClipboardCheck size={14} className="text-emerald-700" />
            <span>CHMSU OJT Monitoring & Evaluation System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Monitoring Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Review and endorse student intern milestone reports across <strong>Weekly</strong>,{' '}
            <strong>Monthly</strong>, <strong>Mid-Term (300h)</strong>, and <strong>End-Term (600h)</strong>{' '}
            periods with the official 9-question CHMSU practicum feedback form.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#146B4D] to-[#152B4D] hover:opacity-95 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-700/20 transition-all cursor-pointer"
          >
            <Plus size={16} /> Log Monitoring Report
          </button>
        </div>
      </div>

      {/* METRIC STATS CARDS: OVERVIEW, MID-TERM, END-TERM, ACTION NEEDED */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Submissions */}
        <div
          onClick={() => {
            setActiveTab('all');
            setActiveSubFilter('all');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'all' && activeSubFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={activeTab === 'all' && activeSubFilter === 'all' ? 'text-slate-300 font-bold' : 'text-slate-500 font-semibold'}>
              Total Submissions
            </span>
            <ClipboardCheck size={14} className={activeTab === 'all' ? 'text-white' : 'text-slate-400'} />
          </div>
          <p className="text-2xl font-black">{metrics.total}</p>
          <p className={`text-[11px] mt-1 ${activeTab === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>
            Across all terms & students
          </p>
        </div>

        {/* Mid-Term (0-300h) Breakdown */}
        <div
          onClick={() => {
            setActiveTab('midterm');
            setActiveSubFilter('all');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'midterm'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={activeTab === 'midterm' ? 'text-blue-100 font-bold' : 'text-slate-500 font-semibold'}>
              Mid-Term (0–300h)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 text-blue-800">
              1st Half
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black">{metrics.midterm.all}</p>
            <span className={`text-[11px] ${activeTab === 'midterm' ? 'text-blue-100' : 'text-slate-400'}`}>reports</span>
          </div>
          <p className={`text-[11px] mt-1 flex items-center gap-1.5 font-medium ${activeTab === 'midterm' ? 'text-blue-100' : 'text-slate-500'}`}>
            <span>W: <strong>{metrics.midterm.weekly}</strong></span>
            <span>•</span>
            <span>M: <strong>{metrics.midterm.monthly}</strong></span>
            <span>•</span>
            <span>Eval: <strong>{metrics.midterm.evaluation}</strong></span>
          </p>
        </div>

        {/* End-Term (301-600h) Breakdown */}
        <div
          onClick={() => {
            setActiveTab('endterm');
            setActiveSubFilter('all');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'endterm'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={activeTab === 'endterm' ? 'text-emerald-100 font-bold' : 'text-slate-500 font-semibold'}>
              End-Term (301–600h)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
              2nd Half
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black">{metrics.endterm.all}</p>
            <span className={`text-[11px] ${activeTab === 'endterm' ? 'text-emerald-100' : 'text-slate-400'}`}>reports</span>
          </div>
          <p className={`text-[11px] mt-1 flex items-center gap-1.5 font-medium ${activeTab === 'endterm' ? 'text-emerald-100' : 'text-slate-500'}`}>
            <span>W: <strong>{metrics.endterm.weekly}</strong></span>
            <span>•</span>
            <span>M: <strong>{metrics.endterm.monthly}</strong></span>
            <span>•</span>
            <span>Eval: <strong>{metrics.endterm.evaluation}</strong></span>
          </p>
        </div>

        {/* Action Needed */}
        <div
          onClick={() => {
            setActiveTab('all');
            setFilterStatus('submitted');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'submitted'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={filterStatus === 'submitted' ? 'text-rose-100 font-bold' : 'text-rose-600 font-bold'}>
              Action Needed
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <p className="text-2xl font-black">{metrics.pendingCount}</p>
          <p className={`text-[11px] mt-1 ${filterStatus === 'submitted' ? 'text-rose-100' : 'text-slate-400'}`}>
            Pending your endorsement
          </p>
        </div>
      </div>

      {/* PERIOD TABS: PRIMARY TERM TABS & SECONDARY SUB-PILLS */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Row 1: Primary Term Selector + Trainee Matrix Button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setActiveSubFilter('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span>All Reports</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {metrics.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('midterm');
                setActiveSubFilter('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'midterm'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              <span>Mid-Term (0–300h)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'midterm' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'}`}>
                {metrics.midterm.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('endterm');
                setActiveSubFilter('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'endterm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              <span>End-Term (301–600h)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'endterm' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                {metrics.endterm.all}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'roster'
                ? 'bg-[#146B4D] text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            <Users size={14} /> Trainee Progress Matrix
          </button>
        </div>

        {/* Row 2: Secondary Sub-Pills (Weekly, Monthly, Evaluation) when not in Roster */}
        {activeTab !== 'roster' && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              {activeTab === 'midterm'
                ? 'Mid-Term Sub-Reports:'
                : activeTab === 'endterm'
                ? 'End-Term Sub-Reports:'
                : 'Filter Frequency:'}
            </span>

            {activeTab === 'midterm' ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeSubFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  All Mid-Term ({metrics.midterm.all})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('weekly')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'weekly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>Weekly Reports ({metrics.midterm.weekly})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('monthly')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'monthly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>Monthly Reports ({metrics.midterm.monthly})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('evaluation')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'evaluation'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>300h Mid-Term Evaluation ({metrics.midterm.evaluation})</span>
                </button>
              </>
            ) : activeTab === 'endterm' ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeSubFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  All End-Term ({metrics.endterm.all})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('weekly')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'weekly'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>Weekly Reports ({metrics.endterm.weekly})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('monthly')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'monthly'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>Monthly Reports ({metrics.endterm.monthly})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('evaluation')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'evaluation'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>600h End-Term Evaluation ({metrics.endterm.evaluation})</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeSubFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  All Submissions ({metrics.total})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('weekly')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'weekly'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>Weekly ({metrics.totalWeekly})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('monthly')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'monthly'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>Monthly ({metrics.totalMonthly})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubFilter('evaluation')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubFilter === 'evaluation'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>Evaluations ({metrics.totalEvaluation})</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ROSTER PROGRESS MATRIX OR REPORTS LIST */}
      {activeTab === 'roster' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Trainee Milestone Completion Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of all student interns across Mid-Term (Weekly, Monthly, 300h) and End-Term (Weekly, Monthly, 600h).
              </p>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Total Enrolled Interns: <strong className="text-slate-800">{allTrainees.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Student Intern</th>
                  <th className="py-3.5 px-3">HTE Company</th>
                  <th className="py-3.5 px-3 text-center bg-blue-50/50 text-blue-900">Mid: Weekly</th>
                  <th className="py-3.5 px-3 text-center bg-blue-50/50 text-blue-900">Mid: Monthly</th>
                  <th className="py-3.5 px-3 text-center bg-blue-50/50 text-blue-900">Mid: Eval (300h)</th>
                  <th className="py-3.5 px-3 text-center bg-emerald-50/50 text-emerald-900">End: Weekly</th>
                  <th className="py-3.5 px-3 text-center bg-emerald-50/50 text-emerald-900">End: Monthly</th>
                  <th className="py-3.5 px-3 text-center bg-emerald-50/50 text-emerald-900">End: Eval (600h)</th>
                  <th className="py-3.5 px-4 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allTrainees.map((trainee) => {
                  const traineeReports = monitoringReports.filter(
                    (r) => r.traineeId === trainee.id || r.studentId === trainee.employeeId
                  );
                  const midWeekly = traineeReports.find((r) => getReportTerm(r) === 'midterm' && getReportFrequency(r) === 'weekly');
                  const midMonthly = traineeReports.find((r) => getReportTerm(r) === 'midterm' && getReportFrequency(r) === 'monthly');
                  const midEval = traineeReports.find((r) => getReportTerm(r) === 'midterm' && getReportFrequency(r) === 'evaluation');
                  const endWeekly = traineeReports.find((r) => getReportTerm(r) === 'endterm' && getReportFrequency(r) === 'weekly');
                  const endMonthly = traineeReports.find((r) => getReportTerm(r) === 'endterm' && getReportFrequency(r) === 'monthly');
                  const endEval = traineeReports.find((r) => getReportTerm(r) === 'endterm' && getReportFrequency(r) === 'evaluation');

                  const rendered = getRenderedHoursForTrainee(trainee.id, trainee.employeeId);
                  const required = trainee.requiredHours || 600;
                  const progressPct = Math.min(100, Math.round((rendered / required) * 100));

                  const renderStatusPill = (rep?: MonitoringReport) => {
                    if (!rep) {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                          Missing
                        </span>
                      );
                    }
                    if (rep.status === 'reviewed') {
                      return (
                        <button
                          type="button"
                          onClick={() => setViewDetailsReport(rep)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full cursor-pointer"
                        >
                          <CheckCircle2 size={11} className="text-emerald-600" /> Reviewed
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => openReviewModal(rep)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full cursor-pointer"
                      >
                        <Clock size={11} className="text-amber-600" /> Review
                      </button>
                    );
                  };

                  return (
                    <tr key={trainee.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={trainee.name}
                            avatarUrl={trainee.avatar}
                            size="sm"
                          />
                          <div>
                            <p className="font-bold text-slate-900">{trainee.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {trainee.employeeId || trainee.id} • {trainee.course || 'BSIT'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-700 truncate max-w-[160px]">
                          {trainee.companyName || 'Host Training Establishment'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {trainee.supervisorName || 'Supervisor Assigned'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center bg-blue-50/20">{renderStatusPill(midWeekly)}</td>
                      <td className="py-3 px-3 text-center bg-blue-50/20">{renderStatusPill(midMonthly)}</td>
                      <td className="py-3 px-3 text-center bg-blue-50/20">{renderStatusPill(midEval)}</td>
                      <td className="py-3 px-3 text-center bg-emerald-50/20">{renderStatusPill(endWeekly)}</td>
                      <td className="py-3 px-3 text-center bg-emerald-50/20">{renderStatusPill(endMonthly)}</td>
                      <td className="py-3 px-3 text-center bg-emerald-50/20">{renderStatusPill(endEval)}</td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-bold text-slate-900">
                          {Math.round(rendered)} / {required}h
                        </p>
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 mt-1 ml-auto overflow-hidden">
                          <div
                            className="bg-emerald-600 h-1.5 rounded-full"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* REPORTS LIST */
        <div className="space-y-4">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search trainee name, student ID, HTE company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                aria-label="Filter by review status"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden"
              >
                <option value="all">All Review Status</option>
                <option value="submitted">Pending Review (Action Needed)</option>
                <option value="reviewed">Reviewed & Endorsed</option>
              </select>

              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                aria-label="Filter by degree course"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden max-w-[180px]"
              >
                <option value="all">All Degree Courses</option>
                {availableCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filterTrainee}
                onChange={(e) => setFilterTrainee(e.target.value)}
                aria-label="Filter by Trainee Account"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden max-w-[210px]"
              >
                <option value="all">All Trainee Accounts ({allTrainees.length})</option>
                {allTrainees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.employeeId || t.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* REPORTS GRID */}
          {filteredReports.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
              <ClipboardCheck size={48} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Monitoring Reports Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                No reports match your current period or filter criteria. Student submissions for Weekly, Monthly,
                Mid-Term, and End-Term will appear here for review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map((report) => {
                const conf = PERIOD_CONFIG[report.reportType] || PERIOD_CONFIG.weekly;
                const rTerm = getReportTerm(report);
                const rFreq = getReportFrequency(report);
                const q = report.questionnaire || {};

                const termBadgeClass =
                  rTerm === 'midterm'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                const freqBadgeClass =
                  rFreq === 'weekly'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : rFreq === 'monthly'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200';

                const freqLabel =
                  rFreq === 'weekly'
                    ? 'Weekly'
                    : rFreq === 'monthly'
                    ? 'Monthly'
                    : rTerm === 'midterm'
                    ? '300h Eval'
                    : '600h Eval';

                return (
                  <div
                    key={report.id}
                    className="bg-white rounded-3xl border border-slate-200 hover:border-slate-300 hover:shadow-lg shadow-xs transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div>
                      {/* Card Header with Dual Badges (Term & Frequency) */}
                      <div className="p-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={report.traineeName}
                            size="md"
                          />
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                              {report.traineeName}
                            </h3>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {report.studentId || report.traineeId}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${termBadgeClass}`}>
                            {rTerm === 'midterm' ? 'Mid-Term' : 'End-Term'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${freqBadgeClass}`}>
                            {freqLabel}
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 space-y-3 text-xs text-slate-600">
                        {/* HTE Details */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                            <Building size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{report.hteCompanyName}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 pl-4 truncate">
                            Supervisor: {report.supervisorName || 'Department Mentor'}
                          </p>
                        </div>

                        {/* Period & Hours */}
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Period Covered:</span>
                            <span className="font-bold text-slate-800 text-right truncate max-w-[160px]">
                              {report.periodCovered || (conf.label === 'Weekly' ? `Week of ${report.dateSubmitted || 'Active'}` : `${conf.label} Period`)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Hours Rendered:</span>
                            <span className="font-bold text-emerald-700">
                              +{report.hoursRenderedThisPeriod || (conf.label === 'Weekly' ? 40 : 160)}h (Total: {report.totalCumulativeHours || report.renderedHours || 0}h)
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Date Submitted:</span>
                            <span className="font-semibold text-slate-700">
                              {report.dateSubmitted || new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* CHMSU Questionnaire Highlight */}
                        <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 space-y-1.5">
                          <span className="font-bold text-emerald-950 text-[11px] block">
                            1. Duties Brief:
                          </span>
                          <p className="text-[11px] text-slate-700 line-clamp-2 italic">
                            &ldquo;{q.q1_dutiesBriefly || report.tasksAccomplished || report.tasksObserved || 'Assisted network engineers with structured cabling, termination, and connectivity testing.'}&rdquo;
                          </p>
                        </div>

                        {/* Status & Remarks */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Review Status:</span>
                          {report.status === 'reviewed' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={12} className="text-emerald-600" /> Reviewed & Endorsed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                              <Clock size={12} className="text-amber-700" /> Pending Review
                            </span>
                          )}
                        </div>

                        {report.instructorRemarks && (
                          <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 text-[11px] text-blue-900 italic">
                            &ldquo;{report.instructorRemarks}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="p-4 pt-0 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewDetailsReport(report)}
                          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="View Full CHMSU Form"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintReport(report)}
                          className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Print / Save Official PDF"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id, report.traineeName)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Report"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => openReviewModal(report)}
                        className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          report.status === 'reviewed'
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-gradient-to-r from-[#146B4D] to-[#152B4D] hover:opacity-95 text-white shadow-sm'
                        }`}
                      >
                        <Edit3 size={13} /> {report.status === 'reviewed' ? 'Edit Remarks' : 'Review & Endorse'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REVIEW & REMARKS MODAL */}
      <AnimatePresence>
        {reviewReport && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    <h3 className="font-black text-slate-900 text-base">
                      Review {PERIOD_CONFIG[reviewReport.reportType]?.label || 'Milestone'} Report
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trainee: <strong>{reviewReport.traineeName}</strong> ({reviewReport.studentId || reviewReport.traineeId}) — {reviewReport.hteCompanyName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewReport(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                {/* Summary Box */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Host Establishment</span>
                    <span className="font-bold text-slate-800">{reviewReport.hteCompanyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Period Covered</span>
                    <span className="font-bold text-slate-800">{reviewReport.periodCovered}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Hours This Period</span>
                    <span className="font-bold text-emerald-700">+{reviewReport.hoursRenderedThisPeriod || 0}h</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Employability</span>
                    <span className="font-bold text-slate-800">
                      {reviewReport.questionnaire?.employabilityStatus || 'OJT Trainee'}
                    </span>
                  </div>
                </div>

                {/* The 9 CHMSU Official Questions & Answers Table */}
                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs flex items-center gap-1.5">
                    <FileText size={14} className="text-emerald-700" />
                    QUESTIONNAIRE (STUDENT PRACTICUM FEEDBACK)
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {CHMSU_QUESTIONS.map((qItem) => {
                      const ans =
                        reviewReport.questionnaire?.[qItem.key] ||
                        (qItem.num === 1 ? reviewReport.tasksAccomplished : '') ||
                        'No response recorded';

                      return (
                        <div key={qItem.key} className="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <p className="font-bold text-slate-800 sm:col-span-1">{qItem.prompt}</p>
                          <p className="text-slate-700 italic leading-relaxed sm:col-span-2 whitespace-pre-line">
                            {ans}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Instructor Remarks Input */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-emerald-700" /> Instructor Remarks & Guidance
                    </label>
                    <span className="text-[10px] text-slate-400">Visible on student's portal & printout</span>
                  </div>

                  {/* Preset Quick Remarks */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setReviewRemarksInput(
                          'Satisfactory milestone completion. Well-documented tasks and good supervisory feedback.'
                        )
                      }
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + Satisfactory milestone
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReviewRemarksInput(
                          'Commendable performance observed this period. Continue maintaining excellent work ethic and prompt attendance.'
                        )
                      }
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + Commendable progress
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReviewRemarksInput(
                          'Exemplary practicum completion! All 600 hours successfully fulfilled with outstanding industry commendation.'
                        )
                      }
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + Final completion endorsement
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={reviewRemarksInput}
                    onChange={(e) => setReviewRemarksInput(e.target.value)}
                    placeholder="Enter official instructor feedback, commendations, or recommendations for this trainee..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-600 transition-all leading-relaxed"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setReviewReport(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#146B4D] to-[#152B4D] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 size={15} /> Save & Endorse Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW DETAILS MODAL */}
      <AnimatePresence>
        {viewDetailsReport && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                    getReportTerm(viewDetailsReport) === 'midterm'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}>
                    {getReportTerm(viewDetailsReport) === 'midterm' ? 'Mid-Term' : 'End-Term'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                    getReportFrequency(viewDetailsReport) === 'weekly'
                      ? 'bg-sky-100 text-sky-800 border-sky-200'
                      : getReportFrequency(viewDetailsReport) === 'monthly'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    {getReportFrequency(viewDetailsReport) === 'weekly'
                      ? 'Weekly'
                      : getReportFrequency(viewDetailsReport) === 'monthly'
                      ? 'Monthly'
                      : 'Evaluation'}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {viewDetailsReport.reportNumber} — {viewDetailsReport.periodCovered}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewDetailsReport(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Trainee</span>
                    <span className="font-bold text-slate-900">{viewDetailsReport.traineeName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Degree Course</span>
                    <span className="font-semibold text-slate-800">{viewDetailsReport.course}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Host Establishment</span>
                    <span className="font-semibold text-slate-800">{viewDetailsReport.hteCompanyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Hours Rendered</span>
                    <span className="font-bold text-emerald-700">+{viewDetailsReport.hoursRenderedThisPeriod || 0}h</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs">
                    Questionnaire (Student Practicum Feedback)
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {CHMSU_QUESTIONS.map((qItem) => {
                      const ans =
                        viewDetailsReport.questionnaire?.[qItem.key] ||
                        (qItem.num === 1 ? viewDetailsReport.tasksAccomplished : '') ||
                        'No response recorded';

                      return (
                        <div key={qItem.key} className="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <p className="font-bold text-slate-800 sm:col-span-1">{qItem.prompt}</p>
                          <p className="text-slate-700 italic leading-relaxed sm:col-span-2 whitespace-pre-line">
                            {ans}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {viewDetailsReport.instructorRemarks && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
                    <span className="font-bold text-emerald-950 flex items-center gap-1">
                      <Sparkles size={13} className="text-emerald-700" /> Instructor Remarks:
                    </span>
                    <p className="text-emerald-900 italic leading-relaxed">
                      &ldquo;{viewDetailsReport.instructorRemarks}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const r = viewDetailsReport;
                    setViewDetailsReport(null);
                    setPrintReport(r);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} /> Print CHMSU Form
                </button>
                <button
                  type="button"
                  onClick={() => setViewDetailsReport(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE / LOG MONITORING REPORT MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Log Official OJT Monitoring Report
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    CHMSU College of Computer Studies • On-The-Job Training Evaluation Form
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateReport} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                {/* Trainee Selection */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Select Student Intern *</label>
                  <select
                    required
                    value={createTraineeId}
                    onChange={(e) => handleSelectCreateTrainee(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                  >
                    <option value="">-- Choose Student Intern --</option>
                    {allTrainees.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.employeeId || t.id}) — {t.companyName || 'HTE'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Term & Frequency Selection: Nest Weekly & Monthly inside MidTerm / EndTerm */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="font-bold text-slate-800 uppercase text-[10px] tracking-wider block mb-1.5">
                      Step 1: Practicum Term Milestone
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleTermChange('midterm')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          createTerm === 'midterm'
                            ? 'bg-blue-50/80 border-blue-500 text-blue-950 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">Mid-Term</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-blue-100 text-blue-800">
                            0–300h
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">1st Practicum Half (Weeks 1–8)</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTermChange('endterm')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          createTerm === 'endterm'
                            ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">End-Term</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-emerald-100 text-emerald-800">
                            301–600h
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">2nd Practicum Half (Weeks 9–16)</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 uppercase text-[10px] tracking-wider block mb-1.5">
                      Step 2: Report Frequency Inside {createTerm === 'midterm' ? 'Mid-Term' : 'End-Term'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleFrequencyChange('weekly')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          createFrequency === 'weekly'
                            ? 'bg-sky-50 border-sky-500 text-sky-900 font-bold ring-2 ring-sky-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs">Weekly Report</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {createTerm === 'midterm' ? 'Weeks 1–8' : 'Weeks 9–16'} (40h)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFrequencyChange('monthly')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          createFrequency === 'monthly'
                            ? 'bg-purple-50 border-purple-500 text-purple-900 font-bold ring-2 ring-purple-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs">Monthly Report</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {createTerm === 'midterm' ? 'Months 1–2' : 'Months 3–4'} (160h)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFrequencyChange('evaluation')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          createFrequency === 'evaluation'
                            ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold ring-2 ring-amber-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs">
                          {createTerm === 'midterm' ? '300h Mid Eval' : '600h End Eval'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {createTerm === 'midterm' ? 'Midpoint Milestone' : 'Exit Completion'}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Period Covered & Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Period Covered Description *</label>
                    <input
                      type="text"
                      required
                      value={createPeriodCovered}
                      onChange={(e) => setCreatePeriodCovered(e.target.value)}
                      placeholder="e.g., Week 2 (Sept 8 - Sept 12) or Mid-Term 300h"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Hours Rendered This Period</label>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={createHoursThisPeriod}
                      onChange={(e) => setCreateHoursThisPeriod(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Employability & Assignment */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    EMPLOYABILITY:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['OJT Trainee', 'Contractual', 'Regular', 'Probationary', 'Casual', 'Applicant'] as const).map(
                      (status) => (
                        <label
                          key={status}
                          onClick={() => setCreateEmployability(status)}
                          className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-400 transition-colors"
                        >
                          {createEmployability === status ? (
                            <CheckSquare size={14} className="text-[#146B4D]" />
                          ) : (
                            <Square size={14} className="text-slate-300" />
                          )}
                          <span className="font-semibold text-slate-700 text-xs">{status}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                {/* 9 Questionnaire Questions */}
                <div className="space-y-3">
                  <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs">
                    QUESTIONNAIRE (STUDENT PRACTICUM FEEDBACK)
                  </h4>
                  {CHMSU_QUESTIONS.map((item) => (
                    <div key={item.key} className="space-y-1">
                      <label className="font-bold text-slate-700">
                        {item.prompt} {item.num === 1 && <span className="text-rose-500">*</span>}
                      </label>
                      <textarea
                        rows={2}
                        required={item.num === 1}
                        value={createQAnswers[item.key]}
                        onChange={(e) =>
                          setCreateQAnswers((prev) => ({
                            ...prev,
                            [item.key]: e.target.value,
                          }))
                        }
                        placeholder="Enter response..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  ))}
                </div>

                {/* Instructor Remarks */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Official Instructor Remarks & Guidance</label>
                  <textarea
                    rows={2}
                    value={createInstructorRemarks}
                    onChange={(e) => setCreateInstructorRemarks(e.target.value)}
                    placeholder="Enter assessment remarks and guidance for the student intern..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-[#146B4D] to-[#152B4D] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 cursor-pointer"
                  >
                    Submit & Save Report
                  </button>
                </div>
              </form>
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
