import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertTriangle, TrendingUp, Calendar, Camera, ChevronRight, Bell, Info, X, Megaphone } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { formatTime } from '../utils/geo';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Announcement } from '../types';

const ANN_COLORS: Record<Announcement['type'], { bg: string; border: string; icon: string; iconBg: string }> = {
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',  icon: 'text-blue-600',   iconBg: 'bg-blue-100' },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200', icon: 'text-amber-600',  iconBg: 'bg-amber-100' },
  success: { bg: 'bg-green-50',  border: 'border-green-200', icon: 'text-green-600',  iconBg: 'bg-green-100' },
  urgent:  { bg: 'bg-red-50',    border: 'border-red-300',   icon: 'text-red-600',    iconBg: 'bg-red-100' },
};

const ANN_ICON: Record<Announcement['type'], React.ReactNode> = {
  info:    <Info size={14} />,
  warning: <AlertTriangle size={14} />,
  success: <CheckCircle size={14} />,
  urgent:  <Bell size={14} />,
};

export function Dashboard() {
  const { currentUser, getCurrentEmployee, getTodayRecord, getEmployeeRecords, settings, getActiveAnnouncements } = useApp();
  const employee = getCurrentEmployee();
  const isAdmin = currentUser?.role === 'admin';
  const displayName = employee?.name || currentUser?.name || (isAdmin ? 'Administrator' : 'Trainee');
  const displayId = employee?.employeeId || (isAdmin ? 'ADMIN' : '');
  const todayRecord = employee ? getTodayRecord(employee.id) : null;
  const allRecords = employee ? getEmployeeRecords(employee.id) : [];
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dismissedAnn, setDismissedAnn] = useState<Set<string>>(new Set());

  const activeAnnouncements = getActiveAnnouncements(isAdmin ? 'admin' : 'employee').filter(a => !dismissedAnn.has(a.id));

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalHoursRendered = allRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0);
  const requiredHours = employee?.requiredHours ?? (isAdmin ? 0 : 486);
  const hoursProgress = requiredHours > 0 ? Math.min((totalHoursRendered / requiredHours) * 100, 100) : 0;
  const presentDays = allRecords.filter(r => r.status === 'present' || r.status === 'overtime').length;
  const lateDays = allRecords.filter(r => r.status === 'late').length;
  const recentRecords = allRecords.slice(0, 5);

  const greeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const timeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const statusColor = () => {
    if (!todayRecord) return 'from-gray-500 to-gray-600';
    if (todayRecord.timeIn && todayRecord.timeOut) return 'from-green-500 to-emerald-600';
    if (todayRecord.timeIn) return 'from-sky-500 to-blue-600';
    return 'from-orange-400 to-orange-500';
  };

  const todayStatus = () => {
    if (!todayRecord) return { label: 'Not Clocked In', color: 'text-gray-500 bg-gray-100' };
    if (todayRecord.timeIn && todayRecord.timeOut) return { label: 'Completed', color: 'text-green-700 bg-green-100' };
    if (todayRecord.timeIn) return { label: todayRecord.status === 'late' ? 'Clocked In (Late)' : 'Clocked In', color: todayRecord.status === 'late' ? 'text-orange-700 bg-orange-100' : 'text-sky-700 bg-sky-100' };
    return { label: 'Absent', color: 'text-red-700 bg-red-100' };
  };

  return (
    <div className="space-y-4">
      {/* Announcements */}
      <AnimatePresence>
        {activeAnnouncements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            {activeAnnouncements.slice(0, 3).map(ann => {
              const c = ANN_COLORS[ann.type];
              return (
                <motion.div
                  key={ann.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`rounded-2xl border p-3 ${c.bg} ${c.border}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.iconBg}`}>
                      <span className={c.icon}>{ANN_ICON[ann.type]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {ann.isPinned && <span className="text-xs font-bold text-gray-500">📌</span>}
                        <p className="text-xs font-bold text-gray-800 truncate">{ann.title}</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{ann.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(ann.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {ann.createdBy}
                      </p>
                    </div>
                    {!ann.isPinned && (
                      <button
                        onClick={() => setDismissedAnn(prev => new Set([...prev, ann.id]))}
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {activeAnnouncements.length > 3 && (
              <p className="text-xs text-center text-gray-400">+{activeAnnouncements.length - 3} more announcements</p>
            )}
            <Link to="/app/announcements" className="block text-xs text-center text-blue-600 font-medium">
              Open announcements & submit response
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Greeting & Time Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl bg-gradient-to-br ${statusColor()} text-white p-5 shadow-lg`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm">{greeting()},</p>
            <h2 className="font-bold text-lg leading-tight">{displayName}</h2>
            {displayId && <p className="text-white/60 text-xs mt-0.5">{displayId}</p>}
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${todayStatus().color}`}>
            {todayStatus().label}
          </div>
        </div>

        <div className="mt-4 text-center">
          <div className="text-4xl font-bold font-mono tracking-tight">{timeStr}</div>
          <div className="text-white/70 text-xs mt-1">{dateStr}</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-2xl p-3">
            <p className="text-white/70 text-xs">Time In</p>
            <p className="text-white font-bold text-sm">
              {todayRecord?.timeIn ? formatTime(todayRecord.timeIn) : '— —'}
            </p>
            {todayRecord?.timeInFaceVerified && (
              <div className="flex items-center gap-1 mt-1">
                <Camera size={10} className="text-green-300" />
                <span className="text-green-300 text-xs">Verified</span>
              </div>
            )}
          </div>
          <div className="bg-white/20 rounded-2xl p-3">
            <p className="text-white/70 text-xs">Time Out</p>
            <p className="text-white font-bold text-sm">
              {todayRecord?.timeOut ? formatTime(todayRecord.timeOut) : '— —'}
            </p>
            {todayRecord?.timeOutFaceVerified && (
              <div className="flex items-center gap-1 mt-1">
                <Camera size={10} className="text-green-300" />
                <span className="text-green-300 text-xs">Verified</span>
              </div>
            )}
          </div>
        </div>

        {todayRecord?.timeIn && todayRecord?.timeOut && todayRecord.totalHours && (
          <div className="mt-3 bg-white/20 rounded-2xl p-3 text-center">
            <p className="text-white/70 text-xs">Total Hours Today</p>
            <p className="text-white font-bold text-xl">{todayRecord.totalHours.toFixed(2)} hrs</p>
          </div>
        )}
      </motion.div>

      {/* Quick Action */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Link
          to="/app/time-record"
          className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock size={22} className="text-blue-700" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                {!todayRecord?.timeIn ? 'Clock In Now' : !todayRecord?.timeOut ? 'Clock Out Now' : 'View Today\'s Record'}
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Camera size={10} />
                Facial Recognition + Geofencing
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </Link>
      </motion.div>

      {/* OJT Progress */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-sm">OJT Progress</h3>
          </div>
          <span className="text-xs text-gray-500">{Math.round(hoursProgress)}% complete</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-sky-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${hoursProgress}%` }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-500">{totalHoursRendered.toFixed(1)} hrs rendered</span>
          <span className="text-xs text-gray-500">
            {requiredHours > 0 ? `${requiredHours} hrs required` : 'N/A'}
          </span>
        </div>
        {employee && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-green-50 rounded-xl p-2 text-center">
              <p className="text-green-700 font-bold">{presentDays}</p>
              <p className="text-xs text-gray-500">Present</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-2 text-center">
              <p className="text-orange-700 font-bold">{lateDays}</p>
              <p className="text-xs text-gray-500">Late</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-2 text-center">
              <p className="text-blue-700 font-bold">{allRecords.length - presentDays - lateDays}</p>
              <p className="text-xs text-gray-500">Other</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Schedule Info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-sky-600" />
          <h3 className="font-semibold text-gray-800 text-sm">Work Schedule</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-sky-50 rounded-xl p-2.5">
            <p className="text-xs text-gray-500">Start Time</p>
            <p className="font-bold text-sky-700">{formatTime(settings.workStartTime)}</p>
          </div>
          <div className="bg-sky-50 rounded-xl p-2.5">
            <p className="text-xs text-gray-500">End Time</p>
            <p className="font-bold text-sky-700">{formatTime(settings.workEndTime)}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <AlertTriangle size={12} className="text-orange-400" />
          Late threshold: {settings.lateThresholdMinutes} minutes after {formatTime(settings.workStartTime)}
        </div>
      </motion.div>

      {/* Recent Records */}
      {recentRecords.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              <h3 className="font-semibold text-gray-800 text-sm">Recent Records</h3>
            </div>
            <Link to="/app/records" className="text-xs text-blue-600 hover:text-blue-800 font-medium">View all</Link>
          </div>
          <div className="space-y-2">
            {recentRecords.map(record => (
              <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                    {record.timeIn && <span>In: {formatTime(record.timeIn)}</span>}
                    {record.timeOut && <span>Out: {formatTime(record.timeOut)}</span>}
                    {record.totalHours && <span className="text-blue-500 font-medium">{record.totalHours.toFixed(1)}h</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    record.status === 'present' ? 'bg-green-100 text-green-700' :
                    record.status === 'late' ? 'bg-orange-100 text-orange-700' :
                    record.status === 'absent' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                  </span>
                  {!record.timeInGeofenced && (
                    <span className="text-xs text-red-500 flex items-center gap-0.5">⚠ Off-premises</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
