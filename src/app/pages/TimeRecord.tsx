import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, MapPin, Camera, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { FaceCapture } from '../components/FaceCapture';
import { GeofenceChecker } from '../components/GeofenceChecker';
import { formatTime, calculateTotalHours, getAttendanceStatus } from '../utils/geo';
import { motion, AnimatePresence } from 'motion/react';
import { fetchSecurityHealth, isSecurityApiConfigured, type SecurityHealthResponse, uploadAttendancePhoto } from '../services/securityApi';

type PageState = 'check-geofence' | 'face-scan' | 'completed' | 'error';

export function TimeRecord() {
  const { getCurrentEmployee, getTodayRecord, addTimeRecord, updateTimeRecord, settings } = useApp();
  const employee = getCurrentEmployee();
  const todayRecord = employee ? getTodayRecord(employee.id) : null;
  const [pageState, setPageState] = useState<PageState>('check-geofence');
  const [geofencePassed, setGeofencePassed] = useState(false);
  const [geofenceCoords, setGeofenceCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [action, setAction] = useState<'in' | 'out'>('in');
  const [currentRecord, setCurrentRecord] = useState(todayRecord);
  const [completedMessage, setCompletedMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [securityHealth, setSecurityHealth] = useState<SecurityHealthResponse | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (employee) {
      const rec = getTodayRecord(employee.id);
      setCurrentRecord(rec);
      if (rec?.timeIn && !rec?.timeOut) {
        setAction('out');
      } else if (!rec?.timeIn) {
        setAction('in');
      }
    }
  }, [employee]);

  useEffect(() => {
    let mounted = true;
    if (!isSecurityApiConfigured()) {
      setSecurityHealth(null);
      return;
    }
    fetchSecurityHealth()
      .then(h => {
        if (mounted) setSecurityHealth(h);
      })
      .catch(() => {
        if (mounted) setSecurityHealth(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleGeofenceResult = (passed: boolean, coords?: { lat: number; lng: number }) => {
    setGeofencePassed(passed);
    setGeofenceCoords(coords);
  };

  const proceedToFaceScan = () => {
    if (!geofencePassed) return;
    setPageState('face-scan');
  };

  const handleFaceSuccess = async (imageData?: string) => {
    if (!employee) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let storedImage = imageData;

    if (imageData && isSecurityApiConfigured()) {
      try {
        const response = await uploadAttendancePhoto({
          employee_id: employee.id,
          action,
          image: imageData,
        });
        if (response.success && response.image_url) {
          storedImage = response.image_url;
        }
      } catch {
        // If upload fails, keep local image data
      }
    }

    if (action === 'in') {
      const status = getAttendanceStatus(timeStr, settings.workStartTime, settings.lateThresholdMinutes);
      const newRecord = addTimeRecord({
        employeeId: employee.id,
        date: now.toISOString().split('T')[0],
        timeIn: timeStr,
        timeInGeofenced: geofencePassed,
        timeOutGeofenced: false,
        timeInFaceVerified: true,
        timeOutFaceVerified: false,
        status,
        timeInLocation: geofenceCoords,
        timeInPhoto: storedImage,
      });
      setCurrentRecord(newRecord);
      setCompletedMessage(`Time In recorded at ${formatTime(timeStr)}${status === 'late' ? ' (Late)' : ''}${!geofencePassed ? ' ⚠ Outside premises' : ''}`);
    } else if (currentRecord) {
      const totalHours = currentRecord.timeIn ? calculateTotalHours(currentRecord.timeIn, timeStr) : 0;
      updateTimeRecord(currentRecord.id, {
        timeOut: timeStr,
        timeOutGeofenced: geofencePassed,
        timeOutFaceVerified: true,
        totalHours,
        timeOutLocation: geofenceCoords,
        timeOutPhoto: storedImage,
        status: currentRecord.status === 'present' ? (totalHours > 9 ? 'overtime' : 'present') : currentRecord.status,
      });
      setCompletedMessage(`Time Out recorded at ${formatTime(timeStr)} • Total: ${totalHours.toFixed(2)} hours`);
    }
    setPageState('completed');
  };

  const handleReset = () => {
    setPageState('check-geofence');
    setGeofencePassed(false);
    setGeofenceCoords(undefined);
    setRetryCount(p => p + 1);
    if (employee) {
      const rec = getTodayRecord(employee.id);
      setCurrentRecord(rec);
      setAction(rec?.timeIn && !rec?.timeOut ? 'out' : 'in');
    }
  };

  const today = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeDisplay = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
          <p className="text-blue-300 text-xs">{employee?.employeeId} • {employee?.department}</p>
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
            {currentRecord?.timeInGeofenced && <p className="text-green-300 text-xs flex items-center gap-0.5 mt-0.5"><MapPin size={8} /> Geofenced</p>}
          </div>
          <div className="bg-white/15 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${currentRecord?.timeOut ? 'bg-green-400' : 'bg-gray-400'}`} />
              <p className="text-blue-200 text-xs">Time Out</p>
              {currentRecord?.timeOutFaceVerified && <Camera size={10} className="text-green-300 ml-auto" />}
            </div>
            <p className="text-white font-bold">{currentRecord?.timeOut ? formatTime(currentRecord.timeOut) : '— —'}</p>
            {currentRecord?.timeOutGeofenced && <p className="text-green-300 text-xs flex items-center gap-0.5 mt-0.5"><MapPin size={8} /> Geofenced</p>}
          </div>
        </div>

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
            <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-medium ${
              currentRecord?.status === 'present' ? 'bg-green-100 text-green-700' :
              currentRecord?.status === 'late' ? 'bg-orange-100 text-orange-700' :
              currentRecord?.status === 'overtime' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {currentRecord?.status?.charAt(0).toUpperCase() + (currentRecord?.status?.slice(1) || '')}
            </div>
          </motion.div>
        ) : pageState === 'check-geofence' ? (
          <motion.div key="geofence" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <MapPin size={18} className="text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Step 1: Location Verification</h3>
                <p className="text-xs text-gray-500">Checking if you're within the geofence zone</p>
              </div>
            </div>

            <GeofenceChecker onResult={handleGeofenceResult} autoCheck />

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
              <AlertCircle size={14} className="text-blue-500 shrink-0" />
              <span>You need to be within the designated work area to proceed with face scanning.</span>
            </div>

            <button
              onClick={proceedToFaceScan}
              disabled={!geofencePassed}
              className="w-full mt-4 py-3 bg-blue-700 text-white rounded-2xl font-semibold text-sm hover:bg-blue-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Camera size={16} />
              {geofencePassed ? `Proceed to Face Scan (Clock ${action === 'in' ? 'In' : 'Out'})` : 'Waiting for Location...'}
            </button>
          </motion.div>
        ) : pageState === 'face-scan' ? (
          <motion.div key="face" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                <Camera size={18} className="text-purple-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Step 2: Face Verification</h3>
                <p className="text-xs text-gray-500">Verifying identity via facial recognition</p>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl p-3">
              <CheckCircle size={14} />
              Location verified — within geofence zone
            </div>

            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs space-y-1">
              <p className="font-semibold text-gray-800">Face Recognition Status</p>
              <p className={`${isSecurityApiConfigured() ? 'text-green-700' : 'text-amber-700'}`}>
                Backend: {isSecurityApiConfigured() ? 'Connected' : 'Not configured (VITE_DJANGO_API_URL missing)'}
              </p>
              <p className={`${securityHealth?.face_recognition_installed ? 'text-green-700' : 'text-amber-700'}`}>
                Face model: {securityHealth?.face_recognition_installed ? 'Available on server' : 'Unknown / not installed'}
              </p>
              <p className={`${employee?.photo ? 'text-green-700' : 'text-amber-700'}`}>
                Employee enrollment: {employee?.photo ? 'Has enrolled face photo' : 'No enrolled face found'}
              </p>
            </div>

            <div className="flex justify-center">
              <FaceCapture
                key={`face-verify-${employee?.id}-${retryCount}`}
                mode="verify"
                employeeName={employee?.name}
                employeeId={employee?.id}
                registeredImage={employee?.photo}
                onSuccess={handleFaceSuccess}
                onCancel={() => setPageState('check-geofence')}
                autoStart
              />
            </div>
          </motion.div>
        ) : pageState === 'completed' ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
              className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle size={40} className="text-green-600" />
            </motion.div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">
              Clock {action === 'in' ? 'In' : 'Out'} Successful!
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
              onClick={handleReset}
              className="w-full py-3 bg-blue-700 text-white rounded-2xl font-semibold text-sm hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              {currentRecord?.timeIn && !currentRecord?.timeOut ? 'Clock Out' : 'Done'}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Info Footer */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3">
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
