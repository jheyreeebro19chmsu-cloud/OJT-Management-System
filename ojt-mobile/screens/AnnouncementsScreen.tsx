import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { Bell, Plus, X, Clock, CheckCircle, Send, AlertCircle, ChevronRight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  expiry_date?: string;
  created_at: string;
  photo?: string;
  academic_year?: string;
}

interface AnnouncementResponse {
  id: string;
  announcement_id: string;
  employee_id: string;
  message: string;
  created_at: string;
}

interface Props {
  profile: any;
  activeAcademicYear: string;
  onBack: () => void;
}

export default function AnnouncementsScreen({ profile, activeAcademicYear, onBack }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [responses, setResponses] = useState<Record<string, AnnouncementResponse>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [posting, setPosting] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'instructor';

  const fetchAnnouncements = useCallback(async () => {
    try {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeAcademicYear) {
        query = query.or(`academic_year.eq.${activeAcademicYear},academic_year.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const now = new Date();
      const active = (data || []).filter((a: Announcement) => {
        if (!a.expiry_date) return true;
        return new Date(a.expiry_date) > now;
      });
      setAnnouncements(active);

      // Fetch own responses
      if (profile?.id) {
        const { data: respData } = await supabase
          .from('announcement_responses')
          .select('*')
          .eq('employee_id', profile.id);
        const respMap: Record<string, AnnouncementResponse> = {};
        (respData || []).forEach((r: AnnouncementResponse) => {
          respMap[r.announcement_id] = r;
        });
        setResponses(respMap);
      }
    } catch (err) {
      console.error('Failed to fetch announcements', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, activeAcademicYear]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const submitResponse = async (announcement: Announcement) => {
    const message = (messageDrafts[announcement.id] || '').trim();
    if (!message) return;
    setSubmitting((prev) => ({ ...prev, [announcement.id]: true }));
    try {
      const { error } = await supabase.from('announcement_responses').upsert({
        announcement_id: announcement.id,
        employee_id: profile.id,
        message,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      setMessageDrafts((prev) => ({ ...prev, [announcement.id]: '' }));
      await fetchAnnouncements();
      Alert.alert('Success', 'Response submitted!');
    } catch {
      Alert.alert('Error', 'Failed to submit response.');
    } finally {
      setSubmitting((prev) => ({ ...prev, [announcement.id]: false }));
    }
  };

  const postAnnouncement = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert('Required', 'Title and content are required.');
      return;
    }
    setPosting(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: newTitle.trim(),
        content: newContent.trim(),
        type: 'general',
        expiry_date: newExpiry || null,
        academic_year: activeAcademicYear,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      setNewTitle('');
      setNewContent('');
      setNewExpiry('');
      setShowCreate(false);
      await fetchAnnouncements();
      Alert.alert('Posted!', 'Announcement posted successfully.');
    } catch {
      Alert.alert('Error', 'Failed to post announcement.');
    } finally {
      setPosting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const isExpiringSoon = (dateStr?: string) => {
    if (!dateStr) return false;
    const diff = new Date(dateStr).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  };

  const typeColor: Record<string, { bg: string; text: string; border: string }> = {
    urgent: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
    reminder: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
    general: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    event: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <X color="#374151" size={20} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Bell color="#2563eb" size={22} />
          <Text style={styles.headerText}>Announcements</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
            <Plus color="#fff" size={18} />
          </TouchableOpacity>
        )}
      </View>

      {/* Create Modal */}
      {showCreate && (
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Post Announcement</Text>
          <TextInput
            style={styles.input}
            placeholder="Title"
            value={newTitle}
            onChangeText={setNewTitle}
            maxLength={80}
          />
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Write announcement content..."
            value={newContent}
            onChangeText={setNewContent}
            multiline
            maxLength={500}
          />
          <TextInput
            style={styles.input}
            placeholder="Expiry date/time (e.g. 2026-09-01T18:00)"
            value={newExpiry}
            onChangeText={setNewExpiry}
            autoCapitalize="none"
          />
          <View style={styles.createActions}>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={postAnnouncement} style={styles.postBtn} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.postBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading announcements...</Text>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centered}>
          <Bell color="#cbd5e1" size={48} />
          <Text style={styles.emptyTitle}>No Announcements</Text>
          <Text style={styles.emptyDesc}>Check back later for updates.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {announcements.map((ann) => {
            const colors = typeColor[ann.type] || typeColor.general;
            const responded = !!responses[ann.id];
            const expiring = isExpiringSoon(ann.expiry_date);

            return (
              <View key={ann.id} style={[styles.card, { borderColor: colors.border }]}>
                {/* Type badge */}
                <View style={[styles.typeBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.text }]}>
                    {(ann.type || 'general').toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.cardTitle}>{ann.title}</Text>
                <Text style={styles.cardContent}>{ann.content}</Text>

                {ann.photo && (
                  <Image source={{ uri: ann.photo }} style={styles.cardPhoto} resizeMode="cover" />
                )}

                <View style={styles.metaRow}>
                  <Clock color="#94a3b8" size={13} />
                  <Text style={styles.metaText}>{formatDate(ann.created_at)}</Text>
                  {expiring && (
                    <View style={styles.expiringBadge}>
                      <AlertCircle color="#d97706" size={12} />
                      <Text style={styles.expiringText}>Expiring soon</Text>
                    </View>
                  )}
                </View>

                {ann.expiry_date && (
                  <Text style={styles.expiryText}>
                    Expires: {formatDate(ann.expiry_date)}
                  </Text>
                )}

                {!isAdmin && (
                  responded ? (
                    <View style={styles.respondedBadge}>
                      <CheckCircle color="#16a34a" size={16} />
                      <Text style={styles.respondedText}>Responded: {responses[ann.id]?.message}</Text>
                    </View>
                  ) : (
                    <View style={styles.responseArea}>
                      <TextInput
                        style={styles.responseInput}
                        placeholder="Type your response..."
                        value={messageDrafts[ann.id] || ''}
                        onChangeText={(v) => setMessageDrafts((prev) => ({ ...prev, [ann.id]: v }))}
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.sendBtn}
                        onPress={() => submitResponse(ann)}
                        disabled={submitting[ann.id]}
                      >
                        {submitting[ann.id] ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Send color="#fff" size={16} />
                        )}
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  backBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 12 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  addBtn: { padding: 10, backgroundColor: '#2563eb', borderRadius: 12 },
  list: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  cardContent: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 12 },
  cardPhoto: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { fontSize: 12, color: '#94a3b8' },
  expiringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 8,
  },
  expiringText: { fontSize: 11, color: '#d97706', fontWeight: '700' },
  expiryText: { fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  respondedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  respondedText: { fontSize: 13, color: '#15803d', flex: 1, fontWeight: '600' },
  responseArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 },
  responseInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 44,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#334155', marginTop: 16 },
  emptyDesc: { fontSize: 14, color: '#64748b', marginTop: 6, textAlign: 'center' },
  createCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  createTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 14 },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  createActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { fontWeight: '700', color: '#374151' },
  postBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  postBtnText: { fontWeight: '800', color: '#fff' },
});
