import {
  Star,
  Users,
  X,
  Save,
  ChevronRight,
  Award,
  Clock,
  Check,
  Edit2,
  Trash2,
  AlertCircle,
  Printer,
  FileText,
  Building,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Download,
  Search,
  User,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { Employee, Evaluation } from '../types';
import { getPhotoUrl } from '../services/config';

const GRADE_CONFIG: Record<
  Evaluation['grade'],
  { color: string; bg: string; border: string; min: number; label: string }
> = {
  Excellent: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    min: 90,
    label: 'Excellent / Outstanding (90-100%)',
  },
  'Very Good': {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    min: 80,
    label: 'Very Good / Above Average (80-89%)',
  },
  Good: {
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    min: 70,
    label: 'Good / Average (70-79%)',
  },
  Satisfactory: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    min: 60,
    label: 'Satisfactory / Fair (60-69%)',
  },
  'Needs Improvement': {
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    min: 0,
    label: 'Needs Improvement / Poor (<60%)',
  },
};

function getGrade(score: number): Evaluation['grade'] {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Satisfactory';
  return 'Needs Improvement';
}

const EVALUATION_SECTIONS = [
  {
    id: 'sec1',
    title: 'Section I: Job Performance & Technical Skills',
    weight: '30%',
    key: 'performanceScore',
    subCriteria: [
      'Quality & Accuracy of Work Output',
      'Technical & Practical Skill Application',
      'Task Productivity & Completion Efficiency',
    ],
  },
  {
    id: 'sec2',
    title: 'Section II: Work Habits, Conduct & Punctuality',
    weight: '30%',
    key: 'attendanceScore',
    subCriteria: [
      'Regularity of Attendance & Punctuality',
      'Dependability & Responsibility towards assigned tasks',
      'Compliance with Company Rules, Safety & Ethics',
    ],
  },
  {
    id: 'sec3',
    title: 'Section III: Interpersonal & Communication Skills',
    weight: '20%',
    key: 'communicationScore',
    subCriteria: [
      'Teamwork & Cooperation with Co-workers/Supervisors',
      'Verbal & Written Communication Ability',
      'Professional Demeanor, Courtesy & Respect',
    ],
  },
  {
    id: 'sec4',
    title: 'Section IV: Time Management & Problem Solving',
    weight: '20%',
    key: 'punctualityScore',
    subCriteria: [
      'Time Management & Deadline Adherence',
      'Initiative, Resourcefulness & Self-Motivation',
      'Critical Thinking & Analytical Problem Solving',
    ],
  },
] as const;

type EvaluationForm = Pick<
  Evaluation,
  | 'attendanceScore'
  | 'performanceScore'
  | 'attitudeScore'
  | 'punctualityScore'
  | 'communicationScore'
  | 'strengths'
  | 'areasForImprovement'
  | 'recommendations'
  | 'status'
>;

const BLANK_FORM: EvaluationForm = {
  attendanceScore: 85,
  performanceScore: 85,
  attitudeScore: 85,
  punctualityScore: 85,
  communicationScore: 85,
  strengths: '',
  areasForImprovement: '',
  recommendations: '',
  status: 'draft' as Evaluation['status'],
};

