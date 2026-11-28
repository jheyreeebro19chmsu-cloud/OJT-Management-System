import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Employee, TimeRecord, GeofenceZone, AppSettings, Evaluation, EvaluationQuestionnaire, Announcement, HostFeedback, AnnouncementSubmission, AnnouncementComment, HostSupervisor, RequiredDocument, MonitoringReport, MonthlyDttrRecord, TraineeDocuments, TraineeDocumentItem } from '../types';
import { isWithinNegrosOccidental } from '../utils/geo';
import { formatFileSize } from '../utils/attachmentHelper';
import { TRAINEE_REQUIRED_HOURS } from '../data/ojtConstants';

// ─── Database Types ──────────────────────────────────────────────────────────

interface SupabaseEmployee extends Omit<Employee, 'registrationLocation'> {
  registration_lat?: number;
  registration_lng?: number;
}

interface SupabaseTimeRecord extends Omit<TimeRecord, 'timeInLocation' | 'timeOutLocation'> {
  time_in_lat?: number;
  time_in_lng?: number;
  time_out_lat?: number;
  time_out_lng?: number;
}

// ─── Employees ───────────────────────────────────────────────────────────────

export const EMPLOYEE_CORE_COLUMNS = [
  'id',
  'name',
  'employee_id',
  'email',
  'department',
  'position',
  'company_name',
  'supervisor_name',
  'school_name',
  'campus',
  'course',
  'start_date',
  'end_date',
  'required_hours',
  'photo',
  'face_registered',
  'active',
  'academic_year',
  'registration_lat',
  'registration_lng',
  'registration_address',
  'instructor_id',
  'hte_id',
  'application_status',
  'registration_location',
  'created_at',
].join(',');

let _coreBootstrapInflight: Promise<{
  employees: Employee[];
  hostSupervisors: HostSupervisor[];
  geofenceZones: GeofenceZone[];
  settings: AppSettings | null;
} | null> | null = null;
let _coreBootstrapCache: {
  data: {
    employees: Employee[];
    hostSupervisors: HostSupervisor[];
    geofenceZones: GeofenceZone[];
    settings: AppSettings | null;
  } | null;
  expiresAt: number;
} = { data: null, expiresAt: 0 };

export async function fetchCoreBootstrap(): Promise<{
  employees: Employee[];
  hostSupervisors: HostSupervisor[];
  geofenceZones: GeofenceZone[];
  settings: AppSettings | null;
} | null> {
  if (_coreBootstrapCache.data && _coreBootstrapCache.expiresAt > Date.now()) {
    return _coreBootstrapCache.data;
  }
  if (_coreBootstrapInflight) {
    return _coreBootstrapInflight;
  }

  _coreBootstrapInflight = (async () => {
    try {
      const res = await fetch('/api/employees?includeMeta=1');
      if (res.ok) {
        const raw = await res.json();
        if (raw && typeof raw === 'object' && Array.isArray(raw.employees)) {
          const employees = raw.employees.map(transformSupabaseEmployee);
          const hostSupervisors = Array.isArray(raw.hostSupervisors)
            ? raw.hostSupervisors.map(transformSupabaseHostSupervisor)
            : [];
          const geofenceZones: GeofenceZone[] = Array.isArray(raw.geofenceZones)
            ? raw.geofenceZones
                .filter((zone: any) => !zone.name?.toLowerCase().includes('main training center') && zone.id !== 'zone-1')
                .map((zone: any) => ({
                  id: zone.id,
                  name: zone.name,
                  address: zone.address,
                  lat: Number(zone.lat),
                  lng: Number(zone.lng),
                  radius: Number(zone.radius) || 100,
                  active: zone.active !== false,
                  academicYear: zone.academic_year || undefined,
                  employeeId: zone.employee_id || zone.employeeId || undefined,
                  employee_id: zone.employee_id || zone.employeeId || undefined,
                }))
            : [];
          let settings: AppSettings | null = null;
          if (raw.settings && typeof raw.settings === 'object') {
            const s = raw.settings;
            const resolvedYears = Array.from(
              new Set([
                ...(Array.isArray(s.academic_years) ? s.academic_years : []),
                '2025-2026',
                '2026-2027',
              ])
            );
            settings = {
              workStartTime: s.work_start_time || '08:00',
              workEndTime: s.work_end_time || '17:00',
              lateThresholdMinutes: s.late_threshold_minutes ?? 15,
              geofenceEnabled: s.geofence_enabled !== false,
              facialRecognitionEnabled: s.facial_recognition_enabled !== false,
              academicYears: resolvedYears,
              activeAcademicYear: s.active_academic_year || '2026-2027',
            };
          }
          const out = { employees, hostSupervisors, geofenceZones, settings };
          _coreBootstrapCache = { data: out, expiresAt: Date.now() + 12000 };
          return out;
        }
      }
    } catch {}
    return _coreBootstrapCache.data || null;
  })().finally(() => {
    _coreBootstrapInflight = null;
  });

  return _coreBootstrapInflight;
}

let _storesBootstrapInflight: Promise<{
  traineeDocuments: Record<string, any>;
  requirements: RequiredDocument[];
  monitoringReports: MonitoringReport[];
  evaluations: Evaluation[];
  announcements: Announcement[];
  dttr: { monthlyDttrs: MonthlyDttrRecord[]; timeRecords: TimeRecord[] };
  academicSettings: {
    academicYears?: string[];
    activeAcademicYear?: string;
    academicYearHours?: Record<string, number>;
    updatedAt?: string;
  } | null;
} | null> | null = null;
let _storesBootstrapCache: {
  data: {
    traineeDocuments: Record<string, any>;
    requirements: RequiredDocument[];
    monitoringReports: MonitoringReport[];
    evaluations: Evaluation[];
    announcements: Announcement[];
    dttr: { monthlyDttrs: MonthlyDttrRecord[]; timeRecords: TimeRecord[] };
    academicSettings: {
      academicYears?: string[];
      activeAcademicYear?: string;
      academicYearHours?: Record<string, number>;
      updatedAt?: string;
    } | null;
  } | null;
  expiresAt: number;
} = { data: null, expiresAt: 0 };

export async function fetchBootstrapStores(): Promise<{
  traineeDocuments: Record<string, any>;
  requirements: RequiredDocument[];
  monitoringReports: MonitoringReport[];
  evaluations: Evaluation[];
  announcements: Announcement[];
  dttr: { monthlyDttrs: MonthlyDttrRecord[]; timeRecords: TimeRecord[] };
  academicSettings: {
    academicYears?: string[];
    activeAcademicYear?: string;
    academicYearHours?: Record<string, number>;
    updatedAt?: string;
  } | null;
} | null> {
  if (_storesBootstrapCache.data && _storesBootstrapCache.expiresAt > Date.now()) {
    return _storesBootstrapCache.data;
  }
  if (_storesBootstrapInflight) {
    return _storesBootstrapInflight;
  }

  _storesBootstrapInflight = (async () => {
    try {
      const res = await fetch('/api/documents?action=get-bootstrap-stores');
      if (res.ok) {
        const raw = await res.json();
        if (raw && typeof raw === 'object') {
          const out = {
            traineeDocuments:
              raw.traineeDocuments && typeof raw.traineeDocuments === 'object' && !Array.isArray(raw.traineeDocuments)
                ? raw.traineeDocuments
                : {},
            requirements: Array.isArray(raw.requirements) ? (raw.requirements as RequiredDocument[]) : [],
            monitoringReports: Array.isArray(raw.monitoringReports)
              ? mergeMonitoringReportsList(raw.monitoringReports)
              : [],
            evaluations: Array.isArray(raw.evaluations) ? mergeEvaluationsList(raw.evaluations) : [],
            announcements: Array.isArray(raw.announcements) ? sortAnnouncements(raw.announcements as Announcement[]) : [],
            dttr: {
              monthlyDttrs: Array.isArray(raw.dttr?.monthlyDttrs) ? mergeMonthlyDttrsList(raw.dttr.monthlyDttrs) : [],
              timeRecords: Array.isArray(raw.dttr?.timeRecords) ? raw.dttr.timeRecords : [],
            },
            academicSettings:
              raw.academicSettings && typeof raw.academicSettings === 'object' && !Array.isArray(raw.academicSettings)
                ? raw.academicSettings
                : null,
          };
          _storesBootstrapCache = { data: out, expiresAt: Date.now() + 12000 };
          return out;
        }
      }
    } catch {}
    return _storesBootstrapCache.data || null;
  })().finally(() => {
    _storesBootstrapInflight = null;
  });

  return _storesBootstrapInflight;
}

export async function fetchEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];

  // 1. Primary path: Service role endpoint /api/employees (cached on server; avoids browser PostgREST connection stampedes)
  try {
    const res = await fetch('/api/employees');
    if (res.ok) {
      const apiData = await res.json();
      if (Array.isArray(apiData) && apiData.length > 0) {
        return apiData.map(transformSupabaseEmployee);
      }
    }
  } catch {}

  // 2. Public CDN fallback (`accounts_index.json` — 0 Postgres connections!)
  try {
    const base = (import.meta.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co').replace(/\/$/, '');
    const pubRes = await fetch(`${base}/storage/v1/object/public/face-photos/settings/accounts_index.json`);
    if (pubRes.ok) {
      const parsed = await pubRes.json();
      if (Array.isArray(parsed?.employees) && parsed.employees.length > 0) {
        return parsed.employees.map(transformSupabaseEmployee);
      }
    }
  } catch {}

  return [];
}

// Helper to compress high-resolution mobile photos to lightweight JPEG (~40-80KB)
// Prevents mobile cellular upload timeouts and avoids database payload blowouts
export async function compressBase64Image(base64Data: string, maxDim: number = 600, quality: number = 0.82): Promise<string> {
  if (typeof window === 'undefined' || !base64Data || !base64Data.startsWith('data:image')) {
    return base64Data;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width <= maxDim && height <= maxDim && base64Data.length < 150000) {
            resolve(base64Data);
            return;
          }
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64Data);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(base64Data);
        }
      };
      img.onerror = () => resolve(base64Data);
      img.src = base64Data;
    } catch {
      resolve(base64Data);
    }
  });
}

function sanitizeDocumentsForDb(docs: any): any {
  if (!docs || typeof docs !== 'object') return null;
  const clean: any = {};
  for (const [key, val] of Object.entries(docs)) {
    if (val && typeof val === 'object') {
      const docItem = val as any;
      const dataUrl = docItem.dataUrl || '';
      const fileUrl = docItem.fileUrl || '';

      // Guard against saving Supabase 400/404 error payloads as URLs
      const isBadUrl = (u?: string) =>
        Boolean(
          !u ||
          typeof u !== 'string' ||
          u.includes('NoSuchKey') ||
          u.includes('NoSuchBucket') ||
          u.includes('Bucket not found') ||
          u.includes('statusCode') ||
          u.includes('documents/unassigned/moa_')
        );

      const validDataUrl = isBadUrl(dataUrl) ? '' : dataUrl;
      const validFileUrl = isBadUrl(fileUrl) ? '' : fileUrl;

      // Extract permanent remote HTTP public URL
      const httpUrl =
        (validFileUrl.startsWith('http://') || validFileUrl.startsWith('https://') ? validFileUrl : '') ||
        (validDataUrl.startsWith('http://') || validDataUrl.startsWith('https://') ? validDataUrl : '');

      let resolvedUrl = httpUrl;
      if (!resolvedUrl) {
        // If no HTTP URL is available yet, only allow small data strings (<50KB) in database JSON to prevent 413
        if (validDataUrl.startsWith('data:') && validDataUrl.length < 50000) {
          resolvedUrl = validDataUrl;
        } else if (validFileUrl.startsWith('data:') && validFileUrl.length < 50000) {
          resolvedUrl = validFileUrl;
        }
      }

      let sanitizedFiles: any[] | undefined = undefined;
      if (Array.isArray(docItem.files) && docItem.files.length > 0) {
        sanitizedFiles = docItem.files.map((f: any, idx: number) => {
          const fData = typeof f?.dataUrl === 'string' && !isBadUrl(f.dataUrl) ? f.dataUrl : '';
          const fUrl = typeof f?.fileUrl === 'string' && !isBadUrl(f.fileUrl) ? f.fileUrl : '';
          const fHttp =
            (fUrl.startsWith('http://') || fUrl.startsWith('https://') ? fUrl : '') ||
            (fData.startsWith('http://') || fData.startsWith('https://') ? fData : '');
          let fResolved = fHttp;
          if (!fResolved) {
            if (fData.startsWith('data:') && fData.length < 50000) fResolved = fData;
            else if (fUrl.startsWith('data:') && fUrl.length < 50000) fResolved = fUrl;
          }
          return {
            id: f?.id || `file-${idx}`,
            name: f?.name || `file_${idx + 1}`,
            size: f?.size || 0,
            fileType: f?.fileType || 'application/octet-stream',
            uploadedAt: f?.uploadedAt || docItem.uploadedAt || new Date().toISOString(),
            fileUrl: fHttp || fResolved,
            dataUrl: fResolved,
          };
        });
      }

      clean[key] = {
        name: docItem.name || 'document',
        title: docItem.title || undefined,
        size: docItem.size,
        fileType: docItem.fileType || 'application/pdf',
        uploadedAt: docItem.uploadedAt || new Date().toISOString(),
        status: docItem.status || 'pending',
        dataUrl: resolvedUrl,
        fileUrl: httpUrl || resolvedUrl,
        description: docItem.description || '',
        notes: docItem.notes || docItem.feedback || '',
        feedback: docItem.feedback || '',
        reviewedBy: docItem.reviewedBy || '',
        reviewedAt: docItem.reviewedAt || '',
        source: docItem.source || 'portal',
        ...(sanitizedFiles ? { files: sanitizedFiles } : {}),
      };
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

// ─── Instant Live Broadcast Sync Bus (Cross-Tab + Cross-Device <100ms) ──────

export type LiveSyncEventType =
  | 'task_updated'
  | 'announcement_created'
  | 'announcement_updated'
  | 'announcement_deleted'
  | 'announcement_comment'
  | 'announcement_submission'
  | 'document_uploaded'
  | 'requirement_updated'
  | 'monitoring_updated'
  | 'employee_updated'
  | 'attendance_updated'
  | 'evaluation_updated'
  | 'geofence_updated'
  | 'settings_updated';

type LiveSyncListener = (event: { type: LiveSyncEventType; payload: any; senderId?: string }) => void;

const LIVE_CLIENT_ID = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const liveListeners = new Set<LiveSyncListener>();
let liveBroadcastChannel: any = null;
let liveChannelSubscribed = false;
let localTabChannel: BroadcastChannel | null = null;

function ensureLiveSyncChannels() {
  if (typeof window === 'undefined') return;

  if (!localTabChannel && typeof BroadcastChannel !== 'undefined') {
    try {
      localTabChannel = new BroadcastChannel('ojt_instant_sync_v1');
      localTabChannel.onmessage = (ev) => {
        const msg = ev?.data;
        if (msg && msg.type && msg.senderId !== LIVE_CLIENT_ID) {
          liveListeners.forEach((fn) => {
            try { fn(msg); } catch {}
          });
        }
      };
    } catch {}
  }

  if (!liveBroadcastChannel && isSupabaseConfigured()) {
    try {
      liveBroadcastChannel = supabase
        .channel('ojt-instant-sync-v1', {
          config: { broadcast: { self: false, ack: false } },
        })
        .on('broadcast', { event: 'ojt_sync' }, (envelope: any) => {
          const msg = envelope?.payload;
          if (msg && msg.type && msg.senderId !== LIVE_CLIENT_ID) {
            liveListeners.forEach((fn) => {
              try { fn(msg); } catch {}
            });
          }
        })
        .subscribe((status: string) => {
          liveChannelSubscribed = status === 'SUBSCRIBED';
        });
    } catch {}
  }
}

export function broadcastLiveEvent(type: LiveSyncEventType, payload: any): void {
  if (typeof window === 'undefined') return;
  ensureLiveSyncChannels();
  const message = { type, payload, senderId: LIVE_CLIENT_ID, ts: Date.now() };

  // 1. Instant same-browser cross-tab BroadcastChannel (<5ms)
  try {
    localTabChannel?.postMessage(message);
  } catch {}

  // 2. Instant cross-device Supabase Realtime Broadcast (<80ms, no DB table required)
  if (liveBroadcastChannel) {
    try {
      if (liveChannelSubscribed) {
        liveBroadcastChannel.send({
          type: 'broadcast',
          event: 'ojt_sync',
          payload: message,
        }).catch?.(() => {});
      } else {
        setTimeout(() => {
          try {
            liveBroadcastChannel?.send({
              type: 'broadcast',
              event: 'ojt_sync',
              payload: message,
            })?.catch?.(() => {});
          } catch {}
        }, 350);
      }
    } catch {}
  }
}

export function subscribeLiveEvents(listener: LiveSyncListener): () => void {
  ensureLiveSyncChannels();
  liveListeners.add(listener);
  return () => {
    liveListeners.delete(listener);
  };
}

// Fast client-side image optimizer for camera/gallery photos (>450KB -> crisp ~1600px JPEG in ~40ms)
export async function optimizeUploadFile(file: File | Blob, maxDim = 1600, quality = 0.84): Promise<Blob | File> {
  if (typeof window === 'undefined' || !file) return file;
  const mime = (file.type || '').toLowerCase();
  if (!mime.startsWith('image/') || mime === 'image/svg+xml' || mime === 'image/gif' || file.size <= 450 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      try {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && file.size <= 700 * 1024) {
          resolve(file);
          return;
        }
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (compressed) => {
            if (!compressed || compressed.size >= file.size) {
              resolve(file);
              return;
            }
            if (file instanceof File) {
              const baseName = file.name.replace(/\.[^/.]+$/, '');
              resolve(new File([compressed], `${baseName}.jpg`, { type: 'image/jpeg' }));
            } else {
              resolve(compressed);
            }
          },
          'image/jpeg',
          quality
        );
      } catch {
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve(file);
    };
    img.src = objUrl;
  });
}

let _directFacePhotosUploadAllowed: boolean | null = null;

export async function uploadDocumentToStorage(
  employeeId: string,
  docKey: string,
  fileDataOrBlob: string | Blob | File,
  fileName?: string
): Promise<string> {
  try {
    let blob: Blob;
    let contentType = 'application/pdf';

    if (typeof fileDataOrBlob === 'string') {
      if (fileDataOrBlob.startsWith('http://') || fileDataOrBlob.startsWith('https://')) {
        return fileDataOrBlob;
      }
      const match = fileDataOrBlob.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        const byteCharacters = atob(match[2]);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        blob = await optimizeUploadFile(new Blob([byteNumbers], { type: contentType }));
        contentType = blob.type || contentType;
      } else {
        return fileDataOrBlob;
      }
    } else {
      const optimized = await optimizeUploadFile(fileDataOrBlob);
      blob = optimized;
      contentType = optimized.type || fileDataOrBlob.type || 'application/octet-stream';
    }

    const cleanEmpId = (employeeId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '_');
    const rawExt = fileName?.split('.').pop() || '';
    const ext = rawExt
      ? rawExt.toLowerCase()
      : contentType.includes('image')
        ? 'jpg'
        : contentType.includes('word') || contentType.includes('officedocument')
          ? 'docx'
          : 'pdf';
    const storagePath = `documents/${cleanEmpId}/${docKey}_${Date.now()}.${ext}`;

    // Fast 1-hop direct Supabase Storage upload (skips /api/documents Vercel cold start when allowed)
    const tryDirectUpload = async (): Promise<string> => {
      if (!isSupabaseConfigured() || _directFacePhotosUploadAllowed === false) return '';
      try {
        const { data, error } = await supabase.storage.from('face-photos').upload(storagePath, blob, {
          contentType,
          upsert: true,
          cacheControl: '604800',
        });
        if (!error && data) {
          _directFacePhotosUploadAllowed = true;
          const { data: urlData } = supabase.storage.from('face-photos').getPublicUrl(storagePath);
          if (urlData?.publicUrl) return urlData.publicUrl;
        } else if (error) {
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('row-level security') || msg.includes('unauthorized') || msg.includes('403')) {
            _directFacePhotosUploadAllowed = false;
          }
        }
      } catch {}
      return '';
    };

    const trySignedUpload = async (): Promise<string> => {
      try {
        const signRes = await fetch(
          `/api/documents?action=get-upload-url&path=${encodeURIComponent(storagePath)}&bucket=face-photos`
        );
        if (signRes.ok) {
          const signInfo = await signRes.json();
          if (signInfo?.token && signInfo?.path && isSupabaseConfigured()) {
            const { error: upErr } = await supabase.storage
              .from('face-photos')
              .uploadToSignedUrl(signInfo.path, signInfo.token, blob, { contentType });
            if (!upErr && signInfo.publicUrl) {
              return signInfo.publicUrl;
            }
          }
        }
      } catch (signErr) {
        console.warn('[Storage] Signed upload URL notice:', signErr);
      }
      return '';
    };

    // 1. If direct 1-hop upload was already confirmed allowed, use it immediately (0 Vercel roundtrips!)
    if (_directFacePhotosUploadAllowed === true) {
      const directUrl = await tryDirectUpload();
      if (directUrl) return directUrl;
    }

    // 2. If unknown (first upload of session), race direct 1-hop upload with signed upload so whichever finishes first wins
    if (_directFacePhotosUploadAllowed === null && isSupabaseConfigured()) {
      const [directRes, signedRes] = await Promise.all([tryDirectUpload(), trySignedUpload()]);
      if (directRes || signedRes) return directRes || signedRes;
    } else {
      const signedUrl = await trySignedUpload();
      if (signedUrl) return signedUrl;
    }

    // 3. Fallback: Direct server upload via /api/documents?action=upload (for < 2.8MB files)
    try {
      let b64 = '';
      if (typeof fileDataOrBlob === 'string') {
        b64 = fileDataOrBlob;
      } else if (blob.size < 2800000) {
        b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      }
      if (b64 && b64.length < 4000000) {
        const srvRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            path: storagePath,
            dataUrl: b64,
            contentType,
            bucket: 'face-photos',
          }),
        });
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData?.publicUrl) return srvData.publicUrl;
        }
      }
    } catch (srvErr) {
      console.warn('[Storage] Server upload fallback notice:', srvErr);
    }

    // 4. Final fallback to 'documents' bucket if present
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.storage.from('documents').upload(storagePath, blob, {
          contentType,
          upsert: true,
          cacheControl: '604800',
        });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
          if (urlData?.publicUrl) return urlData.publicUrl;
        }
      } catch {}
    }
  } catch (err) {
    console.warn('uploadDocumentToStorage notice:', err);
  }

  return typeof fileDataOrBlob === 'string' ? fileDataOrBlob : '';
}

