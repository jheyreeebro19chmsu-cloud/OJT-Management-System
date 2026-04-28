import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import RegisterScreen from './src/RegisterScreen';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <RegisterScreen />
    </SafeAreaView>
  );
}
