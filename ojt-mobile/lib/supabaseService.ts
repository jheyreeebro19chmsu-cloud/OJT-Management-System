import { supabase } from './supabase';

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
  status: 'draft' | 'submitted';
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
    registrationLocation:
      data.registration_lat && data.registration_lng
        ? { lat: Number(data.registration_lat), lng: Number(data.registration_lng) }
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

function transformTimeRecord(data: any): TimeRecord {
  return {
    id: data.id,
    employeeId: data.employee_id,
    date: data.date,
    timeIn: data.time_in,
    timeOut: data.time_out,
    timeInLocation:
      data.time_in_lat && data.time_in_lng
        ? { lat: Number(data.time_in_lat), lng: Number(data.time_in_lng) }
        : undefined,
    timeOutLocation:
      data.time_out_lat && data.time_out_lng
        ? { lat: Number(data.time_out_lat), lng: Number(data.time_out_lng) }
        : undefined,
    timeInGeofenced: Boolean(data.time_in_geofenced),
    timeOutGeofenced: Boolean(data.time_out_geofenced),
    timeInFaceVerified: Boolean(data.time_in_face_verified),
    timeOutFaceVerified: Boolean(data.time_out_face_verified),
    timeInPhoto: data.time_in_photo,
    timeOutPhoto: data.time_out_photo,
    totalHours: Number(data.total_hours) || 0,
    status: data.status || 'present',
    notes: data.notes,
    academicYear: data.academic_year,
    approvalStatus: data.approval_status || 'pending',
  };
}

// ─── API Operations ───

export const mobileDb = {
  // Employees / Profiles
  async getEmployees(academicYear?: string): Promise<Employee[]> {
    let query = supabase.from('employees').select('*').order('created_at', { ascending: false });
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
    const { data, error } = await supabase.from('employees').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return transformEmployee(data);
  },

  async getTraineesByInstructor(instructorId: string, academicYear?: string): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select('*')
      .or(`instructor_id.eq.${instructorId},id.eq.${instructorId}`)
      .order('name', { ascending: true });
    
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

  async getTraineesByHte(hteId: string, academicYear?: string): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select('*')
      .eq('hte_id', hteId)
      .order('name', { ascending: true });
    
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
    if (updates.photo !== undefined) payload.photo = updates.photo;
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
  async getTimeRecords(employeeId?: string, academicYear?: string): Promise<TimeRecord[]> {
    let query = supabase.from('time_records').select('*').order('date', { ascending: false });
    if (employeeId) query = query.eq('employee_id', employeeId);
    if (academicYear) query = query.or(`academic_year.eq.${academicYear},academic_year.is.null`);
    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching time records:', error);
      return [];
    }
    return (data || []).map(transformTimeRecord);
  },

  async getTodayTimeRecord(employeeId: string): Promise<TimeRecord | null> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('time_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();
    if (error || !data) return null;
    return transformTimeRecord(data);
  },

  async saveTimeRecord(record: Omit<TimeRecord, 'id'> & { id?: string }): Promise<TimeRecord | null> {
    const payload: any = {
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

    if (record.id) {
      const { data, error } = await supabase
        .from('time_records')
        .update(payload)
        .eq('id', record.id)
        .select()
        .single();
      if (error) {
        console.error('Error updating time record:', error);
        return null;
      }
      return transformTimeRecord(data);
    } else {
      const { data, error } = await supabase.from('time_records').insert([payload]).select().single();
      if (error) {
        console.error('Error inserting time record:', error);
        return null;
      }
      return transformTimeRecord(data);
    }
  },

  // Geofence Zones
  async getGeofenceZones(academicYear?: string): Promise<GeofenceZone[]> {
    let query = supabase.from('geofence_zones').select('*').order('name', { ascending: true });
    if (academicYear) {
      query = query.or(`academic_year.eq.${academicYear},academic_year.is.null`);
    }
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map((z: any) => ({
      id: z.id,
      name: z.name,
      address: z.address,
      lat: Number(z.lat),
      lng: Number(z.lng),
      radius: Number(z.radius),
      active: z.active !== false,
      academicYear: z.academic_year,
    }));
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
    if (academicYear) query = query.or(`academic_year.eq.${academicYear},academic_year.is.null`);
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map((e: any) => ({
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
      status: evaluation.status,
      academic_year: evaluation.academicYear,
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
      academic_year: feedback.academicYear,
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
};
