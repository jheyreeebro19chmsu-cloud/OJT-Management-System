import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { X, Lock, RefreshCw } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

interface GoogleAuthModalProps {
  visible: boolean;
  targetRole?: 'trainee' | 'admin' | 'hte';
  onClose: () => void;
  onSuccess: (session: any, user: any, role?: 'trainee' | 'admin' | 'hte') => void;
  onError: (errorMessage: string) => void;
}

const REDIRECT_URI = 'https://chmsuojtmis.site/oauth-callback';

export default function GoogleAuthModal({
  visible,
  targetRole,
  onClose,
  onSuccess,
  onError,
}: GoogleAuthModalProps) {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [handlingCallback, setHandlingCallback] = useState(false);
  const webViewRef = useRef<WebView | null>(null);

  useEffect(() => {
    if (!visible) {
      setAuthUrl(null);
      setLoading(true);
      setHandlingCallback(false);
      return;
    }

    let isMounted = true;

    async function initGoogleOAuth() {
      setLoading(true);
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const origin = window.location.origin;
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${origin}/oauth-callback`,
              queryParams: {
                prompt: 'select_account',
                access_type: 'offline',
              },
            },
          });
          return;
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            skipBrowserRedirect: true,
            redirectTo: REDIRECT_URI,
            queryParams: {
              prompt: 'select_account',
              access_type: 'offline',
            },
          },
        });

        if (error) throw error;
        if (data?.url && isMounted) {
          let targetUrl = data.url;
          if (!targetUrl.includes('prompt=')) {
            targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'prompt=select_account';
          }
          setAuthUrl(targetUrl);
        } else {
          throw new Error('No authorization URL returned from Supabase.');
        }
      } catch (err: any) {
        console.error('Google OAuth init error:', err);
        if (isMounted) {
          onError(err?.message || 'Failed to initialize Google sign-in.');
          onClose();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initGoogleOAuth();

    return () => {
      isMounted = false;
    };
  }, [visible]);

  async function handleNavStateChange(navState: WebViewNavigation) {
    const url = navState.url || '';

    // Check if the URL reached our callback endpoint or contains access tokens
    if (
      url.includes('oauth-callback') ||
      url.includes('access_token=') ||
      url.includes('code=')
    ) {
      if (handlingCallback) return;
      setHandlingCallback(true);

      try {
        // Case 1: Implicit grant with hash fragments (#access_token=...&refresh_token=...)
        const hashPart = url.includes('#') ? url.split('#')[1] : '';
        const searchPart = url.includes('?') ? url.split('?')[1] : '';
        const params = new URLSearchParams(hashPart || searchPart);

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionErr) throw sessionErr;
          if (sessionData?.session && sessionData?.user) {
            onSuccess(sessionData.session, sessionData.user, targetRole);
            onClose();
            return;
          }
        }

        // Case 2: Authorization code grant (?code=...)
        const code = params.get('code');
        if (code) {
          const { data: exchangeData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
          if (exchangeData?.session && exchangeData?.user) {
            onSuccess(exchangeData.session, exchangeData.user, targetRole);
            onClose();
            return;
          }
        }

        // Case 3: Read current session from supabase storage
        const { data: currentSession } = await supabase.auth.getSession();
        if (currentSession?.session?.user) {
          onSuccess(currentSession.session, currentSession.session.user, targetRole);
          onClose();
          return;
        }

        // If tokens weren't parsed from URL immediately, give a brief delay for cookie session
        setTimeout(async () => {
          const { data: delayedSession } = await supabase.auth.getSession();
          if (delayedSession?.session?.user) {
            onSuccess(delayedSession.session, delayedSession.session.user, targetRole);
            onClose();
          } else {
            setHandlingCallback(false);
          }
        }, 1200);
      } catch (err: any) {
        console.error('Failed to parse OAuth tokens:', err);
        setHandlingCallback(false);
        onError(err?.message || 'Failed to complete Google authentication.');
      }
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={handlingCallback}>
            <X size={20} color="#0f172a" />
          </TouchableOpacity>

          <View style={styles.headerTitleRow}>
            <Lock size={14} color="#16a34a" />
            <Text style={styles.headerTitle}>Google Authentication</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Loading Bar */}
        {(loading || handlingCallback) && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingBannerText}>
              {handlingCallback ? 'Verifying Google session...' : 'Connecting to Google Sign-In...'}
            </Text>
          </View>
        )}

        {/* In-app Browser WebView */}
        {authUrl && Platform.OS !== 'web' ? (
          <WebView
            ref={webViewRef}
            source={{ uri: authUrl }}
            style={styles.webView}
            onNavigationStateChange={handleNavStateChange}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
          />
        ) : (
          <View style={styles.webFallbackContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.webFallbackText}>Redirecting to Google Sign-In...</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  loadingBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webFallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webFallbackText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
});
