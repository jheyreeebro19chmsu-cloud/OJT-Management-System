import React from 'react';
import {
  Award,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Info,
  Lock,
  Printer,
  ShieldCheck,
  Star,
  ThumbsUp,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../store/AppContext';
import { Evaluation } from '../types';

const GRADE_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string; badge: string }
> = {
  Excellent: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: 'Excellent / Outstanding (90–100%)',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  'Very Good': {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Very Good / Above Average (80–89%)',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  Good: {
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    label: 'Good / Average (70–79%)',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  Satisfactory: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Satisfactory / Passing (60–69%)',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  'Needs Improvement': {
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    label: 'Needs Improvement / Conditional (Below 60%)',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
  },
};

const EVALUATION_SECTIONS = [
  { id: 'attendance', key: 'attendanceScore', title: '1. Punctuality & Attendance', weight: '20%', desc: 'Consistency in arriving on time and attending scheduled work shifts.' },
  { id: 'performance', key: 'performanceScore', title: '2. Quality of Work & Competence', weight: '25%', desc: 'Accuracy, technical skill, and proficiency in assigned tasks.' },
  { id: 'attitude', key: 'attitudeScore', title: '3. Professional Work Attitude', weight: '20%', desc: 'Respect, enthusiasm, discipline, and openness to guidance.' },
  { id: 'punctuality', key: 'punctualityScore', title: '4. Dependability & Deadline Delivery', weight: '15%', desc: 'Reliability in completing deliverables according to agreed timelines.' },
  { id: 'communication', key: 'communicationScore', title: '5. Interpersonal & Communication Skills', weight: '20%', desc: 'Teamwork, active listening, and constructive workplace communication.' },
];

