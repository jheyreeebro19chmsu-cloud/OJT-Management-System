import { Home, Clock, FileText, User, LogOut, Bell, Menu, X, FileCheck, Check, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';
import { LogoutConfirmModal } from './ui/LogoutConfirmModal';
import { REQUIRED_TRAINEE_DOC_KEYS } from '../data/documentRequirements';


const navItems = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/time-record', label: 'Time Record', icon: Clock, end: false },
  { to: '/app/records', label: 'Records', icon: FileText, end: false },
  { to: '/app/documents', label: 'Required Docs', icon: FileCheck, end: false, isDocNav: true },
  { to: '/app/evaluation', label: 'HTE Evaluation', icon: Award, end: false, isEvalNav: true },
  { to: '/app/announcements', label: 'Announcements', icon: Bell, end: false, isAnnounceNav: true },
];

export function EmployeeLayout() {
  const { currentUser, logout, getCurrentEmployee, settings, evaluations, getActiveAnnouncements, announcements } = useApp();
  const navigate = useNavigate();
  const employee = getCurrentEmployee();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
    } else if (currentUser.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (currentUser.role === 'hte' || currentUser.role === 'host') {
      navigate('/hte', { replace: true });
    }
  }, [currentUser, navigate]);

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

  const submittedDocs = employee?.submittedDocuments || {};
  const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
  const totalRequired = docKeys.length;
  const uploadedDocsCount = docKeys.filter((k) => Boolean(submittedDocs[k]?.dataUrl || submittedDocs[k]?.name)).length;
  const missingDocsCount = totalRequired - uploadedDocsCount;

  const traineeEvaluation = evaluations.find(
    (e) => e.employeeId === employee?.id || e.employeeId === employee?.employeeId
  );

  const activeAnnouncements = getActiveAnnouncements
    ? getActiveAnnouncements('employee')
    : announcements.filter((a) => !a.expiresAt || new Date(a.expiresAt) >= new Date());
  const activeAnnouncementCount = activeAnnouncements.length;

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Brand Header */}
      <div className="p-5 border-b border-[#0E1D35] bg-[#0E1D35]/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
              <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-bold text-xs sm:text-[13px] leading-snug">CHMSU OJT Management System</div>
              <div className="text-[#D9A441] text-xs font-semibold mt-0.5">Trainee Panel</div>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1E3A66] transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Academic Year Environment Indicator */}
        <div className="mt-3.5 flex items-center justify-between px-3 py-1.5 bg-[#0E1D35]/60 rounded-xl border border-[#1E3A66] text-[11px] text-blue-100 font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#146B4D] animate-pulse" />
            <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
          </div>
          <span className="text-[10px] text-[#D9A441] uppercase tracking-wider font-bold">Active</span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-none">
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
                  isActive
                    ? 'bg-[#146B4D] text-white shadow-md shadow-[#146B4D]/25'
                    : 'text-slate-300 hover:bg-[#1E3A66] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-white/15' : ''}`}>
                    <Icon size={18} />
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-white/10 rounded-xl -z-10"
                      />
                    )}
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                  {(item as any).isDocNav && (
                    <span
                      className={`ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                        missingDocsCount > 0
                          ? 'bg-[#DC6B2F] text-white shadow-sm'
                          : 'bg-[#146B4D]/30 text-emerald-300 border border-[#146B4D]/50'
                      }`}
                    >
                      {missingDocsCount > 0 ? `${missingDocsCount} left` : `${totalRequired}/${totalRequired}`}
                    </span>
                  )}
                  {(item as any).isEvalNav && (
                    <span
                      className={`ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        traineeEvaluation?.status === 'reviewed_by_instructor'
                          ? 'bg-[#146B4D]/30 text-emerald-300 border border-[#146B4D]/50'
                          : traineeEvaluation
                          ? 'bg-[#1E3A66] text-blue-200 border border-blue-400/30'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {traineeEvaluation?.status === 'reviewed_by_instructor'
                        ? 'Verified'
                        : traineeEvaluation
                        ? 'Evaluated'
                        : 'Pending'}
                    </span>
                  )}
                  {(item as any).isAnnounceNav && activeAnnouncementCount > 0 && (
                    <span className="ml-auto bg-[#DC6B2F] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                      {activeAnnouncementCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-[#0E1D35] bg-[#0E1D35]/30">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
          <div className="w-9 h-9 bg-[#1E3A66] rounded-full flex items-center justify-center overflow-hidden border border-white/20 shadow-inner shrink-0">
            {avatarUrl ? (
              <img
                src={getPhotoUrl(avatarUrl)}
                alt={displayName}
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <Clock size={18} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-bold truncate">{displayName}</div>
            <div className="text-blue-300 text-[10px] truncate">{displayId}</div>
          </div>
        </div>
        <button
          onClick={() => {
            if (isMobile) setSidebarOpen(false);
            handleLogout();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-[#1E3A66] rounded-xl transition-all text-sm font-medium"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F7F7F3] text-[#1F2937] overflow-hidden font-sans">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#152B4D] flex-col shrink-0 no-print border-r border-[#0E1D35] shadow-xl">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-Over Left Sidebar Drawer */}
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
              className="fixed inset-y-0 left-0 z-[999] w-72 bg-[#152B4D] flex flex-col shadow-2xl lg:hidden no-print border-r border-[#0E1D35]"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-gradient-to-r from-[#152B4D] to-[#1E3A66] text-white shadow-md z-10 no-print border-b border-[#0E1D35]">
          <div className="max-w-md lg:max-w-none mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Sidebar Toggle Button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="relative lg:hidden p-2 rounded-xl text-blue-200 hover:text-white hover:bg-[#152B4D] transition-colors focus:outline-none focus:ring-2 focus:ring-[#146B4D] cursor-pointer"
                aria-label="Open Navigation"
              >
                <Menu size={22} />
                {activeAnnouncementCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#DC6B2F] rounded-full border-2 border-[#152B4D] shadow-sm" />
                )}
              </button>

              <div className="w-8 h-8 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
                <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <div className="text-xs text-blue-200 leading-tight">CHMSU OJT Management System</div>
                <div className="text-sm font-bold leading-tight truncate max-w-[130px] sm:max-w-[200px]">{displayName}</div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 bg-[#0E1D35]/60 border border-[#1E3A66] text-blue-100 rounded-full text-[11px] font-bold shadow-sm" title="Active Academic Environment">
                <span className="w-1.5 h-1.5 bg-[#146B4D] rounded-full animate-pulse" />
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
                className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-xs py-1.5 px-2.5 rounded-lg hover:bg-[#1E3A66] font-medium cursor-pointer"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-md lg:max-w-none mx-auto px-4 py-4 lg:p-6">
            <Outlet />
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
