import React, { useMemo, useState } from 'react';
import { Star, User, Building, CheckCircle, Archive, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../store/AppContext';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  submitted: { bg: 'bg-amber-100', text: 'text-amber-700' },
  reviewed: { bg: 'bg-green-100', text: 'text-green-700' },
  archived: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export function AdminHostFeedback() {
  const { hostFeedback, employees, updateHostFeedback } = useApp();
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    return hostFeedback.filter(item => {
      if (employeeFilter !== 'all' && item.employeeId !== employeeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    });
  }, [hostFeedback, employeeFilter, statusFilter]);

  const summary = useMemo(() => {
    if (hostFeedback.length === 0) return { avg: 0, submitted: 0, reviewed: 0, archived: 0 };
    const total = hostFeedback.reduce((sum, f) => sum + f.overallScore, 0);
    return {
      avg: Math.round(total / hostFeedback.length),
      submitted: hostFeedback.filter(f => f.status === 'submitted').length,
      reviewed: hostFeedback.filter(f => f.status === 'reviewed').length,
      archived: hostFeedback.filter(f => f.status === 'archived').length,
    };
  }, [hostFeedback]);

  const employeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Unknown Trainee';

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Star size={18} className="text-blue-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Host Establishment Feedback</h2>
            <p className="text-xs text-gray-500">Monitor and review feedback submitted by host supervisors</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Average Score" value={`${summary.avg}%`} />
        <SummaryCard label="Submitted" value={summary.submitted} />
        <SummaryCard label="Reviewed" value={summary.reviewed} />
        <SummaryCard label="Archived" value={summary.archived} />
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter size={14} />
          Filters
        </div>
        <select
          value={employeeFilter}
          onChange={e => setEmployeeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm"
        >
          <option value="all">All Trainees</option>
          {employees.filter(e => e.active && e.position !== 'OJT Instructor').map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm"
        >
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-gray-500">
              No host feedback records yet.
            </motion.div>
          ) : (
            filtered.map(item => {
              const style = STATUS_STYLES[item.status];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{employeeName(item.employeeId)}</h3>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                        <Building size={12} />
                        {item.hostCompany} - {item.hostName}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{new Date(item.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </div>

                  <div className="grid gap-2 mt-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
                    <ScorePill label="Attendance" value={item.attendanceScore} />
                    <ScorePill label="Performance" value={item.performanceScore} />
                    <ScorePill label="Attitude" value={item.attitudeScore} />
                    <ScorePill label="Communication" value={item.communicationScore} />
                    <ScorePill label="Teamwork" value={item.teamworkScore} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Strengths</p>
                      <p className="text-sm text-gray-700">{item.strengths || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Areas for Improvement</p>
                      <p className="text-sm text-gray-700">{item.areasForImprovement || '-'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <User size={12} />
                      Recommendation: <span className="font-semibold text-gray-700">{item.recommendation}</span>
                    </div>
                    <div className="flex gap-2">
                      {item.status !== 'reviewed' && (
                        <button
                          onClick={() => updateHostFeedback(item.id, { status: 'reviewed' })}
                          className="px-3 py-2 rounded-xl text-xs bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                        >
                          <CheckCircle size={12} />
                          Mark Reviewed
                        </button>
                      )}
                      {item.status !== 'archived' && (
                        <button
                          onClick={() => updateHostFeedback(item.id, { status: 'archived' })}
                          className="px-3 py-2 rounded-xl text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center gap-1"
                        >
                          <Archive size={12} />
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

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-2 text-center">
      <p className="text-[11px] text-blue-700">{label}</p>
      <p className="text-sm font-bold text-blue-900">{value}%</p>
    </div>
  );
}
