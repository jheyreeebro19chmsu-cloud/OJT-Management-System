import * as React from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import './styles/index.css';
import ErrorBoundary from './app/components/ErrorBoundary';

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
