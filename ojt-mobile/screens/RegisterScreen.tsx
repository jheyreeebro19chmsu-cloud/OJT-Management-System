import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { User, Building, GraduationCap, ArrowLeft, ArrowRight, Camera, Check } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { sendWelcomeEmailMobile, sendOtpEmailMobile } from '../lib/email';
import FaceScanner from '../components/FaceScanner';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

type Role = 'trainee' | 'admin' | 'hte' | null;

interface RegisterScreenProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export default function RegisterScreen({ onCancel, onSuccess }: RegisterScreenProps) {
  const [role, setRole] = useState<Role>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredInstructorId, setRegisteredInstructorId] = useState('');
  const qrRef = React.useRef<any>(null);
  
  const [form, setForm] = useState({
    name: '',
    firstName: '',
    lastName: '',
    middleInitial: '',
    birthdate: '',
    age: '',
    address: '',
    email: '',
    password: '',
    department: '',
    companyName: '',
    supervisorName: '',
    schoolName: '',
    course: '',
    photo: '',
  });

  // Do NOT include face enrollment (Photo) for OJT Instructor (admin) or HTE
  const steps = role === 'admin' ? ['Basic Info'] : 
                role === 'hte' ? ['Company Info', 'Contact Info'] : 
                ['Personal', 'Company', 'School', 'Photo'];

  const updateForm = (key: string, value: string) => {
    setForm(prev => {
      const newForm = { ...prev, [key]: value };
      
      // Auto-calculate age if birthdate changes
      if (key === 'birthdate' && value.length >= 10) {
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

  const passwordChecks = (pw: string) => {
    return {
      length: pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      lowercase: /[a-z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
  };

  const handleNext = () => {
    // Email verification bypassed
    /*
    if (step === 0 && (role === 'trainee' || role === 'admin') && !isOtpVerified) {
      Alert.alert('Verification Required', 'Please verify your email with the confirmation code first.');
      return;
    }
    */

    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleRegister();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      setRole(null);
    }
  };

  async function handleRegister() {
    setLoading(true);
    try {
      // 1. Sign up user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            role: role === 'admin' ? 'admin' : role === 'hte' ? 'host' : 'employee',
          }
        }
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('User creation failed');

      // 2. Create profile in respective table
      const tableName = role === 'hte' ? 'host_supervisors' : 'employees';
      const profileData: any = {
        id: userId,
        name: form.name,
        email: form.email,
        active: true,
      };

      if (role === 'trainee') {
        profileData.department = form.department;
        profileData.company_name = form.companyName;
        profileData.supervisor_name = form.supervisorName;
        profileData.school_name = form.schoolName;
        profileData.course = form.course;
        profileData.photo = form.photo;
        profileData.face_registered = !!form.photo;
      } else if (role === 'admin') {
        profileData.department = form.department;
        profileData.position = 'OJT Instructor';
        profileData.photo = form.photo;
        profileData.face_registered = !!form.photo;
      } else if (role === 'hte') {
        profileData.company_name = form.companyName;
        profileData.position = 'Training Supervisor';
      }

      const { error: profileError } = await supabase
        .from(tableName)
        .upsert(profileData);

      if (profileError) throw profileError;

      // Send Welcome Email
      try {
        await sendWelcomeEmailMobile(form.email, form.name || `${form.firstName} ${form.lastName}`);
      } catch (emailErr) {
        console.error('Email failed:', emailErr);
      }

      if (role === 'admin') {
        setRegistrationComplete(true);
      } else {
        Alert.alert('Success', 'Registration complete! You can now log in.');
        onSuccess();
      }
    } catch (error: any) {
      Alert.alert('Registration Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp() {
    if (!form.email) {
      Alert.alert('Error', 'Please enter your email first');
      return;
    }
    setLoading(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    try {
      await sendOtpEmailMobile(form.email, code);
      setOtpSent(true);
      Alert.alert('Sent', 'Confirmation code has been sent to your email.');
    } catch (err) {
      Alert.alert('Error', 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  function handleVerifyOtp() {
    if (otpCode === generatedOtp) {
      setIsOtpVerified(true);
      Alert.alert('Success', 'Email verified!');
    } else {
      Alert.alert('Error', 'Invalid code');
    }
  }

  async function handleShareQr() {
    try {
      if (qrRef.current) {
        qrRef.current.toDataURL(async (data: string) => {
          const filename = `${FileSystem.documentDirectory}instructor_qr.png`;
          await FileSystem.writeAsStringAsync(filename, data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await Sharing.shareAsync(filename);
        });
      } else {
        Alert.alert('QR Ready', 'You can take a screenshot of your QR code to share it with your students!');
      }
    } catch (error) {
      console.error('Sharing error:', error);
      Alert.alert('Error', 'Failed to share QR code image');
    }
  }

  if (registrationComplete && role === 'admin') {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Check color="#fff" size={40} />
          </View>
          <Text style={styles.successTitle}>Registration Successful!</Text>
          <Text style={styles.successDesc}>Share this QR code with your students for enrollment:</Text>
          
          <View style={styles.qrWrapper}>
            <QRCode
              value={`enroll:${registeredInstructorId}`}
              size={200}
              getRef={(c) => (qrRef.current = c)}
            />
          </View>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShareQr}>
            <Text style={styles.shareBtnText}>Share QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginBtn} onPress={onSuccess}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

  if (role === null) {
    return (
      <View style={styles.roleContainer}>
        <TouchableOpacity style={styles.backLink} onPress={onCancel}>
          <ArrowLeft color="#64748b" size={20} />
          <Text style={styles.backLinkText}>Back to Login</Text>
        </TouchableOpacity>
        
        <Text style={styles.roleTitle}>Create Account</Text>
        <Text style={styles.roleSubtitle}>Select your role to get started</Text>
        
        <TouchableOpacity style={styles.roleCard} onPress={() => setRole('trainee')}>
          <View style={[styles.roleIcon, { backgroundColor: '#eff6ff' }]}>
            <User color="#2563eb" size={24} />
          </View>
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleName}>Trainee / Student</Text>
            <Text style={styles.roleDesc}>Complete daily time records and track your OJT hours.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.roleCard} onPress={() => setRole('admin')}>
          <View style={[styles.roleIcon, { backgroundColor: '#fffbeb' }]}>
            <GraduationCap color="#d97706" size={24} />
          </View>
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleName}>OJT Instructor</Text>
            <Text style={styles.roleDesc}>Manage your students, approve records, and post tasks.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.roleCard} onPress={() => setRole('hte')}>
          <View style={[styles.roleIcon, { backgroundColor: '#f0fdf4' }]}>
            <Building color="#166534" size={24} />
          </View>
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleName}>HTE Supervisor</Text>
            <Text style={styles.roleDesc}>Monitor trainee performance at your establishment.</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={handleBack}>
          <ArrowLeft color="#64748b" size={24} />
        </TouchableOpacity>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step {step + 1} of {steps.length}</Text>
          <Text style={styles.stepLabel}>{steps[step]}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.formCard}>
        {/* Step-specific inputs */}
        {role === 'trainee' && step === 0 && (
          <>
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <Input label="Last Name" value={form.lastName} onChange={v => updateForm('lastName', v)} placeholder="Dela Cruz" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Input label="M.I." value={form.middleInitial} onChange={v => updateForm('middleInitial', v)} placeholder="D" />
              </View>
            </View>
            <Input label="First Name" value={form.firstName} onChange={v => updateForm('firstName', v)} placeholder="Juan" />
            
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input 
                  label="Birthdate" 
                  value={form.birthdate} 
                  onChange={v => updateForm('birthdate', v)} 
                  placeholder="YYYY-MM-DD" 
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Input 
                  label="Age" 
                  value={form.age} 
                  onChange={v => updateForm('age', v)} 
                  placeholder="20" 
                  keyboardType="numeric" 
                  editable={false}
                />
              </View>
            </View>
            
            <Input label="Email" value={form.email} onChange={v => updateForm('email', v)} placeholder="juan@example.com" />
            
            <Input label="Address" value={form.address} onChange={v => updateForm('address', v)} placeholder="123 Street, City, Province" />
            
            {/* Email Verification Hidden */}
            {false && (
              <View style={styles.otpSection}>
              <Text style={styles.otpTitle}>Email Verification</Text>
              {!isOtpVerified ? (
                <View>
                  {!otpSent ? (
                    <TouchableOpacity style={styles.otpRequestBtn} onPress={handleRequestOtp} disabled={loading}>
                      <Text style={styles.otpRequestBtnText}>{loading ? 'Sending...' : 'Request Confirmation Code'}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.otpVerifyContainer}>
                      <TextInput 
                        style={styles.otpInput} 
                        placeholder="6-digit code" 
                        value={otpCode} 
                        onChangeText={setOtpCode}
                        keyboardType="numeric"
                        maxLength={6}
                      />
                      <TouchableOpacity style={styles.otpVerifyBtn} onPress={handleVerifyOtp}>
                        <Text style={styles.otpVerifyBtnText}>Verify</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleRequestOtp}>
                        <Text style={styles.resendLink}>Resend</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.verifiedBadge}>
                  <Check color="#16a34a" size={16} />
                  <Text style={styles.verifiedText}>Verified via Resend API</Text>
                </View>
              )}
            </View>

            <Input label="Password" value={form.password} onChange={v => updateForm('password', v)} secure />
            <View style={{ marginTop: 8, marginLeft: 4 }}>
              {(() => {
                const checks = passwordChecks(form.password);
                return (
                  <View>
                    <Text style={{ color: checks.length ? '#16a34a' : '#64748b', fontSize: 12 }}>• Minimum 8 characters</Text>
                    <Text style={{ color: checks.uppercase ? '#16a34a' : '#64748b', fontSize: 12 }}>• Uppercase letter</Text>
                    <Text style={{ color: checks.lowercase ? '#16a34a' : '#64748b', fontSize: 12 }}>• Lowercase letter</Text>
                    <Text style={{ color: checks.number ? '#16a34a' : '#64748b', fontSize: 12 }}>• Number</Text>
                    <Text style={{ color: checks.special ? '#16a34a' : '#64748b', fontSize: 12 }}>• Special character</Text>
                  </View>
                );
              })()}
            </View>
          </>
        )}

        {role === 'trainee' && step === 1 && (
          <>
            <Input label="Company Name" value={form.companyName} onChange={v => updateForm('companyName', v)} placeholder="TechCorp Inc." />
            <Input label="Supervisor Name" value={form.supervisorName} onChange={v => updateForm('supervisorName', v)} placeholder="Mr. Smith" />
          </>
        )}

        {role === 'trainee' && step === 2 && (
          <>
            <Input label="School Name" value={form.schoolName} onChange={v => updateForm('schoolName', v)} placeholder="State University" />
            <Input label="Course" value={form.course} onChange={v => updateForm('course', v)} placeholder="BS Information Technology" />
          </>
        )}

        {(role === 'admin') && step === 0 && (
          <>
            <Input label="Full Name" value={form.name} onChange={v => updateForm('name', v)} placeholder="Instructor Name" />
            <Input label="Email" value={form.email} onChange={v => updateForm('email', v)} placeholder="admin@example.com" />
            
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input label="Department" value={form.department} onChange={v => updateForm('department', v)} placeholder="IT Dept" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Input label="Course" value={form.course} onChange={v => updateForm('course', v)} placeholder="BSIT" />
              </View>
            </View>

            {/* Identity Verification Hidden */}
            {false && (
              <View style={styles.otpSection}>
              <Text style={styles.otpTitle}>Identity Verification</Text>
              {!isOtpVerified ? (
                <View>
                  {!otpSent ? (
                    <TouchableOpacity style={styles.otpRequestBtn} onPress={handleRequestOtp} disabled={loading}>
                      <Text style={styles.otpRequestBtnText}>{loading ? 'Sending...' : 'Request Confirmation Code'}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.otpVerifyContainer}>
                      <TextInput 
                        style={styles.otpInput} 
                        placeholder="6-digit code" 
                        value={otpCode} 
                        onChangeText={setOtpCode}
                        keyboardType="numeric"
                        maxLength={6}
                      />
                      <TouchableOpacity style={styles.otpVerifyBtn} onPress={handleVerifyOtp}>
                        <Text style={styles.otpVerifyBtnText}>Verify</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.verifiedBadge}>
                  <Check color="#16a34a" size={16} />
                  <Text style={styles.verifiedText}>Verified via Resend API</Text>
                </View>
              )}
            </View>

            <Input label="Password" value={form.password} onChange={v => updateForm('password', v)} secure />
            <View style={{ marginTop: 8, marginLeft: 4 }}>
              {(() => {
                const checks = passwordChecks(form.password);
                return (
                  <View>
                    <Text style={{ color: checks.length ? '#16a34a' : '#64748b', fontSize: 12 }}>• Minimum 8 characters</Text>
                    <Text style={{ color: checks.uppercase ? '#16a34a' : '#64748b', fontSize: 12 }}>• Uppercase letter</Text>
                    <Text style={{ color: checks.lowercase ? '#16a34a' : '#64748b', fontSize: 12 }}>• Lowercase letter</Text>
                    <Text style={{ color: checks.number ? '#16a34a' : '#64748b', fontSize: 12 }}>• Number</Text>
                    <Text style={{ color: checks.special ? '#16a34a' : '#64748b', fontSize: 12 }}>• Special character</Text>
                  </View>
                );
              })()}
            </View>
          </>
        )}

        {role === 'hte' && step === 0 && (
          <>
            <Input label="Company Name" value={form.companyName} onChange={v => updateForm('companyName', v)} placeholder="TechCorp Inc." />
            <Input label="Representative Name" value={form.name} onChange={v => updateForm('name', v)} placeholder="John Representative" />
          </>
        )}

        {role === 'hte' && step === 1 && (
          <>
            <Input label="Email" value={form.email} onChange={v => updateForm('email', v)} placeholder="contact@techcorp.com" />
            <Input label="Password" value={form.password} onChange={v => updateForm('password', v)} secure />
            <View style={{ marginTop: 8, marginLeft: 4 }}>
              {(() => {
                const checks = passwordChecks(form.password);
                return (
                  <View>
                    <Text style={{ color: checks.length ? '#16a34a' : '#64748b', fontSize: 12 }}>• Minimum 8 characters</Text>
                    <Text style={{ color: checks.uppercase ? '#16a34a' : '#64748b', fontSize: 12 }}>• Uppercase letter</Text>
                    <Text style={{ color: checks.lowercase ? '#16a34a' : '#64748b', fontSize: 12 }}>• Lowercase letter</Text>
                    <Text style={{ color: checks.number ? '#16a34a' : '#64748b', fontSize: 12 }}>• Number</Text>
                    <Text style={{ color: checks.special ? '#16a34a' : '#64748b', fontSize: 12 }}>• Special character</Text>
                  </View>
                );
              })()}
            </View>
          </>
        )}

        {/* Photo step */}
        {steps[step] === 'Photo' && (
          <View style={styles.photoContainer}>
            {form.photo ? (
              <View style={styles.photoPreview}>
                <Check color="#22c55e" size={48} />
                <Text style={styles.photoStatus}>Face Enrolled Successfully</Text>
                <TouchableOpacity onPress={() => setShowScanner(true)}>
                  <Text style={styles.retakeText}>Retake Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoButton} onPress={() => setShowScanner(true)}>
                <Camera color="#64748b" size={48} />
                <Text style={styles.photoButtonText}>Scan Face</Text>
                <Text style={styles.photoSubtext}>Required for Daily Time Records</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity 
          style={styles.nextButton} 
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {step === steps.length - 1 ? 'Complete Registration' : 'Continue'}
              </Text>
              <ArrowRight color="#fff" size={20} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Input({ label, value, onChange, placeholder, secure = false, keyboardType = 'default', editable = true }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && { backgroundColor: '#f1f5f9', color: '#64748b' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize={secure ? 'none' : 'words'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  scrollContainer: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#f8fafc',
  },
  roleContainer: {
    padding: 24,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  backLinkText: {
    marginLeft: 8,
    color: '#64748b',
    fontWeight: '700',
  },
  roleTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  roleSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 32,
    fontWeight: '500',
  },
  roleCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  roleIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  roleTextWrapper: {
    flex: 1,
  },
  roleName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
  },
  roleDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  stepIndicator: {
    alignItems: 'center',
  },
  stepText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  stepLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#1e293b',
  },
  nextButton: {
    backgroundColor: '#2563eb',
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  photoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  photoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 32,
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  photoButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 16,
  },
  photoSubtext: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  photoPreview: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f0fdf4',
    borderRadius: 32,
    width: '100%',
  },
  photoStatus: {
    fontSize: 17,
    fontWeight: '800',
    color: '#166534',
    marginTop: 16,
  },
  retakeText: {
    color: '#2563eb',
    marginTop: 16,
    fontWeight: '700',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  otpSection: {
    backgroundColor: '#eff6ff',
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  otpTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e40af',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
  },
  otpRequestBtn: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  otpRequestBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  otpVerifyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  otpInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 14,
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 4,
    color: '#1e40af',
  },
  otpVerifyBtn: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  otpVerifyBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  resendLink: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 24,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 40,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  successDesc: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  qrWrapper: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 32,
  },
  shareBtn: {
    backgroundColor: '#eff6ff',
    width: '100%',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareBtnText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '800',
  },
  loginBtn: {
    backgroundColor: '#2563eb',
    width: '100%',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  }
});
