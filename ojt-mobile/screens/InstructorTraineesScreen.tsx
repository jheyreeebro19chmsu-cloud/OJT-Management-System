import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Alert, TextInput } from 'react-native';
import { ArrowLeft, User } from 'lucide-react-native';
import { instructorApi } from '../lib/api';

interface Props {
  onBack: () => void;
  onOpenRecords: (applicationId: string, studentName: string) => void;
}

export default function InstructorTraineesScreen({ onBack, onOpenRecords }: Props) {
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    setLoading(true);
    try {
      const res = await instructorApi.listApplications({ page, page_size: pageSize, q: query });
      if (res && res.applications) {
        setApplications(res.applications);
        setTotal(res.total || 0);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch trainees');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApplications();
  }, [page, query]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft color="#64748b" size={20} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Trainees</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" />
      ) : (
        <View style={{ marginBottom: 12 }}>
          <TextInput
            placeholder="Search by name, email, company"
            value={query}
            onChangeText={setQuery}
            style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 }}
          />
        </View>

        <FlatList
          data={applications}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onOpenRecords(String(item.id), item.student_name)}>
              <View style={styles.cardLeft}>
                <User color="#2563eb" size={28} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.student_name}</Text>
                <Text style={styles.meta}>{item.student_email} • {item.status}</Text>
                {item.status === 'pending' && (
                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <TouchableOpacity style={{ marginRight: 8 }} onPress={async () => {
                      try {
                        await instructorApi.approveApplication(String(item.id));
                        Alert.alert('Approved', 'Application approved');
                        fetchApplications();
                      } catch (err: any) {
                        Alert.alert('Error', err.message || 'Approve failed');
                      }
                    }}>
                      <Text style={{ color: '#16a34a', fontWeight: '800' }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => {
                      try {
                        await instructorApi.rejectApplication(String(item.id), 'Rejected by instructor');
                        Alert.alert('Rejected', 'Application rejected');
                        fetchApplications();
                      } catch (err: any) {
                        Alert.alert('Error', err.message || 'Reject failed');
                      }
                    }}>
                      <Text style={{ color: '#ef4444', fontWeight: '800' }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <TouchableOpacity disabled={page <= 1} onPress={() => setPage(p => Math.max(1, p-1))}>
            <Text style={{ color: page <=1 ? '#94a3b8' : '#2563eb' }}>Previous</Text>
          </TouchableOpacity>
          <Text style={{ color: '#64748b' }}>{page} / {Math.max(1, Math.ceil((total||0)/pageSize))}</Text>
          <TouchableOpacity disabled={page >= Math.ceil((total||0)/pageSize)} onPress={() => setPage(p => p+1)}>
            <Text style={{ color: page >= Math.ceil((total||0)/pageSize) ? '#94a3b8' : '#2563eb' }}>Next</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, backgroundColor: '#f8fafc', flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { marginLeft: 8, color: '#64748b', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 12 },
  card: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  cardLeft: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
