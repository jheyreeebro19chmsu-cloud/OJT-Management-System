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
import * as FileSystem from 'expo-file-system';

interface HTELinkScreenProps {
  onBack: () => void;
  profile: any;
}

export default function HTELinkScreen({ onBack, profile }: HTELinkScreenProps) {
  const qrRef = React.useRef<any>(null);

  async function handleShare() {
    try {
      if (qrRef.current) {
        // Use the getRef callback from react-native-qrcode-svg to get base64
        qrRef.current.toDataURL(async (data: string) => {
          const filename = `${FileSystem.documentDirectory}hte_link_qr.png`;
          await FileSystem.writeAsStringAsync(filename, data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await Sharing.shareAsync(filename, {
            mimeType: 'image/png',
            dialogTitle: 'Share Access QR Code',
            UTI: 'public.png',
          });
        });
      } else {
        Alert.alert('Ready to Link', 'Share this QR code with your HTE Supervisor. They need to scan it to request access to your records.');
      }
    } catch (error) {
      console.error('Sharing error:', error);
      Alert.alert('Error', 'Failed to share QR code image');
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 40,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
  },
  cardDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  qrWrapper: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
  },
  shareBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    width: '100%',
    padding: 20,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  infoBox: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#fffbeb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#fef3c7',
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '700',
  }
});
