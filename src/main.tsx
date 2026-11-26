import * as React from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import './styles/index.css';
import ErrorBoundary from './app/components/ErrorBoundary';

// Automatically recover from stale Vite asset chunks right after a new Vercel deployment
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    try {
      const key = 'ojt_last_chunk_reload_ts';
      const lastReload = Number(window.sessionStorage.getItem(key) || '0');
      if (Date.now() - lastReload > 10_000) {
        window.sessionStorage.setItem(key, String(Date.now()));
        fetch(window.location.href, { cache: 'reload' })
          .catch(() => {})
          .finally(() => window.location.reload());
      }
    } catch {
      window.location.reload();
    }
  });
}

// Expose store or auth context only when running inside Cypress (White-Box Hook)
if (typeof window !== 'undefined' && (window as any).Cypress) {
  (window as any).__APP_STATE__ = {
    currentUser: null,
    setCurrentUser: (user: any) => {
      if ((window as any).__APP_STATE__) {
        (window as any).__APP_STATE__.currentUser = user;
      }
    },
  };
}

createRoot(document.getElementById('root')!).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
