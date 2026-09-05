import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Employee } from '../types';
import * as supabaseService from './supabaseService';

/**
 * Account synchronization and direct Supabase management service.
 * Replaces legacy Django auth endpoints with direct, secure Supabase operations.
 */

export interface AccountSyncResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

/**
 * Register a new user (Trainee, Instructor, or HTE) directly in Supabase.
 * First creates the auth user in Supabase Auth, then saves profile in `employees` table.
 */
export async function registerUserAccount(
  employeeData: Omit<Employee, 'id' | 'createdAt'> & { id?: string },
  password?: string
): Promise<AccountSyncResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Supabase is not configured. Please check environment variables.',
    };
  }

  try {
    let authUserId: string | undefined = employeeData.id;

    // 1. If password provided, attempt Supabase Auth signup
    if (password && employeeData.email) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: employeeData.email.trim(),
          password: password,
          options: {
            data: {
              full_name: employeeData.name,
              role:
                employeeData.position === 'OJT Instructor'
                  ? 'admin'
                  : employeeData.position === 'HTE Representative'
                  ? 'host'
                  : 'employee',
            },
          },
        });

        if (authError) {
          console.warn('Supabase Auth signUp note:', authError.message);
          // If user already exists in auth, we continue to create or update the profile row
        } else if (authData?.user?.id) {
          authUserId = authData.user.id;
        }
      } catch (authErr) {
        console.warn('Supabase Auth signUp exception:', authErr);
      }
    }

    // 2. Prepare payload for the employees table
    const employeePayload = {
      ...employeeData,
      id: authUserId || employeeData.id || crypto.randomUUID(),
    };

    // 3. Directly create or upsert into employees table
    const createdEmployee = await supabaseService.createEmployee(employeePayload);

    if (createdEmployee) {
      return {
        success: true,
        message: 'Account registered successfully in Supabase.',
        data: createdEmployee,
      };
    } else {
      // Try upsert as fallback
      const upsertOk = await supabaseService.upsertEmployees([employeePayload as Employee]);
      if (upsertOk) {
        return {
          success: true,
          message: 'Account saved successfully via upsert.',
          data: employeePayload,
        };
      }
      throw new Error('Could not insert employee row into Supabase.');
    }
  } catch (err: any) {
    console.error('registerUserAccount error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to register account.',
      error: err,
    };
  }
}

/**
 * Link a Trainee to an Instructor
 */
export async function linkTraineeToInstructor(
  traineeId: string,
  instructorId: string
): Promise<AccountSyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase is not configured.' };
  }

  try {
    const { error } = await supabase
      .from('employees')
      .update({
        instructor_id: instructorId,
        approval_status: 'approved',
        linked_at: new Date().toISOString(),
      })
      .eq('id', traineeId);

    if (error) throw error;

    return { success: true, message: 'Trainee successfully linked to Instructor.' };
  } catch (err: any) {
    console.error('linkTraineeToInstructor error:', err);
    return { success: false, message: err?.message || 'Failed to link trainee.', error: err };
  }
}

/**
 * Link a Trainee to a Host Training Establishment (HTE)
 */
export async function linkTraineeToHte(
  traineeId: string,
  hteId: string,
  companyName?: string
): Promise<AccountSyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase is not configured.' };
  }

  try {
    const updates: any = {
      hte_id: hteId,
    };
    if (companyName) {
      updates.company_name = companyName;
    }

    const { error } = await supabase.from('employees').update(updates).eq('id', traineeId);

    if (error) throw error;

    return { success: true, message: 'Trainee successfully assigned to HTE.' };
  } catch (err: any) {
    console.error('linkTraineeToHte error:', err);
    return { success: false, message: err?.message || 'Failed to assign HTE.', error: err };
  }
}

/**
 * Update Trainee Approval Status
 */
export async function updateTraineeApprovalStatus(
  traineeId: string,
  status: 'approved' | 'rejected' | 'pending'
): Promise<AccountSyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase is not configured.' };
  }

  try {
    const { error } = await supabase
      .from('employees')
      .update({
        approval_status: status,
      })
      .eq('id', traineeId);

    if (error) throw error;

    return { success: true, message: `Trainee status updated to ${status}.` };
  } catch (err: any) {
    console.error('updateTraineeApprovalStatus error:', err);
    return { success: false, message: err?.message || 'Failed to update status.', error: err };
  }
}

/**
 * Fetch trainees for a specific instructor
 */
export async function fetchTraineesByInstructor(instructorId: string): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('instructor_id', instructorId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      employeeId: d.employee_id,
      companyName: d.company_name,
      supervisorName: d.supervisor_name,
      schoolName: d.school_name,
      startDate: d.start_date,
      endDate: d.end_date,
      requiredHours: d.required_hours,
      faceRegistered: d.face_registered,
      academicYear: d.academic_year,
      approvalStatus: d.approval_status,
      instructorId: d.instructor_id,
      hteId: d.hte_id,
    }));
  } catch (err) {
    console.error('fetchTraineesByInstructor error:', err);
    return [];
  }
}

/**
 * Fetch trainees assigned to an HTE
 */
export async function fetchTraineesByHte(hteId: string): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('hte_id', hteId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      employeeId: d.employee_id,
      companyName: d.company_name,
      supervisorName: d.supervisor_name,
      schoolName: d.school_name,
      startDate: d.start_date,
      endDate: d.end_date,
      requiredHours: d.required_hours,
      faceRegistered: d.face_registered,
      academicYear: d.academic_year,
      approvalStatus: d.approval_status,
      instructorId: d.instructor_id,
      hteId: d.hte_id,
    }));
  } catch (err) {
    console.error('fetchTraineesByHte error:', err);
    return [];
  }
}
