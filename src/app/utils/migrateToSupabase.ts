/**
 * Migration utility to help transfer data from localStorage to Supabase
 *
 * This is a one-time migration script that can be run from the browser console
 * to transfer existing localStorage data to your Supabase database.
 *
 * Usage:
 * 1. Open browser console
 * 2. Import this module
 * 3. Run: await migrateLocalStorageToSupabase()
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Employee, TimeRecord, GeofenceZone, Evaluation, Announcement } from '../types';

const STORAGE_KEYS = {
  EMPLOYEES: 'ojt_employees',
  TIME_RECORDS: 'ojt_time_records',
  GEOFENCE_ZONES: 'ojt_geofence_zones',
  EVALUATIONS: 'ojt_evaluations',
  ANNOUNCEMENTS: 'ojt_announcements',
};

interface MigrationResult {
  success: boolean;
  message: string;
  counts: {
    employees: number;
    timeRecords: number;
    geofenceZones: number;
    evaluations: number;
    announcements: number;
  };
  errors: string[];
}

export async function migrateLocalStorageToSupabase(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    message: '',
    counts: {
      employees: 0,
      timeRecords: 0,
      geofenceZones: 0,
      evaluations: 0,
      announcements: 0,
    },
    errors: [],
  };

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    result.message = 'Supabase is not configured. Please add your Supabase credentials to the .env file.';
    return result;
  }

  try {
    // Migrate Employees
    const employees = getFromLocalStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    if (employees.length > 0) {
      const employeeData = employees.map((emp) => ({
        id: emp.id,
        name: emp.name,
        employee_id: emp.employeeId,
        email: emp.email,
        department: emp.department,
        position: emp.position,
        company_name: emp.companyName,
        supervisor_name: emp.supervisorName,
        school_name: emp.schoolName,
        course: emp.course,
        start_date: emp.startDate,
        end_date: emp.endDate,
        required_hours: emp.requiredHours,
        photo: emp.photo,
        face_registered: emp.faceRegistered,
        active: emp.active,
        registration_lat: emp.registrationLocation?.lat,
        registration_lng: emp.registrationLocation?.lng,
        registration_address: emp.registrationAddress,
        created_at: emp.createdAt,
      }));

      const { error: empError, count: empCount } = await supabase
        .from('employees')
        .upsert(employeeData, { onConflict: 'id' })
        .select();

      if (empError) {
        result.errors.push(`Employees migration error: ${empError.message}`);
      } else {
        result.counts.employees = empCount || 0;
      }
    }

    // Migrate Time Records
    const timeRecords = getFromLocalStorage<TimeRecord[]>(STORAGE_KEYS.TIME_RECORDS, []);
    if (timeRecords.length > 0) {
      const recordData = timeRecords.map((rec) => ({
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
      }));

      const { error: recError, count: recCount } = await supabase
        .from('time_records')
        .upsert(recordData, { onConflict: 'id' })
        .select();

      if (recError) {
        result.errors.push(`Time records migration error: ${recError.message}`);
      } else {
        result.counts.timeRecords = recCount || 0;
      }
    }

    // Migrate Geofence Zones
    const geofenceZones = getFromLocalStorage<GeofenceZone[]>(STORAGE_KEYS.GEOFENCE_ZONES, []);
    if (geofenceZones.length > 0) {
      const { error: zoneError, count: zoneCount } = await supabase
        .from('geofence_zones')
        .upsert(geofenceZones, { onConflict: 'id' })
        .select();

      if (zoneError) {
        result.errors.push(`Geofence zones migration error: ${zoneError.message}`);
      } else {
        result.counts.geofenceZones = zoneCount || 0;
      }
    }

    // Migrate Evaluations
    const evaluations = getFromLocalStorage<Evaluation[]>(STORAGE_KEYS.EVALUATIONS, []);
    if (evaluations.length > 0) {
      const evalData = evaluations.map((evaluation) => ({
        id: evaluation.id,
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
      }));

      const { error: evalError, count: evalCount } = await supabase
        .from('evaluations')
        .upsert(evalData, { onConflict: 'id' })
        .select();

      if (evalError) {
        result.errors.push(`Evaluations migration error: ${evalError.message}`);
      } else {
        result.counts.evaluations = evalCount || 0;
      }
    }

    // Migrate Announcements
    const announcements = getFromLocalStorage<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
    if (announcements.length > 0) {
      const annData = announcements.map((ann) => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        type: ann.type,
        target_role: ann.targetRole,
        is_pinned: ann.isPinned,
        created_at: ann.createdAt,
        expires_at: ann.expiresAt,
        created_by: ann.createdBy,
      }));

      const { error: annError, count: annCount } = await supabase
        .from('announcements')
        .upsert(annData, { onConflict: 'id' })
        .select();

      if (annError) {
        result.errors.push(`Announcements migration error: ${annError.message}`);
      } else {
        result.counts.announcements = annCount || 0;
      }
    }

    // Check if migration was successful
    if (result.errors.length === 0) {
      result.success = true;
      result.message = 'Migration completed successfully!';
    } else {
      result.message = 'Migration completed with some errors. Check the errors array for details.';
    }
  } catch (error) {
    result.message = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(result.message);
  }

  return result;
}

function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Helper function to clear localStorage after successful migration
 * WARNING: This will delete all local data. Use with caution!
 */
export function clearLocalStorageData(): void {
  const keys = Object.values(STORAGE_KEYS);
  keys.forEach((key) => {
    localStorage.removeItem(key);
  });
  console.log('localStorage data cleared');
}

/**
 * Helper function to backup localStorage data before migration
 */
export function backupLocalStorageData(): string {
  const backup: Record<string, any> = {};
  Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
    const data = localStorage.getItem(key);
    if (data) {
      backup[name] = JSON.parse(data);
    }
  });
  return JSON.stringify(backup, null, 2);
}

// Make functions available in browser console for easy access
if (typeof window !== 'undefined') {
  (window as any).migrateToSupabase = migrateLocalStorageToSupabase;
  (window as any).backupLocalStorage = backupLocalStorageData;
  (window as any).clearLocalStorage = clearLocalStorageData;
}
