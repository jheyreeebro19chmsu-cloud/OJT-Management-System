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
import { getPhotoUrl } from '../../services/config';

const BLANK_ZONE = {
  name: '',
  address: '',
  lat: 10.7410,
  lng: 122.9702,
  radius: GEOFENCE_RADIUS_METERS,
  active: true,
};

type ZoneTypeFilter = 'all' | 'instructor' | 'hte' | 'institutional';

export function AdminGeofence() {
  const { currentUser, geofenceZones, addGeofenceZone, updateGeofenceZone, deleteGeofenceZone, employees, updateEmployee, settings } = useApp();
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

  // View Zone Modal State
  const [viewModalZone, setViewModalZone] = useState<GeofenceZone | null>(null);

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

  // Combine explicit geofenceZones with instructor/HTE registered stations (strictly excluding all Trainees)
  const allCombinedZones = useMemo<GeofenceZone[]>(() => {
    const zoneMap = new Map<string, GeofenceZone>();

    // Set of all known trainee identities to strictly block from geofencing
    const traineeIdentities = new Set<string>();
    employees.forEach((e) => {
      if (isTraineeAccount(e)) {
        if (e.id) traineeIdentities.add(e.id.toLowerCase());
        if (e.employeeId) traineeIdentities.add(e.employeeId.toLowerCase());
        if (e.name) traineeIdentities.add(e.name.toLowerCase().trim());
      }
    });

    const isTraineeZone = (z: GeofenceZone): boolean => {
      const zId = (z.id || '').toLowerCase();
      const zName = (z.name || '').toLowerCase();
      if (zId.startsWith('personal-')) return true;
      if (zName.includes('trainee') || zName.includes('student') || zName.includes('intern')) return true;

      const acc = getAccountForZone(z);
      if (acc && isTraineeAccount(acc)) return true;

      const prefix = (z.name?.includes(' - ') ? z.name.split(' - ')[0].trim() : z.name || '').toLowerCase();
      if (prefix && traineeIdentities.has(prefix)) {
        if (!acc || isTraineeAccount(acc)) return true;
      }
      return false;
    };

    // 1. Process explicit geofence zones from DB/Storage, strictly filtering out any personal trainee zones
    geofenceZones
      .filter(
        (z) =>
          !z.name.toLowerCase().includes('main training center') &&
          z.id !== 'zone-1' &&
          !z.id.startsWith('personal-') &&
          !z.name.toLowerCase().includes('rainer') &&
          !z.name.toLowerCase().includes('dooms') &&
          !isTraineeZone(z)
      )
      .forEach((z) => {
        const account = getAccountForZone(z);
        if (account && isTraineeAccount(account)) return;
        const normPerson = account ? normalizeName(account.name) : normalizeName(z.name.split(' - ')[0] || z.name);
        const personKey = normPerson ? `acc-${normPerson}` : `zone-${z.lat.toFixed(3)},${z.lng.toFixed(3)}`;

        if (!zoneMap.has(personKey)) {
          zoneMap.set(personKey, { ...z, active: z.active !== false });
        } else {
          const existing = zoneMap.get(personKey)!;
          if ((!existing.address || existing.address === 'Official Workplace GPS') && z.address) {
            zoneMap.set(personKey, { ...z, active: z.active !== false });
          }
        }
      });

    // 2. Include registered Instructors and HTEs with GPS coordinates (strictly excluding Trainees)
    employees.forEach((emp: Employee) => {
      if (isTraineeAccount(emp)) return; // Strictly ignore any Trainee account
      if (emp.name?.toLowerCase().includes('rainer') || emp.companyName?.toLowerCase().includes('dooms')) return;
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
      if (!isInst && !isHte) return;

      const regLat = emp.registrationLocation?.lat ?? (emp as any)?.registration_lat;
      const regLng = emp.registrationLocation?.lng ?? (emp as any)?.registration_lng;
      if (regLat && regLng && Number.isFinite(Number(regLat)) && Number.isFinite(Number(regLng))) {
        const normEmp = normalizeName(emp.name);
        const personKey = `acc-${normEmp}`;
        if (!zoneMap.has(personKey)) {
          const defaultName = isInst ? `${emp.name} - Official Station` : `${emp.name} - ${emp.companyName || 'HTE Workplace'}`;
          zoneMap.set(personKey, {
            id: `station-${emp.id}`,
            name: defaultName,
            address: emp.registrationAddress || emp.companyAddress || (isInst ? 'Official Campus Station GPS' : 'HTE Workplace GPS'),
            lat: Number(regLat),
            lng: Number(regLng),
            radius: 100,
            active: true,
            academicYear: emp.academicYear || settings.activeAcademicYear,
          });
        }
      }
    });

    return Array.from(zoneMap.values());
  }, [geofenceZones, employees, settings.activeAcademicYear]);

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

  const filteredZones = useMemo(() => {
    return allCombinedZones.filter((zone) => {
      // Strictly exclude any trainee account
      const account = getAccountForZone(zone);
      if (account && isTraineeAccount(account)) return false;

      // Academic year filter
      if (selectedAcademicYear !== 'all') {
        const zoneAY = getZoneAcademicYear(zone);
        if (zoneAY && zoneAY !== selectedAcademicYear) return false;
      }

      // Zone category filter
      if (zoneTypeFilter === 'instructor' && !isInstructorZone(zone)) return false;
      if (zoneTypeFilter === 'hte' && !isHTEZone(zone)) return false;
      if (zoneTypeFilter === 'institutional' && (isInstructorZone(zone) || isHTEZone(zone))) return false;

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
          (account.position || '').toLowerCase().includes(q)
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

    if (account) {
      updateEmployee(account.id, {
        registrationLocation: {
          lat: Number(updatedData.lat ?? matchedZone?.lat),
          lng: Number(updatedData.lng ?? matchedZone?.lng),
        },
        registrationAddress: updatedData.address || matchedZone?.address,
      });
    }

    const existsInZones = geofenceZones.some((z) => z.id === zoneId);
    if (existsInZones) {
      updateGeofenceZone(zoneId, updatedData);
    } else {
      addGeofenceZone({
        id: zoneId,
        name: updatedData.name || matchedZone?.name || 'Geofence Zone',
        address: updatedData.address || matchedZone?.address || 'Official Workplace GPS',
        lat: Number(updatedData.lat ?? matchedZone?.lat ?? 10.741),
        lng: Number(updatedData.lng ?? matchedZone?.lng ?? 122.9702),
        radius: Number(updatedData.radius ?? matchedZone?.radius ?? GEOFENCE_RADIUS_METERS),
        active: updatedData.active ?? matchedZone?.active ?? true,
        academicYear: selectedAcademicYear !== 'all' ? selectedAcademicYear : settings.activeAcademicYear,
      });
    }
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
    setSelectedZoneId(zone.id);
    setFocusCoords({ lat: zone.lat, lng: zone.lng });
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
    setSelectedZoneId(zone.id);
    setFocusCoords({ lat: zone.lat, lng: zone.lng });
    const mapCard = document.getElementById('geofence-map-card');
    if (mapCard) {
      mapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
    setSelectedZoneId(zone.id);
    setFocusCoords({ lat: zone.lat, lng: zone.lng });
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
  const totalInstructorZones = allCombinedZones.filter((z) => isInstructorZone(z)).length;
  const totalHTEZones = allCombinedZones.filter((z) => isHTEZone(z)).length;
  const totalInstitutional = allCombinedZones.filter((z) => !isInstructorZone(z) && !isHTEZone(z)).length;

  // Currently dragged zone
  const draggedZone = useMemo(() => {
    if (!dragZoneId) return null;
    return allCombinedZones.find((z) => z.id === dragZoneId) || null;
  }, [dragZoneId, allCombinedZones]);

  // Display zones list with live drag coordinates overridden
  const displayZones = useMemo(() => {
    if (!dragZoneId || !dragCoords) return filteredZones;
    return filteredZones.map((z) => {
      if (z.id === dragZoneId) {
        return {
          ...z,
          lat: dragCoords.lat,
          lng: dragCoords.lng,
        };
      }
      return z;
    });
  }, [filteredZones, dragZoneId, dragCoords]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Geofence Location Monitoring</h2>
          <p className="text-sm text-gray-500">
            Monitor OJT instructor stations, HTE partner workplaces, and campus boundaries for attendance verification.
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Total Active Zones</p>
            <p className="text-xl font-black text-gray-900">{totalActive}</p>
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
            <p className="text-xs font-semibold text-gray-500">Campus Institutional</p>
            <p className="text-xl font-black text-sky-700">{totalInstitutional}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => setZoneTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              zoneTypeFilter === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            All Zones ({allCombinedZones.length})
          </button>
          <button
            onClick={() => setZoneTypeFilter('instructor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              zoneTypeFilter === 'instructor'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            OJT Instructors ({totalInstructorZones})
          </button>
          <button
            onClick={() => setZoneTypeFilter('hte')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              zoneTypeFilter === 'hte'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            HTE Workplaces ({totalHTEZones})
          </button>
          <button
            onClick={() => setZoneTypeFilter('institutional')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

            return (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => {
                  if (editId !== zone.id) {
                    setSelectedZoneId(zone.id);
                    setFocusCoords({ lat: Number(zone.lat), lng: Number(zone.lng) });
                  }
                }}
                className={`bg-white rounded-2xl shadow-sm border transition-all cursor-pointer hover:shadow-md ${
                  selectedZoneId === zone.id
                    ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20'
                    : isInstructor
                    ? 'border-purple-100 hover:border-purple-300'
                    : isHTE
                    ? 'border-amber-100 hover:border-amber-300'
                    : 'border-gray-100 hover:border-blue-300'
                } overflow-hidden`}
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
                            isInstructor ? 'bg-purple-100 border-purple-200' : 'bg-amber-100 border-amber-200'
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
                              isInstructor
                                ? 'bg-purple-50 border border-purple-200'
                                : isHTE
                                ? 'bg-amber-50 border border-amber-200'
                                : 'bg-blue-50 border border-blue-200'
                            }`}
                          >
                            {isInstructor ? (
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

                            {isInstructor ? (
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
                            <p className={`text-xs font-medium mt-1 ${isInstructor ? 'text-purple-700' : 'text-amber-700'}`}>
                              {isInstructor ? (
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
                      isInstructorZone(viewModalZone)
                        ? 'bg-purple-100 text-purple-700'
                        : isHTEZone(viewModalZone)
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {isInstructorZone(viewModalZone) ? (
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
                      {isInstructorZone(viewModalZone)
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
            Geofence Boundary Radius: <span className="text-blue-700 font-mono">{form.radius || 100} meters</span>
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={10}
              max={1000}
              value={form.radius || 100}
              onChange={(e) => upd('radius', Math.max(10, parseInt(e.target.value) || 100))}
              className="w-16 px-2 py-1 bg-white border border-gray-300 rounded-lg text-center font-bold text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-xs text-gray-500 font-bold">m</span>
          </div>
        </div>

        <input
          type="range"
          min={30}
          max={500}
          step={10}
          value={form.radius || 100}
          onChange={(e) => upd('radius', parseInt(e.target.value) || 100)}
          className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
        />

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[50, 75, 100, 150, 200, 250, 300].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => upd('radius', preset)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                (form.radius || 100) === preset
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {preset}m {preset === 100 ? '(Standard)' : ''}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          Standard workplace radius is 100 meters. Adjust this according to the size of the establishment facility.
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
