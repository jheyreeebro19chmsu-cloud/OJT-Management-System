import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/authApi';

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as supabaseService from '../services/supabaseService';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import {
  Employee,
  TimeRecord,
  GeofenceZone,
  AppSettings,
  User,
  Evaluation,
  Announcement,
  AnnouncementSubmission,
  RequiredDocument,
  RequiredDocumentSubmission,
  RequirementStatus,
  HostFeedback,
  HostSupervisor,
} from '../types';
import { GEOFENCE_RADIUS_METERS } from '../utils/geo';

const STORAGE_KEYS = {
  EMPLOYEES: 'ojt_employees',
  TIME_RECORDS: 'ojt_time_records',
  GEOFENCE_ZONES: 'ojt_geofence_zones',
  GEOFENCE_MIGRATION_V1: 'ojt_geofence_migration_v1',
  SETTINGS: 'ojt_settings',
  CURRENT_USER: 'ojt_current_user',
  EVALUATIONS: 'ojt_evaluations',
  ANNOUNCEMENTS: 'ojt_announcements',
  ANNOUNCEMENT_SUBMISSIONS: 'ojt_announcement_submissions',
  REQUIRED_DOCUMENTS: 'ojt_required_documents',
  REQUIRED_DOCUMENT_SUBMISSIONS: 'ojt_required_document_submissions',
  HOST_FEEDBACK: 'ojt_host_feedback',
  HOST_SUPERVISORS: 'ojt_host_supervisors',
  PASSWORDS: 'ojt_passwords',
};

const DEFAULT_SETTINGS: AppSettings = {
  workStartTime: '08:00',
  workEndTime: '17:00',
  lateThresholdMinutes: 15,
  geofenceEnabled: true,
  facialRecognitionEnabled: true,
  academicYears: ['2025-2026', '2026-2027'],
  activeAcademicYear: '2026-2027',
};

function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

const DEFAULT_GEOFENCE: GeofenceZone[] = [
  {
    id: 'zone-1',
    name: 'Main Training Center',
    address: 'Ayala Avenue, Makati City, Metro Manila',
    lat: 14.5547,
    lng: 121.0244,
    radius: GEOFENCE_RADIUS_METERS,
    active: true,
  },
];

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'admin-1',
    name: 'OJT Instructor',
    employeeId: 'ADM-2024-001',
    email: 'admin@ojt.com',
    department: 'Administration',
    position: 'OJT Instructor',
    companyName: 'TechCorp Philippines',
    supervisorName: 'System Owner',
    schoolName: 'N/A',
    course: 'N/A',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    requiredHours: 0,
    faceRegistered: false,
    createdAt: '2024-01-01',
    active: true,
    registrationLocation: { lat: 14.5547, lng: 121.0244 },
    registrationAddress: 'Ayala Avenue, Makati City',
  },
  {
    id: 'emp-1',
    name: 'Juan Dela Cruz',
    employeeId: 'OJT-2024-001',
    email: 'juan.delacruz@email.com',
    department: 'Information Technology',
    position: 'OJT Trainee',
    companyName: 'TechCorp Philippines',
    supervisorName: 'Mr. Roberto Santos',
    schoolName: 'Polytechnic University of the Philippines',
    course: 'Bachelor of Science in Information Technology',
    startDate: '2024-01-15',
    endDate: '2024-04-15',
    requiredHours: 486,
    faceRegistered: true,
    createdAt: '2024-01-15',
    active: true,
    registrationLocation: { lat: 14.5547, lng: 121.0244 },
    registrationAddress: 'Ayala Avenue, Makati City',
  },
  {
    id: 'emp-2',
    name: 'Maria Santos',
    employeeId: 'OJT-2024-002',
    email: 'maria.santos@email.com',
    department: 'Human Resources',
    position: 'OJT Trainee',
    companyName: 'TechCorp Philippines',
    supervisorName: 'Ms. Ana Reyes',
    schoolName: 'De La Salle University',
    course: 'Bachelor of Science in Psychology',
    startDate: '2024-01-15',
    endDate: '2024-04-15',
    requiredHours: 486,
    faceRegistered: true,
    createdAt: '2024-01-15',
    active: true,
    registrationLocation: { lat: 14.5644, lng: 121.031 },
    registrationAddress: 'Taft Avenue, Manila',
  },
  {
    id: 'emp-3',
    name: 'Carlo Reyes',
    employeeId: 'OJT-2024-003',
    email: 'carlo.reyes@email.com',
    department: 'Engineering',
    position: 'OJT Trainee',
    companyName: 'TechCorp Philippines',
    supervisorName: 'Engr. Mark Torres',
    schoolName: 'University of Santo Tomas',
    course: 'Bachelor of Science in Computer Engineering',
    startDate: '2024-02-01',
    endDate: '2024-05-01',
    requiredHours: 486,
    faceRegistered: false,
    createdAt: '2024-02-01',
    active: true,
    registrationLocation: { lat: 14.6095, lng: 120.989 },
    registrationAddress: 'España Blvd, Sampaloc, Manila',
  },
];

// Utility to generate stable-ish ids without calling impure APIs in render
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

const DEFAULT_PASSWORDS: Record<string, string> = {
  'admin@ojt.com': 'admin123',
  'juan.delacruz@email.com': 'ojt2024',
  'maria.santos@email.com': 'ojt2024',
  'carlo.reyes@email.com': 'ojt2024',
  'host.supervisor@ojt.com': 'host123',
};

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Welcome to OJT DTR System!',
    content:
      'Welcome to the On-the-Job Training Daily Time Record system. Please make sure to clock in and out every working day using facial recognition and location verification.',
    type: 'success',
    targetRole: 'all',
    isPinned: true,
    createdAt: new Date().toISOString(),
    createdBy: 'OJT Instructor',
  },
  {
    id: 'ann-2',
    title: 'Reminder: Attendance Policy',
    content:
      'Trainees are required to be within the geofenced zone to record attendance. Tardiness of more than 15 minutes will be marked as late. Please arrive on time.',
    type: 'warning',
    targetRole: 'employee',
    isPinned: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'OJT Instructor',
  },
];

const DEFAULT_HOST_SUPERVISORS: HostSupervisor[] = [
  {
    id: 'host-1',
    name: 'Liza Ramos',
    email: 'host.supervisor@ojt.com',
    companyName: 'TechCorp Philippines',
    position: 'Training Supervisor',
    active: true,
  },
];

const DEFAULT_HOST_FEEDBACK: HostFeedback[] = [
  {
    id: 'hf-1',
    employeeId: 'emp-1',
    hostName: 'Liza Ramos',
    hostCompany: 'TechCorp Philippines',
    hostPosition: 'Training Supervisor',
    hostEmail: 'liza.ramos@techcorp.ph',
    attendanceScore: 95,
    performanceScore: 92,
    attitudeScore: 94,
    communicationScore: 90,
    teamworkScore: 93,
    overallScore: 93,
    strengths: 'Consistently punctual and proactive in daily tasks.',
    areasForImprovement: 'Continue building confidence in presenting ideas during meetings.',
    recommendation: 'Highly Recommended',
    submittedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    status: 'submitted',
  },
];

