import {
  Star,
  CheckCircle,
  Building,
  GraduationCap,
  ClipboardCheck,
  Send,
  User,
  History,
  TrendingUp,
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement (1.0)',
  2: 'Fair (2.0)',
  3: 'Good (3.0)',
  4: 'Very Good (4.0)',
  5: 'Outstanding (5.0)',
};

type RatingsState = {
  attendance: number;
  performance: number;
  attitude: number;
  communication: number;
  teamwork: number;
};

export function HTEEvaluations() {
  const location = useLocation();
  const navigate = useNavigate();
  const { employees, hostFeedback, addHostFeedback, currentUser, getCurrentEmployee } = useApp();
  const currentEmp = getCurrentEmployee();

  const queryParams = new URLSearchParams(location.search);
  const preselectedStudentId = queryParams.get('studentId');

  const trainees = useMemo(
    () => employees.filter((e) => e.active && e.position !== 'OJT Instructor' && e.position !== 'HTE Representative'),
    [employees]
  );

  const [activeTab, setActiveTab] = useState<'evaluate' | 'history'>('evaluate');

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

  const [form, setForm] = useState({
    employeeId: preselectedStudentId || trainees[0]?.id || '',
    hostName: supervisorName,
    hostCompany: companyName,
    hostPosition: currentEmp?.position || hteUser?.position || 'Supervisor',
    hostEmail: currentUser?.email || '',
    strengths: '',
    areasForImprovement: '',
    recommendation: 'Recommended',
  });

  const [ratings, setRatings] = useState<RatingsState>({
    attendance: 5,
    performance: 5,
    attitude: 5,
    communication: 4,
    teamwork: 5,
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (preselectedStudentId) {
      setForm((prev) => ({ ...prev, employeeId: preselectedStudentId }));
    } else if (!form.employeeId && trainees[0]) {
      setForm((prev) => ({ ...prev, employeeId: trainees[0].id }));
    }
  }, [preselectedStudentId, trainees, form.employeeId]);

  const selectedTrainee = useMemo(() => {
    return trainees.find((t) => t.id === form.employeeId);
  }, [trainees, form.employeeId]);

  const updateRating = (key: keyof RatingsState, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const overallRating = Math.round(
    (ratings.attendance + ratings.performance + ratings.attitude + ratings.communication + ratings.teamwork) / 5
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) {
      toast.error('Please select a trainee to evaluate.');
      return;
    }

    setSubmitting(true);
    try {
      addHostFeedback({
        employeeId: form.employeeId,
        hostName: form.hostName || supervisorName,
        hostCompany: form.hostCompany || companyName,
        hostPosition: form.hostPosition || 'Supervisor',
        hostEmail: form.hostEmail || undefined,
        attendanceScore: ratings.attendance * 20,
        performanceScore: ratings.performance * 20,
        attitudeScore: ratings.attitude * 20,
        communicationScore: ratings.communication * 20,
        teamworkScore: ratings.teamwork * 20,
        strengths: form.strengths || 'Exemplary work ethics and dedication.',
        areasForImprovement: form.areasForImprovement || 'Keep up the proactive learning.',
        recommendation: form.recommendation as any,
      });

      toast.success('Evaluation submitted and synced with OJT Coordinator & Student!');
      setActiveTab('history');
      setForm((prev) => ({
        ...prev,
        strengths: '',
        areasForImprovement: '',
      }));
    } catch (err: any) {
      toast.error('Failed to submit evaluation: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const criteriaList = [
    { key: 'attendance' as const, title: '1. Attendance & Punctuality', desc: 'Reporting on time, consistency, compliance with designated schedule' },
    { key: 'performance' as const, title: '2. Performance & Work Quality', desc: 'Accuracy, competence, problem solving, output quality' },
    { key: 'attitude' as const, title: '3. Attitude & Professionalism', desc: 'Workplace conduct, discipline, respect, initiative, reliability' },
    { key: 'communication' as const, title: '4. Communication Skills', desc: 'Clarity, active listening, articulation, responsiveness' },
    { key: 'teamwork' as const, title: '5. Teamwork & Collaboration', desc: 'Ability to work constructively with colleagues and supervisors' },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Star className="text-amber-500" size={26} />
            <span>Trainee Performance Evaluation</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Evaluate student intern competencies; evaluations auto-sync directly with the OJT Instructor
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('evaluate')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'evaluate'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            New Evaluation
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            History ({hostFeedback.length})
          </button>
        </div>
      </div>

      {activeTab === 'evaluate' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student Selector Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <h2 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <GraduationCap className="text-blue-600" size={20} />
              <span>Select Trainee to Evaluate</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">Trainee *</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Select a student...</option>
                  {trainees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.course || 'Trainee'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTrainee && (
                <div className="flex items-center gap-3.5 p-3 bg-blue-50/60 rounded-2xl border border-blue-100">
                  <div className="w-12 h-12 rounded-xl bg-white border border-blue-200 flex items-center justify-center overflow-hidden shrink-0">
                    {selectedTrainee.photo ? (
                      <img src={getPhotoUrl(selectedTrainee.photo)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="text-blue-600" size={22} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 text-sm truncate">{selectedTrainee.name}</div>
                    <div className="text-xs text-blue-700 font-semibold truncate">{selectedTrainee.course}</div>
                    <div className="text-[11px] text-slate-500">{selectedTrainee.schoolName}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Core Evaluation Criteria */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Performance Criteria (1 to 5 Stars)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Rate the trainee across all 5 standard competencies</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200">
                <Star size={16} className="text-amber-500 fill-amber-500" />
                <span className="font-extrabold text-amber-900 text-sm">{overallRating}.0 / 5.0</span>
              </div>
            </div>

            <div className="space-y-5">
              {criteriaList.map(({ key, title, desc }) => (
                <div key={key} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">{title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => updateRating(key, star)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                          ratings[key] >= star
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'bg-white text-slate-400 border border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        {star}
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-700 min-w-[120px] ml-2 hidden lg:inline-block">
                      {RATING_LABELS[ratings[key]]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Qualitative Feedback */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">Qualitative Feedback & Recommendations</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Key Strengths & Achievements</label>
                <textarea
                  rows={3}
                  value={form.strengths}
                  onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                  placeholder="e.g. Exceptional teamwork, fast learner, punctual, disciplined..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Areas for Growth / Improvement</label>
                <textarea
                  rows={3}
                  value={form.areasForImprovement}
                  onChange={(e) => setForm({ ...form, areasForImprovement: e.target.value })}
                  placeholder="e.g. Further enhance technical presentation skills..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Overall Recommendation *</label>
              <select
                value={form.recommendation}
                onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Highly Recommended">Highly Recommended (Ready for employment)</option>
                <option value="Recommended">Recommended (Successfully completed requirements)</option>
                <option value="For Improvement">For Improvement (Requires additional training)</option>
                <option value="Not Recommended">Not Recommended</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-600/30 transition-all text-sm disabled:opacity-50"
            >
              <Send size={16} />
              <span>{submitting ? 'Submitting & Syncing...' : 'Submit Official Evaluation'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* Evaluation History Table */
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <History size={18} className="text-blue-600" />
              <span>Submitted Evaluations History</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Total: {hostFeedback.length} submitted
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Trainee</th>
                  <th className="px-4 py-3 font-bold">Evaluator / Company</th>
                  <th className="px-4 py-3 font-bold">Score</th>
                  <th className="px-4 py-3 font-bold">Recommendation</th>
                  <th className="px-4 py-3 font-bold">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hostFeedback.map((hf) => {
                  const emp = employees.find((e) => e.id === hf.employeeId);
                  return (
                    <tr key={hf.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{emp?.name || hf.employeeId}</div>
                        <div className="text-xs text-slate-500">{emp?.course || 'Trainee'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{hf.hostName}</div>
                        <div className="text-xs text-slate-500">{hf.hostCompany}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Star size={12} className="fill-amber-500 text-amber-500" />
                          {hf.overallScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {hf.recommendation || 'Recommended'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                        {new Date(hf.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
                {hostFeedback.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No evaluations submitted yet. Click "New Evaluation" to rate a student intern.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
