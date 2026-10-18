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
  MonitoringQuestionnaire,
  Employee,
  EmployabilityStatus,
} from '../../types';
import { MonitoringReportPrintView } from '../../components/MonitoringReportPrintView';
import { UserAvatar } from '../../components/UserAvatar';

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

  // Active tab filter: 'all' | 'weekly' | 'monthly' | 'midterm' | 'endterm' | 'roster'
  const [activeTab, setActiveTab] = useState<'all' | MonitoringPeriodType | 'roster'>('all');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'reviewed'>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');

  // Modal states
  const [reviewReport, setReviewReport] = useState<MonitoringReport | null>(null);
  const [reviewRemarksInput, setReviewRemarksInput] = useState('');
  const [printReport, setPrintReport] = useState<MonitoringReport | null>(null);
  const [viewDetailsReport, setViewDetailsReport] = useState<MonitoringReport | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Form State
  const [createTraineeId, setCreateTraineeId] = useState('');
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
    const weeklyCount = monitoringReports.filter((r) => r.reportType === 'weekly').length;
    const monthlyCount = monitoringReports.filter((r) => r.reportType === 'monthly').length;
    const midtermCount = monitoringReports.filter((r) => r.reportType === 'midterm').length;
    const endtermCount = monitoringReports.filter((r) => r.reportType === 'endterm').length;
    const pendingCount = monitoringReports.filter((r) => r.status === 'submitted').length;
    const reviewedCount = monitoringReports.filter((r) => r.status === 'reviewed').length;

    return {
      total: monitoringReports.length,
      weeklyCount,
      monthlyCount,
      midtermCount,
      endtermCount,
      pendingCount,
      reviewedCount,
    };
  }, [monitoringReports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return monitoringReports.filter((r) => {
      if (activeTab !== 'all' && activeTab !== 'roster') {
        if (r.reportType !== activeTab) return false;
      }
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterCourse !== 'all' && r.course !== filterCourse) return false;

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
  }, [monitoringReports, activeTab, filterStatus, filterCourse, searchQuery]);

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
      if (createReportType === 'weekly') setCreatePeriodCovered('Week 1 Progress Review');
      else if (createReportType === 'monthly') setCreatePeriodCovered('Month 1 Comprehensive Assessment');
      else if (createReportType === 'midterm') setCreatePeriodCovered('Mid-Term (300h Milestone Evaluation)');
      else if (createReportType === 'endterm') setCreatePeriodCovered('End-Term (600h Exit & Practicum Completion)');
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

    try {
      await addMonitoringReport({
        reportType: createReportType,
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
        periodCovered: createPeriodCovered || `${PERIOD_CONFIG[createReportType].label} Period`,
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

      toast.success(`${PERIOD_CONFIG[createReportType].label} Monitoring Report successfully logged!`);
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

      {/* METRIC STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Weekly */}
        <div
          onClick={() => setActiveTab('weekly')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'weekly'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={activeTab === 'weekly' ? 'text-blue-100 font-bold' : 'text-slate-500 font-semibold'}>
              Weekly Reports
            </span>
            <span className={`w-2 h-2 rounded-full ${activeTab === 'weekly' ? 'bg-white' : 'bg-blue-500'}`} />
          </div>
          <p className="text-2xl font-black">{metrics.weeklyCount}</p>
          <p className={`text-[11px] mt-1 ${activeTab === 'weekly' ? 'text-blue-100' : 'text-slate-400'}`}>
            Routine weekly progress
          </p>
        </div>

        {/* Monthly */}
        <div
          onClick={() => setActiveTab('monthly')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'monthly'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={activeTab === 'monthly' ? 'text-emerald-100 font-bold' : 'text-slate-500 font-semibold'}>
              Monthly Reports
            </span>
            <span className={`w-2 h-2 rounded-full ${activeTab === 'monthly' ? 'bg-white' : 'bg-emerald-500'}`} />
          </div>
          <p className="text-2xl font-black">{metrics.monthlyCount}</p>
          <p className={`text-[11px] mt-1 ${activeTab === 'monthly' ? 'text-emerald-100' : 'text-slate-400'}`}>
            Monthly assessments
          </p>
        </div>

        {/* Mid-Term */}
        <div
          onClick={() => setActiveTab('midterm')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'midterm'
              ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={activeTab === 'midterm' ? 'text-purple-100 font-bold' : 'text-slate-500 font-semibold'}>
              Mid-Term (300h)
            </span>
            <span className={`w-2 h-2 rounded-full ${activeTab === 'midterm' ? 'bg-white' : 'bg-purple-500'}`} />
          </div>
          <p className="text-2xl font-black">{metrics.midtermCount}</p>
          <p className={`text-[11px] mt-1 ${activeTab === 'midterm' ? 'text-purple-100' : 'text-slate-400'}`}>
            Midpoint evaluations
          </p>
        </div>

        {/* End-Term */}
        <div
          onClick={() => setActiveTab('endterm')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'endterm'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={activeTab === 'endterm' ? 'text-amber-100 font-bold' : 'text-slate-500 font-semibold'}>
              End-Term (600h)
            </span>
            <span className={`w-2 h-2 rounded-full ${activeTab === 'endterm' ? 'bg-white' : 'bg-amber-500'}`} />
          </div>
          <p className="text-2xl font-black">{metrics.endtermCount}</p>
          <p className={`text-[11px] mt-1 ${activeTab === 'endterm' ? 'text-amber-100' : 'text-slate-400'}`}>
            Final completion reports
          </p>
        </div>

        {/* Pending Review */}
        <div
          onClick={() => {
            setActiveTab('all');
            setFilterStatus('submitted');
          }}
          className={`p-4 rounded-2xl border col-span-2 lg:col-span-1 transition-all cursor-pointer ${
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
            Pending your review
          </p>
        </div>
      </div>

      {/* PERIOD TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setFilterStatus('all');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all' && filterStatus === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Periods ({metrics.total})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'weekly'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Weekly ({metrics.weeklyCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'monthly'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Monthly ({metrics.monthlyCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('midterm')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'midterm'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Mid-Term ({metrics.midtermCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('endterm')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'endterm'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          End-Term ({metrics.endtermCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto flex items-center gap-1.5 ${
            activeTab === 'roster'
              ? 'bg-[#146B4D] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users size={14} /> Trainee Progress Matrix
        </button>
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
                Overview of all student interns and their submission status across the 4 monitoring periods.
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
                  <th className="py-3.5 px-3 text-center">Weekly</th>
                  <th className="py-3.5 px-3 text-center">Monthly</th>
                  <th className="py-3.5 px-3 text-center">Mid-Term (300h)</th>
                  <th className="py-3.5 px-3 text-center">End-Term (600h)</th>
                  <th className="py-3.5 px-4 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allTrainees.map((trainee) => {
                  const traineeReports = monitoringReports.filter(
                    (r) => r.traineeId === trainee.id || r.studentId === trainee.employeeId
                  );
                  const weeklyRep = traineeReports.find((r) => r.reportType === 'weekly');
                  const monthlyRep = traineeReports.find((r) => r.reportType === 'monthly');
                  const midtermRep = traineeReports.find((r) => r.reportType === 'midterm');
                  const endtermRep = traineeReports.find((r) => r.reportType === 'endterm');

                  const rendered = getRenderedHoursForTrainee(trainee.id, trainee.employeeId);
                  const required = trainee.requiredHours || 600;
                  const progressPct = Math.min(100, Math.round((rendered / required) * 100));

                  const renderStatusPill = (rep?: MonitoringReport) => {
                    if (!rep) {
                      return (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                          Missing
                        </span>
                      );
                    }
                    if (rep.status === 'reviewed') {
                      return (
                        <button
                          type="button"
                          onClick={() => setViewDetailsReport(rep)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full cursor-pointer"
                        >
                          <CheckCircle2 size={12} className="text-emerald-600" /> Reviewed
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => openReviewModal(rep)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full cursor-pointer animate-pulse"
                      >
                        <Clock size={12} className="text-amber-600" /> Needs Review
                      </button>
                    );
                  };

                  return (
                    <tr key={trainee.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={trainee.name}
                            avatarUrl={trainee.avatar}
                            size="sm"
                          />
                          <div>
                            <p className="font-bold text-slate-900">{trainee.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {trainee.employeeId || trainee.id} • {trainee.course || 'BSIT'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-semibold text-slate-700 truncate max-w-[180px]">
                          {trainee.companyName || 'Host Training Establishment'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {trainee.supervisorName || 'Supervisor Assigned'}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 text-center">{renderStatusPill(weeklyRep)}</td>
                      <td className="py-3.5 px-3 text-center">{renderStatusPill(monthlyRep)}</td>
                      <td className="py-3.5 px-3 text-center">{renderStatusPill(midtermRep)}</td>
                      <td className="py-3.5 px-3 text-center">{renderStatusPill(endtermRep)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <p className="font-bold text-slate-900">
                          {Math.round(rendered)} / {required}h
                        </p>
                        <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-1 ml-auto overflow-hidden">
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
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden max-w-[200px]"
              >
                <option value="all">All Degree Courses</option>
                {availableCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
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
                const q = report.questionnaire || {};

                return (
                  <div
                    key={report.id}
                    className="bg-white rounded-3xl border border-slate-200 hover:border-slate-300 hover:shadow-lg shadow-xs transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div>
                      {/* Card Header with Badges */}
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

                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${conf.badgeColor}`}>
                          {conf.label}
                        </span>
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
                              {report.periodCovered}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Hours Rendered:</span>
                            <span className="font-bold text-emerald-700">
                              +{report.hoursRenderedThisPeriod || 0}h (Total: {report.totalCumulativeHours || report.renderedHours || 0}h)
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
                            &ldquo;{q.q1_dutiesBriefly || report.tasksAccomplished || 'Standard technical assignments.'}&rdquo;
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
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${PERIOD_CONFIG[viewDetailsReport.reportType]?.badgeColor || 'bg-slate-900 text-white'}`}>
                    {PERIOD_CONFIG[viewDetailsReport.reportType]?.label} Report
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Monitoring Period Milestone *</label>
                    <select
                      value={createReportType}
                      onChange={(e) => setCreateReportType(e.target.value as MonitoringPeriodType)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                    >
                      <option value="weekly">Weekly Progress Report (40h typical)</option>
                      <option value="monthly">Monthly Progress Assessment (160h typical)</option>
                      <option value="midterm">Mid-Term Evaluation (300h milestone)</option>
                      <option value="endterm">End-Term Completion Report (600h exit)</option>
                    </select>
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
