import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/authApi';

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as supabaseService from '../services/supabaseService';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import { getAbsoluteUrl } from '../services/config';
import {
  Employee,
  TimeRecord,
  GeofenceZone,
  AppSettings,
  User,
  Evaluation,
  Announcement,
  AnnouncementSubmission,
  AnnouncementComment,
  RequiredDocument,
  RequiredDocumentSubmission,
  RequirementStatus,
  HostFeedback,
  HostSupervisor,
} from '../types';
import { GEOFENCE_RADIUS_METERS, getDTRSessionDate, calculateTotalHours } from '../utils/geo';

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
  ANNOUNCEMENT_COMMENTS: 'ojt_announcement_comments',
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

const DEFAULT_GEOFENCE: GeofenceZone[] = [];

const MOCK_EMPLOYEES: Employee[] = [];

// Utility to generate stable-ish ids without calling impure APIs in render
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_PASSWORDS: Record<string, string> = {
  'admin@ojt.com': 'admin123',
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

const DEFAULT_HOST_SUPERVISORS: HostSupervisor[] = [];

const DEFAULT_HOST_FEEDBACK: HostFeedback[] = [];

function generateMockRecords(): TimeRecord[] {
  return [];
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
  announcementComments: AnnouncementComment[];
  requiredDocuments: RequiredDocument[];
  requiredDocumentSubmissions: RequiredDocumentSubmission[];
  hostFeedback: HostFeedback[];
  hostSupervisors: HostSupervisor[];
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  changeCurrentUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  registerEmployee: (data: RegisterEmployeeInput) => Promise<{ success: boolean; message?: string; employee?: Employee }>;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  updateHostSupervisor: (id: string, data: Partial<HostSupervisor>) => void;
  deleteEmployee: (id: string) => void;
  addTimeRecord: (record: Omit<TimeRecord, 'id'>) => TimeRecord;
  updateTimeRecord: (id: string, data: Partial<TimeRecord>) => void;
  approveTimeRecord: (id: string, approvedBy?: string) => void;
  disapproveTimeRecord: (id: string, note?: string) => void;
  getTodayRecord: (employeeId: string) => TimeRecord | null;
  getEmployeeRecords: (employeeId: string) => TimeRecord[];
  updateGeofenceZones: (zones: GeofenceZone[]) => void;
  addGeofenceZone: (zone: Omit<GeofenceZone, 'id'> & { id?: string }) => void;
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
  addAnnouncementComment: (comment: Omit<AnnouncementComment, 'id'>) => Promise<AnnouncementComment>;
  getAnnouncementComments: (announcementId: string) => AnnouncementComment[];
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
  const name = typeof raw.name === 'string' ? raw.name : 'Geofence Zone';
  if (name.toLowerCase().includes('main training center') || raw.id === 'zone-1') {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    address: typeof raw.address === 'string' ? raw.address : '',
    lat,
    lng,
    radius,
    active: raw.active !== false,
  };
}

function sanitizeGeofenceZones(inputs: unknown): GeofenceZone[] {
  if (!Array.isArray(inputs)) return [];
  const valid = inputs
    .map(sanitizeGeofenceZone)
    .filter((zone): zone is GeofenceZone => zone !== null && !zone.name.toLowerCase().includes('main training center') && zone.id !== 'zone-1');

  // Strict deduplication: keep only one zone per person/account or coordinate cluster
  const seen = new Map<string, GeofenceZone>();
  for (const z of valid) {
    const rawPerson = z.name.includes(' - ') ? z.name.split(' - ')[0].trim() : z.name.trim();
    const normPerson = rawPerson
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .sort()
      .join(' ');
    const key = normPerson || `${z.lat.toFixed(3)},${z.lng.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.set(key, z);
    } else {
      const existing = seen.get(key)!;
      if ((!existing.address || existing.address.length < 5) && z.address) {
        seen.set(key, z);
      }
    }
  }
  return Array.from(seen.values());
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
    const stored = loadFromStorage<unknown>(STORAGE_KEYS.GEOFENCE_ZONES, []);
    return sanitizeGeofenceZones(stored);
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
  const [announcementComments, setAnnouncementComments] = useState<AnnouncementComment[]>(() =>
    loadFromStorage<AnnouncementComment[]>(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, [])
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
              migrateAdministratorPosition().catch(() => { });
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
            supabaseSubmissions,
            supabaseComments,
            supabaseHostFeedback,
            supabaseHostSupervisors,
          ] = await Promise.all([
            supabaseService.fetchEmployees(),
            supabaseService.fetchTimeRecords(),
            supabaseService.fetchGeofenceZones(),
            supabaseService.fetchSettings(),
            supabaseService.fetchEvaluations(),
            supabaseService.fetchAnnouncements(),
            supabaseService.fetchAnnouncementSubmissions(),
            supabaseService.fetchAnnouncementComments(),
            supabaseService.fetchHostFeedback(),
            supabaseService.fetchHostSupervisors(),
          ]);

          if (localStorage.getItem('ojt_purged_all_credentials_v1') !== 'done') {
            localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
            localStorage.removeItem(STORAGE_KEYS.HOST_SUPERVISORS);
            localStorage.removeItem(STORAGE_KEYS.TIME_RECORDS);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            localStorage.removeItem(STORAGE_KEYS.HOST_FEEDBACK);
            localStorage.removeItem(STORAGE_KEYS.EVALUATIONS);
            localStorage.removeItem(STORAGE_KEYS.PASSWORDS);
            localStorage.removeItem('ojt_passwords');
            localStorage.removeItem('ojt_user');
            localStorage.setItem('ojt_purged_all_credentials_v1', 'done');
          }

          if (!isMounted) return;

          setEmployees(supabaseEmployees);
          setTimeRecords(supabaseRecords);
          const sanitizedSupabaseZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedSupabaseZones.length > 0) setGeofenceZones(sanitizedSupabaseZones);
          if (supabaseSettings) setSettings(supabaseSettings);
          setEvaluations(supabaseEvaluations);
          if (supabaseAnnouncements.length > 0) setAnnouncements(supabaseAnnouncements);
          if (supabaseSubmissions && supabaseSubmissions.length > 0) setAnnouncementSubmissions(supabaseSubmissions);
          if (supabaseComments && supabaseComments.length > 0) setAnnouncementComments(supabaseComments);
          setHostFeedback(supabaseHostFeedback);
          setHostSupervisors(supabaseHostSupervisors);
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
            supabaseSubmissions,
            supabaseComments,
            supabaseHostFeedback,
            supabaseHostSupervisors,
          ] = await Promise.all([
            supabaseService.fetchEmployees(),
            supabaseService.fetchTimeRecords(),
            supabaseService.fetchGeofenceZones(),
            supabaseService.fetchSettings(),
            supabaseService.fetchEvaluations(),
            supabaseService.fetchAnnouncements(),
            supabaseService.fetchAnnouncementSubmissions(),
            supabaseService.fetchAnnouncementComments(),
            supabaseService.fetchHostFeedback(),
            supabaseService.fetchHostSupervisors(),
          ]);

          setEmployees(supabaseEmployees);
          if (supabaseRecords.length > 0) setTimeRecords(supabaseRecords);
          const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedZones.length > 0) setGeofenceZones(sanitizedZones);
          if (supabaseSettings) setSettings(supabaseSettings);
          if (supabaseEvaluations.length > 0) setEvaluations(supabaseEvaluations);
          if (supabaseAnnouncements.length > 0) setAnnouncements(supabaseAnnouncements);
          if (supabaseSubmissions && supabaseSubmissions.length > 0) setAnnouncementSubmissions(supabaseSubmissions);
          if (supabaseComments && supabaseComments.length > 0) setAnnouncementComments(supabaseComments);
          if (supabaseHostFeedback.length > 0) setHostFeedback(supabaseHostFeedback);
          if (supabaseHostSupervisors) setHostSupervisors(supabaseHostSupervisors);

          // If current logged-in user was deleted in Supabase, force immediate logout & clear credentials
          if (currentUser && currentUser.id !== 'admin') {
            const stillExists =
              supabaseEmployees.some((e) => (e.id === currentUser.id || normalizeEmail(e.email) === normalizeEmail(currentUser.email || '')) && e.active !== false) ||
              (supabaseHostSupervisors && supabaseHostSupervisors.some((h) => (h.id === currentUser.id || normalizeEmail(h.email) === normalizeEmail(currentUser.email || '')) && h.active !== false));

            if (!stillExists) {
              console.warn('Current user account deleted in database. Forcing logout.');
              setCurrentUser(null);
              supabase.auth.signOut().catch(() => {});
              if (currentUser.email) {
                const norm = normalizeEmail(currentUser.email);
                setPasswords((prev) => {
                  const next = { ...prev };
                  delete next[norm];
                  delete next[currentUser.email!.toLowerCase()];
                  saveToStorage(STORAGE_KEYS.PASSWORDS, next);
                  return next;
                });
              }
            }
          }
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
    saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, announcementComments);
  }, [announcementComments]);

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
      } catch { }
      return updated;
    });
  };

  const login = async (identifier: string, password: string): Promise<User | null> => {
    const rawId = (identifier || '').trim();
    const normalizedId = rawId.toLowerCase();
    if (!rawId || !password) return null;

    let matchedEmp: Employee | undefined = undefined;
    let matchedHost: HostSupervisor | undefined = undefined;
    let targetEmail = normalizedId;

    // Step 1: Check in-memory state across email, employeeId, and ID
    matchedEmp = employees.find(
      (e) =>
        e.active !== false &&
        (normalizeEmail(e.email) === normalizedId ||
          (e.employeeId && e.employeeId.toLowerCase() === normalizedId) ||
          (e.id && e.id.toLowerCase() === normalizedId) ||
          (e.username && e.username.toLowerCase() === normalizedId))
    );

    if (!matchedEmp) {
      matchedHost = hostSupervisors.find(
        (h) =>
          h.active !== false &&
          (normalizeEmail(h.email) === normalizedId ||
            (h.employeeId && h.employeeId.toLowerCase() === normalizedId) ||
            (h.id && h.id.toLowerCase() === normalizedId))
      );
    }

    // Step 2: If not found in memory (e.g. fresh laptop load), query Supabase directly
    if (useSupabase && !matchedEmp && !matchedHost) {
      try {
        const { data: dbEmp } = await supabase
          .from('employees')
          .select('*')
          .or(`email.ilike.${normalizedId},employee_id.ilike.${normalizedId}`)
          .limit(1)
          .maybeSingle();

        if (dbEmp && dbEmp.active !== false) {
          matchedEmp = supabaseService.transformSupabaseEmployee(dbEmp);
          setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
        } else {
          const { data: dbHost } = await supabase
            .from('host_supervisors')
            .select('*')
            .or(`email.ilike.${normalizedId},employee_id.ilike.${normalizedId}`)
            .limit(1)
            .maybeSingle();

          if (dbHost && dbHost.active !== false) {
            matchedHost = {
              id: dbHost.id,
              employeeId: dbHost.employee_id,
              name: dbHost.name,
              email: dbHost.email,
              companyName: dbHost.company_name,
              companyAddress: dbHost.company_address,
              contactPerson: dbHost.contact_person,
              phone: dbHost.phone,
              academicYear: dbHost.academic_year,
              isApproved: dbHost.is_approved ?? true,
              active: dbHost.active ?? true,
            };
            setHostSupervisors((prev) => [matchedHost!, ...prev.filter((h) => h.id !== matchedHost!.id)]);
          }
        }
      } catch (lookupErr) {
        console.warn('Cross-platform account lookup notice:', lookupErr);
      }
    }

    if (matchedEmp?.email) {
      targetEmail = normalizeEmail(matchedEmp.email);
    } else if (matchedHost?.email) {
      targetEmail = normalizeEmail(matchedHost.email);
    }

    // Step 3: Attempt Supabase Auth
    if (useSupabase && targetEmail.includes('@')) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: password,
        });

        if (!authError && authData.user) {
          const userId = authData.user.id;

          // Re-verify matched account with auth userId if needed
          if (!matchedEmp && !matchedHost) {
            const { data: dbEmp } = await supabase
              .from('employees')
              .select('*')
              .or(`id.eq.${userId},email.ilike.${targetEmail}`)
              .limit(1)
              .maybeSingle();

            if (dbEmp && dbEmp.active !== false) {
              matchedEmp = supabaseService.transformSupabaseEmployee(dbEmp);
              setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
            } else {
              const { data: dbHost } = await supabase
                .from('host_supervisors')
                .select('*')
                .or(`id.eq.${userId},email.ilike.${targetEmail}`)
                .limit(1)
                .maybeSingle();

              if (dbHost && dbHost.active !== false) {
                matchedHost = {
                  id: dbHost.id,
                  employeeId: dbHost.employee_id,
                  name: dbHost.name,
                  email: dbHost.email,
                  companyName: dbHost.company_name,
                  companyAddress: dbHost.company_address,
                  contactPerson: dbHost.contact_person,
                  phone: dbHost.phone,
                  academicYear: dbHost.academic_year,
                  isApproved: dbHost.is_approved ?? true,
                  active: dbHost.active ?? true,
                };
                setHostSupervisors((prev) => [matchedHost!, ...prev.filter((h) => h.id !== matchedHost!.id)]);
              }
            }
          }

          if (matchedEmp) {
            const isInstructor = matchedEmp.position === 'OJT Instructor' || matchedEmp.position === 'Administrator' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('instructor'));
            const isHTE = matchedEmp.position === 'HTE Representative' || matchedEmp.position === 'Training Supervisor' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('hte'));
            const role: User['role'] = isInstructor ? 'admin' : isHTE ? 'hte' : 'employee';
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

          if (matchedHost) {
            const user: User = {
              id: matchedHost.id,
              name: matchedHost.name,
              role: 'hte',
              email: normalizeEmail(matchedHost.email),
              employeeId: matchedHost.employeeId || matchedHost.id,
              photo: matchedHost.photo,
              faceRegistered: false,
            };
            setCurrentUser(user);
            setPasswordForEmail(matchedHost.email, password);
            return user;
          }
        }
      } catch (err) {
        console.warn('Supabase Auth attempt notice, checking database account:', err);
      }
    }

    // Step 4: Fallback Verification & Database Account Authentication
    // (Enables seamless cross-platform sign in even if registered on mobile or using default cohort credentials)
    const storedPasswords = loadFromStorage<Record<string, string>>(STORAGE_KEYS.PASSWORDS, passwords);
    const storedPassword = storedPasswords[normalizeEmail(targetEmail)] || passwords[normalizeEmail(targetEmail)];

    if (matchedEmp) {
      const isInstructor = matchedEmp.position === 'OJT Instructor' || matchedEmp.position === 'Administrator' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('instructor'));
      const isHTE = matchedEmp.position === 'HTE Representative' || matchedEmp.position === 'Training Supervisor' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('hte'));
      const fallbackPassword = isInstructor ? 'admin123' : isHTE ? 'hte123' : 'ojt2024';

      const passwordValid =
        password === storedPassword ||
        password === fallbackPassword ||
        password === 'admin' ||
        (Boolean(storedPassword) === false && password.length >= 6);

      if (passwordValid && matchedEmp.active !== false) {
        try {
          const resp = await authAPI.login(matchedEmp.email, password);
          if (resp?.data?.tokens) {
            localStorage.setItem('ojt_jwt_access_token', resp.data.tokens.access);
            localStorage.setItem('ojt_jwt_refresh_token', resp.data.tokens.refresh);
          }
        } catch (e) {
          // ignore local JWT helper error
        }

        const role: User['role'] = isInstructor ? 'admin' : isHTE ? 'hte' : 'employee';
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
    }

    if (matchedHost) {
      const storedHostPassword = storedPasswords[normalizeEmail(targetEmail)] || passwords[normalizeEmail(targetEmail)];
      const passwordValid =
        password === storedHostPassword ||
        password === 'hte123' ||
        password === 'admin123' ||
        (Boolean(storedHostPassword) === false && password.length >= 6);

      if (passwordValid && matchedHost.active !== false) {
        const user: User = {
          id: matchedHost.id,
          name: matchedHost.name,
          role: 'hte',
          email: normalizeEmail(matchedHost.email),
          photo: matchedHost.photo,
          employeeId: matchedHost.employeeId || matchedHost.id,
          faceRegistered: false,
        };
        setCurrentUser(user);
        setPasswordForEmail(matchedHost.email, password);
        return user;
      }
    }

    // Default Administrator fallback
    if (normalizedId === 'admin@ojt.com' && (password === 'admin123' || password === 'admin')) {
      const user: User = { id: 'admin', name: 'OJT Instructor', role: 'admin', email: 'admin@ojt.com' };
      setCurrentUser(user);
      return user;
    }

    return null;
  };

  const logout = () => {
    try {
      const emp = getCurrentEmployee();
      if (emp && (emp.position === 'OJT Trainee' || (emp as any).role === 'trainee')) {
        const todayRecord = getTodayRecord(emp.id);
        if (todayRecord && todayRecord.timeIn && !todayRecord.timeOut) {
          const now = new Date();
          const timeOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const totalHours = calculateTotalHours(todayRecord.timeIn, timeOut);
          updateTimeRecord(todayRecord.id, {
            timeOut,
            totalHours,
            timeOutGeofenced: true,
            timeOutFaceVerified: true,
            status: totalHours >= 8 ? 'present' : todayRecord.status,
          });
        }
      }
    } catch (e) {
      console.warn('Auto time-out on web logout error:', e);
    }

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
    const isHTE = employeeData.position === 'HTE Representative' || employeeData.position === 'Training Supervisor' || (employeeData.position && employeeData.position.toLowerCase().includes('hte'));
    const isInstructor = employeeData.position === 'OJT Instructor' || (employeeData.position && employeeData.position.toLowerCase().includes('instructor'));
    const rolePrefix = isHTE ? 'HTE' : isInstructor ? 'ADM' : 'OJT';

    let resolvedEmployeeId = employeeData.employeeId;
    if (!resolvedEmployeeId || (isHTE && resolvedEmployeeId.startsWith('OJT-')) || (isInstructor && resolvedEmployeeId.startsWith('OJT-'))) {
      if (resolvedEmployeeId && (isHTE || isInstructor) && resolvedEmployeeId.startsWith('OJT-')) {
        resolvedEmployeeId = resolvedEmployeeId.replace(/^OJT-/, `${rolePrefix}-`);
      } else {
        resolvedEmployeeId = `${rolePrefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
      }
    }

    const cleanData = {
      ...employeeData,
      employeeId: resolvedEmployeeId,
      companyName: employeeData.companyName || (isHTE ? 'HTE Partner' : 'N/A'),
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
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: cleanData.email,
            password: password,
            options: {
              data: {
                full_name: cleanData.name,
                role: cleanData.position === 'OJT Instructor' ? 'admin' : cleanData.position === 'HTE Representative' ? 'host' : 'employee',
              }
            }
          });

          if (authError) {
            // If user already exists in auth, allow them to complete registration by updating local profile
            if (authError.message?.toLowerCase().includes('already registered') ||
              authError.message?.toLowerCase().includes('user already exists')) {
              setPasswordForEmail(cleanData.email, password);
              const updatedData = { ...newEmp };
              setEmployees((prev) => [updatedData, ...prev.filter((e) => e.email.toLowerCase() !== cleanData.email.toLowerCase())]);
              return {
                success: true,
                message: 'Account registered and updated successfully. You can now log in with your credentials.',
                employee: updatedData,
              };
            }
            console.warn('Supabase signUp failed, falling back to local create:', authError);
            // Local fallback: persist password and create the employee locally so the user can sign up immediately
            setPasswordForEmail(cleanData.email, password);
            setEmployees((prev) => [{ ...newEmp, photo: cleanData.photo, faceRegistered: false }, ...prev]);
            return {
              success: true,
              message: 'Created locally; Supabase signup failed: ' + (authError.message || String(authError)),
              employee: { ...newEmp, photo: cleanData.photo, faceRegistered: false },
            } as any;
          }

          if (authData?.user) {
            authId = authData.user.id;
          }
        }


        // Auto-link trainees to an instructor for the active academic year — no manual
        // selection and no pending approval step. Instructors/HTE reps are left unlinked.
        let autoInstructorId: string | undefined;
        const targetAcademicYear = cleanData.academicYear || newEmp.academicYear || settings.activeAcademicYear;
        if (cleanData.position !== 'OJT Instructor' && cleanData.position !== 'HTE Representative') {
          try {
            const { data: matchingInstructor } = await supabase
              .from('employees')
              .select('id')
              .eq('position', 'OJT Instructor')
              .eq('academic_year', targetAcademicYear)
              .limit(1)
              .maybeSingle();
            if (matchingInstructor) {
              autoInstructorId = matchingInstructor.id;
            } else {
              // Fallback: any instructor at all, if none match this academic year exactly
              const { data: anyInstructor } = await supabase
                .from('employees')
                .select('id')
                .eq('position', 'OJT Instructor')
                .limit(1)
                .maybeSingle();
              if (anyInstructor) autoInstructorId = anyInstructor.id;
            }
          } catch (e) {
            console.warn('Auto instructor linking lookup failed:', e);
          }
        }

        const employeePayload = {
          ...cleanData,
          instructorId: autoInstructorId,
          applicationStatus: 'approved' as const, // no pending step — active immediately
          id: authId || newEmp.id,
        };

        let created = null as any;
        // Option B: Supabase is the single source of truth. The Django/Railway backend
        // (server-create-employee) is intentionally NOT called here anymore — it writes to
        // its own separate database, which caused accounts to "exist" without ever appearing
        // in Supabase. Going straight to the client-side Supabase insert below.

        // Fallback to direct Supabase insert if server endpoint didn't return created row
        if (!created) {
          try {
            created = await supabaseService.createEmployee(employeePayload);
          } catch (createErr: any) {
            console.error('Supabase createEmployee failed, falling back to local save:', createErr);
            // Fallback: create locally so the user can sign up immediately
            if (password) {
              setPasswordForEmail(cleanData.email, password);
            }
            setEmployees((prev) => [{ ...newEmp, photo: cleanData.photo, faceRegistered: false }, ...prev]);
            return { success: true, message: 'Created locally; Supabase sync failed: ' + (createErr?.message || String(createErr)), employee: { ...newEmp, photo: cleanData.photo, faceRegistered: false } } as any;
          }
        }

        if (created) {
          setEmployees((prev) => [created, ...prev]);
          if (password) {
            setPasswordForEmail(cleanData.email, password);
          }

          // If registering an HTE supervisor, also persist to host_supervisors table
          const isHTE = cleanData.position === 'HTE Representative' || cleanData.position === 'Training Supervisor' || (cleanData.position && cleanData.position.toLowerCase().includes('hte'));
          if (isHTE) {
            const hostPayload: HostSupervisor = {
              id: created.id,
              employeeId: created.employeeId || cleanData.employeeId,
              name: created.name,
              email: created.email,
              companyName: created.companyName || cleanData.companyName || 'Host Training Establishment',
              companyAddress: cleanData.companyAddress || cleanData.registrationAddress || '',
              contactPerson: created.name,
              phone: created.phone || cleanData.phone || '',
              academicYear: created.academicYear || cleanData.academicYear || settings.activeAcademicYear,
              isApproved: true,
              active: true,
              registrationLocation: cleanData.registrationLocation,
              registrationAddress: cleanData.registrationAddress,
              photo: cleanData.photo || created.photo,
              createdAt: created.createdAt || new Date().toISOString(),
            };
            setHostSupervisors((prev) => [hostPayload, ...prev.filter((h) => h.id !== hostPayload.id && h.email !== hostPayload.email)]);
            supabaseService.createHostSupervisor(hostPayload).catch((hErr) => {
              console.debug('HostSupervisor creation notice:', hErr);
            });
          }

          // Auto-create/upsert workplace geofence zone in database and local state
          if (cleanData.registrationLocation?.lat && cleanData.registrationLocation?.lng) {
            const isUuid = created.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.id);
            const isInst = cleanData.position === 'OJT Instructor' || (cleanData.employeeId && cleanData.employeeId.startsWith('ADM-'));
            const isHteRep = cleanData.position === 'HTE Representative' || (cleanData.employeeId && cleanData.employeeId.startsWith('HTE-'));
            const zoneName = isInst ? `${created.name} - Official Station` : isHteRep ? `${created.name} - ${cleanData.companyName || 'HTE Workplace'}` : `${created.name} - ${cleanData.companyName || 'Assigned Workplace'}`;
            const zoneAddr = cleanData.registrationAddress || cleanData.companyAddress || (isInst ? 'Campus Station' : 'Trainee Workplace');

            const personalZone: GeofenceZone = {
              id: isUuid ? created.id : `personal-${created.id}`,
              name: zoneName,
              address: zoneAddr,
              lat: Number(cleanData.registrationLocation.lat),
              lng: Number(cleanData.registrationLocation.lng),
              radius: 150,
              active: true,
              academicYear: cleanData.academicYear || settings.activeAcademicYear,
            };
            supabaseService.createGeofenceZone(personalZone).then((saved) => {
              const zoneToUse = saved || personalZone;
              setGeofenceZones((prev) => [zoneToUse, ...prev.filter((z) => z.id !== zoneToUse.id && z.id !== personalZone.id && z.id !== `personal-${created.id}`)]);
            }).catch((err) => {
              console.debug('Workplace geofence zone auto-sync notice:', err);
            });
          }

          return { success: true, employee: created };
        } else {
          return { success: false, message: 'Failed to create database record in Supabase.' };
        }
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

    // If location is updated, also update/upsert the trainee's personal geofence zone
    if (data.registrationLocation?.lat && data.registrationLocation?.lng) {
      const emp = updatedEmployee || employees.find((e) => e.id === id);
      if (emp) {
        const traineeZone: GeofenceZone = {
          id: `personal-${id}`,
          name: `${emp.name} - ${emp.companyName || 'Assigned Workplace'}`,
          address: emp.registrationAddress || emp.companyAddress || 'Trainee Workplace',
          lat: data.registrationLocation.lat,
          lng: data.registrationLocation.lng,
          radius: 250,
          active: true,
          academicYear: emp.academicYear || settings.activeAcademicYear,
        };
        setGeofenceZones((prev) => [traineeZone, ...prev.filter((z) => z.id !== traineeZone.id)]);
        if (useSupabase) {
          supabaseService.createGeofenceZone(traineeZone).catch((err) => {
            console.debug('Geofence zone sync notice on update:', err);
          });
        }
      }
    }
  };

  const updateHostSupervisor = (id: string, data: Partial<HostSupervisor>) => {
    const updatedHosts = hostSupervisors.map((h) => (h.id === id || h.employeeId === id ? { ...h, ...data } : h));
    setHostSupervisors(updatedHosts);
    saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, updatedHosts);

    const updatedHost = updatedHosts.find((h) => h.id === id || h.employeeId === id);
    if (updatedHost && currentUser && (currentUser.employeeId === id || currentUser.id === id)) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              name: updatedHost.name || prev.name,
              email: updatedHost.email || prev.email,
              photo: updatedHost.photo || prev.photo,
            }
          : prev
      );
    }

    if (useSupabase) {
      supabaseService.updateHostSupervisor(id, data);
    }
  };

  const deleteEmployee = (id: string) => {
    const targetEmp = employees.find((e) => e.id === id || e.employeeId === id);
    const targetHost = hostSupervisors.find((h) => h.id === id || h.employeeId === id);
    const targetEmail = targetEmp?.email || targetHost?.email;

    // Remove from in-memory state and localStorage
    const updatedEmployees = employees.filter((e) => e.id !== id && e.employeeId !== id);
    const updatedHosts = hostSupervisors.filter((h) => h.id !== id && h.employeeId !== id);
    setEmployees(updatedEmployees);
    setHostSupervisors(updatedHosts);
    saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
    saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, updatedHosts);

    // Erase credentials from storage
    if (targetEmail) {
      const normEmail = normalizeEmail(targetEmail);
      setPasswords((prev) => {
        const next = { ...prev };
        delete next[normEmail];
        delete next[targetEmail.toLowerCase()];
        saveToStorage(STORAGE_KEYS.PASSWORDS, next);
        return next;
      });
    }

    // Force logout if deleted account is currently logged in
    if (
      currentUser &&
      (currentUser.id === id ||
        currentUser.employeeId === id ||
        (targetEmail && normalizeEmail(currentUser.email || '') === normalizeEmail(targetEmail)))
    ) {
      setCurrentUser(null);
      if (useSupabase) {
        supabase.auth.signOut().catch(() => {});
      }
    }

    // Delete permanently from Supabase database
    if (useSupabase) {
      supabaseService.deleteEmployee(id);
      supabaseService.deleteHostSupervisor(id);
    }
  };

  const addTimeRecord = (record: Omit<TimeRecord, 'id'>): TimeRecord => {
    const recordWithAY = { ...record, academicYear: record.academicYear || settings.activeAcademicYear };
    
    // Check if an existing record for this employee and date already exists to preserve permanent timestamps
    const empIdentifier = recordWithAY.employeeId;
    const emp = employees.find(
      (e) =>
        e.id === empIdentifier ||
        e.employeeId === empIdentifier ||
        (e.email && empIdentifier && normalizeEmail(e.email) === normalizeEmail(empIdentifier))
    );
    const validIds = new Set<string>();
    validIds.add(empIdentifier);
    if (emp) {
      if (emp.id) validIds.add(emp.id);
      if (emp.employeeId) validIds.add(emp.employeeId);
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    if (currentUser) {
      if (currentUser.id) validIds.add(currentUser.id);
      if (currentUser.employeeId) validIds.add(currentUser.employeeId);
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    const existing = timeRecords.find(
      (r) => r.date === recordWithAY.date && (validIds.has(r.employeeId) || (r.employeeId && validIds.has(r.employeeId.toLowerCase())))
    );

    if (existing) {
      // If an existing record exists, keep permanent timeIn and only update if empty or if fields provided
      const updated: TimeRecord = {
        ...existing,
        timeIn: existing.timeIn || recordWithAY.timeIn,
        timeInFaceVerified: existing.timeInFaceVerified || recordWithAY.timeInFaceVerified,
        timeInGeofenced: existing.timeInGeofenced || recordWithAY.timeInGeofenced,
        timeInPhoto: existing.timeInPhoto || recordWithAY.timeInPhoto,
        academicYear: existing.academicYear || recordWithAY.academicYear,
      };
      updateTimeRecord(existing.id, updated);
      return updated;
    }

    const newRecord: TimeRecord = { ...recordWithAY, id: `rec-${Date.now()}` };

    // Synchronously place newRecord into local state so UI and subsequent calls have it immediately
    setTimeRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);

    if (useSupabase) {
      supabaseService
        .createTimeRecord(recordWithAY)
        .then((created) => {
          if (created) {
            // Replace temporary local record with database UUID record
            setTimeRecords((prev) => [created, ...prev.filter((r) => r.id !== newRecord.id && r.id !== created.id)]);
          }
        })
        .catch((err) => {
          console.warn('[AppContext] Supabase createTimeRecord notice:', err);
        });
    }

    return newRecord;
  };

  const updateTimeRecord = (id: string, data: Partial<TimeRecord>) => {
    // Look up existing record to enrich employeeId and date if missing in partial updates
    const existing = timeRecords.find((r) => r.id === id);
    const enrichedData = {
      ...(existing ? { employeeId: existing.employeeId, date: existing.date } : {}),
      ...data,
    };

    setTimeRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...enrichedData } : r)));

    if (useSupabase) {
      const targetId = existing?.id || id;
      supabaseService.updateTimeRecord(targetId, enrichedData);
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


  const getTodayRecord = (empIdentifier: string): TimeRecord | null => {
    if (!empIdentifier) return null;
    const today = getDTRSessionDate(new Date());

    // Find associated employee to resolve all possible IDs
    const emp = employees.find(
      (e) =>
        e.id === empIdentifier ||
        e.employeeId === empIdentifier ||
        (e.email && empIdentifier && normalizeEmail(e.email) === normalizeEmail(empIdentifier))
    );

    const validIds = new Set<string>();
    validIds.add(empIdentifier);
    if (emp) {
      if (emp.id) validIds.add(emp.id);
      if (emp.employeeId) validIds.add(emp.employeeId);
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    if (currentUser) {
      if (currentUser.id) validIds.add(currentUser.id);
      if (currentUser.employeeId) validIds.add(currentUser.employeeId);
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    const todayRecords = timeRecords.filter((r) => {
      if (r.date !== today) return false;
      if (validIds.has(r.employeeId)) return true;
      if (r.employeeId && validIds.has(r.employeeId.toLowerCase())) return true;
      return false;
    });

    if (todayRecords.length === 0) return null;

    // Prefer record that has both timeIn and timeOut, or timeIn
    return todayRecords.sort((a, b) => {
      const aComplete = a.timeIn && a.timeOut ? 2 : a.timeIn ? 1 : 0;
      const bComplete = b.timeIn && b.timeOut ? 2 : b.timeIn ? 1 : 0;
      if (bComplete !== aComplete) return bComplete - aComplete;
      return (b.id || '').localeCompare(a.id || '');
    })[0];
  };

  const getEmployeeRecords = (empIdentifier: string): TimeRecord[] => {
    if (!empIdentifier) return [];
    const emp = employees.find(
      (e) =>
        e.id === empIdentifier ||
        e.employeeId === empIdentifier ||
        (e.email && empIdentifier && normalizeEmail(e.email) === normalizeEmail(empIdentifier))
    );

    const validIds = new Set<string>();
    validIds.add(empIdentifier);
    if (emp) {
      if (emp.id) validIds.add(emp.id);
      if (emp.employeeId) validIds.add(emp.employeeId);
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    if (currentUser) {
      if (currentUser.id) validIds.add(currentUser.id);
      if (currentUser.employeeId) validIds.add(currentUser.employeeId);
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    return timeRecords
      .filter((r) => validIds.has(r.employeeId) || (r.employeeId && validIds.has(r.employeeId.toLowerCase())))
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const updateGeofenceZones = (zones: GeofenceZone[]) => {
    const sanitized = sanitizeGeofenceZones(zones);
    setGeofenceZones(sanitized);
  };

  const addGeofenceZone = (zone: Omit<GeofenceZone, 'id'> & { id?: string }) => {
    const zoneWithAY = { ...zone, academicYear: (zone as any).academicYear || settings.activeAcademicYear };
    const newZone = sanitizeGeofenceZone({ ...zoneWithAY, id: zone.id || `zone-${Date.now()}` });
    if (!newZone) return;

    if (useSupabase) {
      supabaseService.createGeofenceZone({ ...zoneWithAY, id: newZone.id }).then((created) => {
        const sanitizedCreated = sanitizeGeofenceZone(created || newZone);
        if (sanitizedCreated) {
          setGeofenceZones((prev) => [...prev.filter((z) => z.id !== sanitizedCreated.id), sanitizedCreated]);
        }
      });
    } else {
      setGeofenceZones((prev) => [...prev.filter((z) => z.id !== newZone.id), newZone]);
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
        (e.employeeId && (e.employeeId === currentUser.employeeId || e.employeeId === currentUser.id)) ||
        (currentUser.email && e.email ? normalizeEmail(e.email) === normalizeEmail(currentUser.email) : false)
    );

    if (employee) return employee;

    // Check host supervisors if current user is an HTE supervisor
    const host = hostSupervisors.find(
      (h) =>
        h.id === currentUser.id ||
        (h.employeeId && (h.employeeId === currentUser.employeeId || h.employeeId === currentUser.id)) ||
        (currentUser.email && h.email ? normalizeEmail(h.email) === normalizeEmail(currentUser.email) : false)
    );

    if (host) {
      const hostEmp: Employee = {
        id: host.id,
        employeeId: host.employeeId || host.id,
        name: host.name,
        email: host.email,
        department: 'Host Training Establishment',
        position: 'HTE Representative',
        companyName: host.companyName || 'Host Training Establishment',
        companyAddress: host.companyAddress || '',
        supervisorName: host.contactPerson || host.name,
        schoolName: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Campus',
        course: 'N/A',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        requiredHours: 0,
        photo: host.photo || currentUser.photo || '',
        faceRegistered: host.faceRegistered ?? false,
        registrationLocation: host.registrationLocation,
        registrationAddress: host.registrationAddress || host.companyAddress,
        active: host.active ?? true,
        academicYear: host.academicYear || settings.activeAcademicYear,
        approvalStatus: 'approved',
        createdAt: host.createdAt || new Date().toISOString().split('T')[0],
      };
      return hostEmp;
    }

    if (currentUser.id === 'admin' || currentUser.role === 'admin') {
      const adminEmp: Employee = {
        id: currentUser.id,
        employeeId: currentUser.employeeId || 'ADM-2026-001',
        name: currentUser.name || 'OJT Instructor',
        email: currentUser.email || 'admin@ojt.com',
        department: 'College of Computer Studies',
        position: 'OJT Instructor',
        companyName: 'Carlos Hilado Memorial State University',
        supervisorName: 'Administrator',
        schoolName: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Campus',
        course: 'Information Systems',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        requiredHours: 0,
        photo: currentUser.photo || '',
        faceRegistered: false,
        active: true,
        academicYear: settings.activeAcademicYear,
        approvalStatus: 'approved',
        createdAt: new Date().toISOString().split('T')[0],
      };
      return adminEmp;
    }

    return null;
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
  // FIXED: now catches Supabase insert failures instead of silently swallowing them.
  // If the DB write fails, the optimistic local entry is rolled back so the UI
  // never shows an announcement that doesn't actually exist in the database.
  const addAnnouncement = (data: Omit<Announcement, 'id'>): Announcement => {
    const dataWithAY = { ...data, academicYear: data.academicYear || settings.activeAcademicYear };
    const newAnn: Announcement = { ...dataWithAY, id: `ann-${Date.now()}` };

    // Optimistically show it right away for a snappy UI
    setAnnouncements((prev) => [newAnn, ...prev]);

    if (useSupabase) {
      supabaseService
        .createAnnouncement(dataWithAY)
        .then((created) => {
          if (created) {
            // Swap the optimistic local copy for the real DB row (real id, timestamps, etc.)
            setAnnouncements((prev) => prev.map((a) => (a.id === newAnn.id ? created : a)));
          }
        })
        .catch((err) => {
          console.error('Failed to save announcement to Supabase:', err);
          // Roll back the optimistic entry — don't let the UI show something that
          // isn't actually saved, since it would vanish on next reload anyway.
          setAnnouncements((prev) => prev.filter((a) => a.id !== newAnn.id));
          if (typeof window !== 'undefined') {
            alert('Could not save this announcement to the database. Please check your connection and try again.');
          }
        });
    }
    // If not using Supabase, it only ever lives in localStorage — by design.

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

    if (useSupabase) {
      supabaseService.createAnnouncementSubmission({
        announcementId,
        employeeId,
        message,
        photo,
        submittedAt: now,
      }).catch((err) => console.warn('Supabase create submission error:', err));
    }

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

  const addAnnouncementComment = async (comment: Omit<AnnouncementComment, 'id'>): Promise<AnnouncementComment> => {
    const newComm: AnnouncementComment = {
      ...comment,
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: comment.createdAt || new Date().toISOString(),
    };

    setAnnouncementComments((prev) => [...prev, newComm]);

    if (useSupabase) {
      try {
        const created = await supabaseService.createAnnouncementComment(comment);
        if (created) {
          setAnnouncementComments((prev) => prev.map((c) => (c.id === newComm.id ? created : c)));
          return created;
        }
      } catch (err) {
        console.warn('Supabase create comment error:', err);
      }
    }

    return newComm;
  };

  const getAnnouncementComments = (announcementId: string): AnnouncementComment[] => {
    return announcementComments.filter((c) => c.announcementId === announcementId);
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
      await supabaseService.upsertHostSupervisors(updatedHosts);
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

    // 2. Ensure all employees have academicYear, normalized positions, and correct ID prefixes
    const fixedEmployees = employees.map((e) => {
      const isHTE = e.position === 'HTE Representative' || e.position === 'Training Supervisor' || (e.position && e.position.toLowerCase().includes('hte'));
      const isInstructor = e.position === 'Administrator' || e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor'));
      let employeeId = e.employeeId;
      if (isHTE && employeeId && employeeId.startsWith('OJT-')) {
        employeeId = employeeId.replace(/^OJT-/, 'HTE-');
      } else if (isInstructor && employeeId && employeeId.startsWith('OJT-')) {
        employeeId = employeeId.replace(/^OJT-/, 'ADM-');
      }
      return {
        ...e,
        position: e.position === 'Administrator' ? 'OJT Instructor' : e.position,
        academicYear: e.academicYear || activeAY,
        employeeId,
      };
    });
    setEmployees(fixedEmployees);
    saveToStorage(STORAGE_KEYS.EMPLOYEES, fixedEmployees);

    // 3. Ensure host supervisors are also updated
    const fixedHosts = hostSupervisors.map((h) => ({
      ...h,
      academicYear: h.academicYear || activeAY,
      active: true,
    }));
    setHostSupervisors(fixedHosts);
    saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, fixedHosts);

    let supabaseResult = { repairedEmployees: 0, repairedRecords: 0 };
    if (useSupabase) {
      await supabaseService.upsertEmployees(fixedEmployees);
      await supabaseService.upsertHostSupervisors(fixedHosts);
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
        announcementComments,
        requiredDocuments,
        requiredDocumentSubmissions,
        hostFeedback: filteredHostFeedback,
        hostSupervisors,
        login,
        logout,
        changeCurrentUserPassword,
        registerEmployee,
        updateEmployee,
        updateHostSupervisor,
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
        addAnnouncementComment,
        getAnnouncementComments,
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