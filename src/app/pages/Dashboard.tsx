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
  FileCheck,
  FileText,
  Shield,
  Eye,
  Upload,
  Download,
  Printer,
  Check,
  RefreshCw,
  Star,
  Award,
  ThumbsUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { sendWelcomeEmail } from '../lib/resend';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { Announcement, Employee, TraineeDocuments, TraineeDocumentItem } from '../types';
import { formatTime } from '../utils/geo';
import { getPhotoUrl } from '../services/config';
import { transformSupabaseEmployee } from '../services/supabaseService';
import { STANDARD_REQUIRED_DOCS } from './Documents';


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
  const {
    currentUser,
    getCurrentEmployee,
    getTodayRecord,
    getEmployeeRecords,
    settings,
    getActiveAnnouncements,
    employees,
    timeRecords: contextTimeRecords,
    evaluations,
    hostFeedback,
    updateEmployee,
  } = useApp();
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
  const currentEmp = employee || getCurrentEmployee();
  const empLookupId = currentEmp?.id || currentEmp?.employeeId || currentUser?.employeeId || currentUser?.id || '';
  const displayName = currentEmp?.name || currentUser?.name || (isAdmin ? 'OJT Instructor' : 'Trainee');
  const displayId = currentEmp?.employeeId || (isAdmin ? 'ADMIN' : '');
  const todayRecord = empLookupId ? getTodayRecord(empLookupId) : null;
  const allRecords = empLookupId ? getEmployeeRecords(empLookupId) : [];
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dismissedAnn, setDismissedAnn] = useState<Set<string>>(new Set());
  const [pendingApps, setPendingApps] = useState<Employee[]>([]);
  const [hteRequests, setHteRequests] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Trainee Required Documents state
  const [dashboardPreviewDoc, setDashboardPreviewDoc] = useState<any | null>(null);
  const [dashboardUploadingKey, setDashboardUploadingKey] = useState<string | null>(null);
  const [previewEvaluation, setPreviewEvaluation] = useState<any | null>(null);

  const submittedDocs: TraineeDocuments = currentEmp?.submittedDocuments || {};
  const docKeys: (keyof TraineeDocuments)[] = ['endorsement', 'consent', 'medical', 'resume'];
  const uploadedDocsCount = docKeys.filter((k) => Boolean(submittedDocs[k]?.dataUrl || submittedDocs[k]?.name)).length;
  const missingDocsCount = 4 - uploadedDocsCount;
  const isAllDocsPassed = uploadedDocsCount === 4;
  const docsProgressPercent = Math.round((uploadedDocsCount / 4) * 100);

  const handleDashboardDocUpload = (docKey: keyof TraineeDocuments, file: File | null) => {
    if (!file || !currentEmp) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setDashboardUploadingKey(docKey);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const currentDocs: TraineeDocuments = currentEmp.submittedDocuments || {};
      const newDocItem: TraineeDocumentItem = {
        name: file.name,
        size: file.size,
        dataUrl,
        fileType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        status: 'passed',
      };

      const updatedDocs: TraineeDocuments = {
        ...currentDocs,
        [docKey]: newDocItem,
      };

      const newUploadedCount = docKeys.filter((k) => Boolean(updatedDocs[k]?.dataUrl || updatedDocs[k]?.name)).length;
      const newIsAllPassed = newUploadedCount === 4;

      updateEmployee(currentEmp.id, {
        submittedDocuments: updatedDocs,
        documentsPassed: newIsAllPassed,
        documentsStatus: newIsAllPassed ? 'passed' : 'partial',
      });

      setDashboardUploadingKey(null);
      const meta = STANDARD_REQUIRED_DOCS.find((d) => d.key === docKey);
      toast.success(`${meta?.title || 'Document'} submitted & marked as PASSED!`);
    };

    reader.onerror = () => {
      setDashboardUploadingKey(null);
      toast.error('Failed to read file. Please try again.');
    };

    reader.readAsDataURL(file);
  };

  // Load instructor dashboard metrics
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const loadInstructorMetrics = async () => {
      setLoading(true);
      setDashboardError(null);

      const activeAY = settings.activeAcademicYear || '2026-2027';
      const defaultAY = settings.academicYears?.[0] || '2025-2026';

      // Student trainees strictly in the active academic year
      const studentEmployees = employees.filter(
        (e) =>
          e.position !== 'OJT Instructor' &&
          e.position !== 'HTE Representative' &&
          !e.employeeId?.startsWith('ADM-') &&
          !e.employeeId?.startsWith('HTE-') &&
          (e.academicYear === activeAY || (!e.academicYear && activeAY === defaultAY))
      );

      try {
        const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
        let query = supabase
          .from('employees')
          .select('*')
          .neq('position', 'OJT Instructor')
          .neq('position', 'HTE Representative')
          .eq('academic_year', activeAY);
        if (currentUser?.id && isUuid(currentUser.id)) {
          query = query.or(`instructor_id.eq.${currentUser.id},instructor_id.is.null`);
        }
        const { data: rawStudents } = await query;
        
        // Merge Supabase employees and context student employees
        const mergedStudentsMap = new Map<string, any>();
        studentEmployees.forEach((emp) => {
          mergedStudentsMap.set(emp.id, emp);
          if (emp.employeeId) mergedStudentsMap.set(emp.employeeId, emp);
        });

        if (rawStudents && rawStudents.length > 0) {
          rawStudents.forEach((rs: any) => {
            const key = rs.id || rs.employee_id;
            const existing = mergedStudentsMap.get(rs.id) || (rs.employee_id ? mergedStudentsMap.get(rs.employee_id) : undefined);
            const unified = {
              id: rs.id,
              name: rs.name || `${rs.first_name || ''} ${rs.last_name || ''}`.trim() || rs.email || 'Student Trainee',
              email: rs.email || '',
              employeeId: rs.employee_id || rs.employeeId || 'OJT-TRAINEE',
              department: rs.department || '',
              course: rs.course || rs.department || 'OJT Trainee',
              position: rs.position || 'OJT Trainee',
              photo: rs.photo || rs.face_photo_url || rs.avatar_url || existing?.photo,
              startDate: rs.start_date || rs.created_at || existing?.startDate,
              active: rs.active !== false,
              approvalStatus: rs.approval_status || rs.application_status || 'approved',
              requiredHours: Number(rs.required_hours || rs.requiredHours) || 486,
            };
            mergedStudentsMap.set(unified.id, unified);
            if (unified.employeeId) mergedStudentsMap.set(unified.employeeId, unified);
          });
        }

        const allStudentsList: any[] = Array.from(new Set(Array.from(mergedStudentsMap.values())));

        // Calculate metrics
        const totalApplications = allStudentsList.length;
        const approved = allStudentsList.filter((s: any) => s.applicationStatus === 'approved' || s.approval_status === 'approved' || s.active !== false).length;
        const pending = allStudentsList.filter((s: any) => s.applicationStatus === 'pending' || s.approval_status === 'pending').length;
        const rejected = allStudentsList.filter((s: any) => s.applicationStatus === 'rejected' || s.approval_status === 'rejected').length;
        const completed = allStudentsList.filter((s: any) => s.applicationStatus === 'completed').length;
        const cancelled = allStudentsList.filter((s: any) => s.applicationStatus === 'cancelled').length;

        // Get time records
        const { data: rawTimeRecords } = await supabase
          .from('time_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(50);

        const timeRecords = (rawTimeRecords && rawTimeRecords.length > 0) ? rawTimeRecords : contextTimeRecords;

        // Calculate hours
        let totalRenderedHours = 0;
        let totalRequiredHours = allStudentsList.reduce((sum: number, s: any) => sum + (Number(s.requiredHours || s.required_hours) || 486), 0);
        if (timeRecords) {
          totalRenderedHours = timeRecords.reduce((sum: number, r: any) => sum + (Number(r.total_hours || r.totalHours || r.hours_rendered) || 0), 0);
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

        // 1. Build records for students who have logged time records
        const studentTimeLogs = (timeRecords || []).map((r: any) => {
          const empId = r.employee_id || r.employeeId;
          const emp = allStudentsList.find((e) => e.id === empId || e.employeeId === empId || (e.email && empId && e.email.toLowerCase() === empId.toLowerCase()));
          const totalHours = Number(r.total_hours || r.totalHours || r.hours_rendered || 0);
          return {
            id: r.id,
            student_name: emp?.name || r.employee_name || r.employeeName || 'Student Trainee',
            student_id: emp?.employeeId || empId || 'OJT-TRAINEE',
            photo: emp?.photo || r.photo,
            course: emp?.course || emp?.department || 'OJT Trainee',
            date: r.date || (r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            hours_rendered: totalHours,
            is_approved: r.approval_status === 'approved' || r.approvalStatus === 'approved' || r.is_approved || r.status === 'present',
            status: r.status === 'present' ? 'Present' : r.status === 'late' ? 'Late' : (r.approval_status === 'approved' || r.approvalStatus === 'approved' ? 'Approved' : 'Pending'),
          };
        });

        // 2. Build rows for enrolled students who haven't clocked in yet so EVERY student is visible!
        const studentsWithLogs = new Set(studentTimeLogs.map((l: any) => l.student_id).concat(studentTimeLogs.map((l: any) => l.student_name)));
        const enrolledWithoutLogs = allStudentsList
          .filter((s) => !studentsWithLogs.has(s.employeeId) && !studentsWithLogs.has(s.name))
          .map((s) => ({
            id: `enrolled-${s.id}`,
            student_name: s.name,
            student_id: s.employeeId || 'OJT-TRAINEE',
            photo: s.photo,
            course: s.course || s.department || 'OJT Trainee',
            date: s.startDate || 'No clock-in yet',
            hours_rendered: 0,
            is_approved: s.active && s.approvalStatus !== 'pending',
            status: s.active && s.approvalStatus !== 'pending' ? 'Active / Enrolled' : 'Pending Approval',
          }));

        const allStudentEntries = [...studentTimeLogs, ...enrolledWithoutLogs];
        setRecentRecords(allStudentEntries);
        setLoading(false);
        fetchLinkedStudents();
        return;
      } catch (error: any) {
        console.warn('Supabase metric query warning, using active AY context metrics:', error);
      }

      // Context fallback
      const allStudents = studentEmployees;
      const approvedCount = allStudents.filter((e) => e.active && e.approvalStatus !== 'pending').length;
      const pendingCount = allStudents.filter((e) => !e.active || e.approvalStatus === 'pending').length;
      const totalReq = allStudents.reduce((sum, e) => sum + (e.requiredHours || 486), 0);
      const activeIds = new Set(allStudents.map((e) => e.id).concat(allStudents.map((e) => e.employeeId)));
      const activeTimeRecs = contextTimeRecords.filter((r) => activeIds.has(r.employeeId));
      const totalRendered = activeTimeRecs.reduce((sum, r) => sum + (r.totalHours || 0), 0);

      setMetrics({
        total_applications: allStudents.length,
        status_counts: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: 0,
          completed: 0,
          cancelled: 0,
        },
        total_required_hours: totalReq,
        total_rendered_hours: totalRendered,
        total_remaining_hours: Math.max(0, totalReq - totalRendered),
        unique_students: allStudents.length,
      });

      const formatted = activeTimeRecs.slice(0, 20).map((r) => {
        const emp = allStudents.find((e) => e.id === r.employeeId || e.employeeId === r.employeeId);
        return {
          id: r.id,
          student_name: emp?.name || 'Student Trainee',
          student_id: emp?.employeeId || r.employeeId || 'OJT-TRAINEE',
          photo: emp?.photo,
          course: emp?.course || emp?.department || 'OJT Trainee',
          date: r.date,
          hours_rendered: r.totalHours || 0,
          is_approved: r.approvalStatus === 'approved' || r.status === 'present',
          status: r.status === 'present' ? 'Present' : r.status === 'late' ? 'Late' : (r.approvalStatus === 'approved' ? 'Approved' : 'Pending'),
        };
      });

      const seenStudents = new Set(formatted.map((f) => f.student_id).concat(formatted.map((f) => f.student_name)));
      const noLogStudents = allStudents
        .filter((s) => !seenStudents.has(s.employeeId) && !seenStudents.has(s.name))
        .map((s) => ({
          id: `enrolled-${s.id}`,
          student_name: s.name,
          student_id: s.employeeId || 'OJT-TRAINEE',
          photo: s.photo,
          course: s.course || s.department || 'OJT Trainee',
          date: s.startDate || 'No clock-in yet',
          hours_rendered: 0,
          is_approved: s.active && s.approvalStatus !== 'pending',
          status: s.active && s.approvalStatus !== 'pending' ? 'Active / Enrolled' : 'Pending Approval',
        }));

      setRecentRecords([...formatted, ...noLogStudents]);
      setLoading(false);
    };

    loadInstructorMetrics();
  }, [isAdmin, currentUser?.id, employees, contextTimeRecords, settings.activeAcademicYear]);

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
    const queryTerm = searchId.trim();
    if (!queryTerm) return;
    setIsLinking(true);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queryTerm);
      let query = supabase.from('employees').select('*');
      if (isUuid) {
        query = query.or(`id.eq.${queryTerm},employee_id.ilike.%${queryTerm}%`);
      } else {
        query = query.or(`employee_id.ilike.%${queryTerm}%,email.ilike.%${queryTerm}%,name.ilike.%${queryTerm}%`);
      }
      const { data: students, error: sErr } = await query.limit(1);

      if (sErr || !students || students.length === 0) {
        toast.error('Student not found by ID, email, or name.');
        return;
      }

      const student = students[0];
      const instructorUuid = currentUser?.id;

      // Update instructor_id in Supabase employees table
      const { error: linkErr } = await supabase
        .from('employees')
        .update({
          instructor_id: instructorUuid,
          linked_at: new Date().toISOString(),
        })
        .eq('id', student.id);

      if (linkErr) throw linkErr;

      updateEmployee(student.id, {
        instructorId: instructorUuid,
        linkedAt: new Date().toISOString(),
      });

      toast.success(`${student.name} linked successfully!`);
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
          .or(`instructor_id.eq.${currentUser?.id},instructor_id.is.null`)
          .eq('application_status', 'pending');
        if (data) setPendingApps(data.map(transformSupabaseEmployee));
      };

      const fetchHteRequests = async () => {
        try {
          const { data, error } = await supabase
            .from('hte_student_access')
            .select('*, host_supervisors(*), employees!inner(*)')
            .eq('employees.instructor_id', currentUser?.id)
            .in('status', ['pending', 'approved'])
            .order('created_at', { ascending: false });
          if (!error && data) setHteRequests(data);
        } catch {
          // Table may not yet be created in Supabase
        }
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
        .update({
          application_status: 'approved',
          active: true,
          instructor_id: currentUser?.id || student.instructorId || null,
        })
        .eq('id', student.id);
      if (error) throw error;

      updateEmployee(student.id, {
        active: true,
        approvalStatus: 'approved',
        applicationStatus: 'approved',
        instructorId: currentUser?.id || student.instructorId,
        linkedAt: new Date().toISOString(),
      });

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

  const traineeEvaluation = evaluations.find(
    (ev) => ev.employeeId === currentEmp?.id || ev.employeeId === currentEmp?.employeeId
  );
  const traineeHostFeedback = hostFeedback.find(
    (hf) => hf.employeeId === currentEmp?.id || hf.employeeId === currentEmp?.employeeId
  );
  const matchedHteRep = employees.find(
    (e) =>
      (e.position === 'HTE Representative' || e.position === 'Training Supervisor') &&
      ((currentEmp?.hteId && e.id === currentEmp.hteId) ||
        (currentEmp?.companyName && e.companyName?.trim().toLowerCase() === currentEmp.companyName.trim().toLowerCase()))
  );
  const hteCompanyName = currentEmp?.companyName || matchedHteRep?.companyName || 'Host Training Establishment';
  const hteSupervisorName = currentEmp?.supervisorName || matchedHteRep?.name || 'HTE Representative';

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
    const currentH = currentTime.getHours();
    const currentM = currentTime.getMinutes();
    const currentTimeInMinutes = currentH * 60 + currentM;
    const shiftOpenMinutes = 6 * 60; // 6:00 AM (06:00)
    const shiftCloseMinutes = 17 * 60; // 5:00 PM (17:00)

    if (todayRecord?.timeIn && todayRecord?.timeOut) {
      return { label: 'Completed', color: 'text-green-700 bg-green-100' };
    }
    if (todayRecord?.timeIn) {
      if (currentTimeInMinutes >= shiftCloseMinutes) {
        return {
          label: 'Shift Ended (Clock Out)',
          color: 'text-amber-700 bg-amber-100',
        };
      }
      return {
        label: todayRecord.status === 'late' ? 'Clocked In (Late)' : 'Clocked In',
        color: todayRecord.status === 'late' ? 'text-orange-700 bg-orange-100' : 'text-sky-700 bg-sky-100',
      };
    }

    if (currentTimeInMinutes < shiftOpenMinutes) {
      return { label: 'Opens at 6:00 AM', color: 'text-indigo-700 bg-indigo-100' };
    }
    if (currentTimeInMinutes >= shiftCloseMinutes) {
      return { label: 'Closed (5:00 PM)', color: 'text-gray-500 bg-gray-100' };
    }

    return { label: 'Not Clocked In', color: 'text-gray-500 bg-gray-100' };
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Trainees</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.total_applications || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Users className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">HTE Linked Trainees</p>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Recent Time Records</h3>
              <p className="text-sm text-gray-500 mt-0.5">Last entries and enrolled status from your students</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
              {recentRecords.length} student{recentRecords.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/75 border-b border-gray-100">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Student Name</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Hours</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentRecords.length > 0 ? (
                  recentRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {record.photo ? (
                            <img
                              src={getPhotoUrl(record.photo)}
                              alt={record.student_name}
                              className="w-10 h-10 rounded-full object-cover border border-emerald-200 shadow-sm flex-shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                                (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center border border-emerald-200 text-sm flex-shrink-0 ${record.photo ? 'hidden' : ''}`}
                          >
                            {record.student_name ? record.student_name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">{record.student_name}</p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[11px] font-medium">
                                {record.student_id}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-600">{record.course}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.date && record.date !== 'No clock-in yet' && !isNaN(Date.parse(record.date)) ? (
                          new Date(record.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        ) : (
                          <span className="text-xs italic text-gray-400">No clock-in yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {Number(record.hours_rendered || 0) > 0 ? (
                          <span className="text-emerald-700 font-semibold">{Number(record.hours_rendered).toFixed(1)} hrs</span>
                        ) : (
                          <span className="text-gray-400">0.0 hrs</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            record.status === 'Present' || record.status === 'Approved'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : record.status === 'Active / Enrolled'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : record.status === 'Late'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                          }`}
                        >
                          {record.status || (record.is_approved ? 'Approved' : 'Pending')}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      <Users size={36} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm font-medium text-gray-600">No student records yet</p>
                      <p className="text-xs text-gray-400 mt-0.5">Enrolled student trainees and their daily time entries will appear here.</p>
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

        <div className="mt-3 flex items-center justify-between text-[11px] text-white/80 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
          <span>🕒 Attendance Window: <strong>6:00 AM – 5:00 PM</strong></span>
          <span>🔄 Resets daily at 6:00 AM</span>
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

      {/* Trainee Required Documents Compliance Card */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                <FileCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Required OJT Documents</h3>
                <p className="text-xs text-gray-500">
                  {uploadedDocsCount}/4 Documents Submitted ({docsProgressPercent}%)
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1 ${
                isAllDocsPassed
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isAllDocsPassed ? (
                <>
                  <Check size={13} className="stroke-[3]" /> 4/4 Passed
                </>
              ) : (
                <>
                  <Clock size={12} className="animate-pulse" />
                  {missingDocsCount === 1 ? '1 Document Left' : `${missingDocsCount} Left to Pass`}
                </>
              )}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <motion.div
              className={`h-full rounded-full ${
                isAllDocsPassed
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${docsProgressPercent}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>

          {/* Missing docs warning alert banner if any are missing */}
          {!isAllDocsPassed && (
            <div className="mb-3.5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong>Compliance Alert:</strong> You have {missingDocsCount} document{missingDocsCount > 1 ? 's' : ''} that {missingDocsCount > 1 ? 'have' : 'has'} not yet passed. You can submit directly below to complete your registration requirements.
              </div>
            </div>
          )}

          {/* The 4 Document Items List */}
          <div className="space-y-2">
            {STANDARD_REQUIRED_DOCS.map((docItem) => {
              const doc = submittedDocs[docItem.key];
              const hasFile = Boolean(doc?.dataUrl || doc?.name);
              const isPassed = doc?.status === 'passed' && hasFile;
              const isUploading = dashboardUploadingKey === docItem.key;
              const DocIcon = docItem.icon;

              return (
                <div
                  key={docItem.key}
                  className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    isPassed
                      ? 'bg-emerald-50/40 border-emerald-200/80'
                      : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <DocIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-gray-800 truncate">{docItem.title}</p>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border shrink-0 ${
                            isPassed
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isPassed ? 'PASSED' : 'PENDING'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">
                        {hasFile && doc?.name ? `📁 ${doc.name}` : docItem.desc}
                      </p>
                    </div>
                  </div>

                  {/* Inline Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {hasFile ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setDashboardPreviewDoc({
                              title: docItem.title,
                              fileName: doc?.name || `${docItem.key}.pdf`,
                              dataUrl: doc?.dataUrl,
                              uploadedAt: doc?.uploadedAt,
                            })
                          }
                          className="py-1 px-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                        >
                          <Eye size={12} /> View
                        </button>
                        <label
                          htmlFor={`dash-replace-${docItem.key}`}
                          className="py-1 px-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <RefreshCw size={11} className={isUploading ? 'animate-spin' : ''} />
                          {isUploading ? 'Uploading...' : 'Replace'}
                        </label>
                        <input
                          type="file"
                          id={`dash-replace-${docItem.key}`}
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleDashboardDocUpload(docItem.key, e.target.files?.[0] || null)}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </>
                    ) : (
                      <label
                        htmlFor={`dash-upload-${docItem.key}`}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                          isUploading
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <Upload size={12} className={isUploading ? 'animate-spin' : ''} />
                        {isUploading ? 'Uploading...' : 'Submit Document'}
                        <input
                          type="file"
                          id={`dash-upload-${docItem.key}`}
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleDashboardDocUpload(docItem.key, e.target.files?.[0] || null)}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Link Footer */}
          <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Need full view, print, or download?</span>
            <Link
              to="/app/documents"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            >
              Open Required Docs Hub <ChevronRight size={14} />
            </Link>
          </div>
        </motion.div>
      )}

      {/* Trainee HTE Partner & Evaluation Status Card */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                <Building size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800 text-sm">Host Training Establishment (HTE) Status</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    Synced
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Manage mutual evaluations between trainee and host establishment supervisor
                </p>
              </div>
            </div>

            <Link
              to="/app/hte-feedback"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all self-start sm:self-auto"
            >
              <Star size={13} />
              <span>{traineeHostFeedback ? 'View HTE Evaluation' : 'Evaluate HTE Partner'}</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Host Company Info & Trainee's Evaluation of HTE */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                    Assigned HTE Partner
                  </span>
                  {traineeHostFeedback ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={11} /> You Evaluated HTE ({traineeHostFeedback.overallScore}%)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Clock size={11} /> Feedback Pending
                    </span>
                  )}
                </div>

                <p className="text-base font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <Building size={16} className="text-blue-600" />
                  {hteCompanyName}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Supervisor: <span className="font-semibold text-slate-800">{hteSupervisorName}</span>
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  {traineeHostFeedback ? `Recommendation: ${traineeHostFeedback.recommendation}` : 'Rate your internship experience'}
                </span>
                <Link
                  to="/app/hte-feedback"
                  className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {traineeHostFeedback ? 'Review / Edit' : 'Evaluate Now'} <ChevronRight size={13} />
                </Link>
              </div>
            </div>

            {/* 2. Trainee's Evaluation Received from HTE Supervisor */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                    HTE Supervisor Evaluation of You
                  </span>
                  {traineeEvaluation ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Award size={11} /> Official Grade: {traineeEvaluation.grade}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 flex items-center gap-1">
                      <Clock size={11} /> Supervisor Pending
                    </span>
                  )}
                </div>

                {traineeEvaluation ? (
                  <div className="mt-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-blue-700">{traineeEvaluation.overallScore}%</span>
                      <span className="text-xs font-bold text-slate-700">{traineeEvaluation.grade}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      "{traineeEvaluation.strengths || traineeEvaluation.recommendations || 'Performance officially verified.'}"
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5">
                    <p className="text-xs font-semibold text-slate-700">Awaiting Host Evaluation</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Your supervisor at {hteCompanyName} will complete your evaluation for university credits.
                    </p>
                  </div>
                )}
              </div>

              {traineeEvaluation ? (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    Evaluated by {traineeEvaluation.evaluatedBy}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewEvaluation(traineeEvaluation)}
                    className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    View Scorecard <ChevronRight size={13} />
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-400">
                  Evaluation status is synchronized live with supervisor.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

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

      {/* Trainee Dashboard Document Preview Modal */}
      <AnimatePresence>
        {dashboardPreviewDoc && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{dashboardPreviewDoc.title}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">{dashboardPreviewDoc.fileName}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                  >
                    <Printer size={13} /> Print
                  </button>

                  {dashboardPreviewDoc.dataUrl && (
                    <a
                      href={dashboardPreviewDoc.dataUrl}
                      download={dashboardPreviewDoc.fileName || 'ojt-document'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all shadow-sm"
                    >
                      <Download size={13} /> Download
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setDashboardPreviewDoc(null)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex items-center justify-center min-h-[350px]">
                {dashboardPreviewDoc.dataUrl ? (
                  dashboardPreviewDoc.dataUrl.startsWith('data:image/') || dashboardPreviewDoc.dataUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <img
                      src={dashboardPreviewDoc.dataUrl}
                      alt={dashboardPreviewDoc.title}
                      className="max-h-[520px] max-w-full object-contain rounded-2xl shadow-lg border border-slate-200 bg-white"
                    />
                  ) : (
                    <iframe
                      src={dashboardPreviewDoc.dataUrl}
                      className="w-full h-[520px] rounded-2xl border border-slate-200 bg-white shadow"
                      title="Document Preview"
                    />
                  )
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <FileText size={48} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No preview available for this file.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Carlos Hilado Memorial State University</span>
                <button
                  type="button"
                  onClick={() => setDashboardPreviewDoc(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Trainee Evaluation Scorecard Modal */}
        {previewEvaluation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                    <Award size={20} className="text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">HTE Performance Evaluation</h3>
                    <p className="text-xs text-blue-200">Evaluated by {previewEvaluation.evaluatedBy}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewEvaluation(null)}
                  className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4">
                {/* Overall Grade Banner */}
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-600">Official Rating</span>
                    <p className="text-2xl font-black text-blue-900 mt-0.5">{previewEvaluation.grade}</p>
                    <span className="text-xs text-blue-700">Verified OJT Performance Grade</span>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-blue-700">{previewEvaluation.overallScore}%</span>
                    <span className="text-[10px] block text-blue-500 font-semibold">Cumulative Score</span>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Score Breakdown</span>
                  {[
                    { label: 'Job Performance & Practical Skills', score: previewEvaluation.performanceScore },
                    { label: 'Work Habits, Conduct & Attendance', score: previewEvaluation.attendanceScore },
                    { label: 'Interpersonal & Communication Skills', score: previewEvaluation.communicationScore },
                    { label: 'Time Management & Problem Solving', score: previewEvaluation.punctualityScore },
                    { label: 'Attitude & Work Ethic', score: previewEvaluation.attitudeScore },
                  ].map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${item.score}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-900 w-8 text-right">{item.score}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Supervisor Written Feedback */}
                {previewEvaluation.strengths && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Supervisor Feedback & Strengths
                    </span>
                    <p className="text-xs text-emerald-950 mt-1 leading-relaxed">{previewEvaluation.strengths}</p>
                  </div>
                )}

                {previewEvaluation.recommendations && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Recommendations
                    </span>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">{previewEvaluation.recommendations}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Evaluated {previewEvaluation.evaluatedAt ? new Date(previewEvaluation.evaluatedAt).toLocaleDateString() : 'N/A'}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewEvaluation(null)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                >
                  Close Scorecard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
