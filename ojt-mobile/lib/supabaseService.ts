import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export async function uploadFacePhoto(
  employeeId: string,
  base64Data: string,
  type: 'profile' | 'time_in' | 'time_out' = 'profile'
): Promise<string> {
  if (!base64Data) return base64Data;
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) return base64Data;

  try {
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const arrayBuffer = decode(base64Content);
    const cleanEmpId = (employeeId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanEmpId}/${type}_${Date.now()}.jpg`;

    // Route by photo type: profile photos go to face-photos,
    // time in/out photos go to time-records-photos.
    const primaryBucket = type === 'profile' ? 'face-photos' : 'time-records-photos';
    const bucketsToTry = [primaryBucket, 'face-photos', 'avatars'].filter(
      (b, i, arr) => arr.indexOf(b) === i // dedupe in case primaryBucket === 'face-photos'
    );

    for (const bucketName of bucketsToTry) {
      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            return urlData.publicUrl;
          }
        }
      } catch (bErr) {
        console.warn(`[Storage] Exception uploading to bucket "${bucketName}":`, bErr);
      }
    }
  } catch (err) {
    console.debug('Storage upload fallback notice:', err);
  }

  return base64Data;
}

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  position: string;
  companyName: string;
  supervisorName: string;
  schoolName: string;
  campus?: string;
  course: string;
  startDate?: string;
  endDate?: string;
  requiredHours: number;
  photo?: string;
  faceRegistered: boolean;
  createdAt?: string;
  active: boolean;
  instructorId?: string;
  hteId?: string;
  linkedAt?: string;
  registrationLocation?: { lat: number; lng: number };
  registrationAddress?: string;
  academicYear?: string;
  applicationStatus?: 'unregistered' | 'pending' | 'approved' | 'rejected';
  documentsPassed?: boolean;
  documentsStatus?: 'passed' | 'pending' | 'submitted' | 'incomplete';
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  amArrival?: string;
  amDeparture?: string;
  pmArrival?: string;
  pmDeparture?: string;
  amArrivalFaceVerified?: boolean;
  amDepartureFaceVerified?: boolean;
  pmArrivalFaceVerified?: boolean;
  pmDepartureFaceVerified?: boolean;
  amArrivalGeofenced?: boolean;
  amDepartureGeofenced?: boolean;
  pmArrivalGeofenced?: boolean;
  pmDepartureGeofenced?: boolean;
  timeInLocation?: { lat: number; lng: number };
  timeOutLocation?: { lat: number; lng: number };
  timeInGeofenced: boolean;
  timeOutGeofenced: boolean;
  timeInFaceVerified: boolean;
  timeOutFaceVerified: boolean;
  timeInPhoto?: string;
  timeOutPhoto?: string;
  totalHours?: number;
  status: 'present' | 'late' | 'absent' | 'half-day' | 'overtime';
  notes?: string;
  academicYear?: string;
  approvalStatus?: 'approved' | 'disapproved' | 'pending';
  approvalNote?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface GeofenceZone {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  active: boolean;
  academicYear?: string;
}

export interface AppSettings {
  workStartTime: string;
  workEndTime: string;
  lateThresholdMinutes: number;
  geofenceEnabled: boolean;
  facialRecognitionEnabled: boolean;
  academicYears: string[];
  activeAcademicYear: string;
}

export interface Evaluation {
  id: string;
  employeeId: string;
  evaluatedBy: string;
  attendanceScore: number;
  performanceScore: number;
  attitudeScore: number;
  punctualityScore: number;
  communicationScore: number;
  overallScore: number;
  grade: string;
  strengths?: string;
  areasForImprovement?: string;
  recommendations?: string;
  evaluatedAt: string;
  status: 'draft' | 'final' | 'submitted' | 'submitted_to_instructor' | 'reviewed_by_instructor';
  academicYear?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'general' | 'urgent' | 'event' | 'task';
  targetRole: 'all' | 'employee' | 'admin' | 'hte';
  isPinned: boolean;
  createdAt: string;
  expiresAt?: string;
  createdBy: string;
  createdByRole?: string;
  academicYear?: string;
  photo?: string;
  reminder?: string;
  deadlineAt?: string;
  comments?: any[];
  requiresSubmission?: boolean;
}

export interface HostFeedback {
  id: string;
  employeeId: string;
  hostName: string;
  hostCompany: string;
  hostPosition: string;
  hostEmail: string;
  attendanceScore: number;
  performanceScore: number;
  attitudeScore: number;
  communicationScore: number;
  teamworkScore: number;
  overallScore: number;
  strengths: string;
  areasForImprovement: string;
  recommendation: string;
  submittedAt: string;
  status: 'submitted' | 'reviewed';
  academicYear?: string;
}

// ─── Transformation Helpers ───

function transformEmployee(data: any): Employee {
  return {
    id: data.id,
    name: data.name || '',
    employeeId: data.employee_id || '',
    email: data.email || '',
    department: data.department || '',
    position: data.position || 'Student Trainee',
    companyName: data.company_name || '',
    supervisorName: data.supervisor_name || '',
    schoolName: data.school_name || '',
    campus: data.campus,
    course: data.course || '',
    startDate: data.start_date,
    endDate: data.end_date,
    requiredHours: Number(data.required_hours) || 300,
    photo: data.photo,
    faceRegistered: Boolean(data.face_registered),
    createdAt: data.created_at,
    active: data.active !== false,
    academicYear: data.academic_year,
    registrationLocation: (() => {
      if (data.registration_lat != null && data.registration_lng != null) {
        return { lat: Number(data.registration_lat), lng: Number(data.registration_lng) };
      }
      if (data.registration_address) {
        const match = String(data.registration_address).match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
        if (match) {
          return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        }
      }
      return undefined;
    })(),
    registrationAddress: data.registration_address,
    instructorId: data.instructor_id,
    hteId: data.hte_id,
    linkedAt: data.linked_at,
    applicationStatus: data.application_status || 'approved',
    documentsPassed: data.documents_passed !== undefined ? Boolean(data.documents_passed) : true,
    documentsStatus: data.documents_status || (data.documents_passed === false ? 'pending' : 'passed'),
  };
}

function parseMobileTimeMins(t?: string | null): number | null {
  if (!t || typeof t !== 'string') return null;
  const trimmed = t.trim();
  const m12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    const ap = m12[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
  return null;
}

function extractMobileSlots(notes?: string | null): Record<string, any> {
  if (!notes || typeof notes !== 'string') return {};
  const m = notes.match(/\[slots:(.*?)\]/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }
  return {};
}

function encodeMobileSlots(existingNotes: string | undefined | null, slotsObj: Record<string, any>): string | undefined {
  const clean = (existingNotes || '').replace(/\s*\[slots:.*?\]/g, '').trim();
  const filtered: Record<string, any> = {};
  Object.entries(slotsObj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') filtered[k] = v;
  });
  if (Object.keys(filtered).length === 0) return clean || undefined;
  const tag = `[slots:${JSON.stringify(filtered)}]`;
  return clean ? `${clean} ${tag}` : tag;
}

function transformTimeRecord(data: any): TimeRecord {
  const slots = extractMobileSlots(data.notes);
  const cleanNotes = (data.notes || '').replace(/\s*\[slots:.*?\]/g, '').trim() || undefined;
  const rawIn = data.time_in || data.timeIn;
  const rawOut = data.time_out || data.timeOut;
  const safeOut = rawOut && rawOut !== rawIn ? rawOut : undefined;
  const inMins = parseMobileTimeMins(rawIn);
  const outMins = parseMobileTimeMins(safeOut);

  const amArrival = slots.amArrival || data.amArrival || (inMins !== null && inMins < 12 * 60 ? rawIn : undefined);
  let amDeparture = slots.amDeparture || data.amDeparture || undefined;
  let pmArrival = slots.pmArrival || data.pmArrival || (inMins !== null && inMins >= 12 * 60 && !amArrival ? rawIn : undefined);
  let pmDeparture =
    slots.pmDeparture ||
    data.pmDeparture ||
    (outMins !== null && safeOut !== amDeparture && (outMins >= 13 * 60 || (outMins >= 12 * 60 && Boolean(pmArrival)))
      ? safeOut
      : undefined);

  if (!amDeparture && !pmDeparture && outMins !== null && outMins < 13 * 60 && amArrival && !pmArrival) {
    amDeparture = safeOut;
  }
  if (amArrival && pmDeparture) {
    const aIn = parseMobileTimeMins(amArrival);
    const pOut = parseMobileTimeMins(pmDeparture);
    if (aIn !== null && pOut !== null && aIn < 12 * 60 && pOut >= 13 * 60) {
      if (!amDeparture) amDeparture = '12:00:00';
      if (!pmArrival) pmArrival = '13:00:00';
    }
  }

  return {
    id: data.id,
    employeeId: data.employee_id || data.employeeId,
    date: data.date,
    timeIn: rawIn,
    timeOut: safeOut,
    amArrival,
    amDeparture,
    pmArrival,
    pmDeparture,
    amArrivalFaceVerified: slots.amArrivalFaceVerified ?? (amArrival ? Boolean(data.time_in_face_verified) : undefined),
    amDepartureFaceVerified: slots.amDepartureFaceVerified ?? (amDeparture ? Boolean(data.time_out_face_verified) : undefined),
    pmArrivalFaceVerified: slots.pmArrivalFaceVerified ?? (pmArrival ? Boolean(data.time_in_face_verified) : undefined),
    pmDepartureFaceVerified: slots.pmDepartureFaceVerified ?? (pmDeparture ? Boolean(data.time_out_face_verified) : undefined),
    timeInLocation:
      data.time_in_lat && data.time_in_lng
        ? { lat: Number(data.time_in_lat), lng: Number(data.time_in_lng) }
        : undefined,
    timeOutLocation:
      data.time_out_lat && data.time_out_lng
        ? { lat: Number(data.time_out_lat), lng: Number(data.time_out_lng) }
        : undefined,
    timeInGeofenced: Boolean(data.time_in_geofenced ?? data.timeInGeofenced),
    timeOutGeofenced: Boolean(data.time_out_geofenced ?? data.timeOutGeofenced),
    timeInFaceVerified: Boolean(data.time_in_face_verified ?? data.timeInFaceVerified),
    timeOutFaceVerified: Boolean(data.time_out_face_verified ?? data.timeOutFaceVerified),
    timeInPhoto: data.time_in_photo ?? data.timeInPhoto,
    timeOutPhoto: data.time_out_photo ?? data.timeOutPhoto,
    totalHours: Math.round((Number(data.total_hours ?? data.totalHours) || 0) * 100) / 100,
    status: data.status || 'present',
    notes: cleanNotes,
    academicYear: data.academic_year || slots.academicYear,
    approvalStatus: data.approval_status || 'pending',
    approvalNote: data.approval_note,
    approvedBy: data.approved_by,
    approvedAt: data.approved_at,
  };
}

// ─── API Operations ───

const MOBILE_EMP_COLS =
  'id, employee_id, email, name, department, position, company_name, supervisor_name, school_name, campus, course, start_date, end_date, required_hours, photo, face_registered, active, academic_year, instructor_id, hte_id, linked_at, application_status, registration_lat, registration_lng, registration_address, created_at';

const MOBILE_TIME_RECORD_COLS =
  'id, employee_id, date, time_in, time_out, time_in_lat, time_in_lng, time_out_lat, time_out_lng, time_in_geofenced, time_out_geofenced, time_in_face_verified, time_out_face_verified, time_in_photo, time_out_photo, total_hours, status, notes, created_at';

export const mobileDb = {
  // Employees / Profiles
  async getEmployees(academicYear?: string): Promise<Employee[]> {
    let query = supabase.from('employees').select(MOBILE_EMP_COLS).order('created_at', { ascending: false }).limit(1000);
    if (academicYear) {
      query = query.or(`academic_year.eq.${academicYear},academic_year.is.null,position.eq.OJT Instructor,position.eq.HTE Representative`);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching employees:', error);
      return [];
    }
    return (data || []).map(transformEmployee);
  },

  async getEmployeeById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase.from('employees').select(MOBILE_EMP_COLS).eq('id', id).maybeSingle();
    if (error || !data) return null;
    return transformEmployee(data);
  },

  async getTraineesByInstructor(instructorId: string, academicYear?: string): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select(MOBILE_EMP_COLS)
      .or(`instructor_id.eq.${instructorId},id.eq.${instructorId}`)
      .order('name', { ascending: true })
      .limit(500);
    
    if (academicYear) {
      query = query.or(`academic_year.eq.${academicYear},academic_year.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching instructor trainees:', error);
      return [];
    }
    return (data || [])
      .map(transformEmployee)
      .filter((e) => e.position !== 'OJT Instructor' && e.position !== 'HTE Representative');
  },

  async getTraineesByHte(hteId: string, academicYear?: string, companyName?: string): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select(MOBILE_EMP_COLS)
      .order('name', { ascending: true })
      .limit(500);

    if (hteId && companyName && companyName.trim() !== '') {
      query = query.or(`hte_id.eq.${hteId},company_name.ilike.%${companyName.trim()}%`);
    } else if (hteId) {
      query = query.eq('hte_id', hteId);
    } else if (companyName && companyName.trim() !== '') {
      query = query.ilike('company_name', `%${companyName.trim()}%`);
    }
    
    if (academicYear) {
      query = query.or(`academic_year.eq.${academicYear},academic_year.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching HTE trainees:', error);
      return [];
    }
    return (data || [])
      .map(transformEmployee)
      .filter((e) => e.position !== 'OJT Instructor' && e.position !== 'HTE Representative');
  },

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<boolean> {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.department !== undefined) payload.department = updates.department;
    if (updates.position !== undefined) payload.position = updates.position;
    if (updates.companyName !== undefined) payload.company_name = updates.companyName;
    if (updates.supervisorName !== undefined) payload.supervisor_name = updates.supervisorName;
    if (updates.schoolName !== undefined) payload.school_name = updates.schoolName;
    if (updates.campus !== undefined) payload.campus = updates.campus;
    if (updates.course !== undefined) payload.course = updates.course;
    if (updates.requiredHours !== undefined) payload.required_hours = updates.requiredHours;
    if (updates.photo !== undefined) {
      let photoUrl = updates.photo;
      if (photoUrl && !photoUrl.startsWith('http')) {
        try {
          photoUrl = await uploadFacePhoto(updates.employeeId || id, photoUrl, 'profile');
        } catch (pErr) {
          console.warn('Face photo upload notice:', pErr);
        }
      }
      payload.photo = photoUrl;
    }
    if (updates.faceRegistered !== undefined) payload.face_registered = updates.faceRegistered;
    if (updates.active !== undefined) payload.active = updates.active;
    if (updates.academicYear !== undefined) payload.academic_year = updates.academicYear;
    if (updates.instructorId !== undefined) payload.instructor_id = updates.instructorId;
    if (updates.hteId !== undefined) payload.hte_id = updates.hteId;
    if (updates.applicationStatus !== undefined) payload.application_status = updates.applicationStatus;
    if (updates.documentsPassed !== undefined) payload.documents_passed = updates.documentsPassed;
    if (updates.documentsStatus !== undefined) payload.documents_status = updates.documentsStatus;
    if (updates.registrationLocation) {
      payload.registration_lat = updates.registrationLocation.lat;
      payload.registration_lng = updates.registrationLocation.lng;
    }
    if (updates.registrationAddress !== undefined) payload.registration_address = updates.registrationAddress;

    const { error } = await supabase.from('employees').update(payload).eq('id', id);
    if (error) {
      console.error('Failed to update employee:', error);
      return false;
    }
    return true;
  },

  // Time Records / Attendance
  async getTimeRecords(employeeId?: string, academicYear?: string, altId?: string): Promise<TimeRecord[]> {
    const ids = [employeeId, altId].filter(Boolean) as string[];
    let query = supabase
      .from('time_records')
      .select(MOBILE_TIME_RECORD_COLS)
      .order('date', { ascending: false })
      .limit(ids.length > 0 ? 500 : 300);
    if (ids.length > 0) query = query.in('employee_id', ids);
    // Note: Do not query academic_year in SQL as column does not exist on time_records in Supabase
    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching time records:', error);
      return [];
    }
    const records = (data || []).map(transformTimeRecord);
    if (academicYear) {
      return records.filter((r) => !r.academicYear || r.academicYear === academicYear);
    }
    return records;
  },

  async getTodayTimeRecord(employeeId: string, altId?: string): Promise<TimeRecord | null> {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const utcToday = now.toISOString().split('T')[0];
    const targetDates = Array.from(new Set([localToday, utcToday]));

    const ids = [employeeId, altId].filter(Boolean) as string[];
    const { data, error } = await supabase
      .from('time_records')
      .select(MOBILE_TIME_RECORD_COLS)
      .in('employee_id', ids)
      .in('date', targetDates)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return transformTimeRecord(data);
  },

  async saveTimeRecord(record: Omit<TimeRecord, 'id'> & { id?: string }): Promise<TimeRecord | null> {
    const rawInPhoto = record.timeInPhoto;
    const rawOutPhoto = record.timeOutPhoto;

    // Use existing HTTP URL if already uploaded, otherwise proceed immediately without waiting for upload
    const initialInPhoto = rawInPhoto?.startsWith('http') ? rawInPhoto : undefined;
    const initialOutPhoto = rawOutPhoto?.startsWith('http') ? rawOutPhoto : undefined;

    // Look up existing day record if id was omitted so morning timestamps are permanently preserved across AM/PM punches
    let existingRow: any = null;
    try {
      if (record.id) {
        const { data } = await supabase
          .from('time_records')
          .select('id, time_in, time_out, total_hours, notes')
          .eq('id', record.id)
          .maybeSingle();
        existingRow = data;
      } else if (record.employeeId && record.date) {
        const { data } = await supabase
          .from('time_records')
          .select('id, time_in, time_out, total_hours, notes')
          .eq('employee_id', record.employeeId)
          .eq('date', record.date)
          .limit(1)
          .maybeSingle();
        existingRow = data;
      }
    } catch {}

    const prevSlots = extractMobileSlots(existingRow?.notes || record.notes);
    const inMins = parseMobileTimeMins(record.timeIn);
    const outMins = parseMobileTimeMins(record.timeOut);

    let amArrival = prevSlots.amArrival || record.amArrival;
    let amDeparture = prevSlots.amDeparture || record.amDeparture;
    let pmArrival = prevSlots.pmArrival || record.pmArrival;
    let pmDeparture = prevSlots.pmDeparture || record.pmDeparture;

    if (record.timeIn && !record.timeOut) {
      // Clock-In punch via facial recognition
      if (!amArrival && inMins !== null && inMins < 12 * 60) {
        amArrival = record.timeIn;
        prevSlots.amArrivalFaceVerified = true;
      } else if (!pmArrival && (inMins === null || inMins >= 12 * 60 || Boolean(amArrival))) {
        pmArrival = record.timeIn;
        prevSlots.pmArrivalFaceVerified = true;
      }
    } else if (record.timeOut) {
      // Clock-Out punch via facial recognition
      if (!amArrival && existingRow?.time_in) {
        const exInM = parseMobileTimeMins(existingRow.time_in);
        if (exInM !== null && exInM < 12 * 60) amArrival = existingRow.time_in;
      }
      if (outMins !== null && outMins < 13 * 60 && amArrival && !pmArrival && !amDeparture) {
        amDeparture = record.timeOut;
        prevSlots.amDepartureFaceVerified = true;
      } else if (!pmDeparture) {
        pmDeparture = record.timeOut;
        prevSlots.pmDepartureFaceVerified = true;
        if (amArrival && !amDeparture) amDeparture = '12:00:00';
        if (amArrival && !pmArrival) pmArrival = '13:00:00';
      }
    }

    // Recompute accurate 4-slot rendered hours
    let calcMins = 0;
    const aInM = parseMobileTimeMins(amArrival);
    const aOutM = parseMobileTimeMins(amDeparture);
    const pInM = parseMobileTimeMins(pmArrival);
    const pOutM = parseMobileTimeMins(pmDeparture);
    if (aInM !== null && aOutM !== null && aOutM > aInM) calcMins += aOutM - aInM;
    if (pInM !== null && pOutM !== null && pOutM > pInM) calcMins += pOutM - pInM;
    const slotHours = calcMins > 0 ? Math.round((calcMins / 60) * 100) / 100 : (record.totalHours || 0);

    const encodedNotes = encodeMobileSlots(record.notes ?? existingRow?.notes, {
      ...prevSlots,
      amArrival,
      amDeparture,
      pmArrival,
      pmDeparture,
      academicYear: record.academicYear || prevSlots.academicYear,
    });

    const effectiveId = record.id || existingRow?.id;
    const permanentTimeIn = existingRow?.time_in || amArrival || pmArrival || record.timeIn;
    const rawCandidateOut = pmDeparture || amDeparture || record.timeOut || existingRow?.time_out;
    const permanentTimeOut = rawCandidateOut && rawCandidateOut !== permanentTimeIn ? rawCandidateOut : undefined;

    const payload: any = {
      employee_id: record.employeeId,
      date: record.date,
      time_in: permanentTimeIn,
      time_out: permanentTimeOut,
      time_in_lat: record.timeInLocation?.lat,
      time_in_lng: record.timeInLocation?.lng,
      time_out_lat: record.timeOutLocation?.lat,
      time_out_lng: record.timeOutLocation?.lng,
      time_in_geofenced: Boolean(existingRow?.time_in_geofenced || record.timeInGeofenced),
      time_out_geofenced: Boolean(record.timeOutGeofenced),
      time_in_face_verified: Boolean(existingRow?.time_in_face_verified || record.timeInFaceVerified),
      time_out_face_verified: Boolean(record.timeOutFaceVerified),
      ...(initialInPhoto ? { time_in_photo: initialInPhoto } : {}),
      ...(initialOutPhoto ? { time_out_photo: initialOutPhoto } : {}),
      total_hours: slotHours,
      status: record.status,
      notes: encodedNotes,
      ...(record.approvalStatus ? { approval_status: record.approvalStatus } : {}),
      ...(record.approvalNote ? { approval_note: record.approvalNote } : {}),
      ...(record.approvedBy ? { approved_by: record.approvedBy } : {}),
      ...(record.approvedAt ? { approved_at: record.approvedAt } : {}),
    };

    let savedData: any = null;

    // 1. Primary path: sync via /api/time-records so mobile punches immediately mirror to DTTR store too
    try {
      const apiRes = await fetch('https://chmsuojtmis.site/api/time-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          id: effectiveId,
          amArrival,
          amDeparture,
          pmArrival,
          pmDeparture,
        }),
      });
      if (apiRes.ok) {
        const parsed = await apiRes.json().catch(() => null);
        if (Array.isArray(parsed?.records) && parsed.records[0]) {
          savedData = parsed.records[0];
        }
      }
    } catch {}

    // 2. Direct Supabase fallback if API endpoint was unreachable
    if (!savedData) {
      if (effectiveId) {
        const { data, error } = await supabase
          .from('time_records')
          .update(payload)
          .eq('id', effectiveId)
          .select()
          .single();
        if (error) {
          console.error('Error updating time record:', error);
          return null;
        }
        savedData = data;
      } else {
        const { data, error } = await supabase.from('time_records').insert([payload]).select().single();
        if (error) {
          console.error('Error inserting time record:', error);
          return null;
        }
        savedData = data;
      }
    }

    const savedRecord = {
      ...transformTimeRecord(savedData),
      academicYear: record.academicYear,
    };

    // Asynchronously upload photo in background and update record without delaying the attendance timestamp
    const recordId = savedRecord.id;
    if (recordId) {
      if (rawInPhoto && !rawInPhoto.startsWith('http')) {
        uploadFacePhoto(record.employeeId, rawInPhoto, 'time_in')
          .then((url) => {
            if (url) supabase.from('time_records').update({ time_in_photo: url }).eq('id', recordId);
          })
          .catch((e) => console.warn('Background time_in photo upload notice:', e));
      }
      if (rawOutPhoto && !rawOutPhoto.startsWith('http')) {
        uploadFacePhoto(record.employeeId, rawOutPhoto, 'time_out')
          .then((url) => {
            if (url) supabase.from('time_records').update({ time_out_photo: url }).eq('id', recordId);
          })
          .catch((e) => console.warn('Background time_out photo upload notice:', e));
      }
    }

    return savedRecord;
  },

  async updateTimeRecordApproval(
    id: string,
    approvalStatus: 'approved' | 'disapproved' | 'pending',
    note?: string,
    approvedBy?: string
  ): Promise<boolean> {
    const payload: any = {
      approval_status: approvalStatus,
      approved_at: new Date().toISOString(),
    };
    if (note !== undefined) payload.approval_note = note;
    if (approvedBy !== undefined) payload.approved_by = approvedBy;

    const { error } = await supabase.from('time_records').update(payload).eq('id', id);
    if (error) {
      console.error('Error updating time record approval:', error);
      return false;
    }
    return true;
  },

  // Geofence Zones
  async getGeofenceZones(academicYear?: string): Promise<GeofenceZone[]> {
    const query = supabase.from('geofence_zones').select('*').order('name', { ascending: true });
    // Note: Do not query academic_year in SQL as column does not exist on geofence_zones in Supabase
    const { data, error } = await query;
    if (error) return [];
    const zones = (data || []).map((z: any) => ({
      id: z.id,
      name: z.name,
      address: z.address,
      lat: Number(z.lat),
      lng: Number(z.lng),
      radius: Number(z.radius),
      active: z.active !== false,
      academicYear: z.academic_year,
    }));
    if (academicYear) {
      return zones.filter((z: any) => !z.academicYear || z.academicYear === academicYear);
    }
    return zones;
  },

  // Announcements
  async getAnnouncements(academicYear?: string): Promise<Announcement[]> {
    let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (academicYear) {
      query = query.or(`academic_year.eq.${academicYear},academic_year.is.null`);
    }
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      type: a.type || 'general',
      targetRole: a.target_role || 'all',
      isPinned: Boolean(a.is_pinned),
      createdAt: a.created_at,
      expiresAt: a.expires_at,
      createdBy: a.created_by || 'OJT Instructor',
      createdByRole: a.created_by_role,
      academicYear: a.academic_year,
      photo: a.photo,
      reminder: a.reminder,
      deadlineAt: a.deadline_at,
      comments: a.comments || [],
      requiresSubmission: Boolean(a.requires_submission),
    }));
  },

  async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt'>): Promise<Announcement | null> {
    const payload = {
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      target_role: announcement.targetRole,
      is_pinned: announcement.isPinned,
      expires_at: announcement.expiresAt,
      created_by: announcement.createdBy,
      created_by_role: announcement.createdByRole,
      academic_year: announcement.academicYear,
      photo: announcement.photo,
      reminder: announcement.reminder,
      deadline_at: announcement.deadlineAt,
      comments: announcement.comments || [],
      requires_submission: announcement.requiresSubmission,
    };
    const { data, error } = await supabase.from('announcements').insert([payload]).select().single();
    if (error) {
      console.error('Error creating announcement:', error);
      return null;
    }
    return {
      id: data.id,
      ...announcement,
      createdAt: data.created_at,
    };
  },

  // Evaluations
  async getEvaluations(employeeId?: string, academicYear?: string): Promise<Evaluation[]> {
    let query = supabase.from('evaluations').select('*').order('evaluated_at', { ascending: false });
    if (employeeId) query = query.eq('employee_id', employeeId);
    // Note: Do not query academic_year in SQL as column does not exist on evaluations in Supabase
    const { data, error } = await query;
    if (error) return [];
    const evals = (data || []).map((e: any) => ({
      id: e.id,
      employeeId: e.employee_id,
      evaluatedBy: e.evaluated_by,
      attendanceScore: Number(e.attendance_score) || 0,
      performanceScore: Number(e.performance_score) || 0,
      attitudeScore: Number(e.attitude_score) || 0,
      punctualityScore: Number(e.punctuality_score) || 0,
      communicationScore: Number(e.communication_score) || 0,
      overallScore: Number(e.overall_score) || 0,
      grade: e.grade || 'N/A',
      strengths: e.strengths,
      areasForImprovement: e.areas_for_improvement,
      recommendations: e.recommendations,
      evaluatedAt: e.evaluated_at,
      status: e.status || 'submitted',
      academicYear: e.academic_year,
    }));
    if (academicYear) {
      return evals.filter((e: any) => !e.academicYear || e.academicYear === academicYear);
    }
    return evals;
  },

  async saveEvaluation(evaluation: Omit<Evaluation, 'id'>): Promise<Evaluation | null> {
    const payload = {
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
      areas_for_improvement: evaluation.areasForImprovement,
      recommendations: evaluation.recommendations,
      evaluated_at: evaluation.evaluatedAt,
      status: evaluation.status === 'draft' ? 'draft' : 'final',
      // Note: Omit academic_year as evaluations table does not have an academic_year column
    };
    const { data, error } = await supabase.from('evaluations').insert([payload]).select().single();
    if (error) {
      console.error('Error saving evaluation:', error);
      return null;
    }
    return {
      id: data.id,
      ...evaluation,
    };
  },

  // Host Feedback
  async getHostFeedback(employeeId?: string): Promise<HostFeedback[]> {
    let query = supabase.from('host_feedback').select('*').order('submitted_at', { ascending: false });
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map((h: any) => ({
      id: h.id,
      employeeId: h.employee_id,
      hostName: h.host_name,
      hostCompany: h.host_company,
      hostPosition: h.host_position,
      hostEmail: h.host_email,
      attendanceScore: Number(h.attendance_score) || 0,
      performanceScore: Number(h.performance_score) || 0,
      attitudeScore: Number(h.attitude_score) || 0,
      communicationScore: Number(h.communication_score) || 0,
      teamworkScore: Number(h.teamwork_score) || 0,
      overallScore: Number(h.overall_score) || 0,
      strengths: h.strengths,
      areasForImprovement: h.areas_for_improvement,
      recommendation: h.recommendation,
      submittedAt: h.submitted_at,
      status: h.status || 'submitted',
      academicYear: h.academic_year,
    }));
  },

  async saveHostFeedback(feedback: Omit<HostFeedback, 'id'>): Promise<HostFeedback | null> {
    const payload = {
      employee_id: feedback.employeeId,
      host_name: feedback.hostName,
      host_company: feedback.hostCompany,
      host_position: feedback.hostPosition,
      host_email: feedback.hostEmail,
      attendance_score: feedback.attendanceScore,
      performance_score: feedback.performanceScore,
      attitude_score: feedback.attitudeScore,
      communication_score: feedback.communicationScore,
      teamwork_score: feedback.teamworkScore,
      overall_score: feedback.overallScore,
      strengths: feedback.strengths,
      areas_for_improvement: feedback.areasForImprovement,
      recommendation: feedback.recommendation,
      submitted_at: feedback.submittedAt,
      status: feedback.status,
      // Note: Omit academic_year as host_feedback table does not have an academic_year column
    };
    const { data, error } = await supabase.from('host_feedback').insert([payload]).select().single();
    if (error) {
      console.error('Error saving host feedback:', error);
      return null;
    }
    return {
      id: data.id,
      ...feedback,
    };
  },

  // App Settings
  async getSettings(): Promise<AppSettings | null> {
    const { data, error } = await supabase.from('app_settings').select('*').maybeSingle();
    if (error || !data) return null;
    return {
      workStartTime: data.work_start_time || '08:00',
      workEndTime: data.work_end_time || '17:00',
      lateThresholdMinutes: data.late_threshold_minutes || 15,
      geofenceEnabled: data.geofence_enabled !== false,
      facialRecognitionEnabled: data.facial_recognition_enabled !== false,
      academicYears: Array.isArray(data.academic_years) ? data.academic_years : ['2025-2026', '2026-2027'],
      activeAcademicYear: data.active_academic_year || '2025-2026',
    };
  },

  async resetPasswordDirect(email: string, newPassword: string, otpCode?: string): Promise<{ success: boolean; message?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.functions.invoke('reset-password-admin', {
        body: {
          email: cleanEmail,
          newPassword,
          otpCode: (otpCode || '').trim(),
        },
      });

      if (error) {
        console.warn('[mobileDb.resetPasswordDirect] Edge Function error:', error);
        return { success: false, message: error.message || 'Failed to update password.' };
      }

      if (data && data.success === false) {
        return { success: false, message: data.error || 'Failed to update password.' };
      }

      return { success: true, message: data?.message || 'Password updated successfully.' };
    } catch (err: any) {
      console.error('[mobileDb.resetPasswordDirect] Unexpected error:', err);
      return { success: false, message: err?.message || 'Unexpected error updating password.' };
    }
  },
};
