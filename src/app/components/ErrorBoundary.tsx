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
      const msg = String(error?.message || '').toLowerCase();
      if (
        typeof window !== 'undefined' &&
        (msg.includes('failed to fetch dynamically imported module') ||
          msg.includes('importing a module script failed') ||
          msg.includes('error loading dynamically imported module') ||
          error?.name === 'ChunkLoadError')
      ) {
        const key = 'ojt_eb_chunk_reload_ts';
        const last = Number(window.sessionStorage.getItem(key) || '0');
        if (Date.now() - last > 10_000) {
          window.sessionStorage.setItem(key, String(Date.now()));
          fetch(window.location.href, { cache: 'reload' })
            .catch(() => {})
            .finally(() => window.location.reload());
          return;
        }
      }
      console.error('ErrorBoundary caught error:', error);
      console.error('Error info:', info);
      const payload = {
        message: error && (error as any).message,
        stack: error && (error as any).stack,
        componentStack: info.componentStack,
      };
      console.log('Error payload:', payload);
    } catch {
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
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                try {
                  window.sessionStorage.clear();
                } catch {}
                fetch(window.location.href, { cache: 'reload' })
                  .catch(() => {})
                  .finally(() => location.reload());
              }}
              style={{ background: '#0f172a', color: 'white', padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >
              Reload App
            </button>
            <button
              onClick={() => {
                try {
                  window.sessionStorage.clear();
                  localStorage.removeItem('ojt_time_records');
                  localStorage.removeItem('ojt_monitoring_reports');
                  localStorage.removeItem('ojt_trainee_self_monitoring_reports');
                } catch {}
                window.location.href = window.location.pathname + '?v=' + Date.now();
              }}
              style={{ background: '#2563eb', color: 'white', padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >
              Clear Cache & Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
