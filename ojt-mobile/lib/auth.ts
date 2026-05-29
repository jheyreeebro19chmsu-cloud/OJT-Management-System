import * as SecureStore from 'expo-secure-store';
import { setAuthToken } from './api';

const ACCESS_KEY = 'dj_access_token';
const REFRESH_KEY = 'dj_refresh_token';

export async function saveTokens(access?: string | null, refresh?: string | null) {
  if (access) await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  if (!access) await SecureStore.deleteItemAsync(ACCESS_KEY);
  if (!refresh) await SecureStore.deleteItemAsync(REFRESH_KEY);
  setAuthToken(access || null);
}

export async function loadTokens() {
  const access = await SecureStore.getItemAsync(ACCESS_KEY);
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (access) setAuthToken(access);
  return { access, refresh };
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  setAuthToken(null);
}

export async function refreshAccessToken(apiBaseUrl: string) {
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
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
