import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
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
  TraineeDocuments,
  TraineeDocumentItem,
  MonthlyDttrRecord,
} from '../types';
import { GEOFENCE_RADIUS_METERS, getDTRSessionDate, calculateTotalHours } from '../utils/geo';
import { getCampusLocation } from '../utils/campusLocations';

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
  MONTHLY_DTTR: 'ojt_monthly_dttr',
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
    title: 'Welcome to CHMSU OJT Management System!',
    content:
      'Welcome to the Carlos Hilado Memorial State University On-the-Job Training Management System. Please make sure to clock in and out every working day using facial recognition and location verification.',
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

export const DEFAULT_OJT_REQUIRED_DOCUMENTS = [
  {
    docKey: 'endorsement',
    title: 'Endorsement Letter',
    description: 'Official endorsement letter issued and signed by the College Dean / Department Chair / OJT Coordinator.',
    notes: 'Official institutional endorsement from Department Chair / Coordinator',
    dueDate: 'Before starting training hours',
    required: true,
  },
  {
    docKey: 'consent',
    title: 'Parental / Guardian Consent Form & Waiver',
    description: 'Signed student waiver, assumption of liability, and parent/guardian emergency contact authorization.',
    notes: 'Signed student waiver & parent/guardian consent form',
    dueDate: 'Before starting training hours',
    required: true,
  },
  {
    docKey: 'medical',
    title: 'Medical Certificate / Physical Clearance',
    description: 'Valid medical examination clearance & physical fitness certification issued by a licensed physician or university clinic.',
    notes: 'Physical fitness & health examination certification',
    dueDate: 'Before deployment to HTE',
    required: true,
  },
  {
    docKey: 'resume',
    title: 'Student Bio-data / Comprehensive Resume',
    description: 'Comprehensive student profile, academic background, contact details, skill highlights, and formal 2x2 ID photo.',
    notes: 'Updated resume with recent formal 2x2 ID photo',
    dueDate: 'Prior to company placement',
    required: true,
  },
  {
    docKey: 'moa',
    title: 'Memorandum of Agreement (MOA) / Internship Contract',
    description: 'Tripartite training contract between the University (CHMSU), the Host Training Establishment (HTE), and the Trainee.',
    notes: 'Duly notarized tripartite internship agreement',
    dueDate: 'Within first 2 weeks of training',
    required: true,
  },
];

function generateMockRecords(): TimeRecord[] {
  const d = new Date();
  const year = d.getFullYear();
  const monthStr = String(d.getMonth() + 1).padStart(2, '0');
  const day = d.getDate();
  const todayStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
  const prevDayStr = `${year}-${monthStr}-${String(Math.max(1, day - 1)).padStart(2, '0')}`;

  return [
    {
      id: 'rec-demo-20231379',
      employeeId: '20231379',
      date: todayStr,
      timeIn: '08:00:00',
      timeOut: '17:00:00',
      totalHours: 8.0,
      status: 'present',
      timeInGeofenced: true,
      timeOutGeofenced: true,
      timeInFaceVerified: true,
      timeOutFaceVerified: true,
      academicYear: '2026-2027',
      approvalStatus: 'pending',
    },
    {
      id: 'rec-demo-emp1',
      employeeId: 'emp-1',
      date: prevDayStr,
      timeIn: '07:55:00',
      timeOut: '17:05:00',
      totalHours: 8.0,
      status: 'present',
      timeInGeofenced: true,
      timeOutGeofenced: true,
      timeInFaceVerified: true,
      timeOutFaceVerified: true,
      academicYear: '2026-2027',
      approvalStatus: 'pending',
    },
  ];
}

type RegisterEmployeeInput = Omit<Employee, 'id' | 'createdAt'> & {
  password?: string;
};

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
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
  loginWithOAuthUser: (authUser: any, explicitRole?: 'admin' | 'hte' | 'trainee' | null) => Promise<User | null>;
  logout: () => void;
  refreshData: () => Promise<void>;
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
  // Monthly DTTR Monitoring
  monthlyDttrs: MonthlyDttrRecord[];
  saveMonthlyDttr: (record: MonthlyDttrRecord) => void;
  getMonthlyDttr: (employeeId: string, year: number, month: number) => MonthlyDttrRecord | null;
  signMonthlyDttr: (employeeId: string, year: number, month: number, supervisorName: string, supervisorTitle?: string) => void;
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
    .filter((zone): zone is GeofenceZone =>
      zone !== null &&
      !zone.name.toLowerCase().includes('main training center') &&
      zone.id !== 'zone-1' &&
      !zone.id.startsWith('personal-')
    );

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
    const raw = localStorage.getItem(STORAGE_KEYS.GEOFENCE_ZONES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (z: any) => !z.name?.toLowerCase().includes('rainer') && !z.name?.toLowerCase().includes('dooms')
        );
        if (cleaned.length !== parsed.length) {
          saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, cleaned);
        }
      }
    }

    if (localStorage.getItem(STORAGE_KEYS.GEOFENCE_MIGRATION_V1) === 'done') return;
    const rawOld = localStorage.getItem(STORAGE_KEYS.GEOFENCE_ZONES);
    const parsedOld = rawOld ? JSON.parse(rawOld) : [];
    const sanitized = sanitizeGeofenceZones(parsedOld);
    saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitized.length > 0 ? sanitized : DEFAULT_GEOFENCE);
    localStorage.setItem(STORAGE_KEYS.GEOFENCE_MIGRATION_V1, 'done');
  } catch {
    // Keep app boot resilient even if old storage is malformed.
  }
}

function migrateInstructorPositionOnce(): void {
  try {
    if (isSupabaseConfigured()) {
      try {
        localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
      } catch {}
      localStorage.setItem('ojt_migrated_instructor_positions', 'done');
      return;
    }
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

function sanitizeValueForStorage(key: string, value: any): any {
  if (key === STORAGE_KEYS.EMPLOYEES && Array.isArray(value)) {
    return value.map((emp) => {
      if (!emp || typeof emp !== 'object') return emp;
      const copy = { ...emp };
      // Preserve document dataUrls (URLs and compact representations)
      if (copy.submittedDocuments && typeof copy.submittedDocuments === 'object') {
        const sanitizedDocs: any = {};
        for (const [docKey, docVal] of Object.entries(copy.submittedDocuments)) {
          if (docVal && typeof docVal === 'object') {
            const docObj = docVal as any;
            sanitizedDocs[docKey] = {
              ...docObj,
              dataUrl: docObj.dataUrl || docObj.fileUrl || '',
            };
          }
        }
        copy.submittedDocuments = sanitizedDocs;
      }
      // Omit excessive base64 photo strings (> 60KB) from localStorage cache
      if (typeof copy.photo === 'string' && copy.photo.startsWith('data:') && copy.photo.length > 60000) {
        copy.photo = '';
      }
      return copy;
    });
  }
  if (key === STORAGE_KEYS.CURRENT_USER && value && typeof value === 'object') {
    const copy = { ...value };
    if (typeof copy.photo === 'string' && copy.photo.startsWith('data:')) {
      copy.photo = '';
    }
    return copy;
  }
  return value;
}

function cleanupStorageQuota(): void {
  try {
    if (isSupabaseConfigured()) {
      localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
      localStorage.removeItem(STORAGE_KEYS.PASSWORDS);
      localStorage.removeItem(STORAGE_KEYS.HOST_SUPERVISORS);
      localStorage.removeItem('ojt_passwords');
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    if (raw && raw.length > 300000) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = sanitizeValueForStorage(STORAGE_KEYS.EMPLOYEES, parsed);
        localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(sanitized));
      }
    }
  } catch {
    // Ignore any error during startup cleanup
  }
}

function saveToStorage<T>(key: string, value: T): void {
  // Pure database mode: User accounts, passwords, and credentials MUST NEVER be stored in localStorage when Supabase is active
  if (
    isSupabaseConfigured() &&
    (key === STORAGE_KEYS.EMPLOYEES ||
      key === STORAGE_KEYS.PASSWORDS ||
      key === STORAGE_KEYS.HOST_SUPERVISORS)
  ) {
    try {
      localStorage.removeItem(key);
    } catch {}
    return;
  }

  try {
    const payload = sanitizeValueForStorage(key, value);
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err: any) {
    console.warn(`[Storage] QuotaExceeded or error saving key "${key}". Evicting non-essential caches.`);
    try {
      localStorage.removeItem(STORAGE_KEYS.TIME_RECORDS);
      localStorage.removeItem(STORAGE_KEYS.ANNOUNCEMENT_SUBMISSIONS);
      localStorage.removeItem(STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS);
      localStorage.removeItem(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS);

      const payload = sanitizeValueForStorage(key, value);
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Safe catch: never throw QuotaExceededError upwards to crash React
    }
  }
}

function cleanRecordPhoto(photo?: string | null): string | undefined {
  if (!photo || typeof photo !== 'string') return undefined;
  const trimmed = photo.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === 'temp' ||
    trimmed.includes('/face-photos/') ||
    (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/'))
  ) {
    return undefined;
  }
  return trimmed;
}

function sanitizeTimeRecords(records: TimeRecord[]): TimeRecord[] {
  if (!Array.isArray(records)) return [];
  return records.map((r) => ({
    ...r,
    timeInPhoto: cleanRecordPhoto(r.timeInPhoto),
    timeOutPhoto: cleanRecordPhoto(r.timeOutPhoto),
  }));
}

function mergeTimeRecords(remoteRecords: TimeRecord[], currentLocalRecords: TimeRecord[]): TimeRecord[] {
  const sanitizedRemote = sanitizeTimeRecords(remoteRecords || []);
  if (sanitizedRemote.length === 0) {
    return sanitizeTimeRecords(currentLocalRecords || []);
  }
  const remoteIds = new Set(sanitizedRemote.map((r) => r.id));
  const remoteEmpDateMap = new Map<string, TimeRecord>();
  sanitizedRemote.forEach((r) => {
    const key = `${(r.employeeId || '').toLowerCase()}_${(r.date || '').split('T')[0].split(' ')[0]}`;
    remoteEmpDateMap.set(key, r);
  });

  // Keep any local records that aren't yet in remoteRecords (e.g. pending sync, rec- timestamp IDs)
  const localOnly = (currentLocalRecords || []).filter((localR) => {
    if (remoteIds.has(localR.id)) return false;
    const key = `${(localR.employeeId || '').toLowerCase()}_${(localR.date || '').split('T')[0].split(' ')[0]}`;
    const remoteMatch = remoteEmpDateMap.get(key);
    if (remoteMatch) {
      // If remote has this employee+date, merge any more recent punch data from local into remote
      if (!remoteMatch.timeOut && localR.timeOut) {
        remoteMatch.timeOut = localR.timeOut;
        remoteMatch.timeOutPhoto = cleanRecordPhoto(localR.timeOutPhoto) || cleanRecordPhoto(remoteMatch.timeOutPhoto);
        remoteMatch.timeOutFaceVerified = localR.timeOutFaceVerified ?? remoteMatch.timeOutFaceVerified;
        remoteMatch.totalHours = localR.totalHours || remoteMatch.totalHours;
        remoteMatch.timeOutGeofenced = localR.timeOutGeofenced ?? remoteMatch.timeOutGeofenced;
      }
      if (!remoteMatch.timeIn && localR.timeIn) {
        remoteMatch.timeIn = localR.timeIn;
        remoteMatch.timeInPhoto = cleanRecordPhoto(localR.timeInPhoto) || cleanRecordPhoto(remoteMatch.timeInPhoto);
        remoteMatch.timeInFaceVerified = localR.timeInFaceVerified ?? remoteMatch.timeInFaceVerified;
        remoteMatch.timeInGeofenced = localR.timeInGeofenced ?? remoteMatch.timeInGeofenced;
      }
      return false;
    }
    return true;
  }).map((r) => ({
    ...r,
    timeInPhoto: cleanRecordPhoto(r.timeInPhoto),
    timeOutPhoto: cleanRecordPhoto(r.timeOutPhoto),
  }));

  return [...sanitizedRemote, ...localOnly];
}

