import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { isSupabaseConfigured } from '../lib/supabase';
import * as supabaseService from '../services/supabaseService';
import {
  Employee,
  TimeRecord,
  GeofenceZone,
  AppSettings,
  User,
  Evaluation,
  Announcement,
  AnnouncementSubmission,
  HostFeedback,
  HostSupervisor,
} from '../types';

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
};

const DEFAULT_GEOFENCE: GeofenceZone[] = [
  {
    id: 'zone-1',
    name: 'Main Training Center',
    address: 'Ayala Avenue, Makati City, Metro Manila',
    lat: 14.5547,
    lng: 121.0244,
    radius: 300,
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
  hostFeedback: HostFeedback[];
  hostSupervisors: HostSupervisor[];
  login: (email: string, password: string) => User | null;
  logout: () => void;
  changeCurrentUserPassword: (currentPassword: string, newPassword: string) => { success: boolean; message: string };
  registerEmployee: (data: RegisterEmployeeInput) => Employee;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addTimeRecord: (record: Omit<TimeRecord, 'id'>) => TimeRecord;
  updateTimeRecord: (id: string, data: Partial<TimeRecord>) => void;
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
  getActiveAnnouncements: (role?: 'employee' | 'admin') => Announcement[];
  submitAnnouncementResponse: (
    announcementId: string,
    employeeId: string,
    message: string,
    photo?: string
  ) => AnnouncementSubmission;
  getAnnouncementSubmission: (announcementId: string, employeeId: string) => AnnouncementSubmission | null;
  getAnnouncementSubmissionStatus: (announcement: Announcement, employeeId: string) => 'passed' | 'missed' | 'pending';
  // Host Feedback
  addHostFeedback: (data: Omit<HostFeedback, 'id' | 'overallScore' | 'submittedAt' | 'status'>) => HostFeedback;
  updateHostFeedback: (id: string, data: Partial<HostFeedback>) => void;
  deleteHostFeedback: (id: string) => void;
  getEmployeeHostFeedback: (employeeId: string) => HostFeedback[];
  getLatestHostFeedback: (employeeId: string) => HostFeedback | null;
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
  const radius = Number(raw.radius);
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
  const [settings, setSettings] = useState<AppSettings>(() => loadFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS));
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
          ] = await Promise.all([
            supabaseService.fetchEmployees(),
            supabaseService.fetchTimeRecords(),
            supabaseService.fetchGeofenceZones(),
            supabaseService.fetchSettings(),
            supabaseService.fetchEvaluations(),
            supabaseService.fetchAnnouncements(),
          ]);

          if (!isMounted) return;

          if (supabaseEmployees.length > 0) setEmployees(supabaseEmployees);
          if (supabaseRecords.length > 0) setTimeRecords(supabaseRecords);
          const sanitizedSupabaseZones = sanitizeGeofenceZones(supabaseZones);
          if (sanitizedSupabaseZones.length > 0) setGeofenceZones(sanitizedSupabaseZones);
          if (supabaseSettings) setSettings(supabaseSettings);
          if (supabaseEvaluations.length > 0) setEvaluations(supabaseEvaluations);
          if (supabaseAnnouncements.length > 0) setAnnouncements(supabaseAnnouncements);
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
    saveToStorage(STORAGE_KEYS.HOST_SUPERVISORS, hostSupervisors);
  }, [hostSupervisors]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.HOST_FEEDBACK, hostFeedback);
  }, [hostFeedback]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PASSWORDS, passwords);
  }, [passwords]);

  const setPasswordForEmail = (email: string, password: string) => {
    setPasswords((prev) => ({ ...prev, [normalizeEmail(email)]: password }));
  };

  const login = (email: string, password: string): User | null => {
    const normalizedEmail = normalizeEmail(email);
    const emp = employees.find((e) => normalizeEmail(e.email) === normalizedEmail && e.active);
    if (emp) {
      const storedPassword = passwords[normalizedEmail];
      const fallbackPassword = emp.position === 'OJT Instructor' ? 'admin123' : 'ojt2024';
      if (password === (storedPassword || fallbackPassword)) {
        const role: User['role'] = emp.position === 'OJT Instructor' ? 'admin' : 'employee';
        const user: User = { id: emp.id, name: emp.name, role, employeeId: emp.id };
        setCurrentUser(user);
        return user;
      }
      return null;
    }

    const host = hostSupervisors.find((h) => normalizeEmail(h.email) === normalizedEmail && h.active);
    if (host) {
      const storedPassword = passwords[normalizedEmail];
      if (password === storedPassword) {
        const user: User = { id: host.id, name: host.name, role: 'host' };
        setCurrentUser(user);
        return user;
      }
      return null;
    }

    if (normalizedEmail === 'admin@ojt.com' && password === 'admin123') {
      const user: User = { id: 'admin', name: 'OJT Instructor', role: 'admin' };
      setCurrentUser(user);
      return user;
    }
    return null;
  };

  const logout = () => setCurrentUser(null);

  const getCurrentUserEmail = (): string | null => {
    if (!currentUser) return null;
    if (currentUser.role === 'host') {
      const host = hostSupervisors.find((h) => h.id === currentUser.id);
      return host ? normalizeEmail(host.email) : null;
    }
    const employee = employees.find((e) => e.id === currentUser.employeeId || e.id === currentUser.id);
    return employee ? normalizeEmail(employee.email) : null;
  };

  const changeCurrentUserPassword = (
    currentPassword: string,
    newPassword: string
  ): { success: boolean; message: string } => {
    const email = getCurrentUserEmail();
    if (!email) return { success: false, message: 'Current account not found.' };
    const account = employees.find((e) => normalizeEmail(e.email) === email);
    const fallbackPassword = account?.position === 'OJT Instructor' ? 'admin123' : 'ojt2024';
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
    return { success: true, message: 'Password updated successfully.' };
  };

  const registerEmployee = (data: RegisterEmployeeInput): Employee => {
    const { password, ...employeeData } = data;
    if (password) {
      setPasswordForEmail(employeeData.email, password);
    }
    const newEmp: Employee = {
      ...employeeData,
      id: `emp-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (useSupabase) {
      supabaseService.createEmployee(employeeData).then((created) => {
        if (created) {
          setEmployees((prev) => [created, ...prev]);
        }
      });
    } else {
      setEmployees((prev) => [...prev, newEmp]);
    }

    return newEmp;
  };

  const updateEmployee = (id: string, data: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));

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
    const newRecord: TimeRecord = { ...record, id: `rec-${Date.now()}` };

    if (useSupabase) {
      supabaseService.createTimeRecord(record).then((created) => {
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

  const getTodayRecord = (employeeId: string): TimeRecord | null => {
    const today = new Date().toISOString().split('T')[0];
    return timeRecords.find((r) => r.employeeId === employeeId && r.date === today) || null;
  };

  const getEmployeeRecords = (employeeId: string): TimeRecord[] => {
    return timeRecords.filter((r) => r.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date));
  };

  const updateGeofenceZones = (zones: GeofenceZone[]) => {
    const sanitized = sanitizeGeofenceZones(zones);
    setGeofenceZones(sanitized);
  };

  const addGeofenceZone = (zone: Omit<GeofenceZone, 'id'>) => {
    const newZone = sanitizeGeofenceZone({ ...zone, id: `zone-${Date.now()}` });
    if (!newZone) return;

    if (useSupabase) {
      supabaseService.createGeofenceZone(zone).then((created) => {
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
    if (!currentUser?.employeeId) return null;
    return employees.find((e) => e.id === currentUser.employeeId) || null;
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
    const newAnn: Announcement = { ...data, id: `ann-${Date.now()}` };

    if (useSupabase) {
      supabaseService.createAnnouncement(data).then((created) => {
        if (created) {
          setAnnouncements((prev) => [created, ...prev]);
        }
      });
    } else {
      setAnnouncements((prev) => [...prev, newAnn]);
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

  const getActiveAnnouncements = (role?: 'employee' | 'admin'): Announcement[] => {
    const now = new Date();
    return announcements
      .filter((a) => {
        if (a.expiresAt && new Date(a.expiresAt) < now) return false;
        if (role && a.targetRole !== 'all' && a.targetRole !== role) return false;
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

  // ── Host Feedback ─────────────────────────────────────────────────────────────
  const addHostFeedback = (
    data: Omit<HostFeedback, 'id' | 'overallScore' | 'submittedAt' | 'status'>
  ): HostFeedback => {
    const totalScore =
      data.attendanceScore + data.performanceScore + data.attitudeScore + data.communicationScore + data.teamworkScore;
    const overallScore = Math.round(totalScore / 5);

    const newFeedback: HostFeedback = {
      ...data,
      id: `hf-${Date.now()}`,
      overallScore,
      submittedAt: new Date().toISOString(),
      status: 'submitted',
    };

    setHostFeedback((prev) => [newFeedback, ...prev]);
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

  return (
    <AppContext.Provider
      value={{
        currentUser,
        employees,
        timeRecords,
        geofenceZones,
        settings,
        evaluations,
        announcements,
        announcementSubmissions,
        hostFeedback,
        hostSupervisors,
        login,
        logout,
        changeCurrentUserPassword,
        registerEmployee,
        updateEmployee,
        deleteEmployee,
        addTimeRecord,
        updateTimeRecord,
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
        addHostFeedback,
        updateHostFeedback,
        deleteHostFeedback,
        getEmployeeHostFeedback,
        getLatestHostFeedback,
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
