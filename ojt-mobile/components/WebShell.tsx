import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type {
  WebViewNavigation,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { RefreshCw, WifiOff } from 'lucide-react-native';

const WEB_APP_URL = 'https://chmsuojtmis.site';

interface WebShellProps {
  onSwitchToNative?: () => void;
}

export function WebShell({ onSwitchToNative }: WebShellProps) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [key, setKey] = useState(0);

  // 1. Request Native Camera & Location Permissions upon app start
  useEffect(() => {
    (async () => {
      try {
        const [camStatus, locStatus] = await Promise.all([
          Camera.requestCameraPermissionsAsync().catch(() => null),
          Location.requestForegroundPermissionsAsync().catch(() => null),
        ]);

        if (camStatus && !camStatus.granted) {
          console.warn('[WebShell] Camera permission not granted at OS level.');
        }
        if (locStatus && !locStatus.granted) {
          console.warn('[WebShell] Location permission not granted at OS level.');
        }
      } catch (err) {
        console.warn('[WebShell] Permission request error:', err);
      }
    })();
  }, []);

  // 2. Hardware back button handling for Android
  const handleBackPress = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => sub.remove();
    }
  }, [handleBackPress]);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  const handleReload = () => {
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    setKey((prev) => prev + 1);
  };

  const handleError = (syntheticEvent: WebViewErrorEvent | WebViewHttpErrorEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('[WebShell] WebView error:', nativeEvent);
    setHasError(true);
    setErrorMessage(
      (nativeEvent as any).description || 'Could not connect to the CHMSU OJT server. Please check your internet connection.'
    );
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />



      {/* Main WebView Container */}
      <View style={styles.webViewWrapper}>
        <WebView
          key={key}
          ref={webViewRef}
          source={{ uri: WEB_APP_URL }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          geolocationEnabled={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={handleError}
          onHttpError={handleError}
          {...({
            onPermissionRequest: (request: any) => {
              if (request && typeof request.grant === 'function') {
                request.grant(request.resources);
              }
            },
          } as any)}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Connecting to CHMSU OJT Management System...</Text>
            </View>
          )}
        />

        {/* Connection Error Screen */}
        {hasError && (
          <View style={styles.errorOverlay}>
            <View style={styles.errorCard}>
              <View style={styles.errorIconCircle}>
                <WifiOff size={32} color="#dc2626" />
              </View>
              <Text style={styles.errorTitle}>Connection Failed</Text>
              <Text style={styles.errorDesc}>
                {errorMessage || 'Unable to load the online OJT System. Please check your internet connection and try again.'}
              </Text>
              <View style={styles.errorActions}>
                <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
                  <RefreshCw size={16} color="#ffffff" />
                  <Text style={styles.retryButtonText}>Retry Connection</Text>
                </TouchableOpacity>
                {onSwitchToNative && (
                  <TouchableOpacity style={styles.nativeFallbackButton} onPress={onSwitchToNative}>
                    <Text style={styles.nativeFallbackText}>Open Offline Native Mode</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  webViewWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  errorCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorActions: {
    width: '100%',
    gap: 10,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  nativeFallbackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  nativeFallbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
});
