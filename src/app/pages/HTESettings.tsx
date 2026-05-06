import { KeyRound, ShieldCheck, Info } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { HTELayout } from '../components/HTELayout';
import { useApp } from '../store/AppContext';


export function HTESettings() {
  const { changeCurrentUserPassword } = useApp();
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.new.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const result = await changeCurrentUserPassword(passwordForm.current, passwordForm.new);
    setLoading(false);

    if (result.success) {
      toast.success(result.message);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } else {
      toast.error(result.message);
    }
  };

  return (
    <HTELayout hteCompany={localStorage.getItem('ojt_hte_company') || 'HTE Dashboard'}>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-600 mt-1">Manage your account security and preferences</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <KeyRound className="text-indigo-600" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Security Settings</h3>
              <p className="text-sm text-gray-500">Update your login credentials</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, new: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Min 8 chars"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                    className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${passwordForm.confirm && passwordForm.new !== passwordForm.confirm ? 'border-red-300' : 'border-gray-200'}`}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {passwordForm.confirm && passwordForm.new !== passwordForm.confirm && (
              <div className="flex items-center gap-2 text-red-600 text-xs mt-1">
                <Info size={14} />
                <span>Passwords do not match</span>
              </div>
            )}

            <div className="pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ShieldCheck size={14} className="text-green-500" />
                <span>Encrypted secure connection</span>
              </div>
              <button
                type="submit"
                disabled={
                  loading || !passwordForm.current || !passwordForm.new || passwordForm.new !== passwordForm.confirm
                }
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {loading ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </HTELayout>
  );
}
