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
import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
    } else if (currentUser.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (currentUser.role === 'employee' || (currentUser as any).role === 'trainee') {
      navigate('/app', { replace: true });
    }
  }, [currentUser, navigate]);

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

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Brand Header */}
      <div className="p-5 border-b border-blue-800 bg-blue-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
              <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold text-sm leading-tight truncate">CHMSU OJT DTR</div>
              <div className="text-blue-300 text-xs font-semibold">HTE Panel</div>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          )}
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

      {/* Navigation Items on the Left */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const { to, label, icon: Icon, end } = item;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => isMobile && setSidebarOpen(false)}
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
                        layoutId="nav-indicator-hte"
                        className="absolute inset-0 bg-sky-600/40 rounded-xl -z-10"
                      />
                    )}
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Supervisor User Footer on Left Sidebar */}
      <div className="p-3 border-t border-blue-800 bg-blue-950/30">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
          <div className="w-9 h-9 bg-sky-400 rounded-full flex items-center justify-center overflow-hidden border border-white/20 shadow-inner shrink-0">
            {avatarSource ? (
              <img
                src={getPhotoUrl(avatarSource)}
                alt={avatarName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building size={18} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-bold truncate">{avatarName}</div>
            <div className="text-blue-300 text-[10px] truncate">{companyName}</div>
          </div>
        </div>
        <button
          onClick={() => {
            if (isMobile) setSidebarOpen(false);
            handleLogout();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-blue-300 hover:text-white hover:bg-blue-800 rounded-xl transition-all text-sm font-medium cursor-pointer"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Desktop Left Sidebar (Matching Instructor & Trainee) */}
      <aside className="hidden lg:flex w-64 bg-blue-900 flex-col shrink-0 no-print border-r border-blue-800 shadow-xl">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-Over Left Sidebar Drawer (Navigation on the Left) */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[998] lg:hidden no-print"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed inset-y-0 left-0 z-[999] w-72 bg-blue-900 flex flex-col shadow-2xl lg:hidden no-print border-r border-blue-800"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header with Hamburger Navigation Button on the Left */}
        <header className="bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-lg z-10 no-print border-b border-blue-700/50">
          <div className="max-w-md lg:max-w-none mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Sidebar Toggle Button on the Left */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-blue-200 hover:text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                aria-label="Open Navigation"
              >
                <Menu size={22} />
              </button>

              <div className="w-8 h-8 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
                <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <div className="text-xs text-blue-200 leading-tight">CHMSU OJT DTR</div>
                <div className="text-sm font-bold leading-tight truncate max-w-[130px] sm:max-w-[200px]">{companyName}</div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-700/60 border border-blue-400/40 text-blue-100 rounded-full text-[11px] font-bold shadow-sm" title="Active Academic Environment">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/hte/evaluations')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white border border-blue-400/30 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Star size={13} className="text-amber-300 fill-amber-300" />
                <span>Evaluate</span>
              </button>
              <div
                onClick={() => navigate('/hte/profile')}
                className="w-8 h-8 rounded-full overflow-hidden border border-white/30 cursor-pointer shadow-sm flex items-center justify-center bg-blue-800"
                title="View Profile"
              >
                {avatarSource ? (
                  <img
                    src={getPhotoUrl(avatarSource)}
                    alt={avatarName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building size={16} className="text-white p-1" />
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-xs py-1.5 px-2.5 rounded-lg hover:bg-blue-700 font-medium cursor-pointer"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {children || <Outlet />}
          </div>
        </main>
      </div>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
