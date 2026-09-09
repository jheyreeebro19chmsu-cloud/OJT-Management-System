import { Clock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { useApp } from '../store/AppContext';
import { getSchoolLogo } from '../utils/schoolLogos';

const normalizeEmail = (value: string) => value.trim().toLowerCase();



export function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [faceDisabled, setFaceDisabled] = useState(false);
  const { employees } = useApp();
  const matchedEmployee = employees.find((e) => e.email.toLowerCase() === email.toLowerCase());
  const schoolLogo = matchedEmployee ? getSchoolLogo(matchedEmployee.schoolName) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Local login
    await new Promise((r) => setTimeout(r, 800));
    const user = (await login(email, password)) as any;
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'hte' || user.role === 'host') {
        navigate('/hte');
      } else {
        const employee = employees.find(
          (e) =>
            e.id === user.employeeId ||
            e.id === user.id ||
            e.employeeId === user.employeeId ||
            e.employeeId === user.id ||
            (user.email && e.email ? normalizeEmail(e.email) === normalizeEmail(user.email) : false)
        );
        const photoCandidate = employee?.photo || user.photo || '';
        const safePhoto = typeof photoCandidate === 'string' && photoCandidate.startsWith('data:') ? '' : photoCandidate;
        const enrichedUser = {
          ...user,
          photo: safePhoto,
          faceRegistered: employee?.faceRegistered ?? user.faceRegistered ?? false,
          employeeId: employee?.employeeId || user.employeeId || employee?.id || user.id,
        };
        localStorage.setItem('ojt_user', JSON.stringify(enrichedUser));

        navigate('/app');
      }
    } else {
      setError('Invalid email or password. Please try again.');
    }
    setLoading(false);
  };

  const handleResetPassword = async (newPassword: string) => {
    setLoading(true);
    setError('');
    try {
      const resp = await (await import('../services/authApi')).authAPI.resetPassword(email, newPassword);
      if (resp && resp.data && resp.data.success) {
        try {
          localStorage.removeItem('ojt_passwords');
        } catch {}
        setError('Password updated successfully in database. Please sign in with your new password.');
      } else {
        setError('Failed to reset password.');
      }
    } catch (err: any) {
      setError(err?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).__faceApiUnavailable) setFaceDisabled(true);
    } catch {
      // ignore
    }
  }, []);

  const defaultBackgroundImage = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlW_CmtgncO5nHio9TJ4B774KYiHLGcInY7wxgBybI_DU6t8pOLsmsrkZq&s=10';
  let backgroundImage = defaultBackgroundImage;
  try {
    const override = typeof window !== 'undefined' ? localStorage.getItem('loginBg') : null;
    if (override) backgroundImage = override;
  } catch {
    // Keep the default image when local storage is unavailable.
  }

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 selection:bg-blue-600 selection:text-white"
    >
      {/* Background Image */}
      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover scale-105 brightness-90 contrast-105"
      />

      {/* Enhanced Multi-Layer Gradient Scrim for Crystal Clear Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-blue-950/65 to-slate-950/90 backdrop-blur-[1.5px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-500/15 via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo & System Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/95 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.4)] mb-3.5 p-2 ring-4 ring-white/30 backdrop-blur-md">
            <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <h1 className="text-white text-2xl sm:text-3xl font-black tracking-tight drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)]">
            OJT Daily Time Record
          </h1>
          <div className="mt-2">
            <span className="inline-flex items-center px-3.5 py-1 bg-white/15 backdrop-blur-md rounded-full text-sky-100 text-xs font-semibold tracking-wide border border-white/20 shadow-sm">
              On-the-Job Training Management System
            </span>
          </div>
        </div>

        {/* Card */}
        {faceDisabled && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/90 backdrop-blur-md border border-amber-300 text-amber-950 text-xs font-medium shadow-lg">
            Face-recognition features are currently disabled because the local face-api bundle is missing or blocked by the browser. Copy a local face-api.js to <span className="font-mono font-bold">public/vendor/face-api.js</span> or run the downloader in <span className="font-mono font-bold">scripts/</span> to enable biometric features.
          </div>
        )}
        <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] ring-1 ring-black/5 p-7 border border-white">
          <h2 className="text-gray-900 font-extrabold text-xl mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm font-medium"
            >
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Email or Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-gray-50/80 text-gray-900 placeholder:text-gray-400 font-medium transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-gray-50/80 text-gray-900 placeholder:text-gray-400 font-medium transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-center text-sm text-gray-600">
              New user?{' '}
              <Link to="/register" className="text-blue-600 font-bold hover:text-blue-800 transition-colors">
                Create an account
              </Link>
            </p>
            <p className="text-center text-xs text-gray-400 mt-2.5">
              Host supervisor? Sign in with your host account to access the feedback portal.
            </p>
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowForgot((s) => !s)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {showForgot && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Clock size={16} /> Password Recovery
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    Close
                  </button>
                </div>
                <p className="text-xs text-blue-700/80 mb-3">
                  Please enter your email above to verify your registered home address and recover your password.
                </p>
                {matchedEmployee ? (
                  <div className="space-y-2 bg-white rounded-xl p-3 border border-blue-100">
                    <div className="text-xs">
                      <span className="font-semibold text-gray-500 block mb-0.5 text-[10px] tracking-wider uppercase">REGISTERED ADDRESS</span>
                      <span className="text-gray-800 font-medium">{matchedEmployee.registrationAddress || 'No address registered.'}</span>
                    </div>
                    <div className="text-xs pt-1.5 border-t border-blue-100/50">
                      <span className="font-semibold text-gray-500 block mb-0.5 text-[10px] tracking-wider uppercase">RESET PASSWORD</span>
                      <div className="mt-2 flex gap-2">
                        <input id="newpass" type="password" placeholder="New password" className="flex-1 px-3 py-2 rounded-lg border" />
                        <button
                          onClick={() => {
                            const el = document.getElementById('newpass') as HTMLInputElement | null;
                            if (el && el.value.length >= 6) {
                              handleResetPassword(el.value);
                            } else {
                              setError('Please enter a new password (min 6 chars)');
                            }
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded-xl border border-red-100 font-medium">
                    No active account found. Enter your registered email in the input above.
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
