import { Home, Clock, FileText, User, LogOut, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';
import { LogoutConfirmModal } from './ui/LogoutConfirmModal';


const navItems = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/time-record', label: 'Time Record', icon: Clock, end: false },
  { to: '/app/records', label: 'Records', icon: FileText, end: false },
  { to: '/app/announcements', label: 'Announce', icon: Bell, end: false },
  { to: '/app/profile', label: 'Profile', icon: User, end: false },
];

export function EmployeeLayout() {
  const { currentUser, logout, getCurrentEmployee, settings } = useApp();
  const navigate = useNavigate();
  const employee = getCurrentEmployee();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
    }
  }, [currentUser, navigate]);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          Redirecting to login...
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    logout();
    navigate('/');
  };

  const avatarUrl = employee?.photo || currentUser?.photo || '';
  const displayName = employee?.name || currentUser?.name || 'Trainee';
  const displayId = employee?.employeeId || currentUser?.employeeId || 'OJT-STUDENT';
  const displayEmail = employee?.email || currentUser?.email || '';

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-blue-900 flex-col shrink-0 no-print border-r border-blue-800 shadow-xl">
        {/* Brand Header */}
        <div className="p-5 border-b border-blue-800 bg-blue-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
              <img src="/CHMSU.JPEG" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold text-sm leading-tight truncate">CHMSU OJT DTR</div>
              <div className="text-blue-300 text-xs font-semibold">Trainee Panel</div>
            </div>
          </div>

          {/* Academic Year Environment Indicator */}
          <div className="mt-3.5 flex items-center justify-between px-3 py-1.5 bg-blue-950/60 rounded-xl border border-blue-700/50 text-[11px] text-blue-100 font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
            </div>
            <span className="text-[10px] text-blue-300 uppercase tracking-wider font-bold">Active</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  isActive ? 'bg-sky-500 text-white shadow-sm' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-sky-600/40' : ''}`}>
                    <Icon size={18} />
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-sky-600/40 rounded-xl -z-10"
                      />
                    )}
                  </div>
                  <span className="text-sm">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-blue-800 bg-blue-950/30">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-sky-400 rounded-full flex items-center justify-center overflow-hidden border border-white/20 shadow-inner shrink-0">
              {avatarUrl ? (
                <img
                  src={getPhotoUrl(avatarUrl)}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <Clock size={16} className="text-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-bold truncate">{displayName}</div>
              <div className="text-blue-300 text-[10px] truncate">{displayId}</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/app/profile')}
            className="w-full flex items-center gap-2 px-3 py-2 mb-1 text-blue-300 hover:text-white hover:bg-blue-800 rounded-xl transition-all text-sm font-medium"
          >
            <User size={14} />
            Profile
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-blue-300 hover:text-white hover:bg-blue-800 rounded-xl transition-all text-sm font-medium"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-lg z-10 no-print border-b border-blue-700/50">
          <div className="max-w-md lg:max-w-none mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
                <img src="/CHMSU.JPEG" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <div className="text-xs text-blue-200 leading-tight">CHMSU OJT DTR</div>
                <div className="text-sm font-bold leading-tight truncate max-w-[130px] sm:max-w-[200px]">{displayName}</div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-700/60 border border-blue-400/40 text-blue-100 rounded-full text-[11px] font-bold shadow-sm" title="Active Academic Environment">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                onClick={() => navigate('/app/profile')}
                className="w-8 h-8 rounded-full overflow-hidden border border-white/30 cursor-pointer shadow-sm"
                title="View Profile"
              >
                {avatarUrl ? (
                  <img
                    src={getPhotoUrl(avatarUrl)}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <User size={16} className="text-white p-1" />
                )}
              </div>
              <button
                onClick={handleLogout}
                className="lg:hidden flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-xs py-1.5 px-2.5 rounded-lg hover:bg-blue-700 font-medium"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="max-w-md lg:max-w-none mx-auto px-4 py-4 lg:p-6">
            <Outlet />
          </div>
        </main>

        {/* Bottom Navigation (mobile only) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-2xl z-20 no-print">
          <div className="max-w-md mx-auto px-2 py-1.5 grid grid-cols-5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition-all ${
                    isActive ? 'text-blue-700' : 'text-gray-400 hover:text-gray-600'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-blue-50 text-blue-700' : ''}`}>
                      <Icon size={19} />
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator-mobile"
                          className="absolute inset-0 bg-blue-100/70 rounded-xl -z-10"
                        />
                      )}
                    </div>
                    <span className={`text-[10px] font-bold ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
