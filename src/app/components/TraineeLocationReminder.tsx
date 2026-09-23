import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPinOff,
  Navigation,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Laptop,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export type LocationState = 'checking' | 'active' | 'prompt' | 'denied' | 'unavailable' | 'unsupported';

interface TraineeLocationReminderProps {
  onLocationVerified?: (coords: { lat: number; lng: number }) => void;
}

export function TraineeLocationReminder({ onLocationVerified }: TraineeLocationReminderProps) {
  const [locationState, setLocationState] = useState<LocationState>('checking');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [deviceTab, setDeviceTab] = useState<'android' | 'ios' | 'desktop'>(() => {
    if (typeof navigator === 'undefined') return 'android';
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
  });

  const checkCountRef = useRef(0);

  // Check current location permission and hardware GPS readiness
  const evaluateLocation = useCallback(async (interactive = false) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationState('unsupported');
      return;
    }

    if (interactive) {
      setIsRequesting(true);
    }

    try {
      // 1. Check Permissions API if available in browser
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          if (perm.state === 'denied') {
            setLocationState('denied');
            if (interactive) setIsRequesting(false);
            return;
          }
          if (perm.state === 'prompt' && !interactive) {
            // Permission not yet opened by trainee
            setLocationState('prompt');
            return;
          }
        } catch {
          // Permissions API query not supported for geolocation in some environments
        }
      }

      // 2. Test actual device GPS position
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationState('active');
          setIsRequesting(false);

          try {
            localStorage.setItem(
              'ojt_last_coords',
              JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                time: Date.now(),
              })
            );
          } catch {}

          if (interactive || checkCountRef.current > 0) {
            setShowSuccessToast(true);
            setTimeout(() => {
              setShowSuccessToast(false);
            }, 3000);
          }

          if (onLocationVerified) {
            onLocationVerified({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          }
        },
        (err) => {
          setIsRequesting(false);
          if (err.code === 1) {
            // PERMISSION_DENIED
            setLocationState('denied');
          } else if (err.code === 2) {
            // POSITION_UNAVAILABLE (GPS switch is turned OFF on phone or device)
            setLocationState('unavailable');
          } else if (err.code === 3) {
            // TIMEOUT
            setLocationState('unavailable');
          } else {
            setLocationState('denied');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: interactive ? 12000 : 7000,
          maximumAge: interactive ? 0 : 15000,
        }
      );
    } catch {
      setIsRequesting(false);
      setLocationState('unavailable');
    }
  }, [onLocationVerified]);

  // Initial check and auto-listener setup
  useEffect(() => {
    evaluateLocation(false);
    checkCountRef.current += 1;

    // React to browser permission state changes in real-time
    let permStatus: PermissionStatus | null = null;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          permStatus = status;
          status.onchange = () => {
            if (status.state === 'granted') {
              evaluateLocation(false);
            } else if (status.state === 'denied') {
              setLocationState('denied');
            } else if (status.state === 'prompt') {
              setLocationState('prompt');
            }
          };
        })
        .catch(() => {});
    }

    // When trainee turns on location in phone settings and returns to the tab, re-check immediately
    const handleWindowFocus = () => {
      evaluateLocation(false);
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleWindowFocus);

    // Periodic heartbeat check every 15 seconds if location is currently not open
    const interval = setInterval(() => {
      setLocationState((curr) => {
        if (curr !== 'active') {
          evaluateLocation(false);
        }
        return curr;
      });
    }, 15000);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleWindowFocus);
      clearInterval(interval);
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, [evaluateLocation]);

  // Request location explicitly when trainee taps action button
  const handleRequestLocation = () => {
    evaluateLocation(true);
  };

  // If location is active and not showing the brief success banner, hide pop-up completely
  if (locationState === 'active' && !showSuccessToast) {
    return null;
  }

  // If checking for the first time without failure, don't flash yet
  if (locationState === 'checking' && checkCountRef.current === 1) {
    return null;
  }

  return (
    <div className="fixed top-16 left-3 sm:top-20 sm:left-6 lg:left-70 z-[100] max-w-[340px] sm:max-w-[380px] pointer-events-none no-print">
      <AnimatePresence mode="wait">
        {/* Success Confirmation Toast when location is turned ON */}
        {showSuccessToast && (
          <motion.div
            key="success-toast"
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="pointer-events-auto bg-white/95 backdrop-blur-md border border-emerald-500 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3 text-slate-800 ring-2 ring-emerald-500/20"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Location Active</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs text-slate-600 leading-tight mt-0.5">
                GPS signal confirmed. You can now record OJT attendance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccessToast(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        {/* Minimized Floating Pill Badge in Upper Left */}
        {!showSuccessToast && isMinimized && locationState !== 'active' && (
          <motion.button
            key="minimized-pill"
            initial={{ opacity: 0, scale: 0.85, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: -10 }}
            type="button"
            onClick={() => setIsMinimized(false)}
            className="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-2xl shadow-xl border border-amber-300/80 text-xs transition-transform active:scale-95 cursor-pointer ring-2 ring-amber-400/30"
            title="Location is off. Click to open reminder."
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
            </span>
            <MapPinOff size={15} className="text-slate-950" />
            <span>Turn On Location</span>
          </motion.button>
        )}

        {/* Main Location Reminder Pop-up Card */}
        {!showSuccessToast && !isMinimized && locationState !== 'active' && (
          <motion.div
            key="location-reminder-card"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="pointer-events-auto bg-white/95 backdrop-blur-md border border-amber-400/80 shadow-2xl rounded-2xl p-4 text-slate-800 ring-4 ring-amber-400/15 overflow-hidden"
          >
            {/* Top Amber Accent Strip */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />

            {/* Header */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 text-amber-700 shrink-0 shadow-xs border border-amber-200">
                  <MapPinOff size={18} className="text-amber-700" />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-[13px] sm:text-sm text-slate-900 leading-snug">
                    Turn On Your Location
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    <span>Required for OJT Attendance</span>
                  </p>
                </div>
              </div>

              {/* Minimize / Dismiss Button */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Minimize reminder"
                aria-label="Minimize location reminder"
              >
                <X size={16} />
              </button>
            </div>

            {/* Description Body */}
            <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
              Your device location (GPS) is currently{' '}
              <strong className="text-amber-800 font-semibold">
                {locationState === 'denied'
                  ? 'blocked by your browser'
                  : locationState === 'unavailable'
                  ? 'turned off on your device'
                  : 'not yet opened'}
              </strong>
              . Please enable location to verify campus or HTE geofence attendance.
            </p>

            {/* Status Pill */}
            <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">
                {locationState === 'denied' && 'Browser permission is blocked'}
                {locationState === 'unavailable' && 'Device GPS toggle is switched OFF'}
                {locationState === 'prompt' && 'Permission requested — tap below'}
                {locationState === 'unsupported' && 'Browser does not support GPS'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={isRequesting}
                className="flex-1 px-3.5 py-2 bg-gradient-to-r from-[#152B4D] to-[#1E3A66] hover:from-[#1E3A66] hover:to-[#2A4D80] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                {isRequesting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Checking GPS...</span>
                  </>
                ) : (
                  <>
                    <Navigation size={13} className="text-amber-300" />
                    <span>Open / Allow Location</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  showGuide
                    ? 'bg-slate-100 text-slate-800 border-slate-300'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
                title="How to enable device location"
                aria-label="Toggle instructions"
              >
                <HelpCircle size={14} />
                <span className="text-[11px]">{showGuide ? 'Hide' : 'Help'}</span>
                {showGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {/* Expandable Step-by-Step Device Help */}
            <AnimatePresence>
              {showGuide && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-2.5 border-t border-slate-100 overflow-hidden text-xs"
                >
                  {/* Tabs */}
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold text-slate-600 mb-2">
                    <button
                      type="button"
                      onClick={() => setDeviceTab('android')}
                      className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                        deviceTab === 'android' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                      }`}
                    >
                      Android
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceTab('ios')}
                      className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                        deviceTab === 'ios' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                      }`}
                    >
                      iPhone / iPad
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceTab('desktop')}
                      className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                        deviceTab === 'desktop' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                      }`}
                    >
                      Laptop / PC
                    </button>
                  </div>

                  {/* Tab Details */}
                  {deviceTab === 'android' && (
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <li>Swipe down the top notification shade.</li>
                      <li>
                        Tap <strong className="text-slate-800 font-semibold">Location / GPS</strong> to turn it ON.
                      </li>
                      <li>In Chrome, tap the site settings lock icon beside the URL $\rightarrow$ Permissions $\rightarrow$ Location $\rightarrow$ Allow.</li>
                      <li>Tap the <strong>Open / Allow Location</strong> button above.</li>
                    </ol>
                  )}

                  {deviceTab === 'ios' && (
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <li>Open iOS <strong>Settings</strong> $\rightarrow$ <strong>Privacy & Security</strong> $\rightarrow$ <strong>Location Services</strong> (Turn ON).</li>
                      <li>Scroll down $\rightarrow$ tap <strong>Safari Websites</strong> $\rightarrow$ select <strong>While Using the App</strong>.</li>
                      <li>Return here and tap <strong>Open / Allow Location</strong> above.</li>
                    </ol>
                  )}

                  {deviceTab === 'desktop' && (
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <li>Click the <strong>tune / lock icon</strong> on the left side of your browser URL bar.</li>
                      <li>Toggle <strong>Location</strong> to <strong>Allow</strong>.</li>
                      <li>Ensure Windows Location Services is ON in Windows Settings $\rightarrow$ Privacy.</li>
                      <li>Tap <strong>Open / Allow Location</strong> above.</li>
                    </ol>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