export async function createEmployee(employee: Omit<Employee, 'id' | 'createdAt'> & { id?: string }): Promise<Employee> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

  const rawInstructorId = (employee as any).instructorId;
  const rawHteId = (employee as any).hteId;

  // Compress and upload base64 face photo to storage bucket if needed
  let photoToStore = employee.photo || null;
  if (photoToStore && typeof photoToStore === 'string' && !photoToStore.startsWith('http')) {
    try {
      photoToStore = await compressBase64Image(photoToStore, 600, 0.82);
      const uploadedUrl = await uploadFacePhoto(employee.employeeId, photoToStore, 'profile');
      if (uploadedUrl && uploadedUrl.startsWith('http')) {
        photoToStore = uploadedUrl;
      }
    } catch (photoErr) {
      console.warn('Face photo bucket upload notice during createEmployee:', photoErr);
    }
  }

  const phoneVal = employee.contactPhone || employee.phone || employee.telephone || null;
  const resAddrVal =
    employee.residentialAddress ||
    employee.address ||
    [employee.street, employee.barangay, employee.city, employee.province].filter(Boolean).join(', ') ||
    null;

  const posLower = (employee.position || '').toLowerCase();
  const isInst = posLower.includes('instructor') || posLower.includes('faculty') || posLower.includes('admin');
  const isHte = posLower.includes('hte') || posLower.includes('host') || posLower.includes('supervisor');

  const genUuid = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const validUuid = (employee.id && isUuid(employee.id)) ? employee.id : genUuid();

  // Exact payload matching verified live columns in employees table
  // Pass through employee.employeeId directly as generated by caller (Register.tsx)
  const resolvedSupervisor = employee.supervisorName || (isHte ? (employee.name || 'HTE Supervisor') : isInst ? 'Dean / College Head' : 'Training Supervisor');
  const supabaseEmployee: any = {
    id: validUuid,
    name: employee.name,
    employee_id: employee.employeeId,
    email: employee.email.trim().toLowerCase(),
    department: employee.department || 'College of Computer Studies',
    position: employee.position || (isInst ? 'OJT Instructor' : isHte ? 'HTE Representative' : 'OJT Trainee'),
    company_name: employee.companyName || (isInst ? 'Carlos Hilado Memorial State University' : isHte ? 'Concentrix' : 'N/A'),
    supervisor_name: resolvedSupervisor,
    school_name: employee.schoolName || 'Carlos Hilado Memorial State University',
    campus: employee.campus || 'Talisay (Main Campus)',
    course: employee.course || 'Information Systems',
    start_date: employee.startDate || new Date().toISOString().split('T')[0],
    end_date: employee.endDate || new Date().toISOString().split('T')[0],
    required_hours: isInst || isHte
      ? (employee.requiredHours ?? 0)
      : Number(employee.requiredHours) > 0
        ? Math.round(Number(employee.requiredHours))
        : TRAINEE_REQUIRED_HOURS,
    photo: photoToStore,
    face_registered: Boolean(employee.faceRegistered),
    ...(Array.isArray(employee.faceDescriptor) && employee.faceDescriptor.length === 128
      ? { face_descriptor: employee.faceDescriptor }
      : {}),
    active: employee.active !== false,
    registration_lat: employee.registrationLocation?.lat != null ? Number(employee.registrationLocation.lat) : null,
    registration_lng: employee.registrationLocation?.lng != null ? Number(employee.registrationLocation.lng) : null,
    registration_address: employee.registrationAddress || null,
    academic_year: employee.academicYear || '2026-2027',
    instructor_id: isUuid(rawInstructorId) ? rawInstructorId : null,
    hte_id: isUuid(rawHteId) ? rawHteId : null,
    application_status: (employee as any).applicationStatus || 'approved',
    registration_location: {
      lat: employee.registrationLocation?.lat != null ? Number(employee.registrationLocation.lat) : null,
      lng: employee.registrationLocation?.lng != null ? Number(employee.registrationLocation.lng) : null,
      address: employee.registrationAddress || null,
      phone: phoneVal,
      contactPhone: phoneVal,
      telephone: phoneVal,
      residentialAddress: resAddrVal,
      homeAddress: resAddrVal,
      street: employee.street || null,
      barangay: employee.barangay || null,
      city: employee.city || null,
      province: employee.province || null,
      documentsPassed: (() => {
        const isTrainee = !employee.position || (!employee.position.toLowerCase().includes('instructor') && !employee.position.toLowerCase().includes('hte') && employee.position !== 'Administrator');
        if (!isTrainee) return employee.documentsPassed !== undefined ? employee.documentsPassed : true;
        const REQUIRED_KEYS = [
          'internshipAgreement', 'moa', 'consent', 'trainingPlan', 'pledgeOfConduct',
          'medical', 'application', 'resume', 'enrolmentForm', 'endorsement'
        ];
        const uploadedCount = employee.submittedDocuments
          ? REQUIRED_KEYS.filter((k) => {
              const d =
                (employee.submittedDocuments as any)?.[k] ||
                (k === 'consent' ? (employee.submittedDocuments as any)?.parent_consent : undefined) ||
                (k === 'medical' ? (employee.submittedDocuments as any)?.clearance : undefined) ||
                (k === 'trainingPlan' ? (employee.submittedDocuments as any)?.training_plan : undefined) ||
                (k === 'application' ? ((employee.submittedDocuments as any)?.applicationForm || (employee.submittedDocuments as any)?.application_letter) : undefined);
              return Boolean(d && (d.dataUrl || d.name || d.fileUrl));
            }).length
          : 0;
        const isAllComplete = uploadedCount === REQUIRED_KEYS.length;
        return isAllComplete && Boolean(employee.documentsPassed);
      })(),
      documentsStatus: (() => {
        const isTrainee = !employee.position || (!employee.position.toLowerCase().includes('instructor') && !employee.position.toLowerCase().includes('hte') && employee.position !== 'Administrator');
        if (!isTrainee) return employee.documentsStatus || 'passed';
        const REQUIRED_KEYS = [
          'internshipAgreement', 'moa', 'consent', 'trainingPlan', 'pledgeOfConduct',
          'medical', 'application', 'resume', 'enrolmentForm', 'endorsement'
        ];
        const uploadedCount = employee.submittedDocuments
          ? REQUIRED_KEYS.filter((k) => {
              const d =
                (employee.submittedDocuments as any)?.[k] ||
                (k === 'consent' ? (employee.submittedDocuments as any)?.parent_consent : undefined) ||
                (k === 'medical' ? (employee.submittedDocuments as any)?.clearance : undefined) ||
                (k === 'trainingPlan' ? (employee.submittedDocuments as any)?.training_plan : undefined) ||
                (k === 'application' ? ((employee.submittedDocuments as any)?.applicationForm || (employee.submittedDocuments as any)?.application_letter) : undefined);
              return Boolean(d && (d.dataUrl || d.name || d.fileUrl));
            }).length
          : 0;
        const isAllComplete = uploadedCount === REQUIRED_KEYS.length;
        if (!isAllComplete) {
          return employee.documentsStatus === 'rejected' ? 'rejected' : uploadedCount > 0 ? (employee.documentsStatus === 'partial' ? 'partial' : 'pending') : 'pending';
        }
        return employee.documentsStatus || 'submitted';
      })(),
      documents: sanitizeDocumentsForDb(employee.submittedDocuments),
    },
  };

  // 1. Check if employee already exists by email to reuse their UUID primary key
  try {
    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id, employee_id')
      .eq('email', supabaseEmployee.email)
      .maybeSingle();

    if (existingEmp?.id) {
      supabaseEmployee.id = existingEmp.id;
    }
  } catch (lookupErr) {
    console.warn('Existing employee lookup notice:', lookupErr);
  }

  // 1. Primary path: Service role endpoint /api/employees (bypasses RLS to guarantee persistence)
  try {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: supabaseEmployee.id || validUuid,
        updates: supabaseEmployee,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const rec = Array.isArray(json.data) ? json.data[0] : json.data;
      if (rec) {
        return transformSupabaseEmployee(rec);
      }
    }
  } catch (apiErr) {
    console.warn('createEmployee /api/employees error, falling back:', apiErr);
  }

  // 2. Direct Supabase Client fallback
  // Strategy A: Upsert on primary key 'id'
  let upsertResult = await supabase
    .from('employees')
    .upsert([supabaseEmployee], { onConflict: 'id' })
    .select();

  // If column error, dynamically prune extra columns and retry
  let retries = 0;
  while (upsertResult.error && upsertResult.error.message.includes('column') && retries < 6) {
    retries++;
    const match = upsertResult.error.message.match(/column (?:employees\.)?([a-zA-Z0-9_]+) does not exist/i);
    if (match && match[1]) {
      delete supabaseEmployee[match[1]];
    } else {
      delete supabaseEmployee.contact_phone;
      delete supabaseEmployee.phone;
      delete supabaseEmployee.role;
      delete supabaseEmployee.username;
      delete supabaseEmployee.approval_status;
    }
    upsertResult = await supabase
      .from('employees')
      .upsert([supabaseEmployee], { onConflict: 'id' })
      .select();
  }

  // Strategy B: If duplicate/unique constraint error on email, update directly by email
  if (upsertResult.error && (upsertResult.error.message.includes('duplicate') || upsertResult.error.message.includes('unique') || upsertResult.error.message.includes('constraint'))) {
    console.warn('Upsert hit constraint, attempting direct update by email:', upsertResult.error.message);
    const updateResult = await supabase
      .from('employees')
      .update(supabaseEmployee)
      .eq('email', supabaseEmployee.email)
      .select();
    if (!updateResult.error && updateResult.data && updateResult.data.length > 0) {
      upsertResult = updateResult;
    }
  }

  // Strategy C: Plain insert
  if (upsertResult.error) {
    const insertResult = await supabase
      .from('employees')
      .insert([supabaseEmployee])
      .select();
    if (!insertResult.error) {
      upsertResult = insertResult;
    }
  }

  // Sync to host_supervisors if HTE Representative
  if (isHte && supabaseEmployee.id) {
    try {
      await supabase.from('host_supervisors').upsert({
        id: supabaseEmployee.id,
        name: supabaseEmployee.name,
        email: supabaseEmployee.email,
        company_name: supabaseEmployee.company_name || 'Concentrix',
        position: 'HTE Representative',
        active: true,
        is_approved: true,
      }, { onConflict: 'id' });
    } catch (hErr) {
      console.warn('host_supervisors sync note:', hErr);
    }
  }

  const { data, error } = upsertResult;
  const returnedRecord = Array.isArray(data) ? data[0] : data;

  if (error && !returnedRecord) {
    console.warn('[Cloud Write Notice] Supabase cloud store returned note:', error.message);
    // Return safely transformed employee so registration flow never fails with database errors
    return transformSupabaseEmployee({
      ...supabaseEmployee,
      id: supabaseEmployee.id || validUuid,
      created_at: new Date().toISOString(),
    });
  }

  return transformSupabaseEmployee(returnedRecord || {
    ...supabaseEmployee,
    id: supabaseEmployee.id || validUuid,
    created_at: new Date().toISOString(),
  });
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabaseUpdates: any = {};
  if (updates.name !== undefined) supabaseUpdates.name = updates.name;
  if (updates.employeeId !== undefined) supabaseUpdates.employee_id = updates.employeeId;
  if (updates.email !== undefined) supabaseUpdates.email = updates.email.trim().toLowerCase();
  if (updates.department !== undefined) supabaseUpdates.department = updates.department;
  if (updates.position !== undefined) supabaseUpdates.position = updates.position;
  if (updates.companyName !== undefined) supabaseUpdates.company_name = updates.companyName;
  if (updates.supervisorName !== undefined) supabaseUpdates.supervisor_name = updates.supervisorName;
  if (updates.schoolName !== undefined) supabaseUpdates.school_name = updates.schoolName;
  if (updates.campus !== undefined) supabaseUpdates.campus = updates.campus;
  if (updates.course !== undefined) supabaseUpdates.course = updates.course;
  if (updates.startDate !== undefined) supabaseUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) supabaseUpdates.end_date = updates.endDate;
  if (updates.requiredHours !== undefined) supabaseUpdates.required_hours = updates.requiredHours;
  if (updates.photo !== undefined) {
    let photoVal = updates.photo;
    if (photoVal && typeof photoVal === 'string' && !photoVal.startsWith('http')) {
      try {
        const uploadedUrl = await uploadFacePhoto(updates.employeeId || id, photoVal, 'profile');
        if (uploadedUrl && uploadedUrl.startsWith('http')) {
          photoVal = uploadedUrl;
        }
      } catch (pErr) {
        console.warn('Face photo upload notice during updateEmployee:', pErr);
      }
    }
    supabaseUpdates.photo = photoVal;
  }
  if (updates.faceRegistered !== undefined) supabaseUpdates.face_registered = updates.faceRegistered;
  if (Array.isArray(updates.faceDescriptor) && updates.faceDescriptor.length === 128) {
    supabaseUpdates.face_descriptor = updates.faceDescriptor;
  }
  if (updates.active !== undefined) supabaseUpdates.active = updates.active;
  if (updates.academicYear !== undefined) supabaseUpdates.academic_year = updates.academicYear;
  if (updates.applicationStatus !== undefined) supabaseUpdates.application_status = updates.applicationStatus;
  if (updates.approvalStatus !== undefined) supabaseUpdates.application_status = updates.approvalStatus;
  if (updates.instructorId !== undefined) supabaseUpdates.instructor_id = updates.instructorId;
  if (updates.hteId !== undefined) supabaseUpdates.hte_id = updates.hteId;
  if (updates.linkedAt !== undefined) supabaseUpdates.linked_at = updates.linkedAt;
  if ('registrationLocation' in updates) {
    supabaseUpdates.registration_lat = updates.registrationLocation?.lat ?? null;
    supabaseUpdates.registration_lng = updates.registrationLocation?.lng ?? null;
  }
  if ('registrationAddress' in updates) {
    supabaseUpdates.registration_address = updates.registrationAddress ?? null;
  }
  const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  const hasRegLocUpdates =
    'registrationLocation' in updates ||
    updates.registrationRadius !== undefined ||
    updates.contactPhone !== undefined ||
    updates.phone !== undefined ||
    updates.telephone !== undefined ||
    updates.residentialAddress !== undefined ||
    updates.address !== undefined ||
    updates.street !== undefined ||
    updates.barangay !== undefined ||
    updates.city !== undefined ||
    updates.province !== undefined ||
    updates.documentsPassed !== undefined ||
    updates.documentsStatus !== undefined ||
    updates.submittedDocuments !== undefined ||
    (updates as any).geofenceOverride !== undefined;

  if (hasRegLocUpdates) {
    let existingRegLoc: any = {};
    try {
      let fetchQuery = supabase.from('employees').select('registration_location').limit(1);
      if (isUuid(id)) {
        fetchQuery = fetchQuery.eq('id', id);
      } else if (updates.email) {
        fetchQuery = fetchQuery.eq('email', updates.email.trim().toLowerCase());
      } else {
        fetchQuery = fetchQuery.eq('employee_id', id);
      }
      const { data: empRow } = await fetchQuery.maybeSingle();
    if (empRow?.registration_location) {
      if (typeof empRow.registration_location === 'string') {
        try {
          existingRegLoc = JSON.parse(empRow.registration_location);
        } catch {}
      } else if (typeof empRow.registration_location === 'object') {
        existingRegLoc = { ...empRow.registration_location };
      }
    }
  } catch (e) {
    console.warn('Could not fetch existing registration_location:', e);
  }

  if (typeof updates.registrationLocation === 'object' && updates.registrationLocation !== null) {
    existingRegLoc = {
      ...existingRegLoc,
      lat: updates.registrationLocation.lat ?? existingRegLoc.lat ?? null,
      lng: updates.registrationLocation.lng ?? existingRegLoc.lng ?? null,
      radius: updates.registrationLocation.radius ?? existingRegLoc.radius ?? 40,
    };
  }

  const updatedRegLoc: any = {
    ...existingRegLoc,
  };

  if ('registrationLocation' in updates && updates.registrationLocation) {
    updatedRegLoc.lat = updates.registrationLocation.lat ?? null;
    updatedRegLoc.lng = updates.registrationLocation.lng ?? null;
  }
  const regRadius = updates.registrationRadius ?? updates.registrationLocation?.radius;
  if (regRadius !== undefined && regRadius !== null) {
    updatedRegLoc.radius = Math.max(20, Number(regRadius));
  }
  if ((updates as any).geofenceOverride !== undefined) {
    updatedRegLoc.geofenceOverride = (updates as any).geofenceOverride;
  } else if (updates.registrationLocation && (updates.registrationLocation as any).geofenceOverride !== undefined) {
    updatedRegLoc.geofenceOverride = (updates.registrationLocation as any).geofenceOverride;
  }
  if (updates.registrationAddress !== undefined) {
    updatedRegLoc.address = updates.registrationAddress;
    supabaseUpdates.registration_address = updates.registrationAddress;
  }
  if (updates.contactPhone !== undefined || updates.phone !== undefined || updates.telephone !== undefined) {
    const pVal = updates.contactPhone ?? updates.phone ?? updates.telephone;
    updatedRegLoc.phone = pVal;
    updatedRegLoc.contactPhone = pVal;
    updatedRegLoc.telephone = pVal;
  }
    if (updates.residentialAddress !== undefined || updates.address !== undefined) {
      const aVal = updates.residentialAddress ?? updates.address;
      updatedRegLoc.residentialAddress = aVal;
      updatedRegLoc.homeAddress = aVal;
    }
    if (updates.street !== undefined) updatedRegLoc.street = updates.street;
    if (updates.barangay !== undefined) updatedRegLoc.barangay = updates.barangay;
    if (updates.city !== undefined) updatedRegLoc.city = updates.city;
    if (updates.province !== undefined) updatedRegLoc.province = updates.province;
    if (updates.documentsPassed !== undefined) updatedRegLoc.documentsPassed = updates.documentsPassed;
    if (updates.documentsStatus !== undefined) updatedRegLoc.documentsStatus = updates.documentsStatus;
    if (updates.submittedDocuments !== undefined) {
      updatedRegLoc.documents = sanitizeDocumentsForDb(updates.submittedDocuments);
    } else if (updates.documentsPassed !== undefined && updatedRegLoc.documents) {
      const targetDocStatus = updates.documentsPassed ? 'passed' : 'pending';
      const synchronizedDocs: any = { ...updatedRegLoc.documents };
      for (const k of Object.keys(synchronizedDocs)) {
        if (synchronizedDocs[k] && typeof synchronizedDocs[k] === 'object') {
          synchronizedDocs[k] = { ...synchronizedDocs[k], status: targetDocStatus };
        }
      }
      updatedRegLoc.documents = synchronizedDocs;
    }

    supabaseUpdates.registration_location = updatedRegLoc;
  }

  // 1. Primary path: Service role endpoint /api/employees (bypasses RLS to guarantee persistence)
  try {
    const sanitizedUpdates: any = { ...updates };
    if (sanitizedUpdates.submittedDocuments) {
      sanitizedUpdates.submittedDocuments = sanitizeDocumentsForDb(sanitizedUpdates.submittedDocuments);
    }
    if (sanitizedUpdates.submitted_documents) {
      sanitizedUpdates.submitted_documents = sanitizeDocumentsForDb(sanitizedUpdates.submitted_documents);
    }
    if (sanitizedUpdates.documents) {
      sanitizedUpdates.documents = sanitizeDocumentsForDb(sanitizedUpdates.documents);
    }
    if (sanitizedUpdates.registration_location?.documents) {
      sanitizedUpdates.registration_location = {
        ...sanitizedUpdates.registration_location,
        documents: sanitizeDocumentsForDb(sanitizedUpdates.registration_location.documents),
      };
    }
    if (sanitizedUpdates.registrationLocation?.documents) {
      sanitizedUpdates.registrationLocation = {
        ...sanitizedUpdates.registrationLocation,
        documents: sanitizeDocumentsForDb(sanitizedUpdates.registrationLocation.documents),
      };
    }

    const res = await fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        updates: {
          ...sanitizedUpdates,
          ...supabaseUpdates,
        },
      }),
    });
    if (res.ok) {
      const resJson = await res.json().catch(() => null);
      if (!resJson || resJson.success !== false) {
        _coreBootstrapCache = { data: null, expiresAt: 0 };
        broadcastLiveEvent('employee_updated', { id, updates });
        return true;
      }
    }
    const errText = await res.text().catch(() => '');
    console.warn(`API endpoint /api/employees returned status ${res.status}:`, errText);
  } catch {
    // Fall back to direct Supabase client below
  }

  // 2. Direct Supabase client fallback (strip registration_location if existingRegLoc had no documents loaded and submittedDocuments wasn't explicitly passed, preventing accidental wipe of documents!)
  try {
    const safeDirectUpdates = { ...supabaseUpdates };
    if (
      safeDirectUpdates.registration_location &&
      updates.submittedDocuments === undefined &&
      !safeDirectUpdates.registration_location.documents
    ) {
      delete safeDirectUpdates.registration_location;
    }
    if (Object.keys(safeDirectUpdates).length === 0) return true;

    let query = supabase.from('employees').update(safeDirectUpdates);
    if (isUuid(id)) {
      query = query.eq('id', id);
    } else if (updates.email) {
      query = query.eq('email', updates.email.trim().toLowerCase());
    } else {
      query = query.eq('employee_id', id);
    }

    const { error } = await query;
    if (error) {
      if (String(error.message || '').includes('Failed to fetch')) {
        return false;
      }
      console.error('Error updating employee:', error);
      throw new Error(error.message || 'Failed to update employee in database');
    }

    return true;
  } catch (err: any) {
    if (String(err?.message || err || '').includes('Failed to fetch')) {
      return false;
    }
    throw err;
  }
}

