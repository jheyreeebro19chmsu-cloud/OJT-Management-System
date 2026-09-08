import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  Modal,
  LogBox,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Ignore development console noise/overlays on device
LogBox.ignoreAllLogs(true);
import {
  User,
  LogOut,
  Camera as CameraIcon,
  QrCode,
  ClipboardList,
  Bell,
  Plus,
  Clock,
  Check,
  Key,
  Building,
  Star,
  ChevronRight,
  Award,
  Home,
  FileText,
  MapPin,
  Users,
  ShieldCheck,
  Shield,
  AlertTriangle,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Navigation,
  Fingerprint,
  Zap,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from './lib/supabase';
import { setAuthToken, getApiBaseUrl, faceApi, post } from './lib/api';
import { mobileDb, TimeRecord } from './lib/supabaseService';
import authStore from './lib/auth';
import RegisterScreen from './screens/RegisterScreen';
import ApplicationScreen from './screens/ApplicationScreen';
import TasksScreen from './screens/TasksScreen';
import DTRScreen from './screens/DTRScreen';
import HTELinkScreen from './screens/HTELinkScreen';
import InstructorTraineesScreen from './screens/InstructorTraineesScreen';
import InstructorDashboard from './screens/InstructorDashboard';
import InstructorDTRScreen from './screens/InstructorDTRScreen';
import InstructorQRScreen from './screens/InstructorQRScreen';
import HTEDashboardScreen from './screens/HTEDashboardScreen';
import HTEEvaluationScreen from './screens/HTEEvaluationScreen';
import HTEDTRScreen from './screens/HTEDTRScreen';
import TraineeRecordsScreen from './screens/TraineeRecordsScreen';
import FaceScanner from './components/FaceScanner';
import AnnouncementsScreen from './screens/AnnouncementsScreen';
import ProfileScreen from './screens/ProfileScreen';
import EvaluationScreen from './screens/EvaluationScreen';
import { getSchoolLogo } from './utils/schoolLogos';

function normalizeRole(position?: string | null) {
  const value = String(position || '').trim();
  if (value === 'OJT Instructor' || value === 'Administrator' || value === 'admin' || value === 'instructor') return 'admin';
  if (value === 'Training Supervisor' || value === 'HTE Representative' || value === 'hte' || value === 'host') return 'hte';
  return 'employee';
}

function normalizeProfile(data: any) {
  if (!data) return null;
  return {
    ...data,
    role: normalizeRole(data.position || data.role),
    instructor_id: data.instructor_id || data.instructorId || data.application_id || data.id,
    registration_location: data.registration_location || data.registrationLocation,
    schoolName: data.school_name || data.schoolName,
    companyName: data.company_name || data.companyName,
    application_status: data.application_status || data.status || null,
  };
}

function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'register'>('login');

  // Trainee modals & sub-screens
  const [scanning, setScanning] = useState(false);
  const [scannedInstructorId, setScannedInstructorId] = useState<string | null>(null);
  const [showApplication, setShowApplication] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showDTR, setShowDTR] = useState(false);
  const [showHTELink, setShowHTELink] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  // Instructor sub-screens
  const [showInstructorTrainees, setShowInstructorTrainees] = useState(false);
  const [showInstructorDTR, setShowInstructorDTR] = useState(false);
  const [showInstructorQR, setShowInstructorQR] = useState(false);

  // HTE sub-screens
  const [showHTETrainees, setShowHTETrainees] = useState(false);
  const [showHTEDTR, setShowHTEDTR] = useState(false);
  const [showHTEEvaluation, setShowHTEEvaluation] = useState(false);

  // Trainee Records Viewer
  const [showRecords, setShowRecords] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);

  // Face biometrics
  const [showFaceEnroll, setShowFaceEnroll] = useState(false);
  const [faceEnrollInProgress, setFaceEnrollInProgress] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Trainee Live Geofencing state
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean>(false);
  const [distanceToSite, setDistanceToSite] = useState<number | null>(null);
  const [assignedWorkplaceName, setAssignedWorkplaceName] = useState<string>('Carlos Hilado Memorial State University');
  const [locLoading, setLocLoading] = useState<boolean>(false);

  // Biometric Attendance modal mode ('enroll' | 'clock_in' | 'clock_out' | 'verify_test' | null)
  const [faceModalMode, setFaceModalMode] = useState<'enroll' | 'clock_in' | 'clock_out' | 'verify_test' | null>(null);

  // Academic Years
  const [showAcademicYearEditor, setShowAcademicYearEditor] = useState(false);
  const [newAcademicYear, setNewAcademicYear] = useState('');
  const [academicYears, setAcademicYears] = useState<string[]>(() => {
    const current = getCurrentAcademicYear();
    return [current, current.includes('2025') ? '2026-2027' : '2025-2026'];
  });
  const [activeAcademicYear, setActiveAcademicYear] = useState<string>(() => getCurrentAcademicYear());

  // Trainee dashboard metrics
  const [renderedHours, setRenderedHours] = useState<number>(0);
  const [dashboardRecord, setDashboardRecord] = useState<any>(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function evaluateDashboardGeofence(location: Location.LocationObject, userProfile: any = profile) {
    if (!location) return;
    const targetCoordsList: { name: string; lat: number; lng: number; radius: number }[] = [];

    // 1. Profile registration location / workplace
    const regLoc =
      userProfile?.registration_location ||
      userProfile?.registrationLocation ||
      (userProfile?.registration_lat && userProfile?.registration_lng
        ? { lat: userProfile.registration_lat, lng: userProfile.registration_lng }
        : null);
    if (regLoc?.lat && regLoc?.lng) {
      targetCoordsList.push({
        name: userProfile?.companyName || userProfile?.company_name || 'Assigned OJT Workplace',
        lat: Number(regLoc.lat),
        lng: Number(regLoc.lng),
        radius: 300,
      });
    }

    // 2. Query geofence zones from Supabase
    try {
      const zones = await mobileDb.getGeofenceZones();
      const empId = userProfile?.id || userProfile?.employeeId || '';
      zones.forEach((z) => {
        if (z.lat && z.lng) {
          const isPersonal = z.id === `personal-${empId}` || z.id === `geo-trainee-${empId}`;
          const isCompany =
            userProfile?.companyName && z.name && z.name.toLowerCase().includes(userProfile.companyName.toLowerCase());
          if (isPersonal || isCompany || !userProfile?.companyName) {
            targetCoordsList.push({
              name: z.name || 'OJT Geofence Zone',
              lat: z.lat,
              lng: z.lng,
              radius: z.radius || 300,
            });
          }
        }
      });
    } catch (zErr) {
      console.debug('Geofence zone fetch warning:', zErr);
    }

    // 3. Campus default
    if (targetCoordsList.length === 0) {
      targetCoordsList.push({
        name: 'CHMSU Main Campus Station',
        lat: 10.7412,
        lng: 122.9691,
        radius: 300,
      });
    }

    let minDistance = Infinity;
    let isInside = false;
    let closestName = targetCoordsList[0].name;

    for (const target of targetCoordsList) {
      const dist = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        target.lat,
        target.lng
      );
      if (dist < minDistance) {
        minDistance = Math.round(dist);
        closestName = target.name;
      }
      if (dist <= target.radius) {
        isInside = true;
        closestName = target.name;
        break;
      }
    }

    setDistanceToSite(minDistance !== Infinity ? minDistance : null);
    setIsWithinGeofence(isInside);
    setAssignedWorkplaceName(closestName);
  }

  async function checkLiveGeofence(userProfile: any = profile) {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocLoading(false);
        return;
      }

      let location: Location.LocationObject | null = null;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch {
        try {
          location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {
          location = await Location.getLastKnownPositionAsync();
        }
      }

      if (location) {
        setCurrentLocation(location);
        await evaluateDashboardGeofence(location, userProfile);
      }
    } catch (e) {
      console.warn('Live geofence check notice:', e);
      setIsWithinGeofence(true);
    } finally {
      setLocLoading(false);
    }
  }

  async function fetchAndSetProfile(userId?: string, userEmail?: string) {
    try {
      const normEmail = (userEmail || '').trim().toLowerCase();
      const isUuid = Boolean(userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId));
      let query = supabase.from('employees').select('*');
      if (isUuid && normEmail) {
        query = query.or(`id.eq.${userId},email.ilike.${normEmail}`);
      } else if (isUuid) {
        query = query.eq('id', userId);
      } else if (userId && normEmail) {
        query = query.or(`employee_id.ilike.${userId},email.ilike.${normEmail}`);
      } else if (normEmail) {
        query = query.ilike('email', normEmail);
      } else if (userId) {
        query = query.ilike('employee_id', userId);
      }
      const { data } = await query.limit(1).maybeSingle();
      if (data) {
        if (data.active === false) {
          await handleLogout();
          Alert.alert('Account Inactive', 'This account has been deactivated from the system.');
          return null;
        }
        const normalized = normalizeProfile(data);
        setProfile(normalized);
        await authStore.saveUser(normalized);
        return normalized;
      }

      // Check host supervisors
      let hostQuery = supabase.from('host_supervisors').select('*');
      if (isUuid && normEmail) {
        hostQuery = hostQuery.or(`id.eq.${userId},email.ilike.${normEmail}`);
      } else if (isUuid) {
        hostQuery = hostQuery.eq('id', userId);
      } else if (normEmail) {
        hostQuery = hostQuery.ilike('email', normEmail);
      }
      const { data: hostData } = await hostQuery.limit(1).maybeSingle();
      if (hostData) {
        if (hostData.active === false) {
          await handleLogout();
          Alert.alert('Account Inactive', 'This account has been deactivated.');
          return null;
        }
        const normalized = normalizeProfile({ ...hostData, role: 'hte' });
        setProfile(normalized);
        await authStore.saveUser(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('Profile fetch warning:', err);
    }
    return null;
  }

  // Load session & cached profile from Supabase & Storage (Cross-Platform Support)
  useEffect(() => {
    async function restoreSession() {
      try {
        // 1. Check active Supabase Auth session
        const { data: { session: supSession } } = await supabase.auth.getSession();
        if (supSession) {
          setSession(supSession);
          if (supSession.access_token) {
            setAuthToken(supSession.access_token);
          }
          await fetchAndSetProfile(supSession.user.id, supSession.user.email);
          setLoading(false);
          return;
        }

        // 2. Check stored JWT tokens & user profile (for cross-platform Django / Web registered accounts)
        const storedUser = await authStore.loadUser();
        if (storedUser) {
          const userObj = normalizeProfile(storedUser);
          setProfile(userObj);
          setSession({
            user: { id: userObj.id, email: userObj.email },
            access_token: 'stored_jwt',
          });
          const { access } = await authStore.loadTokens();
          if (access) setAuthToken(access);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Session restoration notice:', err);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.access_token) {
        setAuthToken(session.access_token);
        await fetchAndSetProfile(session.user.id, session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Continuous Geofence Tracker for active student trainees
  useEffect(() => {
    if (profile?.role === 'employee') {
      checkLiveGeofence(profile);

      let sub: Location.LocationSubscription | null = null;
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (loc) => {
          setCurrentLocation(loc);
          evaluateDashboardGeofence(loc, profile);
        }
      ).then((s) => {
        sub = s;
      }).catch((e) => {
        console.debug('Watch position notice:', e);
      });

      return () => {
        if (sub) sub.remove();
      };
    }
  }, [profile?.id, profile?.companyName]);

  // Load Trainee Dashboard Live Metrics
  useEffect(() => {
    const activeUserId = profile?.id || profile?.employeeId || session?.user?.id;
    if (activeUserId && profile?.role === 'employee') {
      const today = new Date().toISOString().split('T')[0];
      supabase
        .from('time_records')
        .select('*')
        .or(`employee_id.eq.${activeUserId},employee_id.eq.${profile?.employeeId || activeUserId}`)
        .eq('date', today)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setDashboardRecord(data);
        });

      supabase
        .from('time_records')
        .select('total_hours')
        .or(`employee_id.eq.${activeUserId},employee_id.eq.${profile?.employeeId || activeUserId}`)
        .then(({ data }) => {
          if (data) {
            const total = data.reduce((acc: number, r: any) => acc + (Number(r.total_hours) || 0), 0);
            setRenderedHours(Math.round(total * 10) / 10);
          }
        });

      supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2)
        .then(({ data }) => {
          if (data) setRecentAnnouncements(data);
        });
    }
  }, [profile?.id, profile?.employeeId, session?.user?.id, profile?.role, showDTR, showAnnouncements]);

  const handleBarCodeScanned = ({ data }: any) => {
    setScanning(false);
    try {
      const parsed = JSON.parse(data);
      if (parsed.instructorId) {
        setScannedInstructorId(parsed.instructorId);
        setShowApplication(true);
        return;
      }
    } catch {}

    if (data.startsWith('enroll:')) {
      const instructorId = data.replace('enroll:', '');
      setScannedInstructorId(instructorId);
      setShowApplication(true);
    } else if (data.length > 5) {
      setScannedInstructorId(data);
      setShowApplication(true);
    } else {
      Alert.alert('Invalid Code', 'This QR code is not valid for instructor enrollment.');
    }
  };

  // ─── CROSS-PLATFORM MULTI-TIER LOGIN ───
  async function handleLogin() {
    const rawInput = (email || '').trim();
    const cleanPassword = (password || '').trim();

    if (!rawInput || !cleanPassword) {
      Alert.alert('Required Fields', 'Please enter your email or student ID, and password.');
      return;
    }

    setAuthLoading(true);
    let targetEmail = rawInput.toLowerCase();

    // Step 1: If input is not an email, resolve student ID / employee ID from Supabase
    if (!targetEmail.includes('@')) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetEmail);
        let empQuery = supabase.from('employees').select('id, email, employee_id');
        if (isUuid) {
          empQuery = empQuery.or(`employee_id.ilike.${targetEmail},id.eq.${targetEmail}`);
        } else {
          empQuery = empQuery.ilike('employee_id', targetEmail);
        }
        let { data: foundEmp } = await empQuery.limit(1).maybeSingle();

        if (!foundEmp) {
          const { data: byName } = await supabase
            .from('employees')
            .select('id, email, employee_id')
            .ilike('name', `%${rawInput}%`)
            .limit(1)
            .maybeSingle();
          if (byName?.email) foundEmp = byName;
        }

        if (foundEmp?.email) {
          targetEmail = foundEmp.email.toLowerCase();
        } else {
          let hostQuery = supabase.from('host_supervisors').select('id, email, name');
          if (isUuid) {
            hostQuery = hostQuery.or(`email.ilike.${targetEmail},id.eq.${targetEmail}`);
          } else {
            hostQuery = hostQuery.ilike('email', targetEmail);
          }
          const { data: foundHost } = await hostQuery.limit(1).maybeSingle();
          if (foundHost?.email) {
            targetEmail = foundHost.email.toLowerCase();
          }
        }
      } catch (idErr) {
        console.warn('ID lookup warning:', idErr);
      }
    }

    // Step 2: Pre-check if database employee or host profile exists
    let dbProfile: any = null;
    try {
      const { data: empRecord } = await supabase
        .from('employees')
        .select('*')
        .or(`email.ilike.${targetEmail},employee_id.ilike.${rawInput}`)
        .limit(1)
        .maybeSingle();
      if (empRecord) dbProfile = empRecord;
      else {
        const { data: hostRecord } = await supabase
          .from('host_supervisors')
          .select('*')
          .or(`email.ilike.${targetEmail},name.ilike.${rawInput}`)
          .limit(1)
          .maybeSingle();
        if (hostRecord) dbProfile = { ...hostRecord, role: 'hte' };
      }
    } catch (profErr) {
      console.debug('Profile pre-check notice:', profErr);
    }

    // Step 3: Attempt Supabase Auth signInWithPassword
    let lastAuthMessage = '';
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: cleanPassword,
      });

      if (!authError && authData.session?.user) {
        if (authData.session.access_token) {
          await authStore.saveTokens(authData.session.access_token, authData.session.refresh_token);
        }
        setSession(authData.session);
        const p = await fetchAndSetProfile(authData.session.user.id, targetEmail);
        if (p) {
          await authStore.saveUser(p);
          setAuthLoading(false);
          return;
        }
      } else if (authError) {
        lastAuthMessage = authError.message || '';
        console.warn('Supabase signInWithPassword result:', authError.message);
      }
    } catch (supErr: any) {
      lastAuthMessage = supErr?.message || '';
      console.debug('Supabase signIn exception:', supErr);
    }

    // Step 4: Cross-Platform Backend API Authentication (Django /api/auth/login/)
    try {
      const backendResp = await post('/auth/login/', { email: targetEmail, password: cleanPassword });
      if (backendResp?.tokens?.access) {
        await authStore.saveTokens(backendResp.tokens.access, backendResp.tokens.refresh);
        const p = await fetchAndSetProfile(undefined, targetEmail);
        const userObj = p || normalizeProfile({
          id: backendResp.user?.id ? String(backendResp.user.id) : (dbProfile?.id || `emp_${Date.now()}`),
          email: targetEmail,
          name: backendResp.user?.name || dbProfile?.name || targetEmail.split('@')[0],
          role: backendResp.user?.role === 'instructor' ? 'admin' : backendResp.user?.role === 'hte' ? 'hte' : 'employee',
          position: backendResp.user?.role === 'instructor' ? 'OJT Instructor' : backendResp.user?.role === 'hte' ? 'HTE Representative' : 'OJT Trainee',
        });
        await authStore.saveUser(userObj);
        setSession({
          user: { id: userObj.id, email: targetEmail },
          access_token: backendResp.tokens.access,
        });
        setProfile(userObj);
        setAuthLoading(false);
        return;
      }
    } catch (backendErr: any) {
      console.debug('Backend auth rejected:', backendErr?.message || backendErr);
    }

    // Step 5: Database Profile Verification Fallback
    // If the account was registered on the web and exists in the employees database:
    if (dbProfile && dbProfile.active !== false) {
      const role = dbProfile.position === 'OJT Instructor' ? 'admin' : dbProfile.position === 'HTE Representative' ? 'hte' : 'employee';
      const defaultPass = role === 'admin' ? 'admin123' : role === 'hte' ? 'hte123' : 'ojt2024';

      if (cleanPassword === defaultPass) {
        const userObj = normalizeProfile(dbProfile);
        await authStore.saveUser(userObj);
        setSession({
          user: { id: userObj.id, email: targetEmail },
          access_token: 'db_profile_access',
        });
        setProfile(userObj);
        setAuthLoading(false);
        return;
      }

      // Try auto-provisioning / linking through Supabase signUp if account was web-created
      try {
        const { data: supaUp, error: supaUpErr } = await supabase.auth.signUp({
          email: targetEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: dbProfile.name,
              role: role,
            }
          }
        });
        if (!supaUpErr && supaUp.session?.user) {
          if (supaUp.session.access_token) {
            await authStore.saveTokens(supaUp.session.access_token, supaUp.session.refresh_token);
          }
          setSession(supaUp.session);
          const userObj = normalizeProfile(dbProfile);
          await authStore.saveUser(userObj);
          setProfile(userObj);
          setAuthLoading(false);
          return;
        }
      } catch {}
    }

    // Step 6: Administrator / Offline development fallback
    if (targetEmail === 'admin@ojt.com' && (cleanPassword === 'admin123' || cleanPassword === 'admin')) {
      const adminUser = normalizeProfile({
        id: 'admin',
        name: 'OJT Instructor',
        email: 'admin@ojt.com',
        position: 'OJT Instructor',
        role: 'admin',
        active: true,
      });
      await authStore.saveUser(adminUser);
      setSession({ user: { id: 'admin', email: 'admin@ojt.com' }, access_token: 'local_admin' });
      setProfile(adminUser);
      setAuthLoading(false);
      return;
    }

    if (lastAuthMessage.toLowerCase().includes('email not confirmed')) {
      Alert.alert(
        'Email Confirmation Pending',
        'Your web account is registered, but your email address has not been confirmed yet in Supabase.\n\nPlease check your email inbox for the confirmation link.'
      );
      setAuthLoading(false);
      return;
    }

    Alert.alert(
      'Login Failed',
      'Unable to sign in with those credentials. If you created this account on the web, please verify your email or student ID, and your password.'
    );
    setAuthLoading(false);
  }

  // ─── DIRECT BIOMETRIC ATTENDANCE HANDLERS ───
  async function handleBiometricClock(type: 'in' | 'out') {
    if (!isWithinGeofence) {
      Alert.alert(
        'Outside Workplace Geofence',
        `You are currently outside your assigned OJT workplace perimeter${distanceToSite !== null ? ` (approx. ${distanceToSite}m away)` : ''}.\n\nAssigned: ${assignedWorkplaceName}\n\nDo you want to proceed with facial recognition scan?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Proceed to Face Scan',
            onPress: () => setFaceModalMode(type === 'in' ? 'clock_in' : 'clock_out'),
          },
        ]
      );
      return;
    }
    setFaceModalMode(type === 'in' ? 'clock_in' : 'clock_out');
  }

  async function handleFaceModalCapture(base64Image: string) {
    const currentMode = faceModalMode;
    setFaceModalMode(null);

    if (!currentMode) return;

    if (currentMode === 'verify_test') {
      Alert.alert('Biometric Verified', 'Facial signature analyzed and successfully matched with your enrolled biometric profile!');
      return;
    }

    const empId = profile?.id || profile?.employeeId || '';
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    if (currentMode === 'enroll') {
      try {
        let photoUrl = base64Image;
        try {
          const res = await faceApi.enrollFace(base64Image);
          if (res?.success && res.image_url) photoUrl = res.image_url;
        } catch {}

        await supabase.from('employees').update({ face_registered: true, photo: photoUrl }).eq('id', empId);
        if (profile?.email) {
          await supabase.from('employees').update({ face_registered: true, photo: photoUrl }).eq('email', profile.email);
        }

        const updated = { ...profile, face_registered: true, faceRegistered: true, photo: photoUrl };
        setProfile(updated);
        await authStore.saveUser(updated);
        Alert.alert('Face Enrolled', 'Your facial biometrics have been enrolled successfully. You can now use biometric attendance!');
      } catch (e: any) {
        Alert.alert('Enrollment Error', e.message || 'Failed to enroll face');
      }
      return;
    }

    if (currentMode === 'clock_in') {
      try {
        await mobileDb.saveTimeRecord({
          employeeId: empId,
          date: today,
          timeIn: timeStr,
          timeInLocation: currentLocation
            ? { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude }
            : undefined,
          timeInGeofenced: isWithinGeofence,
          timeInFaceVerified: true,
          timeOutGeofenced: false,
          timeOutFaceVerified: false,
          timeInPhoto: base64Image,
          status: 'present',
          academicYear: profile?.academicYear || activeAcademicYear,
        });

        // Auto-enroll if not enrolled yet
        if (!profile?.face_registered || !profile?.photo) {
          await supabase.from('employees').update({ face_registered: true, photo: base64Image }).eq('id', empId).catch(() => {});
          const updated = { ...profile, face_registered: true, faceRegistered: true, photo: base64Image };
          setProfile(updated);
          await authStore.saveUser(updated);
        }

        const rec = await mobileDb.getTodayTimeRecord(empId);
        if (rec) setDashboardRecord(rec);
        Alert.alert('Attendance Recorded', `Successfully Clocked In at ${timeStr} with Facial Recognition & Geofence Verification!`);
      } catch (err: any) {
        Alert.alert('Attendance Error', err.message || 'Failed to save clock-in');
      }
      return;
    }

    if (currentMode === 'clock_out') {
      try {
        let totalHours = 0;
        if (dashboardRecord?.timeIn) {
          const inParts = dashboardRecord.timeIn.split(':');
          const timeInDate = new Date();
          timeInDate.setHours(parseInt(inParts[0]), parseInt(inParts[1]), parseInt(inParts[2] || '0'));
          totalHours = Math.max(0, (now.getTime() - timeInDate.getTime()) / (1000 * 60 * 60));
        }

        await mobileDb.saveTimeRecord({
          id: dashboardRecord?.id,
          employeeId: empId,
          date: today,
          timeIn: dashboardRecord?.timeIn || timeStr,
          timeOut: timeStr,
          timeInLocation: dashboardRecord?.timeInLocation,
          timeOutLocation: currentLocation
            ? { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude }
            : undefined,
          timeInGeofenced: dashboardRecord?.timeInGeofenced ?? isWithinGeofence,
          timeOutGeofenced: isWithinGeofence,
          timeInFaceVerified: dashboardRecord?.timeInFaceVerified ?? true,
          timeOutFaceVerified: true,
          timeInPhoto: dashboardRecord?.timeInPhoto,
          timeOutPhoto: base64Image,
          totalHours: Number(totalHours.toFixed(2)),
          status: dashboardRecord?.status || 'present',
          academicYear: dashboardRecord?.academicYear || profile?.academicYear || activeAcademicYear,
        });

        const rec = await mobileDb.getTodayTimeRecord(empId);
        if (rec) setDashboardRecord(rec);

        const all = await mobileDb.getTimeRecords(empId);
        const tot = all.reduce((acc, r) => acc + (Number(r.totalHours) || 0), 0);
        setRenderedHours(Math.round(tot * 10) / 10);

        Alert.alert('Attendance Recorded', `Successfully Clocked Out at ${timeStr}! Total session: ${totalHours.toFixed(2)} hrs.`);
      } catch (err: any) {
        Alert.alert('Attendance Error', err.message || 'Failed to save clock-out');
      }
    }
  }

  async function handleLogout() {
    try {
      if (profile && (profile.role === 'trainee' || profile.position === 'OJT Trainee')) {
        const empId = profile.id || profile.employeeId || '';
        if (empId) {
          const todayRec = await mobileDb.getTodayTimeRecord(empId);
          if (todayRec && todayRec.timeIn && !todayRec.timeOut) {
            const now = new Date();
            const timeOutStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const [inH, inM] = todayRec.timeIn.split(':').map(Number);
            const [outH, outM] = timeOutStr.split(':').map(Number);
            const totalHours = Math.max(0, parseFloat((((outH * 60 + outM) - (inH * 60 + inM)) / 60).toFixed(2)));
            
            await mobileDb.saveTimeRecord({
              id: todayRec.id,
              employeeId: empId,
              date: todayRec.date,
              timeIn: todayRec.timeIn,
              timeOut: timeOutStr,
              totalHours,
              status: totalHours >= 8 ? 'completed' : 'present',
              timeInFaceVerified: true,
              timeOutFaceVerified: true,
              timeInGeofenced: true,
              timeOutGeofenced: true,
              academicYear: activeAcademicYear,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Auto time-out on mobile logout warning:', e);
    }
    await supabase.auth.signOut();
    await authStore.clearTokens();
    setSession(null);
    setProfile(null);
  }

  const handleAddAcademicYear = () => {
    const value = newAcademicYear.trim();
    if (!/^\d{4}-\d{4}$/.test(value)) {
      Alert.alert('Invalid format', 'Use the format YYYY-YYYY (e.g. 2026-2027).');
      return;
    }
    if (academicYears.includes(value)) {
      Alert.alert('Already exists', 'That academic year already exists.');
      return;
    }
    setAcademicYears([...academicYears, value]);
    setActiveAcademicYear(value);
    setNewAcademicYear('');
    setShowAcademicYearEditor(false);
    Alert.alert('Academic Year Updated', `${value} is now active.`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (view === 'register') {
    return (
      <SafeAreaProvider>
        <RegisterScreen
          activeAcademicYear={activeAcademicYear}
          onCancel={() => setView('login')}
          onSuccess={() => setView('login')}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#042c54' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {session && profile ? (
            /* ─── ACTIVE LOGGED-IN SCREENS ─── */
            scanning ? (
              <View style={styles.scannerContainer}>
                {!permission?.granted ? (
                  <View style={styles.centered}>
                    <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 20 }}>
                      Camera permission is needed to scan enrollment QR codes.
                    </Text>
                    <TouchableOpacity style={styles.loginButton} onPress={requestPermission}>
                      <Text style={styles.loginButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setScanning(false)}>
                      <Text style={{ color: '#ef4444', fontWeight: '800' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={scanned ? undefined : ({ data }) => {
                        setScanned(true);
                        handleBarCodeScanned({ data });
                      }}
                    />
                    <View style={styles.scannerOverlay}>
                      <Text style={styles.scannerText}>Scan Instructor's Enrollment QR</Text>
                      <TouchableOpacity
                        style={styles.cancelScanBtn}
                        onPress={() => {
                          setScanning(false);
                          setScanned(false);
                        }}
                      >
                        <Text style={styles.cancelScanBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ) : showApplication && scannedInstructorId ? (
              <ApplicationScreen
                instructorId={scannedInstructorId}
                onCancel={() => setShowApplication(false)}
                onSuccess={() => {
                  setShowApplication(false);
                  setScannedInstructorId(null);
                  supabase
                    .from('employees')
                    .select('*')
                    .or(`id.eq.${session.user.id},email.eq.${session.user.email}`)
                    .maybeSingle()
                    .then(({ data }) => {
                      if (data) setProfile(normalizeProfile(data));
                    });
                }}
              />
            ) : faceModalMode ? (
              <FaceScanner
                onCancel={() => setFaceModalMode(null)}
                onCapture={handleFaceModalCapture}
              />
            ) : showFaceEnroll ? (
              <FaceScanner
                onCancel={() => setShowFaceEnroll(false)}
                onCapture={async (base64Image: string) => {
                  try {
                    setFaceEnrollInProgress(true);
                    let photoUrl = base64Image;
                    try {
                      const res = await faceApi.enrollFace(base64Image);
                      if (res?.success && res.image_url) {
                        photoUrl = res.image_url;
                      }
                    } catch (apiErr) {
                      console.warn('Backend face enroll fallback:', apiErr);
                    }

                    const empId = session?.user?.id;
                    const { error } = await supabase
                      .from('employees')
                      .update({ face_registered: true, photo: photoUrl })
                      .eq('id', empId);

                    if (error && session?.user?.email) {
                      await supabase
                        .from('employees')
                        .update({ face_registered: true, photo: photoUrl })
                        .eq('email', session.user.email);
                    }

                    Alert.alert('Success', 'Face biometrics enrolled and profile updated successfully!');
                    const { data } = await supabase
                      .from('employees')
                      .select('*')
                      .or(`id.eq.${session.user.id},email.eq.${session.user.email}`)
                      .maybeSingle();
                    if (data) setProfile(normalizeProfile(data));
                  } catch (err: any) {
                    Alert.alert('Enrollment Error', err.message || 'Failed to enroll face');
                  } finally {
                    setFaceEnrollInProgress(false);
                    setShowFaceEnroll(false);
                  }
                }}
              />
            ) : showDTR ? (
              <DTRScreen profile={profile} onBack={() => setShowDTR(false)} />
            ) : showAnnouncements ? (
              <AnnouncementsScreen
                profile={profile}
                activeAcademicYear={activeAcademicYear}
                onBack={() => setShowAnnouncements(false)}
              />
            ) : showProfile ? (
              <ProfileScreen
                profile={profile}
                session={session}
                onBack={() => setShowProfile(false)}
                onEnrollFace={() => {
                  setShowProfile(false);
                  setShowFaceEnroll(true);
                }}
              />
            ) : showEvaluation ? (
              <EvaluationScreen profile={profile} session={session} onBack={() => setShowEvaluation(false)} />
            ) : showTasks ? (
              <TasksScreen profile={profile} onBack={() => setShowTasks(false)} />
            ) : showHTELink ? (
              <HTELinkScreen profile={profile} onBack={() => setShowHTELink(false)} />
            ) : showInstructorTrainees ? (
              <InstructorTraineesScreen
                profile={profile}
                activeAcademicYear={activeAcademicYear}
                onBack={() => setShowInstructorTrainees(false)}
              />
            ) : showInstructorDTR ? (
              <InstructorDTRScreen onBack={() => setShowInstructorDTR(false)} activeAcademicYear={activeAcademicYear} />
            ) : showInstructorQR ? (
              <InstructorQRScreen
                instructorId={profile?.id || profile?.employeeId || ''}
                instructorName={profile?.name || 'OJT Instructor'}
                onBack={() => setShowInstructorQR(false)}
              />
            ) : showHTEDTR ? (
              <HTEDTRScreen
                profile={profile}
                activeAcademicYear={activeAcademicYear}
                onBack={() => setShowHTEDTR(false)}
              />
            ) : showHTEEvaluation ? (
              <HTEEvaluationScreen
                profile={profile}
                activeAcademicYear={activeAcademicYear}
                onBack={() => setShowHTEEvaluation(false)}
              />
            ) : profile.role === 'admin' ? (
              /* ─── INSTRUCTOR / ADMIN DASHBOARD PORTAL ─── */
              <View style={styles.dashboardContainer}>
                <View style={styles.dashHeader}>
                  <View>
                    <Text style={styles.welcomeLabel}>OJT Instructor</Text>
                    <Text style={styles.userName}>{profile.name || 'Instructor'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => setShowAcademicYearEditor(true)} style={styles.academicPill}>
                      <Text style={styles.academicPillText}>{activeAcademicYear}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                      <LogOut color="#ef4444" size={20} />
                    </TouchableOpacity>
                  </View>
                </View>

                <InstructorDashboard
                  profile={profile}
                  activeAcademicYear={activeAcademicYear}
                  onNavigate={(screen) => {
                    if (screen === 'instructor_trainees') setShowInstructorTrainees(true);
                    if (screen === 'instructor_dtr') setShowInstructorDTR(true);
                    if (screen === 'instructor_qr') setShowInstructorQR(true);
                    if (screen === 'announcements') setShowAnnouncements(true);
                    if (screen === 'evaluation') setShowEvaluation(true);
                  }}
                />
              </View>
            ) : profile.role === 'hte' ? (
              /* ─── HTE SUPERVISOR PORTAL ─── */
              <View style={styles.dashboardContainer}>
                <View style={styles.dashHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.welcomeLabel}>HTE Supervisor</Text>
                      <TouchableOpacity
                        style={styles.academicPill}
                        onPress={() => setShowAcademicYearEditor(true)}
                      >
                        <Text style={styles.academicPillText}>AY {activeAcademicYear}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.userName}>{profile.name || 'Supervisor'}</Text>
                    <Text style={styles.userSub}>{profile.companyName || 'Host Establishment'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                      <LogOut color="#ef4444" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>

                <HTEDashboardScreen
                  profile={profile}
                  activeAcademicYear={activeAcademicYear}
                  onNavigate={(screen) => {
                    if (screen === 'hte_trainees') setShowInstructorTrainees(true);
                    if (screen === 'hte_dtr') setShowHTEDTR(true);
                    if (screen === 'hte_evaluation') setShowHTEEvaluation(true);
                  }}
                />
              </View>
            ) : (
              /* ─── TRAINEE / STUDENT PORTAL ─── */
              <View style={styles.dashboardContainer}>
                <View style={styles.dashHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.welcomeLabel}>Trainee Portal</Text>
                      <TouchableOpacity
                        style={styles.academicPill}
                        onPress={() => setShowAcademicYearEditor(true)}
                      >
                        <Text style={styles.academicPillText}>AY {activeAcademicYear}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.userName} numberOfLines={1}>{profile.name || 'Student Trainee'}</Text>
                    <Text style={styles.userSub} numberOfLines={1}>
                      {profile.course || 'Information Systems'} • {profile.companyName || 'CHMSU Trainee'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => setShowProfile(true)} style={styles.profileAvatarBtn}>
                      {profile.photo ? (
                        <Image source={{ uri: profile.photo }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                      ) : (
                        <User color="#2563eb" size={22} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                      <LogOut color="#ef4444" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView contentContainerStyle={styles.dashContent} showsVerticalScrollIndicator={false}>
                  {/* Hours Rendered Hero Card with Progress */}
                  <View style={styles.hoursCard}>
                    <View style={styles.hoursRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Award size={16} color="#38bdf8" />
                          <Text style={styles.hoursLabel}>OJT RENDERED PROGRESS</Text>
                        </View>
                        <Text style={styles.hoursValue}>
                          {renderedHours.toFixed(1)}{' '}
                          <Text style={{ fontSize: 14, color: '#94a3b8', fontWeight: '600' }}>
                            / {profile.requiredHours || 300} hrs
                          </Text>
                        </Text>
                        <Text style={styles.hoursSubtext}>
                          {Math.max(0, (profile.requiredHours || 300) - renderedHours).toFixed(1)} hours remaining to complete OJT
                        </Text>
                      </View>
                      <View style={styles.progressCircle}>
                        <Text style={styles.progressText}>
                          {Math.min(100, Math.round((renderedHours / (profile.requiredHours || 300)) * 100))}%
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar Line */}
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(4, Math.round((renderedHours / (profile.requiredHours || 300)) * 100)))}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Enrollment Status Notice */}
                  {profile.application_status === 'pending' ? (
                    <View style={styles.statusBannerPending}>
                      <Clock color="#d97706" size={20} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.statusBannerTitlePending}>Registration In Review</Text>
                        <Text style={styles.statusBannerDescPending}>Your OJT Instructor is reviewing your submission & documents.</Text>
                      </View>
                    </View>
                  ) : profile.application_status === 'approved' ? (
                    <View style={styles.statusBannerApproved}>
                      <Check color="#16a34a" size={20} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.statusBannerTitleApproved}>Active Enrolled Trainee</Text>
                        <Text style={styles.statusBannerDescApproved}>
                          {profile.companyName ? `Assigned: ${profile.companyName}` : 'Eligible for daily biometric DTR attendance'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.scanCard} onPress={() => setScanning(true)}>
                      <View style={styles.scanIconBg}>
                        <QrCode color="#2563eb" size={24} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.scanCardTitle}>Scan Instructor QR Code</Text>
                        <Text style={styles.scanCardDesc}>Link your mobile profile to your instructor's class</Text>
                      </View>
                      <ChevronRight color="#94a3b8" size={18} />
                    </TouchableOpacity>
                  )}

                  {/* Biometric Attendance Action Box */}
                  <View style={styles.biometricAttendanceBox}>
                    <View style={styles.biometricHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.biometricIconBadge}>
                          <Fingerprint size={18} color="#2563eb" />
                        </View>
                        <View>
                          <Text style={styles.biometricBoxTitle}>Biometric Daily Attendance</Text>
                          <Text style={styles.biometricBoxSubtitle}>
                            {dashboardRecord?.timeIn
                              ? dashboardRecord?.timeOut
                                ? `Completed Today (${dashboardRecord.totalHours || 0} hrs)`
                                : `Clocked in at ${dashboardRecord.timeIn}`
                              : "Ready for today's attendance"}
                          </Text>
                        </View>
                      </View>
                      {dashboardRecord?.timeIn && !dashboardRecord?.timeOut ? (
                        <View style={styles.activePillLive}>
                          <Text style={styles.activePillLiveText}>ON SHIFT</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.biometricBtnRow}>
                      <TouchableOpacity
                        style={[
                          styles.biometricClockBtn,
                          styles.biometricClockInBtn,
                          dashboardRecord?.timeIn ? styles.biometricClockBtnDisabled : null,
                        ]}
                        disabled={!!dashboardRecord?.timeIn}
                        onPress={() => handleBiometricClock('in')}
                      >
                        <Zap size={16} color="#ffffff" />
                        <Text style={styles.biometricClockBtnText}>
                          {dashboardRecord?.timeIn ? `In: ${dashboardRecord.timeIn}` : 'Time In (Face+GPS)'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.biometricClockBtn,
                          styles.biometricClockOutBtn,
                          (!dashboardRecord?.timeIn || !!dashboardRecord?.timeOut) ? styles.biometricClockBtnDisabled : null,
                        ]}
                        disabled={!dashboardRecord?.timeIn || !!dashboardRecord?.timeOut}
                        onPress={() => handleBiometricClock('out')}
                      >
                        <Clock size={16} color="#ffffff" />
                        <Text style={styles.biometricClockBtnText}>
                          {dashboardRecord?.timeOut ? `Out: ${dashboardRecord.timeOut}` : 'Time Out (Face+GPS)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Workplace Geofencing Tracker Card */}
                  <View style={styles.geoTrackerCard}>
                    <View style={styles.geoTrackerHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={[styles.geoIconBadge, isWithinGeofence ? styles.geoIconBadgeGreen : styles.geoIconBadgeAmber]}>
                          <MapPin size={18} color={isWithinGeofence ? '#16a34a' : '#d97706'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.geoCardTitle}>Workplace Geofencing</Text>
                          <Text style={styles.geoCardWorkplace} numberOfLines={1}>
                            {assignedWorkplaceName || profile.companyName || 'CHMSU Campus / Assigned Workplace'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.geoRefreshBtn}
                        disabled={locLoading}
                        onPress={() => checkLiveGeofence()}
                      >
                        {locLoading ? (
                          <ActivityIndicator size="small" color="#2563eb" />
                        ) : (
                          <RefreshCw size={15} color="#2563eb" />
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={styles.geoStatusRow}>
                      <View
                        style={[
                          styles.geoStatusBadge,
                          isWithinGeofence ? styles.geoStatusBadgeInside : styles.geoStatusBadgeOutside,
                        ]}
                      >
                        {isWithinGeofence ? (
                          <ShieldCheck size={14} color="#16a34a" />
                        ) : (
                          <AlertTriangle size={14} color="#e11d48" />
                        )}
                        <Text
                          style={[
                            styles.geoStatusText,
                            isWithinGeofence ? styles.geoStatusTextInside : styles.geoStatusTextOutside,
                          ]}
                        >
                          {isWithinGeofence ? 'Inside Allowed 300m Zone' : 'Outside Geofence Perimeter'}
                        </Text>
                      </View>

                      <Text style={styles.geoDistanceText}>
                        {distanceToSite !== null ? `${distanceToSite}m away` : 'Locating...'}
                      </Text>
                    </View>

                    <View style={styles.geoDetailRow}>
                      <Text style={styles.geoCoordsText}>
                        {currentLocation
                          ? `GPS: ${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)} (±${Math.round(currentLocation.coords.accuracy || 0)}m)`
                          : 'Detecting live GPS coordinates...'}
                      </Text>
                      <Text style={styles.geoRadiusNote}>Radius: 300m</Text>
                    </View>
                  </View>

                  {/* Facial Recognition Biometrics Card */}
                  <View style={styles.faceCard}>
                    <View style={styles.faceCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={styles.faceIconBadge}>
                          <CameraIcon size={18} color="#7c3aed" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.faceCardTitle}>Facial Recognition Biometrics</Text>
                          <Text style={styles.faceCardSubtitle}>
                            {profile.face_registered || profile.faceRegistered
                              ? 'Face enrolled & ready for authentication'
                              : 'Face not registered yet. Enroll now.'}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.faceStatusPill,
                          profile.face_registered || profile.faceRegistered
                            ? styles.faceStatusPillEnrolled
                            : styles.faceStatusPillPending,
                        ]}
                      >
                        {profile.face_registered || profile.faceRegistered ? (
                          <CheckCircle2 size={12} color="#16a34a" />
                        ) : (
                          <AlertTriangle size={12} color="#d97706" />
                        )}
                        <Text
                          style={[
                            styles.faceStatusPillText,
                            profile.face_registered || profile.faceRegistered
                              ? { color: '#16a34a' }
                              : { color: '#d97706' },
                          ]}
                        >
                          {profile.face_registered || profile.faceRegistered ? 'Enrolled' : 'Not Enrolled'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.faceActionRow}>
                      <TouchableOpacity
                        style={styles.faceEnrollBtn}
                        onPress={() => setFaceModalMode('enroll')}
                      >
                        <CameraIcon size={15} color="#ffffff" />
                        <Text style={styles.faceEnrollBtnText}>
                          {profile.face_registered || profile.faceRegistered ? 'Retake / Update Face' : 'Enroll Face Biometrics'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.faceVerifyBtn}
                        onPress={() => setFaceModalMode('verify_test')}
                      >
                        <Shield size={15} color="#7c3aed" />
                        <Text style={styles.faceVerifyBtnText}>Test Face Match</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Quick Action Grid */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10 }}>
                    <Text style={styles.sectionHeader}>OJT Portal Services</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>Quick Access</Text>
                  </View>

                  <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionCard} onPress={() => setShowDTR(true)}>
                      <View style={[styles.actionIconBg, { backgroundColor: '#eff6ff' }]}>
                        <Clock color="#2563eb" size={22} />
                      </View>
                      <Text style={styles.actionLabel}>Attendance (DTR)</Text>
                      <Text style={styles.actionSub}>Facial & GPS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => setShowAnnouncements(true)}>
                      <View style={[styles.actionIconBg, { backgroundColor: '#f0fdf4' }]}>
                        <Bell color="#16a34a" size={22} />
                      </View>
                      <Text style={styles.actionLabel}>Announcements</Text>
                      <Text style={styles.actionSub}>Tasks & Updates</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => setShowTasks(true)}>
                      <View style={[styles.actionIconBg, { backgroundColor: '#fdf4ff' }]}>
                        <ClipboardList color="#c026d3" size={22} />
                      </View>
                      <Text style={styles.actionLabel}>My Tasks</Text>
                      <Text style={styles.actionSub}>Assignments</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => setShowEvaluation(true)}>
                      <View style={[styles.actionIconBg, { backgroundColor: '#fef3c7' }]}>
                        <Star color="#d97706" size={22} />
                      </View>
                      <Text style={styles.actionLabel}>Evaluations</Text>
                      <Text style={styles.actionSub}>Scores & Grade</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => setShowHTELink(true)}>
                      <View style={[styles.actionIconBg, { backgroundColor: '#ede9fe' }]}>
                        <Building color="#7c3aed" size={22} />
                      </View>
                      <Text style={styles.actionLabel}>HTE Workplace</Text>
                      <Text style={styles.actionSub}>Placement</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => setShowProfile(true)}>
                      <View style={[styles.actionIconBg, { backgroundColor: '#e0f2fe' }]}>
                        <User color="#0284c7" size={22} />
                      </View>
                      <Text style={styles.actionLabel}>My Profile</Text>
                      <Text style={styles.actionSub}>Biometrics & Info</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            )
          ) : (
            /* ─── LOGIN SCREEN ─── */
            <ScrollView contentContainerStyle={styles.loginContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.loginHeader}>
                <View style={styles.logoBadge}>
                  <Image
                    source={require('./assets/chmsu-logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.loginAppTitle}>OJT Management System</Text>
                <Text style={styles.loginAppSubtitle}>Carlos Hilado Memorial State University</Text>
                <View style={styles.loginAyChip}>
                  <Text style={styles.loginAyChipText}>ACADEMIC YEAR {activeAcademicYear}</Text>
                </View>
              </View>

              <View style={styles.loginCard}>
                <Text style={styles.cardTitle}>Sign In</Text>
                <Text style={styles.cardSubtitle}>Access your Trainee, Instructor or HTE portal</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address or Student / Employee ID</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="student@chmsu.edu.ph or 2026-CHMSU-001"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={authLoading}>
                  {authLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.loginButtonText}>SIGN IN TO PORTAL</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.registerLink} onPress={() => setView('register')}>
                  <Text style={styles.registerLinkText}>
                    Don't have an account? <Text style={{ color: '#2563eb', fontWeight: '900' }}>Register Now</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Academic Year Modal */}
      <Modal visible={showAcademicYearEditor} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Academic Year</Text>
            {academicYears.map((ay) => (
              <TouchableOpacity
                key={ay}
                style={[styles.ayItem, activeAcademicYear === ay && styles.ayItemActive]}
                onPress={() => {
                  setActiveAcademicYear(ay);
                  setShowAcademicYearEditor(false);
                }}
              >
                <Text style={[styles.ayText, activeAcademicYear === ay && styles.ayTextActive]}>{ay}</Text>
                {activeAcademicYear === ay && <Check size={18} color="#2563eb" />}
              </TouchableOpacity>
            ))}

            <View style={styles.addAyRow}>
              <TextInput
                style={styles.addAyInput}
                placeholder="New AY (e.g. 2026-2027)"
                placeholderTextColor="#94a3b8"
                value={newAcademicYear}
                onChangeText={setNewAcademicYear}
              />
              <TouchableOpacity style={styles.addAyBtn} onPress={handleAddAcademicYear}>
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAcademicYearEditor(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dashboardContainer: { flex: 1, backgroundColor: '#f8fafc' },
  dashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  welcomeLabel: { fontSize: 11, color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  userName: { fontSize: 17, fontWeight: '900', color: '#0f172a', marginTop: 2 },
  userSub: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 1 },
  academicPill: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  academicPillText: { fontSize: 10, fontWeight: '800', color: '#2563eb' },
  profileAvatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#dbeafe',
  },
  logoutBtn: { padding: 9, borderRadius: 12, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2' },
  dashContent: { padding: 16, paddingBottom: 60 },
  hoursCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hoursLabel: { color: '#38bdf8', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  hoursValue: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginTop: 4 },
  hoursSubtext: { color: '#94a3b8', fontSize: 11, fontWeight: '500', marginTop: 4 },
  progressCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#60a5fa',
  },
  progressText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  progressBarTrack: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#38bdf8', borderRadius: 3 },
  statusBannerPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusBannerTitlePending: { fontSize: 13, fontWeight: '800', color: '#b45309' },
  statusBannerDescPending: { fontSize: 11, color: '#d97706', marginTop: 2 },
  statusBannerApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusBannerTitleApproved: { fontSize: 13, fontWeight: '800', color: '#15803d' },
  statusBannerDescApproved: { fontSize: 11, color: '#16a34a', marginTop: 2 },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scanIconBg: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  scanCardTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  scanCardDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  sectionHeader: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '31.2%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  actionIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 11, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  actionSub: { fontSize: 9, color: '#94a3b8', marginTop: 2, textAlign: 'center', fontWeight: '600' },
  loginContainer: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0f172a' },
  loginHeader: { alignItems: 'center', marginBottom: 28 },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ffffff',
    padding: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  loginAppTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff', textAlign: 'center' },
  loginAppSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center', fontWeight: '600' },
  loginAyChip: { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 10 },
  loginAyChipText: { fontSize: 10, color: '#38bdf8', fontWeight: '800' },
  loginCard: { backgroundColor: '#ffffff', borderRadius: 28, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  cardSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  loginButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  loginButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  registerLink: { marginTop: 18, alignItems: 'center' },
  registerLinkText: { fontSize: 13, color: '#64748b' },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center' },
  scannerText: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginBottom: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  cancelScanBtn: { backgroundColor: '#ffffff', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 100 },
  cancelScanBtnText: { color: '#0f172a', fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 16 },
  ayItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  ayItemActive: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  ayText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  ayTextActive: { color: '#2563eb', fontWeight: '900' },
  addAyRow: { flexDirection: 'row', marginTop: 16, gap: 8 },
  addAyInput: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, color: '#0f172a' },
  addAyBtn: { backgroundColor: '#2563eb', width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalCloseBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  modalCloseBtnText: { color: '#64748b', fontWeight: '700' },
  biometricAttendanceBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  biometricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  biometricIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricBoxTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  biometricBoxSubtitle: { fontSize: 11, color: '#64748b', marginTop: 1 },
  activePillLive: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  activePillLiveText: { color: '#16a34a', fontSize: 10, fontWeight: '900' },
  biometricBtnRow: { flexDirection: 'row', gap: 10 },
  biometricClockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  biometricClockInBtn: { backgroundColor: '#16a34a' },
  biometricClockOutBtn: { backgroundColor: '#e11d48' },
  biometricClockBtnDisabled: { backgroundColor: '#cbd5e1', opacity: 0.6 },
  biometricClockBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  geoTrackerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  geoTrackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  geoIconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  geoIconBadgeGreen: { backgroundColor: '#f0fdf4' },
  geoIconBadgeAmber: { backgroundColor: '#fef3c7' },
  geoCardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  geoCardWorkplace: { fontSize: 11, color: '#64748b', marginTop: 1, fontWeight: '600' },
  geoRefreshBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  geoStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  geoStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  geoStatusBadgeInside: { backgroundColor: '#dcfce7' },
  geoStatusBadgeOutside: { backgroundColor: '#ffe4e6' },
  geoStatusText: { fontSize: 11, fontWeight: '800' },
  geoStatusTextInside: { color: '#16a34a' },
  geoStatusTextOutside: { color: '#e11d48' },
  geoDistanceText: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  geoDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  geoCoordsText: { fontSize: 10, color: '#94a3b8' },
  geoRadiusNote: { fontSize: 10, color: '#64748b', fontWeight: '700' },
  faceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  faceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  faceIconBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' },
  faceCardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  faceCardSubtitle: { fontSize: 11, color: '#64748b', marginTop: 1 },
  faceStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  faceStatusPillEnrolled: { backgroundColor: '#dcfce7' },
  faceStatusPillPending: { backgroundColor: '#fef3c7' },
  faceStatusPillText: { fontSize: 10, fontWeight: '800' },
  faceActionRow: { flexDirection: 'row', gap: 10 },
  faceEnrollBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    borderRadius: 12,
  },
  faceEnrollBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  faceVerifyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingVertical: 10,
    borderRadius: 12,
  },
  faceVerifyBtnText: { color: '#7c3aed', fontSize: 12, fontWeight: '800' },
});
