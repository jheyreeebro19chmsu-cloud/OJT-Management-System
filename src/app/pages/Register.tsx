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
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { GeofenceMap } from '../components/GeofenceMap';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { FaceCapture } from '../components/FaceCapture';
import { sendWelcomeEmail, sendOtpEmail } from '../lib/resend';


import { PH_ADDRESS_DATA } from '../data/ph_address_data';
import { campusOptions, departmentOptions, getCoursesForDepartment } from '../data/academicOptions';
import { Country, State, City } from 'country-state-city';



import { authAPI } from '../services/authApi';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import { useApp } from '../store/AppContext';
import { getCurrentLocation, isGeolocationPositionError } from '../utils/geo';
import { getAbsoluteUrl } from '../services/config';
import { validateRegistrationData, validateSentenceLimit } from '../utils/validation';

// Fix Leaflet marker icon using a method that's safer for production builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
});

const stepsTrainee = ['Personal Info', 'Company Info', 'School Info', 'Face Registration'];
// Do NOT include face registration for OJT Instructor or HTE
const stepsAdmin = ['Personal Info'];
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
    // Personal Information
    name: '',
    firstName: '',
    lastName: '',
    middleInitial: '',
    email: '',
    birthdate: '',
    age: '',
    username: '',
    password: '',
    confirmPassword: '',
    // Location/Address
    country: 'PH',
    countryManual: '',
    region: '',
    regionManual: '',
    province: '',
    provinceManual: '',
    city: '',
    cityManual: '',
    street: '',
    barangay: '',
    barangayManual: '',
    // Position/Role
    department: '',
    position: 'OJT Trainee',
    // Company (for HTE)
    companyName: '',
    companyAddress: '',
    contactPerson: '',
    contactPhone: '',
    // School/Instructor Information
    schoolName: '',
    campus: '',
    course: '',
    supervisorName: '',
    // Employment
    employeeId: '',
    startDate: '',
    endDate: '',
    requiredHours: 486,
  });

  const selectedProgramOptions = getCoursesForDepartment(form.department, form.campus);

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
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailTaken, setEmailTaken] = useState<null | boolean>(null);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailValidationUnavailable, setEmailValidationUnavailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const DEFAULT_CAMPUS_LOCATION = { lat: 10.7410, lng: 122.9702 }; // CHMSU Talisay Campus

  // Registration location state
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('captured');
  const [registrationLocation, setRegistrationLocation] = useState<{ lat: number; lng: number; accuracy?: number } | undefined>(DEFAULT_CAMPUS_LOCATION);
  const [registrationAddress, setRegistrationAddress] = useState<string>('Carlos Hilado Memorial State University, Talisay City, Negros Occidental');
  const [showLocationMap, setShowLocationMap] = useState(true);
  const [pickingLocation, setPickingLocation] = useState(false);
  const watchIdRef = React.useRef<number | null>(null);
  const [liveTracking, setLiveTracking] = useState(false);

  // Load complete lists using country-state-city
  const allCountries = Country.getAllCountries();
  const statesList = form.country && form.country !== 'other' ? State.getStatesOfCountry(form.country) : [];
  const citiesList = form.country && form.country !== 'other' && form.region && form.region !== 'other'
    ? City.getCitiesOfState(form.country, form.region)
    : [];

  const steps = role === 'admin' ? stepsAdmin : role === 'hte' ? stepsHTE : stepsTrainee;

  // registration flow continues below

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setStep(0);
    // store pending oauth role for Google sign-in flow
    localStorage.setItem('pending_oauth_role', nextRole || '');
  };

  // Force-submit removed: face capture/force submit is disabled for HTE and Instructors

  // Detect OAuth HTE prefill on mount
  useEffect(() => {
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

  // Automatically capture location for non‑trainee roles (admin, hte) when role is known
  useEffect(() => {
    if (role && role !== 'trainee' && locationStatus === 'idle') {
      captureLocation();
    }
  }, [role, locationStatus]);

  const captureLocation = async () => {
    setLocationStatus('capturing');
    try {
      const position = await getCurrentLocation();
      const { latitude, longitude } = position.coords;
      setRegistrationLocation({ lat: latitude, lng: longitude, accuracy: position.coords.accuracy });
      setLocationStatus('captured');
      toast.success('Device GPS location updated!');
    } catch (err: unknown) {
      console.warn('Geolocation failed, falling back to default campus location:', err);
      // Fallback to default campus location so registration is never blocked or showing errors
      setRegistrationLocation((prev) => prev || DEFAULT_CAMPUS_LOCATION);
      setLocationStatus('captured');
    }
  };

  const startLiveTracking = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation not supported');
      return;
    }
    if (watchIdRef.current !== null) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setRegistrationLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocationStatus('captured');
      },
      (err) => {
        console.error('watchPosition error', err);
        const isDenied = isGeolocationPositionError(err) && err.code === 1;
        setLocationStatus(isDenied ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    watchIdRef.current = id as unknown as number;
    setLiveTracking(true);
    toast.success('Live location tracking started');
  };

  const stopLiveTracking = () => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current as number);
      watchIdRef.current = null;
    }
    setLiveTracking(false);
    toast('Live tracking stopped');
  };

  useEffect(() => {
    return () => {
      // cleanup watcher
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current as number);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Allow user to begin adjusting the captured location
  const startPickLocation = () => {
    setPickingLocation(true);
    setShowLocationMap(true);
  };

  const update = (field: string, value: string | number) => {
    setForm((p) => {
      let formattedValue = value;

      // Auto-capitalize first letter of each word for text/name/address fields ("capslock then back to normal")
      if (typeof formattedValue === 'string') {
        const titleCaseFields = [
          'firstName',
          'lastName',
          'name',
          'companyName',
          'contactPerson',
          'supervisorName',
          'street',
          'barangay',
          'barangayManual',
          'city',
          'cityManual',
          'province',
          'provinceManual',
          'region',
          'regionManual',
          'schoolName',
          'department',
          'course',
          'campus',
          'position',
        ];

        const limit25Fields = [
          'firstName',
          'lastName',
          'middleInitial',
          'name',
          'companyName',
          'contactPerson',
          'supervisorName',
          'street',
          'barangay',
          'barangayManual',
          'city',
          'cityManual',
          'province',
          'provinceManual',
          'region',
          'regionManual',
          'schoolName',
          'department',
          'course',
          'campus',
          'position',
          'contactPhone',
          'employeeId',
        ];

        if (field === 'middleInitial') {
          formattedValue = formattedValue.toUpperCase().slice(0, 5);
        } else if (titleCaseFields.includes(field)) {
          formattedValue = formattedValue.replace(/(^\w|\s\w|-\w)/g, (match) => match.toUpperCase());
        }

        if (limit25Fields.includes(field)) {
          formattedValue = formattedValue.slice(0, 25);
        }
      }

      const newForm = { ...p, [field]: formattedValue };

      // If user entered email and username is empty, auto-fill username with email
      if (field === 'email' && typeof value === 'string' && (!newForm.username || newForm.username.trim() === '')) {
        newForm.username = value;
      }

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

  const checkEmailExists = async (email: string) => {
    if (!email) return;
    setEmailChecking(true);
    setEmailTaken(null);
    setEmailMsg('');
    setEmailValidationUnavailable(false);
    try {
      // Prefer server-side check
      const res = await authAPI.checkEmail(email).catch(() => null);
      if (res && typeof res.data?.exists === 'boolean') {
        if (res.data.exists) { setEmailTaken(true); setEmailMsg('Email already in use'); }
        else setEmailTaken(false);
      } else {
        // Fallback to local caches when server couldn't be reached
        const existsLocal = employees.some((e) => e.email.toLowerCase() === email.toLowerCase()) || hostSupervisors.some((h) => h.email.toLowerCase() === email.toLowerCase());
        if (existsLocal) {
          setEmailTaken(true);
          setEmailMsg('Email already in use');
        } else {
          // If neither server nor local could confirm, mark validation unavailable but allow registration to continue
          setEmailTaken(false);
          setEmailValidationUnavailable(true);
          setEmailMsg('Could not validate email with server — proceeding with caution');
        }
      }
    } catch (e) {
      console.debug('Email check failed', e);
      // On unexpected errors, allow proceed but show warning
      setEmailTaken(false);
      setEmailValidationUnavailable(true);
      setEmailMsg('Could not validate email (network/server error) — proceeding with caution');
    } finally { setEmailChecking(false); }
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
    setIsSubmitting(true);
    setSubmitError(null);
    const empId =
      form.employeeId ||
      `${role === 'admin' ? 'ADM' : 'OJT'}-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;

    // If OAuth HTE flow pending, attempt HTE registration via backend
    if (oauthPending && role === 'hte') {
      try {
        const parts = (form.name || '').trim().split(/\s+/);
        const first_name = parts[0] || '';
        const last_name = parts.slice(1).join(' ') || '';
        const payload = {
          email: form.email || form.username,
          first_name: first_name || 'User',
          last_name: last_name || '',
          company_name: form.companyName || '',
          company_address: form.companyAddress || '',
          contact_person: form.contactPerson || '',
          contact_phone: form.contactPhone || '',
          // Include registration GPS location if available
          ...(registrationLocation ? {
            gps_latitude: registrationLocation.lat,
            gps_longitude: registrationLocation.lng,
            gps_accuracy: registrationLocation.accuracy,
          } : {}),
        };
        const res = await authAPI.registerHTE(payload);
        if (res?.data?.tokens) {
          const user = (res.data as any)?.user;
          if (user?.face_registration) {
            setFaceRegistered(Boolean(user.face_registration.has_encoding));
            if (user.face_registration.image_url) setPhoto(user.face_registration.image_url);
          } else if (user?.avatar) {
            setPhoto(user.avatar);
          }
          toast.success('Registration successful! Please log in.');
          setOauthPending(false);
          setIsSubmitting(false);
          navigate('/login');
          return;
        } else {
          throw new Error((res?.data as any)?.error || 'OAuth HTE registration failed');
        }
      } catch (err) {
        console.error('HTE register (oauthPending) exception:', err);
        const msg = (err as any)?.response?.data?.error || (err as any)?.message || String(err);
        setSubmitError(msg);
        toast.error('Registration failed: ' + msg);
        setIsSubmitting(false);
      }
      setOauthPending(false);
      // OAuth HTE path ended — do not fall through to registerEmployee
      return;
    }

    // ── Standard Supabase registration path ──────────────────────────────────
    // Validate required fields before proceeding
    if (role === 'admin' || role === 'trainee' || role === 'hte') {
      if (!form.email || !form.password) {
        setSubmitError('Email and password are required');
        setIsSubmitting(false);
        return;
      }
    }
    
    // ── Validate and sanitize form data to prevent dirty data ──
    try {
      // Call validation which will throw on errors
      const validationFormData = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        middleInitial: form.middleInitial,
        name: form.name,
        password: form.password,
        confirmPassword: form.confirmPassword,
        street: form.street,
        barangay: form.barangay,
        barangayManual: form.barangayManual,
        city: form.city,
        province: form.province,
        region: form.region,
        companyName: form.companyName,
        companyAddress: form.companyAddress,
        contactPerson: form.contactPerson,
        contactPhone: form.contactPhone,
        schoolName: form.schoolName,
        campus: form.campus,
        course: form.course,
        department: form.department,
        supervisorName: form.supervisorName,
        position: form.position,
        employeeId: form.employeeId,
        username: form.username,
      };
      
      // This will throw if validation fails
      validateRegistrationData(validationFormData, role || 'trainee');
    } catch (validationErr) {
      const msg = (validationErr as any)?.message || String(validationErr);
      setSubmitError(msg);
      toast.error('Validation error: ' + msg);
      setIsSubmitting(false);
      return;
    }
    
    // HTE flow (existing logic remains unchanged)
    if (role === 'hte') {
      if (!form.email && !form.username) {
        setSubmitError('Email or username is required');
        setIsSubmitting(false);
        return;
      }
    }
    // Proceed with standard employee registration for admin and other roles
    const buildAddrFromForm = () => {
      const parts = [] as string[];
      if (form.barangay === 'other' && form.barangayManual) {
        parts.push(form.barangayManual);
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

    // Compose full name from parts if form.name is empty
    const composedName = form.name || form.contactPerson ||
      [form.firstName, form.middleInitial, form.lastName].filter(Boolean).join(' ') ||
      (form.email ? form.email.split('@')[0] : 'User');

    let result: { success: boolean; message?: string; employee?: any };
    try {
      result = await registerEmployee({
        ...form,
        name: composedName,
        employeeId: empId,
        position: role === 'admin' ? 'OJT Instructor' : role === 'hte' ? 'HTE Representative' : 'OJT Trainee',
        requiredHours: role === 'admin' ? 0 : Number(form.requiredHours),
        faceRegistered,
        photo,
        active: true,
        // Ensure location info is always persisted even if GPS is missing
        registrationLocation: registrationLocation || undefined,
        registrationAddress: computedAddress,
        password: form.password,
      });
    } catch (err: any) {
      console.error('registerEmployee threw:', err);
      toast.error('Registration error: ' + (err?.message || String(err)));
      setIsSubmitting(false);
      return;
    }

    if (!result.success) {
      const msg = result.message || '';
      // If email already exists locally, update the existing record instead of blocking the user.
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already in use')) {
        const emailToFind = (form.email || form.username || '').toLowerCase();
        const existing = employees.find((e) => e.email.toLowerCase() === emailToFind);
        if (existing) {
          // Update the existing employee with latest submitted data
          updateEmployee(existing.id, {
            name: form.name || existing.name,
            firstName: form.firstName || existing.firstName,
            lastName: form.lastName || existing.lastName,
            middleInitial: form.middleInitial || existing.middleInitial,
            email: form.email || existing.email,
            department: form.department || existing.department,
            position: role === 'admin' ? 'OJT Instructor' : role === 'hte' ? 'HTE Representative' : 'OJT Trainee',
            companyName: form.companyName || existing.companyName,
            companyAddress: form.companyAddress || existing.companyAddress,
            contactPerson: form.contactPerson || existing.contactPerson,
            contactPhone: form.contactPhone || existing.contactPhone,
            schoolName: form.schoolName || existing.schoolName,
            campus: form.campus || existing.campus,
            course: form.course || existing.course,
            startDate: form.startDate || existing.startDate,
            endDate: form.endDate || existing.endDate,
            requiredHours: Number(form.requiredHours) || existing.requiredHours,
            registrationLocation: registrationLocation || existing.registrationLocation,
            registrationAddress: computedAddress || existing.registrationAddress,
            photo: photo || existing.photo,
            faceRegistered: faceRegistered || existing.faceRegistered,
            active: true,
          });
          toast.success('Updated existing account and completed registration. Please log in.');
          setIsSubmitting(false);
          navigate('/login');
          return;
        }
      }

      toast.error(msg || 'Registration failed. Please check your inputs.');
      setIsSubmitting(false);
      return;
    }

    const newEmp = result.employee!;

    if (role === 'admin') {
      setRegisteredInstructorId(newEmp.id);
    }

    // Send Welcome Email
    try {
      sendWelcomeEmail(newEmp.email, newEmp.name).catch((emailErr) => {
        console.error('Failed to send welcome email:', emailErr);
      });
    } catch (e) {
      console.error(e);
    }

    // Auto-redirect based on role
    // Redirect to login after successful registration
    setIsSubmitting(false);
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

    const hasName = Boolean(form.name || ((form.firstName || '').trim() && (form.lastName || '').trim()));
    const hasEmail = Boolean((form.email && form.email.toString().trim()) || (form.username && form.username.toString().trim()));

    // Check for email duplication
    const emailToCheck = (form.email || form.username || '').toString().toLowerCase();
    // Use server-validated state when available; otherwise fall back to local caches.
    let emailExists = false;
    if (emailTaken === true) emailExists = true;
    else if (emailTaken === false) emailExists = false;
    else emailExists = employees.some((e) => e.email.toLowerCase() === emailToCheck) || hostSupervisors.some((h) => h.email.toLowerCase() === emailToCheck);

    const hasUpper = /[A-Z]/.test(form.password);
    const hasLower = /[a-z]/.test(form.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(form.password);
    const hasLength = (form.password || '').length >= 8;
    const passwordsMatch = form.password && form.password === form.confirmPassword;
    const hasValidPassword = hasUpper && hasLower && hasSpecial && hasLength && passwordsMatch;

    const hasValidCountry = form.country === 'other' ? Boolean(form.countryManual?.trim()) : Boolean(form.country);
    const hasValidRegion = form.region === 'other' ? Boolean(form.regionManual?.trim()) : Boolean(form.region);
    const hasValidCity = form.city === 'other' ? Boolean(form.cityManual?.trim()) : Boolean(form.city);
    const hasValidBarangay = form.barangay === 'other' ? Boolean(form.barangayManual?.trim()) : Boolean(form.barangay);
    const hasValidProvince =
      form.country === 'PH'
        ? form.province === 'other'
          ? Boolean(form.provinceManual?.trim())
          : Boolean(form.province)
        : true;

    // Role-specific and Step-specific Validation
    if (role === 'admin') {
      if (step === 0) {
        if (hasEmail && emailExists) errors.push('Email already in use');
      }
    }

    if (role === 'trainee') {
      if (step === 0) {
        if (hasEmail && emailExists) errors.push('Email already in use');
        // Location capture is no longer required for trainees
      }
      if (step === 1) {
        if (!form.companyName?.trim()) errors.push('Company Name');
        if (!form.startDate) errors.push('Start Date');
        if (!form.endDate) errors.push('End Date');
        if (!form.requiredHours) errors.push('OJT Hours');
      }
      if (step === 2) {
        // No required fields for step 2
      }
    }

    if (role === 'hte') {
      if (step === 0) {
        if (!form.companyName?.trim()) errors.push('Company Name');
        if (!hasValidPassword) errors.push('Valid password (8+ chars, upper, lower, special, and matching)');
      }
      if (step === 1) {
        if (hasEmail && emailExists) errors.push('Email already in use');
        // Username is optional for HTE; auto-filled from email when possible
        // if (!form.username?.trim()) errors.push('Username');
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
      label: registrationLocation ? `Location captured: ${registrationLocation.lat.toFixed(5)}, ${registrationLocation.lng.toFixed(5)}` : '',
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
              onClick={async () => {
                try {
                  const res = await fetch(getAbsoluteUrl('/api/security/auth/generate-instructor-otp/'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instructor_id: registeredInstructorId }),
                  });
                  if (!res.ok) throw new Error('Failed to generate OTP');
                  const d = await res.json();
                  if (d && d.otp_code) {
                    // show simple alert with OTP and copy to clipboard
                    await navigator.clipboard.writeText(d.otp_code);
                    alert('Enrollment OTP generated and copied to clipboard: ' + d.otp_code);
                  } else {
                    throw new Error(d.error || 'No OTP returned');
                  }
                } catch (e: any) {
                  console.error(e);
                  alert('Could not generate OTP: ' + (e?.message || e));
                }
              }}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              Generate Enrollment OTP
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

        {/* Location status bar - Only show when captured or capturing */}
        {role !== null && role !== 'trainee' && locationStatus === 'capturing' && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border mb-4 bg-sky-50 border-sky-200 text-sky-700 animate-pulse">
            <Loader size={14} className="animate-spin text-sky-500" />
            <span className="flex-1 truncate">Detecting precise GPS location...</span>
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
                              <option value="">Select Country</option>
                              {allCountries.map((c) => (
                                <option key={c.isoCode} value={c.isoCode}>
                                  {c.name}
                                </option>
                              ))}
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
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="">Select State/Region</option>
                                {statesList.map((s) => (
                                  <option key={s.isoCode} value={s.isoCode}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
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
                                </select>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <select
                                  value={form.city}
                                  onChange={(e) => {
                                    update('city', e.target.value);
                                    update('barangay', '');
                                    const countryObj = Country.getCountryByCode(form.country);
                                    const stateObj = State.getStateByCodeAndCountry(form.region, form.country);
                                    const fullAddr = `${e.target.value}, ${stateObj?.name || form.region}, ${countryObj?.name || form.country}`;
                                    setRegistrationAddress(fullAddr);
                                  }}
                                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                  <option value="">Select City</option>
                                  {citiesList.map((c) => (
                                    <option key={c.name} value={c.name}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
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
                                    const fullAddr = `${e.target.value}, ${form.province}, ${form.region}, Philippines`;
                                    setRegistrationAddress(fullAddr);
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
                                </select>
                              </div>
                            ) : (
                              <input
                                value={form.barangay}
                                onChange={(e) => {
                                  update('barangay', e.target.value);
                                  const countryObj = Country.getCountryByCode(form.country);
                                  const stateObj = State.getStateByCodeAndCountry(form.region, form.country);
                                  const fullAddr = `${form.city}, ${e.target.value}, ${stateObj?.name || form.region}, ${countryObj?.name || form.country}`;
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
                            <input
                              value={form.barangay}
                              onChange={(e) => {
                                update('barangay', e.target.value);
                                const cityName = form.city;
                                const provName = form.province;
                                const fullAddr = `${e.target.value}, ${cityName}, ${provName}, ${form.region}, Philippines`;
                                setRegistrationAddress(fullAddr);
                              }}
                              placeholder="Enter barangay"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        )}

                        {/* Location Pinning & Map Box (Visible First in View Mode) */}
                        <div className="mt-4 pt-3 border-t border-blue-100/60 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                              <MapPin size={13} className="text-blue-600" />
                              <span>Company Geofence Location</span>
                            </label>

                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                              {pickingLocation ? 'Pick Mode Active' : 'View Mode'}
                            </span>
                          </div>

                          {/* Embedded Map Component (Always Visible First in View Mode) */}
                          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm relative h-48 bg-slate-100">
                            <GeofenceMap
                              zones={[]}
                              picking={pickingLocation}
                              pickedCoords={registrationLocation}
                              onPick={(lat, lng) => {
                                setRegistrationLocation({ lat, lng });
                                setRegistrationAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                                setLocationStatus('captured');
                              }}
                              liveUser={registrationLocation ? { lat: registrationLocation.lat, lng: registrationLocation.lng, accuracy: (registrationLocation as any).accuracy } : null}
                              className="h-48"
                            />

                            {/* Map Mode Overlay Badge */}
                            <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700 shadow border border-slate-200 flex items-center gap-1.5 pointer-events-none">
                              <span className={`w-2 h-2 rounded-full ${pickingLocation ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                              <span>{pickingLocation ? 'Click map to set pin' : 'Location Pin (View Mode)'}</span>
                            </div>
                          </div>

                          {/* Location Action Buttons */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setPickingLocation(!pickingLocation)}
                              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                pickingLocation
                                  ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <MapPin size={14} />
                              {pickingLocation ? 'Lock Pin Location' : 'Adjust Pin on Map'}
                            </button>

                            <button
                              type="button"
                              onClick={captureLocation}
                              className="py-2 px-3 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm hover:bg-blue-700 flex items-center justify-center gap-1.5 transition-all"
                            >
                              {locationStatus === 'capturing' ? (
                                <Loader className="animate-spin" size={14} />
                              ) : (
                                <MapPin size={14} />
                              )}
                              <span>Detect Device GPS</span>
                            </button>
                          </div>

                          {registrationLocation && (
                            <p className="text-[11px] text-slate-500 text-center font-mono">
                              Pinned Coords: {registrationLocation.lat.toFixed(5)}, {registrationLocation.lng.toFixed(5)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Account Security Card */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3.5 mt-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-200 rounded-md flex items-center justify-center">
                            <Lock size={13} className="text-slate-700" />
                          </div>
                          <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Account Credentials</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Password *</label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={(e) => update('password', e.target.value)}
                                placeholder="Min 8 chars"
                                className="w-full pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                              >
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Confirm Password *</label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.confirmPassword}
                                onChange={(e) => update('confirmPassword', e.target.value)}
                                placeholder="Repeat password"
                                className={`w-full pl-3 pr-8 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                                  form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                              >
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Password strength checklist */}
                        {form.password && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 text-[11px] animate-in fade-in slide-in-from-top-1 duration-200">
                            <p className="font-semibold text-slate-700 mb-0.5">Password Strength Checklist:</p>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className={/[A-Z]/.test(form.password) ? "text-green-600 font-bold" : "text-gray-300 font-bold"}>
                                  {/[A-Z]/.test(form.password) ? "✓" : "○"}
                                </span>
                                <span className={/[A-Z]/.test(form.password) ? "text-green-700 font-medium" : "text-gray-500"}>Uppercase letter</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={/[a-z]/.test(form.password) ? "text-green-600 font-bold" : "text-gray-300 font-bold"}>
                                  {/[a-z]/.test(form.password) ? "✓" : "○"}
                                </span>
                                <span className={/[a-z]/.test(form.password) ? "text-green-700 font-medium" : "text-gray-500"}>Lowercase letter</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? "text-green-600 font-bold" : "text-gray-300 font-bold"}>
                                  {/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? "✓" : "○"}
                                </span>
                                <span className={/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? "text-green-700 font-medium" : "text-gray-500"}>Special character</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={form.password.length >= 8 ? "text-green-600 font-bold" : "text-gray-300 font-bold"}>
                                  {form.password.length >= 8 ? "✓" : "○"}
                                </span>
                                <span className={form.password.length >= 8 ? "text-green-700 font-medium" : "text-gray-500"}>At least 8 chars</span>
                              </div>
                              {form.confirmPassword && (
                                <div className="flex items-center gap-1 col-span-2 border-t border-slate-100 pt-1 mt-1">
                                  <span className={form.password === form.confirmPassword ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                    {form.password === form.confirmPassword ? "✓" : "✗"}
                                  </span>
                                  <span className={form.password === form.confirmPassword ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                                    {form.password === form.confirmPassword ? "Passwords match" : "Passwords do not match"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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
                            value={form.lastName}
                            onChange={(e) => update('lastName', e.target.value)}
                            placeholder="Dela Cruz"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">First Name *</label>
                          <input
                            value={form.firstName}
                            onChange={(e) => update('firstName', e.target.value)}
                            placeholder="Juan"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Middle Initial</label>
                          <input
                            value={form.middleInitial}
                            onChange={(e) => update('middleInitial', e.target.value)}
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
                          onChange={(e) => { update('email', e.target.value); setEmailTaken(null); }}
                          onBlur={() => checkEmailExists(form.email)}
                          placeholder="your@email.com"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                        {emailChecking ? (
                          <p className="text-xs text-gray-500 mt-1">Checking email…</p>
                        ) : emailTaken ? (
                          <p className="text-xs text-red-600 mt-1">{emailMsg}</p>
                        ) : null}
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

                      {form.password && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-[11px] animate-in fade-in slide-in-from-top-1 duration-200">
                          <p className="font-semibold text-slate-700 mb-0.5">Password Strength Checklist:</p>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className={/[A-Z]/.test(form.password) ? "text-green-600 font-bold" : "text-gray-300 font-bold"}>
                                {/[A-Z]/.test(form.password) ? "✓" : "○"}
                              </span>
                              <span className={/[A-Z]/.test(form.password) ? "text-green-700 font-medium" : "text-gray-500"}>Uppercase letter</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={/[a-z]/.test(form.password) ? "text-green-600 font-bold" : "text-gray-300 font-bold"}>
                                {/[a-z]/.test(form.password) ? "✓" : "○"}
                              </span>
                              <span className={/[a-z]/.test(form.password) ? "text-green-700 font-medium" : "text-gray-500"}>Lowercase letter</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? "text-green-600 font-bold" : "text-gray-300 font-bold"}>
                                {/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? "✓" : "○"}
                              </span>
                              <span className={/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? "text-green-700 font-medium" : "text-gray-500"}>Special character</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={form.password.length >= 8 ? "text-green-600 font-bold" : "text-gray-300 font-bold"}>
                                {form.password.length >= 8 ? "✓" : "○"}
                              </span>
                              <span className={form.password.length >= 8 ? "text-green-700 font-medium" : "text-gray-500"}>At least 8 chars</span>
                            </div>
                            {form.confirmPassword && (
                              <div className="flex items-center gap-1 col-span-2 border-t border-slate-200/50 pt-1 mt-1">
                                <span className={form.password === form.confirmPassword ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                  {form.password === form.confirmPassword ? "✓" : "✗"}
                                </span>
                                <span className={form.password === form.confirmPassword ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                                  {form.password === form.confirmPassword ? "Passwords match" : "Passwords do not match"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

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
                      {/* Home address search removed for privacy */}

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
                            <option value="">Select Country</option>
                            {allCountries.map((c) => (
                              <option key={c.isoCode} value={c.isoCode}>
                                {c.name}
                              </option>
                            ))}
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
                              <option value="">Select State/Region</option>
                              {statesList.map((s) => (
                                <option key={s.isoCode} value={s.isoCode}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {form.country === 'PH' && (
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
                              disabled={!form.region}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="">{form.region ? 'Select Province' : 'Select Region First'}</option>
                              {form.region &&
                                PH_ADDRESS_DATA.find((r) => r.name === form.region)?.provinces.map((p) => (
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
                              disabled={!form.province}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="">{form.province ? 'Select City' : 'Select Province First'}</option>
                              {form.province &&
                                PH_ADDRESS_DATA.find((r) => r.name === form.region)
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
                                const countryObj = Country.getCountryByCode(form.country);
                                const stateObj = State.getStateByCodeAndCountry(form.region, form.country);
                                const fullAddr = `${e.target.value}, ${stateObj?.name || form.region}, ${countryObj?.name || form.country}`;
                                setRegistrationAddress(fullAddr);
                              }}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            >
                              <option value="">Select City</option>
                              {citiesList.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
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
                        {/* Always use manual input for Barangay to avoid select fallback */}
                        <input
                          value={form.barangay}
                          onChange={(e) => {
                            update('barangay', e.target.value);
                            const countryObj = Country.getCountryByCode(form.country);
                            const stateObj = State.getStateByCodeAndCountry(form.region, form.country);
                            const fullAddr = `${e.target.value}, ${form.city || ''}, ${stateObj?.name || form.region}, ${countryObj?.name || form.country}`;
                            setRegistrationAddress(fullAddr);
                          }}
                          placeholder="Enter barangay"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
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
                                <div className="h-52">
                                  <GeofenceMap
                                    zones={[]}
                                    picking={false}
                                    pickedCoords={registrationLocation}
                                    liveUser={registrationLocation ? { lat: registrationLocation.lat, lng: registrationLocation.lng, accuracy: (registrationLocation as any).accuracy } : null}
                                    className="h-52 pointer-events-none"
                                  />
                                </div>

                                <div className="absolute top-3 right-3 z-[1100] pointer-events-auto flex items-center gap-2">
                                  {!liveTracking ? (
                                    <button
                                      type="button"
                                      onClick={() => startLiveTracking()}
                                      className="px-3 py-1.5 bg-white border border-gray-200 text-sky-700 text-xs font-bold rounded-lg hover:bg-sky-50 transition-colors"
                                    >
                                      Start Live
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => stopLiveTracking()}
                                      className="px-3 py-1.5 bg-white border border-red-200 text-red-700 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                      Stop Live
                                    </button>
                                  )}
                                  <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs text-gray-800 shadow border border-sky-100">
                                    <span className="font-semibold text-sky-700">{liveTracking ? 'Live' : 'Idle'}</span>
                                    {registrationLocation && (
                                      <span className="text-gray-500 ml-2">{registrationLocation.lat.toFixed(5)}, {registrationLocation.lng.toFixed(5)}</span>
                                    )}
                                  </div>
                                </div>

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
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => update('email', e.target.value)}
                          placeholder="your.email@company.com"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>
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
                    <label className="text-xs font-semibold text-gray-600 block mb-1">School *</label>
                    <select
                      value={form.schoolName}
                      onChange={(e) => update('schoolName', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    >
                      <option value="">Select School</option>
                      <option value="Carlos Hilado Memorial State University">
                        Carlos Hilado Memorial State University
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Department *</label>
                    <select
                      value={form.department}
                      onChange={(e) => {
                        update('department', e.target.value);
                        update('course', '');
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    >
                      <option value="">Select Department</option>
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Campus *</label>
                    <select
                      value={form.campus}
                      onChange={(e) => update('campus', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    >
                      <option value="">Select Campus</option>
                      {campusOptions.map((campus) => (
                        <option key={campus} value={campus}>
                          {campus}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Program *</label>
                    <select
                      value={form.course}
                      onChange={(e) => update('course', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    >
                      <option value="">Select Program</option>
                      {selectedProgramOptions.map((program) => (
                        <option key={program} value={program}>
                          {program}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {role !== null && (role === 'trainee' && step === 3) && (
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
                  <p className="text-sm text-gray-500 mt-2">Optional: you can skip this and enroll your face later from your Profile after logging in.</p>
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
              {validationErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded text-sm text-red-700">
                  <strong className="block mb-1">Please fix the following before continuing:</strong>
                  <ul className="list-disc list-inside">
                    {validationErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

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
                    disabled={!isStepValid() || isSubmitting}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-200"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        Complete Registration
                      </>
                    )}
                  </button>
                )}
              </div>
              {/* Error message display */}
              {submitError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
