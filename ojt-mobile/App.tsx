import React, { useState, useEffect, useRef } from 'react';
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
  StatusBar,
  SafeAreaView
} from 'react-native';
import { User, LogOut, Camera, QrCode, ClipboardList, Bell, Plus, Clock, Check } from 'lucide-react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { supabase } from './lib/supabase';
import RegisterScreen from './screens/RegisterScreen';
import ApplicationScreen from './screens/ApplicationScreen';
import TasksScreen from './screens/TasksScreen';
import DTRScreen from './screens/DTRScreen';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState<'login' | 'register'>('login');
  const [scanning, setScanning] = useState(false);
  const [scannedInstructorId, setScannedInstructorId] = useState<string | null>(null);
  const [showApplication, setShowApplication] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showDTR, setShowDTR] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session) {
      async function fetchProfile() {
        const { data } = await supabase
          .from('employees') // Using employees table as primary profile
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          setProfile({ ...data, role: data.position === 'OJT Instructor' ? 'admin' : 'employee' });
        } else {
          // Check host supervisors if not in employees
          const { data: hostData } = await supabase.from('host_supervisors').select('*').eq('id', session.user.id).single();
          if (hostData) setProfile({ ...hostData, role: 'hte' });
        }
      }
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [session]);

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Login Failed', error.message);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
          {session && profile ? (
            scanning ? (
              <View style={styles.scannerContainer}>
                <BarCodeScanner
                  onBarCodeScanned={handleBarCodeScanned}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.scannerOverlay}>
                  <Text style={styles.scannerText}>Scan Instructor's QR Code</Text>
                  <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setScanning(false)}>
                    <Text style={styles.cancelScanBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : showApplication && scannedInstructorId ? (
              <ApplicationScreen 
                instructorId={scannedInstructorId}
                onCancel={() => setShowApplication(false)}
                onSuccess={() => {
                  setShowApplication(false);
                  setScannedInstructorId(null);
                  // Refresh profile
                  supabase.from('employees').select('*').eq('id', session.user.id).single().then(({ data }) => {
                    if (data) setProfile({ ...data, role: data.position === 'OJT Instructor' ? 'admin' : 'employee' });
                  });
                }}
              />
            ) : showTasks ? (
                <TasksScreen 
                  onBack={() => setShowTasks(false)}
                />
              ) : showDTR ? (
                <DTRScreen 
                  profile={profile}
                  onBack={() => setShowDTR(false)}
                />
              ) : (
                <View style={styles.dashboardContainer}>
                <View style={styles.dashHeader}>
                  <View>
                    <Text style={styles.welcomeLabel}>Hello,</Text>
                    <Text style={styles.userName}>{profile.name || 'User'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutBtn}>
                    <LogOut color="#64748b" size={20} />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.dashContent}>
                  {profile.role === 'employee' ? (
                    <>
                      {profile.application_status === 'pending' ? (
                        <View style={styles.statusCard}>
                          <Clock color="#d97706" size={32} />
                          <Text style={styles.statusTitle}>Application Pending</Text>
                          <Text style={styles.statusDesc}>Waiting for instructor approval.</Text>
                        </View>
                      ) : profile.application_status === 'approved' ? (
                        <View style={[styles.statusCard, { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                          <Check color="#16a34a" size={32} />
                          <Text style={[styles.statusTitle, { color: '#166534' }]}>Enrolled</Text>
                          <Text style={[styles.statusDesc, { color: '#166534' }]}>Currently enrolled in OJT.</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.enrollCard} onPress={() => setScanning(true)}>
                          <QrCode color="#2563eb" size={48} />
                          <Text style={styles.enrollTitle}>Scan to Enroll</Text>
                          <Text style={styles.enrollDesc}>Scan your Instructor's QR Code to apply.</Text>
                        </TouchableOpacity>
                      )}
                      
                      <Text style={styles.sectionTitle}>Quick Actions</Text>
                      <View style={styles.actionGrid}>
                        <ActionBtn 
                          icon={<ClipboardList color="#2563eb" size={24} />} 
                          label="DTR" 
                          onPress={() => setShowDTR(true)} 
                        />
                        <ActionBtn 
                          icon={<FileText color="#2563eb" size={24} />} 
                          label="Tasks" 
                          onPress={() => setShowTasks(true)} 
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.instructorStats}>
                        <StatBox label="Students" value="24" />
                        <StatBox label="Pending" value="5" />
                      </View>
                      <TouchableOpacity style={styles.actionCard}>
                        <Plus color="#2563eb" size={20} />
                        <Text style={styles.actionCardText}>Post Announcement</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionCard}>
                        <ClipboardList color="#2563eb" size={20} />
                        <Text style={styles.actionCardText}>Assign New Task</Text>
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
    </SafeAreaView>
  );
}

const ActionBtn = ({ icon, label, onPress }: any) => (
  <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
    <View style={styles.actionIcon}>{icon}</View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const StatBox = ({ label, value }: any) => (
  <View style={styles.statBox}>
    <Text style={styles.statValue}>{value}</Text>
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
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  welcomeLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  logoutBtn: {
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  dashContent: {
    padding: 24,
  },
  statusCard: {
    backgroundColor: '#fffbeb',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400e',
    marginTop: 12,
  },
  statusDesc: {
    fontSize: 14,
    color: '#b45309',
    textAlign: 'center',
    marginTop: 4,
  },
  enrollCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  enrollTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 16,
  },
  enrollDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontWeight: '700',
    color: '#475569',
    fontSize: 14,
  },
  instructorStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 4,
  },
  actionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionCardText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  scannerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  cancelScanBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
  },
  cancelScanBtnText: {
    color: '#fff',
    fontWeight: '700',
  }
});
