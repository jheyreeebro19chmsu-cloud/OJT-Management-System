import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  Building,
  Camera,
  MapPin,
  Loader,
  Mail,
  Clock,
  CheckCircle,
} from 'lucide-react';

import { FaceCapture } from '../components/FaceCapture';
import { Country, State, City } from 'country-state-city';
import { getCurrentLocation } from '../utils/geo';

// Fix Leaflet marker icon for many bundlers
try {
  // @ts-ignore - delete private internals for bundlers that embed icons
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
  });
} catch (e) {
  // ignore
}

type UserRole = 'trainee' | 'hte' | null;
type RegistrationStep = 'role' | 'info' | 'location' | 'request' | 'waiting' | 'face' | 'complete';

export function RegisterOTP() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(null);
  const [step, setStep] = useState<RegistrationStep>('role');
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [instructorEmail, setInstructorEmail] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    street: '',
    country: 'PH',
    region: '',
    province: '',
    city: '',
    barangay: '',
    schoolName: '',
    course: '',
    yearLevel: '',
    companyName: '',
    companyAddress: '',
    contactPerson: '',
    contactPhone: '',
  });

  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'captured' | 'error'>('idle');
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [facePhoto, setFacePhoto] = useState<string | undefined>();
  const [faceData, setFaceData] = useState('');

  const allCountries = Country.getAllCountries();
  const statesList = form.country ? State.getStatesOfCountry(form.country) : [];
  const citiesList = form.country && form.region ? City.getCitiesOfState(form.country, form.region) : [];

  const captureLocation = async () => {
    setLocationStatus('loading');
    try {
      const pos = await getCurrentLocation();
      if (pos && pos.coords) {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocationStatus('captured');
      }
    } catch (err) {
      console.error('Location error', err);
      setLocationStatus('error');
    }
  };

  // Capture location when user enters the location step; defer to next tick
  useEffect(() => {
    if (step !== 'location') return;
    const t = setTimeout(() => {
      captureLocation();
    }, 0);
    return () => clearTimeout(t);
  }, [step]);

  const selectRole = (r: UserRole) => {
    setRole(r);
    setStep('info');
  };

  const handleFormChange = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value } as any));
  };

  const validateInfo = () => {
    // Only validate email format if provided
    if (form.email && !form.email.includes('@')) {
      toast.error('Enter a valid email');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'info' && !validateInfo()) return;
    if (step === 'location' && !location) {
      toast.error('Please capture location');
      return;
    }
    if (step === 'info') setStep('location');
    else if (step === 'location') setStep('request');
  };

  const handleBack = () => {
    if (step === 'info') {
      setRole(null);
      setStep('role');
    } else if (step === 'location') setStep('info');
    else if (step === 'request') setStep('location');
    else if (step === 'face') setStep('waiting');
  };

  const handleRequestOTP = async () => {
    if (!instructorEmail) return toast.error('Enter instructor email');
    setLoading(true);
    try {
      const payload: any = {
        email: form.email,
        first_name: form.firstName,
        last_name: form.lastName,
        role: role,
        instructor_email: instructorEmail,
      };
      if (location) {
        payload.gps_latitude = location.lat;
        payload.gps_longitude = location.lng;
        if ((location as any).accuracy) payload.gps_accuracy = (location as any).accuracy;
      }
      if (form.companyName) payload.company_name = form.companyName;
      if (form.schoolName) payload.school_name = form.schoolName;

      const res = await fetch('/api/security/auth/request-trainee-otp-registration/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => 'Request failed');
        throw new Error(err);
      }
      const data = await res.json();
      setRequestId(data.request_id || null);
      setStep('waiting');
      toast.success('Request sent to instructor');
      startPollingApproval(data.request_id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const startPollingApproval = (reqId: string) => {
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/security/auth/check-registration-status/?request_id=${reqId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'approved') {
          clearInterval(id);
          toast.success('Approved — proceed to face recognition');
          setStep('face');
        }
      } catch (e) {
        console.error('poll', e);
      }
    }, 5000);
    // stop after 30 minutes
    setTimeout(() => clearInterval(id), 30 * 60 * 1000);
  };

  const handleFaceSuccess = (img?: string) => {
    setFacePhoto(img);
    setShowFaceCapture(false);
  };

  const handleCompleteFaceRecognition = async () => {
    if (!facePhoto) return toast.error('Capture face photo');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('request_id', requestId || '');
      fd.append('face_data', faceData || '');
      if (facePhoto.startsWith('data:')) {
        const [, b64] = facePhoto.split(',');
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: 'image/jpeg' });
        fd.append('avatar', blob, 'face.jpg');
      }
      const res = await fetch('/api/security/auth/submit-face-recognition/', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error('Face submission failed');
      toast.success('Face recognition successful');
      setStep('complete');
    } catch (err: any) {
      toast.error(err?.message || 'Face recognition failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!form.password || form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const payload = { request_id: requestId, password: form.password };
      const res = await fetch('/api/security/auth/complete-trainee-registration/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => 'Registration failed');
        throw new Error(err);
      }
      const data = await res.json();
      toast.success('Registration completed');
      if (data.tokens) {
        localStorage.setItem('access_token', data.tokens.access);
        localStorage.setItem('refresh_token', data.tokens.refresh);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));

        try {
          // Persist a minimal Employee record so the SPA can show profile + photo immediately
          const existing = localStorage.getItem('ojt_employees');
          const employees = existing ? JSON.parse(existing) : [];
          const newEmp = {
            id: data.user.id ? String(data.user.id) : `emp-${Date.now()}`,
            name: data.user.name || data.user.email || 'New User',
            employeeId: data.user.id ? String(data.user.id) : `emp-${Date.now()}`,
            email: data.user.email || '',
            department: data.user.department || '',
            position: data.user.role === 'trainee' ? 'OJT Trainee' : data.user.role,
            companyName: data.user.company || '',
            supervisorName: '',
            schoolName: data.user.school || '',
            course: data.user.course || '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            requiredHours: 0,
            photo: data.user.avatar || '',
            faceRegistered: true,
            createdAt: new Date().toISOString().split('T')[0],
            active: true,
          };
          employees.push(newEmp);
          localStorage.setItem('ojt_employees', JSON.stringify(employees));

          // Also set the app's current user key so the provider can pick it up on reload
          const currentUser = {
            id: newEmp.id,
            name: newEmp.name,
            role: newEmp.position === 'OJT Trainee' ? 'employee' : 'employee',
            employeeId: newEmp.id,
          };
          localStorage.setItem('ojt_current_user', JSON.stringify(currentUser));
        } catch (e) {
          // ignore storage errors
        }
      }

      // Give UI a moment then reload so AppProvider picks up the new current user and employee
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (err: any) {
      toast.error(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">OJT Registration</h1>
          <p className="text-gray-600">
            {step === 'role' && 'Select your role to get started'}
            {step === 'info' && `Complete your ${role} information`}
            {step === 'location' && 'Capture your current location'}
            {step === 'request' && 'Request approval from your instructor'}
            {step === 'waiting' && 'Waiting for instructor approval'}
            {step === 'face' && 'Proceed with face recognition'}
            {step === 'complete' && 'Complete your registration'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'role' && (
            <motion.div key="role" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => selectRole('trainee')} className="p-6 rounded-lg border-2 border-transparent hover:border-blue-500 bg-white hover:shadow-lg transition-all">
                  <GraduationCap className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-1">OJT Trainee</h3>
                  <p className="text-sm text-gray-600">Student undergoing on-the-job training</p>
                </button>

                <button onClick={() => selectRole('hte')} className="p-6 rounded-lg border-2 border-transparent hover:border-green-500 bg-white hover:shadow-lg transition-all">
                  <Building className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-1">HTE</h3>
                  <p className="text-sm text-gray-600">Host Training Establishment representative</p>
                </button>
              </div>
            </motion.div>
          )}

          {step === 'info' && (
            <motion.div key="info" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="First Name *" value={form.firstName} onChange={(e) => handleFormChange('firstName', e.target.value)} className="px-4 py-2 border rounded-lg" />
                <input type="text" placeholder="Last Name *" value={form.lastName} onChange={(e) => handleFormChange('lastName', e.target.value)} className="px-4 py-2 border rounded-lg" />
              </div>
              <input type="email" placeholder="Email *" value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              <input type="number" placeholder="Age" value={form.age} onChange={(e) => handleFormChange('age', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              <input type="text" placeholder="Street Address" value={form.street} onChange={(e) => handleFormChange('street', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              {role === 'trainee' && (
                <>
                  <input type="text" placeholder="School Name *" value={form.schoolName} onChange={(e) => handleFormChange('schoolName', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                  <input type="text" placeholder="Course *" value={form.course} onChange={(e) => handleFormChange('course', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                </>
              )}
              {role === 'hte' && (
                <>
                  <input type="text" placeholder="Company Name *" value={form.companyName} onChange={(e) => handleFormChange('companyName', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                  <input type="text" placeholder="Company Address *" value={form.companyAddress} onChange={(e) => handleFormChange('companyAddress', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                </>
              )}
              <div className="flex gap-3 pt-4">
                <button onClick={handleBack} className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg"> <ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleNext} className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg">Next <ArrowRight className="w-4 h-4" /></button>
              </div>
            </motion.div>
          )}

          {step === 'location' && (
            <motion.div key="location" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Capture Location</h3>
                {locationStatus === 'captured' && <CheckCircle className="w-5 h-5 text-green-500" />}
              </div>
              {location ? (
                <div className="space-y-4">
                  <div className="h-64 rounded-lg overflow-hidden border">
                    <MapContainer center={[location.lat, location.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[location.lat, location.lng]} />
                    </MapContainer>
                  </div>
                  <p className="text-sm text-gray-600">Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
                </div>
              ) : locationStatus === 'loading' ? (
                <div className="flex items-center justify-center h-64"><Loader className="w-8 h-8 text-blue-600 animate-spin" /></div>
              ) : (
                <div className="h-64 rounded-lg bg-gray-100 flex items-center justify-center">
                  <button onClick={captureLocation} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg"><MapPin className="w-4 h-4" /> Capture Location</button>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button onClick={handleBack} className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg"> <ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleNext} disabled={!location} className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400">Next <ArrowRight className="w-4 h-4" /></button>
              </div>
            </motion.div>
          )}

          {step === 'request' && (
            <motion.div key="request" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold mb-4">Request OTP Approval</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">An OTP will be sent to your instructor for approval. Once approved you will receive it by email.</p>
              </div>
              <input type="email" placeholder="Instructor Email *" value={instructorEmail} onChange={(e) => setInstructorEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              <div className="flex gap-3 pt-4">
                <button onClick={handleBack} className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg"> <ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleRequestOTP} disabled={loading || !instructorEmail} className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg disabled:bg-gray-400">{loading ? <><Loader className="w-4 h-4 animate-spin" /> Requesting...</> : <><Mail className="w-4 h-4" /> Request OTP</>}</button>
              </div>
            </motion.div>
          )}

          {step === 'waiting' && (
            <motion.div key="waiting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Clock className="w-16 h-16 text-blue-500 animate-pulse" />
                <h3 className="text-2xl font-semibold text-center">Waiting for Approval</h3>
                <p className="text-center text-gray-600 max-w-md">Your registration request has been sent to your instructor. You will receive an email with your OTP code once approved.</p>
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 animate-pulse" style={{ width: '50%' }} /></div>
                <p className="text-sm text-gray-500">Check your email periodically for the OTP code</p>
              </div>
            </motion.div>
          )}

          {step === 'face' && (
            <motion.div key="face" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold mb-4">Face Recognition</h3>
              {showFaceCapture ? <FaceCapture mode="register" onSuccess={handleFaceSuccess} onCancel={() => setShowFaceCapture(false)} /> : facePhoto ? (
                <div className="space-y-4">
                  <img src={facePhoto} alt="Face" className="w-full h-64 object-cover rounded-lg" />
                  <button onClick={() => setShowFaceCapture(true)} className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg">Retake Photo</button>
                </div>
              ) : (
                <button onClick={() => setShowFaceCapture(true)} className="w-full flex items-center justify-center gap-2 px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg"> <Camera className="w-6 h-6" /> <span>Capture Face Photo</span></button>
              )}
              <div className="flex gap-3 pt-4">
                <button onClick={handleBack} className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg"> <ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleCompleteFaceRecognition} disabled={loading || !facePhoto} className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400">{loading ? <><Loader className="w-4 h-4 animate-spin" /> Processing...</> : <><Check className="w-4 h-4" /> Next</>}</button>
              </div>
            </motion.div>
          )}

          {step === 'complete' && (
            <motion.div key="complete" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold mb-4">Complete Registration</h3>
              <div className="space-y-4">
                <input type="password" placeholder="Password *" value={form.password} onChange={(e) => handleFormChange('password', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                <input type="password" placeholder="Confirm Password *" value={form.confirmPassword} onChange={(e) => handleFormChange('confirmPassword', e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleBack} className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg"> <ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleCompleteRegistration} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg">{loading ? <><Loader className="w-4 h-4 animate-spin" /> Completing...</> : <><CheckCircle className="w-4 h-4" /> Complete Registration</>}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
