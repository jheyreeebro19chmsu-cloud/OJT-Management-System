import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Employee, TimeRecord, GeofenceZone, AppSettings, Evaluation, Announcement, HostFeedback, AnnouncementSubmission, AnnouncementComment, HostSupervisor } from '../types';

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

export async function fetchEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }

  return (data || []).map(transformSupabaseEmployee);
}

export async function createEmployee(employee: Omit<Employee, 'id' | 'createdAt'> & { id?: string }): Promise<Employee | null> {
  if (!isSupabaseConfigured()) return null;

  const isHTE = employee.position === 'HTE Representative' || employee.position === 'Training Supervisor' || (employee.position && employee.position.toLowerCase().includes('hte'));
  const isInstructor = employee.position === 'OJT Instructor' || (employee.position && employee.position.toLowerCase().includes('instructor'));
  const rolePrefix = isHTE ? 'HTE' : isInstructor ? 'ADM' : 'OJT';

  let assignedEmployeeId = employee.employeeId;
  if (!assignedEmployeeId || (isHTE && assignedEmployeeId.startsWith('OJT-')) || (isInstructor && assignedEmployeeId.startsWith('OJT-'))) {
    if (assignedEmployeeId && (isHTE || isInstructor) && assignedEmployeeId.startsWith('OJT-')) {
      assignedEmployeeId = assignedEmployeeId.replace(/^OJT-/, `${rolePrefix}-`);
    } else {
      assignedEmployeeId = `${rolePrefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
    }
  }

  const supabaseEmployee: any = {
    name: employee.name,
    employee_id: assignedEmployeeId,
    email: employee.email,
    department: employee.department,
    position: employee.position,
    company_name: employee.companyName,
    supervisor_name: employee.supervisorName,
    school_name: employee.schoolName,
    campus: employee.campus,
    course: employee.course,
    start_date: employee.startDate,
    end_date: employee.endDate,
    required_hours: employee.requiredHours,
    photo: employee.photo,
    face_registered: employee.faceRegistered,
    active: employee.active,
    registration_lat: employee.registrationLocation?.lat,
    registration_lng: employee.registrationLocation?.lng,
    registration_address: employee.registrationAddress,
    academic_year: employee.academicYear,
    instructor_id: (employee as any).instructorId || null,
    hte_id: (employee as any).hteId || null,
    application_status: (employee as any).applicationStatus || 'approved',
  };

  if (employee.id) {
    supabaseEmployee.id = employee.id;
  }

  const { data, error } = await supabase.from('employees').insert([supabaseEmployee]).select().single();

  if (error) {
    console.error('Error creating employee:', error);
    throw new Error(error.message || JSON.stringify(error));
  }

  return transformSupabaseEmployee(data);
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabaseUpdates: any = {};
  if (updates.name !== undefined) supabaseUpdates.name = updates.name;
  if (updates.employeeId !== undefined) supabaseUpdates.employee_id = updates.employeeId;
  if (updates.email !== undefined) supabaseUpdates.email = updates.email;
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
  if (updates.photo !== undefined) supabaseUpdates.photo = updates.photo;
  if (updates.faceRegistered !== undefined) supabaseUpdates.face_registered = updates.faceRegistered;
  if (updates.active !== undefined) supabaseUpdates.active = updates.active;
  if (updates.academicYear !== undefined) supabaseUpdates.academic_year = updates.academicYear;
  if (updates.applicationStatus !== undefined) supabaseUpdates.application_status = updates.applicationStatus;
  if (updates.registrationLocation !== undefined) {
    supabaseUpdates.registration_lat = updates.registrationLocation?.lat;
    supabaseUpdates.registration_lng = updates.registrationLocation?.lng;
  }
  if (updates.registrationAddress !== undefined) {
    supabaseUpdates.registration_address = updates.registrationAddress;
  }

  const { error } = await supabase.from('employees').update(supabaseUpdates).eq('id', id);

  if (error) {
    console.error('Error updating employee:', error);
    return false;
  }

  return true;
}

export async function deleteEmployee(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    // Delete from employees table
    const { error: empError } = await supabase.from('employees').delete().eq('id', id);
    if (empError) {
      console.warn('Error deleting employee row:', empError);
    }

    // Also delete any corresponding host supervisor entry
    const { error: hostError } = await supabase.from('host_supervisors').delete().eq('id', id);
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

export async function fetchTimeRecords(): Promise<TimeRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('time_records').select('*').order('date', { ascending: false });

  if (error) {
    console.error('Error fetching time records:', error);
    return [];
  }

  return (data || []).map(transformSupabaseTimeRecord);
}

export async function createTimeRecord(record: Omit<TimeRecord, 'id'>): Promise<TimeRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const supabaseRecord = {
    employee_id: record.employeeId,
    date: record.date,
    time_in: record.timeIn,
    time_out: record.timeOut,
    time_in_lat: record.timeInLocation?.lat,
    time_in_lng: record.timeInLocation?.lng,
    time_out_lat: record.timeOutLocation?.lat,
    time_out_lng: record.timeOutLocation?.lng,
    time_in_geofenced: record.timeInGeofenced,
    time_out_geofenced: record.timeOutGeofenced,
    time_in_face_verified: record.timeInFaceVerified,
    time_out_face_verified: record.timeOutFaceVerified,
    time_in_photo: record.timeInPhoto,
    time_out_photo: record.timeOutPhoto,
    total_hours: record.totalHours,
    status: record.status,
    notes: record.notes,
    academic_year: record.academicYear,
  };

  const { data, error } = await supabase.from('time_records').insert([supabaseRecord]).select().single();

  if (error) {
    console.error('Error creating time record:', error);
    throw new Error(error.message || JSON.stringify(error));
  }

  return transformSupabaseTimeRecord(data);
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
  if (updates.timeInPhoto !== undefined) supabaseUpdates.time_in_photo = updates.timeInPhoto;
  if (updates.timeOutPhoto !== undefined) supabaseUpdates.time_out_photo = updates.timeOutPhoto;
  if (updates.totalHours !== undefined) supabaseUpdates.total_hours = updates.totalHours;
  if (updates.status !== undefined) supabaseUpdates.status = updates.status;
  if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes;
  if (updates.academicYear !== undefined) supabaseUpdates.academic_year = updates.academicYear;

  let { error, data } = await supabase.from('time_records').update(supabaseUpdates).eq('id', id).select();

  // If update by id did not match any row (e.g. temporary local ID), match by employee_id and date
  if ((error || !data || data.length === 0) && updates.employeeId) {
    const targetDate = updates.date || new Date().toISOString().split('T')[0];
    const { error: err2 } = await supabase
      .from('time_records')
      .update(supabaseUpdates)
      .eq('employee_id', updates.employeeId)
      .eq('date', targetDate);
    if (!err2) return true;
  }

  if (error) {
    console.error('Error updating time record:', error);
    return false;
  }

  return true;
}

export async function uploadFacePhoto(
  employeeId: string,
  base64Data: string,
  type: 'profile' | 'time_in' | 'time_out' = 'profile'
): Promise<string> {
  if (!isSupabaseConfigured() || !base64Data) return base64Data;

  try {
    if (base64Data.startsWith('http')) return base64Data;

    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    const fileName = `${employeeId || 'unassigned'}/${type}_${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        return urlData.publicUrl;
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

  const { data, error } = await supabase.from('geofence_zones').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching geofence zones:', error);
    return [];
  }

  return (data || [])
    .filter((zone: any) => !zone.name?.toLowerCase().includes('main training center') && zone.id !== 'zone-1')
    .map((zone: any) => ({
      id: zone.id,
      name: zone.name,
      address: zone.address,
      lat: Number(zone.lat),
      lng: Number(zone.lng),
      radius: Number(zone.radius) || 150,
      active: zone.active !== false,
      academicYear: zone.academic_year || undefined,
    }));
}

export async function createGeofenceZone(zone: Omit<GeofenceZone, 'id'> & { id?: string }): Promise<GeofenceZone | null> {
  if (!isSupabaseConfigured()) return null;

  const payload: any = {
    name: zone.name,
    address: zone.address || '',
    lat: Number(zone.lat),
    lng: Number(zone.lng),
    radius: Number(zone.radius) || 150,
    active: zone.active !== false,
  };

  if (zone.id && isValidUUID(zone.id)) {
    payload.id = zone.id;
  }

  const { data, error } = await supabase
    .from('geofence_zones')
    .upsert([payload], payload.id ? { onConflict: 'id' } : undefined)
    .select()
    .single();

  if (error) {
    console.error('Error creating/upserting geofence zone in database:', error);
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

export async function updateGeofenceZone(id: string, updates: Partial<GeofenceZone>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  if (!isValidUUID(id)) {
    console.debug('Skipping database update for non-UUID zone ID:', id);
    return true;
  }

  const supabaseUpdates: any = {};
  if (updates.name !== undefined) supabaseUpdates.name = updates.name;
  if (updates.address !== undefined) supabaseUpdates.address = updates.address;
  if (updates.lat !== undefined) supabaseUpdates.lat = Number(updates.lat);
  if (updates.lng !== undefined) supabaseUpdates.lng = Number(updates.lng);
  if (updates.radius !== undefined) supabaseUpdates.radius = Number(updates.radius);
  if (updates.active !== undefined) supabaseUpdates.active = updates.active;

  const { error } = await supabase.from('geofence_zones').update(supabaseUpdates).eq('id', id);

  if (error) {
    console.error('Error updating geofence zone:', error);
    return false;
  }

  return true;
}

export async function deleteGeofenceZone(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  if (!isValidUUID(id)) {
    return true;
  }

  const { error } = await supabase.from('geofence_zones').delete().eq('id', id);

  if (error) {
    console.error('Error deleting geofence zone:', error);
    return false;
  }

  return true;
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

export async function fetchSettings(): Promise<AppSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.from('app_settings').select('*').maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching settings:', error);
    return null;
  }

  if (!data) return null;

  return {
    workStartTime: data.work_start_time,
    workEndTime: data.work_end_time,
    lateThresholdMinutes: data.late_threshold_minutes,
    geofenceEnabled: data.geofence_enabled,
    facialRecognitionEnabled: data.facial_recognition_enabled,
    academicYears: Array.isArray(data.academic_years) && data.academic_years.length > 0 ? data.academic_years : ['2025-2026'],
    activeAcademicYear: data.active_academic_year || '2025-2026',
  };
}

export async function updateSettings(settings: AppSettings): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabaseSettings = {
    work_start_time: settings.workStartTime,
    work_end_time: settings.workEndTime,
    late_threshold_minutes: settings.lateThresholdMinutes,
    geofence_enabled: settings.geofenceEnabled,
    facial_recognition_enabled: settings.facialRecognitionEnabled,
    academic_years: settings.academicYears,
    active_academic_year: settings.activeAcademicYear,
  };

  const { error: updateError, count } = await supabase.from('app_settings').update(supabaseSettings).eq('id', 1);

  if (updateError || count === 0) {
    const { error: insertError } = await supabase.from('app_settings').insert([{ id: 1, ...supabaseSettings }]);

    if (insertError) {
      console.error('Error inserting settings:', insertError);
      return false;
    }
  }

  return true;
}

// ─── Evaluations ─────────────────────────────────────────────────────────────

export async function fetchEvaluations(): Promise<Evaluation[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('evaluations').select('*').order('evaluated_at', { ascending: false });

  if (error) {
    console.error('Error fetching evaluations:', error);
    return [];
  }

  return (data || []).map((evaluation: any) => ({
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
    recommendations: evaluation.recommendations,
    evaluatedAt: evaluation.evaluated_at,
    status: evaluation.status,
    academicYear: evaluation.academic_year,
  }));
}

export async function createEvaluation(evaluation: Omit<Evaluation, 'id'>): Promise<Evaluation | null> {
  if (!isSupabaseConfigured()) return null;

  const supabaseEval = {
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
    status: evaluation.status,
    academic_year: evaluation.academicYear,
  };

  const { data, error } = await supabase.from('evaluations').insert([supabaseEval]).select().single();

  if (error) {
    console.error('Error creating evaluation:', error);
    return null;
  }

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
    recommendations: data.recommendations,
    evaluatedAt: data.evaluated_at,
    status: data.status,
    academicYear: data.academic_year,
  };
}

export async function updateEvaluation(id: string, updates: Partial<Evaluation>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

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
  if (updates.recommendations !== undefined) supabaseUpdates.recommendations = updates.recommendations;
  if (updates.status !== undefined) supabaseUpdates.status = updates.status;
  if (updates.academicYear !== undefined) supabaseUpdates.academic_year = updates.academicYear;

  const { error } = await supabase.from('evaluations').update(supabaseUpdates).eq('id', id);

  if (error) {
    console.error('Error updating evaluation:', error);
    return false;
  }

  return true;
}

export async function deleteEvaluation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('evaluations').delete().eq('id', id);

  if (error) {
    console.error('Error deleting evaluation:', error);
    return false;
  }

  return true;
}

