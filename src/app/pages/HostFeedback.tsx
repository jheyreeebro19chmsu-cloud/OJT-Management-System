import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building, User, Star, CheckCircle, Send, Mail, Briefcase, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store/AppContext';

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

type RatingsState = {
  attendance: number;
  performance: number;
  attitude: number;
  communication: number;
  teamwork: number;
};

export function HostFeedback() {
  const { employees, addHostFeedback, currentUser, logout } = useApp();
  const navigate = useNavigate();
  const trainees = useMemo(
    () => employees.filter(e => e.active && e.position !== 'OJT Instructor'),
    [employees]
  );

  const [form, setForm] = useState({
    employeeId: trainees[0]?.id || '',
    hostName: currentUser?.name || '',
    hostCompany: '',
    hostPosition: '',
    hostEmail: '',
    strengths: '',
    areasForImprovement: '',
    recommendation: 'Recommended',
  });

  const [ratings, setRatings] = useState<RatingsState>({
    attendance: 4,
    performance: 4,
    attitude: 4,
    communication: 4,
    teamwork: 4,
  });

  const [submitted, setSubmitted] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!currentUser || currentUser.role !== 'host') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-sky-800 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full text-center">
          <h2 className="text-gray-800 font-bold text-lg mb-2">Host Portal Access</h2>
          <p className="text-sm text-gray-500 mb-4">
            This feedback portal is for authorized host supervisors only. Please sign in to continue.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!form.employeeId && trainees[0]) {
      setForm(prev => ({ ...prev, employeeId: trainees[0].id }));
    }
  }, [trainees, form.employeeId]);

  useEffect(() => {
    if (currentUser?.role === 'host' && !form.hostName) {
      setForm(prev => ({ ...prev, hostName: currentUser.name }));
    }
  }, [currentUser, form.hostName]);

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => setSubmitted(false), 3500);
    return () => clearTimeout(timer);
  }, [submitted]);

  const updateForm = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const updateRating = (key: keyof RatingsState, value: number) =>
    setRatings(prev => ({ ...prev, [key]: value }));

  const overallRating = Math.round(
    (ratings.attendance + ratings.performance + ratings.attitude + ratings.communication + ratings.teamwork) / 5
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId || !form.hostName || !form.hostCompany) return;

    addHostFeedback({
      employeeId: form.employeeId,
      hostName: form.hostName,
      hostCompany: form.hostCompany,
      hostPosition: form.hostPosition,
      hostEmail: form.hostEmail || undefined,
      attendanceScore: ratings.attendance * 20,
      performanceScore: ratings.performance * 20,
      attitudeScore: ratings.attitude * 20,
      communicationScore: ratings.communication * 20,
      teamworkScore: ratings.teamwork * 20,
      strengths: form.strengths,
      areasForImprovement: form.areasForImprovement,
      recommendation: form.recommendation as 'Highly Recommended' | 'Recommended' | 'For Improvement' | 'Not Recommended',
    });

    setSubmitted(true);
    setForm(prev => ({ ...prev, hostName: '', hostCompany: '', hostPosition: '', hostEmail: '', strengths: '', areasForImprovement: '' }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-sky-800 px-4 py-10">
      <div className="absolute top-0 left-0 w-72 h-72 bg-sky-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between text-white text-xs mb-6">
          <span>Signed in as {currentUser.name}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
          >
            Logout
          </button>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/15">
              <ClipboardCheck size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">Host Establishment Feedback</h1>
              <p className="text-blue-200 text-sm">Help us assess trainee performance and readiness</p>
            </div>
          </div>
          <div className="text-blue-200 text-xs">
            If you are a host supervisor, kindly complete this evaluation to support the trainee's OJT record.
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/10 border border-white/20 p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Star size={16} className="text-yellow-300" />
                <p className="font-semibold text-sm">What We Need</p>
              </div>
              <p className="text-xs text-blue-100 leading-relaxed">
                Please rate the trainee on attendance, performance, attitude, communication, and teamwork.
                Your feedback will be shared with the school and the OJT coordinator.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-green-300" />
                <p className="font-semibold text-sm">Privacy Note</p>
              </div>
              <p className="text-xs text-blue-100 leading-relaxed">
                This form stores feedback for academic purposes only. Avoid including sensitive personal data.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs text-blue-200 hover:text-white transition-colors"
            >
              Back to login
            </Link>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-2xl border border-white/40"
            onSubmit={handleSubmit}
          >
            <AnimatePresence>
              {submitted && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2"
                >
                  <CheckCircle size={16} />
                  Feedback submitted successfully. Thank you!
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Trainee *</label>
                <select
                  value={form.employeeId}
                  onChange={e => updateForm('employeeId', e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {trainees.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} - {t.employeeId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Host Company *</label>
                <div className="relative">
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={form.hostCompany}
                    onChange={e => updateForm('hostCompany', e.target.value)}
                    required
                    placeholder="Company or establishment name"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Host Supervisor *</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={form.hostName}
                    onChange={e => updateForm('hostName', e.target.value)}
                    required
                    placeholder="Your full name"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Position / Role</label>
                <div className="relative">
                  <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={form.hostPosition}
                    onChange={e => updateForm('hostPosition', e.target.value)}
                    placeholder="Training Supervisor"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Contact Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={form.hostEmail}
                    onChange={e => updateForm('hostEmail', e.target.value)}
                    placeholder="email@company.com"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <RatingRow label="Attendance & punctuality" value={ratings.attendance} onChange={(v) => updateRating('attendance', v)} />
              <RatingRow label="Performance & task quality" value={ratings.performance} onChange={(v) => updateRating('performance', v)} />
              <RatingRow label="Attitude & professionalism" value={ratings.attitude} onChange={(v) => updateRating('attitude', v)} />
              <RatingRow label="Communication skills" value={ratings.communication} onChange={(v) => updateRating('communication', v)} />
              <RatingRow label="Teamwork & collaboration" value={ratings.teamwork} onChange={(v) => updateRating('teamwork', v)} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Strengths / Highlights</label>
                <textarea
                  value={form.strengths}
                  onChange={e => updateForm('strengths', e.target.value)}
                  rows={3}
                  placeholder="Key strengths you observed"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Areas for Improvement</label>
                <textarea
                  value={form.areasForImprovement}
                  onChange={e => updateForm('areasForImprovement', e.target.value)}
                  rows={3}
                  placeholder="Suggestions for growth"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Overall Recommendation</label>
                <select
                  value={form.recommendation}
                  onChange={e => updateForm('recommendation', e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Highly Recommended</option>
                  <option>Recommended</option>
                  <option>For Improvement</option>
                  <option>Not Recommended</option>
                </select>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Overall Rating</div>
                <div className="text-lg font-bold text-blue-700">{overallRating}/5</div>
                <div className="text-xs text-gray-400">{RATING_LABELS[overallRating]}</div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 w-full py-3 bg-blue-700 text-white rounded-2xl font-semibold text-sm hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
            >
              <Send size={16} />
              Submit Feedback
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-xs text-gray-500">{value}/5 - {RATING_LABELS[value]}</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(score => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              value >= score ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-500'
            }`}
            aria-pressed={value >= score}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}
