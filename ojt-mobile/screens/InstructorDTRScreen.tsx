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
  CheckCircle,
  AlertCircle,
  Search,
  ShieldCheck,
  MapPin,
  User,
  Check,
  X,
  CheckCheck,
} from 'lucide-react-native';
import { mobileDb, TimeRecord, Employee } from '../lib/supabaseService';
import { supabase } from '../lib/supabase';

export default function InstructorDTRScreen({
  profile,
  onBack,
  activeAcademicYear,
}: {
  profile?: any;
  onBack: () => void;
  activeAcademicYear?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'disapproved'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Disapproval modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRecordForReject, setSelectedRecordForReject] = useState<TimeRecord | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('instructor-dtr-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_records' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterDate, activeAcademicYear]);

  async function loadData() {
    setLoading(true);
    try {
      const [allRecords, allEmps] = await Promise.all([
        mobileDb.getTimeRecords(undefined, activeAcademicYear),
        mobileDb.getEmployees(),
      ]);

      const empMap: Record<string, Employee> = {};
      allEmps.forEach((e) => {
        empMap[e.id] = e;
      });
      setEmployees(empMap);

      const filtered = allRecords.filter((r) => !filterDate || r.date === filterDate);
      setRecords(filtered);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load DTR records');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(record: TimeRecord) {
    setActionLoadingId(record.id);
    try {
      const instructorName = profile?.name || 'OJT Instructor';
      const ok = await mobileDb.updateTimeRecordApproval(record.id, 'approved', undefined, instructorName);
      if (ok) {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === record.id
              ? {
                  ...r,
                  approvalStatus: 'approved',
                  approvedBy: instructorName,
                  approvedAt: new Date().toISOString(),
                }
              : r
          )
        );
      } else {
        Alert.alert('Error', 'Failed to update approval status in cloud database.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve attendance record.');
    } finally {
      setActionLoadingId(null);
    }
  }

  function promptReject(record: TimeRecord) {
    setSelectedRecordForReject(record);
    setRejectNote('');
    setRejectModalVisible(true);
  }

  async function submitReject() {
    if (!selectedRecordForReject) return;
    const recId = selectedRecordForReject.id;
    setActionLoadingId(recId);
    setRejectModalVisible(false);

    try {
      const instructorName = profile?.name || 'OJT Instructor';
      const note = rejectNote.trim() || 'Disapproved by OJT Instructor';
      const ok = await mobileDb.updateTimeRecordApproval(recId, 'disapproved', note, instructorName);
      if (ok) {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recId
              ? {
                  ...r,
                  approvalStatus: 'disapproved',
                  approvalNote: note,
                  approvedBy: instructorName,
                  approvedAt: new Date().toISOString(),
                }
              : r
          )
        );
      } else {
        Alert.alert('Error', 'Failed to update disapproval status in cloud database.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to disapprove attendance record.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleApproveAllPending() {
    const pending = displayedRecords.filter((r) => !r.approvalStatus || r.approvalStatus === 'pending');
    if (pending.length === 0) {
      Alert.alert('No Pending Records', 'There are no pending attendance records to approve.');
      return;
    }

    Alert.alert(
      'Approve All Pending',
      `Are you sure you want to approve all ${pending.length} pending attendance record(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            const instructorName = profile?.name || 'OJT Instructor';
            try {
              for (const r of pending) {
                await mobileDb.updateTimeRecordApproval(r.id, 'approved', undefined, instructorName);
              }
              setRecords((prev) =>
                prev.map((r) =>
                  pending.some((p) => p.id === r.id)
                    ? {
                        ...r,
                        approvalStatus: 'approved',
                        approvedBy: instructorName,
                        approvedAt: new Date().toISOString(),
                      }
                    : r
                )
              );
              Alert.alert('Success', `Successfully approved ${pending.length} attendance record(s).`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to approve some records.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  // Filter calculations
  const pendingCount = records.filter((r) => !r.approvalStatus || r.approvalStatus === 'pending').length;
  const approvedCount = records.filter((r) => r.approvalStatus === 'approved').length;
  const disapprovedCount = records.filter((r) => r.approvalStatus === 'disapproved').length;

  const displayedRecords = records
    .filter((r) => {
      if (statusFilter === 'pending') return !r.approvalStatus || r.approvalStatus === 'pending';
      if (statusFilter === 'approved') return r.approvalStatus === 'approved';
      if (statusFilter === 'disapproved') return r.approvalStatus === 'disapproved';
      return true;
    })
    .filter((r) => {
      const emp = employees[r.employeeId];
      const name = emp ? emp.name.toLowerCase() : '';
      const id = emp ? emp.employeeId.toLowerCase() : '';
      const q = searchQuery.toLowerCase();
      return name.includes(q) || id.includes(q);
    });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft color="#0f172a" size={20} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>DTR Monitoring & Reports</Text>
        <Text style={styles.subtitle}>Review trainee daily attendance logs, verify compliance & approve DTR</Text>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trainee name or ID..."
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

        {/* Approval Status Filter Pills */}
        <View style={styles.statusFilterRow}>
          <TouchableOpacity
            style={[styles.statusPill, statusFilter === 'all' && styles.statusPillActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.statusPillText, statusFilter === 'all' && styles.statusPillTextActive]}>
              All ({records.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusPill, statusFilter === 'pending' && styles.statusPillActiveAmber]}
            onPress={() => setStatusFilter('pending')}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: '#b45309' },
                statusFilter === 'pending' && styles.statusPillTextActiveAmber,
              ]}
            >
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusPill, statusFilter === 'approved' && styles.statusPillActiveGreen]}
            onPress={() => setStatusFilter('approved')}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: '#15803d' },
                statusFilter === 'approved' && styles.statusPillTextActiveGreen,
              ]}
            >
              Approved ({approvedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusPill, statusFilter === 'disapproved' && styles.statusPillActiveRed]}
            onPress={() => setStatusFilter('disapproved')}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: '#b91c1c' },
                statusFilter === 'disapproved' && styles.statusPillTextActiveRed,
              ]}
            >
              Disapproved ({disapprovedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bulk Quick Action */}
        {pendingCount > 0 && (
          <TouchableOpacity style={styles.bulkApproveBtn} onPress={handleApproveAllPending}>
            <CheckCheck size={16} color="#fff" />
            <Text style={styles.bulkApproveBtnText}>Approve All Pending ({pendingCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Record List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Fetching attendance records...</Text>
        </View>
      ) : displayedRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Clock size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No records found</Text>
          <Text style={styles.emptySubtitle}>
            No attendance logs found matching "{statusFilter}" for {filterDate || 'selected date'}.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item }) => {
            const emp = employees[item.employeeId];
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.userRow}>
                    <View style={styles.avatar}>
                      {emp?.photo ? (
                        <Image source={{ uri: emp.photo }} style={styles.avatarImg} />
                      ) : (
                        <User size={20} color="#3b82f6" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.traineeName}>{emp ? emp.name : 'Unknown Trainee'}</Text>
                      <Text style={styles.traineeMeta}>
                        {emp?.course || 'OJT Student'} • ID: {emp?.employeeId || item.employeeId}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'present'
                        ? styles.presentBadge
                        : item.status === 'late'
                        ? styles.lateBadge
                        : styles.defaultBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.status === 'present'
                          ? styles.presentBadgeText
                          : item.status === 'late'
                          ? styles.lateBadgeText
                          : styles.defaultBadgeText,
                      ]}
                    >
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Time Grid */}
                <View style={styles.timeGrid}>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeColLabel}>Time In</Text>
                    <Text style={styles.timeColValue}>{item.timeIn || '—'}</Text>
                    {item.timeInLocation ? (
                      <Text style={styles.gpsCoordsText}>
                        {item.timeInLocation.lat.toFixed(4)}, {item.timeInLocation.lng.toFixed(4)}
                      </Text>
                    ) : null}
                    {item.timeInGeofenced ? (
                      <View style={styles.badgeSmall}>
                        <MapPin size={10} color="#16a34a" />
                        <Text style={styles.badgeSmallText}>Inside 300m</Text>
                      </View>
                    ) : item.timeInLocation ? (
                      <View style={[styles.badgeSmall, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                        <MapPin size={10} color="#dc2626" />
                        <Text style={[styles.badgeSmallText, { color: '#dc2626' }]}>Outside Geofence</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.timeCol}>
                    <Text style={styles.timeColLabel}>Time Out</Text>
                    <Text style={styles.timeColValue}>{item.timeOut || '—'}</Text>
                    {item.timeOutLocation ? (
                      <Text style={styles.gpsCoordsText}>
                        {item.timeOutLocation.lat.toFixed(4)}, {item.timeOutLocation.lng.toFixed(4)}
                      </Text>
                    ) : null}
                    {item.timeOutGeofenced ? (
                      <View style={styles.badgeSmall}>
                        <MapPin size={10} color="#16a34a" />
                        <Text style={styles.badgeSmallText}>Inside 300m</Text>
                      </View>
                    ) : item.timeOutLocation ? (
                      <View style={[styles.badgeSmall, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                        <MapPin size={10} color="#dc2626" />
                        <Text style={[styles.badgeSmallText, { color: '#dc2626' }]}>Outside Geofence</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.timeCol}>
                    <Text style={styles.timeColLabel}>Total Hours</Text>
                    <Text style={[styles.timeColValue, { color: '#2563eb', fontWeight: '800' }]}>
                      {item.totalHours ? `${item.totalHours.toFixed(1)} hrs` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Verification Flags */}
                <View style={styles.verificationRow}>
                  {item.timeInFaceVerified && (
                    <View style={styles.verifiedTag}>
                      <ShieldCheck size={14} color="#16a34a" />
                      <Text style={styles.verifiedTagText}>Face Biometrics Verified</Text>
                    </View>
                  )}
                  {emp?.companyName && (
                    <View style={[styles.verifiedTag, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
                      <MapPin size={13} color="#0284c7" />
                      <Text style={[styles.verifiedTagText, { color: '#0369a1' }]}>{emp.companyName}</Text>
                    </View>
                  )}
                  {item.approvalNote ? (
                    <Text style={styles.notesText}>Reason: {item.approvalNote}</Text>
                  ) : item.notes ? (
                    <Text style={styles.notesText}>Note: {item.notes}</Text>
                  ) : null}
                </View>

                {/* DTR APPROVAL ACTION ROW (Matches Test Step & UI Specs) */}
                <View style={styles.approvalSection}>
                  <Text style={styles.approvalHeaderLabel}>DTR Approval Status:</Text>
                  {item.approvalStatus === 'approved' ? (
                    <View style={styles.approvedRow}>
                      <View style={styles.approvedBadge}>
                        <CheckCircle size={15} color="#16a34a" />
                        <Text style={styles.approvedBadgeText}>Approved</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.changeStatusBtn}
                        onPress={() => promptReject(item)}
                        disabled={actionLoadingId === item.id}
                      >
                        <Text style={styles.changeStatusText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : item.approvalStatus === 'disapproved' ? (
                    <View style={styles.disapprovedRow}>
                      <View style={styles.disapprovedBadge}>
                        <AlertCircle size={15} color="#dc2626" />
                        <Text style={styles.disapprovedBadgeText}>Disapproved</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.changeStatusBtn}
                        onPress={() => handleApprove(item)}
                        disabled={actionLoadingId === item.id}
                      >
                        <Text style={[styles.changeStatusText, { color: '#16a34a' }]}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.approvalButtonRow}>
                      <TouchableOpacity
                        style={[
                          styles.btnApprove,
                          actionLoadingId === item.id && { opacity: 0.6 },
                        ]}
                        onPress={() => handleApprove(item)}
                        disabled={actionLoadingId === item.id}
                      >
                        {actionLoadingId === item.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Check size={14} color="#fff" strokeWidth={3} />
                            <Text style={styles.btnApproveText}>Approve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.btnReject,
                          actionLoadingId === item.id && { opacity: 0.6 },
                        ]}
                        onPress={() => promptReject(item)}
                        disabled={actionLoadingId === item.id}
                      >
                        <X size={14} color="#fff" strokeWidth={3} />
                        <Text style={styles.btnRejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Disapproval Reason Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <AlertCircle size={20} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Disapprove DTR Record</Text>
                <Text style={styles.modalSubtitle}>Provide a reason for rejecting this attendance log</Text>
              </View>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Unverified hours, outside company location, missing signature..."
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              numberOfLines={3}
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={submitReject}>
                <Text style={styles.modalSubmitText}>Confirm Disapproval</Text>
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
  header: { marginBottom: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { marginLeft: 6, fontWeight: '700', color: '#0f172a', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  filterSection: { marginBottom: 14, gap: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  dateLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginLeft: 6 },
  dateInput: { flex: 1, fontSize: 13, color: '#0f172a', fontWeight: '600' },
  todayBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  todayBtnText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  statusFilterRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  statusPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  statusPillActiveAmber: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  statusPillActiveGreen: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  statusPillActiveRed: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  statusPillText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  statusPillTextActive: { color: '#fff' },
  statusPillTextActiveAmber: { color: '#92400e', fontWeight: '800' },
  statusPillTextActiveGreen: { color: '#166534', fontWeight: '800' },
  statusPillTextActiveRed: { color: '#991b1b', fontWeight: '800' },
  bulkApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
    marginTop: 2,
  },
  bulkApproveBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  traineeName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  traineeMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  presentBadge: { backgroundColor: '#dcfce7' },
  presentBadgeText: { color: '#16a34a', fontWeight: '800', fontSize: 10 },
  lateBadge: { backgroundColor: '#fef3c7' },
  lateBadgeText: { color: '#d97706', fontWeight: '800', fontSize: 10 },
  defaultBadge: { backgroundColor: '#f1f5f9' },
  defaultBadgeText: { color: '#64748b', fontWeight: '800', fontSize: 10 },
  timeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
  },
  timeCol: { alignItems: 'center', flex: 1 },
  timeColLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  timeColValue: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  gpsCoordsText: { fontSize: 8, color: '#64748b', marginTop: 2 },
  badgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  badgeSmallText: { fontSize: 9, color: '#16a34a', fontWeight: '700' },
  verificationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 6 },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  verifiedTagText: { fontSize: 10, color: '#16a34a', fontWeight: '700' },
  notesText: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 2 },
  approvalSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  approvalHeaderLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  approvalButtonRow: { flexDirection: 'row', gap: 8 },
  btnApprove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  btnApproveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  btnReject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  btnRejectText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  approvedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  approvedBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '800' },
  disapprovedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disapprovedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  disapprovedBadgeText: { color: '#b91c1c', fontSize: 11, fontWeight: '800' },
  changeStatusBtn: { paddingVertical: 4, paddingHorizontal: 6 },
  changeStatusText: { fontSize: 11, color: '#94a3b8', fontWeight: '700' },
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
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalSubtitle: { fontSize: 12, color: '#64748b', marginTop: 1 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 16,
  },
  modalButtonRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  modalSubmitText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
