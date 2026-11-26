import * as React from 'react';
import type {
  WebViewProps,
  WebViewNavigation,
  WebViewMessageEvent,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';

declare module 'react-native-webview' {
  export interface WebViewInstance {
    goBack: () => void;
    goForward: () => void;
    reload: () => void;
    stopLoading: () => void;
    injectJavaScript: (str: string) => void;
    requestFocus: () => void;
    postMessage: (data: string) => void;
    clearFormData?: () => void;
    clearCache?: (includeDiskFiles: boolean) => void;
    clearHistory?: () => void;
  }

  export type WebView = WebViewInstance;
  export const WebView: React.ForwardRefExoticComponent<
    WebViewProps & React.RefAttributes<WebViewInstance>
  >;
  export default WebView;
  export {
    WebViewProps,
    WebViewNavigation,
    WebViewMessageEvent,
    WebViewErrorEvent,
    WebViewHttpErrorEvent,
  };
}
