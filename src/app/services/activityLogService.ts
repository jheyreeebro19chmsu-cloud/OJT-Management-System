/**
 * Activity & System Log History Service
 * Tracks user logins, logouts, clock-ins, document changes, and system events.
 * Persists to localStorage and notifies listeners via custom events.
 */

export type ActivityLogType =
  | 'login'
  | 'logout'
  | 'clock_in'
  | 'clock_out'
  | 'document_upload'
  | 'document_approved'
  | 'document_rejected'
  | 'profile_update'
  | 'system';

export interface ActivityLogEntry {
  id: string;
  timestamp: string; // ISO string
  type: ActivityLogType;
  title: string;
  description: string;
  userId?: string;
  userName?: string;
  userRole?: 'admin' | 'employee' | 'hte' | 'host' | 'instructor' | 'trainee' | string;
  device?: string;
  ipHint?: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'ojt_system_activity_logs';
const MAX_LOGS = 250;
const EVENT_NAME = 'ojt_activity_logged';

function getDeviceDescription(): string {
  if (typeof window === 'undefined' || !navigator) return 'Web Client';
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Desktop';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
}

// Generate sensible initial seed logs if empty
function generateSeedLogs(): ActivityLogEntry[] {
  const now = new Date();
  const makeTime = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();

  return [
    {
      id: 'log-seed-1',
      timestamp: makeTime(12),
      type: 'login',
      title: 'Successful User Authentication',
      description: 'Account authenticated via credentials',
      userName: 'Trainee Student',
      userRole: 'employee',
      device: getDeviceDescription(),
    },
    {
      id: 'log-seed-2',
      timestamp: makeTime(75),
      type: 'clock_in',
      title: 'Time In AM Recorded',
      description: 'AM Arrival stamped with facial verification and geofencing validation',
      userName: 'Trainee Student',
      userRole: 'employee',
      device: getDeviceDescription(),
    },
    {
      id: 'log-seed-3',
      timestamp: makeTime(240),
      type: 'login',
      title: 'Instructor Portal Session Started',
      description: 'Instructor logged in to monitor student attendance and records',
      userName: 'OJT Instructor',
      userRole: 'admin',
      device: getDeviceDescription(),
    },
    {
      id: 'log-seed-4',
      timestamp: makeTime(360),
      type: 'system',
      title: 'System Environment Initialized',
      description: 'Academic Year 2026-2027 environment synchronized with database',
      userRole: 'system',
      device: 'System Engine',
    },
  ];
}

/**
 * Retrieve all activity logs, newest first
 */
export function getActivityLogs(filter?: {
  userId?: string;
  role?: string;
  type?: ActivityLogType;
}): ActivityLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: ActivityLogEntry[] = [];
    if (!raw) {
      list = generateSeedLogs();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } else {
      list = JSON.parse(raw);
    }

    if (!Array.isArray(list)) list = [];

    if (filter) {
      return list.filter((item) => {
        if (filter.userId && item.userId && item.userId !== filter.userId) return false;
        if (filter.role && item.userRole && item.userRole !== filter.role) return false;
        if (filter.type && item.type !== filter.type) return false;
        return true;
      });
    }

    return list;
  } catch (err) {
    console.warn('Failed reading activity logs:', err);
    return [];
  }
}

/**
 * Log a new activity event
 */
export function logActivity(
  entry: Omit<ActivityLogEntry, 'id' | 'timestamp'> & { timestamp?: string }
): ActivityLogEntry {
  const newEntry: ActivityLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    device: entry.device || getDeviceDescription(),
    ...entry,
  };

  try {
    const existing = getActivityLogs();
    const updated = [newEntry, ...existing].slice(0, MAX_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Dispatch event so all open UI components update in real-time
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: newEntry }));
    }
  } catch (err) {
    console.warn('Failed saving activity log:', err);
  }

  return newEntry;
}

/**
 * Clear all activity logs
 */
export function clearActivityLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
    }
  } catch (err) {
    console.warn('Failed clearing activity logs:', err);
  }
}

/**
 * Listen for new activity events
 */
export function onActivityLog(callback: (entry: ActivityLogEntry | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (evt: Event) => {
    const custom = evt as CustomEvent<ActivityLogEntry | null>;
    callback(custom.detail);
  };

  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
  };
}