function mergeEvaluations(remoteEvaluations: Evaluation[], currentLocalEvaluations: Evaluation[]): Evaluation[] {
  if (!remoteEvaluations || remoteEvaluations.length === 0) {
    return currentLocalEvaluations || [];
  }
  if (!currentLocalEvaluations || currentLocalEvaluations.length === 0) {
    return remoteEvaluations;
  }

  const remoteMapById = new Map<string, Evaluation>();
  const remoteMapByEmp = new Map<string, Evaluation>();

  remoteEvaluations.forEach((rev) => {
    remoteMapById.set(rev.id, rev);
    if (rev.employeeId) {
      remoteMapByEmp.set(rev.employeeId.toLowerCase(), rev);
    }
  });

  const merged = remoteEvaluations.map((rev) => {
    const localMatch = currentLocalEvaluations.find(
      (lev) =>
        lev.id === rev.id ||
        (lev.employeeId && rev.employeeId && lev.employeeId.toLowerCase() === rev.employeeId.toLowerCase())
    );

    if (!localMatch) return rev;

    // Merge questionnaires: NEVER overwrite answered questions with blank/empty values!
    const localQ = localMatch.questionnaire;
    const remoteQ = rev.questionnaire;

    let mergedQ = remoteQ;
    if (localQ && remoteQ) {
      mergedQ = { ...remoteQ };
      (Object.keys(localQ) as (keyof EvaluationQuestionnaire)[]).forEach((key) => {
        const localVal = String(localQ[key] || '').trim();
        const remoteVal = String(remoteQ[key] || '').trim();
        if (localVal && (!remoteVal || localVal.length > remoteVal.length)) {
          mergedQ![key] = localQ[key];
        }
      });
    } else if (localQ && !remoteQ) {
      mergedQ = localQ;
    }

    // Preserve status hierarchy so trainee submission is never downgraded by a stale draft record
    const STATUS_ORDER: Record<string, number> = {
      draft: 1,
      submitted_by_trainee: 2,
      passed_to_hte: 3,
      submitted_to_instructor: 4,
      reviewed_by_instructor: 5,
      final: 4,
    };

    let mergedStatus = rev.status || localMatch.status;
    const localRank = STATUS_ORDER[localMatch.status || 'draft'] || 1;
    const remoteRank = STATUS_ORDER[rev.status || 'draft'] || 1;
    if (localRank > remoteRank) {
      mergedStatus = localMatch.status;
    }

    return {
      ...rev,
      status: mergedStatus,
      questionnaire: mergedQ,
      ratings: rev.ratings && Object.keys(rev.ratings).length > 0 ? rev.ratings : (localMatch.ratings || rev.ratings),
      ratingComments: rev.ratingComments && Object.keys(rev.ratingComments).length > 0 ? rev.ratingComments : (localMatch.ratingComments || rev.ratingComments),
      commentsSuggestions: rev.commentsSuggestions || localMatch.commentsSuggestions,
    };
  });

  // Preserve any local evaluations that are pending cloud creation (e.g. temporary eval- IDs)
  const localOnly = currentLocalEvaluations.filter((lev) => {
    if (remoteMapById.has(lev.id)) return false;
    if (lev.employeeId && remoteMapByEmp.has(lev.employeeId.toLowerCase())) return false;
    return true;
  });

  return [...merged, ...localOnly];
}

