import {
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Camera,
  ChevronRight,
  Bell,
  Info,
  X,
  Megaphone,
  User,
  Building,
  Loader,
  Plus,
  Link as LinkIcon,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { sendWelcomeEmail } from '../lib/resend';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { Announcement, Employee } from '../types';
import { formatTime } from '../utils/geo';


const ANN_COLORS: Record<Announcement['type'], { bg: string; border: string; icon: string; iconBg: string }> = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', iconBg: 'bg-blue-100' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', iconBg: 'bg-amber-100' },
  success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', iconBg: 'bg-green-100' },
  urgent: { bg: 'bg-red-50', border: 'border-red-300', icon: 'text-red-600', iconBg: 'bg-red-100' },
};

const ANN_ICON: Record<Announcement['type'], React.ReactNode> = {
  info: <Info size={14} />,
  warning: <AlertTriangle size={14} />,
  success: <CheckCircle size={14} />,
  urgent: <Bell size={14} />,
};

export function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, getCurrentEmployee, getTodayRecord, getEmployeeRecords, settings, getActiveAnnouncements } =
    useApp();
  const employee = getCurrentEmployee();
  const isAdmin = currentUser?.role === 'admin';
  
  // HTE/Instructor Dashboard Metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [linkedStudents, setLinkedStudents] = useState<any[]>([]);
  const [searchId, setSearchId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  
  // Original Dashboard State (for non-admin/students)
  const displayName = employee?.name || currentUser?.name || (isAdmin ? 'OJT Instructor' : 'Trainee');
  const displayId = employee?.employeeId || (isAdmin ? 'ADMIN' : '');
  const todayRecord = employee ? getTodayRecord(employee.id) : null;
  const allRecords = employee ? getEmployeeRecords(employee.id) : [];
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dismissedAnn, setDismissedAnn] = useState<Set<string>>(new Set());
  const [pendingApps, setPendingApps] = useState<Employee[]>([]);
  const [hteRequests, setHteRequests] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load instructor dashboard metrics
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const loadInstructorMetrics = async () => {
      setLoading(true);
      setDashboardError(null);

      try {
        // Get all students assigned to this instructor
        const { data: students } = await supabase
          .from('employees')
          .select('*')
          .eq('instructor_id', currentUser?.id);

        // Calculate metrics
        const totalApplications = students?.length || 0;
        const approved = students?.filter((s: any) => s.application_status === 'approved').length || 0;
        const pending = students?.filter((s: any) => s.application_status === 'pending').length || 0;
        const rejected = students?.filter((s: any) => s.application_status === 'rejected').length || 0;
        const completed = students?.filter((s: any) => s.application_status === 'completed').length || 0;
        const cancelled = students?.filter((s: any) => s.application_status === 'cancelled').length || 0;

        // Get time records
        const { data: timeRecords } = await supabase
          .from('time_records')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        // Calculate hours
        let totalRenderedHours = 0;
        let totalRequiredHours = 0;
        if (students) {
          totalRequiredHours = students.reduce((sum: number, s: any) => sum + (s.required_hours || 486), 0);
          // Calculate from time records
          if (timeRecords) {
            totalRenderedHours = timeRecords.reduce((sum: number, r: any) => sum + (r.hours_rendered || 0), 0);
          }
        }

        setMetrics({
          total_applications: totalApplications,
          status_counts: {
            pending,
            approved,
            rejected,
            completed,
            cancelled,
          },
          total_required_hours: totalRequiredHours,
          total_rendered_hours: totalRenderedHours,
          total_remaining_hours: Math.max(0, totalRequiredHours - totalRenderedHours),
          unique_students: totalApplications,
        });

        // Format recent records for display
        const formattedRecords = (timeRecords || []).map((r: any) => ({
          id: r.id,
          student_name: r.employee_name || 'Unknown',
          date: r.created_at,
          hours_rendered: r.hours_rendered || 0,
          is_approved: r.is_approved || false,
        }));
        setRecentRecords(formattedRecords);
      } catch (error: any) {
        console.error('Error loading instructor metrics:', error);
        setDashboardError(error.message || 'Failed to load dashboard metrics');
      }

      setLoading(false);
      fetchLinkedStudents();
    };

    loadInstructorMetrics();
  }, [isAdmin, currentUser?.id]);

  const fetchLinkedStudents = async () => {
    if (!isAdmin) return;

    try {
      const { data } = await supabase
        .from('hte_student_access')
        .select('*, employees(*)')
        .eq('instructor_id', currentUser?.id);

      if (data) setLinkedStudents(data);
    } catch (error) {
      console.error('Error fetching linked students:', error);
    }
  };

  const handleLinkStudent = async () => {
    if (!searchId.trim()) return;
    setIsLinking(true);

    try {
      const { data: student } = await supabase.from('employees').select('id').eq('id', searchId).single();

      if (!student) {
        toast.error('Student ID not found');
        return;
      }

      const { error } = await supabase.from('hte_student_access').insert({
        instructor_id: currentUser?.id,
        student_id: student.id,
        status: 'pending',
      });

      if (error) throw error;

      toast.success('Student linked successfully');
      setSearchId('');
      fetchLinkedStudents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to link student');
    } finally {
      setIsLinking(false);
    }
  };

  // Fetch pending apps and HTE requests for non-HTE display
  useEffect(() => {
    if (isAdmin) {
      const fetchPending = async () => {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('instructor_id', currentUser?.id)
          .eq('application_status', 'pending');
        if (data) setPendingApps(data);
      };

      const fetchHteRequests = async () => {
        const { data } = await supabase
          .from('hte_student_access')
          .select('*, host_supervisors(*), employees!inner(*)')
          .eq('employees.instructor_id', currentUser?.id)
          .in('status', ['pending', 'approved'])
          .order('created_at', { ascending: false });
        if (data) setHteRequests(data);
      };

      fetchPending();
      fetchHteRequests();
    }
  }, [isAdmin, currentUser]);

  const handleApproveHte = async (request: any) => {
    setProcessingId(request.id);
    try {
      const { error } = await supabase
        .from('hte_student_access')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', request.id);
      if (error) throw error;
      setHteRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: 'approved' } : r)));
      toast.success('HTE access approved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (student: Employee) => {
    setProcessingId(student.id);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ application_status: 'approved' })
        .eq('id', student.id);
      if (error) throw error;

      setPendingApps((prev) => prev.filter((a) => a.id !== student.id));

      // Notify student via Resend
      await sendWelcomeEmail(student.email, student.name);
      toast.success('Application approved! Student notified.');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (student: Employee) => {
    setProcessingId(student.id);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ application_status: 'rejected' })
        .eq('id', student.id);
      if (error) throw error;

      setPendingApps((prev) => prev.filter((a) => a.id !== student.id));
      toast.success('Application rejected.');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectHte = async (request: any) => {
    setProcessingId(request.id);
    try {
      const { error } = await supabase.from('hte_student_access').update({ status: 'rejected' }).eq('id', request.id);
      if (error) throw error;
      setHteRequests((prev) => prev.filter((r) => r.id !== request.id));
      toast.success('HTE access rejected');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const activeAnnouncements = getActiveAnnouncements(isAdmin ? 'admin' : 'employee').filter(
    (a) => !dismissedAnn.has(a.id)
  );

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalHoursRendered = allRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0);
  const requiredHours = employee?.requiredHours ?? (isAdmin ? 0 : 486);
  const hoursProgress = requiredHours > 0 ? Math.min((totalHoursRendered / requiredHours) * 100, 100) : 0;
  const presentDays = allRecords.filter((r) => r.status === 'present' || r.status === 'overtime').length;
  const lateDays = allRecords.filter((r) => r.status === 'late').length;
  const recentRecordsEmployee = allRecords.slice(0, 5);

  const greeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const timeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const statusColor = () => {
    if (!todayRecord) return 'from-gray-500 to-gray-600';
    if (todayRecord.timeIn && todayRecord.timeOut) return 'from-green-500 to-emerald-600';
    if (todayRecord.timeIn) return 'from-sky-500 to-blue-600';
    return 'from-orange-400 to-orange-500';
  };

  const todayStatus = () => {
    if (!todayRecord) return { label: 'Not Clocked In', color: 'text-gray-500 bg-gray-100' };
    if (todayRecord.timeIn && todayRecord.timeOut) return { label: 'Completed', color: 'text-green-700 bg-green-100' };
    if (todayRecord.timeIn)
      return {
        label: todayRecord.status === 'late' ? 'Clocked In (Late)' : 'Clocked In',
        color: todayRecord.status === 'late' ? 'text-orange-700 bg-orange-100' : 'text-sky-700 bg-sky-100',
      };
    return { label: 'Absent', color: 'text-red-700 bg-red-100' };
  };

  // ── INSTRUCTOR DASHBOARD (HTE-style) ──
  if (isAdmin) {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      );
    }

    if (dashboardError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-red-900">Error Loading Dashboard</h3>
              <p className="text-red-700 text-sm mt-1">{dashboardError}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Monitor student attendance, hours, and approvals</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.total_applications || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.status_counts.approved || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <Clock className="text-amber-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.status_counts.pending || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Users className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">HTE Linked</p>
                <p className="text-2xl font-bold text-gray-900">{linkedStudents.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hours Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Required Hours</p>
                <p className="text-4xl font-bold mt-2">{metrics?.total_required_hours || 0}</p>
              </div>
              <Clock className="w-12 h-12 text-blue-300 opacity-30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Total Rendered Hours</p>
                <p className="text-4xl font-bold mt-2">{metrics?.total_rendered_hours || 0}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-green-300 opacity-30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Remaining Hours</p>
                <p className="text-4xl font-bold mt-2">{metrics?.total_remaining_hours || 0}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-orange-300 opacity-30" />
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Student Status Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Pending', count: metrics?.status_counts.pending, color: 'bg-yellow-100 text-yellow-800' },
              { label: 'Approved', count: metrics?.status_counts.approved, color: 'bg-green-100 text-green-800' },
              { label: 'Rejected', count: metrics?.status_counts.rejected, color: 'bg-red-100 text-red-800' },
              { label: 'Completed', count: metrics?.status_counts.completed, color: 'bg-blue-100 text-blue-800' },
              { label: 'Cancelled', count: metrics?.status_counts.cancelled, color: 'bg-gray-100 text-gray-800' },
            ].map((status) => (
              <div key={status.label} className={`p-4 rounded-lg ${status.color}`}>
                <p className="text-sm font-semibold">{status.count}</p>
                <p className="text-xs mt-1">{status.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Linked Students Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">HTE Linked Students</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {linkedStudents.map((link) => (
              <div key={link.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800">{link.employees?.name}</p>
                    <p className="text-xs text-gray-500">{link.employees?.course}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                      link.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : link.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {link.status}
                  </span>
                </div>
              </div>
            ))}
            {linkedStudents.length === 0 && (
              <div className="col-span-full py-10 text-center text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-20" />
                <p>No HTE students linked yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Time Records */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Recent Time Records</h3>
            <p className="text-sm text-gray-600 mt-1">Last entries from your students</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase">
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Hours</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentRecords.length > 0 ? (
                  recentRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{record.student_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.hours_rendered.toFixed(2)}h</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {record.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No time records yet
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

  // ── NON-INSTRUCTOR DASHBOARD ──
  return (
    <div className="space-y-4">
      {/* Announcements */}
      <AnimatePresence>
        {activeAnnouncements.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            {activeAnnouncements.slice(0, 3).map((ann) => {
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
                        {new Date(ann.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                        {ann.createdBy}
                      </p>
                    </div>
                    {!ann.isPinned && (
                      <button
                        onClick={() => setDismissedAnn((prev) => new Set([...prev, ann.id]))}
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
              Open announcements, notices, and updates
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

      {/* Instructor: Pending Applications */}
      {isAdmin && pendingApps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <User size={18} className="text-amber-600" />
                </div>
                <h3 className="font-bold text-gray-800">Pending OJT Applications</h3>
              </div>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">
                {pendingApps.length} New
              </span>
            </div>

            <div className="space-y-4">
              {pendingApps.map((app) => (
                <div key={app.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">{app.name}</p>
                      <p className="text-xs text-gray-500">{(app as any).year_section || 'No Section'}</p>
                      <p className="text-xs text-blue-600 mt-1 font-medium">{app.companyName}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(app)}
                        disabled={!!processingId}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(app)}
                        disabled={!!processingId}
                        className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Instructor: HTE Access Requests */}
      {isAdmin && hteRequests.some((req) => req.status === 'pending') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building size={18} className="text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-800">HTE Access Requests</h3>
              </div>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                {hteRequests.length} New
              </span>
            </div>

            <div className="space-y-4">
                {hteRequests.filter((req) => req.status === 'pending').map((req) => (
                <div key={req.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                        {req.host_supervisors?.company_name}
                      </p>
                      <p className="font-bold text-gray-800 mt-1">
                        {req.host_supervisors?.name}{' '}
                        <span className="font-normal text-gray-400">requests access to</span> {req.employees?.name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveHte(req)}
                        disabled={!!processingId}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectHte(req)}
                        disabled={!!processingId}
                        className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Instructor: OJT assigned to an HTE */}
      {isAdmin && hteRequests.some((req) => req.status === 'approved') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Building size={18} className="text-green-600" />
                </div>
                <h3 className="font-bold text-gray-800">OJT Assigned to HTE</h3>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                {hteRequests.filter((req) => req.status === 'approved').length} Assigned
              </span>
            </div>
            <div className="space-y-3">
              {hteRequests
                .filter((req) => req.status === 'approved')
                .map((req) => (
                  <div key={req.id} className="p-4 rounded-2xl bg-green-50 border border-green-100">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-800">{req.employees?.name || 'Unknown OJT'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {req.employees?.employeeId || req.employees?.employee_id || 'No student ID'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-green-700">{req.host_supervisors?.company_name || 'HTE'}</p>
                        <p className="text-xs text-gray-500 mt-1">{req.host_supervisors?.name || 'HTE representative'}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </motion.div>
      )}

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
                {!todayRecord?.timeIn
                  ? 'Clock In Now'
                  : !todayRecord?.timeOut
                    ? 'Clock Out Now'
                    : "View Today's Record"}
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
      >
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
          <span className="text-xs text-gray-500">{requiredHours > 0 ? `${requiredHours} hrs required` : 'N/A'}</span>
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
      >
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              <h3 className="font-semibold text-gray-800 text-sm">Recent Records</h3>
            </div>
            <Link to="/app/records" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(record.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                    {record.timeIn && <span>In: {formatTime(record.timeIn)}</span>}
                    {record.timeOut && <span>Out: {formatTime(record.timeOut)}</span>}
                    {record.totalHours && (
                      <span className="text-blue-500 font-medium">{record.totalHours.toFixed(1)}h</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      record.status === 'present'
                        ? 'bg-green-100 text-green-700'
                        : record.status === 'late'
                          ? 'bg-orange-100 text-orange-700'
                          : record.status === 'absent'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                    }`}
                  >
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
