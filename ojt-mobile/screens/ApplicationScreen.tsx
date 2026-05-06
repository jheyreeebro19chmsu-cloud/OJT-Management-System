import React, { useState, useEffect } from 'react';
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
import { MapPin, Calendar, Clock, User, Check, Camera, ArrowLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { applicationApi } from '../lib/api';
import FaceScanner from '../components/FaceScanner';

interface ApplicationScreenProps {
  instructorId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function ApplicationScreen({ instructorId, onCancel, onSuccess }: ApplicationScreenProps) {
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const [address, setAddress] = useState('Fetching location...');

  const [form, setForm] = useState({
    yearSection: '',
    companyName: '',
    companyAddress: '',
    startDate: '',
    endDate: '',
    requiredHours: '',
    photo: '',
  });

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddress('Permission denied');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      
      let rev = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      if (rev.length > 0) {
        setAddress(`${rev[0].name}, ${rev[0].city}, ${rev[0].region}`);
      }
    })();
  }, []);

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  async function handleSubmit() {
    if (!form.yearSection || !form.companyName || !form.photo) {
      Alert.alert('Error', 'Please fill in all required fields and complete the facial scan.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // 1. Primary: Use Django API for enrollment tracking
      try {
        const djangoForm = {
          user_id: user.id,
          instructor_id: instructorId,
          company_name: form.companyName,
          company_address: form.companyAddress,
          gps_latitude: location?.coords.latitude,
          gps_longitude: location?.coords.longitude,
          geofence_radius: 300,
          start_date: form.startDate,
          end_date: form.endDate,
          required_hours: Number(form.requiredHours),
        };
        await applicationApi.submit(djangoForm);
      } catch (apiErr) {
        console.warn('Django Enrollment API failed, falling back to Supabase:', apiErr);
      }

      // 2. Secondary: Update Supabase profile for mobile UI
      const { error } = await supabase
        .from('employees')
        .update({
          year_section: form.yearSection,
          company_name: form.companyName,
          company_address: form.companyAddress,
          start_date: form.startDate,
          end_date: form.endDate,
          required_hours: Number(form.requiredHours),
          photo: form.photo,
          face_registered: true,
          instructor_id: instructorId,
          application_status: 'pending',
          registration_location: {
            lat: location?.coords.latitude,
            lng: location?.coords.longitude
          },
          registration_address: address
        })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Submitted', 'Your OJT application has been submitted and is pending approval.');
      onSuccess();
    } catch (error: any) {
      Alert.alert('Error', error.message);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onCancel}>
        <ArrowLeft color="#64748b" size={20} />
        <Text style={styles.backBtnText}>Cancel</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>OJT Application</Text>
        <Text style={styles.subtitle}>Fill out your training details</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Year & Section</Text>
          <TextInput 
            style={styles.input} 
            value={form.yearSection} 
            onChangeText={v => updateForm('yearSection', v)}
            placeholder="e.g. BSIT 4-A"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Company Name</Text>
          <TextInput 
            style={styles.input} 
            value={form.companyName} 
            onChangeText={v => updateForm('companyName', v)}
            placeholder="Where you will be training"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Company Address</Text>
          <TextInput 
            style={styles.input} 
            value={form.companyAddress} 
            onChangeText={v => updateForm('companyAddress', v)}
            placeholder="City, Province"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Start Date</Text>
            <TextInput 
              style={styles.input} 
              value={form.startDate} 
              onChangeText={v => updateForm('startDate', v)}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
            <Text style={styles.label}>End Date</Text>
            <TextInput 
              style={styles.input} 
              value={form.endDate} 
              onChangeText={v => updateForm('endDate', v)}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Required Hours</Text>
          <TextInput 
            style={styles.input} 
            value={form.requiredHours} 
            onChangeText={v => updateForm('requiredHours', v)}
            placeholder="e.g. 486"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.locationBadge}>
          <MapPin color="#2563eb" size={16} />
          <Text style={styles.locationText}>{address}</Text>
        </View>

        <View style={styles.photoSection}>
          {form.photo ? (
            <View style={styles.photoVerified}>
              <Check color="#16a34a" size={24} />
              <Text style={styles.photoVerifiedText}>Face Scan Captured</Text>
              <TouchableOpacity onPress={() => setShowScanner(true)}>
                <Text style={styles.retakeLink}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoBtn} onPress={() => setShowScanner(true)}>
              <Camera color="#64748b" size={24} />
              <Text style={styles.photoBtnText}>Scan Face for Application</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Application</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#f8fafc',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtnText: {
    marginLeft: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  card: {
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
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  row: {
    flexDirection: 'row',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  locationText: {
    marginLeft: 8,
    color: '#1e40af',
    fontSize: 13,
    fontWeight: '600',
  },
  photoSection: {
    marginBottom: 24,
  },
  photoBtn: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnText: {
    marginTop: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  photoVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  photoVerifiedText: {
    marginLeft: 12,
    flex: 1,
    color: '#166534',
    fontWeight: '700',
  },
  retakeLink: {
    color: '#2563eb',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  }
});
