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
import FaceScanner from '../components/FaceScanner';

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
  
  const [form, setForm] = useState({
    name: '',
    firstName: '',
    lastName: '',
    middleInitial: '',
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

  const steps = role === 'admin' ? ['Basic Info', 'Photo'] : 
                role === 'hte' ? ['Company Info', 'Contact Info'] : 
                ['Personal', 'Company', 'School', 'Photo'];

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
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

      Alert.alert('Success', 'Registration complete! You can now log in.');
      onSuccess();
    } catch (error: any) {
      Alert.alert('Registration Error', error.message);
    } finally {
      setLoading(false);
    }
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
        
        <Text style={styles.roleTitle}>Select your role</Text>
        
        <TouchableOpacity style={styles.roleCard} onPress={() => setRole('trainee')}>
          <View style={[styles.roleIcon, { backgroundColor: '#dbeafe' }]}>
            <User color="#2563eb" size={24} />
          </View>
          <View>
            <Text style={styles.roleName}>Trainee / Student</Text>
            <Text style={styles.roleDesc}>Complete daily time records</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.roleCard} onPress={() => setRole('admin')}>
          <View style={[styles.roleIcon, { backgroundColor: '#fef3c7' }]}>
            <GraduationCap color="#d97706" size={24} />
          </View>
          <View>
            <Text style={styles.roleName}>OJT Instructor</Text>
            <Text style={styles.roleDesc}>Manage trainees and reports</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.roleCard} onPress={() => setRole('hte')}>
          <View style={[styles.roleIcon, { backgroundColor: '#dcfce7' }]}>
            <Building color="#166534" size={24} />
          </View>
          <View>
            <Text style={styles.roleName}>HTE / Host</Text>
            <Text style={styles.roleDesc}>Host training supervisor</Text>
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
                <Input label="Age" value={form.age} onChange={v => updateForm('age', v)} placeholder="20" keyboardType="numeric" />
              </View>
              <View style={{ flex: 2, marginLeft: 10 }}>
                <Input label="Email" value={form.email} onChange={v => updateForm('email', v)} placeholder="juan@example.com" />
              </View>
            </View>
            
            <Input label="Address" value={form.address} onChange={v => updateForm('address', v)} placeholder="123 Street, City, Province" />
            <Input label="Password" value={form.password} onChange={v => updateForm('password', v)} secure />
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
            <Input label="Password" value={form.password} onChange={v => updateForm('password', v)} secure />
            <Input label="Department" value={form.department} onChange={v => updateForm('department', v)} placeholder="Academic Dept" />
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

function Input({ label, value, onChange, placeholder, secure = false, keyboardType = 'default' }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={secure ? 'none' : 'words'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrollContainer: {
    padding: 24,
    paddingTop: 60,
  },
  roleContainer: {
    padding: 24,
    flex: 1,
    justifyContent: 'center',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backLinkText: {
    marginLeft: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 24,
  },
  roleCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  roleDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
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
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  stepLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 24,
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
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  nextButton: {
    backgroundColor: '#2563eb',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
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
    borderRadius: 20,
    width: '100%',
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
  },
  photoSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  photoPreview: {
    alignItems: 'center',
    padding: 20,
  },
  photoStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginTop: 12,
  },
  retakeText: {
    color: '#2563eb',
    marginTop: 12,
    fontWeight: '600',
  }
});
