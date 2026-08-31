import {
  LayoutDashboard,
  Users,
  Clock,
  Star,
  Megaphone,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Building,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';
import { LogoutConfirmModal } from './ui/LogoutConfirmModal';

interface HTELayoutProps {
  children?: React.ReactNode;
  hteCompany?: string;
}

const navItems = [
  { to: '/hte', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/hte/trainees', label: 'Trainees', icon: Users, end: false },
  { to: '/hte/records', label: 'DTR Records', icon: Clock, end: false },
  { to: '/hte/evaluations', label: 'Evaluations', icon: Star, end: false },
  { to: '/hte/announcements', label: 'Announcements', icon: Megaphone, end: false },
  { to: '/hte/settings', label: 'Settings', icon: Settings, end: false },
  { to: '/hte/profile', label: 'Profile', icon: User, end: false },
];

export function HTELayout({ children, hteCompany }: HTELayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, getCurrentEmployee, settings } = useApp();
  const employee = getCurrentEmployee();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const hteUser = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('ojt_hte_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const companyName =
    hteCompany ||
    employee?.companyName ||
    hteUser?.companyName ||
    localStorage.getItem('ojt_hte_company') ||
    'Host Training Establishment';

  const avatarSource = employee?.photo || currentUser?.photo || hteUser?.photo || '';
  const avatarName = employee?.name || currentUser?.name || hteUser?.name || 'HTE Supervisor';
  const supervisorRole = employee?.position || hteUser?.position || 'HTE Representative';

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('ojt_jwt_access_token');
    localStorage.removeItem('ojt_jwt_refresh_token');
    localStorage.removeItem('ojt_hte_user');
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 flex-col shrink-0 no-print border-r border-slate-800 shadow-xl">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-2xl p-1 shadow-md shrink-0 flex items-center justify-center">
              <img src="/CHMSU.JPEG" alt="CHMSU Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-extrabold text-sm tracking-tight truncate flex items-center gap-1.5">
                <span>HTE Portal</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  PARTNER
                </span>
              </div>
              <div className="text-slate-400 text-xs truncate max-w-[140px] font-medium" title={companyName}>
                {companyName}
              </div>
            </div>
          </div>

          {/* Academic Year Environment Indicator */}
          <div className="mt-3.5 flex items-center justify-between px-3 py-1.5 bg-slate-800/60 rounded-xl border border-slate-700/50 text-[11px] text-slate-300 font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Active</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map(({ to, label, icon: Icon, end }) => {
            const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive: active }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm font-semibold relative ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="hte-nav-pill"
                    className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white"
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Supervisor User Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center overflow-hidden shrink-0">
                {avatarSource ? (
                  <img src={getPhotoUrl(avatarSource)} alt={avatarName} className="w-full h-full object-cover" />
                ) : (
                  <Building size={18} className="text-blue-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-white text-xs font-bold truncate">{avatarName}</div>
                <div className="text-slate-400 text-[10px] truncate">{supervisorRole}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed inset-y-0 left-0 w-72 bg-slate-900 z-50 flex flex-col lg:hidden shadow-2xl border-r border-slate-800"
          >
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white rounded-xl p-1 shadow-md">
                  <img src="/CHMSU.JPEG" alt="CHMSU Logo" className="w-full h-full object-contain rounded-lg" />
                </div>
                <div>
                  <div className="text-white font-extrabold text-sm">HTE Portal</div>
                  <div className="text-slate-400 text-xs truncate max-w-[150px]">{companyName}</div>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive: active }) =>
                    `flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-sm font-semibold ${
                      active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/10 text-red-400 font-semibold text-sm hover:bg-red-500/20 transition-colors"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Left: Mobile Toggle & Page Title */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Menu size={20} />
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800 text-base sm:text-lg tracking-tight">
                    Host Training Establishment
                  </span>
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-xs font-bold shadow-xs">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/hte/evaluations')}
                  className="hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Star size={14} />
                  <span>Evaluate Trainee</span>
                </button>
                <button
                  onClick={() => navigate('/hte/settings')}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
                <button
                  onClick={() => navigate('/hte/profile')}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  title="Profile"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center overflow-hidden">
                    {avatarSource ? (
                      <img src={getPhotoUrl(avatarSource)} alt={avatarName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className="text-blue-600" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/80">
          <div className="max-w-7xl mx-auto pb-16 lg:pb-0">
            {children || <Outlet />}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 z-40 flex items-center justify-around shadow-lg">
          {navItems.slice(0, 5).map(({ to, label, icon: Icon, end }) => {
            const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive: active }) =>
                  `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                    active ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'
                  }`
                }
              >
                <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