// ─── Announcements ───────────────────────────────────────────────────────────
// FIXED: fetchAnnouncements now maps ALL columns (previously silently dropped photo,
// reminder, deadline_at, comments, requires_submission, created_by_role).
// FIXED: createAnnouncement now sends ALL fields to Supabase, and THROWS on error
// instead of silently returning null (which is what let failed saves hide from you).

export async function fetchAnnouncements(): Promise<Announcement[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }

  return (data || []).map((ann: any) => ({
    id: ann.id,
    title: ann.title,
    content: ann.content,
    type: ann.type,
    targetRole: ann.target_role,
    isPinned: ann.is_pinned,
    createdAt: ann.created_at,
    expiresAt: ann.expires_at,
    createdBy: ann.created_by,
    createdByRole: ann.created_by_role,
    academicYear: ann.academic_year,
    photo: ann.photo,
    reminder: ann.reminder,
    deadlineAt: ann.deadline_at,
    comments: ann.comments,
    requiresSubmission: ann.requires_submission,
  }));
}

export async function createAnnouncement(announcement: Omit<Announcement, 'id'>): Promise<Announcement | null> {
  if (!isSupabaseConfigured()) return null;

  const supabaseAnn = {
    title: announcement.title,
    content: announcement.content,
    type: announcement.type,
    target_role: announcement.targetRole,
    is_pinned: announcement.isPinned,
    expires_at: announcement.expiresAt,
    created_by: announcement.createdBy,
    created_by_role: announcement.createdByRole,
    academic_year: (announcement as any).academicYear,
    photo: announcement.photo,
    reminder: announcement.reminder,
    deadline_at: announcement.deadlineAt,
    comments: announcement.comments,
    requires_submission: announcement.requiresSubmission,
    // created_at intentionally omitted — let the DB default (now()) set it
  };

  const { data, error } = await supabase.from('announcements').insert([supabaseAnn]).select().single();

  if (error) {
    console.error('Error creating announcement:', error);
    // Throw instead of returning null, so AppContext.addAnnouncement's .catch()
    // actually finds out the save failed instead of silently treating it as done.
    throw new Error(error.message || JSON.stringify(error));
  }

  return {
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
    reminder: data.reminder,
    deadlineAt: data.deadline_at,
    comments: data.comments,
    requiresSubmission: data.requires_submission,
  } as Announcement;
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
  if (updates.reminder !== undefined) supabaseUpdates.reminder = updates.reminder;
  if (updates.deadlineAt !== undefined) supabaseUpdates.deadline_at = updates.deadlineAt;
  if (updates.comments !== undefined) supabaseUpdates.comments = updates.comments;
  if (updates.requiresSubmission !== undefined) supabaseUpdates.requires_submission = updates.requiresSubmission;
  if (updates.createdByRole !== undefined) supabaseUpdates.created_by_role = updates.createdByRole;

  const { error } = await supabase.from('announcements').update(supabaseUpdates).eq('id', id);

  if (error) {
    console.error('Error updating announcement:', error);
    return false;
  }

  return true;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

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

export async function fetchAnnouncementComments(): Promise<AnnouncementComment[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('announcement_comments')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.debug('Error fetching announcement comments:', error);
      return [];
    }

    return (data || []).map((comm: any) => ({
      id: comm.id,
      announcementId: comm.announcement_id,
      employeeId: comm.employee_id || undefined,
      authorName: comm.author_name || 'User',
      authorRole: comm.author_role || 'employee',
      content: comm.content || '',
      createdAt: comm.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.debug('Comments fetch caught:', err);
    return [];
  }
}

export async function createAnnouncementComment(comment: Omit<AnnouncementComment, 'id'>): Promise<AnnouncementComment | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const payload = {
      announcement_id: comment.announcementId,
      employee_id: comment.employeeId || null,
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
      console.warn('Error saving announcement comment:', error);
      return null;
    }

    return {
      id: data?.id || `comm-${Date.now()}`,
      announcementId: data?.announcement_id || comment.announcementId,
      employeeId: data?.employee_id || comment.employeeId,
      authorName: data?.author_name || comment.authorName,
      authorRole: data?.author_role || comment.authorRole,
      content: data?.content || comment.content,
      createdAt: data?.created_at || comment.createdAt,
    };
  } catch (err) {
    console.warn('Create comment caught:', err);
    return null;
  }
}

