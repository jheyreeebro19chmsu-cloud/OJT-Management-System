import React, { useState, useMemo } from 'react';
import {
  Printer,
  Download,
  Calendar,
  User as UserIcon,
  Building,
  CheckCircle2,
  Clock,
  Edit3,
  Save,
  FileSpreadsheet,
  AlertCircle,
  PenTool,
  X,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Employee, TimeRecord, MonthlyDttrRecord, MonthlyDttrDayEntry } from '../types';

interface MonthlyDTTRViewProps {
  /** Optional pre-selected trainee ID. If not supplied, selector is provided. */
  defaultEmployeeId?: string;
  /** Role context: 'admin' (Instructor), 'hte' (HTE Supervisor), or 'employee' (Trainee) */
  viewerRole?: 'admin' | 'hte' | 'employee';
  /** If true, locks trainee selection to defaultEmployeeId */
  readOnlyTrainee?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MonthlyDTTRView: React.FC<MonthlyDTTRViewProps> = ({
  defaultEmployeeId,
  viewerRole = 'admin',
  readOnlyTrainee = false,
}) => {
  const {
    employees,
    timeRecords,
    currentUser,
    hostSupervisors,
    getMonthlyDttr,
    saveMonthlyDttr,
    signMonthlyDttr,
  } = useApp();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12

  // Available trainees
  const traineeList = useMemo(() => {
    return employees.filter(
      (e) => !e.position?.toLowerCase().includes('instructor') && !e.position?.toLowerCase().includes('admin')
    );
  }, [employees]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
    if (defaultEmployeeId) return defaultEmployeeId;
    if (viewerRole === 'employee' && currentUser?.id) return currentUser.id;
    return traineeList[0]?.id || '';
  });

  const selectedEmployee = useMemo(() => {
    return (
      employees.find((e) => e.id === selectedEmployeeId || e.employeeId === selectedEmployeeId) ||
      traineeList[0] ||
      null
    );
  }, [employees, selectedEmployeeId, traineeList]);

  const instructorName = useMemo(() => {
    if (selectedEmployee?.instructorId) {
      const linked = employees.find(
        (e) => e.id === selectedEmployee.instructorId || e.employeeId === selectedEmployee.instructorId
      );
      if (linked?.name) return linked.name;
    }
    const anyInst = employees.find(
      (e) =>
        e.position === 'OJT Instructor' ||
        (e.position && e.position.toLowerCase().includes('instructor'))
    );
    if (anyInst?.name) return anyInst.name;
    return 'CHMSU OJT Coordinator';
  }, [selectedEmployee, employees]);

  // Number of days in selected month/year
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Existing saved DTTR for this month
  const savedDttr = useMemo(() => {
    if (!selectedEmployee) return null;
    return getMonthlyDttr(selectedEmployee.id, selectedYear, selectedMonth);
  }, [getMonthlyDttr, selectedEmployee, selectedYear, selectedMonth]);

  // Modal / Editing states
  const [isEditingTasks, setIsEditingTasks] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [editDayEntries, setEditDayEntries] = useState<Record<number, MonthlyDttrDayEntry>>({});
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('HTE Supervisor');
  const [signNotes, setSignNotes] = useState('');

  // Daily records map for the selected month
  const monthTimeRecordsMap = useMemo(() => {
    const map = new Map<number, TimeRecord>();
    if (!selectedEmployee) return map;

    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const empRecords = timeRecords.filter(
      (r) =>
        (r.employeeId === selectedEmployee.id || r.employeeId === selectedEmployee.employeeId) &&
        r.date &&
        r.date.startsWith(monthStr)
    );

    empRecords.forEach((r) => {
      const dayNum = parseInt(r.date.split('-')[2], 10);
      if (!Number.isNaN(dayNum)) {
        map.set(dayNum, r);
      }
    });

    return map;
  }, [timeRecords, selectedEmployee, selectedYear, selectedMonth]);

