import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';

import { router } from './routes';
import { AppProvider, useApp } from './store/AppContext';

// Expose live AppContext state to Cypress white-box test runs
function CypressWhiteBoxHook() {
  const appState = useApp();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Cypress) {
      (window as any).__APP_STATE__ = {
        ...appState,
        currentUser: appState.currentUser,
        setCurrentUser: (user: any) => {
          if (typeof appState.loginWithOAuthUser === 'function') {
            appState.loginWithOAuthUser(user);
          } else if ((window as any).__APP_STATE__) {
            (window as any).__APP_STATE__.currentUser = user;
          }
        },
      };
    }
  }, [appState]);

  return null;
}

export default function App() {
  return (
    <AppProvider>
      <CypressWhiteBoxHook />
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            borderRadius: '16px',
            fontSize: '14px',
          },
        }}
      />
    </AppProvider>
  );
}
