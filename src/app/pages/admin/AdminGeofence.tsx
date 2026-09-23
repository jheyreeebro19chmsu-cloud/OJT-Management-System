import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  Save,
  ToggleLeft,
  ToggleRight,
  Navigation,
  Info,
  MoreVertical,
  User,
  Building,
  ExternalLink,
  Search,
  ShieldCheck,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Eye,
  Move,
  Copy,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { GeofenceMap } from '../../components/GeofenceMap';
import { useApp } from '../../store/AppContext';
import { GeofenceZone, Employee } from '../../types';
import { GEOFENCE_RADIUS_METERS } from '../../utils/geo';
import { getCampusLocation } from '../../utils/campusLocations';
import { getPhotoUrl } from '../../services/config';

const BLANK_ZONE = {
  name: '',
  address: '',
  lat: 10.7410,
  lng: 122.9702,
  radius: GEOFENCE_RADIUS_METERS,
  active: true,
};

type ZoneTypeFilter = 'all' | 'trainee' | 'instructor' | 'hte' | 'institutional';

export function AdminGeofence() {
  const { currentUser, geofenceZones, addGeofenceZone, updateGeofenceZone, deleteGeofenceZone, employees, updateEmployee, settings, hostSupervisors = [] } = useApp();
  const navigate = useNavigate();

  // Trainee role guard: Trainees are strictly forbidden from accessing or managing geofences
  useEffect(() => {
    if (!currentUser) return;
    const role = (currentUser.role || (currentUser as any).position || '').toLowerCase();
    if (role === 'employee' || role === 'trainee' || role.includes('trainee') || role.includes('student')) {
      navigate('/app', { replace: true });
    }
  }, [currentUser, navigate]);

  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(settings?.activeAcademicYear || 'all');
  const [zoneTypeFilter, setZoneTypeFilter] = useState<ZoneTypeFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(BLANK_ZONE);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close open action menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleOutsideClick = () => setOpenMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [openMenuId]);

  // View Zone Modal State
  const [viewModalZone, setViewModalZone] = useState<GeofenceZone | null>(null);

  // Assign / Change HTE Workplace State for Trainees
  const [assigningHteAccount, setAssigningHteAccount] = useState<Employee | null>(null);
  const [assigningHteZone, setAssigningHteZone] = useState<GeofenceZone | null>(null);
  const [hteModalSearch, setHteModalSearch] = useState('');

  // Interactive Drag on Map State
  const [dragZoneId, setDragZoneId] = useState<string | null>(null);
  const [dragCoords, setDragCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [copiedCoord, setCopiedCoord] = useState(false);

  const normalizeName = (str: string): string => {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .sort()
      .join(' ');
  };

  const isTraineeAccount = (acc: Employee | null): boolean => {
    if (!acc) return false;
    const normPos = (acc.position || '').toLowerCase();
    const empId = (acc.employeeId || '').toLowerCase();
    const id = (acc.id || '').toLowerCase();
    const role = ((acc as any).role || '').toLowerCase();

    // Positive trainee indicators
    if (
      role === 'employee' ||
      role === 'trainee' ||
      normPos.includes('trainee') ||
      normPos.includes('student') ||
      normPos.includes('intern') ||
      empId.startsWith('ojt-')
    ) {
      return true;
    }

    // Explicit Instructor / Admin indicators
    if (
      role === 'admin' ||
      role === 'instructor' ||
      normPos.includes('instructor') ||
      normPos.includes('faculty') ||
      normPos.includes('admin') ||
      empId.startsWith('adm-') ||
      empId.startsWith('instr-') ||
      id.startsWith('adm') ||
      id.startsWith('instr')
    ) {
      return false;
    }

    // Explicit HTE indicators
    if (
      role === 'hte' ||
      role === 'host' ||
      normPos.includes('hte') ||
      normPos.includes('host training') ||
      normPos.includes('supervisor') ||
      empId.startsWith('hte-') ||
      id.startsWith('hte')
    ) {
      return false;
    }

    return true;
  };

  const getAccountForZone = (zone: any): Employee | null => {
    if (!zone) return null;
    if (zone.id?.startsWith('station-')) {
      const empId = zone.id.replace('station-', '');
      const found = employees.find((e) => e.id === empId || e.employeeId === empId);
      if (found) return found;
    }
    const directEmp = employees.find((e) => e.id === zone.id || e.employeeId === zone.id);
    if (directEmp) return directEmp;

    const personPrefix = (zone.name?.includes(' - ') ? zone.name.split(' - ')[0].trim() : zone.name || '').trim();
    const normZonePrefix = personPrefix.toLowerCase();
    if (!normZonePrefix) return null;

    // 1. Exact name match first
    const exact = employees.find((e) => (e.name || '').toLowerCase().trim() === normZonePrefix);
    if (exact) return exact;

    // 2. Exact word-set match
    const normZoneWords = normalizeName(personPrefix);
    const matchByName = employees.find((e) => {
      if (!e.name) return false;
      return normalizeName(e.name) === normZoneWords;
    });
    if (matchByName) return matchByName;

    return null;
  };

  const isInstructorZone = (zone: any): boolean => {
    const acc = getAccountForZone(zone);
    if (acc && isTraineeAccount(acc)) return false;
    const normPos = acc?.position?.toLowerCase() || '';
    const empId = acc?.employeeId?.toLowerCase() || '';
    const accId = (acc?.id || '').toLowerCase();
    const zoneName = (zone?.name || '').toLowerCase();
    const zoneId = (zone?.id || '').toLowerCase();
    if (zoneName.includes('trainee') || zoneName.includes('student')) return false;
    return Boolean(
      normPos.includes('instructor') ||
      normPos.includes('faculty') ||
      normPos.includes('admin') ||
      empId.startsWith('adm-') ||
      empId.startsWith('instr-') ||
      accId.startsWith('adm') ||
      accId.startsWith('instr') ||
      zoneName.includes('instructor') ||
      zoneName.includes('official station') ||
      zoneName.includes('faculty') ||
      zoneId.includes('instructor') ||
      zoneId.includes('faculty')
    );
  };

  const isHTEZone = (zone: any): boolean => {
    const acc = getAccountForZone(zone);
    if (acc && isTraineeAccount(acc)) return false;
    const normPos = acc?.position?.toLowerCase() || '';
    const empId = acc?.employeeId?.toLowerCase() || '';
    const zoneName = (zone?.name || '').toLowerCase();
    if (zoneName.includes('trainee') || zoneName.includes('student')) return false;
    return Boolean(
      normPos.includes('hte') ||
      normPos.includes('host training') ||
      empId.startsWith('hte-') ||
      (acc?.id && acc.id.toLowerCase().startsWith('hte')) ||
      zoneName.includes('hte') ||
      zoneName.includes('host training') ||
      zoneName.includes('partner workplace')
    );
  };

  const getZoneAcademicYear = (zone: any): string | null => {
    if (zone.academicYear) return zone.academicYear;
    const account = getAccountForZone(zone);
    return account?.academicYear || null;
  };

  const isTraineeZone = (zone: any): boolean => {
    const acc = getAccountForZone(zone);
    if (acc && isTraineeAccount(acc)) return true;
    const zoneName = (zone?.name || '').toLowerCase();
    const zoneId = (zone?.id || '').toLowerCase();
    return Boolean(
      zoneId.startsWith('personal-') ||
      zoneName.includes('trainee') ||
      zoneName.includes('intern') ||
      zoneName.includes('student') ||
      zoneName.includes('registered account geofence')
    );
  };

  // Helper to resolve an HTE's official workplace facility information
  const getHteWorkplaceInfo = (hteId?: string, companyName?: string) => {
    if (!hteId && !companyName) return null;
    const normCompany = (companyName || '').trim().toLowerCase();

    // 1. Check in hostSupervisors
    const matchedHost = hostSupervisors.find(
      (h) => (hteId && (h.id === hteId || h.employeeId === hteId)) || (normCompany && h.companyName?.trim().toLowerCase() === normCompany)
    );
    if (matchedHost) {
      const loc = matchedHost.registrationLocation;
      const addr = matchedHost.companyAddress || matchedHost.registrationAddress || `${matchedHost.companyName} Workplace Premises`;
      if (loc && loc.lat && loc.lng && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng))) {
        return {
          id: matchedHost.id,
          name: matchedHost.name,
          companyName: matchedHost.companyName,
          address: addr,
          lat: Number(loc.lat),
          lng: Number(loc.lng),
          radius: Math.max(40, Number(loc.radius || matchedHost.registrationRadius || 40)),
        };
      }
    }

    // 2. Check in employees with HTE position/role
    const matchedHteEmp = employees.find(
      (e) =>
        (e.position?.toLowerCase().includes('hte') || e.role === 'hte' || e.employeeId?.startsWith('HTE-')) &&
        ((hteId && e.id === hteId) || (normCompany && e.companyName?.trim().toLowerCase() === normCompany))
    );
    if (matchedHteEmp) {
      const regLoc = matchedHteEmp.registrationLocation;
      const addr = matchedHteEmp.companyAddress || matchedHteEmp.registrationAddress || `${matchedHteEmp.companyName} Workplace Premises`;
      if (regLoc && regLoc.lat && regLoc.lng && Number.isFinite(Number(regLoc.lat)) && Number.isFinite(Number(regLoc.lng))) {
        return {
          id: matchedHteEmp.id,
          name: matchedHteEmp.name,
          companyName: matchedHteEmp.companyName,
          address: addr,
          lat: Number(regLoc.lat),
          lng: Number(regLoc.lng),
          radius: Math.max(40, Number((regLoc as any).radius || (matchedHteEmp as any).registration_radius || 40)),
        };
      }
    }

    // 3. Check in geofenceZones for existing HTE partner workplace zone
    const matchedHteZone = geofenceZones.find(
      (z) =>
        isHTEZone(z) &&
        ((hteId && z.id === hteId) || (normCompany && z.name?.toLowerCase().includes(normCompany)))
    );
    if (matchedHteZone && matchedHteZone.lat && matchedHteZone.lng && Number.isFinite(Number(matchedHteZone.lat)) && Number.isFinite(Number(matchedHteZone.lng))) {
      return {
        id: matchedHteZone.id,
        name: matchedHteZone.name,
        companyName: companyName || matchedHteZone.name,
        address: matchedHteZone.address || `${matchedHteZone.name} Workplace Premises`,
        lat: Number(matchedHteZone.lat),
        lng: Number(matchedHteZone.lng),
        radius: Math.max(40, Number(matchedHteZone.radius || 40)),
      };
    }

    if (matchedHost) {
      return {
        id: matchedHost.id,
        name: matchedHost.name,
        companyName: matchedHost.companyName,
        address: matchedHost.companyAddress || matchedHost.registrationAddress || `${matchedHost.companyName} Workplace Premises`,
        lat: 10.7412,
        lng: 122.9691,
        radius: 40,
      };
    }

    return null;
  };

  // List of all registered HTE establishments available for assignment
  const allHteOptions = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      companyName: string;
      companyAddress: string;
      lat: number;
      lng: number;
      radius: number;
      email?: string;
    }> = [];
    const seenNames = new Set<string>();

    hostSupervisors.forEach((h) => {
      if (!h.companyName) return;
      const key = h.companyName.trim().toLowerCase();
      seenNames.add(key);
      const loc = h.registrationLocation;
      list.push({
        id: h.id,
        name: h.name,
        companyName: h.companyName,
        companyAddress: h.companyAddress || h.registrationAddress || `${h.companyName} Workplace Premises`,
        lat: Number(loc?.lat ?? 10.7412),
        lng: Number(loc?.lng ?? 122.9691),
        radius: Math.max(40, Number(loc?.radius || h.registrationRadius || 40)),
        email: h.email,
      });
    });

    employees.forEach((e) => {
      if ((e.position?.toLowerCase().includes('hte') || e.role === 'hte' || e.employeeId?.startsWith('HTE-')) && e.companyName) {
        const key = e.companyName.trim().toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          const loc = e.registrationLocation;
          list.push({
            id: e.id,
            name: e.name,
            companyName: e.companyName,
            companyAddress: e.companyAddress || e.registrationAddress || `${e.companyName} Workplace Premises`,
            lat: Number(loc?.lat ?? 10.7412),
            lng: Number(loc?.lng ?? 122.9691),
            radius: Math.max(40, Number((loc as any)?.radius || 40)),
            email: e.email,
          });
        }
      }
    });

    return list;
  }, [hostSupervisors, employees]);

  // Combine explicit geofenceZones with instructor, HTE, and Trainee registered stations (with strict deduplication)
  const allCombinedZones = useMemo<GeofenceZone[]>(() => {
    const zoneMap = new Map<string, GeofenceZone>();

    // 1. Process explicit geofence zones from DB/Storage
    geofenceZones
      .filter(
        (z) =>
          !z.name.toLowerCase().includes('main training center') &&
          z.id !== 'zone-1' &&
          !z.name.toLowerCase().includes('rainer') &&
          !z.name.toLowerCase().includes('dooms')
      )
      .forEach((z) => {
        const account = getAccountForZone(z);
        const personName = account?.name || (z.name?.includes(' - ') ? z.name.split(' - ')[0].trim() : z.name || '').trim();
        const normPerson = normalizeName(personName);
        const personKey = normPerson
          ? `person-${normPerson}`
          : account
          ? `emp-${account.id}`
          : `zone-${z.lat.toFixed(4)},${z.lng.toFixed(4)}`;

        // If zone belongs to an instructor, ensure address and coordinates are based on campus station geofencing location
        let zoneData: GeofenceZone = { ...z, active: z.active !== false };
        if (isInstructorZone(z)) {
          const campusInfo = getCampusLocation(account?.campus || (account as any)?.schoolName || z.name);
          const rawAddr = (zoneData.address || '').toLowerCase();
          const isResidential =
            rawAddr.includes('lantad') ||
            rawAddr.includes('banago') ||
            rawAddr.includes('silay') ||
            rawAddr.includes('bacolod') ||
            rawAddr.includes('region vi') ||
            (!rawAddr.includes('chmsu') && !rawAddr.includes('campus') && !rawAddr.includes('carlos hilado'));

          if (!zoneData.address || isResidential) {
            zoneData.address = campusInfo.address;
            zoneData.lat = campusInfo.lat;
            zoneData.lng = campusInfo.lng;
          }
        } else if (account && isTraineeAccount(account) && (account.hteId || (account.companyName && !account.companyName.toLowerCase().includes('pending')))) {
          // If zone belongs to a trainee with an assigned HTE, their assigned workplace MUST strictly be the HTE workplace!
          const hteInfo = getHteWorkplaceInfo(account.hteId, account.companyName);
          if (hteInfo) {
            zoneData.name = `${account.name} - Trainee Geofence (${hteInfo.companyName})`;
            zoneData.address = hteInfo.address;
            zoneData.lat = hteInfo.lat;
            zoneData.lng = hteInfo.lng;
            zoneData.radius = Math.max(40, hteInfo.radius);
          }
        }

        if (!zoneMap.has(personKey)) {
          zoneMap.set(personKey, zoneData);
        } else {
          const existing = zoneMap.get(personKey)!;
          const isExistingGeneric = !existing.address || existing.address === 'Official Workplace GPS' || existing.address.includes('GPS Locked');
          const isNewSpecific = Boolean(zoneData.address && zoneData.address !== 'Official Workplace GPS' && !zoneData.address.includes('GPS Locked'));
          if (isExistingGeneric && isNewSpecific) {
            zoneMap.set(personKey, zoneData);
          }
        }
      });

    // 2. Include registered Instructors, HTEs, and Trainees with GPS coordinates (skipping duplicates)
    employees.forEach((emp: Employee) => {
      if (!emp.name || !emp.name.trim()) return;
      if (emp.name.toLowerCase().includes('rainer') || emp.companyName?.toLowerCase().includes('dooms')) return;

      const normEmp = normalizeName(emp.name);
      const personKey = normEmp ? `person-${normEmp}` : `emp-${emp.id}`;

      // If this person already has a configured geofence zone, do not create a redundant duplicate
      if (zoneMap.has(personKey)) {
        return;
      }

      const isInst = Boolean(
        emp.position === 'OJT Instructor' ||
        (emp.position && emp.position.toLowerCase().includes('instructor')) ||
        (emp.employeeId && (emp.employeeId.startsWith('ADM-') || emp.employeeId.startsWith('INSTR-'))) ||
        (emp.id && (emp.id.toLowerCase().startsWith('adm') || emp.id.toLowerCase().startsWith('instr')))
      );
      const isHte = Boolean(
        emp.position === 'HTE Representative' ||
        (emp.position && emp.position.toLowerCase().includes('hte')) ||
        (emp.employeeId && emp.employeeId.startsWith('HTE-')) ||
        (emp.id && emp.id.toLowerCase().startsWith('hte'))
      );

      const campusInfo = getCampusLocation(emp.campus);
      let regLat = isInst ? campusInfo.lat : (emp.registrationLocation?.lat ?? (emp as any)?.registration_lat ?? (emp as any)?.latitude);
      let regLng = isInst ? campusInfo.lng : (emp.registrationLocation?.lng ?? (emp as any)?.registration_lng ?? (emp as any)?.longitude);
      let stationRadius = isInst ? campusInfo.radius : ((emp.registrationLocation as any)?.radius || (emp as any)?.registrationRadius || (emp as any)?.registration_radius || GEOFENCE_RADIUS_METERS);
      let stationAddr = isInst
        ? campusInfo.address
        : (emp.companyAddress || emp.registrationAddress || 'Trainee GPS Locked Station');

      // Trainee with assigned HTE: strictly bind to the HTE workplace!
      if (!isInst && !isHte && (emp.hteId || (emp.companyName && !emp.companyName.toLowerCase().includes('pending')))) {
        const hteInfo = getHteWorkplaceInfo(emp.hteId, emp.companyName);
        if (hteInfo) {
          regLat = hteInfo.lat;
          regLng = hteInfo.lng;
          stationRadius = Math.max(40, hteInfo.radius);
          stationAddr = hteInfo.address;
        }
      }

      if (!isInst && (regLat == null || regLng == null) && (emp.registrationAddress || (emp as any)?.registration_address)) {
        const addrStr = String(emp.registrationAddress || (emp as any)?.registration_address);
        const match = addrStr.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
        if (match) {
          regLat = parseFloat(match[1]);
          regLng = parseFloat(match[2]);
        }
      }
      // Ensure all trainees and staff have a monitorable geofence station (defaulting to campus station coordinates)
      if (regLat == null || regLng == null) {
        regLat = campusInfo.lat;
        regLng = campusInfo.lng;
      }
      if (regLat && regLng && Number.isFinite(Number(regLat)) && Number.isFinite(Number(regLng))) {
        const defaultName = isInst
          ? `${emp.name} - Official Station`
          : isHte
          ? `${emp.name} - ${emp.companyName || 'HTE Workplace'}`
          : `${emp.name} - Trainee Geofence (${emp.companyName || 'Assigned Workplace'})`;

        zoneMap.set(personKey, {
          id: `station-${emp.id}`,
          name: defaultName,
          address: stationAddr,
          lat: Number(regLat),
          lng: Number(regLng),
          radius: stationRadius,
          active: true,
          academicYear: emp.academicYear || settings.activeAcademicYear,
        });
      }
    });

    return Array.from(zoneMap.values());
  }, [geofenceZones, employees, settings.activeAcademicYear, hostSupervisors]);

  const filteredZones = useMemo(() => {
    return allCombinedZones.filter((zone) => {
      // Academic year filter
      if (selectedAcademicYear !== 'all') {
        const zoneAY = getZoneAcademicYear(zone);
        if (zoneAY && zoneAY !== selectedAcademicYear) return false;
      }

      // Zone category filter
      if (zoneTypeFilter === 'trainee' && !isTraineeZone(zone)) return false;
      if (zoneTypeFilter === 'instructor' && !isInstructorZone(zone)) return false;
      if (zoneTypeFilter === 'hte' && !isHTEZone(zone)) return false;
      if (zoneTypeFilter === 'institutional' && (isInstructorZone(zone) || isHTEZone(zone) || isTraineeZone(zone))) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const account = getAccountForZone(zone);
        const matchName = zone.name.toLowerCase().includes(q);
        const matchAddress = (zone.address || '').toLowerCase().includes(q);
        const matchAccount = account && (
          account.name.toLowerCase().includes(q) ||
          (account.employeeId || '').toLowerCase().includes(q) ||
          (account.companyName || '').toLowerCase().includes(q) ||
          (account.position || '').toLowerCase().includes(q) ||
          ((account as any).course || '').toLowerCase().includes(q)
        );
        if (!matchName && !matchAddress && !matchAccount) return false;
      }

      return true;
    });
  }, [allCombinedZones, selectedAcademicYear, zoneTypeFilter, searchQuery, employees]);

  // 5 accounts/zones per page pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAcademicYear, zoneTypeFilter, searchQuery]);

  const totalPages = Math.ceil(filteredZones.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedZones = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredZones.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredZones, currentPage]);

  const upd = (f: string, v: string | number | boolean) => setForm((p) => ({ ...p, [f]: v }));

  // Centralized coordinate & zone update to sync Supabase geofence_zones and employee records
  const saveZoneCoordinates = (zoneId: string, updatedData: Partial<GeofenceZone>) => {
    const matchedZone = allCombinedZones.find((z) => z.id === zoneId);
    const account = getAccountForZone(matchedZone || { id: zoneId });
    const targetRadius = Math.max(40, Number(updatedData.radius ?? matchedZone?.radius ?? GEOFENCE_RADIUS_METERS));

    if (account) {
      updateEmployee(account.id, {
        registrationLocation: {
          lat: Number(updatedData.lat ?? matchedZone?.lat),
          lng: Number(updatedData.lng ?? matchedZone?.lng),
          radius: targetRadius,
        },
        registrationRadius: targetRadius,
        registrationAddress: updatedData.address || matchedZone?.address,
      });
    }

    const existsInZones = geofenceZones.some((z) => z.id === zoneId);
    if (existsInZones) {
      updateGeofenceZone(zoneId, { ...updatedData, radius: targetRadius });
    } else {
      addGeofenceZone({
        id: zoneId,
        name: updatedData.name || matchedZone?.name || (account ? `${account.name} - Trainee Geofence` : 'Geofence Zone'),
        address: updatedData.address || matchedZone?.address || 'Official Workplace GPS',
        lat: Number(updatedData.lat ?? matchedZone?.lat ?? 10.741),
        lng: Number(updatedData.lng ?? matchedZone?.lng ?? 122.9702),
        radius: targetRadius,
        active: updatedData.active ?? matchedZone?.active ?? true,
        academicYear: selectedAcademicYear !== 'all' ? selectedAcademicYear : settings.activeAcademicYear,
      });
    }
  };

  // Directly assign or change the trainee's HTE workplace with instant database & geofence synchronization
  const handleAssignHte = async (targetEmployee: Employee, selectedHte: any) => {
    const hteAddress = selectedHte.companyAddress || selectedHte.registrationAddress || `${selectedHte.companyName} Workplace Premises`;
    const hteCoords = {
      lat: Number(selectedHte.lat ?? 10.7412),
      lng: Number(selectedHte.lng ?? 122.9691),
      radius: Math.max(40, Number(selectedHte.radius || 40)),
    };

    // 1. Directly update trainee employee in AppContext & Supabase
    await updateEmployee(targetEmployee.id, {
      hteId: selectedHte.id,
      companyName: selectedHte.companyName,
      companyAddress: hteAddress,
      registrationAddress: hteAddress,
      supervisorName: selectedHte.name,
      registrationLocation: hteCoords,
      registrationRadius: hteCoords.radius,
    });

    // 2. Directly update/upsert trainee's geofence zone in Supabase and local state
    const zoneId = `station-${targetEmployee.id}`;
    saveZoneCoordinates(zoneId, {
      name: `${targetEmployee.name} - Trainee Geofence (${selectedHte.companyName})`,
      address: hteAddress,
      lat: hteCoords.lat,
      lng: hteCoords.lng,
      radius: hteCoords.radius,
      active: true,
      academicYear: targetEmployee.academicYear || settings?.activeAcademicYear,
    });

    // 3. Move map focus directly to the new coordinates
    setSelectedZoneId(zoneId);
    setFocusCoords({ lat: hteCoords.lat, lng: hteCoords.lng });

    setAssigningHteAccount(null);
    setAssigningHteZone(null);
    toast.success(`Assigned workplace for ${targetEmployee.name} changed directly to ${selectedHte.companyName}!`);
  };

  const handleAdd = () => {
    if (!form.name.trim()) {
      toast.error('Please enter a zone name.');
      return;
    }
    addGeofenceZone({
      ...form,
      academicYear: selectedAcademicYear !== 'all' ? selectedAcademicYear : settings.activeAcademicYear,
    });
    setForm(BLANK_ZONE);
    setShowAdd(false);
    toast.success('Geofence zone added successfully!');
  };

  // Scroll directly to map and fly-to focus coordinates
  const scrollToMapAndFocus = (zone: GeofenceZone) => {
    setSelectedZoneId(zone.id);
    setFocusCoords({ lat: Number(zone.lat), lng: Number(zone.lng) });

    const mapCard = document.getElementById('geofence-map-card');
    if (mapCard) {
      const navHeaderOffset = 70;
      const elementRect = mapCard.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.pageYOffset;
      const targetScrollY = Math.max(0, absoluteElementTop - navHeaderOffset);

      window.scrollTo({ top: targetScrollY, behavior: 'smooth' });

      const mainContainer = document.querySelector('main');
      if (mainContainer) {
        const containerRect = mainContainer.getBoundingClientRect();
        const targetContainerTop = elementRect.top - containerRect.top + mainContainer.scrollTop - navHeaderOffset;
        mainContainer.scrollTo({ top: Math.max(0, targetContainerTop), behavior: 'smooth' });
      }

      mapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleEdit = (zone: GeofenceZone) => {
    setEditId(zone.id);
    setForm({
      name: zone.name,
      address: zone.address,
      lat: zone.lat,
      lng: zone.lng,
      radius: zone.radius || GEOFENCE_RADIUS_METERS,
      active: zone.active,
    });
    scrollToMapAndFocus(zone);
  };

  const handleSaveEdit = () => {
    if (editId) {
      saveZoneCoordinates(editId, form);
      setEditId(null);
      toast.success('Geofence zone updated and saved successfully!');
    }
  };

  // Drag on map handlers
  const handleStartDrag = (zone: GeofenceZone) => {
    setDragZoneId(zone.id);
    setDragCoords({ lat: zone.lat, lng: zone.lng });
    scrollToMapAndFocus(zone);
    toast.info(`📍 Drag mode active for "${zone.name}". Move the marker on the map to relocate perimeter.`);
  };

  const handleZoneDrag = (_zoneId: string, lat: number, lng: number) => {
    setDragCoords({ lat, lng });
  };

  const handleZoneDragEnd = (_zoneId: string, lat: number, lng: number) => {
    setDragCoords({ lat, lng });
  };

  const handleSaveDrag = () => {
    if (dragZoneId && dragCoords) {
      const zName = draggedZone?.name || 'Geofence Zone';
      saveZoneCoordinates(dragZoneId, {
        lat: dragCoords.lat,
        lng: dragCoords.lng,
      });
      setDragZoneId(null);
      setDragCoords(null);
      toast.success(`✓ Saved new geofence position for "${zName}"!`);
    }
  };

  const handleCancelDrag = () => {
    setDragZoneId(null);
    setDragCoords(null);
    toast.info('Drag mode cancelled.');
  };

  // View zone details modal handler
  const handleViewZone = (zone: GeofenceZone) => {
    setViewModalZone(zone);
    scrollToMapAndFocus(zone);
  };

  // Direct save handler from 3-dots menu
  const handleDirectSave = (zone: GeofenceZone) => {
    if (dragZoneId === zone.id && dragCoords) {
      handleSaveDrag();
      return;
    }
    if (editId === zone.id) {
      handleSaveEdit();
      return;
    }
    saveZoneCoordinates(zone.id, {
      lat: zone.lat,
      lng: zone.lng,
      radius: zone.radius,
      active: zone.active,
      name: zone.name,
      address: zone.address,
    });
    toast.success(`✓ Zone "${zone.name}" verified and saved to database.`);
  };

  const handleDelete = (id: string) => {
    deleteGeofenceZone(id);
    toast.success('Geofence zone removed.');
  };

  const handleToggle = (zone: GeofenceZone) => {
    saveZoneCoordinates(zone.id, { active: !zone.active });
    toast.info(`Zone ${zone.active ? 'deactivated' : 'activated'}.`);
  };

  const isValidCoord = (lat: any, lng: any) => {
    return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
  };

  const invalidZones = filteredZones.filter((zone) => !zone || !isValidCoord(zone.lat, zone.lng));

  const availableYears = Array.from(
    new Set([
      settings?.activeAcademicYear || '2026-2027',
      ...(settings?.academicYears || []),
      ...allCombinedZones.map((z: any) => getZoneAcademicYear(z)).filter(Boolean),
    ])
  ).sort().reverse();

  // Statistics
  const totalActive = allCombinedZones.filter((z) => z.active).length;
  const totalTraineeZones = allCombinedZones.filter((z) => isTraineeZone(z)).length;
  const totalInstructorZones = allCombinedZones.filter((z) => isInstructorZone(z)).length;
  const totalHTEZones = allCombinedZones.filter((z) => isHTEZone(z)).length;
  const totalInstitutional = allCombinedZones.filter((z) => !isInstructorZone(z) && !isHTEZone(z) && !isTraineeZone(z)).length;

  // Currently dragged zone
  const draggedZone = useMemo(() => {
    if (!dragZoneId) return null;
    return allCombinedZones.find((z) => z.id === dragZoneId) || null;
  }, [dragZoneId, allCombinedZones]);

  // Display zones list with live drag coordinates and real-time editing radius overridden
  const displayZones = useMemo(() => {
    return filteredZones.map((z) => {
      let updated = { ...z };
      if (dragZoneId && dragCoords && z.id === dragZoneId) {
        updated.lat = dragCoords.lat;
        updated.lng = dragCoords.lng;
      }
      if (editId && z.id === editId) {
        if (form.radius) updated.radius = Number(form.radius);
        if (form.lat) updated.lat = Number(form.lat);
        if (form.lng) updated.lng = Number(form.lng);
        if (form.name) updated.name = form.name;
      }
      return updated;
    });
  }, [filteredZones, dragZoneId, dragCoords, editId, form.radius, form.lat, form.lng, form.name]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Geofence Location Monitoring</h2>
          <p className="text-sm text-gray-500">
            Monitor Trainee registered GPS perimeters, OJT instructor stations, HTE partner workplaces, and campus boundaries for attendance verification.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Academic Year Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm text-xs">
            <span className="font-semibold text-gray-600">Cohort AY:</span>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="bg-transparent font-bold text-blue-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Academic Years</option>
              {availableYears.map((ay) => (
                <option key={ay} value={ay}>
                  AY {ay} {ay === settings?.activeAcademicYear ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setForm(BLANK_ZONE);
              setShowAdd(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            Add Zone
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Total Active</p>
            <p className="text-xl font-black text-gray-900">{totalActive}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <User size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Trainee Geofences</p>
            <p className="text-xl font-black text-emerald-700">{totalTraineeZones}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">OJT Instructors</p>
            <p className="text-xl font-black text-purple-700">{totalInstructorZones}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Building size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">HTE Workplaces</p>
            <p className="text-xl font-black text-amber-700">{totalHTEZones}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center shrink-0">
            <GraduationCap size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Campus Stations</p>
            <p className="text-xl font-black text-sky-700">{totalInstitutional}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => setZoneTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              zoneTypeFilter === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            All Zones ({allCombinedZones.length})
          </button>
          <button
            onClick={() => setZoneTypeFilter('trainee')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              zoneTypeFilter === 'trainee'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Trainees ({totalTraineeZones})
          </button>
          <button
            onClick={() => setZoneTypeFilter('instructor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              zoneTypeFilter === 'instructor'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            OJT Instructors ({totalInstructorZones})
          </button>
          <button
            onClick={() => setZoneTypeFilter('hte')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              zoneTypeFilter === 'hte'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            HTE Workplaces ({totalHTEZones})
          </button>
          <button
            onClick={() => setZoneTypeFilter('institutional')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              zoneTypeFilter === 'institutional'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Campus ({totalInstitutional})
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search station, HTE establishment, or campus zone..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Map Visualization */}
      <motion.div
        id="geofence-map-card"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-blue-600" />
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Interactive Geofence Map (Leaflet)</h3>
              <p className="text-xs text-gray-500">Live visualization of all OJT workplace boundaries and campus pins</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dragZoneId && (
              <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-extrabold flex items-center gap-1.5 animate-pulse border border-purple-200">
                <Move size={12} /> Dragging Active
              </span>
            )}
            {selectedZoneId && (
              <button
                onClick={() => {
                  setSelectedZoneId(null);
                  setFocusCoords(undefined);
                  if (dragZoneId) handleCancelDrag();
                }}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Reset View
              </button>
            )}
          </div>
        </div>

        {/* Floating Map Drag Mode HUD Overlay */}
        <AnimatePresence>
          {dragZoneId && draggedZone && dragCoords && (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="absolute top-16 left-3 right-3 z-500 bg-slate-950/90 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-blue-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/50 flex items-center justify-center shrink-0">
                  <Move size={18} className="text-blue-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-400">Drag Mode Active</span>
                    <span className="text-slate-400 text-xs">•</span>
                    <span className="text-xs font-bold text-white truncate max-w-xs">{draggedZone.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    📍 Lat: {dragCoords.lat.toFixed(5)}, Lng: {dragCoords.lng.toFixed(5)} ({draggedZone.radius}m radius)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleSaveDrag}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <Save size={13} /> Save Position
                </button>
                <button
                  type="button"
                  onClick={handleCancelDrag}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {invalidZones.length > 0 && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Warning:</span> {invalidZones.length} zone
            {invalidZones.length > 1 ? 's' : ''} with invalid coordinates skipped on map.
          </div>
        )}

        <GeofenceMap
          zones={displayZones}
          picking={Boolean(showAdd || (editId && !dragZoneId))}
          pickedCoords={showAdd || editId ? { lat: Number(form.lat), lng: Number(form.lng) } : undefined}
          pickedRadius={Number(form.radius) || GEOFENCE_RADIUS_METERS}
          focusCoords={focusCoords}
          className="h-80"
          draggableZoneId={dragZoneId}
          onZoneDrag={handleZoneDrag}
          onZoneDragEnd={handleZoneDragEnd}
          onZoneClick={(zone) => {
            setSelectedZoneId(zone.id);
            setFocusCoords({ lat: zone.lat, lng: zone.lng });
          }}
          onPick={(lat, lng) => {
            upd('lat', lat);
            upd('lng', lng);
          }}
        />
      </motion.div>


      {/* Zone List */}
      <div className="space-y-3">
        {filteredZones.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
            <MapPin size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No geofence zones found</p>
            <p className="text-gray-400 text-sm mt-1">
              Campus institutional zones, instructor stations, and HTE workplaces will appear here.
            </p>
          </div>
        ) : (
          paginatedZones.map((zone, idx) => {
            const account = getAccountForZone(zone);
            const isInstructor = isInstructorZone(zone);
            const isHTE = isHTEZone(zone);
            const isTrainee = isTraineeZone(zone);

            return (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => {
                  if (editId !== zone.id) {
                    scrollToMapAndFocus(zone);
                  }
                }}
                className={`bg-white rounded-2xl shadow-sm border transition-all cursor-pointer hover:shadow-md ${
                  openMenuId === zone.id ? 'relative z-30' : 'relative z-0'
                } ${
                  selectedZoneId === zone.id
                    ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20'
                    : isTrainee
                    ? 'border-emerald-100 hover:border-emerald-300'
                    : isInstructor
                    ? 'border-purple-100 hover:border-purple-300'
                    : isHTE
                    ? 'border-amber-100 hover:border-amber-300'
                    : 'border-gray-100 hover:border-blue-300'
                }`}
              >
                {editId === zone.id ? (
                  <div className="p-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-gray-800">Edit Zone Settings</h4>
                      <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                      </button>
                    </div>
                    <ZoneForm form={form} upd={upd} />
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800"
                      >
                        <Save size={14} /> Save Changes
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        {/* Zone Icon or Account Avatar */}
                        {account?.photo ? (
                          <div className={`w-12 h-12 rounded-2xl overflow-hidden shrink-0 border ${
                            isTrainee ? 'bg-emerald-100 border-emerald-200' : isInstructor ? 'bg-purple-100 border-purple-200' : 'bg-amber-100 border-amber-200'
                          }`}>
                            <img
                              src={getPhotoUrl(account.photo)}
                              alt=""
                              className="w-full h-full object-cover"
                              style={{ transform: 'scaleX(-1)' }}
                            />
                          </div>
                        ) : (
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                              isTrainee
                                ? 'bg-emerald-50 border border-emerald-200'
                                : isInstructor
                                ? 'bg-purple-50 border border-purple-200'
                                : isHTE
                                ? 'bg-amber-50 border border-amber-200'
                                : 'bg-blue-50 border border-blue-200'
                            }`}
                          >
                            {isTrainee ? (
                              <User size={20} className="text-emerald-600" />
                            ) : isInstructor ? (
                              <ShieldCheck size={20} className="text-purple-600" />
                            ) : isHTE ? (
                              <Building size={20} className="text-amber-600" />
                            ) : (
                              <MapPin size={20} className="text-blue-600" />
                            )}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-gray-800 text-sm hover:text-blue-600 transition-colors">
                              {zone.name}
                            </h4>

                            {isTrainee ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                                <User size={10} /> Trainee Geofence
                              </span>
                            ) : isInstructor ? (
                              <span className="text-[10px] bg-purple-100 text-purple-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 border border-purple-200">
                                <ShieldCheck size={10} /> OJT Instructor Station
                              </span>
                            ) : isHTE ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                                <Building size={10} /> HTE Partner Workplace
                              </span>
                            ) : (
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 border border-blue-200">
                                <GraduationCap size={10} /> Campus Institutional
                              </span>
                            )}

                            {zone.active !== false ? (
                              <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold border border-green-200">
                                <CheckCircle size={10} /> Active
                              </span>
                            ) : (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                                Inactive
                              </span>
                            )}

                            {selectedZoneId === zone.id && (
                              <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                                Focused on Map
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-600 mt-1">{zone.address || 'Designated Establishment Premises'}</p>

                          {/* Account Metadata strip */}
                          {account && (
                            <p className={`text-xs font-medium mt-1 ${isTrainee ? 'text-emerald-700' : isInstructor ? 'text-purple-700' : 'text-amber-700'}`}>
                              {isTrainee ? (
                                <>
                                  Trainee: <span className="font-bold">{account.name}</span> ({account.employeeId || account.email}) • {(account as any).course || account.department || 'BSIS'} • Assigned HTE: <span className="font-semibold">{account.companyName || 'Host Establishment'}</span>
                                </>
                              ) : isInstructor ? (
                                <>
                                  OJT Instructor: <span className="font-bold">{account.name}</span> ({account.employeeId || account.email}) • {account.department || 'College of Computer Studies'}
                                </>
                              ) : (
                                <>
                                  HTE Supervisor: <span className="font-bold">{account.name}</span> ({account.employeeId || account.email}) • {account.companyName || 'Host Training Establishment'}
                                </>
                              )}
                            </p>
                          )}

                          {/* Dedicated Assigned HTE Workplace Card for Trainees */}
                          {isTrainee && account && (
                            <div className="mt-2.5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                  <Building size={16} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md">
                                      Assigned HTE Workplace
                                    </span>
                                    <span className="text-xs font-bold text-gray-900 truncate">
                                      {account.companyName && !account.companyName.toLowerCase().includes('pending')
                                        ? account.companyName
                                        : 'Awaiting HTE Workplace Placement'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-600 mt-1 line-clamp-1">
                                    📍 {zone.address || 'HTE Workplace Premises'}
                                  </p>
                                  {account.supervisorName && (
                                    <p className="text-[10px] text-amber-950 font-medium mt-0.5">
                                      Supervisor: <span className="font-semibold text-gray-800">{account.supervisorName}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssigningHteAccount(account);
                                  setAssigningHteZone(zone);
                                  setHteModalSearch('');
                                }}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto"
                                title="Change assigned HTE workplace"
                              >
                                <Edit2 size={12} />
                                <span>{account.companyName && !account.companyName.toLowerCase().includes('pending') ? 'Change HTE' : 'Assign HTE'}</span>
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-2.5 mt-2 flex-wrap text-xs text-gray-500">
                            <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-md font-medium text-[11px] border border-slate-200">
                              📍 {zone.lat.toFixed(5)}, {zone.lng.toFixed(5)}
                            </span>
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold text-[11px] border border-blue-100">
                              ⭕ {zone.radius}m boundary radius
                            </span>
                            <a
                              href={`https://www.google.com/maps?q=${zone.lat},${zone.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md transition-all"
                            >
                              <ExternalLink size={10} /> Google Maps
                            </a>
                          </div>

                          {/* Owner & AY badges */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {getZoneAcademicYear(zone) ? (
                              <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium border border-blue-100">
                                Academic Year {getZoneAcademicYear(zone)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-100">
                                Global All Cohorts
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 3-Dots Action Menu */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === zone.id ? null : zone.id)}
                          className={`p-2 rounded-xl transition-all cursor-pointer ${
                            openMenuId === zone.id
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                          title="More options"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openMenuId === zone.id && (
                          <div className="absolute right-0 top-10 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 w-60 min-w-max">
                            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Zone Actions</p>
                              <p className="text-xs font-bold text-gray-800 truncate">
                                {zone.name}
                              </p>
                              {account?.name && (
                                <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
                                  {account.name}
                                </p>
                              )}
                            </div>

                            {/* 1. VIEW ZONE */}
                            <button
                              type="button"
                              onClick={() => {
                                handleViewZone(zone);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                            >
                              <Eye size={15} className="text-blue-600 shrink-0" />
                              <div className="text-left">
                                <p className="font-semibold text-xs leading-tight">View Details & Map</p>
                                <p className="text-[10px] text-gray-400">Inspect boundary & GPS</p>
                              </div>
                            </button>

                            {/* CHANGE ASSIGNED HTE WORKPLACE (For Trainees) */}
                            {isTrainee && account && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningHteAccount(account);
                                  setAssigningHteZone(zone);
                                  setHteModalSearch('');
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-amber-800 hover:bg-amber-50 hover:text-amber-900 transition-colors cursor-pointer"
                              >
                                <Building size={15} className="text-amber-600 shrink-0" />
                                <div className="text-left">
                                  <p className="font-semibold text-xs leading-tight">Change HTE Workplace</p>
                                  <p className="text-[10px] text-gray-400">Directly sync host geofence</p>
                                </div>
                              </button>
                            )}

                            {/* 2. EDIT ZONE */}
                            <button
                              type="button"
                              onClick={() => {
                                handleEdit(zone);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                            >
                              <Edit2 size={15} className="text-amber-600 shrink-0" />
                              <div className="text-left">
                                <p className="font-semibold text-xs leading-tight">Edit Zone</p>
                                <p className="text-[10px] text-gray-400">Modify radius, name, address</p>
                              </div>
                            </button>

                            {/* 3. DRAG PIN ON MAP */}
                            <button
                              type="button"
                              onClick={() => {
                                handleStartDrag(zone);
                                setOpenMenuId(null);
                              }}
                              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors cursor-pointer ${
                                dragZoneId === zone.id
                                  ? 'bg-purple-100 text-purple-800 font-bold'
                                  : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                              }`}
                            >
                              <Move size={15} className="text-purple-600 shrink-0" />
                              <div className="text-left">
                                <p className="font-semibold text-xs leading-tight">
                                  {dragZoneId === zone.id ? 'Dragging Active (Reposition)' : 'Drag Pin on Map'}
                                </p>
                                <p className="text-[10px] text-gray-400">Move marker interactively</p>
                              </div>
                            </button>

                            {/* 4. SAVE ZONE / POSITION */}
                            <button
                              type="button"
                              onClick={() => {
                                handleDirectSave(zone);
                                setOpenMenuId(null);
                              }}
                              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors cursor-pointer ${
                                dragZoneId === zone.id || editId === zone.id
                                  ? 'bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100'
                                  : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              <Save size={15} className="text-emerald-600 shrink-0" />
                              <div className="text-left">
                                <p className="font-semibold text-xs leading-tight">
                                  {dragZoneId === zone.id
                                    ? 'Save Dragged Position'
                                    : editId === zone.id
                                    ? 'Save Form Changes'
                                    : 'Save & Sync Zone'}
                                </p>
                                <p className="text-[10px] text-gray-400">Commit to cloud database</p>
                              </div>
                            </button>

                            <div className="my-1 border-t border-gray-100" />

                            {/* TOGGLE ACTIVE */}
                            <button
                              type="button"
                              onClick={() => {
                                handleToggle(zone);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              {zone.active ? <ToggleRight size={15} className="text-blue-500" /> : <ToggleLeft size={15} />}
                              <span>{zone.active ? 'Deactivate Zone' : 'Activate Zone'}</span>
                            </button>

                            {/* DELETE ZONE */}
                            <button
                              type="button"
                              onClick={() => {
                                handleDelete(zone.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                              <span>Delete Zone</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Controls (5 accounts per row/page) */}
      {filteredZones.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-gray-100 shadow-sm mt-3">
          <div className="text-xs text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
            <span className="font-bold text-gray-800">
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredZones.length)}
            </span>{' '}
            of <span className="font-bold text-gray-800">{filteredZones.length}</span> geofence zones (5 per page)
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[32px] h-8 px-2.5 rounded-xl text-xs font-bold transition-all ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Zone Modal Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Add Geofence Zone</h3>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5">
                <ZoneForm form={form} upd={upd} />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAdd}
                    className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800"
                  >
                    Add Zone
                  </button>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Zone Details Modal */}
      <AnimatePresence>
        {viewModalZone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={(e) => e.target === e.currentTarget && setViewModalZone(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      isTraineeZone(viewModalZone)
                        ? 'bg-emerald-100 text-emerald-700'
                        : isInstructorZone(viewModalZone)
                        ? 'bg-purple-100 text-purple-700'
                        : isHTEZone(viewModalZone)
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {isTraineeZone(viewModalZone) ? (
                      <User size={20} />
                    ) : isInstructorZone(viewModalZone) ? (
                      <ShieldCheck size={20} />
                    ) : isHTEZone(viewModalZone) ? (
                      <Building size={20} />
                    ) : (
                      <MapPin size={20} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{viewModalZone.name}</h3>
                    <p className="text-xs text-gray-500">
                      {isTraineeZone(viewModalZone)
                        ? 'Trainee Official Registered Geofence'
                        : isInstructorZone(viewModalZone)
                        ? 'OJT Instructor Station'
                        : isHTEZone(viewModalZone)
                        ? 'HTE Partner Workplace'
                        : 'Campus Institutional Zone'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewModalZone(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4">
                {/* Associated Account Profile Card */}
                {(() => {
                  const account = getAccountForZone(viewModalZone);
                  if (!account) return null;
                  return (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3.5">
                      {account.photo ? (
                        <img
                          src={getPhotoUrl(account.photo)}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border border-slate-300"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                          <User size={22} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{account.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {account.employeeId || account.email} • {account.position || 'Supervisor'}
                        </p>
                        <p className="text-[11px] text-blue-600 font-semibold truncate mt-0.5">
                          {account.companyName || account.department || 'CHMSU Partner'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Status & Boundary Specs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100">
                    <p className="text-[10px] uppercase tracking-wider font-extrabold text-blue-700">Perimeter Radius</p>
                    <p className="text-lg font-black text-blue-900 mt-0.5">{viewModalZone.radius} meters</p>
                    <p className="text-[10px] text-blue-600 mt-1">Allowed punch perimeter</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] uppercase tracking-wider font-extrabold text-gray-500">Zone Status</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${viewModalZone.active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <p className="text-sm font-bold text-gray-800">
                        {viewModalZone.active !== false ? 'Active & Monitored' : 'Inactive'}
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">DTR verification status</p>
                  </div>
                </div>

                {/* GPS Coordinates with Copy Button */}
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-700">Precise GPS Coordinates</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${viewModalZone.lat.toFixed(5)}, ${viewModalZone.lng.toFixed(5)}`);
                        setCopiedCoord(true);
                        setTimeout(() => setCopiedCoord(false), 2000);
                        toast.success('Coordinates copied to clipboard!');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      {copiedCoord ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copiedCoord ? 'Copied!' : 'Copy GPS'}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-gray-800 bg-white p-2 rounded-xl border border-gray-200">
                    Latitude: <strong>{viewModalZone.lat.toFixed(5)}</strong>, Longitude: <strong>{viewModalZone.lng.toFixed(5)}</strong>
                  </p>
                </div>

                {/* Address & Google Maps */}
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
                  <span className="text-xs font-bold text-gray-700 block">Registered Workplace Address</span>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {viewModalZone.address || 'Official Designated Establishment Workplace'}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${viewModalZone.lat},${viewModalZone.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <ExternalLink size={12} /> Open in Google Maps
                  </a>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewModalZone;
                      setViewModalZone(null);
                      handleStartDrag(target);
                    }}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Move size={14} /> Drag Pin on Map
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const target = viewModalZone;
                      setViewModalZone(null);
                      handleEdit(target);
                    }}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Edit2 size={14} /> Edit Zone
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewModalZone(null)}
                  className="px-4 py-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* DIRECT HTE WORKPLACE ASSIGNMENT & SYNC MODAL */}
        {assigningHteAccount && (
          <motion.div
            key="assign-hte-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => {
              setAssigningHteAccount(null);
              setAssigningHteZone(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-gray-100 overflow-hidden my-8"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 p-5 text-white flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                    <Building size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Direct HTE Workplace Sync</h3>
                    <p className="text-xs text-amber-100/90 mt-0.5">
                      Assign Host Training Establishment for <span className="font-semibold underline decoration-white/40">{assigningHteAccount.name}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAssigningHteAccount(null);
                    setAssigningHteZone(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Trainee Info & Search */}
              <div className="p-5 space-y-4">
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                      Current Placement
                    </span>
                    <p className="font-bold text-gray-900 mt-1 text-sm">
                      {assigningHteAccount.companyName && !assigningHteAccount.companyName.toLowerCase().includes('pending')
                        ? assigningHteAccount.companyName
                        : 'Unassigned / Pending Placement'}
                    </p>
                    <p className="text-gray-500 text-[11px] mt-0.5">
                      {assigningHteAccount.companyAddress || assigningHteAccount.registrationAddress || 'No workplace address on record'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-gray-500">
                      ID: {assigningHteAccount.studentId || assigningHteAccount.employeeId || assigningHteAccount.id}
                    </span>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={hteModalSearch}
                    onChange={(e) => setHteModalSearch(e.target.value)}
                    placeholder="Search HTE establishment by name, company, or address..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                  {hteModalSearch && (
                    <button
                      type="button"
                      onClick={() => setHteModalSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* HTE Options List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {allHteOptions
                    .filter((hte) => {
                      if (!hteModalSearch.trim()) return true;
                      const q = hteModalSearch.toLowerCase();
                      return (
                        hte.companyName.toLowerCase().includes(q) ||
                        hte.name.toLowerCase().includes(q) ||
                        hte.companyAddress.toLowerCase().includes(q)
                      );
                    })
                    .map((hte) => {
                      const isCurrent =
                        assigningHteAccount.companyName?.trim().toLowerCase() === hte.companyName.trim().toLowerCase();

                      return (
                        <div
                          key={hte.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-500/20'
                              : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/30'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900 truncate">
                                {hte.companyName}
                              </span>
                              {isCurrent && (
                                <span className="bg-amber-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                                  Current HTE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 flex items-center gap-1.5">
                              <Building size={12} className="text-gray-400 shrink-0" />
                              <span>Supervisor: <strong>{hte.name}</strong></span>
                            </p>
                            <p className="text-[11px] text-gray-500 truncate flex items-center gap-1.5">
                              <MapPin size={12} className="text-gray-400 shrink-0" />
                              <span>{hte.companyAddress}</span>
                            </p>
                            <div className="flex items-center gap-2 pt-0.5 text-[10px] text-gray-500">
                              <span className="bg-slate-100 font-mono text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                📍 {hte.lat.toFixed(5)}, {hte.lng.toFixed(5)}
                              </span>
                              <span className="bg-blue-50 font-bold text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                {hte.radius}m radius
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAssignHte(assigningHteAccount, hte)}
                            disabled={isCurrent}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-100 text-amber-800 cursor-not-allowed border border-amber-200 opacity-80'
                                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm hover:shadow active:scale-95'
                            }`}
                          >
                            <CheckCircle size={14} />
                            <span>{isCurrent ? 'Assigned' : 'Select & Sync'}</span>
                          </button>
                        </div>
                      );
                    })}

                  {allHteOptions.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-xs">
                      No Host Training Establishments (HTEs) found. Please register an HTE supervisor first.
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
                  <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Direct Geofence Synchronization:</strong> Selecting an HTE workplace immediately updates the trainee's profile in Supabase cloud database, re-aligns their attendance station geofence boundary coordinates, and automatically centers the map.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAssigningHteAccount(null);
                    setAssigningHteZone(null);
                  }}
                  className="px-4 py-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function ZoneForm({ form, upd }: { form: typeof BLANK_ZONE; upd: (f: string, v: string | number | boolean) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Zone Name *</label>
        <input
          value={form.name}
          onChange={(e) => upd('name', e.target.value)}
          placeholder="e.g. Main Office / Establishment Premises"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Address</label>
        <input
          value={form.address}
          onChange={(e) => upd('address', e.target.value)}
          placeholder="Street, City, Province"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Latitude *</label>
          <input
            type="number"
            step="0.0001"
            value={form.lat}
            onChange={(e) => upd('lat', parseFloat(e.target.value))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Longitude *</label>
          <input
            type="number"
            step="0.0001"
            value={form.lng}
            onChange={(e) => upd('lng', parseFloat(e.target.value))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        </div>
      </div>
      <div className="space-y-2 p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-800">
            Geofence Boundary Radius: <span className="text-blue-700 font-mono">{form.radius || 40} meters</span>
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={40}
              max={1000}
              value={form.radius || 40}
              onChange={(e) => upd('radius', Math.max(40, parseInt(e.target.value) || 40))}
              className="w-16 px-2 py-1 bg-white border border-gray-300 rounded-lg text-center font-bold text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-xs text-gray-500 font-bold">m</span>
          </div>
        </div>

        <input
          type="range"
          min={40}
          max={500}
          step={5}
          value={form.radius || 40}
          onChange={(e) => upd('radius', Math.max(40, parseInt(e.target.value) || 40))}
          className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
        />

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[40, 50, 75, 100, 150, 200, 300].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => upd('radius', preset)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                (form.radius || 40) === preset
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {preset}m {preset === 40 ? '(Minimum / Standard)' : ''}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          Minimum allowed workplace perimeter is 40 meters. You can adjust this according to the size of the establishment facility. Updates reflect live on the map and for trainee attendance.
        </p>
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
        <span className="text-sm font-medium text-gray-700">Active Monitoring Zone</span>
        <button onClick={() => upd('active', !form.active)} className="relative">
          {form.active ? (
            <ToggleRight size={28} className="text-blue-600" />
          ) : (
            <ToggleLeft size={28} className="text-gray-400" />
          )}
        </button>
      </div>

      <div className="bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700">
        <p className="font-semibold mb-1">💡 Tip: Pick Coordinates from Map</p>
        <p>You can click directly on the map above to instantly drop a pin and set the latitude and longitude.</p>
      </div>
    </div>
  );
}
