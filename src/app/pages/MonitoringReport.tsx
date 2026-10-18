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
  MonitoringTermType,
  MonitoringFrequencyType,
  MonitoringQuestionnaire,
  EmployabilityStatus,
} from '../types';
import { MonitoringReportPrintView } from '../components/MonitoringReportPrintView';

export function getReportTerm(report: IMonitoringReport): MonitoringTermType {
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

export function getReportFrequency(report: IMonitoringReport): MonitoringFrequencyType {
  if (report.frequency) return report.frequency;
  if (report.reportType === 'midterm' || report.reportType === 'endterm') return 'evaluation';
  if (report.reportType === 'monthly' || (report.periodCovered || '').toLowerCase().includes('month')) return 'monthly';
  return 'weekly';
}

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
    title: 'Mid-Term Evaluation (300h)',
    desc: 'Mid-practicum progress review & intermediate milestone evaluation (300 Hours)',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    borderClass: 'border-indigo-500',
    bgClass: 'from-indigo-500/10 to-blue-500/10',
    defaultHours: 300,
  },
  endterm: {
    label: 'EndTerm',
    title: 'End-Term Evaluation (600h)',
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

  // Navigation tabs:
  // Top-level term: 'all' | 'midterm' | 'endterm'
  // Secondary sub-filter: 'all' | 'weekly' | 'monthly' | 'evaluation'
  const [activeTermTab, setActiveTermTab] = useState<'all' | 'midterm' | 'endterm'>('all');
  const [activeSubFilter, setActiveSubFilter] = useState<'all' | 'weekly' | 'monthly' | 'evaluation'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [editingReport, setEditingReport] = useState<IMonitoringReport | null>(null);
  const [viewingReport, setViewingReport] = useState<IMonitoringReport | null>(null);
  const [printReport, setPrintReport] = useState<IMonitoringReport | null>(null);

  // Form states
  const [formTerm, setFormTerm] = useState<MonitoringTermType>('midterm');
  const [formFrequency, setFormFrequency] = useState<MonitoringFrequencyType>('weekly');
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

  // Trainee's reports: ensures any active trainee account has both Mid-Term and End-Term reports
  const myReports = useMemo(() => {
    if (!currentEmp) return [];
    const empId = currentEmp.id;
    const empCode = currentEmp.employeeId;
    const directMatches = monitoringReports.filter(
      (r) => r.traineeId === empId || (empCode && (r.studentId === empCode || r.traineeId === empCode))
    );
    if (directMatches.length > 0) return directMatches;

    // Fallback for demo or newly created trainees without reports yet:
    // map default demo templates to current trainee's profile so they immediately see Mid-Term (Weekly, Monthly) and End-Term (Weekly, Monthly)
    return monitoringReports
      .filter((r) => r.traineeId === '2089636c-7a7f-4943-ac23-23fd70afd4fd' || r.studentId === '20231331' || r.traineeId === '20231379' || r.studentId === '20231379')
      .map((r) => ({
        ...r,
        traineeId: empId,
        studentId: empCode || empId,
        traineeName: currentEmp.name || r.traineeName,
        course: currentEmp.course || r.course,
        department: currentEmp.department || r.department,
        campus: currentEmp.campus || r.campus,
        hteCompanyName: currentEmp.companyName || r.hteCompanyName,
        hteAddress: currentEmp.address || currentEmp.residentialAddress || r.hteAddress,
        supervisorName: currentEmp.supervisorName || r.supervisorName,
      }));
  }, [monitoringReports, currentEmp]);

  // Summary counts per term and nested frequency
  const termCounts = useMemo(() => {
    const midtermReports = myReports.filter((r) => getReportTerm(r) === 'midterm');
    const endtermReports = myReports.filter((r) => getReportTerm(r) === 'endterm');

    return {
      all: myReports.length,
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
      totalWeekly: myReports.filter((r) => getReportFrequency(r) === 'weekly').length,
      totalMonthly: myReports.filter((r) => getReportFrequency(r) === 'monthly').length,
      totalEvaluation: myReports.filter((r) => getReportFrequency(r) === 'evaluation').length,
      pendingCount: myReports.filter((r) => r.status === 'submitted').length,
      reviewedCount: myReports.filter((r) => r.status === 'reviewed').length,
    };
  }, [myReports]);

  // Filtered by active term, nested frequency sub-filter, and search
  const filteredReports = useMemo(() => {
    return myReports.filter((r) => {
      const term = getReportTerm(r);
      const freq = getReportFrequency(r);

      if (activeTermTab !== 'all' && term !== activeTermTab) {
        return false;
      }
      if (activeSubFilter !== 'all' && freq !== activeSubFilter) {
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
  }, [myReports, activeTermTab, activeSubFilter, searchQuery]);

  // Open Submit Modal for New Report
  const openNewSubmitModal = (
    initialTerm: MonitoringTermType = activeTermTab === 'endterm' ? 'endterm' : 'midterm',
    initialFreq: MonitoringFrequencyType = activeSubFilter !== 'all' ? activeSubFilter : 'weekly'
  ) => {
    setEditingReport(null);
    setFormTerm(initialTerm);
    setFormFrequency(initialFreq);
    const derivedType: MonitoringPeriodType =
      initialFreq === 'evaluation' ? initialTerm : initialFreq;
    setFormType(derivedType);

    const defaultHours =
      initialFreq === 'weekly' ? 40 : initialFreq === 'monthly' ? 160 : initialTerm === 'midterm' ? 300 : 600;
    setFormHoursRendered(defaultHours);

    const termPrefix = initialTerm === 'midterm' ? 'Mid-Term' : 'End-Term';
    const currentCount =
      initialFreq === 'weekly'
        ? termCounts[initialTerm].weekly + 1
        : initialFreq === 'monthly'
        ? termCounts[initialTerm].monthly + 1
        : 1;

    setFormPeriodCovered(
      initialFreq === 'weekly'
        ? `${termPrefix} Week ${initialTerm === 'endterm' ? currentCount + 8 : currentCount}`
        : initialFreq === 'monthly'
        ? `${termPrefix} Month ${initialTerm === 'endterm' ? currentCount + 2 : currentCount}`
        : initialTerm === 'midterm'
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
    const rTerm = getReportTerm(report);
    const rFreq = getReportFrequency(report);
    setFormTerm(rTerm);
    setFormFrequency(rFreq);
    setFormType(report.reportType || (rFreq === 'evaluation' ? rTerm : rFreq));
    setFormPeriodCovered(report.periodCovered || '');
    setFormHoursRendered(report.hoursRenderedThisPeriod || (rFreq === 'weekly' ? 40 : rFreq === 'monthly' ? 160 : 300));

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

    const derivedType: MonitoringPeriodType =
      formFrequency === 'evaluation' ? formTerm : formFrequency;

    try {
      if (editingReport) {
        await updateMonitoringReport(editingReport.id, {
          term: formTerm,
          frequency: formFrequency,
          reportType: derivedType,
          periodCovered: formPeriodCovered,
          hoursRenderedThisPeriod: Number(formHoursRendered),
          tasksAccomplished: qAnswers.q1_dutiesBriefly,
          skillsApplied: qAnswers.q3_areasImprovedMost,
          challengesEncountered: qAnswers.q5_situationChallengedMost,
          questionnaire,
        });
        toast.success(`${formTerm === 'midterm' ? 'Mid-Term' : 'End-Term'} ${formFrequency.toUpperCase()} Report updated!`);
      } else {
        await addMonitoringReport({
          term: formTerm,
          frequency: formFrequency,
          reportType: derivedType,
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
        toast.success(`${formTerm === 'midterm' ? 'Mid-Term' : 'End-Term'} ${formFrequency.toUpperCase()} Report submitted successfully!`);
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

  const renderReportCard = (report: IMonitoringReport) => {
    const periodCfg = PERIOD_CONFIG[report.reportType] || PERIOD_CONFIG.weekly;
    const rTerm = getReportTerm(report);
    const rFreq = getReportFrequency(report);
    const q = report.questionnaire || {};
    const isReviewed = report.status === 'reviewed';

    const termBadgeClass =
      rTerm === 'midterm'
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

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
        ? '300h Evaluation'
        : '600h Evaluation';

    return (
      <motion.div
        key={report.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative group"
      >
        <div className="space-y-3">
          {/* Card Header: Dual Badges (Term & Frequency) + Report Ref */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${termBadgeClass}`}>
                  {rTerm === 'midterm' ? 'Mid-Term' : 'End-Term'}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${freqBadgeClass}`}>
                  {freqLabel}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {report.reportNumber}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors pt-0.5">
                {report.periodCovered || (rFreq === 'weekly' ? `${rTerm === 'midterm' ? 'Mid-Term' : 'End-Term'} Weekly Report` : `${rTerm === 'midterm' ? 'Mid-Term' : 'End-Term'} ${freqLabel}`)}
              </h3>
            </div>

            {/* Status Badge */}
            <div className="shrink-0">
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
              Hours Rendered: <strong className="text-slate-900 font-bold">+{report.hoursRenderedThisPeriod || (rFreq === 'weekly' ? 40 : 160)} hrs</strong>
            </span>
            <span>
              Date: <strong className="text-slate-800">{report.dateSubmitted || new Date(report.createdAt).toLocaleDateString()}</strong>
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
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full blur-2xl opacity-60 pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-800 text-xs font-semibold mb-2">
            <ClipboardCheck size={14} className="text-blue-600" />
            <span>CHMSU Practicum Monitoring System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Monitoring Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Organized into <strong>Mid-Term (0–300h)</strong> and <strong>End-Term (301–600h)</strong> milestones, each containing your routine <strong>Weekly</strong> submissions, <strong>Monthly</strong> assessments, and milestone evaluations with the official CHMSU Questionnaire.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => openNewSubmitModal(activeTermTab === 'endterm' ? 'endterm' : 'midterm', 'weekly')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-700/20 transition-all cursor-pointer"
          >
            <Plus size={16} /> Submit Monitoring Report
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS: PROGRESS, MID-TERM BREAKDOWN, END-TERM BREAKDOWN, STATUS */}
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

        {/* Mid-Term Submissions (0-300 hrs) */}
        <div
          onClick={() => {
            setActiveTermTab('midterm');
            setActiveSubFilter('all');
          }}
          className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between transition-all cursor-pointer group ${
            activeTermTab === 'midterm'
              ? 'bg-blue-50/40 border-blue-500 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200/80 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Mid-Term (0–300h)</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              1st Half
            </span>
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-blue-700 transition-colors">
              {termCounts.midterm.all}
            </span>
            <span className="text-xs text-slate-400 font-medium">reports</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-blue-700">W: {termCounts.midterm.weekly}</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-purple-700">M: {termCounts.midterm.monthly}</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-indigo-700">Eval: {termCounts.midterm.evaluation}</span>
          </div>
        </div>

        {/* End-Term Submissions (301-600 hrs) */}
        <div
          onClick={() => {
            setActiveTermTab('endterm');
            setActiveSubFilter('all');
          }}
          className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between transition-all cursor-pointer group ${
            activeTermTab === 'endterm'
              ? 'bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200/80 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>End-Term (301–600h)</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              2nd Half
            </span>
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
              {termCounts.endterm.all}
            </span>
            <span className="text-xs text-slate-400 font-medium">reports</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-blue-700">W: {termCounts.endterm.weekly}</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-purple-700">M: {termCounts.endterm.monthly}</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-emerald-700">Eval: {termCounts.endterm.evaluation}</span>
          </div>
        </div>

        {/* Overall Submission Review Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Review Status</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {termCounts.all}
            </span>
            <span className="text-xs text-slate-400 font-medium">total submitted</span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 size={12} /> {termCounts.reviewedCount} Reviewed
            </span>
            <span className="text-amber-700 font-bold flex items-center gap-1">
              <Clock size={12} /> {termCounts.pendingCount} Pending
            </span>
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH: PRIMARY TERM TABS + SECONDARY FREQUENCY SUB-TABS */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Row 1: Primary Term Selector + Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Primary Term Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTermTab('all');
                setActiveSubFilter('all');
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTermTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>All Reports</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTermTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                }`}
              >
                {termCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTermTab('midterm');
                setActiveSubFilter('all');
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTermTab === 'midterm'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60'
              }`}
            >
              <span>Mid-Term (0 – 300h)</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTermTab === 'midterm' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {termCounts.midterm.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTermTab('endterm');
                setActiveSubFilter('all');
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTermTab === 'endterm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60'
              }`}
            >
              <span>End-Term (301 – 600h)</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTermTab === 'endterm' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {termCounts.endterm.all}
              </span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search duties, period, or ref..."
              className="w-full pl-8 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
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

        {/* Row 2: Secondary Sub-Pills (Weekly, Monthly, Evaluation within Selected Term) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            {activeTermTab === 'midterm'
              ? 'Mid-Term Sub-Reports:'
              : activeTermTab === 'endterm'
              ? 'End-Term Sub-Reports:'
              : 'Filter Frequency:'}
          </span>

          {activeTermTab === 'midterm' ? (
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
                All Mid-Term ({termCounts.midterm.all})
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
                <span>Weekly Reports</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {termCounts.midterm.weekly}
                </span>
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
                <span>Monthly Reports</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {termCounts.midterm.monthly}
                </span>
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
                <span>Mid-Term Evaluation (300h)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {termCounts.midterm.evaluation}
                </span>
              </button>
            </>
          ) : activeTermTab === 'endterm' ? (
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
                All End-Term ({termCounts.endterm.all})
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
                <span>Weekly Reports</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {termCounts.endterm.weekly}
                </span>
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
                <span>Monthly Reports</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {termCounts.endterm.monthly}
                </span>
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
                <span>End-Term Evaluation (600h)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20">
                  {termCounts.endterm.evaluation}
                </span>
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
                All Frequency Types ({termCounts.all})
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
                <span>Weekly ({termCounts.totalWeekly})</span>
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
                <span>Monthly ({termCounts.totalMonthly})</span>
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
                <span>Evaluations ({termCounts.totalEvaluation})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* REPORTS LIST (ORGANIZED BY TERM AND NESTED WEEKLY / MONTHLY) */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <ClipboardCheck size={28} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No Monitoring Reports Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {activeTermTab === 'all'
              ? 'You have not submitted any monitoring reports yet. Click "Submit Monitoring Report" to create your first report.'
              : `No ${activeTermTab === 'midterm' ? 'Mid-Term' : 'End-Term'} reports match the selected filters.`}
          </p>
          <button
            type="button"
            onClick={() => openNewSubmitModal(activeTermTab === 'endterm' ? 'endterm' : 'midterm', activeSubFilter !== 'all' ? activeSubFilter : 'weekly')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Plus size={14} /> Create {activeTermTab === 'endterm' ? 'End-Term' : 'Mid-Term'} Report
          </button>
        </div>
      ) : activeTermTab === 'all' && activeSubFilter === 'all' && !searchQuery.trim() ? (
        /* DUAL SECTION GROUPED VIEW: Mid-Term Section (Weekly & Monthly inside) and End-Term Section (Weekly & Monthly inside) */
        <div className="space-y-8">
          {/* Section 1: Mid-Term Practicum */}
          <div className="bg-gradient-to-b from-blue-50/50 to-transparent p-5 sm:p-6 rounded-3xl border border-blue-100/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  1
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                      Mid-Term Practicum
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      0 – 300 Hours
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    1st Practicum Half: Weekly Progress Reports (Weeks 1–8), Monthly Assessments (Months 1–2), and 300h Mid-Term Evaluation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openNewSubmitModal('midterm', 'weekly')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={13} /> Submit Mid-Term
                </button>
              </div>
            </div>

            {/* Mid-Term Reports Grid */}
            {filteredReports.filter((r) => getReportTerm(r) === 'midterm').length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-blue-200">
                No Mid-Term reports submitted yet. Click &quot;Submit Mid-Term&quot; to log your weekly or monthly progress.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.filter((r) => getReportTerm(r) === 'midterm').map((report) => renderReportCard(report))}
              </div>
            )}
          </div>

          {/* Section 2: End-Term Practicum */}
          <div className="bg-gradient-to-b from-emerald-50/50 to-transparent p-5 sm:p-6 rounded-3xl border border-emerald-100/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  2
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                      End-Term Practicum
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      301 – 600 Hours
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    2nd Practicum Half: Weekly Progress Reports (Weeks 9–16), Monthly Assessments (Months 3–4), and 600h Final Exit Evaluation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openNewSubmitModal('endterm', 'weekly')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={13} /> Submit End-Term
                </button>
              </div>
            </div>

            {/* End-Term Reports Grid */}
            {filteredReports.filter((r) => getReportTerm(r) === 'endterm').length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-emerald-200">
                No End-Term reports submitted yet. Click &quot;Submit End-Term&quot; to log your final practicum progress.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.filter((r) => getReportTerm(r) === 'endterm').map((report) => renderReportCard(report))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* FOCUSED TERM / FILTERED GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => renderReportCard(report))}
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
                {/* 1. Practicum Term Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    1. Select Practicum Term Milestone
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Mid-Term Option */}
                    <button
                      type="button"
                      onClick={() => {
                        const newTerm: MonitoringTermType = 'midterm';
                        setFormTerm(newTerm);
                        const derivedType: MonitoringPeriodType = formFrequency === 'evaluation' ? newTerm : formFrequency;
                        setFormType(derivedType);
                        if (!editingReport) {
                          const count = formFrequency === 'weekly' ? termCounts.midterm.weekly + 1 : formFrequency === 'monthly' ? termCounts.midterm.monthly + 1 : 1;
                          setFormPeriodCovered(
                            formFrequency === 'weekly'
                              ? `Mid-Term Week ${count}`
                              : formFrequency === 'monthly'
                              ? `Mid-Term Month ${count}`
                              : 'Mid-Term Evaluation (300 Hours Milestone)'
                          );
                          setFormHoursRendered(formFrequency === 'weekly' ? 40 : formFrequency === 'monthly' ? 160 : 300);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        formTerm === 'midterm'
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                            1st Half (0–300h)
                          </span>
                          <span className="text-[11px] font-bold text-blue-900">Mid-Term</span>
                        </div>
                        <p className="font-bold text-xs text-slate-900">Mid-Term Practicum</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Weekly tasks (Weeks 1–8), Monthly progress, and 300h milestone evaluation
                        </p>
                      </div>
                      <span className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center ${formTerm === 'midterm' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                        {formTerm === 'midterm' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </button>

                    {/* End-Term Option */}
                    <button
                      type="button"
                      onClick={() => {
                        const newTerm: MonitoringTermType = 'endterm';
                        setFormTerm(newTerm);
                        const derivedType: MonitoringPeriodType = formFrequency === 'evaluation' ? newTerm : formFrequency;
                        setFormType(derivedType);
                        if (!editingReport) {
                          const count = formFrequency === 'weekly' ? termCounts.endterm.weekly + 9 : formFrequency === 'monthly' ? termCounts.endterm.monthly + 3 : 1;
                          setFormPeriodCovered(
                            formFrequency === 'weekly'
                              ? `End-Term Week ${count}`
                              : formFrequency === 'monthly'
                              ? `End-Term Month ${count}`
                              : 'End-Term Final Completion (600 Hours Milestone)'
                          );
                          setFormHoursRendered(formFrequency === 'weekly' ? 40 : formFrequency === 'monthly' ? 160 : 600);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        formTerm === 'endterm'
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            2nd Half (301–600h)
                          </span>
                          <span className="text-[11px] font-bold text-emerald-900">End-Term</span>
                        </div>
                        <p className="font-bold text-xs text-slate-900">End-Term Practicum</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Weekly tasks (Weeks 9–16), Monthly progress, and 600h final completion
                        </p>
                      </div>
                      <span className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center ${formTerm === 'endterm' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                        {formTerm === 'endterm' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Frequency Selection inside Selected Term */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    2. Select Report Type inside {formTerm === 'midterm' ? 'Mid-Term' : 'End-Term'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Weekly Report */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormFrequency('weekly');
                        setFormType('weekly');
                        if (!editingReport) {
                          setFormHoursRendered(40);
                          const count = formTerm === 'midterm' ? termCounts.midterm.weekly + 1 : termCounts.endterm.weekly + 9;
                          setFormPeriodCovered(`${formTerm === 'midterm' ? 'Mid-Term' : 'End-Term'} Week ${count}`);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        formFrequency === 'weekly'
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border mb-1 bg-sky-50 text-sky-700 border-sky-200">
                        Weekly Report
                      </span>
                      <p className="font-bold text-xs text-slate-900 leading-tight">Weekly Monitoring</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Regular routine duties (default: 40 hrs)</p>
                    </button>

                    {/* Monthly Report */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormFrequency('monthly');
                        setFormType('monthly');
                        if (!editingReport) {
                          setFormHoursRendered(160);
                          const count = formTerm === 'midterm' ? termCounts.midterm.monthly + 1 : termCounts.endterm.monthly + 3;
                          setFormPeriodCovered(`${formTerm === 'midterm' ? 'Mid-Term' : 'End-Term'} Month ${count} Assessment`);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        formFrequency === 'monthly'
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border mb-1 bg-purple-50 text-purple-700 border-purple-200">
                        Monthly Report
                      </span>
                      <p className="font-bold text-xs text-slate-900 leading-tight">Monthly Assessment</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Monthly HTE review (default: 160 hrs)</p>
                    </button>

                    {/* Milestone Evaluation */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormFrequency('evaluation');
                        setFormType(formTerm);
                        if (!editingReport) {
                          setFormHoursRendered(formTerm === 'midterm' ? 300 : 600);
                          setFormPeriodCovered(
                            formTerm === 'midterm'
                              ? 'Mid-Term Evaluation (300 Hours Milestone)'
                              : 'End-Term Final Completion (600 Hours Milestone)'
                          );
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        formFrequency === 'evaluation'
                          ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border mb-1 bg-amber-50 text-amber-700 border-amber-200">
                        {formTerm === 'midterm' ? '300h Evaluation' : '600h Final Exit'}
                      </span>
                      <p className="font-bold text-xs text-slate-900 leading-tight">
                        {formTerm === 'midterm' ? 'Mid-Term Evaluation' : 'End-Term Completion'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Formal practicum milestone form</p>
                    </button>
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
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${
                    getReportTerm(viewingReport) === 'midterm' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}>
                    {getReportTerm(viewingReport) === 'midterm' ? 'Mid-Term' : 'End-Term'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider bg-slate-100 text-slate-800 border-slate-200">
                    {getReportFrequency(viewingReport) === 'weekly' ? 'Weekly' : getReportFrequency(viewingReport) === 'monthly' ? 'Monthly' : 'Evaluation'}
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
