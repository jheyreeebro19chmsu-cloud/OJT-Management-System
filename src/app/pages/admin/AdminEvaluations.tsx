import { Star, Users, X, Save, ChevronRight, Award, Clock, Check, Edit2, Trash2, AlertCircle, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';
import { Employee, Evaluation } from '../../types';


const GRADE_CONFIG: Record<Evaluation['grade'], { color: string; bg: string; min: number }> = {
  Excellent: { color: 'text-green-700', bg: 'bg-green-100', min: 90 },
  'Very Good': { color: 'text-blue-700', bg: 'bg-blue-100', min: 80 },
  Good: { color: 'text-sky-700', bg: 'bg-sky-100', min: 70 },
  Satisfactory: { color: 'text-yellow-700', bg: 'bg-yellow-100', min: 60 },
  'Needs Improvement': { color: 'text-red-700', bg: 'bg-red-100', min: 0 },
};

function getGrade(score: number): Evaluation['grade'] {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Satisfactory';
  return 'Needs Improvement';
}

const CRITERIA = [
  { key: 'attendanceScore', label: 'Attendance & Punctuality', desc: 'Regularity and timeliness of attendance' },
  { key: 'performanceScore', label: 'Job Performance', desc: 'Quality and quantity of work output' },
  { key: 'attitudeScore', label: 'Attitude & Conduct', desc: 'Professional behavior and work ethic' },
  { key: 'punctualityScore', label: 'Time Management', desc: 'Ability to manage tasks within deadlines' },
  { key: 'communicationScore', label: 'Communication Skills', desc: 'Verbal and written communication' },
] as const;

type CriteriaKey = (typeof CRITERIA)[number]['key'];

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
  attendanceScore: 80,
  performanceScore: 80,
  attitudeScore: 80,
  punctualityScore: 80,
  communicationScore: 80,
  strengths: '',
  areasForImprovement: '',
  recommendations: '',
  status: 'draft' as Evaluation['status'],
};

const TEXT_FIELDS = [
  {
    key: 'strengths',
    label: 'Strengths & Achievements',
    placeholder: "Describe the trainee's key strengths and notable achievements during the OJT period...",
  },
  {
    key: 'areasForImprovement',
    label: 'Areas for Improvement',
    placeholder: 'What areas does the trainee need to work on...',
  },
  { key: 'recommendations', label: 'Recommendations', placeholder: 'Your overall recommendation for the trainee...' },
] as const;
type TextFieldKey = (typeof TEXT_FIELDS)[number]['key'];

