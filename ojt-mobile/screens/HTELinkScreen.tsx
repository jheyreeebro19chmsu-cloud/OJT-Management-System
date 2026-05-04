import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Alert,
  ScrollView
} from 'react-native';
import { Share2, ArrowLeft, Building } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';

interface HTELinkScreenProps {
  onBack: () => void;
  profile: any;
}

export default function HTELinkScreen({ onBack, profile }: HTELinkScreenProps) {
  const qrRef = React.useRef<any>(null);

  async function handleShare() {
    try {
      Alert.alert('Ready to Link', 'Share this QR code with your HTE Supervisor. They need to scan it to request access to your records.');
    } catch (error) {
      Alert.alert('Error', 'Failed to share QR code');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft color="#64748b" size={20} />
        <Text style={styles.backBtnText}>Dashboard</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>HTE Access</Text>
        <Text style={styles.subtitle}>Link your Host Training Establishment</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.iconWrapper}>
          <Building color="#2563eb" size={32} />
        </View>
        <Text style={styles.cardTitle}>Share Access QR</Text>
        <Text style={styles.cardDesc}>
          Your supervisor can scan this code to view your attendance and performance records.
        </Text>

        <View style={styles.qrWrapper}>
          <QRCode
            value={`student_access:${profile.id}`}
            size={220}
            getRef={(c) => (qrRef.current = c)}
          />
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Share2 color="#fff" size={20} />
          <Text style={styles.shareBtnText}>Share Link Info</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Note: Your Instructor must approve the HTE request before they can start monitoring your progress.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#f8fafc',
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  cardDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 32,
  },
  shareBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    width: '100%',
    padding: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  infoText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  }
});
