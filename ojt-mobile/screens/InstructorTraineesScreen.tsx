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
  Linking,
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
  Edit2,
} from 'lucide-react-native';
import { mobileDb, Employee, TimeRecord } from '../lib/supabaseService';
import { supabase } from '../lib/supabase';

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
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [selectedTrainee, setSelectedTrainee] = useState<Employee | null>(null);
  const [hteList, setHteList] = useState<any[]>([]);
  const [showHteModal, setShowHteModal] = useState(false);

  useEffect(() => {
    fetchData();

    // Real-time listener for live attendance and hours rendered
    const channel = supabase
      .channel('instructor-trainees-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_records' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, activeAcademicYear]);

  async function fetchData() {
    setLoading(true);
    try {
      const instructorId = profile?.id || profile?.employeeId || '';
      const [list, records, htesRes] = await Promise.all([
        mobileDb.getTraineesByInstructor(instructorId, activeAcademicYear),
        mobileDb.getTimeRecords(undefined, activeAcademicYear),
        supabase.from('employees').select('*').or('role.eq.hte,position.ilike.%hte%'),
      ]);
      setTrainees(list);
      setTimeRecords(records);
      setHteList(htesRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load trainees');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeHte(selectedHte: any) {
    if (!selectedTrainee) return;
    try {
      setLoading(true);
      const hteAddress =
        selectedHte.company_address ||
        selectedHte.companyAddress ||
        selectedHte.registration_address ||
        selectedHte.registrationAddress ||
        `${selectedHte.company_name || selectedHte.companyName} Workplace Premises`;
      const regLoc =
        selectedHte.registration_location ||
        selectedHte.registrationLocation ||
        { lat: 10.7412, lng: 122.9691 };
      const radius = Math.max(
        40,
        Number(selectedHte.registration_radius || selectedHte.registrationRadius || regLoc?.radius || 40)
      );
      const companyName = selectedHte.company_name || selectedHte.companyName;

      await supabase.from('employees').update({
        hte_id: selectedHte.id,
        company_name: companyName,
        company_address: hteAddress,
        registration_address: hteAddress,
        supervisor_name: selectedHte.name,
        registration_location: {
          lat: Number(regLoc.lat),
          lng: Number(regLoc.lng),
          radius,
        },
        registration_radius: radius,
      }).eq('id', selectedTrainee.id);

      const zoneId = `station-${selectedTrainee.id}`;
      await supabase.from('geofence_zones').upsert([{
        id: zoneId,
        name: `${selectedTrainee.name} - Trainee Geofence (${companyName})`,
        address: hteAddress,
        lat: Number(regLoc.lat),
        lng: Number(regLoc.lng),
        radius,
        active: true,
        academic_year: selectedTrainee.academicYear || activeAcademicYear,
      }]);

      Alert.alert('Success', `Directly changed ${selectedTrainee.name}'s assigned workplace to ${companyName}!`);
      setShowHteModal(false);
      fetchData();
      setSelectedTrainee((prev: any) => prev ? {
        ...prev,
        hteId: selectedHte.id,
        companyName,
        companyAddress: hteAddress,
        registrationAddress: hteAddress,
        registrationLocation: {
          lat: Number(regLoc.lat),
          lng: Number(regLoc.lng),
          radius,
        },
      } : null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change HTE workplace');
    } finally {
      setLoading(false);
    }
  }

  function getTraineeStats(t: Employee) {
    const ids = new Set<string>();
    if (t.id) ids.add(t.id);
    if (t.employeeId) ids.add(t.employeeId);
    if (t.email) ids.add(t.email.toLowerCase());

    const recs = timeRecords.filter(
      (r) =>
        ids.has(r.employeeId) ||
        (r.employeeId && ids.has(r.employeeId.toLowerCase()))
    );
    const total = Math.round(recs.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0) * 10) / 10;
    const req = t.requiredHours || 486;
    const percent = Math.min(100, Math.round((total / req) * 100));
    const today = new Date().toISOString().split('T')[0];
    const todayRec = recs.find((r) => r.date === today);
    return { total, req, percent, recs, todayRec };
  }

  async function handleApprove(trainee: Employee) {
    try {
      setLoading(true);
      const ok = await mobileDb.updateEmployee(trainee.id, { applicationStatus: 'approved' });
      if (ok) {
        Alert.alert('Success', `${trainee.name}'s OJT application has been approved.`);
        fetchData();
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
        fetchData();
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
        <Text style={styles.subtitle}>Real-time student hours, attendance & placement</Text>
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
          renderItem={({ item }) => {
            const stats = getTraineeStats(item);
            return (
              <TouchableOpacity style={styles.card} onPress={() => setSelectedTrainee(item)}>
                <View style={styles.cardTopRow}>
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
                </View>

                {/* Real-time Rendered Hours Progress Bar */}
                <View style={styles.hoursContainer}>
                  <View style={styles.hoursRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} color="#2563eb" />
                      <Text style={styles.hoursLabel}>
                        <Text style={styles.hoursBold}>{stats.total}</Text> / {stats.req} hrs rendered
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {stats.todayRec?.timeIn && (
                        <View style={[styles.liveDot, { backgroundColor: stats.todayRec?.timeOut ? '#94a3b8' : '#16a34a' }]} />
                      )}
                      <Text style={styles.hoursPercent}>{stats.percent}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${stats.percent}%` }]} />
                  </View>
                </View>

                {/* GPS and Location Chips */}
                <View style={{ marginTop: 8 }}>
                  {item.registrationLocation ? (
                    <View style={styles.geofenceChip}>
                      <MapPin size={10} color="#0284c7" />
                      <Text style={styles.geofenceChipText}>
                        GPS: {item.registrationLocation.lat.toFixed(4)}, {item.registrationLocation.lng.toFixed(4)} ({Math.max(40, Number(item.registrationLocation?.radius || 40))}m)
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.geofenceChip, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                      <MapPin size={10} color="#94a3b8" />
                      <Text style={[styles.geofenceChipText, { color: '#64748b' }]}>GPS Unset</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Trainee Detail & Approval Modal */}
      {selectedTrainee && (() => {
        const modalStats = getTraineeStats(selectedTrainee);
        const remainingHours = Math.max(0, Math.round((modalStats.req - modalStats.total) * 10) / 10);
        return (
          <Modal animationType="slide" transparent visible={Boolean(selectedTrainee)}>
            <View style={styles.modalOverlay}>
              <ScrollView contentContainerStyle={{ paddingVertical: 20 }}>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Trainee Profile & Hours</Text>
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

                  {/* Real-time OJT Rendered Hours Card */}
                  <View style={styles.hoursModalBox}>
                    <View style={styles.hoursModalHeader}>
                      <Clock size={16} color="#2563eb" />
                      <Text style={styles.hoursModalTitle}>Real-Time OJT Hours Rendered</Text>
                      <Text style={styles.hoursModalBadge}>{modalStats.percent}% Done</Text>
                    </View>
                    <View style={styles.hoursStatsGrid}>
                      <View style={styles.hoursStatCol}>
                        <Text style={styles.hoursStatVal}>{modalStats.total}h</Text>
                        <Text style={styles.hoursStatLbl}>Rendered</Text>
                      </View>
                      <View style={styles.hoursStatCol}>
                        <Text style={styles.hoursStatVal}>{remainingHours}h</Text>
                        <Text style={styles.hoursStatLbl}>Remaining</Text>
                      </View>
                      <View style={styles.hoursStatCol}>
                        <Text style={styles.hoursStatVal}>{modalStats.req}h</Text>
                        <Text style={styles.hoursStatLbl}>Required</Text>
                      </View>
                    </View>
                    <View style={[styles.progressBarBg, { marginTop: 10, height: 8 }]}>
                      <View style={[styles.progressBarFill, { width: `${modalStats.percent}%`, height: 8 }]} />
                    </View>
                    <View style={styles.todayAttendanceRow}>
                      <View style={[styles.liveDot, { backgroundColor: modalStats.todayRec?.timeIn ? (modalStats.todayRec?.timeOut ? '#94a3b8' : '#16a34a') : '#cbd5e1' }]} />
                      <Text style={styles.todayAttendanceText}>
                        {modalStats.todayRec?.timeIn
                          ? modalStats.todayRec?.timeOut
                            ? `Clocked Out Today (${modalStats.todayRec.totalHours || 0} hrs rendered)`
                            : `Currently Clocked In (${modalStats.todayRec.timeIn})`
                          : 'No attendance recorded today'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailGrid}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Email:</Text>
                      <Text style={styles.detailValue}>{selectedTrainee.email}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Student ID:</Text>
                      <Text style={styles.detailValue}>{selectedTrainee.employeeId}</Text>
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
                                <FileText size={11} color="#d97706" />
                              )}
                              <Text
                                style={[
                                  styles.docStatusPillText,
                                  isPassed ? styles.docStatusPillTextPassed : styles.docStatusPillTextPending,
                                ]}
                              >
                                {isPassed ? 'PASSED' : 'PENDING'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Quick Toggle 4/4 Passed Button */}
                    <TouchableOpacity
                      style={[
                        styles.toggleDocsBtn,
                        selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending'
                          ? styles.toggleDocsBtnRevoke
                          : styles.toggleDocsBtnApprove,
                      ]}
                      onPress={async () => {
                        const currentPassed = selectedTrainee.documentsPassed !== false && selectedTrainee.documentsStatus !== 'pending';
                        const newStatus = currentPassed ? 'pending' : 'passed';
                        const newPassed = !currentPassed;

                        await mobileDb.updateEmployee(selectedTrainee.id, {
                          documentsPassed: newPassed,
                          documentsStatus: newStatus,
                        });

                        const updatedTrainee = {
                          ...selectedTrainee,
                          documentsPassed: newPassed,
                          documentsStatus: newStatus,
                        };
                        setSelectedTrainee(updatedTrainee);
                        setTrainees((prev) =>
                          prev.map((t) => (t.id === selectedTrainee.id ? updatedTrainee : t))
                        );
                        Alert.alert(
                          newPassed ? 'Documents Approved' : 'Approval Revoked',
                          newPassed
                            ? `All 4 standard documents for ${selectedTrainee.name} are marked as PASSED.`
                            : `Document approval status for ${selectedTrainee.name} set back to PENDING.`
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
                        <Text style={[styles.detailValue, { fontFamily: 'serif', color: '#0369a1' }]}>
                          {selectedTrainee.registrationLocation
                            ? `${selectedTrainee.registrationLocation.lat.toFixed(6)}, ${selectedTrainee.registrationLocation.lng.toFixed(6)}`
                            : 'Not Set'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Geofence Radius:</Text>
                        <Text style={styles.detailValue}>
                          {Math.max(40, Number(selectedTrainee.registrationLocation?.radius || (selectedTrainee as any)?.registration_radius || 40))} Meters (±40m min)
                        </Text>
                      </View>
                      {selectedTrainee.registrationLocation && (
                        <TouchableOpacity
                          style={styles.openMapBtn}
                          onPress={() => {
                            const url = `https://www.google.com/maps?q=${selectedTrainee.registrationLocation?.lat},${selectedTrainee.registrationLocation?.lng}`;
                            Linking.openURL(url);
                          }}
                        >
                          <MapPin size={12} color="#0284c7" />
                          <Text style={styles.openMapBtnText}>View Workplace Pin on Google Maps</Text>
                        </TouchableOpacity>
                      )}
                      <View style={styles.geofenceStatusRow}>
                        <ShieldCheck size={14} color="#059669" />
                        <Text style={styles.geofenceStatusText}>
                          Attendance is restricted to this {Math.max(40, Number(selectedTrainee.registrationLocation?.radius || (selectedTrainee as any)?.registration_radius || 40))}m workplace boundary.
                        </Text>
                      </View>

                      {/* Direct HTE Workplace Assignment Button */}
                      <TouchableOpacity
                        style={styles.changeHteBtn}
                        onPress={() => setShowHteModal(true)}
                      >
                        <Building size={14} color="#fff" />
                        <Text style={styles.changeHteBtnText}>
                          {selectedTrainee.companyName && !selectedTrainee.companyName.toLowerCase().includes('pending')
                            ? 'Change Assigned HTE Workplace'
                            : 'Assign HTE Workplace'}
                        </Text>
                      </TouchableOpacity>
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
              </ScrollView>
            </View>
          </Modal>

          {/* HTE Selection Modal */}
          <Modal
            visible={showHteModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowHteModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Building size={20} color="#b45309" />
                    <Text style={[styles.modalTitle, { fontSize: 18 }]}>Select HTE Workplace</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowHteModal(false)} style={styles.closeBtn}>
                    <XCircle size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  Assign Host Training Establishment for {selectedTrainee?.name}. Workplace geofence coordinates and station will sync directly.
                </Text>

                <ScrollView style={{ flex: 1 }}>
                  {hteList.map((hte) => {
                    const cName = hte.company_name || hte.companyName;
                    const isSelected = selectedTrainee?.companyName === cName;
                    const loc = hte.registration_location || hte.registrationLocation;

                    return (
                      <TouchableOpacity
                        key={hte.id}
                        style={[
                          styles.hteListItem,
                          isSelected && { borderColor: '#b45309', backgroundColor: '#fffbeb' },
                        ]}
                        onPress={() => handleChangeHte(hte)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '800', fontSize: 14, color: '#0f172a' }}>{cName}</Text>
                          <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            Supervisor: {hte.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }} numberOfLines={1}>
                            📍 {hte.company_address || hte.registration_address || 'Workplace Premises'}
                          </Text>
                          {loc?.lat && loc?.lng && (
                            <Text style={{ fontSize: 10, color: '#0284c7', marginTop: 2, fontFamily: 'serif' }}>
                              GPS: {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)} ({Math.max(40, Number(loc.radius || 40))}m)
                            </Text>
                          )}
                        </View>
                        <View style={[styles.hteSelectBadge, isSelected && { backgroundColor: '#b45309' }]}>
                          <Text style={{ color: isSelected ? '#fff' : '#475569', fontSize: 11, fontWeight: '700' }}>
                            {isSelected ? 'Assigned' : 'Select'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {hteList.length === 0 && (
                    <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 24, fontSize: 13 }}>
                      No registered HTE establishments found.
                    </Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })()}
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
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  name: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 1 },
  submeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  hoursContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  hoursLabel: { fontSize: 11, color: '#64748b' },
  hoursBold: { fontWeight: '800', color: '#0f172a' },
  hoursPercent: { fontSize: 11, fontWeight: '800', color: '#2563eb' },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 2 },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  hoursModalBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 14,
  },
  hoursModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  hoursModalTitle: { fontSize: 13, fontWeight: '800', color: '#1e40af', flex: 1 },
  hoursModalBadge: { fontSize: 11, fontWeight: '800', color: '#2563eb', backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  hoursStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
  },
  hoursStatCol: { alignItems: 'center', flex: 1 },
  hoursStatVal: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  hoursStatLbl: { fontSize: 10, fontWeight: '700', color: '#64748b', marginTop: 1 },
  todayAttendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
  },
  todayAttendanceText: { fontSize: 11, fontWeight: '700', color: '#1e3a8a' },
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
  openMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginVertical: 4,
  },
  openMapBtnText: { fontSize: 11, fontWeight: '800', color: '#0284c7' },
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
  changeHteBtn: {
    backgroundColor: '#b45309',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: 8,
  },
  changeHteBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  hteListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  hteSelectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginLeft: 8,
  },
});