  // Compute daily rows combining raw attendance + custom DTTR overrides
  const dailyRows = useMemo(() => {
    const rows: {
      day: number;
      amArrival: string;
      amDeparture: string;
      pmArrival: string;
      pmDeparture: string;
      hours: number;
      tasks: string;
      source: 'auto' | 'custom' | 'empty';
    }[] = [];

    const customEntries = savedDttr?.customEntries || {};

    for (let day = 1; day <= daysInMonth; day++) {
      const custom = customEntries[day];
      const autoRec = monthTimeRecordsMap.get(day);

      if (custom && (custom.amArrival || custom.pmDeparture || custom.hours || custom.tasks)) {
        rows.push({
          day,
          amArrival: custom.amArrival || '',
          amDeparture: custom.amDeparture || '',
          pmArrival: custom.pmArrival || '',
          pmDeparture: custom.pmDeparture || '',
          hours: typeof custom.hours === 'number' ? custom.hours : 0,
          tasks: custom.tasks || '',
          source: 'custom',
        });
      } else if (autoRec && (autoRec.timeIn || autoRec.timeOut)) {
        // Parse automated attendance into AM / PM slots
        let amIn = '';
        let amOut = '';
        let pmIn = '';
        let pmOut = '';

        const parseH = (tStr?: string) => {
          if (!tStr) return null;
          const [h, m] = tStr.split(':').map(Number);
          return { h, m, raw: tStr };
        };

        const tIn = parseH(autoRec.timeIn);
        const tOut = parseH(autoRec.timeOut);

        const format12 = (h: number, m: number) => {
          const ampm = h >= 12 ? 'PM' : 'AM';
          const hh = h % 12 === 0 ? 12 : h % 12;
          const mm = String(m).padStart(2, '0');
          return `${hh}:${mm} ${ampm}`;
        };

        if (tIn && tOut) {
          if (tIn.h < 12 && tOut.h >= 12) {
            // Full day spanning lunch break
            amIn = format12(tIn.h, tIn.m);
            amOut = '12:00 PM';
            pmIn = '1:00 PM';
            pmOut = format12(tOut.h, tOut.m);
          } else if (tIn.h < 12 && tOut.h < 12) {
            // Morning only
            amIn = format12(tIn.h, tIn.m);
            amOut = format12(tOut.h, tOut.m);
          } else {
            // Afternoon only
            pmIn = format12(tIn.h, tIn.m);
            pmOut = format12(tOut.h, tOut.m);
          }
        } else if (tIn) {
          if (tIn.h < 12) {
            amIn = format12(tIn.h, tIn.m);
          } else {
            pmIn = format12(tIn.h, tIn.m);
          }
        }

        const autoHours = autoRec.totalHours || 0;
        const taskText = autoRec.notes || '';

        rows.push({
          day,
          amArrival: amIn,
          amDeparture: amOut,
          pmArrival: pmIn,
          pmDeparture: pmOut,
          hours: autoHours,
          tasks: taskText,
          source: 'auto',
        });
      } else {
        rows.push({
          day,
          amArrival: '',
          amDeparture: '',
          pmArrival: '',
          pmDeparture: '',
          hours: 0,
          tasks: '',
          source: 'empty',
        });
      }
    }

    return rows;
  }, [daysInMonth, monthTimeRecordsMap, savedDttr]);

  // Automatic total hours for the month
  const totalMonthlyHours = useMemo(() => {
    return dailyRows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  }, [dailyRows]);

  // Number of active rendered days
  const totalRenderedDays = useMemo(() => {
    return dailyRows.filter((r) => r.hours > 0 || r.amArrival || r.pmDeparture).length;
  }, [dailyRows]);

