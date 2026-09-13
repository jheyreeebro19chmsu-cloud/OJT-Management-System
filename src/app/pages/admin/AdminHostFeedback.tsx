import { Star, Building, CheckCircle2, Archive, Filter, Sparkles, ThumbsUp, AlertCircle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useMemo, useState } from 'react';

import { useApp } from '../../store/AppContext';

const STATUS_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  submitted: { bg: 'bg-amber-50 text-amber-700', border: 'border-amber-200/60', text: 'Needs Review' },
  reviewed: { bg: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200/60', text: 'Reviewed' },
  archived: { bg: 'bg-slate-100 text-slate-600', border: 'border-slate-200', text: 'Archived' },
};

export function AdminHostFeedback() {
  const { hostFeedback, employees, updateHostFeedback, settings } = useApp();
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(settings?.activeAcademicYear || 'all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    return hostFeedback.filter((item) => {
      if (selectedAcademicYear !== 'all') {
        const itemYear = item.academicYear || employees.find((e) => e.id === item.employeeId)?.academicYear;
        if (itemYear && itemYear !== selectedAcademicYear) return false;
      }
      if (employeeFilter !== 'all' && item.employeeId !== employeeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    });
  }, [hostFeedback, employeeFilter, statusFilter, selectedAcademicYear, employees]);

  const summary = useMemo(() => {
    if (hostFeedback.length === 0) return { avg: 0, submitted: 0, reviewed: 0, archived: 0 };
    const total = hostFeedback.reduce((sum, f) => sum + f.overallScore, 0);
    return {
      avg: Math.round(total / hostFeedback.length),
      submitted: hostFeedback.filter((f) => f.status === 'submitted').length,
      reviewed: hostFeedback.filter((f) => f.status === 'reviewed').length,
      archived: hostFeedback.filter((f) => f.status === 'archived').length,
    };
  }, [hostFeedback]);

  const getTrainee = (id: string) => employees.find((e) => e.id === id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Modern Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-blue-500/10"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Host Establishment Feedback</h1>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white border border-white/20">
                  A.Y. {settings.activeAcademicYear || '2026-2027'}
                </span>
              </div>
              <p className="text-sm text-blue-100/90 mt-1 max-w-2xl leading-relaxed">
                Trainee evaluations and feedback reports regarding their Host Training Establishment (HTE) placement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-xs text-white">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>{hostFeedback.length} Total Submissions</span>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
      </motion.div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Score</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">{summary.avg}%</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
              Overall Rating
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg border border-amber-100">
            ★
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Needs Review</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">{summary.submitted}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Pending evaluation</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Reviewed</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1">{summary.reviewed}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Acknowledged</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Archived</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-600 mt-1">{summary.archived}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Saved records</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-200">
            <Archive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
            <Filter size={14} className="text-blue-600" />
            Filters
          </div>

          <select
            value={selectedAcademicYear}
            onChange={(e) => setSelectedAcademicYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Academic Years</option>
            {settings.academicYears.map((ay) => (
              <option key={ay} value={ay}>
                A.Y. {ay} {ay === settings.activeAcademicYear ? '(Active)' : ''}
              </option>
            ))}
          </select>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Trainees</option>
            {employees
              .filter((e) => e.active && e.position !== 'OJT Instructor' && e.position !== 'HTE Representative')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="submitted">Needs Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing <strong className="text-slate-800">{filtered.length}</strong> submission{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Submissions List */}
      <div className="space-y-4">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl p-12 border border-dashed border-slate-300 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-blue-500 stroke-1" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Feedback Records Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                There are currently no trainee feedback submissions matching the selected filters.
              </p>
            </motion.div>
          ) : (
            filtered.map((item) => {
              const badge = STATUS_BADGES[item.status] || STATUS_BADGES.submitted;
              const trainee = getTrainee(item.employeeId);
              const initials = trainee?.name
                ? trainee.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                : 'ST';

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Top Bar: Trainee Info + Status */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                        {initials}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900 leading-snug">
                          {trainee?.name || 'Student Trainee'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span>{trainee?.course || 'OJT Trainee'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <Building size={12} className="text-blue-600" />
                            {item.hostCompany}
                          </span>
                          {item.hostName && (
                            <>
                              <span>•</span>
                              <span>Supervisor: {item.hostName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.border}`}>
                        {badge.text}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(item.submittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Rating Category Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-5">
                    <ScoreCard label="Attendance" score={item.attendanceScore} />
                    <ScoreCard label="Performance" score={item.performanceScore} />
                    <ScoreCard label="Attitude" score={item.attitudeScore} />
                    <ScoreCard label="Communication" score={item.communicationScore} />
                    <ScoreCard label="Teamwork" score={item.teamworkScore} />
                  </div>

                  {/* Written Feedback Sections */}
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4">
                      <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                        <ThumbsUp size={13} className="text-emerald-600" />
                        Key Strengths Identified
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {item.strengths || 'No specific strengths noted.'}
                      </p>
                    </div>

                    <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4">
                      <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                        <Star size={13} className="text-blue-600" />
                        Areas for Improvement / Notes
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {item.areasForImprovement || 'None noted.'}
                      </p>
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-400">Recommendation:</span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                        {item.recommendation || 'Standard Placement'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status !== 'reviewed' && (
                        <button
                          onClick={() => updateHostFeedback(item.id, { status: 'reviewed' })}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-600/10 cursor-pointer"
                        >
                          <CheckCircle2 size={14} />
                          Mark as Reviewed
                        </button>
                      )}
                      {item.status !== 'archived' && (
                        <button
                          onClick={() => updateHostFeedback(item.id, { status: 'archived' })}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Archive size={14} />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const getBadgeColor = (val: number) => {
    if (val >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200/70';
    if (val >= 75) return 'text-blue-700 bg-blue-50 border-blue-200/70';
    return 'text-amber-700 bg-amber-50 border-amber-200/70';
  };

  return (
    <div className={`p-3 rounded-2xl border ${getBadgeColor(score)} flex flex-col justify-between`}>
      <p className="text-[11px] font-medium opacity-85 truncate">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-lg font-extrabold">{score}</span>
        <span className="text-[10px] font-bold opacity-75">%</span>
      </div>
    </div>
  );
}
