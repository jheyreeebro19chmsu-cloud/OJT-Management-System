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
  ChevronLeft,
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
  GraduationCap,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { sendWelcomeEmail } from '../lib/resend';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { formatTime } from '../utils/geo';
import { getPhotoUrl } from '../services/config';
import { transformSupabaseEmployee, uploadDocumentToStorage } from '../services/supabaseService';
import { STANDARD_REQUIRED_DOCS } from './Documents';
import { REQUIRED_TRAINEE_DOC_KEYS, REQUIRED_TRAINEE_DOCUMENTS } from '../data/documentRequirements';
import { downloadDocument, getFileCategory, formatFileSize } from '../utils/attachmentHelper';
import { computeTraineeOjtNotifications } from '../utils/traineeNotifications';
import { getPaginationWindow } from '../utils/pagination';


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

function formatMetricHours(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = Number(val);
  if (isNaN(num)) return '0';
  const rounded = Math.round(num * 10) / 10;
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
}

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
    refreshData,
  } = useApp();
  const employee = getCurrentEmployee();
  const isAdmin = useMemo(() => {
    const role = (currentUser?.role || (employee as any)?.role || '').toLowerCase();
    const pos = (currentUser?.position || employee?.position || '').toLowerCase();
    if (role === 'admin' || role === 'instructor') return true;
    if (pos.includes('instructor') || pos === 'administrator') return true;
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        const pRole = (parsed.role || '').toLowerCase();
        const pPos = (parsed.position || '').toLowerCase();
        if (pRole === 'admin' || pRole === 'instructor' || pPos.includes('instructor') || pPos === 'administrator') {
          return true;
        }
      }
    } catch {}
    return false;
  }, [currentUser, employee]);

  // Automatically refresh data when instructor or admin views the dashboard
  useEffect(() => {
    refreshData();
  }, [refreshData]);
  
  // HTE/Instructor Dashboard Metrics
  // Student trainees across the active cohort
  const studentEmployees = useMemo(() => {
    const activeAY = settings?.activeAcademicYear || '2026-2027';
    const defaultAY = settings?.academicYears?.[0] || '2026-2027';
    return employees.filter((e) => {
      const pos = (e.position || '').toLowerCase();
      const role = ((e as any).role || '').toLowerCase();
      const isStaffOrHte =
        role === 'admin' ||
        role === 'instructor' ||
        role === 'hte' ||
        role === 'host' ||
        pos === 'administrator' ||
        pos.includes('instructor') ||
        pos.includes('hte') ||
        pos.includes('supervisor') ||
        pos.includes('representative') ||
        e.employeeId?.startsWith('ADM-') ||
        e.employeeId?.startsWith('HTE-');
      if (isStaffOrHte) return false;
      return (
        e.academicYear === activeAY ||
        (!e.academicYear && (activeAY === defaultAY || !activeAY)) ||
        e.academicYear === '2026-2027'
      );
    });
  }, [employees, settings?.activeAcademicYear, settings?.academicYears]);

  // HTE Linked students
  const linkedStudents = useMemo(() => {
    return studentEmployees
      .filter((e) => {
        return Boolean(
          (e.hteId && e.hteId.trim().length > 0) ||
          (e.companyName &&
            e.companyName.trim().length > 0 &&
            !e.companyName.toLowerCase().includes('pending') &&
            e.companyName !== 'N/A' &&
            e.companyName !== 'None')
        );
      })
      .map((s) => ({
        id: s.id,
        status: s.active !== false ? 'approved' : 'pending',
        employees: {
          id: s.id,
          name: s.name,
          course: s.course || s.department || 'OJT Trainee',
          companyName: s.companyName,
          supervisorName: s.supervisorName,
          photo: s.photo,
        },
      }));
  }, [studentEmployees]);

  // Active time records for active academic year cohort
  const activeCohortRecords = useMemo(() => {
    const activeAY = settings?.activeAcademicYear;
    const defaultAY = settings?.academicYears?.[0] || '2025-2026';
    const traineeIds = new Set<string>();
    studentEmployees.forEach((s) => {
      if (s.id) traineeIds.add(s.id);
      if (s.employeeId) traineeIds.add(s.employeeId);
      if (s.email) traineeIds.add(s.email.toLowerCase());
    });

    return (contextTimeRecords || []).filter((r: any) => {
      if (r.academicYear) return r.academicYear === activeAY;
      if (r.employeeId && (traineeIds.has(r.employeeId) || traineeIds.has(r.employeeId.toLowerCase()))) return true;
      return !r.academicYear && (activeAY === defaultAY || !activeAY);
    });
  }, [contextTimeRecords, studentEmployees, settings?.activeAcademicYear, settings?.academicYears]);

  // Instructor Dashboard Metrics
  const metrics = useMemo(() => {
    const totalApplications = studentEmployees.length;
    const approved = studentEmployees.filter((s) => s.applicationStatus === 'approved' || s.approvalStatus === 'approved' || s.active !== false).length;
    const pending = studentEmployees.filter((s) => s.applicationStatus === 'pending' || s.approvalStatus === 'pending' || !s.active).length;
    const rejected = studentEmployees.filter((s) => s.applicationStatus === 'rejected' || s.approvalStatus === 'rejected').length;
    const completed = studentEmployees.filter((s: any) => s.applicationStatus === 'completed' || s.approvalStatus === 'completed').length;
    const cancelled = studentEmployees.filter((s: any) => s.applicationStatus === 'cancelled' || s.approvalStatus === 'cancelled').length;

    let totalRenderedHours = 0;
    if (activeCohortRecords && activeCohortRecords.length > 0) {
      totalRenderedHours = activeCohortRecords.reduce((sum, r) => {
        const hours = Number(r.totalHours || (r as any).total_hours || (r as any).hours_rendered) || 0;
        return sum + hours;
      }, 0);
    }

    const totalRequiredHours = Math.round(
      studentEmployees.reduce((sum, s) => sum + (Number(s.requiredHours) || 600), 0) * 10
    ) / 10;
    totalRenderedHours = Math.round(totalRenderedHours * 10) / 10;
    const totalRemainingHours = Math.max(0, Math.round((totalRequiredHours - totalRenderedHours) * 10) / 10);

    return {
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
      total_remaining_hours: totalRemainingHours,
      unique_students: totalApplications,
    };
  }, [studentEmployees, activeCohortRecords]);

  // Recent Time Records and Enrolled Trainees
  const recentRecords = useMemo(() => {
    // 1. Build records for students who have logged time records
    const studentTimeLogs = (activeCohortRecords || []).map((r: any) => {
      const empId = r.employeeId || r.employee_id;
      const emp = studentEmployees.find(
        (e) =>
          e.id === empId ||
          e.employeeId === empId ||
          (e.email && empId && e.email.toLowerCase() === empId.toLowerCase()) ||
          (e.name && (r.employeeName || r.employee_name) && e.name.toLowerCase().trim() === (r.employeeName || r.employee_name).toLowerCase().trim())
      );
      const totalHours = Number(r.totalHours || r.total_hours || r.hours_rendered || 0);
      return {
        id: r.id,
        employee_id: emp?.id || empId,
        student_name: emp?.name || r.employeeName || r.employee_name || 'Student Trainee',
        student_id: emp?.employeeId || empId || 'OJT-TRAINEE',
        photo: emp?.photo || r.timeInPhoto || r.time_in_photo || r.photo,
        course: emp?.course || emp?.department || 'OJT Trainee',
        date: r.date || (r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        timeIn: r.timeIn || r.time_in,
        timeOut: r.timeOut || r.time_out,
        totalHours,
        timeInGeofenced: Boolean(r.timeInGeofenced ?? r.time_in_geofenced),
        timeOutGeofenced: Boolean(r.timeOutGeofenced ?? r.time_out_geofenced),
        hours_rendered: totalHours,
        is_approved: r.approvalStatus === 'approved' || r.approval_status === 'approved' || r.is_approved || r.status === 'present',
        status: r.status === 'present' ? 'Present' : r.status === 'late' ? 'Late' : (r.approvalStatus === 'approved' || r.approval_status === 'approved' ? 'Approved' : 'Pending'),
        rawEmployee: emp,
      };
    });

    // 2. Build rows for enrolled students who haven't clocked in yet so EVERY student is visible!
    const studentsWithLogs = new Set(studentTimeLogs.map((l: any) => l.student_id).concat(studentTimeLogs.map((l: any) => l.student_name)));
    const enrolledWithoutLogs = studentEmployees
      .filter((s) => !studentsWithLogs.has(s.employeeId) && !studentsWithLogs.has(s.name))
      .map((s) => ({
        id: `enrolled-${s.id}`,
        employee_id: s.id,
        student_name: s.name,
        student_id: s.employeeId || 'OJT-TRAINEE',
        photo: s.photo,
        course: s.course || s.department || 'OJT Trainee',
        date: s.startDate || 'No clock-in yet',
        timeIn: null,
        timeOut: null,
        totalHours: 0,
        timeInGeofenced: false,
        timeOutGeofenced: false,
        hours_rendered: 0,
        is_approved: s.active && s.approvalStatus !== 'pending',
        status: s.active && s.approvalStatus !== 'pending' ? 'Active / Enrolled' : 'Pending Approval',
        rawEmployee: s,
      }));

    return [...studentTimeLogs, ...enrolledWithoutLogs];
  }, [studentEmployees, contextTimeRecords]);

  const [linkedStudentsPage, setLinkedStudentsPage] = useState(1);
  const [linkedStudentsPerPage, setLinkedStudentsPerPage] = useState(6);
  const [searchId, setSearchId] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const [recentRecordsPage, setRecentRecordsPage] = useState(1);
  const RECENT_RECORDS_PER_PAGE = 10;

  const totalRecentRecordsPages = Math.ceil(recentRecords.length / RECENT_RECORDS_PER_PAGE) || 1;
  const paginatedRecentRecords = useMemo(() => {
    const startIndex = (recentRecordsPage - 1) * RECENT_RECORDS_PER_PAGE;
    return recentRecords.slice(startIndex, startIndex + RECENT_RECORDS_PER_PAGE);
  }, [recentRecords, recentRecordsPage]);

  useEffect(() => {
    if (recentRecordsPage > totalRecentRecordsPages) {
      setRecentRecordsPage(1);
    }
  }, [recentRecordsPage, totalRecentRecordsPages]);

  const totalLinkedPages = Math.ceil(linkedStudents.length / linkedStudentsPerPage) || 1;
  const paginatedLinkedStudents = useMemo(() => {
    const startIndex = (linkedStudentsPage - 1) * linkedStudentsPerPage;
    return linkedStudents.slice(startIndex, startIndex + linkedStudentsPerPage);
  }, [linkedStudents, linkedStudentsPage, linkedStudentsPerPage]);

  useEffect(() => {
    if (linkedStudentsPage > totalLinkedPages) {
      setLinkedStudentsPage(1);
    }
  }, [linkedStudentsPage, totalLinkedPages]);
  
  // Original Dashboard State (for non-admin/students)
  const currentEmp = employee || getCurrentEmployee();
  const empLookupId = currentEmp?.id || currentEmp?.employeeId || currentUser?.employeeId || currentUser?.id || '';
  const displayName = currentEmp?.name || currentUser?.name || (isAdmin ? 'OJT Instructor' : 'Trainee');
  const displayId = currentEmp?.employeeId || currentUser?.employeeId || (isAdmin ? 'INSTRUCTOR' : '');
  const todayRecord = empLookupId ? getTodayRecord(empLookupId) : null;
  const allRecords = empLookupId ? getEmployeeRecords(empLookupId) : [];
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dismissedAnn, setDismissedAnn] = useState<Set<string>>(new Set());
  const [pendingApps, setPendingApps] = useState<Employee[]>([]);
  const [hteRequests, setHteRequests] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [traineeRecordsPage, setTraineeRecordsPage] = useState(1);
  const traineeRecordsPerPage = 4;

  const sortedTraineeRecords = useMemo(() => {
    return [...allRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allRecords]);

  const totalTraineePages = Math.max(1, Math.ceil(sortedTraineeRecords.length / traineeRecordsPerPage));
  const paginatedTraineeRecords = useMemo(() => {
    const start = (traineeRecordsPage - 1) * traineeRecordsPerPage;
    return sortedTraineeRecords.slice(start, start + traineeRecordsPerPage);
  }, [sortedTraineeRecords, traineeRecordsPage, traineeRecordsPerPage]);

  // Late threshold evaluation
  const [startH, startM] = (settings.workStartTime || '08:00').split(':').map(Number);
  const lateGraceMinutes = Number(settings.lateThresholdMinutes ?? 15);
  const lateCutoffTotalMinutes = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 0 : startM) + lateGraceMinutes;
  const currentTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const isPastLateThreshold = !todayRecord?.timeIn && currentTotalMinutes > lateCutoffTotalMinutes;

  const cutoffHour = Math.floor(lateCutoffTotalMinutes / 60) % 24;
  const cutoffMin = lateCutoffTotalMinutes % 60;
  const formattedCutoffTime = formatTime(
    `${String(cutoffHour).padStart(2, '0')}:${String(cutoffMin).padStart(2, '0')}`
  );

  // Trainee Required Documents state
  const [dashboardPreviewDoc, setDashboardPreviewDoc] = useState<any | null>(null);
  const [dashboardUploadingKey, setDashboardUploadingKey] = useState<string | null>(null);
  const [previewEvaluation, setPreviewEvaluation] = useState<any | null>(null);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Employee | null>(null);

  const submittedDocs: TraineeDocuments = currentEmp?.submittedDocuments || {};
  const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
  const totalRequired = docKeys.length;
  const uploadedDocsCount = docKeys.filter((k) => Boolean(submittedDocs[k]?.dataUrl || submittedDocs[k]?.name)).length;
  const missingDocsCount = totalRequired - uploadedDocsCount;
  const isAllDocsPassed =
    (currentEmp?.documentsPassed && currentEmp?.documentsStatus === 'passed') ||
    currentEmp?.documentsPassed === true ||
    uploadedDocsCount === totalRequired;
  const docsProgressPercent = Math.round((uploadedDocsCount / totalRequired) * 100);

  const resolveDocDataUrl = (docKey: string, docItem?: TraineeDocumentItem): string => {
    if (docItem?.dataUrl) return docItem.dataUrl;
    if ((docItem as any)?.fileUrl) return (docItem as any).fileUrl;
    const empId = currentEmp?.id || currentEmp?.employeeId || currentUser?.employeeId || '';
    try {
      const cached =
        localStorage.getItem(`ojt_doc_${empId}_${docKey}`) ||
        localStorage.getItem(`ojt_doc_${docKey}`) ||
        localStorage.getItem(`ojt_doc_current_${docKey}`);
      if (cached) return cached;
    } catch {}
    return '';
  };

  const handleDashboardDocUpload = (docKey: keyof TraineeDocuments, file: File | null) => {
    if (!file || !currentEmp) return;

    // Validate file type — Pictures (JPG, PNG, WEBP), PDF, Word (DOC, DOCX)
    const ALLOWED_MIME = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png|webp|doc|docx)$/i;
    if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
      toast.error(
        `Unsupported file type: "${file.name.split('.').pop()?.toUpperCase() || 'Unknown'}". Accepted formats: Pictures (JPG, PNG, WEBP), PDF, and Word documents (DOC, DOCX).`
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit. Allowed size is up to 10MB.');
      return;
    }

    setDashboardUploadingKey(docKey);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const empId = currentEmp.id || currentEmp.employeeId || currentUser?.employeeId || '';

      try {
        localStorage.setItem(`ojt_doc_${empId}_${docKey}`, dataUrl);
        localStorage.setItem(`ojt_doc_${docKey}`, dataUrl);
      } catch {}

      let finalUrl = dataUrl;
      try {
        const storedUrl = await uploadDocumentToStorage(empId, docKey, file, file.name);
        if (storedUrl && storedUrl.startsWith('http')) {
          finalUrl = storedUrl;
          try {
            localStorage.setItem(`ojt_doc_${empId}_${docKey}`, storedUrl);
          } catch {}
        }
      } catch {}

      const currentDocs: TraineeDocuments = currentEmp.submittedDocuments || {};
      const newDocItem: TraineeDocumentItem = {
        name: file.name,
        size: file.size,
        dataUrl: finalUrl,
        fileType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        status: 'pending',
      };

      const updatedDocs: TraineeDocuments = {
        ...currentDocs,
        [docKey]: newDocItem,
      };

      const newUploadedCount = docKeys.filter((k) => Boolean(updatedDocs[k]?.dataUrl || updatedDocs[k]?.name)).length;
      const allPassed = newUploadedCount === totalRequired && docKeys.every((k) => updatedDocs[k]?.status === 'passed');

      updateEmployee(currentEmp.id, {
        submittedDocuments: updatedDocs,
        documentsPassed: allPassed,
        documentsStatus: allPassed ? 'passed' : newUploadedCount === totalRequired ? 'submitted' : 'partial',
      });

      setDashboardUploadingKey(null);
      const meta = STANDARD_REQUIRED_DOCS.find((d) => d.key === docKey);
      toast.success(`${meta?.title || 'Document'} submitted! Pending coordinator review.`);
    };

    reader.onerror = () => {
      setDashboardUploadingKey(null);
      toast.error('Failed to read file. Please try again.');
    };

    reader.readAsDataURL(file);
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
        try {
          const { data } = await supabase
            .from('employees')
            .select('*')
            .eq('application_status', 'pending');
          if (data) setPendingApps(data.map(transformSupabaseEmployee));
        } catch {}
      };

      const fetchHteRequests = async () => {
        // Table hte_student_access is unmigrated in this Supabase instance
        if (typeof window !== 'undefined' && localStorage.getItem('ojt_enable_hte_student_access') !== 'true') {
          return;
        }
        try {
          const { data, error } = await supabase
            .from('hte_student_access')
            .select('*, host_supervisors(*), employees!inner(*)')
            .in('status', ['pending', 'approved'])
            .order('created_at', { ascending: false });
          if (error) return;
          if (data) {
            setHteRequests(data);
          }
        } catch {
          // ignore
        }
      };

      fetchPending();
      fetchHteRequests();
    }
  }, [isAdmin]);

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
      const isUuidVal = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
      const resolvedInstructorId =
        currentUser?.id && isUuidVal(currentUser.id)
          ? currentUser.id
          : employee?.id && isUuidVal(employee.id)
          ? employee.id
          : student.instructorId && isUuidVal(student.instructorId)
          ? student.instructorId
          : null;

      const { error } = await supabase
        .from('employees')
        .update({
          application_status: 'approved',
          active: true,
          instructor_id: resolvedInstructorId,
        })
        .eq('id', student.id);
      if (error) throw error;

      updateEmployee(student.id, {
        active: true,
        approvalStatus: 'approved',
        applicationStatus: 'approved',
        instructorId: resolvedInstructorId || undefined,
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
  const traineeNotifications = useMemo(() => {
    if (isAdmin) return [];
    return computeTraineeOjtNotifications(currentEmp, todayRecord, totalHoursRendered, currentTime);
  }, [isAdmin, currentEmp, todayRecord, totalHoursRendered, currentTime]);

  const adminDocStats = useMemo(() => {
    if (!isAdmin) return { total: 0, compliant: 0, pending: 0, incomplete: 0, pendingSubmissions: [] };

    const trainees = studentEmployees;

    let compliant = 0;
    let pending = 0;
    let incomplete = 0;
    const pendingSubmissions: Array<{
      employee: Employee;
      docKey: string;
      docTitle: string;
      item: any;
    }> = [];

    trainees.forEach((emp) => {
      const docs = emp.submittedDocuments || {};
      const passedCount = REQUIRED_TRAINEE_DOC_KEYS.filter((k) => docs[k]?.status === 'passed').length;
      const hasPendingDoc = REQUIRED_TRAINEE_DOC_KEYS.some((k) => {
        const d = docs[k];
        const hasFile = Boolean(d && (d.dataUrl || d.name || (d as any).fileUrl));
        return hasFile && (d.status === 'pending' || d.status === 'submitted' || !d.status) && d.status !== 'passed' && d.status !== 'rejected';
      });

      const isCompliant = Boolean(
        (emp.documentsPassed && emp.documentsStatus === 'passed') ||
        emp.documentsPassed === true ||
        emp.documentsStatus === 'passed' ||
        passedCount === REQUIRED_TRAINEE_DOC_KEYS.length
      );

      if (isCompliant) {
        compliant++;
      } else if (hasPendingDoc || emp.documentsStatus === 'submitted' || emp.documentsStatus === 'pending') {
        pending++;
      } else {
        incomplete++;
      }

      REQUIRED_TRAINEE_DOCUMENTS.forEach((req) => {
        const d = docs[req.key];
        const hasFile = Boolean(d && (d.dataUrl || d.name || (d as any).fileUrl));
        const isPendingItem = hasFile && (d.status === 'pending' || d.status === 'submitted' || !d.status) && d.status !== 'passed' && d.status !== 'rejected';
        if (isPendingItem) {
          pendingSubmissions.push({
            employee: emp,
            docKey: req.key,
            docTitle: req.title,
            item: d,
          });
        }
      });
    });

    return { total: trainees.length, compliant, pending, incomplete, pendingSubmissions };
  }, [studentEmployees, isAdmin]);

  const requiredHours = employee?.requiredHours ?? (isAdmin ? 0 : 600);
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
    const [startH, startM] = (settings.workStartTime || '08:00').split(':').map(Number);
    const lateGrace = Number(settings.lateThresholdMinutes ?? 15);
    const lateThresholdMinutes = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 0 : startM) + lateGrace;

    if (todayRecord?.timeIn && todayRecord?.timeOut) {
      return { label: 'Completed', color: 'text-green-700 bg-green-100' };
    }
    if (todayRecord?.timeIn) {
      if (todayRecord.status === 'offsite') {
        return {
          label: 'Clocked In (Offsite)',
          color: 'text-purple-700 bg-purple-100',
        };
      }
      return {
        label: todayRecord.status === 'late' ? 'Clocked In (Late)' : 'Clocked In (On-Time)',
        color: todayRecord.status === 'late' ? 'text-orange-700 bg-orange-100' : 'text-sky-700 bg-sky-100',
      };
    }

    // Trainee has not recorded attendance for today yet - clock-in is open all the time
    if (currentTimeInMinutes > lateThresholdMinutes) {
      return { label: 'Open (Late Attendance)', color: 'text-amber-700 bg-amber-100' };
    }

    return { label: 'Open (On-Time)', color: 'text-emerald-700 bg-emerald-100' };
  };

  const handleStudentClick = (record: any) => {
    let emp = record.rawEmployee;
    if (!emp) {
      emp = employees.find(
        (e) =>
          e.id === record.employee_id ||
          e.id === record.id ||
          e.employeeId === record.student_id ||
          (record.student_name && e.name.toLowerCase().trim() === record.student_name.toLowerCase().trim())
      );
    }
    if (emp) {
      setSelectedStudentForModal(emp);
    } else {
      setSelectedStudentForModal({
        id: record.employee_id || record.id,
        name: record.student_name,
        employeeId: record.student_id,
        course: record.course,
        department: 'College of Computer Studies',
        schoolName: 'Carlos Hilado Memorial State University',
        campus: 'Main Campus',
        position: 'OJT Trainee',
        companyName: 'Host Training Establishment',
        supervisorName: 'HTE Supervisor',
        requiredHours: 600,
        active: true,
        photo: record.photo,
      } as Employee);
    }
  };

  // ── INSTRUCTOR DASHBOARD (HTE-style) ──
  if (isAdmin) {
    return (
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Monitor student attendance, hours, and approvals</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <Users className="text-blue-600" size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500">Total Trainees</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{metrics?.total_applications || adminDocStats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                <Building className="text-purple-600" size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500">HTE Linked Trainees</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{linkedStudents.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/20">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="text-emerald-600" size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500">Document Compliance</p>
                <p className="text-2xl font-bold text-emerald-700 mt-0.5">
                  {adminDocStats.compliant}
                  <span className="text-xs font-normal text-gray-500 ml-1">/ {adminDocStats.total} Passed</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100/80 bg-gradient-to-br from-white to-amber-50/20 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                  <FileCheck className="text-amber-600" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500">Pending Reviews</p>
                  <p className="text-2xl font-bold text-amber-700 mt-0.5">
                    {adminDocStats.pending}
                    <span className="text-xs font-normal text-gray-500 ml-1">needs check</span>
                  </p>
                </div>
              </div>
            </div>
            <Link
              to="/admin/documents"
              className="mt-2 text-[11px] font-bold text-violet-700 hover:text-violet-900 flex items-center gap-1 transition-colors"
            >
              Monitor Documents →
            </Link>
          </div>
        </div>

        {/* Hours Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Required Hours</p>
                <p className="text-4xl font-bold mt-2">{formatMetricHours(metrics?.total_required_hours)}</p>
              </div>
              <Clock className="w-12 h-12 text-blue-300 opacity-30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Total Rendered Hours</p>
                <p className="text-4xl font-bold mt-2">{formatMetricHours(metrics?.total_rendered_hours)}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-green-300 opacity-30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Remaining Hours</p>
                <p className="text-4xl font-bold mt-2">{formatMetricHours(metrics?.total_remaining_hours)}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-orange-300 opacity-30" />
            </div>
          </div>
        </div>

        {/* Instructor: Pending Student Registrations Awaiting Verification */}
        {pendingApps.length > 0 && (
          <div className="bg-amber-50/70 rounded-2xl border border-amber-200/80 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-200/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Pending Trainee Registrations</h3>
                  <p className="text-xs text-amber-900/80 mt-0.5">
                    Newly registered student trainees awaiting instructor approval to begin their OJT tracking
                  </p>
                </div>
              </div>
              <span className="px-3.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-xs self-start sm:self-auto">
                {pendingApps.length} Awaiting Approval
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {pendingApps.map((app) => (
                <div key={app.id} className="bg-white p-4 rounded-xl border border-amber-200/70 shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-gray-900 text-sm truncate" title={app.name}>{app.name}</p>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700 shrink-0">
                        {app.employeeId || 'ID: Pending'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{app.course || (app as any).year_section || 'Trainee'}</p>
                    <p className="text-xs text-blue-700 font-semibold mt-1 flex items-center gap-1">
                      <Building size={12} className="shrink-0" />
                      <span className="truncate">{app.companyName || 'Host Establishment Pending'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleApprove(app)}
                      disabled={!!processingId}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer text-center"
                    >
                      {processingId === app.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(app)}
                      disabled={!!processingId}
                      className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors border border-red-200 disabled:opacity-50 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructor: HTE Student Access Requests */}
        {hteRequests.some((req) => req.status === 'pending') && (
          <div className="bg-blue-50/70 rounded-2xl border border-blue-200/80 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-blue-200/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Building size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">HTE Access Requests</h3>
                  <p className="text-xs text-blue-900/80 mt-0.5">
                    Host Training Establishments requesting access to supervise trainees
                  </p>
                </div>
              </div>
              <span className="px-3.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full shadow-xs self-start sm:self-auto">
                {hteRequests.filter((r) => r.status === 'pending').length} Pending Requests
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {hteRequests.filter((req) => req.status === 'pending').map((req) => (
                <div key={req.id} className="bg-white p-4 rounded-xl border border-blue-200/70 shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                      {req.host_supervisors?.company_name || 'Host Company'}
                    </p>
                    <p className="font-bold text-gray-800 text-sm mt-1">
                      {req.host_supervisors?.name}{' '}
                      <span className="font-normal text-gray-400 text-xs">requests</span> {req.employees?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleApproveHte(req)}
                      disabled={!!processingId}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {processingId === req.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectHte(req)}
                      disabled={!!processingId}
                      className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors border border-red-200 disabled:opacity-50 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Students Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">HTE Linked Students</h3>
              <p className="text-xs text-gray-500 mt-0.5">Trainees officially assigned to Host Training Establishments</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                {linkedStudents.length} Assigned
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedLinkedStudents.map((link) => (
              <div key={link.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-white hover:shadow-sm transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{link.employees?.name}</p>
                    <p className="text-xs text-gray-500">{link.employees?.course}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100/60 inline-flex">
                      <Building size={12} className="text-blue-600 shrink-0" />
                      <span className="truncate max-w-[150px]">{link.employees?.companyName || 'Host Establishment'}</span>
                    </div>
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
                    {link.status === 'approved' ? 'Assigned' : link.status}
                  </span>
                </div>
              </div>
            ))}
            {linkedStudents.length === 0 && (
              <div className="col-span-full py-10 text-center text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-20" />
                <p className="font-medium text-sm">No HTE students linked yet.</p>
                <p className="text-xs text-gray-400 mt-1">Assign trainees to an HTE via Student Trainees management.</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {linkedStudents.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 mt-5 border-t border-gray-100">
              <div className="text-xs text-gray-500 font-medium">
                Showing <span className="font-bold text-gray-800">{(linkedStudentsPage - 1) * linkedStudentsPerPage + 1}</span> to{' '}
                <span className="font-bold text-gray-800">
                  {Math.min(linkedStudentsPage * linkedStudentsPerPage, linkedStudents.length)}
                </span>{' '}
                of <span className="font-bold text-gray-800">{linkedStudents.length}</span> assigned trainees
              </div>

              {totalLinkedPages > 1 && (
                <div className="flex items-center gap-1.5 self-center sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setLinkedStudentsPage((p) => Math.max(1, p - 1))}
                    disabled={linkedStudentsPage === 1}
                    className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages = getPaginationWindow(linkedStudentsPage, totalLinkedPages, 10);
                      return (
                        <>
                          {pages[0] > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setLinkedStudentsPage(1)}
                                className="min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                              >
                                1
                              </button>
                              {pages[0] > 2 && <span className="text-gray-400 text-xs px-1">...</span>}
                            </>
                          )}
                          {pages.map((page) => (
                            <button
                              type="button"
                              key={page}
                              onClick={() => setLinkedStudentsPage(page)}
                              className={`min-w-[32px] h-8 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                linkedStudentsPage === page
                                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          {pages[pages.length - 1] < totalLinkedPages && (
                            <>
                              {pages[pages.length - 1] < totalLinkedPages - 1 && (
                                <span className="text-gray-400 text-xs px-1">...</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setLinkedStudentsPage(totalLinkedPages)}
                                className="min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                              >
                                {totalLinkedPages}
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={() => setLinkedStudentsPage((p) => Math.min(totalLinkedPages, p + 1))}
                    disabled={linkedStudentsPage === totalLinkedPages}
                    className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trainee Document Submissions Awaiting Instructor Review */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck size={20} className="text-violet-600" />
                <h3 className="text-lg font-bold text-gray-900">Trainee Document Submissions Awaiting Review</h3>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Onboarding documents, medical clearances, agreements, and forms uploaded by trainees
              </p>
            </div>
            <Link
              to="/admin/documents"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-violet-200 self-start sm:self-auto"
            >
              Open Document Hub ({adminDocStats.pending})
            </Link>
          </div>

          {adminDocStats.pendingSubmissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {adminDocStats.pendingSubmissions.slice(0, 6).map((sub, idx) => (
                <div
                  key={`${sub.employee.id}-${sub.docKey}-${idx}`}
                  className="p-4 rounded-xl border border-violet-100 bg-violet-50/20 hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-900 truncate" title={sub.employee.name}>
                        {sub.employee.name}
                      </span>
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase shrink-0">
                        Pending Review
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-violet-700 truncate">{sub.docTitle}</p>
                    <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
                      📁 {sub.item.name || 'Attached Document'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Submitted: {sub.item.uploadedAt ? new Date(sub.item.uploadedAt).toLocaleDateString() : 'Recently'}
                    </p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">{sub.employee.course || 'OJT Student'}</span>
                    <Link
                      to={`/admin/documents`}
                      className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1"
                    >
                      Review →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">
              <CheckCircle size={32} className="mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="font-semibold text-sm text-gray-700">All Trainee Documents Are Up To Date</p>
              <p className="text-xs text-gray-400 mt-1">No pending student document submissions require immediate verification.</p>
            </div>
          )}
        </div>

        {/* Recent Time Records */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Recent Time Records</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Click any student row to view full information, OJT attendance, and evaluations
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
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
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRecentRecords.length > 0 ? (
                  paginatedRecentRecords.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => handleStudentClick(record)}
                      className="hover:bg-blue-50/60 transition-all cursor-pointer group"
                      title="Click to view student information & OJT progress"
                    >
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
                            <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">
                              {record.student_name}
                            </p>
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
                      <td className="px-6 py-4 text-sm text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:text-blue-700 bg-blue-50 group-hover:bg-blue-100/90 px-3 py-1.5 rounded-xl transition-all">
                          <Eye size={13} />
                          View Info
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      <Users size={36} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm font-medium text-gray-600">No student records yet</p>
                      <p className="text-xs text-gray-400 mt-0.5">Enrolled student trainees and their daily time entries will appear here.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for Recent Time Records (10 per page) */}
          {totalRecentRecordsPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-gray-50/75 border-t border-gray-100 text-xs">
              <span className="text-gray-500 font-medium">
                Showing <span className="font-bold text-gray-800">{(recentRecordsPage - 1) * RECENT_RECORDS_PER_PAGE + 1}</span> to{' '}
                <span className="font-bold text-gray-800">
                  {Math.min(recentRecordsPage * RECENT_RECORDS_PER_PAGE, recentRecords.length)}
                </span>{' '}
                of <span className="font-bold text-gray-800">{recentRecords.length}</span> students
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRecentRecordsPage((prev) => Math.max(1, prev - 1))}
                  disabled={recentRecordsPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                <div className="flex items-center gap-1">
                  {(() => {
                    const pages = getPaginationWindow(recentRecordsPage, totalRecentRecordsPages, 10);
                    return (
                      <>
                        {pages[0] > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setRecentRecordsPage(1)}
                              className="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                            >
                              1
                            </button>
                            {pages[0] > 2 && (
                              <span className="px-1 text-gray-400 font-bold">...</span>
                            )}
                          </>
                        )}

                        {pages.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setRecentRecordsPage(p)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              recentRecordsPage === p
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {p}
                          </button>
                        ))}

                        {pages[pages.length - 1] < totalRecentRecordsPages && (
                          <>
                            {pages[pages.length - 1] < totalRecentRecordsPages - 1 && (
                              <span className="px-1 text-gray-400 font-bold">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setRecentRecordsPage(totalRecentRecordsPages)}
                              className="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                            >
                              {totalRecentRecordsPages}
                            </button>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>

                <button
                  type="button"
                  onClick={() => setRecentRecordsPage((prev) => Math.min(totalRecentRecordsPages, prev + 1))}
                  disabled={recentRecordsPage === totalRecentRecordsPages}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Student Information & OJT Profile Modal */}
        <AnimatePresence>
          {selectedStudentForModal && (() => {
            const target = selectedStudentForModal;
            const empRecords = contextTimeRecords
              .filter((r) => r.employeeId === target.id || r.employeeId === target.employeeId)
              .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

            const totalRendered = empRecords.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);
            const required = Number(target.requiredHours) || 600;
            const progressPercent = Math.min(100, Math.round((totalRendered / required) * 100));
            const remainingHours = Math.max(0, required - totalRendered);

            const presentCount = empRecords.filter((r) => r.status === 'present' || r.status === 'overtime').length;
            const lateCount = empRecords.filter((r) => r.status === 'late').length;

            const evaluation = evaluations.find(
              (e) => e.employeeId === target.id || e.employeeId === target.employeeId
            );
            const feedback = hostFeedback.find(
              (f) => f.employeeId === target.id || f.employeeId === target.employeeId
            );

            const initials = target.name
              ? target.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              : 'ST';

            return (
              <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col"
                >
                  {/* Modal Header */}
                  <div className="p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white flex items-start justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-4">
                      {(() => {
                        const photoUrl = getPhotoUrl(target.photo);
                        return (
                          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 overflow-hidden shadow-inner relative select-none">
                            <span className="text-xl font-extrabold text-white">{initials}</span>
                            {photoUrl && (
                              <img
                                src={photoUrl}
                                alt=""
                                className="w-full h-full object-cover absolute inset-0 z-10"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                        );
                      })()}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold text-white">{target.name}</h3>
                          <span className="font-mono text-xs bg-white/20 text-white px-2 py-0.5 rounded-md border border-white/25">
                            {target.employeeId || 'ID: Pending'}
                          </span>
                        </div>
                        <p className="text-xs text-blue-100/90 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>{target.course || 'Bachelor of Science in Information Systems'}</span>
                          <span>•</span>
                          <span>{target.schoolName || 'Carlos Hilado Memorial State University'}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedStudentForModal(null)}
                      className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-6">
                    {/* KPI Quick Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Rendered</p>
                        <p className="text-xl font-black text-blue-900 mt-0.5">{totalRendered.toFixed(1)}h</p>
                        <p className="text-[10px] text-blue-500 font-medium">{progressPercent}% done</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Remaining</p>
                        <p className="text-xl font-black text-slate-800 mt-0.5">{remainingHours.toFixed(1)}h</p>
                        <p className="text-[10px] text-slate-400 font-medium">of {required}h req.</p>
                      </div>
                      <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Logged Days</p>
                        <p className="text-xl font-black text-emerald-900 mt-0.5">{empRecords.length}</p>
                        <p className="text-[10px] text-emerald-600 font-medium">{presentCount} on-time, {lateCount} late</p>
                      </div>
                      <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-3.5 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Evaluation</p>
                        <p className="text-xl font-black text-purple-900 mt-0.5">
                          {evaluation?.overallScore || feedback?.overallScore ? `${evaluation?.overallScore || feedback?.overallScore}%` : 'Pending'}
                        </p>
                        <p className="text-[10px] text-purple-600 font-medium">
                          {evaluation?.grade || 'In progress'}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-600">
                        <span>OJT Hours Completion</span>
                        <span className="text-blue-700 font-bold">{progressPercent}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Information Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Academic & Personal Particulars */}
                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2.5 text-xs">
                        <h4 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                          <GraduationCap size={14} className="text-blue-600" />
                          Academic & Contact Details
                        </h4>
                        <div className="space-y-1.5 text-slate-600">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Academic Year:</span>
                            <span className="font-bold text-slate-800">AY {target.academicYear || settings.activeAcademicYear || '2026-2027'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Campus:</span>
                            <span className="font-medium text-slate-700">{target.campus || 'Main Campus'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Department:</span>
                            <span className="font-medium text-slate-700">{target.department || 'College of Computer Studies'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Email:</span>
                            <a href={`mailto:${target.email}`} className="font-medium text-blue-600 hover:underline">
                              {target.email || 'No email registered'}
                            </a>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Contact Phone:</span>
                            <span className="font-mono text-slate-700">{target.contactPhone || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Training Period:</span>
                            <span className="font-medium text-slate-700">
                              {target.startDate || 'Start Date'} to {target.endDate || 'End Date'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* HTE Placement */}
                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2.5 text-xs">
                        <h4 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                          <Building size={14} className="text-blue-600" />
                          Host Training Establishment (HTE)
                        </h4>
                        <div className="space-y-1.5 text-slate-600">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Company:</span>
                            <span className="font-bold text-blue-900">{target.companyName || feedback?.hostCompany || 'Host Training Establishment'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Supervisor:</span>
                            <span className="font-bold text-slate-800">{target.supervisorName || feedback?.hostName || 'HTE Supervisor'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Placement Address:</span>
                            <span className="font-medium text-slate-700 text-right max-w-[200px] truncate">
                              {target.companyAddress || 'Deployment premises'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Required Hours:</span>
                            <span className="font-bold text-slate-800">{required} Hours</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Account Status:</span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              {target.approvalStatus === 'pending' ? 'Pending Approval' : 'Active / Enrolled'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Evaluation Snapshot (If Evaluated) */}
                    {(evaluation || feedback) && (
                      <div className="border border-blue-200 rounded-2xl p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/40 space-y-3 text-xs">
                        <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                          <h4 className="font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                            <Award size={15} className="text-blue-600" />
                            Performance Evaluation & Rating
                          </h4>
                          <span className="font-bold px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-[11px]">
                            {evaluation?.overallScore || feedback?.overallScore}% • {evaluation?.grade || 'Very Good'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[11px]">
                          <div className="bg-white/80 p-2 rounded-xl border border-blue-100">
                            <p className="text-slate-400">Attendance</p>
                            <p className="font-bold text-slate-800">{evaluation?.attendanceScore ?? feedback?.attendanceScore}%</p>
                          </div>
                          <div className="bg-white/80 p-2 rounded-xl border border-blue-100">
                            <p className="text-slate-400">Performance</p>
                            <p className="font-bold text-slate-800">{evaluation?.performanceScore ?? feedback?.performanceScore}%</p>
                          </div>
                          <div className="bg-white/80 p-2 rounded-xl border border-blue-100">
                            <p className="text-slate-400">Attitude</p>
                            <p className="font-bold text-slate-800">{evaluation?.attitudeScore ?? feedback?.attitudeScore}%</p>
                          </div>
                          <div className="bg-white/80 p-2 rounded-xl border border-blue-100">
                            <p className="text-slate-400">Communication</p>
                            <p className="font-bold text-slate-800">{evaluation?.communicationScore ?? feedback?.communicationScore}%</p>
                          </div>
                          <div className="bg-white/80 p-2 rounded-xl border border-blue-100 col-span-2 sm:col-span-1">
                            <p className="text-slate-400">Teamwork</p>
                            <p className="font-bold text-slate-800">{evaluation?.punctualityScore ?? feedback?.teamworkScore}%</p>
                          </div>
                        </div>

                        {(evaluation?.strengths || feedback?.strengths) && (
                          <div className="text-slate-700 bg-white/60 p-2.5 rounded-xl border border-blue-100/60 leading-relaxed">
                            <strong className="text-blue-900">Strengths: </strong>
                            {evaluation?.strengths || feedback?.strengths}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Clock-in Logs Table */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock size={14} className="text-blue-600" />
                          Recent Daily Time Records ({empRecords.length} total)
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentForModal(null);
                            navigate(`/admin/employees`);
                          }}
                          className="text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          View all in DTR →
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Date</th>
                              <th className="p-2.5">Time In</th>
                              <th className="p-2.5">Time Out</th>
                              <th className="p-2.5">Total Hours</th>
                              <th className="p-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {empRecords.length > 0 ? (
                              empRecords.slice(0, 8).map((rec) => (
                                <tr key={rec.id} className="hover:bg-slate-50/60">
                                  <td className="p-2.5 font-medium text-slate-800">
                                    {rec.date ? new Date(rec.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                  </td>
                                  <td className="p-2.5 font-mono text-slate-600">{rec.timeIn || '—'}</td>
                                  <td className="p-2.5 font-mono text-slate-600">{rec.timeOut || '—'}</td>
                                  <td className="p-2.5 font-semibold text-slate-900">{Number(rec.totalHours || 0).toFixed(1)}h</td>
                                  <td className="p-2.5 text-right">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        rec.status === 'present'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : rec.status === 'late'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {rec.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                                  No attendance time entries logged yet for this student.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentForModal(null);
                        navigate('/admin/host-feedback');
                      }}
                      className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all border border-blue-200/60 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Award size={14} />
                      Host Feedback / Evaluations
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedStudentForModal(null)}
                      className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>
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

      {/* Live OJT Hours & Shift Proximity Notification Cards (Streamlined & Collapsible) */}
      <AnimatePresence>
        {traineeNotifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {/* Display Primary / Highest-Priority Notice */}
            {(() => {
              const primary = traineeNotifications[0];
              const isHigh = primary.urgency === 'high';
              const isSuccess = primary.urgency === 'success';

              return (
                <div
                  key={primary.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border shadow-sm relative overflow-hidden transition-all ${
                    isHigh
                      ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border-amber-300 ring-2 ring-amber-400/20'
                      : isSuccess
                        ? 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border-emerald-300 ring-2 ring-emerald-400/20'
                        : 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/5 border-blue-300 ring-2 ring-blue-400/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                          isHigh
                            ? 'bg-amber-500 text-white animate-pulse'
                            : isSuccess
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                        }`}
                      >
                        {isHigh ? <Clock size={18} /> : isSuccess ? <Award size={18} /> : <AlertTriangle size={18} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isHigh
                                ? 'bg-amber-200 text-amber-900'
                                : isSuccess
                                  ? 'bg-emerald-200 text-emerald-900'
                                  : 'bg-blue-200 text-blue-900'
                            }`}
                          >
                            {primary.type === 'shift_near_end'
                              ? 'Shift End Alert'
                              : primary.type === 'shift_overtime'
                                ? 'Overtime Alert'
                                : primary.type === 'shift_start_soon'
                                  ? 'Morning Shift'
                                  : 'OJT Milestone'}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-500 font-mono">
                            {primary.timeLabel}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-gray-900 mt-0.5">{primary.title}</h4>
                        <p className="text-xs text-gray-700 mt-0.5 leading-relaxed max-w-2xl">{primary.message}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {primary.actionRoute && (
                        <button
                          type="button"
                          onClick={() => navigate(primary.actionRoute!)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer ${
                            isHigh
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200'
                              : isSuccess
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                          }`}
                        >
                          <span>{primary.actionText || 'Open'}</span>
                          <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toggle button if there are additional alerts */}
                  {traineeNotifications.length > 1 && (
                    <div className="mt-2.5 pt-2 border-t border-gray-200/50 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">
                        {showAllNotifications
                          ? `Showing all ${traineeNotifications.length} notices`
                          : `+${traineeNotifications.length - 1} more notice${traineeNotifications.length > 2 ? 's' : ''} available`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAllNotifications((prev) => !prev)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                      >
                        {showAllNotifications ? 'Hide additional notices ▲' : `View all notices (${traineeNotifications.length}) ▼`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Additional Collapsible Notices */}
            {showAllNotifications &&
              traineeNotifications.slice(1).map((n) => {
                const isHigh = n.urgency === 'high';
                const isSuccess = n.urgency === 'success';

                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3 rounded-2xl border shadow-sm ${
                      isHigh
                        ? 'bg-amber-50/60 border-amber-200'
                        : isSuccess
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-blue-50/60 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isHigh
                              ? 'bg-amber-500 text-white'
                              : isSuccess
                                ? 'bg-emerald-600 text-white'
                                : 'bg-blue-600 text-white'
                          }`}
                        >
                          {isHigh ? <Clock size={14} /> : isSuccess ? <Award size={14} /> : <AlertTriangle size={14} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{n.title}</p>
                          <p className="text-[11px] text-gray-600 truncate">{n.message}</p>
                        </div>
                      </div>
                      {n.actionRoute && (
                        <button
                          type="button"
                          onClick={() => navigate(n.actionRoute!)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-100 shrink-0 transition-colors"
                        >
                          {n.actionText || 'Open'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
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
          <span>🕒 Clock In: <strong>Open All Times</strong> (Late after {formattedCutoffTime || '8:15 AM'})</span>
          <span>🔄 Resets daily at 6:00 AM</span>
        </div>

        {todayRecord?.timeIn && todayRecord?.timeOut && todayRecord.totalHours && (
          <div className="mt-3 bg-white/20 rounded-2xl p-3 text-center">
            <p className="text-white/70 text-xs">Total Hours Today</p>
            <p className="text-white font-bold text-xl">{todayRecord.totalHours.toFixed(2)} hrs</p>
          </div>
        )}
      </motion.div>

      {/* Primary Call-To-Action (CTA): Pronounced Clock In / Clock Out Hero Button */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        {!todayRecord?.timeIn ? (
          /* Active Standout State: Clock In Now (Hero Primary CTA) - Always Open at all times */
          <Link
            to="/app/time-record"
            className={`group relative block overflow-hidden rounded-3xl p-5 sm:p-6 text-white shadow-xl ring-4 active:scale-[0.99] transition-all duration-200 ${
              isPastLateThreshold
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800 shadow-amber-500/25 ring-amber-500/20'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-500/25 ring-blue-500/20'
            }`}
          >
            <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl shrink-0 shadow-inner">
                  <span className={`absolute animate-ping inline-flex h-10 w-10 rounded-full opacity-75 ${isPastLateThreshold ? 'bg-amber-300' : 'bg-emerald-400'}`}></span>
                  <Clock size={28} className="text-white relative z-10" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {isPastLateThreshold ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/25 text-amber-100 border border-amber-300/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
                        Clock-In Open • Late Attendance (Past {formattedCutoffTime})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Shift Open • On-Time Grace until {formattedCutoffTime}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase mt-1">
                    {isPastLateThreshold ? 'CLOCK IN NOW (LATE)' : 'CLOCK IN NOW'}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/90 flex items-center gap-1.5 mt-0.5">
                    <Camera size={14} className="text-white/80" />
                    {isPastLateThreshold
                      ? `Clock-in is open all times. Attendance will be recorded as Late (passed ${lateGraceMinutes} min threshold).`
                      : 'Biometric Face Recognition + Geofenced Verification'}
                  </p>
                </div>
              </div>

              <div className={`px-5 py-2.5 rounded-2xl font-black text-sm tracking-wide shadow-md group-hover:translate-x-1 transition-all flex items-center gap-2 self-start sm:self-center shrink-0 ${
                isPastLateThreshold
                  ? 'bg-white text-orange-800 group-hover:bg-amber-50'
                  : 'bg-white text-blue-700 group-hover:bg-blue-50'
              }`}>
                <span>{isPastLateThreshold ? 'RECORD TIME IN (LATE)' : 'RECORD TIME IN'}</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </Link>
        ) : !todayRecord?.timeOut ? (
          /* Active Clock Out State */
          <Link
            to="/app/time-record"
            className="group relative block overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-xl shadow-amber-500/25 ring-4 ring-amber-500/20 active:scale-[0.99] transition-all duration-200"
          >
            <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl shrink-0 shadow-inner">
                  <Clock size={28} className="text-white relative z-10" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30">
                      Clocked In at {formatTime(todayRecord.timeIn)}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase mt-1">
                    CLOCK OUT NOW
                  </h3>
                  <p className="text-xs sm:text-sm text-amber-100 flex items-center gap-1.5 mt-0.5">
                    <Camera size={14} className="text-amber-200" />
                    Complete today's attendance session and record hours
                  </p>
                </div>
              </div>

              <div className="px-5 py-2.5 rounded-2xl bg-white text-orange-700 font-black text-sm tracking-wide shadow-md group-hover:bg-amber-50 group-hover:translate-x-1 transition-all flex items-center gap-2 self-start sm:self-center shrink-0">
                <span>RECORD TIME OUT</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </Link>
        ) : (
          /* Completed Attendance State */
          <Link
            to="/app/records"
            className="group relative block overflow-hidden rounded-3xl p-5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-lg shadow-emerald-500/20 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-wide uppercase">
                    TODAY'S ATTENDANCE COMPLETED
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Time In: <strong>{formatTime(todayRecord.timeIn)}</strong> • Time Out: <strong>{formatTime(todayRecord.timeOut)}</strong>
                    {todayRecord.totalHours ? ` (${todayRecord.totalHours.toFixed(1)} hrs rendered)` : ''}
                  </p>
                </div>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-center shrink-0 transition-colors">
                <span>View My DTR</span>
                <ChevronRight size={16} />
              </div>
            </div>
          </Link>
        )}
      </motion.div>

      {/* Trainee Required Documents Compliance Summary Card (Concise, Non-Redundant) */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
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
              className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1 shrink-0 ${
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
                  {missingDocsCount === 1 ? '1 Pending' : `${missingDocsCount} Pending`}
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

          {/* 4 Mini Document Status Pills (Compact Overview) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {STANDARD_REQUIRED_DOCS.map((docItem) => {
              const doc = submittedDocs[docItem.key];
              const hasFile = Boolean(doc?.dataUrl || doc?.name);
              const isPassed = doc?.status === 'passed' && hasFile;

              return (
                <div
                  key={docItem.key}
                  className={`p-2 rounded-xl border flex items-center gap-2 text-xs ${
                    isPassed
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {isPassed ? (
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  ) : (
                    <Clock size={14} className="text-amber-500 shrink-0" />
                  )}
                  <span className="font-semibold truncate">{docItem.title}</span>
                </div>
              );
            })}
          </div>

          {/* Action Link to dedicated Documents page */}
          <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
              {isAllDocsPassed ? 'All mandatory clearance documents are complete.' : 'Upload or manage all 4 documents in the document center.'}
            </span>
            <Link
              to="/app/documents"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all"
            >
              <span>Manage Documents</span>
              <ChevronRight size={13} />
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
                  Internship placement details and supervisor performance evaluation
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Host Company Info & Placement Particulars */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                    Assigned HTE Partner
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Active Placement
                  </span>
                </div>

                <p className="text-base font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <Building size={16} className="text-blue-600" />
                  {hteCompanyName}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Supervisor: <span className="font-semibold text-slate-800">{hteSupervisorName}</span>
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px]">
                  Required Hours: <strong className="text-slate-700">{employee?.requiredHours || 600}h</strong>
                </span>
                <span className="text-[11px] font-medium text-slate-600">
                  {employee?.campus || 'CHMSU'}
                </span>
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
                    traineeEvaluation.status === 'reviewed_by_instructor' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Award size={11} /> ✓ Verified
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                        <Award size={11} /> Grade: {traineeEvaluation.grade}
                      </span>
                    )
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
                    {traineeEvaluation.status === 'reviewed_by_instructor' ? (
                      <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                        ✓ Evaluation Completed &amp; Verified by Instructor
                      </p>
                    ) : (
                      <p className="text-xs text-blue-700 font-semibold mt-0.5">
                        Evaluated — Pending Instructor Review
                      </p>
                    )}
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
                  <Link
                    to="/app/evaluation"
                    className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    Open OJT Questionnaire <ChevronRight size={13} />
                  </Link>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px]">View your evaluation form and details.</span>
                  <Link
                    to="/app/evaluation"
                    className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    View Questionnaire <ChevronRight size={13} />
                  </Link>
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

      {/* Trainee Attendance Records with Pagination */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">My Attendance Records</h3>
                <p className="text-[11px] text-gray-400">
                  {sortedTraineeRecords.length} recorded session{sortedTraineeRecords.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <Link to="/app/records" className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
              <span>View all</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {sortedTraineeRecords.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-gray-200">
              <Clock size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="font-medium text-gray-600">No attendance sessions logged yet</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Use the "Clock In Now" button above when starting your shift.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedTraineeRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-all"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-800">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        {record.timeIn && (
                          <span>In: <strong className="text-gray-700">{formatTime(record.timeIn)}</strong></span>
                        )}
                        {record.timeOut && (
                          <span>Out: <strong className="text-gray-700">{formatTime(record.timeOut)}</strong></span>
                        )}
                        {record.totalHours !== undefined && record.totalHours !== null && (
                          <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded-full">
                            {Number(record.totalHours).toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          record.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : record.status === 'late'
                              ? 'bg-amber-100 text-amber-800'
                              : record.status === 'offsite'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : record.status === 'absent'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {record.status}
                      </span>
                      {record.timeInGeofenced ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          📍 Geofenced
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          ⚠ Off-premises
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalTraineePages > 1 && (
                <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Page <strong className="text-gray-800">{traineeRecordsPage}</strong> of{' '}
                    <strong className="text-gray-800">{totalTraineePages}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTraineeRecordsPage((p) => Math.max(1, p - 1))}
                      disabled={traineeRecordsPage === 1}
                      className="px-2.5 py-1 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft size={13} /> Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setTraineeRecordsPage((p) => Math.min(totalTraineePages, p + 1))}
                      disabled={traineeRecordsPage >= totalTraineePages}
                      className="px-2.5 py-1 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      Next <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
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
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <Printer size={13} /> Print
                  </button>

                  {dashboardPreviewDoc.dataUrl && (
                    <button
                      type="button"
                      onClick={() => downloadDocument(dashboardPreviewDoc.dataUrl, dashboardPreviewDoc.fileName)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
                      title="Download file"
                    >
                      <Download size={13} /> Download
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDashboardPreviewDoc(null)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-1 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex items-center justify-center min-h-[350px]">
                {dashboardPreviewDoc.dataUrl ? (
                  (() => {
                    const cat = getFileCategory(dashboardPreviewDoc.fileName || dashboardPreviewDoc.dataUrl);
                    const isImg =
                      cat === 'picture' ||
                      dashboardPreviewDoc.dataUrl.startsWith('data:image/') ||
                      dashboardPreviewDoc.dataUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
                    const isWord =
                      cat === 'doc' ||
                      dashboardPreviewDoc.dataUrl.startsWith('data:application/msword') ||
                      dashboardPreviewDoc.dataUrl.startsWith('data:application/vnd') ||
                      dashboardPreviewDoc.fileName?.match(/\.(doc|docx)$/i);

                    if (isImg) {
                      return (
                        <div className="flex flex-col items-center justify-center gap-3 max-w-full">
                          <img
                            src={dashboardPreviewDoc.dataUrl}
                            alt={dashboardPreviewDoc.title}
                            className="max-h-[520px] max-w-full object-contain rounded-2xl shadow-lg border border-slate-200 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => downloadDocument(dashboardPreviewDoc.dataUrl, dashboardPreviewDoc.fileName)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                          >
                            <Download size={14} /> Download Picture
                          </button>
                        </div>
                      );
                    }

                    if (isWord) {
                      return (
                        <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-blue-200 shadow-lg text-center">
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-inner">
                            <FileText size={36} className="stroke-[2.2]" />
                          </div>
                          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider inline-block mb-2">
                            Microsoft Word Document
                          </span>
                          <h4 className="text-base font-bold text-slate-900 mb-1">{dashboardPreviewDoc.title}</h4>
                          <p className="text-xs text-slate-500 font-mono mb-4 break-all">{dashboardPreviewDoc.fileName}</p>

                          <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-100 mb-5 text-slate-600">
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-500">Document Type:</span>
                              <span className="font-bold text-slate-800">Word (.doc / .docx)</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-500">Status:</span>
                              <span className="font-bold text-emerald-600">✓ PASSED / RECORDED</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                            Word files download directly to open with Microsoft Word, Google Docs, or Office apps.
                          </p>

                          <button
                            type="button"
                            onClick={() => downloadDocument(dashboardPreviewDoc.dataUrl, dashboardPreviewDoc.fileName)}
                            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all cursor-pointer"
                          >
                            <Download size={15} /> Download Word Document
                          </button>
                        </div>
                      );
                    }

                    return (
                      <iframe
                        src={dashboardPreviewDoc.dataUrl}
                        className="w-full h-[520px] rounded-2xl border border-slate-200 bg-white shadow"
                        title="Document Preview"
                      />
                    );
                  })()
                ) : (
                  <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-inner">
                      <FileCheck size={32} />
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ VERIFIED & RECORDED ({dashboardPreviewDoc.status?.toUpperCase() || 'PASSED'})
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">{dashboardPreviewDoc.title}</h4>
                    <p className="text-xs text-slate-500 font-mono mb-4 break-all">Recorded File: {dashboardPreviewDoc.fileName}</p>

                    <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-100 mb-5 text-slate-600">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">Student Name:</span>
                        <span className="font-bold text-slate-800">{currentEmp?.name || currentUser?.name || 'Trainee'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">Student ID:</span>
                        <span className="font-mono text-slate-800">{currentEmp?.employeeId || currentUser?.employeeId || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">Institution:</span>
                        <span className="text-slate-800">Carlos Hilado Memorial State University</span>
                      </div>
                      {dashboardPreviewDoc.uploadedAt && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Filing Date:</span>
                          <span className="text-slate-800">{new Date(dashboardPreviewDoc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                      Attach a fresh copy (Pictures, PDF, or Word Docs up to 10MB) below:
                    </p>

                    <label className="cursor-pointer px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 w-full">
                      <Upload size={14} /> Attach File for Live Preview
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && dashboardPreviewDoc.key) {
                            handleDashboardDocUpload(dashboardPreviewDoc.key as any, file);
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const newUrl = ev.target?.result as string;
                              setDashboardPreviewDoc((prev: any) => (prev ? { ...prev, dataUrl: newUrl } : null));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
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
