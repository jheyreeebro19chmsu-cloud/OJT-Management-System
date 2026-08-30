import { CalendarRange, Plus, Save, Sparkles, CheckCircle2, Shield, FolderPlus, Layers, Users, Clock, Award, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';

export function AcademicYearManagement() {
  const { settings, updateSettings, employees, timeRecords, evaluations } = useApp();
  const [form, setForm] = useState(settings);
  const [newAcademicYear, setNewAcademicYear] = useState('');

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const upd = (field: string, value: string | number | boolean | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

  // Helper stats per academic environment
  const getEnvStats = (year: string) => {
    const envTrainees = employees.filter((e) => e.academicYear === year || (!e.academicYear && year === form.academicYears[0]));
    const envRecords = timeRecords.filter((r) => r.academicYear === year || (!r.academicYear && year === form.academicYears[0]));
    const envEvals = evaluations.filter((ev) => ev.academicYear === year || (!ev.academicYear && year === form.academicYears[0]));
    return { trainees: envTrainees.length, records: envRecords.length, evals: envEvals.length };
  };

  const activeStats = getEnvStats(form.activeAcademicYear);

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Academic Year Environment Management</h2>
        <p className="text-sm text-slate-500 mt-1">
          Create, switch, and manage isolated academic year environments for compliance, trainee rosters, and records.
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
          <div className="flex items-center justify-between">
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
            When a new academic year environment is created or set as active, all new trainee registrations, daily time records (DTR), and evaluation forms automatically comply under <strong>AY {form.activeAcademicYear}</strong>.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sky-300 mb-1">
                <Users size={15} />
                <span className="text-xs font-semibold">Trainees</span>
              </div>
              <p className="text-xl font-extrabold text-white">{activeStats.trainees}</p>
              <p className="text-[10px] text-blue-200">Registered</p>
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
              Enter a new academic year to spawn a fresh system environment for new student cohorts and compliance.
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
                Creating a new year automatically sets it as the active workspace. Previous year records will remain untouched and archived for historical auditing.
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
