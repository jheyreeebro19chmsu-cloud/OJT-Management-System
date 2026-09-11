import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  Clock,
  Calendar,
  CheckCircle2,
  Search,
  MapPin,
  User,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  MessageSquare,
} from 'lucide-react-native';
import { mobileDb, TimeRecord, Employee } from '../lib/supabaseService';

export default function HTEDTRScreen({
  profile,
  activeAcademicYear,
  onBack,
}: {
  profile: any;
  activeAcademicYear?: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [trainees, setTrainees] = useState<Record<string, Employee>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'disapproved'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Disapproval modal note state
  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [selectedRecordForFlag, setSelectedRecordForFlag] = useState<TimeRecord | null>(null);
  const [flagNote, setFlagNote] = useState('');

  useEffect(() => {
    loadHTEAttendance();
  }, [filterDate, profile, activeAcademicYear]);

  async function loadHTEAttendance() {
    setLoading(true);
    try {
      const hteId = profile?.id || profile?.employeeId || '';
      const companyName = profile?.companyName || '';
      const [allRecords, hteTrainees] = await Promise.all([
        mobileDb.getTimeRecords(undefined, activeAcademicYear),
        mobileDb.getTraineesByHte(hteId, activeAcademicYear, companyName),
      ]);

      const traineeMap: Record<string, Employee> = {};
      const traineeIds = new Set<string>();
      hteTrainees.forEach((t) => {
        traineeMap[t.id] = t;
        traineeIds.add(t.id);
        if (t.employeeId) traineeIds.add(t.employeeId);
      });
      setTrainees(traineeMap);

      const filtered = allRecords.filter(
        (r) =>
          (!filterDate || r.date === filterDate) &&
          (traineeIds.has(r.employeeId) || hteTrainees.length === 0)
      );
      setRecords(filtered);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(record: TimeRecord) {
    setActionLoadingId(record.id);
    try {
      const supervisorName = profile?.name || profile?.companyName || 'HTE Supervisor';
      await mobileDb.updateTimeRecordApproval(record.id, 'approved', undefined, supervisorName);

      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? {
                ...r,
                approvalStatus: 'approved',
                approvedBy: supervisorName,
                approvedAt: new Date().toISOString(),
              }
            : r
        )
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to approve attendance');
    } finally {
      setActionLoadingId(null);
    }
  }

  function promptDisapprove(record: TimeRecord) {
    setSelectedRecordForFlag(record);
    setFlagNote('');
    setFlagModalVisible(true);
  }

  async function submitDisapprove() {
    if (!selectedRecordForFlag) return;
    const recId = selectedRecordForFlag.id;
    setActionLoadingId(recId);
    setFlagModalVisible(false);

    try {
      const supervisorName = profile?.name || profile?.companyName || 'HTE Supervisor';
      await mobileDb.updateTimeRecordApproval(
        recId,
        'disapproved',
        flagNote.trim() || 'Flagged by HTE supervisor',
        supervisorName
      );

      setRecords((prev) =>
        prev.map((r) =>
          r.id === recId
            ? {
                ...r,
                approvalStatus: 'disapproved',
                approvalNote: flagNote.trim() || 'Flagged by HTE supervisor',
                approvedBy: supervisorName,
                approvedAt: new Date().toISOString(),
              }
            : r
        )
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to flag attendance');
    } finally {
      setActionLoadingId(null);
      setSelectedRecordForFlag(null);
    }
  }

  const displayedRecords = records.filter((r) => {
    const emp = trainees[r.employeeId];
    const name = emp ? emp.name.toLowerCase() : '';
    const matchesSearch = name.includes(searchQuery.toLowerCase());
    const currentApproval = r.approvalStatus || 'pending';

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'pending') return matchesSearch && currentApproval === 'pending';
    if (statusFilter === 'approved') return matchesSearch && currentApproval === 'approved';
    if (statusFilter === 'disapproved') return matchesSearch && currentApproval === 'disapproved';
    return matchesSearch;
  });

  const pendingCount = records.filter((r) => !r.approvalStatus || r.approvalStatus === 'pending').length;
  const approvedCount = records.filter((r) => r.approvalStatus === 'approved').length;
  const flaggedCount = records.filter((r) => r.approvalStatus === 'disapproved').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft color="#0f172a" size={20} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>HTE Trainee Attendance</Text>
        <Text style={styles.subtitle}>
          Review, approve, and verify daily DTR logs for {profile?.companyName || 'your company'}
        </Text>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trainee name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.dateBar}>
          <Calendar size={16} color="#3b82f6" />
          <Text style={styles.dateLabel}>Date: </Text>
          <TextInput
            style={styles.dateInput}
            value={filterDate}
            onChangeText={setFilterDate}
            placeholder="YYYY-MM-DD"
          />
          <TouchableOpacity
            style={styles.todayBtn}
            onPress={() => setFilterDate(new Date().toISOString().split('T')[0])}
          >
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Tabs */}
        <View style={styles.statusTabRow}>
          <TouchableOpacity
            style={[styles.statusTab, statusFilter === 'all' && styles.statusTabActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.statusTabText, statusFilter === 'all' && styles.statusTabTextActive]}>
              All ({records.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusTab, statusFilter === 'pending' && styles.statusTabActive]}
            onPress={() => setStatusFilter('pending')}
          >
            <Text
              style={[
                styles.statusTabText,
                statusFilter === 'pending' && styles.statusTabTextActive,
                pendingCount > 0 && { color: '#d97706' },
              ]}
            >
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusTab, statusFilter === 'approved' && styles.statusTabActive]}
            onPress={() => setStatusFilter('approved')}
          >
            <Text style={[styles.statusTabText, statusFilter === 'approved' && styles.statusTabTextActive]}>
              Approved ({approvedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusTab, statusFilter === 'disapproved' && styles.statusTabActive]}
            onPress={() => setStatusFilter('disapproved')}
          >
            <Text style={[styles.statusTabText, statusFilter === 'disapproved' && styles.statusTabTextActive]}>
              Flagged ({flaggedCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Records List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Fetching attendance records...</Text>
        </View>
      ) : displayedRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Clock size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No records found</Text>
          <Text style={styles.emptySubtitle}>
            No attendance logs matching your criteria for {filterDate || 'selected date'}.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item }) => {
            const trainee = trainees[item.employeeId];
            const approval = item.approvalStatus || 'pending';
            const isActing = actionLoadingId === item.id;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.userRow}>
                    <View style={styles.avatar}>
                      {trainee?.photo ? (
                        <Image source={{ uri: trainee.photo }} style={styles.avatarImg} />
                      ) : (
                        <User size={18} color="#2563eb" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.name}>{trainee ? trainee.name : 'Trainee'}</Text>
                      <Text style={styles.meta}>{trainee?.course || 'OJT Student'}</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View
                      style={[
                        styles.badge,
                        item.status === 'present' ? styles.badgePresent : styles.badgeLate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          item.status === 'present' ? styles.badgeTextPresent : styles.badgeTextLate,
                        ]}
                      >
                        {item.status.toUpperCase()}
                      </Text>
                    </View>

                    {/* Approval Status Badge */}
                    <View
                      style={[
                        styles.approvalBadge,
                        approval === 'approved'
                          ? styles.approvalBadgeApproved
                          : approval === 'disapproved'
                          ? styles.approvalBadgeDisapproved
                          : styles.approvalBadgePending,
                      ]}
                    >
                      {approval === 'approved' ? (
                        <CheckCircle2 size={10} color="#16a34a" />
                      ) : approval === 'disapproved' ? (
                        <AlertCircle size={10} color="#dc2626" />
                      ) : (
                        <Clock size={10} color="#d97706" />
                      )}
                      <Text
                        style={[
                          styles.approvalBadgeText,
                          approval === 'approved'
                            ? styles.approvalBadgeTextApproved
                            : approval === 'disapproved'
                            ? styles.approvalBadgeTextDisapproved
                            : styles.approvalBadgeTextPending,
                        ]}
                      >
                        {approval === 'approved'
                          ? 'APPROVED'
                          : approval === 'disapproved'
                          ? 'FLAGGED'
                          : 'PENDING'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Time Grid */}
                <View style={styles.timeGrid}>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeLabel}>Time In</Text>
                    <Text style={styles.timeVal}>{item.timeIn || '—'}</Text>
                  </View>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeLabel}>Time Out</Text>
                    <Text style={styles.timeVal}>{item.timeOut || '—'}</Text>
                  </View>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeLabel}>Total Hours</Text>
                    <Text style={[styles.timeVal, { color: '#2563eb', fontWeight: '800' }]}>
                      {item.totalHours ? `${item.totalHours.toFixed(1)} hrs` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Compliance Tags */}
                <View style={styles.complianceRow}>
                  {item.timeInGeofenced && (
                    <View style={styles.tag}>
                      <MapPin size={12} color="#16a34a" />
                      <Text style={styles.tagText}>On-Site (Geofenced)</Text>
                    </View>
                  )}
                  {item.timeInFaceVerified && (
                    <View style={styles.tag}>
                      <ShieldCheck size={12} color="#16a34a" />
                      <Text style={styles.tagText}>Face Verified</Text>
                    </View>
                  )}
                </View>

                {/* Supervisor Note if present */}
                {item.approvalNote ? (
                  <View style={styles.noteBox}>
                    <MessageSquare size={12} color="#64748b" />
                    <Text style={styles.noteText}>
                      <Text style={{ fontWeight: '700' }}>Note: </Text>
                      {item.approvalNote}
                    </Text>
                  </View>
                ) : null}

                {/* Supervisor Approval Actions */}
                <View style={styles.actionsRow}>
                  {isActing ? (
                    <ActivityIndicator size="small" color="#2563eb" style={{ paddingVertical: 6 }} />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.approveBtn,
                          approval === 'approved' && styles.actionBtnActive,
                        ]}
                        onPress={() => handleApprove(item)}
                        disabled={approval === 'approved'}
                      >
                        <Check size={14} color={approval === 'approved' ? '#fff' : '#16a34a'} />
                        <Text
                          style={[
                            styles.actionBtnText,
                            approval === 'approved' ? { color: '#fff' } : { color: '#16a34a' },
                          ]}
                        >
                          {approval === 'approved' ? 'Approved' : 'Approve'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.flagBtn,
                          approval === 'disapproved' && styles.actionBtnActiveRed,
                        ]}
                        onPress={() => promptDisapprove(item)}
                      >
                        <X size={14} color={approval === 'disapproved' ? '#fff' : '#dc2626'} />
                        <Text
                          style={[
                            styles.actionBtnText,
                            approval === 'disapproved' ? { color: '#fff' } : { color: '#dc2626' },
                          ]}
                        >
                          {approval === 'disapproved' ? 'Flagged' : 'Flag'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Disapprove / Flag Note Modal */}
      <Modal visible={flagModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Flag Attendance Record</Text>
            <Text style={styles.modalSubtitle}>
              Please enter the reason for flagging or disapproving this trainee attendance log:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Left early without authorization, proxy check-in"
              placeholderTextColor="#94a3b8"
              value={flagNote}
              onChangeText={setFlagNote}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setFlagModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalConfirmBtn} onPress={submitDisapprove}>
                <Text style={styles.modalConfirmBtnText}>Flag Record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, paddingTop: 50 },
  header: { marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { marginLeft: 6, fontWeight: '700', color: '#0f172a', fontSize: 14 },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  filterSection: { marginBottom: 16, gap: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0f172a' },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  dateLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginLeft: 6 },
  dateInput: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '600' },
  todayBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  todayBtnText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  statusTabRow: { flexDirection: 'row', gap: 6 },
  statusTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  statusTabActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  statusTabText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  statusTabTextActive: { color: '#2563eb', fontWeight: '800' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  name: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  meta: { fontSize: 11, color: '#64748b' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgePresent: { backgroundColor: '#dcfce7' },
  badgeTextPresent: { color: '#16a34a', fontWeight: '800', fontSize: 11 },
  badgeLate: { backgroundColor: '#fef3c7' },
  badgeTextLate: { color: '#d97706', fontWeight: '800', fontSize: 11 },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  approvalBadgeText: { fontSize: 9, fontWeight: '800' },
  approvalBadgeApproved: { backgroundColor: '#f0fdf4' },
  approvalBadgeTextApproved: { color: '#16a34a' },
  approvalBadgeDisapproved: { backgroundColor: '#fef2f2' },
  approvalBadgeTextDisapproved: { color: '#dc2626' },
  approvalBadgePending: { backgroundColor: '#fffbeb' },
  approvalBadgeTextPending: { color: '#d97706' },
  timeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
  },
  timeCol: { alignItems: 'center', flex: 1 },
  timeLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  timeVal: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  complianceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  tagText: { fontSize: 11, color: '#16a34a', fontWeight: '700' },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  noteText: { fontSize: 11, color: '#475569', flex: 1 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
  },
  approveBtn: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  flagBtn: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  actionBtnActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  actionBtnActiveRed: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  loadingText: { marginTop: 10, color: '#64748b', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 14 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 16,
  },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  modalCancelBtnText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  modalConfirmBtn: { backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  modalConfirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
