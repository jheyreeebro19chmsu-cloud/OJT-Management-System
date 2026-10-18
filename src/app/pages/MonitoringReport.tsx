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
  Send,
  HelpCircle,
  Lightbulb,
  CheckSquare,
  Square,
  X,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import {
  MonitoringReport as IMonitoringReport,
  MonitoringPeriodType,
  MonitoringQuestionnaire,
  EmployabilityStatus,
} from '../types';
import { MonitoringReportPrintView } from '../components/MonitoringReportPrintView';

const PERIOD_CONFIG: Record<
  MonitoringPeriodType,
  { label: string; title: string; desc: string; badgeClass: string; borderClass: string; bgClass: string; defaultHours: number }
> = {
  weekly: {
    label: 'Weekly',
    title: 'Weekly Monitoring Report',
    desc: 'Regular weekly tasks, competencies developed, and practicum reflection',
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

const CHMSU_QUESTIONNAIRE_QUESTIONS = [
  {
    key: 'q1_dutiesBriefly' as const,
    num: 1,
    prompt: '1. Describe your duties briefly:',
    placeholder: 'State primary tasks, technical duties, software systems handled, and daily operations...',
    suggestions: [
      'Assisted in web development, database maintenance, UI design, and technical troubleshooting.',
      'Managed IT support, hardware maintenance, network troubleshooting, and workstation configuration.',
      'Handled data entry, database verification, technical report preparation, and system documentation.',
      'Supported network setup, security checks, software installation, and workstation configuration.',
    ],
  },
  {
    key: 'q2_strongestPerformanceArea' as const,
    num: 2,
    prompt: '2. What do you consider your strongest area of performance?',
    placeholder: 'Identify key skills, strengths, work habits, or achievements...',
    suggestions: [
      'Fast learner with strong technical troubleshooting and programming capabilities.',
      'Reliable, punctual, and maintains high accuracy and attention to detail in every assigned task.',
      'Exceptional interpersonal skills, adaptability, and active collaboration with team members.',
      'Ability to remain calm under pressure and deliver quality work before sprint deadlines.',
    ],
  },
  {
    key: 'q3_areasImprovedMost' as const,
    num: 3,
    prompt: '3. In what areas do you feel you have improved the most?',
    placeholder: 'Highlight technical competencies, communication skills, or industry habits developed...',
    suggestions: [
      'Significantly improved real-world technical skills, debugging, and practical system development.',
      'Enhanced workplace communication, professional confidence, and collaboration with senior colleagues.',
      'Better time management, task prioritization, and ability to work with minimal supervision.',
      'Developed deep understanding of organizational workflows and corporate standard operating procedures.',
    ],
  },
  {
    key: 'q4_areasNeedImprovement' as const,
    num: 4,
    prompt: '4. In what areas do you feel need the most improvement?',
    placeholder: 'Areas for future growth, skill refinement, or further learning...',
    suggestions: [
      'Mastery of advanced enterprise frameworks and complex database optimization techniques.',
      'Speaking up more proactively in technical design discussions and stakeholder meetings.',
      'Handling very large multi-layered system architectures independently.',
      'Gaining further certifications in cybersecurity, cloud infrastructure, and project management.',
    ],
  },
  {
    key: 'q5_situationChallengedMost' as const,
    num: 5,
    prompt: '5. What situation challenged you the most?',
    placeholder: 'Describe complex technical bottlenecks, time constraints, or unexpected tasks...',
    suggestions: [
      'Meeting strict deadlines while diagnosing and fixing critical legacy database bugs.',
      'Learning and adopting a completely new backend framework within the first two weeks.',
      'Managing multiple concurrent assignments while maintaining high quality standards.',
      'Adapting to sudden changes in client specifications and urgent project requirements.',
    ],
  },
  {
    key: 'q6_howOvercameChallenge' as const,
    num: 6,
    prompt: '6. How did you overcome this challenge or situation?',
    placeholder: 'Steps taken, problem solving strategies, seeking mentorship...',
    suggestions: [
      'Consulted with senior team members and conducted thorough technical research.',
      'Broke down complex problem statements into structured, manageable sprints.',
      'Applied systematic debugging and documented findings to resolve bottlenecks.',
      'Practiced disciplined time management and prioritized critical system components.',
    ],
  },
  {
    key: 'q7_whatLearnedFromExperience' as const,
    num: 7,
    prompt: '7. What did you learn from your overall training experience?',
    placeholder: 'Key takeaways, technical mastery, professional development...',
    suggestions: [
      'Mastered practical full-stack deployment, debugging, and database management.',
      'Developed confidence in communicating technical concepts and corporate workflows.',
      'Learned the importance of clean code, automated testing, and team documentation.',
      'Gained deep appreciation for workplace ethics, agility, and client collaboration.',
    ],
  },
  {
    key: 'q8_isQualifiedLinkage' as const,
    num: 8,
    prompt: '8. Is this training establishment well-qualified for student OJT placement?',
    placeholder: 'Assessment of facilities, supervision quality, and learning environment...',
    suggestions: [
      'Yes, highly recommended for exceptional mentorship and real industry technology stack.',
      'Yes, provided excellent hands-on projects, supportive staff, and modern infrastructure.',
      'Yes, provided a safe, encouraging, and highly productive learning environment.',
      'Yes, recommended as a premier Host Training Establishment for CHMSU students.',
    ],
  },
  {
    key: 'q9_ojtSuggestionsRecommendations' as const,
    num: 9,
    prompt: '9. Other comments, suggestions, and recommendations:',
    placeholder: 'Any final remarks, gratitude to university/HTE, or concluding insights...',
    suggestions: [
      'Sincere gratitude to the management, supervisors, and colleagues for their warm guidance.',
      'Thankful to CHMSU CCS faculty for preparing us with strong foundational principles.',
      'Highly recommend this Host Training Establishment to future batches of CHMSU OJT students.',
      'Grateful for the opportunity to contribute meaningfully to production projects.',
    ],
  },
];

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

  // Employability & Assignment fields
  const [formEmployability, setFormEmployability] = useState<EmployabilityStatus | string>('OJT Trainee');
  const [formEmployedCompany, setFormEmployedCompany] = useState('-');
  const [formAllowanceSalary, setFormAllowanceSalary] = useState('None / Stipend');
  const [formTelephoneNo, setFormTelephoneNo] = useState('N/A');
  const [formDepartment, setFormDepartment] = useState('COLLEGE OF COMPUTER STUDIES');
  const [formPosition, setFormPosition] = useState('ON - THE - JOB TRAINEE');
  const [formOtherDept, setFormOtherDept] = useState('None');

  // The 9 CHMSU Questionnaire Questions
  const [qAnswers, setQAnswers] = useState({
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
    if (!currentEmp) return [];
    const empId = currentEmp.id;
    const empCode = currentEmp.employeeId;
    return monitoringReports.filter(
      (r) => r.traineeId === empId || (empCode && r.studentId === empCode)
    );
  }, [monitoringReports, currentEmp]);

  // Filtered by active tab and search
  const filteredReports = useMemo(() => {
    return myReports.filter((r) => {
      if (activePeriodTab !== 'all' && r.reportType !== activePeriodTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPeriod = (r.periodCovered || '').toLowerCase().includes(q);
        const matchTasks = (r.tasksAccomplished || '').toLowerCase().includes(q);
        const matchNumber = (r.reportNumber || '').toLowerCase().includes(q);
        const matchCompany = (r.hteCompanyName || '').toLowerCase().includes(q);
        if (!matchPeriod && !matchTasks && !matchNumber && !matchCompany) return false;
      }
      return true;
    });
  }, [myReports, activePeriodTab, searchQuery]);

  // Summary counts per period
  const periodCounts = useMemo(() => {
    return {
      all: myReports.length,
      weekly: myReports.filter((r) => r.reportType === 'weekly').length,
      monthly: myReports.filter((r) => r.reportType === 'monthly').length,
      midterm: myReports.filter((r) => r.reportType === 'midterm').length,
      endterm: myReports.filter((r) => r.reportType === 'endterm').length,
    };
  }, [myReports]);

  // Open Submit Modal for New Report
  const openNewSubmitModal = (type: MonitoringPeriodType = 'weekly') => {
    setEditingReport(null);
    setFormType(type);
    const cfg = PERIOD_CONFIG[type];
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

    setFormEmployability('OJT Trainee');
    setFormEmployedCompany('-');
    setFormAllowanceSalary('None / Stipend');
    setFormTelephoneNo('N/A');
    setFormDepartment(currentEmp?.department || 'COLLEGE OF COMPUTER STUDIES');
    setFormPosition('ON - THE - JOB TRAINEE');
    setFormOtherDept('None');

    setQAnswers({
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

    setShowSubmitModal(true);
  };

  // Open Edit Modal
  const openEditModal = (report: IMonitoringReport) => {
    setEditingReport(report);
    setFormType(report.reportType || 'weekly');
    setFormPeriodCovered(report.periodCovered || '');
    setFormHoursRendered(report.hoursRenderedThisPeriod || 40);

    const q = report.questionnaire || {};
    setFormEmployability(q.employabilityStatus || 'OJT Trainee');
    setFormEmployedCompany(q.employedCompanyName || '-');
    setFormAllowanceSalary(q.allowanceSalary || 'None / Stipend');
    setFormTelephoneNo(q.telephoneNo || 'N/A');
    setFormDepartment(q.department || currentEmp?.department || 'COLLEGE OF COMPUTER STUDIES');
    setFormPosition(q.position || 'ON - THE - JOB TRAINEE');
    setFormOtherDept(q.otherDeptAssigned || 'None');

    setQAnswers({
      q1_dutiesBriefly: q.q1_dutiesBriefly || report.tasksAccomplished || '',
      q2_strongestPerformanceArea: q.q2_strongestPerformanceArea || q.strengths || '',
      q3_areasImprovedMost: q.q3_areasImprovedMost || report.skillsApplied || '',
      q4_areasNeedImprovement: q.q4_areasNeedImprovement || q.areasForImprovement || '',
      q5_situationChallengedMost: q.q5_situationChallengedMost || report.challengesEncountered || '',
      q6_howOvercameChallenge: q.q6_howOvercameChallenge || '',
      q7_whatLearnedFromExperience: q.q7_whatLearnedFromExperience || '',
      q8_isQualifiedLinkage: q.q8_isQualifiedLinkage || '',
      q9_ojtSuggestionsRecommendations: q.q9_ojtSuggestionsRecommendations || '',
    });

    setShowSubmitModal(true);
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPeriodCovered.trim()) {
      toast.error('Please specify the period covered.');
      return;
    }
    if (!qAnswers.q1_dutiesBriefly.trim()) {
      toast.error('Please fill in Question 1: Describe your duties briefly.');
      return;
    }

    const questionnaire: MonitoringQuestionnaire = {
      employabilityStatus: formEmployability,
      employedCompanyName: formEmployedCompany,
      allowanceSalary: formAllowanceSalary,
      telephoneNo: formTelephoneNo,
      department: formDepartment,
      position: formPosition,
      otherDeptAssigned: formOtherDept,
      ...qAnswers,
      attendanceScore: 5,
      performanceScore: 5,
      attitudeScore: 5,
      communicationScore: 5,
      teamworkScore: 5,
      overallScore: 100,
      strengths: qAnswers.q2_strongestPerformanceArea,
      areasForImprovement: qAnswers.q4_areasNeedImprovement,
      recommendation: 'Highly Recommended',
    };

    try {
      if (editingReport) {
        await updateMonitoringReport(editingReport.id, {
          reportType: formType,
          periodCovered: formPeriodCovered,
          hoursRenderedThisPeriod: Number(formHoursRendered),
          tasksAccomplished: qAnswers.q1_dutiesBriefly,
          skillsApplied: qAnswers.q3_areasImprovedMost,
          challengesEncountered: qAnswers.q5_situationChallengedMost,
          questionnaire,
        });
        toast.success(`${PERIOD_CONFIG[formType].label} Monitoring Report updated!`);
      } else {
        await addMonitoringReport({
          reportType: formType,
          traineeId: currentEmp?.id || currentUser?.id || 'trainee-current',
          traineeName: currentEmp?.name || currentUser?.name || 'OJT Student Trainee',
          studentId: currentEmp?.employeeId || currentEmp?.id || '2023-XXXX',
          course: currentEmp?.course || 'Bachelor of Science in Information Technology',
          department: currentEmp?.department || 'College of Computer Studies',
          campus: currentEmp?.campus || 'Talisay (Main Campus)',
          academicYear: '2026-2027',
          hteCompanyName: currentEmp?.companyName || 'Host Training Establishment',
          hteAddress: currentEmp?.residentialAddress || currentEmp?.address || 'Official Station',
          supervisorName: currentEmp?.supervisorName || 'Department Mentor',
          supervisorContact: currentEmp?.contactPhone || currentEmp?.phone || 'N/A',
          supervisorDesignation: 'OJT Mentor / Supervisor',
          instructorName: 'Prof. Ma. Cristina Ramos, MIT',
          periodCovered: formPeriodCovered,
          dateSubmitted: new Date().toISOString().split('T')[0],
          hoursRenderedThisPeriod: Number(formHoursRendered),
          totalCumulativeHours: Math.round(totalRenderedHours),
          requiredHours,
          remainingHours,
          tasksAccomplished: qAnswers.q1_dutiesBriefly,
          skillsApplied: qAnswers.q3_areasImprovedMost,
          challengesEncountered: qAnswers.q5_situationChallengedMost,
          questionnaire,
          status: 'submitted',
        });
        toast.success(`${PERIOD_CONFIG[formType].label} Monitoring Report submitted successfully!`);
      }
      setShowSubmitModal(false);
    } catch {
      toast.error('Failed to submit monitoring report. Please try again.');
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete this ${title}?`)) {
      try {
        await deleteMonitoringReport(id);
        toast.success('Monitoring report deleted.');
      } catch {
        toast.error('Failed to delete report.');
      }
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
            <span>OJT Milestone Monitoring System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Monitoring Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Track and submit your practicum reports across <strong>Weekly</strong>,{' '}
            <strong>Monthly</strong>, <strong>Mid-Term (300h)</strong>, and{' '}
            <strong>End-Term (600h)</strong> milestones with the complete CHMSU Questionnaire.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => openNewSubmitModal('weekly')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-700/20 transition-all cursor-pointer"
          >
            <Plus size={16} /> Submit Monitoring Report
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS & HOURS PROGRESS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Rendered Hours */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Cumulative Rendered</span>
            <Clock size={16} className="text-blue-600" />
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {Math.round(totalRenderedHours)}
            </span>
            <span className="text-xs text-slate-400 font-bold ml-1.5">/ {requiredHours} hrs</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Weekly & Monthly Submissions */}
        <div
          onClick={() => setActivePeriodTab('weekly')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Weekly Reports</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Weekly
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-blue-700 transition-colors">
              {periodCounts.weekly}
            </span>
            <span className="text-xs text-slate-400 font-medium ml-2">submitted</span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">Routine weekly tasks</p>
        </div>

        {/* Monthly Submissions */}
        <div
          onClick={() => setActivePeriodTab('monthly')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-purple-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Monthly Reports</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Monthly
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-purple-700 transition-colors">
              {periodCounts.monthly}
            </span>
            <span className="text-xs text-slate-400 font-medium ml-2">submitted</span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">Comprehensive monthly reviews</p>
        </div>

        {/* MidTerm & EndTerm Milestones */}
        <div
          onClick={() => setActivePeriodTab('midterm')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Milestone Reports</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              300h / 600h
            </span>
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-amber-700 transition-colors">
              {periodCounts.midterm + periodCounts.endterm}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              ({periodCounts.midterm} Mid / {periodCounts.endterm} End)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">Major milestone evaluations</p>
        </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {(['all', 'weekly', 'monthly', 'midterm', 'endterm'] as const).map((tab) => {
            const count = tab === 'all' ? periodCounts.all : periodCounts[tab];
            const isActive = activePeriodTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActivePeriodTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                <span>{tab === 'all' ? 'All Reports' : tab === 'midterm' ? 'MidTerm (300h)' : tab === 'endterm' ? 'EndTerm (600h)' : tab}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, period, or ref..."
            className="w-full pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* REPORTS LIST (CARDS) */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <ClipboardCheck size={28} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No Monitoring Reports Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {activePeriodTab === 'all'
              ? 'You have not submitted any monitoring reports yet. Click "Submit Monitoring Report" to create your first report.'
              : `No ${PERIOD_CONFIG[activePeriodTab as MonitoringPeriodType]?.label} monitoring reports match your filters.`}
          </p>
          <button
            type="button"
            onClick={() => openNewSubmitModal(activePeriodTab === 'all' ? 'weekly' : activePeriodTab)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Plus size={14} /> Create {activePeriodTab === 'all' ? 'Weekly' : PERIOD_CONFIG[activePeriodTab as MonitoringPeriodType]?.label} Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => {
            const periodCfg = PERIOD_CONFIG[report.reportType] || PERIOD_CONFIG.weekly;
            const q = report.questionnaire || {};
            const isReviewed = report.status === 'reviewed';

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative group"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${periodCfg.badgeClass}`}>
                          {periodCfg.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {report.reportNumber}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                        {report.periodCovered}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isReviewed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          Reviewed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={12} className="text-amber-600" />
                          Pending Review
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Period Stats Pill */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Hours Rendered: <strong className="text-slate-900 font-bold">+{report.hoursRenderedThisPeriod} hrs</strong>
                    </span>
                    <span>
                      Date: <strong className="text-slate-800">{report.dateSubmitted}</strong>
                    </span>
                  </div>

                  {/* Duties Snippet */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                      1. Duties Briefly
                    </span>
                    <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                      {q.q1_dutiesBriefly || report.tasksAccomplished || 'No duties recorded.'}
                    </p>
                  </div>

                  {/* Strongest Area Snippet */}
                  {q.q2_strongestPerformanceArea && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                        2. Strongest Area
                      </span>
                      <p className="text-xs text-slate-600 line-clamp-1 italic">
                        &ldquo;{q.q2_strongestPerformanceArea}&rdquo;
                      </p>
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
                      <Eye size={13} /> View Form
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

      {/* SUBMISSION / EDIT MODAL (WITH CHMSU 9-QUESTION QUESTIONNAIRE FORM) */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden my-3"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#146B4D] text-white flex items-center justify-center font-bold">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {editingReport ? 'Edit Monitoring Report' : 'Submit OJT Monitoring Report'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      CHMSU College of Computer Studies • On-The-Job Training Evaluation Form
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
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
                {/* 1. Report Period Type Selector (4 Types) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    1. Select Monitoring Report Period Milestone
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
                              ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
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

                {/* 2. Period Covered & Hours Rendered */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Period Label / Inclusive Dates <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formPeriodCovered}
                      onChange={(e) => setFormPeriodCovered(e.target.value)}
                      placeholder="e.g., Week 3 (Oct 5 - Oct 9, 2026), Month 1, etc."
                      required
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 text-slate-800"
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
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 text-slate-800"
                    />
                  </div>
                </div>

                {/* 3. EMPLOYABILITY BLOCK (From CHMSU Form) */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    EMPLOYABILITY:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['OJT Trainee', 'Contractual', 'Regular', 'Probationary', 'Casual', 'Applicant'] as const).map(
                      (status) => (
                        <label
                          key={status}
                          onClick={() => setFormEmployability(status)}
                          className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-400 transition-colors"
                        >
                          {formEmployability === status ? (
                            <CheckSquare size={14} className="text-[#146B4D]" />
                          ) : (
                            <Square size={14} className="text-slate-300" />
                          )}
                          <span className="font-semibold text-slate-700 text-xs">{status}</span>
                        </label>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-0.5">Allowance / Salary:</label>
                      <input
                        type="text"
                        value={formAllowanceSalary}
                        onChange={(e) => setFormAllowanceSalary(e.target.value)}
                        placeholder="Php None / Stipend"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-0.5">Telephone No:</label>
                      <input
                        type="text"
                        value={formTelephoneNo}
                        onChange={(e) => setFormTelephoneNo(e.target.value)}
                        placeholder="N/A or contact number"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. ASSIGNMENT BLOCK (From CHMSU Form) */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    ASSIGNMENT:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-0.5">Department:</label>
                      <input
                        type="text"
                        value={formDepartment}
                        onChange={(e) => setFormDepartment(e.target.value)}
                        placeholder="COLLEGE OF COMPUTER STUDIES"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-0.5">Position:</label>
                      <input
                        type="text"
                        value={formPosition}
                        onChange={(e) => setFormPosition(e.target.value)}
                        placeholder="ON - THE - JOB TRAINEE"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-0.5">Other Dept Assigned:</label>
                      <input
                        type="text"
                        value={formOtherDept}
                        onChange={(e) => setFormOtherDept(e.target.value)}
                        placeholder="None"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. QUESTIONNAIRE (STUDENT PRACTICUM FEEDBACK) - 9 OFFICIAL QUESTIONS */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#146B4D]" />
                        QUESTIONNAIRE (STUDENT PRACTICUM FEEDBACK)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Answer each of the 9 official CHMSU evaluation prompts below. Click suggestion chips to populate helpful answers.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {CHMSU_QUESTIONNAIRE_QUESTIONS.map((item) => (
                      <div
                        key={item.key}
                        className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 space-y-2 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-900 text-xs">
                            {item.prompt} {item.num === 1 && <span className="text-rose-500">*</span>}
                          </label>
                        </div>

                        <textarea
                          rows={2}
                          required={item.num === 1}
                          value={qAnswers[item.key]}
                          onChange={(e) =>
                            setQAnswers((prev) => ({
                              ...prev,
                              [item.key]: e.target.value,
                            }))
                          }
                          placeholder={item.placeholder}
                          className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 text-slate-800 leading-relaxed"
                        />

                        {/* Quick Suggestions Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Lightbulb size={11} className="text-amber-500" /> Suggestions:
                          </span>
                          {item.suggestions.slice(0, 2).map((sugg, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                setQAnswers((prev) => ({
                                  ...prev,
                                  [item.key]: sugg,
                                }))
                              }
                              className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 rounded-md text-[10px] text-slate-600 transition-colors text-left cursor-pointer truncate max-w-[280px]"
                            >
                              {sugg}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
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
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#146B4D] hover:bg-[#10563e] shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
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
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-3"
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
                {/* Trainee & Company Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 font-medium">Trainee Name:</span>
                    <p className="font-bold text-slate-900">{viewingReport.traineeName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Training Company:</span>
                    <p className="font-bold text-slate-900">{viewingReport.hteCompanyName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Period / Hours:</span>
                    <p className="font-bold text-blue-700">+{viewingReport.hoursRenderedThisPeriod}h</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Review Status:</span>
                    <p className="font-bold text-slate-900 capitalize">{viewingReport.status}</p>
                  </div>
                </div>

                {/* Employability & Assignment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Employability Status</span>
                    <span className="font-semibold text-slate-800">
                      {viewingReport.questionnaire?.employabilityStatus || 'OJT Trainee'}
                    </span>
                    <span className="text-slate-400 text-[11px] block mt-1">
                      Allowance: {viewingReport.questionnaire?.allowanceSalary || 'None / Stipend'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Assignment</span>
                    <span className="font-semibold text-slate-800">
                      {viewingReport.questionnaire?.department || 'COLLEGE OF COMPUTER STUDIES'}
                    </span>
                    <span className="text-slate-400 text-[11px] block mt-1">
                      Position: {viewingReport.questionnaire?.position || 'ON - THE - JOB TRAINEE'}
                    </span>
                  </div>
                </div>

                {/* 9 Questionnaire Responses Table */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <h4 className="font-black text-slate-900 text-xs uppercase tracking-wide">
                    Questionnaire (Student Practicum Feedback)
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {CHMSU_QUESTIONNAIRE_QUESTIONS.map((item) => {
                      const answer =
                        viewingReport.questionnaire?.[item.key] ||
                        (item.num === 1 ? viewingReport.tasksAccomplished : '') ||
                        'No response recorded';

                      return (
                        <div key={item.key} className="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <p className="font-bold text-slate-800 sm:col-span-1">{item.prompt}</p>
                          <p className="text-slate-700 italic leading-relaxed sm:col-span-2 whitespace-pre-line">
                            {answer}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} /> Print CHMSU Form
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
