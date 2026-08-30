import { CalendarRange, Plus, Save } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../store/AppContext';

export function AcademicYearManagement() {
  const { settings, updateSettings } = useApp();
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
      toast.error('Use the format YYYY-YYYY.');
      return;
    }

    if (form.academicYears.includes(academicYear)) {
      toast.error('That academic year already exists.');
      return;
    }

    const updatedYears = [...form.academicYears, academicYear];
    upd('academicYears', updatedYears);
    upd('activeAcademicYear', academicYear);
    setNewAcademicYear('');
    toast.success(`Academic year ${academicYear} has been created.`);
  };

  const handleSave = () => {
    updateSettings(form);
    toast.success('Academic year settings saved successfully.');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Academic Year Management</h2>
        <p className="text-sm text-gray-500">Create a new academic environment for the system and set which year is active.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <CalendarRange size={18} className="text-blue-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Academic Environment</h3>
            <p className="text-xs text-gray-500">This creates a new academic year environment in the system.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Active Academic Year</label>
            <select
              value={form.activeAcademicYear}
              onChange={(e) => upd('activeAcademicYear', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {form.academicYears.map((academicYear) => (
                <option key={academicYear} value={academicYear}>{academicYear}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={newAcademicYear}
              onChange={(e) => setNewAcademicYear(e.target.value)}
              placeholder="2026-2027"
              aria-label="New academic year"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddAcademicYear}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Year
            </button>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
            Active academic year: <strong>{form.activeAcademicYear}</strong>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}
