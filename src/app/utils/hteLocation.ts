import type { Employee, HostSupervisor, GeofenceZone, TraineeGeofenceOverride } from '../types';

/**
 * Stable identity of a trainee's current HTE assignment. Used to scope an
 * instructor-set geofence override so it is automatically discarded if the
 * trainee is later reassigned to a different HTE.
 */
export function getTraineeHteKey(trainee: { hteId?: string; companyName?: string } | null | undefined): string {
  if (!trainee) return '';
  if (trainee.hteId) return `id:${String(trainee.hteId).trim().toLowerCase()}`;
  const comp = String(trainee.companyName || '').trim().toLowerCase();
  return comp ? `co:${comp}` : '';
}

/**
 * Returns the instructor-set permanent geofence for a trainee if it is valid
 * for the trainee's current HTE assignment, otherwise null.
 */
export function getTraineeGeofenceOverride(trainee: any): TraineeGeofenceOverride | null {
  if (!trainee) return null;
  const ov = trainee.geofenceOverride ?? trainee.registrationLocation?.geofenceOverride;
  if (!ov || typeof ov !== 'object') return null;
  const lat = Number(ov.lat);
  const lng = Number(ov.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  const currentKey = getTraineeHteKey(trainee);
  // If the trainee was reassigned to another HTE, the old override no longer applies
  if (ov.hteKey && currentKey && ov.hteKey !== currentKey) {
    // Allow id/company equivalence: override saved with company key while trainee now has hteId (or vice versa)
    const ovIsCo = String(ov.hteKey).startsWith('co:');
    const comp = String(trainee.companyName || '').trim().toLowerCase();
    if (!(ovIsCo && comp && ov.hteKey === `co:${comp}`)) return null;
  }
  return {
    lat,
    lng,
    radius: Math.max(20, Number(ov.radius) || 40),
    address: ov.address,
    hteKey: ov.hteKey || currentKey,
    updatedAt: ov.updatedAt,
    updatedBy: ov.updatedBy,
  };
}

export interface HteLocationInfo {
  lat: number;
  lng: number;
  radius: number;
  address: string;
  name: string;
  companyName: string;
  source: 'host_supervisor' | 'hte_employee' | 'geofence_zone' | 'company_address' | 'default_hte';
}

export const CHMSU_HTE_SITE = {
  id: '95558630-499b-4aac-b869-ba64b0694e8c',
  lat: 10.742858,
  lng: 122.970088,
  radius: 40,
  address: 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
  companyName: 'CHMSU',
  supervisorName: 'Jhey Ree',
  email: 'reejhey1@gmail.com',
};

export const CONCENTRIX_HTE_SITE = {
  id: '89405c66-015c-407a-937b-71ab37b829d7',
  lat: 10.694261,
  lng: 122.959987,
  radius: 40,
  address: 'Helix Service Center, Santa Clara Avenue, Banago, Bacolod City',
  companyName: 'Concentrix',
  supervisorName: 'Jhey Ree C Ebro',
  email: 'jheyree.ebro@chmsu.edu.ph',
};

/**
 * Checks if a company name is empty, placeholder, or unassigned.
 */
export function isInvalidHteCompany(companyName?: string | null): boolean {
  if (!companyName) return true;
  const norm = companyName.trim().toLowerCase();
  return (
    norm.length === 0 ||
    norm === 'n/a' ||
    norm === 'none' ||
    norm === 'pending' ||
    norm.includes('pending') ||
    norm === 'unassigned' ||
    norm === 'not assigned' ||
    norm === 'no company yet' ||
    norm === 'partner network'
  );
}

/**
 * Determines whether a user account or employee is a trainee (student).
 */
export function isTraineeRole(employee?: Partial<Employee> | null): boolean {
  if (!employee) return false;
  const role = (employee.role || (employee as any)?.userRole || '').toLowerCase();
  const pos = (employee.position || '').toLowerCase();
  const empId = (employee.employeeId || employee.id || '').toLowerCase();

  // Explicit instructor / faculty / admin checks
  if (
    role === 'admin' ||
    role === 'instructor' ||
    pos.includes('instructor') ||
    pos.includes('faculty') ||
    pos.includes('admin') ||
    empId.startsWith('adm-') ||
    empId.startsWith('instr-')
  ) {
    return false;
  }

  // Explicit HTE checks
  if (
    role === 'hte' ||
    role === 'host' ||
    pos.includes('hte') ||
    pos.includes('host training') ||
    pos.includes('supervisor') ||
    empId.startsWith('hte-')
  ) {
    return false;
  }

  return true;
}

/**
 * Resolves the designated HTE (Host Training Establishment) location coordinates, radius, and address.
 * Trainees MUST be geofenced to this location rather than their personal registration coordinates.
 */
export function resolveHteLocation(
  traineeOrHte: {
    id?: string;
    employeeId?: string;
    hteId?: string;
    companyName?: string;
    companyAddress?: string;
    registrationAddress?: string;
    assignedZoneId?: string;
    [key: string]: any;
  } | null | undefined,
  hostSupervisors: HostSupervisor[] = [],
  employees: Employee[] = [],
  geofenceZones: GeofenceZone[] = []
): HteLocationInfo | null {
  if (!traineeOrHte) return null;

  // 0. Priority: Instructor permanent custom geofence override for this trainee
  const override = getTraineeGeofenceOverride(traineeOrHte);
  if (override) {
    const rawCompany = (traineeOrHte.companyName || '').trim();
    const comp = rawCompany || (traineeOrHte as any)?.company || 'Assigned Workplace';
    return {
      lat: override.lat,
      lng: override.lng,
      radius: override.radius,
      address: override.address || traineeOrHte.companyAddress || traineeOrHte.registrationAddress || `${comp} Workplace Premises`,
      name: `${comp} Workplace Premises`,
      companyName: comp,
      source: 'geofence_zone',
    };
  }

  const hteId = traineeOrHte.hteId || traineeOrHte.assignedZoneId || (traineeOrHte.role === 'hte' ? traineeOrHte.id : undefined);
  const rawCompany = (traineeOrHte.companyName || '').trim();
  const hasValidCompany = !isInvalidHteCompany(rawCompany);

  // If no HTE ID and no valid company name, trainee has no assigned workplace
  if (!hteId && !hasValidCompany) {
    return null;
  }

  const normCompany = rawCompany.toLowerCase();

  // 1. Priority: Check configured Geofence Zones (Adjusted by Instructor)
  const matchedZone = geofenceZones.find((z) => {
    if (!z || z.active === false || !z.lat || !z.lng) return false;
    // Strictly exclude all personal trainee / student zones
    const zName = (z.name || '').toLowerCase();
    const isTraineeZone =
      z.id.startsWith('personal-') ||
      z.id.startsWith('station-000') ||
      zName.includes('trainee') ||
      zName.includes('student') ||
      (z as any).userType === 'trainee';

    if (isTraineeZone) return false;

    // Match by HTE ID, employeeId, or zone id
    if (hteId && (z.id === hteId || (z as any).employeeId === hteId || (z as any).employee_id === hteId || z.id === `station-${hteId}`)) {
      return true;
    }
    // Match by Company Name
    if (hasValidCompany) {
      if (zName.includes(normCompany)) return true;
      if ((z as any).companyName && String((z as any).companyName).toLowerCase().includes(normCompany)) return true;
      // Also match known aliases
      if (normCompany.includes('concentrix') && zName.includes('concentrix')) return true;
      if (normCompany.includes('printing') && (zName.includes('printing') || zName.includes('press'))) return true;
      if (normCompany.includes('chmsu') && zName.includes('chmsu')) return true;
    }
    return false;
  });

  if (matchedZone && Number.isFinite(Number(matchedZone.lat)) && Number.isFinite(Number(matchedZone.lng))) {
    const comp = (matchedZone as any).companyName || rawCompany || matchedZone.name || 'HTE Workplace';
    return {
      lat: Number(matchedZone.lat),
      lng: Number(matchedZone.lng),
      radius: Math.max(20, Number(matchedZone.radius || 40)),
      address: matchedZone.address || `${comp} Workplace Premises`,
      name: `${comp} Workplace Premises`,
      companyName: comp,
      source: 'geofence_zone',
    };
  }

  // 2. Check in hostSupervisors (matching by ID or company name)
  const matchedHost = hostSupervisors.find((h) => {
    if (!h) return false;
    if (hteId && (h.id === hteId || h.employeeId === hteId)) return true;
    if (hasValidCompany && h.companyName && h.companyName.trim().toLowerCase() === normCompany) return true;
    if (hasValidCompany && h.name && h.name.trim().toLowerCase() === normCompany) return true;
    if (normCompany.includes('concentrix') && (h.companyName?.toLowerCase().includes('concentrix') || h.name?.toLowerCase().includes('concentrix'))) return true;
    if (normCompany.includes('printing') && (h.companyName?.toLowerCase().includes('printing') || h.companyName?.toLowerCase().includes('press') || h.name?.toLowerCase().includes('printing'))) return true;
    if (normCompany.includes('chmsu') && (h.companyName?.toLowerCase().includes('chmsu') || h.name?.toLowerCase().includes('chmsu'))) return true;
    return false;
  });

  if (matchedHost) {
    const loc = matchedHost.registrationLocation;
    const lat = loc?.lat ?? (matchedHost as any)?.lat;
    const lng = loc?.lng ?? (matchedHost as any)?.lng;
    if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90) {
      const comp = matchedHost.companyName || rawCompany || matchedHost.name || 'HTE Workplace';
      return {
        lat: Number(lat),
        lng: Number(lng),
        radius: Math.max(20, Number(loc?.radius || matchedHost.registrationRadius || 40)),
        address: matchedHost.companyAddress || matchedHost.registrationAddress || `${comp} Workplace Premises`,
        name: `${comp} Workplace Premises`,
        companyName: comp,
        source: 'host_supervisor',
      };
    }
  }

  // 3. Check in employees with HTE role / position
  const matchedHteEmp = employees.find((e) => {
    if (!e) return false;
    const isHteAccount =
      e.role === 'hte' ||
      e.role === 'host' ||
      (e.position && e.position.toLowerCase().includes('hte')) ||
      (e.position && e.position.toLowerCase().includes('supervisor')) ||
      (e.employeeId && e.employeeId.startsWith('HTE-'));

    if (!isHteAccount) return false;
    if (hteId && (e.id === hteId || e.employeeId === hteId)) return true;
    if (hasValidCompany && e.companyName && e.companyName.trim().toLowerCase() === normCompany) return true;
    if (normCompany.includes('concentrix') && e.companyName?.toLowerCase().includes('concentrix')) return true;
    if (normCompany.includes('printing') && (e.companyName?.toLowerCase().includes('printing') || e.companyName?.toLowerCase().includes('press'))) return true;
    if (normCompany.includes('chmsu') && e.companyName?.toLowerCase().includes('chmsu')) return true;
    return false;
  });

  if (matchedHteEmp) {
    const loc = matchedHteEmp.registrationLocation;
    const lat = loc?.lat ?? (matchedHteEmp as any)?.registration_lat ?? (matchedHteEmp as any)?.latitude;
    const lng = loc?.lng ?? (matchedHteEmp as any)?.registration_lng ?? (matchedHteEmp as any)?.longitude;
    if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90) {
      const comp = matchedHteEmp.companyName || rawCompany || matchedHteEmp.name || 'HTE Workplace';
      return {
        lat: Number(lat),
        lng: Number(lng),
        radius: Math.max(20, Number(loc?.radius || (matchedHteEmp as any)?.registrationRadius || 40)),
        address: matchedHteEmp.companyAddress || matchedHteEmp.registrationAddress || `${comp} Workplace Premises`,
        name: `${comp} Workplace Premises`,
        companyName: comp,
        source: 'hte_employee',
      };
    }
  }

  // 4. Fallback for Known Permanent HTE Partners (Default coordinates when not adjusted)
  const isChmsuHte =
    hteId === CHMSU_HTE_SITE.id ||
    normCompany === 'chmsu' ||
    (normCompany.includes('chmsu') && !normCompany.includes('concentrix') && !normCompany.includes('printing'));

  if (isChmsuHte) {
    const comp = rawCompany && !normCompany.includes('pending') ? rawCompany : CHMSU_HTE_SITE.companyName;
    return {
      lat: CHMSU_HTE_SITE.lat,
      lng: CHMSU_HTE_SITE.lng,
      radius: CHMSU_HTE_SITE.radius,
      address: CHMSU_HTE_SITE.address,
      name: `${comp} Workplace Premises`,
      companyName: comp,
      source: 'default_hte',
    };
  }

  const isConcentrixHte =
    hteId === CONCENTRIX_HTE_SITE.id ||
    normCompany === 'concentrix' ||
    normCompany.includes('concentrix');

  if (isConcentrixHte) {
    const comp = rawCompany && !normCompany.includes('pending') ? rawCompany : CONCENTRIX_HTE_SITE.companyName;
    return {
      lat: CONCENTRIX_HTE_SITE.lat,
      lng: CONCENTRIX_HTE_SITE.lng,
      radius: CONCENTRIX_HTE_SITE.radius,
      address: CONCENTRIX_HTE_SITE.address,
      name: `${comp} Workplace Premises`,
      companyName: comp,
      source: 'default_hte',
    };
  }

  // 5. Check if companyAddress contains GPS coordinates: e.g. "10.742858, 122.970088"
  const compAddr = traineeOrHte.companyAddress || '';
  const coordMatch = compAddr.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const cLat = parseFloat(coordMatch[1]);
    const cLng = parseFloat(coordMatch[2]);
    if (Number.isFinite(cLat) && Number.isFinite(cLng) && Math.abs(cLat) <= 90 && Math.abs(cLng) <= 180) {
      return {
        lat: cLat,
        lng: cLng,
        radius: 40,
        address: compAddr,
        name: `${rawCompany} Workplace Premises`,
        companyName: rawCompany,
        source: 'company_address',
      };
    }
  }

  // 5. Permanent designated HTE establishment site coordinates (Fixed, never moving)
  if (hasValidCompany) {
    return {
      lat: 10.742858,
      lng: 122.970088,
      radius: 40,
      address: compAddr || 'Domingo Lizares Street, Purok Manpower, Zone 1, Talisay, Negros Occidental, Negros Island Region, 6115, Philippines',
      name: `${rawCompany} Workplace Premises`,
      companyName: rawCompany,
      source: 'default_hte',
    };
  }

  return null;
}
