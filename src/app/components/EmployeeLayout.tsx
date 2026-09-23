import { Home, Clock, FileText, User, LogOut, Bell, Menu, X, FileCheck, Check, Award, AlertTriangle, CheckCircle, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';
import { LogoutConfirmModal } from './ui/LogoutConfirmModal';
import { REQUIRED_TRAINEE_DOC_KEYS } from '../data/documentRequirements';
import { computeTraineeOjtNotifications, TraineeOjtNotification } from '../utils/traineeNotifications';
import { TraineeLocationReminder } from './TraineeLocationReminder';


const navItems = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/time-record', label: 'Time Record', icon: Clock, end: false },
  { to: '/app/records', label: 'Records', icon: FileText, end: false },
  { to: '/app/documents', label: 'Required Docs', icon: FileCheck, end: false, isDocNav: true },
  { to: '/app/evaluation', label: 'OJT Questionnaire', icon: Award, end: false, isEvalNav: true },
  { to: '/app/announcements', label: 'Announcements', icon: Bell, end: false, isAnnounceNav: true },
];

export function EmployeeLayout() {
  const { currentUser, logout, getCurrentEmployee, settings, evaluations, getActiveAnnouncements, announcements, timeRecords } = useApp();
  const navigate = useNavigate();
  const employee = getCurrentEmployee();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifTrayOpen, setNotifTrayOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('trainee_read_notif_ids') || '[]');
    } catch {
      return [];
    }
  });

  const [currentTimeTick, setCurrentTimeTick] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeTick(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const traineeRecords = useMemo(() => {
    if (!employee) return [];
    return (timeRecords || []).filter((r) => r.employeeId === employee.id || r.employeeId === employee.employeeId);
  }, [timeRecords, employee]);

  const todayRecord = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return traineeRecords.find((r) => r.date === todayStr) || null;
  }, [traineeRecords]);

  const totalRenderedHours = useMemo(() => {
    return traineeRecords
      .filter((r) => r.approvalStatus !== 'rejected')
      .reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);
  }, [traineeRecords]);

  const ojtNotifications = useMemo(() => {
    return computeTraineeOjtNotifications(employee, todayRecord, totalRenderedHours, currentTimeTick);
  }, [employee, todayRecord, totalRenderedHours, currentTimeTick]);

  const unreadCount = useMemo(() => {
    return ojtNotifications.filter((n) => !readNotifIds.includes(n.id)).length;
  }, [ojtNotifications, readNotifIds]);

  const handleMarkAsRead = (id: string) => {
    setReadNotifIds((prev) => {
      const next = Array.from(new Set([...prev, id]));
      try {
        localStorage.setItem('trainee_read_notif_ids', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

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

  const isQuestionnaireAnswered = Boolean(
    traineeEvaluation?.questionnaire?.q1_dutiesBriefly ||
    traineeEvaluation?.questionnaire?.contactPerson
  );

  const activeAnnouncements = getActiveAnnouncements
    ? getActiveAnnouncements('employee')
    : announcements.filter((a) => !a.expiresAt || new Date(a.expiresAt) >= new Date());
  const activeAnnouncementCount = activeAnnouncements.length;

  const handleMobileNavClick = (to: string) => {
    navigate(to);
    setSidebarOpen(false);
  };

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Brand Header */}
      <div className="p-5 border-b border-[#0E1D35] bg-[#0E1D35]/40">
        <div className="flex items-center justify-between">
          <NavLink
            to="/app"
            onClick={() => isMobile && setSidebarOpen(false)}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <div className="w-10 h-10 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
              <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-bold text-xs sm:text-[13px] leading-snug">CHMSU OJT Management System</div>
              <div className="text-[#D9A441] text-xs font-semibold mt-0.5">Trainee Panel</div>
            </div>
          </NavLink>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1E3A66] transition-colors cursor-pointer"
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
              onClick={() => {
                if (isMobile) {
                  setSidebarOpen(false);
                }
              }}
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
                        layoutId={isMobile ? 'nav-indicator-mobile' : 'nav-indicator-desktop'}
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
                        isQuestionnaireAnswered
                          ? 'bg-[#146B4D]/30 text-emerald-300 border border-[#146B4D]/50'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      }`}
                    >
                      {isQuestionnaireAnswered ? 'Answered' : 'Pending'}
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
              <User size={18} className="text-white" />
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
            navigate('/app/profile');
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 mb-1 text-slate-300 hover:text-white hover:bg-[#1E3A66] rounded-xl transition-all text-sm font-medium cursor-pointer"
        >
          <User size={15} />
          Profile
        </button>
        <button
          onClick={() => {
            if (isMobile) setSidebarOpen(false);
            handleLogout();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-[#1E3A66] rounded-xl transition-all text-sm font-medium cursor-pointer"
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

              <NavLink to="/app" className="flex items-center gap-2.5 hover:opacity-95 transition-opacity">
                <div className="w-8 h-8 bg-white rounded-full p-0.5 shadow flex items-center justify-center shrink-0">
                  <img src="/chmsu-logo.png" alt="CHMSU Logo" className="w-full h-full object-contain rounded-full" />
                </div>
                <div>
                  <div className="text-xs text-blue-200 leading-tight">CHMSU OJT System</div>
                  <div className="text-sm font-bold leading-tight truncate max-w-[130px] sm:max-w-[200px]">{displayName}</div>
                </div>
              </NavLink>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 bg-[#0E1D35]/60 border border-[#1E3A66] text-blue-100 rounded-full text-[11px] font-bold shadow-sm" title="Active Academic Environment">
                <span className="w-1.5 h-1.5 bg-[#146B4D] rounded-full animate-pulse" />
                <span>AY {settings?.activeAcademicYear || '2026-2027'}</span>
              </div>
            </div>

            {/* Right Header: Notification Bell & Quick Profile */}
            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => setNotifTrayOpen((prev) => !prev)}
                className="relative p-2 rounded-xl text-blue-100 hover:text-white hover:bg-[#1E3A66] transition-colors cursor-pointer"
                title="OJT Shift & Hours Notifications"
                aria-label="View notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center shadow-md animate-pulse border-2 border-[#152B4D]">
                    {unreadCount}
                  </span>
                )}
              </button>

              <NavLink
                to="/app/profile"
                className="hidden sm:flex items-center gap-2 p-1 pl-2.5 bg-[#0E1D35]/50 hover:bg-[#0E1D35] rounded-full border border-[#1E3A66] transition-all"
              >
                <span className="text-xs font-semibold text-blue-100 pr-1 max-w-[100px] truncate">{displayName.split(' ')[0]}</span>
                <div className="w-7 h-7 rounded-full bg-[#1E3A66] overflow-hidden border border-white/20 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={getPhotoUrl(avatarUrl)} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={14} className="text-white" />
                  )}
                </div>
              </NavLink>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-6">
          <div className="max-w-md lg:max-w-none mx-auto px-4 py-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* OJT Shift & Hours Notifications Slide-Over Tray */}
      <AnimatePresence>
        {notifTrayOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotifTrayOpen(false)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-[1000] no-print"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed inset-y-0 right-0 z-[1001] w-full sm:w-96 bg-white shadow-2xl flex flex-col no-print border-l border-gray-200"
            >
              {/* Tray Header */}
              <div className="p-4 bg-gradient-to-r from-[#152B4D] to-[#1E3A66] text-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Bell size={18} className="text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">OJT Hours & Shift Alerts</h3>
                    <p className="text-[11px] text-blue-200">Real-time attendance & schedule status</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifTrayOpen(false)}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Trainee Shift Summary Bar */}
              <div className="px-4 py-3 bg-slate-50 border-b border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Shift Schedule</span>
                  <span className="font-semibold text-slate-800">8:00 AM – 5:00 PM</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Today's Status</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                    todayRecord?.timeOut
                      ? 'bg-blue-100 text-blue-800'
                      : todayRecord?.timeIn
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                    {todayRecord?.timeOut
                      ? 'Shift Completed'
                      : todayRecord?.timeIn
                        ? 'Currently Clocked In'
                        : 'Not Clocked In'}
                  </span>
                </div>
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {ojtNotifications.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                      <CheckCircle size={24} />
                    </div>
                    <p className="font-bold text-sm text-gray-800">You're All Caught Up!</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                      No urgent shift alerts right now. Shift proximity notices (e.g. 4:20 PM clock-out warnings) and required hours milestones will appear here.
                    </p>
                  </div>
                ) : (
                  ojtNotifications.map((n) => {
                    const isRead = readNotifIds.includes(n.id);
                    const isHigh = n.urgency === 'high';
                    const isSuccess = n.urgency === 'success';

                    return (
                      <div
                        key={n.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isHigh
                            ? 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-400/30'
                            : isSuccess
                              ? 'bg-emerald-50/80 border-emerald-200'
                              : 'bg-blue-50/70 border-blue-200'
                        } ${isRead ? 'opacity-75' : 'shadow-xs'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {isHigh ? (
                              <Clock size={15} className="text-amber-600 shrink-0" />
                            ) : isSuccess ? (
                              <Sparkles size={15} className="text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle size={15} className="text-blue-600 shrink-0" />
                            )}
                            <h4 className="font-bold text-xs text-gray-900 leading-snug">{n.title}</h4>
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0 font-medium">{n.timeLabel}</span>
                        </div>

                        <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">{n.message}</p>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-black/5 gap-2">
                          {n.actionRoute && (
                            <button
                              type="button"
                              onClick={() => {
                                handleMarkAsRead(n.id);
                                setNotifTrayOpen(false);
                                navigate(n.actionRoute!);
                              }}
                              className="px-3 py-1.5 bg-gradient-to-r from-[#152B4D] to-[#1E3A66] hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                            >
                              <span>{n.actionText || 'Take Action'}</span>
                              <ChevronRight size={13} />
                            </button>
                          )}

                          {!isRead && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsRead(n.id)}
                              className="text-[11px] text-gray-500 hover:text-gray-800 font-medium px-2 py-1 rounded-lg hover:bg-black/5 cursor-pointer ml-auto"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Tray Footer */}
              <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span>Standard CHMSU OJT Hours</span>
                <span className="font-semibold text-gray-700">{employee?.requiredHours || 486} Required Total</span>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />

      {/* Trainee Location Reminder Pop-up (Upper Left) */}
      <TraineeLocationReminder />
    </div>
  );
}