export async function fetchAllTraineeDocumentsStore(forceFresh: boolean = false): Promise<Record<string, {
  id?: string;
  employeeId?: string;
  email?: string;
  name?: string;
  documents?: TraineeDocuments;
  documentsPassed?: boolean;
  documentsStatus?: 'passed' | 'pending' | 'submitted' | 'incomplete' | 'partial';
  updatedAt?: string;
}>> {
  if (!forceFresh && _storesBootstrapCache.data?.traineeDocuments && _storesBootstrapCache.expiresAt > Date.now()) {
    return _storesBootstrapCache.data.traineeDocuments;
  }
  // 1. Fast zero-DB API read (/api/documents serves write-through server memory cache; ?fresh=1 bypasses cross-Lambda CDN lag post-mutation!)
  try {
    const res = await fetch(`/api/documents?action=get-all-trainee-documents${forceFresh ? '&fresh=1' : ''}`);
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (_storesBootstrapCache.data) {
          _storesBootstrapCache.data.traineeDocuments = parsed;
        }
        return parsed;
      }
    }
  } catch {}

  // 2. Direct public Storage CDN fallback
  try {
    const base = (import.meta.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co').replace(/\/$/, '');
    const pubRes = await fetch(`${base}/storage/v1/object/public/face-photos/settings/trainee_documents_store.json`);
    if (pubRes.ok) {
      const parsed = await pubRes.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}

  return {};
}

export async function fetchEmployeeDocuments(employeeId: string, forceFresh: boolean = false): Promise<{
  success: boolean;
  documents?: TraineeDocuments;
  documentsPassed?: boolean;
  documentsStatus?: 'passed' | 'pending' | 'submitted' | 'incomplete' | 'partial';
  storedDocuments?: any[];
} | null> {
  if (!employeeId) return null;

  // 1. Primary path: Service role endpoint /api/documents (bypasses RLS)
  try {
    const res = await fetch(`/api/documents?employeeId=${encodeURIComponent(employeeId)}${forceFresh ? '&fresh=1' : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return data;
      }
    }
  } catch (err) {
    console.warn('fetchEmployeeDocuments API notice:', err);
  }

  // 2. Secondary path: Direct Supabase fallback
  if (isSupabaseConfigured()) {
    try {
      const isUuidStr = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
      let q = supabase.from('employees').select('id, employee_id, registration_location').limit(1);
      if (isUuidStr(employeeId)) {
        q = q.eq('id', employeeId);
      } else {
        q = q.eq('employee_id', String(employeeId).trim());
      }
      const { data: row } = await q.maybeSingle();
      if (row?.registration_location) {
        const reg = typeof row.registration_location === 'string' ? JSON.parse(row.registration_location) : row.registration_location;
        return {
          success: true,
          documents: reg?.documents || {},
          documentsPassed: Boolean(reg?.documentsPassed),
          documentsStatus: reg?.documentsStatus || 'pending',
        };
      }
    } catch (dbErr) {
      console.warn('fetchEmployeeDocuments direct DB notice:', dbErr);
    }
  }

  return null;
}

export async function saveDocumentPassStatus(
  employeeId: string,
  payload: {
    docKey?: string;
    removeDocKey?: string;
    isEdit?: boolean;
    replaceSubmittedDocuments?: boolean;
    status?: 'passed' | 'pending' | 'submitted' | 'rejected';
    allPassed?: boolean;
    documentsStatus?: 'passed' | 'pending' | 'submitted' | 'partial' | 'incomplete';
    submittedDocuments?: TraineeDocuments;
    documentItem?: TraineeDocumentItem;
  }
): Promise<boolean> {
  if (!employeeId) return false;

  const sanitizedSubmittedDocs = payload.submittedDocuments
    ? sanitizeDocumentsForDb(payload.submittedDocuments)
    : undefined;
  const sanitizedDocItem = payload.documentItem
    ? sanitizeDocumentsForDb({ item: payload.documentItem })?.item
    : undefined;

  const shouldReplaceDocs = Boolean(
    payload.replaceSubmittedDocuments ||
    payload.removeDocKey ||
    payload.isEdit ||
    payload.submittedDocuments !== undefined
  );

  const cleanPayload = {
    ...payload,
    replaceSubmittedDocuments: shouldReplaceDocs,
    submittedDocuments: sanitizedSubmittedDocs,
    documentItem: sanitizedDocItem,
  };

  // Invalidate bootstrap caches immediately so subsequent reads reflect edits/deletions
  _coreBootstrapCache = { data: null, expiresAt: 0 };
  _storesBootstrapCache = { data: null, expiresAt: 0 };

  const emitLiveDocBroadcast = () => {
    broadcastLiveEvent('document_uploaded', {
      employeeId,
      action: payload.removeDocKey ? 'deleted' : payload.isEdit ? 'edited' : 'uploaded',
      docKey: payload.docKey,
      removeDocKey: payload.removeDocKey,
      replaceSubmittedDocuments: shouldReplaceDocs,
      documentItem: cleanPayload.documentItem,
      submittedDocuments: cleanPayload.submittedDocuments,
      documentsPassed: payload.allPassed,
      documentsStatus: payload.documentsStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  // 1. Primary path: Dedicated /api/documents endpoint (bypasses RLS with service role + mirrors to trainee_documents_store.json)
  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        ...cleanPayload,
      }),
    });
    if (res.ok) {
      emitLiveDocBroadcast();
      return true;
    }
  } catch (err) {
    console.warn('/api/documents endpoint notice:', err);
  }

  // 2. Secondary path: /api/employees endpoint
  try {
    const res = await fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: employeeId,
        employeeId,
        updates: {
          documentsPassed: payload.allPassed,
          documentsStatus: payload.documentsStatus,
          submittedDocuments: sanitizedSubmittedDocs || (cleanPayload.docKey && cleanPayload.documentItem ? { [cleanPayload.docKey]: cleanPayload.documentItem } : undefined),
        },
      }),
    });
    if (res.ok) {
      emitLiveDocBroadcast();
      return true;
    }
  } catch (err) {
    console.warn('/api/employees fallback notice:', err);
  }

  // 3. Tertiary path: Direct Supabase database query fallback
  if (isSupabaseConfigured()) {
    try {
      const isUuidStr = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
      let fetchQuery = supabase.from('employees').select('id, employee_id, registration_location').limit(1);
      if (isUuidStr(employeeId)) {
        fetchQuery = fetchQuery.eq('id', employeeId);
      } else {
        fetchQuery = fetchQuery.eq('employee_id', String(employeeId).trim());
      }
      const { data: empRow } = await fetchQuery.maybeSingle();
      if (empRow) {
        const curLoc = typeof empRow.registration_location === 'object' && empRow.registration_location !== null
          ? { ...empRow.registration_location }
          : {};
        const currentDocs = { ...(curLoc.documents || {}) };
        if (payload.docKey && payload.documentItem) {
          currentDocs[payload.docKey] = {
            ...(currentDocs[payload.docKey] || {}),
            ...payload.documentItem,
          };
        }
        if (payload.submittedDocuments) {
          Object.assign(currentDocs, payload.submittedDocuments);
        }
        const updatedRegLoc = {
          ...curLoc,
          documents: sanitizeDocumentsForDb(currentDocs),
          documentsPassed: payload.allPassed !== undefined ? payload.allPassed : curLoc.documentsPassed,
          documentsStatus: payload.documentsStatus || curLoc.documentsStatus || 'pending',
        };
        const { error: directErr } = await supabase
          .from('employees')
          .update({ registration_location: updatedRegLoc })
          .eq('id', empRow.id);
        if (!directErr) {
          return true;
        }
      }
    } catch (dbErr) {
      console.warn('Direct Supabase document pass query notice:', dbErr);
    }
  }

  return false;
}

export async function batchUpdateEmployees(
  ids: string[],
  updates: Partial<Employee>
): Promise<boolean> {
  if (!isSupabaseConfigured() || !ids || ids.length === 0) return false;

  const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  const supabaseUpdates: any = {};
  if (updates.name !== undefined) supabaseUpdates.name = updates.name;
  if (updates.employeeId !== undefined) supabaseUpdates.employee_id = updates.employeeId;
  if (updates.email !== undefined) supabaseUpdates.email = updates.email.trim().toLowerCase();
  if (updates.department !== undefined) supabaseUpdates.department = updates.department;
  if (updates.position !== undefined) supabaseUpdates.position = updates.position;
  if (updates.companyName !== undefined) supabaseUpdates.company_name = updates.companyName;
  if (updates.supervisorName !== undefined) supabaseUpdates.supervisor_name = updates.supervisorName;
  if (updates.schoolName !== undefined) supabaseUpdates.school_name = updates.schoolName;
  if (updates.campus !== undefined) supabaseUpdates.campus = updates.campus;
  if (updates.course !== undefined) supabaseUpdates.course = updates.course;
  if (updates.startDate !== undefined) supabaseUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) supabaseUpdates.end_date = updates.endDate;
  if (updates.requiredHours !== undefined) supabaseUpdates.required_hours = updates.requiredHours;
  if (updates.active !== undefined) supabaseUpdates.active = updates.active;
  if (updates.academicYear !== undefined) supabaseUpdates.academic_year = updates.academicYear;
  if (updates.applicationStatus !== undefined) supabaseUpdates.application_status = updates.applicationStatus;
  if (updates.approvalStatus !== undefined) supabaseUpdates.application_status = updates.approvalStatus;
  if (updates.instructorId !== undefined) supabaseUpdates.instructor_id = updates.instructorId;
  if (updates.hteId !== undefined) supabaseUpdates.hte_id = updates.hteId;
  if (updates.linkedAt !== undefined) supabaseUpdates.linked_at = updates.linkedAt;

  if (updates.registrationLocation) {
    supabaseUpdates.registration_lat = updates.registrationLocation.lat ?? null;
    supabaseUpdates.registration_lng = updates.registrationLocation.lng ?? null;
    supabaseUpdates.registration_location = {
      lat: updates.registrationLocation.lat ?? null,
      lng: updates.registrationLocation.lng ?? null,
      radius: Math.max(20, Number(updates.registrationLocation.radius || updates.registrationRadius || 40)),
      address: updates.registrationAddress || updates.registrationLocation.address,
    };
  }
  if (updates.registrationAddress !== undefined) {
    supabaseUpdates.registration_address = updates.registrationAddress;
  }

  // 1. Primary path: Service role endpoint /api/employees
  try {
    const res = await fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traineeIds: ids,
        updates: {
          ...updates,
          ...supabaseUpdates,
        },
      }),
    });
    if (res.ok) {
      return true;
    }
  } catch (apiErr) {
    console.warn('API endpoint /api/employees batch error, falling back to direct Supabase:', apiErr);
  }

  // 2. Direct Supabase client fallback
  try {
    const uuidIds = ids.filter(isUuid);
    const nonUuidIds = ids.filter((id) => !isUuid(id));

    const promises: Promise<any>[] = [];
    if (uuidIds.length > 0) {
      promises.push(Promise.resolve(supabase.from('employees').update(supabaseUpdates).in('id', uuidIds)));
    }
    if (nonUuidIds.length > 0) {
      promises.push(Promise.resolve(supabase.from('employees').update(supabaseUpdates).in('employee_id', nonUuidIds)));
    }
    const results = await Promise.all(promises);
    const error = results.find((r) => r.error)?.error;
    if (error) {
      console.error('Direct Supabase batch update error:', error);
      return false;
    }
    return true;
  } catch (directErr) {
    console.error('Direct Supabase batch update exception:', directErr);
    return false;
  }
}

export async function deleteEmployee(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  // 1. Primary path: Service role endpoint /api/employees
  try {
    const res = await fetch(`/api/employees?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;
  } catch (apiErr) {
    console.warn('API endpoint /api/employees DELETE error, falling back to direct Supabase:', apiErr);
  }

  try {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const isUuidVal = isUuid(id);

    // Delete from employees table
    let empQuery = supabase.from('employees').delete();
    if (isUuidVal) {
      empQuery = empQuery.eq('id', id);
    } else {
      empQuery = empQuery.eq('employee_id', id);
    }
    const { error: empError } = await empQuery;
    if (empError) {
      console.warn('Error deleting employee row:', empError);
    }

    // Also delete any corresponding host supervisor entry
    let hostQuery = supabase.from('host_supervisors').delete();
    if (isUuidVal) {
      hostQuery = hostQuery.eq('id', id);
    } else {
      hostQuery = hostQuery.eq('employee_id', id);
    }
    const { error: hostError } = await hostQuery;
    if (hostError) {
      console.debug('No host_supervisor row to delete or notice:', hostError);
    }

    return true;
  } catch (err) {
    console.error('deleteEmployee exception:', err);
    return false;
  }
}

// ─── Time Records ────────────────────────────────────────────────────────────

let _allTimeRecordsCache: {
  data: TimeRecord[] | null;
  expiresAt: number;
  inflight: Promise<TimeRecord[]> | null;
} = { data: null, expiresAt: 0, inflight: null };

const _empTimeRecordsCache = new Map<
  string,
  { data?: TimeRecord[]; expiresAt: number; inflight?: Promise<TimeRecord[]> }
>();

function safeMergeRecordHours(a?: number, b?: number): number {
  const ha = Number(a) > 16 ? 0 : Number(a) || 0;
  const hb = Number(b) > 16 ? 0 : Number(b) || 0;
  return Math.max(ha, hb);
}

export async function fetchTimeRecords(): Promise<TimeRecord[]> {
  if (_allTimeRecordsCache.data && _allTimeRecordsCache.expiresAt > Date.now()) {
    return _allTimeRecordsCache.data;
  }
  if (_allTimeRecordsCache.inflight) {
    return _allTimeRecordsCache.inflight;
  }

  const run = (async (): Promise<TimeRecord[]> => {
    const storagePromise = fetchDttrStoreFromStorage()
      .then((s) => (Array.isArray(s.timeRecords) ? s.timeRecords : []))
      .catch(() => [] as TimeRecord[]);

    const dbPromise = (async (): Promise<TimeRecord[]> => {
      let apiNotMounted = false;
      // 1. Primary path: Service role endpoint /api/time-records
      if (typeof window !== 'undefined') {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5500);
          const res = await fetch('/api/time-records', { signal: controller.signal });
          clearTimeout(timer);
          if (res.status === 404) {
            apiNotMounted = true;
          } else if (res.ok) {
            const apiData = await res.json();
            return Array.isArray(apiData) ? apiData.map(transformSupabaseTimeRecord) : [];
          } else {
            return [];
          }
        } catch {
          return [];
        }
      }

      // 2. Standalone local Vite dev fallback only (when /api/time-records is 404)
      if (!isSupabaseConfigured() || (typeof window !== 'undefined' && !apiNotMounted)) return [];

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const { data, error } = await supabase
          .from('time_records')
          .select('id,employee_id,date,time_in,time_out,time_in_lat,time_in_lng,time_out_lat,time_out_lng,time_in_geofenced,time_out_geofenced,time_in_face_verified,time_out_face_verified,total_hours,status,notes')
          .order('date', { ascending: false })
          .limit(300)
          .abortSignal(controller.signal);
        clearTimeout(timer);
        if (!error && data && data.length > 0) {
          return data.map(transformSupabaseTimeRecord);
        }
      } catch {}

      return [];
    })();

    const [storageRecords, dbRecords] = await Promise.all([storagePromise, dbPromise]);
    let merged: TimeRecord[];
    if (storageRecords.length === 0) {
      merged = dbRecords;
    } else if (dbRecords.length === 0) {
      merged = storageRecords;
    } else {
      const map = new Map<string, TimeRecord>();
      for (const s of storageRecords) {
        if (!s) continue;
        const dateKey = (s.date || '').split('T')[0].trim();
        const key = `${(s.employeeId || '').toLowerCase()}_${dateKey}`;
        map.set(key, s);
      }
      for (const r of dbRecords) {
        if (!r) continue;
        const dateKey = (r.date || '').split('T')[0].trim();
        const key = `${(r.employeeId || '').toLowerCase()}_${dateKey}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, r);
        } else {
          map.set(key, {
            ...existing,
            ...r,
            id: r.id && !r.id.startsWith('rec-') ? r.id : existing.id,
            timeIn: r.timeIn || existing.timeIn,
            timeOut: r.timeOut || existing.timeOut,
            amArrival: r.amArrival || existing.amArrival,
            amDeparture: r.amDeparture || existing.amDeparture,
            pmArrival: r.pmArrival || existing.pmArrival,
            pmDeparture: r.pmDeparture || existing.pmDeparture,
            totalHours: safeMergeRecordHours(r.totalHours, existing.totalHours),
            notes: r.notes && r.notes.trim() ? r.notes : existing.notes,
            timeInPhoto: r.timeInPhoto || existing.timeInPhoto,
            timeOutPhoto: r.timeOutPhoto || existing.timeOutPhoto,
          });
        }
      }
      merged = Array.from(map.values());
    }

    if (merged.length > 0) {
      _allTimeRecordsCache = { data: merged, expiresAt: Date.now() + 5000, inflight: null };
    }
    return merged;
  })().finally(() => {
    _allTimeRecordsCache.inflight = null;
  });

  _allTimeRecordsCache.inflight = run;
  return run;
}

export async function fetchTimeRecordsForEmployee(
  employeeId: string,
  altIds: string[] = []
): Promise<TimeRecord[]> {
  const allIds = Array.from(
    new Set([employeeId, ...altIds].map((s) => (s || '').trim()).filter(Boolean))
  );
  if (allIds.length === 0) return [];

  const cacheKey = allIds
    .map((s) => s.toLowerCase())
    .sort()
    .join('|');
  const cachedEntry = _empTimeRecordsCache.get(cacheKey);
  if (cachedEntry?.data && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.data;
  }
  if (cachedEntry?.inflight) {
    return cachedEntry.inflight;
  }

  const lowerSet = new Set(allIds.map((id) => id.toLowerCase()));

  const run = (async (): Promise<TimeRecord[]> => {
    // 1. Fetch from DTTR store in Supabase Storage CDN
    const storagePromise = fetchDttrStoreFromStorage()
      .then((s) => {
        const records = Array.isArray(s.timeRecords) ? s.timeRecords : [];
        return records.filter((r) => r?.employeeId && lowerSet.has(r.employeeId.toLowerCase()));
      })
      .catch(() => [] as TimeRecord[]);

    // 2. Fetch from /api/time-records (never falls through to uncancelled 90s browser PostgREST 522 calls)
    const dbPromise = (async (): Promise<TimeRecord[]> => {
      let apiNotMounted = false;
      if (typeof window !== 'undefined') {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5500);
          const url = `/api/time-records?employeeIds=${encodeURIComponent(allIds.join(','))}&limit=500`;
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (res.status === 404) {
            apiNotMounted = true;
          } else if (res.ok) {
            const apiData = await res.json();
            return Array.isArray(apiData) ? apiData.map(transformSupabaseTimeRecord) : [];
          } else {
            return [];
          }
        } catch {
          return [];
        }
      }

      if (!isSupabaseConfigured() || (typeof window !== 'undefined' && !apiNotMounted)) return [];

      try {
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
        const uuidIds = allIds.filter(isUUID);
        if (uuidIds.length === 0) return [];

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const { data, error } = await supabase
          .from('time_records')
          .select('id,employee_id,date,time_in,time_out,time_in_lat,time_in_lng,time_out_lat,time_out_lng,time_in_geofenced,time_out_geofenced,time_in_face_verified,time_out_face_verified,total_hours,status,notes')
          .in('employee_id', uuidIds)
          .order('date', { ascending: false })
          .limit(300)
          .abortSignal(controller.signal);
        clearTimeout(timer);
        if (!error && data && data.length > 0) {
          return data.map(transformSupabaseTimeRecord);
        }
      } catch {}

      return [];
    })();

    const [storageRecords, dbRecords] = await Promise.all([storagePromise, dbPromise]);
    let merged: TimeRecord[];
    if (storageRecords.length === 0) {
      merged = dbRecords;
    } else if (dbRecords.length === 0) {
      merged = storageRecords;
    } else {
      const map = new Map<string, TimeRecord>();
      for (const s of storageRecords) {
        if (!s) continue;
        const dateKey = (s.date || '').split('T')[0].trim();
        map.set(dateKey, s);
      }
      for (const r of dbRecords) {
        if (!r) continue;
        const dateKey = (r.date || '').split('T')[0].trim();
        const existing = map.get(dateKey);
        if (!existing) {
          map.set(dateKey, r);
        } else {
          map.set(dateKey, {
            ...existing,
            ...r,
            id: r.id && !r.id.startsWith('rec-') ? r.id : existing.id,
            timeIn: r.timeIn || existing.timeIn,
            timeOut: r.timeOut || existing.timeOut,
            amArrival: r.amArrival || existing.amArrival,
            amDeparture: r.amDeparture || existing.amDeparture,
            pmArrival: r.pmArrival || existing.pmArrival,
            pmDeparture: r.pmDeparture || existing.pmDeparture,
            totalHours: safeMergeRecordHours(r.totalHours, existing.totalHours),
            notes: r.notes && r.notes.trim() ? r.notes : existing.notes,
          });
        }
      }
      merged = Array.from(map.values());
    }

    if (merged.length > 0) {
      _empTimeRecordsCache.set(cacheKey, { data: merged, expiresAt: Date.now() + 5000 });
    } else {
      _empTimeRecordsCache.delete(cacheKey);
    }
    return merged;
  })();

  _empTimeRecordsCache.set(cacheKey, { expiresAt: Date.now() + 5000, inflight: run });
  return run;
}

export function encodeSlotNotes(existingNotes: string | null | undefined, record: Partial<TimeRecord>): string | null {
  const existingSlots = extractSlotNotes(existingNotes);
  const slots: Record<string, any> = { ...existingSlots };
  if (record.amArrival) slots.amArrival = record.amArrival;
  if (record.amDeparture) slots.amDeparture = record.amDeparture;
  if (record.pmArrival) slots.pmArrival = record.pmArrival;
  if (record.pmDeparture) slots.pmDeparture = record.pmDeparture;
  if (record.amArrivalFaceVerified) slots.amArrivalFaceVerified = true;
  if (record.amDepartureFaceVerified) slots.amDepartureFaceVerified = true;
  if (record.pmArrivalFaceVerified) slots.pmArrivalFaceVerified = true;
  if (record.pmDepartureFaceVerified) slots.pmDepartureFaceVerified = true;
  if (record.amArrivalGeofenced) slots.amArrivalGeofenced = true;
  if (record.amDepartureGeofenced) slots.amDepartureGeofenced = true;
  if (record.pmArrivalGeofenced) slots.pmArrivalGeofenced = true;
  if (record.pmDepartureGeofenced) slots.pmDepartureGeofenced = true;
  if (record.approvalStatus) slots.approvalStatus = record.approvalStatus;
  if (record.approvedBy) slots.approvedBy = record.approvedBy;
  if (record.approvedAt) slots.approvedAt = record.approvedAt;
  if (record.approvalNote) slots.approvalNote = record.approvalNote;

  if (Object.keys(slots).length === 0) return existingNotes || null;

  const baseNote = (existingNotes || '').replace(/\s*\[slots:.*?\]/g, '').trim();
  const slotTag = `[slots:${JSON.stringify(slots)}]`;
  return baseNote ? `${baseNote} ${slotTag}` : slotTag;
}

export function extractSlotNotes(notes?: string | null): Record<string, any> {
  if (!notes || typeof notes !== 'string') return {};
  const match = notes.match(/\[slots:(.*?)\]/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }
  return {};
}

function parseTimeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const match = t.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  return null;
}

export async function resolveEmployeeUuid(empIdOrCode?: string): Promise<string | null> {
  if (!empIdOrCode) return null;
  const trimmed = String(empIdOrCode).trim();
  if (!trimmed || /^(emp-\d+|demo-|mock-|seed-)/i.test(trimmed)) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) return trimmed;

  try {
    let q = supabase.from('employees').select('id').limit(1);
    if (trimmed.includes('@')) {
      q = q.eq('email', trimmed.toLowerCase());
    } else {
      q = q.eq('employee_id', trimmed);
    }
    const { data: matched } = await q.maybeSingle();
    if (matched?.id && uuidRegex.test(matched.id)) return matched.id;
  } catch (e) {
    console.warn('resolveEmployeeUuid notice:', e);
  }
  return null;
}

export async function createTimeRecord(record: Omit<TimeRecord, 'id'>): Promise<TimeRecord | null> {
  if (!record?.employeeId || /^(emp-\d+|demo-|mock-|seed-)/i.test(String(record.employeeId).trim())) {
    return null;
  }

  // 1. Primary path: Fast server-side proxy using service role key (bypasses RLS)
  if (typeof window !== 'undefined') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const apiRes = await fetch('/api/time-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (apiRes.ok) {
        const resData = await apiRes.json();
        const saved = Array.isArray(resData?.records) ? resData.records[0] : (resData?.id ? resData : null);
        if (saved && (saved.id || saved.employee_id || saved.employeeId)) {
          const transformed = transformSupabaseTimeRecord(saved);
          saveDttrStoreToStorage({ timeRecords: [transformed] }).catch(() => {});
          return transformed;
        }
        // Server explicitly skipped record because employee_id could not be resolved to an existing UUID
        if (resData?.success === true && resData?.count === 0) {
          return null;
        }
      }
    } catch {}
  }

  if (!isSupabaseConfigured()) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const resolvedEmpId = await resolveEmployeeUuid(record.employeeId);
  if (!resolvedEmpId || !uuidRegex.test(resolvedEmpId)) {
    return null;
  }
  const cleanDate = record.date ? String(record.date).split('T')[0] : new Date().toISOString().split('T')[0];

  // Idempotency guard: if a "Time In" request fires twice (retry, double-tap),
  // don't create a second open session — return the existing one instead.
  if (record.timeIn && !record.timeOut) {
    const { data: existingOpen } = await supabase
      .from('time_records')
      .select('*')
      .eq('employee_id', resolvedEmpId)
      .eq('date', cleanDate)
      .is('time_out', null)
      .order('time_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOpen) {
      console.warn('[Idempotency] Open time-in record already exists for today — returning existing record instead of duplicating.');
      return transformSupabaseTimeRecord(existingOpen);
    }
  }

  const effectiveTimeIn = record.timeIn || record.amArrival || record.pmArrival || null;
  const effectiveTimeOut = record.timeOut || record.pmDeparture || record.amDeparture || null;

  const baseRecord: any = {
    employee_id: resolvedEmpId,
    date: cleanDate,
    time_in: effectiveTimeIn,
    time_out: effectiveTimeOut,
    total_hours: record.totalHours ?? 0,
    status: record.status || 'present',
    notes: encodeSlotNotes(record.notes, record),
    time_in_geofenced: Boolean(record.timeInGeofenced || record.amArrivalGeofenced || record.pmArrivalGeofenced),
    time_out_geofenced: Boolean(record.timeOutGeofenced || record.pmDepartureGeofenced || record.amDepartureGeofenced),
    time_in_face_verified: Boolean(record.timeInFaceVerified || record.amArrivalFaceVerified || record.pmArrivalFaceVerified),
    time_out_face_verified: Boolean(record.timeOutFaceVerified || record.pmDepartureFaceVerified || record.amDepartureFaceVerified),
    time_in_lat: record.timeInLocation?.lat != null ? Number(record.timeInLocation.lat) : null,
    time_in_lng: record.timeInLocation?.lng != null ? Number(record.timeInLocation.lng) : null,
    time_out_lat: record.timeOutLocation?.lat != null ? Number(record.timeOutLocation.lat) : null,
    time_out_lng: record.timeOutLocation?.lng != null ? Number(record.timeOutLocation.lng) : null,
  };

  if (record.timeInPhoto && record.timeInPhoto.startsWith('http')) {
    baseRecord.time_in_photo = record.timeInPhoto;
  }
  if (record.timeOutPhoto && record.timeOutPhoto.startsWith('http')) {
    baseRecord.time_out_photo = record.timeOutPhoto;
  }

  let insertResult = await supabase.from('time_records').insert([baseRecord]).select().single();

  // Resilience fallback: Core columns only if extended metadata columns don't exist yet
  if (insertResult.error) {
    const coreRecord: any = {
      employee_id: resolvedEmpId,
      date: cleanDate,
      time_in: effectiveTimeIn,
      time_out: effectiveTimeOut,
      total_hours: record.totalHours ?? 0,
      status: record.status || 'present',
      notes: baseRecord.notes || record.notes || null,
    };
    if (baseRecord.time_in_photo) coreRecord.time_in_photo = baseRecord.time_in_photo;
    if (baseRecord.time_out_photo) coreRecord.time_out_photo = baseRecord.time_out_photo;
    insertResult = await supabase.from('time_records').insert([coreRecord]).select().single();
  }

  if (insertResult.error) {
    console.error('Error creating time record in Supabase:', insertResult.error);
    throw new Error(insertResult.error.message || JSON.stringify(insertResult.error));
  }

  return transformSupabaseTimeRecord({
    ...insertResult.data,
    academic_year: record.academicYear,
    am_arrival: record.amArrival,
    am_departure: record.amDeparture,
    pm_arrival: record.pmArrival,
    pm_departure: record.pmDeparture,
    am_arrival_face_verified: record.amArrivalFaceVerified,
    am_departure_face_verified: record.amDepartureFaceVerified,
    pm_arrival_face_verified: record.pmArrivalFaceVerified,
    pm_departure_face_verified: record.pmDepartureFaceVerified,
    am_arrival_geofenced: record.amArrivalGeofenced,
    am_departure_geofenced: record.amDepartureGeofenced,
    pm_arrival_geofenced: record.pmArrivalGeofenced,
    pm_departure_geofenced: record.pmDepartureGeofenced,
  });
}

export async function updateTimeRecord(id: string, updates: Partial<TimeRecord>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabaseUpdates: any = {};
  if (updates.timeIn !== undefined) supabaseUpdates.time_in = updates.timeIn;
  if (updates.timeOut !== undefined) supabaseUpdates.time_out = updates.timeOut;
  if (updates.timeInLocation !== undefined) {
    supabaseUpdates.time_in_lat = updates.timeInLocation?.lat;
    supabaseUpdates.time_in_lng = updates.timeInLocation?.lng;
  }
  if (updates.timeOutLocation !== undefined) {
    supabaseUpdates.time_out_lat = updates.timeOutLocation?.lat;
    supabaseUpdates.time_out_lng = updates.timeOutLocation?.lng;
  }
  if (updates.timeInGeofenced !== undefined) supabaseUpdates.time_in_geofenced = updates.timeInGeofenced;
  if (updates.timeOutGeofenced !== undefined) supabaseUpdates.time_out_geofenced = updates.timeOutGeofenced;
  if (updates.timeInFaceVerified !== undefined) supabaseUpdates.time_in_face_verified = updates.timeInFaceVerified;
  if (updates.timeOutFaceVerified !== undefined) supabaseUpdates.time_out_face_verified = updates.timeOutFaceVerified;
  if ('timeInPhoto' in updates) {
    if (!updates.timeInPhoto || updates.timeInPhoto === 'null') {
      supabaseUpdates.time_in_photo = null;
    } else if (typeof updates.timeInPhoto === 'string' && (updates.timeInPhoto.startsWith('http') || updates.timeInPhoto.startsWith('data:image'))) {
      supabaseUpdates.time_in_photo = updates.timeInPhoto;
    }
  }
  if ('timeOutPhoto' in updates) {
    if (!updates.timeOutPhoto || updates.timeOutPhoto === 'null') {
      supabaseUpdates.time_out_photo = null;
    } else if (typeof updates.timeOutPhoto === 'string' && (updates.timeOutPhoto.startsWith('http') || updates.timeOutPhoto.startsWith('data:image'))) {
      supabaseUpdates.time_out_photo = updates.timeOutPhoto;
    }
  }
  if (updates.totalHours !== undefined) supabaseUpdates.total_hours = updates.totalHours;
  if (updates.status !== undefined) supabaseUpdates.status = updates.status;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const hasSlotUpdate =
    updates.amArrival !== undefined ||
    updates.amDeparture !== undefined ||
    updates.pmArrival !== undefined ||
    updates.pmDeparture !== undefined;

  const hasApprovalMeta =
    updates.approvalStatus !== undefined ||
    updates.approvedBy !== undefined ||
    updates.approvedAt !== undefined ||
    updates.approvalNote !== undefined;

  if (updates.notes !== undefined || hasSlotUpdate || hasApprovalMeta) {
    // Load the current DB notes so previously saved punch slots ([slots:{...}]) and tasks are never lost
    let existingDbNotes: string | null = null;
    try {
      if (isUuid) {
        const { data: cur } = await supabase.from('time_records').select('notes').eq('id', id).maybeSingle();
        existingDbNotes = cur?.notes ?? null;
      } else if (updates.employeeId) {
        const empUuid = await resolveEmployeeUuid(updates.employeeId);
        if (empUuid) {
          const d = updates.date ? String(updates.date).split('T')[0] : new Date().toISOString().split('T')[0];
          const { data: cur } = await supabase
            .from('time_records')
            .select('notes')
            .eq('employee_id', empUuid)
            .eq('date', d)
            .limit(1)
            .maybeSingle();
          existingDbNotes = cur?.notes ?? null;
        }
      }
    } catch {}

    const stripSlots = (n?: string | null) => (n || '').replace(/\s*\[slots:.*?\]/g, '').trim();
    const existingSlots = extractSlotNotes(existingDbNotes);
    const baseNote = updates.notes !== undefined ? stripSlots(updates.notes) : stripSlots(existingDbNotes);
    const seed = Object.keys(existingSlots).length
      ? `${baseNote} [slots:${JSON.stringify(existingSlots)}]`.trim()
      : baseNote;
    supabaseUpdates.notes = encodeSlotNotes(seed, updates) ?? (baseNote || null);
  }

  if (Object.keys(supabaseUpdates).length === 0) {
    return true;
  }

  // 1. Primary path: Route via Service Role API endpoint /api/time-records to guarantee write permissions
  if (typeof window !== 'undefined') {
    try {
      const endpointPayload: any = {
        id: isUuid ? id : undefined,
        employee_id: updates.employeeId,
        date: updates.date,
        time_in: updates.timeIn || updates.amArrival || updates.pmArrival,
        time_out: updates.timeOut || updates.pmDeparture || updates.amDeparture,
        amArrival: updates.amArrival,
        amDeparture: updates.amDeparture,
        pmArrival: updates.pmArrival,
        pmDeparture: updates.pmDeparture,
        am_arrival: updates.amArrival,
        am_departure: updates.amDeparture,
        pm_arrival: updates.pmArrival,
        pm_departure: updates.pmDeparture,
        total_hours: updates.totalHours,
        status: updates.status,
        notes: supabaseUpdates.notes ?? updates.notes,
      };
      const apiRes = await fetch('/api/time-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endpointPayload),
      });
      if (apiRes.ok) {
        const resData = await apiRes.json().catch(() => null);
        const saved = Array.isArray(resData?.records) ? resData.records[0] : null;
        if (saved && (saved.id || saved.employee_id || saved.employeeId)) {
          saveDttrStoreToStorage({ timeRecords: [transformSupabaseTimeRecord(saved)] }).catch(() => {});
          return true;
        }
      }
    } catch (e) {
      console.warn('Endpoint /api/time-records update notice:', e);
    }
  }

  if (isUuid) {
    let res = await supabase.from('time_records').update(supabaseUpdates).eq('id', id).select();
    if (res.error) {
      const fallbackUpdates = { ...supabaseUpdates };
      delete fallbackUpdates.approval_status;
      delete fallbackUpdates.approved_by;
      delete fallbackUpdates.approved_at;
      delete fallbackUpdates.approval_note;
      res = await supabase.from('time_records').update(fallbackUpdates).eq('id', id).select();
    }
    if (res.error) {
      console.error('Error updating time record by UUID:', res.error);
    } else if (res.data && res.data.length > 0) {
      return true;
    }
  }

  // Fallback: match by employee_id and date (critical for temporary local IDs like rec-...)
  if (updates.employeeId) {
    const resolvedEmpId = await resolveEmployeeUuid(updates.employeeId);
    if (!resolvedEmpId) {
      return false;
    }
    const targetDate = updates.date ? String(updates.date).split('T')[0] : new Date().toISOString().split('T')[0];
    const res2 = await supabase
      .from('time_records')
      .update(supabaseUpdates)
      .eq('employee_id', resolvedEmpId)
      .eq('date', targetDate)
      .select();
    if (res2.data && res2.data.length > 0) {
      return true;
    }

    // Upsert fallback: If record does not exist in Supabase yet, create it now!
    try {
      const effectiveTimeIn = updates.timeIn || updates.amArrival || updates.pmArrival || null;
      const effectiveTimeOut = updates.timeOut || updates.pmDeparture || updates.amDeparture || null;
      const insertRecord: any = {
        employee_id: resolvedEmpId,
        date: targetDate,
        time_in: effectiveTimeIn,
        time_out: effectiveTimeOut,
        total_hours: updates.totalHours ?? 0,
        status: updates.status || 'present',
        notes: encodeSlotNotes(supabaseUpdates.notes || updates.notes, updates),
        time_in_geofenced: Boolean(updates.timeInGeofenced || updates.amArrivalGeofenced || updates.pmArrivalGeofenced),
        time_out_geofenced: Boolean(updates.timeOutGeofenced || updates.pmDepartureGeofenced || updates.amDepartureGeofenced),
        time_in_face_verified: Boolean(updates.timeInFaceVerified || updates.amArrivalFaceVerified || updates.pmArrivalFaceVerified),
        time_out_face_verified: Boolean(updates.timeOutFaceVerified || updates.pmDepartureFaceVerified || updates.amDepartureFaceVerified),
      };
      if (updates.timeInLocation) {
        insertRecord.time_in_lat = updates.timeInLocation.lat;
        insertRecord.time_in_lng = updates.timeInLocation.lng;
      }
      if (updates.timeOutLocation) {
        insertRecord.time_out_lat = updates.timeOutLocation.lat;
        insertRecord.time_out_lng = updates.timeOutLocation.lng;
      }
      const { data: createdRow, error: createErr } = await supabase.from('time_records').insert([insertRecord]).select();
      if (!createErr && createdRow && createdRow.length > 0) {
        return true;
      }
    } catch (upsertErr) {
      console.warn('Upsert fallback notice in updateTimeRecord:', upsertErr);
    }
  }

  return false;
}

export async function uploadFacePhoto(
  employeeId: string,
  base64Data: string,
  type: 'profile' | 'time_in' | 'time_out' = 'profile'
): Promise<string> {
  if (!isSupabaseConfigured() || !base64Data) return base64Data;

  try {
    if (base64Data.startsWith('http')) return base64Data;

    if (base64Data.startsWith('data:image')) {
      try {
        base64Data = await compressBase64Image(base64Data, 600, 0.82);
      } catch (cErr) {
        console.warn('Image compression note:', cErr);
      }
    }

    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    const cleanEmpId = (employeeId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanEmpId}/${type}_${Date.now()}.jpg`;

    // Route by photo type: profile photos go to face-photos,
    // time in/out photos go to time-records-photos.
    const primaryBucket = type === 'profile' ? 'face-photos' : 'time-records-photos';
    const bucketsToTry = [primaryBucket, 'face-photos', 'avatars'].filter(
      (b, i, arr) => arr.indexOf(b) === i
    );
    for (const bucketName of bucketsToTry) {
      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: true,
            // 'profile' photos rarely change once enrolled, so cache them long.
            // 'time_in'/'time_out' snapshots are timestamped and never overwritten
            // anyway (each has a unique filename), so a shorter cache is fine and
            // still meaningfully cuts repeat-view egress on attendance history pages.
            cacheControl: type === 'profile' ? '604800' : '86400',
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            console.log(`[Storage] Uploaded face photo to bucket "${bucketName}":`, urlData.publicUrl);
            return urlData.publicUrl;
          }
        } else if (uploadError) {
          console.warn(`[Storage] Bucket "${bucketName}" upload failed, trying next bucket:`, uploadError.message || uploadError);
        }
      } catch (bErr) {
        console.warn(`[Storage] Exception uploading to bucket "${bucketName}":`, bErr);
      }
    }

    // Server-side service-role upload fallback (essential during unauthenticated new-account registration)
    if (typeof window !== 'undefined' && base64Data.length < 4000000) {
      try {
        const srvRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            path: fileName,
            dataUrl: base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Content}`,
            contentType: 'image/jpeg',
            bucket: primaryBucket,
          }),
        });
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData?.publicUrl) return srvData.publicUrl;
        }
      } catch (srvErr) {
        console.warn('[Storage] Server face photo upload fallback notice:', srvErr);
      }
    }
  } catch (err) {
    console.debug('Direct database image storage fallback active:', err);
  }

  return base64Data;
}

// ─── Geofence Zones ──────────────────────────────────────────────────────────

const isValidUUID = (str?: string): boolean => {
  return Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
};

export async function fetchGeofenceZones(): Promise<GeofenceZone[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase.from('geofence_zones').select('*').order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data
        .filter((zone: any) => !zone.name?.toLowerCase().includes('main training center') && zone.id !== 'zone-1')
        .map((zone: any) => ({
          id: zone.id,
          name: zone.name,
          address: zone.address,
          lat: Number(zone.lat),
          lng: Number(zone.lng),
          radius: Number(zone.radius) || 100,
          active: zone.active !== false,
          academicYear: zone.academic_year || undefined,
          employeeId: zone.employee_id || zone.employeeId || undefined,
          employee_id: zone.employee_id || zone.employeeId || undefined,
        }));
    }
  } catch (err) {
    console.warn('Direct fetchGeofenceZones error:', err);
  }

  // Fallback: serverless endpoint /api/geofence-zones
  try {
    const res = await fetch('/api/geofence-zones');
    if (res.ok) {
      const apiData = await res.json();
      if (Array.isArray(apiData) && apiData.length > 0) return apiData;
    }
  } catch {}

  return [];
}

export async function createGeofenceZone(zone: Omit<GeofenceZone, 'id'> & { id?: string; employeeId?: string; employee_id?: string }): Promise<GeofenceZone | null> {
  if (!isSupabaseConfigured()) return null;

  let empId = (zone as any).employeeId || (zone as any).employee_id;
  if (!empId && zone.id) {
    const rawSuffix = zone.id.replace(/^(station|personal|trainee|inst|hte)-/, '');
    if (isValidUUID(rawSuffix)) {
      empId = rawSuffix;
    }
  }

  // 1. Primary path: Service role endpoint /api/geofence-zones (guaranteed RLS bypass and persistence)
  try {
    const res = await fetch('/api/geofence-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: zone.id,
        name: zone.name,
        address: zone.address || '',
        lat: Number(zone.lat),
        lng: Number(zone.lng),
        radius: Math.max(20, Number(zone.radius) || 40),
        active: zone.active !== false,
        academicYear: zone.academicYear,
        employeeId: empId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: data.id,
        name: data.name,
        address: data.address,
        lat: Number(data.lat),
        lng: Number(data.lng),
        radius: Number(data.radius),
        active: data.active !== false,
        academicYear: zone.academicYear,
        employeeId: empId,
        employee_id: empId,
      };
    }
  } catch (apiErr) {
    console.warn('API endpoint /api/geofence-zones POST error, falling back to direct Supabase:', apiErr);
  }

  // 2. Direct Supabase client fallback
  const payload: any = {
    name: zone.name,
    address: zone.address || '',
    lat: Number(zone.lat),
    lng: Number(zone.lng),
    radius: Math.max(20, Number(zone.radius) || 20),
    active: zone.active !== false,
  };

  if (empId && isValidUUID(empId)) {
    payload.employee_id = empId;
  }
  if (zone.id && isValidUUID(zone.id)) {
    payload.id = zone.id;
  }

  // Deduplicate: If an active zone for this employee_id or this exact name already exists, reuse its id to avoid duplicate rows
  try {
    if (payload.employee_id) {
      const { data: existing } = await supabase
        .from('geofence_zones')
        .select('id')
        .eq('employee_id', payload.employee_id)
        .limit(1);

      if (existing && existing.length > 0) {
        payload.id = existing[0].id;
      }
    } else if (payload.name) {
      const { data: existingByName } = await supabase
        .from('geofence_zones')
        .select('id')
        .eq('name', payload.name)
        .limit(1);

      if (existingByName && existingByName.length > 0) {
        payload.id = existingByName[0].id;
      }
    }
  } catch {
    // Column employee_id may be pending migration; proceed safely
  }

  let data;
  let error;

  if (payload.id) {
    const res = await supabase.from('geofence_zones').update(payload).eq('id', payload.id).select().maybeSingle();
    data = res.data;
    error = res.error;
  } else {
    const res = await supabase.from('geofence_zones').insert([payload]).select().maybeSingle();
    data = res.data;
    error = res.error;
  }

  // If failed and payload had employee_id, retry without employee_id in case column is not yet migrated in Supabase
  if (error && payload.employee_id) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.employee_id;
    if (fallbackPayload.id) {
      const retry = await supabase.from('geofence_zones').update(fallbackPayload).eq('id', fallbackPayload.id).select().maybeSingle();
      if (!retry.error && retry.data) {
        data = retry.data;
        error = null;
      }
    } else {
      const retry = await supabase.from('geofence_zones').insert([fallbackPayload]).select().maybeSingle();
      if (!retry.error && retry.data) {
        data = retry.data;
        error = null;
      }
    }
  }

  if (error || !data) {
    console.warn('Geofence zone cloud write notice in Supabase:', error?.message || error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    address: data.address,
    lat: Number(data.lat),
    lng: Number(data.lng),
    radius: Number(data.radius),
    active: data.active !== false,
    academicYear: zone.academicYear,
  };
}

export async function updateGeofenceZone(id: string, updates: Partial<GeofenceZone> & { employeeId?: string; employee_id?: string }): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  let empId = (updates as any).employeeId || (updates as any).employee_id;
  if (!empId && id) {
    const rawSuffix = id.replace(/^(station|personal|trainee|inst|hte)-/, '');
    if (isValidUUID(rawSuffix)) {
      empId = rawSuffix;
    }
  }

  // 1. Primary path: Service role endpoint /api/geofence-zones (guaranteed RLS bypass and persistence)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('/api/geofence-zones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        id,
        name: updates.name,
        address: updates.address,
        lat: updates.lat !== undefined ? Number(updates.lat) : undefined,
        lng: updates.lng !== undefined ? Number(updates.lng) : undefined,
        radius: updates.radius !== undefined ? Number(updates.radius) : undefined,
        active: updates.active,
        academicYear: updates.academicYear,
        employeeId: empId,
      }),
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return true;
    }
  } catch (apiErr) {
    console.warn('API endpoint /api/geofence-zones PUT error, falling back to direct Supabase:', apiErr);
  }

  // 2. Direct Supabase client fallback
  try {
    const supabaseUpdates: any = {};
    if (updates.name !== undefined) supabaseUpdates.name = updates.name;
    if (updates.address !== undefined) supabaseUpdates.address = updates.address;
    if (updates.lat !== undefined) supabaseUpdates.lat = Number(updates.lat);
    if (updates.lng !== undefined) supabaseUpdates.lng = Number(updates.lng);
    if (updates.radius !== undefined) supabaseUpdates.radius = Number(updates.radius);
    if (updates.active !== undefined) supabaseUpdates.active = updates.active;
    if (empId && isValidUUID(empId)) supabaseUpdates.employee_id = empId;

    if (isValidUUID(id)) {
      const { data: updatedRows, error } = await supabase.from('geofence_zones').update(supabaseUpdates).eq('id', id).select();
      if (!error && updatedRows && updatedRows.length > 0) return true;
    }

    // Match by employee_id if available
    if (empId) {
      try {
        const { data: matchedEmp } = await supabase.from('geofence_zones').select('id').eq('employee_id', empId).limit(1);
        if (matchedEmp && matchedEmp.length > 0) {
          const { data: updatedRows, error } = await supabase.from('geofence_zones').update(supabaseUpdates).eq('id', matchedEmp[0].id).select();
          if (!error && updatedRows && updatedRows.length > 0) return true;
        }
      } catch {}
    }

    if (updates.name) {
      const { data: matched } = await supabase.from('geofence_zones').select('id').eq('name', updates.name).limit(1);
      if (matched && matched.length > 0 && isValidUUID(matched[0].id)) {
        const { data: updatedRows, error } = await supabase.from('geofence_zones').update(supabaseUpdates).eq('id', matched[0].id).select();
        if (!error && updatedRows && updatedRows.length > 0) return true;
      }
    }

    // If not yet present in geofence_zones table, create record with resolved coordinates
    if (updates.lat && updates.lng) {
      await createGeofenceZone({
        id: isValidUUID(id) ? id : undefined,
        name: updates.name || 'Workplace Geofence Zone',
        address: updates.address || '',
        lat: Number(updates.lat),
        lng: Number(updates.lng),
        radius: Math.max(20, Number(updates.radius) || 40),
        active: updates.active !== false,
        academicYear: updates.academicYear,
        employeeId: empId,
      } as any);
    }
  } catch (sbErr) {
    console.warn('Direct Supabase geofence update note:', sbErr);
  }

  return true;
}

export async function deleteGeofenceZone(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  // 1. Primary path: Service role endpoint /api/geofence-zones
  try {
    await fetch(`/api/geofence-zones?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {}

  try {
    const isUuid = isValidUUID(id);
    if (isUuid) {
      await supabase.from('geofence_zones').delete().eq('id', id);
    }

    const cleanId = id
      .replace(/^personal-/, '')
      .replace(/^station-/, '')
      .replace(/^hte-/, '')
      .replace(/^inst-/, '')
      .replace(/^trainee-/, '');
    if (cleanId !== id && isValidUUID(cleanId)) {
      await supabase.from('geofence_zones').delete().eq('id', cleanId);
    }

    // Restore pre-existing behavior: clear employee assigned workplace coordinates in Supabase
    // Uses verified live columns: registration_lat, registration_lng, registration_address
    if (cleanId) {
      const isCleanUuid = isValidUUID(cleanId);
      let query = supabase.from('employees').update({
        registration_lat: null,
        registration_lng: null,
        registration_address: null,
      });

      if (isCleanUuid) {
        query = query.or(`id.eq.${cleanId},employee_id.eq.${cleanId}`);
      } else {
        query = query.eq('employee_id', cleanId);
      }

      const { error: empUpdateErr } = await query;
      if (empUpdateErr) {
        console.warn('Notice clearing employee coordinates on zone deletion:', empUpdateErr.message);
      }
    }

    return true;
  } catch (err: any) {
    console.error('Error in deleteGeofenceZone:', err);
    throw new Error(err.message || 'Failed to delete geofence zone');
  }
}

// Migration helper: update any employees/announcements that still use 'Administrator' position/name
export async function migrateAdministratorPosition(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const { error: updateErr } = await supabase
      .from('employees')
      .update({ position: 'OJT Instructor' })
      .eq('position', 'Administrator');
    if (updateErr) console.error('Error migrating employee positions:', updateErr);

    const { error: annErr } = await supabase
      .from('announcements')
      .update({ created_by: 'OJT Instructor' })
      .eq('created_by', 'Administrator');
    if (annErr) console.error('Error migrating announcements created_by:', annErr);

    return 1;
  } catch (e) {
    console.error('migrateAdministratorPosition failed:', e);
    return 0;
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function fetchAcademicSettingsFromStorage(forceFresh = false): Promise<{
  academicYears?: string[];
  activeAcademicYear?: string;
  academicYearHours?: Record<string, number>;
  updatedAt?: string;
} | null> {
  if (!forceFresh && _storesBootstrapCache.data?.academicSettings && _storesBootstrapCache.expiresAt > Date.now()) {
    return _storesBootstrapCache.data.academicSettings;
  }

  try {
    const res = await fetch(`/api/documents?action=get-academic-settings${forceFresh ? '&fresh=1' : ''}`, {
      cache: forceFresh ? 'no-store' : 'default',
    });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {}

  try {
    const base = (import.meta.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co').replace(/\/$/, '');
    const pubUrl = `${base}/storage/v1/object/public/face-photos/settings/academic_settings_store.json${forceFresh ? `?t=${Date.now()}` : ''}`;
    const pubRes = await fetch(pubUrl);
    if (pubRes.ok) {
      const parsed = await pubRes.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}

  return null;
}

export async function fetchSettings(forceFresh = false): Promise<AppSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const [dbSettled, cloudAcademicSettled] = await Promise.allSettled([
    supabase.from('app_settings').select('*').maybeSingle(),
    fetchAcademicSettingsFromStorage(forceFresh),
  ]);

  let data: any = null;
  if (dbSettled.status === 'fulfilled' && !dbSettled.value.error) {
    data = dbSettled.value.data;
  }
  const cloudAcademic = cloudAcademicSettled.status === 'fulfilled' ? cloudAcademicSettled.value : null;

  let localSettings: Partial<AppSettings> = {};
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('ojt_settings') : null;
    if (raw) {
      localSettings = JSON.parse(raw) || {};
    }
  } catch {}

  if (!data && !cloudAcademic) {
    return Object.keys(localSettings).length > 0 ? (localSettings as AppSettings) : null;
  }

  const localAcademicYears =
    Array.isArray(localSettings.academicYears) && localSettings.academicYears.length > 0
      ? localSettings.academicYears
      : ['2025-2026', '2026-2027'];
  const localActiveYear = localSettings.activeAcademicYear || '2026-2027';

  const resolvedYears = Array.from(
    new Set([
      ...(Array.isArray(cloudAcademic?.academicYears) ? cloudAcademic!.academicYears! : []),
      ...(Array.isArray(data?.academic_years) ? data.academic_years : []),
      ...localAcademicYears,
      '2025-2026',
      '2026-2027',
    ])
  );

  const mergedHours: Record<string, number> = {};
  const rawHoursSources = [
    localSettings.academicYearHours,
    data?.academic_year_hours,
    cloudAcademic?.academicYearHours,
  ];
  for (const src of rawHoursSources) {
    if (src && typeof src === 'object') {
      for (const [yr, hrs] of Object.entries(src)) {
        const n = Math.round(Number(hrs));
        if (Number.isFinite(n) && n > 0) {
          mergedHours[yr] = n;
        }
      }
    }
  }
  for (const yr of resolvedYears) {
    if (!mergedHours[yr]) mergedHours[yr] = TRAINEE_REQUIRED_HOURS;
  }

  return {
    workStartTime: data?.work_start_time || localSettings.workStartTime || '08:00',
    workEndTime: data?.work_end_time || localSettings.workEndTime || '17:00',
    lateThresholdMinutes: data?.late_threshold_minutes ?? localSettings.lateThresholdMinutes ?? 15,
    geofenceEnabled: data?.geofence_enabled ?? localSettings.geofenceEnabled ?? true,
    facialRecognitionEnabled: data?.facial_recognition_enabled ?? localSettings.facialRecognitionEnabled ?? true,
    academicYears: resolvedYears,
    activeAcademicYear: cloudAcademic?.activeAcademicYear || data?.active_academic_year || localActiveYear || '2026-2027',
    academicYearHours: mergedHours,
  };
}

export async function updateSettings(
  settings: AppSettings,
  options?: { syncAcademicYear?: string; syncHours?: number }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  _storesBootstrapCache = { data: null, expiresAt: 0 };
  _coreBootstrapCache = { data: null, expiresAt: 0 };

  broadcastLiveEvent('settings_updated', {
    settings,
    syncAcademicYear: options?.syncAcademicYear,
    syncHours: options?.syncHours,
  });

  let savedAcademicStore = false;
  try {
    const apiRes = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save-academic-settings',
        academicYears: settings.academicYears,
        activeAcademicYear: settings.activeAcademicYear,
        academicYearHours: settings.academicYearHours,
        syncAcademicYear: options?.syncAcademicYear,
        syncHours: options?.syncHours,
      }),
    });
    if (apiRes.ok) {
      savedAcademicStore = true;
    } else if (apiRes.status === 404) {
      const payload = {
        academicYears: settings.academicYears,
        activeAcademicYear: settings.activeAcademicYear,
        academicYearHours: settings.academicYearHours || {},
        updatedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const { error: stErr } = await supabase.storage
        .from('face-photos')
        .upload('settings/academic_settings_store.json', blob, {
          contentType: 'application/json',
          cacheControl: '60',
          upsert: true,
        });
      if (!stErr) savedAcademicStore = true;
    }
  } catch (acErr) {
    console.warn('updateSettings academic store sync notice:', acErr);
  }

  // Only send verified live columns in public.app_settings
  const supabaseSettings = {
    work_start_time: settings.workStartTime,
    work_end_time: settings.workEndTime,
    late_threshold_minutes: settings.lateThresholdMinutes,
    geofence_enabled: settings.geofenceEnabled,
    facial_recognition_enabled: settings.facialRecognitionEnabled,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError, count } = await supabase.from('app_settings').update(supabaseSettings).eq('id', 1);

  if (updateError || count === 0) {
    const { error: insertError } = await supabase.from('app_settings').insert([{ id: 1, ...supabaseSettings }]);

    if (insertError && !savedAcademicStore) {
      console.error('Error inserting settings in Supabase:', insertError);
      throw new Error(insertError.message || 'Failed to save settings');
    }
  }

  return true;
}

