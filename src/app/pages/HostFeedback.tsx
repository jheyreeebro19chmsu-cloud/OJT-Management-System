import {
  Building,
  User,
  Star,
  CheckCircle,
  Send,
  Mail,
  Briefcase,
  ClipboardCheck,
  Award,
  Sparkles,
  ShieldCheck,
  Edit3,
  ThumbsUp,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { HostFeedback as HostFeedbackType } from '../types';

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const CRITERIA = [
  {
    key: 'attendance' as const,
    title: 'Work Environment & Safety',
    desc: 'Cleanliness, ergonomics, workplace safety standards, and welcoming atmosphere.',
  },
  {
    key: 'performance' as const,
    title: 'Mentorship & Supervision',
    desc: 'Quality of supervisor guidance, constructive feedback, and availability for questions.',
  },
  {
    key: 'attitude' as const,
    title: 'Learning & Skill Acquisition',
    desc: 'Alignment of tasks with your field of study, hands-on learning, and practical training.',
  },
  {
    key: 'communication' as const,
    title: 'Workplace Culture & Professionalism',
    desc: 'Respectful treatment, inclusivity, team dynamics, and professional workplace values.',
  },
  {
    key: 'teamwork' as const,
    title: 'Resources & Equipment Support',
    desc: 'Adequacy of tools, computer hardware/software, and necessary working materials.',
  },
];

type RatingsState = {
  attendance: number;
  performance: number;
  attitude: number;
  communication: number;
  teamwork: number;
};

export function HostFeedback() {
  const {
    employees,
    hostFeedback,
    addHostFeedback,
    updateHostFeedback,
    currentUser,
    getCurrentEmployee,
    updateEmployee,
    settings,
  } = useApp();
  const navigate = useNavigate();

  const currentEmp = getCurrentEmployee();
  const isTrainee = !currentUser?.role || currentUser?.role === 'employee';

  // Registered HTE Representatives from employees list for active academic year
  const hteRepresentatives = useMemo(() => {
    const targetAY = settings?.activeAcademicYear || '2026-2027';
    const defaultAY = settings?.academicYears?.[0] || '2025-2026';
    return employees.filter(
      (e) =>
        (e.position === 'HTE Representative' || e.position === 'Training Supervisor') &&
        (e.academicYear === targetAY || (!e.academicYear && targetAY === defaultAY))
    );
  }, [employees, settings]);

  // Check if current trainee has already submitted feedback
  const existingFeedback = useMemo(() => {
    if (!currentEmp) return null;
    return (
      hostFeedback.find(
        (f) => f.employeeId === currentEmp.id || f.employeeId === currentEmp.employeeId
      ) || null
    );
  }, [hostFeedback, currentEmp]);

  const [isEditing, setIsEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form State
  const [form, setForm] = useState({
    hostCompany: currentEmp?.companyName || '',
    hostName: currentEmp?.supervisorName || '',
    hostPosition: 'HTE Supervisor',
    hostEmail: '',
    strengths: '',
    areasForImprovement: '',
    recommendation: 'Highly Recommended' as HostFeedbackType['recommendation'],
  });

  const [ratings, setRatings] = useState<RatingsState>({
    attendance: 5,
    performance: 5,
    attitude: 5,
    communication: 5,
    teamwork: 5,
  });

  // Prepopulate if existing feedback or employee profile changes
  useEffect(() => {
    if (existingFeedback && !isEditing) {
      setRatings({
        attendance: Math.round(existingFeedback.attendanceScore / 20) || 4,
        performance: Math.round(existingFeedback.performanceScore / 20) || 4,
        attitude: Math.round(existingFeedback.attitudeScore / 20) || 4,
        communication: Math.round(existingFeedback.communicationScore / 20) || 4,
        teamwork: Math.round(existingFeedback.teamworkScore / 20) || 4,
      });
      setForm({
        hostCompany: existingFeedback.hostCompany || currentEmp?.companyName || '',
        hostName: existingFeedback.hostName || currentEmp?.supervisorName || '',
        hostPosition: existingFeedback.hostPosition || 'HTE Supervisor',
        hostEmail: existingFeedback.hostEmail || '',
        strengths: existingFeedback.strengths || '',
        areasForImprovement: existingFeedback.areasForImprovement || '',
        recommendation: existingFeedback.recommendation || 'Recommended',
      });
    } else if (currentEmp) {
      setForm((prev) => ({
        ...prev,
        hostCompany: prev.hostCompany || currentEmp.companyName || '',
        hostName: prev.hostName || currentEmp.supervisorName || '',
      }));
    }
  }, [existingFeedback, currentEmp, isEditing]);

  // When hostCompany changes, auto-fill supervisor if matching HTE representative exists
  const handleCompanySelect = (companyName: string) => {
    const matched = hteRepresentatives.find(
      (h) => h.companyName?.trim().toLowerCase() === companyName.trim().toLowerCase()
    );
    setForm((prev) => ({
      ...prev,
      hostCompany: companyName,
      hostName: matched ? matched.name : prev.hostName,
      hostEmail: matched?.email || prev.hostEmail,
    }));
  };

  const updateForm = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const updateRating = (key: keyof RatingsState, value: number) =>
    setRatings((prev) => ({ ...prev, [key]: value }));

  const overallScorePercent = Math.round(
    ((ratings.attendance +
      ratings.performance +
      ratings.attitude +
      ratings.communication +
      ratings.teamwork) /
      5) *
      20
  );

  const overallRating = Math.round(
    (ratings.attendance +
      ratings.performance +
      ratings.attitude +
      ratings.communication +
      ratings.teamwork) /
      5
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmp) {
      toast.error('Trainee account not found. Please log in.');
      return;
    }

    if (!form.hostCompany.trim()) {
      toast.error('Please enter or select your Host Training Establishment company name.');
      return;
    }

    if (!form.hostName.trim()) {
      toast.error('Please enter the name of your HTE supervisor.');
      return;
    }

    // Match HTE representative to sync hte_id
    const matchedHte = hteRepresentatives.find(
      (h) =>
        h.companyName?.trim().toLowerCase() === form.hostCompany.trim().toLowerCase() ||
        h.name.trim().toLowerCase() === form.hostName.trim().toLowerCase()
    );

    const feedbackPayload = {
      employeeId: currentEmp.id,
      hostName: form.hostName.trim(),
      hostCompany: form.hostCompany.trim(),
      hostPosition: form.hostPosition.trim() || 'HTE Supervisor',
      hostEmail: form.hostEmail.trim() || undefined,
      attendanceScore: ratings.attendance * 20,
      performanceScore: ratings.performance * 20,
      attitudeScore: ratings.attitude * 20,
      communicationScore: ratings.communication * 20,
      teamworkScore: ratings.teamwork * 20,
      strengths: form.strengths.trim() || 'Valuable industry training experience and support.',
      areasForImprovement:
        form.areasForImprovement.trim() || 'Maintain continuous hands-on project opportunities.',
      recommendation: form.recommendation,
    };

    if (existingFeedback && isEditing) {
      updateHostFeedback(existingFeedback.id, {
        ...feedbackPayload,
        overallScore: overallScorePercent,
        status: 'submitted',
      });
      toast.success('Host Establishment Evaluation updated successfully!');
    } else {
      addHostFeedback(feedbackPayload);
      toast.success('Host Establishment Evaluation submitted successfully!');
    }

    // Bidirectional account synchronization: update Trainee profile with HTE linking
    updateEmployee(currentEmp.id, {
      companyName: form.hostCompany.trim(),
      supervisorName: form.hostName.trim(),
      hteId: matchedHte?.id || currentEmp.hteId,
    });

    setSubmitted(true);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-900 via-indigo-900 to-sky-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden"
      >
        <div className="absolute -right-10 -bottom-10 w-56 h-56 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Star size={24} className="text-yellow-400 fill-yellow-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Evaluate Host Establishment</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/30 text-sky-200 border border-sky-400/30">
                  Trainee Portal
                </span>
              </div>
              <p className="text-blue-200 text-xs sm:text-sm mt-0.5">
                Share your official evaluation and learning experience at your Host Training Establishment (HTE)
              </p>
            </div>
          </div>

          {currentEmp && (
            <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 text-xs text-right shrink-0">
              <span className="text-blue-300 block text-[10px] uppercase font-bold">Evaluator (Trainee)</span>
              <span className="font-bold text-white">{currentEmp.name}</span>
              <span className="text-blue-200 block text-[11px]">{currentEmp.employeeId}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Trainee Already Evaluated View */}
      {existingFeedback && !isEditing ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Evaluation Submitted</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Synced with Coordinator & HTE
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submitted on {new Date(existingFeedback.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors self-start sm:self-auto"
            >
              <Edit3 size={14} />
              Update Evaluation
            </button>
          </div>

          {/* Company & Rating Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Host Company</span>
              <p className="text-base font-bold text-slate-800 mt-1 flex items-center gap-2">
                <Building size={16} className="text-blue-600" />
                {existingFeedback.hostCompany}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Supervisor: {existingFeedback.hostName}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Overall Rating</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-black text-blue-700">{existingFeedback.overallScore}%</span>
                <span className="text-xs font-semibold text-slate-600">({Math.round(existingFeedback.overallScore / 20)} / 5)</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{RATING_LABELS[Math.round(existingFeedback.overallScore / 20)] || 'Good'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Recommendation</span>
              <p className="text-sm font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                <ThumbsUp size={16} />
                {existingFeedback.recommendation}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">For incoming student trainees</p>
            </div>
          </div>

          {/* Scores Breakdown */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Evaluation Criteria Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Work Environment & Safety', score: existingFeedback.attendanceScore },
                { label: 'Mentorship & Supervision', score: existingFeedback.performanceScore },
                { label: 'Learning & Skill Acquisition', score: existingFeedback.attitudeScore },
                { label: 'Workplace Culture & Professionalism', score: existingFeedback.communicationScore },
                { label: 'Resources & Equipment Support', score: existingFeedback.teamworkScore },
              ].map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${item.score}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 w-9 text-right">{item.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Written Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">Company Strengths & Highlights</h4>
              <p className="text-xs text-blue-950 leading-relaxed">{existingFeedback.strengths || 'N/A'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Suggestions for Future Interns</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{existingFeedback.areasForImprovement || 'N/A'}</p>
            </div>
          </div>
        </motion.div>
      ) : (
        /* Evaluation Form */
        <motion.form
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6"
        >
          {/* Section: HTE Partner Details */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Building size={18} className="text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Host Training Establishment (HTE) Details</h2>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Host Company */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Host Establishment Company Name *
                </label>
                <div className="relative">
                  <Building size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={form.hostCompany}
                    onChange={(e) => updateForm('hostCompany', e.target.value)}
                    placeholder="e.g. Focus, Tech Corp, DOOM CORPS"
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Quick select from registered HTE establishments */}
                {hteRepresentatives.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Registered HTEs:</span>
                    {hteRepresentatives.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => handleCompanySelect(h.companyName || '')}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                          form.hostCompany.trim().toLowerCase() === (h.companyName || '').trim().toLowerCase()
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {h.companyName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Host Supervisor */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  HTE Supervisor / Representative Name *
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={form.hostName}
                    onChange={(e) => updateForm('hostName', e.target.value)}
                    placeholder="e.g. Yvonne Norte"
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Supervisor Position / Department
                </label>
                <div className="relative">
                  <Briefcase size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={form.hostPosition}
                    onChange={(e) => updateForm('hostPosition', e.target.value)}
                    placeholder="e.g. HTE Representative / Senior Manager"
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Supervisor or Company Contact Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={form.hostEmail}
                    onChange={(e) => updateForm('hostEmail', e.target.value)}
                    placeholder="e.g. supervisor@company.com"
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section: Evaluation Rubric */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Star size={18} className="text-yellow-500 fill-yellow-500" />
                  Evaluation Criteria & Rating Rubric
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Rate each area honestly from 1 (Needs Improvement) to 5 (Excellent)</p>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Computed Score</span>
                <p className="text-lg font-black text-blue-700 leading-none mt-0.5">{overallScorePercent}%</p>
              </div>
            </div>

            <div className="space-y-3">
              {CRITERIA.map((criterion) => {
                const currentScore = ratings[criterion.key];
                return (
                  <div
                    key={criterion.key}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{criterion.title}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{criterion.desc}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-700 shrink-0">
                        {currentScore} / 5 — {RATING_LABELS[currentScore]}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((score) => {
                        const isSelected = currentScore === score;
                        const isFilled = currentScore >= score;
                        return (
                          <button
                            key={score}
                            type="button"
                            onClick={() => updateRating(criterion.key, score)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                                : isFilled
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Star size={12} className={isFilled ? 'fill-current' : 'opacity-40'} />
                            <span>{score}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Written Feedback */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck size={18} className="text-indigo-600" />
              Comments & Recommendations
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Company Highlights & Strengths
                </label>
                <textarea
                  rows={3}
                  value={form.strengths}
                  onChange={(e) => updateForm('strengths', e.target.value)}
                  placeholder="What did you like most about the internship experience, supervisor guidance, or team environment?"
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Suggestions / Areas for Improvement
                </label>
                <textarea
                  rows={3}
                  value={form.areasForImprovement}
                  onChange={(e) => updateForm('areasForImprovement', e.target.value)}
                  placeholder="What could be improved for future student interns (e.g. equipment, onboarding, task scheduling)?"
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <div>
                <label className="text-xs font-bold text-indigo-950 block">Overall Recommendation for Future Interns</label>
                <p className="text-[11px] text-indigo-800/80 mt-0.5">Would you recommend this company as an OJT Host Training Establishment?</p>
              </div>

              <select
                value={form.recommendation}
                onChange={(e) => updateForm('recommendation', e.target.value)}
                className="px-3.5 py-2 border border-indigo-200 rounded-xl text-xs font-bold bg-white text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="Highly Recommended">Highly Recommended</option>
                <option value="Recommended">Recommended</option>
                <option value="For Improvement">For Improvement</option>
                <option value="Not Recommended">Not Recommended</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>Your evaluation will be recorded in official university OJT records and synced with the coordinator.</span>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all"
            >
              <Send size={16} />
              <span>{existingFeedback ? 'Update Evaluation' : 'Submit HTE Evaluation'}</span>
            </button>
          </div>
        </motion.form>
      )}
    </div>
  );
}
