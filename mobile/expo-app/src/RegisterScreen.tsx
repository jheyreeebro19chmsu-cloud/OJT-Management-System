import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Button, Image, Alert, ScrollView, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as yup from 'yup';
import { Formik } from 'formik';
import { BACKEND, API_KEY } from './config';

const schema = yup.object().shape({
  fullName: yup.string().required('Full name is required'),
  age: yup.number().required('Age is required').min(1, 'Age must be >= 1'),
  email: yup.string().email('Invalid email').required('Email required'),
  address: yup.string().required('Address required'),
});

export default function RegisterScreen() {
  const cameraRef = useRef<Camera | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraPerm, setCameraPerm] = useState<boolean | null>(null);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Location permission is required to capture registration location.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    setLocation(loc);
    try {
      const geocoded = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geocoded && geocoded.length > 0) {
        const g = geocoded[0];
        setAddress([g.name, g.street, g.subregion, g.city, g.region, g.country].filter(Boolean).join(', '));
      }
    } catch {
      // ignore reverse geocode error
    }
  };

  const startCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPerm(status === 'granted');
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is required for face/photo registration.');
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
    setPhotoUri(photo.uri);
  };

  const submit = async (values: any) => {
    const payload = {
      fullName: values.fullName,
      age: values.age,
      email: values.email,
      address: values.address || address,
      location: location ? { lat: location.coords.latitude, lng: location.coords.longitude, accuracy: location.coords.accuracy } : undefined,
    };
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    if (photoUri) {
      const filename = photoUri.split('/').pop() || 'photo.jpg';
      form.append('photo', {
        uri: photoUri,
        name: filename,
        type: 'image/jpeg',
      } as any);
    }

    try {
      const res = await fetch(`${BACKEND}/api/mobile/register/`, {
        method: 'POST',
        body: form,
        headers: {
          'X-OJT-API-KEY': API_KEY,
        },
      });
      if (!res.ok) throw new Error('server error');
      Alert.alert('Success', 'Registration submitted');
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Button title="Capture location" onPress={requestLocation} />
      <Text style={styles.help}>{address || 'No address captured'}</Text>

      <Formik
        initialValues={{ fullName: '', age: '', email: '', address: '' }}
        validationSchema={schema}
        onSubmit={submit}
      >
        {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
          <View style={{ width: '100%' }}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput value={values.fullName} onChangeText={handleChange('fullName')} style={styles.input} />
            {touched.fullName && errors.fullName && <Text style={styles.err}>{errors.fullName}</Text>}

            <Text style={styles.label}>Age</Text>
            <TextInput value={values.age} onChangeText={handleChange('age')} keyboardType="numeric" style={styles.input} />
            {touched.age && errors.age && <Text style={styles.err}>{errors.age}</Text>}

            <Text style={styles.label}>Email</Text>
            <TextInput value={values.email} onChangeText={handleChange('email')} keyboardType="email-address" style={styles.input} />
            {touched.email && errors.email && <Text style={styles.err}>{errors.email}</Text>}

            <Text style={styles.label}>Address (press Capture location to auto-fill)</Text>
            <TextInput value={values.address} onChangeText={handleChange('address')} style={styles.input} />
            {touched.address && errors.address && <Text style={styles.err}>{errors.address}</Text>}

            <Button title="Start Camera" onPress={startCamera} />
            {cameraPerm && (
              <View style={{ marginTop: 8 }}>
                <Camera ref={cameraRef} style={{ height: 300 }} ratio="4:3" />
                <Button title="Take Photo" onPress={takePhoto} />
              </View>
            )}
            {photoUri && <Image source={{ uri: photoUri }} style={{ width: 150, height: 150, marginTop: 8 }} />}

            <View style={{ height: 12 }} />
            <Button title="Submit" onPress={() => handleSubmit()} />
          </View>
        )}
      </Formik>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  input: { borderWidth: 1, padding: 8, width: '100%', marginBottom: 8, borderRadius: 6 },
  label: { fontWeight: '600', marginTop: 8 },
  help: { marginVertical: 8, color: '#333' },
  err: { color: 'red', marginBottom: 8 },
});
