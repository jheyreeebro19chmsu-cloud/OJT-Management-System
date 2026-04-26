import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Camera, ChevronDown, Filter, FileText, AlertTriangle, CheckCircle, ShieldOff } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { formatTime } from '../utils/geo';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-orange-100 text-orange-700',
  absent: 'bg-red-100 text-red-700',
  overtime: 'bg-blue-100 text-blue-700',
  'half-day': 'bg-yellow-100 text-yellow-700',
};

export function Records() {
  const { getCurrentEmployee, getEmployeeRecords } = useApp();
  const employee = getCurrentEmployee();
  const allRecords = employee ? getEmployeeRecords(employee.id) : [];
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{ src: string; label: string } | null>(null);

  const filteredRecords = allRecords.filter(r => r.date.startsWith(filterMonth));

  const totalHours = filteredRecords.reduce((s, r) => s + (r.totalHours || 0), 0);
  const presentCount = filteredRecords.filter(r => r.status === 'present' || r.status === 'overtime').length;
  const lateCount = filteredRecords.filter(r => r.status === 'late').length;
  const outsideCount = filteredRecords.filter(r => !r.timeInGeofenced || !r.timeOutGeofenced).length;

  // Generate month options (last 6 months)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { value, label };
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
    };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-3xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={18} />
          <h2 className="font-bold">Daily Time Records</h2>
        </div>
        <p className="text-blue-200 text-xs mb-4">{employee?.name} • {employee?.employeeId}</p>

        {/* Month summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/15 rounded-2xl p-2.5 text-center">
            <p className="text-xl font-bold">{totalHours.toFixed(0)}</p>
            <p className="text-blue-200 text-xs">Hours</p>
          </div>
          <div className="bg-white/15 rounded-2xl p-2.5 text-center">
            <p className="text-xl font-bold">{presentCount}</p>
            <p className="text-blue-200 text-xs">Present</p>
          </div>
          <div className="bg-white/15 rounded-2xl p-2.5 text-center">
            <p className="text-xl font-bold">{lateCount}</p>
            <p className="text-blue-200 text-xs">Late</p>
          </div>
          <div className={`rounded-2xl p-2.5 text-center ${outsideCount > 0 ? 'bg-red-500/40' : 'bg-white/15'}`}>
            <p className="text-xl font-bold">{outsideCount}</p>
            <p className="text-blue-200 text-xs">Off-site</p>
          </div>
        </div>
      </motion.div>

      {/* Month Filter */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500 font-medium">Filter by month:</span>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="flex-1 text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer"
          >
            {monthOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Records List */}
      {filteredRecords.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No records for this month</p>
          <p className="text-gray-400 text-sm mt-1">Clock in to start recording your attendance</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {filteredRecords.map((record, idx) => {
            const { day, date, month } = formatDate(record.date);
            const isExpanded = expandedId === record.id;
            const inPremises = record.timeInGeofenced;
            const outPremises = !record.timeOut || record.timeOutGeofenced;
            const allPremises = inPremises && outPremises;

            return (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Date badge */}
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs text-blue-500">{day}</span>
                    <span className="text-lg font-bold text-blue-800 leading-tight">{date}</span>
                    <span className="text-xs text-blue-500">{month}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[record.status] || 'bg-gray-100 text-gray-600'}`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                      {record.timeInFaceVerified && (
                        <span className="text-xs text-purple-500 flex items-center gap-0.5">
                          <Camera size={10} />Face
                        </span>
                      )}
                      {allPremises ? (
                        <span className="text-xs text-green-500 flex items-center gap-0.5">
                          <MapPin size={10} />In Premises
                        </span>
                      ) : (
                        <span className="text-xs text-red-500 flex items-center gap-0.5">
                          <ShieldOff size={10} />Off-premises
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock size={10} />
                        {record.timeIn ? formatTime(record.timeIn) : '—'}
                        {' → '}
                        {record.timeOut ? formatTime(record.timeOut) : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {record.totalHours ? (
                      <span className="text-sm font-bold text-gray-700">{record.totalHours.toFixed(2)}h</span>
                    ) : null}
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100 px-4 pb-4"
                  >
                    <div className="pt-3 grid grid-cols-2 gap-3">
                      {/* Clock In */}
                      <div className={`rounded-xl p-3 ${inPremises ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500 mb-1 font-medium">Clock In</p>
                        <p className={`font-bold ${inPremises ? 'text-green-700' : 'text-red-700'}`}>
                          {record.timeIn ? formatTime(record.timeIn) : 'N/A'}
                        </p>
                        <div className="mt-1.5 space-y-0.5">
                          {record.timeInFaceVerified && (
                            <p className="text-xs text-purple-600 flex items-center gap-1"><Camera size={10} /> Face verified</p>
                          )}
                          {inPremises ? (
                            <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={10} /> In premises</p>
                          ) : (
                            <p className="text-xs text-red-600 flex items-center gap-1"><ShieldOff size={10} /> Outside premises</p>
                          )}
                        </div>
                        {record.timeInPhoto && (
                          <button
                            onClick={() => setPhotoModal({ src: record.timeInPhoto!, label: 'Clock-In Face Capture' })}
                            className="mt-2 w-full"
                          >
                            <img
                              src={record.timeInPhoto}
                              alt="Clock-in face"
                              className="w-full h-16 object-cover rounded-lg border border-green-200"
                              style={{ transform: 'scaleX(-1)' }}
                            />
                            <p className="text-xs text-center text-gray-400 mt-1">Tap to enlarge</p>
                          </button>
                        )}
                      </div>

                      {/* Clock Out */}
                      <div className={`rounded-xl p-3 ${outPremises ? 'bg-orange-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500 mb-1 font-medium">Clock Out</p>
                        <p className={`font-bold ${outPremises ? 'text-orange-700' : 'text-red-700'}`}>
                          {record.timeOut ? formatTime(record.timeOut) : 'N/A'}
                        </p>
                        <div className="mt-1.5 space-y-0.5">
                          {record.timeOutFaceVerified && (
                            <p className="text-xs text-purple-600 flex items-center gap-1"><Camera size={10} /> Face verified</p>
                          )}
                          {record.timeOut && (outPremises ? (
                            <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={10} /> In premises</p>
                          ) : (
                            <p className="text-xs text-red-600 flex items-center gap-1"><ShieldOff size={10} /> Outside premises</p>
                          ))}
                        </div>
                        {record.timeOutPhoto && (
                          <button
                            onClick={() => setPhotoModal({ src: record.timeOutPhoto!, label: 'Clock-Out Face Capture' })}
                            className="mt-2 w-full"
                          >
                            <img
                              src={record.timeOutPhoto}
                              alt="Clock-out face"
                              className="w-full h-16 object-cover rounded-lg border border-orange-200"
                              style={{ transform: 'scaleX(-1)' }}
                            />
                            <p className="text-xs text-center text-gray-400 mt-1">Tap to enlarge</p>
                          </button>
                        )}
                      </div>
                    </div>

                    {record.totalHours && (
                      <div className="mt-3 bg-blue-50 rounded-xl p-3 flex justify-between items-center">
                        <span className="text-xs text-gray-500">Total Hours Rendered</span>
                        <span className="text-sm font-bold text-blue-700">{record.totalHours.toFixed(2)} hours</span>
                      </div>
                    )}

                    {!allPremises && (
                      <div className="mt-3 bg-red-50 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700">
                          <span className="font-semibold">Outside premises warning: </span>
                          This record indicates the trainee was not within the designated geofence zone during this attendance entry.
                        </p>
                      </div>
                    )}

                    {record.notes && (
                      <div className="mt-3 bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 font-medium">Notes</p>
                        <p className="text-xs text-gray-700 mt-0.5">{record.notes}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Photo Modal */}
      <AnimatePresence>
        {photoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setPhotoModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-white rounded-2xl overflow-hidden max-w-xs w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{photoModal.label}</p>
                <button onClick={() => setPhotoModal(null)} className="text-gray-400 text-xs">Close</button>
              </div>
              <img
                src={photoModal.src}
                alt={photoModal.label}
                className="w-full"
                style={{ transform: 'scaleX(-1)' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}