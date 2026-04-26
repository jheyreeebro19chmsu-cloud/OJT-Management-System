import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, User, Building, GraduationCap, Camera, MapPin, Loader, ShieldCheck, UserCircle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { FaceCapture } from '../components/FaceCapture';
import { getCurrentLocation, isGeolocationPositionError } from '../utils/geo';
import { motion, AnimatePresence } from 'motion/react';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';

const stepsTrainee = ['Personal Info', 'Company Info', 'School Info', 'Face Registration'];
const stepsAdmin = ['Personal Info', 'Face Registration'];
const stepsHTE = ['Company Info', 'Contact Info'];

type LocationStatus = 'idle' | 'capturing' | 'captured' | 'denied' | 'error';
type UserRole = 'trainee' | 'admin' | 'hte' | null;

const PASSWORD_LENGTH = 12;
const PASSWORD_SETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  special: '!@#$%^&*?',
};
const PASSWORD_ALL = `${PASSWORD_SETS.upper}${PASSWORD_SETS.lower}${PASSWORD_SETS.numbers}${PASSWORD_SETS.special}`;

const INITIAL_FORM = {
  name: '',
  email: '',
  department: '',
  position: 'OJT Trainee',
  companyName: '',
  supervisorName: '',
  schoolName: '',
  course: '',
  employeeId: '',
  startDate: '',
  endDate: '',
  requiredHours: 486,
  contactPerson: '',
  contactPhone: '',
  companyAddress: '',
};

