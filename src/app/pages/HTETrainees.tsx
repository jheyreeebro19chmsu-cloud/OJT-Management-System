import {
  Users,
  Search,
  Star,
  Clock,
  Building,
  GraduationCap,
  ChevronRight,
  UserCheck,
  RefreshCw,
  Filter,
  CheckCircle2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';
import { courseOptions } from '../data/academicOptions';

export function HTETrainees() {
  const navigate = useNavigate();
  const { employees, timeRecords, currentUser, getCurrentEmployee, settings, refreshData } = useApp();
  const currentEmp = getCurrentEmployee();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [filterScope, setFilterScope] = useState<'all' | 'assigned'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedProfileTrainee, setSelectedProfileTrainee] = useState<any | null>(null);

  const targetAY = settings?.activeAcademicYear || '2026-2027';
  const defaultAY = settings?.academicYears?.[0] || '2025-2026';

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
    '';

  const currentHteId = currentUser?.id || currentUser?.employeeId || currentEmp?.id || hteUser?.id || undefined;
  const currentCompany = (companyName || '').trim().toLowerCase();

  // All active student trainees eligible for OJT strictly in the active academic year
  const allOjtTrainees = useMemo(() => {
    return employees.filter((e) => {
      if (!e.active || e.position === 'OJT Instructor' || e.position === 'HTE Representative') return false;
      const empAY = e.academicYear || defaultAY;
      return empAY === targetAY;
    });
  }, [employees, targetAY, defaultAY]);

  // Show trainees based on filter scope (All trainees vs assigned to this HTE)
  const trainees = useMemo(() => {
    if (filterScope === 'all') {
      return allOjtTrainees;
    }

    return allOjtTrainees.filter((e) => {
      const isAssignedToCurrentHte = Boolean(e.hteId && currentHteId && e.hteId === currentHteId);
      const isCompanyMatched = Boolean(
        currentCompany &&
        currentCompany !== 'host training establishment' &&
        e.companyName &&
        e.companyName.trim().toLowerCase() === currentCompany
      );
      const isInstructorLinked = Boolean(e.instructorId && currentHteId && e.instructorId !== currentHteId);
      return isAssignedToCurrentHte || isCompanyMatched || isInstructorLinked;
    });
  }, [allOjtTrainees, filterScope, currentHteId, currentCompany]);

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

      const isDirectlyAssigned = Boolean(
        (trainee.hteId && currentHteId && trainee.hteId === currentHteId) ||
        (currentCompany && currentCompany !== 'host training establishment' && trainee.companyName && trainee.companyName.trim().toLowerCase() === currentCompany)
      );

      return {
        ...trainee,
        renderedHours,
        requiredHours,
        progressPercent,
        totalLogs: records.length,
        isDirectlyAssigned,
      };
    });
  }, [trainees, timeRecords, currentHteId, currentCompany]);

  // Combined list of courses from official academic options and registered trainees
  const allAvailableCourses = useMemo(() => {
    const set = new Set<string>();
    courseOptions.forEach((c) => set.add(c));
    allOjtTrainees.forEach((t) => {
      if (t.course) set.add(t.course);
    });
    return Array.from(set).sort();
  }, [allOjtTrainees]);

  // Trainee count per course for quick badge toggles
  const courseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    trainees.forEach((t) => {
      if (t.course) {
        counts[t.course] = (counts[t.course] || 0) + 1;
      }
    });
    return counts;
  }, [trainees]);

  // Courses that currently have at least 1 trainee in the active scope
  const activeCoursesWithTrainees = useMemo(() => {
    return Object.keys(courseCounts).sort((a, b) => (courseCounts[b] || 0) - (courseCounts[a] || 0));
  }, [courseCounts]);

  const filteredTrainees = useMemo(() => {
    return traineeData.filter((t) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        t.name.toLowerCase().includes(q) ||
        (t.course && t.course.toLowerCase().includes(q)) ||
        (t.department && t.department.toLowerCase().includes(q)) ||
        (t.companyName && t.companyName.toLowerCase().includes(q)) ||
        (t.employeeId && t.employeeId.toLowerCase().includes(q));
      const matchesCourse = selectedCourse === 'all' || t.course === selectedCourse;
      return matchesSearch && matchesCourse;
    });
  }, [traineeData, searchTerm, selectedCourse]);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await refreshData();
      toast.success('Trainee accounts synchronized from database');
    } catch {
      toast.error('Failed to sync data');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="text-blue-600" size={26} />
              <span>OJT Trainees</span>
            </h1>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
              {filteredTrainees.length} total
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Monitor rendered hours, progress, and performance of student interns across all degree programs
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Sync latest trainee registrations from database"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-2xl transition-all disabled:opacity-60"
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Database'}</span>
          </button>

          <button
            onClick={() => navigate('/hte/evaluations')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl shadow-md shadow-blue-600/20 transition-all"
          >
            <Star size={16} />
            <span>Evaluate Trainees</span>
          </button>
        </div>
      </div>

      {/* Trainee Scope Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterScope('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              filterScope === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sparkles size={14} />
            <span>All Registered Trainees</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              filterScope === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {allOjtTrainees.length}
            </span>
          </button>

          <button
            onClick={() => setFilterScope('assigned')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              filterScope === 'assigned'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <UserCheck size={14} />
            <span>My Establishment</span>
            {companyName && (
              <span className="max-w-[120px] truncate text-[11px] opacity-80">
                ({companyName})
              </span>
            )}
          </button>
        </div>

        {selectedCourse !== 'all' && (
          <div className="flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
            <span>Filter: <strong>{selectedCourse}</strong></span>
            <button
              onClick={() => setSelectedCourse('all')}
              className="text-blue-500 hover:text-blue-900 font-bold ml-1 text-sm"
              title="Reset course filter"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Interactive Course Toggle Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <GraduationCap size={16} className="text-blue-600" />
            <span>Toggle Trainee Courses</span>
          </div>
          <span className="text-xs text-slate-400">
            Click any course to filter trainees
          </span>
        </div>

        {/* Quick Horizontal Toggle Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setSelectedCourse('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedCourse === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>All Courses</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              selectedCourse === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {trainees.length}
            </span>
          </button>

          {activeCoursesWithTrainees.map((course) => {
            const isSelected = selectedCourse === course;
            const count = courseCounts[course] || 0;
            return (
              <button
                key={course}
                onClick={() => setSelectedCourse(course)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                }`}
                title={course}
              >
                <span className="truncate max-w-[200px]">{course}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, course, company, or ID..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>

        {/* Complete Course Dropdown Selection */}
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs min-w-0 max-w-sm truncate"
          title={selectedCourse === 'all' ? 'Filter by All Courses' : selectedCourse}
        >
          <option value="all">All Courses ({trainees.length})</option>
          {allAvailableCourses.map((course) => {
            const count = courseCounts[course] || 0;
            return (
              <option key={course} value={course}>
                {course} {count > 0 ? `(${count})` : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Trainees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTrainees.map((trainee) => (
          <div
            key={trainee.id}
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between relative group"
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                      {trainee.name}
                    </h3>
                    {trainee.isDirectlyAssigned && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                        Assigned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-600 font-semibold truncate mt-0.5" title={trainee.course}>
                    {trainee.course || 'OJT Trainee'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono truncate">
                    <span>ID: {trainee.employeeId || trainee.id.slice(0, 8)}</span>
                    {trainee.companyName && (
                      <span className="text-slate-500 font-sans truncate">
                        • {trainee.companyName}
                      </span>
                    )}
                  </div>
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
                onClick={() => setSelectedProfileTrainee(trainee)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <User size={14} />
                <span>View Profile</span>
              </button>
            </div>
          </div>
        ))}

        {filteredTrainees.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700">No trainees found</h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm || selectedCourse !== 'all'
                ? 'Try adjusting your course or search filter'
                : 'No student trainees registered yet'}
            </p>
            {selectedCourse !== 'all' && (
              <button
                onClick={() => setSelectedCourse('all')}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl"
              >
                Show All Courses
              </button>
            )}
          </div>
        )}
      </div>

      {/* Trainee Profile Modal */}
      {selectedProfileTrainee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                  {selectedProfileTrainee.photo ? (
                    <img
                      src={getPhotoUrl(selectedProfileTrainee.photo)}
                      alt={selectedProfileTrainee.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={28} className="text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{selectedProfileTrainee.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {selectedProfileTrainee.employeeId || selectedProfileTrainee.id.slice(0, 8)}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                      {selectedProfileTrainee.course || 'OJT Trainee'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProfileTrainee(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Academic & University Particulars */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <GraduationCap size={14} className="text-blue-600" />
                <span>Academic & Institutional Details</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">University:</span>
                  <span className="font-medium text-slate-800">{selectedProfileTrainee.schoolName || 'Carlos Hilado Memorial State University'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Campus:</span>
                  <span className="font-medium text-slate-800">{selectedProfileTrainee.campus || 'Main Campus'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">College Department:</span>
                  <span className="font-medium text-slate-800">{selectedProfileTrainee.department || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Degree Program:</span>
                  <span className="font-bold text-slate-900">{selectedProfileTrainee.course || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Academic Year:</span>
                  <span className="font-bold text-emerald-700">AY {selectedProfileTrainee.academicYear || settings?.activeAcademicYear || '2026-2027'}</span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User size={14} className="text-blue-600" />
                <span>Contact & Personal Details</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Email Address:</span>
                  <span className="font-medium text-slate-800 break-all">{selectedProfileTrainee.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Contact Number:</span>
                  <span className="font-medium text-slate-800">{selectedProfileTrainee.contactPhone || selectedProfileTrainee.phone || 'Not specified'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-semibold block">Residential Address:</span>
                  <span className="font-medium text-slate-800">
                    {selectedProfileTrainee.address ||
                      [selectedProfileTrainee.street, selectedProfileTrainee.barangay, selectedProfileTrainee.city, selectedProfileTrainee.province]
                        .filter(Boolean)
                        .join(', ') ||
                      'Not recorded'}
                  </span>
                </div>
              </div>
            </div>

            {/* OJT Rendered Hours & Progress */}
            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-600" />
                  <span>OJT Rendered Hours</span>
                </h4>
                <span className="text-xs font-black text-blue-700">{selectedProfileTrainee.progressPercent}%</span>
              </div>
              <div className="h-2.5 bg-blue-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${selectedProfileTrainee.progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 font-medium pt-1">
                <span>Rendered: <strong className="text-slate-900">{selectedProfileTrainee.renderedHours}h</strong></span>
                <span>Required: <strong className="text-slate-900">{selectedProfileTrainee.requiredHours}h</strong></span>
                <span>Logs: <strong className="text-slate-900">{selectedProfileTrainee.totalLogs}</strong></span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedProfileTrainee(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = selectedProfileTrainee.id;
                  setSelectedProfileTrainee(null);
                  navigate(`/hte/evaluations?studentId=${id}`);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Star size={13} />
                <span>Evaluate Trainee</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
