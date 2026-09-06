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
import { Bell, Plus, X, Clock, CheckCircle, Send, AlertCircle, ChevronRight, Camera, Image as ImageIcon, MessageSquare, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
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
  requires_submission?: boolean;
}

interface AnnouncementResponse {
  id: string;
  announcement_id: string;
  employee_id: string;
  message: string;
  photo?: string;
  created_at: string;
}

export interface AnnouncementComment {
  id: string;
  announcement_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
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
  const [comments, setComments] = useState<Record<string, AnnouncementComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, string | null>>({});
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

      // Fetch all comments for active announcements
      try {
        const { data: commData } = await supabase
          .from('announcement_comments')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (commData) {
          const commMap: Record<string, AnnouncementComment[]> = {};
          commData.forEach((c: AnnouncementComment) => {
            if (!commMap[c.announcement_id]) commMap[c.announcement_id] = [];
            commMap[c.announcement_id].push(c);
          });
          setComments(commMap);
        }
      } catch (commErr) {
        console.debug('Failed to fetch announcement comments:', commErr);
      }
    } catch (err) {
      console.error('Failed to fetch announcements', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, activeAcademicYear]);

  const postComment = async (announcementId: string) => {
    const text = (commentDrafts[announcementId] || '').trim();
    if (!text) return;

    setSubmittingComment(prev => ({ ...prev, [announcementId]: true }));
    const newComm: AnnouncementComment = {
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      announcement_id: announcementId,
      author_id: profile?.id || 'anonymous',
      author_name: profile?.name || 'User',
      author_role: isAdmin ? 'Instructor' : profile?.role === 'hte' ? 'HTE' : 'Trainee',
      content: text,
      created_at: new Date().toISOString(),
    };

    // Optimistically show immediately
    setComments(prev => ({
      ...prev,
      [announcementId]: [...(prev[announcementId] || []), newComm],
    }));
    setCommentDrafts(prev => ({ ...prev, [announcementId]: '' }));

    try {
      await supabase.from('announcement_comments').insert({
        announcement_id: announcementId,
        author_id: newComm.author_id,
        author_name: newComm.author_name,
        author_role: newComm.author_role,
        content: newComm.content,
        created_at: newComm.created_at,
      });
    } catch (err) {
      console.debug('Supabase comment insert failed, saved in local state:', err);
    } finally {
      setSubmittingComment(prev => ({ ...prev, [announcementId]: false }));
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const pickImage = async (announcementId: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoDrafts((prev) => ({ ...prev, [announcementId]: uri }));
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const takePhoto = async (announcementId: string) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to capture assignment photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoDrafts((prev) => ({ ...prev, [announcementId]: uri }));
      }
    } catch (err) {
      console.warn('Camera error:', err);
    }
  };

  const submitResponse = async (announcement: Announcement) => {
    const message = (messageDrafts[announcement.id] || '').trim();
    const photo = photoDrafts[announcement.id];
    if (!message && !photo) {
      Alert.alert('Required', 'Please write a message or attach a photo for your submission.');
      return;
    }
    setSubmitting((prev) => ({ ...prev, [announcement.id]: true }));
    try {
      const { error } = await supabase.from('announcement_responses').upsert({
        announcement_id: announcement.id,
        employee_id: profile.id,
        message: message || 'Assignment attachment submitted',
        photo: photo || null,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      setMessageDrafts((prev) => ({ ...prev, [announcement.id]: '' }));
      setPhotoDrafts((prev) => ({ ...prev, [announcement.id]: null }));
      await fetchAnnouncements();
      Alert.alert('Success', 'Assignment response submitted successfully!');
    } catch {
      Alert.alert('Error', 'Failed to submit assignment response.');
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

                {/* Trainee Assignment Submission Section */}
                {!isAdmin && (
                  <View style={styles.assignmentSection}>
                    <View style={styles.assignmentHeader}>
                      <Text style={styles.assignmentTitle}>Assignment / Task Submission</Text>
                    </View>

                    {responded ? (
                      <View style={styles.respondedCard}>
                        <View style={styles.respondedTop}>
                          <CheckCircle size={16} color="#059669" />
                          <Text style={styles.respondedTitle}>Submitted</Text>
                          <Text style={styles.respondedDate}>{formatDate(responses[ann.id].created_at)}</Text>
                        </View>
                        <Text style={styles.respondedMessage}>{responses[ann.id].message}</Text>
                        {responses[ann.id].photo && (
                          <Image
                            source={{ uri: responses[ann.id].photo }}
                            style={styles.submittedPhoto}
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    ) : (
                      <View style={styles.submissionBox}>
                        <TextInput
                          style={styles.submissionInput}
                          placeholder="Type your assignment response or work summary..."
                          placeholderTextColor="#94a3b8"
                          value={messageDrafts[ann.id] || ''}
                          onChangeText={(v) => setMessageDrafts((prev) => ({ ...prev, [ann.id]: v }))}
                          multiline
                        />

                        {photoDrafts[ann.id] && (
                          <View style={styles.previewContainer}>
                            <Image
                              source={{ uri: photoDrafts[ann.id]! }}
                              style={styles.previewImage}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={styles.removePhotoBtn}
                              onPress={() => setPhotoDrafts((prev) => ({ ...prev, [ann.id]: null }))}
                            >
                              <X size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        )}

                        <View style={styles.submissionActionsRow}>
                          <View style={styles.attachmentButtons}>
                            <TouchableOpacity
                              style={styles.attachBtn}
                              onPress={() => takePhoto(ann.id)}
                            >
                              <Camera size={16} color="#0284c7" />
                              <Text style={styles.attachBtnText}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.attachBtn}
                              onPress={() => pickImage(ann.id)}
                            >
                              <ImageIcon size={16} color="#0284c7" />
                              <Text style={styles.attachBtnText}>Gallery</Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.submitAssignmentBtn,
                              (!messageDrafts[ann.id]?.trim() && !photoDrafts[ann.id]) && styles.submitBtnDisabled,
                            ]}
                            onPress={() => submitResponse(ann)}
                            disabled={
                              submitting[ann.id] ||
                              (!messageDrafts[ann.id]?.trim() && !photoDrafts[ann.id])
                            }
                          >
                            {submitting[ann.id] ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <>
                                <Send size={14} color="#fff" />
                                <Text style={styles.submitAssignmentBtnText}>Submit</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Synced Comments Section */}
                <View style={styles.commentsSection}>
                  <View style={styles.commentsHeader}>
                    <Text style={styles.commentsHeading}>
                      Comments ({comments[ann.id]?.length || 0})
                    </Text>
                  </View>

                  {/* List of comments */}
                  {comments[ann.id] && comments[ann.id].length > 0 ? (
                    <View style={styles.commentsList}>
                      {comments[ann.id].map((comm) => {
                        const isInstr = comm.author_role === 'Instructor';
                        const isHTE = comm.author_role === 'HTE';
                        return (
                          <View key={comm.id} style={styles.commentItem}>
                            <View style={styles.commentMetaRow}>
                              <Text style={styles.commentAuthor}>{comm.author_name}</Text>
                              <View
                                style={[
                                  styles.roleBadge,
                                  isInstr
                                    ? { backgroundColor: '#f3e8ff' }
                                    : isHTE
                                    ? { backgroundColor: '#dcfce7' }
                                    : { backgroundColor: '#e0f2fe' },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.roleBadgeText,
                                    isInstr
                                      ? { color: '#7e22ce' }
                                      : isHTE
                                      ? { color: '#15803d' }
                                      : { color: '#0369a1' },
                                  ]}
                                >
                                  {comm.author_role}
                                </Text>
                              </View>
                              <Text style={styles.commentDate}>{formatDate(comm.created_at)}</Text>
                            </View>
                            <Text style={styles.commentBody}>{comm.content}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
                  )}

                  {/* Comment Input */}
                  <View style={styles.commentInputRow}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Write a comment..."
                      placeholderTextColor="#94a3b8"
                      value={commentDrafts[ann.id] || ''}
                      onChangeText={(v) => setCommentDrafts((prev) => ({ ...prev, [ann.id]: v }))}
                      multiline
                    />
                    <TouchableOpacity
                      style={styles.commentSendBtn}
                      onPress={() => postComment(ann.id)}
                      disabled={submittingComment[ann.id] || !commentDrafts[ann.id]?.trim()}
                    >
                      {submittingComment[ann.id] ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Send color="#fff" size={15} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
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
  commentsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentsHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  commentsList: {
    gap: 8,
    marginBottom: 10,
  },
  commentItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  commentDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  commentBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  noCommentsText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 70,
  },
  commentSendBtn: {
    width: 38,
    height: 38,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  assignmentHeader: {
    marginBottom: 8,
  },
  assignmentTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369a1',
  },
  respondedCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    gap: 6,
  },
  respondedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  respondedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  respondedDate: {
    fontSize: 11,
    color: '#16a34a',
    marginLeft: 'auto',
  },
  respondedMessage: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  submittedPhoto: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginTop: 6,
  },
  submissionBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 8,
  },
  submissionInput: {
    fontSize: 13,
    color: '#0f172a',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  previewContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 3,
  },
  submissionActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  attachmentButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  attachBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  submitAssignmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitAssignmentBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});