export function AdminEvaluations() {
  const { employees, timeRecords, evaluations, addEvaluation, updateEvaluation, deleteEvaluation } = useApp();
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
      const autoAttendance = totalDays > 0 ? Math.round(Math.max(0, 100 - (lateCount / totalDays) * 40)) : 80;
      const autoOnTime = totalDays > 0 ? Math.round(Math.max(0, 100 - (lateCount / totalDays) * 60)) : 80;
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

  if (viewMode === 'form' && selectedEmp) {
    return (
      <div className="space-y-5 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800">OJT Evaluation Form</h2>
            <p className="text-sm text-gray-500">
              {selectedEmp.name} • {selectedEmp.employeeId}
            </p>
          </div>
        </div>

        {/* Trainee overview */}
        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-200 rounded-xl flex items-center justify-center overflow-hidden">
              {selectedEmp.photo ? (
                <img
                  src={selectedEmp.photo}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <span className="text-blue-700 font-bold text-lg">{selectedEmp.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold text-blue-900">{selectedEmp.name}</p>
              <p className="text-blue-600 text-sm">{selectedEmp.course}</p>
              <p className="text-blue-500 text-xs">{selectedEmp.schoolName}</p>
            </div>
            {(() => {
              const s = getEmpStats(selectedEmp.id);
              return (
                <div className="text-right text-xs text-blue-700">
                  <p className="font-bold">{s.totalHours.toFixed(0)}h</p>
                  <p>{s.present} present</p>
                  <p>{s.late} late</p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Scoring criteria */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Star size={16} className="text-yellow-500" />
            Performance Criteria
          </h3>
          {CRITERIA.map(({ key, label, desc }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
                      form[key] >= 90
                        ? 'bg-green-100 text-green-700'
                        : form[key] >= 80
                          ? 'bg-blue-100 text-blue-700'
                          : form[key] >= 70
                            ? 'bg-sky-100 text-sky-700'
                            : form[key] >= 60
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {form[key]}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form[key]}
                onChange={(e) => upd(key, parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          ))}
        </div>

        {/* Overall Score */}
        <div
          className={`rounded-2xl p-5 border-2 ${gradeConfig.bg} border-current`}
          style={{ borderColor: 'transparent' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall Score</p>
              <p className="text-4xl font-bold text-gray-800 mt-1">{overallScore}%</p>
            </div>
            <div className="text-center">
              <Award size={32} className={gradeConfig.color} />
              <p className={`text-lg font-bold mt-1 ${gradeConfig.color}`}>{grade}</p>
            </div>
          </div>
          {/* Grade bar */}
          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                overallScore >= 90
                  ? 'bg-green-500'
                  : overallScore >= 80
                    ? 'bg-blue-500'
                    : overallScore >= 70
                      ? 'bg-sky-500'
                      : overallScore >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${overallScore}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Written Evaluation */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-800">Written Evaluation</h3>
          {TEXT_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">{label}</label>
              <textarea
                value={form[key as TextFieldKey]}
                onChange={(e) => upd(key, e.target.value)}
                placeholder={placeholder}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
              />
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleSave('draft')}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            <Save size={15} />
            Save as Draft
          </button>
          <button
            onClick={() => handleSave('final')}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors"
          >
            <Check size={15} />
            Finalize Evaluation
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'view' && selectedEmp) {
    const ev = evaluations.find((e) => e.employeeId === selectedEmp.id);
    if (!ev) return null;
    const gc = GRADE_CONFIG[ev.grade];
    return (
      <div className="space-y-5 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('list')} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">Evaluation Result</h2>
            <p className="text-sm text-gray-500">{selectedEmp.name}</p>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-semibold ${ev.status === 'final' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
          >
            {ev.status === 'final' ? 'Finalized' : 'Draft'}
          </span>
        </div>

        {/* Overall grade */}
        <div className={`rounded-2xl p-6 text-center ${gc.bg}`}>
          <Award size={40} className={`mx-auto mb-2 ${gc.color}`} />
          <p className={`text-3xl font-bold ${gc.color}`}>{ev.grade}</p>
          <p className="text-gray-600 text-lg mt-1">{ev.overallScore}% Overall Score</p>
          <p className="text-xs text-gray-500 mt-2">
            Evaluated on{' '}
            {new Date(ev.evaluatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Score breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-bold text-gray-800">Score Breakdown</h3>
          {CRITERIA.map(({ key, label }) => {
            const score = ev[key];
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-semibold text-gray-800">{score}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${score >= 90 ? 'bg-green-500' : score >= 80 ? 'bg-blue-500' : score >= 70 ? 'bg-sky-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Written evaluation */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          {[
            { label: 'Strengths & Achievements', val: ev.strengths },
            { label: 'Areas for Improvement', val: ev.areasForImprovement },
            { label: 'Recommendations', val: ev.recommendations },
          ].map(({ label, val }) =>
            val ? (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{label}</p>
                <p className="text-sm text-gray-700 leading-relaxed">{val}</p>
              </div>
            ) : null
          )}
        </div>

        <div className="flex gap-3 no-print">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-800 text-white rounded-xl font-semibold text-sm hover:bg-gray-900 transition-colors"
          >
            <Printer size={15} />
            Print Hard Copy
          </button>
          <button
            onClick={() => openNewEval(selectedEmp)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800"
          >
            <Edit2 size={15} />
            Edit Evaluation
          </button>
          <button
            onClick={() => {
              handleDelete(ev.id);
              setViewMode('list');
            }}
            className="px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm hover:bg-red-100 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">OJT Evaluations</h2>
        <p className="text-sm text-gray-500">Evaluate trainees at the end of their OJT period</p>
      </div>

      <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-0.5">End-of-OJT Evaluation</p>
          <p className="text-xs text-blue-600">
            Evaluate each trainee's performance at the end of their OJT period. Finalized evaluations are visible to the
            trainee in their profile.
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
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                  {emp.photo ? (
                    <img
                      src={emp.photo}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <span className="text-blue-700 font-bold text-lg">{emp.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.course}</p>
                      <p className="text-xs text-gray-400">{emp.schoolName}</p>
                    </div>
                    {ev && gc && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gc.bg} ${gc.color}`}>
                        {ev.grade}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-1.5 text-center">
                      <p className="font-bold text-gray-700">{stats.totalHours.toFixed(0)}h</p>
                      <p className="text-gray-400">Hours</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-1.5 text-center">
                      <p className="font-bold text-green-700">{stats.present}</p>
                      <p className="text-gray-400">Present</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-1.5 text-center">
                      <p className="font-bold text-orange-700">{stats.late}</p>
                      <p className="text-gray-400">Late</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>OJT Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {ev ? (
                  <>
                    <button
                      onClick={() => viewEval(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                      <Award size={13} />
                      View Evaluation
                    </button>
                    <button
                      onClick={() => openNewEval(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-700 text-white rounded-xl text-xs font-medium hover:bg-blue-800 transition-colors"
                    >
                      <Edit2 size={13} />
                      Edit
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openNewEval(emp)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors"
                  >
                    <Star size={14} />
                    Create Evaluation
                    <ChevronRight size={13} />
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
