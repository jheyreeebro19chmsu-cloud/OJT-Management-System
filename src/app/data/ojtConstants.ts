import type { Employee } from '../types';

/**
 * Default baseline OJT required hours (600 hours) when an Academic Year
 * has not been customized by the OJT Instructor.
 * Instructor (admin) and HTE accounts do not render OJT hours (0).
 */
export const TRAINEE_REQUIRED_HOURS = 600;

/**
 * Resolves the configured Required OJT Hours for a specific Academic Year.
 * Falls back to 600 hours if no custom hours are set for that Academic Year.
 */
export function getAcademicYearRequiredHours(
  academicYear?: string | null,
  academicYearHours?: Record<string, number> | null
): number {
  if (academicYear && academicYearHours && typeof academicYearHours === 'object') {
    const custom = Number(academicYearHours[academicYear]);
    if (Number.isFinite(custom) && custom > 0) {
      return Math.round(custom);
    }
  }
  return TRAINEE_REQUIRED_HOURS;
}

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
 * Normalizes Trainee required hours per Academic Year (defaulting to 600 hours).
 * Returns the same array reference when nothing needed to change.
 */
export function normalizeTraineeRequiredHours(
  list: Employee[],
  academicYearHours?: Record<string, number> | null,
  fallbackAcademicYear?: string | null
): Employee[] {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((emp) => {
    if (!isTraineeAccount(emp)) return emp;
    const ay = emp.academicYear || fallbackAcademicYear || '';
    const hasAyOverride = Boolean(
      ay && academicYearHours && typeof academicYearHours === 'object' && Number(academicYearHours[ay]) > 0
    );
    const targetHours = hasAyOverride
      ? getAcademicYearRequiredHours(ay, academicYearHours)
      : Number(emp.requiredHours) > 0
        ? Math.round(Number(emp.requiredHours))
        : TRAINEE_REQUIRED_HOURS;
    if (emp.requiredHours !== targetHours) {
      changed = true;
      return { ...emp, requiredHours: targetHours };
    }
    return emp;
  });
  return changed ? next : list;
}
