import './lib/typography';
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Globe } from 'lucide-react-native';
import { WebShell } from './components/WebShell';
import NativeApp from './NativeApp';

export default function App() {
  const [appMode, setAppMode] = useState<'web' | 'native'>('web');

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {appMode === 'web' ? (
        <WebShell onSwitchToNative={() => setAppMode('native')} />
      ) : (
        <View style={styles.container}>
          {/* Top Bar allowing user to switch back to Web view */}
          <View style={styles.nativeTopBanner}>
            <Text style={styles.bannerText}>Offline / Native Mode Active</Text>
            <TouchableOpacity
              onPress={() => setAppMode('web')}
              style={styles.switchButton}
              accessibilityLabel="Switch to Full Web Experience"
            >
              <Globe size={13} color="#ffffff" />
              <Text style={styles.switchButtonText}>Open Web App</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            <NativeApp onSwitchToWeb={() => setAppMode('web')} />
          </View>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  nativeTopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1e3a8a',
  },
  bannerText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  switchButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});
