/**
 * accountSync.ts
 * Supabase-native replacement for the Django OTP / pending-request / approval flow.
 * Uses the existing `employees` table: application_status, instructor_id, hte_id.
 * Replaces every fetch(getAbsoluteUrl('/api/...')) call related to registration approval.
 */
import { supabase } from '../lib/supabase';
import { Employee } from '../types';

// ─── Linking a trainee to an Instructor / HTE ──────────────────────────────

export async function linkTraineeToInstructor(traineeId: string, instructorId: string) {
  const { error } = await supabase
    .from('employees')
    .update({
      instructor_id: instructorId,
      application_status: 'pending', // instructor must approve before trainee is active
      linked_at: new Date().toISOString(),
    })
    .eq('id', traineeId);

  if (error) throw new Error(error.message);
  return true;
}

export async function linkTraineeToHte(traineeId: string, hteId: string) {
  const { error } = await supabase
    .from('employees')
    .update({ hte_id: hteId, linked_at: new Date().toISOString() })
    .eq('id', traineeId);

  if (error) throw new Error(error.message);
  return true;
}

// ─── Instructor: view + act on pending trainee requests ───────────────────

export async function getPendingTraineeRequests(instructorId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('instructor_id', instructorId)
    .eq('application_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function approveTrainee(traineeId: string) {
  const { error } = await supabase
    .from('employees')
    .update({ application_status: 'approved', active: true })
    .eq('id', traineeId);

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