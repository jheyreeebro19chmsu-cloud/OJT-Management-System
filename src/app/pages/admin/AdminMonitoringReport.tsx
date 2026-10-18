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

const HOST_FEEDBACK_QUESTIONS = [
  {
    key: 'attendanceScore',
    label: 'Work Environment & Workplace Safety',
    description: 'Physical workplace conditions, safety measures, clean workstations, and accessibility.',
  },
  {
    key: 'performanceScore',
    label: 'Mentorship, Guidance & Supervision',
    description: 'Availability of designated supervisor, constructive feedback, and coaching support.',
  },
  {
    key: 'attitudeScore',
    label: 'Learning Opportunities & Skill Acquisition',
    description: 'Alignment with degree curriculum, exposure to real projects, and hands-on technical skills.',
  },
  {
    key: 'communicationScore',
    label: 'Workplace Culture & Professionalism',
    description: 'Welcoming atmosphere, ethical standards, team collaboration, and diversity.',
  },
  {
    key: 'teamworkScore',
    label: 'Resources, Tools & Equipment Support',
    description: 'Access to required hardware, software, office supplies, and relevant technical materials.',
  },
] as const;

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
  const [createTasks, setCreateTasks] = useState('');
  const [createSkills, setCreateSkills] = useState('');
  const [createChallenges, setCreateChallenges] = useState('');
  const [createRatings, setCreateRatings] = useState({
    attendanceScore: 5,
    performanceScore: 5,
    attitudeScore: 5,
    communicationScore: 5,
    teamworkScore: 5,
  });
  const [createStrengths, setCreateStrengths] = useState('');
  const [createImprovements, setCreateImprovements] = useState('');
  const [createRecommendation, setCreateRecommendation] = useState<
    'Highly Recommended' | 'Recommended' | 'For Improvement' | 'Not Recommended'
  >('Highly Recommended');
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
      // Period filter
      if (activeTab !== 'all' && activeTab !== 'roster') {
        if (r.reportType !== activeTab) return false;
      }

      // Status filter
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;

      // Course filter
      if (filterCourse !== 'all' && r.course !== filterCourse) return false;

      // Search query
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
    if (!createTasks.trim()) {
      toast.error('Please input tasks accomplished.');
      return;
    }

    const totalRatings =
      createRatings.attendanceScore +
      createRatings.performanceScore +
      createRatings.attitudeScore +
      createRatings.communicationScore +
      createRatings.teamworkScore;
    const overallScore = Math.round((totalRatings / 25) * 100);

    const questionnaire: MonitoringQuestionnaire = {
      ...createRatings,
      overallScore,
      strengths: createStrengths,
      areasForImprovement: createImprovements,
      recommendation: createRecommendation,
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
        tasksAccomplished: createTasks,
        skillsApplied: createSkills,
        challengesEncountered: createChallenges,
        questionnaire,
        status: createInstructorRemarks.trim() ? 'reviewed' : 'submitted',
        instructorRemarks: createInstructorRemarks,
        reviewedByInstructorAt: createInstructorRemarks.trim() ? new Date().toISOString() : undefined,
      });

      toast.success(`${PERIOD_CONFIG[createReportType].label} Monitoring Report successfully logged!`);
      setShowCreateModal(false);
      // Reset form
      setCreateTraineeId('');
      setCreateTasks('');
      setCreateSkills('');
      setCreateChallenges('');
      setCreateStrengths('');
      setCreateImprovements('');
      setCreateInstructorRemarks('');
    } catch {
      toast.error('Failed to create monitoring report.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full blur-2xl opacity-60 pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-800 text-xs font-semibold mb-2">
            <ClipboardCheck size={14} className="text-blue-600" />
            <span>OJT Monitoring & Milestone Assessment System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Monitoring Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Monitor, assess, and endorse student practicum reports across <strong>Weekly</strong>,{' '}
            <strong>Monthly</strong>, <strong>Mid-Term</strong>, and <strong>End-Term</strong> milestones,
            featuring complete Host Feedback questionnaires.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-700/20 transition-all cursor-pointer"
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
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users size={14} /> Trainee Progress Matrix
        </button>
      </div>

      {/* TAB CONTENT: ROSTER PROGRESS MATRIX OR REPORTS LIST */}
      {activeTab === 'roster' ? (
        /* ROSTER MATRIX: SHOWS EVERY TRAINEE AND THEIR 4 PERIOD STATUSES */
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

                  const renderStatusPill = (rep?: MonitoringReport, typeLabel = '') => {
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
                      <td className="py-3.5 px-3 text-center">{renderStatusPill(weeklyRep, 'Weekly')}</td>
                      <td className="py-3.5 px-3 text-center">{renderStatusPill(monthlyRep, 'Monthly')}</td>
                      <td className="py-3.5 px-3 text-center">{renderStatusPill(midtermRep, 'Mid-Term')}</td>
                      <td className="py-3.5 px-3 text-center">{renderStatusPill(endtermRep, 'End-Term')}</td>
                      <td className="py-3.5 px-4 text-right">
                        <p className="font-bold text-slate-900">
                          {Math.round(rendered)} / {required}h
                        </p>
                        <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-1 ml-auto overflow-hidden">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
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
        /* REPORTS LIST VIEW */
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
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-blue-500 transition-all"
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
              {/* Status filter */}
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

              {/* Course filter */}
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
                const q = report.questionnaire || {
                  attendanceScore: 5,
                  performanceScore: 5,
                  attitudeScore: 5,
                  communicationScore: 5,
                  teamworkScore: 5,
                  overallScore: 100,
                  strengths: '',
                  areasForImprovement: '',
                  recommendation: 'Highly Recommended' as const,
                };

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
                            <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
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
                      <div className="p-5 space-y-3.5 text-xs text-slate-600">
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
                            <span className="font-bold text-blue-700">
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

                        {/* Host Feedback Questionnaire Preview */}
                        <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-950 text-[11px] flex items-center gap-1">
                              <Star size={13} className="text-amber-500 fill-amber-500" /> Host Feedback
                            </span>
                            <span className="font-black text-xs text-amber-900">
                              {q.overallScore}% Rating
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1 text-center">
                            <div className="bg-white/80 p-1 rounded-lg border border-amber-100">
                              <p className="text-[9px] text-slate-400">Safety</p>
                              <p className="font-black text-slate-800 text-xs">{q.attendanceScore}★</p>
                            </div>
                            <div className="bg-white/80 p-1 rounded-lg border border-amber-100">
                              <p className="text-[9px] text-slate-400">Mentor</p>
                              <p className="font-black text-slate-800 text-xs">{q.performanceScore}★</p>
                            </div>
                            <div className="bg-white/80 p-1 rounded-lg border border-amber-100">
                              <p className="text-[9px] text-slate-400">Skills</p>
                              <p className="font-black text-slate-800 text-xs">{q.attitudeScore}★</p>
                            </div>
                            <div className="bg-white/80 p-1 rounded-lg border border-amber-100">
                              <p className="text-[9px] text-slate-400">Culture</p>
                              <p className="font-black text-slate-800 text-xs">{q.communicationScore}★</p>
                            </div>
                            <div className="bg-white/80 p-1 rounded-lg border border-amber-100">
                              <p className="text-[9px] text-slate-400">Tools</p>
                              <p className="font-black text-slate-800 text-xs">{q.teamworkScore}★</p>
                            </div>
                          </div>
                          {q.recommendation && (
                            <p className="text-[10px] text-amber-900 font-medium">
                              Recommendation: <strong className="font-bold">{q.recommendation}</strong>
                            </p>
                          )}
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
                          title="View Full Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintReport(report)}
                          className="p-2 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Print / Save PDF"
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
                            : 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white shadow-sm'
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
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                    <h3 className="font-black text-slate-900 text-base">
                      Review {PERIOD_CONFIG[reviewReport.reportType]?.label || 'Milestone'} Report
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trainee: <strong>{reviewReport.traineeName}</strong> ({reviewReport.studentId || reviewReport.traineeId})
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
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Host Establishment</span>
                    <span className="font-bold text-slate-800">{reviewReport.hteCompanyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Period Covered</span>
                    <span className="font-bold text-slate-800">{reviewReport.periodCovered}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[10px] uppercase block">Hours Rendered</span>
                    <span className="font-bold text-blue-700">+{reviewReport.hoursRenderedThisPeriod || 0} Hours</span>
                  </div>
                </div>

                {/* Trainee Tasks */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">Tasks Accomplished</span>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 leading-relaxed text-slate-800 whitespace-pre-line">
                    {reviewReport.tasksAccomplished}
                  </p>
                </div>

                {reviewReport.skillsApplied && (
                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">Skills & Tools Applied</span>
                    <p className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/60 leading-relaxed text-blue-950 whitespace-pre-line">
                      {reviewReport.skillsApplied}
                    </p>
                  </div>
                )}

                {/* Complete Host Feedback Questionnaire Display */}
                {reviewReport.questionnaire && (
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-950 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                        <Star size={14} className="text-amber-500 fill-amber-500" /> Host Feedback Questionnaire Ratings
                      </span>
                      <span className="font-black text-amber-900 text-sm">
                        Overall Score: {reviewReport.questionnaire.overallScore}%
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-white rounded-xl border border-amber-100 flex items-center justify-between">
                        <span className="text-slate-600">1. Work Environment & Safety:</span>
                        <span className="font-bold text-slate-900">{reviewReport.questionnaire.attendanceScore} / 5 ★</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-amber-100 flex items-center justify-between">
                        <span className="text-slate-600">2. Mentorship & Guidance:</span>
                        <span className="font-bold text-slate-900">{reviewReport.questionnaire.performanceScore} / 5 ★</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-amber-100 flex items-center justify-between">
                        <span className="text-slate-600">3. Learning & Skill Growth:</span>
                        <span className="font-bold text-slate-900">{reviewReport.questionnaire.attitudeScore} / 5 ★</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-amber-100 flex items-center justify-between">
                        <span className="text-slate-600">4. Workplace Culture:</span>
                        <span className="font-bold text-slate-900">{reviewReport.questionnaire.communicationScore} / 5 ★</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-amber-100 flex items-center justify-between sm:col-span-2">
                        <span className="text-slate-600">5. Resources & Equipment:</span>
                        <span className="font-bold text-slate-900">{reviewReport.questionnaire.teamworkScore} / 5 ★</span>
                      </div>
                    </div>

                    {reviewReport.questionnaire.strengths && (
                      <div>
                        <span className="font-semibold text-amber-950 block mb-1">HTE Strengths Commended:</span>
                        <p className="p-2.5 bg-white rounded-xl border border-amber-100 text-slate-800">
                          {reviewReport.questionnaire.strengths}
                        </p>
                      </div>
                    )}

                    {reviewReport.questionnaire.areasForImprovement && (
                      <div>
                        <span className="font-semibold text-amber-950 block mb-1">Areas for Improvement / Suggestions:</span>
                        <p className="p-2.5 bg-white rounded-xl border border-amber-100 text-slate-800">
                          {reviewReport.questionnaire.areasForImprovement}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Instructor Remarks Input */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-blue-600" /> Instructor Remarks & Guidance
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
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-blue-500 transition-all leading-relaxed"
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-700/20 transition-all cursor-pointer"
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
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${PERIOD_CONFIG[viewDetailsReport.reportType]?.badgeColor || 'bg-slate-900 text-white'}`}>
                    {PERIOD_CONFIG[viewDetailsReport.reportType]?.label} Report
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {viewDetailsReport.reportNumber}
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
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3">
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
                    <span className="font-bold text-blue-700">+{viewDetailsReport.hoursRenderedThisPeriod || 0} Hours</span>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px] block mb-1">Tasks Accomplished</span>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 whitespace-pre-line leading-relaxed">
                    {viewDetailsReport.tasksAccomplished}
                  </p>
                </div>

                {viewDetailsReport.skillsApplied && (
                  <div>
                    <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px] block mb-1">Skills Applied</span>
                    <p className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-blue-950 whitespace-pre-line leading-relaxed">
                      {viewDetailsReport.skillsApplied}
                    </p>
                  </div>
                )}

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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} /> Print Report
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
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Log Official OJT Monitoring Report
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a student intern and enter assessment details for one of the 4 milestone periods.
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

                {/* Tasks Accomplished */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Key Tasks Accomplished & Observed *</label>
                  <textarea
                    rows={3}
                    required
                    value={createTasks}
                    onChange={(e) => setCreateTasks(e.target.value)}
                    placeholder="Describe specific duties, technical projects, or workplace assignments completed..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                {/* Skills Applied */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Skills & Competencies Applied</label>
                  <input
                    type="text"
                    value={createSkills}
                    onChange={(e) => setCreateSkills(e.target.value)}
                    placeholder="e.g., Network cabling, Python API endpoints, UI design..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                {/* Host Feedback Questionnaire (5 Dimensions) */}
                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/70 space-y-4">
                  <div className="flex items-center gap-1.5">
                    <Star size={16} className="text-amber-500 fill-amber-500" />
                    <h4 className="font-bold text-amber-950 text-xs">
                      Host Feedback Questionnaire (Rating 1 - 5 Stars)
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {HOST_FEEDBACK_QUESTIONS.map((q) => (
                      <div
                        key={q.key}
                        className="bg-white p-3 rounded-xl border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{q.label}</p>
                          <p className="text-[11px] text-slate-500">{q.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setCreateRatings((prev) => ({
                                  ...prev,
                                  [q.key]: star,
                                }))
                              }
                              className={`p-1 text-base transition-transform hover:scale-110 cursor-pointer ${
                                star <= createRatings[q.key as keyof typeof createRatings]
                                  ? 'text-amber-500'
                                  : 'text-slate-300'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                          <span className="font-bold text-slate-700 ml-1.5 text-xs">
                            {createRatings[q.key as keyof typeof createRatings]} / 5
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Key Strengths of HTE</label>
                      <input
                        type="text"
                        value={createStrengths}
                        onChange={(e) => setCreateStrengths(e.target.value)}
                        placeholder="Notable positive aspects observed..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Areas for Improvement</label>
                      <input
                        type="text"
                        value={createImprovements}
                        onChange={(e) => setCreateImprovements(e.target.value)}
                        placeholder="Suggestions for training enhancement..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>
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
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-700/20 cursor-pointer"
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
