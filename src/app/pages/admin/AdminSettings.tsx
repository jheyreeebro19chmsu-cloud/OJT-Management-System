import {
  Settings,
  Clock,
  MapPin,
  Camera,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
  KeyRound,
  Calendar,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { fetchSecurityHealth, isSecurityApiConfigured, type SecurityHealthResponse } from '../../services/securityApi';
import { useApp } from '../../store/AppContext';

export function AdminSettings() {
  const { settings, updateSettings, changeCurrentUserPassword, currentUser } = useApp();
  const [form, setForm] = useState(settings);
  const [securityHealth, setSecurityHealth] = useState<SecurityHealthResponse | null>(null);
  const [securityHealthLoading, setSecurityHealthLoading] = useState(false);
  const [otps, setOtps] = useState<Array<any>>([]);
  const [loadingOtps, setLoadingOtps] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const upd = (f: string, v: string | number | boolean | string[]) => setForm((p) => ({ ...p, [f]: v }));

  const handleSave = () => {
    updateSettings(form);
    toast.success('Settings saved successfully!');
  };

  const handleReset = () => {
    setForm(settings);
    toast.info('Changes discarded.');
  };

  const probeSecurityBackend = async () => {
    if (!isSecurityApiConfigured()) {
      toast.error('Set VITE_DJANGO_API_URL in .env and restart the dev server.');
      return;
    }

    setSecurityHealthLoading(true);
    try {
      const h = await fetchSecurityHealth();
      setSecurityHealth(h);
      if (h.face_recognition_installed) {
        toast.success('Django security API reachable; face_recognition is installed.');
      } else {
        toast.warning('API reachable but face_recognition is not available on the server (verify returns 501).');
      }
    } catch {
      setSecurityHealth(null);
      toast.error('Could not reach GET /api/health/. Is Django running?');
    } finally {
      setSecurityHealthLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    const result = await changeCurrentUserPassword(currentPassword, newPassword);
    if (result.success) {
      toast.success(result.message);
      setCurrentPassword('');
      setNewPassword('');
    } else {
      toast.error(result.message);
    }
  };

  async function fetchOtps() {
    if (!currentUser?.id) return;
    setLoadingOtps(true);
    try {
      const stored = JSON.parse(localStorage.getItem('ojt_instructor_otps') || '[]');
      const filtered = stored.filter((o: any) => o.instructorId === currentUser.id);
      setOtps(filtered);
    } catch (e) {
      console.error(e);
      setOtps([]);
    } finally {
      setLoadingOtps(false);
    }
  }

  useEffect(() => {
    if (currentUser?.id) {
      fetchOtps();
    }
  }, [currentUser?.id]);

  const handleGenerateOtp = async () => {
    if (!currentUser?.id) return toast.error('Instructor context not available');

    try {
      const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const stored = JSON.parse(localStorage.getItem('ojt_instructor_otps') || '[]');
      const newOtpObj = {
        code: newOtpCode,
        instructorId: currentUser.id,
        createdAt: new Date().toISOString(),
      };
      stored.unshift(newOtpObj);
      localStorage.setItem('ojt_instructor_otps', JSON.stringify(stored));
      await navigator.clipboard.writeText(newOtpCode);
      toast.success(`OTP ${newOtpCode} generated and copied to clipboard`);
      fetchOtps();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Could not generate OTP');
    }
  };

  const handleRevokeOtp = async (code: string) => {
    if (!currentUser?.id) return;

    try {
      const stored = JSON.parse(localStorage.getItem('ojt_instructor_otps') || '[]');
      const filtered = stored.filter((o: any) => !(o.instructorId === currentUser.id && o.code === code));
      localStorage.setItem('ojt_instructor_otps', JSON.stringify(filtered));
      toast.success('OTP revoked');
      fetchOtps();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Could not revoke OTP');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-8">
      {/* Header Row */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">System Settings</h2>
        <p className="text-sm text-gray-500">Configure attendance rules and verification requirements</p>
      </div>

      {/* Balanced 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Schedule, Geofencing & Current Mode */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={18} className="text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Work Schedule</h3>
                <p className="text-xs text-gray-500">Define standard work hours and late threshold</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Work Start Time</label>
                  <input
                    type="time"
                    value={form.workStartTime}
                    onChange={(e) => upd('workStartTime', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Work End Time</label>
                  <input
                    type="time"
                    value={form.workEndTime}
                    onChange={(e) => upd('workEndTime', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  Late Threshold: <span className="text-blue-600">{form.lateThresholdMinutes} minutes</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={form.lateThresholdMinutes}
                  onChange={(e) => upd('lateThresholdMinutes', parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>0 min (exact)</span>
                  <span>30 min</span>
                  <span>60 min</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Trainees who clock in more than {form.lateThresholdMinutes} minutes after {form.workStartTime} will be marked as late.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-green-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Geofencing</h3>
                <p className="text-xs text-gray-500">Location-based attendance verification</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-700 text-sm">Enable Geofencing</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Require trainees to be within a geofence zone to clock in/out
                </p>
              </div>
              <button
                type="button"
                onClick={() => upd('geofenceEnabled', !form.geofenceEnabled)}
                className={`relative w-12 h-6 rounded-full transition-all shrink-0 cursor-pointer ${form.geofenceEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.geofenceEnabled ? 'translate-x-6' : ''}`}
                />
              </button>
            </div>

            {form.geofenceEnabled && (
              <div className="mt-3 bg-green-50 rounded-xl p-3 text-xs text-green-700">
                <p>✓ Trainees must be within an active geofence zone to record attendance.</p>
                <p className="mt-0.5">
                  Configure zones in the <strong>Geofence Zones</strong> section.
                </p>
              </div>
            )}

            {!form.geofenceEnabled && (
              <div className="mt-3 bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700">
                <p>⚠ Geofencing is disabled. Trainees can clock in/out from any location.</p>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-blue-50 rounded-2xl p-5 border border-blue-100"
          >
            <h4 className="font-semibold text-blue-800 text-sm mb-2">Current Verification Mode</h4>
            <div className="text-xs text-blue-700 space-y-1.5">
              {form.geofenceEnabled && form.facialRecognitionEnabled && (
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs shrink-0">
                    ✓
                  </span>
                  <span>
                    <strong>Full Security:</strong> Location + Face verification required
                  </span>
                </div>
              )}
              {form.geofenceEnabled && !form.facialRecognitionEnabled && (
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs shrink-0">
                    ✓
                  </span>
                  <span>
                    <strong>Location Only:</strong> Geofence verification required
                  </span>
                </div>
              )}
              {!form.geofenceEnabled && form.facialRecognitionEnabled && (
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs shrink-0">
                    ✓
                  </span>
                  <span>
                    <strong>Face Only:</strong> Facial recognition required
                  </span>
                </div>
              )}
              {!form.geofenceEnabled && !form.facialRecognitionEnabled && (
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs shrink-0">
                    !
                  </span>
                  <span>
                    <strong>No Verification:</strong> Time recorded without security checks
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Account Security & Facial Recognition */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                <KeyRound size={18} className="text-indigo-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Change Password</h3>
                <p className="text-xs text-gray-500">Update your admin account password</p>
              </div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} className="space-y-3">
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Update Password
              </button>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                <Camera size={18} className="text-purple-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Facial Recognition</h3>
                <p className="text-xs text-gray-500">Biometric identity verification for attendance</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-700 text-sm">Enable Facial Recognition</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verify trainee identity using facial recognition before recording time
                </p>
              </div>
              <button
                type="button"
                onClick={() => upd('facialRecognitionEnabled', !form.facialRecognitionEnabled)}
                className={`relative w-12 h-6 rounded-full transition-all shrink-0 cursor-pointer ${form.facialRecognitionEnabled ? 'bg-purple-500' : 'bg-gray-300'}`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.facialRecognitionEnabled ? 'translate-x-6' : ''}`}
                />
              </button>
            </div>

            {form.facialRecognitionEnabled && (
              <div className="mt-3 bg-purple-50 rounded-xl p-3 text-xs text-purple-700">
                <p>✓ Trainees must pass facial recognition to record attendance.</p>
                <p className="mt-0.5">Trainees need to register their face during account setup.</p>
              </div>
            )}

            <div className="mt-6 border-t border-gray-100 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="font-bold text-gray-800 text-sm">Instructor Enrollment OTPs</h4>
                  <p className="text-xs text-gray-500">Generate and revoke short OTP codes for trainee enrollment.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fetchOtps}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateOtp}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Generate OTP
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                {loadingOtps ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : otps.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent OTPs found.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                    {otps.map((o, idx) => {
                      const otpCode = o.code || o.otp_code || '';
                      const otpCreated = o.createdAt || o.created_at;
                      return (
                        <div
                          key={otpCode || `otp-${idx}`}
                          className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-200/80"
                        >
                          <div>
                            <div className="text-sm font-mono font-bold text-gray-800">{otpCode}</div>
                            <div className="text-xs text-gray-400">
                              Created: {otpCreated ? new Date(otpCreated).toLocaleString() : 'Recently'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(otpCode);
                                toast.success('Copied');
                              }}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeOtp(otpCode)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Full-Width Bottom Action Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Save your attendance schedule and security verification settings to apply them system-wide.
        </p>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors shadow-sm cursor-pointer"
          >
            <Save size={16} />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
