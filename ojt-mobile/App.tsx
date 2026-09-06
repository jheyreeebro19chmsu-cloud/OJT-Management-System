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
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from './lib/supabase';
import { setAuthToken, getApiBaseUrl, faceApi } from './lib/api';
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

  // Load session from Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.access_token) {
        setAuthToken(session.access_token);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.access_token) {
        setAuthToken(session.access_token);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch employee/user profile whenever session changes
  useEffect(() => {
    if (session?.user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .or(`id.eq.${session.user.id},email.eq.${session.user.email}`)
          .maybeSingle();

        if (data) {
          setProfile(normalizeProfile(data));
        } else {
          // Check if user is an HTE host supervisor
          const { data: hostData } = await supabase
            .from('host_supervisors')
            .select('*')
            .or(`id.eq.${session.user.id},email.eq.${session.user.email}`)
            .maybeSingle();
          if (hostData) setProfile(normalizeProfile({ ...hostData, role: 'hte' }));
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [session]);

  // Load Trainee Dashboard Live Metrics
  useEffect(() => {
    if (session?.user?.id && profile?.role === 'employee') {
      const today = new Date().toISOString().split('T')[0];
      supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', session.user.id)
        .eq('date', today)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setDashboardRecord(data);
        });

      supabase
        .from('time_records')
        .select('total_hours')
        .eq('employee_id', session.user.id)
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
  }, [session?.user?.id, profile?.role, showDTR, showAnnouncements]);

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

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      Alert.alert('Login Failed', error.message);
    } else if (data.session?.access_token) {
      await authStore.saveTokens(data.session.access_token, data.session.refresh_token);
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
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
                  <Building color="#38bdf8" size={36} />
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
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="student@chmsu.edu.ph"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
  logoBadge: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(56, 189, 248, 0.15)', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
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
});
