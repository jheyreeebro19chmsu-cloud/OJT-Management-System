import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ArrowLeft, Share2, Copy, Check, QrCode } from 'lucide-react-native';

export default function InstructorQRScreen({
  instructorId,
  instructorName,
  onBack,
}: {
  instructorId: string;
  instructorName: string;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const qrData = JSON.stringify({
    type: 'instructor_enrollment',
    instructorId: instructorId,
    name: instructorName,
  });

  async function handleCopy() {
    setCopied(true);
    Alert.alert('Instructor ID', `Instructor ID: ${instructorId}\n\nStudents can use this ID or scan your QR.`);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Enroll in OJT with ${instructorName || 'your instructor'} using Instructor ID: ${instructorId}`,
      });
    } catch (err: any) {
      Alert.alert('Share error', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft color="#0f172a" size={20} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Instructor QR Code</Text>
        <Text style={styles.subtitle}>Students can scan this code to link their registration</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.qrContainer}>
          <QRCode value={qrData || instructorId || 'OJT-INSTRUCTOR'} size={220} color="#0f172a" backgroundColor="#ffffff" />
        </View>

        <Text style={styles.name}>{instructorName || 'OJT Instructor'}</Text>
        <Text style={styles.label}>INSTRUCTOR ID</Text>
        <Text style={styles.idText} selectable>{instructorId}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            {copied ? <Check size={18} color="#16a34a" /> : <Copy size={18} color="#2563eb" />}
            <Text style={[styles.copyBtnText, copied && { color: '#16a34a' }]}>
              {copied ? 'Copied!' : 'Copy ID'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Share2 size={18} color="#ffffff" />
            <Text style={styles.shareBtnText}>Share Code</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.guideCard}>
        <QrCode size={20} color="#64748b" />
        <Text style={styles.guideText}>
          Tell students to open their OJT Mobile App, navigate to Registration or Scan QR, and point their camera here to automatically link their profile to your class.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20, paddingTop: 50 },
  header: { marginBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { marginLeft: 6, fontWeight: '700', color: '#0f172a', fontSize: 14 },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  name: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  label: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginTop: 12 },
  idText: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 2, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  copyBtnText: { color: '#2563eb', fontWeight: '800', fontSize: 14 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  shareBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  guideCard: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    gap: 12,
    alignItems: 'flex-start',
  },
  guideText: { flex: 1, fontSize: 12, color: '#475569', lineHeight: 18 },
});
