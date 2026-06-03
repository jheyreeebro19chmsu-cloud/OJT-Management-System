import L from 'leaflet';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  Building,
  GraduationCap,
  Camera,
  MapPin,
  ShieldCheck,
  Loader,
  UserCircle,
  X,
  Mail,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { FaceCapture } from '../components/FaceCapture';
import { PH_ADDRESS_DATA } from '../data/ph_address_data';
import { Country, State, City } from 'country-state-city';

import { authAPI } from '../services/authApi';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import { getCurrentLocation, isGeolocationPositionError } from '../utils/geo';

// Fix Leaflet marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
});

type UserRole = 'trainee' | 'hte' | null;
type RegistrationStep = 'role' | 'info' | 'location' | 'request' | 'waiting' | 'face' | 'complete';

export function RegisterOTP() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(null);
  const [step, setStep] = useState<RegistrationStep>('role');
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [instructorEmail, setInstructorEmail] = useState('');

  // Form state
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    address: '',
    country: 'PH',
    region: '',
    province: '',
    city: '',
    barangay: '',
    street: '',
    // School info (trainee)
    school_name: '',
    course: '',
    year_level: '',
    // Company info
    company_name: '',
    company_address: '',
    contact_person: '',
    contact_phone: '',
  });

  // Location state
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'captured' | 'error'>('idle');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Face recognition state
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [facePhoto, setFacePhoto] = useState<string | undefined>();
  const [faceData, setFaceData] = useState('');

  // Location lists
  const allCountries = Country.getAllCountries();
  const statesList = form.country ? State.getStatesOfCountry(form.country) : [];
  const citiesList = form.country && form.region ? City.getCitiesOfState(form.country, form.region) : [];

  // Capture location on mount
  useEffect(() => {
    if (step === 'location') {
      captureLocation();
    }
  }, [step]);

  const captureLocation = async () => {
    setLocationStatus('loading');
    try {
      const pos = await getCurrentLocation();
      if (pos) {
        setLocation({ lat: pos.latitude, lng: pos.longitude });
        setLocationStatus('captured');
      }
    } catch (error) {
      console.error('Location error:', error);
      setLocationStatus('error');
    }
  };

  const selectRole = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setStep('info');
  };

  const handleFormChange = (key: string, value: string) => {
    setForm((prev) => {
      const newForm = { ...prev, [key]: value } as any;
      // Auto-calculate age if birthdate is provided
      if (key === 'birthdate') {
        const birthDate = new Date(value);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
          newForm.age = age.toString();
        }
      }
      return newForm;
    });
  };

  const validateInfo = (): boolean => {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error('Please fill in all required fields');
      return false;
    }
    if (!form.email.includes('@')) {
      toast.error('Please enter a valid email');
      return false;
    }
    if (role === 'trainee') {
      if (!form.school_name || !form.course) {
        toast.error('Please fill in school information');
        return false;
      }
    } else if (role === 'hte') {
      if (!form.company_name || !form.company_address) {
        toast.error('Please fill in company information');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'info' && !validateInfo()) return;
    if (step === 'location' && !location) {
      toast.error('Please capture your location');
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
    if (!instructorEmail) {
      toast.error('Please enter your instructor email');
      return;
    }

    setLoading(true);
    try {
      // First, get the instructor's ID from email (this would need a lookup endpoint)
      // For now, we'll assume instructorEmail is passed as ID or we need to fetch it
      // You may need to create an endpoint to get instructor by email
      
      const payload = {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        role: role,
        instructor_email: instructorEmail,
        age: form.age ? parseInt(form.age) : undefined,
        address: form.street,
        gps_latitude: location?.lat,
        gps_longitude: location?.lng,
        school_name: form.school_name,
        course: form.course,
        year_level: form.year_level,
        company_name: form.company_name,
        company_address: form.company_address,
        barangay: form.barangay,
        contact_person: form.contact_person,
        contact_phone: form.contact_phone,
      };

      // This endpoint will be created in the backend
      const res = await fetch('/api/security/auth/request-trainee-otp-registration/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to request OTP');
      }

      const data = await res.json();
      setRequestId(data.request_id);
      setStep('waiting');
      toast.success('Registration request sent to instructor!');

      // Poll for approval every 5 seconds
      pollForApproval(data.request_id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const pollForApproval = async (reqId: string) => {
    // This is a simple polling mechanism
    // In production, you'd use WebSockets or SSE
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/security/auth/check-registration-status/?request_id=${reqId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.status === 'approved') {
          clearInterval(pollInterval);
          toast.success('Request approved! Proceed to face recognition.');
          setStep('face');
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 5000);

    // Stop polling after 30 minutes
    setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);
  };

  const handleFaceSuccess = (img?: string) => {
    setFacePhoto(img);
    setShowFaceCapture(false);
  };

  const handleCompleteFaceRecognition = async () => {
    if (!facePhoto) {
      toast.error('Please capture a face photo');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('request_id', requestId || '');
      formData.append('face_data', faceData);

      // Convert base64 photo to blob
      if (facePhoto.startsWith('data:')) {
        const [header, data] = facePhoto.split(',');
        const bstr = atob(data);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
        const blob = new Blob([u8arr], { type: 'image/jpeg' });
        formData.append('avatar', blob, 'face.jpg');
      }

      // This would submit face recognition
      const res = await fetch('/api/security/auth/submit-face-recognition/', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Face recognition failed');
      
      setStep('complete');
      toast.success('Face recognition successful!');
    } catch (error: any) {
      toast.error(error.message || 'Face recognition failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!form.password || form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        request_id: requestId,
        password: form.password,
      };

      const res = await fetch('/api/security/auth/complete-trainee-registration/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await res.json();
      toast.success('Registration completed successfully!');
      
      // Store tokens and redirect to dashboard
      localStorage.setItem('access_token', data.tokens.access);
      localStorage.setItem('refresh_token', data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setTimeout(() => {
        navigate(role === 'trainee' ? '/dashboard' : '/hte-dashboard');
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
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

        {/* Content */}
        <AnimatePresence mode="wait">
          {step === 'role' && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => selectRole('trainee')}
                  className="p-6 rounded-lg border-2 border-transparent hover:border-blue-500 bg-white hover:shadow-lg transition-all"
                >
                  <GraduationCap className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-1">OJT Trainee</h3>
                  <p className="text-sm text-gray-600">Student undergoing on-the-job training</p>
                </button>

                <button
                  onClick={() => selectRole('hte')}
                  className="p-6 rounded-lg border-2 border-transparent hover:border-green-500 bg-white hover:shadow-lg transition-all"
                >
                  <Building className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-1">HTE</h3>
                  <p className="text-sm text-gray-600">Host Training Establishment representative</p>
                </button>
              </div>
            </motion.div>
          )}

          {step === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-lg shadow-lg p-6 space-y-4"
            >
              {/* Personal Info */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={form.first_name}
                  onChange={(e) => handleFormChange('first_name', e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Last Name *"
                  value={form.last_name}
                  onChange={(e) => handleFormChange('last_name', e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <input
                type="email"
                placeholder="Email *"
                value={form.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="number"
                placeholder="Age"
                value={form.age}
                onChange={(e) => handleFormChange('age', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="text"
                placeholder="Street Address"
                value={form.street}
                onChange={(e) => handleFormChange('street', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Role-specific fields */}
              {role === 'trainee' && (
                <>
                  <input
                    type="text"
                    placeholder="School Name *"
                    value={form.school_name}
                    onChange={(e) => handleFormChange('school_name', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Course *"
                    value={form.course}
                    onChange={(e) => handleFormChange('course', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Year Level"
                    value={form.year_level}
                    onChange={(e) => handleFormChange('year_level', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={form.company_name}
                    onChange={(e) => handleFormChange('company_name', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Company Address"
                    value={form.company_address}
                    onChange={(e) => handleFormChange('company_address', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </>
              )}

              {role === 'hte' && (
                <>
                  <input
                    type="text"
                    placeholder="Company Name *"
                    value={form.company_name}
                    onChange={(e) => handleFormChange('company_name', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Company Address *"
                    value={form.company_address}
                    onChange={(e) => handleFormChange('company_address', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Barangay"
                    value={form.barangay}
                    onChange={(e) => handleFormChange('barangay', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Contact Person"
                    value={form.contact_person}
                    onChange={(e) => handleFormChange('contact_person', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="tel"
                    placeholder="Contact Phone"
                    value={form.contact_phone}
                    onChange={(e) => handleFormChange('contact_phone', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'location' && (
            <motion.div
              key="location"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-lg shadow-lg p-6 space-y-4"
            >
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
                  <p className="text-sm text-gray-600">
                    Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                </div>
              ) : locationStatus === 'loading' ? (
                <div className="flex items-center justify-center h-64">
                  <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : (
                <div className="h-64 rounded-lg bg-gray-100 flex items-center justify-center">
                  <button
                    onClick={captureLocation}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <MapPin className="w-4 h-4" />
                    Capture Location
                  </button>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!location}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'request' && (
            <motion.div
              key="request"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-lg shadow-lg p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold mb-4">Request OTP Approval</h3>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  An OTP code will be sent to your instructor for approval. Once approved, you'll receive the code via email to proceed with face recognition.
                </p>
              </div>

              <input
                type="email"
                placeholder="Your Instructor's Email *"
                value={instructorEmail}
                onChange={(e) => setInstructorEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Navigation */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleRequestOTP}
                  disabled={loading || !instructorEmail}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Request OTP
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-lg shadow-lg p-6 space-y-4"
            >
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Clock className="w-16 h-16 text-blue-500 animate-pulse" />
                <h3 className="text-2xl font-semibold text-center">Waiting for Approval</h3>
                <p className="text-center text-gray-600 max-w-md">
                  Your registration request has been sent to your instructor. You'll receive an email with your OTP code once approved.
                </p>
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 animate-pulse" style={{ width: '50%' }}></div>
                </div>
                <p className="text-sm text-gray-500">Check your email periodically for the OTP code</p>
              </div>
            </motion.div>
          )}

          {step === 'face' && (
            <motion.div
              key="face"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-lg shadow-lg p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold mb-4">Face Recognition</h3>

              {showFaceCapture ? (
                <FaceCapture
                  onSuccess={handleFaceSuccess}
                  onCancel={() => setShowFaceCapture(false)}
                />
              ) : facePhoto ? (
                <div className="space-y-4">
                  <img src={facePhoto} alt="Face" className="w-full h-64 object-cover rounded-lg" />
                  <button
                    onClick={() => setShowFaceCapture(true)}
                    className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                  >
                    Retake Photo
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowFaceCapture(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50"
                >
                  <Camera className="w-6 h-6" />
                  <span>Capture Face Photo</span>
                </button>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleCompleteFaceRecognition}
                  disabled={loading || !facePhoto}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Next
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-lg shadow-lg p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold mb-4">Complete Registration</h3>

              <div className="space-y-4">
                <input
                  type="password"
                  placeholder="Password *"
                  value={form.password}
                  onChange={(e) => handleFormChange('password', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="Confirm Password *"
                  value={form.confirmPassword}
                  onChange={(e) => handleFormChange('confirmPassword', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Navigation */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleCompleteRegistration}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Complete Registration
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
