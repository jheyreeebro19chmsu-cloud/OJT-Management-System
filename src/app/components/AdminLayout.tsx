import {
  LayoutDashboard,
  Users,
  MapPin,
  BarChart2,
  Settings,
  LogOut,
  Clock,
  Menu,
  X,
  Star,
  Bell,
  Megaphone,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useApp } from '../store/AppContext';
import { getPhotoUrl, getAbsoluteUrl } from '../services/config';
import { isSecurityApiConfigured } from '../services/securityApi';
import { isSupabaseConfigured } from '../lib/supabase';
import { getPendingTraineeRequests, subscribeToPendingRequests } from '../services/accountSync';
import { LogoutConfirmModal } from './ui/LogoutConfirmModal';


const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/employees', label: 'OJT/Records', icon: Users, end: false },
  { to: '/admin/geofence', label: 'Geofence Zones', icon: MapPin, end: false },
  { to: '/admin/reports', label: 'Reports', icon: BarChart2, end: false },
  { to: '/admin/evaluations', label: 'Evaluations', icon: Star, end: false },
  { to: '/admin/host-feedback', label: 'Host Feedback', icon: MessageSquare, end: false },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, end: false },
  { to: '/admin/academic-years', label: 'Academic Year', icon: Calendar, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
];

export function AdminLayout() {
  const { logout, announcements, currentUser, getCurrentEmployee, employees, settings } = useApp();
  const navigate = useNavigate();
  const employee = getCurrentEmployee();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
    } else if (currentUser.role === 'employee' || (currentUser as any).role === 'trainee') {
      navigate('/app', { replace: true });
    } else if (currentUser.role === 'hte' || currentUser.role === 'host') {
      navigate('/hte', { replace: true });
    }
  }, [currentUser, navigate]);

  // Determine whether the current user is an instructor
  const isInstructor = Boolean(
    (employee && (employee as any).role === 'instructor') ||
    (currentUser && (currentUser as any).role === 'instructor') ||
    (currentUser && currentUser.role === 'admin') ||
    (() => {
      try {
        const u = localStorage.getItem('user');
        if (!u) return false;
        const parsed = JSON.parse(u);
        return parsed && (parsed.role === 'instructor' || parsed.role === 'admin');
      } catch {
        return false;
      }
    })()
  );

  const fetchPendingCount = useCallback(async () => {
    if (!isInstructor) return setPendingCount(0);
    try {
      const instrId = employee?.id || (() => {
        try {
          const u = localStorage.getItem('user');
          if (u) return JSON.parse(u).id;
        } catch { }
        return null;
      })();
      if (!instrId) return setPendingCount(0);

      // 1. Direct Supabase query (instant, no CORS, authentic)
      if (isSupabaseConfigured()) {
        const list = await getPendingTraineeRequests(instrId).catch(() => []);
        setPendingCount(list.length);
        return;
      }

      // 2. Active security API fallback if configured
      if (isSecurityApiConfigured()) {
        const res = await fetch(getAbsoluteUrl(`/api/security/auth/get-pending-trainee-requests/?instructor_id=${instrId}`));
        if (!res.ok) return;
        const data = await res.json();
        const count = Array.isArray(data.requests) ? data.requests.length : 0;
        setPendingCount(count);
        return;
      }

      // 3. Local fallback
      const localPending = employees.filter(
        (e) => (e.instructorId === instrId || !e.instructorId) && e.applicationStatus === 'pending'
      ).length;
      setPendingCount(localPending);
    } catch {
      // silent
    }
  }, [employee, isInstructor, employees]);

  useEffect(() => {
    if (!isInstructor) return;

    const instrId = employee?.id || (() => {
      try {
        const u = localStorage.getItem('user');
        if (u) return JSON.parse(u).id;
      } catch { }
      return null;
    })();

    void fetchPendingCount();

    // In Supabase mode, subscribe to real-time postgres changes (never fails with HTTP 200 on Vercel)
    if (isSupabaseConfigured() && instrId) {
      const unsub = subscribeToPendingRequests(instrId, () => {
        void fetchPendingCount();
      });
      const interval = setInterval(() => void fetchPendingCount(), 30000);
      return () => {
        unsub?.();
        clearInterval(interval);
      };
    }

    const pollId = setInterval(() => void fetchPendingCount(), 30000);
    return () => clearInterval(pollId);
  }, [fetchPendingCount, isInstructor, employee]);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    logout();
    navigate('/');
  };

  const unreadAnn = announcements.filter((a) => {
    if (a.expiresAt && new Date(a.expiresAt) < new Date()) return false;
    return true;
  }).length;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-blue-900 flex-col shrink-0 no-print">
        <div className="p-5 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
              <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">CHMSU OJT DTR</div>
              <div className="text-blue-300 text-xs font-semibold">Admin Panel</div>
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

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${isActive ? 'bg-sky-500 text-white shadow-sm' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {label === 'Announcements' && unreadAnn > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadAnn}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-blue-800">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
              {(() => {
                const url = getPhotoUrl(employee?.photo as any);
                return url ? (
                  <img src={url} alt={employee?.name} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                ) : (
                  <span className="text-white text-xs font-bold">AD</span>
                );
              })()}
            </div>
            <div>
              <div className="text-white text-xs font-medium">{employee?.name || 'OJT Instructor'}</div>
              <div className="text-blue-400 text-xs">{employee?.email || 'No email'}</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/profile')}
            className="w-full flex items-center gap-2 px-3 py-2 mb-1 text-blue-300 hover:text-white hover:bg-blue-800 rounded-xl transition-all text-sm"
          >
            <Users size={14} />
            Profile
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-blue-300 hover:text-white hover:bg-blue-800 rounded-xl transition-all text-sm"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-[998]"
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-60 bg-blue-900 flex flex-col z-[999] no-print"
            >
              <div className="p-5 border-b border-blue-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
                      <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">CHMSU OJT DTR</div>
                      <div className="text-blue-300 text-xs font-semibold">Admin Panel</div>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="text-blue-300 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex items-center justify-between px-3 py-1.5 bg-blue-950/60 rounded-xl border border-blue-700/50 text-[11px] text-blue-100 font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
                  </div>
                  <span className="text-[10px] text-blue-300 uppercase tracking-wider font-bold">Active</span>
                </div>
              </div>
              <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${isActive ? 'bg-sky-500 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={16} />
                    <span className="flex-1">{label}</span>
                    {label === 'Announcements' && unreadAnn > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {unreadAnn}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="p-3 border-t border-blue-800">
                <div className="flex items-center gap-2 px-3 py-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                    {(() => {
                      const url = getPhotoUrl(employee?.photo as any);
                      return url ? (
                        <img src={url} alt={employee?.name} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                      ) : (
                        <span className="text-blue-900 text-xs font-bold">AD</span>
                      );
                    })()}
                  </div>
                  <div>
                    <div className="text-white text-xs font-medium">{employee?.name || 'OJT Instructor'}</div>
                    <div className="text-blue-400 text-xs">{employee?.email || 'No email'}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSidebarOpen(false);
                    navigate('/admin/profile');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 mb-1 text-blue-300 hover:text-white hover:bg-blue-800 rounded-xl transition-all text-sm font-medium"
                >
                  <Users size={14} />
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
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 shadow-sm z-20 no-print">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
              <Menu size={22} />
            </button>
            <div className="flex-1 flex items-center gap-3">
              <h1 className="text-gray-800 font-semibold text-base">OJT Daily Time Record — Admin</h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-xs font-bold shadow-sm" title="Active System Academic Environment">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                  {(() => {
                    const url = getPhotoUrl(employee?.photo as any);
                    return url ? (
                      <img src={url} alt={employee?.name} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                    ) : (
                      <span className="text-blue-700 text-xs font-bold">AD</span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
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