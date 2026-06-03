import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const webStorage = {
  async getItem(key: string) {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {}
  },
  async removeItem(key: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {}
  },
};

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => (Platform.OS === 'web' ? webStorage.getItem(key) : SecureStore.getItemAsync(key)),
  setItem: (key: string, value: string) =>
    Platform.OS === 'web' ? webStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    Platform.OS === 'web' ? webStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

const supabaseUrl = 'https://wooighmdckuoebsuegzz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTE4MDcsImV4cCI6MjA4ODI2NzgwN30.ETVnzajdLNdezhh-lraSrubf1MC--VSyKKV3KUh9vWk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