function generatePassword(length: number = PASSWORD_LENGTH): string {
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const chars = [
    pick(PASSWORD_SETS.upper),
    pick(PASSWORD_SETS.lower),
    pick(PASSWORD_SETS.numbers),
    pick(PASSWORD_SETS.special),
  ];
  for (let i = chars.length; i < length; i += 1) {
    chars.push(pick(PASSWORD_ALL));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function Register() {
  const { registerEmployee, registerHostSupervisor, updateEmployee } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(null);
  const [step, setStep] = useState(0);
  const [generatedPassword, setGeneratedPassword] = useState(() => generatePassword());
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [faceCapturing, setFaceCapturing] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>();

  // Registration location state
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [registrationLocation, setRegistrationLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [registrationAddress, setRegistrationAddress] = useState<string>('');

  const steps = role === 'admin' ? stepsAdmin : role === 'hte' ? stepsHTE : stepsTrainee;

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setStep(0);
    setForm(INITIAL_FORM);
    setGeneratedPassword(generatePassword());
    setPasswordCopied(false);
    setFaceRegistered(false);
    setPhoto(undefined);
    setFaceCapturing(false);
  };

  const regeneratePassword = () => {
    setGeneratedPassword(generatePassword());
    setPasswordCopied(false);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 1500);
    } catch {
      // Ignore clipboard errors (not supported or blocked)
    }
  };

  // Capture location on mount
  useEffect(() => {
    captureLocation();
  }, []);

  const captureLocation = async () => {
    setLocationStatus('capturing');
    try {
      const position = await getCurrentLocation();
      const { latitude, longitude } = position.coords;
      setRegistrationLocation({ lat: latitude, lng: longitude });
      setRegistrationAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      setLocationStatus('captured');
    } catch (err: unknown) {
      const isDenied = isGeolocationPositionError(err) && err.code === 1;
      setLocationStatus(isDenied ? 'denied' : 'error');
    }
  };

  const update = (field: string, value: string | number) => {
    // Keep numeric fields numeric, otherwise store as string
    const newValue = field === 'requiredHours' ? Number(value) : value;
    setForm(p => ({ ...p, [field]: newValue }));
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
  };
  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleFaceSuccess = (img?: string) => {
    setFaceRegistered(true);
    setPhoto(img);
    setFaceCapturing(false);
  };

  const handleSubmit = async () => {
    if (!role) return;

    if (role === 'hte') {
      registerHostSupervisor({
        name: form.contactPerson.trim() || form.name.trim() || 'HTE Supervisor',
        email: form.email.trim(),
        companyName: form.companyName.trim(),
        position: 'Training Supervisor',
        password: generatedPassword,
      });
      navigate('/host/feedback');
      return;
    }

    const empId = form.employeeId || `${role === 'admin' ? 'ADM' : 'OJT'}-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
    const newEmp = registerEmployee({
      ...form,
      employeeId: empId,
      position: role === 'admin' ? 'Administrator' : 'OJT Trainee',
      requiredHours: role === 'admin' ? 0 : Number(form.requiredHours),
      faceRegistered,
      photo,
      active: true,
      registrationLocation,
      registrationAddress: locationStatus === 'captured' ? registrationAddress : undefined,
      password: generatedPassword,
    });

    if (photo && isSecurityApiConfigured()) {
      try {
        const response = await registerFace({
          employee_id: newEmp.id,
          image: photo,
        });
        if (response.success && response.image_url) {
          updateEmployee(newEmp.id, { photo: response.image_url, faceRegistered: true });
        }
      } catch {
        // Keep local photo if backend is unavailable
      }
    }
    
    // Auto-redirect based on role
    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/app');
    }
  };

  const hasText = (value: unknown) => String(value ?? '').trim().length > 0;

  const isStepValid = () => {
    if (!role) return false;

    if (role === 'hte') {
      if (step === 0) return hasText(form.companyName) && hasText(form.companyAddress);
      return hasText(form.contactPerson) && hasText(form.email);
    }

    if (role === 'admin') {
      if (step === 0) return hasText(form.name) && hasText(form.email);
      return faceRegistered;
    }

    // Trainee / Employee
    if (step === 0) return hasText(form.name) && hasText(form.email);
    if (step === 1) return hasText(form.companyName) && hasText(form.supervisorName) && hasText(form.startDate) && hasText(form.endDate);
    if (step === 2) return hasText(form.schoolName) && hasText(form.course);
    return faceRegistered;
  };

  const stepValidationMessage = () => {
    if (!role) return null;
    if (isStepValid()) return null;

    if (role === 'hte') {
      if (step === 0) return 'Company name and company address are required.';
      return 'Contact person and email address are required.';
    }

    if (role === 'admin') {
      if (step === 0) return 'Full name and email address are required.';
      return 'Face registration is required to continue.';
    }

    if (step === 0) return 'Full name and email address are required.';
    if (step === 1) return 'Company name, supervisor, and dates are required.';
    if (step === 2) return 'School and course are required.';
    return 'Face registration is required to continue.';
  };

  

  const locationStatusConfig = {
    idle: { color: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Waiting for location...', icon: <MapPin size={14} className="text-gray-400" /> },
    capturing: { color: 'bg-sky-50 border-sky-200', text: 'text-sky-700', label: 'Capturing your registration location...', icon: <Loader size={14} className="text-sky-500 animate-spin" /> },
    captured: { color: 'bg-green-50 border-green-200', text: 'text-green-700', label: `Location captured: ${registrationAddress}`, icon: <Check size={14} className="text-green-500" /> },
    denied: { color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', label: 'Location permission denied. Continuing without location.', icon: <MapPin size={14} className="text-yellow-500" /> },
    error: { color: 'bg-orange-50 border-orange-200', text: 'text-orange-700', label: 'Could not capture location. Continuing without it.', icon: <MapPin size={14} className="text-orange-500" /> },
  };

  const locConfig = locationStatusConfig[locationStatus];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-sky-700 flex flex-col items-center justify-center px-4 py-8">
      <div className="absolute top-0 left-0 w-72 h-72 bg-sky-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-blue-200 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg">
              {role === null
                ? 'Select Registration Type'
                : role === 'admin'
                  ? 'Admin Registration'
                  : role === 'hte'
                    ? 'HTE Registration'
                    : 'Trainee Registration'}
            </h1>
            {role !== null && <p className="text-blue-200 text-xs">Step {step + 1} of {steps.length}</p>}
          </div>
        </div>

        {/* Progress - Only show when role is selected */}
        {role !== null && (
          <div className="flex gap-1.5 mb-6">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-sky-400' : 'bg-blue-700'}`}
              />
            ))}
          </div>
        )}

        {/* Location status bar - Only show when role is selected */}
        {role !== null && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border mb-4 ${locConfig.color} ${locConfig.text}`}>
            {locConfig.icon}
            <span className="flex-1 truncate">{locConfig.label}</span>
            {(locationStatus === 'denied' || locationStatus === 'error') && (
              <button onClick={captureLocation} className="underline shrink-0">Retry</button>
            )}
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          <AnimatePresence mode="wait">
            {/* Role Selection Screen */}
            {role === null && (
              <motion.div
                key="role-select"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <h2 className="font-bold text-gray-800 text-lg">Choose Your Role</h2>
                  <p className="text-sm text-gray-500 mt-1">Select how you want to register</p>
                </div>

                <button
                  onClick={() => selectRole('trainee')}
                  className="w-full p-5 border-2 border-blue-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-500 transition-colors shrink-0">
                      <UserCircle size={28} className="text-blue-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1">Trainee / Employee</h3>
                      <p className="text-xs text-gray-500">Register as an OJT trainee or employee. You'll complete a full registration with company and school information.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => selectRole('admin')}
                  className="w-full p-5 border-2 border-purple-200 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-500 transition-colors shrink-0">
                      <ShieldCheck size={28} className="text-purple-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1">Administrator</h3>
                      <p className="text-xs text-gray-500">Register as an admin or supervisor. You'll have access to manage employees, view reports, and configure settings.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => selectRole('hte')}
                  className="w-full p-5 border-2 border-green-200 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-500 transition-colors shrink-0">
                      <Building size={28} className="text-green-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1">Host Training Establishment (HTE)</h3>
                      <p className="text-xs text-gray-500">Register as an HTE representative. You'll monitor employee attendance, rendered hours, and manage registrations.</p>
                    </div>
                  </div>
                </button>

                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-center text-xs text-gray-400">
                    Already have an account?{' '}
                    <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
                      Sign in here
                    </Link>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 0: Personal Info - Only show when role is selected */}
            {role !== null && role !== 'hte' && step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User size={16} className="text-blue-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Personal Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Full Name *</label>
                    <input value={form.name} onChange={e => update('name', e.target.value)}
                      placeholder="Juan Dela Cruz" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Email Address *</label>
                    <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                      placeholder="your@email.com" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Employee ID (optional)</label>
                    <input value={form.employeeId} onChange={e => update('employeeId', e.target.value)}
                      placeholder="Auto-generated if empty" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Department</label>
                    <input value={form.department} onChange={e => update('department', e.target.value)}
                      placeholder="e.g. Information Technology" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  {locationStatus === 'captured' && (
                    <div className="bg-green-50 rounded-xl p-3 flex items-start gap-2">
                      <MapPin size={14} className="text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-green-700">Registration Location Captured</p>
                        <p className="text-xs text-green-600 font-mono mt-0.5">{registrationAddress}</p>
                        <p className="text-xs text-green-500 mt-0.5">This will be stored with your registration record.</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {role === 'hte' && step === 0 && (
              <motion.div key="hte-step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Building size={16} className="text-green-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Company Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Company Name *</label>
                    <input value={form.companyName} onChange={e => update('companyName', e.target.value)}
                      placeholder="Company Name" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Company Address *</label>
                    <input value={form.companyAddress} onChange={e => update('companyAddress', e.target.value)}
                      placeholder="Company Address" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                </div>
              </motion.div>
            )}

            {role === 'trainee' && step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                    <Building size={16} className="text-sky-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Company Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Company Name *</label>
                    <input value={form.companyName} onChange={e => update('companyName', e.target.value)}
                      placeholder="Company Name" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Supervisor Name *</label>
                    <input value={form.supervisorName} onChange={e => update('supervisorName', e.target.value)}
                      placeholder="Mr./Ms. Supervisor" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Start Date *</label>
                      <input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">End Date *</label>
                      <input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Required OJT Hours</label>
                    <input type="number" value={form.requiredHours} onChange={e => update('requiredHours', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                </div>
              </motion.div>
            )}

            {role === 'hte' && step === 1 && (
              <motion.div key="hte-step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User size={16} className="text-blue-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Contact Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Contact Person *</label>
                    <input value={form.contactPerson} onChange={e => update('contactPerson', e.target.value)}
                      placeholder="Full Name" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Email Address *</label>
                    <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                      placeholder="your@email.com" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Contact Phone</label>
                    <input value={form.contactPhone} onChange={e => update('contactPhone', e.target.value)}
                      placeholder="09xxxxxxxxx" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                </div>
              </motion.div>
            )}

            {role === 'trainee' && step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <GraduationCap size={16} className="text-green-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">School Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">School / University *</label>
                    <input value={form.schoolName} onChange={e => update('schoolName', e.target.value)}
                      placeholder="University Name" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Course / Program *</label>
                    <input value={form.course} onChange={e => update('course', e.target.value)}
                      placeholder="e.g. BS Information Technology" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                </div>

              </motion.div>
            )}

            {(role === 'trainee' && step === 3) || (role === 'admin' && step === 1) ? (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Camera size={16} className="text-purple-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Face Registration</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">Register your face for biometric time recording. The captured image will be stored in the system for identity verification during clock-in/out.</p>

                {faceCapturing ? (
                  <FaceCapture
                    mode="register"
                    employeeName={form.name}
                    onSuccess={handleFaceSuccess}
                    onCancel={() => setFaceCapturing(false)}
                    autoStart
                  />
                ) : faceRegistered ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-green-300">
                      {photo ? (
                        <img src={photo} alt="Registered Face" className="w-full h-full object-cover rounded-full" style={{ transform: 'scaleX(-1)' }} />
                      ) : (
                        <Check size={36} className="text-green-600" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-green-700">Face Registered!</p>
                      <p className="text-xs text-gray-500 mt-0.5">Your biometric image has been captured and will be stored</p>
                    </div>
                    <button onClick={() => { setFaceRegistered(false); setFaceCapturing(true); }}
                      className="text-xs text-blue-600 hover:text-blue-800">Re-register face</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300">
                      <Camera size={28} className="text-gray-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">No face registered yet</p>
                      <p className="text-xs text-gray-400 mt-0.5">Required for biometric time recording</p>
                    </div>
                    <button onClick={() => setFaceCapturing(true)}
                      className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2">
                      <Camera size={16} />
                      Register Face
                    </button>
                  </div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {role !== null && (
            <div className="mt-4 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-indigo-700">Generated Password</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={regeneratePassword}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    {passwordCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <code className="text-sm font-mono font-bold text-indigo-800 bg-white px-2 py-1 rounded-lg border border-indigo-100">
                  {generatedPassword}
                </code>
              </div>
              <p className="text-xs text-indigo-600 mt-2">Save this password. You'll need it to log in.</p>
            </div>
          )}

          {/* Navigation - Only show when role is selected */}
          {role !== null && (
            <div className="flex gap-3 mt-6">
              {step > 0 && (
                <button onClick={handleBack}
                  className="flex items-center gap-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}
              {step < steps.length - 1 ? (
                <button onClick={handleNext} disabled={!isStepValid()}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Next
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={!isStepValid()}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Check size={14} />
                  Complete Registration
                </button>
              )}
            </div>
          )}

          {role !== null && !isStepValid() && (
            <p className="text-center text-xs text-gray-400 mt-2">{stepValidationMessage()}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
