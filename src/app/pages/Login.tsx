import { Clock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { useApp } from '../store/AppContext';


export function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { employees } = useApp();
  const matchedEmployee = employees.find((e) => e.email.toLowerCase() === email.toLowerCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Local login
    await new Promise((r) => setTimeout(r, 800));
    const user = await login(email, password);
    if (user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'hte') {
        localStorage.setItem('ojt_hte_user', JSON.stringify(user));
        navigate('/hte/dashboard');
      } else if (user.role === 'host') navigate('/host/feedback');
      else navigate('/app');
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
        // Optionally store password locally for local mode convenience
        const stored = localStorage.getItem('ojt_passwords');
        const map = stored ? JSON.parse(stored) : {};
        map[email.toLowerCase()] = newPassword;
        localStorage.setItem('ojt_passwords', JSON.stringify(map));
        setError('Password updated successfully. Please sign in with your new password.');
      } else {
        setError('Failed to reset password.');
      }
    } catch (err: any) {
      setError(err?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-sky-700 flex flex-col items-center justify-center px-4 py-8">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-sky-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-xl mb-4">
            <Clock size={36} className="text-blue-700" />
          </div>
          <h1 className="text-white text-2xl font-bold">OJT Daily Time Record</h1>
          <p className="text-blue-200 text-sm mt-1">On-the-Job Training Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          <h2 className="text-gray-800 font-bold text-lg mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-5">Sign in to your account</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm"
            >
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email or Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email or username"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
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

          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-center text-sm text-gray-500">
              New user?{' '}
              <Link to="/register" className="text-blue-600 font-medium hover:text-blue-800">
                Create an account
              </Link>
            </p>
            <p className="text-center text-xs text-gray-400 mt-2">
              Host supervisor? Sign in with your host account to access the feedback portal.
            </p>
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowForgot((s) => !s)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {showForgot && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-4 bg-blue-50/80 border border-blue-100 rounded-2xl text-sm"
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
                  <div className="space-y-2 bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-blue-100/50">
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
