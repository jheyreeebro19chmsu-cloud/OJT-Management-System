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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { User, LogOut, Camera as CameraIcon, QrCode, ClipboardList, Bell, Plus, Clock, Check, Key, Building } from 'lucide-react-native';
import { useCameraPermissions } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';
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

// Try to set a global default font for React Native Text and TextInput
try {
  const anyText = (Text as any);
  if (!anyText.defaultProps) anyText.defaultProps = {};
  const prevTextStyle = anyText.defaultProps.style;
  anyText.defaultProps.style = prevTextStyle
    ? [{ fontFamily: 'Times New Roman' }, ...(Array.isArray(prevTextStyle) ? prevTextStyle : [prevTextStyle])]
    : { fontFamily: 'Times New Roman' };

  const anyTextInput = (TextInput as any);
  if (!anyTextInput.defaultProps) anyTextInput.defaultProps = {};
  const prevInputStyle = anyTextInput.defaultProps.style;
  anyTextInput.defaultProps.style = prevInputStyle
    ? [{ fontFamily: 'Times New Roman' }, ...(Array.isArray(prevInputStyle) ? prevInputStyle : [prevInputStyle])]
    : { fontFamily: 'Times New Roman' };
} catch (e) {
  console.debug('Could not set default font for Text/TextInput', e);
}

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
  const [scannerPermission, setScannerPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!scanning) {
      setScanned(false);
      return;
    }
    (async () => {
      try {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setScannerPermission(status === 'granted');
      } catch (e) {
        console.debug('Barcode permission request failed', e);
        setScannerPermission(false);
      }
    })();
  }, [scanning]);
  

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
                    {scannerPermission === null ? (
                      <View style={styles.centered}><ActivityIndicator size="large" /></View>
                    ) : scannerPermission === false ? (
                      <View style={styles.centered}>
                        <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>Barcode permission denied.</Text>
                        <TouchableOpacity style={[styles.loginButton, { paddingHorizontal: 20 }]} onPress={async () => {
                          const { status } = await BarCodeScanner.requestPermissionsAsync();
                          setScannerPermission(status === 'granted');
                        }}>
                          <Text style={styles.loginButtonText}>Request Permission</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => setScanning(false)}>
                          <Text style={{ color: '#94a3b8' }}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <BarCodeScanner
                          onBarCodeScanned={scanned ? undefined : ({ data }) => {
                            setScanned(true);
                            handleBarCodeScanned({ data });
                          }}
                          style={StyleSheet.absoluteFillObject}
                        />
                        <View style={styles.scannerOverlay}>
                          <Text style={styles.scannerText}>Scan Instructor's QR Code</Text>
                          <TouchableOpacity style={styles.cancelScanBtn} onPress={() => { setScanning(false); setScanned(false); }}>
                            <Text style={styles.cancelScanBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
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
                          icon={<Building color="#0891b2" size={24} />} 
                          label="HTE Link" 
                          onPress={() => setShowHTELink(true)} 
                          color="#ecfeff"
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Instructor Dashboard</Text>
                      </View>
                      <View style={styles.instructorStats}>
                        <StatBox label="Active Trainees" value="24" color="#dbeafe" textColor="#1e40af" />
                        <StatBox label="New Requests" value="5" color="#fef3c7" textColor="#92400e" />
                      </View>
                      
                      <TouchableOpacity style={styles.premiumActionCard} onPress={() => setShowTrainees(true)}>
                        <View style={[styles.actionIconContainer, { backgroundColor: '#eff6ff' }]}>
                          <Plus color="#2563eb" size={20} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={styles.actionCardTitle}>Post Announcement</Text>
                          <Text style={styles.actionCardDesc}>Broadcast updates to all students</Text>
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
              <View style={styles.header}>
                <Text style={styles.title}>OJT System</Text>
                <Text style={styles.subtitle}>Mobile Connect</Text>
              </View>

              {/* University Logo Display */}
              {schoolLogo && (
                <View style={styles.logoContainer}>
                  <Image
                    source={{ uri: schoolLogo }}
                    style={styles.schoolLogo}
                    resizeMode="contain"
                  />
                </View>
              )}

              <View style={styles.loginCard}>
                <Text style={styles.loginTitle}>Sign In</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput style={styles.input} placeholder="your@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput style={styles.input} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />
                </View>
                <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={authLoading}>
                  {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Login</Text>}
                </TouchableOpacity>
                <View style={styles.registerLinkContainer}>
                  <Text style={styles.registerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => setView('register')}>
                    <Text style={styles.registerLink}>Register</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
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
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  schoolLogo: {
    width: 64,
    height: 64,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
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
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 32,
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