// ─── Evaluations ─────────────────────────────────────────────────────────────

const CHMSU_EVAL_META_TAG = '<!--CHMSU_EVAL_META-->';

function packEvaluationMeta(recommendations?: string, extra?: any): string {
  const cleanRec = (recommendations || '').split(CHMSU_EVAL_META_TAG)[0].trim();
  if (!extra || Object.keys(extra).length === 0) return cleanRec;
  return `${cleanRec}\n\n${CHMSU_EVAL_META_TAG}\n${JSON.stringify(extra)}`;
}

function unpackEvaluationMeta(rawRecommendations?: string): {
  recommendations: string;
  ratings?: Record<string, number>;
  ratingComments?: Record<string, string>;
  commentsSuggestions?: string;
  overallRating?: number;
  questionnaire?: any;
  status?: Evaluation['status'];
} {
  if (!rawRecommendations) {
    return { recommendations: '' };
  }
  if (!rawRecommendations.includes(CHMSU_EVAL_META_TAG)) {
    return { recommendations: rawRecommendations };
  }
  const [cleanRec, jsonPart] = rawRecommendations.split(CHMSU_EVAL_META_TAG);
  try {
    const parsed = JSON.parse(jsonPart.trim());
    return {
      recommendations: cleanRec.trim(),
      ratings: parsed.ratings,
      ratingComments: parsed.ratingComments,
      commentsSuggestions: parsed.commentsSuggestions,
      overallRating: parsed.overallRating,
      questionnaire: parsed.questionnaire,
      status: parsed.status,
    };
  } catch {
    return { recommendations: cleanRec.trim() };
  }
}

