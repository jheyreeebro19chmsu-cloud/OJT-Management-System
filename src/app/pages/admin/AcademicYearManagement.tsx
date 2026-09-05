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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

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

    const updatedYears = [...form.academicYears, academicYear];
    const newSettings = {
      ...form,
      academicYears: updatedYears,
      activeAcademicYear: academicYear,
    };

    setForm(newSettings);
    updateSettings(newSettings);
    setNewAcademicYear('');
    toast.success(`Academic environment ${academicYear} initialized and set as Active! System is ready for new compliance data.`);
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

  const handleSave = () => {
    updateSettings(form);
    toast.success('Academic environment settings saved successfully.');
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
    const envTrainees = employees.filter(
      (e) =>
        e.position !== 'OJT Instructor' &&
        e.position !== 'HTE Representative' &&
        (e.academicYear === year || (!e.academicYear && year === form.academicYears[0]))
    );
    const envRecords = timeRecords.filter((r) => r.academicYear === year || (!r.academicYear && year === form.academicYears[0]));
    const envEvals = evaluations.filter((ev) => ev.academicYear === year || (!ev.academicYear && year === form.academicYears[0]));
    const envGeofences = geofenceZones.filter((z) => !z.academicYear || z.academicYear === year);
    return { trainees: envTrainees.length, records: envRecords.length, evals: envEvals.length, geofences: envGeofences.length };
  };

  const activeStats = getEnvStats(form.activeAcademicYear);
  const totalInstructors = employees.filter((e) => e.position === 'OJT Instructor').length;
  const totalHTE = employees.filter((e) => e.position === 'HTE Representative').length + hostSupervisors.length;
  const totalTrainees = employees.filter((e) => e.position !== 'OJT Instructor' && e.position !== 'HTE Representative').length;

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
            All account rosters, daily time records (DTR), and evaluation forms automatically operate under <strong>AY {form.activeAcademicYear}</strong>. Institutional HTE and Instructor accounts remain active across all years.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sky-300 mb-1">
                <Users size={15} />
                <span className="text-xs font-semibold">Trainees (Active AY)</span>
              </div>
              <p className="text-xl font-extrabold text-white">{activeStats.trainees}</p>
              <p className="text-[10px] text-blue-200">Enrolled</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sky-300 mb-1">
                <Clock size={15} />
                <span className="text-xs font-semibold">DTR Logs</span>
              </div>
              <p className="text-xl font-extrabold text-white">{activeStats.records}</p>
              <p className="text-[10px] text-blue-200">Time Entries</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sky-300 mb-1">
                <Award size={15} />
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
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">New Academic Year Format (YYYY-YYYY)</label>
              <input
                value={newAcademicYear}
                onChange={(e) => setNewAcademicYear(e.target.value)}
                placeholder="e.g. 2026-2027"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
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
              <p className="font-bold mb-0.5">Environment Isolation Guarantee:</p>
              <p className="text-amber-800 leading-relaxed">
                Creating a new year automatically sets it as the active workspace. Previous year records remain intact for historical auditing.
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

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs border-t border-slate-200/60 pt-3">
                  <div className="bg-white/80 rounded-xl p-1.5 border border-slate-100">
                    <p className="font-bold text-slate-800">{stats.trainees}</p>
                    <p className="text-[10px] text-slate-400">Trainees</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-1.5 border border-slate-100">
                    <p className="font-bold text-slate-800">{stats.records}</p>
                    <p className="text-[10px] text-slate-400">DTRs</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-1.5 border border-slate-100">
                    <p className="font-bold text-slate-800">{stats.evals}</p>
                    <p className="text-[10px] text-slate-400">Evals</p>
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