export function HTEEvaluations() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    employees,
    timeRecords,
    evaluations,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    hostFeedback,
    addHostFeedback,
    currentUser,
    getCurrentEmployee,
    settings,
  } = useApp();

  const currentEmp = getCurrentEmployee();
  const queryParams = new URLSearchParams(location.search);
  const preselectedStudentId = queryParams.get('studentId');

  const hteCompany = currentEmp?.companyName || localStorage.getItem('ojt_hte_company') || '';
  const assignedTraineeIds = useMemo(() => {
    const ids = new Set<string>();
    try {
      const raw = localStorage.getItem('ojt_hte_student_access');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry: any) => {
            const studentId = entry?.student_id || entry?.studentId || entry?.student?.id;
            if (studentId) ids.add(String(studentId));
          });
        }
      }
    } catch {
      // ignore malformed local storage payloads
    }

    if (ids.size > 0) return ids;

    if (hteCompany) {
      employees
        .filter(
          (e) =>
            e.active &&
            e.position !== 'OJT Instructor' &&
            e.position !== 'HTE Representative' &&
            (e.companyName === hteCompany || e.companyName?.toLowerCase() === hteCompany.toLowerCase())
        )
        .forEach((e) => ids.add(e.id));
    }

    return ids;
  }, [employees, hteCompany]);

  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState<EvaluationForm>(BLANK_FORM);
  const [editEvalId, setEditEvalId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'view'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');

  const hteUser = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('ojt_hte_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const supervisorName =
    currentUser?.name ||
    currentEmp?.name ||
    hteUser?.name ||
    'HTE Supervisor';

  const companyName =
    currentEmp?.companyName ||
    hteUser?.companyName ||
    localStorage.getItem('ojt_hte_company') ||
    'Host Training Establishment';

  // Filter only active trainees (exclude instructors and non-trainees)
  const activeTrainees = useMemo(() => {
    return employees.filter((e) => {
      const isTrainee = e.active && e.position !== 'OJT Instructor' && e.position !== 'HTE Representative';
      if (!isTrainee) return false;
      if (assignedTraineeIds.size === 0) return true;
      return assignedTraineeIds.has(e.id);
    });
  }, [employees, assignedTraineeIds]);

  // Handle preselected student from URL
  React.useEffect(() => {
    if (preselectedStudentId && activeTrainees.length > 0) {
      const found = activeTrainees.find((t) => t.id === preselectedStudentId);
      if (found) {
        openNewEval(found);
      }
    }
  }, [preselectedStudentId, activeTrainees]);

  const openNewEval = (emp: Employee) => {
    const existing = evaluations.find((e) => e.employeeId === emp.id);
    setSelectedEmp(emp);
    if (existing) {
      setEditEvalId(existing.id);
      setForm({
        attendanceScore: existing.attendanceScore,
        performanceScore: existing.performanceScore,
        attitudeScore: existing.attitudeScore,
        punctualityScore: existing.punctualityScore,
        communicationScore: existing.communicationScore,
        strengths: existing.strengths,
        areasForImprovement: existing.areasForImprovement,
        recommendations: existing.recommendations,
        status: existing.status,
      });
    } else {
      // Auto-calculate attendance score from DTR
      const recs = timeRecords.filter((r) => r.employeeId === emp.id);
      const lateCount = recs.filter((r) => r.status === 'late').length;
      const totalDays = recs.length;
      const autoAttendance = totalDays > 0 ? Math.round(Math.max(0, 100 - (lateCount / totalDays) * 40)) : 85;
      const autoOnTime = totalDays > 0 ? Math.round(Math.max(0, 100 - (lateCount / totalDays) * 60)) : 85;
      setEditEvalId(null);
      setForm({ ...BLANK_FORM, attendanceScore: autoAttendance, punctualityScore: autoOnTime });
    }
    setViewMode('form');
  };

  const viewEval = (emp: Employee) => {
    setSelectedEmp(emp);
    setViewMode('view');
  };

  const handleSave = (status: Evaluation['status']) => {
    if (!selectedEmp) return;

    const scores = [
      form.attendanceScore,
      form.performanceScore,
      form.attitudeScore,
      form.punctualityScore,
      form.communicationScore,
    ];
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const grade = getGrade(overallScore);

    const data = {
      employeeId: selectedEmp.id,
      evaluatedBy: supervisorName,
      ...form,
      overallScore,
      grade,
      evaluatedAt: new Date().toISOString(),
      status,
    };

    if (editEvalId) {
      updateEvaluation(editEvalId, data);
      toast.success(`Evaluation ${status === 'final' ? 'finalized and synced' : 'saved as draft'}!`);
    } else {
      addEvaluation(data);
      toast.success(`Evaluation ${status === 'final' ? 'finalized and synced' : 'saved as draft'}!`);
    }

    // Also mirror to Host Feedback table for HTE cross-sync
    try {
      addHostFeedback({
        employeeId: selectedEmp.id,
        hostName: supervisorName,
        hostCompany: companyName,
        hostPosition: currentEmp?.position || hteUser?.position || 'Supervisor',
        attendanceScore: form.attendanceScore,
        performanceScore: form.performanceScore,
        attitudeScore: form.attitudeScore,
        communicationScore: form.communicationScore,
        teamworkScore: form.punctualityScore,
        strengths: form.strengths || 'Exemplary dedication and competence.',
        areasForImprovement: form.areasForImprovement || 'Continue active growth.',
        recommendation: overallScore >= 80 ? 'Recommended' : 'For Improvement',
      });
    } catch {}

    setViewMode('list');
  };

  const handleDelete = (evalId: string) => {
    if (confirm('Are you sure you want to delete this evaluation?')) {
      deleteEvaluation(evalId);
      toast.success('Evaluation deleted.');
    }
  };

  const getEmpStats = (empId: string) => {
    const recs = timeRecords.filter((r) => r.employeeId === empId);
    const totalHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
    const present = recs.filter((r) => r.status === 'present' || r.status === 'overtime').length;
    const late = recs.filter((r) => r.status === 'late').length;
    return { totalHours, present, late, totalDays: recs.length };
  };

  const upd = (key: string, val: number | string) => setForm((p) => ({ ...p, [key]: val }));

  const overallScore = Math.round(
    [
      form.attendanceScore,
      form.performanceScore,
      form.attitudeScore,
      form.punctualityScore,
      form.communicationScore,
    ].reduce((a, b) => a + b, 0) / 5
  );
  const grade = getGrade(overallScore);
  const gradeConfig = GRADE_CONFIG[grade];

  const courses = useMemo(() => {
    const set = new Set(activeTrainees.map((e) => e.course).filter(Boolean));
    return Array.from(set);
  }, [activeTrainees]);

  const filteredTrainees = useMemo(() => {
    return activeTrainees.filter((e) => {
      const matchSearch =
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.employeeId && e.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.course && e.course.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCourse = filterCourse === 'all' || e.course === filterCourse;
      return matchSearch && matchCourse;
    });
  }, [activeTrainees, searchTerm, filterCourse]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Official Evaluation Form Screen (Create / Edit)
  // ─────────────────────────────────────────────────────────────────────────────
  if (viewMode === 'form' && selectedEmp) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans">
        {/* Navigation & Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:text-slate-900 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all"
          >
            <X size={16} />
            Cancel & Return
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm"
              title="Print Evaluation Sheet"
            >
              <Printer size={15} />
              Print Sheet
            </button>
            <button
              onClick={() => {
                const ev = evaluations.find((e) => e.employeeId === selectedEmp.id);
                const csvData = [
                  ['Trainee Name', 'Employee ID', 'Establishment', 'Supervisor', 'Overall Score', 'Grade', 'Evaluated At', 'Status'],
                  [
                    selectedEmp.name,
                    selectedEmp.employeeId,
                    companyName,
                    supervisorName,
                    `${overallScore}%`,
                    grade,
                    new Date().toISOString(),
                    'final',
                  ],
                ];
                const csvContent = 'data:text/csv;charset=utf-8,' + csvData.map((e) => e.join(',')).join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `HTE_Evaluation_${selectedEmp.name.replace(/\s+/g, '_')}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('CSV exported successfully!');
              }}
              className="px-3.5 py-2 bg-emerald-600 text-white rounded-2xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Download size={15} />
              Export CSV
            </button>
            <button
              onClick={() => handleSave('draft')}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Save size={15} />
              Save Draft
            </button>
            <button
              onClick={() => handleSave('final')}
              className="px-5 py-2 bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30"
            >
              <Check size={16} />
              Finalize & Sync Evaluation
            </button>
          </div>
        </div>

        {/* Official Printable Evaluation Sheet */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Institutional Header */}
          <div className="bg-slate-900 text-white p-6 text-center border-b border-slate-800">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-16 bg-white rounded-full p-1 shadow-lg flex items-center justify-center shrink-0 mb-1">
                <img src="/CHMSU.JPEG" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold tracking-wide uppercase text-slate-100">
                  Carlos Hilado Memorial State University
                </h1>
                <p className="text-xs text-slate-300 font-medium tracking-wider uppercase">
                  Office of On-the-Job Training & Student Internship Program
                </p>
                <div className="mt-2 inline-block px-4 py-1 bg-blue-600/40 border border-blue-400/30 rounded-full text-xs font-bold tracking-widest text-sky-200 uppercase">
                  Host Training Establishment (HTE) Performance Evaluation
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Student & Host Establishment Particulars */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                <span>Trainee & Establishment Particulars</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Student Trainee:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedEmp.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Student ID / Employee ID:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedEmp.employeeId || selectedEmp.id.slice(0, 8)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">School & Program:</span>
                  <span className="font-semibold text-slate-700">{selectedEmp.schoolName || 'CHMSU'} ({selectedEmp.course || 'OJT Trainee'})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Campus & Department:</span>
                  <span className="font-medium text-slate-700">{selectedEmp.campus || 'Main Campus'} • {selectedEmp.department || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Host Establishment (HTE):</span>
                  <span className="font-extrabold text-blue-900">{companyName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Authorizing Supervisor:</span>
                  <span className="font-bold text-slate-800">{supervisorName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Required OJT Hours:</span>
                  <span className="font-bold text-slate-800">{selectedEmp.requiredHours || 486} Hours</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Academic Year:</span>
                  <span className="font-bold text-emerald-700">AY {settings?.activeAcademicYear || '2026-2027'}</span>
                </div>
              </div>
            </div>

            {/* Rating Scale Legend */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-2">
              <p className="font-bold uppercase tracking-wider text-[11px] text-blue-800">Standard Grading Rubric:</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-center font-medium">
                <span className="bg-emerald-100 text-emerald-800 p-1.5 rounded-xl font-bold">90-100%: Excellent</span>
                <span className="bg-blue-100 text-blue-800 p-1.5 rounded-xl font-bold">80-89%: Very Good</span>
                <span className="bg-sky-100 text-sky-800 p-1.5 rounded-xl font-bold">70-79%: Good</span>
                <span className="bg-amber-100 text-amber-800 p-1.5 rounded-xl font-bold">60-69%: Fair</span>
                <span className="bg-rose-100 text-rose-800 p-1.5 rounded-xl font-bold">&lt;60%: Unsatisfactory</span>
              </div>
            </div>

            {/* Performance Criteria Rating Matrix */}
            <div className="space-y-5">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>Evaluation Competency Criteria</span>
                <span className="text-xs text-slate-400 font-normal">Score Range: 0 to 100%</span>
              </h3>

              {EVALUATION_SECTIONS.map((sec) => {
                const currentScore = form[sec.key as keyof EvaluationForm] as number;
                return (
                  <div key={sec.id} className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-white hover:border-blue-300 transition-colors shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{sec.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Weight Component: {sec.weight}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400">Score:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={currentScore}
                          onChange={(e) => upd(sec.key, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-18 px-2.5 py-1.5 border border-slate-300 rounded-xl text-center font-extrabold text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                        />
                        <span className="font-bold text-slate-600">%</span>
                      </div>
                    </div>

                    <div className="pl-3 border-l-2 border-blue-400 space-y-1.5 text-xs text-slate-600">
                      {sec.subCriteria.map((sub, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0" />
                          <span>{sub}</span>
                        </div>
                      ))}
                    </div>

                    {/* Interactive Slider */}
                    <div className="pt-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={currentScore}
                        onChange={(e) => upd(sec.key, parseInt(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Final Overall Grade Summary Card */}
            <div className={`rounded-2xl p-6 border-2 ${gradeConfig.bg} ${gradeConfig.border} flex items-center justify-between shadow-sm`}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall Weighted Evaluation Score</p>
                <p className="text-4xl font-black text-slate-900 mt-1">{overallScore}%</p>
                <p className="text-xs text-slate-500 mt-1">Calculated across all evaluated competencies</p>
              </div>
              <div className="text-right">
                <div className="inline-block p-2.5 rounded-full bg-white shadow-sm mb-1">
                  <Award size={28} className={gradeConfig.color} />
                </div>
                <p className={`text-lg font-black ${gradeConfig.color}`}>{grade}</p>
                <p className="text-xs font-bold text-slate-600">{gradeConfig.label}</p>
              </div>
            </div>

            {/* Written Assessment & Remarks */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
                Qualitative Assessment & Recommendations
              </h3>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  1. Major Strengths & Notable Achievements *
                </label>
                <textarea
                  value={form.strengths}
                  onChange={(e) => upd('strengths', e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                  placeholder="Describe specific strengths, work accomplishments, technical skills, and commendable behavior demonstrated by the intern..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  2. Key Areas for Growth & Professional Improvement *
                </label>
                <textarea
                  value={form.areasForImprovement}
                  onChange={(e) => upd('areasForImprovement', e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                  placeholder="Identify skills, competencies, or professional habits the student intern should continue developing..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  3. Official Recommendation & Employment Readiness *
                </label>
                <textarea
                  value={form.recommendations}
                  onChange={(e) => upd('recommendations', e.target.value)}
                  rows={2}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                  placeholder="Provide overall endorsement and evaluation remarks regarding the student's industry readiness..."
                />
              </div>
            </div>

            {/* Official Signatures Certification Box */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
                Certification & Endorsement
              </h4>
              <p className="text-xs text-slate-500 italic leading-relaxed">
                I hereby certify that the scores and qualitative assessments recorded above represent a true, objective,
                and comprehensive evaluation of the student intern's on-the-job training performance.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-1 font-bold text-slate-900">{supervisorName}</div>
                  <div className="text-slate-500 mt-1">Host Training Supervisor Signature</div>
                  <div className="text-slate-400 text-[10px]">{companyName}</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 font-bold text-slate-900">
                    {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="text-slate-500 mt-1">Evaluation Date & Verification</div>
                  <div className="text-emerald-600 font-bold text-[10px]">Digitally Endorsed</div>
                </div>
              </div>
            </div>

            {/* Bottom Save Action */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 no-print">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave('final')}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5"
              >
                <Check size={16} />
                <span>Submit & Finalize Official Evaluation</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. View Mode (Printable / Certificate Review)
  // ─────────────────────────────────────────────────────────────────────────────
  if (viewMode === 'view' && selectedEmp) {
    const existing = evaluations.find((e) => e.employeeId === selectedEmp.id);
    const evScore = existing?.overallScore || 85;
    const evGrade = existing?.grade || getGrade(evScore);
    const evGradeConfig = GRADE_CONFIG[evGrade];

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans">
        <div className="flex items-center justify-between no-print">
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:text-slate-900 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all"
          >
            <X size={16} />
            Back to Trainees List
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-md"
            >
              <Printer size={15} />
              Print Official Form
            </button>
            <button
              onClick={() => openNewEval(selectedEmp)}
              className="px-4 py-2 bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20"
            >
              <Edit2 size={15} />
              Edit Evaluation
            </button>
          </div>
        </div>

        {/* Official Printable Sheet */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white p-6 text-center border-b border-slate-800">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-16 bg-white rounded-full p-1 shadow-lg flex items-center justify-center shrink-0 mb-1">
                <img src="/CHMSU.JPEG" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <h1 className="font-serif text-lg font-bold tracking-wide uppercase text-slate-100">
                Carlos Hilado Memorial State University
              </h1>
              <p className="text-xs text-slate-300 uppercase">
                Official Trainee Performance Evaluation Form
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-xs border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
              <div>
                <span className="text-slate-400 font-semibold block">Student Intern:</span>
                <span className="font-extrabold text-slate-900 text-sm">{selectedEmp.name}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Student ID:</span>
                <span className="font-mono font-bold text-slate-800">{selectedEmp.employeeId}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">School & Program:</span>
                <span className="font-medium text-slate-700">{selectedEmp.schoolName} ({selectedEmp.course})</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Host Establishment:</span>
                <span className="font-bold text-blue-900">{companyName}</span>
              </div>
            </div>

            <div className={`rounded-2xl p-6 border-2 ${evGradeConfig.bg} ${evGradeConfig.border} flex items-center justify-between`}>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Official Evaluation Score</span>
                <p className="text-4xl font-black text-slate-900 mt-1">{evScore}%</p>
              </div>
              <div className="text-right">
                <p className={`text-xl font-black ${evGradeConfig.color}`}>{evGrade}</p>
                <p className="text-xs font-semibold text-slate-600">{evGradeConfig.label}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">Key Strengths & Achievements:</span>
                <p className="text-slate-600 leading-relaxed">{existing?.strengths || 'Exemplary work performance.'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">Areas for Improvement:</span>
                <p className="text-slate-600 leading-relaxed">{existing?.areasForImprovement || 'Continuous learning and growth.'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">Recommendation Remarks:</span>
                <p className="text-slate-600 leading-relaxed">{existing?.recommendations || 'Recommended for completion of OJT.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Main Trainees List & Evaluator Dashboard View
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Star className="text-amber-500 fill-amber-500" size={26} />
            <span>Trainee Performance Evaluations</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official performance evaluation system matching university criteria with real-time coordinator sync
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-800 rounded-2xl border border-blue-200 text-xs font-bold shadow-xs">
          <Building size={16} />
          <span>{companyName}</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student intern by name, ID, or course..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>

        {courses.length > 0 && (
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
          >
            <option value="all">All Programs</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Trainees Evaluation Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <span>Assigned Interns Roster</span>
          </h2>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total: {filteredTrainees.length} Interns
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3">Student Intern</th>
                <th className="px-4 py-3">Course / Department</th>
                <th className="px-4 py-3">Rendered Hours</th>
                <th className="px-4 py-3">Evaluation Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrainees.map((emp) => {
                const evalData = evaluations.find((e) => e.employeeId === emp.id);
                const stats = getEmpStats(emp.id);
                const gradeInfo = evalData ? GRADE_CONFIG[evalData.grade] : null;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors font-medium">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                          {emp.photo ? (
                            <img src={getPhotoUrl(emp.photo)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <GraduationCap size={20} className="text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{emp.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">ID: {emp.employeeId || emp.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-blue-700 text-xs">{emp.course || 'OJT Trainee'}</div>
                      <div className="text-[11px] text-slate-500">{emp.schoolName || 'CHMSU'}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {stats.totalHours.toFixed(1)} / {emp.requiredHours || 486} hrs
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {evalData && gradeInfo ? (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border ${gradeInfo.bg} ${gradeInfo.border} ${gradeInfo.color}`}>
                            <Award size={13} />
                            {evalData.overallScore}% ({evalData.grade})
                          </span>
                          {evalData.status === 'final' && (
                            <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Finalized
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                          Not Yet Evaluated
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {evalData ? (
                          <>
                            <button
                              onClick={() => viewEval(emp)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                            >
                              View Sheet
                            </button>
                            <button
                              onClick={() => openNewEval(emp)}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors"
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openNewEval(emp)}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all"
                          >
                            Evaluate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTrainees.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No student interns found matching your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