export function TraineeEvaluation() {
  const { getCurrentEmployee, evaluations, hostFeedback } = useApp();
  const employee = getCurrentEmployee();

  const evaluation: Evaluation | undefined = evaluations.find(
    (e) => e.employeeId === employee?.id || e.employeeId === employee?.employeeId
  );

  const feedback = hostFeedback.find(
    (h) => h.employeeId === employee?.id || h.employeeId === employee?.employeeId
  );

  const gradeConfig = evaluation?.grade ? GRADE_CONFIG[evaluation.grade] || GRADE_CONFIG['Good'] : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">HTE Performance Evaluation</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <Lock size={12} /> View Only
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Official internship assessment submitted by your Host Training Establishment supervisor
          </p>
        </div>

        {evaluation && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer size={14} />
              Print Official Report
            </button>
          </div>
        )}
      </div>

      {/* Trainee Read-Only Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 no-print">
        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck size={18} />
        </div>
        <div className="text-xs text-slate-700 leading-relaxed">
          <p className="font-bold text-blue-900 text-sm mb-0.5">Official OJT Performance Record</p>
          This evaluation form is evaluated and submitted directly by your Host Training Establishment (HTE) supervisor and verified by your OJT Instructor. Trainees are granted <strong>view-only access</strong> to review performance ratings, qualitative remarks, and competency domain scores.
        </div>
      </div>

      {/* Case 1: Evaluation exists from HTE */}
      {evaluation ? (
        <div className="space-y-6">
          {/* Status & Particulars Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px] mb-1">
                  Assigned Host Establishment
                </span>
                <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Building size={14} className="text-amber-600 shrink-0" />
                  {employee?.companyName || 'Host Training Establishment'}
                </p>
                <p className="text-slate-500 mt-0.5">
                  Supervisor: <span className="font-semibold text-slate-700">{employee?.supervisorName || evaluation.evaluatedBy || 'HTE Supervisor'}</span>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px] mb-1">
                  Evaluation Date
                </span>
                <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-600 shrink-0" />
                  {new Date(evaluation.evaluatedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-slate-500 mt-0.5">
                  Academic Year: <span className="font-semibold text-slate-700">{evaluation.academicYear || employee?.academicYear || '2026-2027'}</span>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px] mb-1">
                  Institutional Verification Status
                </span>
                <div className="mt-1">
                  {evaluation.status === 'reviewed_by_instructor' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      Verified by OJT Instructor
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      <Clock size={13} className="text-blue-600" />
                      Submitted by HTE • Awaiting Instructor Review
                    </span>
                  )}
                </div>
                {evaluation.instructorViewedBy && (
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Reviewed by {evaluation.instructorViewedBy}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Overall Rating Hero Card */}
          {gradeConfig && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className={`rounded-2xl p-6 border-2 ${gradeConfig.bg} ${gradeConfig.border} shadow-sm flex flex-col md:flex-row items-center justify-between gap-6`}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center border border-white shrink-0">
                  <Award size={32} className={gradeConfig.color} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Overall Performance Rating
                  </span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-5xl font-black text-slate-900 tracking-tight">
                      {evaluation.overallScore}%
                    </span>
                    <span className={`text-xl font-extrabold ${gradeConfig.color}`}>
                      {evaluation.grade}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    {gradeConfig.label}
                  </p>
                </div>
              </div>

              {feedback?.recommendation && (
                <div className="bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-slate-200/80 text-right shrink-0">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Supervisor Endorsement</p>
                  <p className="text-sm font-extrabold text-blue-800 flex items-center gap-1.5 justify-end mt-0.5">
                    <ThumbsUp size={14} className="text-blue-600" />
                    {feedback.recommendation}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Competency Assessment Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Competency Domain Scores</h3>
                <p className="text-xs text-slate-500">Detailed breakdown across evaluation criteria</p>
              </div>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                5 Assessment Domains
              </span>
            </div>

            <div className="divide-y divide-slate-100 p-2">
              {EVALUATION_SECTIONS.map((sec) => {
                const score = (evaluation as any)[sec.key] || 0;
                const scoreColor =
                  score >= 90
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : score >= 80
                    ? 'text-blue-700 bg-blue-50 border-blue-200'
                    : score >= 75
                    ? 'text-sky-700 bg-sky-50 border-sky-200'
                    : 'text-amber-700 bg-amber-50 border-amber-200';

                return (
                  <div key={sec.id} className="p-4 hover:bg-slate-50/70 transition-colors rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{sec.title}</span>
                        <p className="text-xs text-slate-400 mt-0.5">{sec.desc}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <span className={`inline-block font-mono font-black text-sm px-3 py-1 rounded-xl border ${scoreColor}`}>
                          {score}%
                        </span>
                        <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
                          Weight: {sec.weight}
                        </span>
                      </div>
                    </div>

                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 mt-2">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-blue-500 to-indigo-600"
                        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Qualitative Evaluator Remarks & Feedback */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Major Strengths */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                <Star size={15} />
                <span>1. Major Strengths</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/60 min-h-[90px]">
                {evaluation.strengths || feedback?.strengths || 'No specific strengths remarks recorded.'}
              </p>
            </div>

            {/* Areas for Improvement */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                <Info size={15} />
                <span>2. Areas for Growth</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-amber-50/40 p-3 rounded-xl border border-amber-100/60 min-h-[90px]">
                {evaluation.areasForImprovement || feedback?.areasForImprovement || 'No specific areas for improvement noted.'}
              </p>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <ThumbsUp size={15} />
                <span>3. Recommendations</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-blue-50/40 p-3 rounded-xl border border-blue-100/60 min-h-[90px]">
                {evaluation.recommendations || feedback?.recommendation || 'Keep up the good performance and proactive engagement.'}
              </p>
            </div>
          </motion.div>
        </div>
      ) : (
        /* Case 2: Awaiting HTE Evaluation */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-10 border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-5"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
            <Clock size={32} className="animate-pulse" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Awaiting HTE Performance Evaluation</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Your Host Training Establishment (HTE) supervisor has not yet submitted your official OJT performance evaluation.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Trainee Name:</span>
              <span className="font-bold text-slate-800">{employee?.name}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Host Establishment:</span>
              <span className="font-bold text-slate-800">{employee?.companyName || 'Host Training Establishment'}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Designated Supervisor:</span>
              <span className="font-bold text-slate-800">{employee?.supervisorName || 'HTE Supervisor'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Required Internship Hours:</span>
              <span className="font-bold text-blue-700">{employee?.requiredHours || 300} Hours</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            💡 Once your supervisor completes your assessment form on their portal, your competency scores, remarks, and overall grade will automatically appear on this page.
          </p>
        </motion.div>
      )}
    </div>
  );
}
