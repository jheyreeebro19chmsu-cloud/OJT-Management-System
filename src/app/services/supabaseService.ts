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

export async function fetchEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_CORE_COLUMNS)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map(transformSupabaseEmployee);
    }

    if (error) {
      console.warn('Optimized fetchEmployees query notice, trying fallback columns:', error.message);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('employees')
        .select('id, name, employee_id, email, department, position, company_name, supervisor_name, school_name, campus, course, start_date, end_date, required_hours, photo, face_registered, active, academic_year, instructor_id, hte_id, application_status, registration_location, created_at')
        .order('created_at', { ascending: false });

      if (!fallbackError && fallbackData) {
        return fallbackData.map(transformSupabaseEmployee);
      }
      console.error('Error fetching employees fallback:', fallbackError);
    }
  } catch (err) {
    console.error('fetchEmployees exception:', err);
  }

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
      clean[key] = {
        name: docItem.name || 'document',
        size: docItem.size,
        fileType: docItem.fileType || 'application/pdf',
        uploadedAt: docItem.uploadedAt || new Date().toISOString(),
        status: docItem.status || 'passed',
        // Preserve dataUrl or fileUrl so documents can be viewed and previewed
        dataUrl: docItem.dataUrl || docItem.fileUrl || '',
      };
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export async function uploadDocumentToStorage(
  employeeId: string,
  docKey: string,
  fileDataOrBlob: string | Blob | File,
  fileName?: string
): Promise<string> {
  if (!isSupabaseConfigured()) return typeof fileDataOrBlob === 'string' ? fileDataOrBlob : '';

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
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        blob = new Blob([new Uint8Array(byteNumbers)], { type: contentType });
      } else {
        return fileDataOrBlob;
      }
    } else {
      blob = fileDataOrBlob;
      contentType = fileDataOrBlob.type || 'application/octet-stream';
    }

    const cleanEmpId = (employeeId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = fileName?.split('.').pop() || (contentType.includes('image') ? 'jpg' : 'pdf');
    const storagePath = `${cleanEmpId}/${docKey}_${Date.now()}.${ext}`;

    const bucketsToTry = ['documents', 'trainee-documents', 'avatars', 'face-photos'];
    for (const bucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(bucket).upload(storagePath, blob, {
          contentType,
          upsert: true,
          cacheControl: '604800', // 7 days: documents rarely change once uploaded, so repeat views should hit cache instead of re-downloading from origin every time
        });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
          if (urlData?.publicUrl) {
            console.log(`[Storage] Uploaded document ${docKey} to bucket "${bucket}":`, urlData.publicUrl);
            return urlData.publicUrl;
          }
        }
      } catch {
        // try next bucket
      }
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

  // Exact payload matching verified live columns in employees table
  // Pass through employee.employeeId directly as generated by caller (Register.tsx)
  const supabaseEmployee: any = {
    name: employee.name,
    employee_id: employee.employeeId,
    email: employee.email.trim().toLowerCase(),
    department: employee.department || 'College of Computer Studies',
    position: employee.position || 'OJT Trainee',
    company_name: employee.companyName || 'N/A',
    supervisor_name: employee.supervisorName || 'N/A',
    school_name: employee.schoolName || 'Carlos Hilado Memorial State University',
    campus: employee.campus || 'Talisay (Main Campus)',
    course: employee.course || 'Information Systems',
    start_date: employee.startDate || new Date().toISOString().split('T')[0],
    end_date: employee.endDate || new Date().toISOString().split('T')[0],
    required_hours: employee.requiredHours ?? 0,
    photo: photoToStore,
    face_registered: Boolean(employee.faceRegistered),
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
      documentsPassed: employee.documentsPassed !== undefined ? employee.documentsPassed : true,
      documentsStatus: employee.documentsStatus || 'passed',
      documents: sanitizeDocumentsForDb(employee.submittedDocuments),
    },
  };

  if (employee.id && isUuid(employee.id)) {
    supabaseEmployee.id = employee.id;
  }

  const { data, error } = await supabase
    .from('employees')
    .upsert([supabaseEmployee], { onConflict: 'email' })
    .select()
    .single();

  if (error) {
    console.error('Error creating employee in Supabase:', error);
    throw new Error(error.message || 'Failed to save employee to database');
  }

  return transformSupabaseEmployee(data);
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
  const regRadius = updates.registrationLocation?.radius ?? updates.registrationRadius;

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
    updates.submittedDocuments !== undefined;

  if (hasRegLocUpdates) {
    const existingRegLoc: any =
      typeof updates.registrationLocation === 'object' && updates.registrationLocation !== null
        ? { ...updates.registrationLocation }
        : {};

    const updatedRegLoc: any = {
      ...existingRegLoc,
    };

    if ('registrationLocation' in updates && updates.registrationLocation) {
      updatedRegLoc.lat = updates.registrationLocation.lat ?? null;
      updatedRegLoc.lng = updates.registrationLocation.lng ?? null;
    }
    if (regRadius) {
      updatedRegLoc.radius = Math.max(40, Number(regRadius));
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
    if (updates.submittedDocuments !== undefined) updatedRegLoc.documents = sanitizeDocumentsForDb(updates.submittedDocuments);

    supabaseUpdates.registration_location = updatedRegLoc;
  }

  const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  let query = supabase.from('employees').update(supabaseUpdates);
  if (isUuid(id)) {
    query = query.eq('id', id);
  } else if (updates.email) {
    query = query.eq('email', updates.email.trim().toLowerCase());
  } else {
    query = query.eq('employee_id', id);
  }

  const { error } = await query;
  if (error) {
    console.error('Error updating employee:', error);
    throw new Error(error.message || 'Failed to update employee in database');
  }

  return true;
}

