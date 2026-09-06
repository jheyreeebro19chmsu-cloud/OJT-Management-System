import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import {
  User,
  Building,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  QrCode,
  Share2,
  Copy,
  MapPin,
  ShieldCheck,
  Mail,
  Lock,
  Phone,
  Calendar,
  BookOpen,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  FileCheck,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';

import { supabase } from '../lib/supabase';
import { mobileApi } from '../lib/api';
import { sendWelcomeEmailMobile, sendOtpEmailMobile } from '../lib/email';
import FaceScanner from '../components/FaceScanner';
import DropdownPicker from '../components/DropdownPicker';
import {
  campusOptions,
  departmentOptions,
  schoolOptions,
  yearLevelOptions,
  requiredHoursOptions,
  getCoursesForDepartment,
} from '../data/academicOptions';
import { countryOptions, PH_ADDRESS_DATA } from '../data/addressData';

type Role = 'trainee' | 'admin' | 'hte' | null;

interface RegisterScreenProps {
  onCancel: () => void;
  onSuccess: () => void;
  activeAcademicYear?: string;
}

export default function RegisterScreen({
  onCancel,
  onSuccess,
  activeAcademicYear = '2026-2027',
}: RegisterScreenProps) {
  const [role, setRole] = useState<Role>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Instructors and HTE list fetched from Supabase
  const [availableInstructors, setAvailableInstructors] = useState<{ label: string; value: string }[]>([]);
  const [availableHteCompanies, setAvailableHteCompanies] = useState<{ label: string; value: string }[]>([]);

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredInstructorId, setRegisteredInstructorId] = useState('');

  // Form State
  const [form, setForm] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    middleInitial: '',
    suffix: '',
    birthdate: '',
    age: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    emergencyContactName: '',
    emergencyContactPhone: '',

    // Address & Location
    country: 'Philippines',
    region: 'Region VI (Western Visayas)',
    province: 'Negros Occidental',
    city: 'Talisay City',
    barangay: '',
    street: '',
    address: '',

    // Academic Profile
    schoolName: 'Carlos Hilado Memorial State University',
    campus: 'Talisay Campus',
    department: 'College of Computer Studies',
    course: 'Bachelor of Science in Information Systems',
    yearLevel: '4th Year',
    section: '',
    instructorEmail: '',
    employeeId: '', // For instructor

    // HTE / Host Establishment
    companyName: '',
    companyAddress: '',
    supervisorName: '',
    supervisorPhone: '',
    supervisorEmail: '',
    requiredHours: '486',
    startDate: '',
    endDate: '',

    // Biometrics & Documents
    photo: '',
    documentsPassed: true,
  });

  // Email Validation State
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailTaken, setEmailTaken] = useState<null | boolean>(null);
  const [emailMsg, setEmailMsg] = useState('');

  // GPS Location State
  const [location, setLocation] = useState<{ lat?: number; lng?: number; accuracy?: number; error?: string }>({});
  const [locLoading, setLocLoading] = useState(false);

  // Load registered instructors and HTE companies for trainee dropdowns
  useEffect(() => {
    async function loadDropdownData() {
      try {
        // Fetch instructors
        const { data: instructors } = await supabase
          .from('employees')
          .select('id, name, email, department')
          .or('position.eq.OJT Instructor,role.eq.instructor,role.eq.admin');

        if (instructors && instructors.length > 0) {
          setAvailableInstructors(
            instructors.map((inst) => ({
              label: `${inst.name || 'Instructor'} (${inst.email})`,
              value: inst.email || inst.id,
            }))
          );
        } else {
          setAvailableInstructors([
            { label: 'Prof. Mark Santos (mark.santos@chmsu.edu.ph)', value: 'mark.santos@chmsu.edu.ph' },
            { label: 'Dr. Maria Elena Ramos (elena.ramos@chmsu.edu.ph)', value: 'elena.ramos@chmsu.edu.ph' },
            { label: 'Engr. Roberto Gomez (roberto.gomez@chmsu.edu.ph)', value: 'roberto.gomez@chmsu.edu.ph' },
          ]);
        }

        // Fetch HTE companies
        const { data: htes } = await supabase
          .from('host_supervisors')
          .select('id, company_name, name, contact_person, email');

        if (htes && htes.length > 0) {
          const uniqueCompanies = Array.from(new Set(htes.map((h) => h.company_name).filter(Boolean)));
          setAvailableHteCompanies([
            ...uniqueCompanies.map((comp) => ({ label: comp, value: comp })),
            { label: 'Other Company / External Establishment', value: 'Other' },
          ]);
        } else {
          setAvailableHteCompanies([
            { label: 'TechCorp Solutions Inc. - Bacolod', value: 'TechCorp Solutions Inc. - Bacolod' },
            { label: 'Provincial Capitol of Negros Occidental', value: 'Provincial Capitol of Negros Occidental' },
            { label: 'City Government of Talisay', value: 'City Government of Talisay' },
            { label: 'SM Prime Holdings Inc.', value: 'SM Prime Holdings Inc.' },
            { label: 'Other Company / External Establishment', value: 'Other' },
          ]);
        }
      } catch (err) {
        console.debug('Failed to load initial dropdown data:', err);
      }
    }
    loadDropdownData();
    requestLocation();
  }, []);

  // OTP Countdown Timer
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Request GPS Location
  async function requestLocation() {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation({ error: 'Location permission was denied. Please allow location access.' });
        setLocLoading(false);
        return;
      }
      
      let pos: Location.LocationObject | null = null;
      try {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch {
        try {
          pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {
          pos = await Location.getLastKnownPositionAsync();
        }
      }

      if (pos) {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        });
      } else {
        setLocation({ error: 'Could not acquire GPS coordinates' });
      }
    } catch (e: any) {
      setLocation({ error: e.message || 'Could not acquire GPS coordinates' });
    } finally {
      setLocLoading(false);
    }
  }

  // Dynamic Address Calculation based on Country / Region / Province
  const currentProvinces = useMemo(() => {
    if (form.country !== 'Philippines') return [];
    const regionObj = PH_ADDRESS_DATA.find((r) => r.name === form.region);
    return regionObj ? regionObj.provinces.map((p) => p.name) : [];
  }, [form.country, form.region]);

  const currentCities = useMemo(() => {
    if (form.country !== 'Philippines') return [];
    const regionObj = PH_ADDRESS_DATA.find((r) => r.name === form.region);
    if (!regionObj) return [];
    const provObj = regionObj.provinces.find((p) => p.name === form.province);
    return provObj ? provObj.cities : [];
  }, [form.country, form.region, form.province]);

  // Dynamic Course calculation based on Campus and College Department
  const dynamicCourses = useMemo(() => {
    return getCoursesForDepartment(form.department, form.campus);
  }, [form.department, form.campus]);

  // Auto-compose full address
  useEffect(() => {
    if (form.country === 'Philippines') {
      const parts = [form.street, form.barangay, form.city, form.province, form.region, 'Philippines'].filter(
        Boolean
      );
      setForm((prev) => ({ ...prev, address: parts.join(', ') }));
    } else {
      const parts = [form.street, form.city, form.country].filter(Boolean);
      setForm((prev) => ({ ...prev, address: parts.join(', ') }));
    }
  }, [form.country, form.region, form.province, form.city, form.barangay, form.street]);

  const updateForm = (key: string, value: any) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };

      // Auto-compute age if birthdate changes (YYYY-MM-DD)
      if (key === 'birthdate' && value.length >= 10) {
        const birthDate = new Date(value);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
          updated.age = age > 0 ? age.toString() : '';
        }
      }

      // Reset province/city if region changes
      if (key === 'region') {
        const regionObj = PH_ADDRESS_DATA.find((r) => r.name === value);
        if (regionObj && regionObj.provinces.length > 0) {
          updated.province = regionObj.provinces[0].name;
          updated.city = regionObj.provinces[0].cities[0] || '';
        }
      }

      // Reset city if province changes
      if (key === 'province') {
        const regionObj = PH_ADDRESS_DATA.find((r) => r.name === updated.region);
        const provObj = regionObj?.provinces.find((p) => p.name === value);
        if (provObj && provObj.cities.length > 0) {
          updated.city = provObj.cities[0];
        }
      }

      // Update course when department/campus changes
      if (key === 'department' || key === 'campus') {
        const courses = getCoursesForDepartment(
          key === 'department' ? value : updated.department,
          key === 'campus' ? value : updated.campus
        );
        if (courses.length > 0 && !courses.includes(updated.course as any)) {
          updated.course = courses[0];
        }
      }

      return updated;
    });
  };

  // Live Email Uniqueness Check in Supabase
  async function checkEmailExists(email: string) {
    if (!email || !email.includes('@')) return;
    setEmailChecking(true);
    setEmailTaken(null);
    setEmailMsg('');
    try {
      const { data: emp } = await supabase.from('employees').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
      if (emp) {
        setEmailTaken(true);
        setEmailMsg('This email is already registered in the system.');
        return;
      }
      const { data: host } = await supabase.from('host_supervisors').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
      if (host) {
        setEmailTaken(true);
        setEmailMsg('This email is already in use by an HTE supervisor.');
        return;
      }
      setEmailTaken(false);
      setEmailMsg('Email is available!');
    } catch (e: any) {
      console.debug('Email check failed', e);
    } finally {
      setEmailChecking(false);
    }
  }

  // Password Security Checklist
  const passwordChecks = (pw: string) => ({
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  });

  // Step definitions (No Email OTP step)
  const stepsTrainee = [
    'Personal Info',
    'Address & Location',
    'School Profile',
    'HTE & Internship',
    'Face Biometrics',
  ];

  const stepsAdmin = [
    'Instructor Account',
    'Campus Assignment',
  ];

  const stepsHTE = [
    'Establishment Info',
    'Supervisor Account',
  ];

  const steps = role === 'admin' ? stepsAdmin : role === 'hte' ? stepsHTE : stepsTrainee;

  // Step Validation before progressing
  const validateCurrentStep = (): boolean => {
    if (role === 'trainee') {
      if (step === 0) {
        if (!form.firstName.trim() || !form.lastName.trim()) {
          Alert.alert('Required Fields', 'Please enter your first name and last name.');
          return false;
        }
        if (!form.birthdate.trim()) {
          Alert.alert('Required Fields', 'Please provide your birthdate.');
          return false;
        }
        if (!form.email.trim() || emailTaken) {
          Alert.alert('Email Required', 'Please enter a valid, available email address.');
          return false;
        }
        const checks = passwordChecks(form.password);
        if (!checks.length || !checks.uppercase || !checks.number) {
          Alert.alert('Password Security', 'Your password must be at least 8 characters long and include uppercase letters and numbers.');
          return false;
        }
        if (form.password !== form.confirmPassword) {
          Alert.alert('Password Mismatch', 'Your passwords do not match. Please verify.');
          return false;
        }
      }
      if (step === 1) {
        if (!form.city.trim()) {
          Alert.alert('Address Required', 'Please specify your city or municipality.');
          return false;
        }
      }
      if (step === 2) {
        if (!form.schoolName || !form.campus || !form.department || !form.course) {
          Alert.alert('Academic Profile', 'Please complete your school, campus, college, and degree program fields.');
          return false;
        }
      }
      if (step === 3) {
        if (!form.companyName.trim()) {
          Alert.alert('Host Establishment', 'Please select or enter your Host Training Establishment (HTE) company name.');
          return false;
        }
      }
      if (step === 4) {
        if (!form.photo) {
          Alert.alert('Biometrics Required', 'Please capture your face biometrics to complete registration.');
          return false;
        }
      }
    } else if (role === 'admin') {
      if (step === 0) {
        if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim()) {
          Alert.alert('Required Fields', 'Please complete your name, email, and password.');
          return false;
        }
      }
      if (step === 1) {
        if (!form.campus || !form.department) {
          Alert.alert('Campus Details', 'Please select your campus and department.');
          return false;
        }
      }
    } else if (role === 'hte') {
      if (step === 0) {
        if (!form.companyName.trim() || !form.city.trim()) {
          Alert.alert('Establishment Info', 'Please provide your company name and address.');
          return false;
        }
      }
      if (step === 1) {
        if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim()) {
          Alert.alert('Supervisor Account', 'Please provide your full name, email, and password.');
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Final step -> directly finalize registration
      handleFinalizeRegistration();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      setRole(null);
    }
  };

  // Final Registration & Supabase Submission
  async function handleFinalizeRegistration() {
    setLoading(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim() || 'User';

      // 1. Supabase Auth Sign-Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            full_name: fullName,
            role: role === 'admin' ? 'admin' : role === 'hte' ? 'host' : 'employee',
          },
        },
      });

      if (authError && !authError.message.toLowerCase().includes('already registered')) {
        throw authError;
      }

      const userId = authData?.user?.id || `emp-${Date.now()}`;

      // 2. Build Profile Data Partitioned by Academic Year
      const profileData: any = {
        id: userId,
        name: fullName,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        middle_initial: form.middleInitial.trim() || undefined,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        academic_year: activeAcademicYear,
        active: true,
        approval_status: 'approved',
        application_status: 'approved',
        location: location.lat && location.lng ? { lat: location.lat, lng: location.lng } : undefined,
        registration_location: location.lat && location.lng ? { lat: location.lat, lng: location.lng } : undefined,
        registration_address: form.address,
        company_address: form.companyAddress || form.address,
        photo: form.photo || undefined,
        face_registered: Boolean(form.photo),
      };

      if (role === 'trainee') {
        profileData.position = 'OJT Trainee';
        profileData.department = form.department;
        profileData.course = form.course;
        profileData.campus = form.campus;
        profileData.school_name = form.schoolName;
        profileData.year_level = form.yearLevel;
        profileData.section = form.section || undefined;
        profileData.company_name = form.companyName;
        profileData.instructor_email = form.instructorEmail || undefined;
        profileData.supervisor_name = form.supervisorName || undefined;
        profileData.supervisor_phone = form.supervisorPhone || undefined;
        profileData.required_hours = parseInt(form.requiredHours, 10) || 486;
        profileData.start_date = form.startDate || new Date().toISOString().split('T')[0];
        profileData.end_date = form.endDate || undefined;
      } else if (role === 'admin') {
        profileData.position = 'OJT Instructor';
        profileData.department = form.department;
        profileData.campus = form.campus;
        profileData.school_name = form.schoolName;
        profileData.employee_id = form.employeeId || undefined;
      } else if (role === 'hte') {
        profileData.position = 'Training Supervisor';
        profileData.company_name = form.companyName;
        profileData.department = form.department;
      }

      // Upsert into employees table
      const { error: profileError } = await supabase.from('employees').upsert(profileData);
      if (profileError) {
        console.warn('Employees upsert warning:', profileError);
      }

      // If HTE supervisor, also sync to host_supervisors table
      if (role === 'hte') {
        await supabase.from('host_supervisors').upsert({
          id: userId,
          name: fullName,
          email: form.email.trim().toLowerCase(),
          company_name: form.companyName,
          company_address: form.companyAddress || form.address,
          contact_person: fullName,
          phone: form.phone || undefined,
          academic_year: activeAcademicYear,
        });
      }

      // 3. Auto-Create Geofence Zone for Trainee tagged with Academic Year
      if (role === 'trainee' && location.lat && location.lng) {
        try {
          const zonePayload = {
            id: `personal-${userId}`,
            name: `${fullName} - ${form.companyName || 'Assigned Workplace'}`,
            address: form.companyAddress || form.address || 'Trainee Workplace',
            lat: location.lat,
            lng: location.lng,
            radius: 300,
            active: true,
            academic_year: activeAcademicYear,
          };
          await supabase.from('geofence_zones').upsert(zonePayload);
        } catch (zoneErr) {
          console.debug('Failed to auto-sync geofence zone:', zoneErr);
        }
      }

      // 4. Send Welcome Confirmation Email
      try {
        await sendWelcomeEmailMobile(form.email.trim(), fullName);
      } catch (e) {
        console.debug('Welcome email dispatch skipped:', e);
      }

      // Handle Success
      if (role === 'admin') {
        setRegisteredInstructorId(userId);
        setRegistrationComplete(true);
      } else {
        Alert.alert(
          'Registration Successful!',
          `Your account has been enrolled for Academic Year ${activeAcademicYear}. You can now log in to access your OJT dashboard.`,
          [{ text: 'Proceed to Login', onPress: onSuccess }]
        );
      }
    } catch (err: any) {
      Alert.alert('Registration Error', err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  }

  // Camera Face Capture Modal
  if (showScanner) {
    return (
      <FaceScanner
        onCapture={(img) => {
          updateForm('photo', img);
          setShowScanner(false);
        }}
        onCancel={() => setShowScanner(false)}
      />
    );
  }

  // Instructor Registration Success Screen with Enrollment QR Code
  if (registrationComplete && role === 'admin') {
    const instructorQrData = JSON.stringify({
      type: 'instructor_enrollment',
      instructorId: registeredInstructorId || form.email,
      name: `${form.firstName} ${form.lastName}`.trim() || 'OJT Instructor',
      campus: form.campus,
      department: form.department,
      academicYear: activeAcademicYear,
    });

    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Check color="#ffffff" size={32} />
          </View>
          <Text style={styles.successTitle}>Instructor Registered!</Text>
          <Text style={styles.successDesc}>
            Your instructor account is active for AY {activeAcademicYear}. Share your Enrollment QR Code with your trainees:
          </Text>

          <View style={styles.qrWrapper}>
            <QRCode value={instructorQrData} size={180} color="#0f172a" backgroundColor="#ffffff" />
          </View>

          <Text style={styles.badgeLabel}>INSTRUCTOR ID / EMAIL</Text>
          <Text style={styles.badgeValue} selectable>
            {registeredInstructorId || form.email}
          </Text>

          <View style={styles.successBtnGroup}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={async () => {
                try {
                  await Share.share({
                    message: `Enroll in OJT with Instructor ${form.firstName} ${form.lastName} using ID: ${registeredInstructorId || form.email} (AY ${activeAcademicYear})`,
                  });
                } catch (err: any) {
                  Alert.alert('Share error', err.message);
                }
              }}
            >
              <Share2 size={16} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.shareBtnText}>Share Enrollment Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginBtn} onPress={onSuccess}>
              <Text style={styles.loginBtnText}>Proceed to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Role Selection Screen
  if (role === null) {
    return (
      <View style={styles.roleContainer}>
        <TouchableOpacity style={styles.backLink} onPress={onCancel}>
          <ArrowLeft color="#64748b" size={20} />
          <Text style={styles.backLinkText}>Back to Login</Text>
        </TouchableOpacity>

        <Text style={styles.roleTitle}>Create Account</Text>
        <Text style={styles.roleSubtitle}>
          Select your portal role for Academic Year <Text style={{ color: '#2563eb', fontWeight: '800' }}>{activeAcademicYear}</Text>
        </Text>

        {/* Trainee Card */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => {
            setRole('trainee');
            setStep(0);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIcon, { backgroundColor: '#eff6ff' }]}>
            <User color="#2563eb" size={26} />
          </View>
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleName}>Trainee / Student</Text>
            <Text style={styles.roleDesc}>
              Complete your daily time records (DTR), upload documents, and track OJT rendered hours.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Instructor Card */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => {
            setRole('admin');
            setStep(0);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIcon, { backgroundColor: '#fffbeb' }]}>
            <GraduationCap color="#d97706" size={26} />
          </View>
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleName}>OJT Instructor</Text>
            <Text style={styles.roleDesc}>
              Manage trainee cohorts, approve student attendance logs, and generate enrollment QR codes.
            </Text>
          </View>
        </TouchableOpacity>

        {/* HTE Supervisor Card */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => {
            setRole('hte');
            setStep(0);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIcon, { backgroundColor: '#f0fdf4' }]}>
            <Building color="#166534" size={26} />
          </View>
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleName}>HTE Supervisor</Text>
            <Text style={styles.roleDesc}>
              Monitor trainee attendance at your establishment and submit evaluation feedback.
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Multi-step Registration Form
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* GPS Location Bar */}
        <View style={styles.gpsBanner}>
          {locLoading ? (
            <View style={styles.gpsLoading}>
              <ActivityIndicator size="small" color="#d97706" />
              <Text style={styles.gpsLoadingText}>Acquiring device GPS coordinates...</Text>
            </View>
          ) : location.error ? (
            <View style={styles.gpsWarning}>
              <MapPin size={15} color="#d97706" />
              <Text style={styles.gpsWarningText}>GPS offline. Geofencing will use defaults.</Text>
              <TouchableOpacity onPress={requestLocation} style={styles.gpsRetryBtn}>
                <Text style={styles.gpsRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : location.lat && location.lng ? (
            <View style={styles.gpsSuccess}>
              <MapPin size={15} color="#059669" />
              <Text style={styles.gpsSuccessText}>
                GPS Locked: {location.lat?.toFixed(4)}, {location.lng?.toFixed(4)} (±{Math.round(location.accuracy || 0)}m)
              </Text>
            </View>
          ) : null}
        </View>

        {/* Step Header */}
        <View style={styles.stepHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft color="#1e293b" size={22} />
          </TouchableOpacity>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>
              Step {step + 1} of {steps.length}
            </Text>
            <Text style={styles.stepLabel}>{steps[step]}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Step Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((step + 1) / steps.length) * 100}%` },
            ]}
          />
        </View>

        {/* Form Container */}
        <View style={styles.formCard}>
          {/* ========================================================= */}
          {/* TRAINEE FLOW */}
          {/* ========================================================= */}

          {/* Trainee Step 1: Personal & Account */}
          {role === 'trainee' && step === 0 && (
            <>
              <Text style={styles.sectionHeading}>Personal Information</Text>

              <View style={styles.nameRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Last Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Dela Cruz"
                    placeholderTextColor="#94a3b8"
                    value={form.lastName}
                    onChangeText={(v) => updateForm('lastName', v)}
                  />
                </View>
                <View style={{ flex: 2, marginLeft: 8 }}>
                  <Text style={styles.fieldLabel}>First Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Juan"
                    placeholderTextColor="#94a3b8"
                    value={form.firstName}
                    onChangeText={(v) => updateForm('firstName', v)}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.fieldLabel}>M.I.</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="D"
                    placeholderTextColor="#94a3b8"
                    maxLength={2}
                    value={form.middleInitial}
                    onChangeText={(v) => updateForm('middleInitial', v)}
                  />
                </View>
              </View>

              <View style={styles.nameRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Birthdate (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="2003-05-15"
                    placeholderTextColor="#94a3b8"
                    value={form.birthdate}
                    onChangeText={(v) => updateForm('birthdate', v)}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.fieldLabel}>Age</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: '#f1f5f9', color: '#475569' }]}
                    placeholder="21"
                    placeholderTextColor="#94a3b8"
                    value={form.age}
                    editable={false}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Contact Phone Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="09123456789"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(v) => updateForm('phone', v)}
              />

              <Text style={styles.fieldLabel}>Email Address *</Text>
              <TextInput
                style={[styles.textInput, emailTaken ? styles.inputError : null]}
                placeholder="juan.delacruz@chmsu.edu.ph"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(v) => {
                  updateForm('email', v);
                  setEmailTaken(null);
                }}
                onBlur={() => checkEmailExists(form.email)}
              />
              {emailChecking ? (
                <Text style={styles.helperText}>Checking email availability...</Text>
              ) : emailTaken ? (
                <Text style={styles.errorText}>{emailMsg}</Text>
              ) : emailTaken === false ? (
                <Text style={styles.successHelperText}>Email is available!</Text>
              ) : null}

              {/* Password */}
              <Text style={styles.fieldLabel}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Create a strong password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={form.password}
                  onChangeText={(v) => updateForm('password', v)}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <Text style={styles.fieldLabel}>Confirm Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Repeat your password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showConfirmPassword}
                  value={form.confirmPassword}
                  onChangeText={(v) => updateForm('confirmPassword', v)}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                  {showConfirmPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </TouchableOpacity>
              </View>

              {/* Password Security Checklist */}
              {form.password.length > 0 && (
                <View style={styles.checklistCard}>
                  <Text style={styles.checklistTitle}>Password Requirements:</Text>
                  {(() => {
                    const checks = passwordChecks(form.password);
                    return (
                      <>
                        <Text style={[styles.checkItem, checks.length ? styles.checkItemPassed : null]}>
                          {checks.length ? '✓' : '•'} At least 8 characters
                        </Text>
                        <Text style={[styles.checkItem, checks.uppercase ? styles.checkItemPassed : null]}>
                          {checks.uppercase ? '✓' : '•'} Contains uppercase letter (A-Z)
                        </Text>
                        <Text style={[styles.checkItem, checks.number ? styles.checkItemPassed : null]}>
                          {checks.number ? '✓' : '•'} Contains a number (0-9)
                        </Text>
                      </>
                    );
                  })()}
                </View>
              )}
            </>
          )}

          {/* Trainee Step 2: Address & Location */}
          {role === 'trainee' && step === 1 && (
            <>
              <Text style={styles.sectionHeading}>Address & Geofence Details</Text>

              <DropdownPicker
                label="Country"
                value={form.country}
                options={countryOptions}
                onSelect={(val) => updateForm('country', val)}
                required
              />

              {form.country === 'Philippines' ? (
                <>
                  <DropdownPicker
                    label="Region"
                    value={form.region}
                    options={PH_ADDRESS_DATA.map((r) => r.name)}
                    onSelect={(val) => updateForm('region', val)}
                    required
                  />

                  <DropdownPicker
                    label="Province"
                    value={form.province}
                    options={currentProvinces}
                    onSelect={(val) => updateForm('province', val)}
                    required
                  />

                  <DropdownPicker
                    label="City / Municipality"
                    value={form.city}
                    options={currentCities}
                    onSelect={(val) => updateForm('city', val)}
                    required
                  />
                </>
              ) : (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.fieldLabel}>City / State / Region *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter city and state"
                    placeholderTextColor="#94a3b8"
                    value={form.city}
                    onChangeText={(v) => updateForm('city', v)}
                  />
                </View>
              )}

              <Text style={styles.fieldLabel}>Barangay / District</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Brgy. Zone 2"
                placeholderTextColor="#94a3b8"
                value={form.barangay}
                onChangeText={(v) => updateForm('barangay', v)}
              />

              <Text style={styles.fieldLabel}>Street / Unit / House No.</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 123 Rizal St."
                placeholderTextColor="#94a3b8"
                value={form.street}
                onChangeText={(v) => updateForm('street', v)}
              />

              {/* Full Address Preview */}
              <View style={styles.addressPreviewCard}>
                <Text style={styles.addressPreviewTitle}>Composed Full Address:</Text>
                <Text style={styles.addressPreviewText}>
                  {form.address || 'Address will appear here automatically.'}
                </Text>
              </View>
            </>
          )}

          {/* Trainee Step 3: School & Academic Profile */}
          {role === 'trainee' && step === 2 && (
            <>
              <Text style={styles.sectionHeading}>School & Academic Information</Text>

              <DropdownPicker
                label="School / University"
                value={form.schoolName}
                options={schoolOptions}
                onSelect={(val) => updateForm('schoolName', val)}
                required
              />

              <DropdownPicker
                label="Campus"
                value={form.campus}
                options={campusOptions}
                onSelect={(val) => updateForm('campus', val)}
                required
              />

              <DropdownPicker
                label="College / Department"
                value={form.department}
                options={departmentOptions}
                onSelect={(val) => updateForm('department', val)}
                required
              />

              <DropdownPicker
                label="Degree Program / Course"
                value={form.course}
                options={dynamicCourses}
                onSelect={(val) => updateForm('course', val)}
                required
              />

              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <DropdownPicker
                    label="Year Level"
                    value={form.yearLevel}
                    options={yearLevelOptions}
                    onSelect={(val) => updateForm('yearLevel', val)}
                    required
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.fieldLabel}>Section / Group</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. BSIS-4A"
                    placeholderTextColor="#94a3b8"
                    value={form.section}
                    onChangeText={(v) => updateForm('section', v)}
                  />
                </View>
              </View>

              <DropdownPicker
                label="Assigned OJT Instructor"
                value={form.instructorEmail}
                options={availableInstructors}
                onSelect={(val) => updateForm('instructorEmail', val)}
                placeholder="Select your OJT Instructor"
                customAllow
              />
            </>
          )}

          {/* Trainee Step 4: HTE & Internship Terms */}
          {role === 'trainee' && step === 3 && (
            <>
              <Text style={styles.sectionHeading}>Host Training Establishment (HTE)</Text>

              <DropdownPicker
                label="Host Company / Establishment"
                value={form.companyName}
                options={availableHteCompanies}
                onSelect={(val) => updateForm('companyName', val)}
                placeholder="Select Host Company"
                customAllow
                required
              />

              <Text style={styles.fieldLabel}>Company Physical Address</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Lacson St., Bacolod City"
                placeholderTextColor="#94a3b8"
                value={form.companyAddress}
                onChangeText={(v) => updateForm('companyAddress', v)}
              />

              <Text style={styles.fieldLabel}>HTE Supervisor / Contact Person</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Engr. Alex Ramos"
                placeholderTextColor="#94a3b8"
                value={form.supervisorName}
                onChangeText={(v) => updateForm('supervisorName', v)}
              />

              <DropdownPicker
                label="Required OJT Training Hours"
                value={form.requiredHours}
                options={requiredHoursOptions}
                onSelect={(val) => updateForm('requiredHours', val)}
                required
              />

              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Start Date</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={form.startDate}
                    onChangeText={(v) => updateForm('startDate', v)}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.fieldLabel}>Expected End Date</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={form.endDate}
                    onChangeText={(v) => updateForm('endDate', v)}
                  />
                </View>
              </View>
            </>
          )}

          {/* Trainee Step 5: Face Biometrics Enrollment */}
          {role === 'trainee' && step === 4 && (
            <>
              <Text style={styles.sectionHeading}>Face Biometrics Enrollment</Text>
              <Text style={styles.sectionSubtitle}>
                Register your face for AI-powered attendance verification during daily time recording (DTR).
              </Text>

              {form.photo ? (
                <View style={styles.facePreviewContainer}>
                  <Image source={{ uri: form.photo }} style={styles.facePreviewImage} />
                  <View style={styles.faceVerifiedBadge}>
                    <Check size={14} color="#ffffff" />
                    <Text style={styles.faceVerifiedBadgeText}>Biometrics Captured</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={() => setShowScanner(true)}
                  >
                    <RefreshCw size={14} color="#2563eb" style={{ marginRight: 6 }} />
                    <Text style={styles.retakeBtnText}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.capturePromptCard}>
                  <Camera size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                  <Text style={styles.capturePromptTitle}>No Face Enrolled Yet</Text>
                  <Text style={styles.capturePromptDesc}>
                    Look directly into your front camera in good lighting to capture your biometric template.
                  </Text>
                  <TouchableOpacity
                    style={styles.openScannerBtn}
                    onPress={() => setShowScanner(true)}
                  >
                    <Camera size={18} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.openScannerBtnText}>Open Face Scanner</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Document Status Check */}
              <View style={styles.docStatusCard}>
                <FileCheck size={20} color="#059669" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.docStatusTitle}>OJT Registration Documents</Text>
                  <Text style={styles.docStatusDesc}>
                    Medical Clearance, Waiver & Endorsement will be certified automatically upon activation.
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ========================================================= */}
          {/* INSTRUCTOR FLOW */}
          {/* ========================================================= */}
          {role === 'admin' && step === 0 && (
            <>
              <Text style={styles.sectionHeading}>Instructor Account Details</Text>

              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>First Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Prof. Juan"
                    placeholderTextColor="#94a3b8"
                    value={form.firstName}
                    onChangeText={(v) => updateForm('firstName', v)}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.fieldLabel}>Last Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Dela Cruz"
                    placeholderTextColor="#94a3b8"
                    value={form.lastName}
                    onChangeText={(v) => updateForm('lastName', v)}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Institutional Email Address *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="instructor@chmsu.edu.ph"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(v) => updateForm('email', v)}
              />

              <Text style={styles.fieldLabel}>Contact Phone Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="09123456789"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(v) => updateForm('phone', v)}
              />

              <Text style={styles.fieldLabel}>Password *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={form.password}
                onChangeText={(v) => updateForm('password', v)}
              />
            </>
          )}

          {role === 'admin' && step === 1 && (
            <>
              <Text style={styles.sectionHeading}>Campus & Department Assignment</Text>

              <DropdownPicker
                label="University / Institution"
                value={form.schoolName}
                options={schoolOptions}
                onSelect={(val) => updateForm('schoolName', val)}
                required
              />

              <DropdownPicker
                label="Assigned Campus"
                value={form.campus}
                options={campusOptions}
                onSelect={(val) => updateForm('campus', val)}
                required
              />

              <DropdownPicker
                label="College Department"
                value={form.department}
                options={departmentOptions}
                onSelect={(val) => updateForm('department', val)}
                required
              />

              <Text style={styles.fieldLabel}>Faculty / Employee ID (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. FAC-2026-001"
                placeholderTextColor="#94a3b8"
                value={form.employeeId}
                onChangeText={(v) => updateForm('employeeId', v)}
              />
            </>
          )}

          {/* ========================================================= */}
          {/* HTE REPRESENTATIVE FLOW */}
          {/* ========================================================= */}
          {role === 'hte' && step === 0 && (
            <>
              <Text style={styles.sectionHeading}>Establishment Information</Text>

              <Text style={styles.fieldLabel}>Company / Organization Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Ayala Land Corp. / TechCorp"
                placeholderTextColor="#94a3b8"
                value={form.companyName}
                onChangeText={(v) => updateForm('companyName', v)}
              />

              <DropdownPicker
                label="Industry / Department Type"
                value={form.department}
                options={departmentOptions}
                onSelect={(val) => updateForm('department', val)}
                required
              />

              <DropdownPicker
                label="City / Municipality"
                value={form.city}
                options={currentCities.length > 0 ? currentCities : ['Bacolod City', 'Talisay City', 'Silay City', 'Other']}
                onSelect={(val) => updateForm('city', val)}
                required
              />

              <Text style={styles.fieldLabel}>Company Physical Address</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 4th Floor, Tech Tower, Lacson St."
                placeholderTextColor="#94a3b8"
                value={form.companyAddress}
                onChangeText={(v) => updateForm('companyAddress', v)}
              />
            </>
          )}

          {role === 'hte' && step === 1 && (
            <>
              <Text style={styles.sectionHeading}>Supervisor Profile</Text>

              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>First Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Supervisor First Name"
                    placeholderTextColor="#94a3b8"
                    value={form.firstName}
                    onChangeText={(v) => updateForm('firstName', v)}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.fieldLabel}>Last Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Last Name"
                    placeholderTextColor="#94a3b8"
                    value={form.lastName}
                    onChangeText={(v) => updateForm('lastName', v)}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Official Email Address *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="supervisor@company.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(v) => updateForm('email', v)}
              />

              <Text style={styles.fieldLabel}>Contact Phone Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="09123456789"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(v) => updateForm('phone', v)}
              />

              <Text style={styles.fieldLabel}>Password *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Create password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={form.password}
                onChangeText={(v) => updateForm('password', v)}
              />
            </>
          )}

          {/* ========================================================= */}
          {/* FINAL STEP FOR ALL ROLES: OTP VERIFICATION & ACTIVATION */}
          {/* ========================================================= */}
          {/* Bottom Action Navigation Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.prevBtn} onPress={handleBack} disabled={loading}>
              <Text style={styles.prevBtnText}>{step === 0 ? 'Change Role' : 'Previous'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, loading && styles.nextBtnDisabled]}
              onPress={handleNext}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>
                    {step === steps.length - 1 ? 'Complete Registration & Activate' : 'Next Step'}
                  </Text>
                  <ArrowRight size={18} color="#ffffff" style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingBottom: 40,
  },
  gpsBanner: {
    marginBottom: 12,
  },
  gpsLoading: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsLoadingText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '500',
  },
  gpsWarning: {
    backgroundColor: '#fffbeb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  gpsWarningText: {
    color: '#b45309',
    fontSize: 12,
    flex: 1,
    marginLeft: 6,
  },
  gpsRetryBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gpsRetryText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  gpsSuccess: {
    backgroundColor: '#ecfdf5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 6,
  },
  gpsSuccessText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  stepIndicator: {
    alignItems: 'center',
  },
  stepText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 14,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  helperText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 2,
  },
  successHelperText: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 14,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeBtn: {
    padding: 6,
  },
  checklistCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  checkItem: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  checkItemPassed: {
    color: '#16a34a',
    fontWeight: '600',
  },
  addressPreviewCard: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 4,
    marginBottom: 14,
  },
  addressPreviewTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e40af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  addressPreviewText: {
    fontSize: 13,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  facePreviewContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  facePreviewImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: '#2563eb',
    marginBottom: 12,
  },
  faceVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    marginBottom: 12,
  },
  faceVerifiedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  retakeBtnText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  capturePromptCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  capturePromptTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
  },
  capturePromptDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },
  openScannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  openScannerBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  docStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  docStatusTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  docStatusDesc: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  otpContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  otpIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  otpTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  otpDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  otpInput: {
    width: '80%',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 10,
    color: '#0f172a',
    marginBottom: 16,
  },
  resendRow: {
    marginBottom: 16,
  },
  resendTimerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  resendBtnText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '700',
  },
  enrollmentNotice: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
  },
  enrollmentNoticeText: {
    fontSize: 12,
    color: '#334155',
  },
  enrollmentNoticeDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  prevBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 13,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Role Selection Screen Styles */
  roleContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  roleTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleTextWrapper: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  roleDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },

  /* Instructor Registration Success Screen */
  successContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  successDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  qrWrapper: {
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  badgeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 2,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  successBtnGroup: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  loginBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 13,
    borderRadius: 12,
  },
  loginBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
});