export async function fetchEvaluations(): Promise<Evaluation[]> {
  const storagePromise = fetchEvaluationsFromStorage().catch(() => [] as Evaluation[]);

  const dbPromise = (async (): Promise<Evaluation[]> => {
    if (!isSupabaseConfigured()) return [];
    try {
      const queryPromise = supabase.from('evaluations').select('*').order('evaluated_at', { ascending: false });
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 5000)
      );
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      if (error || !data) return [];

      return (data || []).map((evaluation: any) => {
        const unpacked = unpackEvaluationMeta(evaluation.recommendations);
        return {
          id: evaluation.id,
          employeeId: evaluation.employee_id,
          evaluatedBy: evaluation.evaluated_by,
          attendanceScore: evaluation.attendance_score,
          performanceScore: evaluation.performance_score,
          attitudeScore: evaluation.attitude_score,
          punctualityScore: evaluation.punctuality_score,
          communicationScore: evaluation.communication_score,
          overallScore: evaluation.overall_score,
          grade: evaluation.grade,
          strengths: evaluation.strengths,
          areasForImprovement: evaluation.areas_for_improvement,
          recommendations: unpacked.recommendations,
          ratings: unpacked.ratings,
          ratingComments: unpacked.ratingComments,
          commentsSuggestions: unpacked.commentsSuggestions,
          overallRating: unpacked.overallRating,
          questionnaire: unpacked.questionnaire,
          evaluatedAt: evaluation.evaluated_at,
          status: unpacked.status || evaluation.status,
          academicYear: evaluation.academic_year,
        };
      });
    } catch {
      return [];
    }
  })();

  const [storageEvals, dbEvals] = await Promise.all([storagePromise, dbPromise]);
  return mergeEvaluationsList(storageEvals, dbEvals);
}

export async function createEvaluation(evaluation: Omit<Evaluation, 'id'>): Promise<Evaluation | null> {
  if (!isSupabaseConfigured()) return null;

  // Live schema check constraint: CHECK (status IN ('draft', 'final'))
  let dbStatus = evaluation.status;
  if (
    dbStatus === 'submitted_to_instructor' ||
    dbStatus === 'reviewed_by_instructor' ||
    dbStatus === 'submitted_by_trainee' ||
    dbStatus === 'passed_to_hte'
  ) {
    dbStatus = 'final';
  } else if (dbStatus !== 'final' && dbStatus !== 'draft') {
    dbStatus = 'final';
  }

  const metaPayload = {
    ratings: evaluation.ratings,
    ratingComments: evaluation.ratingComments,
    commentsSuggestions: evaluation.commentsSuggestions,
    overallRating: evaluation.overallRating,
    questionnaire: evaluation.questionnaire,
    status: evaluation.status,
  };

  const packedRecommendations = packEvaluationMeta(
    evaluation.recommendations || evaluation.commentsSuggestions || '',
    metaPayload
  );

  // Check if evaluation already exists for this trainee (prevent duplicate key or parallel entry issues)
  if (evaluation.employeeId) {
    try {
      const { data: existing } = await supabase
        .from('evaluations')
        .select('id, recommendations, status')
        .eq('employee_id', evaluation.employeeId)
        .maybeSingle();

      if (existing?.id) {
        const success = await updateEvaluation(existing.id, evaluation);
        if (success) {
          return {
            ...evaluation,
            id: existing.id,
          };
        }
      }
    } catch (e) {
      console.warn('[supabaseService] Check existing evaluation error:', e);
    }
  }

  // Live schema columns: areas_for_improvement must be snake_case in PostgreSQL
  const supabaseEval: any = {
    employee_id: evaluation.employeeId,
    evaluated_by: evaluation.evaluatedBy,
    attendance_score: evaluation.attendanceScore,
    performance_score: evaluation.performanceScore,
    attitude_score: evaluation.attitudeScore,
    punctuality_score: evaluation.punctualityScore,
    communication_score: evaluation.communicationScore,
    overall_score: evaluation.overallScore,
    grade: evaluation.grade,
    strengths: evaluation.strengths,
    areas_for_improvement: evaluation.areasForImprovement || (evaluation as any).areas_for_improvement || '',
    recommendations: packedRecommendations,
    evaluated_at: evaluation.evaluatedAt || new Date().toISOString(),
    status: dbStatus,
  };

  const { data, error } = await supabase.from('evaluations').insert([supabaseEval]).select().single();

  if (error) {
    // If error is duplicate key on employee_id, update instead
    if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
      const { data: existing } = await supabase
        .from('evaluations')
        .select('id')
        .eq('employee_id', evaluation.employeeId)
        .maybeSingle();
      if (existing?.id) {
        await updateEvaluation(existing.id, evaluation);
        return { ...evaluation, id: existing.id };
      }
    }
    console.error('Error creating evaluation in Supabase:', error);
    throw new Error(error.message || JSON.stringify(error));
  }

  const unpacked = unpackEvaluationMeta(data.recommendations);

  return {
    id: data.id,
    employeeId: data.employee_id,
    evaluatedBy: data.evaluated_by,
    attendanceScore: data.attendance_score,
    performanceScore: data.performance_score,
    attitudeScore: data.attitude_score,
    punctualityScore: data.punctuality_score,
    communicationScore: data.communication_score,
    overallScore: data.overall_score,
    grade: data.grade,
    strengths: data.strengths,
    areasForImprovement: data.areas_for_improvement,
    recommendations: unpacked.recommendations,
    ratings: evaluation.ratings || unpacked.ratings,
    ratingComments: evaluation.ratingComments || unpacked.ratingComments,
    commentsSuggestions: evaluation.commentsSuggestions || unpacked.commentsSuggestions,
    overallRating: evaluation.overallRating || unpacked.overallRating,
    questionnaire: evaluation.questionnaire || unpacked.questionnaire,
    evaluatedAt: data.evaluated_at,
    status: unpacked.status || evaluation.status || data.status,
    academicYear: evaluation.academicYear,
  };
}

export async function updateEvaluation(id: string, updates: Partial<Evaluation>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  let targetId = id;
  const targetEmployeeId = updates.employeeId;

  if (targetId.startsWith('eval-') && targetEmployeeId) {
    try {
      const { data: matched } = await supabase
        .from('evaluations')
        .select('id')
        .eq('employee_id', targetEmployeeId)
        .maybeSingle();
      if (matched?.id) {
        targetId = matched.id;
      } else {
        // No row exists in Supabase yet, create it!
        const created = await createEvaluation(updates as any);
        return Boolean(created);
      }
    } catch {}
  }

  const supabaseUpdates: any = {};
  if (updates.evaluatedBy !== undefined) supabaseUpdates.evaluated_by = updates.evaluatedBy;
  if (updates.attendanceScore !== undefined) supabaseUpdates.attendance_score = updates.attendanceScore;
  if (updates.performanceScore !== undefined) supabaseUpdates.performance_score = updates.performanceScore;
  if (updates.attitudeScore !== undefined) supabaseUpdates.attitude_score = updates.attitudeScore;
  if (updates.punctualityScore !== undefined) supabaseUpdates.punctuality_score = updates.punctualityScore;
  if (updates.communicationScore !== undefined) supabaseUpdates.communication_score = updates.communicationScore;
  if (updates.overallScore !== undefined) supabaseUpdates.overall_score = updates.overallScore;
  if (updates.grade !== undefined) supabaseUpdates.grade = updates.grade;
  if (updates.strengths !== undefined) supabaseUpdates.strengths = updates.strengths;
  if (updates.areasForImprovement !== undefined) supabaseUpdates.areas_for_improvement = updates.areasForImprovement;

  if (
    updates.recommendations !== undefined ||
    updates.ratings !== undefined ||
    updates.ratingComments !== undefined ||
    updates.commentsSuggestions !== undefined ||
    updates.overallRating !== undefined ||
    updates.questionnaire !== undefined ||
    updates.status !== undefined
  ) {
    let existingMeta: any = {};
    let existingCleanRec = updates.recommendations ?? updates.commentsSuggestions ?? '';

    try {
      const { data: existingRec } = await supabase.from('evaluations').select('recommendations, status').eq('id', targetId).single();
      if (existingRec?.recommendations) {
        const unpacked = unpackEvaluationMeta(existingRec.recommendations);
        existingCleanRec = updates.recommendations ?? updates.commentsSuggestions ?? unpacked.recommendations ?? '';
        existingMeta = {
          ratings: unpacked.ratings,
          ratingComments: unpacked.ratingComments,
          commentsSuggestions: unpacked.commentsSuggestions,
          overallRating: unpacked.overallRating,
          questionnaire: unpacked.questionnaire,
          status: unpacked.status || existingRec.status,
        };
      }
    } catch (e) {
      console.warn('Could not fetch existing evaluation meta:', e);
    }

    const metaPayload = {
      ratings: updates.ratings !== undefined ? updates.ratings : existingMeta.ratings,
      ratingComments: updates.ratingComments !== undefined ? updates.ratingComments : existingMeta.ratingComments,
      commentsSuggestions: updates.commentsSuggestions !== undefined ? updates.commentsSuggestions : existingMeta.commentsSuggestions,
      overallRating: updates.overallRating !== undefined ? updates.overallRating : existingMeta.overallRating,
      questionnaire: updates.questionnaire !== undefined ? updates.questionnaire : existingMeta.questionnaire,
      status: updates.status !== undefined ? updates.status : existingMeta.status,
    };

    supabaseUpdates.recommendations = packEvaluationMeta(
      existingCleanRec,
      metaPayload
    );
  }

  if (updates.status !== undefined) {
    let dbStatus = updates.status;
    if (
      dbStatus === 'submitted_to_instructor' ||
      dbStatus === 'reviewed_by_instructor' ||
      dbStatus === 'submitted_by_trainee' ||
      dbStatus === 'passed_to_hte'
    ) {
      dbStatus = 'final';
    } else if (dbStatus !== 'final' && dbStatus !== 'draft') {
      dbStatus = 'final';
    }
    supabaseUpdates.status = dbStatus;
  }

  const { error } = await supabase.from('evaluations').update(supabaseUpdates).eq('id', targetId);

  if (error) {
    console.error('Error updating evaluation in Supabase:', error);
    throw new Error(error.message || 'Failed to update evaluation');
  }

  return true;
}

export async function deleteEvaluation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('evaluations').delete().eq('id', id);

  if (error) {
    console.error('Error deleting evaluation in Supabase:', error);
    throw new Error(error.message || 'Failed to delete evaluation');
  }

  return true;
}

// ─── Announcements ───────────────────────────────────────────────────────────
import { sortAnnouncements } from '../utils/announcementHelper';
// reminder, deadline_at, comments, requires_submission, created_by_role).
// FIXED: createAnnouncement now sends ALL fields to Supabase, and THROWS on error
// instead of silently returning null (which is what let failed saves hide from you).


export async function fetchAnnouncementsFromStorage(): Promise<Announcement[]> {
  if (_storesBootstrapCache.data?.announcements?.length && _storesBootstrapCache.expiresAt > Date.now()) {
    return _storesBootstrapCache.data.announcements;
  }
  try {
    const apiRes = await fetch('/api/documents?action=get-announcements');
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return sortAnnouncements(data as Announcement[]);
      }
    }
  } catch {}

  try {
    const pubRes = await fetch(
      'https://wooighmdckuoebsuegzz.supabase.co/storage/v1/object/public/face-photos/settings/announcements_store.json',
      { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined }
    );
    if (pubRes.ok) {
      const data = await pubRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return sortAnnouncements(data as Announcement[]);
      }
    }
  } catch {}

  return [];
}

export async function saveAnnouncementsToStorage(announcements: Announcement[]): Promise<boolean> {
  if (!announcements || announcements.length === 0) return false;
  _storesBootstrapCache = { data: null, expiresAt: 0 };
  try {
    const apiRes = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save-announcements',
        announcements,
      }),
    });
    if (apiRes.ok) return true;
  } catch (err) {
    console.warn('saveAnnouncementsToStorage notice:', err);
  }
  return false;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  if (!isSupabaseConfigured()) return [];

  // 1. Primary path: Service role endpoint /api/announcements (bypasses RLS)
  try {
    const res = await fetch('/api/announcements');
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return sortAnnouncements(data as Announcement[]);
      }
    }
  } catch {
    // Fall back silently to direct Supabase client below
  }

  // 2. Direct Supabase client fallback
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }

  const mapped = (data || []).map((ann: any) => {
    let files = ann.files || undefined;
    let photo = ann.photo || undefined;
    if (photo && typeof photo === 'string' && photo.startsWith('{') && photo.includes('"url"')) {
      try {
        const parsed = JSON.parse(photo);
        if (Array.isArray(parsed.files) && parsed.files.length > 0) {
          files = parsed.files;
        } else if (parsed.url) {
          files = [{
            id: `file-${ann.id}-0`,
            name: parsed.name || 'Attachment',
            fileType: parsed.type === 'image' ? 'image/jpeg' : parsed.type === 'pdf' ? 'application/pdf' : 'application/octet-stream',
            size: parsed.size || '',
            dataUrl: parsed.url,
            fileUrl: parsed.url,
            uploadedAt: ann.created_at,
          }];
        }
      } catch {}
    } else if (photo && typeof photo === 'string' && (photo.startsWith('http') || photo.startsWith('data:image'))) {
      files = [{
        id: `file-${ann.id}-0`,
        name: 'Photo.jpg',
        fileType: 'image/jpeg',
        dataUrl: photo,
        fileUrl: photo,
        uploadedAt: ann.created_at,
      }];
    }

    return {
      id: ann.id,
      title: ann.title,
      content: ann.content,
      type: ann.type,
      targetRole: ann.target_role || 'all',
      isPinned: ann.is_pinned,
      createdAt: ann.created_at,
      expiresAt: ann.expires_at,
      createdBy: ann.created_by,
      createdByRole: ann.created_by_role,
      academicYear: ann.academic_year,
      photo,
      files,
      reminder: ann.reminder,
      deadlineAt: ann.deadline_at,
      comments: ann.comments,
      requiresSubmission: ann.requires_submission,
    };
  });
  return sortAnnouncements(mapped);
}

export async function createAnnouncement(announcement: Omit<Announcement, 'id'>): Promise<Announcement | null> {
  if (!isSupabaseConfigured()) return null;

  let annPhoto = announcement.photo;
  if (announcement.files && announcement.files.length > 0) {
    const first = announcement.files[0];
    const url = first.fileUrl || first.dataUrl || (typeof annPhoto === 'string' ? annPhoto : '');
    annPhoto = JSON.stringify({
      url,
      name: first.name || 'Attachment',
      type: (first.fileType || '').startsWith('image/')
        ? 'image'
        : (first.fileType || '').includes('pdf') || (first.name || '').toLowerCase().endsWith('.pdf')
        ? 'pdf'
        : 'doc',
      size: first.size ? formatFileSize(Number(first.size)) : '',
      files: announcement.files,
    });
  } else if (annPhoto && typeof annPhoto === 'string' && annPhoto.startsWith('data:image')) {
    try {
      annPhoto = await compressBase64Image(annPhoto, 800, 0.82);
    } catch (cErr) {
      console.warn('Announcement photo compression note:', cErr);
    }
  }

  const supabaseAnn: any = {
    title: announcement.title,
    content: announcement.content,
    type: announcement.type,
    target_role: announcement.targetRole || 'all',
    is_pinned: announcement.isPinned || false,
    expires_at: announcement.expiresAt || null,
    created_by: announcement.createdBy || 'OJT Instructor',
    created_by_role: announcement.createdByRole || 'admin',
    academic_year: (announcement as any).academicYear,
    photo: annPhoto,
    files: announcement.files,
    reminder: announcement.reminder || null,
    deadline_at: announcement.deadlineAt || null,
    comments: announcement.comments || null,
    requires_submission: announcement.requiresSubmission || false,
    created_at: announcement.createdAt || new Date().toISOString(),
  };

  // 1. Primary path: Service role endpoint /api/announcements (bypasses RLS to guarantee persistence)
  try {
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supabaseAnn),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        const createdOut = {
          ...data,
          files: announcement.files || data.files,
        } as Announcement;
        broadcastLiveEvent('announcement_created', createdOut);
        return createdOut;
      }
    }
  } catch (apiErr) {
    console.warn('API endpoint /api/announcements POST error, falling back to direct Supabase:', apiErr);
  }

  // 2. Direct Supabase client fallback (strip files since table has no files column)
  const { files: _f, ...insertPayload } = supabaseAnn;
  const { data, error } = await supabase.from('announcements').insert([insertPayload]).select().single();

  if (error) {
    console.error('Error creating announcement:', error);
    throw new Error(error.message || JSON.stringify(error));
  }

  const fallbackCreated = {
    id: data.id,
    title: data.title,
    content: data.content,
    type: data.type,
    targetRole: data.target_role,
    isPinned: data.is_pinned,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    createdBy: data.created_by,
    createdByRole: data.created_by_role,
    academicYear: data.academic_year,
    photo: data.photo,
    files: announcement.files,
    reminder: data.reminder,
    deadlineAt: data.deadline_at,
    comments: data.comments,
    requiresSubmission: data.requires_submission,
  } as Announcement;
  broadcastLiveEvent('announcement_created', fallbackCreated);
  return fallbackCreated;
}