export async function deleteEmployee(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

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

  const cleanDate = record.date ? String(record.date).split('T')[0] : new Date().toISOString().split('T')[0];

  // Idempotency guard: if a "Time In" request fires twice (retry, double-tap),
  // don't create a second open session — return the existing one instead.
  if (record.timeIn && !record.timeOut) {
    const { data: existingOpen } = await supabase
      .from('time_records')
      .select('*')
      .eq('employee_id', record.employeeId)
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

  const baseRecord: any = {
    employee_id: record.employeeId,
    date: cleanDate,
    time_in: record.timeIn || null,
    time_out: record.timeOut || null,
    total_hours: record.totalHours ?? 0,
    status: record.status || 'present',
    time_in_geofenced: Boolean(record.timeInGeofenced),
    time_out_geofenced: Boolean(record.timeOutGeofenced),
    time_in_face_verified: Boolean(record.timeInFaceVerified),
    time_out_face_verified: Boolean(record.timeOutFaceVerified),
  };

  if (record.timeInPhoto && record.timeInPhoto.startsWith('http')) {
    baseRecord.time_in_photo = record.timeInPhoto;
  }
  if (record.timeOutPhoto && record.timeOutPhoto.startsWith('http')) {
    baseRecord.time_out_photo = record.timeOutPhoto;
  }

  const extendedRecord: any = {
    ...baseRecord,
    time_in_lat: record.timeInLocation?.lat != null ? Number(record.timeInLocation.lat) : null,
    time_in_lng: record.timeInLocation?.lng != null ? Number(record.timeInLocation.lng) : null,
    time_out_lat: record.timeOutLocation?.lat != null ? Number(record.timeOutLocation.lat) : null,
    time_out_lng: record.timeOutLocation?.lng != null ? Number(record.timeOutLocation.lng) : null,
    notes: record.notes || null,
    academic_year: record.academicYear || null,
    approval_status: record.approvalStatus || 'pending',
    approved_by: record.approvedBy || null,
    approved_at: record.approvedAt || null,
    approval_note: record.approvalNote || null,
  };

  let insertResult = await supabase.from('time_records').insert([extendedRecord]).select().single();

  if (insertResult.error) {
    console.warn('[Supabase] Extended time_record insert notice, retrying with core columns:', insertResult.error.message);
    insertResult = await supabase.from('time_records').insert([baseRecord]).select().single();
  }

  if (insertResult.error) {
    console.error('Error creating time record in Supabase:', insertResult.error);
    throw new Error(insertResult.error.message || JSON.stringify(insertResult.error));
  }

  return transformSupabaseTimeRecord({ ...insertResult.data, academic_year: record.academicYear });
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
  if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes;
  if (updates.approvalStatus !== undefined) supabaseUpdates.approval_status = updates.approvalStatus;
  if (updates.approvedBy !== undefined) supabaseUpdates.approved_by = updates.approvedBy;
  if (updates.approvedAt !== undefined) supabaseUpdates.approved_at = updates.approvedAt;
  if (updates.approvalNote !== undefined) supabaseUpdates.approval_note = updates.approvalNote;

  if (Object.keys(supabaseUpdates).length === 0) {
    return true;
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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
    const targetDate = updates.date ? String(updates.date).split('T')[0] : new Date().toISOString().split('T')[0];
    let res2 = await supabase
      .from('time_records')
      .update(supabaseUpdates)
      .eq('employee_id', updates.employeeId)
      .eq('date', targetDate)
      .select();
    if (res2.error) {
      const fallbackUpdates = { ...supabaseUpdates };
      delete fallbackUpdates.approval_status;
      delete fallbackUpdates.approved_by;
      delete fallbackUpdates.approved_at;
      delete fallbackUpdates.approval_note;
      res2 = await supabase
        .from('time_records')
        .update(fallbackUpdates)
        .eq('employee_id', updates.employeeId)
        .eq('date', targetDate)
        .select();
    }
    if (res2.error) {
      console.error('Error updating time record by employee_id and date:', res2.error);
    } else if (res2.data && res2.data.length > 0) {
      return true;
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
      radius: Number(zone.radius) || 100,
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
    radius: Math.max(40, Number(zone.radius) || 40),
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
    throw new Error(error.message || 'Failed to create geofence zone');
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

  const supabaseUpdates: any = {};
  if (updates.name !== undefined) supabaseUpdates.name = updates.name;
  if (updates.address !== undefined) supabaseUpdates.address = updates.address;
  if (updates.lat !== undefined) supabaseUpdates.lat = Number(updates.lat);
  if (updates.lng !== undefined) supabaseUpdates.lng = Number(updates.lng);
  if (updates.radius !== undefined) supabaseUpdates.radius = Number(updates.radius);
  if (updates.active !== undefined) supabaseUpdates.active = updates.active;

  if (isValidUUID(id)) {
    const { error } = await supabase.from('geofence_zones').update(supabaseUpdates).eq('id', id);
    if (error) {
      console.error('Error updating geofence zone in Supabase:', error);
      throw new Error(error.message || 'Failed to update geofence zone');
    }
    return true;
  }

  // Non-UUID ID (e.g. station-xxx or personal-xxx): attempt matching existing zone by name
  if (updates.name) {
    const { data: matched } = await supabase.from('geofence_zones').select('id').eq('name', updates.name).limit(1);
    if (matched && matched.length > 0 && isValidUUID(matched[0].id)) {
      const { error } = await supabase.from('geofence_zones').update(supabaseUpdates).eq('id', matched[0].id);
      if (!error) return true;
    }
  }

  // If not yet present in geofence_zones table, create record
  if (updates.name && updates.lat && updates.lng) {
    await createGeofenceZone({
      name: updates.name,
      address: updates.address || '',
      lat: Number(updates.lat),
      lng: Number(updates.lng),
      radius: Math.max(40, Number(updates.radius) || 40),
      active: updates.active !== false,
      academicYear: updates.academicYear,
    });
  }

  return true;
}

export async function deleteGeofenceZone(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const isUuid = isValidUUID(id);
    if (isUuid) {
      const { error: delErr } = await supabase.from('geofence_zones').delete().eq('id', id);
      if (delErr) {
        console.error('Error deleting from geofence_zones by id:', delErr.message);
        throw new Error(delErr.message);
      }
    }

    const cleanId = id.startsWith('personal-') ? id.replace('personal-', '') : id;
    if (cleanId !== id && isValidUUID(cleanId)) {
      const { error: delErr2 } = await supabase.from('geofence_zones').delete().eq('id', cleanId);
      if (delErr2) {
        console.error('Error deleting personal geofence zone by cleanId:', delErr2.message);
        throw new Error(delErr2.message);
      }
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

    if (insertError) {
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
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('evaluations').select('*').order('evaluated_at', { ascending: false });

  if (error) {
    console.error('Error fetching evaluations:', error);
    return [];
  }

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

  let annPhoto = announcement.photo;
  if (annPhoto && typeof annPhoto === 'string' && annPhoto.startsWith('data:image')) {
    try {
      annPhoto = await compressBase64Image(annPhoto, 800, 0.82);
    } catch (cErr) {
      console.warn('Announcement photo compression note:', cErr);
    }
  }

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
    photo: annPhoto,
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

let announcementCommentsTableMissing = false;

export async function fetchAnnouncementComments(): Promise<AnnouncementComment[]> {
  if (!isSupabaseConfigured() || announcementCommentsTableMissing) return [];

  try {
    const { data, error } = await supabase
      .from('announcement_comments')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
        announcementCommentsTableMissing = true;
      }
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
  const regLoc = data.registration_location;

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
    (!isCoordString(regLoc?.address) ? regLoc?.address : undefined) ||
    (!isCoordString(data.address) ? data.address : undefined);

  const compositeResidential = [
    regLoc?.street,
    regLoc?.barangay,
    regLoc?.city,
    regLoc?.province,
  ].filter(Boolean).join(', ');

  const finalResidential = rawResidential || (compositeResidential ? compositeResidential : undefined);

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
    registrationLocation: (() => {
      const radiusVal = Math.max(40, Number(data.registration_radius ?? regLoc?.radius ?? 40));
      if (data.registration_lat != null && data.registration_lng != null) {
        return { lat: Number(data.registration_lat), lng: Number(data.registration_lng), radius: radiusVal };
      }
      if (regLoc?.lat != null && regLoc?.lng != null) {
        return { lat: Number(regLoc.lat), lng: Number(regLoc.lng), radius: radiusVal };
      }
      if (data.registration_address) {
        const match = String(data.registration_address).match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
        if (match) {
          return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), radius: radiusVal };
        }
      }
      return undefined;
    })(),
    registrationRadius: Math.max(40, Number(data.registration_radius ?? regLoc?.radius ?? 40)),
    registrationAddress: data.registration_address || regLoc?.address || undefined,
    contactPhone: phoneVal,
    phone: phoneVal,
    telephone: phoneVal,
    residentialAddress: finalResidential,
    address: finalResidential,
    street: regLoc?.street || undefined,
    barangay: regLoc?.barangay || undefined,
    city: regLoc?.city || undefined,
    province: regLoc?.province || undefined,
    instructorId: data.instructor_id,
    hteId: data.hte_id,
    linkedAt: data.linked_at,
    applicationStatus: data.application_status || data.approval_status || 'approved',
    approvalStatus: data.application_status || data.approval_status || 'approved',
    documentsPassed:
      data.documents_passed !== undefined
        ? Boolean(data.documents_passed)
        : regLoc?.documentsPassed !== undefined
          ? Boolean(regLoc.documentsPassed)
          : true,
    documentsStatus:
      data.documents_status ||
      regLoc?.documentsStatus ||
      (data.documents_passed === false ? 'pending' : 'passed'),
    submittedDocuments: regLoc?.documents || data.submitted_documents || undefined,
  };
}

export function transformSupabaseTimeRecord(data: any): TimeRecord {
  return {
    id: data.id,
    employeeId: data.employee_id,
    date: data.date ? String(data.date).split('T')[0] : data.date,
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
    totalHours: data.total_hours != null ? Math.round(Number(data.total_hours) * 100) / 100 : undefined,
    status: data.status,
    notes: data.notes,
    academicYear: data.academic_year,
    approvalStatus: (data.approval_status as any) || 'pending',
    approvedBy: data.approved_by || undefined,
    approvedAt: data.approved_at || undefined,
    approvalNote: data.approval_note || undefined,
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
      totalHours: rec.totalHours,
      status: rec.status,
      notes: rec.notes,
    }));

    const { error } = await supabase.from('time_records').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error upserting time records in Supabase:', error);
      throw new Error(error.message || 'Failed to upsert time records');
    }
    return true;
  } catch (e) {
    console.error('upsertTimeRecords exception:', e);
    throw e;
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
  if (updates.isApproved !== undefined) supabaseUpdates.is_approved = updates.isApproved;
  if (updates.active !== undefined) supabaseUpdates.active = updates.active;

  const { error } = await supabase.from('host_supervisors').update(supabaseUpdates).eq('id', id);
  if (error) {
    console.error('Error updating host_supervisor:', error);
    throw new Error(error.message || 'Failed to update host_supervisor');
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

export async function repairDatabaseData(activeAY = '2026-2027'): Promise<{ success: boolean; repairedEmployees: number; repairedRecords: number; migratedHTEs: number }> {
  if (!isSupabaseConfigured()) return { success: false, repairedEmployees: 0, repairedRecords: 0, migratedHTEs: 0 };

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

    return { success: true, repairedEmployees, repairedRecords: 0, migratedHTEs };
  } catch (e) {
    console.error('repairDatabaseData error:', e);
    return { success: false, repairedEmployees: 0, repairedRecords: 0, migratedHTEs: 0 };
  }
}

export async function resetPasswordDirect(email: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await supabase.functions.invoke('reset-password-admin', {
      body: {
        email: cleanEmail,
        newPassword,
      },
    });

    if (error) {
      console.warn('[resetPasswordDirect] Edge Function invocation error:', error);
      return { success: false, message: error.message || 'Failed to update password.' };
    }

    if (data && data.success === false) {
      return { success: false, message: data.error || 'Failed to update password.' };
    }

    return { success: true, message: data?.message || 'Password updated successfully.' };
  } catch (err: any) {
    console.error('[resetPasswordDirect] Unexpected error:', err);
    return { success: false, message: err?.message || 'Unexpected error updating password.' };
  }
}