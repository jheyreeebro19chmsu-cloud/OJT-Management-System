import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Employee, TimeRecord, GeofenceZone, AppSettings, Evaluation, Announcement } from '../types';

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

  const supabaseEmployee: any = {
    name: employee.name,
    employee_id: employee.employeeId,
    email: employee.email,
    department: employee.department,
    position: employee.position,
    company_name: employee.companyName,
    supervisor_name: employee.supervisorName,
    school_name: employee.schoolName,
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
  };

  if (employee.id) {
    supabaseEmployee.id = employee.id;
  }

  const { data, error } = await supabase.from('employees').insert([supabaseEmployee]).select().single();

  if (error) {
    console.error('Error creating employee:', error);
    return null;
  }

  return transformSupabaseEmployee(data);
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabaseUpdates: any = {};
  if (updates.name !== undefined) supabaseUpdates.name = updates.name;
  if (updates.email !== undefined) supabaseUpdates.email = updates.email;
  if (updates.department !== undefined) supabaseUpdates.department = updates.department;
  if (updates.position !== undefined) supabaseUpdates.position = updates.position;
  if (updates.companyName !== undefined) supabaseUpdates.company_name = updates.companyName;
  if (updates.supervisorName !== undefined) supabaseUpdates.supervisor_name = updates.supervisorName;
  if (updates.schoolName !== undefined) supabaseUpdates.school_name = updates.schoolName;
  if (updates.course !== undefined) supabaseUpdates.course = updates.course;
  if (updates.startDate !== undefined) supabaseUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) supabaseUpdates.end_date = updates.endDate;
  if (updates.requiredHours !== undefined) supabaseUpdates.required_hours = updates.requiredHours;
  if (updates.photo !== undefined) supabaseUpdates.photo = updates.photo;
  if (updates.faceRegistered !== undefined) supabaseUpdates.face_registered = updates.faceRegistered;
  if (updates.active !== undefined) supabaseUpdates.active = updates.active;
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

  // Soft delete - just set active to false
  const { error } = await supabase.from('employees').update({ active: false }).eq('id', id);

  if (error) {
    console.error('Error deleting employee:', error);
    return false;
  }

  return true;
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
  };

  const { data, error } = await supabase.from('time_records').insert([supabaseRecord]).select().single();

  if (error) {
    console.error('Error creating time record:', error);
    return null;
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

  const { error } = await supabase.from('time_records').update(supabaseUpdates).eq('id', id);

  if (error) {
    console.error('Error updating time record:', error);
    return false;
  }

  return true;
}

// ─── Geofence Zones ──────────────────────────────────────────────────────────

export async function fetchGeofenceZones(): Promise<GeofenceZone[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('geofence_zones').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching geofence zones:', error);
    return [];
  }

  return (data || []).map((zone: any) => ({
    id: zone.id,
    name: zone.name,
    address: zone.address,
    lat: zone.lat,
    lng: zone.lng,
    radius: zone.radius,
    active: zone.active,
  }));
}

export async function createGeofenceZone(zone: Omit<GeofenceZone, 'id'>): Promise<GeofenceZone | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.from('geofence_zones').insert([zone]).select().single();

  if (error) {
    console.error('Error creating geofence zone:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    address: data.address,
    lat: data.lat,
    lng: data.lng,
    radius: data.radius,
    active: data.active,
  };
}

export async function updateGeofenceZone(id: string, updates: Partial<GeofenceZone>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('geofence_zones').update(updates).eq('id', id);

  if (error) {
    console.error('Error updating geofence zone:', error);
    return false;
  }

  return true;
}

// Migration helper: update any employees/announcements that still use 'Administrator' position/name
export async function migrateAdministratorPosition(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    // Update employee positions in a single query where possible
    const { error: updateErr } = await supabase
      .from('employees')
      .update({ position: 'OJT Instructor' })
      .eq('position', 'Administrator');
    if (updateErr) {
      console.error('Error migrating employee positions:', updateErr);
    }

    // Update announcements createdBy field if present
    const { error: annErr } = await supabase
      .from('announcements')
      .update({ created_by: 'OJT Instructor' })
      .eq('created_by', 'Administrator');
    if (annErr) {
      console.error('Error migrating announcements created_by:', annErr);
    }

    return 1; // return non-zero to indicate attempt (caller can check logs)
  } catch (e) {
    console.error('migrateAdministratorPosition failed:', e);
    return 0;
  }
}

export async function deleteGeofenceZone(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('geofence_zones').delete().eq('id', id);

  if (error) {
    console.error('Error deleting geofence zone:', error);
    return false;
  }

  return true;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<AppSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.from('app_settings').select('*').maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      // No settings found, return null to use defaults
      return null;
    }
    console.error('Error fetching settings:', error);
    return null;
  }

  if (!data) {
    // No settings row present
    return null;
  }

  return {
    workStartTime: data.work_start_time,
    workEndTime: data.work_end_time,
    lateThresholdMinutes: data.late_threshold_minutes,
    geofenceEnabled: data.geofence_enabled,
    facialRecognitionEnabled: data.facial_recognition_enabled,
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
  };

  // Try to update first, if no rows affected, insert
  const { error: updateError, count } = await supabase.from('app_settings').update(supabaseSettings).eq('id', 1);

  if (updateError || count === 0) {
    // Insert new settings
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
    created_at: announcement.createdAt,
    expires_at: announcement.expiresAt,
    created_by: announcement.createdBy,
  };

  const { data, error } = await supabase.from('announcements').insert([supabaseAnn]).select().single();

  if (error) {
    console.error('Error creating announcement:', error);
    return null;
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
  };
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

// ─── Transform Helpers ───────────────────────────────────────────────────────

function transformSupabaseEmployee(data: any): Employee {
  return {
    id: data.id,
    name: data.name,
    employeeId: data.employee_id,
    email: data.email,
    department: data.department,
    position: data.position,
    companyName: data.company_name,
    supervisorName: data.supervisor_name,
    schoolName: data.school_name,
    course: data.course,
    startDate: data.start_date,
    endDate: data.end_date,
    requiredHours: data.required_hours,
    photo: data.photo,
    faceRegistered: data.face_registered,
    createdAt: data.created_at,
    active: data.active,
    registrationLocation:
      data.registration_lat && data.registration_lng
        ? { lat: data.registration_lat, lng: data.registration_lng }
        : undefined,
    registrationAddress: data.registration_address,
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
  };
}