export async function updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabaseUpdates: any = {};
  if (updates.title !== undefined) supabaseUpdates.title = updates.title;
  if (updates.content !== undefined) supabaseUpdates.content = updates.content;
  if (updates.type !== undefined) supabaseUpdates.type = updates.type;
  if (updates.targetRole !== undefined) supabaseUpdates.target_role = updates.targetRole;
  if (updates.isPinned !== undefined) supabaseUpdates.is_pinned = updates.isPinned;
  if (updates.expiresAt !== undefined) supabaseUpdates.expires_at = updates.expiresAt;
  if ((updates as any).academicYear !== undefined) supabaseUpdates.academic_year = (updates as any).academicYear;
  if (updates.photo !== undefined) supabaseUpdates.photo = updates.photo;
  if (updates.files !== undefined && updates.files.length > 0) {
    const first = updates.files[0];
    const url = first.fileUrl || first.dataUrl || (typeof supabaseUpdates.photo === 'string' ? supabaseUpdates.photo : '');
    supabaseUpdates.photo = JSON.stringify({
      url,
      name: first.name || 'Attachment',
      type: (first.fileType || '').startsWith('image/')
        ? 'image'
        : (first.fileType || '').includes('pdf') || (first.name || '').toLowerCase().endsWith('.pdf')
        ? 'pdf'
        : 'doc',
      size: first.size ? formatFileSize(Number(first.size)) : '',
      files: updates.files,
    });
    supabaseUpdates.files = updates.files;
  }
  if (updates.reminder !== undefined) supabaseUpdates.reminder = updates.reminder;
  if (updates.deadlineAt !== undefined) supabaseUpdates.deadline_at = updates.deadlineAt;
  if (updates.comments !== undefined) supabaseUpdates.comments = updates.comments;
  if (updates.requiresSubmission !== undefined) supabaseUpdates.requires_submission = updates.requiresSubmission;
  if (updates.createdByRole !== undefined) supabaseUpdates.created_by_role = updates.createdByRole;
  if (updates.createdAt !== undefined) supabaseUpdates.created_at = updates.createdAt;

  // 1. Primary path: Service role endpoint /api/announcements (bypasses RLS)
  try {
    const res = await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supabaseUpdates),
    });
    if (res.ok) {
      return true;
    }
  } catch (apiErr) {
    console.warn('API endpoint /api/announcements PUT error, falling back to direct Supabase:', apiErr);
  }

  // 2. Direct Supabase client fallback
  const { error } = await supabase.from('announcements').update(supabaseUpdates).eq('id', id);

  if (error) {
    console.error('Error updating announcement:', error);
    return false;
  }

  return true;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  // 1. Primary path: Service role endpoint /api/announcements (bypasses RLS)
  try {
    const res = await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return true;
    }
  } catch (apiErr) {
    console.warn('API endpoint /api/announcements DELETE error, falling back to direct Supabase:', apiErr);
  }

  // 2. Direct Supabase client fallback
  const { error } = await supabase.from('announcements').delete().eq('id', id);

  if (error) {
    console.error('Error deleting announcement:', error);
    return false;
  }

  return true;
}

// ─── Announcement Submissions & Comments ─────────────────────────────────────

export async function fetchAnnouncementSubmissions(): Promise<AnnouncementSubmission[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('announcement_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      // Best-effort check if table exists
      console.debug('Error fetching announcement submissions:', error);
      return [];
    }

    return (data || []).map((sub: any) => ({
      id: sub.id,
      announcementId: sub.announcement_id,
      employeeId: sub.employee_id,
      message: sub.message || '',
      photo: sub.photo || undefined,
      submittedAt: sub.submitted_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.debug('Submissions fetch caught:', err);
    return [];
  }
}

export async function createAnnouncementSubmission(submission: Omit<AnnouncementSubmission, 'id'>): Promise<AnnouncementSubmission | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const payload = {
      announcement_id: submission.announcementId,
      employee_id: submission.employeeId,
      message: submission.message,
      photo: submission.photo || null,
      submitted_at: submission.submittedAt || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('announcement_submissions')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Error saving announcement submission:', error);
      return null;
    }

    return {
      id: data?.id || `sub-${Date.now()}`,
      announcementId: data?.announcement_id || submission.announcementId,
      employeeId: data?.employee_id || submission.employeeId,
      message: data?.message || submission.message,
      photo: data?.photo || submission.photo,
      submittedAt: data?.submitted_at || submission.submittedAt,
    };
  } catch (err) {
    console.warn('Create submission caught:', err);
    return null;
  }
}

let hasAnnouncementCommentsTable: boolean | null = null;

export async function fetchAnnouncementComments(): Promise<AnnouncementComment[]> {
  // 1. Try server endpoint first (prevents 404 in browser console and handles service role)
  try {
    const res = await fetch('/api/announcements?action=comments');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (apiErr) {
    // API not reachable, fallback to direct Supabase
  }

  if (!isSupabaseConfigured() || hasAnnouncementCommentsTable === false) return [];

  try {
    const { data, error } = await supabase
      .from('announcement_comments')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      if ((error as any)?.code === 'PGRST205' || (error as any)?.status === 404) {
        hasAnnouncementCommentsTable = false;
      }
      return [];
    }

    hasAnnouncementCommentsTable = true;
    return (data || []).map((row: any) => ({
      id: row.id,
      announcementId: row.announcement_id,
      employeeId: row.employee_id,
      authorName: row.author_name,
      authorRole: row.author_role,
      content: row.content,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function createAnnouncementComment(comment: Omit<AnnouncementComment, 'id'>): Promise<AnnouncementComment | null> {
  const localComment: AnnouncementComment = {
    id: `comm-${Date.now()}`,
    announcementId: comment.announcementId,
    employeeId: comment.employeeId,
    authorName: comment.authorName,
    authorRole: comment.authorRole,
    content: comment.content,
    createdAt: comment.createdAt || new Date().toISOString(),
  };

  // 1. Primary path: Service role endpoint /api/announcements?action=comment (safely returns 200 even if unmigrated)
  try {
    const res = await fetch('/api/announcements?action=comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcement_id: comment.announcementId,
        employee_id: comment.employeeId || null,
        author_name: comment.authorName,
        author_role: comment.authorRole,
        content: comment.content,
        created_at: comment.createdAt || new Date().toISOString(),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.comment) {
        return data.comment;
      }
      return localComment;
    }
  } catch (apiErr) {
    // API endpoint not reachable (e.g. standalone Vite dev without server)
  }

  if (!isSupabaseConfigured() || hasAnnouncementCommentsTable === false) return localComment;

  try {
    const isUUID = typeof comment.employeeId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(comment.employeeId);
    const payload = {
      announcement_id: comment.announcementId,
      employee_id: isUUID ? comment.employeeId : null,
      author_id: comment.employeeId || null,
      author_name: comment.authorName,
      author_role: comment.authorRole,
      content: comment.content,
      created_at: comment.createdAt || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('announcement_comments')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) {
      if ((error as any)?.code === 'PGRST205' || (error as any)?.status === 404) {
        hasAnnouncementCommentsTable = false;
      }
      return localComment;
    }

    hasAnnouncementCommentsTable = true;
    return {
      id: data?.id || localComment.id,
      announcementId: data?.announcement_id || comment.announcementId,
      employeeId: data?.employee_id || comment.employeeId,
      authorName: data?.author_name || comment.authorName,
      authorRole: data?.author_role || comment.authorRole,
      content: data?.content || comment.content,
      createdAt: data?.created_at || comment.createdAt,
    };
  } catch (err) {
    return localComment;
  }
}

// ─── Host Feedback ────────────────────────────────────────────────────────────

export async function fetchHostFeedback(): Promise<HostFeedback[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase.from('host_feedback').select('*').order('submitted_at', { ascending: false });

    if (error) {
      console.warn('fetchHostFeedback database note:', error.message);
      return [];
    }

    return (data || []).map((hf: any) => ({
    id: hf.id,
    employeeId: hf.employee_id,
    hostName: hf.host_name,
    hostCompany: hf.host_company,
    hostPosition: hf.host_position,
    hostEmail: hf.host_email,
    attendanceScore: hf.attendance_score,
    performanceScore: hf.performance_score,
    attitudeScore: hf.attitude_score,
    communicationScore: hf.communication_score,
    teamworkScore: hf.teamwork_score,
    overallScore: hf.overall_score,
    strengths: hf.strengths,
    areasForImprovement: hf.areas_for_improvement,
    recommendation: hf.recommendation,
    submittedAt: hf.submitted_at,
    status: hf.status,
    academicYear: hf.academic_year,
  }));
  } catch (netErr) {
    console.warn('fetchHostFeedback network note:', netErr);
    return [];
  }
}

export async function createHostFeedback(feedback: Omit<HostFeedback, 'id'>): Promise<HostFeedback | null> {
  if (!isSupabaseConfigured()) return null;

  // Live schema has no academic_year column; send only live columns
  const supabaseHf = {
    employee_id: feedback.employeeId,
    host_name: feedback.hostName,
    host_company: feedback.hostCompany,
    host_position: feedback.hostPosition || 'Supervisor',
    host_email: feedback.hostEmail || 'hte@chmsu.edu.ph',
    attendance_score: feedback.attendanceScore,
    performance_score: feedback.performanceScore,
    attitude_score: feedback.attitudeScore,
    communication_score: feedback.communicationScore,
    teamwork_score: feedback.teamworkScore,
    overall_score: feedback.overallScore,
    strengths: feedback.strengths,
    areas_for_improvement: feedback.areasForImprovement,
    recommendation: feedback.recommendation,
    submitted_at: feedback.submittedAt || new Date().toISOString(),
    status: feedback.status || 'submitted',
  };

  const { data, error } = await supabase.from('host_feedback').insert([supabaseHf]).select().single();

  if (error) {
    console.error('Error creating host feedback in Supabase:', error);
    throw new Error(error.message || JSON.stringify(error));
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    hostName: data.host_name,
    hostCompany: data.host_company,
    hostPosition: data.host_position,
    hostEmail: data.host_email,
    attendanceScore: data.attendance_score,
    performanceScore: data.performance_score,
    attitudeScore: data.attitude_score,
    communicationScore: data.communication_score,
    teamworkScore: data.teamwork_score,
    overallScore: data.overall_score,
    strengths: data.strengths,
    areasForImprovement: data.areas_for_improvement,
    recommendation: data.recommendation,
    submittedAt: data.submitted_at,
    status: data.status,
    academicYear: feedback.academicYear,
  };
}

export async function updateHostFeedback(id: string, updates: Partial<HostFeedback>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabaseUpdates: any = {};
  if (updates.hostName !== undefined) supabaseUpdates.host_name = updates.hostName;
  if (updates.hostCompany !== undefined) supabaseUpdates.host_company = updates.hostCompany;
  if (updates.hostPosition !== undefined) supabaseUpdates.host_position = updates.hostPosition;
  if (updates.hostEmail !== undefined) supabaseUpdates.host_email = updates.hostEmail;
  if (updates.attendanceScore !== undefined) supabaseUpdates.attendance_score = updates.attendanceScore;
  if (updates.performanceScore !== undefined) supabaseUpdates.performance_score = updates.performanceScore;
  if (updates.attitudeScore !== undefined) supabaseUpdates.attitude_score = updates.attitudeScore;
  if (updates.communicationScore !== undefined) supabaseUpdates.communication_score = updates.communicationScore;
  if (updates.teamworkScore !== undefined) supabaseUpdates.teamwork_score = updates.teamworkScore;
  if (updates.overallScore !== undefined) supabaseUpdates.overall_score = updates.overallScore;
  if (updates.strengths !== undefined) supabaseUpdates.strengths = updates.strengths;
  if (updates.areasForImprovement !== undefined) supabaseUpdates.areas_for_improvement = updates.areasForImprovement;
  if (updates.recommendation !== undefined) supabaseUpdates.recommendation = updates.recommendation;
  if (updates.status !== undefined) supabaseUpdates.status = updates.status;

  const { error } = await supabase.from('host_feedback').update(supabaseUpdates).eq('id', id);

  if (error) {
    console.error('Error updating host feedback in Supabase:', error);
    throw new Error(error.message || 'Failed to update host feedback');
  }

  return true;
}

export async function deleteHostFeedback(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('host_feedback').delete().eq('id', id);

  if (error) {
    console.error('Error deleting host feedback in Supabase:', error);
    throw new Error(error.message || 'Failed to delete host feedback');
  }

  return true;
}

// ─── Transform Helpers ───────────────────────────────────────────────────────

export function transformSupabaseEmployee(data: any): Employee {
  let regLoc = data.registration_location;
  if (typeof regLoc === 'string') {
    try {
      regLoc = JSON.parse(regLoc);
    } catch {}
  }

  // Filter out raw GPS coordinates if stored as an address string
  const isCoordString = (val?: string) => Boolean(val && /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(String(val).trim()));

  const phoneVal =
    data.phone ||
    data.contact_phone ||
    regLoc?.phone ||
    regLoc?.contactPhone ||
    regLoc?.telephone ||
    undefined;

  const rawResidential =
    regLoc?.residentialAddress ||
    regLoc?.homeAddress ||
    data.residential_address ||
    data.residentialAddress ||
    (!isCoordString(regLoc?.address) ? regLoc?.address : undefined) ||
    (!isCoordString(data.address) ? data.address : undefined);

  const compositeResidential = [
    regLoc?.street || data.street,
    regLoc?.barangay || data.barangay,
    regLoc?.city || data.city,
    regLoc?.province || data.province,
  ].filter(Boolean).join(', ');

  const finalResidential = rawResidential || (compositeResidential ? compositeResidential : undefined);

  const resolvedRole: 'admin' | 'hte' | 'employee' = data.role || (
    data.position === 'OJT Instructor' || data.position === 'Administrator' || (data.position && String(data.position).toLowerCase().includes('instructor'))
      ? 'admin'
      : data.position === 'HTE Representative' || data.position === 'Training Supervisor' || (data.position && String(data.position).toLowerCase().includes('hte'))
        ? 'hte'
        : 'employee'
  );
  const isTraineeAccount = resolvedRole !== 'admin' && resolvedRole !== 'hte' && (resolvedRole as string) !== 'instructor';

  return {
    id: data.id,
    name: data.name,
    employeeId: data.employee_id || '',
    email: data.email,
    role: data.role || (
      data.position === 'OJT Instructor' || data.position === 'Administrator' || (data.position && String(data.position).toLowerCase().includes('instructor'))
        ? 'admin'
        : data.position === 'HTE Representative' || data.position === 'Training Supervisor' || (data.position && String(data.position).toLowerCase().includes('hte'))
          ? 'hte'
          : 'employee'
    ),
    department: data.department,
    position: data.position,
    companyName: (() => {
      if (data.company_name) return data.company_name;
      if (data.hte_id === '95558630-499b-4aac-b869-ba64b0694e8c') return 'CHMSU';
      if (data.hte_id === '89405c66-015c-407a-937b-71ab37b829d7') return 'Concentrix';
      const empId = String(data.employee_id || '').toUpperCase();
      if (empId.includes('CHMSU') || empId.includes('PS')) return 'CHMSU';
      if (empId.includes('CTX')) return 'Concentrix';
      return 'Pending Admin Assignment';
    })(),
    supervisorName: (() => {
      if (data.supervisor_name) return data.supervisor_name;
      if (data.hte_id === '95558630-499b-4aac-b869-ba64b0694e8c') return 'Jhey Ree';
      if (data.hte_id === '89405c66-015c-407a-937b-71ab37b829d7') return 'Jhey Ree C Ebro';
      const empId = String(data.employee_id || '').toUpperCase();
      if (empId.includes('PS')) return 'Jhey Ree';
      if (empId.includes('CTX')) return 'Jhey Ree C Ebro';
      return undefined;
    })(),
    schoolName: data.school_name,
    campus: data.campus,
    course: data.course,
    startDate: data.start_date,
    endDate: data.end_date,
    requiredHours: isTraineeAccount
      ? Number(data.required_hours) > 0
        ? Math.round(Number(data.required_hours))
        : TRAINEE_REQUIRED_HOURS
      : Number(data.required_hours ?? 0),
    renderedHours: Number(data.rendered_hours ?? regLoc?.renderedHours ?? 0),
    photo: data.photo,
    faceRegistered: data.face_registered,
    faceDescriptor: (() => {
      const raw = data.face_descriptor ?? regLoc?.faceDescriptor;
      if (Array.isArray(raw) && raw.length === 128) return raw.map(Number);
      if (typeof raw === 'string' && raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === 128) return parsed.map(Number);
        } catch {}
      }
      return undefined;
    })(),
    createdAt: data.created_at,
    active: data.active,
    academicYear: data.academic_year,
    registrationLocation: (() => {
      const radiusVal = Math.max(20, Number(data.registration_radius ?? regLoc?.radius ?? 40));
      const hoursVal = Number(data.rendered_hours ?? regLoc?.renderedHours ?? 0);
      if (data.registration_lat != null && data.registration_lng != null) {
        return { lat: Number(data.registration_lat), lng: Number(data.registration_lng), radius: radiusVal, renderedHours: hoursVal };
      }
      if (regLoc?.lat != null && regLoc?.lng != null) {
        return { lat: Number(regLoc.lat), lng: Number(regLoc.lng), radius: radiusVal, renderedHours: hoursVal };
      }
      if (data.registration_address) {
        const match = String(data.registration_address).match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
        if (match) {
          return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), radius: radiusVal, renderedHours: hoursVal };
        }
      }
      return hoursVal > 0 ? { lat: 0, lng: 0, radius: radiusVal, renderedHours: hoursVal } : undefined;
    })(),
    registrationRadius: Math.max(20, Number(data.registration_radius ?? regLoc?.radius ?? 40)),
    geofenceOverride: (data as any)?.geofence_override || regLoc?.geofenceOverride || undefined,
    registrationAddress: data.registration_address || regLoc?.address || undefined,
    contactPhone: phoneVal,
    phone: phoneVal,
    telephone: phoneVal,
    residentialAddress: finalResidential,
    address: finalResidential,
    street: regLoc?.street || data.street || undefined,
    barangay: regLoc?.barangay || data.barangay || undefined,
    city: regLoc?.city || data.city || undefined,
    province: regLoc?.province || data.province || undefined,
    instructorId: data.instructor_id,
    hteId: (() => {
      if (data.hte_id) return data.hte_id;
      const comp = String(data.company_name || '').toLowerCase();
      if (comp.includes('concentrix')) return '89405c66-015c-407a-937b-71ab37b829d7';
      if (comp.includes('printing')) return '95558630-499b-4aac-b869-ba64b0694e8c';
      const empId = String(data.employee_id || '').toUpperCase();
      if (empId.includes('CTX')) return '89405c66-015c-407a-937b-71ab37b829d7';
      if (empId.includes('PS')) return '95558630-499b-4aac-b869-ba64b0694e8c';
      return undefined;
    })(),
    linkedAt: data.linked_at,
    applicationStatus: data.application_status || data.approval_status || (
      data.position === 'OJT Instructor' || data.position === 'Administrator' || (data.position && String(data.position).toLowerCase().includes('instructor')) ||
      data.position === 'HTE Representative' || (data.position && String(data.position).toLowerCase().includes('hte'))
        ? 'approved'
        : 'pending'
    ),
    approvalStatus: data.approval_status || data.application_status || (
      data.position === 'OJT Instructor' || data.position === 'Administrator' || (data.position && String(data.position).toLowerCase().includes('instructor')) ||
      data.position === 'HTE Representative' || (data.position && String(data.position).toLowerCase().includes('hte'))
        ? 'approved'
        : 'pending'
    ),
    ...(() => {
      const resolvedRole = data.role || (
        data.position === 'OJT Instructor' || data.position === 'Administrator' || (data.position && String(data.position).toLowerCase().includes('instructor'))
          ? 'admin'
          : data.position === 'HTE Representative' || data.position === 'Training Supervisor' || (data.position && String(data.position).toLowerCase().includes('hte'))
            ? 'hte'
            : 'employee'
      );
      const isTrainee = resolvedRole === 'employee' || resolvedRole === 'trainee';
      const submittedDocs = regLoc?.documents || data.submitted_documents || undefined;

      if (!isTrainee) {
        return {
          documentsPassed:
            data.documents_passed !== undefined
              ? Boolean(data.documents_passed)
              : regLoc?.documentsPassed !== undefined
                ? Boolean(regLoc.documentsPassed)
                : true,
          documentsStatus:
            data.documents_status ||
            regLoc?.documentsStatus ||
            'passed',
          submittedDocuments: submittedDocs,
        };
      }

      const REQUIRED_KEYS = [
        'internshipAgreement', 'moa', 'consent', 'trainingPlan', 'pledgeOfConduct',
        'medical', 'application', 'resume', 'enrolmentForm', 'endorsement'
      ];
      const getDoc = (k: string) => {
        if (!submittedDocs) return undefined;
        if ((submittedDocs as any)[k]) return (submittedDocs as any)[k];
        if (k === 'trainingPlan' && ((submittedDocs as any).dutiesAndResponsibilities || (submittedDocs as any).training_plan)) return (submittedDocs as any).dutiesAndResponsibilities || (submittedDocs as any).training_plan;
        if (k === 'application' && ((submittedDocs as any).evaluationForm || (submittedDocs as any).evaluationReport || (submittedDocs as any).applicationForm || (submittedDocs as any).application_letter)) return (submittedDocs as any).evaluationForm || (submittedDocs as any).evaluationReport || (submittedDocs as any).applicationForm || (submittedDocs as any).application_letter;
        if (k === 'consent' && ((submittedDocs as any).parent_consent || (submittedDocs as any).parentalConsent)) return (submittedDocs as any).parent_consent || (submittedDocs as any).parentalConsent;
        if (k === 'internshipAgreement' && ((submittedDocs as any).internship_agreement || (submittedDocs as any).agreement)) return (submittedDocs as any).internship_agreement || (submittedDocs as any).agreement;
        if (k === 'moa' && ((submittedDocs as any).memorandumOfAgreement || (submittedDocs as any).moaDoc)) return (submittedDocs as any).memorandumOfAgreement || (submittedDocs as any).moaDoc;
        if (k === 'medical' && ((submittedDocs as any).medicalCertificate || (submittedDocs as any).clearance || (submittedDocs as any).medCert)) return (submittedDocs as any).medicalCertificate || (submittedDocs as any).clearance || (submittedDocs as any).medCert;
        if (k === 'endorsement' && ((submittedDocs as any).endorsementLetter || (submittedDocs as any).endorsementDoc)) return (submittedDocs as any).endorsementLetter || (submittedDocs as any).endorsementDoc;
        return undefined;
      };

      const uploadedDocsCount = submittedDocs
        ? REQUIRED_KEYS.filter((k) => {
            const d = getDoc(k);
            return Boolean(d && (d.dataUrl || d.name || d.fileUrl));
          }).length
        : 0;
      const passedDocsCount = submittedDocs
        ? REQUIRED_KEYS.filter((k) => {
            const d = getDoc(k);
            return d?.status === 'passed' && Boolean(d && (d.dataUrl || d.name || d.fileUrl));
          }).length
        : 0;

      const isAllCompleted = uploadedDocsCount === REQUIRED_KEYS.length;
      const isAllPassed = isAllCompleted && passedDocsCount === REQUIRED_KEYS.length;

      let finalDocsPassed = false;
      let finalDocsStatus: 'passed' | 'pending' | 'submitted' | 'incomplete' | 'partial' | 'rejected' = 'pending';

      // STRICT RULE: If trainee has NOT completed all 10 required documents, it MUST be pending and NOT passed!
      if (!isAllCompleted) {
        finalDocsPassed = false;
        finalDocsStatus = (data.documents_status === 'rejected' || regLoc?.documentsStatus === 'rejected')
          ? 'rejected'
          : uploadedDocsCount > 0
            ? (data.documents_status === 'partial' ? 'partial' : 'pending')
            : 'pending';
      } else {
        const explicitPassed = (data.documents_passed === true || regLoc?.documentsPassed === true || data.documents_status === 'passed' || regLoc?.documentsStatus === 'passed');
        if (isAllPassed || explicitPassed) {
          finalDocsPassed = true;
          finalDocsStatus = 'passed';
        } else {
          finalDocsPassed = false;
          finalDocsStatus = data.documents_status || regLoc?.documentsStatus || 'submitted';
        }
      }

      return {
        documentsPassed: finalDocsPassed,
        documentsStatus: finalDocsStatus,
        submittedDocuments: submittedDocs,
      };
    })(),
  };
}

