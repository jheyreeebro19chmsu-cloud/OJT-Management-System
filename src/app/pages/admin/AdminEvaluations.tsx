import { Star, Users, X, Save, ChevronRight, Award, Clock, Check, Edit2, Trash2, AlertCircle, Printer, FileText, Building, GraduationCap, Calendar, CheckCircle2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';
import { Employee, Evaluation } from '../../types';

const GRADE_CONFIG: Record<Evaluation['grade'], { color: string; bg: string; border: string; min: number; label: string }> = {
  Excellent: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', min: 90, label: 'Excellent / Outstanding (90-100%)' },
  'Very Good': { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', min: 80, label: 'Very Good / Above Average (80-89%)' },
  Good: { color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', min: 70, label: 'Good / Average (70-79%)' },
  Satisfactory: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', min: 60, label: 'Satisfactory / Fair (60-69%)' },
  'Needs Improvement': { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', min: 0, label: 'Needs Improvement / Poor (<60%)' },
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

export function AdminEvaluations() {
  const {
    employees,
    timeRecords,
    evaluations,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    getEmployeeRequiredDocuments,
    getEmployeeRequirementSummary,
  } = useApp();
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState<EvaluationForm>(BLANK_FORM);
  const [editEvalId, setEditEvalId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'view'>('list');

  const activeEmployees = employees.filter((e) => e.active);

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
    if (status === 'final') {
      const summary = getEmployeeRequirementSummary(selectedEmp.id);
      if (summary.missing > 0 || summary.incomplete > 0) {
        toast.error(`Upload all required documents before finalizing. ${summary.missing} missing, ${summary.incomplete} incomplete.`);
        return;
      }
    }
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
      evaluatedBy: 'OJT Instructor',
      ...form,
      overallScore,
      grade,
      evaluatedAt: new Date().toISOString(),
      status,
    };

    if (editEvalId) {
      updateEvaluation(editEvalId, data);
      toast.success(`Evaluation ${status === 'final' ? 'finalized' : 'saved as draft'}!`);
    } else {
      addEvaluation(data);
      toast.success(`Evaluation ${status === 'final' ? 'finalized' : 'saved as draft'}!`);
    }
    setViewMode('list');
  };

  const handleDelete = (evalId: string) => {
    if (confirm('Delete this evaluation?')) {
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

  // ── True Evaluation Form Screen (Create / Edit) ───────────────────────────
  if (viewMode === 'form' && selectedEmp) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto pb-12">
        {/* Navigation Header */}
        <div className="flex items-center justify-between no-print">
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <X size={16} />
            Cancel & Return
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm"
              title="Print Evaluation Sheet"
            >
              <Printer size={15} />
              Print Sheet
            </button>
            <button
              onClick={() => {
                const ev = evaluations.find((e) => e.employeeId === selectedEmp.id);
                const csvData = [
                  ['Trainee Name', 'Employee ID', 'Company', 'Overall Score', 'Grade', 'Evaluated At', 'Status'],
                  [
                    selectedEmp.name,
                    selectedEmp.employeeId,
                    selectedEmp.companyName,
                    `${ev?.overallScore || form.performanceScore}%`,
                    ev?.grade || grade,
                    ev?.evaluatedAt || new Date().toISOString(),
                    ev?.status || 'draft',
                  ],
                ];
                const csvContent = csvData.map((e) => e.join(',')).join('\n');
                const url = URL.createObjectURL(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = `Evaluation_${selectedEmp.name.replace(/\s+/g, '_')}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.success('CSV exported successfully!');
              }}
              className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm"
              title="Export Evaluation CSV"
            >
              <Download size={15} />
              Export CSV
            </button>
            <button
              onClick={() => handleSave('draft')}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all flex items-center gap-1.5"
            >
              <Save size={15} />
              Save Draft
            </button>
            <button
              onClick={() => handleSave('final')}
              disabled={(() => { const summary = getEmployeeRequirementSummary(selectedEmp.id); return summary.missing > 0 || summary.incomplete > 0; })()}
              className="px-5 py-2 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200"
            >
              <Check size={16} />
              Finalize & Issue Form
            </button>
          </div>
        </div>

        {/* Official Printable Evaluation Sheet */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Institutional Header */}
          <div className="bg-slate-900 text-white p-6 text-center border-b border-slate-800">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-16 bg-white rounded-full p-1 shadow-lg flex items-center justify-center shrink-0 mb-1">
                <img src="/chmsu-logo.svg" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold tracking-wide uppercase text-slate-100">
                  Carlos Hilado Memorial State University
                </h1>
                <p className="text-xs text-slate-300 font-medium tracking-wider uppercase">
                  Office of On-the-Job Training & Student Internship Program
                </p>
                <div className="mt-2 inline-block px-4 py-1 bg-blue-600/40 border border-blue-400/30 rounded-full text-xs font-bold tracking-widest text-sky-200 uppercase">
                  Official Trainee Performance Evaluation Form
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Student & Host Establishment Particulars */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <UserCircleIcon className="w-4 h-4 text-blue-600" />
                Trainee & Establishment Details
              </h3>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Student Name:</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedEmp.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Student ID / Employee ID:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedEmp.employeeId}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">School & Course:</span>
                  <span className="font-medium text-slate-700">{selectedEmp.schoolName} ({selectedEmp.course || 'N/A'})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Campus & Department:</span>
                  <span className="font-medium text-slate-700">{selectedEmp.campus || 'Main Campus'} • {selectedEmp.department || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Host Training Establishment (HTE):</span>
                  <span className="font-bold text-blue-900">{selectedEmp.companyName || 'Not recorded'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Training Supervisor:</span>
                  <span className="font-medium text-slate-800">{selectedEmp.supervisorName || selectedEmp.contactPerson || 'OJT Supervisor'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Required OJT Hours:</span>
                  <span className="font-bold text-slate-800">{selectedEmp.requiredHours} Hours</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Rendered Training Period:</span>
                  <span className="font-medium text-slate-700">{selectedEmp.startDate || 'Start Date'} to {selectedEmp.endDate || 'Present'}</span>
                </div>
              </div>
            </div>

            {/* Rating Scale Legend */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
              <p className="font-bold uppercase tracking-wider text-[11px] text-blue-800">Rating Scale Standard:</p>
              <div className="grid grid-cols-5 gap-1.5 text-[11px] text-center font-medium">
                <span className="bg-emerald-100 text-emerald-800 p-1 rounded font-bold">90-100%: Excellent</span>
                <span className="bg-blue-100 text-blue-800 p-1 rounded font-bold">80-89%: Very Good</span>
                <span className="bg-sky-100 text-sky-800 p-1 rounded font-bold">70-79%: Good</span>
                <span className="bg-amber-100 text-amber-800 p-1 rounded font-bold">60-69%: Fair</span>
                <span className="bg-rose-100 text-rose-800 p-1 rounded font-bold">&lt;60%: Unsatisfactory</span>
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
                  <div key={sec.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white hover:border-blue-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{sec.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Weight Component: {sec.weight}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Score:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={currentScore}
                          onChange={(e) => upd(sec.key, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="font-bold text-slate-600">%</span>
                      </div>
                    </div>

                    <div className="pl-3 border-l-2 border-slate-200 space-y-1 text-xs text-slate-600">
                      {sec.subCriteria.map((sub, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                          <span>{sub}</span>
                        </div>
                      ))}
                    </div>

                    {/* Interactive Slider */}
                    <div className="pt-1">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={currentScore}
                        onChange={(e) => upd(sec.key, parseInt(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Final Overall Grade Summary Card */}
            <div className={`rounded-xl p-5 border-2 ${gradeConfig.bg} ${gradeConfig.border} flex items-center justify-between shadow-sm`}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall Weighted Score</p>
                <p className="text-4xl font-extrabold text-slate-900 mt-1">{overallScore}%</p>
                <p className="text-xs text-slate-500 mt-1">Calculated across all evaluation competency areas</p>
              </div>
              <div className="text-right">
                <div className="inline-block p-2 rounded-full bg-white shadow-sm mb-1">
                  <Award size={28} className={gradeConfig.color} />
                </div>
                <p className={`text-lg font-extrabold ${gradeConfig.color}`}>{grade}</p>
                <p className="text-xs font-medium text-slate-600">{gradeConfig.label}</p>
              </div>
            </div>

            {/* Written Assessment & Remarks */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
                Qualitative Assessment & Feedback
              </h3>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  1. Major Strengths & Notable Achievements *
                </label>
                <textarea
                  value={form.strengths}
                  onChange={(e) => upd('strengths', e.target.value)}
                  placeholder="Detail key competencies, exceptional performance, and work contributions..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  2. Areas Needing Growth & Technical Improvement
                </label>
                <textarea
                  value={form.areasForImprovement}
                  onChange={(e) => upd('areasForImprovement', e.target.value)}
                  placeholder="Identify skills or work habits that require further development..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  3. Overall Recommendation & Remarks
                </label>
                <textarea
                  value={form.recommendations}
                  onChange={(e) => upd('recommendations', e.target.value)}
                  placeholder="Provide recommendations for future professional growth or employment..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50 resize-none"
                />
              </div>
            </div>

            {/* Signature Blocks */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="h-12 border-b border-slate-400 mb-1 flex items-end justify-center pb-1">
                  <span className="font-bold text-slate-800 text-sm uppercase">{selectedEmp.supervisorName || 'OJT SUPERVISOR'}</span>
                </div>
                <p className="font-semibold text-slate-600">HTE Training Supervisor / Evaluator</p>
                <p className="text-slate-400 text-[10px]">Signature over Printed Name & Date</p>
              </div>

              <div>
                <div className="h-12 border-b border-slate-400 mb-1 flex items-end justify-center pb-1">
                  <span className="font-bold text-slate-800 text-sm uppercase">OJT INSTRUCTOR</span>
                </div>
                <p className="font-semibold text-slate-600">CHMSU OJT Coordinator / Instructor</p>
                <p className="text-slate-400 text-[10px]">Signature over Printed Name & Date</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 no-print">
          <button
            onClick={() => handleSave('draft')}
            className="flex-1 py-3 border border-slate-300 bg-white text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Save size={16} />
            Save Draft Evaluation
          </button>
          <button
            onClick={() => handleSave('final')}
            disabled={(() => { const summary = getEmployeeRequirementSummary(selectedEmp.id); return summary.missing > 0 || summary.incomplete > 0; })()}
            className="flex-1 py-3 bg-blue-700 text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200"
          >
            <Check size={16} />
            Finalize Official Evaluation
          </button>
        </div>
      </div>
    );
  }

  // ── True Evaluation Form Screen (View / Printable Sheet) ─────────────────
  if (viewMode === 'view' && selectedEmp) {
    const ev = evaluations.find((e) => e.employeeId === selectedEmp.id);
    if (!ev) return null;
    const gc = GRADE_CONFIG[ev.grade];

    return (
      <div className="space-y-6 max-w-3xl mx-auto pb-12">
        {/* Navigation & Print Action Bar */}
        <div className="flex items-center justify-between no-print">
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white rounded-xl border border-slate-200 shadow-sm"
          >
            <X size={16} />
            Back to List
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Printer size={15} />
              Print Official Hard Copy
            </button>
            <button
              onClick={() => openNewEval(selectedEmp)}
              className="px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-all flex items-center gap-1.5"
            >
              <Edit2 size={15} />
              Edit Evaluation
            </button>
          </div>
        </div>

        {/* Printable Sheet Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden printable-sheet">
          {/* Institutional Header */}
          <div className="bg-slate-900 text-white p-6 text-center border-b border-slate-800">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-16 bg-white rounded-full p-1 shadow-lg flex items-center justify-center shrink-0 mb-1">
                <img src="/chmsu-logo.svg" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold tracking-wide uppercase text-slate-100">
                  Carlos Hilado Memorial State University
                </h1>
                <p className="text-xs text-slate-300 font-medium tracking-wider uppercase">
                  Office of On-the-Job Training & Student Internship Program
                </p>
                <div className="mt-2 inline-block px-4 py-1 bg-blue-600/40 border border-blue-400/30 rounded-full text-xs font-bold tracking-widest text-sky-200 uppercase">
                  Official Trainee Performance Evaluation Report
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Particulars Header */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Student Name:</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedEmp.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Student ID / Employee ID:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedEmp.employeeId}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">School & Course:</span>
                  <span className="font-medium text-slate-700">{selectedEmp.schoolName} ({selectedEmp.course || 'N/A'})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Host Training Establishment:</span>
                  <span className="font-bold text-blue-900">{selectedEmp.companyName || 'Not recorded'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Evaluation Date:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(ev.evaluatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Evaluation Status:</span>
                  <span className={`inline-block font-bold px-2 py-0.5 rounded text-[11px] uppercase ${ev.status === 'final' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {ev.status === 'final' ? 'Official / Finalized' : 'Draft Copy'}
                  </span>
                </div>
              </div>
            </div>

            {/* Score Breakdown Table */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
                Competency Assessment Breakdown
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">Evaluation Competency Domain</th>
                      <th className="p-3 text-center w-24">Weight</th>
                      <th className="p-3 text-center w-24">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {EVALUATION_SECTIONS.map((sec) => (
                      <tr key={sec.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-800">{sec.title}</td>
                        <td className="p-3 text-center text-slate-500">{sec.weight}</td>
                        <td className="p-3 text-center font-bold text-slate-900">
                          {ev[sec.key as keyof Evaluation]}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overall Grade Card */}
            <div className={`rounded-xl p-5 border-2 ${gc.bg} ${gc.border} flex items-center justify-between`}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall Final Rating</p>
                <p className="text-4xl font-extrabold text-slate-900 mt-1">{ev.overallScore}%</p>
              </div>
              <div className="text-right">
                <p className={`text-xl font-extrabold ${gc.color}`}>{ev.grade}</p>
                <p className="text-xs font-semibold text-slate-600">{gc.label}</p>
              </div>
            </div>

            {/* Written Assessment Remarks */}
            <div className="space-y-3 pt-2 text-xs">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
                Evaluator Feedback & Qualitative Remarks
              </h3>

              {ev.strengths && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-700">1. Major Strengths & Achievements:</p>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">{ev.strengths}</p>
                </div>
              )}

              {ev.areasForImprovement && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-700">2. Areas for Growth & Improvement:</p>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">{ev.areasForImprovement}</p>
                </div>
              )}

              {ev.recommendations && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-700">3. Final Recommendations:</p>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">{ev.recommendations}</p>
                </div>
              )}
            </div>

            {/* Official Signatures */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="h-12 border-b border-slate-400 mb-1 flex items-end justify-center pb-1">
                  <span className="font-bold text-slate-800 text-sm uppercase">{selectedEmp.supervisorName || 'OJT SUPERVISOR'}</span>
                </div>
                <p className="font-semibold text-slate-600">HTE Training Supervisor / Evaluator</p>
                <p className="text-slate-400 text-[10px]">Signature over Printed Name & Date</p>
              </div>

              <div>
                <div className="h-12 border-b border-slate-400 mb-1 flex items-end justify-center pb-1">
                  <span className="font-bold text-slate-800 text-sm uppercase">OJT INSTRUCTOR</span>
                </div>
                <p className="font-semibold text-slate-600">CHMSU OJT Coordinator / Instructor</p>
                <p className="text-slate-400 text-[10px]">Signature over Printed Name & Date</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List View (Trainees Roster) ──────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">OJT Trainee Performance Evaluations</h2>
          <p className="text-sm text-gray-500">Official evaluation management for OJT trainees and intern performance reports</p>
        </div>
        <button
          onClick={() => {
            const csvRows = [
              ['Trainee Name', 'Employee ID', 'Company', 'Department', 'Overall Score', 'Grade', 'Evaluated At', 'Status'],
            ];
            activeEmployees.forEach((emp) => {
              const ev = evaluations.find((e) => e.employeeId === emp.id);
              csvRows.push([
                emp.name,
                emp.employeeId,
                emp.companyName,
                emp.department,
                ev ? `${ev.overallScore}%` : 'N/A',
                ev ? ev.grade : 'Not Evaluated',
                ev ? ev.evaluatedAt : 'N/A',
                ev ? ev.status : 'Pending',
              ]);
            });
            const csvContent = csvRows.map((e) => e.join(',')).join('\n');
            const url = URL.createObjectURL(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `OJT_Evaluations_Summary_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Evaluations summary CSV exported!');
          }}
          className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Download size={14} />
          Export All CSV
        </button>
      </div>

      <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3 border border-blue-100 shadow-sm">
        <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-bold mb-0.5">End-of-OJT Performance Evaluation</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Conduct formal performance evaluations for each trainee upon completion of required OJT hours.
            Finalized evaluation reports generate official university grade sheets printable for student records.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {activeEmployees.map((emp) => {
          const ev = evaluations.find((e) => e.employeeId === emp.id);
          const stats = getEmpStats(emp.id);
          const progress = Math.min((stats.totalHours / emp.requiredHours) * 100, 100);
          const gc = ev ? GRADE_CONFIG[ev.grade] : null;

          return (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:border-blue-200 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 shadow-inner">
                  {emp.photo ? (
                    <img
                      src={emp.photo}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <span className="text-blue-700 font-bold text-xl">{emp.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800 text-base">{emp.name}</p>
                      <p className="text-xs text-slate-500 font-medium">{emp.course} • {emp.schoolName}</p>
                      <p className="text-xs text-blue-600 font-semibold mt-0.5">{emp.companyName || 'Host Training Establishment'}</p>
                    </div>
                    {ev && gc && (
                      <div className="text-right">
                        <span className={`inline-block text-xs font-extrabold px-3 py-1 rounded-full border ${gc.bg} ${gc.color} ${gc.border}`}>
                          {ev.grade} ({ev.overallScore}%)
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                          {ev.status === 'final' ? 'Official' : 'Draft'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                      <p className="font-bold text-slate-800">{stats.totalHours.toFixed(0)} / {emp.requiredHours}h</p>
                      <p className="text-slate-400 text-[10px]">Rendered Hours</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                      <p className="font-bold text-emerald-700">{stats.present} Days</p>
                      <p className="text-slate-400 text-[10px]">Present</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                      <p className="font-bold text-amber-700">{stats.late} Days</p>
                      <p className="text-slate-400 text-[10px]">Late</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1 font-medium">
                      <span>OJT Required Hours Progress</span>
                      <span className="font-bold text-slate-700">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                {ev ? (
                  <>
                    <button
                      onClick={() => viewEval(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                    >
                      <FileText size={14} />
                      View Official Form
                    </button>
                    <button
                      onClick={() => openNewEval(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition-colors"
                    >
                      <Edit2 size={14} />
                      Edit Evaluation
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openNewEval(emp)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors shadow-sm"
                  >
                    <Star size={15} />
                    Evaluate Trainee Performance
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function UserCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