// ─── Host Feedback ────────────────────────────────────────────────────────────

export async function fetchHostFeedback(): Promise<HostFeedback[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('host_feedback').select('*').order('submitted_at', { ascending: false });

  if (error) {
    console.error('Error fetching host feedback:', error);
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
}

export async function createHostFeedback(feedback: Omit<HostFeedback, 'id'>): Promise<HostFeedback | null> {
  if (!isSupabaseConfigured()) return null;

  const supabaseHf = {
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
    academic_year: feedback.academicYear,
  };

  const { data, error } = await supabase.from('host_feedback').insert([supabaseHf]).select().single();

  if (error) {
    console.error('Error creating host feedback:', error);
    return null;
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
    academicYear: data.academic_year,
  };
}

// ─── Transform Helpers ───────────────────────────────────────────────────────

function transformSupabaseEmployee(data: any): Employee {
  const isHTE = data.position === 'HTE Representative' || data.position === 'Training Supervisor' || (data.position && data.position.toLowerCase().includes('hte'));
  const isInstructor = data.position === 'OJT Instructor' || (data.position && data.position.toLowerCase().includes('instructor'));
  let normalizedEmployeeId = data.employee_id;
  if (isHTE && normalizedEmployeeId && normalizedEmployeeId.startsWith('OJT-')) {
    normalizedEmployeeId = normalizedEmployeeId.replace(/^OJT-/, 'HTE-');
  } else if (isInstructor && normalizedEmployeeId && normalizedEmployeeId.startsWith('OJT-')) {
    normalizedEmployeeId = normalizedEmployeeId.replace(/^OJT-/, 'ADM-');
  }

  return {
    id: data.id,
    name: data.name,
    employeeId: normalizedEmployeeId || (isHTE ? `HTE-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}` : isInstructor ? `ADM-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}` : `OJT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`),
    email: data.email,
    department: data.department,
    position: data.position,
    companyName: data.company_name,
    supervisorName: data.supervisor_name,
    schoolName: data.school_name,
    campus: data.campus,
    course: data.course,
    startDate: data.start_date,
    endDate: data.end_date,
    requiredHours: data.required_hours,
    photo: data.photo,
    faceRegistered: data.face_registered,
    createdAt: data.created_at,
    active: data.active,
    academicYear: data.academic_year,
    registrationLocation:
      data.registration_lat && data.registration_lng
        ? { lat: data.registration_lat, lng: data.registration_lng }
        : undefined,
    registrationAddress: data.registration_address,
    instructorId: data.instructor_id,
    hteId: data.hte_id,
    linkedAt: data.linked_at,
    applicationStatus: data.application_status || 'approved',
    documentsPassed: data.documents_passed !== undefined ? Boolean(data.documents_passed) : true,
    documentsStatus: data.documents_status || (data.documents_passed === false ? 'pending' : 'passed'),
  };
}

function transformSupabaseTimeRecord(data: any): TimeRecord {
  return {
    id: data.id,
    employeeId: data.employee_id,
    date: data.date,
    timeIn: data.time_in,
    timeOut: data.time_out,
    timeInLocation: data.time_in_lat && data.time_in_lng ? { lat: data.time_in_lat, lng: data.time_in_lng } : undefined,
    timeOutLocation:
      data.time_out_lat && data.time_out_lng ? { lat: data.time_out_lat, lng: data.time_out_lng } : undefined,
    timeInGeofenced: data.time_in_geofenced,
    timeOutGeofenced: data.time_out_geofenced,
    timeInFaceVerified: data.time_in_face_verified,
    timeOutFaceVerified: data.time_out_face_verified,
    timeInPhoto: data.time_in_photo,
    timeOutPhoto: data.time_out_photo,
    totalHours: data.total_hours,
    status: data.status,
    notes: data.notes,
    academicYear: data.academic_year,
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
  if (!isSupabaseConfigured() || records.length === 0) return false;

  try {
    const payload = records.map((rec) => ({
      id: rec.id,
      employee_id: rec.employeeId,
      date: rec.date,
      time_in: rec.timeIn,
      time_out: rec.timeOut,
      time_in_lat: rec.timeInLocation?.lat,
      time_in_lng: rec.timeInLocation?.lng,
      time_out_lat: rec.timeOutLocation?.lat,
      time_out_lng: rec.timeOutLocation?.lng,
      time_in_geofenced: rec.timeInGeofenced,
      time_out_geofenced: rec.timeOutGeofenced,
      time_in_face_verified: rec.timeInFaceVerified,
      time_out_face_verified: rec.timeOutFaceVerified,
      time_in_photo: rec.timeInPhoto,
      time_out_photo: rec.timeOutPhoto,
      total_hours: rec.totalHours,
      status: rec.status,
      notes: rec.notes,
      academic_year: rec.academicYear,
    }));

    const { error } = await supabase.from('time_records').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error upserting time records in Supabase:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('upsertTimeRecords exception:', e);
    return false;
  }
}

// ─── Host Supervisors (HTE Establishment Accounts) ───────────────────────────

export async function fetchHostSupervisors(): Promise<HostSupervisor[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('host_supervisors').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching host_supervisors:', error);
    return [];
  }
  return (data || []).map(transformSupabaseHostSupervisor);
}

export async function createHostSupervisor(host: HostSupervisor): Promise<HostSupervisor | null> {
  if (!isSupabaseConfigured()) return null;

  const payload: any = {
    id: host.id,
    name: host.name,
    email: host.email?.trim().toLowerCase(),
    company_name: host.companyName,
    company_address: host.companyAddress || null,
    contact_person: host.contactPerson || host.name,
    phone: host.phone || null,
    academic_year: host.academicYear || null,
    is_approved: host.isApproved ?? true,
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
  if (updates.name !== undefined) supabaseUpdates.name = updates.name;
  if (updates.email !== undefined) supabaseUpdates.email = updates.email.trim().toLowerCase();
  if (updates.companyName !== undefined) supabaseUpdates.company_name = updates.companyName;
  if (updates.companyAddress !== undefined) supabaseUpdates.company_address = updates.companyAddress;
  if (updates.contactPerson !== undefined) supabaseUpdates.contact_person = updates.contactPerson;
  if (updates.phone !== undefined) supabaseUpdates.phone = updates.phone;
  if (updates.academicYear !== undefined) supabaseUpdates.academic_year = updates.academicYear;
  if (updates.isApproved !== undefined) supabaseUpdates.is_approved = updates.isApproved;

  const { error } = await supabase.from('host_supervisors').update(supabaseUpdates).eq('id', id);
  if (error) {
    console.error('Error updating host_supervisor:', error);
    return false;
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

  try {
    const payload = hosts.map((h) => ({
      id: h.id,
      name: h.name,
      email: h.email?.trim().toLowerCase(),
      company_name: h.companyName,
      company_address: h.companyAddress || null,
      contact_person: h.contactPerson || h.name,
      phone: h.phone || null,
      academic_year: h.academicYear || null,
      is_approved: h.isApproved ?? true,
    }));

    const { error } = await supabase.from('host_supervisors').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error upserting host_supervisors:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('upsertHostSupervisors exception:', e);
    return false;
  }
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

export async function repairDatabaseData(activeAY = '2026-2027'): Promise<{ success: boolean; repairedEmployees: number; repairedRecords: number; migratedHTEs: number }> {
  if (!isSupabaseConfigured()) return { success: false, repairedEmployees: 0, repairedRecords: 0, migratedHTEs: 0 };

  try {
    // 1. Update any employee missing academic_year, legacy administrator position, or mismatched HTE/ADM employee_ids
    const { data: emps, error: empFetchErr } = await supabase.from('employees').select('id, academic_year, position, employee_id, name, email, company_name, registration_address');
    let repairedEmployees = 0;
    let migratedHTEs = 0;
    if (!empFetchErr && emps) {
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
              company_address: e.registration_address || 'Company Workplace',
              contact_person: e.name,
              academic_year: e.academic_year || activeAY,
              is_approved: true,
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

    // 2. Update any time_records missing academic_year
    const { data: recs, error: recFetchErr } = await supabase.from('time_records').select('id, academic_year');
    let repairedRecords = 0;
    if (!recFetchErr && recs) {
      for (const r of recs) {
        if (!r.academic_year) {
          await supabase.from('time_records').update({ academic_year: activeAY }).eq('id', r.id);
          repairedRecords++;
        }
      }
    }

    return { success: true, repairedEmployees, repairedRecords, migratedHTEs };
  } catch (e) {
    console.error('repairDatabaseData error:', e);
    return { success: false, repairedEmployees: 0, repairedRecords: 0, migratedHTEs: 0 };
  }
}