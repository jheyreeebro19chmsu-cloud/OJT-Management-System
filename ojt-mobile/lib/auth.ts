import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken } from './api';

const ACCESS_KEY = 'dj_access_token';
const REFRESH_KEY = 'dj_refresh_token';

const webStorage = {
  async getItemAsync(key: string) {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItemAsync(key: string, value: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {}
  },
  async deleteItemAsync(key: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {}
  },
};

const storage = Platform.OS === 'web' ? webStorage : SecureStore;

export async function saveTokens(access?: string | null, refresh?: string | null) {
  if (access) await storage.setItemAsync(ACCESS_KEY, access);
  if (refresh) await storage.setItemAsync(REFRESH_KEY, refresh);
  if (!access) await storage.deleteItemAsync(ACCESS_KEY);
  if (!refresh) await storage.deleteItemAsync(REFRESH_KEY);
  setAuthToken(access || null);
}

export async function loadTokens() {
  const access = await storage.getItemAsync(ACCESS_KEY);
  const refresh = await storage.getItemAsync(REFRESH_KEY);
  if (access) setAuthToken(access);
  return { access, refresh };
}

export async function clearTokens() {
  await storage.deleteItemAsync(ACCESS_KEY);
  await storage.deleteItemAsync(REFRESH_KEY);
  setAuthToken(null);
}

export async function refreshAccessToken(apiBaseUrl: string) {
  const refresh = await storage.getItemAsync(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(`${apiBaseUrl}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const access = data.access || data.token || null;
    if (access) {
      await saveTokens(access, refresh);
    }
    return access;
  } catch (e) {
    return null;
  }
}

export default {
  saveTokens,
  loadTokens,
  clearTokens,
  refreshAccessToken,
};
