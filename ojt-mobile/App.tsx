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
  SafeAreaView,
  Image,
  ImageBackground,
  LinearGradient,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { User, LogOut, Camera as CameraIcon, QrCode, ClipboardList, Bell, Plus, Clock, Check, Key, Building, Star, ChevronRight, Award } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from './lib/supabase';
import { setAuthToken, getApiBaseUrl, faceApi } from './lib/api';
import authStore from './lib/auth';
import RegisterScreen from './screens/RegisterScreen';
import QRCode from 'react-native-qrcode-svg';
import ApplicationScreen from './screens/ApplicationScreen';
import TasksScreen from './screens/TasksScreen';
import DTRScreen from './screens/DTRScreen';
import HTELinkScreen from './screens/HTELinkScreen';
import InstructorTraineesScreen from './screens/InstructorTraineesScreen';
import InstructorDashboard from './screens/InstructorDashboard';
import { getSchoolLogo } from './utils/schoolLogos';
import TraineeRecordsScreen from './screens/TraineeRecordsScreen';
import FaceScanner from './components/FaceScanner';
import AnnouncementsScreen from './screens/AnnouncementsScreen';
import ProfileScreen from './screens/ProfileScreen';
import EvaluationScreen from './screens/EvaluationScreen';

function normalizeRole(position?: string | null) {
  const value = String(position || '').trim();
  if (value === 'OJT Instructor' || value === 'Administrator' || value === 'admin') return 'admin';
  if (value === 'Training Supervisor' || value === 'HTE Representative' || value === 'hte') return 'hte';
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

// Font defaults removed — use system font for clean modern look

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'register'>('login');
  const [scanning, setScanning] = useState(false);
  const [scannedInstructorId, setScannedInstructorId] = useState<string | null>(null);
  const [showApplication, setShowApplication] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showDTR, setShowDTR] = useState(false);
  const [showHTELink, setShowHTELink] = useState(false);
  const [showTrainees, setShowTrainees] = useState(false);
  const [showInstructorDashboard, setShowInstructorDashboard] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);
  const [showFaceEnroll, setShowFaceEnroll] = useState(false);
  const [faceEnrollInProgress, setFaceEnrollInProgress] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showAcademicYearEditor, setShowAcademicYearEditor] = useState(false);
  const [newAcademicYear, setNewAcademicYear] = useState('');
  // New screens
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [academicYears, setAcademicYears] = useState<string[]>(() => {
    const current = getCurrentAcademicYear();
    return [current, current.includes('2025') ? '2026-2027' : '2025-2026'];
  });
  const [activeAcademicYear, setActiveAcademicYear] = useState<string>(() => getCurrentAcademicYear());

  const handleAddAcademicYear = () => {
    const value = newAcademicYear.trim();
    if (!/^\d{4}-\d{4}$/.test(value)) {
      Alert.alert('Invalid format', 'Use the format YYYY-YYYY.');
      return;
    }
    if (academicYears.includes(value)) {
      Alert.alert('Already exists', 'That academic year already exists in this system.');
      return;
    }
    const nextYears = [...academicYears, value];
    setAcademicYears(nextYears);
    setActiveAcademicYear(value);
    setNewAcademicYear('');
    setShowAcademicYearEditor(false);
    Alert.alert('Academic year created', `${value} is now the active academic environment.`);
  };

  // Watch for email changes and fetch school logo
  useEffect(() => {
    const fetchSchoolLogo = async () => {
      if (!email) {
        setSchoolLogo(null);
        return;
      }

      try {
        const { data } = await supabase
          .from('employees')
          .select('schoolName')
          .ilike('email', email)
          .maybeSingle();

        if (data?.schoolName) {
          const logo = getSchoolLogo(data.schoolName);
          setSchoolLogo(logo);
        } else {
          setSchoolLogo(null);
        }
      } catch (err) {
        console.debug('Failed to fetch school logo', err);
        setSchoolLogo(null);
      }
    };

    fetchSchoolLogo();
  }, [email]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      // If supabase session exists, exchange for Django JWT
      if (session && session.access_token) {
        (async () => {
          try {
            const r = await fetch(`${getApiBaseUrl()}/api/auth/supabase-exchange/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: session.access_token }),
            });
            const res = await r.json();
            if (res && res.tokens) {
              const access = res.tokens.access;
              const refresh = res.tokens.refresh;
              await authStore.saveTokens(access, refresh);
            }
          } catch (err) {
            console.warn('Token exchange failed', err);
          }
        })();
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && session.access_token) {
        (async () => {
          try {
            const r = await fetch(`${getApiBaseUrl()}/api/auth/supabase-exchange/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: session.access_token }),
            });
            const res = await r.json();
            if (res && res.tokens) {
              await authStore.saveTokens(res.tokens.access, res.tokens.refresh);
            }
          } catch (err) {
            console.warn('Token exchange failed', err);
          }
        })();
      } else {
        setAuthToken(null);
      }
    });
  }, []);

  useEffect(() => {
    if (session) {
      async function fetchProfile() {
      const { data } = await supabase
          .from('employees')
          .select('*')
          .or(`id.eq.${session.user.id},email.eq.${session.user.email}`)
          .maybeSingle();

        if (data) {
          setProfile(normalizeProfile(data));
        } else {
          // Check host supervisors if not in employees
          const { data: hostData } = await supabase.from('host_supervisors').select('*').or(`id.eq.${session.user.id},email.eq.${session.user.email}`).maybeSingle();
          if (hostData) setProfile(normalizeProfile({ ...hostData, role: 'hte' }));
        }
      }
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [session]);

  // Poll Supabase employee record for application_status changes (prompt post-approval enroll)
  useEffect(() => {
    if (!session || !profile || profile.role !== 'employee') return;
    let alerted = false;
    const check = async () => {
      try {
        const { data } = await supabase.from('employees').select('*').or(`id.eq.${session.user.id},email.eq.${session.user.email}`).maybeSingle();
        if (data) {
          // update local profile
          setProfile((prev: any) => normalizeProfile({ ...(prev || {}), ...data }));
          if (!alerted && data.application_status === 'approved' && !data.face_registered) {
            alerted = true;
            Alert.alert('Application Approved', 'Your application has been approved. Enroll your face now?', [
              { text: 'Later', style: 'cancel' },
              { text: 'Enroll Now', onPress: () => setShowFaceEnroll(true) }
            ]);
          }
        }
      } catch (e) {
        console.debug('Status poll failed', e);
      }
    };
    // initial check plus interval
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, [session, profile]);

  const handleBarCodeScanned = ({ data }: any) => {
    setScanning(false);
    if (data.startsWith('enroll:')) {
      const instructorId = data.replace('enroll:', '');
      setScannedInstructorId(instructorId);
      setShowApplication(true);
    } else {
      Alert.alert('Invalid Code', 'This QR code is not for enrollment.');
    }
  };

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Login Failed', error.message);
    } else if (data.session?.access_token) {
      await authStore.saveTokens(data.session.access_token, data.session.refresh_token);
    }
    setAuthLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (view === 'register') {
    return (
      <RegisterScreen 
        onCancel={() => setView('login')} 
        onSuccess={() => setView('login')} 
      />
    );
  }

  // Attempt to load local university background image; try CHMSU.JPEG then fallback
  let uniBg: any = null;
  try {
    uniBg = require('./assets/CHMSU.JPEG');
  } catch (e1) {
    try {
      uniBg = require('./assets/university-bg.jpg');
    } catch (e2) {
      uniBg = null;
    }
  }

  const AppWrapper = ({ children }: any) => {
    if (uniBg) {
      return (
        <ImageBackground source={uniBg} style={{ flex: 1 }} imageStyle={{ resizeMode: 'cover' }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(4,44,84,0.35)' }}>{children}</SafeAreaView>
        </ImageBackground>
      );
    }
    return <SafeAreaView style={{ flex: 1, backgroundColor: '#042c54' }}>{children}</SafeAreaView>;
  };

  return (
    <AppWrapper>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
          {session && profile ? (
            scanning ? (
              <View style={styles.scannerContainer}>
                {!permission ? (
                  <View style={styles.centered}><ActivityIndicator size="large" /></View>
                ) : !permission.granted ? (
                  <View style={styles.centered}>
                    <Text style={{ textAlign: 'center', marginBottom: 20 }}>We need your permission to show the camera</Text>
                    <TouchableOpacity 
                      style={[styles.loginButton, { paddingHorizontal: 40 }]} 
                      onPress={requestPermission}
                    >
                      <Text style={styles.loginButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setScanning(false)}>
                      <Text style={{ color: '#ef4444' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={scanned ? undefined : ({ data }) => {
                        setScanned(true);
                        handleBarCodeScanned({ data });
                      }}
                    />
                    <View style={styles.scannerOverlay}>
                      <Text style={styles.scannerText}>Scan Instructor's QR Code</Text>
                      <TouchableOpacity style={styles.cancelScanBtn} onPress={() => { setScanning(false); setScanned(false); }}>
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
                  // Refresh profile
                      supabase.from('employees').select('*').or(`id.eq.${session.user.id},email.eq.${session.user.email}`).maybeSingle().then(({ data }) => {
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
                    const res = await faceApi.enrollFace(base64Image);
                    if (res && res.success) {
                      // mark face_registered in supabase employees and attach photo if returned
                      try {
                        const updates: any = { face_registered: true };
                        if (res.image_url) updates.photo = res.image_url;
                        await supabase.from('employees').update(updates).eq('id', session.user.id);
                      } catch (e) {
                        console.debug('Failed to update supabase face_registered/photo', e);
                      }
                      Alert.alert('Success', 'Face enrolled successfully');
                      // refresh profile
                      const { data } = await supabase.from('employees').select('*').or(`id.eq.${session.user.id},email.eq.${session.user.email}`).maybeSingle();
                      if (data) setProfile(normalizeProfile(data));
                    } else {
                      Alert.alert('Enroll Failed', res && res.error ? res.error : 'Unknown error');
                    }
                  } catch (err: any) {
                    console.error('Enroll error', err);
                    Alert.alert('Enroll Error', err.message || String(err));
                  } finally {
                    setFaceEnrollInProgress(false);
                    setShowFaceEnroll(false);
                  }
                }}
              />
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
              />
            ) : showEvaluation ? (
              <EvaluationScreen
                profile={profile}
                session={session}
                onBack={() => setShowEvaluation(false)}
              />
            ) : showTrainees ? (
              <InstructorTraineesScreen
                onBack={() => setShowTrainees(false)}
                onOpenRecords={(appId, studentName) => {
                  setSelectedApplicationId(appId);
                  setSelectedStudentName(studentName);
                  setShowRecords(true);
                }}
              />
            ) : showInstructorDashboard ? (
              <InstructorDashboard onBack={() => setShowInstructorDashboard(false)} />
            ) : showRecords && selectedApplicationId && selectedStudentName ? (
              <TraineeRecordsScreen
                applicationId={selectedApplicationId}
                studentName={selectedStudentName}
                onBack={() => setShowRecords(false)}
              />
            ) : showTasks ? (
                <TasksScreen 
                  profile={profile}
                  onBack={() => setShowTasks(false)}
                />
              ) : showDTR ? (
                <DTRScreen 
                  profile={profile}
                  onBack={() => setShowDTR(false)}
                />
              ) : showHTELink ? (
                <HTELinkScreen 
                  profile={profile}
                  onBack={() => setShowHTELink(false)}
                />
              ) : (
                <View style={styles.dashboardContainer}>
                <View style={styles.dashHeader}>
                  <View>
                    <Text style={styles.welcomeLabel}>Welcome back,</Text>
                    <Text style={styles.userName}>{profile.name || 'User'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => setShowAcademicYearEditor(true)} style={styles.academicPill}>
                      <Text style={styles.academicPillText}>{activeAcademicYear}</Text>
                    </TouchableOpacity>
                    {profile?.photo ? (
                      <Image source={{ uri: profile.photo }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                    ) : null}
                    <TouchableOpacity onPress={async () => {
                      await supabase.auth.signOut();
                      await authStore.clearTokens();
                    }} style={styles.logoutBtn}>
                      <LogOut color="#ef4444" size={20} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView contentContainerStyle={styles.dashContent}>
                  {profile.role === 'employee' ? (
                    <>
                      {profile.application_status === 'pending' ? (
                        <View style={styles.statusCard}>
                          <View style={styles.statusIconBg}>
                            <Clock color="#d97706" size={32} />
                          </View>
                          <Text style={styles.statusTitle}>Application Pending</Text>
                          <Text style={styles.statusDesc}>Your application is being reviewed by your instructor.</Text>
                        </View>
                      ) : profile.application_status === 'approved' ? (
                        <View style={[styles.statusCard, { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                          <View style={[styles.statusIconBg, { backgroundColor: '#dcfce7' }]}>
                            <Check color="#16a34a" size={32} />
                          </View>
                          <Text style={[styles.statusTitle, { color: '#166534' }]}>Status: Enrolled</Text>
                          <Text style={[styles.statusDesc, { color: '#166534' }]}>You are active in the OJT program.</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.enrollCard} onPress={() => setScanning(true)}>
                          <View style={styles.enrollIconBg}>
                            <QrCode color="#2563eb" size={48} />
                          </View>
                          <Text style={styles.enrollTitle}>Scan to Enroll</Text>
                          <Text style={styles.enrollDesc}>Scan your Instructor's QR Code to link your training.</Text>
                        </TouchableOpacity>
                      )}
                      
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <Text style={styles.sectionSubtitle}>Manage your daily records</Text>
                      </View>
                      <View style={styles.actionGrid}>
                        <ActionBtn 
                          icon={<Clock color="#2563eb" size={24} />} 
                          label="DTR" 
                          onPress={() => setShowDTR(true)} 
                          color="#eff6ff"
                        />
                        <ActionBtn 
                          icon={<ClipboardList color="#7c3aed" size={24} />} 
                          label="Tasks" 
                          onPress={() => setShowTasks(true)} 
                          color="#f5f3ff"
                        />
                        <ActionBtn 
                          icon={<Bell color="#0891b2" size={24} />} 
                          label="Notices" 
                          onPress={() => setShowAnnouncements(true)} 
                          color="#ecfeff"
                        />
                      </View>
                      <View style={styles.actionGrid}>
                        <ActionBtn 
                          icon={<Star color="#d97706" size={24} />} 
                          label="Evaluation" 
                          onPress={() => setShowEvaluation(true)} 
                          color="#fffbeb"
                        />
                        <ActionBtn 
                          icon={<User color="#16a34a" size={24} />} 
                          label="Profile" 
                          onPress={() => setShowProfile(true)} 
                          color="#f0fdf4"
                        />
                        <ActionBtn 
                          icon={<Building color="#7c3aed" size={24} />} 
                          label="HTE Link" 
                          onPress={() => setShowHTELink(true)} 
                          color="#f5f3ff"
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Instructor Dashboard</Text>
                      </View>

                      <TouchableOpacity style={styles.academicCard} onPress={() => setShowAcademicYearEditor(true)}>
                        <Text style={styles.academicCardLabel}>Academic Year</Text>
                        <Text style={styles.academicCardValue}>{activeAcademicYear}</Text>
                        <Text style={styles.academicCardHint}>Tap to create a new academic environment</Text>
                      </TouchableOpacity>

                      <View style={styles.instructorStats}>
                        <StatBox label="Active Trainees" value="24" color="#dbeafe" textColor="#1e40af" />
                        <StatBox label="New Requests" value="5" color="#fef3c7" textColor="#92400e" />
                      </View>
                      
                      <TouchableOpacity style={styles.premiumActionCard} onPress={() => setShowAnnouncements(true)}>
                        <View style={[styles.actionIconContainer, { backgroundColor: '#ecfeff' }]}>
                          <Bell color="#0891b2" size={20} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={styles.actionCardTitle}>Announcements</Text>
                          <Text style={styles.actionCardDesc}>Post updates & broadcast to all trainees</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.premiumActionCard} onPress={() => setShowTrainees(true)}>
                        <View style={[styles.actionIconContainer, { backgroundColor: '#eff6ff' }]}>
                          <Plus color="#2563eb" size={20} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={styles.actionCardTitle}>Manage Trainees</Text>
                          <Text style={styles.actionCardDesc}>View and manage enrolled trainees</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.premiumActionCard} onPress={() => setShowEvaluation(true)}>
                        <View style={[styles.actionIconContainer, { backgroundColor: '#fffbeb' }]}>
                          <Star color="#d97706" size={20} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={styles.actionCardTitle}>View Evaluations</Text>
                          <Text style={styles.actionCardDesc}>See all trainee evaluation results</Text>
                        </View>
                      </TouchableOpacity>
                      {/* Instructor QR Card - visible and easy to scan by trainees */}
                      <View style={styles.instructorQrCard}>
                        <Text style={styles.instructorQrTitle}>Your Enrollment QR</Text>
                        <View style={styles.instructorQrWrap}>
                          <QRCode value={`enroll:${profile.id}`} size={160} />
                        </View>
                        <Text style={styles.instructorQrHint}>Place your device here for trainees to scan</Text>
                      </View>

                      <TouchableOpacity style={styles.premiumActionCard}>
                        <View style={[styles.actionIconContainer, { backgroundColor: '#f5f3ff' }]}>
                          <ClipboardList color="#7c3aed" size={20} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={styles.actionCardTitle}>Assign New Task</Text>
                          <Text style={styles.actionCardDesc}>Create individual assignments</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.premiumActionCard, { marginTop: 12 }]} onPress={() => setShowInstructorDashboard(true)}>
                        <View style={[styles.actionIconContainer, { backgroundColor: '#ecfeff' }]}>
                          <Key color="#0891b2" size={18} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={styles.actionCardTitle}>OTP Management</Text>
                          <Text style={styles.actionCardDesc}>Generate and share enrollment codes</Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              </View>
            )
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContainer}>
              {/* Hero Header */}
              <View style={styles.loginHero}>
                <View style={styles.loginLogoWrap}>
                  <Image
                    source={require('./assets/icon.png')}
                    style={styles.loginLogo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.title}>OJT Daily Time Record</Text>
                <Text style={styles.subtitle}>On-the-Job Training Management System</Text>
                {schoolLogo && (
                  <Image source={{ uri: schoolLogo }} style={styles.schoolLogo} resizeMode="contain" />
                )}
              </View>

              <View style={styles.loginCard}>
                <Text style={styles.loginTitle}>Sign In</Text>
                <Text style={styles.loginSubtitle}>Welcome back! Please enter your credentials.</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput style={styles.input} placeholder="your@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#94a3b8" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput style={styles.input} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#94a3b8" />
                </View>
                <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={authLoading}>
                  {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Sign In</Text>}
                </TouchableOpacity>
                <View style={styles.registerLinkContainer}>
                  <Text style={styles.registerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => setView('register')}>
                    <Text style={styles.registerLink}>Register here</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
        {showAcademicYearEditor && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Academic Year Management</Text>
              <Text style={styles.modalSubtitle}>Create a new academic environment in the system and set the current year.</Text>

              <Text style={styles.label}>Active Academic Year</Text>
              <View style={styles.academicSelectorBox}>
                <Text style={styles.academicSelectorText}>{activeAcademicYear}</Text>
              </View>

              <Text style={styles.label}>Add New Year</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-2027"
                value={newAcademicYear}
                onChangeText={setNewAcademicYear}
                autoCapitalize="none"
              />

              <Text style={styles.sectionSubtitle}>Available years</Text>
              <View style={styles.yearList}>
                {academicYears.map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={[styles.yearChip, year === activeAcademicYear && styles.yearChipActive]}
                    onPress={() => setActiveAcademicYear(year)}
                  >
                    <Text style={[styles.yearChipText, year === activeAcademicYear && styles.yearChipTextActive]}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowAcademicYearEditor(false)}>
                  <Text style={styles.secondaryButtonText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={handleAddAcademicYear}>
                  <Text style={styles.primaryButtonText}>Create Year</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        <StatusBar style="auto" />
        </KeyboardAvoidingView>
    </AppWrapper>
  );
}

const ActionBtn = ({ icon, label, onPress, color }: any) => (
  <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
    <View style={[styles.actionIcon, { backgroundColor: color || '#eff6ff' }]}>{icon}</View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const StatBox = ({ label, value, color, textColor }: any) => (
  <View style={[styles.statBox, { backgroundColor: color || '#fff' }]}>
    <Text style={[styles.statValue, { color: textColor || '#2563eb' }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 48,
  },
  loginHero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loginLogoWrap: {
    width: 88,
    height: 88,
    backgroundColor: '#fff',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  loginLogo: { width: 68, height: 68, borderRadius: 20 },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20,
    marginTop: -22,
  },
  schoolLogo: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginTop: 10,
  },
  loginCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loginButton: {
    backgroundColor: '#2563eb',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  registerLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#64748b',
  },
  registerLink: {
    color: '#2563eb',
    fontWeight: '700',
  },
  dashboardContainer: {
    flex: 1,
  },
  dashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 10,
  },
  welcomeLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 12,
    backgroundColor: '#fff1f2',
    borderRadius: 16,
  },
  academicPill: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  academicPillText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '800',
  },
  dashContent: {
    padding: 24,
    paddingTop: 32,
  },
  statusCard: {
    backgroundColor: '#fffbeb',
    padding: 24,
    borderRadius: 32,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  statusIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400e',
  },
  statusDesc: {
    fontSize: 14,
    color: '#b45309',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  enrollCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 40,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  enrollIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  enrollTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
  },
  enrollDesc: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  academicCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  academicCardLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  academicCardValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 8,
  },
  academicCardHint: {
    marginTop: 6,
    fontSize: 13,
    color: '#475569',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  modalSheet: {
    width: '88%',
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 20,
  },
  academicSelectorBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 16,
  },
  academicSelectorText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  yearList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    marginBottom: 18,
  },
  yearChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  yearChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  yearChipText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  yearChipTextActive: {
    color: '#1d4ed8',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 24,
    borderRadius: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontWeight: '800',
    color: '#334155',
    fontSize: 14,
  },
  instructorStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  instructorQrCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e6f0ff',
  },
  instructorQrWrap: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginVertical: 12,
  },
  instructorQrTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  instructorQrHint: {
    fontSize: 12,
    color: '#64748b'
  },
  statBox: {
    flex: 1,
    padding: 24,
    borderRadius: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  premiumActionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  actionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
  },
  actionCardDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  scannerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    marginBottom: 32,
    overflow: 'hidden',
  },
  cancelScanBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 24,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  cancelScanBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  }
});
