import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  BarChart3,
  Activity,
  Target,
  Zap,
  Building,
  Users,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
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
  ReferenceArea,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

import { Employee, TimeRecord } from '../../types';

interface AdvancedAnalyticsDashboardProps {
  records: TimeRecord[];
  allRecords: TimeRecord[];
  trainees: Employee[];
  selectedMonth: string; // "YYYY-MM" or "all"
  selectedAcademicYear?: string;
}

type AnalyticsViewMode = 'overtime_regular' | 'utilization' | 'by_hte' | 'heatmap';
type TimeGranularity = 'daily' | 'weekly' | 'monthly';

export function AdvancedAnalyticsDashboard({
  records,
  allRecords,
  trainees,
  selectedMonth,
  selectedAcademicYear,
}: AdvancedAnalyticsDashboardProps) {
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>('overtime_regular');
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('daily');
  const [hoveredCalendarDay, setHoveredCalendarDay] = useState<any | null>(null);

  // Parse Year and Month
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

  // Working days in month (Mon-Fri)
  const workingDaysInMonth = useMemo(() => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
    }
    return count || 22;
  }, [year, month, daysInMonth]);

  const activeTraineeCount = trainees.length || 1;
  const standardDailyCapacityHours = activeTraineeCount * 8; // Available working capacity per working day
  const targetMonthlyCapacityHours = activeTraineeCount * workingDaysInMonth * 8;
  const totalMonthlyCapacityHours = targetMonthlyCapacityHours;

  // -------------------------------------------------------------
  // 1. DAILY DATA with Regular vs Overtime & 7-day Rolling Average
  // -------------------------------------------------------------
  const dailyData = useMemo(() => {
    const rawDays = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${monthKey}-${String(dayNum).padStart(2, '0')}`;
      const dayDate = new Date(year, month, dayNum);
      const dayOfWeekNum = dayDate.getDay();
      const isWeekend = dayOfWeekNum === 0 || dayOfWeekNum === 6;
      const weekdayShort = dayDate.toLocaleDateString('en-US', { weekday: 'short' });

      const dayRecs = records.filter((r) => r.date === dateStr);

      let regular = 0;
      let overtime = 0;
      let presentCount = 0;
      let lateCount = 0;

      dayRecs.forEach((r) => {
        const h = Number(r.totalHours) || 0;
        if (h > 0) {
          const reg = Math.min(8, h);
          const ot = Math.max(0, h - 8);
          regular += reg;
          overtime += ot;
        }
        if (r.status === 'present' || r.status === 'overtime') presentCount++;
        if (r.status === 'late') lateCount++;
      });

      const totalH = parseFloat((regular + overtime).toFixed(1));
      const expectedCapacity = isWeekend ? 0 : standardDailyCapacityHours;
      const utilization = expectedCapacity > 0 ? Math.min(150, Math.round((totalH / expectedCapacity) * 100)) : 0;

      return {
        day: String(dayNum),
        dateStr,
        weekdayShort,
        isWeekend,
        dayOfWeekNum,
        regularHours: parseFloat(regular.toFixed(1)),
        overtimeHours: parseFloat(overtime.toFixed(1)),
        totalHours: totalH,
        utilizationPct: utilization,
        presentCount,
        lateCount,
        recordCount: dayRecs.length,
      };
    });

    // Compute honest 7-day rolling average for each day
    return rawDays.map((item, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const windowSlice = rawDays.slice(windowStart, idx + 1);
      const sum = windowSlice.reduce((s, d) => s + d.totalHours, 0);
      const rollingAvg = parseFloat((sum / windowSlice.length).toFixed(1));

      return {
        ...item,
        rollingAvg7d: rollingAvg,
      };
    });
  }, [records, daysInMonth, monthKey, year, month, standardDailyCapacityHours]);

  // -------------------------------------------------------------
  // 2. WEEKLY TOTALS
  // -------------------------------------------------------------
  const weeklyData = useMemo(() => {
    const weeks: {
      week: string;
      range: string;
      regularHours: number;
      overtimeHours: number;
      totalHours: number;
      utilizationPct: number;
      presentCount: number;
    }[] = [];

    const weekSize = 7;
    const numWeeks = Math.ceil(daysInMonth / weekSize);

    for (let w = 0; w < numWeeks; w++) {
      const startDay = w * weekSize + 1;
      const endDay = Math.min(daysInMonth, (w + 1) * weekSize);
      const daysInThisWeek = dailyData.slice(startDay - 1, endDay);

      const reg = daysInThisWeek.reduce((s, d) => s + d.regularHours, 0);
      const ot = daysInThisWeek.reduce((s, d) => s + d.overtimeHours, 0);
      const tot = daysInThisWeek.reduce((s, d) => s + d.totalHours, 0);
      const pres = daysInThisWeek.reduce((s, d) => s + d.presentCount, 0);

      // Week expected capacity (approx 5 working days per 7-day block)
      const workingDaysInWeek = daysInThisWeek.filter((d) => !d.isWeekend).length || 5;
      const weekCapacity = activeTraineeCount * workingDaysInWeek * 8;
      const util = weekCapacity > 0 ? Math.min(150, Math.round((tot / weekCapacity) * 100)) : 0;

      weeks.push({
        week: `Week ${w + 1}`,
        range: `Day ${startDay}–${endDay}`,
        regularHours: parseFloat(reg.toFixed(1)),
        overtimeHours: parseFloat(ot.toFixed(1)),
        totalHours: parseFloat(tot.toFixed(1)),
        utilizationPct: util,
        presentCount: pres,
      });
    }

    return weeks;
  }, [dailyData, daysInMonth, activeTraineeCount]);

  // -------------------------------------------------------------
  // 3. MONTHLY HISTORICAL TOTALS (Past 6 Months)
  // -------------------------------------------------------------
  const monthlyHistoricalData = useMemo(() => {
    const list: {
      monthLabel: string;
      monthKey: string;
      regularHours: number;
      overtimeHours: number;
      totalHours: number;
      utilizationPct: number;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const mRecs = allRecords.filter((r) => r.date.startsWith(mKey));
      let reg = 0;
      let ot = 0;
      mRecs.forEach((r) => {
        const h = Number(r.totalHours) || 0;
        reg += Math.min(8, h);
        ot += Math.max(0, h - 8);
      });
      const tot = reg + ot;
      const approxCapacity = activeTraineeCount * 22 * 8;
      const util = approxCapacity > 0 ? Math.min(150, Math.round((tot / approxCapacity) * 100)) : 0;

      list.push({
        monthLabel: label,
        monthKey: mKey,
        regularHours: parseFloat(reg.toFixed(1)),
        overtimeHours: parseFloat(ot.toFixed(1)),
        totalHours: parseFloat(tot.toFixed(1)),
        utilizationPct: util,
      });
    }

    return list;
  }, [allRecords, year, month, activeTraineeCount]);

  // -------------------------------------------------------------
  // 4. STACKED BARS BY HTE / TEAM / CLIENT
  // -------------------------------------------------------------
  const hteBreakdownData = useMemo(() => {
    const companyMap: Record<string, { regular: number; overtime: number; count: number; trainees: Set<string> }> = {};

    trainees.forEach((t) => {
      const cName = t.companyName?.trim() || 'Unassigned / Pending HTE';
      if (!companyMap[cName]) {
        companyMap[cName] = { regular: 0, overtime: 0, count: 0, trainees: new Set() };
      }
      companyMap[cName].trainees.add(t.id);
    });

    records.forEach((r) => {
      const emp = trainees.find((t) => t.id === r.employeeId || t.employeeId === r.employeeId);
      const cName = emp?.companyName?.trim() || 'Other Training Station';
      if (!companyMap[cName]) {
        companyMap[cName] = { regular: 0, overtime: 0, count: 0, trainees: new Set() };
      }
      const h = Number(r.totalHours) || 0;
      companyMap[cName].regular += Math.min(8, h);
      companyMap[cName].overtime += Math.max(0, h - 8);
      companyMap[cName].count++;
    });

    return Object.entries(companyMap)
      .map(([name, val]) => {
        const reg = parseFloat(val.regular.toFixed(1));
        const ot = parseFloat(val.overtime.toFixed(1));
        const total = parseFloat((reg + ot).toFixed(1));
        const traineeCount = val.trainees.size;
        return {
          name,
          shortName: name.length > 18 ? name.slice(0, 16) + '…' : name,
          regularHours: reg,
          overtimeHours: ot,
          totalHours: total,
          traineeCount,
          avgHoursPerTrainee: traineeCount > 0 ? parseFloat((total / traineeCount).toFixed(1)) : 0,
        };
      })
      .filter((item) => item.totalHours > 0 || item.traineeCount > 0)
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 8); // Top 8 companies for clear, non-cluttered display
  }, [records, trainees]);

  // -------------------------------------------------------------
  // 5. SUMMARY KPIS & VARIANCE INDICATORS
  // -------------------------------------------------------------
  const summaryKpis = useMemo(() => {
    const totalRendered = records.reduce((s, r) => s + (Number(r.totalHours) || 0), 0);
    const regularSum = records.reduce((s, r) => s + Math.min(8, Number(r.totalHours) || 0), 0);
    const overtimeSum = Math.max(0, totalRendered - regularSum);

    // Current month utilization %
    const utilizationRate =
      totalMonthlyCapacityHours > 0
        ? Math.min(100, Math.round((totalRendered / totalMonthlyCapacityHours) * 100))
        : 0;

    // Previous month comparison
    const prevMonthDate = new Date(year, month - 1, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthRecords = allRecords.filter((r) => r.date.startsWith(prevMonthKey));
    const prevMonthTotal = prevMonthRecords.reduce((s, r) => s + (Number(r.totalHours) || 0), 0);

    let varianceVsLastMonthPct = 0;
    if (prevMonthTotal > 0) {
      varianceVsLastMonthPct = parseFloat((((totalRendered - prevMonthTotal) / prevMonthTotal) * 100).toFixed(1));
    } else if (totalRendered > 0) {
      varianceVsLastMonthPct = 100;
    }

    // Variance vs Target Pace (85% benchmark)
    const targetBenchmarkPct = 85;
    const varianceVsTarget = utilizationRate - targetBenchmarkPct;

    const overtimeSharePct = totalRendered > 0 ? Math.round((overtimeSum / totalRendered) * 100) : 0;

    return {
      totalRendered: parseFloat(totalRendered.toFixed(1)),
      regularHours: parseFloat(regularSum.toFixed(1)),
      overtimeHours: parseFloat(overtimeSum.toFixed(1)),
      utilizationRate,
      targetMonthlyCapacityHours,
      prevMonthTotal: parseFloat(prevMonthTotal.toFixed(1)),
      varianceVsLastMonthPct,
      varianceVsTarget,
      overtimeSharePct,
    };
  }, [records, allRecords, year, month, totalMonthlyCapacityHours]);

  // -------------------------------------------------------------
  // 6. CALENDAR HEATMAP MATRIX
  // -------------------------------------------------------------
  const heatmapMatrix = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
    const cells: (typeof dailyData[0] | null)[] = [];

    // Prepend null cells for alignment
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    // Add all month days
    dailyData.forEach((dayItem) => {
      cells.push(dayItem);
    });

    return cells;
  }, [dailyData, year, month]);

  const maxDailyHours = useMemo(() => {
    return Math.max(...dailyData.map((d) => d.totalHours), 1);
  }, [dailyData]);

  const getHeatmapColor = (hours: number, isWeekend: boolean) => {
    if (hours === 0) {
      return isWeekend ? 'bg-slate-100/60 text-slate-400 border-slate-200' : 'bg-slate-100 text-slate-500 border-slate-200';
    }
    const ratio = hours / maxDailyHours;
    if (ratio < 0.25) return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';
    if (ratio < 0.55) return 'bg-emerald-300 text-emerald-950 border-emerald-400 font-bold';
    if (ratio < 0.8) return 'bg-emerald-500 text-white border-emerald-600 font-bold shadow-xs';
    return 'bg-emerald-700 text-white border-emerald-800 font-black shadow-xs ring-1 ring-emerald-300';
  };

  return (
    <div className="space-y-5 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm font-sans">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-sm">
              <Activity size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  OJT Cohort Intelligence &amp; Analytics
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <Sparkles size={11} /> Live Insights
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprehensive tracking of student utilization, overtime distributions, rolling pace, and establishment breakdowns for {monthLabel}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('overtime_regular')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'overtime_regular'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 size={13} />
            <span>Overtime vs Regular</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('utilization')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'utilization'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target size={13} />
            <span>Utilization % (Target Band)</span>
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
            <span>Hours by HTE</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'heatmap'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar size={13} />
            <span>Calendar Heatmap</span>
          </button>
        </div>
      </div>

      {/* Variance & KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Utilization Rate with Target Band Indicator */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-emerald-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Utilization %</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Target size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-800">{summaryKpis.utilizationRate}%</span>
            <span className="text-xs text-slate-500 font-medium">of available capacity</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-600">
              {summaryKpis.totalRendered}h / {summaryKpis.targetMonthlyCapacityHours}h avail.
            </span>
            <span
              className={`font-bold px-1.5 py-0.2 rounded-md ${
                summaryKpis.utilizationRate >= 80
                  ? 'bg-emerald-100 text-emerald-800'
                  : summaryKpis.utilizationRate >= 60
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {summaryKpis.utilizationRate >= 80 ? '✓ In Target Band' : 'Under Pace'}
            </span>
          </div>
        </div>

        {/* KPI 2: Variance vs Last Month */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/40 border border-blue-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Variance vs Last Mo.</span>
            <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              {summaryKpis.varianceVsLastMonthPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                summaryKpis.varianceVsLastMonthPct >= 0 ? 'text-blue-800' : 'text-rose-700'
              }`}
            >
              {summaryKpis.varianceVsLastMonthPct >= 0 ? `+${summaryKpis.varianceVsLastMonthPct}%` : `${summaryKpis.varianceVsLastMonthPct}%`}
            </span>
            <span className="text-xs text-slate-500 font-medium">rendered hours</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-600 truncate">
            Last month: <span className="font-semibold text-slate-800">{summaryKpis.prevMonthTotal}h</span>
          </p>
        </div>

        {/* KPI 3: Regular vs Overtime Breakdown */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 to-orange-50/40 border border-amber-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Overtime vs Regular</span>
            <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Zap size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900">{summaryKpis.overtimeHours}h</span>
            <span className="text-xs font-bold text-amber-700">({summaryKpis.overtimeSharePct}% OT)</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            Regular duty: <span className="font-semibold text-slate-800">{summaryKpis.regularHours}h</span>
          </p>
        </div>

        {/* KPI 4: 7-Day Rolling Trend Pace */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/80 to-violet-50/40 border border-purple-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">7-Day Rolling Pace</span>
            <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
              <Clock size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-900">
              {dailyData[dailyData.length - 1]?.rollingAvg7d || 0}h
            </span>
            <span className="text-xs text-slate-500 font-medium">per cohort day</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            Target per day: <span className="font-semibold text-slate-800">{standardDailyCapacityHours}h</span>
          </p>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="space-y-4">
        {/* Sub-toolbar when viewing Time Breakdown (Daily / Weekly / Monthly) */}
        {(viewMode === 'overtime_regular' || viewMode === 'utilization') && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Aggregation Level:</span>
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
                  Daily (with 7-Day Rolling Trend)
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
                  6-Month Comparison
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              {viewMode === 'overtime_regular' && (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    Regular Hours (≤8h/day)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Overtime Hours (&gt;8h)
                  </span>
                  {timeGranularity === 'daily' && (
                    <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <span className="w-3.5 h-0.5 bg-emerald-600" />
                      7-Day Rolling Avg
                    </span>
                  )}
                </>
              )}
              {viewMode === 'utilization' && (
                <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400" />
                  Target Band (80%–100%)
                </span>
              )}
            </div>
          </div>
        )}

        {/* 1. OVERTIME VS REGULAR HOURS (Stacked Bars + 7-Day Rolling Line) */}
        {viewMode === 'overtime_regular' && (
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {timeGranularity === 'daily' ? (
                <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(val) => `D${val}`}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    unit="h"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [`${val} hrs`, name]}
                    labelFormatter={(label) => `Day ${label} of ${monthLabel}`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar
                    dataKey="regularHours"
                    name="Regular Duty Hours"
                    stackId="hours"
                    fill="#3b82f6"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="overtimeHours"
                    name="Overtime Hours"
                    stackId="hours"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rollingAvg7d"
                    name="7-Day Rolling Average"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              ) : timeGranularity === 'weekly' ? (
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    formatter={(val: any, name: any) => [`${val} hrs`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="regularHours" name="Regular Hours" stackId="w" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="overtimeHours" name="Overtime Hours" stackId="w" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={monthlyHistoricalData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    formatter={(val: any, name: any) => [`${val} hrs`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="regularHours" name="Regular Hours" stackId="m" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="overtimeHours" name="Overtime Hours" stackId="m" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* 2. UTILIZATION % (0-100% AXIS with 80-100% TARGET BAND) */}
        {viewMode === 'utilization' && (
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={timeGranularity === 'daily' ? dailyData : timeGranularity === 'weekly' ? weeklyData : monthlyHistoricalData}
                margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey={timeGranularity === 'daily' ? 'day' : timeGranularity === 'weekly' ? 'week' : 'monthLabel'}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  tickFormatter={timeGranularity === 'daily' ? (v) => `D${v}` : undefined}
                />
                <YAxis
                  domain={[0, 120]}
                  ticks={[0, 20, 40, 60, 80, 100, 120]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Utilization Rate']}
                />
                {/* 80% to 100% Target Band */}
                <ReferenceArea y1={80} y2={100} fill="#10b981" fillOpacity={0.12} stroke="#10b981" strokeDasharray="2 2" />
                <ReferenceLine y={85} stroke="#059669" strokeDasharray="3 3" label={{ value: 'Target 85%', position: 'insideTopRight', fill: '#059669', fontSize: 11 }} />
                <Bar
                  dataKey="utilizationPct"
                  name="Utilization %"
                  fill="#0d9488"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={timeGranularity === 'daily' ? 18 : 36}
                />
                <Line
                  type="monotone"
                  dataKey="utilizationPct"
                  name="Utilization Trend"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#0f766e' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 3. STACKED BARS BY HTE / TEAM / CLIENT */}
        {viewMode === 'by_hte' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Top Host Training Establishments (HTE) by Rendered Hours</span>
              <span className="font-semibold text-slate-700">Showing {hteBreakdownData.length} active stations</span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hteBreakdownData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} unit="h" />
                  <YAxis
                    dataKey="shortName"
                    type="category"
                    tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                    width={120}
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
                      `${val} hrs (${item.payload.traineeCount} trainees)`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="regularHours" name="Regular Hours" stackId="hte" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="overtimeHours" name="Overtime Hours" stackId="hte" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 4. CALENDAR HEATMAP */}
        {viewMode === 'heatmap' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Day-of-week intensity matrix for <span className="font-bold text-slate-900">{monthLabel}</span>
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>Low</span>
                <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-300 border border-emerald-400" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-700 border border-emerald-800" />
                <span>High</span>
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
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-white" title={`${cell.lateCount} late`} />
                      )}
                    </div>

                    <div className="text-right">
                      {cell.totalHours > 0 ? (
                        <span className="text-xs tracking-tight">{cell.totalHours}h</span>
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
                      <strong className="text-blue-700">{hoveredCalendarDay.totalHours} hrs rendered</strong> (Regular: {hoveredCalendarDay.regularHours}h • Overtime: {hoveredCalendarDay.overtimeHours}h)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <span>{hoveredCalendarDay.presentCount} Trainees Present</span>
                    {hoveredCalendarDay.lateCount > 0 && (
                      <span className="text-amber-700 font-bold">{hoveredCalendarDay.lateCount} Late</span>
                    )}
                    <span>{hoveredCalendarDay.utilizationPct}% Utilization</span>
                  </div>
                </>
              ) : (
                <span className="text-slate-400 italic flex items-center gap-1.5">
                  <Info size={13} /> Hover over any calendar day to inspect detailed hours, presence, and overtime.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
