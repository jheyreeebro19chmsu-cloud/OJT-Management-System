import { Users, Search, Plus, Trash2, Camera, CheckCircle, XCircle, Eye, X, User, MapPin, Shield, Printer, FileText, Download, FileCheck, CheckCircle2, ExternalLink, MoreVertical, RefreshCw, Building, ChevronLeft, ChevronRight, Edit3, Check, AlertTriangle, GraduationCap, Clock, ShieldCheck, CheckSquare, Square, Send, UserMinus, Sparkles, Building2, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { FaceCapture } from '../../components/FaceCapture';
import { isSecurityApiConfigured, registerFace } from '../../services/securityApi';
import { useApp } from '../../store/AppContext';
import { Employee, TraineeDocuments } from '../../types';
import { getPhotoUrl } from '../../services/config';
import { campusOptions, departmentOptions, getCoursesForDepartment } from '../../data/academicOptions';
import { getCampusLocation } from '../../utils/campusLocations';
import { REQUIRED_TRAINEE_DOCUMENTS, REQUIRED_TRAINEE_DOC_KEYS } from '../../data/documentRequirements';
import { downloadDocument, getFileCategory } from '../../utils/attachmentHelper';
import { isWithinNegrosOccidental } from '../../utils/geo';
import { getPaginationWindow } from '../../utils/pagination';
import { resolveHteLocation, isInvalidHteCompany } from '../../utils/hteLocation';
type ModalMode = 'view' | 'add' | 'edit' | 'review' | null;

const BLANK_FORM = {
  name: '',
  email: '',
  contactPhone: '',
  employeeId: '',
  department: '',
  position: 'OJT Trainee',
  companyName: '',
  supervisorName: '',
  schoolName: 'Carlos Hilado Memorial State University',
  campus: '',
  course: '',
  startDate: '',
  endDate: '',
  requiredHours: 486,
  academicYear: '2026-2027',
  residentialAddress: '',
  documentsPassed: false,
  documentsStatus: 'pending' as 'passed' | 'pending' | 'partial',
  active: true,
  approvalStatus: 'approved' as 'pending' | 'approved' | 'rejected',
};

export function formatHoursAndMinutes(totalHours: number): string {
  if (!totalHours || totalHours <= 0) return '0h';
  const h = Math.floor(totalHours);
  const m = Math.round((totalHours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}mins`;
  return `${h}hr ${m}mins`;
}

export function AdminEmployees() {
  const {
    currentUser,
    getCurrentEmployee,
    employees,
    timeRecords,
    geofenceZones,
    addGeofenceZone,
    registerEmployee,
    updateEmployee,
    batchUpdateEmployees,
    deleteEmployee,
    approveEmployee,
    rejectEmployee,
    settings,
    refreshData,
    hostSupervisors,
    requiredDocuments = [],
    addRequiredDocument,
    deleteRequiredDocument,
    getEmployeeRequiredDocuments,
    submitRequiredDocument,
    getRequiredDocumentSubmission,
    getRequirementStatus,
    getEmployeeRequirementSummary,
  } = useApp();
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  const [previewInstructorDoc, setPreviewInstructorDoc] = useState<{ studentName: string; studentId: string; title: string; fileName?: string; fileUrl?: string; note?: string; date?: string } | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [editForm, setEditForm] = useState(BLANK_FORM);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressValue, setAddressValue] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docDueDate, setDocDueDate] = useState('');
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'student' | 'instructor' | 'hte' | 'pending' | 'documents' | 'all'>('student');
  const [assigningHte, setAssigningHte] = useState(false);
  const [selectedHteId, setSelectedHteId] = useState('');
  const [batchDeployOpen, setBatchDeployOpen] = useState(false);
  const [deployTargetHteId, setDeployTargetHteId] = useState('');
  const [deploySelectedStudentIds, setDeploySelectedStudentIds] = useState<string[]>([]);
  const [deployCourseFilter, setDeployCourseFilter] = useState('all');
  const [deployStatusFilter, setDeployStatusFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [deploySearch, setDeploySearch] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  // Document monitoring state
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [docViewMode, setDocViewMode] = useState<'monitoring' | 'requirements'>('monitoring');
  const [docFilterStatus, setDocFilterStatus] = useState<'all' | 'pending' | 'compliant' | 'incomplete'>('all');
  const [docFilterRequirement, setDocFilterRequirement] = useState<string>('all');
  const [docFilterCourse, setDocFilterCourse] = useState<string>('all');
  const [docSearch, setDocSearch] = useState<string>('');
  const [docMonitoringPage, setDocMonitoringPage] = useState<number>(1);
  const docMonitoringPerPage = 10;

  useEffect(() => {
    if (location.pathname === '/admin/documents' || searchParams.get('tab') === 'documents') {
      setActiveCategoryTab('documents');
    }
  }, [location.pathname, searchParams]);

  const currentEmp = getCurrentEmployee();
  const isLoggedInInstructor = useMemo(() => {
    let cachedRole = '';
    let cachedPosition = '';
    let cachedName = '';
    try {
      const uStr = localStorage.getItem('ojt_current_user') || localStorage.getItem('ojt_user') || localStorage.getItem('user');
      if (uStr) {
        const u = JSON.parse(uStr);
        cachedRole = u.role || '';
        cachedPosition = u.position || '';
        cachedName = u.name || '';
      }
    } catch {}

    const role = (currentUser?.role || currentEmp?.role || cachedRole || '').toLowerCase();
    const position = ((currentUser as any)?.position || currentEmp?.position || cachedPosition || '').toLowerCase();
    const name = (currentUser?.name || currentEmp?.name || cachedName || '').toLowerCase();
    const empId = (currentUser?.employeeId || currentEmp?.employeeId || '').toLowerCase();

    return (
      role === 'instructor' ||
      position.includes('instructor') ||
      position.includes('faculty') ||
      name.includes('instructor') ||
      empId.startsWith('instr-')
    );
  }, [currentUser, currentEmp]);

  // All student trainees for document compliance monitoring
  const allTrainees = useMemo(() => {
    return employees.filter((emp) => {
      const pos = (emp.position || '').toLowerCase();
      const role = ((emp as any).role || '').toLowerCase();
      return (
        role !== 'admin' &&
        role !== 'instructor' &&
        role !== 'hte' &&
        pos !== 'administrator' &&
        !pos.includes('instructor') &&
        !pos.includes('faculty') &&
        !pos.includes('hte') &&
        !pos.includes('host')
      );
    });
  }, [employees]);

  // Document Compliance Statistics
  const docStats = useMemo(() => {
    let compliantCount = 0;
    let pendingCount = 0;
    let incompleteCount = 0;
    let totalFilesUploaded = 0;

    allTrainees.forEach((t) => {
      const docs = t.submittedDocuments || {};
      const uploadedCount = REQUIRED_TRAINEE_DOC_KEYS.filter((k) => Boolean(docs[k]?.dataUrl || docs[k]?.name)).length;
      const passedCount = REQUIRED_TRAINEE_DOC_KEYS.filter((k) => docs[k]?.status === 'passed').length;
      const hasPending = REQUIRED_TRAINEE_DOC_KEYS.some((k) => docs[k]?.status === 'pending' && Boolean(docs[k]?.dataUrl || docs[k]?.name));

      totalFilesUploaded += uploadedCount;

      if (passedCount === REQUIRED_TRAINEE_DOC_KEYS.length || (t.documentsPassed === true && t.documentsStatus === 'passed')) {
        compliantCount++;
      } else if (hasPending || t.documentsStatus === 'submitted') {
        pendingCount++;
      } else {
        incompleteCount++;
      }
    });

    return {
      total: allTrainees.length,
      compliant: compliantCount,
      pending: pendingCount,
      incomplete: incompleteCount,
      totalFilesUploaded,
    };
  }, [allTrainees]);

  const availableDocCourses = useMemo(() => {
    const set = new Set<string>();
    allTrainees.forEach((t) => {
      if (t.course) set.add(t.course);
    });
    return Array.from(set).sort();
  }, [allTrainees]);

  const filteredDocTrainees = useMemo(() => {
    return allTrainees.filter((t) => {
      const q = docSearch.trim().toLowerCase();
      if (q) {
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchId = (t.employeeId || '').toLowerCase().includes(q);
        const matchCourse = (t.course || '').toLowerCase().includes(q);
        const matchCompany = (t.companyName || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchCourse && !matchCompany) return false;
      }

      if (docFilterCourse !== 'all' && t.course !== docFilterCourse) {
        return false;
      }

      const docs = t.submittedDocuments || {};
      const passedCount = REQUIRED_TRAINEE_DOC_KEYS.filter((k) => docs[k]?.status === 'passed').length;
      const hasPending = REQUIRED_TRAINEE_DOC_KEYS.some((k) => docs[k]?.status === 'pending' && Boolean(docs[k]?.dataUrl || docs[k]?.name));
      const isCompliant = passedCount === REQUIRED_TRAINEE_DOC_KEYS.length || (t.documentsPassed === true && t.documentsStatus === 'passed');

      if (docFilterStatus === 'compliant' && !isCompliant) return false;
      if (docFilterStatus === 'pending' && (!hasPending && t.documentsStatus !== 'submitted')) return false;
      if (docFilterStatus === 'incomplete' && (isCompliant || hasPending)) return false;

      if (docFilterRequirement !== 'all') {
        const targetDoc = docs[docFilterRequirement];
        if (!targetDoc?.dataUrl && !targetDoc?.name) return false;
      }

      return true;
    });
  }, [allTrainees, docSearch, docFilterCourse, docFilterStatus, docFilterRequirement]);

  const totalDocPages = Math.ceil(filteredDocTrainees.length / docMonitoringPerPage) || 1;
  const paginatedDocTrainees = useMemo(() => {
    const start = (docMonitoringPage - 1) * docMonitoringPerPage;
    return filteredDocTrainees.slice(start, start + docMonitoringPerPage);
  }, [filteredDocTrainees, docMonitoringPage, docMonitoringPerPage]);

  const resolveEmpHomeAddress = (emp: Employee | null) => {
    if (!emp) return '';
    const isC = (val?: string) => Boolean(val && /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(String(val).trim()));
    let regAny = (emp as any)?.registrationLocation;
    if (typeof regAny === 'string') {
      try { regAny = JSON.parse(regAny); } catch {}
    }
    return (
      emp.residentialAddress ||
      regAny?.residentialAddress ||
      regAny?.homeAddress ||
      (!isC(emp.address) ? emp.address : '') ||
      (!isC(regAny?.address) ? regAny?.address : '') ||
      [emp.street || regAny?.street, emp.barangay || regAny?.barangay, emp.city || regAny?.city, emp.province || regAny?.province]
        .filter(Boolean)
        .join(', ') ||
      ''
    );
  };

  const resolveEmpPhone = (emp: Employee | null) => {
    if (!emp) return '';
    let regAny = (emp as any)?.registrationLocation;
    if (typeof regAny === 'string') {
      try { regAny = JSON.parse(regAny); } catch {}
    }
    return emp.contactPhone || emp.phone || emp.telephone || regAny?.contactPhone || regAny?.phone || regAny?.telephone || '';
  };

  const [selectedYear, setSelectedYear] = useState(settings.activeAcademicYear || '2026-2027');
  const [selectedHte, setSelectedHte] = useState<string>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pageByGroup, setPageByGroup] = useState<Record<string, number>>({
    pending: 1,
    student: 1,
    instructor: 1,
    hte: 1,
  });

  useEffect(() => {
    if (settings.activeAcademicYear) {
      setSelectedYear(settings.activeAcademicYear);
    }
  }, [settings.activeAcademicYear]);

  useEffect(() => {
    setPageByGroup({
      pending: 1,
      student: 1,
      instructor: 1,
      hte: 1,
    });
  }, [search, selectedYear, selectedHte]);

  const getEmployeeGroup = (emp?: Employee | null) => {
    if (!emp) return 'student';
    const normalized = emp.position?.toLowerCase() || '';
    const empId = emp.employeeId?.toLowerCase() || '';
    const role = ((emp as any)?.role || '').toLowerCase();
    if (role === 'admin' || role === 'instructor' || normalized.includes('instructor') || empId.startsWith('adm-') || empId.startsWith('instr-')) return 'instructor';
    if (role === 'hte' || role === 'host' || normalized.includes('hte') || normalized.includes('host training') || empId.startsWith('hte-')) return 'hte';
    return 'student';
  };

  const deduplicateAccounts = <T extends { id?: string; employeeId?: string; email?: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const email = (item.email || '').trim().toLowerCase();
      const empId = (item.employeeId || '').trim().toLowerCase();
      const id = (item.id || '').trim();

      const key = email ? `email:${email}` : empId ? `empId:${empId}` : `id:${id}`;
      if (seen.has(key)) return false;
      seen.add(key);

      if (email) seen.add(`email:${email}`);
      if (empId) seen.add(`empId:${empId}`);
      if (id) seen.add(`id:${id}`);

      return true;
    });
  };

  const matchesYear = (emp: Employee) => {
    if (selectedYear === 'all') return true;
    const defaultAY = settings?.academicYears?.[0] || '2025-2026';
    const activeAY = settings?.activeAcademicYear || '2026-2027';
    // Instructors are system-wide, but trainees and HTE are scoped by academic year
    if (emp.position === 'OJT Instructor' || emp.employeeId?.startsWith('ADM-')) {
      return true;
    }
    const empAY = emp.academicYear || activeAY || defaultAY;
    return empAY === selectedYear;
  };

  const matchesHteFilter = (emp: Employee, targetHte: string) => {
    if (targetHte === 'all') return true;
    const rawComp = (emp.companyName || '').trim();
    const isInvalid = !rawComp || isInvalidHteCompany(rawComp);
    if (targetHte === 'Unassigned') {
      return isInvalid;
    }
    if (isInvalid) {
      return false;
    }
    const empComp = rawComp.toLowerCase();
    const target = targetHte.toLowerCase();
    return empComp.includes(target) || target.includes(empComp);
  };

  const allAvailableHtes = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      email: string;
      companyName: string;
      companyAddress?: string;
      lat?: number;
      lng?: number;
      radius?: number;
      internCount: number;
    }>();

    // Verified permanent partner establishments
    map.set('95558630-499b-4aac-b869-ba64b0694e8c', {
      id: '95558630-499b-4aac-b869-ba64b0694e8c',
      name: 'Jhey Ree',
      email: 'jheyreeebro19chmsu@gmail.com',
      companyName: 'Printing Services',
      companyAddress: 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
      lat: 10.742858,
      lng: 122.970088,
      radius: 40,
      internCount: 0,
    });

    map.set('89405c66-015c-407a-937b-71ab37b829d7', {
      id: '89405c66-015c-407a-937b-71ab37b829d7',
      name: 'Jhey Ree C Ebro',
      email: 'concentrix.supervisor@example.com',
      companyName: 'Concentrix',
      companyAddress: 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod City',
      lat: 10.694261,
      lng: 122.959987,
      radius: 40,
      internCount: 0,
    });

    (hostSupervisors || []).forEach((h) => {
      const id = h.id || h.employeeId;
      if (!id) return;
      const key = id.toLowerCase();
      const existing = map.get(key) || map.get(id);
      const isCtx = (h.companyName || '').toLowerCase().includes('concentrix');
      const isPrinting = (h.companyName || '').toLowerCase().includes('printing');
      const defLat = isCtx ? 10.694261 : isPrinting ? 10.742858 : h.registrationLocation?.lat;
      const defLng = isCtx ? 122.959987 : isPrinting ? 122.970088 : h.registrationLocation?.lng;
      const defRadius = isCtx || isPrinting ? 40 : (h.registrationRadius || h.registrationLocation?.radius || 40);

      map.set(key, {
        id: h.id,
        name: h.name || existing?.name || 'HTE Supervisor',
        email: h.email || existing?.email || '',
        companyName: h.companyName || existing?.companyName || 'Host Establishment',
        companyAddress: h.companyAddress || h.registrationAddress || existing?.companyAddress || '',
        lat: defLat,
        lng: defLng,
        radius: defRadius,
        internCount: existing?.internCount || 0,
      });
    });

    employees.forEach((e) => {
      const isHte =
        e.position === 'HTE Representative' ||
        (e.position && e.position.toLowerCase().includes('hte')) ||
        (e as any).role === 'hte';
      if (!isHte) return;
      const id = e.id || e.employeeId;
      if (!id) return;
      const key = id.toLowerCase();
      const existing = map.get(key) || map.get(id);
      const isCtx = (e.companyName || '').toLowerCase().includes('concentrix');
      const isPrinting = (e.companyName || '').toLowerCase().includes('printing');
      const defLat = isCtx ? 10.694261 : isPrinting ? 10.742858 : e.registrationLocation?.lat;
      const defLng = isCtx ? 122.959987 : isPrinting ? 122.970088 : e.registrationLocation?.lng;
      const defRadius = isCtx || isPrinting ? 40 : (e.registrationRadius || e.registrationLocation?.radius || 40);

      if (!existing) {
        map.set(key, {
          id: e.id,
          name: e.name || 'HTE Supervisor',
          email: e.email || '',
          companyName: e.companyName || 'Host Establishment',
          companyAddress: e.companyAddress || e.registrationAddress || '',
          lat: defLat,
          lng: defLng,
          radius: defRadius,
          internCount: 0,
        });
      } else {
        if (!existing.lat && defLat) existing.lat = defLat;
        if (!existing.lng && defLng) existing.lng = defLng;
      }
    });

    employees.forEach((e) => {
      const isStudent = getEmployeeGroup(e) === 'student';
      if (isStudent && e.hteId) {
        const key = e.hteId.toLowerCase();
        const found = map.get(key);
        if (found) {
          found.internCount += 1;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [hostSupervisors, employees]);

  const isTraineeDeployed = (emp: Employee) => {
    const rawComp = (emp.companyName || '').trim();
    if (!rawComp || isInvalidHteCompany(rawComp)) {
      return false;
    }
    // Deployed if explicit valid hteId exists, or company name matches an available HTE establishment
    if (emp.hteId) {
      return true;
    }
    return (allAvailableHtes || []).some(
      (h) => h.id === emp.hteId || (h.companyName && h.companyName.trim().toLowerCase() === rawComp.toLowerCase())
    );
  };

  const filteredGroups = {
    pending: deduplicateAccounts(
      employees.filter(
        (e) =>
          // Pending is strictly for student trainees awaiting verification or HTE deployment
          getEmployeeGroup(e) === 'student' &&
          (e.active === false ||
            e.approvalStatus === 'pending' ||
            e.applicationStatus === 'pending' ||
            e.applicationStatus === 'unregistered' ||
            // null active with non-approved status = awaiting review
            (e.active == null && e.applicationStatus !== 'approved') ||
            !isTraineeDeployed(e)) &&
          matchesYear(e) &&
          matchesHteFilter(e, selectedHte) &&
          ((e.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.email || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.course || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(search.toLowerCase()))
      )
    ),
    student: deduplicateAccounts(
      employees.filter(
        (e) =>
          (e.active === true || e.active == null) &&
          e.approvalStatus !== 'pending' &&
          e.applicationStatus !== 'pending' &&
          e.applicationStatus !== 'unregistered' &&
          getEmployeeGroup(e) === 'student' &&
          isTraineeDeployed(e) &&
          matchesYear(e) &&
          matchesHteFilter(e, selectedHte) &&
          ((e.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.course || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(search.toLowerCase()))
      )
    ),
    instructor: deduplicateAccounts(
      employees.filter(
        (e) =>
          (e.active === true || e.active == null) &&
          e.approvalStatus !== 'pending' &&
          e.applicationStatus !== 'pending' &&
          getEmployeeGroup(e) === 'instructor' &&
          ((e.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(search.toLowerCase()))
      )
    ),
    hte: deduplicateAccounts([
      ...employees.filter(
        (e) =>
          (e.active === true || e.active == null) &&
          e.approvalStatus !== 'pending' &&
          e.applicationStatus !== 'pending' &&
          getEmployeeGroup(e) === 'hte' &&
          matchesYear(e) &&
          ((e.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(search.toLowerCase()))
      ),
      ...(hostSupervisors || []).map((h) => ({
        id: h.id,
        employeeId: h.employeeId || h.id,
        name: h.name,
        email: h.email,
        position: 'HTE Representative',
        role: 'hte',
        companyName: h.companyName,
        companyAddress: h.companyAddress,
        department: 'Host Establishment',
        supervisorName: h.name,
        phone: h.phone,
        contactPhone: h.phone,
        academicYear: h.academicYear || settings.activeAcademicYear,
        active: h.active !== false,
        approvalStatus: 'approved' as const,
        applicationStatus: 'approved' as const,
        requiredHours: 0,
        faceRegistered: false,
      } as Employee)).filter(
        (h) =>
          matchesYear(h) &&
          ((h.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (h.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
            (h.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
            (h.department || '').toLowerCase().includes(search.toLowerCase()))
      ),
    ]),
  };

  const hteDropdownOptions = useMemo(() => {
    const counts = new Map<string, number>();

    employees.forEach((e) => {
      if (getEmployeeGroup(e) !== 'student') return;
      if (!matchesYear(e)) return;
      const rawComp = (e.companyName || '').trim();
      if (!rawComp || isInvalidHteCompany(rawComp)) {
        counts.set('Unassigned', (counts.get('Unassigned') || 0) + 1);
      } else {
        counts.set(rawComp, (counts.get(rawComp) || 0) + 1);
      }
    });

    (allAvailableHtes || []).forEach((h) => {
      const name = (h.companyName || '').trim();
      if (name && !counts.has(name)) {
        counts.set(name, 0);
      }
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (a.name === 'Unassigned') return 1;
        if (b.name === 'Unassigned') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [employees, allAvailableHtes, selectedYear, settings?.academicYears, settings?.activeAcademicYear]);

  const deployableTrainees = useMemo(() => {
    return employees.filter((t) => {
      if (getEmployeeGroup(t) !== 'student') return false;
      if (t.approvalStatus === 'rejected') return false;
      if (!matchesYear(t)) return false;
      const matchesSearch =
        !deploySearch ||
        t.name.toLowerCase().includes(deploySearch.toLowerCase()) ||
        (t.employeeId && t.employeeId.toLowerCase().includes(deploySearch.toLowerCase())) ||
        (t.companyName && t.companyName.toLowerCase().includes(deploySearch.toLowerCase()));
      const matchesCourse = deployCourseFilter === 'all' || t.course === deployCourseFilter;
      const isAssigned = isTraineeDeployed(t);
      const matchesStatus =
        deployStatusFilter === 'all' ||
        (deployStatusFilter === 'unassigned' && !isAssigned) ||
        (deployStatusFilter === 'assigned' && isAssigned);
      return matchesSearch && matchesCourse && matchesStatus;
    });
  }, [employees, deploySearch, deployCourseFilter, deployStatusFilter, selectedYear, settings?.academicYears, settings?.activeAcademicYear, allAvailableHtes]);

  const handleBatchDeploy = async () => {
    if (!deployTargetHteId || deploySelectedStudentIds.length === 0) return;
    const matchedHte = allAvailableHtes.find((h) => h.id === deployTargetHteId);
    if (!matchedHte) {
      toast.error('Selected HTE not found.');
      return;
    }

    setIsDeploying(true);
    try {
      const isCtx = (matchedHte.companyName || '').toLowerCase().includes('concentrix');
      const hteLoc = resolveHteLocation(matchedHte, hostSupervisors, employees, geofenceZones) || {
        lat: isCtx ? 10.694261 : 10.742858,
        lng: isCtx ? 122.959987 : 122.970088,
        radius: 40,
        address: matchedHte.companyAddress || (isCtx ? 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod City' : 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines'),
        companyName: matchedHte.companyName,
      };

      const updatedFields: Partial<Employee> = {
        hteId: matchedHte.id,
        companyName: matchedHte.companyName,
        companyAddress: hteLoc.address,
        supervisorName: matchedHte.name,
        registrationLocation: {
          lat: Number(hteLoc.lat),
          lng: Number(hteLoc.lng),
          radius: hteLoc.radius,
          address: hteLoc.address,
        },
        registrationRadius: hteLoc.radius,
        registrationAddress: hteLoc.address,
        active: true,
        approvalStatus: 'approved',
        applicationStatus: 'approved',
      };

      const success = await batchUpdateEmployees(deploySelectedStudentIds, updatedFields);
      if (success) {
        toast.success(`Successfully assigned & deployed ${deploySelectedStudentIds.length} trainees to ${matchedHte.companyName}!`);
        setBatchDeployOpen(false);
        setDeploySelectedStudentIds([]);
        setDeployTargetHteId('');
      } else {
        toast.error('Failed to update trainees in database.');
      }
    } catch (err: any) {
      console.error('Batch deployment error:', err);
      toast.error('Deployment failed: ' + (err?.message || 'Error'));
    } finally {
      setIsDeploying(false);
    }
  };

  const totalFiltered = Object.values(filteredGroups).reduce((sum, items) => sum + items.length, 0);

  const openView = (emp: Employee) => {
    if (!emp) return;
    setSelectedEmp(emp);
    setFaceEnrollOpen(false);
    setEditingAddress(false);
    setAddressValue(resolveEmpHomeAddress(emp));
    setEditingPhone(false);
    setPhoneValue(resolveEmpPhone(emp));
    setModalMode('view');
  };

  const openReview = (emp: Employee) => {
    if (!emp) return;
    setSelectedEmp(emp);
    setFaceEnrollOpen(false);
    setEditingAddress(false);
    setEditingPhone(false);
    setModalMode('review');
  };

  const openEdit = (emp: Employee) => {
    if (!emp) return;
    setSelectedEmp(emp);
    setFaceEnrollOpen(false);
    setEditingAddress(false);
    setEditingPhone(false);
    setEditForm({
      name: emp.name || '',
      email: emp.email || '',
      contactPhone: resolveEmpPhone(emp) || '',
      employeeId: emp.employeeId || '',
      department: emp.department || '',
      position: emp.position || 'OJT Trainee',
      companyName: emp.companyName || '',
      companyAddress: (emp as any).companyAddress || (emp as any).registrationAddress || '',
      supervisorName: emp.supervisorName || '',
      hteId: emp.hteId || '',
      schoolName: emp.schoolName || 'Carlos Hilado Memorial State University',
      campus: emp.campus || '',
      course: emp.course || '',
      startDate: emp.startDate || '',
      endDate: emp.endDate || '',
      requiredHours: emp.requiredHours ?? 486,
      academicYear: emp.academicYear || settings?.activeAcademicYear || '2026-2027',
      residentialAddress: resolveEmpHomeAddress(emp) || '',
      documentsPassed: (() => {
        const isTrainee = emp.role === 'employee' || emp.role === 'trainee' || (!emp.position?.toLowerCase().includes('instructor') && !emp.position?.toLowerCase().includes('hte') && emp.position !== 'Administrator');
        if (!isTrainee) return emp.documentsPassed !== false;
        const missingCount = REQUIRED_TRAINEE_DOC_KEYS.filter((k) => !emp.submittedDocuments?.[k]?.dataUrl && !emp.submittedDocuments?.[k]?.name).length;
        return missingCount === 0 && emp.documentsPassed === true && emp.documentsStatus === 'passed';
      })(),
      documentsStatus: (() => {
        const isTrainee = emp.role === 'employee' || emp.role === 'trainee' || (!emp.position?.toLowerCase().includes('instructor') && !emp.position?.toLowerCase().includes('hte') && emp.position !== 'Administrator');
        if (!isTrainee) return (emp.documentsStatus as any) || 'passed';
        const missingCount = REQUIRED_TRAINEE_DOC_KEYS.filter((k) => !emp.submittedDocuments?.[k]?.dataUrl && !emp.submittedDocuments?.[k]?.name).length;
        if (missingCount > 0) return 'pending';
        return (emp.documentsStatus as any) || 'pending';
      })(),
      active: emp.active !== false,
      approvalStatus: emp.approvalStatus || 'approved',
    });
    setModalMode('edit');
  };

  const handleSaveEdit = async () => {
    if (!selectedEmp) return;
    if (!editForm.name.trim()) {
      toast.error('Full Name is required');
      return;
    }

    const matchedHost = allAvailableHtes.find(
      (h) =>
        (editForm.hteId && h.id === editForm.hteId) ||
        (editForm.companyName && h.companyName && h.companyName.toLowerCase().trim() === editForm.companyName.toLowerCase().trim())
    );

    let targetLoc: { lat: number; lng: number } | undefined = undefined;
    let hteRadius = 40;
    let hteAddress = editForm.companyAddress || '';

    const hteLookupCandidate = matchedHost || (editForm.companyName && !isInvalidHteCompany(editForm.companyName) ? { companyName: editForm.companyName, hteId: editForm.hteId } : null);

    if (hteLookupCandidate) {
      const hteLoc = resolveHteLocation(hteLookupCandidate, hostSupervisors, employees, geofenceZones);
      if (hteLoc) {
        targetLoc = { lat: hteLoc.lat, lng: hteLoc.lng };
        hteRadius = hteLoc.radius;
        hteAddress = hteLoc.address;
      }
    }

    const resolvedCompanyName = matchedHost ? matchedHost.companyName : (editForm.companyName.trim() || 'Printing Services');
    const resolvedSupervisorName = matchedHost ? matchedHost.name : (editForm.supervisorName.trim() || 'Jhey Ree');
    const resolvedHteId = matchedHost ? matchedHost.id : (editForm.hteId || (resolvedCompanyName.toLowerCase().includes('concentrix') ? '89405c66-015c-407a-937b-71ab37b829d7' : '95558630-499b-4aac-b869-ba64b0694e8c'));

    const updatedFields: any = {
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      contactPhone: editForm.contactPhone.trim(),
      phone: editForm.contactPhone.trim(),
      telephone: editForm.contactPhone.trim(),
      employeeId: editForm.employeeId.trim(),
      department: editForm.department,
      position: editForm.position,
      companyName: resolvedCompanyName,
      companyAddress: hteAddress || editForm.companyAddress || (selectedEmp as any).companyAddress,
      supervisorName: resolvedSupervisorName,
      hteId: resolvedHteId,
      schoolName: editForm.schoolName,
      campus: editForm.campus,
      course: editForm.course,
      startDate: editForm.startDate,
      endDate: editForm.endDate,
      requiredHours: Number(editForm.requiredHours) || 486,
      academicYear: editForm.academicYear,
      residentialAddress: editForm.residentialAddress.trim(),
      address: editForm.residentialAddress.trim(),
      documentsPassed: editForm.documentsPassed,
      documentsStatus: editForm.documentsPassed ? 'passed' : 'pending',
      active: editForm.active,
      approvalStatus: editForm.approvalStatus,
    };

    if (targetLoc) {
      updatedFields.registrationLocation = {
        lat: Number(targetLoc.lat),
        lng: Number(targetLoc.lng),
        radius: hteRadius,
        address: hteAddress,
      };
      updatedFields.registrationRadius = hteRadius;
      updatedFields.registrationAddress = hteAddress;
      updatedFields.companyAddress = hteAddress;
    }

    await updateEmployee(selectedEmp.id, updatedFields);

    if (targetLoc) {
      addGeofenceZone({
        id: `station-${selectedEmp.id}`,
        name: `${editForm.name.trim()} - Trainee Geofence (${resolvedCompanyName})`,
        address: hteAddress,
        lat: Number(targetLoc.lat),
        lng: Number(targetLoc.lng),
        radius: hteRadius,
        active: true,
        academicYear: editForm.academicYear || settings?.activeAcademicYear,
        employeeId: selectedEmp.id,
        userType: 'trainee',
      } as any);
    }

    setSelectedEmp((prev) => (prev ? { ...prev, ...updatedFields } : null));
    toast.success(`Account for ${editForm.name} updated successfully!`);
    setModalMode('view');
  };

  const updEdit = (field: string, val: any) => setEditForm((prev) => ({ ...prev, [field]: val }));

  const openAdd = () => {
    setForm(BLANK_FORM);
    setModalMode('add');
  };
  const closeModal = () => {
    setModalMode(null);
    setSelectedEmp(null);
    setFaceEnrollOpen(false);
  };

  const handleAdd = () => {
    registerEmployee({
      ...form,
      academicYear: selectedYear === 'all' ? settings.activeAcademicYear : selectedYear,
      requiredHours: Number(form.requiredHours),
      faceRegistered: false,
      active: true,
      approvalStatus: 'approved',
      applicationStatus: 'approved',
    });
    closeModal();
  };

  const handleDelete = (id: string) => {
    const emp = employees.find((e) => e.id === id || e.employeeId === id);
    const name = emp?.name || 'this account';
    if (confirm(`Permanently delete ${name} and remove all associated records from the system and database?`)) {
      deleteEmployee(id);
      if (selectedEmp?.id === id || selectedEmp?.employeeId === id) {
        closeModal();
      }
      toast.success(`${name} was deleted successfully.`);
    }
  };

  const handleApprove = (emp: Employee) => {
    const isDeployed = isTraineeDeployed(emp);
    if (!isDeployed) {
      setDeploySelectedStudentIds([emp.id]);
      setBatchDeployOpen(true);
      toast.info(`Please select a Host Training Establishment (HTE) to deploy and enroll ${emp.name}.`);
      return;
    }
    approveEmployee(emp.id);
    toast.success(`${emp.name} approved & enrolled for Academic Year ${settings.activeAcademicYear}!`);
  };

  const handleReject = (emp: Employee) => {
    if (confirm(`Decline registration request for ${emp.name}?`)) {
      rejectEmployee(emp.id);
      toast.info(`Registration for ${emp.name} declined.`);
    }
  };

  const getEmpStats = (empId: string) => {
    const targetEmp = employees.find((e) => e.id === empId || e.employeeId === empId);
    const validIds = new Set<string>();
    if (empId) validIds.add(empId);
    if (targetEmp?.id) validIds.add(targetEmp.id);
    if (targetEmp?.employeeId) validIds.add(targetEmp.employeeId);
    if (targetEmp?.email) validIds.add(targetEmp.email.toLowerCase());

    const recs = timeRecords.filter(
      (r) =>
        validIds.has(r.employeeId) ||
        (r.employeeId && validIds.has(r.employeeId.toLowerCase())) ||
        (targetEmp?.name && (r as any).employeeName === targetEmp.name)
    );
    const recordedHours = Math.round(recs.reduce((s, r) => s + (Number(r.totalHours) || 0), 0) * 10) / 10;
    const directHours = Number(targetEmp?.renderedHours) || Number((targetEmp?.registrationLocation as any)?.renderedHours) || 0;
    const totalHours = Math.max(recordedHours, directHours);
    const present = recs.filter((r) => r.status === 'present' || r.status === 'overtime').length || (totalHours > 0 ? Math.round(totalHours / 8) : 0);
    const late = recs.filter((r) => r.status === 'late').length;
    return { totalHours, present, late, totalDays: recs.length || (totalHours > 0 ? Math.round(totalHours / 8) : 0) };
  };

  const upd = (f: string, v: string | number) => setForm((p) => ({ ...p, [f]: v }));

  const groupConfig = {
    pending: {
      title: 'Pending Approvals',
      emptyText: 'No pending student enrollments or undeployed trainees awaiting approval',
      accent: 'amber',
      badge: 'bg-amber-100 text-amber-800 font-bold border border-amber-200',
    },
    student: {
      title: 'Active Trainees',
      emptyText: 'No active deployed trainees found for this academic year',
      accent: 'blue',
      badge: 'bg-blue-100 text-blue-800 font-bold border border-blue-200',
    },
    instructor: {
      title: 'OJT Instructors',
      emptyText: 'No instructor accounts found',
      accent: 'purple',
      badge: 'bg-purple-100 text-purple-800 font-bold border border-purple-200',
    },
    hte: {
      title: 'HTE Supervisors',
      emptyText: 'No HTE accounts found',
      accent: 'emerald',
      badge: 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200',
    },
  } as const;

  const renderEmployeeSection = (group: keyof typeof filteredGroups, countLabel: string) => {
    const items = filteredGroups[group];
    const config = groupConfig[group];
    const isPendingGroup = group === 'pending';
    const isInstructorGroup = group === 'instructor';
    const isHteGroup = group === 'hte';
    const isTraineeGroup = !isInstructorGroup && !isHteGroup;

    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1;
    const currentPage = Math.min(pageByGroup[group] || 1, totalPages);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // In "All Records" view, hide pending section if empty and no search
    if (isPendingGroup && items.length === 0 && search === '' && activeCategoryTab === 'all') return null;

    return (
      <div key={group} className={`bg-white rounded-2xl shadow-sm border ${isPendingGroup ? 'border-amber-200 ring-2 ring-amber-400/20' : 'border-gray-100'} overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-3 ${isPendingGroup ? 'bg-amber-50/80 border-b border-amber-100' : 'bg-gray-50 border-b border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${isPendingGroup ? 'text-amber-900' : 'text-gray-800'}`}>{config.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.badge}`}>{items.length}</span>
          </div>
          <div className="flex items-center gap-2.5">
            {(group === 'student' || group === 'pending') && (
              <button
                type="button"
                onClick={() => {
                  setDeploySelectedStudentIds([]);
                  setBatchDeployOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Building size={13} />
                <span>Deploy Trainees to HTE</span>
              </button>
            )}
            <span className="text-[11px] uppercase tracking-wide text-gray-400">{countLabel}</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8">
            <Users size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">{config.emptyText}</p>
          </div>
        ) : (
          paginatedItems.map((emp, idx) => {
            const stats = getEmpStats(emp.id);
            const progress = Math.min((stats.totalHours / (emp.requiredHours || 1)) * 100, 100);
            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <div
                  onClick={() => openView(emp)}
                  className={`hidden lg:grid ${isPendingGroup ? 'grid-cols-[2fr_1.5fr_1.5fr_auto]' : 'grid-cols-[2fr_1fr_1fr_1fr_auto]'} gap-4 items-center px-5 py-4 border-b border-gray-50 hover:bg-blue-50/60 cursor-pointer transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const photoUrl = getPhotoUrl(emp.photo);
                      const avatarClass = isInstructorGroup
                        ? 'bg-purple-100 text-purple-700'
                        : isHteGroup
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700';
                      return (
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative select-none ${avatarClass}`}>
                          <span className="font-bold text-sm">{emp.name.charAt(0)}</span>
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
                      <p className="font-semibold text-gray-800 text-sm hover:text-blue-700 transition-colors">{emp.name}</p>
                      <p className="text-xs text-gray-400">
                        {emp.employeeId} • {emp.email}
                      </p>
                      {emp.academicYear && isTraineeGroup && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                          A.Y. {emp.academicYear}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">{emp.department || 'General'}</p>
                    <p className="text-xs text-gray-400">{isInstructorGroup ? (emp.campus || 'CHMSU Campus') : (emp.course || emp.position)}</p>
                    {isTraineeGroup && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {(() => {
                          const isDeployed = Boolean(
                            (emp.hteId || (emp.companyName && !isInvalidHteCompany(emp.companyName))) &&
                            !isInvalidHteCompany(emp.companyName)
                          );
                          const displayHteName = (emp.companyName && !isInvalidHteCompany(emp.companyName))
                            ? emp.companyName
                            : (emp.hteId && hteLookup[emp.hteId]?.companyName ? hteLookup[emp.hteId].companyName : null);

                          if (isDeployed && displayHteName) {
                            return (
                              <>
                                <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                                  <Building size={11} className="text-blue-600 shrink-0" />
                                  HTE: {displayHteName}
                                </span>
                                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1 w-fit">
                                  <MapPin size={10} className="text-emerald-600" />
                                  Deployed to HTE ({emp.registrationLocation?.radius || 40}m)
                                </span>
                              </>
                            );
                          }
                          return (
                            <>
                              <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                                <Building size={11} className="text-amber-600 shrink-0" />
                                HTE: Unassigned
                              </span>
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1 w-fit">
                                <AlertTriangle size={10} className="text-amber-600" />
                                Awaiting Instructor Deployment
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  {isTraineeGroup ? (
                    !isPendingGroup ? (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{formatHoursAndMinutes(stats.totalHours)}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{emp.requiredHours}h required</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{emp.companyName || 'No Company Yet'}</p>
                        <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{emp.registrationAddress || 'Live GPS Centered'}</p>
                      </div>
                    )
                  ) : isInstructorGroup ? (
                    <div>
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                        Faculty Coordinator
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{emp.schoolName || 'CHMSU'}</p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        Industry Partner
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{emp.companyName || 'Partner Network'}</p>
                    </div>
                  )}
                  {isTraineeGroup && !isPendingGroup ? (
                    <div className="flex flex-col gap-1 items-start">
                      {(() => {
                        const missingDocsCount = REQUIRED_TRAINEE_DOC_KEYS.filter(
                          (k) => !emp.submittedDocuments?.[k]?.dataUrl && !emp.submittedDocuments?.[k]?.name
                        ).length;
                        const isFullyCertified = missingDocsCount === 0 && emp.documentsPassed === true && emp.documentsStatus === 'passed';
                        const isSubmittedPendingReview = missingDocsCount === 0 && (emp.documentsStatus === 'submitted' || (!isFullyCertified && emp.documentsStatus !== 'pending'));

                        return (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openReview(emp);
                              }}
                              className={`text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                                isFullyCertified
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                  : isSubmittedPendingReview
                                  ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300 ring-1 ring-blue-300/60'
                                  : 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300 ring-1 ring-amber-300/60'
                              }`}
                              title="Click to Review Trainee Compliance Documents"
                            >
                              {isFullyCertified ? (
                                <>
                                  <FileCheck size={12} className="text-emerald-600" /> Docs: Passed
                                </>
                              ) : isSubmittedPendingReview ? (
                                <>
                                  <CheckCircle2 size={12} className="text-blue-600" /> Docs: Submitted
                                </>
                              ) : (
                                <>
                                  <FileText size={12} className="text-amber-600 animate-pulse" /> Docs: Pending
                                </>
                              )}
                            </button>
                            {missingDocsCount > 0 ? (
                              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                ⚠️ {missingDocsCount} Missing
                              </span>
                            ) : (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                isFullyCertified
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : 'text-blue-700 bg-blue-50 border-blue-200'
                              }`}>
                                ✓ Complete ({REQUIRED_TRAINEE_DOCUMENTS.length}/{REQUIRED_TRAINEE_DOCUMENTS.length})
                              </span>
                            )}
                          </>
                        );
                      })()}
                      {emp.faceRegistered ? (
                        <span className="text-[10px] flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <Camera size={9} /> Face Enrolled
                        </span>
                      ) : (
                        <span className="text-[10px] flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                          <XCircle size={9} /> Face Pending
                        </span>
                      )}
                      {(() => {
                        const rawLat = emp.registrationLocation?.lat ?? (emp as any).registration_lat ?? (emp as any).registrationLat;
                        const rawLng = emp.registrationLocation?.lng ?? (emp as any).registration_lng ?? (emp as any).registrationLng;
                        if (rawLat != null && rawLng != null && !isWithinNegrosOccidental(rawLat, rawLng)) {
                          return (
                            <span className="text-[10px] flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-bold" title="Stored coordinates are outside Negros Occidental">
                              <AlertTriangle size={9} className="text-rose-600" /> Out-of-Region GPS
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : !isTraineeGroup ? (
                    <div>
                      <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        {isInstructorGroup ? 'Instructor Account' : 'Supervisor Account'}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {isPendingGroup ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeploySelectedStudentIds([emp.id]);
                            setBatchDeployOpen(true);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          title="Deploy Trainee to HTE"
                        >
                          <Building size={13} />
                          Deploy to HTE
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(emp);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          title="Accept & Enroll Trainee"
                        >
                          <CheckCircle size={13} />
                          Accept & Enroll
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(emp);
                          }}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                          title="Edit Trainee"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(emp);
                          }}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          title="Decline Request"
                        >
                          <XCircle size={13} />
                          Decline
                        </button>
                      </>
                    ) : (
                      <>
                        {/* View Profile Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openView(emp);
                          }}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                          title={isInstructorGroup ? "View Instructor Profile" : "View Trainee Profile"}
                        >
                          <Eye size={16} />
                        </button>

                        {/* Review Documents Button (Trainees Only) */}
                        {isTraineeGroup && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReview(emp);
                            }}
                            className="p-1.5 text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded-lg transition-all cursor-pointer"
                            title="Review Compliance Documents"
                          >
                            <FileCheck size={16} />
                          </button>
                        )}

                        {/* Edit Trainee/Account Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(emp);
                          }}
                          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                          title={isInstructorGroup ? "Edit Instructor Account" : "Edit Trainee Account"}
                        >
                          <Edit3 size={16} />
                        </button>

                        {/* 3-Dots Dropdown Menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === emp.id ? null : emp.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                            title="More actions"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {openMenuId === emp.id && (
                            <div
                              className="absolute right-0 top-8 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 w-52 text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  openView(emp);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                              >
                                <Eye size={14} className="text-blue-600" /> View Details
                              </button>

                              {isTraineeGroup && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    openReview(emp);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors cursor-pointer"
                                >
                                  <FileCheck size={14} className="text-violet-600" /> Review Documents
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  openEdit(emp);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                              >
                                <Edit3 size={14} className="text-amber-600" /> Edit Account Details
                              </button>

                              {isTraineeGroup && (
                                <button
                                  onClick={async () => {
                                    setOpenMenuId(null);
                                    const missingDocsCount = REQUIRED_TRAINEE_DOC_KEYS.filter(
                                      (k) => !emp.submittedDocuments?.[k]?.dataUrl && !emp.submittedDocuments?.[k]?.name
                                    ).length;
                                    const isCurrentlyPassed = missingDocsCount === 0 && emp.documentsPassed === true && emp.documentsStatus === 'passed';
                                    const willPass = !isCurrentlyPassed;
                                    const currentDocs = emp.submittedDocuments || {};
                                    const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
                                    const updatedDocs: TraineeDocuments = { ...currentDocs };
                                    docKeys.forEach((k) => {
                                      updatedDocs[k] = {
                                        ...(currentDocs[k] || {
                                          name: `${k}.pdf`,
                                          type: 'application/pdf',
                                          size: 0,
                                          uploadedAt: new Date().toISOString(),
                                        }),
                                        status: willPass ? 'passed' : 'pending',
                                      };
                                    });

                                    await updateEmployee(emp.id, {
                                      submittedDocuments: updatedDocs,
                                      documentsPassed: willPass,
                                      documentsStatus: willPass ? 'passed' : 'pending',
                                    });
                                    toast.success(willPass ? 'All documents marked as PASSED' : 'Documents marked as PENDING');
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 size={14} className="text-emerald-600" />
                                  {isCurrentlyPassed ? 'Set Docs as Pending' : 'Approve All Documents'}
                                </button>
                              )}

                              <div className="h-px bg-gray-100 my-1" />

                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleDelete(emp.id);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} /> {isInstructorGroup ? 'Delete Instructor' : 'Delete Trainee'}
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div
                  onClick={() => openView(emp)}
                  className="lg:hidden p-4 border-b border-gray-50 hover:bg-blue-50/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {(() => {
                      const photoUrl = getPhotoUrl(emp.photo);
                      const avatarClass = isInstructorGroup
                        ? 'bg-purple-100 text-purple-700'
                        : isHteGroup
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700';
                      return (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative select-none ${avatarClass}`}>
                          <span className="font-bold">{emp.name.charAt(0)}</span>
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
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm hover:text-blue-700">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.employeeId || emp.email}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {emp.department} • {isInstructorGroup ? (emp.campus || 'CHMSU Campus') : (emp.course || emp.position)}
                          </p>
                          {(() => {
                            const hasCustomGeo = Boolean(
                              emp.registrationLocation?.lat ||
                              (emp as any)?.registration_lat ||
                              geofenceZones.some((z) => z.id === `station-${emp.id}` || z.id === `personal-${emp.id}` || (z.name && emp.name && z.name.toLowerCase().includes(emp.name.toLowerCase())))
                            );
                            const matchedZone = geofenceZones.find((z) => z.id === `station-${emp.id}` || z.id === `personal-${emp.id}` || (z.name && emp.name && z.name.toLowerCase().includes(emp.name.toLowerCase())));
                            const zoneRadius = Math.max(20, Number(emp.registrationLocation?.radius || emp.registrationRadius || matchedZone?.radius || 40));

                            return (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {hasCustomGeo ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                    <MapPin size={10} /> Geofenced ({zoneRadius}m)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                    <MapPin size={10} /> Campus Geofence (40m)
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {isPendingGroup ? (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeploySelectedStudentIds([emp.id]);
                                  setBatchDeployOpen(true);
                                }}
                                className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Deploy
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(emp);
                                }}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReject(emp);
                                }}
                                className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openView(emp);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                title={isInstructorGroup ? "View Instructor Profile" : "View Trainee Profile"}
                              >
                                <Eye size={15} />
                              </button>
                              {isTraineeGroup && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReview(emp);
                                  }}
                                  className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg cursor-pointer"
                                  title="Review Documents"
                                >
                                  <FileCheck size={15} />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(emp);
                                }}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                                title={isInstructorGroup ? "Edit Instructor" : "Edit Trainee"}
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(emp.id);
                                }}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg cursor-pointer"
                                title={isInstructorGroup ? "Delete Instructor" : "Delete Trainee"}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {isTraineeGroup && !isPendingGroup && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatHoursAndMinutes(stats.totalHours)} / {emp.requiredHours}h ({Math.round(progress)}%)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-gray-50/75 border-t border-gray-100 text-xs">
            <span className="text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-800">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-gray-800">{Math.min(startIndex + ITEMS_PER_PAGE, items.length)}</span> of{' '}
              <span className="font-bold text-gray-800">{items.length}</span> {config.title.toLowerCase()}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPageByGroup((prev) => ({ ...prev, [group]: Math.max(1, currentPage - 1) }))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const pages = getPaginationWindow(currentPage, totalPages, 10);
                  return (
                    <>
                      {pages[0] > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPageByGroup((prev) => ({ ...prev, [group]: 1 }))}
                            className="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            1
                          </button>
                          {pages[0] > 2 && <span className="px-1 text-gray-400 font-bold">...</span>}
                        </>
                      )}

                      {pages.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPageByGroup((prev) => ({ ...prev, [group]: p }))}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            currentPage === p
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}

                      {pages[pages.length - 1] < totalPages && (
                        <>
                          {pages[pages.length - 1] < totalPages - 1 && (
                            <span className="px-1 text-gray-400 font-bold">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPageByGroup((prev) => ({ ...prev, [group]: totalPages }))}
                            className="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={() => setPageByGroup((prev) => ({ ...prev, [group]: Math.min(totalPages, currentPage + 1) }))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">OJT/Records</h2>
          <p className="text-sm text-gray-500">
            {filteredGroups.student.length} Active Trainees • Current Academic Year: <span className="font-semibold text-blue-700">A.Y. {settings.activeAcademicYear}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-gray-500">Academic Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs font-bold text-blue-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Academic Years</option>
              {settings.academicYears.map((ay) => (
                <option key={ay} value={ay}>
                  A.Y. {ay} {ay === settings.activeAcademicYear ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          {!isLoggedInInstructor && (
            <>
              <button
                onClick={async () => {
                  try {
                    setIsSyncing(true);
                    await refreshData();
                    toast.success('Database synchronized successfully!');
                  } catch {
                    toast.error('Failed to sync database');
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
                title="Sync latest trainee and instructor records from database"
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Database'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeploySelectedStudentIds([]);
                  setBatchDeployOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm cursor-pointer"
              >
                <Building size={15} />
                <span>Deploy Trainees to HTE</span>
              </button>
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm cursor-pointer"
              >
                <Plus size={15} />
                Add Trainee / Account
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top Metric Cards - Clickable to Switch Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(groupConfig).map(([key, config]) => (
          <div
            key={key}
            onClick={() => setActiveCategoryTab(key as any)}
            className={`rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${
              activeCategoryTab === key
                ? 'border-blue-500 ring-2 ring-blue-400/30 bg-blue-50/20'
                : key === 'pending' && filteredGroups.pending.length > 0
                ? 'border-amber-300 bg-amber-50/50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            } px-3 py-2`}
          >
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{config.title}</p>
            <p className={`text-lg font-bold ${key === 'pending' && filteredGroups.pending.length > 0 ? 'text-amber-700' : 'text-gray-800'}`}>
              {filteredGroups[key as keyof typeof filteredGroups].length}
            </p>
          </div>
        ))}
      </div>

      {/* Category Separation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveCategoryTab('student')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategoryTab === 'student'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <GraduationCap size={15} />
          Students / Trainees
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeCategoryTab === 'student' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {filteredGroups.student.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('instructor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategoryTab === 'instructor'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <ShieldCheck size={15} />
          OJT Instructors
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeCategoryTab === 'instructor' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {filteredGroups.instructor.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('hte')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategoryTab === 'hte'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Building size={15} />
          Host Establishments (HTE)
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeCategoryTab === 'hte' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {filteredGroups.hte.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategoryTab === 'pending'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Clock size={15} />
          Pending Approvals
          {filteredGroups.pending.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
              {filteredGroups.pending.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('documents')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategoryTab === 'documents'
              ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <FileCheck size={15} />
          Document Monitoring
          {docStats.pending > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
              {docStats.pending} Pending
            </span>
          ) : (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeCategoryTab === 'documents' ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {docStats.compliant}/{docStats.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategoryTab === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Users size={15} />
          All Records ({totalFiltered})
        </button>
      </div>

      {activeCategoryTab !== 'documents' && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, course, company, or department..."
                className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* HTE Dropdown Filter */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-2xs shrink-0">
              <Building size={15} className="text-gray-400 shrink-0" />
              <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">HTE:</span>
              <select
                value={selectedHte}
                onChange={(e) => setSelectedHte(e.target.value)}
                className="text-xs font-bold text-blue-700 bg-transparent focus:outline-none cursor-pointer max-w-[210px]"
                title="Filter trainees by Host Establishment"
              >
                <option value="all">All HTEs</option>
                {hteDropdownOptions.map((h) => (
                  <option key={h.name} value={h.name}>
                    {h.name} ({h.count} {h.count === 1 ? 'Trainee' : 'Trainees'})
                  </option>
                ))}
              </select>
              {selectedHte !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedHte('all')}
                  className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Reset HTE filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Active HTE Filter Indicator */}
          {selectedHte !== 'all' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-blue-800">
              <Building size={13} className="text-blue-600" />
              <span>
                Filtered by Host Establishment: <strong className="font-semibold text-blue-900">{selectedHte}</strong> ({filteredGroups.student.length} active {filteredGroups.student.length === 1 ? 'trainee' : 'trainees'})
              </span>
              <button
                type="button"
                onClick={() => setSelectedHte('all')}
                className="ml-auto text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
              >
                Clear HTE Filter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-5">
        {activeCategoryTab === 'documents' ? (
          /* Trainee Document Monitoring & Compliance Hub */
          <div className="space-y-6">
            {/* Hub Header & Mode Switcher */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                    <FileCheck size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      Trainee Document Monitoring & Compliance Hub
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Monitor, preview, verify, and certify onboarding credentials (PDFs, Images, and Documents) uploaded in registration or portal
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
                <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1 border border-gray-200/60">
                  <button
                    type="button"
                    onClick={() => setDocViewMode('monitoring')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      docViewMode === 'monitoring'
                        ? 'bg-white text-violet-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Users size={14} />
                    Trainee Submissions
                    {docStats.pending > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-extrabold animate-pulse">
                        {docStats.pending}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocViewMode('requirements')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      docViewMode === 'requirements'
                        ? 'bg-white text-violet-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileText size={14} />
                    Requirements Guidelines ({REQUIRED_TRAINEE_DOCUMENTS.length + (requiredDocuments?.length || 0)})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddDocModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Add Requirement
                </button>
              </div>
            </div>

            {docViewMode === 'monitoring' ? (
              /* Trainee Document Submissions Monitoring View */
              <div className="space-y-6">
                {/* 5 KPI Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Users size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-500">Total Trainees</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{docStats.total}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/20 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-500">Fully Compliant</p>
                        <p className="text-xl font-bold text-emerald-700 mt-0.5">
                          {docStats.compliant}
                          <span className="text-[10px] font-normal text-gray-500 ml-1">
                            ({Math.round((docStats.compliant / Math.max(1, docStats.total)) * 100)}%)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
                    docStats.pending > 0
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-white border-gray-100'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                        <Clock size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-500">Pending Review</p>
                        <p className="text-xl font-bold text-amber-800 mt-0.5">
                          {docStats.pending}
                          {docStats.pending > 0 && (
                            <span className="text-[9px] font-extrabold uppercase ml-1 px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-md">
                              Action Required
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        <AlertTriangle size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-500">Incomplete</p>
                        <p className="text-xl font-bold text-rose-700 mt-0.5">{docStats.incomplete}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                        <FileCheck size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-500">Uploaded Files</p>
                        <p className="text-xl font-bold text-violet-800 mt-0.5">{docStats.totalFilesUploaded}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        placeholder="Search student by name, student ID, course, or host company..."
                        value={docSearch}
                        onChange={(e) => {
                          setDocSearch(e.target.value);
                          setDocMonitoringPage(1);
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      />
                      {docSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setDocSearch('');
                            setDocMonitoringPage(1);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status Filter */}
                      <select
                        value={docFilterStatus}
                        onChange={(e) => {
                          setDocFilterStatus(e.target.value as any);
                          setDocMonitoringPage(1);
                        }}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      >
                        <option value="all">All Statuses ({docStats.total})</option>
                        <option value="pending">⏳ Needs Review ({docStats.pending})</option>
                        <option value="compliant">✓ Fully Compliant ({docStats.compliant})</option>
                        <option value="incomplete">⚠️ Incomplete ({docStats.incomplete})</option>
                      </select>

                      {/* Requirement Filter */}
                      <select
                        value={docFilterRequirement}
                        onChange={(e) => {
                          setDocFilterRequirement(e.target.value);
                          setDocMonitoringPage(1);
                        }}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 max-w-[200px]"
                      >
                        <option value="all">All 10 Requirements</option>
                        {REQUIRED_TRAINEE_DOCUMENTS.map((req) => (
                          <option key={req.key} value={req.key}>
                            {req.num}. {req.title}
                          </option>
                        ))}
                      </select>

                      {/* Course Filter */}
                      {availableDocCourses.length > 0 && (
                        <select
                          value={docFilterCourse}
                          onChange={(e) => {
                            setDocFilterCourse(e.target.value);
                            setDocMonitoringPage(1);
                          }}
                          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 max-w-[180px]"
                        >
                          <option value="all">All Programs ({availableDocCourses.length})</option>
                          {availableDocCourses.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      )}

                      {(docSearch || docFilterStatus !== 'all' || docFilterRequirement !== 'all' || docFilterCourse !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setDocSearch('');
                            setDocFilterStatus('all');
                            setDocFilterRequirement('all');
                            setDocFilterCourse('all');
                            setDocMonitoringPage(1);
                          }}
                          className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trainees Document Monitoring Table */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                        <span>Trainee Compliance & Document Verification</span>
                        <span className="text-xs font-normal text-gray-500">
                          ({filteredDocTrainees.length} {filteredDocTrainees.length === 1 ? 'trainee' : 'trainees'})
                        </span>
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Inspect attached files, preview PDFs and pictures, verify compliance, or certify all requirements.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="px-5 py-3.5">Student Trainee</th>
                          <th className="px-4 py-3.5">Compliance Progress</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5">Uploaded Credentials Matrix</th>
                          <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {paginatedDocTrainees.map((trainee) => {
                          const docs = trainee.submittedDocuments || {};
                          const uploadedCount = REQUIRED_TRAINEE_DOC_KEYS.filter((k) => Boolean(docs[k]?.dataUrl || docs[k]?.name)).length;
                          const passedCount = REQUIRED_TRAINEE_DOC_KEYS.filter((k) => docs[k]?.status === 'passed').length;
                          const hasPending = REQUIRED_TRAINEE_DOC_KEYS.some((k) => docs[k]?.status === 'pending' && Boolean(docs[k]?.dataUrl || docs[k]?.name));
                          const isCompliant = passedCount === REQUIRED_TRAINEE_DOC_KEYS.length || (trainee.documentsPassed === true && trainee.documentsStatus === 'passed');
                          const photoUrl = getPhotoUrl(trainee.photo);

                          return (
                            <tr key={trainee.id} className="hover:bg-slate-50/60 transition-colors">
                              {/* Trainee Profile */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-violet-200">
                                    {photoUrl ? (
                                      <img src={photoUrl} alt={trainee.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{trainee.name?.slice(0, 2).toUpperCase() || 'TR'}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-900 text-sm truncate" title={trainee.name}>
                                      {trainee.name}
                                    </p>
                                    <p className="text-[11px] font-mono text-gray-500 mt-0.5">{trainee.employeeId}</p>
                                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                                      <span className="truncate max-w-[140px] text-blue-700 font-medium">{trainee.course || 'BS Information Systems'}</span>
                                      {trainee.companyName && (
                                        <>
                                          <span>•</span>
                                          <span className="truncate max-w-[140px] text-gray-600 flex items-center gap-1">
                                            <Building size={11} className="text-gray-400" />
                                            {trainee.companyName}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Progress bar */}
                              <td className="px-4 py-4 min-w-[160px]">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-gray-700">{passedCount}/10 Passed</span>
                                    <span className="text-gray-500 font-mono text-[10px]">{uploadedCount} uploaded</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200/60">
                                    <div
                                      className={`h-full transition-all duration-300 rounded-full ${
                                        isCompliant
                                          ? 'bg-emerald-500'
                                          : hasPending
                                          ? 'bg-amber-500'
                                          : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${Math.min(100, Math.round((passedCount / 10) * 100))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                    isCompliant
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : hasPending
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {isCompliant ? (
                                    <>
                                      <CheckCircle2 size={11} className="text-emerald-700" /> Certified
                                    </>
                                  ) : hasPending ? (
                                    <>
                                      <Clock size={11} className="text-amber-700" /> Needs Review
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle size={11} className="text-slate-600" /> Incomplete
                                    </>
                                  )}
                                </span>
                              </td>

                              {/* Documents Interactive Matrix */}
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-1 max-w-[340px]">
                                  {REQUIRED_TRAINEE_DOCUMENTS.map((req) => {
                                    const doc = docs[req.key];
                                    const isDocPassed = doc?.status === 'passed';
                                    const hasFile = Boolean(doc?.dataUrl || doc?.name);
                                    const isPendingDoc = hasFile && !isDocPassed;

                                    if (isDocPassed) {
                                      return (
                                        <button
                                          key={req.id}
                                          type="button"
                                          onClick={() =>
                                            setPreviewInstructorDoc({
                                              studentName: trainee.name,
                                              studentId: trainee.employeeId,
                                              title: `${req.num}. ${req.title}`,
                                              fileName: doc?.name || `${req.key}.pdf`,
                                              fileUrl: doc?.dataUrl || undefined,
                                              note: doc?.name
                                                ? `Uploaded file: ${doc.name}${doc.source ? ` • Uploaded in ${doc.source === 'registration' ? 'Registration' : 'Portal'}` : ''}`
                                                : `Verified requirement.`,
                                              date: doc?.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Recorded',
                                            })
                                          }
                                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                          title={`${req.title}: PASSED (Click to preview)`}
                                        >
                                          <Check size={9} className="stroke-[3]" />
                                          <span className="truncate max-w-[80px]">{req.title.split(' ')[0]}</span>
                                        </button>
                                      );
                                    }

                                    if (isPendingDoc) {
                                      return (
                                        <button
                                          key={req.id}
                                          type="button"
                                          onClick={() =>
                                            setPreviewInstructorDoc({
                                              studentName: trainee.name,
                                              studentId: trainee.employeeId,
                                              title: `${req.num}. ${req.title}`,
                                              fileName: doc?.name || `${req.key}.pdf`,
                                              fileUrl: doc?.dataUrl || undefined,
                                              note: doc?.name
                                                ? `Attached: ${doc.name} (Awaiting Coordinator Review)${doc.source ? ` • Uploaded in ${doc.source === 'registration' ? 'Registration' : 'Portal'}` : ''}`
                                                : undefined,
                                              date: doc?.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Recent submission',
                                            })
                                          }
                                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors inline-flex items-center gap-1 cursor-pointer animate-pulse"
                                          title={`${req.title}: Attached & Pending Review (Click to preview)`}
                                        >
                                          <Clock size={9} />
                                          <span className="truncate max-w-[80px]">{req.title.split(' ')[0]}</span>
                                        </button>
                                      );
                                    }

                                    return (
                                      <span
                                        key={req.id}
                                        className="px-1.5 py-0.5 rounded text-[10px] text-gray-300 font-mono"
                                        title={`${req.title}: Not submitted`}
                                      >
                                        —
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="px-5 py-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openReview(trainee)}
                                    className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-violet-200 transition-all cursor-pointer"
                                  >
                                    <Eye size={13} /> Review Docs
                                  </button>

                                  {!isCompliant && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const currentDocs = trainee.submittedDocuments || {};
                                        const updatedDocs: TraineeDocuments = { ...currentDocs };
                                        REQUIRED_TRAINEE_DOC_KEYS.forEach((k) => {
                                          updatedDocs[k] = {
                                            ...(currentDocs[k] || {
                                              name: `${k}.pdf`,
                                              fileType: 'application/pdf',
                                              size: 0,
                                              uploadedAt: new Date().toISOString(),
                                            }),
                                            status: 'passed',
                                          };
                                        });

                                        await updateEmployee(trainee.id, {
                                          submittedDocuments: updatedDocs,
                                          documentsPassed: true,
                                          documentsStatus: 'passed',
                                        });
                                        toast.success(`All 10 documents certified as PASSED for ${trainee.name}!`);
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer"
                                      title="One-click certify all documents"
                                    >
                                      <CheckCircle2 size={13} /> Certify All
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {paginatedDocTrainees.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-400">
                              <FileCheck size={36} className="mx-auto mb-2 opacity-30" />
                              <p className="font-semibold text-sm text-gray-700">No trainees matched your filter</p>
                              <p className="text-xs text-gray-400 mt-1">Try resetting search keywords or changing the status filter.</p>
                              {(docSearch || docFilterStatus !== 'all' || docFilterRequirement !== 'all' || docFilterCourse !== 'all') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDocSearch('');
                                    setDocFilterStatus('all');
                                    setDocFilterRequirement('all');
                                    setDocFilterCourse('all');
                                    setDocMonitoringPage(1);
                                  }}
                                  className="mt-3 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-100 transition-colors"
                                >
                                  Reset Filters
                                </button>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalDocPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-100 text-xs text-gray-500">
                      <div>
                        Showing <strong className="text-gray-900">{(docMonitoringPage - 1) * docMonitoringPerPage + 1}</strong> to{' '}
                        <strong className="text-gray-900">{Math.min(docMonitoringPage * docMonitoringPerPage, filteredDocTrainees.length)}</strong> of{' '}
                        <strong className="text-gray-900">{filteredDocTrainees.length}</strong> trainees
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDocMonitoringPage((p) => Math.max(1, p - 1))}
                          disabled={docMonitoringPage === 1}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronLeft size={15} />
                        </button>
                        {Array.from({ length: totalDocPages }, (_, i) => i + 1).map((pg) => (
                          <button
                            key={pg}
                            type="button"
                            onClick={() => setDocMonitoringPage(pg)}
                            className={`min-w-[28px] h-7 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                              docMonitoringPage === pg
                                ? 'bg-violet-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {pg}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDocMonitoringPage((p) => Math.min(totalDocPages, p + 1))}
                          disabled={docMonitoringPage === totalDocPages}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Requirements Guidelines & Setup View */
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <FileCheck size={20} className="text-violet-600" />
                      Standard Mandatory OJT Requirements ({REQUIRED_TRAINEE_DOCUMENTS.length})
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Official institutional documents required for trainee onboarding, deployment, and final completion across CHMSU.
                    </p>
                  </div>
                </div>

                {/* Standard 10 Mandatory Documents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {REQUIRED_TRAINEE_DOCUMENTS.map((doc) => (
                    <div key={doc.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between hover:bg-white hover:shadow-xs transition-all">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-black flex items-center justify-center">
                              {doc.num}
                            </span>
                            {doc.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Mandatory
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-blue-700">{doc.subtitle}</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{doc.desc}</p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Status: Institutional Standard</span>
                        <span className="font-semibold text-emerald-600">Active Requirement</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Departmental Documents (if any) */}
                {requiredDocuments && requiredDocuments.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} className="text-violet-600" />
                      Additional Departmental Requirements ({requiredDocuments.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {requiredDocuments.map((doc, idx) => (
                        <div key={doc.id} className="p-4 rounded-2xl border border-violet-200 bg-violet-50/30 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-bold text-gray-900 flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-violet-100 text-violet-800 text-[10px] font-black flex items-center justify-center">
                                  {REQUIRED_TRAINEE_DOCUMENTS.length + idx + 1}
                                </span>
                                {doc.title}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                                  Custom Requirement
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Remove "${doc.title}" from required documents?`)) {
                                      deleteRequiredDocument(doc.id);
                                      toast.success(`"${doc.title}" removed.`);
                                    }
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                  title="Delete requirement"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            {doc.description && <p className="text-xs text-gray-600 mt-1">{doc.description}</p>}
                            {doc.notes && <p className="text-[11px] text-gray-500 mt-1 italic">Notes: {doc.notes}</p>}
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-violet-100 flex items-center justify-between text-[11px] text-gray-400">
                            <span>Due: {doc.dueDate || 'Prior to Deployment'}</span>
                            <span className="text-violet-700 font-semibold">A.Y. {doc.academicYear || settings.activeAcademicYear}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : totalFiltered === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-12">
            <Users size={40} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No records found</p>
          </div>
        ) : activeCategoryTab === 'all' ? (
          (['pending', 'student', 'instructor', 'hte'] as const).map((group) => renderEmployeeSection(group, groupConfig[group].title))
        ) : (
          renderEmployeeSection(activeCategoryTab, groupConfig[activeCategoryTab].title)
        )}
      </div>

      {/* Add Custom Required Document Modal */}
      <AnimatePresence>
        {showAddDocModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Add New Required Document</h3>
                  <p className="text-xs text-gray-500">Students will be prompted to upload this document in their portal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddDocModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Document Title *</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. Barangay Clearance, PhilHealth ID, Certificate of Good Moral"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Description / Instructions</label>
                  <textarea
                    rows={2}
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    placeholder="Describe what the student needs to submit (e.g. Photocopy or clear photo with official stamp)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Special Notes / Requirements</label>
                  <input
                    type="text"
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    placeholder="e.g. Must be certified true copy or verified by OJT Coordinator"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Due Date / Milestone</label>
                  <input
                    type="text"
                    value={docDueDate}
                    onChange={(e) => setDocDueDate(e.target.value)}
                    placeholder="e.g. Prior to HTE Deployment or specify date"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddDocModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!docTitle.trim()) {
                      toast.error('Document title is required');
                      return;
                    }
                    addRequiredDocument('all', {
                      title: docTitle.trim(),
                      description: docDescription.trim(),
                      notes: docNotes.trim(),
                      dueDate: docDueDate.trim(),
                      required: true,
                      academicYear: selectedYear === 'all' ? settings.activeAcademicYear : selectedYear,
                    });
                    setDocTitle('');
                    setDocDescription('');
                    setDocNotes('');
                    setDocDueDate('');
                    setShowAddDocModal(false);
                    toast.success('New required document added! Trainees can now submit this credential.');
                  }}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200 transition-all cursor-pointer"
                >
                  Save Required Document
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {modalMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-20">
                <div>
                  <h3 className="font-bold text-gray-800 text-base">
                    {modalMode === 'view'
                      ? selectedEmp && getEmployeeGroup(selectedEmp) === 'instructor'
                        ? `${selectedEmp.name} (Instructor)`
                        : selectedEmp && getEmployeeGroup(selectedEmp) === 'hte'
                        ? `${selectedEmp.name} (HTE Supervisor)`
                        : `${selectedEmp?.name}`
                      : modalMode === 'edit'
                      ? `Edit Account: ${editForm.name || selectedEmp?.name || 'Trainee'}`
                      : modalMode === 'review'
                      ? `Document Compliance: ${selectedEmp?.name || 'Trainee'}`
                      : 'Add New Trainee'}
                  </h3>
                  {selectedEmp && modalMode !== 'add' && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {selectedEmp.employeeId || 'ID Pending'} • {selectedEmp.course || selectedEmp.department || 'CHMSU'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedEmp && (
                    <>
                      {getEmployeeGroup(selectedEmp) === 'student' && modalMode !== 'review' && (
                        <button
                          type="button"
                          onClick={() => openReview(selectedEmp)}
                          className="px-2.5 py-1.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Review Trainee Compliance Documents"
                        >
                          <FileCheck size={14} />
                          <span className="hidden sm:inline">Review Docs</span>
                        </button>
                      )}
                      {modalMode !== 'edit' ? (
                        <button
                          type="button"
                          onClick={() => openEdit(selectedEmp)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit Account Details"
                        >
                          <Edit3 size={14} />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openView(selectedEmp)}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="View Profile Details"
                        >
                          <Eye size={14} />
                          <span className="hidden sm:inline">View Profile</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedEmp.id)}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title={
                          getEmployeeGroup(selectedEmp) === 'instructor'
                            ? 'Permanently Delete Instructor'
                            : getEmployeeGroup(selectedEmp) === 'hte'
                            ? 'Permanently Delete HTE Supervisor'
                            : 'Permanently Delete Trainee'
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                  <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                {modalMode === 'view' && selectedEmp ? (
                  faceEnrollOpen ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">Enroll face — {selectedEmp.name}</p>
                          <p className="text-xs text-gray-500">
                            Use a clear, frontal photo. Saved to the Django server for clock-in verification.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFaceEnrollOpen(false)}
                          className="text-xs text-gray-500 hover:text-gray-800"
                        >
                          Back
                        </button>
                      </div>
                      <FaceCapture
                        mode="register"
                        employeeName={selectedEmp.name}
                        autoStart
                        onSuccess={async (imageData) => {
                          if (!imageData) {
                            toast.error('No image captured. Try again or allow the camera.');
                            setFaceEnrollOpen(false);
                            return;
                          }
                          try {
                            const res = await registerFace({ employee_id: selectedEmp.id, image: imageData });
                            if (res.success && res.image_url) {
                              updateEmployee(selectedEmp.id, { photo: res.image_url, faceRegistered: true });
                              setSelectedEmp({ ...selectedEmp, photo: res.image_url, faceRegistered: true });
                              toast.success('Face enrolled on server. Trainee can use clock-in verification.');
                            } else {
                              toast.error(res.message || 'Registration failed');
                            }
                          } catch (e) {
                            toast.error(
                              e instanceof Error
                                ? e.message
                                : 'Could not reach the security API. Check URL and API key.'
                            );
                          }
                          setFaceEnrollOpen(false);
                        }}
                        onCancel={() => setFaceEnrollOpen(false)}
                      />
                    </div>
                  ) : (
                    (() => {
                      const empGroup = getEmployeeGroup(selectedEmp);
                      const isInstructor = empGroup === 'instructor';
                      const isHTE = empGroup === 'hte';
                      const isTrainee = !isInstructor && !isHTE;

                      return (
                        <div className="space-y-4">
                          {/* Profile header */}
                          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl">
                            {(() => {
                              const photoUrl = getPhotoUrl(selectedEmp.photo);
                              return (
                                <div className="w-16 h-16 bg-blue-200 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 relative select-none">
                                  <User size={28} className="text-blue-700" />
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
                            <div className="flex-1">
                              <p className="font-bold text-blue-900">{selectedEmp.name}</p>
                              <p className="text-blue-600 text-sm">{selectedEmp.employeeId}</p>
                              
                              {isInstructor ? (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <span className="text-xs flex items-center gap-1 text-indigo-700 bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                                    OJT Instructor (Faculty)
                                  </span>
                                  <span className="text-xs flex items-center gap-1 text-blue-700 bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 rounded-full font-medium">
                                    {selectedEmp.department || 'CCS Department'}
                                  </span>
                                </div>
                              ) : isHTE ? (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <span className="text-xs flex items-center gap-1 text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                                    HTE Supervisor
                                  </span>
                                  <span className="text-xs flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                                    {selectedEmp.companyName || 'Host Establishment'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {(() => {
                                    const missingCount = REQUIRED_TRAINEE_DOC_KEYS.filter(
                                      (k) => !selectedEmp.submittedDocuments?.[k]?.dataUrl && !selectedEmp.submittedDocuments?.[k]?.name
                                    ).length;
                                    const isPassed = missingCount === 0 && selectedEmp.documentsPassed === true && selectedEmp.documentsStatus === 'passed';
                                    const isSubmitted = missingCount === 0 && (selectedEmp.documentsStatus === 'submitted' || (!isPassed && selectedEmp.documentsStatus !== 'pending'));

                                    if (isPassed) {
                                      return (
                                        <span className="text-xs flex items-center gap-1 text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                                          <FileCheck size={11} className="text-emerald-600" /> Documents: Passed
                                        </span>
                                      );
                                    }
                                    if (isSubmitted) {
                                      return (
                                        <span className="text-xs flex items-center gap-1 text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                                          <CheckCircle2 size={11} className="text-blue-600" /> Documents: Submitted
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-xs flex items-center gap-1 text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                                        <FileText size={11} className="text-amber-600" /> Documents: Pending
                                      </span>
                                    );
                                  })()}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const missingDocs = REQUIRED_TRAINEE_DOC_KEYS.filter(
                                        (k) => !selectedEmp.submittedDocuments?.[k]?.dataUrl && !selectedEmp.submittedDocuments?.[k]?.name
                                      ).length;
                                      const isCurrentlyPassed = missingDocs === 0 && selectedEmp.documentsPassed === true && selectedEmp.documentsStatus === 'passed';
                                      const willPass = !isCurrentlyPassed;
                                      const currentDocs = selectedEmp.submittedDocuments || {};
                                      const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
                                      const updatedDocs: TraineeDocuments = { ...currentDocs };
                                      docKeys.forEach((k) => {
                                        updatedDocs[k] = {
                                          ...(currentDocs[k] || {
                                            name: `${k}.pdf`,
                                            type: 'application/pdf',
                                            size: 0,
                                            uploadedAt: new Date().toISOString(),
                                          }),
                                          status: willPass ? 'passed' : 'pending',
                                        };
                                      });

                                      await updateEmployee(selectedEmp.id, {
                                        submittedDocuments: updatedDocs,
                                        documentsPassed: willPass,
                                        documentsStatus: willPass ? 'passed' : 'pending',
                                      });
                                      setSelectedEmp({
                                        ...selectedEmp,
                                        submittedDocuments: updatedDocs,
                                        documentsPassed: willPass,
                                        documentsStatus: willPass ? 'passed' : 'pending',
                                      });
                                      toast.success(willPass ? 'Registration documents marked as PASSED!' : 'Registration documents marked as PENDING');
                                    }}
                                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline ml-1 cursor-pointer"
                                  >
                                    Toggle Status
                                  </button>
                                  {selectedEmp.faceRegistered ? (
                                    <span className="text-xs flex items-center gap-0.5 text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                      <Camera size={10} /> Face Enrolled
                                    </span>
                                  ) : (
                                    <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                                      Not Enrolled
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Quick Action Buttons */}
                              <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-blue-200/60">
                                {isTrainee && (
                                  <button
                                    type="button"
                                    onClick={() => openReview(selectedEmp)}
                                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                                  >
                                    <FileCheck size={13} /> Review Documents
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEdit(selectedEmp)}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                                >
                                  <Edit3 size={13} /> Edit Account Info
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Contact / Telephone Number */}
                          <div className="mt-3">
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Contact / Telephone Number</label>
                            {!editingPhone ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm text-gray-700 font-mono">
                                  {resolveEmpPhone(selectedEmp) || '—'}
                                </div>
                                <button
                                  onClick={() => {
                                    setPhoneValue(resolveEmpPhone(selectedEmp));
                                    setEditingPhone(true);
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  Edit
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  value={phoneValue}
                                  onChange={(e) => setPhoneValue(e.target.value)}
                                  placeholder="+639123456789"
                                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono"
                                />
                                <button
                                  onClick={async () => {
                                    if (!selectedEmp) return;
                                    await updateEmployee(selectedEmp.id, {
                                      phone: phoneValue,
                                      contactPhone: phoneValue,
                                      telephone: phoneValue,
                                    });
                                    setSelectedEmp({
                                      ...selectedEmp,
                                      phone: phoneValue,
                                      contactPhone: phoneValue,
                                      telephone: phoneValue,
                                    });
                                    setEditingPhone(false);
                                    toast.success('Contact number updated');
                                  }}
                                  className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPhone(false);
                                    setPhoneValue(resolveEmpPhone(selectedEmp));
                                  }}
                                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Residential Home Address */}
                          <div className="mt-3">
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Residential Address (Home)</label>
                            {!editingAddress ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm text-gray-700">{resolveEmpHomeAddress(selectedEmp) || '—'}</div>
                                <button
                                  onClick={() => {
                                    setAddressValue(resolveEmpHomeAddress(selectedEmp));
                                    setEditingAddress(true);
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  Edit
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  value={addressValue}
                                  onChange={(e) => setAddressValue(e.target.value)}
                                  placeholder="House No., Street, Barangay, City, Province"
                                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                                />
                                <button
                                  onClick={async () => {
                                    if (!selectedEmp) return;
                                    await updateEmployee(selectedEmp.id, {
                                      residentialAddress: addressValue,
                                      address: addressValue,
                                    });
                                    setSelectedEmp({
                                      ...selectedEmp,
                                      residentialAddress: addressValue,
                                      address: addressValue,
                                    });
                                    setEditingAddress(false);
                                    toast.success('Residential address updated');
                                  }}
                                  className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingAddress(false);
                                    setAddressValue(resolveEmpHomeAddress(selectedEmp));
                                  }}
                                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Attendance Stats - Trainees ONLY */}
                          {isTrainee && (() => {
                            const stats = getEmpStats(selectedEmp.id);
                            return (
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-green-50 rounded-xl p-3 text-center">
                                  <p className="font-bold text-green-700">{stats.present}</p>
                                  <p className="text-xs text-gray-500">Present</p>
                                </div>
                                <div className="bg-orange-50 rounded-xl p-3 text-center">
                                  <p className="font-bold text-orange-700">{stats.late}</p>
                                  <p className="text-xs text-gray-500">Late</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-3 text-center">
                                  <p className="font-bold text-blue-700">{formatHoursAndMinutes(stats.totalHours)}</p>
                                  <p className="text-xs text-gray-500">Hours</p>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Account Detail Attributes */}
                          {(isInstructor
                            ? [
                                { label: 'Email', val: selectedEmp.email },
                                { label: 'Contact Phone', val: resolveEmpPhone(selectedEmp) || 'Not specified' },
                                { label: 'Faculty ID', val: selectedEmp.employeeId },
                                { label: 'Department', val: selectedEmp.department || 'College of Computer Studies' },
                                { label: 'School', val: selectedEmp.schoolName || 'Carlos Hilado Memorial State University' },
                                { label: 'Campus', val: selectedEmp.campus || 'Talisay (Main Campus)' },
                                { label: 'Position', val: selectedEmp.position || 'OJT Instructor' },
                              ]
                            : isHTE
                            ? [
                                { label: 'Email', val: selectedEmp.email },
                                { label: 'Contact Phone', val: resolveEmpPhone(selectedEmp) || 'Not specified' },
                                { label: 'Supervisor ID', val: selectedEmp.employeeId },
                                { label: 'Company', val: selectedEmp.companyName || 'Host Training Establishment' },
                                { label: 'Department', val: selectedEmp.department || 'Internship Division' },
                                { label: 'Campus / Branch', val: selectedEmp.campus || 'Partner Network' },
                                { label: 'Position', val: selectedEmp.position || 'HTE Representative' },
                              ]
                            : [
                                { label: 'Email', val: selectedEmp.email || 'Not specified' },
                                { label: 'Contact Phone', val: resolveEmpPhone(selectedEmp) || 'Not specified' },
                                { label: 'Department', val: selectedEmp.department || 'Not specified' },
                                { label: 'Company', val: selectedEmp.companyName || 'Not specified' },
                                { label: 'Supervisor', val: selectedEmp.supervisorName || 'Not specified' },
                                { label: 'School', val: selectedEmp.schoolName || 'Carlos Hilado Memorial State University' },
                                { label: 'Campus', val: selectedEmp.campus || 'Not specified' },
                                { label: 'Course', val: selectedEmp.course || 'Not specified' },
                                { label: 'OJT Period', val: `${selectedEmp.startDate || '—'} → ${selectedEmp.endDate || '—'}` },
                                { label: 'Required Hours', val: `${selectedEmp.requiredHours ?? 486} hrs` },
                                {
                                  label: 'Requirements',
                                  val: (() => {
                                    try {
                                      const summary = getEmployeeRequirementSummary(selectedEmp.id);
                                      return `${summary?.complete ?? 0} complete, ${summary?.incomplete ?? 0} incomplete, ${summary?.missing ?? 0} missing`;
                                    } catch {
                                      return 'Credentials active';
                                    }
                                  })(),
                                },
                              ]
                          ).map(({ label, val }) => (
                            <div key={label} className="flex gap-3 text-sm border-b border-gray-50 pb-2 last:border-0">
                              <span className="text-gray-400 w-28 shrink-0">{label}</span>
                              <span className="font-medium text-gray-700">{val}</span>
                            </div>
                          ))}

                          {/* HTE Placement & Assignment - Trainees ONLY */}
                          {isTrainee && (
                            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Building size={16} className="text-blue-600" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                                    HTE Placement
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigningHte(!assigningHte);
                                    setSelectedHteId(selectedEmp.hteId || '');
                                  }}
                                  className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                                >
                                  {assigningHte ? 'Cancel' : selectedEmp.companyName && !selectedEmp.companyName.toLowerCase().includes('pending') ? 'Change HTE' : 'Assign to HTE'}
                                </button>
                              </div>

                              {assigningHte ? (
                                <div className="space-y-2 pt-1">
                                  <label className="text-xs font-medium text-slate-700 block">Select Host Training Establishment (HTE):</label>
                                  <select
                                    value={selectedHteId}
                                    onChange={(e) => setSelectedHteId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="">-- Choose Host Supervisor / Company --</option>
                                    {allAvailableHtes.map((h) => (
                                      <option key={h.id} value={h.id}>
                                        {h.companyName} — {h.name} ({h.email})
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      disabled={!selectedHteId}
                                      onClick={async () => {
                                        const matchedHost = allAvailableHtes.find((h) => h.id === selectedHteId);
                                        if (!matchedHost) return;

                                        const isCtx = (matchedHost.companyName || '').toLowerCase().includes('concentrix');
                                        const hteLoc = resolveHteLocation(matchedHost, hostSupervisors, employees, geofenceZones) || {
                                          lat: isCtx ? 10.694261 : 10.742858,
                                          lng: isCtx ? 122.959987 : 122.970088,
                                          radius: 40,
                                          address: matchedHost.companyAddress || (isCtx ? 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod City' : 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines'),
                                          companyName: matchedHost.companyName,
                                        };

                                        const updatedFields: any = {
                                          hteId: matchedHost.id,
                                          companyName: matchedHost.companyName,
                                          companyAddress: hteLoc.address,
                                          supervisorName: matchedHost.name,
                                          registrationLocation: {
                                            lat: Number(hteLoc.lat),
                                            lng: Number(hteLoc.lng),
                                            radius: hteLoc.radius,
                                            address: hteLoc.address,
                                          },
                                          registrationRadius: hteLoc.radius,
                                          registrationAddress: hteLoc.address,
                                          active: true,
                                          approvalStatus: 'approved',
                                          applicationStatus: 'approved',
                                        };

                                        await updateEmployee(selectedEmp.id, updatedFields);

                                        addGeofenceZone({
                                          id: `station-${selectedEmp.id}`,
                                          name: `${selectedEmp.name} - Trainee Geofence (${matchedHost.companyName})`,
                                          address: hteLoc.address,
                                          lat: Number(hteLoc.lat),
                                          lng: Number(hteLoc.lng),
                                          radius: hteLoc.radius,
                                          active: true,
                                          academicYear: selectedEmp.academicYear || settings?.activeAcademicYear,
                                          employeeId: selectedEmp.id,
                                          userType: 'trainee',
                                        } as any);

                                        setSelectedEmp((prev) => prev ? {
                                          ...prev,
                                          ...updatedFields,
                                        } : null);
                                        setAssigningHte(false);
                                        toast.success(`Assigned ${selectedEmp.name} to ${matchedHost.companyName} with official workplace geofence!`);
                                      }}
                                      className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-sm"
                                    >
                                      Confirm & Assign HTE
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-600">
                                  {selectedEmp.companyName && !selectedEmp.companyName.toLowerCase().includes('pending') ? (
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-bold text-slate-900 text-sm">{selectedEmp.companyName}</p>
                                        <p className="text-slate-500 mt-0.5">Supervisor: {selectedEmp.supervisorName || 'N/A'}</p>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (confirm(`Unassign ${selectedEmp.name} from ${selectedEmp.companyName}?`)) {
                                              const updatedFields: any = {
                                                hteId: null,
                                                companyName: 'Pending Admin Assignment',
                                                companyAddress: '',
                                                supervisorName: 'Pending Admin Assignment',
                                              };
                                              await updateEmployee(selectedEmp.id, updatedFields);
                                              setSelectedEmp((prev) => prev ? { ...prev, ...updatedFields } : null);
                                              toast.success(`Unassigned ${selectedEmp.name} from HTE.`);
                                            }
                                          }}
                                          className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline mt-1.5 cursor-pointer block"
                                        >
                                          Unassign from HTE
                                        </button>
                                      </div>
                                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] uppercase">
                                        Assigned
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <p className="text-amber-700 font-medium">Unassigned • Awaiting Admin HTE Placement</p>
                                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px] uppercase">
                                        Unassigned
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Standard Required OJT Documents Monitoring - Trainees ONLY */}
                          {isTrainee && (
                            <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-violet-900 flex items-center gap-1.5">
                                    <FileCheck size={16} className="text-violet-600" />
                                    Required OJT Documents Monitoring ({REQUIRED_TRAINEE_DOCUMENTS.length} Credentials)
                                  </p>
                                  <p className="text-[11px] text-violet-600 mt-0.5">
                                    {REQUIRED_TRAINEE_DOCUMENTS.length} Official Compliance Documents Required for Trainee Activation & Deployment
                                  </p>
                                </div>
                                {(() => {
                                  const missingCount = REQUIRED_TRAINEE_DOC_KEYS.filter(
                                    (k) => !selectedEmp.submittedDocuments?.[k]?.dataUrl && !selectedEmp.submittedDocuments?.[k]?.name
                                  ).length;
                                  const passedCount = REQUIRED_TRAINEE_DOC_KEYS.filter(
                                    (k) => selectedEmp.submittedDocuments?.[k]?.status === 'passed'
                                  ).length;
                                  const isCompliant = missingCount === 0 && passedCount === REQUIRED_TRAINEE_DOCUMENTS.length && selectedEmp.documentsPassed === true && selectedEmp.documentsStatus === 'passed';

                                  return (
                                    <span
                                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                        isCompliant
                                          ? 'bg-green-100 text-green-700 border-green-200'
                                          : 'bg-amber-100 text-amber-700 border-amber-200'
                                      }`}
                                    >
                                      {isCompliant
                                        ? `${REQUIRED_TRAINEE_DOCUMENTS.length}/${REQUIRED_TRAINEE_DOCUMENTS.length} Passed (Compliant)`
                                        : `${passedCount}/${REQUIRED_TRAINEE_DOCUMENTS.length} Passed (Pending)`}
                                    </span>
                                  );
                                })()}
                              </div>

                              {/* The 9 Standard Documents Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {REQUIRED_TRAINEE_DOCUMENTS.map((docItem) => {
                                  const doc = selectedEmp.submittedDocuments?.[docItem.key];
                                  const isPassed = doc ? doc.status === 'passed' : false;
                                  const hasFile = !!doc?.dataUrl;
                                  const IconComponent = docItem.icon;
                                  return (
                                    <div
                                      key={docItem.id}
                                      className={`rounded-xl bg-white p-3 border transition-all ${
                                        isPassed
                                          ? 'border-green-200 shadow-sm shadow-green-50/50'
                                          : 'border-amber-200 shadow-sm shadow-amber-50/50'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <div
                                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                              isPassed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                            }`}
                                          >
                                            {docItem.num}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-gray-800 truncate" title={docItem.title}>{docItem.title}</p>
                                            {doc?.name && (
                                              <p className="text-[10px] text-blue-600 truncate max-w-[140px]" title={doc.name}>
                                                📁 {doc.name}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <span
                                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                                            isPassed
                                              ? 'bg-green-100 text-green-700 border-green-200'
                                              : 'bg-amber-100 text-amber-700 border-amber-200'
                                          }`}
                                        >
                                          {isPassed ? '✓ PASSED' : 'PENDING'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-gray-500 leading-tight mb-2.5 line-clamp-2">{docItem.desc}</p>

                                      <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewInstructorDoc({
                                              studentName: selectedEmp.name,
                                              studentId: selectedEmp.employeeId,
                                              title: `${docItem.num}. ${docItem.title}`,
                                              fileName: doc?.name || `${docItem.title.toLowerCase().replace(/\s+/g, '_')}_${selectedEmp.employeeId}.pdf`,
                                              fileUrl: doc?.dataUrl || undefined,
                                              note: doc?.name
                                                ? `Uploaded File: ${doc.name}${doc.size ? ` (${(Number(doc.size) / 1024).toFixed(1)} KB)` : ''}`
                                                : `Verified submission record for ${selectedEmp.name} (${selectedEmp.course || 'OJT Student'}).`,
                                              date: doc?.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : new Date().toLocaleDateString(),
                                            })
                                          }
                                          className="flex-1 py-1 px-2 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-all"
                                        >
                                          <Eye size={11} /> {hasFile ? 'View' : 'View Doc'}
                                        </button>

                                        {hasFile && doc?.dataUrl && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              downloadDocument(
                                                doc.dataUrl!,
                                                doc.name || `${docItem.title.toLowerCase().replace(/\s+/g, '_')}_${selectedEmp.employeeId}`
                                              )
                                            }
                                            className="py-1 px-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-all"
                                            title="Download student file"
                                          >
                                            <Download size={11} /> Download
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const newDocStatus: 'passed' | 'pending' = isPassed ? 'pending' : 'passed';
                                            const currentDocs = selectedEmp.submittedDocuments || {};
                                            const updatedDocs: TraineeDocuments = {
                                              ...currentDocs,
                                              [docItem.key]: {
                                                ...(currentDocs[docItem.key] || {
                                                  name: `${docItem.title}.pdf`,
                                                  fileType: 'application/pdf',
                                                  size: 0,
                                                  uploadedAt: new Date().toISOString(),
                                                }),
                                                status: newDocStatus,
                                              },
                                            };
                                            const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
                                            const allPassed = docKeys.every((k) => updatedDocs[k]?.status === 'passed');
                                            const anyPassed = docKeys.some((k) => updatedDocs[k]?.status === 'passed');

                                            await updateEmployee(selectedEmp.id, {
                                              submittedDocuments: updatedDocs,
                                              documentsPassed: allPassed,
                                              documentsStatus: allPassed ? 'passed' : anyPassed ? 'partial' : 'pending',
                                            });
                                            setSelectedEmp({
                                              ...selectedEmp,
                                              submittedDocuments: updatedDocs,
                                              documentsPassed: allPassed,
                                              documentsStatus: allPassed ? 'passed' : anyPassed ? 'partial' : 'pending',
                                            });
                                            toast.success(
                                              newDocStatus === 'passed'
                                                ? `${docItem.title} marked as PASSED`
                                                : `${docItem.title} marked as PENDING`
                                            );
                                          }}
                                          className={`py-1 px-2.5 rounded-lg text-[10px] font-bold border transition-all ${
                                            isPassed
                                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                              : 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                          }`}
                                        >
                                          {isPassed ? 'Revoke' : 'Approve'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Bulk Toggle All Documents Action */}
                              {(() => {
                                const missingDocs = REQUIRED_TRAINEE_DOC_KEYS.filter(
                                  (k) => !selectedEmp.submittedDocuments?.[k]?.dataUrl && !selectedEmp.submittedDocuments?.[k]?.name
                                ).length;
                                const passedDocs = REQUIRED_TRAINEE_DOC_KEYS.filter(
                                  (k) => selectedEmp.submittedDocuments?.[k]?.status === 'passed'
                                ).length;
                                const isCertified = missingDocs === 0 && passedDocs === REQUIRED_TRAINEE_DOCUMENTS.length && selectedEmp.documentsPassed === true && selectedEmp.documentsStatus === 'passed';

                                return (
                                  <div className="flex items-center justify-between pt-1 border-t border-violet-100">
                                    <p className="text-[11px] text-violet-700 font-medium">
                                      Status:{' '}
                                      <span className="font-bold">
                                        {isCertified
                                          ? `All ${REQUIRED_TRAINEE_DOCUMENTS.length} Required Documents Certified`
                                          : 'Pending Verification of Registration Documents'}
                                      </span>
                                    </p>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const willPass = !isCertified;
                                        const targetStatus: 'passed' | 'pending' = willPass ? 'passed' : 'pending';
                                        const currentDocs = selectedEmp.submittedDocuments || {};
                                        const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
                                        const updatedDocs: TraineeDocuments = { ...currentDocs };
                                        docKeys.forEach((k) => {
                                          updatedDocs[k] = {
                                            ...(currentDocs[k] || {
                                              name: `${k}.pdf`,
                                              type: 'application/pdf',
                                              size: 0,
                                              uploadedAt: new Date().toISOString(),
                                            }),
                                            status: targetStatus,
                                          };
                                        });

                                        await updateEmployee(selectedEmp.id, {
                                          submittedDocuments: updatedDocs,
                                          documentsPassed: willPass,
                                          documentsStatus: willPass ? 'passed' : 'pending',
                                        });
                                        setSelectedEmp({
                                          ...selectedEmp,
                                          submittedDocuments: updatedDocs,
                                          documentsPassed: willPass,
                                          documentsStatus: willPass ? 'passed' : 'pending',
                                        });
                                        toast.success(
                                          willPass
                                            ? `All ${REQUIRED_TRAINEE_DOCUMENTS.length} required documents marked as PASSED!`
                                            : 'Documents marked as PENDING verification.'
                                        );
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                        isCertified
                                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'
                                      }`}
                                    >
                                      {isCertified
                                        ? 'Set All as Pending'
                                        : `✓ Approve All ${REQUIRED_TRAINEE_DOCUMENTS.length} Documents`}
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Geofencing & Location Zone */}
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                                <MapPin size={16} className="text-blue-600" />
                                <span>{isInstructor ? 'Campus Station Location' : 'Geofencing & Workplace Location'}</span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">
                                {isInstructor ? 'Official Station' : 'Active Monitoring'}
                              </span>
                            </div>

                            <div className="text-xs text-blue-800 space-y-1">
                              {isInstructor ? (
                                <>
                                  <p><span className="font-semibold text-blue-900">Campus Station:</span> {selectedEmp.campus || 'CHMSU Talisay (Main Campus)'}</p>
                                  <p><span className="font-semibold text-blue-900">Station Geofence Address:</span> {getCampusLocation(selectedEmp.campus).address}</p>
                                  <p><span className="font-semibold text-blue-900">Department / Office:</span> {selectedEmp.department || 'College of Computer Studies'}</p>
                                </>
                              ) : (
                                <>
                                  <p><span className="font-semibold text-blue-900">Workplace/HTE:</span> {selectedEmp.companyName || 'Not Assigned'}</p>
                                  {(() => {
                                    const matchingZone = geofenceZones.find((z) =>
                                      z.id === selectedEmp.id ||
                                      z.id === `personal-${selectedEmp.id}` ||
                                      Boolean(selectedEmp.name && z?.name && String(z.name).toLowerCase().includes(String(selectedEmp.name).toLowerCase()))
                                    );
                                    const rawZoneAddr = matchingZone?.address || '';
                                    const isResidential =
                                      rawZoneAddr.toLowerCase().includes('lantad') ||
                                      rawZoneAddr.toLowerCase().includes('banago') ||
                                      (!rawZoneAddr.toLowerCase().includes('chmsu') && !rawZoneAddr.toLowerCase().includes('campus') && !rawZoneAddr.toLowerCase().includes('concentrix') && !rawZoneAddr.toLowerCase().includes('focus') && !rawZoneAddr.toLowerCase().includes('mcdonald'));

                                    const workplaceAddr = selectedEmp.companyAddress || (!isResidential && rawZoneAddr ? rawZoneAddr : null) || (selectedEmp.companyName && selectedEmp.companyName !== 'N/A' && !selectedEmp.companyName.toLowerCase().includes('pending') ? `${selectedEmp.companyName} Workplace Premises` : 'Campus Location');
                                    return (
                                      <p><span className="font-semibold text-blue-900">Workplace Address:</span> {workplaceAddr}</p>
                                    );
                                  })()}
                                </>
                              )}
                              {(() => {
                                const regLoc = selectedEmp.registrationLocation;
                                const rawLat = regLoc && typeof regLoc === 'object' ? (regLoc as any).lat : null;
                                const rawLng = regLoc && typeof regLoc === 'object' ? (regLoc as any).lng : null;
                                const numLat = rawLat != null && !isNaN(Number(rawLat)) ? Number(rawLat) : null;
                                const numLng = rawLng != null && !isNaN(Number(rawLng)) ? Number(rawLng) : null;

                                if (numLat != null && numLng != null) {
                                  const rad = Math.max(20, Number((regLoc as any)?.radius || selectedEmp.registrationRadius || 40));
                                  const isNegrosValid = isWithinNegrosOccidental(numLat, numLng);
                                  return (
                                    <div className="space-y-1.5 mt-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className={`font-mono text-[11px] p-1.5 rounded-lg border inline-block ${
                                          isNegrosValid
                                            ? 'text-blue-700 bg-white/70 border-blue-200'
                                            : 'text-rose-700 bg-rose-50 border-rose-200 font-bold'
                                        }`}>
                                          📍 GPS: {numLat.toFixed(5)}, {numLng.toFixed(5)} (±{rad}m)
                                        </p>
                                        <a
                                          href={`https://www.google.com/maps?q=${numLat},${numLng}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg transition-all"
                                        >
                                          <ExternalLink size={11} /> Open Map
                                        </a>
                                      </div>
                                      {!isNegrosValid && (
                                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium flex items-start gap-1.5">
                                          <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                                          <span><strong>Out-of-Region GPS Detected:</strong> This trainee's stored coordinates are outside Negros Occidental (e.g. Metro Manila or Panay Island). They will fail live geofencing checks until updated with valid premises coordinates.</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <p className="font-mono text-[11px] text-blue-700 bg-white/70 p-1.5 rounded-lg border border-blue-200 inline-block mt-1">
                                    📍 Campus Geofence Boundary: Institutional Campus Zone (40m)
                                  </p>
                                );
                              })()}
                            </div>
                          </div>

                          {selectedEmp.registrationAddress && !isInstructor && (
                            <div className="flex gap-3 text-sm border-t border-gray-50 pt-2">
                              <span className="text-gray-400 w-28 shrink-0 flex items-center gap-1">
                                <MapPin size={11} /> Registered At
                              </span>
                              <span className="font-mono text-xs text-gray-600">{selectedEmp.registrationAddress}</span>
                            </div>
                          )}

                          {/* Server Face Enrollment - Trainees ONLY */}
                          {isTrainee && (
                            isSecurityApiConfigured() ? (
                              <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 space-y-2">
                                <div className="flex items-center gap-2 text-sky-900">
                                  <Shield size={16} className="shrink-0" />
                                  <p className="text-sm font-semibold">Server face enrollment</p>
                                </div>
                                <p className="text-xs text-sky-800/90">
                                  Registers this trainee’s face with{' '}
                                  <code className="text-[11px] bg-white/70 px-1 rounded">/api/face/register/</code> so
                                  clock-in uses <code className="text-[11px] bg-white/70 px-1 rounded">employee_id</code>{' '}
                                  matching this app’s internal ID.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setFaceEnrollOpen(true)}
                                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors"
                                >
                                  <Camera size={16} />
                                  {selectedEmp.faceRegistered ? 'Re-enroll face (camera)' : 'Enroll face (camera)'}
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3 border border-amber-100">
                                Set <code className="text-[11px]">VITE_DJANGO_API_URL</code> (and API key if the server
                                requires it) to enroll faces on the backend.
                              </p>
                            )
                          )}

                          {/* Profile modal footer quick actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              {isTrainee && (
                                <button
                                  type="button"
                                  onClick={() => openReview(selectedEmp)}
                                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                                >
                                  <FileCheck size={14} /> Review Documents
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEdit(selectedEmp)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                              >
                                <Edit3 size={14} /> Edit Account
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={closeModal}
                              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  )
                ) : modalMode === 'edit' && selectedEmp ? (
                  <div className="space-y-4">
                    {/* Banner */}
                    <div className="flex items-center gap-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                        <Edit3 size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-amber-950">Editing Account: {selectedEmp.name}</p>
                        <p className="text-xs text-amber-700">Update trainee records, contact info, academic details, or placement credentials.</p>
                      </div>
                    </div>

                    {/* Form Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Full Name */}
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Full Name *</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => updEdit('name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50"
                          placeholder="Juan Dela Cruz"
                        />
                      </div>

                      {/* Student / Employee ID */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Student / Employee ID</label>
                        <input
                          type="text"
                          value={editForm.employeeId}
                          onChange={(e) => updEdit('employeeId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50 font-mono"
                          placeholder="20231342 or OJT-2026-XXX"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Email Address</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => updEdit('email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50"
                          placeholder="student@chmsu.edu.ph"
                        />
                      </div>

                      {/* Contact Phone */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Contact Phone</label>
                        <input
                          type="text"
                          value={editForm.contactPhone}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^\d+]/g, '');
                            if (val.startsWith('09')) val = '+639' + val.slice(2);
                            else if (val.startsWith('9')) val = '+639' + val.slice(1);
                            else if (val.startsWith('639')) val = '+639' + val.slice(3);
                            if (!val.startsWith('+639') && val.length > 0) {
                              if (val.startsWith('+')) val = '+639' + val.slice(1).replace(/^639?/, '');
                              else val = '+639' + val;
                            }
                            updEdit('contactPhone', val.slice(0, 13));
                          }}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50 font-mono"
                          placeholder="+639123456789"
                        />
                      </div>

                      {/* Academic Year */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Academic Year</label>
                        <select
                          value={editForm.academicYear}
                          onChange={(e) => updEdit('academicYear', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                        >
                          {(settings?.academicYears && settings.academicYears.length > 0) ? (
                            settings.academicYears.map((ay) => (
                              <option key={ay} value={ay}>
                                A.Y. {ay}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="2026-2027">A.Y. 2026-2027</option>
                              <option value="2025-2026">A.Y. 2025-2026</option>
                              <option value="2024-2025">A.Y. 2024-2025</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Residential Address */}
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Residential Address (Home)</label>
                        <input
                          type="text"
                          value={editForm.residentialAddress}
                          onChange={(e) => updEdit('residentialAddress', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50"
                          placeholder="House No., Street, Barangay, City, Province"
                        />
                      </div>

                      {/* Campus */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Campus</label>
                        <select
                          value={editForm.campus}
                          onChange={(e) => updEdit('campus', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                        >
                          <option value="">Select Campus</option>
                          {campusOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* College / Department */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">College (CHMSU)</label>
                        <select
                          value={editForm.department}
                          onChange={(e) => {
                            updEdit('department', e.target.value);
                            updEdit('course', '');
                          }}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                        >
                          <option value="">Select College</option>
                          {departmentOptions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Program */}
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Program (CHMSU)</label>
                        <select
                          value={editForm.course}
                          onChange={(e) => updEdit('course', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                        >
                          <option value="">Select Program</option>
                          {getCoursesForDepartment(editForm.department, editForm.campus).map((course) => (
                            <option key={course} value={course}>
                              {course}
                            </option>
                          ))}
                          {editForm.course && !getCoursesForDepartment(editForm.department, editForm.campus).includes(editForm.course) && (
                            <option value={editForm.course}>{editForm.course}</option>
                          )}
                        </select>
                      </div>

                      {/* Designated HTE / Host Training Establishment */}
                      <div className="sm:col-span-2 space-y-2 p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-blue-950 block">
                            Designated Host Training Establishment (HTE) & Workplace Geofence
                          </label>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                            Auto-syncs GPS
                          </span>
                        </div>
                        <select
                          value={editForm.hteId || ''}
                          onChange={(e) => {
                            const chosenId = e.target.value;
                            updEdit('hteId', chosenId);
                            const matched = allAvailableHtes.find((h) => h.id === chosenId);
                            if (matched) {
                              updEdit('companyName', matched.companyName);
                              updEdit('supervisorName', matched.name);
                              const hteZone = geofenceZones.find(
                                (z) =>
                                  (z as any).employeeId === matched.id ||
                                  (z as any).employee_id === matched.id ||
                                  z.id === matched.id ||
                                  z.id === `station-${matched.id}` ||
                                  (matched.companyName && z.name && z.name.toLowerCase().includes(matched.companyName.toLowerCase()))
                              );
                              const addr = hteZone?.address || matched.companyAddress || `${matched.companyName} Workplace Premises`;
                              updEdit('companyAddress', addr);
                            }
                          }}
                          className="w-full px-3 py-2 border border-blue-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                          <option value="">-- Choose Registered HTE Supervisor / Company --</option>
                          {allAvailableHtes.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.companyName} — {h.name} ({h.email})
                            </option>
                          ))}
                        </select>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[11px] font-semibold text-gray-700 block mb-1">Company / Workplace Name</label>
                            <input
                              type="text"
                              value={editForm.companyName}
                              onChange={(e) => updEdit('companyName', e.target.value)}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                              placeholder="Host Training Establishment"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-gray-700 block mb-1">HTE Supervisor Name</label>
                            <input
                              type="text"
                              value={editForm.supervisorName}
                              onChange={(e) => updEdit('supervisorName', e.target.value)}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                              placeholder="Supervisor Full Name"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Required Hours */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Required OJT Hours</label>
                        <input
                          type="number"
                          value={editForm.requiredHours}
                          onChange={(e) => updEdit('requiredHours', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50"
                          placeholder="486"
                        />
                      </div>

                      {/* Position */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Role / Position</label>
                        <input
                          type="text"
                          value={editForm.position}
                          onChange={(e) => updEdit('position', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50"
                          placeholder="OJT Trainee"
                        />
                      </div>

                      {/* Start Date & End Date */}
                      <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">OJT Start Date</label>
                          <input
                            type="date"
                            value={editForm.startDate}
                            onChange={(e) => updEdit('startDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">OJT End Date</label>
                          <input
                            type="date"
                            value={editForm.endDate}
                            onChange={(e) => updEdit('endDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-gray-50/50"
                          />
                        </div>
                      </div>

                      {/* Document Status & Enrollment Status */}
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-800">Documents Status</p>
                          <p className="text-[11px] text-gray-500">{editForm.documentsPassed ? 'All documents approved' : 'Pending verification'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !editForm.documentsPassed;
                            updEdit('documentsPassed', nextVal);
                            updEdit('documentsStatus', nextVal ? 'passed' : 'pending');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            editForm.documentsPassed ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {editForm.documentsPassed ? '✓ Passed' : 'Pending'}
                        </button>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-800">Account Enrolled</p>
                          <p className="text-[11px] text-gray-500">{editForm.active ? 'Active & Approved' : 'Inactive / Pending'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextActive = !editForm.active;
                            updEdit('active', nextActive);
                            updEdit('approvalStatus', nextActive ? 'approved' : 'pending');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            editForm.active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {editForm.active ? 'Active' : 'Pending'}
                        </button>
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setModalMode('view')}
                        className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all cursor-pointer"
                      >
                        <Check size={14} />
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : modalMode === 'review' && selectedEmp ? (
                  <div className="space-y-4">
                    {/* Trainee Review Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                          {selectedEmp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-base">{selectedEmp.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{selectedEmp.employeeId} • {selectedEmp.course || selectedEmp.department}</p>
                          <p className="text-[11px] text-violet-700 font-medium mt-0.5">
                            A.Y. {selectedEmp.academicYear || settings.activeAcademicYear} • {selectedEmp.companyName || 'Host Establishment Pending'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(selectedEmp)}
                          className="px-3 py-1.5 rounded-xl bg-white border border-violet-200 text-violet-800 hover:bg-violet-50 text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Edit3 size={13} /> Edit Account
                        </button>
                        <button
                          type="button"
                          onClick={() => openView(selectedEmp)}
                          className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Eye size={13} /> Full Profile
                        </button>
                      </div>
                    </div>

                    {/* Compliance Overview Card & Bulk Approval */}
                    {(() => {
                      const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
                      const missingCount = docKeys.filter((k) => !selectedEmp.submittedDocuments?.[k]?.dataUrl && !selectedEmp.submittedDocuments?.[k]?.name).length;
                      const passedCount = docKeys.filter((k) => selectedEmp.submittedDocuments?.[k]?.status === 'passed').length;
                      const isFullyPassed = missingCount === 0 && passedCount === REQUIRED_TRAINEE_DOCUMENTS.length && selectedEmp.documentsPassed === true && selectedEmp.documentsStatus === 'passed';

                      return (
                        <div className={`p-4 rounded-2xl border transition-all ${
                          isFullyPassed ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <FileCheck size={18} className={isFullyPassed ? 'text-emerald-700' : 'text-amber-700'} />
                                <h4 className="font-bold text-sm text-gray-900">
                                  Required OJT Document Compliance ({passedCount}/{REQUIRED_TRAINEE_DOCUMENTS.length} Certified)
                                </h4>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {isFullyPassed
                                  ? `All ${REQUIRED_TRAINEE_DOCUMENTS.length} compliance credentials verified. Trainee is certified for deployment.`
                                  : 'Review submitted attachments below. Mark individual documents as passed or approve all.'}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                const willPass = !isFullyPassed;
                                const targetStatus: 'passed' | 'pending' = willPass ? 'passed' : 'pending';
                                const currentDocs = selectedEmp.submittedDocuments || {};
                                const updatedDocs: TraineeDocuments = { ...currentDocs };
                                docKeys.forEach((k) => {
                                  updatedDocs[k] = {
                                    ...(currentDocs[k] || {
                                      name: `${k}.pdf`,
                                      fileType: 'application/pdf',
                                      size: 0,
                                      uploadedAt: new Date().toISOString(),
                                    }),
                                    status: targetStatus,
                                  };
                                });

                                await updateEmployee(selectedEmp.id, {
                                  submittedDocuments: updatedDocs,
                                  documentsPassed: willPass,
                                  documentsStatus: willPass ? 'passed' : 'pending',
                                });
                                setSelectedEmp({
                                  ...selectedEmp,
                                  submittedDocuments: updatedDocs,
                                  documentsPassed: willPass,
                                  documentsStatus: willPass ? 'passed' : 'pending',
                                });
                                toast.success(
                                  willPass
                                    ? `All ${REQUIRED_TRAINEE_DOCUMENTS.length} documents marked as PASSED for ${selectedEmp.name}!`
                                    : `Documents marked as PENDING for ${selectedEmp.name}`
                                );
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer ${
                                isFullyPassed
                                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                              }`}
                            >
                              {isFullyPassed ? 'Mark All as Pending' : `✓ Approve All ${REQUIRED_TRAINEE_DOCUMENTS.length} Documents`}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* The 9 Standard Documents Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {REQUIRED_TRAINEE_DOCUMENTS.map((docItem) => {
                        const doc = selectedEmp.submittedDocuments?.[docItem.key];
                        const isPassed = doc ? doc.status === 'passed' : false;
                        const hasFile = Boolean(doc?.dataUrl);

                        return (
                          <div
                            key={docItem.id}
                            className={`rounded-2xl bg-white p-3.5 border transition-all ${
                              isPassed
                                ? 'border-emerald-200 bg-emerald-50/20 shadow-2xs'
                                : 'border-amber-200 bg-amber-50/20 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {docItem.num}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-gray-900 truncate" title={docItem.title}>{docItem.title}</p>
                                  {doc?.name ? (
                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                      <p className="text-[10px] text-blue-600 truncate font-mono max-w-[150px]" title={doc.name}>
                                        📁 {doc.name} {doc.size ? `(${(Number(doc.size) / 1024).toFixed(0)} KB)` : ''}
                                      </p>
                                      {doc.source && (
                                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                          doc.source === 'registration'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-blue-100 text-blue-700'
                                        }`}>
                                          {doc.source === 'registration' ? 'Registration' : 'Portal'}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-gray-400 italic">No custom file uploaded</p>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                                  isPassed
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                {isPassed ? '✓ PASSED' : 'PENDING'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 leading-snug mb-3 line-clamp-2">{docItem.desc}</p>

                            <div className="flex items-center gap-1.5 pt-2.5 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewInstructorDoc({
                                    studentName: selectedEmp.name,
                                    studentId: selectedEmp.employeeId,
                                    title: `${docItem.num}. ${docItem.title}`,
                                    fileName: doc?.name || `${docItem.title.toLowerCase().replace(/\s+/g, '_')}_${selectedEmp.employeeId}.pdf`,
                                    fileUrl: doc?.dataUrl || undefined,
                                    note: doc?.name
                                      ? `Uploaded File: ${doc.name}${doc.size ? ` (${(Number(doc.size) / 1024).toFixed(1)} KB)` : ''}${doc.source ? ` • Source: ${doc.source === 'registration' ? 'Pre-Registration' : 'Trainee Portal'}` : ''}`
                                      : `Verified submission record for ${selectedEmp.name} (${selectedEmp.course || 'OJT Student'}).`,
                                    date: doc?.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : new Date().toLocaleDateString(),
                                  })
                                }
                                className="flex-1 py-1.5 px-2.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 text-xs font-semibold inline-flex items-center justify-center gap-1 transition-all cursor-pointer"
                              >
                                <Eye size={12} /> {hasFile ? 'Preview' : 'View Doc'}
                              </button>

                              {hasFile && doc?.dataUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadDocument(
                                      doc.dataUrl!,
                                      doc.name || `${docItem.title.toLowerCase().replace(/\s+/g, '_')}_${selectedEmp.employeeId}`
                                    )
                                  }
                                  className="py-1.5 px-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold inline-flex items-center justify-center gap-1 transition-all cursor-pointer"
                                  title="Download attached student document"
                                >
                                  <Download size={12} /> Download
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={async () => {
                                  const newDocStatus: 'passed' | 'pending' = isPassed ? 'pending' : 'passed';
                                  const currentDocs = selectedEmp.submittedDocuments || {};
                                  const updatedDocs: TraineeDocuments = {
                                    ...currentDocs,
                                    [docItem.key]: {
                                      ...(currentDocs[docItem.key] || {
                                        name: `${docItem.title}.pdf`,
                                        fileType: 'application/pdf',
                                        size: 0,
                                        uploadedAt: new Date().toISOString(),
                                      }),
                                      status: newDocStatus,
                                    },
                                  };
                                  const docKeys = REQUIRED_TRAINEE_DOC_KEYS;
                                  const allPassed = docKeys.every((k) => updatedDocs[k]?.status === 'passed');
                                  const anyPassed = docKeys.some((k) => updatedDocs[k]?.status === 'passed');

                                  await updateEmployee(selectedEmp.id, {
                                    submittedDocuments: updatedDocs,
                                    documentsPassed: allPassed,
                                    documentsStatus: allPassed ? 'passed' : anyPassed ? 'partial' : 'pending',
                                  });
                                  setSelectedEmp({
                                    ...selectedEmp,
                                    submittedDocuments: updatedDocs,
                                    documentsPassed: allPassed,
                                    documentsStatus: allPassed ? 'passed' : anyPassed ? 'partial' : 'pending',
                                  });
                                  toast.success(
                                    newDocStatus === 'passed'
                                      ? `${docItem.title} marked as PASSED`
                                      : `${docItem.title} marked as PENDING`
                                  );
                                }}
                                className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                  isPassed
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                }`}
                              >
                                {isPassed ? 'Revoke' : 'Approve'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom navigation */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => openView(selectedEmp)}
                        className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                      >
                        ← Back to Trainee Profile
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-5 py-2 text-xs font-bold text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors cursor-pointer"
                      >
                        Done Reviewing
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                      {[
                        { label: 'Full Name', field: 'name', placeholder: 'Juan Dela Cruz' },
                        { label: 'Email', field: 'email', placeholder: 'email@example.com' },
                        { label: 'Contact Number (Philippines +639...)', field: 'contactPhone', placeholder: '+639123456789' },
                        { label: 'Employee ID', field: 'employeeId', placeholder: 'OJT-2024-XXX (optional)' },
                        { label: 'Company Name', field: 'companyName', placeholder: 'Company Name' },
                        { label: 'Supervisor', field: 'supervisorName', placeholder: 'Mr./Ms. Supervisor' },
                      ].map(({ label, field, placeholder }) => (
                      <div key={field}>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                        <input
                          value={((form as Record<string, any>)[field] as string) ?? ''}
                          onChange={(e) => {
                            if (field === 'contactPhone') {
                              let val = e.target.value.replace(/[^\d+]/g, '');
                              if (val.startsWith('09')) val = '+639' + val.slice(2);
                              else if (val.startsWith('9')) val = '+639' + val.slice(1);
                              else if (val.startsWith('639')) val = '+639' + val.slice(3);
                              if (!val.startsWith('+639') && val.length > 0) {
                                if (val.startsWith('+')) val = '+639' + val.slice(1).replace(/^639?/, '');
                                else val = '+639' + val;
                              }
                              upd(field, val.slice(0, 13));
                            } else {
                              upd(field, e.target.value);
                            }
                          }}
                          placeholder={placeholder}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Campus</label>
                      <select
                        value={form.campus}
                        onChange={(e) => upd('campus', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        <option value="">Select Campus</option>
                        {campusOptions.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">School</label>
                      <select
                        value={form.schoolName}
                        onChange={(e) => upd('schoolName', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        <option value="">Select School</option>
                        <option value="Carlos Hilado Memorial State University">
                          Carlos Hilado Memorial State University
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Department</label>
                      <select
                        value={form.department}
                        onChange={(e) => {
                          upd('department', e.target.value);
                          upd('course', '');
                        }}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        <option value="">Select Department</option>
                        {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Course</label>
                      <select
                        value={form.course}
                        onChange={(e) => upd('course', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        <option value="">Select Course</option>
                        {getCoursesForDepartment(form.department, form.campus).map((course) => <option key={course} value={course}>{course}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Start Date</label>
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => upd('startDate', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">End Date</label>
                        <input
                          type="date"
                          value={form.endDate}
                          onChange={(e) => upd('endDate', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Required OJT Hours</label>
                      <input
                        type="number"
                        value={form.requiredHours}
                        onChange={(e) => upd('requiredHours', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                    </div>
                    <button
                      onClick={handleAdd}
                      className="w-full py-3 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors mt-2"
                    >
                      Add Trainee
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructor Document Preview & Print Modal */}
      {previewInstructorDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Print header – visible only on print */}
            <div className="hidden print:block p-6 border-b border-gray-200 text-center">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Carlos Hilado Memorial State University</p>
              <h2 className="text-lg font-bold text-gray-900">{previewInstructorDoc.title}</h2>
              <p className="text-sm text-gray-600 mt-1">OJT Management System – Official Document</p>
            </div>

            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 print:hidden">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{previewInstructorDoc.title}</h3>
                <p className="text-xs text-gray-500 truncate font-mono">{previewInstructorDoc.fileName || 'Attached Document'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all shadow-sm cursor-pointer"
                >
                  <Printer size={13} /> Print
                </button>
                {previewInstructorDoc.fileUrl && (
                  <button
                    type="button"
                    onClick={() => downloadDocument(previewInstructorDoc.fileUrl!, previewInstructorDoc.fileName)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition-all shadow-sm cursor-pointer"
                    title="Download document"
                  >
                    <Download size={13} /> Download
                  </button>
                )}
                <button
                  onClick={() => setPreviewInstructorDoc(null)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Student info strip */}
            <div className="px-4 sm:px-6 py-3 bg-violet-50/90 border-b border-violet-100 print:bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-700">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-bold text-slate-900 shrink-0">Student Name:</span>
                  <span className="font-semibold text-slate-800 break-words">{previewInstructorDoc.studentName}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-bold text-slate-900 shrink-0">Student ID:</span>
                  <span className="font-mono text-slate-800">{previewInstructorDoc.studentId}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-bold text-slate-900 shrink-0">Document:</span>
                  <span className="text-slate-800 break-words">{previewInstructorDoc.title}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-bold text-slate-900 shrink-0">Date Submitted:</span>
                  <span className="text-slate-800">{previewInstructorDoc.date}</span>
                </div>
                {previewInstructorDoc.note && (
                  <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row sm:items-baseline gap-1 bg-white/80 p-2.5 rounded-xl border border-violet-100 mt-1">
                    <span className="font-bold text-slate-900 shrink-0">Note:</span>
                    <span className="text-slate-700 break-all leading-relaxed text-[11px]">{previewInstructorDoc.note}</span>
                  </div>
                )}
              </div>
            </div>

            {/* File preview */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex items-center justify-center min-h-[350px]">
              {previewInstructorDoc.fileUrl ? (
                (() => {
                  const cat = getFileCategory(previewInstructorDoc.fileName || previewInstructorDoc.fileUrl);
                  const isImg =
                    cat === 'picture' ||
                    previewInstructorDoc.fileUrl.startsWith('data:image/') ||
                    previewInstructorDoc.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
                  const isWord =
                    cat === 'doc' ||
                    previewInstructorDoc.fileUrl.startsWith('data:application/msword') ||
                    previewInstructorDoc.fileUrl.startsWith('data:application/vnd') ||
                    previewInstructorDoc.fileName?.match(/\.(doc|docx)$/i);

                  if (isImg) {
                    return (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <img
                          src={previewInstructorDoc.fileUrl}
                          alt="Document preview"
                          className="max-h-[500px] object-contain rounded-xl shadow border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => downloadDocument(previewInstructorDoc.fileUrl!, previewInstructorDoc.fileName)}
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
                        <h4 className="text-base font-bold text-slate-900 mb-1">{previewInstructorDoc.title}</h4>
                        <p className="text-xs text-slate-500 font-mono mb-4 break-all">{previewInstructorDoc.fileName}</p>

                        <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-100 mb-5 text-slate-600">
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-500">Student:</span>
                            <span className="font-bold text-slate-800">{previewInstructorDoc.studentName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-500">Format:</span>
                            <span className="font-bold text-slate-800">Word (.doc / .docx)</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                          Download this student's Word submission to view in Microsoft Word, Google Docs, or LibreOffice.
                        </p>

                        <button
                          type="button"
                          onClick={() => downloadDocument(previewInstructorDoc.fileUrl!, previewInstructorDoc.fileName)}
                          className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all cursor-pointer"
                        >
                          <Download size={15} /> Download Word Document
                        </button>
                      </div>
                    );
                  }

                  return (
                    <iframe
                      src={previewInstructorDoc.fileUrl}
                      className="w-full h-[480px] rounded-xl border border-gray-200 bg-white"
                      title="Document Preview"
                    />
                  );
                })()
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                  <FileText size={40} />
                  <p className="text-sm">No file preview available</p>
                </div>
              )}
            </div>

            {/* Signature block – print only */}
            <div className="hidden print:block px-6 py-4 border-t border-gray-200 mt-4">
              <div className="flex justify-between mt-8">
                <div className="text-center">
                  <div className="border-t border-gray-400 w-40 mx-auto mb-1" />
                  <p className="text-xs text-gray-600">OJT Coordinator Signature</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-gray-400 w-40 mx-auto mb-1" />
                  <p className="text-xs text-gray-600">Date Received</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Trainee Deployment to HTE Modal */}
      {batchDeployOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Building className="text-blue-200" size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Deploy Trainees to HTE</h3>
                  <p className="text-xs text-blue-200">
                    Assign student interns to an approved Host Training Establishment with official workplace geofence
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchDeployOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              {/* Step 1: Select Target HTE */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">1</span>
                    Select Host Training Establishment (HTE)
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {allAvailableHtes.length} partner establishments registered
                  </span>
                </div>

                <select
                  value={deployTargetHteId}
                  onChange={(e) => setDeployTargetHteId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="">-- Choose Host Training Establishment --</option>
                  {allAvailableHtes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.companyName} — {h.name} ({h.internCount} currently assigned)
                    </option>
                  ))}
                </select>

                {(() => {
                  const targetHte = allAvailableHtes.find((h) => h.id === deployTargetHteId);
                  if (!targetHte) return null;
                  return (
                    <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/80 text-xs text-blue-900 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">{targetHte.companyName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 font-bold text-[10px]">
                          {targetHte.internCount} Interns Deployed
                        </span>
                      </div>
                      <p className="text-blue-700">Representative: <strong>{targetHte.name}</strong> • {targetHte.email}</p>
                      <p className="text-slate-600 text-[11px] flex items-center gap-1">
                        <MapPin size={12} className="text-blue-600 shrink-0" />
                        {targetHte.companyAddress || 'Official workplace address on file'}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Step 2: Select Trainees to Deploy */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">2</span>
                    Select Trainees to Deploy
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = deployableTrainees.map((t) => t.id);
                        setDeploySelectedStudentIds(allIds);
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      Select All Filtered ({deployableTrainees.length})
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setDeploySelectedStudentIds([])}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={deploySearch}
                      onChange={(e) => setDeploySearch(e.target.value)}
                      placeholder="Search trainee by name, ID..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <select
                    value={deployStatusFilter}
                    onChange={(e) => setDeployStatusFilter(e.target.value as any)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Trainees</option>
                    <option value="unassigned">Unassigned Trainees Only</option>
                    <option value="assigned">Already Assigned Trainees</option>
                  </select>

                  <select
                    value={deployCourseFilter}
                    onChange={(e) => setDeployCourseFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 truncate"
                  >
                    <option value="all">All Programs / Courses</option>
                    {departmentOptions.flatMap(d => getCoursesForDepartment(d)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Trainees List Table */}
                <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {deployableTrainees.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No trainees found matching the selected filters.
                    </div>
                  ) : (
                    deployableTrainees.map((student) => {
                      const isSelected = deploySelectedStudentIds.includes(student.id);
                      const isAssigned = Boolean(
                        (student.hteId || (student.companyName && !isInvalidHteCompany(student.companyName))) &&
                        !isInvalidHteCompany(student.companyName)
                      );
                      const studentHteName = (student.companyName && !isInvalidHteCompany(student.companyName))
                        ? student.companyName
                        : (student.hteId && hteLookup[student.hteId]?.companyName ? hteLookup[student.hteId].companyName : null);
                      return (
                        <div
                          key={student.id}
                          onClick={() => {
                            setDeploySelectedStudentIds((prev) =>
                              prev.includes(student.id)
                                ? prev.filter((id) => id !== student.id)
                                : [...prev, student.id]
                            );
                          }}
                          className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 pointer-events-none"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-900">{student.name}</p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {student.employeeId || student.email} • {student.course || student.department || 'Trainee'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            {isAssigned && studentHteName ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                {studentHteName}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Unassigned
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Selected for deployment: <strong>{deploySelectedStudentIds.length}</strong> trainees</span>
                  <span>Total filtered: <strong>{deployableTrainees.length}</strong></span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setBatchDeployOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!deployTargetHteId || deploySelectedStudentIds.length === 0 || isDeploying}
                onClick={handleBatchDeploy}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDeploying ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deploying Trainees...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>
                      Deploy {deploySelectedStudentIds.length} Trainees to{' '}
                      {allAvailableHtes.find((h) => h.id === deployTargetHteId)?.companyName || 'HTE'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