export function transformSupabaseTimeRecord(data: any): TimeRecord {
  const slotData = extractSlotNotes(data.notes);
  const cleanNotes = (data.notes || '').replace(/\s*\[slots:.*?\]/g, '').trim() || undefined;

  let amArrival = slotData.amArrival || data.am_arrival || undefined;
  let amDeparture = slotData.amDeparture || data.am_departure || undefined;
  let pmArrival = slotData.pmArrival || data.pm_arrival || undefined;
  let pmDeparture = slotData.pmDeparture || data.pm_departure || undefined;

  // Dual Fallback: If slots are not explicitly specified in slotData or columns, infer from time_in / time_out
  if (!amArrival && !pmArrival && data.time_in) {
    const mins = parseTimeToMinutes(data.time_in);
    if (mins !== null) {
      if (mins < 12 * 60) {
        amArrival = data.time_in;
      } else {
        pmArrival = data.time_in;
      }
    }
  }

  const safeTimeOut = data.time_out && data.time_out !== data.time_in ? data.time_out : undefined;

  if (!amDeparture && !pmDeparture && safeTimeOut) {
    const mins = parseTimeToMinutes(safeTimeOut);
    if (mins !== null) {
      if (mins < 13 * 60 && !amDeparture && amArrival && !pmArrival) {
        amDeparture = safeTimeOut;
      } else if (mins >= 13 * 60 || (mins >= 12 * 60 && pmArrival)) {
        pmDeparture = safeTimeOut;
        if (amArrival && !amDeparture) {
          amDeparture = '12:00:00';
        }
        if (amArrival && !pmArrival) {
          pmArrival = '13:00:00';
        }
      }
    }
  }

  // Re-align if amDeparture was erroneously recorded during afternoon / evening
  const amOutMins = amDeparture ? parseTimeToMinutes(amDeparture) : null;
  if (amOutMins !== null && amOutMins >= 13 * 60) {
    if (!pmDeparture) pmDeparture = amDeparture;
    amDeparture = undefined;
  }

  // Full-day attendance alignment: if trainee has morning arrival and evening departure without separate lunch punches
  const amInMins = amArrival ? parseTimeToMinutes(amArrival) : null;
  const pmOutMins = pmDeparture ? parseTimeToMinutes(pmDeparture) : null;
  if (amInMins !== null && pmOutMins !== null && amInMins < 12 * 60 && pmOutMins >= 13 * 60) {
    if (!amDeparture) amDeparture = '12:00:00';
    if (!pmArrival) pmArrival = '13:00:00';
  }

  return {
    id: data.id,
    employeeId: data.employee_id || data.employeeId || data.employeeID || data.employee_Id || data.userId || data.user_id || '',
    date: data.date ? String(data.date).split('T')[0].split(' ')[0].trim() : data.date,
    timeIn: data.time_in ?? data.timeIn,
    timeOut: data.time_out ?? data.timeOut,
    amArrival,
    amDeparture,
    pmArrival,
    pmDeparture,
    amArrivalFaceVerified: slotData.amArrivalFaceVerified ?? data.am_arrival_face_verified ?? (amArrival ? data.time_in_face_verified : undefined),
    amDepartureFaceVerified: slotData.amDepartureFaceVerified ?? data.am_departure_face_verified ?? (amDeparture ? data.time_out_face_verified : undefined),
    pmArrivalFaceVerified: slotData.pmArrivalFaceVerified ?? data.pm_arrival_face_verified ?? (pmArrival ? data.time_in_face_verified : undefined),
    pmDepartureFaceVerified: slotData.pmDepartureFaceVerified ?? data.pm_departure_face_verified ?? (pmDeparture ? data.time_out_face_verified : undefined),
    amArrivalGeofenced: slotData.amArrivalGeofenced ?? data.am_arrival_geofenced ?? (amArrival ? data.time_in_geofenced : undefined),
    amDepartureGeofenced: slotData.amDepartureGeofenced ?? data.am_departure_geofenced ?? (amDeparture ? data.time_out_geofenced : undefined),
    pmArrivalGeofenced: slotData.pmArrivalGeofenced ?? data.pm_arrival_geofenced ?? (pmArrival ? data.time_in_geofenced : undefined),
    pmDepartureGeofenced: slotData.pmDepartureGeofenced ?? data.pm_departure_geofenced ?? (pmDeparture ? data.time_out_geofenced : undefined),
    timeInLocation: data.time_in_lat && data.time_in_lng ? { lat: data.time_in_lat, lng: data.time_in_lng } : undefined,
    timeOutLocation:
      data.time_out_lat && data.time_out_lng ? { lat: data.time_out_lat, lng: data.time_out_lng } : undefined,
    timeInGeofenced: data.time_in_geofenced,
    timeOutGeofenced: data.time_out_geofenced,
    timeInFaceVerified: data.time_in_face_verified,
    timeOutFaceVerified: data.time_out_face_verified,
    timeInPhoto: data.time_in_photo,
    timeOutPhoto: data.time_out_photo,
    totalHours: (() => {
      const rawHrs =
        data.total_hours != null
          ? Number(data.total_hours)
          : data.totalHours != null
            ? Number(data.totalHours)
            : undefined;
      if (rawHrs !== undefined && rawHrs <= 16) {
        return Math.round(rawHrs * 100) / 100;
      }
      let mins = 0;
      const aIn = amArrival ? parseTimeToMinutes(amArrival) : null;
      const aOut = amDeparture ? parseTimeToMinutes(amDeparture) : null;
      const pIn = pmArrival ? parseTimeToMinutes(pmArrival) : null;
      const pOut = pmDeparture ? parseTimeToMinutes(pmDeparture) : null;
      if (aIn !== null && aOut !== null && aOut > aIn) mins += aOut - aIn;
      if (pIn !== null && pOut !== null && pOut > pIn) mins += pOut - pIn;
      if (mins > 0) return Math.round((mins / 60) * 100) / 100;
      return rawHrs !== undefined ? Math.min(8, Math.max(0, Math.round(rawHrs * 100) / 100)) : undefined;
    })(),
    status: data.status,
    notes: cleanNotes,
    academicYear: data.academic_year,
    approvalStatus: (data.approval_status || slotData.approvalStatus || 'pending') as any,
    approvedBy: data.approved_by || slotData.approvedBy || undefined,
    approvedAt: data.approved_at || slotData.approvedAt || undefined,
    approvalNote: data.approval_note || slotData.approvalNote || undefined,
  };
}

// ─── Batch Synchronization & Data Repair ─────────────────────────────────────

export async function upsertEmployees(employees: Employee[]): Promise<boolean> {
  if (!isSupabaseConfigured() || employees.length === 0) return false;

  try {
    const payload = employees.map((emp) => {
      const isHTE = emp.position === 'HTE Representative' || emp.position === 'Training Supervisor' || (emp.position && emp.position.toLowerCase().includes('hte'));
      const isInstructor = emp.position === 'OJT Instructor' || (emp.position && emp.position.toLowerCase().includes('instructor'));
      let employeeId = emp.employeeId;
      if (isHTE && employeeId && employeeId.startsWith('OJT-')) {
        employeeId = employeeId.replace(/^OJT-/, 'HTE-');
      } else if (isInstructor && employeeId && employeeId.startsWith('OJT-')) {
        employeeId = employeeId.replace(/^OJT-/, 'ADM-');
      }

      return {
        id: emp.id,
        name: emp.name,
        employee_id: employeeId,
        email: emp.email,
        department: emp.department,
        position: emp.position,
        company_name: emp.companyName,
        supervisor_name: emp.supervisorName,
        school_name: emp.schoolName,
        campus: emp.campus,
        course: emp.course,
        start_date: emp.startDate,
        end_date: emp.endDate,
        required_hours: emp.requiredHours,
        photo: emp.photo,
        face_registered: emp.faceRegistered,
        active: emp.active,
        academic_year: emp.academicYear,
        registration_lat: emp.registrationLocation?.lat,
        registration_lng: emp.registrationLocation?.lng,
        registration_address: emp.registrationAddress,
      };
    });

    const { error } = await supabase.from('employees').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error upserting employees in Supabase:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('upsertEmployees exception:', e);
    return false;
  }
}

export async function upsertTimeRecords(records: TimeRecord[]): Promise<boolean> {
  if (records.length === 0) return false;

  // 1. Primary path: Server-side API with service role (bypasses RLS & UUID issues)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/time-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      // Also ensure backed up to DTTR store
      saveDttrStoreToStorage({ timeRecords: records }).catch(() => {});
      return true;
    }
  } catch {}

  if (!isSupabaseConfigured()) return false;

  try {
    const isUuid = (val: any) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const payload = records.map((rec) => {
      const item: any = {
        employee_id: rec.employeeId,
        date: rec.date ? String(rec.date).split('T')[0] : rec.date,
        time_in: rec.timeIn || rec.amArrival || rec.pmArrival,
        time_out: rec.timeOut || rec.pmDeparture || rec.amDeparture,
        time_in_lat: rec.timeInLocation?.lat,
        time_in_lng: rec.timeInLocation?.lng,
        time_out_lat: rec.timeOutLocation?.lat,
        time_out_lng: rec.timeOutLocation?.lng,
        time_in_geofenced: rec.timeInGeofenced,
        time_out_geofenced: rec.timeOutGeofenced,
        time_in_face_verified: rec.timeInFaceVerified,
        time_out_face_verified: rec.timeOutFaceVerified,
        total_hours: rec.totalHours != null ? Number(rec.totalHours) : 0,
        status: rec.status,
        notes: rec.notes,
      };
      if (rec.id && isUuid(rec.id)) {
        item.id = rec.id;
      }
      return item;
    });

    // Direct client upsert omitted if not using service role to prevent RLS 403 errors in console
    saveDttrStoreToStorage({ timeRecords: records }).catch(() => {});
    return true;
  } catch (e) {
    console.warn('upsertTimeRecords exception:', e);
    saveDttrStoreToStorage({ timeRecords: records }).catch(() => {});
    return true;
  }
}

// ─── Host Supervisors (HTE Establishment Accounts) ───────────────────────────

export async function fetchHostSupervisors(): Promise<HostSupervisor[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('host_supervisors')
      .select('id, name, email, company_name, position, active, is_approved, approved_by, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.warn('fetchHostSupervisors database note:', error.message);
      return [];
    }
    return (data || []).map(transformSupabaseHostSupervisor);
  } catch (netErr) {
    console.warn('fetchHostSupervisors network note:', netErr);
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('ojt_host_supervisors') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }
}

export async function createHostSupervisor(host: HostSupervisor): Promise<HostSupervisor | null> {
  if (!isSupabaseConfigured()) return null;

  const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
  const resolvedId = isUuid(host.id) ? host.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);

  const payload: any = {
    ...(resolvedId ? { id: resolvedId } : {}),
    name: host.contactPerson || host.name,
    email: host.email?.trim().toLowerCase(),
    company_name: host.companyName || 'Host Training Establishment',
    position: (host as any).position || 'HTE Representative',
    is_approved: host.isApproved ?? true,
    active: host.active !== false,
  };

  const { data, error } = await supabase.from('host_supervisors').upsert([payload], { onConflict: 'id' }).select().single();
  if (error) {
    console.error('Error creating host_supervisor in Supabase:', error);
    throw new Error(error.message || JSON.stringify(error));
  }
  return transformSupabaseHostSupervisor(data);
}

export async function updateHostSupervisor(id: string, updates: Partial<HostSupervisor>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabaseUpdates: any = {};
  if (updates.name !== undefined || updates.contactPerson !== undefined) {
    supabaseUpdates.name = updates.contactPerson || updates.name;
  }
  if (updates.email !== undefined) supabaseUpdates.email = updates.email.trim().toLowerCase();
  if (updates.companyName !== undefined) supabaseUpdates.company_name = updates.companyName;
  if ((updates as any).position !== undefined) supabaseUpdates.position = (updates as any).position;
  if (updates.isApproved !== undefined) supabaseUpdates.is_approved = updates.isApproved;
  if (updates.active !== undefined) supabaseUpdates.active = updates.active;

  // 1. Update host_supervisors table with valid schema columns
  let { data: updatedHostData, error } = await supabase
    .from('host_supervisors')
    .update(supabaseUpdates)
    .eq('id', id)
    .select();

  if ((!updatedHostData || updatedHostData.length === 0) && updates.email) {
    const emailRes = await supabase
      .from('host_supervisors')
      .update(supabaseUpdates)
      .ilike('email', updates.email.trim().toLowerCase())
      .select();
    if (emailRes.error) error = emailRes.error;
  }

  if (error) {
    console.error('Error updating host_supervisor:', error);
    throw new Error(error.message || 'Failed to update host_supervisor');
  }

  // 2. Also synchronize supervisor's row in employees table
  try {
    const empUpdates: any = {};
    if (supabaseUpdates.name) {
      empUpdates.name = supabaseUpdates.name;
      empUpdates.supervisor_name = supabaseUpdates.name;
    }
    if (supabaseUpdates.company_name) empUpdates.company_name = supabaseUpdates.company_name;
    if (updates.companyAddress || (updates as any).registrationAddress) {
      empUpdates.registration_address = updates.companyAddress || (updates as any).registrationAddress;
    }
    if (updates.phone) empUpdates.contactPhone = updates.phone;

    if (Object.keys(empUpdates).length > 0) {
      const { data: updatedEmpData } = await supabase
        .from('employees')
        .update(empUpdates)
        .eq('id', id)
        .select();

      if ((!updatedEmpData || updatedEmpData.length === 0) && updates.email) {
        await supabase
          .from('employees')
          .update(empUpdates)
          .ilike('email', updates.email.trim().toLowerCase());
      }
    }

    // 3. If establishment name or supervisor name changed, cascade to all trainees assigned to this HTE
    if (supabaseUpdates.company_name || supabaseUpdates.name) {
      const cascadeUpdates: any = {};
      if (supabaseUpdates.company_name) cascadeUpdates.company_name = supabaseUpdates.company_name;
      if (supabaseUpdates.name) cascadeUpdates.supervisor_name = supabaseUpdates.name;
      await supabase.from('employees').update(cascadeUpdates).eq('hte_id', id);
    }
  } catch (empErr) {
    console.warn('Employees sync during updateHostSupervisor notice:', empErr);
  }

  // 4. Also sync geofence_zones for this HTE if location or company name changed
  try {
    const zoneName = updates.companyName
      ? `${updates.companyName} - Workplace Premises`
      : undefined;
    const zoneAddress = updates.companyAddress || (updates as any).registrationAddress;
    const regLoc = (updates as any).registrationLocation;

    const geoUpdates: any = {};
    if (zoneName) geoUpdates.name = zoneName;
    if (zoneAddress) geoUpdates.address = zoneAddress;
    if (regLoc && regLoc.lat && regLoc.lng) {
      geoUpdates.lat = Number(regLoc.lat);
      geoUpdates.lng = Number(regLoc.lng);
      geoUpdates.radius = Math.max(20, Number(regLoc.radius || (updates as any).registrationRadius) || 40);
    }

    if (Object.keys(geoUpdates).length > 0) {
      await supabase.from('geofence_zones').update(geoUpdates).or(`id.eq.${id},employee_id.eq.${id}`);
    }
  } catch (gErr) {
    console.warn('Geofence zone sync during updateHostSupervisor notice:', gErr);
  }

  return true;
}

export async function deleteHostSupervisor(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    await supabase.from('host_supervisors').delete().eq('id', id);
    await supabase.from('employees').delete().eq('id', id);
    return true;
  } catch (e) {
    console.error('deleteHostSupervisor error:', e);
    return false;
  }
}

export async function upsertHostSupervisors(hosts: HostSupervisor[]): Promise<boolean> {
  if (!isSupabaseConfigured() || hosts.length === 0) return false;

  const payload = hosts.map((h) => ({
    id: h.id,
    name: h.contactPerson || h.name,
    email: h.email?.trim().toLowerCase(),
    company_name: h.companyName,
    is_approved: h.isApproved ?? true,
    active: h.active !== false,
  }));

  const { error } = await supabase.from('host_supervisors').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Error upserting host_supervisors:', error);
    throw new Error(error.message || 'Failed to upsert host_supervisors');
  }
  return true;
}

function transformSupabaseHostSupervisor(data: any): HostSupervisor {
  return {
    id: data.id,
    name: data.name || data.contact_person || 'HTE Supervisor',
    email: data.email || '',
    employeeId: data.employee_id || `HTE-${new Date().getFullYear()}-${String(data.id || '').slice(0, 3).toUpperCase()}`,
    companyName: data.company_name || 'Host Training Establishment',
    companyAddress: data.company_address || undefined,
    contactPerson: data.contact_person || data.name || undefined,
    phone: data.phone || undefined,
    position: 'HTE Representative',
    active: true,
    isApproved: data.is_approved ?? true,
    academicYear: data.academic_year || undefined,
    createdAt: data.created_at,
  };
}

export async function repairDatabaseData(activeAY = '2026-2027'): Promise<{
  success: boolean;
  repairedEmployees: number;
  repairedRecords: number;
  migratedHTEs: number;
  deduplicatedZones?: number;
  outOfRegionTrainees?: any[];
}> {
  if (!isSupabaseConfigured()) return { success: false, repairedEmployees: 0, repairedRecords: 0, migratedHTEs: 0, deduplicatedZones: 0, outOfRegionTrainees: [] };

  try {
    // 1. Update any employee missing academic_year, legacy administrator position, mismatched HTE/ADM employee_ids, or missing photo
    const { data: emps, error: empFetchErr } = await supabase.from('employees').select('id, academic_year, position, employee_id, name, email, company_name, registration_address, photo');
    let repairedEmployees = 0;
    let migratedHTEs = 0;
    if (!empFetchErr && emps) {
      // Get current auth user if available to cross-fill avatar
      const { data: authSession } = await supabase.auth.getSession();
      const currentAuthUser = authSession?.session?.user;
      const currentAuthAvatar = currentAuthUser?.user_metadata?.avatar_url || currentAuthUser?.user_metadata?.picture;

      for (const e of emps) {
        let needsUpdate = false;
        const updates: any = {};
        if (!e.academic_year) {
          updates.academic_year = activeAY;
          needsUpdate = true;
        }
        if (e.position === 'Administrator') {
          updates.position = 'OJT Instructor';
          needsUpdate = true;
        }
        // Sync photo from session user if employee has no photo
        if ((!e.photo || e.photo === 'null' || e.photo === 'undefined') && currentAuthAvatar) {
          if (
            (currentAuthUser.email && e.email && currentAuthUser.email.toLowerCase() === e.email.toLowerCase()) ||
            currentAuthUser.id === e.id
          ) {
            updates.photo = currentAuthAvatar;
            needsUpdate = true;
          }
        }
        const isHTE = e.position === 'HTE Representative' || e.position === 'Training Supervisor' || (e.position && e.position.toLowerCase().includes('hte'));
        const isInstructor = e.position === 'OJT Instructor' || (e.position && e.position.toLowerCase().includes('instructor'));
        
        if (isHTE) {
          // SEPARATE HTE ACCOUNTS INTO host_supervisors TABLE
          try {
            await supabase.from('host_supervisors').upsert({
              id: e.id,
              name: e.name || 'HTE Representative',
              email: (e.email || '').trim().toLowerCase(),
              company_name: e.company_name || 'Host Training Establishment',
              position: 'HTE Representative',
              is_approved: true,
              active: true,
            }, { onConflict: 'id' });
            migratedHTEs++;
          } catch (mErr) {
            console.warn('HTE migration error:', mErr);
          }

          if (!e.employee_id || e.employee_id.startsWith('OJT-')) {
            updates.employee_id = e.employee_id && e.employee_id.startsWith('OJT-') ? e.employee_id.replace(/^OJT-/, 'HTE-') : `HTE-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
            needsUpdate = true;
          }
        } else if (isInstructor && (!e.employee_id || e.employee_id.startsWith('OJT-'))) {
          updates.employee_id = e.employee_id && e.employee_id.startsWith('OJT-') ? e.employee_id.replace(/^OJT-/, 'ADM-') : `ADM-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
          needsUpdate = true;
        }
        if (needsUpdate) {
          await supabase.from('employees').update(updates).eq('id', e.id);
          repairedEmployees++;
        }
      }
    }

    // 2. Audit Geofence Zones: Deduplicate redundant multi-row zones per trainee
    let deduplicatedZones = 0;
    try {
      const { data: allZones } = await supabase
        .from('geofence_zones')
        .select('id, name, employee_id, created_at')
        .order('created_at', { ascending: false });

      if (allZones && allZones.length > 0) {
        const seenKeys = new Set<string>();
        const toDelete: string[] = [];

        for (const z of allZones) {
          // Identify unique key for trainee zones
          const key = (z.employee_id || z.name || '').trim().toLowerCase();
          if (!key) continue;
          if (seenKeys.has(key)) {
            toDelete.push(z.id);
          } else {
            seenKeys.add(key);
          }
        }

        if (toDelete.length > 0) {
          for (const delId of toDelete) {
            await supabase.from('geofence_zones').delete().eq('id', delId);
            deduplicatedZones++;
          }
        }
      }
    } catch (gzErr) {
      console.warn('Geofence deduplication in repair notice:', gzErr);
    }

    // 3. Audit Trainees for Out-of-Region Coordinates (Outside Negros Occidental)
    const outOfRegionTrainees: string[] = [];
    try {
      const { data: traineeCoords } = await supabase
        .from('employees')
        .select('id, name, registration_lat, registration_lng, registration_location, position');

      if (traineeCoords) {
        for (const tc of traineeCoords) {
          const isStaff = tc.position && (tc.position.toLowerCase().includes('instructor') || tc.position.toLowerCase().includes('admin'));
          if (isStaff) continue;

          const lat = tc.registration_location?.lat ?? tc.registration_lat;
          const lng = tc.registration_location?.lng ?? tc.registration_lng;

          if (lat != null && lng != null) {
            if (!isWithinNegrosOccidental(Number(lat), Number(lng))) {
              outOfRegionTrainees.push(`${tc.name} (${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)})`);
            }
          }
        }
      }
      if (outOfRegionTrainees.length > 0) {
        console.warn(`[Audit] Found ${outOfRegionTrainees.length} trainees registered with coordinates outside Negros Occidental:`, outOfRegionTrainees);
      }
    } catch (auditErr) {
      console.warn('Location audit notice:', auditErr);
    }

    return {
      success: true,
      repairedEmployees,
      repairedRecords: 0,
      migratedHTEs,
      deduplicatedZones,
      outOfRegionTrainees,
    };
  } catch (e) {
    console.error('repairDatabaseData error:', e);
    return { success: false, repairedEmployees: 0, repairedRecords: 0, migratedHTEs: 0, deduplicatedZones: 0, outOfRegionTrainees: [] };
  }
}

export async function resetPasswordDirect(
  email: string,
  newPassword: string,
  otpCode?: string
): Promise<{ success: boolean; message?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = (otpCode || '').trim();

  // 1. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('reset-password-admin', {
      body: {
        email: cleanEmail,
        newPassword,
        otpCode: cleanOtp,
      },
    });

    if (!error && data && data.success !== false) {
      return { success: true, message: data?.message || 'Password updated successfully.' };
    }
    if (data?.error) {
      console.warn('[resetPasswordDirect] Edge Function reported error:', data.error);
    }
  } catch (edgeErr) {
    console.warn('[resetPasswordDirect] Edge Function unavailable, trying fallback API:', edgeErr);
  }

  // 2. Fallback to /api/reset-password endpoint
  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        newPassword,
        otpCode: cleanOtp,
      }),
    });

    const result = await res.json().catch(() => null);
    if (res.ok && result?.success !== false) {
      return { success: true, message: result?.message || 'Password updated successfully.' };
    }
    if (result?.error) {
      return { success: false, message: result.error };
    }
  } catch (fallbackErr) {
    console.error('[resetPasswordDirect] Fallback error:', fallbackErr);
  }

  return { success: false, message: 'Failed to update password. Please try again.' };
}

// ─── Departmental / Required Documents Cloud Sync ───────────────────────────

