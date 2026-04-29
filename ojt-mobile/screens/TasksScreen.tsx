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
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

interface TasksScreenProps {
  onBack: () => void;
}

export default function TasksScreen({ onBack }: TasksScreenProps) {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, { message: string, photo: string | null }>>({});

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTasks(data || []);
      
      // Initialize response state
      const initialResponses: any = {};
      data?.forEach(t => {
        initialResponses[t.id] = { message: '', photo: null };
      });
      setResponses(initialResponses);
    } catch (err: any) {
      Alert.alert('Error', err.message);
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
    if (!response.message && !response.photo) {
      Alert.alert('Empty Submission', 'Please provide a message or a photo.');
      return;
    }

    setSubmitting(task.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      let photoUrl = null;
      if (response.photo) {
        // Upload to Supabase Storage
        const base64 = await FileSystem.readAsStringAsync(response.photo, { encoding: FileSystem.EncodingType.Base64 });
        const filePath = `submissions/${user.id}/${task.id}_${Date.now()}.jpg`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-submissions')
          .upload(filePath, decode(base64), { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('task-submissions')
          .getPublicUrl(filePath);
        
        photoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('announcement_submissions')
        .insert({
          announcement_id: task.id,
          employee_id: user.id,
          message: response.message,
          photo: photoUrl,
          submitted_at: new Date().toISOString()
        });

      if (error) throw error;

      Alert.alert('Success', 'Your response has been submitted.');
      // Refresh or clear
      updateResponse(task.id, 'message', '');
      updateResponse(task.id, 'photo', null);
    } catch (err: any) {
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
        <Text style={styles.subtitle}>Submit your progress to your instructor</Text>
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
              <View style={[styles.typeBadge, { backgroundColor: task.type === 'urgent' ? '#fee2e2' : '#eff6ff' }]}>
                <Text style={[styles.typeText, { color: task.type === 'urgent' ? '#ef4444' : '#2563eb' }]}>
                  {task.type.toUpperCase()}
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

            {task.requires_submission && (
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
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    marginTop: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deadlineText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  taskContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 20,
  },
  submissionSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 20,
  },
  submissionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  responseInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  photoActions: {
    marginVertical: 16,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignSelf: 'flex-start',
  },
  addPhotoText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 14,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  removePhoto: {
    padding: 8,
  },
  removePhotoText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  }
});