  // HTE Company and Supervisor details
  const companyName = selectedEmployee?.companyName || (selectedEmployee as any)?.company || selectedEmployee?.department || 'Partner Host Training Establishment';
  const supervisorFromHost = useMemo(() => {
    const comp = selectedEmployee?.companyName || (selectedEmployee as any)?.company;
    if (!comp) return null;
    return hostSupervisors.find(
      (h) => h.companyName?.toLowerCase() === comp.toLowerCase()
    );
  }, [hostSupervisors, selectedEmployee]);

  const defaultSupervisorName =
    savedDttr?.hteSupervisorName ||
    supervisorFromHost?.name ||
    (viewerRole === 'hte' && currentUser?.name ? currentUser.name : 'HTE Supervisor');

  // Start editing tasks
  const handleOpenEditTasks = () => {
    const entries: Record<number, MonthlyDttrDayEntry> = {};
    dailyRows.forEach((r) => {
      entries[r.day] = {
        day: r.day,
        amArrival: r.amArrival,
        amDeparture: r.amDeparture,
        pmArrival: r.pmArrival,
        pmDeparture: r.pmDeparture,
        hours: r.hours,
        tasks: r.tasks,
      };
    });
    setEditDayEntries(entries);
    setIsEditingTasks(true);
  };

  const handleSaveTasks = () => {
    if (!selectedEmployee) return;
    const record: MonthlyDttrRecord = {
      id: `${selectedEmployee.id}_${selectedYear}_${selectedMonth}`,
      employeeId: selectedEmployee.id,
      year: selectedYear,
      month: selectedMonth,
      customEntries: editDayEntries,
      hteSupervisorName: savedDttr?.hteSupervisorName,
      hteSupervisorTitle: savedDttr?.hteSupervisorTitle,
      hteSignedAt: savedDttr?.hteSignedAt,
      hteSignatureStatus: savedDttr?.hteSignatureStatus || 'pending',
    };
    saveMonthlyDttr(record);
    setIsEditingTasks(false);
  };

  // Open Sign Modal
  const handleOpenSignModal = () => {
    setSignerName(defaultSupervisorName);
    setSignerTitle(savedDttr?.hteSupervisorTitle || supervisorFromHost?.position || 'HTE Supervisor');
    setSignNotes(savedDttr?.hteSignatureNotes || '');
    setIsSignModalOpen(true);
  };

  // Submit Sign
  const handleConfirmSign = () => {
    if (!selectedEmployee || !signerName.trim()) return;
    signMonthlyDttr(
      selectedEmployee.id,
      selectedYear,
      selectedMonth,
      signerName.trim(),
      signerTitle.trim() || 'HTE Supervisor'
    );
    setIsSignModalOpen(false);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!selectedEmployee) return;
    const monthName = MONTH_NAMES[selectedMonth - 1];
    const headers = [
      'Day',
      'AM Arrival',
      'AM Departure',
      'PM Arrival',
      'PM Departure',
      'No. of Hours',
      'Tasks / Assignments Performed',
    ];

    const dataRows = dailyRows.map((r) => [
      r.day,
      `"${r.amArrival}"`,
      `"${r.amDeparture}"`,
      `"${r.pmArrival}"`,
      `"${r.pmDeparture}"`,
      r.hours || 0,
      `"${(r.tasks || '').replace(/"/g, '""')}"`,
    ]);

    dataRows.push(['TOTAL', '', '', '', '', totalMonthlyHours, '']);
    dataRows.push(['Trainee', `"${selectedEmployee.name}"`, '', '', '', '', '']);
    dataRows.push(['HTE Company', `"${companyName}"`, '', '', '', '', '']);
    dataRows.push(['Month', `"${monthName} ${selectedYear}"`, '', '', '', '', '']);
    dataRows.push(['HTE Supervisor Signature', `"${savedDttr?.hteSupervisorName || 'Pending'}"`, '', '', '', '', '']);

