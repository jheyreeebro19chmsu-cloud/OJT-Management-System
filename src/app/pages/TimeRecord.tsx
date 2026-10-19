import {
  Clock,
  CheckCircle,
  MapPin,
  Camera,
  AlertCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Compass,
  Lock,
  Sunrise,
  Sunset,
  Sun,
  Utensils,
  CheckCircle2,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { FaceCapture } from '../components/FaceCapture';
import { GeofenceChecker, type GeoState } from '../components/GeofenceChecker';
import {
  fetchSecurityHealth,
  isSecurityApiConfigured,
  type SecurityHealthResponse,
  uploadAttendancePhoto,
} from '../services/securityApi';
import { useApp } from '../store/AppContext';
import { uploadFacePhoto } from '../services/supabaseService';
import {
  formatTime,
  calculateTotalHours,
  calculate4SlotHours,
  getAttendanceStatus,
  getCurrentLocation,
  getDTRSessionDate,
} from '../utils/geo';
import { authAPI } from '../services/authApi';
import type { TimeRecord as TimeRecordType } from '../types';
import { isInvalidHteCompany } from '../utils/hteLocation';

type PageState = 'check-geofence' | 'face-scan' | 'completed' | 'error';

export type AttendanceSlot = 'am_arrival' | 'am_departure' | 'pm_arrival' | 'pm_departure';

interface SlotMeta {
  id: AttendanceSlot;
  label: string;
  shortLabel: string;
  period: 'AM' | 'PM';
  type: 'in' | 'out';
  title: string;
  subtitle: string;
  field: 'amArrival' | 'amDeparture' | 'pmArrival' | 'pmDeparture';
  verifiedField: 'amArrivalFaceVerified' | 'amDepartureFaceVerified' | 'pmArrivalFaceVerified' | 'pmDepartureFaceVerified';
  geofenceField: 'amArrivalGeofenced' | 'amDepartureGeofenced' | 'pmArrivalGeofenced' | 'pmDepartureGeofenced';
}

const ATTENDANCE_SLOTS: SlotMeta[] = [
  {
    id: 'am_arrival',
    label: 'Time In AM',
    shortLabel: 'AM In',
    period: 'AM',
    type: 'in',
    title: 'Time In A.M. (Morning Clock In)',
    subtitle: 'Morning Shift Start',
    field: 'amArrival',
    verifiedField: 'amArrivalFaceVerified',
    geofenceField: 'amArrivalGeofenced',
  },
  {
    id: 'am_departure',
    label: 'Time Out AM',
    shortLabel: 'AM Out',
    period: 'AM',
    type: 'out',
    title: 'Time Out A.M. (Lunch Break Out)',
    subtitle: 'Lunch Break Out',
    field: 'amDeparture',
    verifiedField: 'amDepartureFaceVerified',
    geofenceField: 'amDepartureGeofenced',
  },
  {
    id: 'pm_arrival',
    label: 'Time In PM',
    shortLabel: 'PM In',
    period: 'PM',
    type: 'in',
    title: 'Time In P.M. (Afternoon Clock In)',
    subtitle: 'Afternoon Shift Start',
    field: 'pmArrival',
    verifiedField: 'pmArrivalFaceVerified',
    geofenceField: 'pmArrivalGeofenced',
  },
  {
    id: 'pm_departure',
    label: 'Time Out PM',
    shortLabel: 'PM Out',
    period: 'PM',
    type: 'out',
    title: 'Time Out P.M. (End of Shift Out)',
    subtitle: 'End of Day Out',
    field: 'pmDeparture',
    verifiedField: 'pmDepartureFaceVerified',
    geofenceField: 'pmDepartureGeofenced',
  },
];

export function TimeRecord() {
  const navigate = useNavigate();
  const {
    currentUser,
    getCurrentEmployee,
    getTodayRecord,
    addTimeRecord,
    updateTimeRecord,
    updateEmployee,
    settings,
    timeRecords,
    employees,
  } = useApp();
  const employee = getCurrentEmployee();
  const empLookupId = employee?.id || employee?.employeeId || currentUser?.employeeId || currentUser?.id || '';
  const todayRecord = empLookupId ? getTodayRecord(empLookupId) : null;
  const [pageState, setPageState] = useState<PageState>('check-geofence');
  const [geofencePassed, setGeofencePassed] = useState(false);
  const [geofenceCoords, setGeofenceCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [geofenceStatus, setGeofenceStatus] = useState<GeoState>('checking');
  const [geofenceMessage, setGeofenceMessage] = useState<string>('');

  const [currentRecord, setCurrentRecord] = useState<TimeRecordType | null>(todayRecord);
  const [completedMessage, setCompletedMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [securityHealth, setSecurityHealth] = useState<SecurityHealthResponse | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const userActionOverrideRef = useRef<boolean>(false);

  // Auto-slot selector logic
  const getRecommendedSlot = (rec: TimeRecordType | null, hour: number): AttendanceSlot => {
    if (hour < 12) {
      if (!rec?.amArrival) return 'am_arrival';
      if (!rec?.amDeparture) return 'am_departure';
      if (!rec?.pmArrival) return 'pm_arrival';
      if (!rec?.pmDeparture) return 'pm_departure';
      return 'am_departure';
    } else {
      if (!rec?.pmArrival) return 'pm_arrival';
      if (!rec?.pmDeparture) return 'pm_departure';
      if (!rec?.amArrival) return 'am_arrival';
      if (!rec?.amDeparture) return 'am_departure';
      return 'pm_departure';
    }
  };

  const [selectedSlot, setSelectedSlot] = useState<AttendanceSlot>(() => {
    return getRecommendedSlot(todayRecord, new Date().getHours());
  });
  const [completedSlot, setCompletedSlot] = useState<AttendanceSlot>(selectedSlot);

  const currentSlotConfig = ATTENDANCE_SLOTS.find((s) => s.id === selectedSlot) || ATTENDANCE_SLOTS[0];
  const action: 'in' | 'out' = currentSlotConfig.type;
  const completedSlotConfig = ATTENDANCE_SLOTS.find((s) => s.id === completedSlot) || ATTENDANCE_SLOTS[0];

  // Comprehensive fallback resolution for registered face template
  const registeredPhotoSource =
    employee?.photo ||
    currentUser?.photo ||
    (currentUser as any)?.avatar ||
    employees?.find((e) => e.id === empLookupId || e.employeeId === empLookupId)?.photo;

  // CORS-safe data URL of the registered face image for biometric matching
  const [registeredImageDataUrl, setRegisteredImageDataUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Proactive GPS permission check
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (status.state === 'denied') {
            setGeofenceStatus('denied');
            setGeofenceMessage('GPS location permission denied');
          }
          status.onchange = () => {
            if (status.state === 'denied') {
              setGeofenceStatus('denied');
              setGeofenceMessage('GPS location permission denied');
            } else if (status.state === 'granted') {
              setGeofenceStatus('checking');
            }
          };
        })
        .catch(() => {
          // Permissions API fallback
        });
    }
  }, []);

  // Keep currentRecord synced and auto-select next logical slot unless user clicked a specific one
  useEffect(() => {
    const lookupId = empLookupId || employee?.id || employee?.employeeId || currentUser?.employeeId || currentUser?.id || '';
    if (lookupId) {
      const rec = getTodayRecord(lookupId);
      if (rec) {
        setCurrentRecord(rec);
      }
      if (pageState !== 'completed' && !userActionOverrideRef.current) {
        const effectiveRec = rec || currentRecord;
        setSelectedSlot(getRecommendedSlot(effectiveRec, new Date().getHours()));
      }
    }
  }, [employee, empLookupId, currentUser, timeRecords, pageState]);

  useEffect(() => {
    let mounted = true;
    if (!isSecurityApiConfigured()) {
      setSecurityHealth(null);
      return;
    }
    fetchSecurityHealth()
      .then((h) => {
        if (mounted) setSecurityHealth(h);
      })
      .catch(() => {
        if (mounted) setSecurityHealth(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // CORS-safe prefetch of registered face image
  useEffect(() => {
    const photo = registeredPhotoSource;
    if (!photo) {
      setRegisteredImageDataUrl(undefined);
      return;
    }
    if (photo.startsWith('data:')) {
      setRegisteredImageDataUrl(photo);
      return;
    }
    let cancelled = false;
    fetch(photo)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!cancelled) setRegisteredImageDataUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        if (!cancelled) setRegisteredImageDataUrl(photo);
      });
    return () => {
      cancelled = true;
    };
  }, [registeredPhotoSource]);

  const handleGeofenceResult = React.useCallback(
    (passed: boolean, coords?: { lat: number; lng: number }, state?: GeoState, message?: string) => {
      setGeofencePassed(passed);
      setGeofenceCoords(coords);
      if (state) setGeofenceStatus(state);
      if (message) setGeofenceMessage(message);
    },
    []
  );

  const isStudent =
    !employee?.position?.toLowerCase().includes('instructor') &&
    !employee?.position?.toLowerCase().includes('faculty') &&
    !employee?.position?.toLowerCase().includes('admin') &&
    currentUser?.role !== 'admin';
  const hasValidHte = Boolean(
    employee?.companyName &&
    !isInvalidHteCompany(employee.companyName)
  );

  // Late threshold evaluation
  const [startH, startM] = (settings.workStartTime || '08:00').split(':').map(Number);
  const lateGraceMinutes = Number(settings.lateThresholdMinutes ?? 15);
  const lateCutoffTotalMinutes = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 0 : startM) + lateGraceMinutes;
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const isPastLateThreshold =
    isStudent &&
    selectedSlot === 'am_arrival' &&
    !currentRecord?.amArrival &&
    !currentRecord?.timeIn &&
    currentTotalMinutes > lateCutoffTotalMinutes;

  const cutoffHour = Math.floor(lateCutoffTotalMinutes / 60) % 24;
  const cutoffMin = lateCutoffTotalMinutes % 60;
  const formattedCutoffTime = formatTime(
    `${String(cutoffHour).padStart(2, '0')}:${String(cutoffMin).padStart(2, '0')}`
  );

  const proceedToFaceScan = () => {
    if (isStudent && !hasValidHte) {
      toast.error('Clock-in blocked: You must be assigned to an approved Host Training Establishment (HTE) workplace by your instructor first.');
      return;
    }
    if (!geofencePassed) return;

    if (selectedSlot === 'am_departure' && !currentRecord?.amArrival && !currentRecord?.timeIn) {
      toast.error('No Time In AM recorded yet. It is recommended to record Time In AM first.');
    }

    if (!registeredPhotoSource && !registeredImageDataUrl) {
      toast.error(
        'No registered face biometrics found on your account. Please enroll your face photo in Profile or Registration before recording attendance.'
      );
      return;
    }
    setPageState('face-scan');
  };

  const handleFaceSuccess = async (imageData?: string) => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const currentEmp = employee || (currentUser ? {
        id: currentUser.id,
        employeeId: currentUser.employeeId || currentUser.id,
        name: currentUser.name,
        department: 'College of Computer Studies',
        position: 'OJT Trainee',
      } as any : null);
      if (!currentEmp) return;
      const targetEmpId = currentEmp.id || currentEmp.employeeId || currentUser?.employeeId || currentUser?.id || '';

      const slot = selectedSlot;
      setCompletedSlot(slot);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const dateStr = getDTRSessionDate(now);

      const baseRec = currentRecord;
      const newAmArrival = slot === 'am_arrival' ? timeStr : baseRec?.amArrival;
      const newAmDeparture = slot === 'am_departure' ? timeStr : baseRec?.amDeparture;
      const newPmArrival = slot === 'pm_arrival' ? timeStr : baseRec?.pmArrival;
      const newPmDeparture = slot === 'pm_departure' ? timeStr : baseRec?.pmDeparture;

      // Legacy mirror for backward compatibility
      const primaryTimeIn = newAmArrival || newPmArrival || baseRec?.timeIn || timeStr;
      const primaryTimeOut = newPmDeparture || newAmDeparture || baseRec?.timeOut;

      const totalHours = calculate4SlotHours(
        newAmArrival,
        newAmDeparture,
        newPmArrival,
        newPmDeparture,
        primaryTimeIn,
        primaryTimeOut
      );

      const status = getAttendanceStatus(primaryTimeIn, settings.workStartTime, settings.lateThresholdMinutes, geofencePassed);

      let slotPayload: Partial<TimeRecordType> = {};
      if (slot === 'am_arrival') {
        slotPayload = {
          amArrival: timeStr,
          amArrivalFaceVerified: true,
          amArrivalGeofenced: geofencePassed,
          timeIn: primaryTimeIn,
          timeInFaceVerified: true,
          timeInGeofenced: geofencePassed,
          timeInLocation: geofenceCoords || (currentEmp as any).registrationLocation,
          ...(imageData ? { timeInPhoto: imageData } : {}),
        };
      } else if (slot === 'am_departure') {
        slotPayload = {
          amDeparture: timeStr,
          amDepartureFaceVerified: true,
          amDepartureGeofenced: geofencePassed,
          timeOut: timeStr,
          timeOutFaceVerified: true,
          timeOutGeofenced: geofencePassed,
          timeOutLocation: geofenceCoords || (currentEmp as any).registrationLocation,
          ...(imageData ? { timeOutPhoto: imageData } : {}),
        };
      } else if (slot === 'pm_arrival') {
        slotPayload = {
          pmArrival: timeStr,
          pmArrivalFaceVerified: true,
          pmArrivalGeofenced: geofencePassed,
          timeIn: primaryTimeIn,
          ...(imageData && !baseRec?.timeInPhoto ? { timeInPhoto: imageData } : {}),
        };
      } else if (slot === 'pm_departure') {
        slotPayload = {
          pmDeparture: timeStr,
          pmDepartureFaceVerified: true,
          pmDepartureGeofenced: geofencePassed,
          timeOut: timeStr,
          timeOutFaceVerified: true,
          timeOutGeofenced: geofencePassed,
          timeOutLocation: geofenceCoords || (currentEmp as any).registrationLocation,
          ...(imageData ? { timeOutPhoto: imageData } : {}),
        };
      }

      let createdRecordId: string | null = null;

      if (baseRec?.id) {
        const updatedData: Partial<TimeRecordType> = {
          ...slotPayload,
          totalHours,
          status: baseRec.status === 'present' && totalHours > 9 ? 'overtime' : (baseRec.status || status),
        };
        updateTimeRecord(baseRec.id, updatedData);
        createdRecordId = baseRec.id;
        setCurrentRecord({ ...baseRec, ...updatedData });
      } else {
        const newRecord = addTimeRecord({
          employeeId: targetEmpId,
          date: dateStr,
          ...slotPayload,
          totalHours,
          status,
          timeInGeofenced: geofencePassed,
          timeOutGeofenced: slot.includes('departure') ? geofencePassed : false,
          timeInFaceVerified: true,
          timeOutFaceVerified: slot.includes('departure'),
        });
        createdRecordId = newRecord.id;
        setCurrentRecord(newRecord);
      }

      const slotTitle = ATTENDANCE_SLOTS.find((s) => s.id === slot)?.title || 'Attendance';
      setCompletedMessage(
        `${slotTitle} recorded at ${formatTime(timeStr)}${totalHours > 0 ? ` • Total: ${totalHours.toFixed(2)} hrs rendered today` : ''}`
      );
      setPageState('completed');

      // Asynchronously upload photo and sync to backend
      if (imageData) {
        uploadFacePhoto(
          targetEmpId,
          imageData,
          slot.includes('arrival') ? 'time_in' : 'time_out'
        ).then((uploadedUrl) => {
          if (uploadedUrl && createdRecordId) {
            if (slot.includes('arrival')) {
              updateTimeRecord(createdRecordId, { timeInPhoto: uploadedUrl });
            } else {
              updateTimeRecord(createdRecordId, { timeOutPhoto: uploadedUrl });
            }
          }
        }).catch((uploadErr) => {
          console.warn('Face photo background upload notice:', uploadErr);
        });

        if (!currentEmp.photo || !currentEmp.faceRegistered) {
          updateEmployee(currentEmp.id, {
            photo: imageData,
            faceRegistered: true,
          });
        }
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReset = () => {
    userActionOverrideRef.current = false;
    setPageState('check-geofence');
    setGeofencePassed(false);
    setGeofenceCoords(undefined);
    setRetryCount((p) => p + 1);
    const lookupId = empLookupId || employee?.id || employee?.employeeId || currentUser?.employeeId || currentUser?.id || '';
    if (lookupId) {
      const rec = getTodayRecord(lookupId);
      if (rec) {
        setCurrentRecord(rec);
        setSelectedSlot(getRecommendedSlot(rec, new Date().getHours()));
      }
    }
  };

  const today = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeDisplay = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const isAllCompleted = Boolean(
    currentRecord?.amArrival &&
    currentRecord?.amDeparture &&
    currentRecord?.pmArrival &&
    currentRecord?.pmDeparture
  );

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-3xl p-5 text-white shadow-lg"
      >
        <div className="text-center">
          <p className="text-blue-200 text-xs mb-1">{today}</p>
          <div className="text-3xl font-bold font-mono tracking-tight">{timeDisplay}</div>
          <p className="text-blue-200 text-sm mt-1">{employee?.name}</p>
          <p className="text-blue-300 text-xs">
            {employee?.employeeId} • {employee?.department}
          </p>
          {isSecurityApiConfigured() && (
            <p className="text-blue-100 text-xxs mt-1">
              {(() => {
                const possibleUserId = (employee as any)?.user_id || (employee as any)?.userId || (employee as any)?.id;
                const userIdNum = Number(possibleUserId);
                if (!Number.isNaN(userIdNum)) return `Canonical emp id: emp_${userIdNum}`;
                return 'Canonical emp id: N/A';
              })()}
            </p>
          )}
        </div>

        {/* Today's 4-Slot Status Row (Civil Service Form 48 / DTTR Standard) */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-200">
              Today's Attendance Status (4 Punch Slots)
            </span>
            <span className="text-[10px] text-blue-300 bg-white/10 px-2 py-0.5 rounded-full font-semibold">
              Civil Service Form 48
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ATTENDANCE_SLOTS.map((slot) => {
              const rawTime = (currentRecord as any)?.[slot.field] as string | undefined;
              const isPunched = Boolean(rawTime);
              const isVerified = Boolean((currentRecord as any)?.[slot.verifiedField]);
              const isGeofenced = Boolean((currentRecord as any)?.[slot.geofenceField]);
              const isCurrent = selectedSlot === slot.id;

              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slot.id);
                    userActionOverrideRef.current = true;
                  }}
                  className={`text-left rounded-2xl p-2.5 transition-all cursor-pointer relative border ${
                    isCurrent
                      ? 'bg-white text-slate-900 border-white shadow-md ring-2 ring-blue-300'
                      : isPunched
                      ? 'bg-white/20 text-white border-white/20 hover:bg-white/25'
                      : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isCurrent
                          ? 'bg-blue-100 text-blue-800'
                          : isPunched
                          ? 'bg-emerald-400/30 text-emerald-200'
                          : 'bg-white/15 text-blue-200'
                      }`}
                    >
                      {slot.period}
                    </span>
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPunched ? 'bg-green-400' : isCurrent ? 'bg-blue-400 animate-ping' : 'bg-gray-400'
                        }`}
                      />
                      {isVerified && <Camera size={10} className={isCurrent ? 'text-green-600' : 'text-green-300'} />}
                    </div>
                  </div>

                  <p className={`text-[11px] font-bold truncate ${isCurrent ? 'text-slate-800' : 'text-blue-100'}`}>
                    {slot.label}
                  </p>
                  <p className={`font-black text-sm tracking-tight mt-0.5 ${isCurrent ? 'text-blue-700' : 'text-white'}`}>
                    {rawTime ? formatTime(rawTime) : '— —'}
                  </p>

                  <div className="flex items-center gap-1 mt-1">
                    {isPunched && isGeofenced && (
                      <span className={`text-[9px] flex items-center gap-0.5 ${isCurrent ? 'text-green-700' : 'text-green-300'}`}>
                        <MapPin size={8} /> GPS
                      </span>
                    )}
                    {isPunched && (
                      <span className={`text-[9px] font-semibold ml-auto ${isCurrent ? 'text-emerald-700' : 'text-emerald-300'}`}>
                        Recorded
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-blue-100 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
          <span>🕒 Official Hours: <strong>8:00 AM – 12:00 PM</strong> • <strong>1:00 PM – 5:00 PM</strong></span>
          <span>🔄 Daily Reset: <strong>6:00 AM</strong></span>
        </div>

        {/* Shift End Alerts */}
        {Boolean(currentRecord?.timeIn && !currentRecord?.timeOut) &&
          currentTime.getHours() * 60 + currentTime.getMinutes() >= 16 * 60 &&
          currentTime.getHours() * 60 + currentTime.getMinutes() < 17 * 60 && (
            <div className="mt-3 bg-amber-500/25 border border-amber-300/60 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-100">
              <Clock size={16} className="text-amber-300 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="font-bold text-white text-xs">
                  ⏰ Nearing Daily Shift End (4:20 PM Window)
                </p>
                <p className="mt-0.5 text-amber-100/90 leading-relaxed text-[11px]">
                  Today's standard OJT shift concludes at 5:00 PM ({17 * 60 - (currentTime.getHours() * 60 + currentTime.getMinutes())} mins remaining). Please remember to complete your Biometric Time Out PM before leaving.
                </p>
              </div>
            </div>
          )}

        {currentRecord?.totalHours !== undefined && currentRecord.totalHours > 0 && (
          <div className="mt-3 bg-white/15 rounded-2xl p-3 text-center">
            <p className="text-blue-200 text-xs">Total Hours Rendered Today</p>
            <p className="text-white font-bold text-xl">{currentRecord.totalHours.toFixed(2)} hrs</p>
          </div>
        )}
      </motion.div>

      {/* Main Action Area */}
      <AnimatePresence mode="wait">
        {pageState === 'check-geofence' ? (
          <motion.div
            key="geofence"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <MapPin size={18} className="text-blue-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">Step 1: Shift &amp; Location Verification</h3>
                <p className="text-xs text-gray-500">Select punch slot &amp; verify designated workplace geofence</p>
              </div>
            </div>

            {/* GPS Warning Banner */}
            {geofenceStatus === 'denied' && (
              <div className="mb-4 bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                <AlertTriangle size={22} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-amber-900">⚠️ GPS Location Permission Denied</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                      Permission Required
                    </span>
                  </div>
                  <p className="mt-1 text-amber-800 leading-relaxed">
                    The system cannot record your Daily Time Record (DTR) attendance without GPS verification. Location access is currently blocked by your browser or device settings.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        toast.info(
                          'How to Allow GPS Location: 1. Click the Lock (🔒) or Tune (🎛️) icon on the address bar. 2. Change Location to Allow. 3. Refresh or click Retry.',
                          { duration: 8000 }
                        );
                      }}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      Unblock Instructions
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-2.5 py-1 bg-white border border-amber-300 text-amber-800 rounded-lg text-[11px] font-semibold hover:bg-amber-100 transition-colors"
                    >
                      Reload Page
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Shift & Slot Switcher (AM & PM) */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">Choose Attendance Punch Slot:</span>
                <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {currentSlotConfig.title}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Morning (AM) Shift Box */}
                <div className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Sunrise size={12} className="text-amber-500" />
                      Morning Shift (A.M.)
                    </span>
                    <span className="text-[9.5px] text-slate-400">8:00 AM – 12:00 PM</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSlot('am_arrival');
                        userActionOverrideRef.current = true;
                      }}
                      className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                        selectedSlot === 'am_arrival'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                          : currentRecord?.amArrival
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold">Time In</span>
                        {currentRecord?.amArrival && (
                          <CheckCircle2
                            size={12}
                            className={selectedSlot === 'am_arrival' ? 'text-blue-200' : 'text-emerald-600'}
                          />
                        )}
                      </div>
                      <p
                        className={`text-xs font-black ${
                          selectedSlot === 'am_arrival' ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        {currentRecord?.amArrival ? formatTime(currentRecord.amArrival) : 'Not Clocked'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSlot('am_departure');
                        userActionOverrideRef.current = true;
                      }}
                      className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                        selectedSlot === 'am_departure'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                          : currentRecord?.amDeparture
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold">Time Out</span>
                        {currentRecord?.amDeparture && (
                          <CheckCircle2
                            size={12}
                            className={selectedSlot === 'am_departure' ? 'text-blue-200' : 'text-emerald-600'}
                          />
                        )}
                      </div>
                      <p
                        className={`text-xs font-black ${
                          selectedSlot === 'am_departure' ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        {currentRecord?.amDeparture ? formatTime(currentRecord.amDeparture) : 'Not Clocked'}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Afternoon (PM) Shift Box */}
                <div className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Sun size={12} className="text-orange-500" />
                      Afternoon Shift (P.M.)
                    </span>
                    <span className="text-[9.5px] text-slate-400">1:00 PM – 5:00 PM</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSlot('pm_arrival');
                        userActionOverrideRef.current = true;
                      }}
                      className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                        selectedSlot === 'pm_arrival'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                          : currentRecord?.pmArrival
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold">Time In</span>
                        {currentRecord?.pmArrival && (
                          <CheckCircle2
                            size={12}
                            className={selectedSlot === 'pm_arrival' ? 'text-blue-200' : 'text-emerald-600'}
                          />
                        )}
                      </div>
                      <p
                        className={`text-xs font-black ${
                          selectedSlot === 'pm_arrival' ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        {currentRecord?.pmArrival ? formatTime(currentRecord.pmArrival) : 'Not Clocked'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSlot('pm_departure');
                        userActionOverrideRef.current = true;
                      }}
                      className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                        selectedSlot === 'pm_departure'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                          : currentRecord?.pmDeparture
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold">Time Out</span>
                        {currentRecord?.pmDeparture && (
                          <CheckCircle2
                            size={12}
                            className={selectedSlot === 'pm_departure' ? 'text-blue-200' : 'text-emerald-600'}
                          />
                        )}
                      </div>
                      <p
                        className={`text-xs font-black ${
                          selectedSlot === 'pm_departure' ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        {currentRecord?.pmDeparture ? formatTime(currentRecord.pmDeparture) : 'Not Clocked'}
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {isPastLateThreshold && (
              <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 text-xs flex items-start gap-2.5">
                <Clock className="text-amber-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="font-bold text-xs text-amber-950">Clock-In Active (Late Attendance)</p>
                  <p className="mt-0.5 leading-relaxed text-amber-800">
                    Attendance cutoff was {formattedCutoffTime} ({lateGraceMinutes} min grace period). Clock-in is open and your attendance will be recorded as <strong>Late</strong>.
                  </p>
                </div>
              </div>
            )}

            {isStudent && !hasValidHte && (
              <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 text-xs flex items-start gap-3">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-bold text-sm text-amber-950">HTE Workplace Placement Required</p>
                  <p className="mt-1 leading-relaxed">
                    You have not been assigned to a Host Training Establishment (HTE) yet. Clock-in attendance is locked until your OJT Instructor completes your company placement.
                  </p>
                </div>
              </div>
            )}

            <GeofenceChecker onResult={handleGeofenceResult} autoCheck />

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
              <AlertCircle size={14} className="text-blue-500 shrink-0" />
              <span>You need to be within the designated work area to proceed with face scanning.</span>
            </div>

            <button
              onClick={() => {
                if (isStudent && !hasValidHte) {
                  toast.error('Clock-in blocked: Awaiting HTE workplace placement from your OJT Instructor.');
                  return;
                }
                if (geofenceStatus === 'denied') {
                  toast.error(
                    'GPS Location Permission Denied: Click the Lock (🔒) icon in your browser address bar, set Location to Allow, and retry.',
                    { duration: 6000 }
                  );
                  return;
                }
                if (!geofencePassed) {
                  toast.error(
                    'GPS Permission Required: Please allow browser location access so the system can verify your designated workplace geofence.',
                    { duration: 6000 }
                  );
                  return;
                }
                proceedToFaceScan();
              }}
              disabled={geofenceStatus === 'outside' || (isStudent && !hasValidHte)}
              className={`w-full mt-4 py-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                isStudent && !hasValidHte
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300'
                  : geofencePassed
                    ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-md cursor-pointer'
                    : geofenceStatus === 'denied'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-2 border-amber-400 cursor-pointer shadow-sm'
                      : geofenceStatus === 'outside'
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-sky-100 hover:bg-sky-200 text-sky-900 border-2 border-sky-400 cursor-pointer shadow-sm'
              }`}
            >
              {isStudent && !hasValidHte ? (
                <>
                  <Lock size={16} />
                  <span>Awaiting HTE Workplace Assignment</span>
                </>
              ) : geofenceStatus === 'denied' ? (
                <>
                  <AlertTriangle size={16} className="text-amber-700" />
                  <span>GPS Permission Denied — Allow Location to Proceed</span>
                </>
              ) : geofencePassed ? (
                <>
                  <Camera size={16} />
                  <span>Proceed to Face Scan ({currentSlotConfig.label})</span>
                </>
              ) : geofenceStatus === 'outside' ? (
                <>
                  <MapPin size={16} />
                  <span>Outside Work Premises — Cannot Punch Attendance</span>
                </>
              ) : (
                <>
                  <Compass size={16} className="text-sky-600 animate-spin" />
                  <span>GPS Permission Required — Click to Grant Location</span>
                </>
              )}
            </button>
          </motion.div>
        ) : pageState === 'face-scan' ? (
          <motion.div
            key="face"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                <Camera size={18} className="text-purple-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">
                  Step 2: Face Verification ({currentSlotConfig.title})
                </h3>
                <p className="text-xs text-gray-500">Verifying identity via facial recognition</p>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl p-3">
              <CheckCircle size={14} />
              Location verified — within geofence zone
            </div>

            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  AI Face Biometrics Active
                </p>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  {currentSlotConfig.period} Shift Punch
                </span>
              </div>
              <p className="text-emerald-800">
                Recording Slot: <span className="font-semibold">{currentSlotConfig.title}</span>
              </p>
              <p className="text-emerald-800">
                Face Verification: <span className="font-semibold">Real-time Biometric AI Match</span>
              </p>
              <p className={`${registeredPhotoSource ? 'text-emerald-800' : 'text-amber-700 font-semibold'}`}>
                Biometric Enrollment: <span className="font-semibold">{registeredPhotoSource ? 'Enrolled & Verified in Database' : 'Required: Please enroll photo first'}</span>
              </p>
            </div>

            <div className="flex justify-center">
              <FaceCapture
                key={`face-verify-${empLookupId}-${retryCount}`}
                mode="verify"
                employeeName={employee?.name || currentUser?.name}
                employeeId={employee?.id || currentUser?.id}
                registeredImage={registeredImageDataUrl || registeredPhotoSource}
                onSuccess={handleFaceSuccess}
                onCancel={() => setPageState('check-geofence')}
                autoStart
              />
            </div>
          </motion.div>
        ) : pageState === 'completed' ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
              className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle size={40} className="text-green-600" />
            </motion.div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">
              {completedSlotConfig.label} Successful!
            </h3>
            <p className="text-sm text-gray-500 mb-4">{completedMessage}</p>

            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              <div className="bg-green-50 rounded-xl p-2.5 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                <div className="text-left">
                  <p className="font-medium text-green-700">Face Verified</p>
                  <p className="text-gray-500">Biometric OK</p>
                </div>
              </div>
              <div className="bg-green-50 rounded-xl p-2.5 flex items-center gap-2">
                <MapPin size={14} className="text-green-500" />
                <div className="text-left">
                  <p className="font-medium text-green-700">Location OK</p>
                  <p className="text-gray-500">Geofence passed</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/app')}
              className="w-full py-3 bg-blue-700 text-white rounded-2xl font-semibold text-sm hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <CheckCircle size={15} />
              Done (Return to Dashboard)
            </button>

            <button
              onClick={handleReset}
              className="w-full mt-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold text-xs transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={13} />
              Need to Record Another Shift Punch? Click here
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Info Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3"
      >
        <Clock size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="font-semibold mb-1">Civil Service Form 48 DTTR Guidelines:</p>
          <ol className="space-y-0.5 list-decimal list-inside text-blue-600">
            <li><strong>Morning Shift (A.M.):</strong> Time In (Clock In) &bull; Time Out (Lunch Break Out)</li>
            <li><strong>Afternoon Shift (P.M.):</strong> Time In (Clock In) &bull; Time Out (Day End Out)</li>
            <li>Each punch verifies both your workplace GPS coordinates and real-time facial recognition</li>
          </ol>
        </div>
      </motion.div>
    </div>
  );
}
