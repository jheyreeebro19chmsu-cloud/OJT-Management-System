import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

function isJwtExpired(rawToken: string): boolean {
  try {
    const token = rawToken.replace(/^Bearer\s+/i, '').trim();
    if (!token || token === supabaseAnonKey) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (payload?.role === 'anon' || payload?.role === 'service_role') return false;
    if (typeof payload?.exp === 'number') {
      // Consider expired if current time is past (or within 30s of) exp
      return payload.exp * 1000 <= Date.now() + 30_000;
    }
    return false;
  } catch {
    return false;
  }
}

export function purgeStaleSupabaseAuth(forceAll = false): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        if (forceAll) {
          localStorage.removeItem(key);
          continue;
        }
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const accessToken = parsed?.access_token || parsed?.currentSession?.access_token || '';
          const expiresAt = parsed?.expires_at || parsed?.currentSession?.expires_at || 0;
          if (
            (accessToken && isJwtExpired(accessToken)) ||
            (typeof expiresAt === 'number' && expiresAt > 0 && expiresAt * 1000 <= Date.now() + 30_000)
          ) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
}

const resilientSupabaseFetch: typeof fetch = async (input, init) => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init?.headers || {});
  const authHeader = headers.get('Authorization') || headers.get('authorization') || '';

  // Pre-emptively swap expired user JWT with anon key so PostgREST never returns PGRST303 (JWT expired)
  if (authHeader && supabaseAnonKey && isJwtExpired(authHeader)) {
    purgeStaleSupabaseAuth(true);
    headers.set('Authorization', `Bearer ${supabaseAnonKey}`);
    headers.set('apikey', supabaseAnonKey);
  }

  const nextInit: RequestInit = { ...init, headers };
  const response = await fetch(input, nextInit);

  // If GoTrue token refresh fails with 400, purge stale auth token so it stops looping
  if (response.status === 400 && urlStr.includes('/auth/v1/token')) {
    purgeStaleSupabaseAuth(true);
    return response;
  }

  // If PostgREST or Storage rejects with 401/403 (e.g. PGRST303 JWT expired due to clock skew),
  // purge stale session and immediately retry with the project anon key.
  if (
    (response.status === 401 || response.status === 403) &&
    supabaseAnonKey &&
    (urlStr.includes('/rest/v1/') || urlStr.includes('/storage/v1/'))
  ) {
    const currentAuth = headers.get('Authorization') || '';
    if (currentAuth !== `Bearer ${supabaseAnonKey}`) {
      purgeStaleSupabaseAuth(true);
      const retryHeaders = new Headers(init?.headers || {});
      retryHeaders.set('Authorization', `Bearer ${supabaseAnonKey}`);
      retryHeaders.set('apikey', supabaseAnonKey);
      return fetch(input, { ...init, headers: retryHeaders });
    }
  }

  return response;
};

// Clean stale OAuth error params (e.g., bad_oauth_state) and expired JWT tokens from URL/storage
// before GoTrueClient initializes so the address bar is clean and queries never fail with PGRST303.
if (typeof window !== 'undefined') {
  purgeStaleSupabaseAuth(false);
  try {
    const currentUrl = new URL(window.location.href);
    const searchParams = currentUrl.searchParams;
    const hashRaw = currentUrl.hash.startsWith('#') ? currentUrl.hash.substring(1) : currentUrl.hash;
    const hashParams = new URLSearchParams(hashRaw);

    const urlError = searchParams.get('error') || hashParams.get('error');
    const urlErrorCode = searchParams.get('error_code') || hashParams.get('error_code');
    const urlErrorDesc = searchParams.get('error_description') || hashParams.get('error_description');

    if (urlError || urlErrorCode || urlErrorDesc) {
      sessionStorage.setItem(
        'ojt_oauth_url_error',
        JSON.stringify({
          error: urlError || '',
          errorCode: urlErrorCode || '',
          errorDescription: urlErrorDesc ? decodeURIComponent(urlErrorDesc.replace(/\+/g, ' ')) : '',
          timestamp: Date.now(),
        })
      );

      // Clear any stale PKCE code verifier keys so the next OAuth attempt starts fresh
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.includes('code-verifier')) {
          localStorage.removeItem(key);
        }
      }

      if (!currentUrl.pathname.startsWith('/oauth-callback')) {
        searchParams.delete('error');
        searchParams.delete('error_code');
        searchParams.delete('error_description');
        const cleanSearch = searchParams.toString();
        const cleanUrl = `${currentUrl.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  } catch {
    // Ignore URL parsing errors
  }
}

// Create Supabase client only if configured
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: resilientSupabaseFetch,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

