import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  Clock,
  ShieldCheck,
  Building,
  Award,
  FileCheck,
  FileText,
} from 'lucide-react-native';
import { mobileDb, Employee } from '../lib/supabaseService';

export default function InstructorTraineesScreen({
  profile,
  activeAcademicYear,
  onBack,
}: {
  profile: any;
  activeAcademicYear?: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [trainees, setTrainees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [selectedTrainee, setSelectedTrainee] = useState<Employee | null>(null);

  useEffect(() => {
    fetchTrainees();
  }, [profile, activeAcademicYear]);

  async function fetchTrainees() {
    setLoading(true);
    try {
      const instructorId = profile?.id || profile?.employeeId || '';
      const list = await mobileDb.getTraineesByInstructor(instructorId, activeAcademicYear);
      setTrainees(list);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load trainees');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(trainee: Employee) {
    try {
      setLoading(true);
      const ok = await mobileDb.updateEmployee(trainee.id, { applicationStatus: 'approved' });
      if (ok) {
        Alert.alert('Success', `${trainee.name}'s OJT application has been approved.`);
        fetchTrainees();
        setSelectedTrainee(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(trainee: Employee) {
    try {
      setLoading(true);
      const ok = await mobileDb.updateEmployee(trainee.id, { applicationStatus: 'rejected' });
      if (ok) {
        Alert.alert('Rejected', `${trainee.name}'s OJT application has been marked as rejected.`);
        fetchTrainees();
        setSelectedTrainee(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject');
    } finally {
      setLoading(false);
    }
  }

  const filteredTrainees = trainees.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = t.name.toLowerCase().includes(q) || t.employeeId.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && t.applicationStatus === 'pending') ||
      (statusFilter === 'approved' && t.applicationStatus === 'approved');
    return matchesQuery && matchesStatus;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft color="#0f172a" size={20} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Enrolled Trainees</Text>
        <Text style={styles.subtitle}>Manage student approvals, hours & placement</Text>
      </View>

      {/* Search & Status Filters */}
      <View style={styles.searchBar}>
        <Search size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student name or ID..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'pending', 'approved'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextActive]}>
              {filter.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Trainees List */}
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : filteredTrainees.length === 0 ? (
        <View style={styles.emptyCard}>
          <User size={36} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No trainees found</Text>
          <Text style={styles.emptyDesc}>No students match your filter criteria.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTrainees}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelectedTrainee(item)}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.avatarImg} />
                  ) : (
                    <User size={20} color="#2563eb" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.course || 'Student'} • ID: {item.employeeId}
                  </Text>
                  <Text style={styles.submeta}>{item.companyName || 'No HTE Assigned'}</Text>
                  {item.registrationLocation ? (
                    <View style={styles.geofenceChip}>
                      <MapPin size={10} color="#0284c7" />
                      <Text style={styles.geofenceChipText}>
                        GPS: {item.registrationLocation.lat.toFixed(4)}, {item.registrationLocation.lng.toFixed(4)} (300m)
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.geofenceChip, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                      <MapPin size={10} color="#94a3b8" />
                      <Text style={[styles.geofenceChipText, { color: '#64748b' }]}>GPS Unset</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {item.documentsPassed !== false && item.documentsStatus !== 'pending' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 3, borderWidth: 1, borderColor: '#a7f3d0' }}>
                    <FileCheck size={10} color="#059669" />
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#059669' }}>DOCS: PASSED</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 3, borderWidth: 1, borderColor: '#fde68a' }}>
                    <FileText size={10} color="#d97706" />
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#d97706' }}>DOCS: PENDING</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.statusBadge,
                    item.applicationStatus === 'approved' ? styles.badgeApproved : styles.badgePending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      item.applicationStatus === 'approved' ? styles.statusTextApproved : styles.statusTextPending,
                    ]}
                  >
                    {item.applicationStatus?.toUpperCase() || 'ENROLLED'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Trainee Detail & Approval Modal */}
      {selectedTrainee && (
        <Modal animationType="slide" transparent visible={Boolean(selectedTrainee)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Trainee Details</Text>
                <TouchableOpacity onPress={() => setSelectedTrainee(null)}>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.profileSummary}>
                <View style={styles.modalAvatar}>
                  {selectedTrainee.photo ? (
                    <Image source={{ uri: selectedTrainee.photo }} style={styles.avatarImg} />
                  ) : (
                    <User size={30} color="#2563eb" />
                  )}
                </View>
                <Text style={styles.modalName}>{selectedTrainee.name}</Text>
                <Text style={styles.modalCourse}>{selectedTrainee.course}</Text>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailValue}>{selectedTrainee.email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Required Hours:</Text>
                  <Text style={styles.detailValue}>{selectedTrainee.requiredHours} hrs</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Host Establishment:</Text>
                  <Text style={styles.detailValue}>{selectedTrainee.companyName || 'Not Assigned'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Face Biometrics:</Text>
                  <Text style={styles.detailValue}>
                    {selectedTrainee.faceRegistered ? 'Registered' : 'Not Registered'}
                  </Text>
                </View>
              </View>

              {/* 4 Standard Required OJT Documents Monitoring Card */}
              <View style={styles.docsMonitoringCard}>
                <View style={styles.docsCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docsCardTitle}>Required OJT Documents</Text>
                    <Text style={styles.docsCardSub}>4 Standard compliance documents</Text>
                  </View>
                  <View
                    style={[
                      styles.docsBadge,
                      selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending'
                        ? styles.docsBadgePassed
                        : styles.docsBadgePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.docsBadgeText,
                        selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending'
                          ? styles.docsBadgeTextPassed
                          : styles.docsBadgeTextPending,
                      ]}
                    >
                      {selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending'
                        ? '4/4 Passed'
                        : 'Pending Docs'}
                    </Text>
                  </View>
                </View>

                {/* 4 Standard Documents List */}
                <View style={styles.docsList}>
                  {[
                    { id: '1', title: '1. Endorsement Letter', desc: 'Department Chair recommendation' },
                    { id: '2', title: '2. Parental Consent Form', desc: 'Signed guardian authorization' },
                    { id: '3', title: '3. Medical Certificate', desc: 'Physician fit-to-work clearance' },
                    { id: '4', title: '4. Student Bio-data / Resume', desc: 'Updated CV & photo' },
                  ].map((doc) => {
                    const isPassed = selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending';
                    return (
                      <View key={doc.id} style={styles.docItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docItemTitle}>{doc.title}</Text>
                          <Text style={styles.docItemDesc}>{doc.desc}</Text>
                        </View>
                        <View
                          style={[
                            styles.docStatusPill,
                            isPassed ? styles.docStatusPillPassed : styles.docStatusPillPending,
                          ]}
                        >
                          {isPassed ? (
                            <FileCheck size={11} color="#059669" />
                          ) : (
                            <Clock size={11} color="#d97706" />
                          )}
                          <Text
                            style={[
                              styles.docStatusPillText,
                              isPassed ? styles.docStatusPillTextPassed : styles.docStatusPillTextPending,
                            ]}
                          >
                            {isPassed ? 'Verified' : 'Submitted'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Toggle All Documents Approval Button */}
                <TouchableOpacity
                  style={[
                    styles.toggleDocsBtn,
                    selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending'
                      ? styles.toggleDocsBtnRevoke
                      : styles.toggleDocsBtnApprove,
                  ]}
                  onPress={async () => {
                    const newStatus = selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending' ? false : true;
                    await mobileDb.updateEmployee(selectedTrainee.id, {
                      documentsPassed: newStatus,
                      documentsStatus: newStatus ? 'passed' : 'pending',
                    });
                    setSelectedTrainee({
                      ...selectedTrainee,
                      documentsPassed: newStatus,
                      documentsStatus: newStatus ? 'passed' : 'pending',
                    });
                    fetchTrainees();
                    Alert.alert(
                      'Documents Status Updated',
                      newStatus ? 'All 4 standard documents marked as PASSED.' : 'Documents marked as PENDING verification.'
                    );
                  }}
                >
                  <FileCheck size={14} color={selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending' ? '#b91c1c' : '#15803d'} />
                  <Text
                    style={[
                      styles.toggleDocsBtnText,
                      selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending'
                        ? { color: '#b91c1c' }
                        : { color: '#15803d' },
                    ]}
                  >
                    {selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending'
                      ? 'Revoke Document Approval'
                      : '✓ Approve All 4 Standard Documents'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Geofencing & Workplace Location Box */}
              <View style={styles.geofenceBox}>
                <View style={styles.geofenceHeader}>
                  <MapPin size={16} color="#0284c7" />
                  <Text style={styles.geofenceTitle}>Geofencing & Workplace Location</Text>
                </View>
                <View style={styles.geofenceBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Workplace:</Text>
                    <Text style={styles.detailValue}>{selectedTrainee.companyName || 'Not Assigned'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Location Address:</Text>
                    <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                      {selectedTrainee.registrationAddress || 'Registered Location'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>GPS Coordinates:</Text>
                    <Text style={[styles.detailValue, { fontFamily: 'monospace', color: '#0369a1' }]}>
                      {selectedTrainee.registrationLocation
                        ? `${selectedTrainee.registrationLocation.lat.toFixed(6)}, ${selectedTrainee.registrationLocation.lng.toFixed(6)}`
                        : 'Not Set'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Geofence Radius:</Text>
                    <Text style={styles.detailValue}>300 Meters</Text>
                  </View>
                  <View style={styles.geofenceStatusRow}>
                    <ShieldCheck size={14} color="#059669" />
                    <Text style={styles.geofenceStatusText}>
                      Attendance is restricted to this 300m workplace boundary.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Approval Actions */}
              <View style={styles.modalActions}>
                {selectedTrainee.applicationStatus !== 'approved' && (
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#16a34a' }]}
                    onPress={() => handleApprove(selectedTrainee)}
                  >
                    <CheckCircle size={18} color="#fff" />
                    <Text style={styles.modalBtnText}>Approve Application</Text>
                  </TouchableOpacity>
                )}
                {selectedTrainee.applicationStatus !== 'rejected' && (
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#dc2626' }]}
                    onPress={() => handleReject(selectedTrainee)}
                  >
                    <XCircle size={18} color="#fff" />
                    <Text style={styles.modalBtnText}>Reject Application</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0f172a' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterChipText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  filterChipTextActive: { color: '#ffffff' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  name: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 1 },
  submeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  badgeApproved: { backgroundColor: '#dcfce7' },
  statusTextApproved: { color: '#16a34a', fontSize: 10, fontWeight: '800' },
  badgePending: { backgroundColor: '#fef3c7' },
  statusTextPending: { color: '#d97706', fontSize: 10, fontWeight: '800' },
  emptyCard: { backgroundColor: '#fff', padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 10 },
  emptyDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  closeText: { color: '#64748b', fontWeight: '700' },
  profileSummary: { alignItems: 'center', marginBottom: 20 },
  modalAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10 },
  modalName: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  modalCourse: { fontSize: 13, color: '#64748b', marginTop: 2 },
  detailGrid: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 14, gap: 8, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  detailValue: { fontSize: 13, color: '#0f172a', fontWeight: '800' },
  geofenceChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4, marginTop: 4, borderWidth: 1, borderColor: '#bae6fd', alignSelf: 'flex-start' },
  geofenceChipText: { fontSize: 10, fontWeight: '700', color: '#0284c7' },
  geofenceBox: { backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0', padding: 12, marginBottom: 16 },
  geofenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  geofenceTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  geofenceBody: { gap: 6 },
  geofenceStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#dcfce7' },
  geofenceStatusText: { fontSize: 11, fontWeight: '700', color: '#15803d', flex: 1 },
  docsMonitoringCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    padding: 12,
    marginBottom: 12,
  },
  docsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
    paddingBottom: 8,
  },
  docsCardTitle: { fontSize: 13, fontWeight: '800', color: '#581c87' },
  docsCardSub: { fontSize: 10, color: '#7e22ce', marginTop: 1 },
  docsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  docsBadgePassed: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  docsBadgePending: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
  docsBadgeText: { fontSize: 10, fontWeight: '800' },
  docsBadgeTextPassed: { color: '#059669' },
  docsBadgeTextPending: { color: '#d97706' },
  docsList: { gap: 6, marginBottom: 10 },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
  docItemTitle: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  docItemDesc: { fontSize: 9, color: '#64748b', marginTop: 1 },
  docStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  docStatusPillPassed: { backgroundColor: '#ecfdf5' },
  docStatusPillPending: { backgroundColor: '#fffbeb' },
  docStatusPillText: { fontSize: 9, fontWeight: '800' },
  docStatusPillTextPassed: { color: '#059669' },
  docStatusPillTextPending: { color: '#d97706' },
  toggleDocsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleDocsBtnApprove: { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0' },
  toggleDocsBtnRevoke: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  toggleDocsBtnText: { fontSize: 11, fontWeight: '800' },
  modalActions: { gap: 10 },
  modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
