import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Clock, MapPin, Camera, CheckCircle, ArrowLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import FaceScanner from '../components/FaceScanner';

interface DTRScreenProps {
  onBack: () => void;
  profile: any;
}

export default function DTRScreen({ onBack, profile }: DTRScreenProps) {
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanType, setScanType] = useState<'in' | 'out' | null>(null);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);

  useEffect(() => {
    fetchTodayRecord();
    checkGeofence();
  }, []);

  async function fetchTodayRecord() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('time_records')
      .select('*')
      .eq('employee_id', profile.id)
      .eq('date', today)
      .single();
    
    if (data) setTodayRecord(data);
  }

  async function checkGeofence() {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required for Geofencing.');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    setCurrentLocation(location);

    // Assuming the employee has a registered location from their application
    if (profile.registration_location) {
      const { lat, lng } = profile.registration_location;
      const distance = getDistance(
        location.coords.latitude,
        location.coords.longitude,
        lat,
        lng
      );
      
      // Radius of 300 meters
      setIsWithinGeofence(distance <= 300);
    } else {
      // If no location set, we default to true for development or alert
      setIsWithinGeofence(true); 
    }
  }

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async function handleAction(type: 'in' | 'out') {
    if (!isWithinGeofence) {
      Alert.alert('Out of Range', 'You must be at your assigned OJT location to clock in/out.');
      return;
    }
    setScanType(type);
    setShowScanner(true);
  }

  async function submitAttendance(photo: string) {
    setLoading(true);
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];

      if (scanType === 'in') {
        const { error } = await supabase
          .from('time_records')
          .insert({
            employee_id: profile.id,
            date: today,
            time_in: timeStr,
            time_in_lat: currentLocation?.coords.latitude,
            time_in_lng: currentLocation?.coords.longitude,
            time_in_geofenced: isWithinGeofence,
            time_in_face_verified: true,
            time_in_photo: photo,
            status: 'present'
          });
        if (error) throw error;
      } else {
        // Calculate total hours
        const timeInParts = todayRecord.time_in.split(':');
        const timeInDate = new Date();
        timeInDate.setHours(parseInt(timeInParts[0]), parseInt(timeInParts[1]), parseInt(timeInParts[2]));
        
        const totalHours = (now.getTime() - timeInDate.getTime()) / (1000 * 60 * 60);

        const { error } = await supabase
          .from('time_records')
          .update({
            time_out: timeStr,
            time_out_lat: currentLocation?.coords.latitude,
            time_out_lng: currentLocation?.coords.longitude,
            time_out_geofenced: isWithinGeofence,
            time_out_face_verified: true,
            time_out_photo: photo,
            total_hours: totalHours
          })
          .eq('id', todayRecord.id);
        if (error) throw error;
      }

      Alert.alert('Success', `Successfully clocked ${scanType}!`);
      fetchTodayRecord();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setShowScanner(false);
    }
  }

  if (showScanner) {
    return (
      <FaceScanner 
        onCapture={submitAttendance}
        onCancel={() => setShowScanner(false)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft color="#64748b" size={20} />
        <Text style={styles.backBtnText}>Dashboard</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.subtitle}>Daily Time Record</Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.locationStatus}>
          <MapPin color={isWithinGeofence ? '#16a34a' : '#ef4444'} size={20} />
          <Text style={[styles.locationText, { color: isWithinGeofence ? '#166534' : '#ef4444' }]}>
            {isWithinGeofence ? 'Within OJT Site' : 'Outside OJT Site'}
          </Text>
        </View>
        
        <View style={styles.clockContainer}>
          <Clock color="#2563eb" size={40} />
          <Text style={styles.timeText}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>

        <View style={styles.actionRow}>
          {!todayRecord?.time_in ? (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.timeInBtn]} 
              onPress={() => handleAction('in')}
              disabled={loading}
            >
              <Text style={styles.actionBtnText}>TIME IN</Text>
            </TouchableOpacity>
          ) : !todayRecord?.time_out ? (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.timeOutBtn]} 
              onPress={() => handleAction('out')}
              disabled={loading}
            >
              <Text style={styles.actionBtnText}>TIME OUT</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedBadge}>
              <CheckCircle color="#16a34a" size={24} />
              <Text style={styles.completedText}>Shift Completed Today</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Shift Details</Text>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Time In:</Text>
          <Text style={styles.detailValue}>{todayRecord?.time_in || '--:--'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Time Out:</Text>
          <Text style={styles.detailValue}>{todayRecord?.time_out || '--:--'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Total Hours:</Text>
          <Text style={styles.detailValue}>{todayRecord?.total_hours?.toFixed(2) || '0.00'} hrs</Text>
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
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 24,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    marginBottom: 32,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  clockContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timeText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#1e293b',
    marginTop: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  actionRow: {
    width: '100%',
  },
  actionBtn: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInBtn: {
    backgroundColor: '#2563eb',
  },
  timeOutBtn: {
    backgroundColor: '#1e293b',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 16,
  },
  completedText: {
    color: '#166534',
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    color: '#64748b',
    fontWeight: '600',
  },
  detailValue: {
    color: '#1e293b',
    fontWeight: '700',
  }
});
