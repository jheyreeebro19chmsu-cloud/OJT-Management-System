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
  Search,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { FaceCapture } from '../components/FaceCapture';
import { sendWelcomeEmail, sendOtpEmail } from '../lib/resend';


import { PH_ADDRESS_DATA, BARANGAY_SAMPLES } from '../data/ph_address_data';


import addressApi from '../services/addressApi';
import { authAPI } from '../services/authApi';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import { useApp } from '../store/AppContext';
import { getCurrentLocation, isGeolocationPositionError } from '../utils/geo';

// Fix Leaflet marker icon using a method that's safer for production builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
});

const stepsTrainee = ['Personal Info', 'Company Info', 'School Info', 'Face Registration'];
const stepsAdmin = ['Personal Info', 'Face Registration'];
const stepsHTE = ['Company Info', 'Contact Info'];

type LocationStatus = 'idle' | 'capturing' | 'captured' | 'denied' | 'error';
type UserRole = 'trainee' | 'admin' | 'hte' | null;

export function Register() {
  const { registerEmployee, updateEmployee, employees, hostSupervisors } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(null);
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [faceCapturing, setFaceCapturing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    first_name: '',
    last_name: '',
    middle_initial: '',
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
    birthdate: '',
    age: '',
    country: 'PH',
    country_manual: '',
    region: '',
    region_manual: '',
    province: '',
    province_manual: '',
    city: '',
    city_manual: '',
    street: '',
    barangay: '',
    barangay_manual: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [registeredInstructorId, setRegisteredInstructorId] = useState('');

  const [faceRegistered, setFaceRegistered] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>();
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  // Registration location state
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [registrationLocation, setRegistrationLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [registrationAddress, setRegistrationAddress] = useState<string>('');
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);

  const steps = role === 'admin' ? stepsAdmin : role === 'hte' ? stepsHTE : stepsTrainee;

  // registration flow continues below

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setStep(0);
    // store pending oauth role for Google sign-in flow
    localStorage.setItem('pending_oauth_role', nextRole || '');
  };

  // Capture location on mount and detect OAuth HTE prefill
  useEffect(() => {
    captureLocation();

    try {
      const params = new URLSearchParams(window.location.search);
      const h = params.get('h');
      const pending = localStorage.getItem('pending_oauth_role');
      const oauthEmail = localStorage.getItem('oauth_email');
      const oauthName = localStorage.getItem('oauth_name');
      if (h === 'hte' || pending === 'hte') {
        setRole('hte');
        setOauthPending(true);
        if (oauthEmail) update('email', oauthEmail);
        if (oauthName) update('name', oauthName);
        // clear pending markers
        localStorage.removeItem('pending_oauth_role');
        localStorage.removeItem('oauth_email');
        localStorage.removeItem('oauth_name');
      }
    } catch {
      // ignore
    }
  }, []);

  const captureLocation = async () => {
    setLocationStatus('capturing');
    try {
      const position = await getCurrentLocation();
      const { latitude, longitude } = position.coords;
      setRegistrationLocation({ lat: latitude, lng: longitude });
      setLocationStatus('captured');
    } catch (err: unknown) {
      const isDenied = isGeolocationPositionError(err) && err.code === 1;
      setLocationStatus(isDenied ? 'denied' : 'error');
    }
  };

  const update = (field: string, value: string | number) => {
    setForm((p) => {
      const newForm = { ...p, [field]: value };

      // Auto-calculate age if birthdate changes
      if (field === 'birthdate' && typeof value === 'string' && value) {
        const birthDate = new Date(value);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          newForm.age = age.toString();
        }
      }

      return newForm;
    });
  };

  const handleAddressSearch = async (val: string) => {
    setAddressSearch(val);
    if (val.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    setSearchingAddress(true);
    try {
      // Fetch from both GeoNames and OSM for maximum coverage
      const [geoRes, osmRes] = await Promise.all([
        addressApi.autocompletePlaces(val),
        addressApi.searchGlobalAddress(val),
      ]);

      const geoItems = (geoRes.geonames || []).map((s: any) => ({ ...s, source: 'geonames' }));
      const osmItems = (osmRes.results || []).map((s: any) => ({ ...s, source: 'osm' }));

      setAddressSuggestions([...osmItems, ...geoItems].slice(0, 15));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchingAddress(false);
    }
  };

  const selectAddressSuggestion = async (s: any) => {
    if (s.source === 'osm') {
      const parsed = addressApi.parseOsmAddress(s);
      if (parsed) {
        setAddressSearch(parsed.formatted);
        update('country', parsed.country);
        update('region', parsed.region);
        update('province', parsed.province);
        update('city', parsed.city);

        // If it's PH, check if the city/barangay exists in our local data
        if (parsed.country === 'PH') {
          const regionData = PH_ADDRESS_DATA.find((r) => r.name === parsed.region);
          const provinceData = regionData?.provinces.find((p) => p.name === parsed.province);
          const cityExists = provinceData?.cities.includes(parsed.city);

          if (!cityExists) {
            update('city', 'other');
            update('city_manual', parsed.city);
          }

          const barangayList = BARANGAY_SAMPLES[parsed.city] || [];
          if (!barangayList.includes(parsed.barangay)) {
            update('barangay', 'other');
            update('barangay_manual', parsed.barangay);
          } else {
            update('barangay', parsed.barangay);
          }
        } else {
          update('barangay', parsed.barangay);
        }

        update('street', parsed.street);
        setRegistrationAddress(parsed.formatted);
      }
    } else {
      // GeoNames logic
      const countryCode = s.countryCode || 'PH';
      setAddressSearch(
        s.name + (s.adminName2 ? `, ${s.adminName2}` : '') + (s.countryName ? `, ${s.countryName}` : '')
      );
      update('country', countryCode);
      update('region', s.adminName1 || '');
      update('province', s.adminName2 || '');

      if (countryCode === 'PH') {
        update('city', 'other');
        update('city_manual', s.adminName2 || s.name || '');
        update('barangay', 'other');
        update('barangay_manual', s.name || '');
      } else {
        update('city', s.adminName2 || s.name || '');
        update('barangay', s.name || '');
      }

      const fullAddr = [s.name, s.adminName2, s.adminName1, s.countryName].filter(Boolean).join(', ');
      setRegistrationAddress(fullAddr);
    }
    setAddressSuggestions([]);
  };

  const handleRequestOtp = async () => {
    if (!form.email) {
      alert('Please enter your email first');
      return;
    }

    setOtpVerifying(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);

    try {
      const result = await sendOtpEmail(form.email, code);
      if (result.error) throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));

      setOtpSent(true);
      alert('Confirmation code sent to your email!');
    } catch (err: any) {
      console.error('OTP Error:', err);
      alert('Failed to send code: ' + (err.message || 'Unknown error'));
    } finally {
      setOtpVerifying(false);
    }
  };

  const verifyOtp = () => {
    if (otpCode === generatedOtp) {
      setIsOtpVerified(true);
      alert('Email verified successfully!');
    } else {
      alert('Invalid confirmation code. Please try again.');
    }
  };

  const handleShareQr = () => {
    const canvas = document.getElementById('instructor-qr') as HTMLCanvasElement;
    if (canvas) {
      // In a real browser app, we'd use navigator.share or download
      alert('QR Code is ready! You can right-click the image to save and share it.');
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep((s) => s + 1);
  };
  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleFaceSuccess = (img?: string) => {
    setFaceRegistered(true);
    setPhoto(img);
    setFaceCapturing(false);
  };

  const handleSubmit = async () => {
    const empId =
      form.employeeId ||
      `${role === 'admin' ? 'ADM' : 'OJT'}-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
    // If OTP was verified against backend, attempt server registration first
    if (true) {
      // bypass isOtpVerified check
      try {
        let first_name = form.first_name;
        let last_name = form.last_name;
        if (!first_name || !last_name) {
          const parts = (form.name || '').trim().split(/\s+/);
          first_name = parts.length > 0 ? parts[0] : form.name;
          last_name = parts.length > 1 ? parts.slice(1).join(' ') : '';
        }

        if (role === 'admin' || role === 'trainee') {
          const composedAddress = [form.street, form.city, form.country].filter(Boolean).join(', ');
          const payload = {
            email: form.email,
            password: form.password,
            first_name,
            last_name,
            middle_initial: form.middle_initial || undefined,
            age: form.age ? Number(form.age) : undefined,
            address: composedAddress || undefined,
          };
          const res = await authAPI.registerStudent(payload);
          if (res.data && (res.data as any).tokens) {
            // No auto-login: don't store tokens
          }
        } else if (role === 'hte') {
          const payload = {
            email: form.email,
            first_name: first_name,
            last_name: last_name,
            company_name: form.companyName,
            company_address: form.companyAddress,
          };
          const res = await authAPI.registerHTE(payload);
          if (res.data && (res.data as any).tokens) {
            // No auto-login: don't store tokens
          }
        }
      } catch (err) {
        // If server registration fails, fall back to local registration below
      }
    }

    // If OAuth HTE flow pending (no OTP), attempt HTE registration via backend
    if (oauthPending && role === 'hte') {
      try {
        const parts = (form.name || '').trim().split(/\s+/);
        const first_name = parts[0] || '';
        const last_name = parts.slice(1).join(' ') || '';
        const payload = {
          email: form.email,
          first_name,
          last_name,
          company_name: form.companyName,
          company_address: form.companyAddress,
          contact_person: form.contactPerson,
          contact_phone: form.contactPhone,
        };
        const res = await authAPI.registerHTE(payload);
        if (res.data && (res.data as any).tokens) {
          // No auto-login: don't store tokens
        }
      } catch (err) {
        // fallback: continue to local registration
      }
      setOauthPending(false);
    }

    const buildAddrFromForm = () => {
      const parts = [] as string[];
      if (form.barangay === 'other' && form.barangay_manual) {
        parts.push(form.barangay_manual);
      } else if (form.barangay) {
        parts.push(form.barangay);
      }
      if (form.street) parts.push(form.street);
      if (form.city) parts.push(form.city);
      if (form.province) parts.push(form.province);
      if (form.region) parts.push(form.region);
      if (form.country) {
        try {
          const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
          parts.push(regionNames.of(form.country) || form.country);
        } catch {
          parts.push(form.country === 'PH' ? 'Philippines' : form.country);
        }
      }
      return parts.filter(Boolean).join(', ');
    };

    const computedAddress = registrationAddress || buildAddrFromForm() || undefined;

    const newEmp = registerEmployee({
      ...form,
      employeeId: empId,
      position: role === 'admin' ? 'OJT Instructor' : role === 'hte' ? 'HTE Representative' : 'OJT Trainee',
      requiredHours: role === 'admin' ? 0 : Number(form.requiredHours),
      faceRegistered,
      photo,
      active: true,
      registrationLocation,
      registrationAddress: computedAddress,
      password: form.password,
    });

    if (role === 'admin') {
      setRegisteredInstructorId(newEmp.id);
    }

    if (photo && isSecurityApiConfigured()) {
      try {
        const response = await registerFace({
          employee_id: newEmp.id,
          image: photo,
        });
        if (response.success && response.image_url) {
          updateEmployee(newEmp.id, { photo: response.image_url, faceRegistered: true });
        }
        // Send Welcome Email via Resend
        try {
          await sendWelcomeEmail(newEmp.email, newEmp.name);
        } catch (emailErr) {
          console.error('Failed to send welcome email:', emailErr);
        }
      } catch {
        // Keep local photo if backend is unavailable
      }
    } else {
      // Send Welcome Email even if no photo registration
      try {
        await sendWelcomeEmail(newEmp.email, newEmp.name);
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
      }
    }

    // Auto-redirect based on role
    // Redirect to login after successful registration
    if (role === 'admin') {
      // For admin, show the success screen with QR code
      setRegistrationComplete(true);
      toast.success('Registration successful! Please save your QR code.');
    } else {
      toast.success('Registration successful! Please log in.');
      navigate('/login');
    }
  };

  const getValidationErrors = () => {
    const errors = [];

    const hasName = Boolean(form.name || ((form.first_name || '').trim() && (form.last_name || '').trim()));
    const hasEmail = Boolean(form.email && form.email.toString().trim());

    // Check for email duplication
    const emailExists =
      employees.some((e) => e.email.toLowerCase() === form.email.toLowerCase()) ||
      hostSupervisors.some((h) => h.email.toLowerCase() === form.email.toLowerCase());

    const hasUpper = /[A-Z]/.test(form.password);
    const hasLower = /[a-z]/.test(form.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(form.password);
    const hasLength = (form.password || '').length >= 8;
    const passwordsMatch = form.password && form.password === form.confirmPassword;
    const hasValidPassword = hasUpper && hasLower && hasSpecial && hasLength && passwordsMatch;

    const hasValidCountry = form.country === 'other' ? Boolean(form.country_manual?.trim()) : Boolean(form.country);
    const hasValidRegion = form.region === 'other' ? Boolean(form.region_manual?.trim()) : Boolean(form.region);
    const hasValidCity = form.city === 'other' ? Boolean(form.city_manual?.trim()) : Boolean(form.city);
    const hasValidBarangay = form.barangay === 'other' ? Boolean(form.barangay_manual?.trim()) : Boolean(form.barangay);
    const hasValidProvince =
      form.country === 'PH'
        ? form.province === 'other'
          ? Boolean(form.province_manual?.trim())
          : Boolean(form.province)
        : true;

    // Role-specific and Step-specific Validation
    if (role === 'admin') {
      if (step === 0) {
        if (!hasName) errors.push('Full Name');
        if (!hasEmail) errors.push('Valid Email');
        if (hasEmail && emailExists) errors.push('Email already in use');
        if (!hasValidPassword) errors.push('Password');
        if (!hasValidCountry) errors.push('Country');
        if (!hasValidRegion) errors.push('Region');
        if (!hasValidProvince) errors.push('Province');
        if (!hasValidCity) errors.push('City/Municipality');
        if (!hasValidBarangay) errors.push('Barangay');
        if (!form.department?.trim()) errors.push('Department');
        if (!form.course?.trim()) errors.push('Course');
      }
    }

    if (role === 'trainee') {
      if (step === 0) {
        if (!hasName) errors.push('Full Name');
        if (!hasEmail) errors.push('Valid Email');
        if (hasEmail && emailExists) errors.push('Email already in use');
        if (!hasValidPassword) errors.push('Password');
        if (!hasValidCountry) errors.push('Country');
        if (!hasValidRegion) errors.push('Region');
        if (!hasValidProvince) errors.push('Province');
        if (!hasValidCity) errors.push('City/Municipality');
        if (!hasValidBarangay) errors.push('Barangay');
        
        const hasAge = form.age !== '' && form.age !== undefined && form.age !== null;
        if (!hasAge) errors.push('Birthdate/Age');
        if (locationStatus !== 'captured') errors.push('Capture Location');
      }
      if (step === 1) {
        if (!form.companyName?.trim()) errors.push('Company Name');
        if (!form.startDate) errors.push('Start Date');
        if (!form.endDate) errors.push('End Date');
        if (!form.requiredHours) errors.push('OJT Hours');
      }
      if (step === 2) {
        if (!form.schoolName?.trim()) errors.push('School Name');
        if (!form.course?.trim()) errors.push('Course');
      }
    }

    if (role === 'hte') {
      if (step === 0) {
        if (!form.companyName?.trim()) errors.push('Company Name');
        if (!hasValidCountry) errors.push('Country');
        if (!hasValidRegion) errors.push('Region');
        if (!hasValidProvince) errors.push('Province');
        if (!hasValidCity) errors.push('City/Municipality');
        if (!hasValidBarangay) errors.push('Barangay');
        if (locationStatus !== 'captured') errors.push('Company Location');
      }
      if (step === 1) {
        if (!hasName) errors.push('Contact Name');
        if (!hasEmail) errors.push('Contact Email');
        if (hasEmail && emailExists) errors.push('Email already in use');
        if (!hasValidPassword) errors.push('Password');
        if (!form.username?.trim()) errors.push('Username');
        if (!form.contactPerson?.trim()) errors.push('Contact Person');
        if (!form.contactPhone?.trim()) errors.push('Contact Phone');
      }
    }

    return errors;
  };

  const isStepValid = () => {
    return getValidationErrors().length === 0;
  };

  const validationErrors = getValidationErrors();

  const locationStatusConfig = {
    idle: {
      color: 'bg-gray-50 border-gray-200',
      text: 'text-gray-500',
      label: 'Waiting for location...',
      icon: <MapPin size={14} className="text-gray-400" />,
    },
    capturing: {
      color: 'bg-sky-50 border-sky-200',
      text: 'text-sky-700',
      label: 'Capturing your registration location...',
      icon: <Loader size={14} className="text-sky-500 animate-spin" />,
    },
    captured: {
      color: 'bg-green-50 border-green-200',
      text: 'text-green-700',
      label: `Location captured: ${registrationAddress}`,
      icon: <Check size={14} className="text-green-500" />,
    },
    denied: {
      color: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-700',
      label: 'Location permission denied. Continuing without location.',
      icon: <MapPin size={14} className="text-yellow-500" />,
    },
    error: {
      color: 'bg-orange-50 border-orange-200',
      text: 'text-orange-700',
      label: 'Could not capture location. Continuing without it.',
      icon: <MapPin size={14} className="text-orange-500" />,
    },
  };

  const locConfig = locationStatusConfig[locationStatus];

  if (registrationComplete && role === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h2>
          <p className="text-gray-500 mb-8">
            Your OJT Instructor account has been created. Here is your enrollment QR Code:
          </p>

          <div className="bg-slate-50 p-6 rounded-2xl inline-block mb-8 border-2 border-dashed border-slate-200">
            <QRCodeSVG
              id="instructor-qr"
              value={`enroll:${registeredInstructorId}`}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="space-y-3">
            <button
              onClick={handleShareQr}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Share QR Code
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              Go to Login
            </button>
          </div>
          <p className="mt-6 text-xs text-slate-400 uppercase tracking-widest font-bold">
            Instruction: Students must scan this code to enroll under you.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-sky-700 flex flex-col items-center justify-center px-4 py-8">
      <div className="absolute top-0 left-0 w-72 h-72 bg-sky-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
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
                  ? 'OJT Instructor Registration'
                  : role === 'hte'
                    ? 'HTE Representative Registration'
                    : 'Trainee Registration'}
            </h1>
            {role !== null && (
              <p className="text-blue-200 text-xs">
                Step {step + 1} of {steps.length} • {steps[step]}
              </p>
            )}
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
          <div
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border mb-4 ${locConfig.color} ${locConfig.text}`}
          >
            {locConfig.icon}
            <span className="flex-1 truncate">{locConfig.label}</span>
            {(locationStatus === 'denied' || locationStatus === 'error') && (
              <button onClick={captureLocation} className="underline shrink-0">
                Retry
              </button>
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
                      <p className="text-xs text-gray-500">
                        Register as an OJT trainee or employee. You'll complete a full registration with company and
                        school information.
                      </p>
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
                      <h3 className="font-bold text-gray-800 mb-1">OJT Instructor</h3>
                      <p className="text-xs text-gray-500">
                        Register as an OJT Instructor or supervisor. You'll have access to manage employees, view
                        reports, and configure settings.
                      </p>
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
                      <p className="text-xs text-gray-500">
                        Register as an HTE representative. You'll monitor employee attendance, rendered hours, and
                        provide feedback on their performance.
                      </p>
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

            {/* Step 0: Personal Info (Trainee/Admin) or Company Details (HTE) */}
            {role !== null && step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {role === 'hte' ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <Building size={16} className="text-green-700" />
                      </div>
                      <h2 className="font-bold text-gray-800">Company Details</h2>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Company Name *</label>
                        <input
                          value={form.companyName}
                          onChange={(e) => update('companyName', e.target.value)}
                          placeholder="Host Training Establishment Name"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>

                      <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 space-y-4">
                        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-2">
                          Company Location (GeoNames Search)
                        </p>

                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-blue-400" />
                          </div>
                          <input
                            value={addressSearch}
                            onChange={(e) => handleAddressSearch(e.target.value)}
                            placeholder="Search your company address..."
                            className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                          />
                          {searchingAddress && (
                            <div className="absolute right-3 top-2.5">
                              <Loader size={14} className="animate-spin text-blue-500" />
                            </div>
                          )}

                          {addressSuggestions.length > 0 && (
                            <div className="absolute z-[2000] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                              {addressSuggestions.map((s, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => selectAddressSuggestion(s)}
                                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm font-bold text-gray-800 truncate flex-1">
                                      {s.source === 'osm' ? s.name || s.display_name?.split(',')[0] : s.name}
                                    </p>
                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 uppercase tracking-tighter">
                                      {s.source}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 line-clamp-1">
                                    {s.source === 'osm'
                                      ? s.display_name
                                      : `${s.adminName2 ? `${s.adminName2}, ` : ''}${s.adminName1}, ${s.countryName}`}
                                  </p>
                                </button>
                              ))}
                              <div className="p-2 bg-gray-50 border-t border-gray-100 text-[8px] text-center text-gray-400">
                                Search powered by OpenStreetMap & GeoNames
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Country *</label>
                            <select
                              value={form.country}
                              onChange={(e) => {
                                update('country', e.target.value);
                                update('region', '');
                                update('province', '');
                                update('city', '');
                                update('barangay', '');
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="PH">Philippines</option>
                              <option value="US">United States</option>
                              <option value="other">Other (Type manually)</option>
                            </select>
                            {form.country === 'other' && (
                              <input
                                value={form.country_manual || ''}
                                onChange={(e) => update('country_manual', e.target.value)}
                                placeholder="Enter country name"
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-2"
                              />
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">
                              {form.country === 'PH' ? 'Region *' : 'State/Region *'}
                            </label>
                            {form.country === 'PH' ? (
                              <select
                                value={form.region}
                                onChange={(e) => {
                                  update('region', e.target.value);
                                  update('province', '');
                                  update('city', '');
                                  update('barangay', '');
                                }}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="">Select Region</option>
                                {PH_ADDRESS_DATA.map((r) => (
                                  <option key={r.name} value={r.name}>
                                    {r.name}
                                  </option>
                                ))}
                                <option value="other">Other (Type manually)</option>
                              </select>
                            ) : (
                              <select
                                value={form.region}
                                onChange={(e) => {
                                  update('region', e.target.value);
                                  update('province', '');
                                  update('city', '');
                                  update('barangay', '');
                                }}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="">Select State</option>
                                <option value="other">Other (Type manually)</option>
                              </select>
                            )}
                            {form.region === 'other' && (
                              <input
                                value={form.region_manual || ''}
                                onChange={(e) => update('region_manual', e.target.value)}
                                placeholder="Enter state/region name"
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-2"
                              />
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">
                              {form.country === 'PH' ? 'Province *' : 'City/Town *'}
                            </label>
                            {form.country === 'PH' ? (
                              <div className="space-y-2">
                                <select
                                  value={form.province}
                                  onChange={(e) => {
                                    update('province', e.target.value);
                                    update('city', '');
                                    update('barangay', '');
                                  }}
                                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                  <option value="">Select Province</option>
                                  {PH_ADDRESS_DATA.find((r) => r.name === form.region)?.provinces.map((p) => (
                                    <option key={p.name} value={p.name}>
                                      {p.name}
                                    </option>
                                  ))}
                                  <option value="other">Other (Type manually)</option>
                                </select>
                                {form.province === 'other' && (
                                  <input
                                    value={form.province_manual || ''}
                                    onChange={(e) => update('province_manual', e.target.value)}
                                    placeholder="Enter province name"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <select
                                  value={form.city}
                                  onChange={(e) => {
                                    update('city', e.target.value);
                                    update('barangay', '');
                                    if (e.target.value !== 'other') {
                                      const countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(form.country) || form.country;
                                      const fullAddr = `${e.target.value}, ${form.region}, ${countryName}`;
                                      setRegistrationAddress(fullAddr);
                                    }
                                  }}
                                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                  <option value="">Select City</option>
                                  <option value="other">Other (Type manually)</option>
                                </select>
                                {form.city === 'other' && (
                                  <input
                                    value={form.city_manual || ''}
                                    onChange={(e) => {
                                      update('city_manual', e.target.value);
                                      const countryName = form.country === 'other' ? form.country_manual : (new Intl.DisplayNames(['en'], { type: 'region' }).of(form.country) || form.country);
                                      const fullAddr = `${e.target.value}, ${form.region}, ${countryName}`;
                                      setRegistrationAddress(fullAddr);
                                    }}
                                    placeholder="Enter city name"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">
                              {form.country === 'PH' ? 'City/Municipality *' : 'Neighborhood/Barangay'}
                            </label>
                            {form.country === 'PH' ? (
                              <div className="space-y-2">
                                <select
                                  value={form.city}
                                  onChange={(e) => {
                                    update('city', e.target.value);
                                    update('barangay', '');
                                    if (e.target.value !== 'other') {
                                      const fullAddr = `${e.target.value}, ${form.province}, ${form.region}, Philippines`;
                                      setRegistrationAddress(fullAddr);
                                    }
                                  }}
                                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                  <option value="">Select City</option>
                                  {PH_ADDRESS_DATA.find((r) => r.name === form.region)
                                    ?.provinces.find((p) => p.name === form.province)
                                    ?.cities.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  <option value="other">Other (Type manually)</option>
                                </select>
                                {form.city === 'other' && (
                                  <input
                                    value={form.city_manual || ''}
                                    onChange={(e) => {
                                      update('city_manual', e.target.value);
                                      const fullAddr = `${e.target.value}, ${form.province}, ${form.region}, Philippines`;
                                      setRegistrationAddress(fullAddr);
                                    }}
                                    placeholder="Enter city name"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                )}
                              </div>
                            ) : (
                              <input
                                value={form.barangay}
                                onChange={(e) => {
                                  update('barangay', e.target.value);
                                  const countryName = form.country === 'other' ? form.country_manual : (new Intl.DisplayNames(['en'], { type: 'region' }).of(form.country) || form.country);
                                  const stateName = form.region === 'other' ? form.region_manual : form.region;
                                  const cityName = form.city === 'other' ? form.city_manual : form.city;
                                  const fullAddr = `${cityName}, ${e.target.value}, ${stateName}, ${countryName}`;
                                  setRegistrationAddress(fullAddr);
                                }}
                                placeholder="Area/Street"
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            )}
                          </div>
                        </div>

                        {form.country === 'PH' && (
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Barangay *</label>
                            <select
                              value={form.barangay}
                              onChange={(e) => {
                                update('barangay', e.target.value);
                                if (e.target.value !== 'other') {
                                  const cityName = form.city === 'other' ? form.city_manual : form.city;
                                  const provName = form.province === 'other' ? form.province_manual : form.province;
                                  const fullAddr = `${e.target.value}, ${cityName}, ${provName}, ${form.region}, Philippines`;
                                  setRegistrationAddress(fullAddr);
                                }
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select Barangay</option>
                              {((form.city && BARANGAY_SAMPLES[form.city]) || []).map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                              <option value="other">Other (Type manually)</option>
                            </select>
                            {form.barangay === 'other' && (
                              <input
                                value={form.barangay_manual || ''}
                                onChange={(e) => {
                                  update('barangay_manual', e.target.value);
                                  const cityName = form.city === 'other' ? form.city_manual : form.city;
                                  const provName = form.province === 'other' ? form.province_manual : form.province;
                                  const fullAddr = `${e.target.value}, ${cityName}, ${provName}, ${form.region}, Philippines`;
                                  setRegistrationAddress(fullAddr);
                                }}
                                placeholder="Type barangay name"
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-2"
                              />
                            )}
                          </div>
                        )}

                        <div className="mt-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                            Capture Precise Location
                          </label>
                          <button
                            type="button"
                            onClick={captureLocation}
                            className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${locationStatus === 'captured' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'}`}
                          >
                            {locationStatus === 'capturing' ? (
                              <Loader className="animate-spin" size={16} />
                            ) : (
                              <MapPin size={16} />
                            )}
                            {locationStatus === 'captured' ? 'Location Secured' : 'Pin Precise Company Location'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <User size={16} className="text-blue-700" />
                      </div>
                      <h2 className="font-bold text-gray-800">Personal Information</h2>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Last Name *</label>
                          <input
                            value={form.last_name}
                            onChange={(e) => update('last_name', e.target.value)}
                            placeholder="Dela Cruz"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">First Name *</label>
                          <input
                            value={form.first_name}
                            onChange={(e) => update('first_name', e.target.value)}
                            placeholder="Juan"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Middle Initial</label>
                          <input
                            value={form.middle_initial}
                            onChange={(e) => update('middle_initial', e.target.value)}
                            placeholder="D"
                            maxLength={1}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Email Address *</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => update('email', e.target.value)}
                          placeholder="your@email.com"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Password *</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={form.password}
                              onChange={(e) => update('password', e.target.value)}
                              placeholder="Min 8 characters"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Confirm Password *</label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.confirmPassword}
                            onChange={(e) => update('confirmPassword', e.target.value)}
                            placeholder="Repeat password"
                            className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-300' : 'border-gray-200'}`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 px-1">
                        <input
                          type="checkbox"
                          id="show-pw"
                          checked={showPassword}
                          onChange={() => setShowPassword(!showPassword)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="show-pw" className="text-xs text-gray-500 cursor-pointer">
                          Show passwords
                        </label>
                      </div>

                      {role === 'admin' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Department *</label>
                            <input
                              value={form.department}
                              onChange={(e) => update('department', e.target.value)}
                              placeholder="e.g. CICS"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Course / Field *</label>
                            <input
                              value={form.course}
                              onChange={(e) => update('course', e.target.value)}
                              placeholder="e.g. IT"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            />
                          </div>
                        </div>
                      )}

                      {/* Email Verification hidden as requested */}
                      {false && role === 'trainee' && (
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Email Verification
                            </label>
                            {isOtpVerified && (
                              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                Verified
                              </span>
                            )}
                          </div>

                          {!isOtpVerified ? (
                            <div className="flex gap-2">
                              {!otpSent ? (
                                <button
                                  type="button"
                                  onClick={handleRequestOtp}
                                  disabled={otpVerifying || !form.email}
                                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                                >
                                  {otpVerifying ? 'Sending...' : 'Request Confirmation Code'}
                                </button>
                              ) : (
                                <>
                                  <input
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value)}
                                    placeholder="6-digit code"
                                    className="flex-1 px-3 py-2 border border-blue-200 rounded-xl text-center font-bold tracking-widest focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    maxLength={6}
                                  />
                                  <button
                                    type="button"
                                    onClick={verifyOtp}
                                    className="px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-bold"
                                  >
                                    Verify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleRequestOtp}
                                    className="px-2 text-[10px] text-blue-600 underline"
                                  >
                                    Resend
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-green-700">
                              <Check size={16} />
                              <span className="text-sm font-medium">Email confirmed via Resend API</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Birthdate *</label>
                        <input
                          type="date"
                          value={form.birthdate}
                          onChange={(e) => update('birthdate', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Age (auto-calculated)</label>
                        <input
                          value={form.age}
                          disabled
                          type="number"
                          placeholder="Enter birthdate first"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-500"
                        />
                      </div>
                      <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 space-y-4 mb-4">
                        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-2">
                          Home Address (GeoNames Search)
                        </p>

                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-blue-400" />
                          </div>
                          <input
                            value={addressSearch}
                            onChange={(e) => handleAddressSearch(e.target.value)}
                            placeholder="Search your home address..."
                            className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                          />
                          {searchingAddress && (
                            <div className="absolute right-3 top-2.5">
                              <Loader size={14} className="animate-spin text-blue-500" />
                            </div>
                          )}

                          {addressSuggestions.length > 0 && (
                            <div className="absolute z-[2000] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                              {addressSuggestions.map((s, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => selectAddressSuggestion(s)}
                                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
                                >
                                  <p className="text-sm font-bold text-gray-800">{s.name}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {s.adminName2 ? `${s.adminName2}, ` : ''}
                                    {s.adminName1}, {s.countryName}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Country *</label>
                          <select
                            value={form.country}
                            onChange={(e) => {
                              update('country', e.target.value);
                              update('region', '');
                              update('province', '');
                              update('city', '');
                              update('barangay', '');
                            }}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          >
                            <option value="PH">Philippines</option>
                            <option value="US">United States</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">
                            {form.country === 'PH' ? 'Region *' : 'State/Region *'}
                          </label>
                          {form.country === 'PH' ? (
                            <select
                              value={form.region}
                              onChange={(e) => {
                                update('region', e.target.value);
                                update('province', '');
                                update('city', '');
                                update('barangay', '');
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            >
                              <option value="">Select Region</option>
                              {PH_ADDRESS_DATA.map((r) => (
                                <option key={r.name} value={r.name}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={form.region}
                              onChange={(e) => {
                                update('region', e.target.value);
                                update('province', '');
                                update('city', '');
                                update('barangay', '');
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            >
                              <option value="">Select State</option>
                              <option value="other">Other (Manual Entry)</option>
                            </select>
                          )}
                        </div>
                      </div>

                      {form.country === 'PH' && form.region && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Province *</label>
                            <select
                              value={form.province}
                              onChange={(e) => {
                                update('province', e.target.value);
                                update('city', '');
                                update('barangay', '');
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            >
                              <option value="">Select Province</option>
                              {PH_ADDRESS_DATA.find((r) => r.name === form.region)?.provinces.map((p) => (
                                <option key={p.name} value={p.name}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">
                              City/Municipality *
                            </label>
                            <select
                              value={form.city}
                              onChange={(e) => {
                                update('city', e.target.value);
                                update('barangay', '');
                                const fullAddr = `${e.target.value}, ${form.province}, ${form.region}, Philippines`;
                                setRegistrationAddress(fullAddr);
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            >
                              <option value="">Select City</option>
                              {PH_ADDRESS_DATA.find((r) => r.name === form.region)
                                ?.provinces.find((p) => p.name === form.province)
                                ?.cities.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {form.country !== 'PH' && form.region && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">City *</label>
                            <select
                              value={form.city}
                              onChange={(e) => {
                                update('city', e.target.value);
                                update('barangay', '');
                                const countryName = (new Intl.DisplayNames(['en'], { type: 'region' }).of(form.country) || form.country);
                                const fullAddr = `${e.target.value}, ${form.region}, ${countryName}`;
                                setRegistrationAddress(fullAddr);
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            >
                              <option value="">Select City</option>
                              <option value="other">Other (Manual Entry)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Street Address</label>
                            <input
                              value={form.street}
                              onChange={(e) => update('street', e.target.value)}
                              placeholder="Street name"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          {form.country === 'PH' ? 'Barangay *' : 'Neighborhood/Area'}
                        </label>
                        {form.country === 'PH' && form.city && BARANGAY_SAMPLES[form.city] ? (
                          <div className="space-y-2">
                            <select
                              value={form.barangay}
                              onChange={(e) => {
                                update('barangay', e.target.value);
                                if (e.target.value !== 'other') {
                                  const fullAddr = `${e.target.value}, ${form.city}, ${form.province}, ${form.region}, Philippines`;
                                  setRegistrationAddress(fullAddr);
                                }
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            >
                              <option value="">Select Barangay</option>
                              {BARANGAY_SAMPLES[form.city].map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                              <option value="other">Other (Type manually)</option>
                            </select>
                            {form.barangay === 'other' && (
                              <input
                                value={form.barangay_manual || ''}
                                onChange={(e) => {
                                  update('barangay_manual', e.target.value);
                                  const fullAddr = `${e.target.value}, ${form.city}, ${form.province}, ${form.region}, Philippines`;
                                  setRegistrationAddress(fullAddr);
                                }}
                                placeholder="Enter barangay name"
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            value={form.barangay}
                            onChange={(e) => {
                              update('barangay', e.target.value);
                              const countryName = form.country === 'other' ? form.country_manual : (new Intl.DisplayNames(['en'], { type: 'region' }).of(form.country) || form.country);
                              const stateName = form.region === 'other' ? form.region_manual : form.region;
                              const fullAddr = `${e.target.value}, ${form.city || ''}, ${stateName}, ${countryName}`;
                              setRegistrationAddress(fullAddr);
                            }}
                            placeholder="e.g. Area name"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Employee ID (optional)</label>
                        <input
                          value={form.employeeId}
                          onChange={(e) => update('employeeId', e.target.value)}
                          placeholder="Auto-generated if empty"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>

                      {registrationLocation && (
                        <div className="mt-4 space-y-3">
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <MapPin className="text-green-600 mt-0.5" size={18} />
                              <div>
                                <p className="text-green-800 text-sm font-bold">Registration Location Captured</p>
                                <p className="text-green-600 text-xs mt-0.5">
                                  Your official geofence location is locked.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowLocationMap(!showLocationMap);
                                setTimeout(() => {
                                  window.dispatchEvent(new Event('resize'));
                                }, 300);
                              }}
                              className="px-3 py-1.5 bg-white border border-green-200 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors"
                            >
                              {showLocationMap ? 'Hide Map' : 'See your location'}
                            </button>
                          </div>

                          <AnimatePresence>
                            {showLocationMap && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 200, opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden rounded-2xl border border-gray-200 shadow-inner relative"
                              >
                                <MapContainer
                                  key={
                                    registrationLocation
                                      ? `${registrationLocation.lat}-${registrationLocation.lng}`
                                      : 'map'
                                  }
                                  center={[registrationLocation.lat, registrationLocation.lng]}
                                  zoom={16}
                                  style={{ height: '100%', width: '100%' }}
                                  dragging={false}
                                  doubleClickZoom={false}
                                  scrollWheelZoom={false}
                                  touchZoom={false}
                                  zoomControl={false}
                                  boxZoom={false}
                                >
                                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                  <Marker position={[registrationLocation.lat, registrationLocation.lng]} />
                                </MapContainer>
                                <div className="absolute inset-0 z-[1000] pointer-events-none border-2 border-purple-500/20 rounded-2xl" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {role !== null && role !== 'admin' && step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                    <Building size={16} className="text-sky-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">
                    {role === 'hte' ? 'Contact Information' : 'Company Information'}
                  </h2>
                </div>
                <div className="space-y-3">
                  {role === 'hte' ? (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Contact Person / Representative *
                        </label>
                        <input
                          value={form.contactPerson}
                          onChange={(e) => update('contactPerson', e.target.value)}
                          placeholder="Full Name of Representative"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Username *
                        </label>
                        <input
                          value={form.username}
                          onChange={(e) => update('username', e.target.value)}
                          placeholder="choose_a_username"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Contact Phone / Mobile *
                        </label>
                        <input
                          value={form.contactPhone}
                          onChange={(e) => update('contactPhone', e.target.value)}
                          placeholder="e.g. 09123456789"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Position / Title</label>
                        <input
                          value={form.supervisorName}
                          onChange={(e) => update('supervisorName', e.target.value)}
                          placeholder="e.g. HR Manager"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Company Name *</label>
                        <input
                          value={form.companyName}
                          onChange={(e) => update('companyName', e.target.value)}
                          placeholder="Company Name"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Supervisor Name *</label>
                        <input
                          value={form.supervisorName}
                          onChange={(e) => update('supervisorName', e.target.value)}
                          placeholder="Mr./Ms. Supervisor"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Start Date *</label>
                          <input
                            type="date"
                            value={form.startDate}
                            onChange={(e) => update('startDate', e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">End Date *</label>
                          <input
                            type="date"
                            value={form.endDate}
                            onChange={(e) => update('endDate', e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Required OJT Hours</label>
                        <input
                          type="number"
                          value={form.requiredHours}
                          onChange={(e) => update('requiredHours', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {role !== null && step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <GraduationCap size={16} className="text-green-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">School Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">School / University *</label>
                    <input
                      value={form.schoolName}
                      onChange={(e) => update('schoolName', e.target.value)}
                      placeholder="University Name"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Course / Program *</label>
                    <input
                      value={form.course}
                      onChange={(e) => update('course', e.target.value)}
                      placeholder="e.g. BS Information Technology"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {role !== null && ((role === 'trainee' && step === 3) || (role === 'admin' && step === 1)) && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Camera size={16} className="text-purple-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Face Registration</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Register your face for biometric time recording. The captured image will be stored in the system for
                  identity verification during clock-in/out.
                </p>

                {faceCapturing ? (
                  <FaceCapture
                    key={`face-reg-${retryCount}`}
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
                        <img
                          src={photo}
                          alt="Registered Face"
                          className="w-full h-full object-cover rounded-full"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <Check size={36} className="text-green-600" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-green-700">Face Registered!</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Your biometric image has been captured and will be stored
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFaceRegistered(false);
                        setFaceCapturing(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Re-register face
                    </button>
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
                    <button
                      onClick={() => setFaceCapturing(true)}
                      className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                      <Camera size={16} />
                      Register Face
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation - Only show when role is selected */}
          {role !== null && (
            <div className="mt-6">

              <div className="flex gap-3">
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                {step < steps.length - 1 ? (
                  <button
                    onClick={handleNext}
                    disabled={!isStepValid()}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
                  >
                    Next
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={(role === 'trainee' || role === 'admin') && !faceRegistered}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-200"
                  >
                    <Check size={14} />
                    Complete Registration
                  </button>
                )}
              </div>
            </div>
          )}

          {role !== null && step === steps.length - 1 && !faceRegistered && (
            <p className="text-center text-xs text-gray-400 mt-2">Face registration required to complete</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
