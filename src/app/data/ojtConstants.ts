import type { Employee } from '../types';

/**
 * Standard OJT required hours applied to every Trainee account.
 * Instructor (admin) and HTE accounts do not render OJT hours (0).
 */
export const TRAINEE_REQUIRED_HOURS = 600;

/** True when the account is an OJT Trainee (not Instructor/Admin/HTE). */
export function isTraineeAccount(emp: Partial<Employee> | null | undefined): boolean {
  if (!emp) return false;
  const role = String((emp as any).role || '').toLowerCase();
  const pos = String(emp.position || '').toLowerCase();
  if (role === 'admin' || role === 'instructor' || role === 'hte') return false;
  if (
    pos === 'administrator' ||
    pos.includes('instructor') ||
    pos.includes('faculty') ||
    pos.includes('hte') ||
    pos.includes('host') ||
    pos.includes('training supervisor')
  ) {
    return false;
  }
  return true;
}

/**
 * Forces every Trainee account to the standard 600 required hours.
 * Returns the same array reference when nothing needed to change.
 */
export function normalizeTraineeRequiredHours(list: Employee[]): Employee[] {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((emp) => {
    if (isTraineeAccount(emp) && emp.requiredHours !== TRAINEE_REQUIRED_HOURS) {
      changed = true;
      return { ...emp, requiredHours: TRAINEE_REQUIRED_HOURS };
    }
    return emp;
  });
  return changed ? next : list;
}
