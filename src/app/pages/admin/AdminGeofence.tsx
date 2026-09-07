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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useMemo } from 'react';
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

type ZoneTypeFilter = 'all' | 'trainee' | 'instructor' | 'institutional';

export function AdminGeofence() {
  const { geofenceZones, addGeofenceZone, updateGeofenceZone, deleteGeofenceZone, employees, settings } = useApp();
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(settings?.activeAcademicYear || 'all');
  const [zoneTypeFilter, setZoneTypeFilter] = useState<ZoneTypeFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(BLANK_ZONE);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const normalizeName = (str: string): string => {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .sort()
      .join(' ');
  };

  const getTraineeForZone = (zone: any): Employee | null => {
    if (!zone) return null;
    if (zone.id?.startsWith('personal-')) {
      const empId = zone.id.replace('personal-', '');
      const found = employees.find((e) => e.id === empId || e.employeeId === empId);
      if (found) return found;
    }
    const directEmp = employees.find((e) => e.id === zone.id || e.employeeId === zone.id);
    if (directEmp) return directEmp;

    const personPrefix = zone.name?.includes(' - ') ? zone.name.split(' - ')[0].trim() : zone.name;
    const normZonePrefix = normalizeName(personPrefix);

    const matchByName = employees.find((e) => {
      if (!e.name) return false;
      const normEmp = normalizeName(e.name);
      if (normEmp === normZonePrefix) return true;
      if (normEmp && normZonePrefix && (normEmp.includes(normZonePrefix) || normZonePrefix.includes(normEmp))) return true;
      return false;
    });
    if (matchByName) return matchByName;

    return null;
  };

  // Combine explicit geofenceZones with any accounts who registered GPS locations with strict 1-account-1-zone deduplication
  const allCombinedZones = useMemo<GeofenceZone[]>(() => {
    const zoneMap = new Map<string, GeofenceZone>();

    // 1. Process explicit geofence zones from DB/Storage
    geofenceZones
      .filter((z) => !z.name.toLowerCase().includes('main training center') && z.id !== 'zone-1')
      .forEach((z) => {
        const account = getTraineeForZone(z);
        const normPerson = account ? normalizeName(account.name) : normalizeName(z.name.split(' - ')[0] || z.name);
        const personKey = normPerson ? `acc-${normPerson}` : `zone-${z.lat.toFixed(3)},${z.lng.toFixed(3)}`;

        if (!zoneMap.has(personKey)) {
          zoneMap.set(personKey, { ...z, active: z.active !== false });
        } else {
          // If already exists, keep the one that has valid address or personal- ID
          const existing = zoneMap.get(personKey)!;
          if ((!existing.address || existing.address === 'Official Workplace GPS') && z.address) {
            zoneMap.set(personKey, { ...z, active: z.active !== false });
          }
        }
      });

    // 2. Include registered employees who have GPS coordinates if not already represented
    employees.forEach((emp: Employee) => {
      const regLat = emp.registrationLocation?.lat ?? (emp as any)?.registration_lat;
      const regLng = emp.registrationLocation?.lng ?? (emp as any)?.registration_lng;
      if (regLat && regLng && Number.isFinite(Number(regLat)) && Number.isFinite(Number(regLng))) {
        const normEmp = normalizeName(emp.name);
        const personKey = `acc-${normEmp}`;
        if (!zoneMap.has(personKey)) {
          const isInst = emp.position === 'OJT Instructor' || (emp.employeeId && emp.employeeId.startsWith('ADM-'));
          const defaultName = isInst ? `${emp.name} - Official Station` : `${emp.name} - ${emp.companyName || 'Assigned Workplace'}`;
          zoneMap.set(personKey, {
            id: `personal-${emp.id}`,
            name: defaultName,
            address: emp.registrationAddress || emp.companyAddress || 'Official Workplace GPS',
            lat: Number(regLat),
            lng: Number(regLng),
            radius: 150,
            active: true,
            academicYear: emp.academicYear || settings.activeAcademicYear,
          });
        }
      }
    });

    return Array.from(zoneMap.values());
  }, [geofenceZones, employees, settings.activeAcademicYear]);

  const isInstructorZone = (zone: any): boolean => {
    const acc = getTraineeForZone(zone);
    return Boolean(
      acc?.position === 'OJT Instructor' ||
      (acc?.employeeId && acc.employeeId.startsWith('ADM-')) ||
      (acc?.id && acc.id.startsWith('adm')) ||
      zone.name?.toLowerCase().includes('instructor')
    );
  };

  const isHTEZone = (zone: any): boolean => {
    const acc = getTraineeForZone(zone);
    return Boolean(
      acc?.position === 'HTE Representative' ||
      (acc?.employeeId && acc.employeeId.startsWith('HTE-'))
    );
  };

  const isTraineeZone = (zone: any): boolean => {
    if (isInstructorZone(zone) || isHTEZone(zone)) return false;
    return Boolean(zone.id?.startsWith('personal-') || getTraineeForZone(zone) || zone.name?.includes(' - '));
  };

  const getZoneAcademicYear = (zone: any): string | null => {
    if (zone.academicYear) return zone.academicYear;
    const trainee = getTraineeForZone(zone);
    return trainee?.academicYear || null;
  };

  const filteredZones = useMemo(() => {
    return allCombinedZones.filter((zone) => {
      // Academic year filter
      if (selectedAcademicYear !== 'all') {
        const zoneAY = getZoneAcademicYear(zone);
        if (zoneAY && zoneAY !== selectedAcademicYear) return false;
      }

      // Zone category filter
      if (zoneTypeFilter === 'instructor' && !isInstructorZone(zone)) return false;
      if (zoneTypeFilter === 'trainee' && !isTraineeZone(zone)) return false;
      if (zoneTypeFilter === 'institutional' && (isInstructorZone(zone) || isTraineeZone(zone) || isHTEZone(zone))) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const account = getTraineeForZone(zone);
        const matchName = zone.name.toLowerCase().includes(q);
        const matchAddress = (zone.address || '').toLowerCase().includes(q);
        const matchAccount = account && (
          account.name.toLowerCase().includes(q) ||
          (account.employeeId || '').toLowerCase().includes(q) ||
          (account.companyName || '').toLowerCase().includes(q) ||
          (account.course || '').toLowerCase().includes(q) ||
          (account.position || '').toLowerCase().includes(q)
        );
        if (!matchName && !matchAddress && !matchAccount) return false;
      }

      return true;
    });
  }, [allCombinedZones, selectedAcademicYear, zoneTypeFilter, searchQuery, employees]);

  const upd = (f: string, v: string | number | boolean) => setForm((p) => ({ ...p, [f]: v }));

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
  };

  const handleSaveEdit = () => {
    if (editId) {
      updateGeofenceZone(editId, form);
      setEditId(null);
      toast.success('Geofence zone updated successfully!');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this geofence zone?')) {
      deleteGeofenceZone(id);
      toast.success('Geofence zone removed.');
    }
  };

  const handleToggle = (zone: GeofenceZone) => {
    updateGeofenceZone(zone.id, { active: !zone.active });
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
  const totalTraineeZones = allCombinedZones.filter((z) => isTraineeZone(z)).length;
  const totalInstitutional = allCombinedZones.filter((z) => !isTraineeZone(z) && !isInstructorZone(z) && !isHTEZone(z)).length;

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Geofence Location Monitoring</h2>
          <p className="text-sm text-gray-500">
            Monitor OJT instructor stations, trainee workplaces, and campus boundaries for attendance verification.
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

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Building size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Trainee Workplaces</p>
            <p className="text-xl font-black text-emerald-700">{totalTraineeZones}</p>
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
            onClick={() => setZoneTypeFilter('trainee')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              zoneTypeFilter === 'trainee'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Trainee Workplaces ({totalTraineeZones})
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
            placeholder="Search trainee, establishment, or zone..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Map Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-blue-600" />
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Interactive Geofence Map (Leaflet)</h3>
              <p className="text-xs text-gray-500">Live visualization of all OJT workplace boundaries and campus pins</p>
            </div>
          </div>
          {selectedZoneId && (
            <button
              onClick={() => {
                setSelectedZoneId(null);
                setFocusCoords(undefined);
              }}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              Reset View
            </button>
          )}
        </div>
        {invalidZones.length > 0 && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Warning:</span> {invalidZones.length} zone
            {invalidZones.length > 1 ? 's' : ''} with invalid coordinates skipped on map.
          </div>
        )}
        <GeofenceMap
          zones={filteredZones}
          picking={Boolean(showAdd || editId)}
          pickedCoords={showAdd || editId ? { lat: Number(form.lat), lng: Number(form.lng) } : undefined}
          focusCoords={focusCoords}
          className="h-80"
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
              When trainees register with GPS, their OJT workplace geofences will automatically appear here.
            </p>
          </div>
        ) : (
          filteredZones.map((zone, idx) => {
            const account = getTraineeForZone(zone);
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
                    : isTrainee
                    ? 'border-emerald-100 hover:border-emerald-300'
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
                            isInstructor ? 'bg-purple-100 border-purple-200' : isHTE ? 'bg-amber-100 border-amber-200' : 'bg-emerald-100 border-emerald-200'
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
                                : isTrainee
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-blue-50 border border-blue-200'
                            }`}
                          >
                            {isInstructor ? (
                              <ShieldCheck size={20} className="text-purple-600" />
                            ) : isHTE ? (
                              <Building size={20} className="text-amber-600" />
                            ) : isTrainee ? (
                              <Building size={20} className="text-emerald-600" />
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
                                <ShieldCheck size={10} /> OJT Instructor Workplace
                              </span>
                            ) : isHTE ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                                <Building size={10} /> HTE Partner Workplace
                              </span>
                            ) : isTrainee ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                                <Building size={10} /> Trainee OJT Workplace
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
                            <p className={`text-xs font-medium mt-1 ${isInstructor ? 'text-purple-700' : isHTE ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {isInstructor ? (
                                <>
                                  OJT Instructor: <span className="font-bold">{account.name}</span> ({account.employeeId || account.email}) • {account.department || 'College of Computer Studies'}
                                </>
                              ) : isHTE ? (
                                <>
                                  HTE Supervisor: <span className="font-bold">{account.name}</span> ({account.employeeId || account.email}) • {account.companyName || 'Host Training Establishment'}
                                </>
                              ) : (
                                <>
                                  Trainee: <span className="font-bold">{account.name}</span> ({account.employeeId || account.email}) • {account.course || 'OJT Student'}
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
                          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                          title="More options"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openMenuId === zone.id && (
                          <div className="absolute right-0 top-10 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 w-52 min-w-max">
                            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Zone Classification</p>
                              <p className="text-xs font-semibold text-gray-700 truncate">
                                {isInstructor ? `${account?.name} (OJT Instructor)` : isHTE ? `${account?.name} (HTE Supervisor)` : isTrainee ? (account?.name || 'Trainee Workplace') : 'Campus Institutional'}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                handleToggle(zone);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              {zone.active ? <ToggleRight size={15} className="text-blue-500" /> : <ToggleLeft size={15} />}
                              {zone.active ? 'Deactivate Zone' : 'Activate Zone'}
                            </button>

                            <button
                              onClick={() => {
                                handleEdit(zone);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              <Edit2 size={15} /> Edit Zone
                            </button>

                            <button
                              onClick={() => {
                                handleDelete(zone.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={15} /> Delete Zone
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
            Geofence Boundary Radius: <span className="text-blue-700 font-mono">{form.radius || 250} meters</span>
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={10}
              max={1000}
              value={form.radius || 250}
              onChange={(e) => upd('radius', Math.max(10, parseInt(e.target.value) || 250))}
              className="w-16 px-2 py-1 bg-white border border-gray-300 rounded-lg text-center font-bold text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-xs text-gray-500 font-bold">m</span>
          </div>
        </div>

        <input
          type="range"
          min={50}
          max={500}
          step={10}
          value={form.radius || 250}
          onChange={(e) => upd('radius', parseInt(e.target.value) || 250)}
          className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
        />

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[100, 150, 200, 250, 300, 500].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => upd('radius', preset)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                (form.radius || 250) === preset
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {preset}m {preset === 250 ? '(Standard)' : ''}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          Standard workplace radius is 250 meters. Adjust this according to the size of the establishment facility.
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