    const csvContent = [headers.join(','), ...dataRows.map((e) => e.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `DTTR_${selectedEmployee.name.replace(/\s+/g, '_')}_${monthName}_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isSignedByHte = savedDttr?.hteSignatureStatus === 'signed';

  return (
    <div className="space-y-6">
      {/* Control & Filter Bar (Hidden on Print) */}
      <div className="no-print bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Monthly DTTR Monitoring</span>
                {isSignedByHte ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 size={12} /> HTE Signed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <AlertCircle size={12} /> Pending HTE Sign-off
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Official CHMSU Daily Time & Tasks Record with automatic hours calculation and official HTE supervisor endorsement
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenEditTasks}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              <Edit3 size={14} />
              <span>Edit Tasks & Hours</span>
            </button>

            {(viewerRole === 'hte' || viewerRole === 'admin') && (
              <button
                type="button"
                onClick={handleOpenSignModal}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  isSignedByHte
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <PenTool size={14} />
                <span>{isSignedByHte ? 'Update HTE Signature' : 'Sign & Endorse as HTE'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Print Complete Official DTTR Document"
            >
              <Printer size={14} />
              <span>Print Official DTTR (Full Doc)</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          {!readOnlyTrainee && (
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Select Trainee Intern
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {traineeList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.employeeId || 'No ID'}) - {t.companyName || (t as any).company || 'Unassigned'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500">Rendered Days</span>
            <p className="text-lg font-black text-slate-800">{totalRenderedDays} days</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-emerald-700">Automatic Monthly Hours</span>
            <p className="text-lg font-black text-emerald-800">{totalMonthlyHours.toFixed(1)} hrs</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-blue-700">HTE Partner</span>
            <p className="text-xs font-bold text-blue-900 truncate" title={companyName}>
              {companyName}
            </p>
          </div>
          <div className={`border rounded-2xl p-3 ${isSignedByHte ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <span className="text-[10px] uppercase font-bold text-slate-600">Supervisor Endorsement</span>
            <p className="text-xs font-bold truncate text-slate-900">
              {isSignedByHte ? savedDttr?.hteSupervisorName : 'Pending Signature'}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================
          OFFICIAL PRINTABLE / VIEWABLE DTTR DOCUMENT (EXACT CHMSU FORMAT)
          ========================================================= */}
      <div
        id="dttr-printable-document"
        className="dttr-sheet bg-white p-6 sm:p-10 rounded-3xl border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none"
      >
        {/* CHMSU Official Institutional Header */}
        <div className="text-center relative pb-3 mb-3 print:pb-1.5 print:mb-1.5 border-b-2 border-slate-900">
          <div className="flex items-center justify-between gap-3 mb-1 print:mb-0.5">
            <div className="w-16 h-16 shrink-0 flex items-center justify-center print:w-12 print:h-12">
              <img
                src="/chmsu-logo.png"
                alt="CHMSU Logo"
                className="w-14 h-14 object-contain drop-shadow-xs print:w-11 print:h-11"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 px-1 text-center">
              <p className="text-[9px] print:text-[7.5pt] uppercase tracking-widest text-slate-600 font-bold">
                Republic of the Philippines
              </p>
              <h1 className="text-base sm:text-lg print:text-[12pt] font-black text-emerald-950 tracking-tight leading-tight uppercase font-serif">
                CARLOS HILADO MEMORIAL STATE UNIVERSITY
              </h1>
              <p className="text-[9.5px] print:text-[7.5pt] text-slate-600 font-medium">
                Alijis Campus • Binalbagan Campus • Fortune Towne Campus • Talisay (Main) Campus
              </p>
              <p className="text-[9px] print:text-[7pt] text-emerald-800 font-semibold italic">
                A leading GREEN institution of higher learning in the global community by 2030
              </p>
              <h2 className="text-xs print:text-[8.5pt] font-black uppercase tracking-wider text-slate-900 mt-1 print:mt-0.5">
                College of Computer Studies
              </h2>
              <h3 className="text-sm sm:text-base print:text-[10pt] font-black text-slate-950 tracking-wide uppercase mt-0.5">
                DAILY TIME &amp; TASKS RECORD (DTTR)
              </h3>
            </div>
            <div className="w-16 h-16 shrink-0 flex flex-col items-center justify-center text-right text-[8px] print:text-[7pt] text-slate-500 font-mono leading-tight print:w-12 print:h-12">
              <span className="font-bold text-slate-700">CHMSU-CCS</span>
              <span>DTTR-FM-01</span>
              <span>Rev: 01</span>
              <span>AY 2026-2027</span>
            </div>
          </div>
        </div>

        {/* Trainee & Agency Details Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:gap-2 text-xs print:text-[8pt] font-medium text-slate-800 mb-3 print:mb-1.5">
          <div className="space-y-1.5 print:space-y-0.5">
            <div className="flex items-baseline">
              <span className="font-bold text-[11px] print:text-[8pt] text-slate-900 whitespace-nowrap mr-2">NAME OF TRAINEE:</span>
              <span className="flex-1 font-black text-sm print:text-[9pt] text-slate-950 uppercase border-b border-slate-800 px-1 pb-0.5 tracking-wide">
                {selectedEmployee?.name || '__________________________'}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-[10px] print:text-[7.5pt] text-slate-700 whitespace-nowrap mr-2">
                HOST TRAINING ESTABLISHMENT (HTE) / AGENCY:
              </span>
              <span className="flex-1 font-semibold text-xs print:text-[8pt] text-slate-900 border-b border-slate-800 px-1 pb-0.5 truncate">
                {companyName}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 print:space-y-0.5 md:pl-4 print:pl-2">
            <div className="flex items-baseline">
              <span className="font-bold text-[11px] print:text-[8pt] text-slate-900 whitespace-nowrap mr-2">MONTH &amp; YEAR:</span>
              <span className="flex-1 font-bold text-sm print:text-[9pt] text-slate-900 border-b border-slate-800 px-1 pb-0.5">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-[10px] print:text-[7.5pt] text-slate-700 whitespace-nowrap mr-2">
                COURSE, YEAR &amp; SECTION:
              </span>
              <span className="flex-1 text-xs print:text-[8pt] text-slate-900 border-b border-slate-800 px-1 pb-0.5 truncate">
                {selectedEmployee?.course || 'BS Information Systems'} • {selectedEmployee?.campus || 'Alijis Campus'}
              </span>
            </div>
          </div>
        </div>

        {/* Official DTTR Table (Pixel-perfect match to CHMSU paper form) */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse border-2 border-slate-900 text-xs print:text-[7.5pt] font-sans text-slate-900">
            <thead>
              {/* Row 1 Headers */}
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th
                  rowSpan={2}
                  className="border-r border-slate-900 px-1 py-1.5 print:py-0.5 w-8 print:w-7 text-[11px] print:text-[7.5pt] font-black"
                >
                  DAY
                </th>
                <th
                  colSpan={4}
                  className="border-r border-slate-900 py-1 print:py-0.5 text-[11px] print:text-[7.5pt] uppercase tracking-wider font-black"
                >
                  Official Hour of Arrival and Departure
                </th>
                <th
                  rowSpan={2}
                  className="border-r border-slate-900 px-1 py-1.5 print:py-0.5 w-14 print:w-11 text-[10px] print:text-[7pt] font-black uppercase leading-tight"
                >
                  NO. OF<br />HOURS
                </th>
                <th
                  rowSpan={2}
                  className="px-2 py-1.5 print:py-0.5 text-left text-[11px] print:text-[7.5pt] font-black uppercase tracking-wider"
                >
                  TASKS / ASSIGNMENTS PERFORMED
                </th>
              </tr>

              {/* Row 2 Subheaders */}
              <tr className="bg-slate-50 text-slate-800 border-b-2 border-slate-900 text-center text-[10px] print:text-[7pt] font-bold">
                <th colSpan={2} className="border-r border-slate-900 py-0.5 print:py-0">
                  <div className="font-black text-slate-900 border-b border-slate-300 pb-0.5 print:pb-0">AM</div>
                  <div className="grid grid-cols-2 text-[9px] print:text-[6.5pt] pt-0.5 print:pt-0">
                    <span className="border-r border-slate-300">ARRIVAL</span>
                    <span>DEPARTURE</span>
                  </div>
                </th>
                <th colSpan={2} className="border-r border-slate-900 py-0.5 print:py-0">
                  <div className="font-black text-slate-900 border-b border-slate-300 pb-0.5 print:pb-0">PM</div>
                  <div className="grid grid-cols-2 text-[9px] print:text-[6.5pt] pt-0.5 print:pt-0">
                    <span className="border-r border-slate-300">ARRIVAL</span>
                    <span>DEPARTURE</span>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {dailyRows.map((r) => {
                const isEven = r.day % 2 === 0;
                const hasData = r.hours > 0 || r.amArrival || r.pmDeparture;
                return (
                  <tr
                    key={r.day}
                    className={`border-b border-slate-400 text-center print:py-0 print:border-slate-700 ${
                      !hasData ? 'text-slate-400 bg-white' : isEven ? 'bg-slate-50/60 print:bg-white' : 'bg-white'
                    }`}
                  >
                    {/* DAY */}
                    <td className="border-r border-slate-900 font-bold text-slate-900 text-[11px] print:text-[7.5pt] py-0.5 print:py-0">
                      {r.day}
                    </td>

                    {/* AM ARRIVAL */}
                    <td className="border-r border-slate-300 print:border-slate-400 text-[10px] print:text-[7pt] px-1 py-0.5 print:py-0 font-medium whitespace-nowrap">
                      {r.amArrival || ''}
                    </td>

                    {/* AM DEPARTURE */}
                    <td className="border-r border-slate-900 text-[10px] print:text-[7pt] px-1 py-0.5 print:py-0 font-medium whitespace-nowrap">
                      {r.amDeparture || ''}
                    </td>

                    {/* PM ARRIVAL */}
                    <td className="border-r border-slate-300 print:border-slate-400 text-[10px] print:text-[7pt] px-1 py-0.5 print:py-0 font-medium whitespace-nowrap">
                      {r.pmArrival || ''}
                    </td>

                    {/* PM DEPARTURE */}
                    <td className="border-r border-slate-900 text-[10px] print:text-[7pt] px-1 py-0.5 print:py-0 font-medium whitespace-nowrap">
                      {r.pmDeparture || ''}
                    </td>

                    {/* NO. OF HOURS (Automatic) */}
                    <td className="border-r border-slate-900 font-bold text-slate-900 text-[11px] print:text-[7.5pt] px-1 py-0.5 print:py-0 bg-slate-50/30 print:bg-white">
                      {r.hours > 0 ? r.hours : ''}
                    </td>

                    {/* TASKS / ASSIGNMENTS PERFORMED */}
                    <td className="text-left px-2 py-0.5 print:py-0 print:px-1 text-[11px] print:text-[7pt] text-slate-800 leading-tight truncate max-w-[320px] sm:max-w-none print:max-w-none print:overflow-visible print:whitespace-normal">
                      {r.tasks || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer with TOTAL NO. OF HOURS */}
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-100 print:bg-slate-50 font-black text-slate-900">
                <td colSpan={5} className="border-r border-slate-900 px-3 py-1.5 print:py-0.5 text-right text-xs print:text-[7.5pt] uppercase tracking-wider">
                  TOTAL NO. OF HOURS:
                </td>
                <td className="border-r border-slate-900 px-2 py-1.5 print:py-0.5 text-center text-sm print:text-[8pt] font-black bg-white border-2 border-slate-900">
                  {totalMonthlyHours.toFixed(0)}
                </td>
                <td className="px-3 py-1.5 print:py-0.5 text-[10px] print:text-[7pt] text-slate-600 font-normal italic">
                  Automatic summary of daily rendered OJT hours for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Certification Statement */}
        <div className="mt-2 text-[10px] sm:text-[11px] print:text-[7.5pt] text-slate-800 text-justify leading-relaxed italic border-t border-slate-400 pt-1.5 print:mt-1 print:pt-1">
          I hereby certify on my honor that the above is a true and correct report of hours and assignments/tasks
          performed, a record of which was made daily at the time of arrival and departure from the office.
        </div>

        {/* Official 3-Party Signatures Section */}
        <div className="mt-4 pt-2 print:mt-2 print:pt-1 border-t border-slate-300 print:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 print:gap-3 text-center text-xs print:text-[8pt] dttr-break-avoid">
          {/* 1. Student Trainee Signature */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[200px] border-b-2 border-slate-900 pb-0.5 mb-0.5 min-h-[20px] print:min-h-[16px] flex items-end justify-center">
              <span className="font-bold text-xs sm:text-sm print:text-[8.5pt] uppercase text-slate-900 truncate block">
                {selectedEmployee?.name}
              </span>
            </div>
            <p className="font-extrabold text-[11px] print:text-[7.5pt] uppercase tracking-wider text-slate-800">
              OJT Trainee Signature
            </p>
            <p className="text-[10px] print:text-[7pt] text-slate-500">
              Student ID: {selectedEmployee?.employeeId || 'OJT-STUDENT'}
            </p>
          </div>

          {/* 2. HTE Supervisor Signature & Endorsement */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[220px] border-b-2 border-slate-900 pb-0.5 mb-0.5 relative min-h-[20px] print:min-h-[16px] flex items-end justify-center">
              {isSignedByHte ? (
                <div className="space-y-0.5">
                  <span className="font-black text-xs sm:text-sm print:text-[8.5pt] uppercase text-slate-900 truncate block">
                    {savedDttr?.hteSupervisorName || defaultSupervisorName}
                  </span>
                  <div className="text-[8px] print:text-[6.5pt] font-bold text-emerald-700 uppercase flex items-center justify-center gap-1 print:text-black">
                    <CheckCircle2 size={10} /> Verified &amp; Signed {savedDttr?.hteSignedAt ? new Date(savedDttr.hteSignedAt).toLocaleDateString() : ''}
                  </div>
                </div>
              ) : (
                <span className="font-bold text-xs print:text-[8.5pt] uppercase text-slate-900 truncate block">
                  {savedDttr?.hteSupervisorName || defaultSupervisorName || 'HTE Supervisor'}
                </span>
              )}
            </div>
            <p className="font-extrabold text-[11px] print:text-[7.5pt] uppercase tracking-wider text-slate-800">
              Immediate HTE Supervisor
            </p>
            <p className="text-[10px] print:text-[7pt] text-slate-500 truncate max-w-[220px]">
              {savedDttr?.hteSupervisorTitle || supervisorFromHost?.position || 'Supervisor'} • {companyName}
            </p>
          </div>

          {/* 3. CHMSU OJT Coordinator / Instructor */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[220px] border-b-2 border-slate-900 pb-0.5 mb-0.5 min-h-[20px] print:min-h-[16px] flex items-end justify-center">
              <span className="font-black text-xs sm:text-sm print:text-[8.5pt] uppercase text-slate-900 truncate block">
                {instructorName}
              </span>
            </div>
            <p className="font-extrabold text-[11px] print:text-[7.5pt] uppercase tracking-wider text-slate-800">
              CHMSU OJT Coordinator
            </p>
            <p className="text-[10px] print:text-[7pt] text-slate-500">
              College of Computer Studies
            </p>
          </div>
        </div>

        {/* Institutional Footer */}
        <div className="mt-4 pt-1.5 print:mt-1.5 print:pt-1 border-t-2 border-emerald-800/60 print:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[9px] print:text-[6.5pt] text-slate-600 font-medium">
          <span>college.computerstudies@chmsu.edu.ph • (034) 434 8148 • chmsu.edu.ph</span>
          <span className="font-black tracking-widest text-emerald-900 uppercase">
            GREEN CHMSU EXCELSIOR!
          </span>
          <span>Doc Code: CHMSU-CCS-DTTR-FM-01</span>
        </div>
      </div>

      {/* =========================================================
          MODAL: EDIT DAILY TASKS & HOURS
          ========================================================= */}
      {isEditingTasks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Edit3 size={18} className="text-blue-600" />
                  <span>Edit Daily Tasks &amp; Hours ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Update daily tasks performed and manual arrival/departure adjustments for {selectedEmployee?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingTasks(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {dailyRows.map((r) => {
                const entry = editDayEntries[r.day] || {
                  day: r.day,
                  amArrival: r.amArrival,
                  amDeparture: r.amDeparture,
                  pmArrival: r.pmArrival,
                  pmDeparture: r.pmDeparture,
                  hours: r.hours,
                  tasks: r.tasks,
                };

                return (
                  <div
                    key={r.day}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <div className="w-10 font-black text-slate-800 text-xs text-center shrink-0">
                      Day {r.day}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-[10px] w-full sm:w-64 shrink-0">
                      <input
                        type="text"
                        placeholder="AM In"
                        value={entry.amArrival || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditDayEntries((prev) => ({
                            ...prev,
                            [r.day]: { ...prev[r.day], day: r.day, amArrival: val },
                          }));
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="AM Out"
                        value={entry.amDeparture || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditDayEntries((prev) => ({
                            ...prev,
                            [r.day]: { ...prev[r.day], day: r.day, amDeparture: val },
                          }));
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="PM In"
                        value={entry.pmArrival || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditDayEntries((prev) => ({
                            ...prev,
                            [r.day]: { ...prev[r.day], day: r.day, pmArrival: val },
                          }));
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="PM Out"
                        value={entry.pmDeparture || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditDayEntries((prev) => ({
                            ...prev,
                            [r.day]: { ...prev[r.day], day: r.day, pmDeparture: val },
                          }));
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>

                    <div className="w-16 shrink-0">
                      <input
                        type="number"
                        placeholder="Hrs"
                        step="0.5"
                        min="0"
                        max="24"
                        value={entry.hours !== undefined ? entry.hours : ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditDayEntries((prev) => ({
                            ...prev,
                            [r.day]: { ...prev[r.day], day: r.day, hours: val },
                          }));
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                      />
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Tasks / assignments performed on this day..."
                        value={entry.tasks || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditDayEntries((prev) => ({
                            ...prev,
                            [r.day]: { ...prev[r.day], day: r.day, tasks: val },
                          }));
                        }}
                        className="w-full px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsEditingTasks(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTasks}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: SIGN & ENDORSE AS HTE SUPERVISOR
          ========================================================= */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <PenTool size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">HTE Supervisor Endorsement</h3>
                  <p className="text-[11px] text-slate-500">Sign official monthly attendance report</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Trainee Intern:</span>
                  <span className="font-bold text-slate-800">{selectedEmployee?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Period:</span>
                  <span className="font-bold text-slate-800">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Rendered Hours:</span>
                  <span className="font-black text-emerald-700">{totalMonthlyHours.toFixed(1)} hrs</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Supervisor Printed Name *
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="e.g. SERGIO JAMES B. GOLEZ, RN"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Designation / License / Position
                </label>
                <input
                  type="text"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="e.g. HTE Supervisor / Registered Nurse"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-[11px] text-emerald-900 leading-tight flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                <span>
                  By signing, you officially verify that the trainee intern rendered the indicated hours and performed
                  the tasks stated in this monthly record.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsSignModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSign}
                disabled={!signerName.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <PenTool size={14} />
                <span>Confirm &amp; Endorse</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
