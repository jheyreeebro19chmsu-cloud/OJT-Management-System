import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { instructorApi } from '../lib/api';

interface Props {
  applicationId: string;
  studentName: string;
  onBack: () => void;
}

export default function TraineeRecordsScreen({ applicationId, studentName, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    setLoading(true);
    try {
      const res = await instructorApi.getTimeRecords(applicationId);
      if (res && res.time_records) setRecords(res.time_records);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft color="#64748b" size={20} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{studentName}</Text>
      <Text style={styles.subtitle}>Attendance Records</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.recordCard}>
              <Text style={styles.recordDate}>{item.date}</Text>
              <Text style={styles.recordText}>In: {item.time_in || '—'}</Text>
              <Text style={styles.recordText}>Out: {item.time_out || '—'}</Text>
              <Text style={styles.recordText}>Hours: {item.hours_rendered ?? '—'}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, backgroundColor: '#f8fafc', flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { marginLeft: 8, color: '#64748b', fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 18 },
  recordCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  recordDate: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  recordText: { fontSize: 13, color: '#475569' },
});
