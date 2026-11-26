import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { Camera, FileText, Send, CheckCircle, Clock, ArrowLeft, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { announcementApi } from '../lib/api';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

interface TasksScreenProps {
  onBack: () => void;
  profile: any;
}

export default function TasksScreen({ onBack, profile }: TasksScreenProps) {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, { message: string, photo: string | null }>>({});

  useEffect(() => {
    fetchTasks();

    const liveChannel = supabase
      .channel('ojt-mobile-tasks-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    const broadcastChannel = supabase
      .channel('ojt-instant-sync-v1', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'live_sync' }, ({ payload }) => {
        if (
          payload?.type === 'announcement_created' ||
          payload?.type === 'announcement_updated' ||
          payload?.type === 'announcement_deleted'
        ) {
          fetchTasks();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(liveChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, []);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = data || [];
      setTasks(list);

      setResponses((prev) => {
        const next: Record<string, { message: string; photo: string | null }> = { ...prev };
        list.forEach((t: any) => {
          if (!next[t.id]) {
            next[t.id] = { message: '', photo: null };
          }
        });
        return next;
      });
    } catch (err: any) {
      console.error('Fetch tasks error:', err);
    } finally {
      setLoading(false);
    }
  }

  const updateResponse = (taskId: string, key: 'message' | 'photo', value: any) => {
    setResponses(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], [key]: value }
    }));
  };

  async function pickImage(taskId: string) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      updateResponse(taskId, 'photo', result.assets[0].uri);
    }
  }

  async function handleSubmit(task: any) {
    const response = responses[task.id];
    if (!response?.message && !response?.photo) {
      Alert.alert('Empty Submission', 'Please provide a message or a photo.');
      return;
    }

    const msgSnapshot = response.message || 'Task submission attached';
    const photoSnapshot = response.photo;
    const submittedAt = new Date().toISOString();

    // Optimistically clear inputs right away so UI feels instantaneous
    updateResponse(task.id, 'message', '');
    updateResponse(task.id, 'photo', null);
    setSubmitting(task.id);

    try {
      const userId = profile?.id || (await supabase.auth.getUser()).data?.user?.id;
      if (!userId) throw new Error('User not found');

      let photoUrl: string | null = null;
      if (photoSnapshot) {
        const base64 = await FileSystem.readAsStringAsync(photoSnapshot, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const arrayBuf = decode(base64);
        const filePath = `submissions/${userId}/${task.id}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('task-submissions')
          .upload(filePath, arrayBuf, { contentType: 'image/jpeg', upsert: true });

        if (!uploadError) {
          const { data: pub } = supabase.storage.from('task-submissions').getPublicUrl(filePath);
          photoUrl = pub.publicUrl;
        } else {
          const fallbackPath = `documents/${userId}/sub_${task.id}_${Date.now()}.jpg`;
          const { error: fbErr } = await supabase.storage
            .from('face-photos')
            .upload(fallbackPath, arrayBuf, { contentType: 'image/jpeg', upsert: true });
          if (!fbErr) {
            const { data: fbPub } = supabase.storage.from('face-photos').getPublicUrl(fallbackPath);
            photoUrl = fbPub.publicUrl;
          }
        }
      }

      await Promise.allSettled([
        supabase.from('announcement_submissions').insert({
          announcement_id: task.id,
          employee_id: userId,
          message: msgSnapshot,
          photo: photoUrl,
          submitted_at: submittedAt,
        }),
        supabase.from('announcement_responses').upsert({
          announcement_id: task.id,
          employee_id: userId,
          message: msgSnapshot,
          photo: photoUrl,
          created_at: submittedAt,
        }),
      ]);

      try {
        const ch = supabase.channel('ojt-instant-sync-v1');
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            ch.send({
              type: 'broadcast',
              event: 'live_sync',
              payload: {
                type: 'announcement_submission',
                payload: {
                  announcementId: task.id,
                  submission: {
                    id: `sub-${Date.now()}`,
                    announcementId: task.id,
                    employeeId: userId,
                    message: msgSnapshot,
                    photo: photoUrl || undefined,
                    submittedAt,
                  },
                },
              },
            }).finally(() => supabase.removeChannel(ch));
          }
        });
      } catch {}

      Alert.alert('Success', 'Your response has been submitted.');
    } catch (err: any) {
      updateResponse(task.id, 'message', msgSnapshot);
      updateResponse(task.id, 'photo', photoSnapshot);
      Alert.alert('Submission Failed', err.message);
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft color="#64748b" size={20} />
        <Text style={styles.backBtnText}>Back to Dashboard</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Tasks & Updates</Text>
        <Text style={styles.subtitle}>Stay informed and submit your work</Text>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <FileText color="#94a3b8" size={48} />
          <Text style={styles.emptyText}>No tasks assigned yet.</Text>
        </View>
      ) : (
        tasks.map(task => (
          <View key={task.id} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <View style={[styles.typeBadge, { backgroundColor: '#eff6ff' }]}>
                <Text style={[styles.typeText, { color: '#2563eb' }]}>
                  ANNOUNCEMENT
                </Text>
              </View>
              {task.deadline_at && (
                <View style={styles.deadlineRow}>
                  <Clock size={12} color="#64748b" />
                  <Text style={styles.deadlineText}>Due: {new Date(task.deadline_at).toLocaleDateString()}</Text>
                </View>
              )}
            </View>

            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskContent}>{task.content}</Text>

            {true && (
              <View style={styles.submissionSection}>
                <Text style={styles.submissionLabel}>Your Response</Text>
                <TextInput 
                  style={styles.responseInput}
                  multiline
                  placeholder="Enter your message here..."
                  value={responses[task.id]?.message}
                  onChangeText={v => updateResponse(task.id, 'message', v)}
                />

                <View style={styles.photoActions}>
                  {responses[task.id]?.photo ? (
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: responses[task.id].photo! }} style={styles.previewImage} />
                      <TouchableOpacity 
                        style={styles.removePhoto} 
                        onPress={() => updateResponse(task.id, 'photo', null)}
                      >
                        <Text style={styles.removePhotoText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickImage(task.id)}>
                      <ImageIcon color="#2563eb" size={20} />
                      <Text style={styles.addPhotoText}>Add Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.submitBtn} 
                  onPress={() => handleSubmit(task)}
                  disabled={submitting === task.id}
                >
                  {submitting === task.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Send color="#fff" size={18} />
                      <Text style={styles.submitBtnText}>Send Submission</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backBtnText: {
    marginLeft: 8,
    color: '#64748b',
    fontWeight: '700',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyText: {
    marginTop: 20,
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 16,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  deadlineText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 10,
  },
  taskContent: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 24,
  },
  submissionSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 24,
  },
  submissionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  responseInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 20,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  photoActions: {
    marginVertical: 20,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignSelf: 'flex-start',
  },
  addPhotoText: {
    color: '#2563eb',
    fontWeight: '800',
    fontSize: 14,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  removePhoto: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  removePhotoText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  }
});
