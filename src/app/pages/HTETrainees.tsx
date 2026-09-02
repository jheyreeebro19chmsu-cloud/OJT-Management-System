import {
  Users,
  Search,
  Star,
  Clock,
  Building,
  GraduationCap,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';

export function HTETrainees() {
  const navigate = useNavigate();
  const { employees, timeRecords, currentUser, getCurrentEmployee } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  const currentEmp = getCurrentEmployee();
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

  // Filter trainees (exclude instructors and non-trainees)
  const trainees = useMemo(() => {
    return employees.filter((e) => {
      const isTrainee = e.active && e.position !== 'OJT Instructor' && e.position !== 'HTE Representative';
      if (!isTrainee) return false;
      if (assignedTraineeIds.size === 0) return true;
      return assignedTraineeIds.has(e.id);
    });
  }, [employees, assignedTraineeIds]);

  // Calculate rendered hours for each trainee
  const traineeData = useMemo(() => {
    return trainees.map((trainee) => {
      const records = timeRecords.filter((r) => r.employeeId === trainee.id);
      const totalMinutes = records.reduce((acc, r) => {
        if (!r.timeIn || !r.timeOut) return acc;
        const [inH, inM] = r.timeIn.split(':').map(Number);
        const [outH, outM] = r.timeOut.split(':').map(Number);
        let mins = outH * 60 + outM - (inH * 60 + inM);
        if (mins < 0) mins += 24 * 60;
        return acc + mins;
      }, 0);
      const renderedHours = Math.round((totalMinutes / 60) * 10) / 10;
      const requiredHours = trainee.requiredHours || 486;
      const progressPercent = Math.min(Math.round((renderedHours / requiredHours) * 100), 100);

      return {
        ...trainee,
        renderedHours,
        requiredHours,
        progressPercent,
        totalLogs: records.length,
      };
    });
  }, [trainees, timeRecords]);

  const filteredTrainees = useMemo(() => {
    return traineeData.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.course && t.course.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.employeeId && t.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesDept = selectedDept === 'all' || t.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [traineeData, searchTerm, selectedDept]);

  const departments = useMemo(() => {
    const set = new Set(trainees.map((t) => t.department).filter(Boolean));
    return Array.from(set);
  }, [trainees]);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="text-blue-600" size={26} />
            <span>OJT Trainees</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor rendered hours, progress, and performance of student interns
          </p>
        </div>
        <button
          onClick={() => navigate('/hte/evaluations')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl shadow-md shadow-blue-600/20 transition-all"
        >
          <Star size={16} />
          <span>Evaluate Trainees</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, course, or ID..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>
        {departments.length > 0 && (
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Trainees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTrainees.map((trainee) => (
          <div
            key={trainee.id}
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Trainee Card Header */}
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                  {trainee.photo ? (
                    <img
                      src={getPhotoUrl(trainee.photo)}
                      alt={trainee.name}
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <GraduationCap size={22} className="text-blue-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                    {trainee.name}
                  </h3>
                  <p className="text-xs text-blue-600 font-semibold truncate mt-0.5">
                    {trainee.course || 'OJT Trainee'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                    ID: {trainee.employeeId || trainee.id.slice(0, 8)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 mb-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Rendered Hours</span>
                  <span className="font-extrabold text-slate-800 font-mono">
                    {trainee.renderedHours} / {trainee.requiredHours} hrs
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      trainee.progressPercent >= 100
                        ? 'bg-emerald-500'
                        : trainee.progressPercent >= 60
                          ? 'bg-blue-600'
                          : 'bg-amber-500'
                    }`}
                    style={{ width: `${trainee.progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{trainee.totalLogs} logged days</span>
                  <span className="font-bold text-blue-600">{trainee.progressPercent}% Completed</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => navigate(`/hte/evaluations?studentId=${trainee.id}`)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors"
              >
                <Star size={14} />
                <span>Evaluate</span>
              </button>
              <button
                onClick={() => navigate(`/hte/records`)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                <Clock size={14} />
                <span>View DTR</span>
              </button>
            </div>
          </div>
        ))}

        {filteredTrainees.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700">No trainees found</h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm ? 'Try adjusting your search criteria' : 'No student trainees assigned yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
