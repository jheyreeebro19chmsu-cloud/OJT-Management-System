/**
 * accountSync.ts
 * Supabase-native replacement for the Django OTP / pending-request / approval flow.
 * Uses the existing `employees` table: application_status, instructor_id, hte_id.
 * Replaces every fetch(getAbsoluteUrl('/api/...')) call related to registration approval.
 */
import { supabase } from '../lib/supabase';
import { Employee } from '../types';
import { transformSupabaseEmployee } from './supabaseService';

const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

// ─── Linking a trainee to an Instructor / HTE ──────────────────────────────

export async function linkTraineeToInstructor(traineeId: string, instructorId: string) {
  let resolvedInstructorUuid = instructorId;
  if (!isUuid(instructorId)) {
    const { data: inst } = await supabase
      .from('employees')
      .select('id')
      .or(`employee_id.eq.${instructorId},email.ilike.${instructorId}`)
      .limit(1)
      .maybeSingle();
    if (inst?.id) resolvedInstructorUuid = inst.id;
  }

  let query = supabase.from('employees').update({
    instructor_id: resolvedInstructorUuid,
    application_status: 'pending',
    linked_at: new Date().toISOString(),
  });

  if (isUuid(traineeId)) {
    query = query.eq('id', traineeId);
  } else {
    query = query.eq('employee_id', traineeId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
  return true;
}

export async function linkTraineeToHte(traineeId: string, hteId: string) {
  let query = supabase.from('employees').update({ hte_id: hteId, linked_at: new Date().toISOString() });
  if (isUuid(traineeId)) {
    query = query.eq('id', traineeId);
  } else {
    query = query.eq('employee_id', traineeId);
  }
  const { error } = await query;
  if (error) throw new Error(error.message);
  return true;
}

// ─── Instructor: view + act on pending trainee requests ───────────────────

export async function getPendingTraineeRequests(instructorId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .or(`instructor_id.eq.${instructorId},instructor_id.is.null`)
    .eq('application_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(transformSupabaseEmployee);
}

export async function approveTrainee(traineeId: string, instructorId?: string) {
  const updates: any = { application_status: 'approved', active: true };
  if (instructorId) {
    updates.instructor_id = instructorId;
    updates.linked_at = new Date().toISOString();
  }

  let query = supabase.from('employees').update(updates);
  if (isUuid(traineeId)) {
    query = query.eq('id', traineeId);
  } else {
    query = query.eq('employee_id', traineeId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
  return true;
}

export async function rejectTrainee(traineeId: string, reason?: string) {
  const { error } = await supabase
    .from('employees')
    .update({ application_status: 'rejected', active: false })
    .eq('id', traineeId);

  if (error) throw new Error(error.message);
  // Optional: log `reason` to a notes/audit table if you want a paper trail.
  return true;
}

// ─── Live updates: instructor sees new pending requests instantly ─────────
// Call this inside a useEffect in InstructorPendingRequests.tsx / AdminLayout.tsx.
// Replaces the old WebSocket/polling calls to the Django backend.

export function subscribeToPendingRequests(
  instructorId: string,
  onChange: (employee: Employee) => void
) {
  const channel = supabase
    .channel(`pending-requests-${instructorId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT (new registration) or UPDATE (status change)
        schema: 'public',
        table: 'employees',
        filter: `instructor_id=eq.${instructorId}`,
      },
      (payload) => {
        onChange(payload.new as Employee);
      }
    )
    .subscribe();

  // Caller should invoke the returned function on unmount:
  // useEffect(() => { const unsub = subscribeToPendingRequests(...); return unsub; }, []);
  return () => supabase.removeChannel(channel);
}

// ─── HTE: view trainees assigned to them ───────────────────────────────────

export async function getHteTrainees(hteId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('hte_id', hteId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}