import {
  BarChart2,
  Download,
  Filter,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  Printer,
  CheckCircle,
  XCircle,
  Award,
  Star,
  Search,
  Building,
  CheckCircle2,
  FileText,
  Eye,
  X,
  Lock,
  ThumbsUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

import { useApp } from '../../store/AppContext';
import { formatTime } from '../../utils/geo';
import { getPhotoUrl } from '../../services/config';
import { Employee, Evaluation } from '../../types';
import { MonthlyDTTRView } from '../../components/MonthlyDTTRView';

const GRADE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  Excellent: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Very Good': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Good: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  Satisfactory: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Needs Improvement': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export function AdminReports() {
  const { employees, timeRecords, evaluations, approveTimeRecord, disapproveTimeRecord, addTimeRecord, settings } = useApp();

  // Active Top Tab: 'attendance', 'monthly_dttr', or 'evaluation'
  const [activeTab, setActiveTab] = useState<'attendance' | 'monthly_dttr' | 'evaluation'>('attendance');

  // Attendance Filters
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(settings?.activeAcademicYear || 'all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedEmpId, setSelectedEmpId] = useState('all');
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState<'all' | 'pending' | 'approved' | 'disapproved'>('all');
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);

  // Evaluation Filters
  const [evalSearch, setEvalSearch] = useState('');
  const [evalCompanyFilter, setEvalCompanyFilter] = useState('all');
  const [evalGradeFilter, setEvalGradeFilter] = useState('all');
  const [selectedEvalModal, setSelectedEvalModal] = useState<{ emp: Employee; eval?: Evaluation } | null>(null);

  const monthOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Months / Dates' }];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      opts.push({ value: val, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
    }
    return opts;
  }, []);

  // Trainee role filter helper: strictly exclude Instructors and HTEs
  const isTrainee = (emp: any): boolean => {
    if (!emp) return false;
    const pos = (emp.position || '').toLowerCase();
    const empId = (emp.employeeId || '').toLowerCase();
    const role = (emp.role || '').toLowerCase();
    if (
      role === 'instructor' ||
      role === 'admin' ||
      pos.includes('instructor') ||
      pos.includes('admin') ||
      pos.includes('faculty') ||
      empId.startsWith('adm-') ||
      empId.startsWith('instr-')
    ) {
      return false;
    }
    if (
      role === 'hte' ||
      role === 'host' ||
      pos.includes('hte') ||
      pos.includes('host training') ||
      pos.includes('supervisor') ||
      empId.startsWith('hte-')
    ) {
      return false;
    }
    return true;
  };

  const traineeEmployees = useMemo(() => {
    return employees.filter((e) => e.active && isTrainee(e));
  }, [employees]);

  const traineeIds = useMemo(() => {
    const set = new Set<string>();
    traineeEmployees.forEach((e) => {
      if (e.id) set.add(e.id);
      if (e.employeeId) set.add(e.employeeId);
      if (e.email) set.add(e.email.toLowerCase());
    });
    return set;
  }, [traineeEmployees]);

  // Attendance records filtered
  const filteredRecords = useMemo(() => {
    return timeRecords.filter((r) => {
      const empIdStr = (r.employeeId || '').toLowerCase();
      const isTraineeRec =
        traineeIds.has(r.employeeId) ||
        traineeIds.has(empIdStr) ||
        traineeEmployees.some(
          (e) =>
            e.id === r.employeeId ||
            e.employeeId === r.employeeId ||
            (e.email && e.email.toLowerCase() === empIdStr)
        ) ||
        !employees.some(
          (e) =>
            (e.id === r.employeeId || e.employeeId === r.employeeId || (e.email && e.email.toLowerCase() === empIdStr)) &&
            !isTrainee(e)
        );

      if (!isTraineeRec) return false;

      const matchMonth = selectedMonth === 'all' || r.date.startsWith(selectedMonth);

      const matchEmp =
        selectedEmpId === 'all' ||
        r.employeeId === selectedEmpId ||
        traineeEmployees.find((e) => e.id === selectedEmpId)?.employeeId === r.employeeId ||
        traineeEmployees.find((e) => e.id === selectedEmpId)?.email?.toLowerCase() === empIdStr;

      const matchYear =
        selectedAcademicYear === 'all' ||
        !r.academicYear ||
        r.academicYear === selectedAcademicYear ||
        r.academicYear === settings?.activeAcademicYear;

      return matchMonth && matchEmp && matchYear;
    });
  }, [timeRecords, selectedMonth, selectedEmpId, selectedAcademicYear, settings, traineeIds, traineeEmployees, employees]);

  // Daily chart data for attendance
  const dailyData = useMemo(() => {
    const monthKey =
      selectedMonth === 'all'
        ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        : selectedMonth;
    const parts = monthKey.split('-');
    const year = parseInt(parts[0]) || new Date().getFullYear();
    const month = (parseInt(parts[1]) || new Date().getMonth() + 1) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
      const recs = filteredRecords.filter((r) => r.date === dateStr);
      const totalHrs = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
      return {
        day: String(day),
        hours: parseFloat(totalHrs.toFixed(1)),
        present: recs.filter((r) => r.status === 'present' || r.status === 'overtime').length,
        late: recs.filter((r) => r.status === 'late').length,
      };
    });
  }, [filteredRecords, selectedMonth]);

  // Per-employee attendance summary
  const employeeSummary = useMemo(() => {
    const activeTrainees =
      selectedEmpId === 'all'
        ? traineeEmployees
        : traineeEmployees.filter((e) => e.id === selectedEmpId);
    return activeTrainees
      .map((emp) => {
        const recs = filteredRecords.filter((r) => r.employeeId === emp.id);
        const totalHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
        const present = recs.filter((r) => r.status === 'present' || r.status === 'overtime').length;
        const late = recs.filter((r) => r.status === 'late').length;
        const absent = Math.max(0, 22 - recs.length);
        return { emp, totalHours, present, late, absent, records: recs };
      })
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredRecords, traineeEmployees, selectedEmpId]);

  const totalHours = filteredRecords.reduce((s, r) => s + (r.totalHours || 0), 0);
  const presentCount = filteredRecords.filter((r) => r.status === 'present' || r.status === 'overtime').length;
  const lateCount = filteredRecords.filter((r) => r.status === 'late').length;
  const avgHoursPerDay = filteredRecords.length > 0 ? totalHours / filteredRecords.length : 0;

  // Approval counts & filtered detailed records
  const approvedCount = useMemo(() => {
    return filteredRecords.filter((r) => r.approvalStatus === 'approved').length;
  }, [filteredRecords]);

  const disapprovedCount = useMemo(() => {
    return filteredRecords.filter((r) => r.approvalStatus === 'disapproved').length;
  }, [filteredRecords]);

  const pendingApprovalCount = useMemo(() => {
    return filteredRecords.filter((r) => !r.approvalStatus || r.approvalStatus === 'pending').length;
  }, [filteredRecords]);

  const displayedDetailedRecords = useMemo(() => {
    let list = filteredRecords;
    if (selectedApprovalStatus === 'pending') {
      list = list.filter((r) => !r.approvalStatus || r.approvalStatus === 'pending');
    } else if (selectedApprovalStatus === 'approved') {
      list = list.filter((r) => r.approvalStatus === 'approved');
    } else if (selectedApprovalStatus === 'disapproved') {
      list = list.filter((r) => r.approvalStatus === 'disapproved');
    }
    return list.slice().sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRecords, selectedApprovalStatus]);

  const handleApproveAllPending = () => {
    const pending = filteredRecords.filter((r) => !r.approvalStatus || r.approvalStatus === 'pending');
    if (pending.length === 0) return;
    if (window.confirm(`Approve all ${pending.length} pending time record(s)?`)) {
      pending.forEach((r) => approveTimeRecord(r.id, 'Instructor'));
      setApprovalNotice(`✓ Approved all ${pending.length} pending time records!`);
      setTimeout(() => setApprovalNotice(null), 5000);
    }
  };

  const handleDisapproveAllPending = () => {
    const pending = filteredRecords.filter((r) => !r.approvalStatus || r.approvalStatus === 'pending');
    if (pending.length === 0) return;
    if (window.confirm(`Disapprove all ${pending.length} pending time record(s)?`)) {
      pending.forEach((r) => disapproveTimeRecord(r.id));
      setApprovalNotice(`✕ Disapproved all ${pending.length} pending time records.`);
      setTimeout(() => setApprovalNotice(null), 5000);
    }
  };

  const handleGenerateDemoRecord = () => {
    const targetEmp =
      selectedEmpId !== 'all'
        ? traineeEmployees.find((e) => e.id === selectedEmpId) || traineeEmployees[0]
        : traineeEmployees[0];

    const d = new Date();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const targetMonth = selectedMonth === 'all' ? `${d.getFullYear()}-${monthStr}` : selectedMonth;
    const dateStr = `${targetMonth}-${String(d.getDate()).padStart(2, '0')}`;

    addTimeRecord({
      employeeId: targetEmp ? targetEmp.id : '20231379',
      date: dateStr,
      timeIn: '08:00:00',
      timeOut: '17:00:00',
      totalHours: 8.0,
      status: 'present',
      timeInFaceVerified: true,
      timeOutFaceVerified: true,
      timeInGeofenced: true,
      timeOutGeofenced: true,
      approvalStatus: 'pending',
      academicYear: selectedAcademicYear === 'all' ? (settings?.activeAcademicYear || '2026-2027') : selectedAcademicYear,
    });

    setApprovalNotice(
      `✓ Valid attendance record generated for ${targetEmp?.name || 'Trainee'}. Click "Approve" below to test!`
    );
    setTimeout(() => setApprovalNotice(null), 6000);
  };

  const handleApproveWithFeedback = (recId: string, traineeName: string) => {
    approveTimeRecord(recId, 'Instructor');
    setApprovalNotice(`✓ Attendance record for ${traineeName} marked as Approved! System successfully changed the DTR Approval status from "Approve/Reject" buttons to a green "Approved".`);
    setTimeout(() => setApprovalNotice(null), 6000);
  };

  const handleDisapproveWithFeedback = (recId: string, traineeName: string) => {
    disapproveTimeRecord(recId);
    setApprovalNotice(`✕ Attendance record for ${traineeName} marked as Disapproved.`);
    setTimeout(() => setApprovalNotice(null), 6000);
  };

  // Evaluation dataset calculation
  const evaluatedTraineesList = useMemo(() => {
    const list = traineeEmployees.map((emp) => {
      const evaluation = evaluations.find(
        (ev) => ev.employeeId === emp.id || ev.employeeId === emp.employeeId
      );
      return { emp, evaluation };
    });

    return list.filter(({ emp, evaluation }) => {
      // Academic year filter
      if (selectedAcademicYear !== 'all') {
        const matchYear =
          emp.academicYear === selectedAcademicYear ||
          evaluation?.academicYear === selectedAcademicYear;
        if (!matchYear) return false;
      }

      // Company filter
      if (evalCompanyFilter !== 'all') {
        if ((emp.companyName || 'N/A') !== evalCompanyFilter) return false;
      }

      // Grade filter
      if (evalGradeFilter !== 'all') {
        if (evalGradeFilter === 'pending') {
          if (evaluation && evaluation.totalScore > 0) return false;
        } else if (evaluation?.grade !== evalGradeFilter) {
          return false;
        }
      }

      // Search query
      if (evalSearch.trim()) {
        const q = evalSearch.toLowerCase();
        const nameMatch = emp.name.toLowerCase().includes(q);
        const idMatch = (emp.employeeId || '').toLowerCase().includes(q);
        const compMatch = (emp.companyName || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch && compMatch === false) return false;
      }

      return true;
    });
  }, [traineeEmployees, evaluations, selectedAcademicYear, evalCompanyFilter, evalGradeFilter, evalSearch]);

  const uniqueCompanies = useMemo(() => {
    const set = new Set<string>();
    traineeEmployees.forEach((e) => {
      if (e.companyName && e.companyName !== 'N/A') set.add(e.companyName);
    });
    return Array.from(set).sort();
  }, [traineeEmployees]);

  // Evaluation summary statistics
  const totalTraineesCount = traineeEmployees.length;
  const evaluatedCount = traineeEmployees.filter((emp) =>
    evaluations.some((ev) => (ev.employeeId === emp.id || ev.employeeId === emp.employeeId) && ev.totalScore > 0)
  ).length;
  const evaluatedPercent = totalTraineesCount > 0 ? Math.round((evaluatedCount / totalTraineesCount) * 100) : 0;

  const validScores = evaluations
    .filter((e) => traineeIds.has(e.employeeId) && e.totalScore > 0)
    .map((e) => e.totalScore);
  const avgEvaluationScore =
    validScores.length > 0
      ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
      : '0.0';

  const reviewedByInstructorCount = evaluations.filter(
    (e) => traineeIds.has(e.employeeId) && e.status === 'reviewed_by_instructor'
  ).length;

  const gradeCounts = useMemo(() => {
    const counts = {
      Excellent: 0,
      'Very Good': 0,
      Good: 0,
      Satisfactory: 0,
      'Needs Improvement': 0,
      Pending: 0,
    };
    traineeEmployees.forEach((emp) => {
      const ev = evaluations.find((e) => e.employeeId === emp.id || e.employeeId === emp.employeeId);
      if (ev?.grade && counts[ev.grade] !== undefined) {
        counts[ev.grade]++;
      } else {
        counts.Pending++;
      }
    });
    return counts;
  }, [traineeEmployees, evaluations]);

  // Attendance CSV Export
  const exportAttendanceCsv = () => {
    const headers = ['Date', 'Trainee', 'Time In', 'Time Out', 'Hours', 'Status', 'Face Verified', 'Geofenced', 'DTR Approval'];
    const rows = filteredRecords.map((record) => {
      const employee = employees.find((e) => e.id === record.employeeId);
      return [
        record.date,
        employee?.name || 'Unknown',
        record.timeIn || '',
        record.timeOut || '',
        record.totalHours?.toFixed(2) || '0.00',
        record.status,
        record.timeInFaceVerified && record.timeOutFaceVerified ? 'Yes' : 'No',
        record.timeInGeofenced && record.timeOutGeofenced ? 'Yes' : 'No',
        record.approvalStatus || 'pending',
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-report-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Evaluation CSV Export
  const exportEvaluationCsv = () => {
    const headers = [
      'Trainee Name',
      'Student ID',
      'Course',
      'Host Training Establishment (HTE)',
      'HTE Supervisor / Evaluator',
      'Evaluation Date',
      'Performance (25%)',
      'Attendance (20%)',
      'Attitude (20%)',
      'Punctuality/Delivery (15%)',
      'Communication (20%)',
      'Total Score (%)',
      'Official Grade',
      'Verification Status',
      'Strengths',
      'Areas for Growth',
      'Supervisor Recommendations',
    ];

    const rows = evaluatedTraineesList.map(({ emp, evaluation }) => {
      return [
        emp.name,
        emp.employeeId || '',
        emp.course || 'BSIS',
        emp.companyName || 'N/A',
        evaluation?.evaluatorName || emp.supervisorName || 'Pending',
        evaluation?.date || 'N/A',
        evaluation?.performanceScore != null ? `${evaluation.performanceScore}%` : 'N/A',
        evaluation?.attendanceScore != null ? `${evaluation.attendanceScore}%` : 'N/A',
        evaluation?.attitudeScore != null ? `${evaluation.attitudeScore}%` : 'N/A',
        evaluation?.punctualityScore != null ? `${evaluation.punctualityScore}%` : 'N/A',
        evaluation?.communicationScore != null ? `${evaluation.communicationScore}%` : 'N/A',
        evaluation?.totalScore != null ? `${evaluation.totalScore}%` : 'N/A',
        evaluation?.grade || 'Awaiting Evaluation',
        evaluation?.status === 'reviewed_by_instructor'
          ? 'Verified by Instructor'
          : evaluation?.status === 'submitted_to_instructor' || evaluation?.status === 'final'
          ? 'Submitted by HTE'
          : 'Pending Evaluation',
        evaluation?.strengths || '',
        evaluation?.areasForImprovement || '',
        evaluation?.recommendations || '',
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hte-evaluation-report-AY${selectedAcademicYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Official Print-Only Header (CHMSU) */}
      <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-base font-bold uppercase tracking-wider text-gray-900">Carlos Hilado Memorial State University</h1>
        <p className="text-xs text-gray-600">College of Computer Studies • Bachelor of Science in Information Systems</p>
        <h2 className="text-lg font-black uppercase text-blue-900 mt-2">
          {activeTab === 'evaluation' ? 'Official OJT Performance Evaluation Report' : 'Official OJT Trainee Attendance Report'}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Academic Year: {selectedAcademicYear === 'all' ? (settings?.activeAcademicYear || '2026-2027') : selectedAcademicYear} • Date Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap no-print">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            {activeTab === 'evaluation'
              ? 'HTE Evaluation Reports'
              : activeTab === 'monthly_dttr'
              ? 'Monthly DTTR Monitoring Form'
              : 'Attendance & DTR Reports'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {activeTab === 'evaluation'
              ? 'Trainee performance appraisal, competency breakdowns, and supervisor remarks'
              : activeTab === 'monthly_dttr'
              ? 'Official CHMSU Daily Time & Tasks Record (DTTR) with automatic hours and HTE supervisor sign-off'
              : 'Detailed time record analysis, rendered hours, and biometric clock-in logs'}
          </p>
        </div>

        {/* Tab Switcher & Export Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'attendance'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={14} />
              <span>Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('monthly_dttr')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'monthly_dttr'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={14} />
              <span>Monthly DTTR</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('evaluation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'evaluation'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award size={14} />
              <span>Evaluation Report</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded-full font-extrabold">
                {evaluatedCount}/{totalTraineesCount}
              </span>
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors shadow-sm"
          >
            <Printer size={14} />
            Print
          </button>
          <button
            onClick={activeTab === 'evaluation' ? exportEvaluationCsv : exportAttendanceCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 bg-white text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MONTHLY DTTR MONITORING VIEW                               */}
      {/* ========================================================= */}
      {activeTab === 'monthly_dttr' && (
        <MonthlyDTTRView viewerRole="admin" />
      )}

      {/* ========================================================= */}
      {/* EVALUATION REPORT VIEW                                    */}
      {/* ========================================================= */}
      {activeTab === 'evaluation' && (
        <div className="space-y-6">
          {/* Evaluation Filters */}
          <div className="bg-white p-4 rounded-3xl border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search trainee name or ID..."
                  value={evalSearch}
                  onChange={(e) => setEvalSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Academic Year */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-gray-500">AY:</span>
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="text-xs font-bold text-blue-700 bg-transparent focus:outline-none"
                >
                  <option value="all">All Years</option>
                  {settings.academicYears.map((ay) => (
                    <option key={ay} value={ay}>
                      AY {ay}
                    </option>
                  ))}
                </select>
              </div>

              {/* HTE Company */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs">
                <Building size={13} className="text-gray-400" />
                <select
                  value={evalCompanyFilter}
                  onChange={(e) => setEvalCompanyFilter(e.target.value)}
                  className="text-xs font-semibold text-gray-700 bg-transparent focus:outline-none max-w-[150px] truncate"
                >
                  <option value="all">All HTE Establishments</option>
                  {uniqueCompanies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade / Status */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs">
                <Filter size={13} className="text-gray-400" />
                <select
                  value={evalGradeFilter}
                  onChange={(e) => setEvalGradeFilter(e.target.value)}
                  className="text-xs font-semibold text-gray-700 bg-transparent focus:outline-none"
                >
                  <option value="all">All Ratings</option>
                  <option value="Excellent">Excellent (90–100%)</option>
                  <option value="Very Good">Very Good (80–89%)</option>
                  <option value="Good">Good (70–79%)</option>
                  <option value="Satisfactory">Satisfactory (60–69%)</option>
                  <option value="Needs Improvement">Needs Improvement (&lt;60%)</option>
                  <option value="pending">Awaiting Evaluation</option>
                </select>
              </div>
            </div>

            <div className="text-xs font-bold text-gray-500">
              Showing {evaluatedTraineesList.length} Trainees
            </div>
          </div>

          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Trainees</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900">{totalTraineesCount}</div>
              <p className="text-[11px] text-gray-400 mt-1">Enrolled in active OJT</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-emerald-200/80 shadow-sm shadow-emerald-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Evaluated</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Award size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-700">
                {evaluatedCount}{' '}
                <span className="text-xs font-extrabold text-emerald-600">({evaluatedPercent}%)</span>
              </div>
              <p className="text-[11px] text-emerald-600/80 mt-1">Appraised by HTE supervisor</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-sky-200/80 shadow-sm shadow-sky-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">Average Score</span>
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Star size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-sky-700">{avgEvaluationScore}%</div>
              <p className="text-[11px] text-sky-600/80 mt-1">Across evaluated trainees</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-violet-200/80 shadow-sm shadow-violet-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Verified by Faculty</span>
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-violet-700">{reviewedByInstructorCount}</div>
              <p className="text-[11px] text-violet-600/80 mt-1">Reviewed by OJT Instructor</p>
            </div>
          </div>

          {/* Grade Distribution Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-blue-600" />
                Performance Grade Distribution
              </span>
              <span className="text-xs text-gray-400 font-medium">Active OJT Cohort</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <p className="text-[10px] font-bold text-emerald-800 uppercase">Excellent</p>
                <p className="text-lg font-black text-emerald-700">{gradeCounts.Excellent}</p>
                <p className="text-[9px] text-emerald-600">90–100%</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                <p className="text-[10px] font-bold text-blue-800 uppercase">Very Good</p>
                <p className="text-lg font-black text-blue-700">{gradeCounts['Very Good']}</p>
                <p className="text-[9px] text-blue-600">80–89%</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-sky-50 border border-sky-200 text-center">
                <p className="text-[10px] font-bold text-sky-800 uppercase">Good</p>
                <p className="text-lg font-black text-sky-700">{gradeCounts.Good}</p>
                <p className="text-[9px] text-sky-600">70–79%</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <p className="text-[10px] font-bold text-amber-800 uppercase">Satisfactory</p>
                <p className="text-lg font-black text-amber-700">{gradeCounts.Satisfactory}</p>
                <p className="text-[9px] text-amber-600">60–69%</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                <p className="text-[10px] font-bold text-rose-800 uppercase">Needs Imp.</p>
                <p className="text-lg font-black text-rose-700">{gradeCounts['Needs Improvement']}</p>
                <p className="text-[9px] text-rose-600">&lt;60%</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-[10px] font-bold text-slate-700 uppercase">Awaiting</p>
                <p className="text-lg font-black text-slate-700">{gradeCounts.Pending}</p>
                <p className="text-[9px] text-slate-500">Pending HTE</p>
              </div>
            </div>
          </div>

          {/* Official Evaluation Records Table */}
          <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Official Trainee Evaluation Roster</h3>
                <p className="text-xs text-gray-400">Detailed HTE performance scores and verification status</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-gray-200 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Trainee</th>
                    <th className="py-3 px-3">HTE Establishment</th>
                    <th className="py-3 px-2 text-center" title="Quality of Work (25%)">Work (25%)</th>
                    <th className="py-3 px-2 text-center" title="Attendance & Punctuality (20%)">Attd (20%)</th>
                    <th className="py-3 px-2 text-center" title="Professional Attitude (20%)">Attitude (20%)</th>
                    <th className="py-3 px-2 text-center" title="Delivery & Deadlines (15%)">Delivery (15%)</th>
                    <th className="py-3 px-2 text-center" title="Communication Skills (20%)">Comm (20%)</th>
                    <th className="py-3 px-3 text-center">Overall Score</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {evaluatedTraineesList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400">
                        No trainees match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    evaluatedTraineesList.map(({ emp, evaluation }) => {
                      const gradeStyle = evaluation?.grade ? GRADE_BADGES[evaluation.grade] : null;
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Trainee Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-100 overflow-hidden shrink-0 border border-gray-200">
                                {emp.photo ? (
                                  <img src={getPhotoUrl(emp.photo)} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-blue-700 text-xs">
                                    {emp.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 truncate">{emp.name}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{emp.employeeId || 'No ID'}</p>
                              </div>
                            </div>
                          </td>

                          {/* HTE Establishment */}
                          <td className="py-3 px-3">
                            <p className="font-semibold text-gray-800 truncate max-w-[170px]" title={emp.companyName || 'N/A'}>
                              {emp.companyName || 'Pending Assignment'}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate max-w-[170px]">
                              Supv: {evaluation?.evaluatorName || emp.supervisorName || 'Pending'}
                            </p>
                          </td>

                          {/* Domain Scores */}
                          <td className="py-3 px-2 text-center font-mono font-semibold text-gray-700">
                            {evaluation?.performanceScore != null ? `${evaluation.performanceScore}%` : '—'}
                          </td>
                          <td className="py-3 px-2 text-center font-mono font-semibold text-gray-700">
                            {evaluation?.attendanceScore != null ? `${evaluation.attendanceScore}%` : '—'}
                          </td>
                          <td className="py-3 px-2 text-center font-mono font-semibold text-gray-700">
                            {evaluation?.attitudeScore != null ? `${evaluation.attitudeScore}%` : '—'}
                          </td>
                          <td className="py-3 px-2 text-center font-mono font-semibold text-gray-700">
                            {evaluation?.punctualityScore != null ? `${evaluation.punctualityScore}%` : '—'}
                          </td>
                          <td className="py-3 px-2 text-center font-mono font-semibold text-gray-700">
                            {evaluation?.communicationScore != null ? `${evaluation.communicationScore}%` : '—'}
                          </td>

                          {/* Overall Score & Grade */}
                          <td className="py-3 px-3 text-center">
                            {evaluation?.totalScore != null ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-black text-sm text-gray-900">{evaluation.totalScore}%</span>
                                {gradeStyle && (
                                  <span
                                    className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md border ${gradeStyle.bg} ${gradeStyle.text} ${gradeStyle.border}`}
                                  >
                                    {evaluation.grade}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Not rated</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center">
                            {evaluation?.status === 'reviewed_by_instructor' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                <CheckCircle2 size={10} /> Verified
                              </span>
                            ) : evaluation ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                <Clock size={10} /> Evaluated
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                Awaiting HTE
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right no-print">
                            {evaluation ? (
                              <button
                                type="button"
                                onClick={() => setSelectedEvalModal({ emp, eval: evaluation })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 rounded-lg text-xs font-bold transition-all"
                              >
                                <Eye size={12} /> View Scorecard
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Signatures for Print Mode */}
          <div className="hidden print:block pt-12 text-xs text-gray-700">
            <div className="grid grid-cols-2 gap-12 mt-8">
              <div className="text-center">
                <div className="border-t border-gray-400 w-48 mx-auto mb-1" />
                <p className="font-bold text-gray-900">OJT Coordinator / Instructor</p>
                <p className="text-[10px] text-gray-500">College of Computer Studies</p>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 w-48 mx-auto mb-1" />
                <p className="font-bold text-gray-900">College Dean</p>
                <p className="text-[10px] text-gray-500">Carlos Hilado Memorial State University</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ATTENDANCE REPORT VIEW (Existing Functionality Preserved) */}
      {/* ========================================================= */}
      {activeTab === 'attendance' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 no-print">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-gray-500">AY:</span>
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="text-sm font-semibold text-blue-700 bg-transparent focus:outline-none"
              >
                <option value="all">All Academic Years</option>
                {settings.academicYears.map((ay) => (
                  <option key={ay} value={ay}>
                    A.Y. {ay} {ay === settings.activeAcademicYear ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-gray-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm text-gray-700 bg-transparent focus:outline-none"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Filter size={14} className="text-gray-400" />
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="text-sm text-gray-700 bg-transparent focus:outline-none"
              >
                <option value="all">All Trainees</option>
                {traineeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-gray-500">DTR Status:</span>
              <select
                value={selectedApprovalStatus}
                onChange={(e) => setSelectedApprovalStatus(e.target.value as any)}
                className="text-sm font-semibold text-blue-700 bg-transparent focus:outline-none"
              >
                <option value="all">All Approval Statuses ({filteredRecords.length})</option>
                <option value="pending">Pending Approval ({pendingApprovalCount})</option>
                <option value="approved">Approved ({approvedCount})</option>
                <option value="disapproved">Disapproved ({disapprovedCount})</option>
              </select>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Total Hours Rendered</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{totalHours.toFixed(1)}h</div>
              <p className="text-xs text-gray-400 mt-1">This month</p>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Total Present Logs</span>
                <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{presentCount}</div>
              <p className="text-xs text-gray-400 mt-1">Attendance check-ins</p>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Late Arrivals</span>
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{lateCount}</div>
              <p className="text-xs text-gray-400 mt-1">Check-ins after schedule</p>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">DTR Approval Status</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle size={16} />
                </div>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="text-base sm:text-xl font-bold text-emerald-700">{approvedCount}</span>
                <span className="text-[11px] sm:text-xs text-gray-400">Approved</span>
                <span className="text-gray-300">/</span>
                <span className="text-base sm:text-xl font-bold text-rose-600">{disapprovedCount}</span>
                <span className="text-[11px] sm:text-xs text-gray-400">Disapproved</span>
              </div>
              <p className="text-xs text-amber-600 font-semibold mt-1">
                {pendingApprovalCount} pending review
              </p>
            </div>
          </div>

          {/* Daily Hours Chart */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">Daily Total Rendered Hours</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} unit="h" />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#hoursGrad)"
                    name="Total Hours"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trainee Hours Summary Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Trainee Rendering Progress</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[560px]">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-100 whitespace-nowrap">
                    <th className="py-3 px-4">Trainee</th>
                    <th className="py-3 px-4">Rendered This Month</th>
                    <th className="py-3 px-4">Required Total</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4">Present</th>
                    <th className="py-3 px-4">Late</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {employeeSummary.map(({ emp, totalHours: empHrs, present, late }) => {
                    const required = emp.requiredHours || 486;
                    const allRecords = timeRecords.filter((r) => r.employeeId === emp.id);
                    const allTotalHours = allRecords.reduce((s, r) => s + (r.totalHours || 0), 0);
                    const pct = Math.min(100, Math.round((allTotalHours / required) * 100));
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 overflow-hidden shrink-0 border border-gray-200">
                              {emp.photo ? (
                                <img src={getPhotoUrl(emp.photo)} alt={emp.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-blue-700 text-xs">
                                  {emp.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-xs">{emp.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{emp.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-blue-700">{empHrs.toFixed(1)}h</td>
                        <td className="py-3 px-4 text-gray-500">{required}h</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[80px]">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-600">{pct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-green-600 font-semibold">{present}</td>
                        <td className="py-3 px-4 text-orange-600 font-semibold">{late}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Records Table */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-blue-600" />
                  <h3 className="font-bold text-gray-800">
                    Detailed Records ({displayedDetailedRecords.length})
                  </h3>
                  {pendingApprovalCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      {pendingApprovalCount} pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Individual attendance check-ins with face/geofence verification and DTR approval actions
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter Pills */}
                <div className="inline-flex p-1 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedApprovalStatus('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      selectedApprovalStatus === 'all'
                        ? 'bg-white text-gray-800 shadow-xs font-bold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    All ({filteredRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedApprovalStatus('pending')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      selectedApprovalStatus === 'pending'
                        ? 'bg-amber-50 text-amber-800 shadow-xs border border-amber-200 font-bold'
                        : 'text-amber-700 hover:text-amber-900'
                    }`}
                  >
                    Pending ({pendingApprovalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedApprovalStatus('approved')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      selectedApprovalStatus === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 shadow-xs border border-emerald-200 font-bold'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    Approved ({approvedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedApprovalStatus('disapproved')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      selectedApprovalStatus === 'disapproved'
                        ? 'bg-rose-50 text-rose-800 shadow-xs border border-rose-200 font-bold'
                        : 'text-rose-700 hover:text-rose-900'
                    }`}
                  >
                    Disapproved ({disapprovedCount})
                  </button>
                </div>

                {/* Bulk Quick Actions & Demo Generator */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {pendingApprovalCount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleApproveAllPending}
                        title="Approve all visible pending records"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <CheckCircle size={12} /> Approve All Pending
                      </button>
                      <button
                        type="button"
                        onClick={handleDisapproveAllPending}
                        title="Disapprove all visible pending records"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <XCircle size={12} /> Disapprove All Pending
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleGenerateDemoRecord}
                    title="Generate sample attendance log for testing DTR approval"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Clock size={12} /> + Add Demo Record
                  </button>
                </div>
              </div>
            </div>

            {/* Approval Live Feedback Banner */}
            {approvalNotice && (
              <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{approvalNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setApprovalNotice(null)}
                  className="text-emerald-600 hover:text-emerald-800 p-1 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Trainee</th>
                    <th className="px-4 py-2 text-center">Time In</th>
                    <th className="px-4 py-2 text-center">Time Out</th>
                    <th className="px-4 py-2 text-center">Hours</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Verified</th>
                    <th className="px-4 py-2 text-center">DTR Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDetailedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 px-4">
                        <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Clock size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">No Attendance Records Found</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {selectedApprovalStatus !== 'all'
                                ? `No records currently marked as "${selectedApprovalStatus}". Try switching approval filter to "All" or add a demo record below to test.`
                                : 'No attendance check-ins recorded for the selected month/trainee yet.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleGenerateDemoRecord}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                          >
                            <CheckCircle size={14} /> Generate Demo Record to Test Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedDetailedRecords.map((record) => {
                      const emp = employees.find(
                        (e) =>
                          e.id === record.employeeId ||
                          e.employeeId === record.employeeId ||
                          (e.email && record.employeeId && e.email.toLowerCase() === record.employeeId.toLowerCase())
                      );
                      let displayName = emp?.name;
                      let displayCode = emp?.employeeId;
                      if (!displayName) {
                        if (record.employeeId === 'emp-1') {
                          displayName = 'Juan Dela Cruz';
                          displayCode = 'OJT-2024-001';
                        } else if (record.employeeId === 'emp-2') {
                          displayName = 'Maria Santos';
                          displayCode = 'OJT-2024-002';
                        } else if (record.employeeId === 'emp-3') {
                          displayName = 'Carlo Reyes';
                          displayCode = 'OJT-2024-003';
                        } else if (record.employeeId === 'admin-1') {
                          displayName = 'OJT Instructor';
                          displayCode = 'ADM-2024-001';
                        } else if (record.employeeId === '20231379') {
                          displayName = 'Jhey Ree Ebro';
                          displayCode = '20231379';
                        } else {
                          displayName = record.employeeId;
                          displayCode =
                            record.employeeId.startsWith('OJT-') || record.employeeId.startsWith('HTE-')
                              ? record.employeeId
                              : `OJT-${record.employeeId.slice(0, 8)}`;
                        }
                      }
                      const approvalStatus = record.approvalStatus || 'pending';

                      return (
                        <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2 text-gray-600 text-xs whitespace-nowrap">
                            {new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-700 overflow-hidden shrink-0 border border-blue-200">
                                {emp?.photo ? (
                                  <img
                                    src={getPhotoUrl(emp.photo)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    style={{ transform: 'scaleX(-1)' }}
                                  />
                                ) : (
                                  <span>{(displayName || 'U').charAt(0)}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 text-xs">{displayName}</p>
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 mt-0.5">
                                  {displayCode || 'OJT-TRAINEE'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center text-xs text-gray-600 font-mono">
                            {record.timeIn ? formatTime(record.timeIn) : '—'}
                          </td>
                          <td className="px-4 py-2 text-center text-xs text-gray-600 font-mono">
                            {record.timeOut ? formatTime(record.timeOut) : '—'}
                          </td>
                          <td className="px-4 py-2 text-center text-xs font-semibold text-blue-700">
                            {record.totalHours ? `${record.totalHours.toFixed(1)}h` : '—'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                record.status === 'present'
                                  ? 'bg-green-100 text-green-700'
                                  : record.status === 'late'
                                    ? 'bg-orange-100 text-orange-700'
                                    : record.status === 'overtime'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {record.timeInFaceVerified && (
                                <span title="Face Verified" className="text-purple-500">
                                  👤
                                </span>
                              )}
                              {record.timeInGeofenced && (
                                <span title="Geofenced" className="text-green-500">
                                  📍
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {approvalStatus === 'approved' ? (
                                <div className="inline-flex items-center gap-1">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                                    <CheckCircle size={12} className="text-emerald-600" /> Approved
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDisapproveWithFeedback(record.id, displayName || 'Trainee')}
                                    title="Change status to Disapproved"
                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-md transition-all cursor-pointer"
                                  >
                                    Disapprove
                                  </button>
                                </div>
                              ) : approvalStatus === 'disapproved' ? (
                                <div className="inline-flex items-center gap-1">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 shadow-2xs">
                                    <XCircle size={12} className="text-rose-600" /> Disapproved
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveWithFeedback(record.id, displayName || 'Trainee')}
                                    title="Change status to Approved"
                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-md transition-all cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveWithFeedback(record.id, displayName || 'Trainee')}
                                    title="Approve DTR"
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-[#16a34a] hover:bg-[#15803d] text-white rounded-full shadow-xs transition-colors cursor-pointer"
                                  >
                                    <CheckCircle size={12} /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDisapproveWithFeedback(record.id, displayName || 'Trainee')}
                                    title="Reject DTR"
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-full shadow-xs transition-colors cursor-pointer"
                                  >
                                    <XCircle size={12} /> Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}

      {/* ========================================================= */}
      {/* DETAILED EVALUATION SCORECARD MODAL                       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {selectedEvalModal && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => e.target === e.currentTarget && setSelectedEvalModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Award size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">HTE Performance Scorecard</h3>
                    <p className="text-xs text-gray-400">{selectedEvalModal.emp.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="p-2 text-gray-500 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
                    title="Print Evaluation"
                  >
                    <Printer size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedEvalModal(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Hero Overall Grade */}
                {selectedEvalModal.eval && (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-white border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Official Assessment
                      </span>
                      <h4 className="text-xl font-black text-emerald-950 mt-1">
                        {selectedEvalModal.eval.grade || 'Evaluated'}
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Evaluated by: <strong>{selectedEvalModal.eval.evaluatorName || 'HTE Supervisor'}</strong>
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Date: {selectedEvalModal.eval.date} • AY: {selectedEvalModal.eval.academicYear || settings?.activeAcademicYear}
                      </p>
                    </div>

                    <div className="text-center px-6 py-3 bg-white rounded-2xl shadow-sm border border-emerald-100">
                      <span className="text-3xl font-black text-emerald-700">{selectedEvalModal.eval.totalScore}%</span>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Overall Rating</p>
                    </div>
                  </div>
                )}

                {/* Trainee and Company Info */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div>
                    <span className="text-gray-400 font-medium">Trainee Name:</span>
                    <p className="font-bold text-gray-800">{selectedEvalModal.emp.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium">Student ID:</span>
                    <p className="font-bold text-gray-800 font-mono">{selectedEvalModal.emp.employeeId}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium">HTE Establishment:</span>
                    <p className="font-bold text-gray-800">{selectedEvalModal.emp.companyName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium">Degree Program:</span>
                    <p className="font-bold text-gray-800">{selectedEvalModal.emp.course || 'BS Information Systems'}</p>
                  </div>
                </div>

                {/* Competency Scores Breakdown */}
                {selectedEvalModal.eval && (
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Core Competency Domain Breakdown
                    </h5>
                    <div className="space-y-2.5">
                      {[
                        { title: 'Quality of Work & Competence (25%)', val: selectedEvalModal.eval.performanceScore },
                        { title: 'Punctuality & Attendance (20%)', val: selectedEvalModal.eval.attendanceScore },
                        { title: 'Professional Work Attitude (20%)', val: selectedEvalModal.eval.attitudeScore },
                        { title: 'Dependability & Deadline Delivery (15%)', val: selectedEvalModal.eval.punctualityScore },
                        { title: 'Interpersonal & Communication Skills (20%)', val: selectedEvalModal.eval.communicationScore },
                      ].map((domain, i) => (
                        <div key={i} className="p-3 bg-white border border-gray-200/80 rounded-xl">
                          <div className="flex justify-between items-center text-xs font-semibold mb-1">
                            <span className="text-gray-700">{domain.title}</span>
                            <span className="font-mono text-gray-900 font-bold">{domain.val}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                              style={{ width: `${domain.val}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Qualitative Remarks */}
                {selectedEvalModal.eval && (
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Supervisor Evaluation Remarks
                    </h5>
                    <div className="space-y-2 text-xs">
                      {selectedEvalModal.eval.strengths && (
                        <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                          <span className="font-bold text-emerald-800 block mb-0.5">Key Strengths & Commendations:</span>
                          <p className="text-gray-700">{selectedEvalModal.eval.strengths}</p>
                        </div>
                      )}
                      {selectedEvalModal.eval.areasForImprovement && (
                        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                          <span className="font-bold text-amber-800 block mb-0.5">Areas for Growth & Guidance:</span>
                          <p className="text-gray-700">{selectedEvalModal.eval.areasForImprovement}</p>
                        </div>
                      )}
                      {selectedEvalModal.eval.recommendations && (
                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                          <span className="font-bold text-blue-800 block mb-0.5">Future Recommendations:</span>
                          <p className="text-gray-700">{selectedEvalModal.eval.recommendations}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvalModal(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