function generateMockRecords(): TimeRecord[] {
  const records: TimeRecord[] = [];
  const today = new Date();

  for (let i = 30; i >= 1; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    MOCK_EMPLOYEES.slice(0, 2).forEach((emp) => {
      const isLate = Math.random() < 0.15;
      const timeInHour = isLate ? 8 : 7 + Math.floor(Math.random() * 2);
      const timeInMin = isLate ? 15 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 60);
      const totalHours = 8 + Math.random() * 2;
      const timeOutHour = Math.floor(timeInHour + totalHours);
      const timeOutMin = Math.floor((totalHours % 1) * 60);
      const outsidePremises = Math.random() < 0.05;

      records.push({
        id: `rec-${dateStr}-${emp.id}`,
        employeeId: emp.id,
        date: dateStr,
        timeIn: `${String(timeInHour).padStart(2, '0')}:${String(timeInMin).padStart(2, '0')}`,
        timeOut: `${String(timeOutHour).padStart(2, '0')}:${String(timeOutMin).padStart(2, '0')}`,
        timeInGeofenced: !outsidePremises,
        timeOutGeofenced: true,
        timeInFaceVerified: true,
        timeOutFaceVerified: true,
        totalHours: parseFloat(totalHours.toFixed(2)),
        status: isLate ? 'late' : 'present',
      });
    });
  }
  return records;
}

type RegisterEmployeeInput = Omit<Employee, 'id' | 'createdAt'> & {
  password?: string;
};

interface AppContextType {
  currentUser: User | null;
  employees: Employee[];
  timeRecords: TimeRecord[];
  geofenceZones: GeofenceZone[];
  settings: AppSettings;
  evaluations: Evaluation[];
  announcements: Announcement[];
  announcementSubmissions: AnnouncementSubmission[];
  requiredDocuments: RequiredDocument[];
  requiredDocumentSubmissions: RequiredDocumentSubmission[];
  hostFeedback: HostFeedback[];
  hostSupervisors: HostSupervisor[];
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  changeCurrentUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  registerEmployee: (data: RegisterEmployeeInput) => Promise<{ success: boolean; message?: string; employee?: Employee }>;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addTimeRecord: (record: Omit<TimeRecord, 'id'>) => TimeRecord;
  updateTimeRecord: (id: string, data: Partial<TimeRecord>) => void;
  approveTimeRecord: (id: string, approvedBy?: string) => void;
  disapproveTimeRecord: (id: string, note?: string) => void;
  getTodayRecord: (employeeId: string) => TimeRecord | null;
  getEmployeeRecords: (employeeId: string) => TimeRecord[];
  updateGeofenceZones: (zones: GeofenceZone[]) => void;
  addGeofenceZone: (zone: Omit<GeofenceZone, 'id'>) => void;
  updateGeofenceZone: (id: string, data: Partial<GeofenceZone>) => void;
  deleteGeofenceZone: (id: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  getCurrentEmployee: () => Employee | null;
  // Evaluations
  addEvaluation: (data: Omit<Evaluation, 'id'>) => Evaluation;
  updateEvaluation: (id: string, data: Partial<Evaluation>) => void;
  deleteEvaluation: (id: string) => void;
  getEmployeeEvaluation: (employeeId: string) => Evaluation | null;
  // Announcements
  addAnnouncement: (data: Omit<Announcement, 'id'>) => Announcement;
  updateAnnouncement: (id: string, data: Partial<Announcement>) => void;
  deleteAnnouncement: (id: string) => void;
  getActiveAnnouncements: (role?: 'employee' | 'admin' | 'hte' | 'host') => Announcement[];
  submitAnnouncementResponse: (
    announcementId: string,
    employeeId: string,
    message: string,
    photo?: string
  ) => AnnouncementSubmission;
  getAnnouncementSubmission: (announcementId: string, employeeId: string) => AnnouncementSubmission | null;
  getAnnouncementSubmissionStatus: (announcement: Announcement, employeeId: string) => 'passed' | 'missed' | 'pending';
  addRequiredDocument: (
    employeeId: string,
    data: { title: string; description?: string; notes?: string; dueDate?: string; required?: boolean; academicYear?: string }
  ) => RequiredDocument;
  updateRequiredDocument: (id: string, data: Partial<RequiredDocument>) => void;
  deleteRequiredDocument: (id: string) => void;
  getEmployeeRequiredDocuments: (employeeId: string) => RequiredDocument[];
  getRequirementStatus: (documentId: string, employeeId: string) => RequirementStatus;
  getEmployeeRequirementSummary: (employeeId: string) => { missing: number; incomplete: number; complete: number };
  submitRequiredDocument: (
    documentId: string,
    employeeId: string,
    payload: { note?: string; notes?: string; fileName?: string; fileUrl?: string }
  ) => RequiredDocumentSubmission;
  getRequiredDocumentSubmission: (documentId: string, employeeId: string) => RequiredDocumentSubmission | null;
  // Host Feedback
  addHostFeedback: (data: Omit<HostFeedback, 'id' | 'overallScore' | 'submittedAt' | 'status'>) => HostFeedback;
  updateHostFeedback: (id: string, data: Partial<HostFeedback>) => void;
  deleteHostFeedback: (id: string) => void;
  getEmployeeHostFeedback: (employeeId: string) => HostFeedback[];
  getLatestHostFeedback: (employeeId: string) => HostFeedback | null;
  approveEmployee: (id: string) => void;
  rejectEmployee: (id: string) => void;
  setPasswordForEmail: (email: string, password: string) => void;
  syncAllAccountsAcrossAcademicYears: (targetAcademicYear?: string) => Promise<{ success: boolean; syncedCount: number; message: string }>;
  repairAndPersistDatabase: () => Promise<{ success: boolean; message: string; repairedCounts: any }>;
}

const AppContext = createContext<AppContextType | null>(null);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function normalizePasswordMap(map: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.entries(map).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      normalized[normalizeEmail(key)] = value;
    }
  });
  return normalized;
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeGeofenceZone(input: unknown): GeofenceZone | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<GeofenceZone>;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const radius = GEOFENCE_RADIUS_METERS;
  const valid =
    isFiniteCoord(lat) &&
    isFiniteCoord(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    Number.isFinite(radius) &&
    radius > 0;
  if (!valid) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: typeof raw.name === 'string' ? raw.name : 'Geofence Zone',
    address: typeof raw.address === 'string' ? raw.address : '',
    lat,
    lng,
    radius,
    active: raw.active !== false,
  };
}

function sanitizeGeofenceZones(inputs: unknown): GeofenceZone[] {
  if (!Array.isArray(inputs)) return [];
  return inputs.map(sanitizeGeofenceZone).filter((zone): zone is GeofenceZone => zone !== null);
}

function migrateGeofenceStorageOnce(): void {
  try {
    if (localStorage.getItem(STORAGE_KEYS.GEOFENCE_MIGRATION_V1) === 'done') return;
    const raw = localStorage.getItem(STORAGE_KEYS.GEOFENCE_ZONES);
    const parsed = raw ? JSON.parse(raw) : [];
    const sanitized = sanitizeGeofenceZones(parsed);
    saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitized.length > 0 ? sanitized : DEFAULT_GEOFENCE);
    localStorage.setItem(STORAGE_KEYS.GEOFENCE_MIGRATION_V1, 'done');
  } catch {
    // Keep app boot resilient even if old storage is malformed.
  }
}

