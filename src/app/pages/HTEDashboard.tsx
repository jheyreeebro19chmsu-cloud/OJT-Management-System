import {
  Users,
  Clock,
  CheckCircle2,
  Star,
  Megaphone,
  Building,
  GraduationCap,
  Calendar,
  Search,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  MapPin,
  FileText,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';

export function HTEDashboard() {
  const navigate = useNavigate();
  const { employees, timeRecords, hostFeedback, announcements, currentUser, getCurrentEmployee, settings } =
    useApp();
  const currentEmp = getCurrentEmployee();
  const [searchTerm, setSearchTerm] = useState('');

  const hteUser = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('ojt_hte_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const companyName =
    currentEmp?.companyName ||
    hteUser?.companyName ||
    localStorage.getItem('ojt_hte_company') ||
    'Host Training Establishment';

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

    employees
      .filter(
        (e) =>
          e.active &&
          e.position !== 'OJT Instructor' &&
          e.position !== 'HTE Representative' &&
          (e.companyName === companyName || e.companyName?.toLowerCase() === companyName.toLowerCase())
      )
      .forEach((e) => ids.add(e.id));

    return ids;
  }, [employees, companyName]);

  // Filter trainees
  const trainees = useMemo(() => {
    return employees.filter((e) => {
      const isTrainee = e.active && e.position !== 'OJT Instructor' && e.position !== 'HTE Representative';
      if (!isTrainee) return false;
      if (assignedTraineeIds.size === 0) return true;
      return assignedTraineeIds.has(e.id);
    });
  }, [employees, assignedTraineeIds]);

  // Compute rendered hours
  const traineeStats = useMemo(() => {
    return trainees.map((t) => {
      const records = timeRecords.filter((r) => r.employeeId === t.id);
      const totalMinutes = records.reduce((acc, r) => {
        if (!r.timeIn || !r.timeOut) return acc;
        const [inH, inM] = r.timeIn.split(':').map(Number);
        const [outH, outM] = r.timeOut.split(':').map(Number);
        let mins = outH * 60 + outM - (inH * 60 + inM);
        if (mins < 0) mins += 24 * 60;
        return acc + mins;
      }, 0);
      const renderedHours = Math.round((totalMinutes / 60) * 10) / 10;
      const requiredHours = t.requiredHours || 486;
      const progress = Math.min(Math.round((renderedHours / requiredHours) * 100), 100);
      const hasEvaluation = hostFeedback.some((hf) => hf.employeeId === t.id);

      return {
        ...t,
        renderedHours,
        requiredHours,
        progress,
        hasEvaluation,
        logCount: records.length,
      };
    });
  }, [trainees, timeRecords, hostFeedback]);

  // High-level summary metrics
  const totalRenderedHours = useMemo(() => {
    return traineeStats.reduce((sum, t) => sum + t.renderedHours, 0);
  }, [traineeStats]);

  const totalRequiredHours = useMemo(() => {
    return traineeStats.reduce((sum, t) => sum + t.requiredHours, 0);
  }, [traineeStats]);

  const evaluatedCount = useMemo(() => {
    return hostFeedback.length;
  }, [hostFeedback]);

  const filteredTrainees = useMemo(() => {
    return traineeStats.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.course && t.course.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [traineeStats, searchTerm]);

  // Recent time records for trainees
  const recentLogs = useMemo(() => {
    return timeRecords
      .slice(0, 8)
      .map((r) => {
        const emp = employees.find((e) => e.id === r.employeeId);
        return {
          ...r,
          employeeName: emp?.name || r.employeeId,
          course: emp?.course || 'Trainee',
        };
      });
  }, [timeRecords, employees]);

  return (
    <div className="space-y-6 font-sans">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 border border-white/10">
              <Building size={14} className="text-blue-300" />
              <span>{companyName}</span>
              <span className="text-white/40">•</span>
              <span className="text-emerald-300 font-bold">Partner Establishment</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome to HTE Management Portal
            </h1>
            <p className="text-blue-100 text-sm max-w-xl">
              Monitor student interns, track daily rendered hours, verify DTR logs, and submit performance evaluations
              synced with the university.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/hte/evaluations')}
              className="inline-flex items-center gap-2 px-5 py-3 bg-white text-blue-900 font-extrabold text-sm rounded-2xl hover:bg-blue-50 shadow-lg shadow-black/10 transition-all"
            >
              <Star size={16} className="text-amber-500 fill-amber-500" />
              <span>Evaluate Trainee</span>
            </button>
            <button
              onClick={() => navigate('/hte/records')}
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-700/60 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl border border-blue-400/30 backdrop-blur-sm transition-all"
            >
              <Clock size={16} />
              <span>View Time Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Trainees */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={26} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Interns</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{trainees.length}</p>
            <p className="text-[11px] text-blue-600 font-semibold mt-0.5">Assigned to Company</p>
          </div>
        </div>

        {/* Rendered Hours */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock size={26} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rendered Hours</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{Math.round(totalRenderedHours)} hrs</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Across all students</p>
          </div>
        </div>

        {/* Evaluations */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Star size={26} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evaluations</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{evaluatedCount}</p>
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Submitted & Synced</p>
          </div>
        </div>

        {/* Notices */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Megaphone size={26} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Announcements</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{announcements.length}</p>
            <p className="text-[11px] text-purple-600 font-semibold mt-0.5">University Advisories</p>
          </div>
        </div>
      </div>

      {/* Trainees Roster Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <GraduationCap className="text-blue-600" size={22} />
              <span>Assigned Student Interns</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Progress toward mandatory OJT rendered hours</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search intern name..."
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-60"
              />
            </div>
            <button
              onClick={() => navigate('/hte/trainees')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0"
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3">Student Intern</th>
                <th className="px-4 py-3">Course / Department</th>
                <th className="px-4 py-3">Rendered Hours</th>
                <th className="px-4 py-3">Evaluation</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredTrainees.slice(0, 6).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                        {t.photo ? (
                          <img src={getPhotoUrl(t.photo)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <GraduationCap size={18} className="text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">ID: {t.employeeId || t.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-bold text-blue-700">{t.course || 'OJT Trainee'}</div>
                    <div className="text-[11px] text-slate-500">{t.schoolName || 'CHMSU'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-36 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-slate-700">{t.renderedHours} hrs</span>
                        <span className="text-slate-400 font-mono">{t.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            t.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${t.progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {t.hasEvaluation ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} />
                        Evaluated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/hte/evaluations?studentId=${t.id}`)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors"
                    >
                      Evaluate
                    </button>
                  </td>
                </tr>
              ))}

              {filteredTrainees.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No trainees found matching your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent DTR Activity Logs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="text-emerald-600" size={22} />
            <span>Recent Trainee DTR Logs</span>
          </h2>
          <button
            onClick={() => navigate('/hte/records')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>View Full Log Sheet</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time In</th>
                <th className="px-4 py-3">Time Out</th>
                <th className="px-4 py-3">Geofence Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{log.employeeName}</div>
                    <div className="text-xs text-slate-500">{log.course}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.date}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-700">
                    {log.timeIn || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                    {log.timeOut || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <ShieldCheck size={12} />
                      Verified In Zone
                    </span>
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No recent time logs recorded yet.
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
