import { BarChart2, Download, Filter, Clock, Users, TrendingUp, Calendar, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

import { useApp } from '../../store/AppContext';
import { formatTime } from '../../utils/geo';


export function AdminReports() {
  const { employees, timeRecords } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedEmpId, setSelectedEmpId] = useState('all');

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { value: val, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
  });

  const filteredRecords = useMemo(() => {
    return timeRecords.filter((r) => {
      const matchMonth = r.date.startsWith(selectedMonth);
      const matchEmp = selectedEmpId === 'all' || r.employeeId === selectedEmpId;
      return matchMonth && matchEmp;
    });
  }, [timeRecords, selectedMonth, selectedEmpId]);

  // Daily chart data
  const dailyData = useMemo(() => {
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const recs = filteredRecords.filter((r) => r.date === dateStr);
      const totalHrs = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
      return {
        day: String(day),
        hours: parseFloat(totalHrs.toFixed(1)),
        present: recs.filter((r) => r.status === 'present' || r.status === 'overtime').length,
        late: recs.filter((r) => r.status === 'late').length,
      };
    });
  }, [filteredRecords, selectedMonth]);

  // Per-employee summary
  const employeeSummary = useMemo(() => {
    const activeEmps =
      selectedEmpId === 'all'
        ? employees.filter((e) => e.active)
        : employees.filter((e) => e.id === selectedEmpId && e.active);
    return activeEmps
      .map((emp) => {
        const recs = filteredRecords.filter((r) => r.employeeId === emp.id);
        const totalHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
        const present = recs.filter((r) => r.status === 'present' || r.status === 'overtime').length;
        const late = recs.filter((r) => r.status === 'late').length;
        const absent = Math.max(0, 22 - recs.length); // Approximate working days
        return { emp, totalHours, present, late, absent, records: recs };
      })
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredRecords, employees, selectedEmpId]);

  const totalHours = filteredRecords.reduce((s, r) => s + (r.totalHours || 0), 0);
  const presentCount = filteredRecords.filter((r) => r.status === 'present' || r.status === 'overtime').length;
  const lateCount = filteredRecords.filter((r) => r.status === 'late').length;
  const avgHoursPerDay = filteredRecords.length > 0 ? totalHours / filteredRecords.length : 0;

  const activeEmployees = employees.filter((e) => e.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Attendance Reports</h2>
          <p className="text-sm text-gray-500">Detailed time record analysis</p>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            <Printer size={15} />
            Print Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 no-print">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Calendar size={14} className="text-gray-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-sm text-gray-700 bg-transparent focus:outline-none"
          >
            {monthOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="text-sm text-gray-700 bg-transparent focus:outline-none"
          >
            <option value="all">All Trainees</option>
            {activeEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Hours',
            val: `${totalHours.toFixed(1)}h`,
            icon: <Clock size={16} className="text-blue-600" />,
            color: 'bg-blue-100',
          },
          {
            label: 'Present Days',
            val: presentCount,
            icon: <Users size={16} className="text-green-600" />,
            color: 'bg-green-100',
          },
          {
            label: 'Late Arrivals',
            val: lateCount,
            icon: <Clock size={16} className="text-orange-600" />,
            color: 'bg-orange-100',
          },
          {
            label: 'Avg Hrs/Day',
            val: `${avgHoursPerDay.toFixed(1)}h`,
            icon: <TrendingUp size={16} className="text-purple-600" />,
            color: 'bg-purple-100',
          },
        ].map(({ label, val, icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-xl font-bold text-gray-800 mt-0.5">{val}</p>
          </motion.div>
        ))}
      </div>

      {/* Daily Hours Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={18} className="text-blue-600" />
          <h3 className="font-bold text-gray-800">Daily Hours Rendered</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={dailyData}>
            <defs>
              <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(val: number) => [`${val}h`, 'Hours']}
            />
            <Area type="monotone" dataKey="hours" stroke="#3b82f6" fill="url(#hoursGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Attendance by Status Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-blue-600" />
          <h3 className="font-bold text-gray-800">Daily Attendance Count</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dailyData.filter((d) => d.present > 0 || d.late > 0)} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} />
            <Bar dataKey="present" fill="#22c55e" radius={[3, 3, 0, 0]} name="Present" />
            <Bar dataKey="late" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Late" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Employee Summary Table */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={16} className="text-blue-600" />
          <h3 className="font-bold text-gray-800">Trainee Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3 text-left">Trainee</th>
                <th className="px-4 py-3 text-center">Present</th>
                <th className="px-4 py-3 text-center">Late</th>
                <th className="px-4 py-3 text-center">Total Hours</th>
                <th className="px-4 py-3 text-left">Progress</th>
              </tr>
            </thead>
            <tbody>
              {employeeSummary.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                    No data for selected period
                  </td>
                </tr>
              ) : (
                employeeSummary.map(({ emp, totalHours, present, late }) => {
                  const prog = Math.min((totalHours / emp.requiredHours) * 100, 100);
                  return (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{emp.name}</p>
                            <p className="text-xs text-gray-400">{emp.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-green-700">{present}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-orange-600">{late}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-blue-700">{totalHours.toFixed(1)}h</span>
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${prog}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {Math.round(prog)}% of {emp.requiredHours}h
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detailed Records */}
      {filteredRecords.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Detailed Records ({filteredRecords.length})</h3>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Trainee</th>
                  <th className="px-4 py-2 text-center">Time In</th>
                  <th className="px-4 py-2 text-center">Time Out</th>
                  <th className="px-4 py-2 text-center">Hours</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-center">Verified</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((record) => {
                    const emp = employees.find((e) => e.id === record.employeeId);
                    return (
                      <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-600 text-xs whitespace-nowrap">
                          {new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-2">
                          <p className="font-medium text-gray-800 text-xs">{emp?.name || 'Unknown'}</p>
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-600">
                          {record.timeIn ? formatTime(record.timeIn) : '—'}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-600">
                          {record.timeOut ? formatTime(record.timeOut) : '—'}
                        </td>
                        <td className="px-4 py-2 text-center text-xs font-semibold text-blue-700">
                          {record.totalHours ? `${record.totalHours.toFixed(1)}h` : '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              record.status === 'present'
                                ? 'bg-green-100 text-green-700'
                                : record.status === 'late'
                                  ? 'bg-orange-100 text-orange-700'
                                  : record.status === 'overtime'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {record.timeInFaceVerified && (
                              <span title="Face Verified" className="text-purple-500">
                                👤
                              </span>
                            )}
                            {record.timeInGeofenced && (
                              <span title="Geofenced" className="text-green-500">
                                📍
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
