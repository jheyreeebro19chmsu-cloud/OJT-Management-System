import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Clean stale OAuth error params (e.g., bad_oauth_state) from the root/login URL before
// GoTrueClient initializes so the address bar is clean and auth initialization isn't poisoned.
if (typeof window !== 'undefined') {
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
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

