import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  X,
  LogIn,
  LogOut,
  Clock,
  FileText,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Filter,
  Trash2,
  Calendar,
  Laptop,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import {
  getActivityLogs,
  clearActivityLogs,
  onActivityLog,
  type ActivityLogEntry,
  type ActivityLogType,
} from '../services/activityLogService';

export interface ExtraAlertItem {
  id: string;
  title: string;
  message: string;
  urgency: 'normal' | 'high' | 'success';
  timestamp?: string;
  timeLabel?: string;
  actionRoute?: string;
  actionText?: string;
}

export interface SystemLogBellTrayProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
  currentUserId?: string;
  extraNotifications?: ExtraAlertItem[];
  readExtraNotifIds?: string[];
  onMarkExtraNotifRead?: (id: string) => void;
  shiftSummary?: {
    schedule: string;
    statusText: string;
    statusVariant: 'completed' | 'clocked_in' | 'not_clocked_in';
  };
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function formatExactDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function SystemLogBellTray({
  isOpen,
  onClose,
  currentUserRole = 'employee',
  currentUserId,
  extraNotifications = [],
  readExtraNotifIds = [],
  onMarkExtraNotifRead,
  shiftSummary,
}: SystemLogBellTrayProps) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'alerts'>('logs');
  const [filterType, setFilterType] = useState<'all' | 'login' | 'clock' | 'docs' | 'system'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Reload logs whenever tray opens or event occurs
  const reloadLogs = () => {
    setLogs(getActivityLogs());
  };

  useEffect(() => {
    if (isOpen) {
      reloadLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = onActivityLog(() => {
      reloadLogs();
    });
    return unsubscribe;
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType === 'all') return true;
      if (filterType === 'login') return log.type === 'login' || log.type === 'logout';
      if (filterType === 'clock') return log.type === 'clock_in' || log.type === 'clock_out';
      if (filterType === 'docs')
        return (
          log.type === 'document_upload' ||
          log.type === 'document_approved' ||
          log.type === 'document_rejected'
        );
      if (filterType === 'system') return log.type === 'system' || log.type === 'profile_update';
      return true;
    });
  }, [logs, filterType]);

  const hasExtraAlerts = extraNotifications.length > 0;

  const renderLogIcon = (type: ActivityLogType) => {
    switch (type) {
      case 'login':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <LogIn size={16} />
          </div>
        );
      case 'logout':
        return (
          <div className="w-8 h-8 rounded-xl bg-slate-500/15 text-slate-600 flex items-center justify-center shrink-0 border border-slate-500/20">
            <LogOut size={16} />
          </div>
        );
      case 'clock_in':
        return (
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Clock size={16} />
          </div>
        );
      case 'clock_out':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Clock size={16} />
          </div>
        );
      case 'document_upload':
      case 'document_approved':
      case 'document_rejected':
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center shrink-0 border border-purple-500/20">
            <FileText size={16} />
          </div>
        );
      case 'system':
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-500/20">
            <ShieldCheck size={16} />
          </div>
        );
    }
  };

  const getRoleBadge = (role?: string) => {
    if (!role) return null;
    const r = role.toLowerCase();
    if (r.includes('admin') || r.includes('instructor')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          Instructor
        </span>
      );
    }
    if (r.includes('hte') || r.includes('host')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          HTE
        </span>
      );
    }
    if (r.includes('system')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          System
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
        Trainee
      </span>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-[1000] no-print"
          />

          {/* Slide-over Tray */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-[1001] w-full sm:w-[440px] bg-white shadow-2xl flex flex-col no-print border-l border-gray-200 font-sans"
          >
            {/* Tray Header */}
            <div className="p-4 bg-gradient-to-r from-[#152B4D] to-[#1E3A66] text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Bell size={18} className="text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">System & Log History</h3>
                  <p className="text-[11px] text-blue-200">User session, login & activity audit logs</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={reloadLogs}
                  title="Refresh Logs"
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Optional Tab Switcher if extra alerts exist */}
            {hasExtraAlerts && (
              <div className="flex border-b border-gray-200 bg-slate-50 px-3 pt-2 gap-2 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'logs'
                      ? 'border-[#152B4D] text-[#152B4D] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LogIn size={14} />
                  <span>Log History</span>
                  <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                    {filteredLogs.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('alerts')}
                  className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'alerts'
                      ? 'border-[#152B4D] text-[#152B4D] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Clock size={14} />
                  <span>Shift Alerts</span>
                  {extraNotifications.length > 0 && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-extrabold">
                      {extraNotifications.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Shift summary bar for Trainees */}
            {shiftSummary && activeTab === 'alerts' && (
              <div className="px-4 py-2.5 bg-slate-50 border-b border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Shift Schedule</span>
                  <span className="font-semibold text-slate-800">{shiftSummary.schedule}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Today's Status</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                      shiftSummary.statusVariant === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : shiftSummary.statusVariant === 'clocked_in'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {shiftSummary.statusText}
                  </span>
                </div>
              </div>
            )}

            {/* Content Area */}
            {activeTab === 'logs' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Filter Pills */}
                <div className="p-3 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between gap-2 overflow-x-auto">
                  <div className="flex items-center gap-1.5">
                    <Filter size={13} className="text-slate-400 shrink-0 ml-1" />
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'login', label: 'Logins' },
                        { id: 'clock', label: 'Clocking' },
                        { id: 'docs', label: 'Documents' },
                        { id: 'system', label: 'System' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilterType(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          filterType === f.id
                            ? 'bg-[#152B4D] text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-gray-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowClearConfirm(true)}
                    title="Clear Log History"
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Clear Confirmation Banner */}
                {showClearConfirm && (
                  <div className="p-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-800">
                    <span>Clear all saved log entries?</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          clearActivityLogs();
                          setShowClearConfirm(false);
                          setLogs([]);
                        }}
                        className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Yes, Clear
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="px-2 py-0.5 rounded bg-gray-200 text-slate-700 hover:bg-gray-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Log Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-16 px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <Clock size={24} />
                      </div>
                      <p className="font-bold text-sm text-gray-800">No Log Entries Found</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                        User sign-ins, punches, and system events will appear here in chronological order.
                      </p>
                    </div>
                  ) : (
                    filteredLogs.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xs transition-all bg-white flex items-start gap-3"
                      >
                        {renderLogIcon(item.type)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="font-bold text-xs text-gray-900 truncate leading-snug">
                              {item.title}
                            </h4>
                            <span
                              className="text-[10px] text-slate-400 whitespace-nowrap"
                              title={formatExactDateTime(item.timestamp)}
                            >
                              {formatRelativeTime(item.timestamp)}
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-600 leading-relaxed mb-2">
                            {item.description}
                          </p>

                          <div className="flex items-center flex-wrap gap-2 text-[10px] text-slate-500">
                            {item.userName && (
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                {item.userName}
                              </span>
                            )}
                            {getRoleBadge(item.userRole)}
                            {item.device && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Laptop size={11} />
                                {item.device}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Alerts Tab */
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {extraNotifications.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                      <CheckCircle size={24} />
                    </div>
                    <p className="font-bold text-sm text-gray-800">You're All Caught Up!</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                      No urgent shift alerts right now. Shift proximity notices and required hours milestones will appear here.
                    </p>
                  </div>
                ) : (
                  extraNotifications.map((n) => {
                    const isRead = readExtraNotifIds.includes(n.id);
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
                          <div className="flex items-center gap-2">
                            {n.timeLabel && (
                              <span className="text-[10px] text-gray-400 shrink-0 font-medium">{n.timeLabel}</span>
                            )}
                            {!isRead && onMarkExtraNotifRead && (
                              <button
                                type="button"
                                onClick={() => onMarkExtraNotifRead(n.id)}
                                className="text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">{n.message}</p>
                        {n.actionRoute && (
                          <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (onMarkExtraNotifRead) onMarkExtraNotifRead(n.id);
                                onClose();
                                navigate(n.actionRoute!);
                              }}
                              className="px-2.5 py-1 bg-gradient-to-r from-[#152B4D] to-[#1E3A66] hover:opacity-95 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                            >
                              <span>{n.actionText || 'Take Action'}</span>
                              <ChevronRight size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tray Footer */}
            <div className="p-3 bg-slate-50 border-t border-gray-200 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Audit Logging Active
              </span>
              <span>CHMSU OJT System</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
