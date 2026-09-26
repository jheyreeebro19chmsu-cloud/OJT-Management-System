import { Clock, CheckCircle, MapPin, Camera, AlertCircle, AlertTriangle, XCircle, RefreshCw, Compass, Lock } from 'lucide-react';
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
import { formatTime, calculateTotalHours, getAttendanceStatus, getCurrentLocation, getDTRSessionDate } from '../utils/geo';
import { authAPI } from '../services/authApi';
import type { TimeRecord as TimeRecordType } from '../types';

type PageState = 'check-geofence' | 'face-scan' | 'completed' | 'error';

export function TimeRecord() {
  const navigate = useNavigate();
  const { currentUser, getCurrentEmployee, getTodayRecord, addTimeRecord, updateTimeRecord, updateEmployee, settings, timeRecords, employees } = useApp();
  const employee = getCurrentEmployee();
  const empLookupId = employee?.id || employee?.employeeId || currentUser?.employeeId || currentUser?.id || '';
  const todayRecord = empLookupId ? getTodayRecord(empLookupId) : null;
  const [pageState, setPageState] = useState<PageState>('check-geofence');
  const [geofencePassed, setGeofencePassed] = useState(false);
  const [geofenceCoords, setGeofenceCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [geofenceStatus, setGeofenceStatus] = useState<GeoState>('checking');
  const [geofenceMessage, setGeofenceMessage] = useState<string>('');
  const [action, setAction] = useState<'in' | 'out'>('in');
  const [completedAction, setCompletedAction] = useState<'in' | 'out'>('in');
  const [currentRecord, setCurrentRecord] = useState(todayRecord);
  const [completedMessage, setCompletedMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [securityHealth, setSecurityHealth] = useState<SecurityHealthResponse | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const userActionOverrideRef = useRef<boolean>(false);

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

  // Proactive GPS permission check — surface denied state immediately before async GeofenceChecker fires
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
              // Permission was re-granted — clear denied state
              setGeofenceStatus('checking');
            }
          };
        })
        .catch(() => {
          // Permissions API not supported — rely on GeofenceChecker's own detection
        });
    }
  }, []);

  useEffect(() => {
    const lookupId = empLookupId || employee?.id || employee?.employeeId || currentUser?.employeeId || currentUser?.id || '';
    if (lookupId) {
      const rec = getTodayRecord(lookupId);
      if (rec) {
        setCurrentRecord(rec);
      }
      // Guard: do not flip the action state while viewing the completed confirmation
      if (pageState !== 'completed') {
        const effectiveRec = rec || currentRecord;
        if (effectiveRec?.timeIn && !effectiveRec?.timeOut) {
          if (!userActionOverrideRef.current) {
            setAction('out');
          }
        } else {
          // If not clocked in or already clocked out, Clock In is the only permissible action
          setAction('in');
          userActionOverrideRef.current = false;
        }
      }
    }
  }, [employee, empLookupId, currentUser, timeRecords, pageState]);

  // Strict guard: Guarantee action cannot remain 'out' if there is no prior clock-in today
  useEffect(() => {
    if (!currentRecord?.timeIn && action === 'out') {
      setAction('in');
      userActionOverrideRef.current = false;
    }
  }, [currentRecord?.timeIn, action]);

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

  // CORS-safe prefetch of registered face image into a local data URL
  // Prevents biometric matching failures caused by cross-origin Supabase storage URLs
  useEffect(() => {
    const photo = registeredPhotoSource;
    if (!photo) {
      setRegisteredImageDataUrl(undefined);
      return;
    }
    // Already a data URL — use directly
    if (photo.startsWith('data:')) {
      setRegisteredImageDataUrl(photo);
      return;
    }
    // Remote URL — fetch as blob and convert to data URL
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
        // Fallback: pass the raw URL and let faceClient handle CORS via its own fetch
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
    employee.companyName.trim().length > 0 &&
    employee.companyName.toLowerCase() !== 'n/a' &&
    !employee.companyName.toLowerCase().includes('pending')
  );

  const proceedToFaceScan = () => {
    if (isStudent && !hasValidHte) {
      toast.error('Clock-in blocked: You must be assigned to an approved Host Training Establishment (HTE) workplace by your instructor first.');
      return;
    }
    if (!geofencePassed) return;
    if (action === 'out' && !currentRecord?.timeIn) {
      toast.error('You must clock in first before you can clock out.');
      setAction('in');
      return;
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

      const currentAction = action;
      if (currentAction === 'out' && !currentRecord?.timeIn) {
        toast.error('Cannot record Clock Out: No prior Clock In found for today.');
        setAction('in');
        setPageState('check-geofence');
        return;
      }
      setCompletedAction(currentAction);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const dateStr = getDTRSessionDate(now);

      let createdRecordId: string | null = null;

      if (currentAction === 'in') {
        const status = getAttendanceStatus(timeStr, settings.workStartTime, settings.lateThresholdMinutes);
        const newRecord = addTimeRecord({
          employeeId: targetEmpId,
          date: dateStr,
          timeIn: timeStr,
          timeInGeofenced: geofencePassed,
          timeOutGeofenced: false,
          timeInFaceVerified: true,
          timeOutFaceVerified: false,
          status,
          timeInLocation: geofenceCoords || (currentEmp as any).registrationLocation,
          timeInPhoto: imageData,
        });
        createdRecordId = newRecord.id;
        setCurrentRecord(newRecord);
        setAction('out');
        userActionOverrideRef.current = false;
        setCompletedMessage(
          `Time In recorded at ${formatTime(timeStr)}${status === 'late' ? ' (Late)' : ''}${!geofencePassed ? ' ⚠ Outside premises' : ''}`
        );
      } else if (currentRecord) {
        const totalHours = currentRecord.timeIn ? calculateTotalHours(currentRecord.timeIn, timeStr) : 0;
        const updatedFields: Partial<TimeRecordType> = {
          employeeId: targetEmpId,
          date: currentRecord.date || dateStr,
          timeOut: timeStr,
          timeOutGeofenced: geofencePassed,
          timeOutFaceVerified: true,
          totalHours,
          timeOutLocation: geofenceCoords || (currentEmp as any).registrationLocation,
          timeOutPhoto: imageData,
          status: currentRecord.status === 'present' ? (totalHours > 9 ? 'overtime' : 'present') : currentRecord.status,
        };
        updateTimeRecord(currentRecord.id, updatedFields);
        createdRecordId = currentRecord.id;
        setCurrentRecord({ ...currentRecord, ...updatedFields });
        setCompletedMessage(`Time Out recorded at ${formatTime(timeStr)} • Total: ${totalHours.toFixed(2)} hours`);
      } else {
        // Safe fallback: If user clocked out without a prior clock-in today, persist a record immediately
        const fallbackRecord = addTimeRecord({
          employeeId: targetEmpId,
          date: dateStr,
          timeIn: timeStr,
          timeOut: timeStr,
          totalHours: 0,
          timeInGeofenced: geofencePassed,
          timeOutGeofenced: geofencePassed,
          timeInFaceVerified: true,
          timeOutFaceVerified: true,
          status: 'present',
          timeOutLocation: geofenceCoords || (currentEmp as any).registrationLocation,
          timeOutPhoto: imageData,
        });
        createdRecordId = fallbackRecord.id;
        setCurrentRecord(fallbackRecord);
        setCompletedMessage(`Time Out recorded at ${formatTime(timeStr)}`);
      }

      setPageState('completed');

      // Asynchronously upload photo and sync to backend in background (never delays timestamp saving)
      if (imageData) {
        uploadFacePhoto(
          targetEmpId,
          imageData,
          currentAction === 'in' ? 'time_in' : 'time_out'
        ).then((uploadedUrl) => {
          if (uploadedUrl && createdRecordId) {
            if (currentAction === 'in') {
              updateTimeRecord(createdRecordId, { timeInPhoto: uploadedUrl });
            } else {
              updateTimeRecord(createdRecordId, { timeOutPhoto: uploadedUrl });
            }
          }
        }).catch((uploadErr) => {
          console.warn('Face photo background upload notice:', uploadErr);
        });

        // Auto-enroll face biometrics into database if trainee was not enrolled before
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
        setAction(rec?.timeIn && !rec?.timeOut ? 'out' : 'in');
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
  const isCompleted = currentRecord?.timeIn && currentRecord?.timeOut;

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

        {/* Today's Status Row */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white/15 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${currentRecord?.timeIn ? 'bg-green-400' : 'bg-gray-400'}`} />
              <p className="text-blue-200 text-xs">Time In</p>
              {currentRecord?.timeInFaceVerified && <Camera size={10} className="text-green-300 ml-auto" />}
            </div>
            <p className="text-white font-bold">{currentRecord?.timeIn ? formatTime(currentRecord.timeIn) : '— —'}</p>
            {currentRecord?.timeInGeofenced && (
              <p className="text-green-300 text-xs flex items-center gap-0.5 mt-0.5">
                <MapPin size={8} /> Geofenced
              </p>
            )}
          </div>
          <div className="bg-white/15 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${currentRecord?.timeOut ? 'bg-green-400' : 'bg-gray-400'}`} />
              <p className="text-blue-200 text-xs">Time Out</p>
              {currentRecord?.timeOutFaceVerified && <Camera size={10} className="text-green-300 ml-auto" />}
            </div>
            <p className="text-white font-bold">{currentRecord?.timeOut ? formatTime(currentRecord.timeOut) : '— —'}</p>
            {currentRecord?.timeOutGeofenced && (
              <p className="text-green-300 text-xs flex items-center gap-0.5 mt-0.5">
                <MapPin size={8} /> Geofenced
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-blue-100 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
          <span>🕒 Attendance Window: <strong>6:00 AM – 5:00 PM</strong></span>
          <span>🔄 Daily Reset: <strong>6:00 AM</strong></span>
        </div>

        {/* 4:20 PM / Shift End Proximity Alert Banner */}
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
                  Today's standard OJT shift concludes at 5:00 PM ({17 * 60 - (currentTime.getHours() * 60 + currentTime.getMinutes())} mins remaining). Please remember to complete your Biometric Time Out with GPS verification before departing.
                </p>
              </div>
            </div>
          )}

        {/* Overtime / Past 5:00 PM Alert Banner */}
        {Boolean(currentRecord?.timeIn && !currentRecord?.timeOut) &&
          currentTime.getHours() * 60 + currentTime.getMinutes() >= 17 * 60 && (
            <div className="mt-3 bg-red-500/25 border border-red-300/60 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-red-100">
              <AlertTriangle size={16} className="text-red-300 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <p className="font-bold text-white text-xs">
                  🚨 Regular Shift Concluded — Clock Out Pending
                </p>
                <p className="mt-0.5 text-red-100/90 leading-relaxed text-[11px]">
                  It is past 5:00 PM. Please submit your Time Out now to record and lock in today's rendered OJT hours.
                </p>
              </div>
            </div>
          )}

        {currentRecord?.totalHours && (
          <div className="mt-3 bg-white/15 rounded-2xl p-3 text-center">
            <p className="text-blue-200 text-xs">Total Hours</p>
            <p className="text-white font-bold text-xl">{currentRecord.totalHours.toFixed(2)} hrs</p>
          </div>
        )}
      </motion.div>

      {/* Main Action Area */}
      <AnimatePresence mode="wait">
        {isCompleted && pageState !== 'completed' ? (
          <motion.div
            key="already-done"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center"
          >
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h3 className="font-bold text-gray-800 mb-1">Attendance Completed</h3>
            <p className="text-sm text-gray-500">You have already clocked in and out for today.</p>
            <div
              className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-medium ${
                currentRecord?.status === 'present'
                  ? 'bg-green-100 text-green-700'
                  : currentRecord?.status === 'late'
                    ? 'bg-orange-100 text-orange-700'
                    : currentRecord?.status === 'overtime'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
              }`}
            >
              {currentRecord?.status?.charAt(0).toUpperCase() + (currentRecord?.status?.slice(1) || '')}
            </div>
          </motion.div>
        ) : pageState === 'check-geofence' ? (
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
                <h3 className="font-bold text-gray-800">Step 1: Location Verification</h3>
                <p className="text-xs text-gray-500">Checking if you're within the geofence zone</p>
              </div>
            </div>

            {/* Prominent GPS Permission Warning Banner */}
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
                        alert(
                          'How to Allow GPS Location:\n\n1. Click the Lock (🔒) or Tune (🎛️) icon on the left of your browser address bar.\n2. Change Location to "Allow".\n3. Refresh this page or click "Retry Location Check".'
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


            {/* Attendance Action Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setAction('in');
                  userActionOverrideRef.current = true;
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  action === 'in'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Clock In
              </button>
              <button
                type="button"
                disabled={!currentRecord?.timeIn}
                onClick={() => {
                  if (!currentRecord?.timeIn) {
                    toast.error('Clock Out is closed. You must clock in first before you can clock out.');
                    return;
                  }
                  setAction('out');
                  userActionOverrideRef.current = true;
                }}
                title={!currentRecord?.timeIn ? 'Clock Out closed — Clock In first' : 'Switch to Clock Out'}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  !currentRecord?.timeIn
                    ? 'opacity-40 cursor-not-allowed text-slate-400 bg-transparent'
                    : action === 'out'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {!currentRecord?.timeIn && <Lock size={12} className="text-slate-400" />}
                <span>Clock Out</span>
              </button>
            </div>

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
                  alert(
                    'GPS Location Permission Denied\n\nTo clock in or out, you must allow location access:\n1. Click the Lock (🔒) or Site Settings icon in your browser address bar.\n2. Change Location to "Allow".\n3. Click "Request GPS Permission / Retry".'
                  );
                  return;
                }
                if (!geofencePassed) {
                  alert(
                    'GPS Permission Required\n\nPlease allow browser location access so the system can verify you are within your designated workplace geofence before clocking in or out.'
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
                  <span>Proceed to Face Scan (Clock {action === 'in' ? 'In' : 'Out'})</span>
                </>
              ) : geofenceStatus === 'outside' ? (
                <>
                  <MapPin size={16} />
                  <span>Outside Work Premises — Cannot Clock In/Out</span>
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
                <h3 className="font-bold text-gray-800">Step 2: Face Verification ({action === 'in' ? 'Clock In' : 'Clock Out'})</h3>
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
                  Database Connected
                </span>
              </div>
              <p className="text-emerald-800">
                Cloud Database: <span className="font-semibold">Supabase Database & Storage (Active)</span>
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
            <h3 className="font-bold text-gray-800 text-lg mb-2">Clock {completedAction === 'in' ? 'In' : 'Out'} Successful!</h3>
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

            {completedAction === 'in' && currentRecord?.timeIn && !currentRecord?.timeOut && (
              <button
                onClick={handleReset}
                className="w-full mt-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold text-xs transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={13} />
                Need to Clock Out? Click here
              </button>
            )}

            {currentRecord?.timeIn && currentRecord?.timeOut && (
              <button
                onClick={() => {
                  setCurrentRecord(null);
                  setAction('in');
                  setPageState('check-geofence');
                  setGeofencePassed(false);
                  setGeofenceCoords(undefined);
                  setRetryCount((p) => p + 1);
                }}
                className="w-full mt-3 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw size={14} />
                Clock In Again (New Shift)
              </button>
            )}
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
          <p className="font-semibold mb-1">How it works:</p>
          <ol className="space-y-0.5 list-decimal list-inside text-blue-600">
            <li>System checks your GPS location against geofence zones</li>
            <li>Facial recognition verifies your identity</li>
            <li>Time is automatically recorded with verification badges</li>
          </ol>
        </div>
      </motion.div>
    </div>
  );
}
