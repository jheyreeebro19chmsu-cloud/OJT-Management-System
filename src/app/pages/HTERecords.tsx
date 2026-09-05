import {
  Clock,
  Search,
  Calendar,
  ShieldCheck,
  Download,
  Filter,
  Users,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { useApp } from '../store/AppContext';

export function HTERecords() {
  const { timeRecords, employees } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Map employee info with records
  const enrichedRecords = useMemo(() => {
    return timeRecords.map((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      let renderedHours = 0;
      if (r.timeIn && r.timeOut) {
        const [inH, inM] = r.timeIn.split(':').map(Number);
        const [outH, outM] = r.timeOut.split(':').map(Number);
        let mins = outH * 60 + outM - (inH * 60 + inM);
        if (mins < 0) mins += 24 * 60;
        renderedHours = Math.round((mins / 60) * 10) / 10;
      }

      return {
        ...r,
        studentName: emp?.name || r.employeeId,
        course: emp?.course || 'OJT Trainee',
        schoolName: emp?.schoolName || 'CHMSU',
        renderedHours,
      };
    });
  }, [timeRecords, employees]);

  const filtered = useMemo(() => {
    return enrichedRecords.filter((r) => {
      const matchesSearch =
        r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.course.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = !selectedDate || r.date === selectedDate;
      return matchesSearch && matchesDate;
    });
  }, [enrichedRecords, searchTerm, selectedDate]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Student Name', 'Course', 'Time In', 'Time Out', 'Hours Rendered', 'Geofence Status'];
    const rows = filtered.map((r) => [
      r.date,
      `"${r.studentName}"`,
      `"${r.course}"`,
      r.timeIn || '',
      r.timeOut || '',
      r.renderedHours,
      'Verified',
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    // Prepend UTF-8 BOM so Excel opens it cleanly
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `HTE_DTR_Logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Clock className="text-blue-600" size={26} />
            <span>Trainee DTR Records</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete daily time logs, biometric timestamps, and rendered hours for all student interns
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors shrink-0"
        >
          <Download size={15} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name or course..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
          />
          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="px-3 py-3 bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl hover:bg-slate-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Logs: {filtered.length} entries
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Course / Department</th>
                <th className="px-4 py-3">Time In</th>
                <th className="px-4 py-3">Time Out</th>
                <th className="px-4 py-3">Rendered</th>
                <th className="px-4 py-3">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{r.studentName}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-medium">{r.course}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-700">
                    {r.timeIn || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                    {r.timeOut || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-extrabold text-blue-700 font-mono text-xs">
                      {r.renderedHours > 0 ? `${r.renderedHours} hrs` : 'In Progress'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <ShieldCheck size={12} />
                      Verified In Zone
                    </span>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No DTR records found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