export function AppProvider({ children }: { children: ReactNode }) {
  cleanupStorageQuota();
  migrateGeofenceStorageOnce();
  migrateInstructorPositionOnce();
  const [isLoading, setIsLoading] = useState(false);
  const [useSupabase, setUseSupabase] = useState(() => isSupabaseConfigured());

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const primary = loadFromStorage<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (primary) return primary;
    const legacyUser = loadFromStorage<User | null>('ojt_user', null);
    if (legacyUser) return legacyUser;
    return loadFromStorage<User | null>('ojt_current_user', null);
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const stored = loadFromStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    return stored;
  });
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>(() => {
    const stored = loadFromStorage<TimeRecord[]>(STORAGE_KEYS.TIME_RECORDS, []);
    return sanitizeTimeRecords(stored);
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
    if (isSupabaseConfigured()) {
      try {
        localStorage.removeItem(STORAGE_KEYS.PASSWORDS);
        localStorage.removeItem('ojt_passwords');
      } catch {}
      return {};
    }
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

  const [monthlyDttrs, setMonthlyDttrs] = useState<MonthlyDttrRecord[]>(() =>
    loadFromStorage<MonthlyDttrRecord[]>(STORAGE_KEYS.MONTHLY_DTTR, [])
  );

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

          // Fetch all data from Supabase in parallel and update state dynamically
          Promise.allSettled([
            supabaseService.fetchEmployees().then((emp) => {
              if (isMounted && emp && emp.length > 0) {
                setEmployees(emp);
                saveToStorage(STORAGE_KEYS.EMPLOYEES, emp);
              }
            }),
            supabaseService.fetchTimeRecords().then((recs) => {
              if (isMounted && recs && recs.length > 0) {
                setTimeRecords((prev) => {
                  const merged = mergeTimeRecords(recs, prev);
                  saveToStorage(STORAGE_KEYS.TIME_RECORDS, merged);
                  return merged;
                });
              }
            }),
            supabaseService.fetchGeofenceZones().then((zones) => {
              if (isMounted && zones) {
                const sanitized = sanitizeGeofenceZones(zones);
                if (sanitized.length > 0) {
                  setGeofenceZones(sanitized);
                  saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitized);
                }
              }
            }),
            supabaseService.fetchSettings().then((st) => {
              if (isMounted && st) setSettings(st);
            }),
            supabaseService.fetchEvaluations().then((ev) => {
              if (isMounted && ev && ev.length > 0) {
                setEvaluations(ev);
                saveToStorage(STORAGE_KEYS.EVALUATIONS, ev);
              }
            }),
            supabaseService.fetchAnnouncements().then((ann) => {
              if (isMounted && ann && ann.length > 0) {
                setAnnouncements(ann);
                saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, ann);
              }
            }),
            supabaseService.fetchAnnouncementSubmissions().then((subs) => {
              if (isMounted && subs && subs.length > 0) setAnnouncementSubmissions(subs);
            }),
            supabaseService.fetchAnnouncementComments().then((cmts) => {
              if (isMounted && cmts && cmts.length > 0) setAnnouncementComments(cmts);
            }),
            supabaseService.fetchHostFeedback().then((fb) => {
              if (isMounted && fb && fb.length > 0) setHostFeedback(fb);
            }),
            supabaseService.fetchHostSupervisors().then((sup) => {
              if (isMounted && sup && sup.length > 0) {
                setHostSupervisors(sup);
                saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, sup);
              }
            }),
          ]).finally(() => {
            if (isMounted) {
              setIsLoading(false);
            }
          });
        } catch (error) {
          console.error('Error loading data from Supabase:', error);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'geofence_zones' }, async () => {
        try {
          const supabaseZones = await supabaseService.fetchGeofenceZones();
          const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedZones.length > 0) {
            setGeofenceZones(sanitizedZones);
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitizedZones);
          }
        } catch (err) {
          console.error('Real-time geofence_zones sync error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, async () => {
        try {
          const [supabaseEmployees, supabaseZones] = await Promise.all([
            supabaseService.fetchEmployees(),
            supabaseService.fetchGeofenceZones(),
          ]);
          setEmployees(supabaseEmployees);
          const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedZones.length > 0) {
            setGeofenceZones(sanitizedZones);
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitizedZones);
          }
        } catch (err) {
          console.error('Real-time employees/geofence sync error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_records' }, async (payload) => {
        try {
          if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
            const transformed = supabaseService.transformSupabaseTimeRecord(payload.new);
            setTimeRecords((prev) => {
              const updated = [transformed, ...prev.filter((r) => r.id !== transformed.id)];
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
              return updated;
            });
          } else if (payload.old && payload.eventType === 'DELETE') {
            setTimeRecords((prev) => {
              const updated = prev.filter((r) => r.id !== (payload.old as any).id);
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
              return updated;
            });
          }
          const supabaseRecords = await supabaseService.fetchTimeRecords();
          if (supabaseRecords.length > 0) {
            setTimeRecords((prev) => {
              const merged = mergeTimeRecords(supabaseRecords, prev);
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, merged);
              return merged;
            });
          }
        } catch (err) {
          console.error('Real-time time_records sync error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations' }, async () => {
        try {
          const freshEvals = await supabaseService.fetchEvaluations();
          if (freshEvals && freshEvals.length > 0) {
            setEvaluations((prev) => {
              const merged = mergeEvaluations(freshEvals, prev);
              saveToStorage(STORAGE_KEYS.EVALUATIONS, merged);
              return merged;
            });
          }
        } catch (err) {
          console.error('Real-time evaluations sync error:', err);
        }
      })
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
          if (supabaseRecords.length > 0) {
            setTimeRecords((prev) => {
              const merged = mergeTimeRecords(supabaseRecords, prev);
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, merged);
              return merged;
            });
          }
          const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedZones.length > 0) {
            setGeofenceZones(sanitizedZones);
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, sanitizedZones);
          }
          if (supabaseSettings) setSettings(supabaseSettings);
          if (supabaseEvaluations && supabaseEvaluations.length > 0) {
            setEvaluations((prev) => {
              const merged = mergeEvaluations(supabaseEvaluations, prev);
              saveToStorage(STORAGE_KEYS.EVALUATIONS, merged);
              return merged;
            });
          }
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

  // Periodic polling & window focus auto-sync across all open tabs/devices
  const refreshData = useCallback(async () => {
    if (!useSupabase && !isSupabaseConfigured()) return;
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

      if (supabaseEmployees && supabaseEmployees.length > 0) setEmployees(supabaseEmployees);
      if (supabaseRecords && supabaseRecords.length > 0) {
        setTimeRecords((prev) => {
          const merged = mergeTimeRecords(supabaseRecords, prev);
          saveToStorage(STORAGE_KEYS.TIME_RECORDS, merged);
          return merged;
        });
      }
      const sanitizedZones = sanitizeGeofenceZones(supabaseZones);
      if (sanitizedZones.length > 0) setGeofenceZones(sanitizedZones);
      if (supabaseSettings) setSettings(supabaseSettings);
      if (supabaseEvaluations && supabaseEvaluations.length > 0) {
        setEvaluations((prev) => {
          const merged = mergeEvaluations(supabaseEvaluations, prev);
          saveToStorage(STORAGE_KEYS.EVALUATIONS, merged);
          return merged;
        });
      }
      if (supabaseAnnouncements && supabaseAnnouncements.length > 0) setAnnouncements(supabaseAnnouncements);
      if (supabaseSubmissions && supabaseSubmissions.length > 0) setAnnouncementSubmissions(supabaseSubmissions);
      if (supabaseComments && supabaseComments.length > 0) setAnnouncementComments(supabaseComments);
      if (supabaseHostFeedback && supabaseHostFeedback.length > 0) setHostFeedback(supabaseHostFeedback);
      if (supabaseHostSupervisors && supabaseHostSupervisors.length > 0) setHostSupervisors(supabaseHostSupervisors);
    } catch (err) {
      console.warn('Manual or auto refreshData failed:', err);
    }
  }, [useSupabase]);

  useEffect(() => {
    if (!useSupabase && !isSupabaseConfigured()) return;

    const onFocus = () => {
      refreshData();
    };
    window.addEventListener('focus', onFocus);

    // Periodic live background sync every 45 seconds (when tab is active) so Supabase is not flooded with requests
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshData();
    }, 45000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(syncInterval);
    };
  }, [refreshData, useSupabase]);

  // Save to localStorage only when not using Supabase
  useEffect(() => {
    if (!useSupabase && employees.length > 0) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, employees);
    }
  }, [employees, useSupabase]);

  useEffect(() => {
    if (timeRecords.length > 0) {
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, timeRecords);
    }
  }, [timeRecords]);

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
    try {
      if (currentUser) {
        localStorage.setItem('ojt_user', JSON.stringify(currentUser));
        localStorage.setItem('ojt_current_user', JSON.stringify(currentUser));
        if (currentUser.role === 'hte' || currentUser.role === 'host') {
          localStorage.setItem('ojt_hte_user', JSON.stringify(currentUser));
        }
      }
    } catch {}
  }, [currentUser]);

  // Cross-synchronize photo between employees state and currentUser so avatars always resolve immediately
  useEffect(() => {
    if (!currentUser || employees.length === 0) return;
    const matched = employees.find(
      (e) =>
        e.id === currentUser.employeeId ||
        e.id === currentUser.id ||
        (e.employeeId && (e.employeeId === currentUser.employeeId || e.employeeId === currentUser.id)) ||
        (currentUser.email && e.email ? normalizeEmail(e.email) === normalizeEmail(currentUser.email) : false)
    );
    if (!matched) return;

    // Case 1: Database has photo, currentUser does not -> update currentUser
    if (matched.photo && (!currentUser.photo || currentUser.photo !== matched.photo)) {
      setCurrentUser((prev) => (prev ? { ...prev, photo: matched.photo } : prev));
    }
    // Case 2: currentUser has photo (e.g. from Google OAuth), database does not -> persist to DB
    else if (currentUser.photo && !matched.photo) {
      matched.photo = currentUser.photo;
      if (useSupabase) {
        supabaseService.updateEmployee(matched.id, { photo: currentUser.photo }).catch(console.warn);
      }
    }
  }, [employees, currentUser?.id, currentUser?.employeeId, currentUser?.email, currentUser?.photo, useSupabase]);

  useEffect(() => {
    if (evaluations.length > 0) {
      saveToStorage(STORAGE_KEYS.EVALUATIONS, evaluations);
    }
  }, [evaluations]);

  useEffect(() => {
    if (!useSupabase && announcements.length > 0) {
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
    }
  }, [announcements, useSupabase]);
  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_SUBMISSIONS, announcementSubmissions);
    }
  }, [announcementSubmissions, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENT_COMMENTS, announcementComments);
    }
  }, [announcementComments, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENTS, requiredDocuments);
    }
  }, [requiredDocuments, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.REQUIRED_DOCUMENT_SUBMISSIONS, requiredDocumentSubmissions);
    }
  }, [requiredDocumentSubmissions, useSupabase]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MONTHLY_DTTR, monthlyDttrs);
  }, [monthlyDttrs]);

  useEffect(() => {
    if (!useSupabase && hostSupervisors.length > 0) {
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, hostSupervisors);
    }
  }, [hostSupervisors, useSupabase]);

  useEffect(() => {
    if (!useSupabase && hostFeedback.length > 0) {
      saveToStorage(STORAGE_KEYS.HOST_FEEDBACK, hostFeedback);
    }
  }, [hostFeedback, useSupabase]);

  // Passwords are NOT saved to localStorage — only the database stores authentication credentials.
  const setPasswordForEmail = (email: string, password: string) => {
    const norm = normalizeEmail(email);
    setPasswords((prev) => ({ ...prev, [norm]: password }));
    try {
      localStorage.removeItem(STORAGE_KEYS.PASSWORDS);
      localStorage.removeItem('ojt_passwords');
    } catch { }
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
        (normalizeEmail(e.email) === normalizedId ||
          (e.employeeId && e.employeeId.toLowerCase() === normalizedId) ||
          (e.id && e.id.toLowerCase() === normalizedId) ||
          (e.username && e.username.toLowerCase() === normalizedId))
    );

    if (!matchedEmp) {
      matchedHost = hostSupervisors.find(
        (h) =>
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

        if (dbEmp) {
          matchedEmp = supabaseService.transformSupabaseEmployee(dbEmp);
          setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
        } else {
          const { data: dbHost } = await supabase
            .from('host_supervisors')
            .select('*')
            .eq('email', normalizedId)
            .limit(1)
            .maybeSingle();

          if (dbHost) {
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
        const authPromise = supabase.auth.signInWithPassword({
          email: targetEmail,
          password: password,
        });
        const { data: authData, error: authError } = await Promise.race([
          authPromise,
          new Promise<any>((_, rej) => setTimeout(() => rej(new Error('Supabase login timeout')), 3500)),
        ]);

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

            if (dbEmp) {
              matchedEmp = supabaseService.transformSupabaseEmployee(dbEmp);
              setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
            } else {
              const { data: dbHost } = await supabase
                .from('host_supervisors')
                .select('*')
                .or(`id.eq.${userId},email.ilike.${targetEmail}`)
                .limit(1)
                .maybeSingle();

              if (dbHost) {
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
              } else {
                // Auto-heal: User exists in Supabase Auth but profile was missing in employees table
                const userMeta = authData.user.user_metadata || {};
                const userRole = userMeta.role || 'employee';
                const isHostRole = userRole === 'host' || userRole === 'hte';
                const isInstRole = userRole === 'admin' || userRole === 'instructor';
                const healEmp: Employee = {
                  id: userId,
                  name: userMeta.full_name || targetEmail.split('@')[0] || 'Trainee',
                  email: targetEmail,
                  employeeId: isHostRole ? `HTE-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}` : isInstRole ? `ADM-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}` : `OJT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
                  department: 'College of Computer Studies',
                  position: isInstRole ? 'OJT Instructor' : isHostRole ? 'HTE Representative' : 'OJT Trainee',
                  companyName: isHostRole ? 'Host Establishment' : 'N/A',
                  supervisorName: 'N/A',
                  schoolName: 'Carlos Hilado Memorial State University',
                  campus: 'Talisay Campus',
                  course: 'Information Systems',
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: new Date().toISOString().split('T')[0],
                  requiredHours: isInstRole || isHostRole ? 0 : 486,
                  faceRegistered: false,
                  active: true,
                  academicYear: settings.activeAcademicYear,
                  approvalStatus: 'approved',
                  applicationStatus: 'approved',
                  createdAt: new Date().toISOString().split('T')[0],
                };
                try {
                  const saved = await supabaseService.createEmployee(healEmp);
                  matchedEmp = saved || healEmp;
                } catch {
                  matchedEmp = healEmp;
                }
                setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
              }
            }
          }

          if (matchedEmp) {
            const isInstructor = matchedEmp.position === 'OJT Instructor' || matchedEmp.position === 'Administrator' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('instructor'));
            const isHTE = matchedEmp.position === 'HTE Representative' || matchedEmp.position === 'Training Supervisor' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('hte'));
            const role: User['role'] = isInstructor ? 'admin' : isHTE ? 'hte' : 'employee';
            const authAvatar = authData.user.user_metadata?.avatar_url || authData.user.user_metadata?.picture;
            const resolvedPhoto = matchedEmp.photo || authAvatar || '';
            const user: User = {
              id: matchedEmp.id,
              name: matchedEmp.name,
              role,
              employeeId: matchedEmp.employeeId || matchedEmp.id,
              email: normalizeEmail(matchedEmp.email),
              photo: resolvedPhoto,
              faceRegistered: matchedEmp.faceRegistered,
            };
            if (authAvatar && !matchedEmp.photo) {
              matchedEmp.photo = authAvatar;
              if (useSupabase) {
                supabaseService.updateEmployee(matchedEmp.id, { photo: authAvatar }).catch(console.warn);
              }
            }
            setCurrentUser(user);
            saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
            try {
              localStorage.setItem('ojt_user', JSON.stringify(user));
              localStorage.setItem('ojt_current_user', JSON.stringify(user));
              if (role === 'hte') localStorage.setItem('ojt_hte_user', JSON.stringify(user));
            } catch {}
            setPasswordForEmail(matchedEmp.email, password);
            return user;
          }

          if (matchedHost) {
            const authAvatar = authData.user.user_metadata?.avatar_url || authData.user.user_metadata?.picture;
            const hostPhoto = matchedHost.photo || authAvatar || '';
            const user: User = {
              id: matchedHost.id,
              name: matchedHost.name,
              role: 'hte',
              email: normalizeEmail(matchedHost.email),
              employeeId: matchedHost.employeeId || matchedHost.id,
              photo: hostPhoto,
              faceRegistered: false,
            };
            setCurrentUser(user);
            saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
            try {
              localStorage.setItem('ojt_user', JSON.stringify(user));
              localStorage.setItem('ojt_hte_user', JSON.stringify(user));
              localStorage.setItem('ojt_current_user', JSON.stringify(user));
            } catch {}
            setPasswordForEmail(matchedHost.email, password);
            return user;
          }
        }
      } catch (err) {
        console.warn('Supabase Auth attempt notice, checking database account:', err);
      }
    }

    // Step 4: Backend API & Database Verification
    if (targetEmail.includes('@')) {
      try {
        const resp = await authAPI.login(targetEmail, password);
        if (resp?.data?.tokens) {
          localStorage.setItem('ojt_jwt_access_token', resp.data.tokens.access);
          localStorage.setItem('ojt_jwt_refresh_token', resp.data.tokens.refresh);
        }

        if (matchedEmp) {
          const isInstructor = matchedEmp.position === 'OJT Instructor' || matchedEmp.position === 'Administrator' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('instructor'));
          const isHTE = matchedEmp.position === 'HTE Representative' || matchedEmp.position === 'Training Supervisor' || (matchedEmp.position && matchedEmp.position.toLowerCase().includes('hte'));
          const role: User['role'] = isInstructor ? 'admin' : isHTE ? 'hte' : 'employee';
          const user: User = {
            id: matchedEmp.id,
            name: matchedEmp.name,
            role,
            employeeId: matchedEmp.employeeId || matchedEmp.id,
            email: normalizeEmail(matchedEmp.email),
            photo: matchedEmp.photo,
            faceRegistered: matchedEmp.faceRegistered,
          };
          setCurrentUser(user);
          return user;
        }

        if (matchedHost) {
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
          return user;
        }

        if (resp?.data?.user) {
          const u = resp.data.user;
          const user: User = {
            id: String(u.id),
            name: u.name || targetEmail.split('@')[0],
            role: u.role === 'instructor' ? 'admin' : u.role === 'hte' ? 'hte' : 'employee',
            email: normalizeEmail(u.email || targetEmail),
            photo: u.avatar || undefined,
            faceRegistered: Boolean(u.face_registered),
          };
          setCurrentUser(user);
          return user;
        }
      } catch (backendAuthErr) {
        // Backend DB authentication also rejected credentials
      }
    }

    // Default Administrator fallback (in case offline development mode)
    if (normalizedId === 'admin@ojt.com' && (password === 'admin123' || password === 'admin')) {
      const user: User = { id: 'admin', name: 'OJT Instructor', role: 'admin', email: 'admin@ojt.com' };
      setCurrentUser(user);
      return user;
    }

    return null;
  };

  const loginWithOAuthUser = async (authUser: any, explicitRole?: 'admin' | 'hte' | 'trainee' | null): Promise<User | null> => {
    if (!authUser) return null;
    const authEmail = (authUser.email || '').trim().toLowerCase();
    const authId = authUser.id || '';
    if (!authEmail && !authId) return null;

    let matchedEmp: Employee | undefined = undefined;
    let matchedHost: HostSupervisor | undefined = undefined;

    // Step 1: Check memory + local storage cached records first
    const cachedEmployees = loadFromStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const cachedHosts = loadFromStorage<HostSupervisor[]>(STORAGE_KEYS.HOST_SUPERVISORS, []);
    const allEmps = employees.length > 0 ? employees : cachedEmployees;
    const allHosts = hostSupervisors.length > 0 ? hostSupervisors : cachedHosts;

    matchedEmp = allEmps.find(
      (e) =>
        (authEmail && e.email && normalizeEmail(e.email) === authEmail) ||
        (authId && (e.id === authId || e.userId === authId))
    );

    if (!matchedEmp) {
      matchedHost = allHosts.find(
        (h) =>
          (authEmail && h.email && normalizeEmail(h.email) === authEmail) ||
          (authId && h.id === authId)
      );
    }

    // Step 2: Supabase DB check if not found in memory/storage
    if (useSupabase && !matchedEmp && !matchedHost) {
      try {
        if (authEmail) {
          const { data: dbEmp, error: empErr } = await supabase
            .from('employees')
            .select('*')
            .ilike('email', authEmail)
            .limit(1)
            .maybeSingle();

          if (!empErr && dbEmp) {
            matchedEmp = supabaseService.transformSupabaseEmployee(dbEmp);
            setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
            saveToStorage(STORAGE_KEYS.EMPLOYEES, [matchedEmp!, ...cachedEmployees.filter((e) => e.id !== matchedEmp!.id)]);
          }
        }

        if (!matchedEmp && authId) {
          const { data: dbEmpId, error: empIdErr } = await supabase
            .from('employees')
            .select('*')
            .eq('id', authId)
            .limit(1)
            .maybeSingle();

          if (!empIdErr && dbEmpId) {
            matchedEmp = supabaseService.transformSupabaseEmployee(dbEmpId);
            setEmployees((prev) => [matchedEmp!, ...prev.filter((e) => e.id !== matchedEmp!.id)]);
            saveToStorage(STORAGE_KEYS.EMPLOYEES, [matchedEmp!, ...cachedEmployees.filter((e) => e.id !== matchedEmp!.id)]);
          }
        }

        if (!matchedEmp && authEmail) {
          const { data: dbHost, error: hostErr } = await supabase
            .from('host_supervisors')
            .select('*')
            .ilike('email', authEmail)
            .limit(1)
            .maybeSingle();

          if (!hostErr && dbHost) {
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
        console.warn('OAuth database lookup notice:', lookupErr);
      }
    }

    const pendingRole =
      explicitRole ||
      (typeof window !== 'undefined' ? (localStorage.getItem('pending_oauth_role') as any) : null) ||
      authUser.user_metadata?.role;

    if (matchedEmp) {
      if (useSupabase && authId && matchedEmp.userId !== authId) {
        try {
          await supabase.from('employees').update({ user_id: authId }).eq('id', matchedEmp.id);
          matchedEmp.userId = authId;
        } catch (linkErr) {
          console.warn('Could not link OAuth user_id:', linkErr);
        }
      }

      const isInstructor =
        pendingRole === 'admin' ||
        matchedEmp.role === 'admin' ||
        matchedEmp.position === 'OJT Instructor' ||
        matchedEmp.position === 'Administrator' ||
        (matchedEmp.position && matchedEmp.position.toLowerCase().includes('instructor')) ||
        (matchedEmp.position && matchedEmp.position.toLowerCase().includes('admin'));
      const isHTE =
        pendingRole === 'hte' ||
        matchedEmp.role === 'hte' ||
        matchedEmp.role === 'host' ||
        matchedEmp.position === 'HTE Representative' ||
        matchedEmp.position === 'Training Supervisor' ||
        (matchedEmp.position && matchedEmp.position.toLowerCase().includes('hte'));
      const role: User['role'] = isInstructor ? 'admin' : isHTE ? 'hte' : 'employee';

      // If user specifically signed in as Instructor, ensure their employee record has role admin
      if (pendingRole === 'admin' && (matchedEmp.role !== 'admin' || matchedEmp.position !== 'OJT Instructor')) {
        matchedEmp.role = 'admin';
        matchedEmp.position = 'OJT Instructor';
        if (useSupabase) {
          try {
            await supabase.from('employees').update({
              role: 'admin',
              position: 'OJT Instructor',
              application_status: 'approved',
            }).eq('id', matchedEmp.id);
          } catch (syncErr) {
            console.warn('Failed syncing instructor role to DB:', syncErr);
          }
        }
      }

      // If user specifically signed in as HTE, ensure their employee record has role hte
      if (pendingRole === 'hte' && matchedEmp.role !== 'hte') {
        matchedEmp.role = 'hte';
        matchedEmp.position = 'HTE Representative';
        if (useSupabase) {
          try {
            await supabase.from('employees').update({
              role: 'hte',
              position: 'HTE Representative',
              application_status: 'approved',
            }).eq('id', matchedEmp.id);
          } catch (syncErr) {
            console.warn('Failed syncing HTE role to DB:', syncErr);
          }
        }
      }

      const oauthPhoto = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture;
      if (oauthPhoto && !matchedEmp.photo) {
        matchedEmp.photo = oauthPhoto;
        if (useSupabase) {
          supabaseService.updateEmployee(matchedEmp.id, { photo: oauthPhoto }).catch(console.warn);
        }
      }
      const user: User = {
        id: matchedEmp.id,
        name: matchedEmp.name,
        role,
        employeeId: matchedEmp.employeeId || matchedEmp.id,
        email: normalizeEmail(matchedEmp.email),
        photo: matchedEmp.photo || oauthPhoto,
        faceRegistered: matchedEmp.faceRegistered,
      };
      setCurrentUser(user);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
      try {
        localStorage.setItem('ojt_user', JSON.stringify(user));
        localStorage.setItem('ojt_current_user', JSON.stringify(user));
        if (role === 'hte') {
          localStorage.setItem('ojt_hte_user', JSON.stringify(user));
        }
      } catch {}
      return user;
    }

    if (matchedHost) {
      const oauthPhoto = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture;
      if (oauthPhoto && !matchedHost.photo) {
        matchedHost.photo = oauthPhoto;
      }
      const user: User = {
        id: matchedHost.id,
        name: matchedHost.name,
        role: 'hte',
        email: normalizeEmail(matchedHost.email),
        employeeId: matchedHost.employeeId || matchedHost.id,
        photo: matchedHost.photo || oauthPhoto,
        faceRegistered: false,
      };
      setCurrentUser(user);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
      try {
        localStorage.setItem('ojt_user', JSON.stringify(user));
        localStorage.setItem('ojt_hte_user', JSON.stringify(user));
        localStorage.setItem('ojt_current_user', JSON.stringify(user));
      } catch {}
      return user;
    }

    // Auto-provision instructor if signing in via Google with Instructor role
    if (pendingRole === 'admin') {
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authEmail.split('@')[0];
      const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '';
      const employeeId = `ADM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const autoInstructor: Employee = {
        id: authId || `ADM-${Date.now()}`,
        name: fullName,
        email: authEmail,
        employeeId,
        role: 'admin',
        position: 'OJT Instructor',
        department: 'College of Computer Studies',
        companyName: 'N/A',
        supervisorName: 'N/A',
        schoolName: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Campus',
        course: 'Information Systems',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        requiredHours: 0,
        faceRegistered: false,
        active: true,
        academicYear: settings.activeAcademicYear,
        approvalStatus: 'approved',
        applicationStatus: 'approved',
        documentsPassed: true,
        documentsStatus: 'passed',
        createdAt: new Date().toISOString().split('T')[0],
        photo: avatarUrl || undefined,
        userId: authId,
      };

      if (useSupabase) {
        try {
          const dbData: any = {
            id: authId,
            employee_id: employeeId,
            name: fullName,
            email: authEmail,
            position: 'OJT Instructor',
            role: 'admin',
            academic_year: settings.activeAcademicYear,
            department: 'College of Computer Studies',
            campus: 'Talisay Campus',
            school_name: 'Carlos Hilado Memorial State University',
            photo: avatarUrl || null,
            active: true,
            application_status: 'approved',
            documents_passed: true,
            documents_status: 'passed',
            face_registered: false,
            required_hours: 0,
          };
          const { error: upErr } = await supabase.from('employees').upsert(dbData, { onConflict: 'email' });
          if (upErr) {
            await supabase.from('employees').upsert(dbData, { onConflict: 'id' });
          }
        } catch (provErr) {
          console.warn('Auto-provisioning instructor notice in AppContext:', provErr);
        }
      }

      setEmployees((prev) => [autoInstructor, ...prev.filter((e) => e.email !== authEmail)]);
      const user: User = {
        id: autoInstructor.id,
        name: autoInstructor.name,
        role: 'admin',
        employeeId: autoInstructor.employeeId,
        email: authEmail,
        photo: avatarUrl,
        faceRegistered: false,
      };
      setCurrentUser(user);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
      try {
        localStorage.setItem('ojt_user', JSON.stringify(user));
      } catch {}
      return user;
    }

    // Auto-provision HTE supervisor if signing in via Google with HTE role
    if (pendingRole === 'hte') {
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authEmail.split('@')[0];
      const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '';
      const employeeId = `HTE-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const autoHte: Employee = {
        id: authId || `HTE-${Date.now()}`,
        name: fullName,
        email: authEmail,
        employeeId,
        role: 'hte',
        position: 'HTE Representative',
        department: 'Host Establishment',
        companyName: 'Host Training Establishment',
        supervisorName: fullName,
        schoolName: 'Carlos Hilado Memorial State University',
        campus: 'Talisay Campus',
        course: 'Information Systems',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        requiredHours: 0,
        faceRegistered: false,
        active: true,
        academicYear: settings.activeAcademicYear,
        approvalStatus: 'approved',
        applicationStatus: 'approved',
        documentsPassed: true,
        documentsStatus: 'passed',
        createdAt: new Date().toISOString().split('T')[0],
        photo: avatarUrl || undefined,
        userId: authId,
      };

      if (useSupabase) {
        try {
          const dbData: any = {
            id: authId,
            employee_id: employeeId,
            name: fullName,
            email: authEmail,
            position: 'HTE Representative',
            role: 'hte',
            academic_year: settings.activeAcademicYear,
            company_name: 'Host Training Establishment',
            supervisor_name: fullName,
            photo: avatarUrl || null,
            active: true,
            application_status: 'approved',
            documents_passed: true,
            documents_status: 'passed',
            face_registered: false,
            required_hours: 0,
          };
          const { error: upErr } = await supabase.from('employees').upsert(dbData, { onConflict: 'email' });
          if (upErr) {
            await supabase.from('employees').upsert(dbData, { onConflict: 'id' });
          }
          await supabase.from('host_supervisors').upsert({
            id: authId,
            employee_id: employeeId,
            name: fullName,
            email: authEmail,
            company_name: 'Host Training Establishment',
            contact_person: fullName,
            is_approved: true,
            active: true,
          }, { onConflict: 'email' });
        } catch (provErr) {
          console.warn('Auto-provisioning HTE notice in AppContext:', provErr);
        }
      }

      setEmployees((prev) => [autoHte, ...prev.filter((e) => e.email !== authEmail)]);
      const user: User = {
        id: autoHte.id,
        name: autoHte.name,
        role: 'hte',
        employeeId: autoHte.employeeId,
        email: authEmail,
        photo: avatarUrl,
        faceRegistered: false,
      };
      setCurrentUser(user);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
      try {
        localStorage.setItem('ojt_user', JSON.stringify(user));
        localStorage.setItem('ojt_hte_user', JSON.stringify(user));
      } catch {}
      return user;
    }

    // Returning null for trainee first-time Google sign in so user can complete registration
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
    const isCloud = isSupabaseConfigured() || useSupabase;

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

    const phoneVal = employeeData.contactPhone || employeeData.phone || (employeeData as any).telephone;
    const resAddrVal = employeeData.residentialAddress || employeeData.address;

    const cleanData = {
      ...employeeData,
      employeeId: resolvedEmployeeId,
      companyName: employeeData.companyName || (isHTE ? 'HTE Partner' : 'N/A'),
      supervisorName: employeeData.supervisorName || 'N/A',
      schoolName: employeeData.schoolName || 'Carlos Hilado Memorial State University',
      campus: employeeData.campus || 'Talisay (Main Campus)',
      contactPhone: phoneVal,
      phone: phoneVal,
      telephone: phoneVal,
      residentialAddress: resAddrVal,
      address: resAddrVal,
      course: employeeData.course || 'N/A',
      startDate: employeeData.startDate || new Date().toISOString().split('T')[0],
      endDate: employeeData.endDate || new Date().toISOString().split('T')[0],
      requiredHours: employeeData.requiredHours ?? (isInstructor || isHTE ? 0 : 486),
    };

    const newEmp: Employee = {
      ...cleanData,
      academicYear: cleanData.academicYear || settings.activeAcademicYear,
      id: generateId('emp'),
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (isCloud) {
      try {
        // Compress and upload face photo if base64
        if (cleanData.photo && typeof cleanData.photo === 'string' && !cleanData.photo.startsWith('http')) {
          try {
            cleanData.photo = await supabaseService.compressBase64Image(cleanData.photo, 600, 0.82);
            const uploadedUrl = await supabaseService.uploadFacePhoto(resolvedEmployeeId || 'unassigned', cleanData.photo, 'profile');
            if (uploadedUrl && uploadedUrl.startsWith('http')) {
              cleanData.photo = uploadedUrl;
            }
          } catch (uploadErr) {
            console.warn('Face photo upload warning during registerEmployee:', uploadErr);
          }
        }

        let authId: string | undefined;

        // Attempt Supabase Auth account creation if password provided
        if (password) {
          try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: cleanData.email.trim().toLowerCase(),
              password: password,
              options: {
                data: {
                  full_name: cleanData.name,
                  role: isInstructor ? 'admin' : isHTE ? 'host' : 'employee',
                }
              }
            });

            if (authError) {
              console.warn('Supabase auth.signUp note (proceeding to ensure employees row is saved):', authError.message);
            } else if (authData?.user?.id) {
              authId = authData.user.id;
            }
          } catch (authCatchErr) {
            console.warn('Supabase auth.signUp exception (proceeding to save database record):', authCatchErr);
          }
        }

        if (!authId && cleanData.userId) {
          authId = cleanData.userId;
        }

        // Auto-link trainees to an instructor and HTE supervisor for the active academic year
        let autoInstructorId: string | undefined;
        let autoHteId: string | undefined;
        const targetAcademicYear = cleanData.academicYear || newEmp.academicYear || settings.activeAcademicYear;
        const defaultAY = settings.academicYears?.[0] || '2025-2026';

        if (!isInstructor && !isHTE) {
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

          if (!autoInstructorId) {
            const localInst = employees.find(
              (e) => (e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor'))) &&
                     (e.academicYear === targetAcademicYear || (!e.academicYear && targetAcademicYear === defaultAY))
            ) || employees.find((e) => e.position === 'OJT Instructor');
            if (localInst) autoInstructorId = localInst.id;
          }

          // Auto-link trainee to matching HTE supervisor by company name or any active HTE supervisor
          try {
            if (cleanData.companyName && cleanData.companyName.trim() !== '' && cleanData.companyName.toLowerCase() !== 'n/a') {
              const { data: matchingHte } = await supabase
                .from('employees')
                .select('id')
                .eq('position', 'HTE Representative')
                .ilike('company_name', `%${cleanData.companyName.trim()}%`)
                .limit(1)
                .maybeSingle();
              if (matchingHte?.id) {
                autoHteId = matchingHte.id;
              } else {
                const { data: matchingHost } = await supabase
                  .from('host_supervisors')
                  .select('id')
                  .ilike('company_name', `%${cleanData.companyName.trim()}%`)
                  .limit(1)
                  .maybeSingle();
                if (matchingHost?.id) autoHteId = matchingHost.id;
              }
            }

            if (!autoHteId) {
              const { data: anyHte } = await supabase
                .from('employees')
                .select('id')
                .eq('position', 'HTE Representative')
                .limit(1)
                .maybeSingle();
              if (anyHte?.id) autoHteId = anyHte.id;
            }
          } catch (hteErr) {
            console.warn('Auto HTE linking lookup failed:', hteErr);
          }

          if (!autoHteId && cleanData.companyName && cleanData.companyName.trim() !== '' && cleanData.companyName.toLowerCase() !== 'n/a') {
            const comp = cleanData.companyName.trim().toLowerCase();
            const localHte = employees.find(
              (e) => (e.position === 'HTE Representative' || (e.position && e.position.toLowerCase().includes('hte'))) &&
                     e.companyName && e.companyName.trim().toLowerCase() === comp
            ) || hostSupervisors.find(
              (h) => h.companyName && h.companyName.trim().toLowerCase() === comp
            );
            if (localHte?.id) autoHteId = localHte.id;
          }
        }

        const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        const employeePayload = {
          ...cleanData,
          academicYear: targetAcademicYear,
          instructorId: isUuid(autoInstructorId) ? autoInstructorId : undefined,
          hteId: isUuid(autoHteId) ? autoHteId : undefined,
          applicationStatus: 'approved' as const,
          approvalStatus: 'approved' as const,
          active: true,
          ...(isUuid(authId) ? { id: authId } : {}),
        };

        let created: Employee | null = null;
        try {
          created = await supabaseService.createEmployee(employeePayload);
        } catch (createErr: any) {
          console.error('createEmployee failed:', createErr);
          const errMsg = String(createErr?.message || createErr || '').toLowerCase();
          const isNetworkError =
            errMsg.includes('failed to fetch') ||
            errMsg.includes('network') ||
            errMsg.includes('timeout') ||
            errMsg.includes('connection') ||
            (typeof navigator !== 'undefined' && !navigator.onLine);

          if (isNetworkError) {
            console.warn('[Offline Mode] Network unavailable or connection dropped during registration — saving trainee locally.');
            created = {
              ...newEmp,
              ...employeePayload,
              id: employeePayload.id || newEmp.id,
            };
          } else {
            return {
              success: false,
              message: `Database registration failed: ${createErr?.message || 'Unknown error'}`,
            };
          }
        }

        if (!created) {
          return { success: false, message: 'Failed to create database record in Supabase.' };
        }

        if (password) {
          setPasswordForEmail(cleanData.email, password);
        }

        // Update local React state and storage with newly registered profile (guarantees offline availability)
        setEmployees((prev) => [created!, ...prev.filter((e) => e.email.toLowerCase() !== cleanData.email.toLowerCase() && e.id !== created!.id)]);
        saveToStorage(STORAGE_KEYS.EMPLOYEES, [created!, ...employees.filter((e) => e.email.toLowerCase() !== cleanData.email.toLowerCase() && e.id !== created!.id)]);

        // Cross-role sync: If registering an HTE supervisor, persist host supervisor and auto-link matching trainees in this academic year
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

          // Bidirectional sync: Link all Trainees registered under this academic year with matching company name to this HTE
          const comp = (created.companyName || cleanData.companyName || '').trim().toLowerCase();
          if (comp && comp !== 'n/a' && comp !== 'host training establishment') {
            const traineesToLink = employees.filter(
              (e) =>
                e.position !== 'OJT Instructor' &&
                e.position !== 'HTE Representative' &&
                (e.academicYear === targetAcademicYear || (!e.academicYear && targetAcademicYear === defaultAY)) &&
                e.companyName &&
                e.companyName.trim().toLowerCase() === comp &&
                !e.hteId
            );

            if (traineesToLink.length > 0) {
              traineesToLink.forEach((t) => {
                t.hteId = created!.id;
                supabase.from('employees').update({ hte_id: created!.id }).eq('id', t.id).then(undefined, () => {});
              });
              setEmployees((prev) =>
                prev.map((e) => (traineesToLink.some((t) => t.id === e.id) ? { ...e, hteId: created!.id } : e))
              );
            }
          }
        }

        // Cross-role sync: If registering an Instructor, auto-link unassigned Trainees in this academic year
        if (isInstructor) {
          const traineesToLink = employees.filter(
            (e) =>
              e.position !== 'OJT Instructor' &&
              e.position !== 'HTE Representative' &&
              (e.academicYear === targetAcademicYear || (!e.academicYear && targetAcademicYear === defaultAY)) &&
              !e.instructorId
          );

          if (traineesToLink.length > 0) {
            traineesToLink.forEach((t) => {
              t.instructorId = created!.id;
              supabase.from('employees').update({ instructor_id: created!.id }).eq('id', t.id).then(undefined, () => {});
            });
            setEmployees((prev) =>
              prev.map((e) => (traineesToLink.some((t) => t.id === e.id) ? { ...e, instructorId: created!.id } : e))
            );
          }
        }

        // Auto-create/upsert station geofence zone in database and local state for all registered accounts
        const campusInfo = getCampusLocation(cleanData.campus || created.campus);
        const hasCoords = (cleanData.registrationLocation?.lat && cleanData.registrationLocation?.lng) || isInstructor;

        if (hasCoords) {
          const isCreatedUuid = created.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.id);
          const zoneName = isInstructor
            ? `${created.name} - Official Station`
            : isHTE
            ? `${created.name} - ${cleanData.companyName || 'HTE Workplace'}`
            : `${created.name} - Trainee Geofence (${cleanData.companyName || 'Assigned Workplace'})`;
          const zoneAddr = isInstructor
            ? campusInfo.address
            : cleanData.companyAddress || cleanData.registrationAddress || `${Number(cleanData.registrationLocation?.lat).toFixed(6)}, ${Number(cleanData.registrationLocation?.lng).toFixed(6)}`;

          const zoneLat = isInstructor ? campusInfo.lat : Number(cleanData.registrationLocation?.lat);
          const zoneLng = isInstructor ? campusInfo.lng : Number(cleanData.registrationLocation?.lng);

          const stationZone: GeofenceZone = {
            id: isCreatedUuid ? created.id : `station-${created.id}`,
            name: zoneName,
            address: zoneAddr,
            lat: zoneLat,
            lng: zoneLng,
            radius: isInstructor ? campusInfo.radius : 100,
            active: true,
            academicYear: cleanData.academicYear || settings.activeAcademicYear,
          };
          supabaseService.createGeofenceZone(stationZone).then((saved) => {
            const zoneToUse = saved || stationZone;
            setGeofenceZones((prev) => [zoneToUse, ...prev.filter((z) => z.id !== zoneToUse.id && z.id !== stationZone.id && z.id !== `station-${created!.id}`)]);
          }).catch((err) => {
            console.debug('Station geofence zone auto-sync notice:', err);
          });
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

      // Local storage station geofence auto-creation
      const campusInfo = getCampusLocation(cleanData.campus || newEmp.campus);
      const hasCoords = (cleanData.registrationLocation?.lat && cleanData.registrationLocation?.lng) || isInstructor;
      if (hasCoords) {
        const zoneName = isInstructor
          ? `${newEmp.name} - Official Station`
          : isHTE
          ? `${newEmp.name} - ${cleanData.companyName || 'HTE Workplace'}`
          : `${newEmp.name} - Trainee Geofence (${cleanData.companyName || 'Assigned Workplace'})`;
        const zoneAddr = isInstructor
          ? campusInfo.address
          : cleanData.companyAddress || cleanData.registrationAddress || `${Number(cleanData.registrationLocation?.lat).toFixed(6)}, ${Number(cleanData.registrationLocation?.lng).toFixed(6)}`;

        const localZone: GeofenceZone = {
          id: `station-${newEmp.id}`,
          name: zoneName,
          address: zoneAddr,
          lat: isInstructor ? campusInfo.lat : Number(cleanData.registrationLocation?.lat),
          lng: isInstructor ? campusInfo.lng : Number(cleanData.registrationLocation?.lng),
          radius: isInstructor ? campusInfo.radius : 100,
          active: true,
          academicYear: cleanData.academicYear || settings.activeAcademicYear,
        };
        setGeofenceZones((prev) => {
          const next = [localZone, ...prev.filter((z) => z.id !== localZone.id)];
          saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, next);
          return next;
        });
      }

      // Local storage face enrollment fallback
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
    const updatedEmployees = employees.map((e) => {
      if (e.id === id || e.employeeId === id) {
        const next: any = { ...e, ...data };
        if ('registrationLocation' in data && !data.registrationLocation) {
          delete next.registrationLocation;
          delete next.registration_lat;
          delete next.registration_lng;
        }
        if ('registrationAddress' in data && !data.registrationAddress) {
          delete next.registrationAddress;
          delete next.registration_address;
        }
        return next as Employee;
      }
      return e;
    });
    setEmployees(updatedEmployees);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
    }

    const updatedEmployee = updatedEmployees.find((e) => e.id === id || e.employeeId === id);
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
      supabaseService.updateEmployee(id, {
        ...data,
        email: updatedEmployee?.email || data.email,
        phone: updatedEmployee?.phone || data.phone,
        contactPhone: updatedEmployee?.contactPhone || data.contactPhone,
        telephone: (updatedEmployee as any)?.telephone || (data as any)?.telephone,
        residentialAddress: updatedEmployee?.residentialAddress || data.residentialAddress,
        address: updatedEmployee?.address || data.address,
        registrationLocation: updatedEmployee?.registrationLocation,
        registrationAddress: updatedEmployee?.registrationAddress,
        submittedDocuments: updatedEmployee?.submittedDocuments,
        documentsPassed: updatedEmployee?.documentsPassed,
        documentsStatus: updatedEmployee?.documentsStatus,
      });
    }

    // If location is cleared, remove personal geofence zone
    if ('registrationLocation' in data && !data.registrationLocation) {
      setGeofenceZones((prev) => {
        const filtered = prev.filter((z) => z.id !== `personal-${id}` && z.id !== id);
        if (!useSupabase) {
          saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, filtered);
        }
        return filtered;
      });
      if (useSupabase) {
        supabaseService.deleteGeofenceZone(`personal-${id}`);
      }
    }

    // Ensure no personal geofence zones are created for trainees
    setGeofenceZones((prev) => {
      const filtered = prev.filter((z) => z.id !== `personal-${id}`);
      if (filtered.length !== prev.length) {
        if (!useSupabase) {
          saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, filtered);
        }
        if (useSupabase) {
          supabaseService.deleteGeofenceZone(`personal-${id}`).catch(() => {});
        }
      }
      return filtered;
    });

    // AUTO-SYNC TRAINEE GEOFENCE ZONE WITH HTE WORKPLACE
    // If the employee is a student/trainee and their HTE workplace is set/changed,
    // automatically sync the trainee's station-${id} geofence zone directly to the HTE workplace!
    if (updatedEmployee && (data.companyName || data.hteId || data.companyAddress || data.registrationLocation)) {
      const isStudent =
        !updatedEmployee.position?.toLowerCase().includes('instructor') &&
        !updatedEmployee.position?.toLowerCase().includes('hte') &&
        updatedEmployee.role !== 'hte' &&
        updatedEmployee.role !== 'admin';

      if (isStudent && updatedEmployee.companyName && !updatedEmployee.companyName.toLowerCase().includes('pending')) {
        let hteCoords = updatedEmployee.registrationLocation;
        let hteAddress = updatedEmployee.companyAddress || updatedEmployee.registrationAddress || `${updatedEmployee.companyName} Workplace Premises`;
        let hteRadius = Math.max(40, Number(updatedEmployee.registrationRadius || (hteCoords as any)?.radius || 40));

        if (!hteCoords || !hteCoords.lat || !hteCoords.lng) {
          const matchedHost = hostSupervisors.find(
            (h) => (updatedEmployee.hteId && (h.id === updatedEmployee.hteId || h.employeeId === updatedEmployee.hteId)) ||
                   (h.companyName && h.companyName.trim().toLowerCase() === updatedEmployee.companyName?.trim().toLowerCase())
          );
          if (matchedHost?.registrationLocation?.lat && matchedHost?.registrationLocation?.lng) {
            hteCoords = {
              lat: Number(matchedHost.registrationLocation.lat),
              lng: Number(matchedHost.registrationLocation.lng),
            };
            hteAddress = matchedHost.companyAddress || matchedHost.registrationAddress || hteAddress;
            hteRadius = Math.max(40, Number(matchedHost.registrationRadius || (matchedHost.registrationLocation as any)?.radius || 40));
          } else {
            const matchedHteEmp = employees.find(
              (e) => (e.position?.toLowerCase().includes('hte') || e.role === 'hte') &&
                     ((updatedEmployee.hteId && e.id === updatedEmployee.hteId) ||
                      (e.companyName && e.companyName.trim().toLowerCase() === updatedEmployee.companyName?.trim().toLowerCase()))
            );
            if (matchedHteEmp?.registrationLocation?.lat && matchedHteEmp?.registrationLocation?.lng) {
              hteCoords = {
                lat: Number(matchedHteEmp.registrationLocation.lat),
                lng: Number(matchedHteEmp.registrationLocation.lng),
              };
              hteAddress = matchedHteEmp.companyAddress || matchedHteEmp.registrationAddress || hteAddress;
              hteRadius = Math.max(40, Number(matchedHteEmp.registrationRadius || (matchedHteEmp.registrationLocation as any)?.radius || 40));
            }
          }
        }

        if (hteCoords && hteCoords.lat && hteCoords.lng) {
          const stationZoneId = `station-${id}`;
          const stationZone: GeofenceZone = {
            id: stationZoneId,
            name: `${updatedEmployee.name} - Trainee Geofence (${updatedEmployee.companyName})`,
            address: hteAddress,
            lat: Number(hteCoords.lat),
            lng: Number(hteCoords.lng),
            radius: hteRadius,
            active: true,
            academicYear: updatedEmployee.academicYear || settings?.activeAcademicYear,
          };

          setGeofenceZones((prev) => {
            const exists = prev.some((z) => z.id === stationZoneId);
            const updated = exists
              ? prev.map((z) => (z.id === stationZoneId ? { ...z, ...stationZone } : z))
              : [...prev, stationZone];
            if (!useSupabase) {
              saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, updated);
            }
            return updated;
          });

          if (useSupabase) {
            supabase
              .from('geofence_zones')
              .upsert([
                {
                  id: stationZone.id,
                  name: stationZone.name,
                  address: stationZone.address,
                  lat: stationZone.lat,
                  lng: stationZone.lng,
                  radius: stationZone.radius,
                  active: stationZone.active,
                  academic_year: stationZone.academicYear,
                },
              ])
              .then(
                () => {},
                (err: any) => {
                  console.warn('[AppContext] Auto-sync trainee geofence zone error:', err);
                }
              );
          }
        }
      }
    }
  };

  const updateHostSupervisor = (id: string, data: Partial<HostSupervisor>) => {
    const updatedHosts = hostSupervisors.map((h) => (h.id === id || h.employeeId === id ? { ...h, ...data } : h));
    setHostSupervisors(updatedHosts);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, updatedHosts);
    }

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
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, updatedHosts);
    }

    // Erase credentials from storage
    if (targetEmail) {
      const normEmail = normalizeEmail(targetEmail);
      setPasswords((prev) => {
        const next = { ...prev };
        delete next[normEmail];
        delete next[targetEmail.toLowerCase()];
        if (!useSupabase) {
          saveToStorage(STORAGE_KEYS.PASSWORDS, next);
        }
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
    const cleanRecordDate = (recordWithAY.date || getDTRSessionDate(new Date())).split('T')[0].split(' ')[0].trim();
    recordWithAY.date = cleanRecordDate;
    
    // Check if an existing record for this employee and date already exists to preserve permanent timestamps
    const empIdentifier = (recordWithAY.employeeId || '').trim();
    const emp = employees.find(
      (e) =>
        e.id === empIdentifier ||
        e.employeeId === empIdentifier ||
        (e.email && empIdentifier && normalizeEmail(e.email) === normalizeEmail(empIdentifier))
    );
    const validIds = new Set<string>();
    if (empIdentifier) {
      validIds.add(empIdentifier);
      validIds.add(empIdentifier.toLowerCase());
    }
    if (emp) {
      if (emp.id) { validIds.add(emp.id); validIds.add(emp.id.toLowerCase()); }
      if (emp.employeeId) { validIds.add(emp.employeeId); validIds.add(emp.employeeId.toLowerCase()); }
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    if (currentUser) {
      if (currentUser.id) { validIds.add(currentUser.id); validIds.add(currentUser.id.toLowerCase()); }
      if (currentUser.employeeId) { validIds.add(currentUser.employeeId); validIds.add(currentUser.employeeId.toLowerCase()); }
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    const existing = timeRecords.find(
      (r) => {
        const rDate = (r.date || '').split('T')[0].split(' ')[0].trim();
        if (rDate !== cleanRecordDate) return false;
        const rEmpId = (r.employeeId || '').trim();
        return validIds.has(rEmpId) || validIds.has(rEmpId.toLowerCase());
      }
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

    // Synchronously place newRecord into local state and storage so UI and subsequent calls have it immediately
    setTimeRecords((prev) => {
      const updated = [newRecord, ...prev.filter((r) => r.id !== newRecord.id)];
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
      return updated;
    });

    if (useSupabase) {
      supabaseService
        .createTimeRecord(recordWithAY)
        .then((created) => {
          if (created) {
            // Replace temporary local record with database UUID record
            setTimeRecords((prev) => {
              const updated = [created, ...prev.filter((r) => r.id !== newRecord.id && r.id !== created.id)];
              saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
              return updated;
            });
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

    setTimeRecords((prev) => {
      const updated = prev.map((r) => {
        if (r.id === id) {
          const next = { ...r, ...enrichedData };
          if ('timeInPhoto' in data && !data.timeInPhoto) {
            delete (next as any).timeInPhoto;
          }
          if ('timeOutPhoto' in data && !data.timeOutPhoto) {
            delete (next as any).timeOutPhoto;
          }
          return next;
        }
        return r;
      });
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
      return updated;
    });

    if (useSupabase) {
      const targetId = existing?.id || id;
      supabaseService.updateTimeRecord(targetId, enrichedData).catch((err) => {
        console.error('[AppContext] Failed to update time record in Supabase:', err);
      });
    }
  };

  const approveTimeRecord = (id: string, approvedBy?: string) => {
    const previous = timeRecords.find((r) => r.id === id);
    const now = new Date().toISOString();
    const update: Partial<TimeRecord> = {
      employeeId: previous?.employeeId,
      date: previous?.date,
      approvalStatus: 'approved',
      approvedBy: approvedBy || 'Instructor',
      approvedAt: now,
      approvalNote: '',
    };
    setTimeRecords((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, ...update } : r));
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
      return updated;
    });
    if (useSupabase) {
      supabaseService.updateTimeRecord(id, update).catch((err) => {
        console.warn('[AppContext] Supabase approve sync notice:', err);
      });
    }
  };

  const disapproveTimeRecord = (id: string, note?: string) => {
    const previous = timeRecords.find((r) => r.id === id);
    const now = new Date().toISOString();
    const update: Partial<TimeRecord> = {
      employeeId: previous?.employeeId,
      date: previous?.date,
      approvalStatus: 'disapproved',
      approvalNote: note || '',
      approvedAt: now,
    };
    setTimeRecords((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, ...update } : r));
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, updated);
      return updated;
    });
    if (useSupabase) {
      supabaseService.updateTimeRecord(id, update).catch((err) => {
        console.warn('[AppContext] Supabase disapprove sync notice:', err);
      });
    }
  };


  const getTodayRecord = (empIdentifier: string): TimeRecord | null => {
    if (!empIdentifier) return null;
    const rawToday = getDTRSessionDate(new Date());
    const today = rawToday.split('T')[0].split(' ')[0].trim();
    const cleanEmpId = (empIdentifier || '').trim();

    // Find associated employee to resolve all possible IDs
    const emp = employees.find(
      (e) =>
        e.id === cleanEmpId ||
        e.employeeId === cleanEmpId ||
        (e.email && cleanEmpId && normalizeEmail(e.email) === normalizeEmail(cleanEmpId))
    );

    const validIds = new Set<string>();
    validIds.add(cleanEmpId);
    validIds.add(cleanEmpId.toLowerCase());
    if (emp) {
      if (emp.id) { validIds.add(emp.id); validIds.add(emp.id.toLowerCase()); }
      if (emp.employeeId) { validIds.add(emp.employeeId); validIds.add(emp.employeeId.toLowerCase()); }
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    if (currentUser) {
      if (currentUser.id) { validIds.add(currentUser.id); validIds.add(currentUser.id.toLowerCase()); }
      if (currentUser.employeeId) { validIds.add(currentUser.employeeId); validIds.add(currentUser.employeeId.toLowerCase()); }
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    const todayRecords = timeRecords.filter((r) => {
      const rDate = (r.date || '').split('T')[0].split(' ')[0].trim();
      if (rDate !== today) return false;
      const rEmpId = (r.employeeId || '').trim();
      if (validIds.has(rEmpId) || validIds.has(rEmpId.toLowerCase())) return true;
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
    const cleanEmpId = (empIdentifier || '').trim();
    const emp = employees.find(
      (e) =>
        e.id === cleanEmpId ||
        e.employeeId === cleanEmpId ||
        (e.email && cleanEmpId && normalizeEmail(e.email) === normalizeEmail(cleanEmpId))
    );

    const validIds = new Set<string>();
    validIds.add(cleanEmpId);
    validIds.add(cleanEmpId.toLowerCase());
    if (emp) {
      if (emp.id) { validIds.add(emp.id); validIds.add(emp.id.toLowerCase()); }
      if (emp.employeeId) { validIds.add(emp.employeeId); validIds.add(emp.employeeId.toLowerCase()); }
      if (emp.email) validIds.add(emp.email.toLowerCase());
    }
    if (currentUser) {
      if (currentUser.id) { validIds.add(currentUser.id); validIds.add(currentUser.id.toLowerCase()); }
      if (currentUser.employeeId) { validIds.add(currentUser.employeeId); validIds.add(currentUser.employeeId.toLowerCase()); }
      if (currentUser.email) validIds.add(currentUser.email.toLowerCase());
    }

    return timeRecords
      .filter((r) => {
        const rEmpId = (r.employeeId || '').trim();
        return validIds.has(rEmpId) || validIds.has(rEmpId.toLowerCase());
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  };

  const updateGeofenceZones = (zones: GeofenceZone[]) => {
    const sanitized = sanitizeGeofenceZones(zones);
    setGeofenceZones(sanitized);
  };

  const addGeofenceZone = (zone: Omit<GeofenceZone, 'id'> & { id?: string }) => {
    const zoneWithAY = { ...zone, academicYear: (zone as any).academicYear || settings.activeAcademicYear };
    const tempId = zone.id || `zone-${Date.now()}`;
    const newZone = sanitizeGeofenceZone({ ...zoneWithAY, id: tempId });
    if (!newZone) return;

    setGeofenceZones((prev) => [...prev.filter((z) => z.id !== newZone.id), newZone]);

    if (useSupabase) {
      supabaseService
        .createGeofenceZone({ ...zoneWithAY, id: newZone.id })
        .then((created) => {
          const sanitizedCreated = sanitizeGeofenceZone(created || newZone);
          if (sanitizedCreated) {
            setGeofenceZones((prev) => [...prev.filter((z) => z.id !== tempId && z.id !== sanitizedCreated.id), sanitizedCreated]);
          }
        })
        .catch((err) => {
          console.error('[AppContext] Failed to create geofence zone in Supabase:', err);
          setGeofenceZones((prev) => prev.filter((z) => z.id !== tempId));
          alert('Failed to save geofence zone to cloud. Please try again.');
        });
    }
  };

  const updateGeofenceZone = (id: string, data: Partial<GeofenceZone>) => {
    const previous = geofenceZones.find((z) => z.id === id);
    setGeofenceZones((prev) => {
      const next = prev.map((z) => {
        if (z.id !== id) return z;
        const merged = sanitizeGeofenceZone({ ...z, ...data });
        return merged || z;
      });
      saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, next);
      return next;
    });

    if (useSupabase) {
      supabaseService.updateGeofenceZone(id, data).catch((err) => {
        console.error('[AppContext] Failed to update geofence zone in Supabase:', err);
        if (previous) {
          setGeofenceZones((prev) => {
            const restored = prev.map((z) => (z.id === id ? previous : z));
            saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, restored);
            return restored;
          });
        }
        alert('Failed to save geofence zone update to cloud. Changes have been rolled back.');
      });
    }
  };

  const deleteGeofenceZone = (id: string) => {
    const previousZones = geofenceZones;
    // 1. Remove from local geofenceZones state and storage
    setGeofenceZones((prev) => {
      const filtered = prev.filter((z) => z.id !== id && z.id !== `personal-${id}`);
      saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, filtered);
      return filtered;
    });

    // 2. Identify associated employee and clear their registration coordinates
    let matchedEmpId = id.startsWith('personal-') ? id.replace('personal-', '') : id;
    const targetZone = geofenceZones.find((z) => z.id === id);
    if (targetZone) {
      const personPrefix = targetZone.name?.includes(' - ')
        ? targetZone.name.split(' - ')[0].trim().toLowerCase()
        : targetZone.name.toLowerCase();
      const matchedEmp = employees.find(
        (e) => e.id === matchedEmpId || (e.name && e.name.toLowerCase() === personPrefix)
      );
      if (matchedEmp) {
        matchedEmpId = matchedEmp.id;
      }
    }

    const empToUpdate = employees.find((e) => e.id === matchedEmpId || e.id === id || `personal-${e.id}` === id);
    if (empToUpdate) {
      updateEmployee(empToUpdate.id, {
        registrationLocation: null as any,
        registrationAddress: null as any,
      });
    }

    // 3. Always delete from Supabase database
    if (useSupabase) {
      supabaseService.deleteGeofenceZone(id).catch((err) => {
        console.error('[AppContext] Failed to delete geofence zone in Supabase:', err);
        setGeofenceZones(previousZones);
        saveToStorage(STORAGE_KEYS.GEOFENCE_ZONES, previousZones);
        alert('Failed to delete geofence zone from cloud. Item has been restored.');
      });
      if (matchedEmpId && matchedEmpId !== id) {
        supabaseService.deleteGeofenceZone(matchedEmpId).catch(() => {});
      }
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const previous = settings;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    if (useSupabase) {
      supabaseService.updateSettings(updated).catch((err) => {
        console.error('[AppContext] Failed to update settings in Supabase:', err);
        setSettings(previous);
        alert('Failed to save settings to cloud. Changes have been rolled back.');
      });
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

    if (employee) {
      if (!employee.photo && currentUser.photo) {
        employee = { ...employee, photo: currentUser.photo };
      }
      return employee;
    }

    // Check host supervisors if current user is an HTE supervisor
    const host = hostSupervisors.find(
      (h) =>
        h.id === currentUser.id ||
        (h.employeeId && (h.employeeId === currentUser.employeeId || h.employeeId === currentUser.id)) ||
        (currentUser.email && h.email ? normalizeEmail(h.email) === normalizeEmail(currentUser.email) : false)
    );

    if (host) {
      const fallbackHostPhoto = host.photo || currentUser.photo || (employees.find(e => e.email && normalizeEmail(e.email) === normalizeEmail(currentUser.email))?.photo) || '';
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
        photo: fallbackHostPhoto,
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
      const fallbackAdminPhoto = currentUser.photo || (employees.find(e => e.email && normalizeEmail(e.email) === normalizeEmail(currentUser.email))?.photo) || '';
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
        photo: fallbackAdminPhoto,
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
    const tempId = `eval-${Date.now()}`;
    const newEval: Evaluation = { ...data, id: tempId };

    setEvaluations((prev) => {
      const existingIdx = prev.findIndex(
        (e) => (data.employeeId && e.employeeId === data.employeeId) || e.id === tempId
      );
      let updated: Evaluation[];
      if (existingIdx >= 0) {
        updated = prev.map((e, idx) => (idx === existingIdx ? { ...e, ...data } : e));
      } else {
        updated = [newEval, ...prev];
      }
      saveToStorage(STORAGE_KEYS.EVALUATIONS, updated);
      return updated;
    });

    if (useSupabase) {
      supabaseService
        .createEvaluation(data)
        .then((created) => {
          if (created) {
            setEvaluations((prev) => {
              const updated = [created, ...prev.filter((e) => e.id !== tempId && e.id !== created.id && (data.employeeId ? e.employeeId !== data.employeeId : true))];
              saveToStorage(STORAGE_KEYS.EVALUATIONS, updated);
              return updated;
            });
          }
        })
        .catch((err) => {
          console.error('[AppContext] Failed to save evaluation to Supabase:', err);
          // Preserve local storage so user responses are NEVER lost!
          toast.error('Cloud synchronization delayed: responses are saved locally on your device.');
        });
    }

    return newEval;
  };

  const updateEvaluation = (id: string, data: Partial<Evaluation>) => {
    const previous = evaluations.find((e) => e.id === id || (data.employeeId && e.employeeId === data.employeeId));
    const targetId = previous ? previous.id : id;

    setEvaluations((prev) => {
      const updated = prev.map((e) => (e.id === targetId || (data.employeeId && e.employeeId === data.employeeId) ? { ...e, ...data } : e));
      saveToStorage(STORAGE_KEYS.EVALUATIONS, updated);
      return updated;
    });

    if (useSupabase) {
      const resolvedEmployeeId = data.employeeId || previous?.employeeId;
      supabaseService.updateEvaluation(targetId, { ...data, employeeId: resolvedEmployeeId }).catch((err) => {
        console.error('[AppContext] Failed to update evaluation in Supabase:', err);
        // Preserve local state so responses are NEVER lost!
        toast.error('Cloud synchronization delayed: changes are saved locally on your device.');
      });
    }
  };

  const deleteEvaluation = (id: string) => {
    const previous = evaluations.find((e) => e.id === id);
    setEvaluations((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      saveToStorage(STORAGE_KEYS.EVALUATIONS, updated);
      return updated;
    });

    if (useSupabase) {
      supabaseService.deleteEvaluation(id).catch((err) => {
        console.error('[AppContext] Failed to delete evaluation in Supabase:', err);
        if (previous) {
          setEvaluations((prev) => {
            const rolledBack = [previous, ...prev];
            saveToStorage(STORAGE_KEYS.EVALUATIONS, rolledBack);
            return rolledBack;
          });
        }
        alert('Failed to delete evaluation from cloud. Item has been restored.');
      });
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

            // Background Fire-and-Forget Email Notification
            (async () => {
              try {
                const target = created.targetRole || 'all';
                const recipientEmails = employees
                  .filter((emp) => {
                    if (!emp.email || !emp.email.includes('@')) return false;
                    if (target === 'all') return true;
                    const isInst = emp.position === 'OJT Instructor' || emp.role === 'admin';
                    const isHte = emp.position === 'HTE Representative' || emp.role === 'host' || emp.role === 'hte';
                    const isTrainee = !isInst && !isHte;
                    if (target === 'employee') return isTrainee;
                    if (target === 'hte' || target === 'host') return isHte;
                    if (target === 'admin') return isInst;
                    return false;
                  })
                  .map((emp) => emp.email.trim().toLowerCase());

                const uniqueEmails = Array.from(new Set(recipientEmails));
                if (uniqueEmails.length === 0) return;

                const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
                const snippet = created.content.length > 180
                  ? `${created.content.slice(0, 180)}...`
                  : created.content;

                const emailHtml = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
                    <div style="background: #2563eb; padding: 18px 24px; border-radius: 12px 12px 0 0; color: white;">
                      <h2 style="margin: 0; font-size: 20px;">New System Announcement</h2>
                      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">OJT Management System</p>
                    </div>
                    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px; background: #ffffff;">
                      <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">${created.title}</h3>
                      <p style="color: #475569; font-size: 15px; margin-bottom: 24px;">${snippet}</p>
                      ${appUrl ? `<a href="${appUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 14px;">View Announcement in App &rarr;</a>` : ''}
                      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;" />
                      <p style="font-size: 12px; color: #94a3b8; margin: 0;">This is an automated notification. Please do not reply directly to this email.</p>
                    </div>
                  </div>
                `;

                const { error: fnError } = await supabase.functions.invoke('send-email', {
                  body: {
                    to: uniqueEmails,
                    subject: `[OJT Announcement] ${created.title}`,
                    html: emailHtml,
                  },
                });

                if (fnError) {
                  console.warn('Background announcement email delivery failed:', fnError);
                }
              } catch (emailErr) {
                console.warn('Background announcement email notification error:', emailErr);
              }
            })();
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
    // 1. Fetch any specific custom documents added by admin for this employee or all employees
    const assignedDocs = requiredDocuments.filter(
      (doc) =>
        (doc.employeeId === employeeId || doc.employeeId === 'all') &&
        (!doc.academicYear || doc.academicYear === settings.activeAcademicYear)
    );

    // 2. Standard mandatory institutional OJT checklist documents
    const standardDocs: RequiredDocument[] = DEFAULT_OJT_REQUIRED_DOCUMENTS.map((d, index) => ({
      id: `req-${d.docKey || index + 1}-${employeeId}`,
      employeeId,
      title: d.title,
      description: d.description,
      notes: d.notes,
      dueDate: d.dueDate,
      required: d.required,
      academicYear: settings.activeAcademicYear,
      createdAt: new Date().toISOString(),
    }));

    // Merge: custom assigned documents take priority over duplicate titles
    const combined = [...assignedDocs];
    for (const std of standardDocs) {
      const alreadyExists = combined.some(
        (c) => c.title.toLowerCase().trim() === std.title.toLowerCase().trim()
      );
      if (!alreadyExists) {
        combined.push(std);
      }
    }

    return combined;
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
        saved = {
          ...existing,
          note: notes,
          notes,
          fileName: payload.fileName || '',
          fileUrl: payload.fileUrl || '',
          submittedAt: now,
          status: 'submitted',
        };
        return prev.map((s) => (s.id === existing.id ? saved : s));
      }
      return [saved, ...prev];
    });

    // Also sync to employee.submittedDocuments
    const lowerDoc = documentId.toLowerCase();
    let docKey: keyof TraineeDocuments | null = null;
    if (lowerDoc.includes('endorsement')) docKey = 'endorsement';
    else if (lowerDoc.includes('consent')) docKey = 'consent';
    else if (lowerDoc.includes('medical')) docKey = 'medical';
    else if (lowerDoc.includes('resume')) docKey = 'resume';

    if (docKey) {
      const currentEmp = employees.find((e) => e.id === employeeId) || getCurrentEmployee();
      if (currentEmp) {
        updateEmployee(employeeId, {
          submittedDocuments: {
            ...(currentEmp.submittedDocuments || {}),
            [docKey]: {
              name: payload.fileName || 'Uploaded Document.pdf',
              dataUrl: payload.fileUrl || '',
              uploadedAt: now,
              status: 'passed' as const,
            },
          } as TraineeDocuments,
        });
      }
    }

    return saved;
  };

  const getRequiredDocumentSubmission = (documentId: string, employeeId: string): RequiredDocumentSubmission | null => {
    // 1. Direct match in requiredDocumentSubmissions
    const existing = requiredDocumentSubmissions.find(
      (s) =>
        (s.documentId === documentId || documentId.includes(s.documentId) || s.documentId.includes(documentId)) &&
        s.employeeId === employeeId
    );
    if (existing) return existing;

    // 2. Trainee submittedDocuments fallback
    const emp =
      employees.find((e) => e.id === employeeId) ||
      (getCurrentEmployee()?.id === employeeId ? getCurrentEmployee() : null);
    if (emp?.submittedDocuments) {
      let matchedDocItem: TraineeDocumentItem | undefined = undefined;
      const lowerDoc = documentId.toLowerCase();
      if (lowerDoc.includes('pledge') || lowerDoc.includes('conduct') || lowerDoc.includes('doc-1')) {
        matchedDocItem = emp.submittedDocuments.pledgeOfConduct;
      } else if (lowerDoc.includes('medical') || lowerDoc.includes('doc-2')) {
        matchedDocItem = emp.submittedDocuments.medical;
      } else if (lowerDoc.includes('enrolment') || lowerDoc.includes('enrollment') || lowerDoc.includes('cor') || lowerDoc.includes('doc-3')) {
        matchedDocItem = emp.submittedDocuments.enrolmentForm;
      } else if (lowerDoc.includes('consent') || lowerDoc.includes('waiver') || lowerDoc.includes('parental') || lowerDoc.includes('doc-4')) {
        matchedDocItem = emp.submittedDocuments.consent;
      } else if (lowerDoc.includes('resume') || lowerDoc.includes('biodata') || lowerDoc.includes('bio-data') || lowerDoc.includes('cv') || lowerDoc.includes('doc-5')) {
        matchedDocItem = emp.submittedDocuments.resume;
      } else if (lowerDoc.includes('duties') || lowerDoc.includes('responsibilities') || lowerDoc.includes('bsis') || lowerDoc.includes('doc-6')) {
        matchedDocItem = emp.submittedDocuments.dutiesAndResponsibilities;
      } else if (lowerDoc.includes('moa') || lowerDoc.includes('memorandum') || lowerDoc.includes('doc-7')) {
        matchedDocItem = emp.submittedDocuments.moa;
      } else if (lowerDoc.includes('internship') || lowerDoc.includes('agreement') || lowerDoc.includes('contract') || lowerDoc.includes('doc-8')) {
        matchedDocItem = emp.submittedDocuments.internshipAgreement;
      } else if ((lowerDoc.includes('evaluation') && lowerDoc.includes('report')) || lowerDoc.includes('doc-10')) {
        matchedDocItem = emp.submittedDocuments.evaluationReport;
      } else if (lowerDoc.includes('evaluation') || lowerDoc.includes('appraisal') || lowerDoc.includes('doc-9')) {
        matchedDocItem = emp.submittedDocuments.evaluationForm;
      } else if (lowerDoc.includes('endorsement')) {
        matchedDocItem = emp.submittedDocuments.endorsement;
      } else {
        // Direct key lookup
        matchedDocItem = (emp.submittedDocuments as any)[documentId];
      }

      if (matchedDocItem && (matchedDocItem.dataUrl || matchedDocItem.name)) {
        return {
          id: `sub-auto-${documentId}`,
          documentId,
          employeeId,
          submittedAt: matchedDocItem.uploadedAt || new Date().toISOString(),
          fileName: matchedDocItem.name || 'Submitted Document.pdf',
          fileUrl: matchedDocItem.dataUrl || '',
          note: `Verified (${matchedDocItem.status || 'passed'})`,
          status: 'approved',
          verificationStatus: 'passed',
        };
      }
    }

    return null;
  };

  // ── Host Feedback ─────────────────────────────────────────────────────────────
  const addHostFeedback = (
    data: Omit<HostFeedback, 'id' | 'overallScore' | 'submittedAt' | 'status'>
  ): HostFeedback => {
    const totalScore =
      data.attendanceScore + data.performanceScore + data.attitudeScore + data.communicationScore + data.teamworkScore;
    const overallScore = Math.round(totalScore / 5);
    const tempId = `hf-${Date.now()}`;

    const newFeedback: HostFeedback = {
      ...data,
      hostEmail: data.hostEmail || 'hte@chmsu.edu.ph',
      academicYear: (data as any).academicYear || settings.activeAcademicYear,
      id: tempId,
      overallScore,
      submittedAt: new Date().toISOString(),
      status: 'submitted',
    };

    setHostFeedback((prev) => [newFeedback, ...prev]);

    if (useSupabase) {
      supabaseService
        .createHostFeedback(newFeedback)
        .then((created) => {
          if (created) {
            setHostFeedback((prev) => [created, ...prev.filter((f) => f.id !== tempId && f.id !== created.id)]);
          }
        })
        .catch((err) => {
          console.error('[AppContext] Failed to save host feedback to Supabase:', err);
          setHostFeedback((prev) => prev.filter((f) => f.id !== tempId));
        });
    }

    // Auto-sync into evaluations table so Instructor and Trainee see the evaluation in real-time
    const existingEval = evaluations.find((e) => e.employeeId === data.employeeId);
    const grade: 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Needs Improvement' =
      overallScore >= 90 ? 'Excellent' :
        overallScore >= 80 ? 'Very Good' :
          overallScore >= 70 ? 'Good' :
            overallScore >= 60 ? 'Satisfactory' : 'Needs Improvement';

    if (existingEval) {
      updateEvaluation(existingEval.id, {
        evaluatedBy: data.hostName + (data.hostCompany ? ` (${data.hostCompany})` : ' [HTE Supervisor]'),
        attendanceScore: data.attendanceScore,
        performanceScore: data.performanceScore,
        attitudeScore: data.attitudeScore,
        punctualityScore: data.teamworkScore || data.attendanceScore,
        communicationScore: data.communicationScore,
        overallScore: overallScore,
        grade: grade,
        strengths: data.strengths || existingEval.strengths,
        areasForImprovement: data.areasForImprovement || existingEval.areasForImprovement,
        recommendations: data.recommendation || existingEval.recommendations,
      });
    } else {
      addEvaluation({
        employeeId: data.employeeId,
        evaluatedBy: data.hostName + (data.hostCompany ? ` (${data.hostCompany})` : ' [HTE Supervisor]'),
        attendanceScore: data.attendanceScore,
        performanceScore: data.performanceScore,
        attitudeScore: data.attitudeScore,
        punctualityScore: data.teamworkScore || data.attendanceScore,
        communicationScore: data.communicationScore,
        overallScore: overallScore,
        grade: grade,
        strengths: data.strengths || 'Consistent performance and dedicated engagement.',
        areasForImprovement: data.areasForImprovement || 'Continue developing technical problem-solving skills.',
        recommendations: data.recommendation || 'Recommended for completion.',
        evaluatedAt: new Date().toISOString(),
        status: 'submitted_to_instructor',
        academicYear: (data as any).academicYear || settings.activeAcademicYear,
      });
    }

    return newFeedback;
  };

  const updateHostFeedback = (id: string, updates: Partial<HostFeedback>) => {
    const previous = hostFeedback.find((f) => f.id === id);
    setHostFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    if (useSupabase) {
      supabaseService.updateHostFeedback(id, updates).catch((err) => {
        console.error('[AppContext] Failed to update host feedback in Supabase:', err);
        if (previous) {
          setHostFeedback((prev) => prev.map((f) => (f.id === id ? previous : f)));
        }
        alert('Failed to save host feedback update to cloud. Changes have been rolled back.');
      });
    }
  };

  const deleteHostFeedback = (id: string) => {
    const previous = hostFeedback.find((f) => f.id === id);
    setHostFeedback((prev) => prev.filter((f) => f.id !== id));
    if (useSupabase) {
      supabaseService.deleteHostFeedback(id).catch((err) => {
        console.error('[AppContext] Failed to delete host feedback in Supabase:', err);
        if (previous) {
          setHostFeedback((prev) => [previous, ...prev]);
        }
        alert('Failed to delete host feedback from cloud. Item has been restored.');
      });
    }
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
    const defaultAY = settings.academicYears?.[0] || '2025-2026';

    // 1. Locate Instructor for this academic year (or system administrator)
    const inst = employees.find(
      (e) =>
        (e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor'))) &&
        (e.academicYear === ay || (!e.academicYear && ay === defaultAY))
    ) || employees.find((e) => e.position === 'OJT Instructor');

    // 2. Locate HTE partners registered for this academic year
    const htePartners = employees.filter(
      (e) =>
        (e.position === 'HTE Representative' || (e.position && e.position.toLowerCase().includes('hte'))) &&
        (e.academicYear === ay || (!e.academicYear && ay === defaultAY))
    );

    // 3. Bidirectionally synchronize Trainees, Instructor, and HTE partners within target academic year
    // CRITICAL: Preserve each Trainee and HTE's registered academic year; accounts stay in their own academic year!
    let updatedLinkages = 0;
    const updatedEmployees = employees.map((emp) => {
      const empAY = emp.academicYear || defaultAY;
      // Only link trainees within this target academic year
      if (empAY !== ay) {
        return emp;
      }

      const isTrainee = emp.position !== 'OJT Instructor' && emp.position !== 'HTE Representative';
      if (!isTrainee) return emp;

      let newInstructorId = emp.instructorId;
      let newHteId = emp.hteId;

      if (!newInstructorId && inst) {
        newInstructorId = inst.id;
      }

      if (!newHteId && emp.companyName && emp.companyName.trim() !== '' && emp.companyName.toLowerCase() !== 'n/a') {
        const comp = emp.companyName.trim().toLowerCase();
        const matchedHte = htePartners.find((h) => h.companyName && h.companyName.trim().toLowerCase() === comp);
        if (matchedHte) {
          newHteId = matchedHte.id;
        }
      }

      if (newInstructorId !== emp.instructorId || newHteId !== emp.hteId) {
        updatedLinkages++;
        return {
          ...emp,
          instructorId: newInstructorId,
          hteId: newHteId,
        };
      }

      return emp;
    });

    setEmployees(updatedEmployees);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
    } else {
      const affected = updatedEmployees.filter((e) => (e.academicYear || defaultAY) === ay);
      if (affected.length > 0) {
        await supabaseService.upsertEmployees(affected).catch(() => {});
      }
    }

    return {
      success: true,
      syncedCount: updatedLinkages,
      message: `Synchronized accounts for Academic Year ${ay}: ${updatedLinkages} trainee linkages established across Instructor and HTE partners. Accounts in other academic years remain safely preserved.`,
    };
  };

  const repairAndPersistDatabase = async (): Promise<{ success: boolean; message: string; repairedCounts: any }> => {
    const activeAY = settings.activeAcademicYear;
    const defaultAY = settings.academicYears?.[0] || '2025-2026';

    // 1. Ensure all employees keep their academicYear and normalized positions
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
        academicYear: e.academicYear || activeAY || defaultAY,
        employeeId,
      };
    });
    setEmployees(fixedEmployees);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, fixedEmployees);
    }

    // 2. Ensure time records have academicYear matching their trainee or active academic year
    const fixedRecords = timeRecords.map((r) => {
      const emp = fixedEmployees.find(
        (e) =>
          e.id === r.employeeId ||
          e.employeeId === r.employeeId ||
          (e.email && r.employeeId && e.email.toLowerCase() === r.employeeId.toLowerCase())
      );
      return {
        ...r,
        academicYear: r.academicYear || emp?.academicYear || activeAY || defaultAY,
      };
    });
    setTimeRecords(fixedRecords);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.TIME_RECORDS, fixedRecords);
    }

    // 3. Ensure evaluations have academicYear matching their trainee or active academic year
    const fixedEvals = evaluations.map((ev) => {
      const emp = fixedEmployees.find(
        (e) =>
          e.id === ev.employeeId ||
          e.employeeId === ev.employeeId ||
          (e.email && ev.employeeId && e.email.toLowerCase() === ev.employeeId.toLowerCase())
      );
      return {
        ...ev,
        academicYear: ev.academicYear || emp?.academicYear || activeAY || defaultAY,
      };
    });
    setEvaluations(fixedEvals);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.EVALUATIONS, fixedEvals);
    }

    // 4. Ensure host feedback has academicYear matching their trainee or active academic year
    const fixedFeedback = hostFeedback.map((hf) => {
      const emp = fixedEmployees.find(
        (e) =>
          e.id === hf.employeeId ||
          e.employeeId === hf.employeeId ||
          (e.email && hf.employeeId && e.email.toLowerCase() === hf.employeeId.toLowerCase())
      );
      return {
        ...hf,
        academicYear: hf.academicYear || emp?.academicYear || activeAY || defaultAY,
      };
    });
    setHostFeedback(fixedFeedback);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.HOST_FEEDBACK, fixedFeedback);
    }

    // 5. Ensure host supervisors preserve their academicYear
    const fixedHosts = hostSupervisors.map((h) => ({
      ...h,
      academicYear: h.academicYear || activeAY || defaultAY,
      active: true,
    }));
    setHostSupervisors(fixedHosts);
    if (!useSupabase) {
      saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, fixedHosts);
    }

    let supabaseResult = { repairedEmployees: 0, repairedRecords: 0 };
    if (useSupabase) {
      await supabaseService.upsertEmployees(fixedEmployees);
      await supabaseService.upsertHostSupervisors(fixedHosts);
      await supabaseService.upsertTimeRecords(fixedRecords);
      supabaseResult = await supabaseService.repairDatabaseData(activeAY);
    }

    return {
      success: true,
      message: 'All data, photos, records, and accounts successfully verified and saved in database for Academic Year ' + activeAY + '.',
      repairedCounts: supabaseResult,
    };
  };

  const approveEmployee = (id: string) => {
    updateEmployee(id, { active: true, approvalStatus: 'approved', applicationStatus: 'approved' });
  };

  const rejectEmployee = (id: string) => {
    deleteEmployee(id);
  };

  const saveMonthlyDttr = useCallback((record: MonthlyDttrRecord) => {
    setMonthlyDttrs((prev) => {
      const targetEmp = (record.employeeId || '').trim().toLowerCase();
      const matchedEmp = employees.find(
        (e) => e.id.toLowerCase() === targetEmp || (e.employeeId && e.employeeId.toLowerCase() === targetEmp)
      );
      const validIds = new Set<string>([targetEmp]);
      if (matchedEmp) {
        if (matchedEmp.id) validIds.add(matchedEmp.id.toLowerCase());
        if (matchedEmp.employeeId) validIds.add(matchedEmp.employeeId.toLowerCase());
      }

      const existingIndex = prev.findIndex(
        (r) =>
          (r.id === record.id || validIds.has((r.employeeId || '').toLowerCase())) &&
          Number(r.year) === Number(record.year) &&
          Number(r.month) === Number(record.month)
      );
      const id = record.id || `${record.employeeId}_${record.year}_${record.month}`;
      const updatedRecord = { ...record, id, updatedAt: new Date().toISOString() };
      let next: MonthlyDttrRecord[];
      if (existingIndex >= 0) {
        next = [...prev];
        next[existingIndex] = { ...next[existingIndex], ...updatedRecord };
      } else {
        next = [...prev, updatedRecord];
      }
      saveToStorage(STORAGE_KEYS.MONTHLY_DTTR, next);
      return next;
    });
  }, [employees]);

  const getMonthlyDttr = useCallback((employeeId: string, year: number, month: number): MonthlyDttrRecord | null => {
    if (!employeeId) return null;
    const targetEmp = employeeId.trim().toLowerCase();
    const matchedEmp = employees.find(
      (e) => e.id.toLowerCase() === targetEmp || (e.employeeId && e.employeeId.toLowerCase() === targetEmp)
    );
    const validIds = new Set<string>([targetEmp]);
    if (matchedEmp) {
      if (matchedEmp.id) validIds.add(matchedEmp.id.toLowerCase());
      if (matchedEmp.employeeId) validIds.add(matchedEmp.employeeId.toLowerCase());
    }

    const found = monthlyDttrs.find(
      (r) =>
        (validIds.has((r.employeeId || '').toLowerCase()) || r.id === `${employeeId}_${year}_${month}`) &&
        Number(r.year) === Number(year) &&
        Number(r.month) === Number(month)
    );
    return found || null;
  }, [monthlyDttrs, employees]);

  const signMonthlyDttr = useCallback((employeeId: string, year: number, month: number, supervisorName: string, supervisorTitle?: string) => {
    setMonthlyDttrs((prev) => {
      const targetEmp = (employeeId || '').trim().toLowerCase();
      const matchedEmp = employees.find(
        (e) => e.id.toLowerCase() === targetEmp || (e.employeeId && e.employeeId.toLowerCase() === targetEmp)
      );
      const validIds = new Set<string>([targetEmp]);
      if (matchedEmp) {
        if (matchedEmp.id) validIds.add(matchedEmp.id.toLowerCase());
        if (matchedEmp.employeeId) validIds.add(matchedEmp.employeeId.toLowerCase());
      }

      const existingIndex = prev.findIndex(
        (r) =>
          (validIds.has((r.employeeId || '').toLowerCase()) || r.id === `${employeeId}_${year}_${month}`) &&
          Number(r.year) === Number(year) &&
          Number(r.month) === Number(month)
      );
      const id = `${employeeId}_${year}_${month}`;
      const updated: MonthlyDttrRecord = {
        id,
        employeeId,
        year: Number(year),
        month: Number(month),
        ...(existingIndex >= 0 ? prev[existingIndex] : {}),
        hteSupervisorName: supervisorName,
        hteSupervisorTitle: supervisorTitle || 'HTE Supervisor',
        hteSignedAt: new Date().toISOString(),
        hteSignatureStatus: 'signed',
        updatedAt: new Date().toISOString(),
      };
      let next: MonthlyDttrRecord[];
      if (existingIndex >= 0) {
        next = [...prev];
        next[existingIndex] = updated;
      } else {
        next = [...prev, updated];
      }
      saveToStorage(STORAGE_KEYS.MONTHLY_DTTR, next);
      return next;
    });
  }, [employees]);

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
        setCurrentUser,
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
        loginWithOAuthUser,
        logout,
        refreshData,
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
        monthlyDttrs,
        saveMonthlyDttr,
        getMonthlyDttr,
        signMonthlyDttr,
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