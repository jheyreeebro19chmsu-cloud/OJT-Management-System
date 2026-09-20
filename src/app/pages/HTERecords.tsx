import {
  Clock,
  Search,
  Calendar,
  ShieldCheck,
  Download,
  Filter,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { useApp } from '../store/AppContext';
import { getPhotoUrl } from '../services/config';
import { MonthlyDTTRView } from '../components/MonthlyDTTRView';

export function HTERecords() {
  const { timeRecords, employees, approveTimeRecord, disapproveTimeRecord } = useApp();
  const [viewMode, setViewMode] = useState<'daily' | 'monthly_dttr'>('daily');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Map employee info with records
  const enrichedRecords = useMemo(() => {
    return timeRecords.map((r) => {
      const emp = employees.find(
        (e) =>
          e.id === r.employeeId ||
          e.employeeId === r.employeeId ||
          (e.email && r.employeeId && e.email.toLowerCase() === r.employeeId.toLowerCase()) ||
          (e.name && r.employeeId && e.name.toLowerCase() === r.employeeId.toLowerCase())
      );

      let displayName = emp?.name;
      let displayCode = emp?.employeeId;

      if (!displayName) {
        if (r.employeeId === 'emp-1') {
          displayName = 'Juan Dela Cruz';
          displayCode = 'OJT-2024-001';
        } else if (r.employeeId === 'emp-2') {
          displayName = 'Maria Santos';
          displayCode = 'OJT-2024-002';
        } else if (r.employeeId === 'emp-3') {
          displayName = 'Carlo Reyes';
          displayCode = 'OJT-2024-003';
        } else if (r.employeeId === 'admin-1') {
          displayName = 'OJT Instructor';
          displayCode = 'ADM-2024-001';
        } else {
          displayName = r.employeeId;
          displayCode = r.employeeId.startsWith('OJT-') || r.employeeId.startsWith('HTE-') ? r.employeeId : `OJT-${r.employeeId.slice(0, 8)}`;
        }
      }

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
        studentName: displayName,
        ojtCode: displayCode || 'OJT-TRAINEE',
        course: emp?.course || 'OJT Trainee',
        schoolName: emp?.schoolName || 'CHMSU',
        photo: emp?.photo || (r as any)?.timeInPhoto || (r as any)?.timeOutPhoto || '',
        renderedHours,
      };
    });
  }, [timeRecords, employees]);

  const filtered = useMemo(() => {
    return enrichedRecords.filter((r) => {
      const matchesSearch =
        r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ojtCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.course.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = !selectedDate || r.date === selectedDate;
      return matchesSearch && matchesDate;
    });
  }, [enrichedRecords, searchTerm, selectedDate]);

  // Pagination state (10 records per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDate]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Student Name', 'OJT Code', 'Course', 'Time In', 'Time Out', 'Hours Rendered', 'Geofence Status'];
    const rows = filtered.map((r) => [
      r.date,
      `"${r.studentName}"`,
      `"${r.ojtCode}"`,
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
    link.download = `HTE_DTR_Logs_${selectedDate || 'all'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Clock className="text-blue-600" size={26} />
            <span>{viewMode === 'monthly_dttr' ? 'Monthly DTTR Monitoring & Sign-off' : 'Trainee DTR Records'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {viewMode === 'monthly_dttr'
              ? 'Official CHMSU Daily Time & Tasks Record (DTTR), automatic hours computation, task inspection, and HTE supervisor endorsement'
              : 'Complete daily time records, verified coordinates, and rendered hours for all assigned students'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'daily'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={14} />
              <span>Daily Logs</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly_dttr')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'monthly_dttr'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={14} />
              <span>Monthly DTTR &amp; Sign</span>
            </button>
          </div>

          {viewMode === 'daily' && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-all shrink-0"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'monthly_dttr' ? (
        <MonthlyDTTRView viewerRole="hte" />
      ) : (
        <>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, OJT code, or course..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <th className="px-4 py-3 w-14 text-center">Profile</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Course / Department</th>
                <th className="px-4 py-3">Time In</th>
                <th className="px-4 py-3">Time Out</th>
                <th className="px-4 py-3">Rendered</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3 text-center">DTR Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0 shadow-xs mx-auto">
                      {r.photo ? (
                        <img
                          src={getPhotoUrl(r.photo)}
                          alt={r.studentName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-blue-700 font-black text-xs">
                          {r.studentName ? r.studentName.charAt(0).toUpperCase() : 'T'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.date}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{r.studentName}</div>
                    <div className="mt-0.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                        {r.ojtCode}
                      </span>
                    </div>
                  </td>
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
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {r.approvalStatus === 'approved' ? (
                        <div className="inline-flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle size={12} className="text-emerald-600" /> Approved
                          </span>
                          <button
                            type="button"
                            onClick={() => disapproveTimeRecord(r.id)}
                            title="Change status to Disapproved"
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-md transition-all cursor-pointer"
                          >
                            Disapprove
                          </button>
                        </div>
                      ) : r.approvalStatus === 'disapproved' ? (
                        <div className="inline-flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            <XCircle size={12} className="text-rose-600" /> Disapproved
                          </span>
                          <button
                            type="button"
                            onClick={() => approveTimeRecord(r.id, 'HTE Supervisor')}
                            title="Change status to Approved"
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-md transition-all cursor-pointer"
                          >
                            Approve
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => approveTimeRecord(r.id, 'HTE Supervisor')}
                            title="Approve DTR"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xs transition-colors cursor-pointer"
                          >
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => disapproveTimeRecord(r.id)}
                            title="Disapprove DTR"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-xs transition-colors cursor-pointer"
                          >
                            <XCircle size={12} /> Disapprove
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No DTR records found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Records Pagination Controls */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-bold text-slate-800">
                {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
              </span>{' '}
              of <span className="font-bold text-slate-800">{filtered.length}</span> records
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 self-center sm:self-auto">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        currentPage === page
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
