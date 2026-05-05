import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, MapPin, BarChart2, Settings, LogOut,
  Clock, Menu, X, Star, Megaphone, MessageSquare
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/employees', label: 'Employees', icon: Users, end: false },
  { to: '/admin/geofence', label: 'Geofence Zones', icon: MapPin, end: false },
  { to: '/admin/reports', label: 'Reports', icon: BarChart2, end: false },
  { to: '/admin/evaluations', label: 'Evaluations', icon: Star, end: false },
  { to: '/admin/host-feedback', label: 'Host Feedback', icon: MessageSquare, end: false },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
];

export function AdminLayout() {
  const { logout, announcements, currentUser, getCurrentEmployee } = useApp();
  const navigate = useNavigate();
  const employee = getCurrentEmployee();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const unreadAnn = announcements.filter(a => {
    if (a.expiresAt && new Date(a.expiresAt) < new Date()) return false;
    return true;
  }).length;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-blue-900 flex-col shrink-0">
        <div className="p-5 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-400 rounded-xl flex items-center justify-center shadow">
              <Clock size={18} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">OJT DTR</div>
              <div className="text-blue-300 text-xs">Admin Panel</div>
            </div>
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
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
            <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center overflow-hidden">
              {employee?.photo ? (
                <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              ) : (
                <span className="text-white text-xs font-bold">AD</span>
              )}
            </div>
            <div>
              <div className="text-white text-xs font-medium">OJT Instructor</div>
              <div className="text-blue-400 text-xs">admin@ojt.com</div>
            </div>
          </div>
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
              className="lg:hidden fixed inset-0 bg-black/50 z-30"
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-60 bg-blue-900 flex flex-col z-40"
            >
              <div className="p-5 border-b border-blue-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-sky-400 rounded-xl flex items-center justify-center">
                    <Clock size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">OJT DTR</div>
                    <div className="text-blue-300 text-xs">Admin Panel</div>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-blue-300 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                        isActive ? 'bg-sky-500 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
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
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-blue-300 hover:text-white hover:bg-blue-800 rounded-xl transition-all text-sm"
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
        <header className="bg-white border-b border-gray-200 shadow-sm z-20">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={22} />
            </button>
            <div className="flex-1">
              <h1 className="text-gray-800 font-semibold text-base">OJT Daily Time Record — Admin</h1>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                {employee?.photo ? (
                  <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                ) : (
                  <span className="text-blue-700 text-xs font-bold">AD</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
