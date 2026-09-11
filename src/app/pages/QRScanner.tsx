import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Camera,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  GraduationCap,
  Building,
  Clock,
  Sparkles,
  Link,
  ShieldCheck,
  VideoOff,
} from 'lucide-react';

import { authAPI } from '../services/authApi';
import { linkTraineeToInstructor } from '../services/accountSync';
import { useApp } from '../store/AppContext';

export default function QRScanner() {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [qr, setQr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const app = useApp();

  const verifyCode = useCallback(
    async (rawCode: string) => {
      const rawQr = (rawCode || '').trim();
      if (!rawQr) return;

      setLoading(true);
      setResult(null);

      // 1. Try JSON parsing (standard instructor QR or trainee QR)
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawQr);
      } catch {}

      // Case A: Instructor Enrollment QR
      if (parsed && (parsed.type === 'instructor_enrollment' || parsed.instructorId)) {
        const instId = parsed.instructorId || parsed.email || parsed.id;
        const found = app?.employees.find(
          (e) =>
            instId &&
            (e.id === instId ||
              e.employeeId?.toLowerCase() === String(instId).toLowerCase() ||
              e.email.toLowerCase() === String(instId).toLowerCase())
        );
        setResult({
          success: true,
          type: 'instructor',
          instructor: found
            ? { id: found.id, email: found.email, name: found.name, employeeId: found.employeeId }
            : { id: instId, email: parsed.email || instId, name: parsed.name || 'Instructor' },
        });
        setLoading(false);
        return;
      }

      // Case B: Trainee Profile / Attendance QR
      if (parsed && (parsed.type === 'trainee_profile' || parsed.type === 'trainee_pass' || parsed.employeeId)) {
        const empId = parsed.employeeId || parsed.id || parsed.email;
        const found = app?.employees.find(
          (e) =>
            empId &&
            (e.id === empId ||
              e.employeeId?.toLowerCase() === String(empId).toLowerCase() ||
              e.email.toLowerCase() === String(empId).toLowerCase())
        );
        setResult({
          success: true,
          type: 'trainee',
          trainee: found || {
            name: parsed.name || 'Student Trainee',
            employeeId: parsed.employeeId || 'OJT',
            course: parsed.course || 'OJT Intern',
            companyName: parsed.companyName || 'Host Training Establishment',
            requiredHours: parsed.requiredHours || 300,
          },
        });
        setLoading(false);
        return;
      }

      // 2. Try instructor_local_{email} format
      if (rawQr.startsWith('instructor_local_')) {
        const email = rawQr.replace('instructor_local_', '').trim();
        const found = app?.employees.find((e) => e.email.toLowerCase() === email.toLowerCase());
        setResult({
          success: true,
          type: 'instructor',
          instructor: found
            ? { id: found.id, email: found.email, name: found.name, employeeId: found.employeeId }
            : { email, name: 'Instructor' },
        });
        setLoading(false);
        return;
      }

      // 3. Fallback: query in-memory employees by ID or email
      const matched = app?.employees.find(
        (e) =>
          e.email.toLowerCase() === rawQr.toLowerCase() ||
          e.id === rawQr ||
          e.employeeId?.toLowerCase() === rawQr.toLowerCase()
      );
      if (matched) {
        const isInst =
          matched.position === 'OJT Instructor' ||
          matched.position?.toLowerCase().includes('instructor') ||
          matched.position === 'Administrator';

        if (isInst) {
          setResult({
            success: true,
            type: 'instructor',
            instructor: { id: matched.id, email: matched.email, name: matched.name, employeeId: matched.employeeId },
          });
        } else {
          setResult({
            success: true,
            type: 'trainee',
            trainee: matched,
          });
        }
        setLoading(false);
        return;
      }

      // 4. Try backend verification
      try {
        const res = await authAPI.verifyQR(rawQr);
        setResult({ success: true, type: 'backend', data: res.data });
      } catch (err: any) {
        setResult({
          success: false,
          error: err?.response?.data || 'Unrecognized QR code or invalid enrollment token.',
        });
      } finally {
        setLoading(false);
      }
    },
    [app?.employees]
  );

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);

      // Start BarcodeDetector loop if supported
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          scanIntervalRef.current = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const detected = barcodes[0].rawValue;
                  if (detected) {
                    toast.success('QR Code detected!');
                    setQr(detected);
                    verifyCode(detected);
                    stopCamera();
                  }
                }
              } catch {}
            }
          }, 500);
        } catch {}
      }
    } catch (e: any) {
      setCameraError('Camera access denied or unavailable. You can upload an image or paste the code directly.');
      setCameraActive(false);
    }
  }, [stopCamera, verifyCode]);

  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, startCamera, stopCamera]);

  // Handle image file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();
        const barcodes = await barcodeDetector.detect(img);
        if (barcodes && barcodes.length > 0) {
          const detected = barcodes[0].rawValue;
          toast.success('QR Code extracted from image!');
          setQr(detected);
          verifyCode(detected);
          return;
        }
      } catch {}
    }

    // Fallback: FileReader read text or alert
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text && (text.includes('{') || text.includes('instructor'))) {
        setQr(text);
        verifyCode(text);
      } else {
        toast.info('Image uploaded. If QR was not automatically decoded, paste data below.');
      }
    };
    reader.readAsText(file);
  };

  const handleLinkToInstructor = async () => {
    if (!result?.instructor || !app?.currentUser) return;
    const instructorId = result.instructor.id || result.instructor.email;
    const traineeId = app.currentUser.id || app.currentUser.employeeId;
    if (!traineeId) return;

    setLinking(true);
    try {
      await linkTraineeToInstructor(traineeId, instructorId);
      if (app.updateEmployee) {
        app.updateEmployee(traineeId, {
          instructorId: result.instructor.id,
          applicationStatus: 'pending',
          approvalStatus: 'pending',
          linkedAt: new Date().toISOString(),
        });
      }
      toast.success(`Successfully enrolled with ${result.instructor.name || 'Instructor'}! Awaiting coordinator approval.`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link to instructor');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Camera className="w-6 h-6 text-blue-600" />
          Interactive QR Scanner
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Scan enrollment QR codes, instructor badges, or student passes using your camera or file upload.
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl mb-6 max-w-md">
        <button
          onClick={() => setActiveTab('camera')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'camera'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera className="w-4 h-4" />
          Live Camera
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'upload'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload Image
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'manual'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Manual Code
        </button>
      </div>

      {/* Main Scanner Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        {/* Tab 1: Live Camera Viewfinder */}
        {activeTab === 'camera' && (
          <div className="space-y-4">
            <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
              />

              {/* Scanning Reticle & Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-blue-400/80 rounded-2xl relative shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br" />
                    <div className="w-full h-0.5 bg-blue-500/80 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_10px_#3b82f6]" />
                  </div>
                </div>
              )}

              {/* Camera Inactive / Error Fallback */}
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <VideoOff className="w-10 h-10 mb-2 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-300">
                    {cameraError || 'Camera is warming up...'}
                  </p>
                  <button
                    onClick={startCamera}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    Try Reconnecting Camera
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-center text-slate-500">
              Align the QR code within the blue square for instant automated decoding.
            </p>
          </div>
        )}

        {/* Tab 2: Upload File View */}
        {activeTab === 'upload' && (
          <div className="p-8 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl text-center bg-slate-50/50 transition-all">
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Drop your QR Code image here or browse</p>
            <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, JPEG screenshots and photos</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="mt-4 block mx-auto text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>
        )}

        {/* Tab 3: Manual Input View */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <textarea
              value={qr}
              onChange={(e) => setQr(e.target.value)}
              placeholder="Paste instructor QR token, trainee enrollment JSON, or text string here..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                onClick={() => verifyCode(qr)}
                disabled={loading || !qr.trim()}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 text-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
              {qr && (
                <button
                  onClick={() => {
                    setQr('');
                    setResult(null);
                  }}
                  className="rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold px-4 py-2.5 text-sm transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Verification Result Display */}
        {result && (
          <div className="mt-6 rounded-2xl border p-5 transition-all bg-slate-50 border-slate-200">
            {result.success ? (
              result.type === 'instructor' ? (
                /* Instructor Enrollment Result */
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold shadow-sm">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">Verified Instructor</h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase">
                          Coordinator
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-semibold">{result.instructor?.name || 'Instructor'}</p>
                      <p className="text-xs text-slate-500">{result.instructor?.email || 'No email recorded'}</p>
                    </div>
                  </div>

                  {app?.currentUser?.role === 'employee' && (
                    <button
                      onClick={handleLinkToInstructor}
                      disabled={linking}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Link className="w-4 h-4" />
                      {linking ? 'Enrolling...' : `Enroll with ${result.instructor?.name || 'this Instructor'}`}
                    </button>
                  )}
                </div>
              ) : (
                /* Trainee Profile Result */
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold shadow-sm">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">Verified Trainee Intern</h3>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold uppercase">
                          Active OJT
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-semibold">{result.trainee?.name || 'Student Intern'}</p>
                      <p className="text-xs text-slate-500">{result.trainee?.course || 'OJT Student'} • {result.trainee?.companyName || 'Host Establishment'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium">Student ID:</span>
                      <p className="font-bold text-slate-800">{result.trainee?.employeeId || 'OJT-XXXX'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Required Hours:</span>
                      <p className="font-bold text-blue-600">{result.trainee?.requiredHours || 300} hrs</p>
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* Verification Failed */
              <div className="flex items-start gap-3 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm">QR Code Verification Failed</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {typeof result.error === 'string' ? result.error : 'Invalid or unrecognized QR token.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