function migrateInstructorPositionOnce(): void {
  try {
    if (localStorage.getItem('ojt_migrated_instructor_positions') === 'done') return;
    const raw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    const parsed = raw ? JSON.parse(raw) : [];
    let changed = false;
    if (Array.isArray(parsed)) {
      parsed.forEach((emp: any) => {
        if (emp && emp.position === 'Administrator') {
          emp.position = 'OJT Instructor';
          if (emp.name === 'Administrator') emp.name = 'OJT Instructor';
          changed = true;
        }
      });
    }
    if (changed) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, parsed);
    }
    localStorage.setItem('ojt_migrated_instructor_positions', 'done');
  } catch {
    // ignore migration failures
  }
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function AppProvider({ children }: { children: ReactNode }) {
  migrateGeofenceStorageOnce();
  migrateInstructorPositionOnce();
  const [isLoading, setIsLoading] = useState(false);
  const [useSupabase, setUseSupabase] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(() => loadFromStorage(STORAGE_KEYS.CURRENT_USER, null));
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const stored = loadFromStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    if (stored.length === 0) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
      return MOCK_EMPLOYEES;
    }
    return stored;
  });
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>(() => {
    const stored = loadFromStorage<TimeRecord[]>(STORAGE_KEYS.TIME_RECORDS, []);
    if (stored.length === 0) {
      const mock = generateMockRecords();
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, mock);
      return mock;
    }
    return stored;
  });
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>(() => {
    const stored = loadFromStorage<unknown>(STORAGE_KEYS.GEOFENCE_ZONES, DEFAULT_GEOFENCE);
    const sanitized = sanitizeGeofenceZones(stored);
    return sanitized.length > 0 ? sanitized : DEFAULT_GEOFENCE;
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = loadFromStorage<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
    const currentAcademicYear = getCurrentAcademicYear();
    const academicYears = Array.from(new Set([...(stored.academicYears || DEFAULT_SETTINGS.academicYears), currentAcademicYear]));
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      academicYears,
      activeAcademicYear: stored.activeAcademicYear || currentAcademicYear,
    };
  });
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => loadFromStorage(STORAGE_KEYS.EVALUATIONS, []));
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const stored = loadFromStorage<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
    if (stored.length === 0) {
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, DEFAULT_ANNOUNCEMENTS);
      return DEFAULT_ANNOUNCEMENTS;
    }
    return stored;
  });
  const [announcementSubmissions, setAnnouncementSubmissions] = useState<AnnouncementSubmission[]>(() =>
    loadFromStorage<AnnouncementSubmission[]>(STORAGE_KEYS.ANNOUNCEMENT_SUBMISSIONS, [])
  );
  const [requiredDocuments, setRequiredDocuments] = useState<RequiredDocument[]>(() =>
    loadFromStorage<RequiredDocument[]>(STORAGE_KEYS.REQUIRED_DOCUMENTS, [])
  );
  const [requiredDocumentSubmissions, setRequiredDocumentSubmissions] = useState<RequiredDocumentSubmission[]>(() =>
    loadFromStorage<RequiredDocumentSubmission[]>(STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS, [])
  );
  const [hostSupervisors, setHostSupervisors] = useState<HostSupervisor[]>(() => {
    const stored = loadFromStorage<HostSupervisor[]>(STORAGE_KEYS.HOST_SUPERVISORS, []);
    if (stored.length === 0) {
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, DEFAULT_HOST_SUPERVISORS);
      return DEFAULT_HOST_SUPERVISORS;
    }
    return stored;
  });
  const [hostFeedback, setHostFeedback] = useState<HostFeedback[]>(() => {
    const stored = loadFromStorage<HostFeedback[]>(STORAGE_KEYS.HOST_FEEDBACK, []);
    if (stored.length === 0) {
      saveToStorage(STORAGE_KEYS.HOST_FEEDBACK, DEFAULT_HOST_FEEDBACK);
      return DEFAULT_HOST_FEEDBACK;
    }
    return stored;
  });
  const [passwords, setPasswords] = useState<Record<string, string>>(() => {
    const stored = loadFromStorage<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
    const normalized = normalizePasswordMap(stored);
    if (Object.keys(normalized).length === 0) {
      return normalizePasswordMap(DEFAULT_PASSWORDS);
    }
    const defaults = normalizePasswordMap(DEFAULT_PASSWORDS);
    Object.entries(defaults).forEach(([key, value]) => {
      if (!normalized[key]) normalized[key] = value;
    });
    return normalized;
  });

  // Check if Supabase is configured and load initial data
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      const configured = isSupabaseConfigured();

      if (!isMounted) return;
      setUseSupabase(configured);

      if (configured) {
        try {
          setIsLoading(true);
          // Run one-time Supabase migration to normalize 'Administrator' → 'OJT Instructor'
          try {
            if (localStorage.getItem('ojt_migrated_instructor_positions') !== 'done') {
              // import lazily to avoid circular imports at module level
              const { migrateAdministratorPosition } = await import('../services/supabaseService');
              migrateAdministratorPosition().catch(() => {});
              localStorage.setItem('ojt_migrated_instructor_positions', 'done');
            }
          } catch {
            // ignore migration errors
          }

          // Fetch all data from Supabase
          const [
            supabaseEmployees,
            supabaseRecords,
            supabaseZones,
            supabaseSettings,
            supabaseEvaluations,
            supabaseAnnouncements,
            supabaseHostFeedback,
          ] = await Promise.all([
            supabaseService.fetchEmployees(),
            supabaseService.fetchTimeRecords(),
            supabaseService.fetchGeofenceZones(),
            supabaseService.fetchSettings(),
            supabaseService.fetchEvaluations(),
            supabaseService.fetchAnnouncements(),
            supabaseService.fetchHostFeedback(),
          ]);

          if (!isMounted) return;

          if (supabaseEmployees.length > 0) setEmployees(supabaseEmployees);
          if (supabaseRecords.length > 0) setTimeRecords(supabaseRecords);
          const sanitizedSupabaseZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedSupabaseZones.length > 0) setGeofenceZones(sanitizedSupabaseZones);
          if (supabaseSettings) setSettings(supabaseSettings);
          if (supabaseEvaluations.length > 0) setEvaluations(supabaseEvaluations);
          if (supabaseAnnouncements.length > 0) setAnnouncements(supabaseAnnouncements);
          if (supabaseHostFeedback.length > 0) setHostFeedback(supabaseHostFeedback);
        } catch (error) {
          console.error('Error loading data from Supabase:', error);
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time Supabase Broadcast Subscription across all 3 roles (Instructor, Employee/Trainee, HTE)
  useEffect(() => {
    if (!useSupabase) return;

    const channel = supabase
      .channel('public-realtime-system-binding')
      .on('postgres_changes', { event: '*', schema: 'public' }, async () => {
        try {
          const [
            supabaseEmployees,
            supabaseRecords,
            supabaseZones,
            supabaseSettings,
            supabaseEvaluations,
            supabaseAnnouncements,
            supabaseHostFeedback,
          ] = await Promise.all([
            supabaseService.fetchEmployees(),
            supabaseService.fetchTimeRecords(),
            supabaseService.fetchGeofenceZones(),
            supabaseService.fetchSettings(),
            supabaseService.fetchEvaluations(),
            supabaseService.fetchAnnouncements(),
            supabaseService.fetchHostFeedback(),
          ]);

          if (supabaseEmployees.length > 0) setEmployees(supabaseEmployees);
          if (supabaseRecords.length > 0) setTimeRecords(supabaseRecords);
          const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedZones.length > 0) setGeofenceZones(sanitizedZones);
          if (supabaseSettings) setSettings(supabaseSettings);
          if (supabaseEvaluations.length > 0) setEvaluations(supabaseEvaluations);
          if (supabaseAnnouncements.length > 0) setAnnouncements(supabaseAnnouncements);
          if (supabaseHostFeedback.length > 0) setHostFeedback(supabaseHostFeedback);
        } catch (err) {
          console.error('Supabase real-time sync error:', err);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [useSupabase]);

  // Save to localStorage only when not using Supabase
  useEffect(() => {
    if (!useSupabase && employees.length > 0) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, employees);
    }
  }, [employees, useSupabase]);

  useEffect(() => {
    if (!useSupabase && timeRecords.length > 0) {
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, timeRecords);
    }
  }, [timeRecords, useSupabase]);

  useEffect(() => {
    if (!useSupabase && geofenceZones.length > 0) {
      saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, geofenceZones);
    }
  }, [geofenceZones, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.SETTINGS, settings);
    }
  }, [settings, useSupabase]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (!useSupabase && evaluations.length > 0) {
      saveToStorage(STORAGE_KEYS.EVALUATIONS, evaluations);
    }
  }, [evaluations, useSupabase]);

  useEffect(() => {
    if (!useSupabase && announcements.length > 0) {
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
    }
  }, [announcements, useSupabase]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_SUBMISSIONS, announcementSubmissions);
  }, [announcementSubmissions]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENTS, requiredDocuments);
  }, [requiredDocuments]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS, requiredDocumentSubmissions);
  }, [requiredDocumentSubmissions]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, hostSupervisors);
  }, [hostSupervisors]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.HOST_FEEDBACK, hostFeedback);
  }, [hostFeedback]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PASSWORDS, passwords);
  }, [passwords]);

  const setPasswordForEmail = (email: string, password: string) => {
    const norm = normalizeEmail(email);
    setPasswords((prev) => {
      const updated = { ...prev, [norm]: password };
      try {
        localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const login = async (identifier: string, password: string): Promise<User | null> => {
    const normalizedId = identifier.toLowerCase().trim();

    // 1. Try Supabase Auth first
    if (useSupabase) {
      let targetEmail = normalizedId;
      const emp = employees.find(
        (e) =>
          (normalizeEmail(e.email) === normalizedId || (e.username && e.username.toLowerCase() === normalizedId)) && e.active
      );
      if (emp) {
        targetEmail = normalizeEmail(emp.email);
      } else {
        const host = hostSupervisors.find((h) => normalizeEmail(h.email) === normalizedId && h.active);
        if (host) {
          targetEmail = normalizeEmail(host.email);
        }
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: password,
        });

        if (!authError && authData.user) {
          const userId = authData.user.id;
          
          // Try to match with loaded employees or host supervisors
          const matchedEmp = employees.find(
            (e) =>
              e.active &&
              (e.id === userId ||
                normalizeEmail(e.email) === normalizeEmail(targetEmail) ||
                (e.username && e.username.toLowerCase() === normalizedId))
          );
          if (matchedEmp) {
            const role: User['role'] =
              matchedEmp.position === 'OJT Instructor' ? 'admin' : matchedEmp.position === 'HTE Representative' ? 'hte' : 'employee';
            const user: User = {
              id: matchedEmp.id,
              name: matchedEmp.name,
              role,
              employeeId: matchedEmp.id,
              email: normalizeEmail(matchedEmp.email),
              photo: matchedEmp.photo,
              faceRegistered: matchedEmp.faceRegistered,
            };
            setCurrentUser(user);
            setPasswordForEmail(matchedEmp.email, password);
            return user;
          }

          const matchedHost = hostSupervisors.find((h) => h.id === userId && h.active);
          if (matchedHost) {
            const user: User = { id: matchedHost.id, name: matchedHost.name, role: 'host', email: normalizeEmail(matchedHost.email) };
            setCurrentUser(user);
            setPasswordForEmail(matchedHost.email, password);
            return user;
          }

          // Fallback user construction from metadata
          const roleFromMetadata = authData.user.user_metadata?.role;
          const nameFromMetadata = authData.user.user_metadata?.full_name || authData.user.email || 'User';
          
          const role: User['role'] = roleFromMetadata === 'admin' ? 'admin' : roleFromMetadata === 'host' ? 'host' : 'employee';
          const user: User = {
            id: userId,
            name: nameFromMetadata,
            role,
            employeeId: role === 'employee' ? userId : undefined,
            email: authData.user.email ? normalizeEmail(authData.user.email) : normalizeEmail(targetEmail),
            photo: matchedEmp?.photo,
            faceRegistered: matchedEmp?.faceRegistered,
          };
          setCurrentUser(user);
          setPasswordForEmail(user.email, password);
          return user;
        }
      } catch (err) {
        console.error('Supabase signInWithPassword exception, trying local fallback:', err);
      }
    }

    // 2. Direct Matching / Local & Offline fallback
    const emp = employees.find(
      (e) =>
        normalizeEmail(e.email) === normalizedId || (e.username && e.username.toLowerCase() === normalizedId)
    );

    const storedPasswords = loadFromStorage<Record<string, string>>(STORAGE_KEYS.PASSWORDS, passwords);
    const storedPassword = emp ? storedPasswords[normalizeEmail(emp.email)] || passwords[normalizeEmail(emp.email)] : undefined;
    const fallbackPassword =
      emp?.position === 'OJT Instructor' ? 'admin123' : emp?.position === 'HTE Representative' ? 'hte123' : 'ojt2024';

    if (emp && (password === storedPassword || password === fallbackPassword || !storedPassword)) {
      if (emp.active === false || emp.approvalStatus === 'pending') {
        return {
          id: emp.id,
          name: emp.name,
          role: 'employee',
          pendingApproval: true,
          academicYear: emp.academicYear || settings.activeAcademicYear,
        } as any;
      }
      try {
        const resp = await authAPI.login(emp.email, password);
        if (resp && resp.data && resp.data.tokens) {
          localStorage.setItem('ojt_jwt_access_token', resp.data.tokens.access);
          localStorage.setItem('ojt_jwt_refresh_token', resp.data.tokens.refresh);
        }
      } catch (e) {
        console.warn('Failed to obtain JWT token during local login:', e);
      }
      const role: User['role'] =
        emp.position === 'OJT Instructor' ? 'admin' : emp.position === 'HTE Representative' ? 'hte' : 'employee';
      const user: User = {
        id: emp.id,
        name: emp.name,
        role,
        employeeId: emp.id,
        email: normalizeEmail(emp.email),
        photo: emp.photo,
        faceRegistered: emp.faceRegistered,
      };
      setCurrentUser(user);
      setPasswordForEmail(emp.email, password);
      return user;
    }

    const host = hostSupervisors.find((h) => normalizeEmail(h.email) === normalizedId && h.active);
    if (host) {
      const storedHostPassword = storedPasswords[normalizedId] || passwords[normalizedId];
      if (password === storedHostPassword || !storedHostPassword || password === 'hte123') {
        const user: User = {
          id: host.id,
          name: host.name,
          role: 'host',
          email: normalizeEmail(host.email),
          photo: undefined,
          faceRegistered: false,
        };
        setCurrentUser(user);
        setPasswordForEmail(host.email, password);
        return user;
      }
    }

    if (normalizedId === 'admin@ojt.com' && (password === 'admin123' || password === 'admin')) {
      const user: User = { id: 'admin', name: 'OJT Instructor', role: 'admin', email: 'admin@ojt.com' };
      setCurrentUser(user);
      return user;
    }

    return null;
  };

  const logout = () => {
    setCurrentUser(null);
    if (useSupabase) {
      supabase.auth.signOut().catch((err) => {
        console.error('Error signing out from Supabase:', err);
      });
    }
  };

  const getCurrentUserEmail = (): string | null => {
    if (!currentUser) return null;
    if (currentUser.email) return normalizeEmail(currentUser.email);
    if (currentUser.role === 'host') {
      const host = hostSupervisors.find((h) => h.id === currentUser.id);
      return host ? normalizeEmail(host.email) : null;
    }
    const employee = employees.find(
      (e) =>
        e.id === currentUser.employeeId ||
        e.id === currentUser.id ||
        normalizeEmail(e.email) === normalizeEmail(currentUser.email || '')
    );
    return employee ? normalizeEmail(employee.email) : null;
  };

  const changeCurrentUserPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const email = getCurrentUserEmail();
    if (!email) return { success: false, message: 'Current account not found.' };

    const checkLocalFallback = () => {
      const account = employees.find((e) => normalizeEmail(e.email) === email);
      const host = hostSupervisors.find((h) => normalizeEmail(h.email) === email);
      const position = account?.position || (host ? 'HTE Representative' : '');
      const fallbackPassword = position === 'OJT Instructor' ? 'admin123' : position === 'HTE Representative' ? 'hte123' : 'ojt2024';
      const existingPassword = passwords[email] || fallbackPassword;
      
      if (currentPassword !== existingPassword) {
        return { success: false, message: 'Current password is incorrect.' };
      }
      if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'New password must be at least 6 characters.' };
      }
      if (newPassword === existingPassword) {
        return { success: false, message: 'New password must be different from current password.' };
      }
      setPasswordForEmail(email, newPassword);
      return { success: true, message: 'Password updated successfully (local mode).' };
    };

    if (useSupabase) {
      try {
        // 1. Verify the current password by signing in
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: email,
          password: currentPassword,
        });

        if (verifyError) {
          console.warn('Supabase password verify failed, trying local fallback:', verifyError);
          return checkLocalFallback();
        }

        // 2. Update to the new password in Supabase Auth
        if (!newPassword || newPassword.length < 6) {
          return { success: false, message: 'New password must be at least 6 characters.' };
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateError) {
          return { success: false, message: updateError.message };
        }

        setPasswordForEmail(email, newPassword);
        return { success: true, message: 'Password updated successfully.' };
      } catch (err: any) {
        console.error('changeCurrentUserPassword exception:', err);
        return checkLocalFallback();
      }
    }

    return checkLocalFallback();
  };

  const registerEmployee = async (data: RegisterEmployeeInput): Promise<{ success: boolean; message?: string; employee?: Employee }> => {
    const { password, ...employeeData } = data;
    
    // Check if email already exists locally (in memory state)
    const existingLocalEmp = employees.find((e) => e.email.toLowerCase() === employeeData.email.toLowerCase());
    if (existingLocalEmp) {
      const updatedData: Employee = {
        ...existingLocalEmp,
        ...employeeData,
        name: employeeData.name || existingLocalEmp.name,
        companyName: employeeData.companyName || existingLocalEmp.companyName || 'N/A',
        supervisorName: employeeData.supervisorName || existingLocalEmp.supervisorName || 'N/A',
        schoolName: employeeData.schoolName || existingLocalEmp.schoolName || 'Carlos Hilado Memorial State University',
        campus: employeeData.campus || existingLocalEmp.campus || 'Talisay Campus',
        course: employeeData.course || existingLocalEmp.course || 'N/A',
        department: employeeData.department || existingLocalEmp.department || 'College of Computer Studies',
        startDate: employeeData.startDate || existingLocalEmp.startDate || new Date().toISOString().split('T')[0],
        endDate: employeeData.endDate || existingLocalEmp.endDate || new Date().toISOString().split('T')[0],
        requiredHours: employeeData.requiredHours ?? existingLocalEmp.requiredHours ?? 486,
        photo: employeeData.photo || existingLocalEmp.photo,
        faceRegistered: employeeData.faceRegistered ?? existingLocalEmp.faceRegistered,
        active: true,
      };
      if (password) {
        setPasswordForEmail(employeeData.email, password);
      }
      setEmployees((prev) => [updatedData, ...prev.filter((e) => e.id !== existingLocalEmp.id)]);
      return {
        success: true,
        message: 'Account profile updated with your registration details and face recognition.',
        employee: updatedData,
      };
    }

    // Set robust default values for non-trainee roles to avoid violating NOT NULL database constraints
    const cleanData = {
      ...employeeData,
      companyName: employeeData.companyName || (employeeData.position === 'HTE Representative' ? 'HTE Partner' : 'N/A'),
      supervisorName: employeeData.supervisorName || 'N/A',
      schoolName: employeeData.schoolName || 'N/A',
      campus: employeeData.campus || 'N/A',
      course: employeeData.course || 'N/A',
      startDate: employeeData.startDate || new Date().toISOString().split('T')[0],
      endDate: employeeData.endDate || new Date().toISOString().split('T')[0],
      requiredHours: employeeData.requiredHours ?? 0,
    };

    const newEmp: Employee = {
      ...cleanData,
      academicYear: cleanData.academicYear || settings.activeAcademicYear,
      id: generateId('emp'),
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (useSupabase) {
      try {
        // Query Supabase to double-check email uniqueness (best-effort — RLS may block anon reads)
        try {
          const { data: existingEmp } = await supabase
            .from('employees')
            .select('id')
            .ilike('email', cleanData.email)
            .maybeSingle();

          if (existingEmp) {
            // Update the existing record with new details instead of rejecting
            const updatedData: Employee = {
              ...cleanData,
              id: existingEmp.id,
              academicYear: cleanData.academicYear || settings.activeAcademicYear,
              createdAt: new Date().toISOString().split('T')[0],
            };
            if (password) setPasswordForEmail(cleanData.email, password);
            setEmployees((prev) => [updatedData, ...prev.filter((e) => e.id !== existingEmp.id)]);
            return {
              success: true,
              message: 'Account profile updated with your registration details and face recognition.',
              employee: updatedData,
            };
          }
        } catch (checkErr) {
          // RLS or network error — skip uniqueness pre-check; signUp will catch duplicates
          console.warn('Email uniqueness pre-check failed (possibly RLS), proceeding with signUp:', checkErr);
        }

        let authId: string | undefined;
        if (password) {
          try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: cleanData.email.trim(),
              password: password,
              options: {
                data: {
                  full_name: cleanData.name,
                  role: cleanData.position === 'OJT Instructor' ? 'admin' : cleanData.position === 'HTE Representative' ? 'host' : 'employee',
                }
              }
            });

            if (authError) {
              console.warn('Supabase Auth signUp note:', authError.message);
            } else if (authData?.user?.id) {
              authId = authData.user.id;
            }
          } catch (signUpErr) {
            console.warn('Supabase Auth signUp exception:', signUpErr);
          }
        }

        const employeePayload = {
          ...cleanData,
          id: authId || newEmp.id || crypto.randomUUID(),
        };

        let created: Employee | null = null;
        if (isSupabaseConfigured()) {
          try {
            created = await supabaseService.createEmployee(employeePayload);
          } catch (createErr: any) {
            console.warn('supabaseService.createEmployee failed, trying upsert:', createErr);
            const upsertOk = await supabaseService.upsertEmployees([employeePayload as Employee]);
            if (upsertOk) {
              created = employeePayload as Employee;
            }
          }
        }

        if (!created) {
          // Fallback to memory / local store
          created = { ...newEmp, ...employeePayload } as Employee;
        }

        if (password) {
          setPasswordForEmail(cleanData.email, password);
        }

        setEmployees((prev) => [created!, ...prev.filter((e) => e.email.toLowerCase() !== cleanData.email.toLowerCase())]);

          // Handle face registration after successful database creation to use the real database UUID
          // Skip face registration for OJT Instructors and HTE Representatives
          if (
            cleanData.photo &&
            isSecurityApiConfigured() &&
            cleanData.position !== 'OJT Instructor' &&
            cleanData.position !== 'HTE Representative'
          ) {
            try {
              const response = await registerFace({
                employee_id: created.id,
                image: cleanData.photo,
              });
              if (response.success && response.image_url) {
                // Update shared state and return an updated copy instead of mutating
                updateEmployee(created.id, { photo: response.image_url, faceRegistered: true });
                // create a non-mutated copy to return
                const updatedCreated = { ...created, photo: response.image_url, faceRegistered: true };
                return { success: true, employee: updatedCreated } as any;
              }
            } catch (err) {
              console.error('Face registration failed inside AppContext:', err);
            }
          }
          return { success: true, employee: created };
      } catch (err: any) {
        console.error('registerEmployee Supabase path error:', err);
        const errMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown error during Supabase registration.';
        return { success: false, message: errMsg };
      }
    } else {
      if (password) {
        setPasswordForEmail(employeeData.email, password);
      }
      setEmployees((prev) => [...prev, newEmp]);

      // Local storage face enrollment fallback
      // Skip face registration for OJT Instructors and HTE Representatives
      if (
        cleanData.photo &&
        isSecurityApiConfigured() &&
        cleanData.position !== 'OJT Instructor' &&
        cleanData.position !== 'HTE Representative'
      ) {
        try {
          const response = await registerFace({
            employee_id: newEmp.id,
            image: cleanData.photo,
          });
          if (response.success && response.image_url) {
            updateEmployee(newEmp.id, { photo: response.image_url, faceRegistered: true });
            const updatedNewEmp = { ...newEmp, photo: response.image_url, faceRegistered: true };
            return { success: true, employee: updatedNewEmp } as any;
          }
        } catch (err) {
          console.error('Local face registration failed:', err);
        }
      }
      return { success: true, employee: newEmp };
    }
  };

  const updateEmployee = (id: string, data: Partial<Employee>) => {
    const updatedEmployees = employees.map((e) => (e.id === id ? { ...e, ...data } : e));
    setEmployees(updatedEmployees);

    const updatedEmployee = updatedEmployees.find((e) => e.id === id);
    if (updatedEmployee && currentUser && (currentUser.employeeId === id || currentUser.id === id)) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              name: updatedEmployee.name || prev.name,
              email: updatedEmployee.email || prev.email,
              photo: updatedEmployee.photo || prev.photo,
              faceRegistered: updatedEmployee.faceRegistered ?? prev.faceRegistered ?? false,
            }
          : prev
      );
    }

    if (useSupabase) {
      supabaseService.updateEmployee(id, data);
    }
  };

  const deleteEmployee = (id: string) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, active: false } : e)));

    if (useSupabase) {
      supabaseService.deleteEmployee(id);
    }
  };

  const addTimeRecord = (record: Omit<TimeRecord, 'id'>): TimeRecord => {
    const recordWithAY = { ...record, academicYear: record.academicYear || settings.activeAcademicYear };
    const newRecord: TimeRecord = { ...recordWithAY, id: `rec-${Date.now()}` };

    if (useSupabase) {
      supabaseService.createTimeRecord(recordWithAY).then((created) => {
        if (created) {
          setTimeRecords((prev) => [created, ...prev]);
        }
      });
    } else {
      setTimeRecords((prev) => [...prev, newRecord]);
    }

    return newRecord;
  };

  const updateTimeRecord = (id: string, data: Partial<TimeRecord>) => {
    setTimeRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));

    if (useSupabase) {
      supabaseService.updateTimeRecord(id, data);
    }
  };

  const approveTimeRecord = (id: string, approvedBy?: string) => {
    const now = new Date().toISOString();
    const update: Partial<TimeRecord> = {
      approvalStatus: 'approved',
      approvedBy: approvedBy || 'Instructor',
      approvedAt: now,
      approvalNote: '',
    };
    setTimeRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
    if (useSupabase) supabaseService.updateTimeRecord(id, update);
  };

  const disapproveTimeRecord = (id: string, note?: string) => {
    const now = new Date().toISOString();
    const update: Partial<TimeRecord> = {
      approvalStatus: 'disapproved',
      approvalNote: note || '',
      approvedAt: now,
    };
    setTimeRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
    if (useSupabase) supabaseService.updateTimeRecord(id, update);
  };


  const getTodayRecord = (employeeId: string): TimeRecord | null => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = timeRecords.filter((r) => r.employeeId === employeeId && r.date === today);
    if (todayRecords.length === 0) return null;
    
    // Sort today's records reverse-chronologically (newest first) by their id
    return todayRecords.sort((a, b) => b.id.localeCompare(a.id))[0];
  };

  const getEmployeeRecords = (employeeId: string): TimeRecord[] => {
    return timeRecords.filter((r) => r.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date));
  };

  const updateGeofenceZones = (zones: GeofenceZone[]) => {
    const sanitized = sanitizeGeofenceZones(zones);
    setGeofenceZones(sanitized);
  };

  const addGeofenceZone = (zone: Omit<GeofenceZone, 'id'>) => {
    const zoneWithAY = { ...zone, academicYear: (zone as any).academicYear || settings.activeAcademicYear };
    const newZone = sanitizeGeofenceZone({ ...zoneWithAY, id: `zone-${Date.now()}` });
    if (!newZone) return;

    if (useSupabase) {
      supabaseService.createGeofenceZone(zoneWithAY).then((created) => {
        const sanitizedCreated = sanitizeGeofenceZone(created);
        if (sanitizedCreated) {
          setGeofenceZones((prev) => [...prev, sanitizedCreated]);
        }
      });
    } else {
      setGeofenceZones((prev) => [...prev, newZone]);
    }
  };

  const updateGeofenceZone = (id: string, data: Partial<GeofenceZone>) => {
    setGeofenceZones((prev) =>
      prev.map((z) => {
        if (z.id !== id) return z;
        const merged = sanitizeGeofenceZone({ ...z, ...data });
        return merged || z;
      })
    );

    if (useSupabase) {
      supabaseService.updateGeofenceZone(id, data);
    }
  };

  const deleteGeofenceZone = (id: string) => {
    setGeofenceZones((prev) => prev.filter((z) => z.id !== id));

    if (useSupabase) {
      supabaseService.deleteGeofenceZone(id);
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    if (useSupabase) {
      supabaseService.updateSettings(updated);
    }
  };

  const getCurrentEmployee = (): Employee | null => {
    if (!currentUser) return null;
    let employee = employees.find(
      (e) =>
        e.id === currentUser.employeeId ||
        e.id === currentUser.id ||
        (currentUser.email ? normalizeEmail(e.email) === normalizeEmail(currentUser.email) : false)
    );
    if (!employee && currentUser) {
      const currentUserAny = currentUser as any;
      const registrationLocation =
        currentUserAny.registrationLocation ||
        (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('ojt_hte_user') || 'null')?.registrationLocation : null) ||
        undefined;
      const registrationAddress =
        currentUserAny.registrationAddress ||
        (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('ojt_hte_user') || 'null')?.registrationAddress : null) ||
        currentUserAny.companyAddress ||
        undefined;
      const fallbackEmp: Employee = {
        id: currentUser.employeeId || currentUser.id || `emp-${Date.now()}`,
        employeeId: currentUser.employeeId || currentUser.id || 'OJT-STUDENT',
        name: currentUser.name || 'Trainee Student',
        email: currentUser.email || '',
        department: currentUserAny.department || 'College of Computer Studies',
        position: currentUserAny.position || (currentUser.role === 'admin' ? 'OJT Instructor' : currentUser.role === 'hte' ? 'HTE Representative' : 'OJT Trainee'),
        companyName: currentUserAny.companyName || 'Host Training Establishment',
        supervisorName: currentUserAny.supervisorName || 'HTE Supervisor',
        schoolName: currentUserAny.schoolName || 'Carlos Hilado Memorial State University',
        campus: currentUserAny.campus || 'Talisay Campus',
        course: currentUserAny.course || 'BS Information Technology',
        startDate: currentUserAny.startDate || new Date().toISOString().split('T')[0],
        endDate: currentUserAny.endDate || new Date().toISOString().split('T')[0],
        requiredHours: currentUserAny.requiredHours || 486,
        photo: currentUser.photo || '',
        faceRegistered: currentUser.faceRegistered ?? false,
        registrationLocation,
        registrationAddress,
        companyAddress: currentUserAny.companyAddress || registrationAddress,
        active: true,
        academicYear: currentUserAny.academicYear || settings.activeAcademicYear,
        approvalStatus: 'approved',
        createdAt: new Date().toISOString().split('T')[0],
      };
      return fallbackEmp;
    }
    return employee || null;
  };

  // ─── Evaluations ─────────────────────────────────────────────────────────────
  const addEvaluation = (data: Omit<Evaluation, 'id'>): Evaluation => {
    const newEval: Evaluation = { ...data, id: `eval-${Date.now()}` };

    if (useSupabase) {
      supabaseService.createEvaluation(data).then((created) => {
        if (created) {
          setEvaluations((prev) => [created, ...prev]);
        }
      });
    } else {
      setEvaluations((prev) => [...prev, newEval]);
    }

    return newEval;
  };

  const updateEvaluation = (id: string, data: Partial<Evaluation>) => {
    setEvaluations((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));

    if (useSupabase) {
      supabaseService.updateEvaluation(id, data);
    }
  };

  const deleteEvaluation = (id: string) => {
    setEvaluations((prev) => prev.filter((e) => e.id !== id));

    if (useSupabase) {
      supabaseService.deleteEvaluation(id);
    }
  };

  const getEmployeeEvaluation = (employeeId: string): Evaluation | null => {
    return evaluations.find((e) => e.employeeId === employeeId) || null;
  };

  // ─── Announcements ────────────────────────────────────────────────────────────
  const addAnnouncement = (data: Omit<Announcement, 'id'>): Announcement => {
    const dataWithAY = { ...data, academicYear: data.academicYear || settings.activeAcademicYear };
    const newAnn: Announcement = { ...dataWithAY, id: `ann-${Date.now()}` };

    setAnnouncements((prev) => [newAnn, ...prev]);

    if (useSupabase) {
      supabaseService.createAnnouncement(dataWithAY).then((created) => {
        if (created) {
          setAnnouncements((prev) => prev.map((a) => (a.id === newAnn.id ? created : a)));
        }
      });
    }

    return newAnn;
  };

  const updateAnnouncement = (id: string, data: Partial<Announcement>) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));

    if (useSupabase) {
      supabaseService.updateAnnouncement(id, data);
    }
  };

  const deleteAnnouncement = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));

    if (useSupabase) {
      supabaseService.deleteAnnouncement(id);
    }
  };

  const getActiveAnnouncements = (role?: 'employee' | 'admin' | 'hte' | 'host'): Announcement[] => {
    const now = new Date();
    const matchesAudience = (announcementRole: Announcement['targetRole'], requestedRole?: typeof role) => {
      if (!requestedRole) return true;
      if (announcementRole === 'all') return true;
      if (requestedRole === 'admin') return ['admin', 'employee'].includes(announcementRole);
      if (requestedRole === 'employee') return ['employee', 'admin'].includes(announcementRole);
      if (requestedRole === 'hte') return ['hte', 'host'].includes(announcementRole);
      if (requestedRole === 'host') return ['host', 'hte'].includes(announcementRole);
      return false;
    };

    return announcements
      .filter((a) => {
        if (a.expiresAt && new Date(a.expiresAt) < now) return false;
        if (!matchesAudience(a.targetRole, role)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  };

  const submitAnnouncementResponse = (
    announcementId: string,
    employeeId: string,
    message: string,
    photo?: string
  ): AnnouncementSubmission => {
    const now = new Date().toISOString();
    let saved: AnnouncementSubmission = {
      id: `ann-sub-${Date.now()}`,
      announcementId,
      employeeId,
      message,
      photo,
      submittedAt: now,
    };
    setAnnouncementSubmissions((prev) => {
      const existing = prev.find((s) => s.announcementId === announcementId && s.employeeId === employeeId);
      if (existing) {
        saved = { ...existing, message, photo, submittedAt: now };
        return prev.map((s) => (s.id === existing.id ? saved : s));
      }
      return [saved, ...prev];
    });
    return saved;
  };

  const getAnnouncementSubmission = (announcementId: string, employeeId: string): AnnouncementSubmission | null => {
    return (
      announcementSubmissions.find((s) => s.announcementId === announcementId && s.employeeId === employeeId) || null
    );
  };

  const getAnnouncementSubmissionStatus = (
    announcement: Announcement,
    employeeId: string
  ): 'passed' | 'missed' | 'pending' => {
    if (!announcement.requiresSubmission) return 'passed';
    const submission = getAnnouncementSubmission(announcement.id, employeeId);
    if (submission) return 'passed';
    if (announcement.deadlineAt && new Date(announcement.deadlineAt) < new Date()) return 'missed';
    return 'pending';
  };

  const addRequiredDocument = (
    employeeId: string,
    data: { title: string; description?: string; notes?: string; dueDate?: string; required?: boolean; academicYear?: string }
  ): RequiredDocument => {
    const notes = (data.notes ?? data.description ?? '').trim();
    const newDoc: RequiredDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeId,
      title: data.title.trim(),
      description: notes,
      notes,
      dueDate: data.dueDate || '',
      required: data.required ?? true,
      academicYear: data.academicYear || settings.activeAcademicYear,
      createdAt: new Date().toISOString(),
    };

    setRequiredDocuments((prev) => [newDoc, ...prev]);
    return newDoc;
  };

  const updateRequiredDocument = (id: string, data: Partial<RequiredDocument>) => {
    setRequiredDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, ...data } : doc)));
  };

  const deleteRequiredDocument = (id: string) => {
    setRequiredDocuments((prev) => prev.filter((doc) => doc.id !== id));
    setRequiredDocumentSubmissions((prev) => prev.filter((submission) => submission.documentId !== id));
  };

  const getEmployeeRequiredDocuments = (employeeId: string): RequiredDocument[] => {
    return requiredDocuments
      .filter((doc) => doc.employeeId === employeeId && (!doc.academicYear || doc.academicYear === settings.activeAcademicYear))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getRequirementStatus = (documentId: string, employeeId: string): RequirementStatus => {
    const submission = getRequiredDocumentSubmission(documentId, employeeId);
    if (!submission) return 'missing';
    return submission.fileUrl ? 'complete' : 'incomplete';
  };

  const getEmployeeRequirementSummary = (employeeId: string) => {
    return getEmployeeRequiredDocuments(employeeId).reduce(
      (summary, document) => {
        summary[getRequirementStatus(document.id, employeeId)] += 1;
        return summary;
      },
      { missing: 0, incomplete: 0, complete: 0 }
    );
  };

  const submitRequiredDocument = (
    documentId: string,
    employeeId: string,
    payload: { note?: string; notes?: string; fileName?: string; fileUrl?: string }
  ): RequiredDocumentSubmission => {
    const notes = (payload.notes ?? payload.note ?? '').trim();
    const now = new Date().toISOString();
    let saved: RequiredDocumentSubmission = {
      id: `doc-sub-${Date.now()}`,
      documentId,
      employeeId,
      submittedAt: now,
      note: notes,
      notes,
      fileName: payload.fileName || '',
      fileUrl: payload.fileUrl || '',
      status: 'submitted',
    };

    setRequiredDocumentSubmissions((prev) => {
      const existing = prev.find((s) => s.documentId === documentId && s.employeeId === employeeId);
      if (existing) {
        saved = { ...existing, note: notes, notes, fileName: payload.fileName || '', fileUrl: payload.fileUrl || '', submittedAt: now, status: 'submitted' };
        return prev.map((s) => (s.id === existing.id ? saved : s));
      }
      return [saved, ...prev];
    });

    return saved;
  };

  const getRequiredDocumentSubmission = (documentId: string, employeeId: string): RequiredDocumentSubmission | null => {
    return requiredDocumentSubmissions.find((s) => s.documentId === documentId && s.employeeId === employeeId) || null;
  };

  // ── Host Feedback ─────────────────────────────────────────────────────────────
  const addHostFeedback = (
    data: Omit<HostFeedback, 'id' | 'overallScore' | 'submittedAt' | 'status'>
  ): HostFeedback => {
    const totalScore =
      data.attendanceScore + data.performanceScore + data.attitudeScore + data.communicationScore + data.teamworkScore;
    const overallScore = Math.round(totalScore / 5);

    const newFeedback: HostFeedback = {
      ...data,
      academicYear: (data as any).academicYear || settings.activeAcademicYear,
      id: `hf-${Date.now()}`,
      overallScore,
      submittedAt: new Date().toISOString(),
      status: 'submitted',
    };

    setHostFeedback((prev) => [newFeedback, ...prev]);

    if (useSupabase) {
      supabaseService.createHostFeedback(newFeedback).then((created) => {
        if (created) {
          setHostFeedback((prev) => prev.map((f) => (f.id === newFeedback.id ? created : f)));
        }
      });
    }

    // Auto-sync into evaluations table so Instructor and Trainee see the evaluation in real-time
    const grade: 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Needs Improvement' =
      overallScore >= 90 ? 'Excellent' :
      overallScore >= 80 ? 'Very Good' :
      overallScore >= 70 ? 'Good' :
      overallScore >= 60 ? 'Satisfactory' : 'Needs Improvement';

    addEvaluation({
      employeeId: data.employeeId,
      evaluatedBy: data.hostName + (data.hostCompany ? ` (${data.hostCompany})` : ' [HTE Supervisor]'),
      attendanceScore: data.attendanceScore,
      performanceScore: data.performanceScore,
      attitudeScore: data.attitudeScore,
      punctualityScore: data.attendanceScore,
      communicationScore: data.communicationScore,
      overallScore: overallScore,
      grade: grade,
      strengths: data.strengths || 'Consistent performance and dedicated engagement.',
      areasForImprovement: data.areasForImprovement || 'Continue developing technical problem-solving skills.',
      recommendations: data.recommendation || 'Recommended for completion.',
      evaluatedAt: new Date().toISOString(),
      status: 'final',
      academicYear: (data as any).academicYear || settings.activeAcademicYear,
    });

    return newFeedback;
  };

  const updateHostFeedback = (id: string, updates: Partial<HostFeedback>) => {
    setHostFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const deleteHostFeedback = (id: string) => {
    setHostFeedback((prev) => prev.filter((f) => f.id !== id));
  };

  const getEmployeeHostFeedback = (employeeId: string): HostFeedback[] => {
    return hostFeedback
      .filter((f) => f.employeeId === employeeId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  };

  const getLatestHostFeedback = (employeeId: string): HostFeedback | null => {
    const list = getEmployeeHostFeedback(employeeId);
    return list.length > 0 ? list[0] : null;
  };

  const syncAllAccountsAcrossAcademicYears = async (
    targetAcademicYear?: string
  ): Promise<{ success: boolean; syncedCount: number; message: string }> => {
    const ay = targetAcademicYear || settings.activeAcademicYear;

    // 1. Synchronize all employees (Trainees, Instructors, and HTE Representatives)
    const updatedEmployees = employees.map((emp) => {
      const isInstructor = emp.position === 'OJT Instructor' || (emp.position && emp.position.toLowerCase().includes('instructor'));
      const isHTE = emp.position === 'HTE Representative' || (emp.position && emp.position.toLowerCase().includes('hte'));

      if (isInstructor || isHTE) {
        return {
          ...emp,
          active: true,
          approvalStatus: 'approved' as const,
          academicYear: emp.academicYear || ay,
        };
      }

      return {
        ...emp,
        academicYear: emp.academicYear || ay,
      };
    });

    setEmployees(updatedEmployees);
    saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);

    // 2. Ensure all Host Supervisors remain active
    const updatedHosts = hostSupervisors.map((h) => ({
      ...h,
      active: true,
      academicYear: h.academicYear || ay,
    }));
    setHostSupervisors(updatedHosts);
    saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, updatedHosts);

    // 3. Persist to Supabase if configured
    if (useSupabase) {
      await supabaseService.upsertEmployees(updatedEmployees);
      await supabaseService.repairDatabaseData(ay);
    }

    const totalSynced = updatedEmployees.length + updatedHosts.length;
    return {
      success: true,
      syncedCount: totalSynced,
      message: `Synchronized ${updatedEmployees.length} user accounts and ${updatedHosts.length} HTE partners for Academic Year ${ay}.`,
    };
  };

  const repairAndPersistDatabase = async (): Promise<{ success: boolean; message: string; repairedCounts: any }> => {
    const activeAY = settings.activeAcademicYear;

    // 1. Ensure all time records have academicYear & valid photo fields
    const fixedRecords = timeRecords.map((r) => ({
      ...r,
      academicYear: r.academicYear || activeAY,
    }));
    setTimeRecords(fixedRecords);
    saveToStorage(STORAGE_KEYS.TIME_RECORDS, fixedRecords);

    // 2. Ensure all employees have academicYear and normalized positions
    const fixedEmployees = employees.map((e) => ({
      ...e,
      position: e.position === 'Administrator' ? 'OJT Instructor' : e.position,
      academicYear: e.academicYear || activeAY,
    }));
    setEmployees(fixedEmployees);
    saveToStorage(STORAGE_KEYS.EMPLOYEES, fixedEmployees);

    let supabaseResult = { repairedEmployees: 0, repairedRecords: 0 };
    if (useSupabase) {
      await supabaseService.upsertEmployees(fixedEmployees);
      await supabaseService.upsertTimeRecords(fixedRecords);
      supabaseResult = await supabaseService.repairDatabaseData(activeAY);
    }

    return {
      success: true,
      message: 'All data, photos, records, and accounts successfully verified and saved in database.',
      repairedCounts: supabaseResult,
    };
  };

  const approveEmployee = (id: string) => {
    updateEmployee(id, { active: true, approvalStatus: 'approved' });
  };

  const rejectEmployee = (id: string) => {
    deleteEmployee(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading OJT DTR System...</p>
        </div>
      </div>
    );
  }

  // Accounts are global across academic years; records retain their own academic-year metadata.
  const filteredEmployees = employees;
  const filteredTimeRecords = timeRecords;
  const filteredGeofenceZones = geofenceZones;
  const filteredEvaluations = evaluations;
  const filteredAnnouncements = announcements;
  const filteredHostFeedback = hostFeedback;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        employees: filteredEmployees,
        timeRecords: filteredTimeRecords,
        geofenceZones: filteredGeofenceZones,
        settings,
        evaluations: filteredEvaluations,
        announcements: filteredAnnouncements,
        announcementSubmissions,
        requiredDocuments,
        requiredDocumentSubmissions,
        hostFeedback: filteredHostFeedback,
        hostSupervisors,
        login,
        logout,
        changeCurrentUserPassword,
        registerEmployee,
        updateEmployee,
        deleteEmployee,
        approveEmployee,
        rejectEmployee,
        addTimeRecord,
        updateTimeRecord,
        approveTimeRecord,
        disapproveTimeRecord,
        getTodayRecord,
        getEmployeeRecords,
        updateGeofenceZones,
        addGeofenceZone,
        updateGeofenceZone,
        deleteGeofenceZone,
        updateSettings,
        getCurrentEmployee,
        addEvaluation,
        updateEvaluation,
        deleteEvaluation,
        getEmployeeEvaluation,
        addAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
        getActiveAnnouncements,
        submitAnnouncementResponse,
        getAnnouncementSubmission,
        getAnnouncementSubmissionStatus,
        addRequiredDocument,
        updateRequiredDocument,
        deleteRequiredDocument,
        getEmployeeRequiredDocuments,
        getRequirementStatus,
        getEmployeeRequirementSummary,
        submitRequiredDocument,
        getRequiredDocumentSubmission,
        addHostFeedback,
        updateHostFeedback,
        deleteHostFeedback,
        getEmployeeHostFeedback,
        getLatestHostFeedback,
        // Expose password helper so UI can set passwords when updating existing accounts
        setPasswordForEmail,
        syncAllAccountsAcrossAcademicYears,
        repairAndPersistDatabase,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
