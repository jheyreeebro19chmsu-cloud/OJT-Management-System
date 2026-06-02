import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Share } from 'react-native';
import { ArrowLeft, User, Key } from 'lucide-react-native';
import { instructorApi } from '../lib/api';

export default function InstructorDashboard({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<any[]>([]);

  useEffect(() => { fetchApps(); }, []);

  async function fetchApps() {
    setLoading(true);
    try {
      const res = await instructorApi.listApplications({ page: 1, page_size: 50 });
      if (res && res.applications) setApps(res.applications);
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  async function handleGenerateOtp(item: any) {
    try {
      setLoading(true);
      const res = await instructorApi.createOtp();
      if (res && res.otp_code) {
        Alert.alert('OTP Generated', `Code: ${res.otp_code}\nExpires: ${new Date(res.expires_at).toLocaleString()}`, [
          { text: 'Share', onPress: async () => { try { await Share.share({ message: `Enrollment OTP from your instructor: ${res.otp_code}` }); } catch (err) { Alert.alert('Share failed'); } } },
          { text: 'OK', style: 'cancel' }
        ]);
      } else {
        Alert.alert('OTP', 'No code returned');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create OTP');
    } finally { setLoading(false); }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={onBack}><ArrowLeft color="#64748b" size={18} /><Text style={styles.backText}>Back</Text></TouchableOpacity>
      <Text style={styles.title}>Instructor Dashboard</Text>
      {loading ? <ActivityIndicator size="large" color="#2563eb" /> : (
        <FlatList
          data={apps}
          keyExtractor={i => String(i.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ marginRight: 12 }}><User color="#2563eb" size={28} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.student_name}</Text>
                <Text style={styles.meta}>{item.student_email} • {item.status}</Text>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  {item.status === 'pending' && (
                    <>
                      <TouchableOpacity style={styles.otpBtn} onPress={() => handleGenerateOtp(item)}>
                        <Text style={styles.otpBtnText}>Generate OTP</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => Alert.alert('Info', `Student email: ${item.student_email}`)}>
                        <Text style={{ color: '#64748b' }}>View Email</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {item.status === 'approved' && (
                    <Text style={{ color: '#16a34a', fontWeight: '800' }}>Approved</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, backgroundColor: '#f8fafc', flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { marginLeft: 8, color: '#64748b', fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 12 },
  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  name: { fontWeight: '800', color: '#0f172a' },
  meta: { color: '#64748b', marginTop: 4 },
  otpBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  otpBtnText: { color: '#fff', fontWeight: '800' },
});