export async function fetchRequiredDocumentsFromStorage(): Promise<RequiredDocument[]> {
  if (_storesBootstrapCache.data?.requirements?.length && _storesBootstrapCache.expiresAt > Date.now()) {
    return _storesBootstrapCache.data.requirements;
  }
  // 1. Try server-side API proxy (CDN/memory cached)
  try {
    const apiRes = await fetch('/api/documents?action=get-requirements');
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {}

  // 2. Direct public Supabase CDN URL (without cache-busting query string!)
  try {
    const res = await fetch(
      'https://wooighmdckuoebsuegzz.supabase.co/storage/v1/object/public/face-photos/settings/requirements_store.json'
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch {}

  return [];
}

export async function saveRequiredDocumentsToStorage(docs: RequiredDocument[]): Promise<boolean> {
  _storesBootstrapCache = { data: null, expiresAt: 0 };
  broadcastLiveEvent('requirement_updated', { docs });
  // 1. Try server-side API proxy (service role)
  try {
    const apiRes = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-requirements', docs }),
    });
    if (apiRes.ok) return true;
  } catch {}

  // 2. Direct Supabase client upload
  if (!isSupabaseConfigured()) return false;
  try {
    const jsonStr = JSON.stringify(docs);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    const { error } = await supabase.storage.from('face-photos').upload('settings/requirements_store.json', blob, {
      contentType: 'application/json',
      upsert: true,
    });
    if (!error) return true;
  } catch (err) {
    console.warn('saveRequiredDocumentsToStorage notice:', err);
  }
  return false;
}

// ─── Monitoring Reports Cloud Sync (Mid-Term, End-Term, Monthly) ────────────

function slimMonitoringFileItem(f: any): any {
  if (!f || typeof f !== 'object') return f;
  const fileUrl = typeof f.fileUrl === 'string' ? f.fileUrl : '';
  const dataUrl = typeof f.dataUrl === 'string' ? f.dataUrl : '';
  const httpUrl = fileUrl.startsWith('http') ? fileUrl : dataUrl.startsWith('http') ? dataUrl : '';
  return {
    ...f,
    fileUrl: httpUrl || fileUrl || dataUrl,
    dataUrl: httpUrl || dataUrl,
  };
}

function hasMeaningfulSubmission(s: any): boolean {
  if (!s || typeof s !== 'object') return false;
  const hasFiles = Array.isArray(s.files) && s.files.length > 0;
  const hasNotes = typeof s.notes === 'string' && s.notes.trim().length > 0;
  return hasFiles || hasNotes;
}

function slimMonitoringReportList(reports: MonitoringReport[]): MonitoringReport[] {
  if (!Array.isArray(reports)) return [];
  return reports.map((r) => ({
    ...r,
    instructorFiles: Array.isArray(r.instructorFiles) ? r.instructorFiles.map(slimMonitoringFileItem) : r.instructorFiles,
    traineeFiles: Array.isArray(r.traineeFiles) ? r.traineeFiles.map(slimMonitoringFileItem) : r.traineeFiles,
    submissions: Array.isArray(r.submissions)
      ? r.submissions
          .filter(hasMeaningfulSubmission)
          .map((s) => ({
            ...s,
            files: Array.isArray(s.files) ? s.files.map(slimMonitoringFileItem) : [],
          }))
      : r.submissions,
  }));
}

export function mergeMonitoringSubmissionItem(a: any, b: any): any {
  if (!a) return b;
  if (!b) return a;

  const aSubTime = new Date(a.updatedAt || a.submittedAt || 0).getTime();
  const bSubTime = new Date(b.updatedAt || b.submittedAt || 0).getTime();
  const newerSub = bSubTime >= aSubTime ? b : a;
  const olderSub = bSubTime >= aSubTime ? a : b;

  const aRevTime = new Date(a.reviewedAt || 0).getTime();
  const bRevTime = new Date(b.reviewedAt || 0).getTime();
  const aHasRemarks = typeof a.instructorRemarks === 'string' && a.instructorRemarks.trim().length > 0;
  const bHasRemarks = typeof b.instructorRemarks === 'string' && b.instructorRemarks.trim().length > 0;

  let instructorRemarks = newerSub.instructorRemarks;
  let reviewedAt = newerSub.reviewedAt;

  if (bRevTime > aRevTime) {
    instructorRemarks = b.instructorRemarks ?? a.instructorRemarks;
    reviewedAt = b.reviewedAt;
  } else if (aRevTime > bRevTime) {
    instructorRemarks = a.instructorRemarks ?? b.instructorRemarks;
    reviewedAt = a.reviewedAt;
  } else if (bHasRemarks && !aHasRemarks) {
    instructorRemarks = b.instructorRemarks;
    reviewedAt = b.reviewedAt || a.reviewedAt;
  } else if (aHasRemarks && !bHasRemarks) {
    instructorRemarks = a.instructorRemarks;
    reviewedAt = a.reviewedAt || b.reviewedAt;
  }

  const status =
    a.status === 'reviewed' || b.status === 'reviewed' || Boolean(instructorRemarks && String(instructorRemarks).trim())
      ? 'reviewed'
      : newerSub.status || olderSub.status || 'submitted';

  // Authoritatively respect newerSub.files so edited/deleted files are NEVER resurrected from olderSub
  const filesSource = Array.isArray(newerSub.files)
    ? newerSub.files
    : Array.isArray(olderSub.files)
      ? olderSub.files
      : [];

  return {
    ...olderSub,
    ...newerSub,
    files: filesSource.map(slimMonitoringFileItem),
    notes: newerSub.notes !== undefined ? newerSub.notes : olderSub.notes,
    status,
    instructorRemarks,
    reviewedAt,
  };
}

export interface MonitoringReportMutationOptions {
  actorRole?: 'trainee' | 'instructor';
  actorTraineeId?: string;
  actorStudentId?: string;
  reportId?: string;
  traineeSubmissions?: any[];
  instructorFiles?: any[];
  reviewSubmission?: {
    submissionId: string;
    status?: 'submitted' | 'reviewed';
    instructorRemarks?: string;
    reviewedAt?: string;
  };
  newReport?: MonitoringReport;
  deleteReportId?: string;
  removedFileUrls?: string[];
}

export function mergeMonitoringReportsList(
  primaryList: MonitoringReport[],
  secondaryList: MonitoringReport[] = [],
  options?: { authoritativePrimary?: boolean }
): MonitoringReport[] {
  // When primaryList comes from cloud storage or a live broadcast, deleted reports & deleted submissions
  // must NOT be resurrected from stale local secondaryList!
  if (options?.authoritativePrimary) {
    const validPrimary = (primaryList || []).filter(
      (r) =>
        r &&
        r.id &&
        (Boolean(r.createdByRole) ||
          (Array.isArray(r.instructorFiles) && r.instructorFiles.length > 0) ||
          (Array.isArray(r.traineeFiles) && r.traineeFiles.length > 0) ||
          (Array.isArray(r.submissions) && r.submissions.length > 0))
    );
    return slimMonitoringReportList(validPrimary);
  }

  const map = new Map<string, MonitoringReport>();

  const addReportToMap = (r: MonitoringReport) => {
    if (!r || !r.id) return;
    if (
      !Boolean(r.createdByRole) &&
      !(Array.isArray(r.instructorFiles) && r.instructorFiles.length > 0) &&
      !(Array.isArray(r.traineeFiles) && r.traineeFiles.length > 0) &&
      !(Array.isArray(r.submissions) && r.submissions.length > 0)
    ) {
      return;
    }

    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, r);
      return;
    }

    const rTime = new Date(r.updatedAt || r.createdAt || 0).getTime();
    const eTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    // Tie goes to `existing` (which came from `primaryList`)
    const newer = rTime > eTime ? r : existing;
    const older = rTime > eTime ? existing : r;

    // Authoritative submissions: ONLY keep submissions present in `newer` so deleted submissions never reappear,
    // while enriching surviving submissions with any review metadata from `older`.
    const olderSubById = new Map<string, any>();
    for (const os of older.submissions || []) {
      if (os?.id) olderSubById.set(os.id, os);
    }
    const resolvedSubs = (newer.submissions || [])
      .filter(hasMeaningfulSubmission)
      .map((ns) => {
        const matchOld = ns?.id ? olderSubById.get(ns.id) : undefined;
        return matchOld ? mergeMonitoringSubmissionItem(matchOld, ns) : ns;
      });

    map.set(r.id, {
      ...older,
      ...newer,
      instructorFiles: Array.isArray(newer.instructorFiles) ? newer.instructorFiles : older.instructorFiles,
      submissions: resolvedSubs,
    });
  };

  for (const r of primaryList || []) addReportToMap(r);
  for (const r of secondaryList || []) addReportToMap(r);

  return slimMonitoringReportList(Array.from(map.values()));
}

export async function fetchMonitoringReportsFromStorage(forceFresh = false): Promise<MonitoringReport[]> {
  if (!forceFresh && _storesBootstrapCache.data?.monitoringReports?.length && _storesBootstrapCache.expiresAt > Date.now()) {
    return _storesBootstrapCache.data.monitoringReports;
  }
  try {
    const apiRes = await fetch(`/api/documents?action=get-monitoring-reports${forceFresh ? '&fresh=1' : ''}`, {
      cache: forceFresh ? 'no-store' : 'default',
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data)) {
        return mergeMonitoringReportsList(data, [], { authoritativePrimary: true });
      }
    }
  } catch {}

  try {
    const pubUrl = `https://wooighmdckuoebsuegzz.supabase.co/storage/v1/object/public/face-photos/settings/monitoring_reports_store.json${forceFresh ? `?t=${Date.now()}` : ''}`;
    const pubRes = await fetch(pubUrl, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
    });
    if (pubRes.ok) {
      const data = await pubRes.json();
      if (Array.isArray(data)) {
        return mergeMonitoringReportsList(data, [], { authoritativePrimary: true });
      }
    }
  } catch {}

  return [];
}

export async function saveMonitoringReportsToStorage(
  reports: MonitoringReport[],
  mutationOptions?: MonitoringReportMutationOptions
): Promise<MonitoringReport[] | null> {
  _storesBootstrapCache = { data: null, expiresAt: 0 };
  const slimmed = slimMonitoringReportList(reports);
  broadcastLiveEvent('monitoring_updated', {
    reports: slimmed,
    reportId: mutationOptions?.reportId,
    deleteReportId: mutationOptions?.deleteReportId,
    authoritative: true,
  });

  // 1. Server-side API proxy (atomic per-trainee / per-report merge in service role)
  try {
    const apiRes = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save-monitoring-reports',
        reports: slimmed,
        ...(mutationOptions || {}),
      }),
    });
    if (apiRes.ok) {
      const json = await apiRes.json().catch(() => null);
      if (Array.isArray(json?.reports)) {
        const canonical = slimMonitoringReportList(json.reports);
        broadcastLiveEvent('monitoring_updated', {
          reports: canonical,
          reportId: mutationOptions?.reportId,
          deleteReportId: mutationOptions?.deleteReportId,
          authoritative: true,
        });
        return canonical;
      }
      return slimmed;
    }
  } catch {}

  // 2. Direct Supabase client fallback (only when serverless /api is unavailable)
  if (!isSupabaseConfigured()) return null;
  try {
    const jsonStr = JSON.stringify(slimmed);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    const { error } = await supabase.storage.from('face-photos').upload('settings/monitoring_reports_store.json', blob, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true,
    });
    if (!error) return slimmed;
  } catch (err) {
    console.warn('saveMonitoringReportsToStorage notice:', err);
  }
  return null;
}

// ─── Evaluations & Questionnaire Cloud Storage Sync ──────────────────────────

export function mergeEvaluationItem(a: Evaluation, b: Evaluation): Evaluation {
  if (!a) return b;
  if (!b) return a;

  const aTime = new Date((a as any).updatedAt || a.evaluatedAt || 0).getTime();
  const bTime = new Date((b as any).updatedAt || b.evaluatedAt || 0).getTime();
  const newer = bTime >= aTime ? b : a;
  const older = bTime >= aTime ? a : b;

  const olderQ = older.questionnaire || {};
  const newerQ = newer.questionnaire || {};
  const mergedQ: EvaluationQuestionnaire = { ...olderQ, ...newerQ };

  for (const key of Object.keys(olderQ) as (keyof EvaluationQuestionnaire)[]) {
    const newerVal = String(newerQ[key] ?? '').trim();
    const olderVal = String(olderQ[key] ?? '').trim();
    if (!newerVal && olderVal) {
      (mergedQ as any)[key] = olderQ[key];
    }
  }

  const STATUS_ORDER: Record<string, number> = {
    draft: 1,
    submitted_by_trainee: 2,
    passed_to_hte: 3,
    submitted_to_instructor: 4,
    final: 4,
    reviewed_by_instructor: 5,
  };
  const aRank = STATUS_ORDER[a.status || 'draft'] || 1;
  const bRank = STATUS_ORDER[b.status || 'draft'] || 1;
  const mergedStatus = bRank >= aRank ? (b.status || a.status) : a.status;

  return {
    ...older,
    ...newer,
    id: !older.id?.startsWith('eval-') ? older.id : newer.id,
    status: mergedStatus,
    questionnaire: mergedQ,
    ratings:
      newer.ratings && Object.keys(newer.ratings).length > 0
        ? newer.ratings
        : older.ratings,
    ratingComments:
      newer.ratingComments && Object.keys(newer.ratingComments).length > 0
        ? newer.ratingComments
        : older.ratingComments,
    commentsSuggestions: newer.commentsSuggestions || older.commentsSuggestions,
    evaluatedAt: newer.evaluatedAt || older.evaluatedAt,
  };
}

export function mergeEvaluationsList(
  primaryList: Evaluation[],
  secondaryList: Evaluation[] = []
): Evaluation[] {
  const map = new Map<string, Evaluation>();

  const addEval = (ev: Evaluation) => {
    if (!ev) return;
    const key = (ev.employeeId || ev.id || '').toLowerCase();
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, ev);
    } else {
      map.set(key, mergeEvaluationItem(existing, ev));
    }
  };

  for (const ev of primaryList || []) addEval(ev);
  for (const ev of secondaryList || []) addEval(ev);

  return Array.from(map.values());
}

export async function fetchEvaluationsFromStorage(): Promise<Evaluation[]> {
  if (_storesBootstrapCache.data?.evaluations?.length && _storesBootstrapCache.expiresAt > Date.now()) {
    return _storesBootstrapCache.data.evaluations;
  }
  try {
    const apiRes = await fetch('/api/documents?action=get-evaluations');
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data)) {
        return mergeEvaluationsList(data);
      }
    }
  } catch {}

  try {
    const pubRes = await fetch(
      'https://wooighmdckuoebsuegzz.supabase.co/storage/v1/object/public/face-photos/settings/evaluations_store.json',
      { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined }
    );
    if (pubRes.ok) {
      const data = await pubRes.json();
      if (Array.isArray(data)) {
        return mergeEvaluationsList(data);
      }
    }
  } catch {}

  return [];
}

export async function saveEvaluationsToStorage(evaluations: Evaluation[]): Promise<boolean> {
  _storesBootstrapCache = { data: null, expiresAt: 0 };
  broadcastLiveEvent('evaluation_updated', { evaluations });
  let mergedToSave = evaluations;
  try {
    const existingRemote = await fetchEvaluationsFromStorage();
    if (existingRemote.length > 0) {
      mergedToSave = mergeEvaluationsList(evaluations, existingRemote);
    }
  } catch {}

  try {
    const apiRes = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-evaluations', evaluations: mergedToSave }),
    });
    if (apiRes.ok) return true;
  } catch {}

  if (!isSupabaseConfigured()) return false;
  try {
    const jsonStr = JSON.stringify(mergedToSave);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const { error } = await supabase.storage.from('face-photos').upload('settings/evaluations_store.json', blob, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true,
    });
    if (!error) return true;
  } catch (err) {
    console.warn('saveEvaluationsToStorage notice:', err);
  }
  return false;
}

// ─── DTTR & Attendance Time Records Cloud Storage Sync ──────────────────────

export function mergeMonthlyDttrsList(
  primaryList: MonthlyDttrRecord[],
  secondaryList: MonthlyDttrRecord[] = []
): MonthlyDttrRecord[] {
  const map = new Map<string, MonthlyDttrRecord>();

  // Build employee alias map to reconcile student code (e.g. 20231331) and UUID
  const aliasMap = new Map<string, string>();
  if (typeof window !== 'undefined') {
    try {
      const storedEmployees = JSON.parse(localStorage.getItem('ojt_employees') || '[]');
      if (Array.isArray(storedEmployees)) {
        storedEmployees.forEach((emp: any) => {
          if (emp && emp.id) {
            const canonical = String(emp.id).toLowerCase();
            aliasMap.set(canonical, canonical);
            if (emp.employeeId) aliasMap.set(String(emp.employeeId).toLowerCase(), canonical);
            if (emp.email) aliasMap.set(String(emp.email).toLowerCase(), canonical);
          }
        });
      }
    } catch {}
  }

  const addRecord = (rec: MonthlyDttrRecord) => {
    if (!rec || !rec.employeeId) return;
    const rawEmp = String(rec.employeeId).toLowerCase();
    const canonicalEmp = aliasMap.get(rawEmp) || rawEmp;
    const key = `${canonicalEmp}_${Number(rec.year)}_${Number(rec.month)}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...rec, employeeId: canonicalEmp });
      return;
    }

    const rTime = new Date(rec.updatedAt || 0).getTime();
    const eTime = new Date(existing.updatedAt || 0).getTime();
    const newer = rTime >= eTime ? rec : existing;
    const older = rTime >= eTime ? existing : rec;

    const mergedCustom: Record<number, any> = {
      ...(older.customEntries || {}),
      ...(newer.customEntries || {}),
    };

    const allDays = new Set([
      ...Object.keys(older.customEntries || {}),
      ...Object.keys(newer.customEntries || {}),
    ]);

    for (const dayStr of allDays) {
      const d = Number(dayStr);
      const oldEntry = (older.customEntries || {})[d];
      const newEntry = (newer.customEntries || {})[d];
      if (oldEntry && newEntry) {
        const oldTasks = oldEntry.tasks && String(oldEntry.tasks).trim();
        const newTasks = newEntry.tasks && String(newEntry.tasks).trim();
        mergedCustom[d] = {
          ...oldEntry,
          ...newEntry,
          amArrival: newEntry.amArrival || oldEntry.amArrival || '',
          amDeparture: newEntry.amDeparture || oldEntry.amDeparture || '',
          pmArrival: newEntry.pmArrival || oldEntry.pmArrival || '',
          pmDeparture: newEntry.pmDeparture || oldEntry.pmDeparture || '',
          hours: newEntry.hours || oldEntry.hours || 0,
          tasks: newTasks || oldTasks || '',
        };
      } else if (newEntry) {
        mergedCustom[d] = newEntry;
      } else if (oldEntry) {
        mergedCustom[d] = oldEntry;
      }
    }

    map.set(key, {
      ...older,
      ...newer,
      employeeId: canonicalEmp,
      customEntries: mergedCustom,
      hteSignatureStatus:
        older.hteSignatureStatus === 'signed' || newer.hteSignatureStatus === 'signed'
          ? 'signed'
          : newer.hteSignatureStatus || older.hteSignatureStatus,
      hteSignedAt: newer.hteSignedAt || older.hteSignedAt,
      hteSupervisorName: newer.hteSupervisorName || older.hteSupervisorName,
      hteSupervisorTitle: newer.hteSupervisorTitle || older.hteSupervisorTitle,
    });
  };

  for (const r of primaryList || []) addRecord(r);
  for (const r of secondaryList || []) addRecord(r);

  return Array.from(map.values());
}

let _dttrFetchCache: {
  data: { monthlyDttrs: MonthlyDttrRecord[]; timeRecords: TimeRecord[] } | null;
  expiresAt: number;
  inflight: Promise<{ monthlyDttrs: MonthlyDttrRecord[]; timeRecords: TimeRecord[] }> | null;
} = { data: null, expiresAt: 0, inflight: null };

export async function fetchDttrStoreFromStorage(): Promise<{
  monthlyDttrs: MonthlyDttrRecord[];
  timeRecords: TimeRecord[];
}> {
  if (_storesBootstrapCache.data?.dttr && _storesBootstrapCache.expiresAt > Date.now()) {
    return _storesBootstrapCache.data.dttr;
  }
  if (_dttrFetchCache.data && _dttrFetchCache.expiresAt > Date.now()) {
    return _dttrFetchCache.data;
  }
  if (_dttrFetchCache.inflight) {
    return _dttrFetchCache.inflight;
  }

  const p = (async (): Promise<{ monthlyDttrs: MonthlyDttrRecord[]; timeRecords: TimeRecord[] }> => {
    try {
      const pubRes = await fetch(
        'https://wooighmdckuoebsuegzz.supabase.co/storage/v1/object/public/face-photos/settings/dttr_store.json',
        { signal: AbortSignal.timeout ? AbortSignal.timeout(4500) : undefined }
      );
      if (pubRes.ok) {
        const data = await pubRes.json();
        if (data && typeof data === 'object') {
          const out = {
            monthlyDttrs: Array.isArray(data.monthlyDttrs) ? mergeMonthlyDttrsList(data.monthlyDttrs) : [],
            timeRecords: Array.isArray(data.timeRecords) ? data.timeRecords : [],
          };
          _dttrFetchCache = { data: out, expiresAt: Date.now() + 25000, inflight: null };
          return out;
        }
      }
    } catch {}

    try {
      const apiRes = await fetch('/api/documents?action=get-dttr');
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data && typeof data === 'object') {
          const out = {
            monthlyDttrs: Array.isArray(data.monthlyDttrs) ? mergeMonthlyDttrsList(data.monthlyDttrs) : [],
            timeRecords: Array.isArray(data.timeRecords) ? data.timeRecords : [],
          };
          _dttrFetchCache = { data: out, expiresAt: Date.now() + 25000, inflight: null };
          return out;
        }
      }
    } catch {}

    return { monthlyDttrs: [], timeRecords: [] };
  })().finally(() => {
    _dttrFetchCache.inflight = null;
  });

  _dttrFetchCache.inflight = p;
  return p;
}

let _dttrSaveChain: Promise<boolean> = Promise.resolve(true);

export async function saveDttrStoreToStorage(payload: {
  monthlyDttrs?: MonthlyDttrRecord[];
  timeRecords?: TimeRecord[];
}): Promise<boolean> {
  // Immediately broadcast delta to all open Instructor, HTE, and Trainee browsers (<80ms latency!)
  _storesBootstrapCache = { data: null, expiresAt: 0 };
  _dttrFetchCache = { data: null, expiresAt: 0, inflight: null };
  _allTimeRecordsCache = { data: null, expiresAt: 0, inflight: null };
  _empTimeRecordsCache.clear();
  broadcastLiveEvent('task_updated', {
    monthlyDttrs: payload.monthlyDttrs,
    timeRecords: payload.timeRecords,
  });

  // Serialize server delta writes so concurrent task + timeRecord updates never race or pre-fetch full store
  const runSave = async (): Promise<boolean> => {
    let apiNotMounted = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      const apiRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-dttr',
          monthlyDttrs: payload.monthlyDttrs,
          timeRecords: payload.timeRecords,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (apiRes.status === 404) {
        apiNotMounted = true;
      } else {
        return apiRes.ok;
      }
    } catch {
      // Do not hammer browser Storage upload with a second 544 when production /api/documents timed out
      return false;
    }

    // Fallback ONLY when running standalone local Vite dev without /api serverless routes (404)
    if (!apiNotMounted || !isSupabaseConfigured()) return false;
    try {
      const existing = await fetchDttrStoreFromStorage();
      const mergedMonthly = payload.monthlyDttrs
        ? mergeMonthlyDttrsList(payload.monthlyDttrs, existing.monthlyDttrs)
        : existing.monthlyDttrs;
      const mergedTimeRecords = payload.timeRecords
        ? [...payload.timeRecords, ...(existing.timeRecords || [])].slice(0, 1500)
        : existing.timeRecords || [];
      const blob = new Blob(
        [JSON.stringify({ monthlyDttrs: mergedMonthly, timeRecords: mergedTimeRecords, updatedAt: new Date().toISOString() })],
        { type: 'application/json' }
      );
      const { error } = await supabase.storage.from('face-photos').upload('settings/dttr_store.json', blob, {
        contentType: 'application/json',
        cacheControl: '60',
        upsert: true,
      });
      return !error;
    } catch {
      return false;
    }
  };

  _dttrSaveChain = _dttrSaveChain.then(runSave, runSave);
  return _dttrSaveChain;
}