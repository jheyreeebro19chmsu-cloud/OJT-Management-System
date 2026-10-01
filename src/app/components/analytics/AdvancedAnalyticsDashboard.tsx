import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Clock,
  Calendar,
  Building,
  Users,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  BarChart3,
  BookOpen,
  MapPin,
  CheckCircle,
  AlertCircle,
  Award,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  ReferenceLine,
} from 'recharts';

import { Employee, TimeRecord } from '../../types';

interface AdvancedAnalyticsDashboardProps {
  records: TimeRecord[];
  allRecords: TimeRecord[];
  trainees: Employee[];
  selectedMonth: string; // "YYYY-MM" or "all"
  selectedAcademicYear?: string;
}

type AnalyticsViewMode = 'attendance_trend' | 'trainee_milestones' | 'by_hte' | 'by_program' | 'heatmap';
type TimeGranularity = 'daily' | 'weekly' | 'monthly';

export function AdvancedAnalyticsDashboard({
  records,
  allRecords,
  trainees,
  selectedMonth,
  selectedAcademicYear,
}: AdvancedAnalyticsDashboardProps) {
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>('attendance_trend');
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('daily');
  const [hoveredCalendarDay, setHoveredCalendarDay] = useState<any | null>(null);

  // Parse Year and Month for filtering and labels
  const { year, month, daysInMonth, monthLabel, monthKey } = useMemo(() => {
    const fallbackMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const targetKey = selectedMonth === 'all' ? fallbackMonth : selectedMonth;
    const parts = targetKey.split('-');
    const y = parseInt(parts[0], 10) || new Date().getFullYear();
    const m = (parseInt(parts[1], 10) || new Date().getMonth() + 1) - 1;
    const days = new Date(y, m + 1, 0).getDate();
    const dateObj = new Date(y, m, 1);
    const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { year: y, month: m, daysInMonth: days, monthLabel: label, monthKey: targetKey };
  }, [selectedMonth]);

  // Total Trainee Count
  const totalTrainees = trainees.length || 0;

  // -------------------------------------------------------------
  // 1. INDIVIDUAL TRAINEE TOTALS & MILESTONES (All-Time Progress)
  // -------------------------------------------------------------
  const traineeProgressList = useMemo(() => {
    return trainees.map((t) => {
      const requiredHours = Number(t.requiredHours) || 486;
      // All-time records for this specific trainee
      const studentRecords = allRecords.filter(
        (r) => r.employeeId === t.id || r.employeeId === t.employeeId
      );
      const renderedHours = studentRecords.reduce(
        (sum, r) => sum + (Number(r.totalHours) || 0),
        0
      );
      const roundedRendered = Math.round(renderedHours * 10) / 10;
      const progressPercent = Math.min(100, Math.round((roundedRendered / requiredHours) * 100));
      const remainingHours = Math.max(0, Math.round((requiredHours - roundedRendered) * 10) / 10);

      // Current month rendered hours
      const thisMonthRecords = records.filter(
        (r) => r.employeeId === t.id || r.employeeId === t.employeeId
      );
      const thisMonthHours = Math.round(
        thisMonthRecords.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0) * 10
      ) / 10;

      // Status Category
      let milestone: 'completed' | 'near_completion' | 'in_progress' | 'just_started' = 'just_started';
      if (roundedRendered >= requiredHours) {
        milestone = 'completed';
      } else if (progressPercent >= 75) {
        milestone = 'near_completion';
      } else if (progressPercent >= 25) {
        milestone = 'in_progress';
      } else {
        milestone = 'just_started';
      }

      return {
        id: t.id,
        name: t.name,
        employeeId: t.employeeId || 'OJT-ID',
        course: t.course || t.department || 'BSIT',
        companyName: t.companyName?.trim() || 'Pending Assignment',
        requiredHours,
        renderedHours: roundedRendered,
        remainingHours,
        progressPercent,
        thisMonthHours,
        milestone,
        active: roundedRendered > 0,
      };
    }).sort((a, b) => b.renderedHours - a.renderedHours);
  }, [trainees, allRecords, records]);

  // Milestone Counts for Cohort Summary
  const milestoneCounts = useMemo(() => {
    const counts = {
      completed: 0,
      near_completion: 0,
      in_progress: 0,
      just_started: 0,
    };
    traineeProgressList.forEach((t) => {
      counts[t.milestone]++;
    });
    return counts;
  }, [traineeProgressList]);

  // -------------------------------------------------------------
  // 2. CORE OJT SUMMARY KPIS (Understandable & Relevant)
  // -------------------------------------------------------------
  const ojtSummary = useMemo(() => {
    // Total required hours across all trainees (standard 486h per trainee)
    const totalRequired = traineeProgressList.reduce((sum, t) => sum + t.requiredHours, 0);
    // Total rendered hours by all trainees to date
    const totalRendered = traineeProgressList.reduce((sum, t) => sum + t.renderedHours, 0);
    const overallProgressPercent = totalRequired > 0 ? Math.round((totalRendered / totalRequired) * 100) : 0;
    const totalRemaining = Math.max(0, totalRequired - totalRendered);

    // Month specific hours
    const monthRendered = records.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);

    // Active Trainees in this period (trainees who logged at least 1 record this month)
    const activeStudentIds = new Set(records.map((r) => r.employeeId));
    const activeInMonthCount = activeStudentIds.size;
    const participationRate = totalTrainees > 0 ? Math.round((activeInMonthCount / totalTrainees) * 100) : 0;

    // Average hours completed per student
    const avgHoursPerTrainee = totalTrainees > 0 ? Math.round((totalRendered / totalTrainees) * 10) / 10 : 0;

    // Attendance health metrics from records
    let presentCount = 0;
    let lateCount = 0;
    let geofencedCount = 0;
    const totalLogs = records.length;

    records.forEach((r) => {
      if (r.status === 'present' || r.status === 'overtime') presentCount++;
      if (r.status === 'late') lateCount++;
      if (r.timeInGeofenced) geofencedCount++;
    });

    const onTimeRate = (presentCount + lateCount) > 0
      ? Math.round((presentCount / (presentCount + lateCount)) * 100)
      : 100;

    const geofenceComplianceRate = totalLogs > 0
      ? Math.round((geofencedCount / totalLogs) * 100)
      : 100;

    return {
      totalRequired,
      totalRendered: Math.round(totalRendered * 10) / 10,
      totalRemaining: Math.round(totalRemaining * 10) / 10,
      overallProgressPercent,
      monthRendered: Math.round(monthRendered * 10) / 10,
      activeInMonthCount,
      participationRate,
      avgHoursPerTrainee,
      onTimeRate,
      geofenceComplianceRate,
      totalLogs,
      presentCount,
      lateCount,
    };
  }, [traineeProgressList, records, totalTrainees]);

  // -------------------------------------------------------------
  // 3. DAILY ATTENDANCE & HOURS (Month Breakdown)
  // -------------------------------------------------------------
  const dailyAttendanceData = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${monthKey}-${String(dayNum).padStart(2, '0')}`;
      const dayDate = new Date(year, month, dayNum);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const weekdayShort = dayDate.toLocaleDateString('en-US', { weekday: 'short' });

      const dayRecs = records.filter((r) => r.date === dateStr);
      let dayHours = 0;
      let present = 0;
      let late = 0;
      const uniqueStudents = new Set<string>();

      dayRecs.forEach((r) => {
        const h = Number(r.totalHours) || 0;
        dayHours += h;
        if (r.status === 'late') late++;
        else present++;
        if (r.employeeId) uniqueStudents.add(r.employeeId);
      });

      return {
        day: String(dayNum),
        dateStr,
        weekdayShort,
        isWeekend,
        totalHours: Math.round(dayHours * 10) / 10,
        studentCount: uniqueStudents.size,
        presentCount: present,
        lateCount: late,
        recordCount: dayRecs.length,
      };
    });
  }, [records, daysInMonth, monthKey, year, month]);

  // -------------------------------------------------------------
  // 4. WEEKLY TOTALS
  // -------------------------------------------------------------
  const weeklyAttendanceData = useMemo(() => {
    const weeks: {
      week: string;
      range: string;
      totalHours: number;
      studentCount: number;
      avgHoursPerDay: number;
    }[] = [];

    const weekSize = 7;
    const numWeeks = Math.ceil(daysInMonth / weekSize);

    for (let w = 0; w < numWeeks; w++) {
      const startDay = w * weekSize + 1;
      const endDay = Math.min(daysInMonth, (w + 1) * weekSize);
      const daysSlice = dailyAttendanceData.slice(startDay - 1, endDay);

      const totHours = daysSlice.reduce((s, d) => s + d.totalHours, 0);
      const maxStudentsOnAnyDay = Math.max(0, ...daysSlice.map((d) => d.studentCount));
      const workdaysInSlice = daysSlice.filter((d) => !d.isWeekend).length || 5;

      weeks.push({
        week: `Week ${w + 1}`,
        range: `Day ${startDay}–${endDay}`,
        totalHours: Math.round(totHours * 10) / 10,
        studentCount: maxStudentsOnAnyDay,
        avgHoursPerDay: Math.round((totHours / workdaysInSlice) * 10) / 10,
      });
    }

    return weeks;
  }, [dailyAttendanceData, daysInMonth]);

  // -------------------------------------------------------------
  // 5. MONTHLY HISTORICAL TREND (Past 6 Months)
  // -------------------------------------------------------------
  const monthlyTrendData = useMemo(() => {
    const list: {
      monthLabel: string;
      monthKey: string;
      totalHours: number;
      activeStudents: number;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const mRecs = allRecords.filter((r) => r.date.startsWith(mKey));
      const hours = mRecs.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);
      const studentSet = new Set(mRecs.map((r) => r.employeeId));

      list.push({
        monthLabel: label,
        monthKey: mKey,
        totalHours: Math.round(hours * 10) / 10,
        activeStudents: studentSet.size,
      });
    }

    return list;
  }, [allRecords, year, month]);

  // -------------------------------------------------------------
  // 6. BY HOST TRAINING ESTABLISHMENT (HTE) LEADERBOARD
  // -------------------------------------------------------------
  const hteLeaderboard = useMemo(() => {
    const companyMap: Record<
      string,
      { totalHours: number; trainees: Set<string>; logCount: number }
    > = {};

    // Populate with registered trainees
    trainees.forEach((t) => {
      const cName = t.companyName?.trim() || 'Pending Assignment';
      if (!companyMap[cName]) {
        companyMap[cName] = { totalHours: 0, trainees: new Set(), logCount: 0 };
      }
      companyMap[cName].trainees.add(t.id);
    });

    // Accumulate total rendered hours per company from records
    allRecords.forEach((r) => {
      const emp = trainees.find((t) => t.id === r.employeeId || t.employeeId === r.employeeId);
      const cName = emp?.companyName?.trim() || 'Other Training Station';
      if (!companyMap[cName]) {
        companyMap[cName] = { totalHours: 0, trainees: new Set(), logCount: 0 };
      }
      companyMap[cName].totalHours += Number(r.totalHours) || 0;
      companyMap[cName].logCount++;
    });

    return Object.entries(companyMap)
      .map(([name, data]) => {
        const studentCount = data.trainees.size;
        const total = Math.round(data.totalHours * 10) / 10;
        return {
          name,
          shortName: name.length > 22 ? name.slice(0, 20) + '…' : name,
          studentCount,
          totalHours: total,
          avgHoursPerStudent: studentCount > 0 ? Math.round((total / studentCount) * 10) / 10 : 0,
        };
      })
      .filter((c) => c.studentCount > 0 || c.totalHours > 0)
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 8); // Top 8 companies
  }, [trainees, allRecords]);

  // -------------------------------------------------------------
  // 7. BY ACADEMIC PROGRAM / COURSE COMPARISON (BSIT vs BSCS etc)
  // -------------------------------------------------------------
  const programComparison = useMemo(() => {
    const progMap: Record<
      string,
      {
        courseName: string;
        studentCount: number;
        totalRendered: number;
        totalRequired: number;
      }
    > = {};

    traineeProgressList.forEach((t) => {
      const c = t.course || 'BSIT';
      if (!progMap[c]) {
        progMap[c] = {
          courseName: c,
          studentCount: 0,
          totalRendered: 0,
          totalRequired: 0,
        };
      }
      progMap[c].studentCount++;
      progMap[c].totalRendered += t.renderedHours;
      progMap[c].totalRequired += t.requiredHours;
    });

    return Object.values(progMap).map((p) => {
      const completionRate = p.totalRequired > 0 ? Math.round((p.totalRendered / p.totalRequired) * 100) : 0;
      const avgHours = p.studentCount > 0 ? Math.round((p.totalRendered / p.studentCount) * 10) / 10 : 0;
      return {
        course: p.courseName,
        studentCount: p.studentCount,
        totalRendered: Math.round(p.totalRendered * 10) / 10,
        totalRequired: Math.round(p.totalRequired * 10) / 10,
        avgHours,
        completionRate,
      };
    }).sort((a, b) => b.studentCount - a.studentCount);
  }, [traineeProgressList]);

  // -------------------------------------------------------------
  // 8. CALENDAR HEATMAP MATRIX
  // -------------------------------------------------------------
  const heatmapMatrix = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
    const cells: (typeof dailyAttendanceData[0] | null)[] = [];

    // Prepend empty slots
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    // Add day cells
    dailyAttendanceData.forEach((dayItem) => {
      cells.push(dayItem);
    });

    return cells;
  }, [dailyAttendanceData, year, month]);

  const maxDailyAttendanceHours = useMemo(() => {
    return Math.max(...dailyAttendanceData.map((d) => d.totalHours), 1);
  }, [dailyAttendanceData]);

  const getHeatmapColor = (hours: number, isWeekend: boolean) => {
    if (hours === 0) {
      return isWeekend
        ? 'bg-slate-50 text-slate-400 border-slate-200'
        : 'bg-slate-100/70 text-slate-500 border-slate-200';
    }
    const ratio = hours / maxDailyAttendanceHours;
    if (ratio < 0.25) return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    if (ratio < 0.55) return 'bg-emerald-200 text-emerald-950 border-emerald-300 font-bold';
    if (ratio < 0.8) return 'bg-emerald-500 text-white border-emerald-600 font-bold shadow-xs';
    return 'bg-emerald-700 text-white border-emerald-800 font-black shadow-xs ring-1 ring-emerald-300';
  };

  return (
    <div className="space-y-6 bg-white p-5 sm:p-7 rounded-3xl border border-slate-200 shadow-sm font-sans">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER SECTION                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                OJT Cohort Progress &amp; Attendance Analytics
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <Sparkles size={11} /> Live Progress
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Academic requirement tracking (486h standard), student completion status, and partner establishment duty hours for {monthLabel}
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 flex-wrap bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('attendance_trend')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'attendance_trend'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 size={13} />
            <span>Attendance Trend</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('trainee_milestones')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'trainee_milestones'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award size={13} />
            <span>Student Milestones</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('by_hte')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'by_hte'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building size={13} />
            <span>Partner Companies</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('by_program')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'by_program'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen size={13} />
            <span>Programs (BSIT/BSCS)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'heatmap'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar size={13} />
            <span>Monthly Heatmap</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4 CORE OJT METRIC CARDS (Natural Academic Metrics)                */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Rendered vs Required */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/50 border border-blue-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Cohort OJT Completion</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <GraduationCap size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-900">{ojtSummary.overallProgressPercent}%</span>
            <span className="text-xs text-blue-700 font-semibold">of 486h requirement</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-blue-200/70 h-2 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ojtSummary.overallProgressPercent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
            <span>{ojtSummary.totalRendered}h rendered</span>
            <span className="font-semibold text-slate-800">{ojtSummary.totalRemaining}h remaining</span>
          </div>
        </div>

        {/* Metric 2: Average Hours Per Trainee */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-purple-50/50 border border-indigo-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Average Hours / Student</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-900">{ojtSummary.avgHoursPerTrainee}h</span>
            <span className="text-xs text-slate-500 font-medium">rendered average</span>
          </div>
          <p className="mt-2.5 text-xs text-slate-600">
            Target: <strong className="text-slate-800">486 hours</strong> per student
          </p>
          <div className="mt-2 text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
            <TrendingUp size={12} />
            <span>{ojtSummary.monthRendered}h logged in {monthLabel}</span>
          </div>
        </div>

        {/* Metric 3: Active Trainee Participation */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Active Trainees</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-900">
              {ojtSummary.activeInMonthCount} / {totalTrainees}
            </span>
            <span className="text-xs text-emerald-700 font-bold">({ojtSummary.participationRate}%)</span>
          </div>
          <p className="mt-2.5 text-xs text-slate-600">
            Actively reporting to host companies
          </p>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{totalTrainees - ojtSummary.activeInMonthCount} inactive / pending</span>
            <span className="font-bold text-emerald-700">Enrolled: {totalTrainees}</span>
          </div>
        </div>

        {/* Metric 4: Punctuality & Verification Health */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-orange-50/50 border border-amber-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Attendance Punctuality</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900">{ojtSummary.onTimeRate}%</span>
            <span className="text-xs text-amber-800 font-semibold">on-time arrival rate</span>
          </div>
          <p className="mt-2.5 text-xs text-slate-600">
            Geofence Verified: <strong className="text-emerald-700">{ojtSummary.geofenceComplianceRate}%</strong>
          </p>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{ojtSummary.lateCount} late records</span>
            <span className="font-semibold text-slate-700">{ojtSummary.totalLogs} total logs</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* STUDENT MILESTONE DISTRIBUTION BANNER                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-blue-700" />
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Student Requirement Completion Stages
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Curriculum Standard: <strong>486 Hours</strong> per Trainee
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Stage 1: Completed */}
          <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-emerald-700">{milestoneCounts.completed}</span>
                <span className="text-[11px] text-slate-500">students</span>
              </div>
              <p className="text-[11px] font-bold text-slate-700 truncate">Completed (100%)</p>
              <p className="text-[10px] text-emerald-600">486+ hours reached</p>
            </div>
          </div>

          {/* Stage 2: Near Completion */}
          <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <TrendingUp size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-blue-700">{milestoneCounts.near_completion}</span>
                <span className="text-[11px] text-slate-500">students</span>
              </div>
              <p className="text-[11px] font-bold text-slate-700 truncate">Near Completion (75–99%)</p>
              <p className="text-[10px] text-blue-600">365–485 hours</p>
            </div>
          </div>

          {/* Stage 3: In Progress */}
          <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-indigo-700">{milestoneCounts.in_progress}</span>
                <span className="text-[11px] text-slate-500">students</span>
              </div>
              <p className="text-[11px] font-bold text-slate-700 truncate">In Progress (25–74%)</p>
              <p className="text-[10px] text-indigo-600">120–364 hours</p>
            </div>
          </div>

          {/* Stage 4: Just Started / Behind */}
          <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-amber-700">{milestoneCounts.just_started}</span>
                <span className="text-[11px] text-slate-500">students</span>
              </div>
              <p className="text-[11px] font-bold text-slate-700 truncate">Just Started (&lt;25%)</p>
              <p className="text-[10px] text-amber-600">&lt;120 hours / 0 hours</p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN VIEW CONTROLS & CHARTS                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        {/* VIEW 1: ATTENDANCE TREND (Daily / Weekly / Monthly) */}
        {viewMode === 'attendance_trend' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Internship Attendance &amp; Rendered Hours Over Time
                </h4>
                <p className="text-xs text-slate-500">
                  Daily breakdown of student work hours rendered and student attendance volume
                </p>
              </div>

              {/* Granularity Selector */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTimeGranularity('daily')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeGranularity === 'daily'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daily Breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setTimeGranularity('weekly')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeGranularity === 'weekly'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Weekly Totals
                </button>
                <button
                  type="button"
                  onClick={() => setTimeGranularity('monthly')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeGranularity === 'monthly'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  6-Month Trend
                </button>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {timeGranularity === 'daily' ? (
                  <ComposedChart data={dailyAttendanceData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickFormatter={(val) => `D${val}`}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      unit="h"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#10b981' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, name: any) => [
                        name.includes('Students') ? `${val} students` : `${val} hrs`,
                        name,
                      ]}
                      labelFormatter={(label) => `Day ${label} of ${monthLabel}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar
                      yAxisId="left"
                      dataKey="totalHours"
                      name="Hours Rendered"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={24}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="studentCount"
                      name="Students Present"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#10b981' }}
                    />
                  </ComposedChart>
                ) : timeGranularity === 'weekly' ? (
                  <BarChart data={weeklyAttendanceData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} unit="h" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val} hrs (Peak: ${item.payload.studentCount} students)`,
                        'Total Hours Rendered',
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="totalHours" name="Weekly Rendered Hours" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                ) : (
                  <BarChart data={monthlyTrendData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} unit="h" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val} hrs (${item.payload.activeStudents} active students)`,
                        'Rendered Hours',
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="totalHours" name="Monthly Total Hours" fill="#0d9488" radius={[8, 8, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 2: TRAINEE MILESTONES & PROGRESS LEADERBOARD */}
        {viewMode === 'trainee_milestones' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Individual student progress toward the required <strong>486 hours</strong>
              </span>
              <span className="font-semibold text-slate-700">
                Showing top trainees by hours completed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {traineeProgressList.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="text-sm font-bold text-slate-900 truncate">{t.name}</h5>
                      <p className="text-[11px] text-slate-500 truncate">
                        {t.course} • {t.companyName}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                        t.milestone === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.milestone === 'near_completion'
                          ? 'bg-blue-100 text-blue-800'
                          : t.milestone === 'in_progress'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.milestone === 'completed'
                        ? 'Completed'
                        : t.milestone === 'near_completion'
                        ? 'Near Completion'
                        : t.milestone === 'in_progress'
                        ? 'In Progress'
                        : 'Just Started'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-bold text-slate-700">{t.renderedHours} hrs rendered</span>
                      <span className="text-slate-500">{t.progressPercent}% of {t.requiredHours}h</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          t.milestone === 'completed'
                            ? 'bg-emerald-500'
                            : t.milestone === 'near_completion'
                            ? 'bg-blue-600'
                            : t.milestone === 'in_progress'
                            ? 'bg-indigo-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${t.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
                    <span>This month: <strong>{t.thisMonthHours}h</strong></span>
                    <span>Remaining: <strong>{t.remainingHours}h</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: BY HOST TRAINING ESTABLISHMENT (HTE) */}
        {viewMode === 'by_hte' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Top Host Training Establishments (Partner Companies) by Student Rendered Hours</span>
              <span className="font-semibold text-slate-700">Showing {hteLeaderboard.length} active stations</span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hteLeaderboard}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} unit="h" />
                  <YAxis
                    dataKey="shortName"
                    type="category"
                    tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                    width={130}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} hrs total (${item.payload.studentCount} students • avg ${item.payload.avgHoursPerStudent}h/student)`,
                      'Total Rendered Hours',
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="totalHours" name="Total Hours Rendered" fill="#6366f1" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 4: BY ACADEMIC PROGRAM (BSIT vs BSCS) */}
        {viewMode === 'by_program' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Comparison across Academic Programs / Departments</span>
              <span className="font-semibold text-slate-700">{programComparison.length} Programs Tracked</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {programComparison.map((prog) => (
                <div
                  key={prog.course}
                  className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold text-slate-900">{prog.course}</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {prog.studentCount} Students
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Curriculum Completion</span>
                      <span className="font-bold text-slate-800">{prog.completionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${prog.completionRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400">Total Rendered</p>
                      <p className="font-bold text-slate-800">{prog.totalRendered} hrs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">Avg per Student</p>
                      <p className="font-bold text-indigo-700">{prog.avgHours} hrs</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-64 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={programComparison} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="course" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} unit="h" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [`${val} hrs`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="avgHours" name="Average Hours per Student" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="totalRendered" name="Total Program Hours" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 5: CALENDAR ATTENDANCE HEATMAP */}
        {viewMode === 'heatmap' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Daily attendance intensity for <span className="font-bold text-slate-900">{monthLabel}</span>
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>0 hrs</span>
                <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-200 border border-emerald-400" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-700 border border-emerald-800" />
                <span>Peak</span>
              </div>
            </div>

            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider py-1">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {heatmapMatrix.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="h-16 rounded-xl bg-slate-50/40 border border-transparent" />;
                }

                const colorClass = getHeatmapColor(cell.totalHours, cell.isWeekend);

                return (
                  <div
                    key={cell.dateStr}
                    onMouseEnter={() => setHoveredCalendarDay(cell)}
                    onMouseLeave={() => setHoveredCalendarDay(null)}
                    className={`h-16 p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer hover:scale-105 hover:shadow-md relative ${colorClass}`}
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span>{cell.day}</span>
                      {cell.lateCount > 0 && (
                        <span
                          className="w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white"
                          title={`${cell.lateCount} late arrivals`}
                        />
                      )}
                    </div>

                    <div className="text-right">
                      {cell.totalHours > 0 ? (
                        <div>
                          <div className="text-xs font-black tracking-tight">{cell.totalHours}h</div>
                          <div className="text-[9px] opacity-80">{cell.studentCount} std</div>
                        </div>
                      ) : (
                        <span className="text-[10px] opacity-40">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected / Hovered Day Tooltip Card */}
            <div className="min-h-[44px] bg-slate-50 p-2.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-700">
              {hoveredCalendarDay ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {hoveredCalendarDay.weekdayShort}, {hoveredCalendarDay.dateStr}:
                    </span>
                    <span>
                      <strong className="text-blue-700">{hoveredCalendarDay.totalHours} hrs rendered</strong> across {hoveredCalendarDay.studentCount} students
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <span className="font-semibold text-emerald-700">{hoveredCalendarDay.presentCount} Present</span>
                    {hoveredCalendarDay.lateCount > 0 && (
                      <span className="text-amber-700 font-bold">{hoveredCalendarDay.lateCount} Late</span>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-slate-400 italic flex items-center gap-1.5">
                  <Info size={13} /> Hover over any calendar day to inspect hours rendered, student headcount, and late arrivals.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
