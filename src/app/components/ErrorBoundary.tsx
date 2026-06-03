import React from 'react';

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      console.error('ErrorBoundary caught error:', error);
      console.error('Error info:', info);
      // Attempt to stringify important parts for remote logs
      const payload = {
        message: error && (error as any).message,
        stack: error && (error as any).stack,
        componentStack: info.componentStack,
      };
      console.log('Error payload:', payload);
    } catch (e) {
      // ignore
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <h2 style={{ color: '#111827' }}>Unexpected Application Error</h2>
          <p style={{ color: '#374151' }}>An unexpected error occurred while rendering the application.</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 12, borderRadius: 8, color: '#111827' }}>
            {this.state.error?.message}
            {this.state.error?.stack && '\n\n' + this.state.error.stack}
          </pre>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => location.reload()} style={{ background: '#0f172a', color: 'white', padding: '8px 12px', borderRadius: 8 }}>
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
