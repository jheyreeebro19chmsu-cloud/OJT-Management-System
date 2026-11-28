import {
  CalendarRange,
  Plus,
  Save,
  Sparkles,
  CheckCircle2,
  FolderPlus,
  Layers,
  Users,
  Clock,
  Award,
  ArrowRight,
  RefreshCw,
  Database,
  Building2,
  GraduationCap,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';
import { TRAINEE_REQUIRED_HOURS, getAcademicYearRequiredHours } from '../../data/ojtConstants';

export function AcademicYearManagement() {
  const {
    settings,
    updateSettings,
    employees,
    hostSupervisors,
    timeRecords,
    evaluations,
    syncAllAccountsAcrossAcademicYears,
    repairAndPersistDatabase,
  } = useApp();
  const [form, setForm] = useState(settings);
  const [newAcademicYear, setNewAcademicYear] = useState('');
  const [newAcademicYearHours, setNewAcademicYearHours] = useState<string>(String(TRAINEE_REQUIRED_HOURS));
  const [hoursDraftByYear, setHoursDraftByYear] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    // Collect all academic years from settings, default list, and employees in the system
    const employeeAYs = employees
      .map((e) => e.academicYear)
      .filter((ay): ay is string => Boolean(ay && /^\d{4}-\d{4}$/.test(ay)));

    const allYears = Array.from(new Set([
      ...(settings.academicYears || ['2025-2026', '2026-2027']),
      ...employeeAYs,
      '2025-2026',
      '2026-2027',
    ]));

    const resolvedHoursMap: Record<string, number> = {
      ...(settings.academicYearHours || {}),
    };
    const nextDrafts: Record<string, string> = {};
    for (const yr of allYears) {
      const hrs = getAcademicYearRequiredHours(yr, settings.academicYearHours);
      resolvedHoursMap[yr] = hrs;
      nextDrafts[yr] = String(hrs);
    }

    setForm({
      ...settings,
      academicYears: allYears,
      activeAcademicYear: settings.activeAcademicYear || '2026-2027',
      academicYearHours: resolvedHoursMap,
    });
    setHoursDraftByYear(nextDrafts);
  }, [settings, employees]);

  const handleAddAcademicYear = () => {
    const academicYear = newAcademicYear.trim();

    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      toast.error('Use format YYYY-YYYY (e.g. 2026-2027).');
      return;
    }

    if (form.academicYears.includes(academicYear)) {
      toast.error('That academic year environment already exists.');
      return;
    }

    const parsedHours = Math.round(Number(newAcademicYearHours));
    if (!Number.isFinite(parsedHours) || parsedHours < 1 || parsedHours > 3000) {
      toast.error('Please enter valid Required OJT Hours between 1 and 3000.');
      return;
    }

    const updatedYears = [...form.academicYears, academicYear];
    const updatedHoursMap: Record<string, number> = {
      ...(form.academicYearHours || {}),
      [academicYear]: parsedHours,
    };
    const newSettings = {
      ...form,
      academicYears: updatedYears,
      activeAcademicYear: academicYear,
      academicYearHours: updatedHoursMap,
    };

    setForm(newSettings);
    setHoursDraftByYear((prev) => ({ ...prev, [academicYear]: String(parsedHours) }));
    updateSettings(newSettings, { syncAcademicYear: academicYear, syncHours: parsedHours });
    setNewAcademicYear('');
    setNewAcademicYearHours(String(TRAINEE_REQUIRED_HOURS));
    toast.success(
      `Academic Year ${academicYear} created and activated with ${parsedHours} Required OJT Hours! Other academic years remain unchanged.`
    );
  };

  const handleSwitchEnvironment = (year: string) => {
    const newSettings = {
      ...form,
      activeAcademicYear: year,
    };
    setForm(newSettings);
    updateSettings(newSettings);
    toast.success(`Switched active environment to AY ${year}.`);
  };

  const handleSaveYearHours = (year: string) => {
    const rawVal = hoursDraftByYear[year] ?? String(getAcademicYearRequiredHours(year, form.academicYearHours));
    const parsedHours = Math.round(Number(rawVal));
    if (!Number.isFinite(parsedHours) || parsedHours < 1 || parsedHours > 3000) {
      toast.error(`Please enter valid Required OJT Hours (1–3000) for AY ${year}.`);
      return;
    }

    const updatedHoursMap: Record<string, number> = {
      ...(form.academicYearHours || {}),
      [year]: parsedHours,
    };
    const newSettings = {
      ...form,
      academicYearHours: updatedHoursMap,
    };

    setForm(newSettings);
    setHoursDraftByYear((prev) => ({ ...prev, [year]: String(parsedHours) }));
    updateSettings(newSettings, { syncAcademicYear: year, syncHours: parsedHours });
    toast.success(
      `Required OJT Hours for AY ${year} updated to ${parsedHours} hours! Applies only to AY ${year} Trainee Registration & trainees.`
    );
  };

  const handleSave = () => {
    const updatedHoursMap: Record<string, number> = { ...(form.academicYearHours || {}) };
    let changedYear: string | undefined;
    let changedHours: number | undefined;

    for (const yr of form.academicYears) {
      const raw = hoursDraftByYear[yr];
      if (raw !== undefined) {
        const parsed = Math.round(Number(raw));
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3000) {
          toast.error(`Invalid Required OJT Hours for AY ${yr}. Enter between 1 and 3000.`);
          return;
        }
        const prevHrs = getAcademicYearRequiredHours(yr, settings.academicYearHours);
        if (parsed !== prevHrs) {
          changedYear = yr;
          changedHours = parsed;
        }
        updatedHoursMap[yr] = parsed;
      }
    }

    const nextSettings = {
      ...form,
      academicYearHours: updatedHoursMap,
    };
    setForm(nextSettings);
    updateSettings(
      nextSettings,
      changedYear && changedHours ? { syncAcademicYear: changedYear, syncHours: changedHours } : undefined
    );
    toast.success('Academic environment & per-year OJT hours saved successfully.');
  };

  const handleSyncAllAccounts = async () => {
    try {
      setIsSyncing(true);
      const res = await syncAllAccountsAcrossAcademicYears(form.activeAcademicYear);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error('Account sync encountered an issue.');
      }
    } catch (e: any) {
      toast.error('Sync failed: ' + (e?.message || String(e)));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRepairDatabase = async () => {
    try {
      setIsRepairing(true);
      const res = await repairAndPersistDatabase();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error('Database verification failed.');
      }
    } catch (e: any) {
      toast.error('Database repair failed: ' + (e?.message || String(e)));
    } finally {
      setIsRepairing(false);
    }
  };

  const { geofenceZones } = useApp();

  // Helper stats per academic environment
  const getEnvStats = (year: string) => {
    const defaultYear = form.academicYears[0] || '2025-2026';
    const activeYear = form.activeAcademicYear || '2026-2027';

    // 1. Trainees belonging to this academic year
    const envTrainees = employees.filter(
      (e) =>
        e.position !== 'OJT Instructor' &&
        e.position !== 'HTE Representative' &&
        !e.employeeId?.startsWith('ADM-') &&
        !e.employeeId?.startsWith('HTE-') &&
        (e.academicYear === year || (!e.academicYear && (activeYear === year || year === defaultYear)))
    );

    // Build lookup set of trainee identifiers for this academic year
    const traineeIds = new Set<string>();
    envTrainees.forEach((t) => {
      if (t.id) traineeIds.add(t.id);
      if (t.employeeId) traineeIds.add(t.employeeId);
      if (t.email) traineeIds.add(t.email.toLowerCase());
    });

    // 2. HTE Supervisors/Representatives belonging to this academic year (deduplicated between employees & hostSupervisors)
    const seenHteAY = new Set<string>();
    employees.forEach((e) => {
      const isHte =
        e.position === 'HTE Representative' ||
        (e.position && e.position.toLowerCase().includes('hte')) ||
        e.employeeId?.startsWith('HTE-') ||
        (e as any).role === 'hte' ||
        (e as any).role === 'host';
      const matches = isHte && (e.academicYear === year || (!e.academicYear && (activeYear === year || year === defaultYear)));
      if (matches) {
        const key = (e.email || e.employeeId || e.id || '').trim().toLowerCase();
        if (key) seenHteAY.add(key);
      }
    });
    hostSupervisors.forEach((h) => {
      const matches = h.academicYear === year || (!h.academicYear && (activeYear === year || year === defaultYear));
      if (matches) {
        const key = (h.email || h.employeeId || h.id || '').trim().toLowerCase();
        if (key) seenHteAY.add(key);
      }
    });
    const envHTE = seenHteAY.size;

    // 3. Time records belonging to this academic year (explicit AY stamp or linked trainee AY)
    const envRecords = timeRecords.filter((r) => {
      if (r.academicYear) return r.academicYear === year;
      if (r.employeeId && (traineeIds.has(r.employeeId) || traineeIds.has(r.employeeId.toLowerCase()))) return true;
      return !r.academicYear && (activeYear === year || year === defaultYear);
    });

    // 4. Evaluations belonging to this academic year (explicit AY stamp or linked trainee AY)
    const envEvals = evaluations.filter((ev) => {
      if (ev.academicYear) return ev.academicYear === year;
      if (ev.employeeId && (traineeIds.has(ev.employeeId) || traineeIds.has(ev.employeeId.toLowerCase()))) return true;
      return !ev.academicYear && (activeYear === year || year === defaultYear);
    });

    // 5. Geofences belonging to this academic year
    const envGeofences = geofenceZones.filter(
      (z) => z.academicYear === year || (!z.academicYear && (activeYear === year || year === defaultYear))
    );

    return {
      trainees: envTrainees.length,
      hte: envHTE,
      records: envRecords.length,
      evals: envEvals.length,
      geofences: envGeofences.length,
    };
  };

  const activeStats = getEnvStats(form.activeAcademicYear);

  // Deduplicated global statistics across accounts to eliminate redundancy
  const seenInstructors = new Set<string>();
  employees.forEach((e) => {
    const isInst =
      e.position === 'OJT Instructor' ||
      (e.position && e.position.toLowerCase().includes('instructor')) ||
      e.employeeId?.startsWith('ADM-') ||
      e.employeeId?.startsWith('INSTR-') ||
      (e as any).role === 'admin' ||
      (e as any).role === 'instructor';
    if (isInst) {
      const key = (e.email || e.employeeId || e.id || '').trim().toLowerCase();
      if (key) seenInstructors.add(key);
    }
  });
  const totalInstructors = seenInstructors.size;

  const seenHTEAll = new Set<string>();
  employees.forEach((e) => {
    const isHte =
      e.position === 'HTE Representative' ||
      (e.position && e.position.toLowerCase().includes('hte')) ||
      e.employeeId?.startsWith('HTE-') ||
      (e as any).role === 'hte' ||
      (e as any).role === 'host';
    if (isHte) {
      const key = (e.email || e.employeeId || e.id || '').trim().toLowerCase();
      if (key) seenHTEAll.add(key);
    }
  });
  hostSupervisors.forEach((h) => {
    const key = (h.email || h.employeeId || h.id || '').trim().toLowerCase();
    if (key) seenHTEAll.add(key);
  });
  const totalHTE = seenHTEAll.size;

  const seenTraineesAll = new Set<string>();
  employees.forEach((e) => {
    const isStaff =
      e.position === 'OJT Instructor' ||
      (e.position && e.position.toLowerCase().includes('instructor')) ||
      e.employeeId?.startsWith('ADM-') ||
      e.employeeId?.startsWith('INSTR-') ||
      (e as any).role === 'admin' ||
      (e as any).role === 'instructor' ||
      e.position === 'HTE Representative' ||
      (e.position && e.position.toLowerCase().includes('hte')) ||
      e.employeeId?.startsWith('HTE-') ||
      (e as any).role === 'hte' ||
      (e as any).role === 'host';
    if (!isStaff) {
      const key = (e.email || e.employeeId || e.id || '').trim().toLowerCase();
      if (key) seenTraineesAll.add(key);
    }
  });
  const totalTrainees = seenTraineesAll.size;

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Academic Year & Account Synchronization</h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage isolated academic year environments, synchronize accounts (HTE, Instructors, Trainees), and ensure data integrity in the database.
        </p>
      </div>

      {/* Active Environment Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-900 via-slate-900 to-sky-900 rounded-3xl p-6 text-white shadow-xl border border-blue-800/40 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                <CalendarRange size={24} className="text-sky-300" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-sky-300 bg-sky-950/60 px-2.5 py-0.5 rounded-full border border-sky-400/30">
                  Current Active Workspace
                </span>
                <h3 className="font-serif text-2xl font-bold text-white mt-1">
                  Academic Year {form.activeAcademicYear}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
              <CheckCircle2 size={15} />
              Active System Environment
            </div>
          </div>

          <p className="text-xs text-blue-200 leading-relaxed max-w-2xl">
            All account rosters, daily time records (DTR), and evaluation forms strictly operate under <strong>AY {form.activeAcademicYear}</strong>. Trainee and HTE accounts remain securely bound to the academic year in which they were registered. Newly created academic years initialize cleanly with 0 Trainees and 0 HTE Partners.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-emerald-300 mb-1">
                <Clock size={14} />
                <span className="text-xs font-semibold">OJT Hours</span>
              </div>
              <p className="text-xl font-extrabold text-white">
                {getAcademicYearRequiredHours(form.activeAcademicYear, form.academicYearHours)}
              </p>
              <p className="text-[10px] text-emerald-200">Required (AY)</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sky-300 mb-1">
                <Users size={14} />
                <span className="text-xs font-semibold">Trainees</span>
              </div>
              <p className="text-xl font-extrabold text-white">{activeStats.trainees}</p>
              <p className="text-[10px] text-blue-200">Enrolled (AY)</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-amber-300 mb-1">
                <Building2 size={14} />
                <span className="text-xs font-semibold">HTE Partners</span>
              </div>
              <p className="text-xl font-extrabold text-white">{activeStats.hte}</p>
              <p className="text-[10px] text-blue-200">Active (AY)</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sky-300 mb-1">
                <Clock size={14} />
                <span className="text-xs font-semibold">DTR Logs</span>
              </div>
              <p className="text-xl font-extrabold text-white">{activeStats.records}</p>
              <p className="text-[10px] text-blue-200">Time Entries</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center col-span-2 sm:col-span-1">
              <div className="flex items-center justify-center gap-1.5 text-sky-300 mb-1">
                <Award size={14} />
                <span className="text-xs font-semibold">Evaluations</span>
              </div>
              <p className="text-xl font-extrabold text-white">{activeStats.evals}</p>
              <p className="text-[10px] text-blue-200">Issued Reports</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Account Synchronization & Database Persistence Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Synchronize Accounts Across Academic Years</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ensure all HTE Representatives, Instructors, and Trainees are synced and active in every academic year.
              </p>
            </div>
          </div>
        </div>

        {/* Global Account Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center shrink-0 font-bold">
              <GraduationCap size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">OJT Instructors</p>
              <p className="text-base font-bold text-slate-800">{totalInstructors} Accounts</p>
              <p className="text-[10px] text-emerald-600 font-semibold">Global Access</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0 font-bold">
              <Building2 size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">HTE Partners</p>
              <p className="text-base font-bold text-slate-800">{totalHTE} Supervisors</p>
              <p className="text-[10px] text-emerald-600 font-semibold">Global Access</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center shrink-0 font-bold">
              <Users size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Trainees</p>
              <p className="text-base font-bold text-slate-800">{totalTrainees} Students</p>
              <p className="text-[10px] text-blue-600 font-semibold">Tracked per AY</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleSyncAllAccounts}
            disabled={isSyncing}
            className="flex-1 min-w-[220px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Synchronizing Accounts...' : 'Sync All Accounts to Active AY'}
          </button>

          <button
            type="button"
            onClick={handleRepairDatabase}
            disabled={isRepairing}
            className="flex-1 min-w-[220px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition-all shadow-md shadow-slate-200 disabled:opacity-50 cursor-pointer"
          >
            <Database size={15} className={isRepairing ? 'animate-spin' : ''} />
            {isRepairing ? 'Validating Database...' : 'Verify & Store Data in Database'}
          </button>
        </div>
      </motion.div>

      {/* Create New Academic Environment Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <FolderPlus size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Create New Academic Year Environment</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter a new academic year to spawn a fresh system environment for new student cohorts.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">New Academic Year Format (YYYY-YYYY)</label>
              <input
                value={newAcademicYear}
                onChange={(e) => setNewAcademicYear(e.target.value)}
                placeholder="e.g. 2027-2028"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Required OJT Hours</label>
              <input
                type="number"
                min={1}
                max={3000}
                value={newAcademicYearHours}
                onChange={(e) => setNewAcademicYearHours(e.target.value)}
                placeholder="600"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddAcademicYear}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 transition-all shadow-md shadow-blue-200 cursor-pointer"
              >
                <Plus size={16} />
                Create Environment
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Environment & Per-Academic-Year Hours Isolation:</p>
              <p className="text-amber-800 leading-relaxed">
                Creating or editing Required OJT Hours applies strictly to that Academic Year only (default 600 hours) and automatically updates the locked Required OJT Hours shown in Trainee Registration when that Academic Year is active.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Academic Environment Roster / Selection */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">All System Academic Environments</h3>
              <p className="text-xs text-slate-500 mt-0.5">Select an environment to activate it as the primary system workspace.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
          >
            <Save size={14} />
            Save Configuration
          </button>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          {form.academicYears.map((year) => {
            const isActive = year === form.activeAcademicYear;
            const stats = getEnvStats(year);
            const savedYearHours = getAcademicYearRequiredHours(year, form.academicYearHours);
            const draftHours = hoursDraftByYear[year] ?? String(savedYearHours);
            const isHoursModified = Number(draftHours) !== savedYearHours;

            return (
              <div
                key={year}
                className={`rounded-2xl p-4 border transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Academic Environment</span>
                    <h4 className="font-bold text-slate-900 text-base mt-0.5">AY {year}</h4>
                  </div>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 size={12} />
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      Archived
                    </span>
                  )}
                </div>

                {/* Editable Per-Academic-Year Required OJT Hours */}
                <div className="mt-3 rounded-xl bg-white/90 border border-blue-200/70 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock size={13} className="text-blue-600" />
                      Required OJT Hours (AY {year} Only)
                    </label>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      {savedYearHours} hrs
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min={1}
                        max={3000}
                        value={draftHours}
                        onChange={(e) =>
                          setHoursDraftByYear((prev) => ({
                            ...prev,
                            [year]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 pr-10 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 pointer-events-none">
                        hrs
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveYearHours(year)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isHoursModified
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                          : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      <Check size={12} />
                      Update Hours
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    {isActive
                      ? `Displayed as locked ${savedYearHours} hours in Trainee Registration for AY ${year}.`
                      : `Isolated to AY ${year} only — will apply to Trainee Registration if AY ${year} is activated.`}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-xs border-t border-slate-200/60 pt-3">
                  <div className="bg-white/80 rounded-xl p-1.5 border border-slate-100">
                    <p className="font-bold text-slate-800">{stats.trainees}</p>
                    <p className="text-[9px] text-slate-400">Trainees</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-1.5 border border-slate-100">
                    <p className="font-bold text-amber-700">{stats.hte}</p>
                    <p className="text-[9px] text-slate-400">HTE</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-1.5 border border-slate-100">
                    <p className="font-bold text-slate-800">{stats.records}</p>
                    <p className="text-[9px] text-slate-400">DTRs</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-1.5 border border-slate-100">
                    <p className="font-bold text-slate-800">{stats.evals}</p>
                    <p className="text-[9px] text-slate-400">Evals</p>
                  </div>
                </div>

                {!isActive && (
                  <button
                    type="button"
                    onClick={() => handleSwitchEnvironment(year)}
                    className="mt-3.5 w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Switch to this Environment</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

