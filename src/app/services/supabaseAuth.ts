import { supabase } from '../lib/supabase';

// Initiate Google OAuth (redirect)
export async function signInWithGoogle(redirectTo?: string) {
  const options = redirectTo ? { redirectTo } : undefined;
  return supabase.auth.signInWithOAuth({ provider: 'google', options });
}

// Parse the OAuth callback URL and return session + user
export async function handleOAuthCallback() {
  // supabase v2: getSessionFromUrl
  try {
    const { data } = await supabase.auth.getSession();
    return { data, error: null };
  } catch (err) {
    return { error: err };
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
