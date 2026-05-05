import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Clock, FileText, User, LogOut, Bell } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { motion } from 'motion/react';

const navItems = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/time-record', label: 'Time Record', icon: Clock, end: false },
  { to: '/app/records', label: 'Records', icon: FileText, end: false },
  { to: '/app/announcements', label: 'Announce', icon: Bell, end: false },
  { to: '/app/profile', label: 'Profile', icon: User, end: false },
];

export function EmployeeLayout() {
  const { logout, getCurrentEmployee } = useApp();
  const navigate = useNavigate();
  const employee = getCurrentEmployee();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-blue-900 flex-col shrink-0">
        <div className="p-5 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-400 rounded-xl flex items-center justify-center shadow overflow-hidden">
              {employee?.photo ? (
                <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              ) : (
                <Clock size={18} className="text-white" />
              )}
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight truncate max-w-[120px]">{employee?.name || 'OJT DTR'}</div>
              <div className="text-blue-300 text-[10px] uppercase tracking-wider font-bold">{employee?.employeeId || 'Employee Panel'}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
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
        <div className="p-3 border-t border-blue-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-blue-300 hover:text-white hover:bg-blue-800 rounded-xl transition-all text-sm"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-lg z-10">
          <div className="max-w-md lg:max-w-none mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-sky-400 rounded-lg flex items-center justify-center shadow overflow-hidden">
                {employee?.photo ? (
                  <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                ) : (
                  <Clock size={16} className="text-white" />
                )}
              </div>
              <div>
                <div className="text-xs text-blue-200 leading-tight">OJT System</div>
                <div className="text-sm font-bold leading-tight">{employee?.name || 'Daily Time Record'}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="lg:hidden flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-xs py-1.5 px-3 rounded-lg hover:bg-blue-700"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="max-w-md lg:max-w-none mx-auto px-4 py-4 lg:p-6">
            <Outlet />
          </div>
        </main>

        {/* Bottom Navigation (mobile only) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20">
          <div className="max-w-md mx-auto px-2 py-1 grid grid-cols-5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all ${
                    isActive ? 'text-blue-700' : 'text-gray-400 hover:text-gray-600'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-blue-100' : ''}`}>
                      <Icon size={20} />
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator-mobile"
                          className="absolute inset-0 bg-blue-100 rounded-xl -z-10"
                        />
                      )}
                    </div>
                    <span className={`text-[10px] font-medium ${isActive ? 'text-blue-700' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
