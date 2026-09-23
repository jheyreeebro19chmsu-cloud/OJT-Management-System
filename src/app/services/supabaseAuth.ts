import { supabase } from '../lib/supabase';

// Initiate Google OAuth (redirect)
export async function signInWithGoogle(redirectTo?: string) {
  const options = redirectTo ? { redirectTo } : undefined;
  return supabase.auth.signInWithOAuth({ provider: 'google', options });
}

// Parse the OAuth callback URL and return session + user
export async function handleOAuthCallback() {
  try {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const error = searchParams.get('error') || hashParams.get('error');
      const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');
      if (error || errorDesc) {
        return { data: null, error: new Error(errorDesc || error || 'OAuth error') };
      }

      const code = searchParams.get('code');
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data?.session) {
          return { data, error: null };
        }
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error && data?.session) {
          return { data, error: null };
        }
      }
    }

    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export default { signInWithGoogle, handleOAuthCallback, signOut, getUser };
