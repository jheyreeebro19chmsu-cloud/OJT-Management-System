import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/AppContext';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { loginWithOAuthUser, employees } = useApp();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const processOAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          console.error('OAuth callback session error:', sessionError);
          if (isMounted) {
            setError(sessionError?.message || 'Unable to retrieve Google session. Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
          }
          return;
        }

        const authUser = session.user;
        const matchedUser = await loginWithOAuthUser(authUser);

        if (matchedUser) {
          // Existing user: direct to role-specific dashboard
          if (matchedUser.role === 'admin') {
            navigate('/admin');
          } else if (matchedUser.role === 'hte' || matchedUser.role === 'host') {
            navigate('/hte');
          } else {
            const employee = employees.find(
              (e) => e.id === matchedUser.employeeId || e.id === matchedUser.id
            );
            const enrichedUser = {
              ...matchedUser,
              photo: matchedUser.photo || employee?.photo || '',
              faceRegistered: employee?.faceRegistered ?? matchedUser.faceRegistered ?? false,
              employeeId: employee?.employeeId || matchedUser.employeeId || employee?.id || matchedUser.id,
            };
            localStorage.setItem('ojt_user', JSON.stringify(enrichedUser));
            navigate('/app');
          }
        } else {
          // Option B: First-time Google user — route to /register to complete required profile details
          const email = authUser.email || '';
          const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
          const photoUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '';

          localStorage.setItem('oauth_email', email);
          localStorage.setItem('oauth_name', fullName);
          if (photoUrl) localStorage.setItem('oauth_photo', photoUrl);
          localStorage.setItem('oauth_user_id', authUser.id);

          navigate('/register');
        }
      } catch (err: any) {
        console.error('OAuth callback processing error:', err);
        if (isMounted) {
          setError(err?.message || 'An unexpected error occurred while signing in with Google.');
          setTimeout(() => navigate('/login'), 2500);
        }
      }
    };

    processOAuth();

    return () => {
      isMounted = false;
    };
  }, [navigate, loginWithOAuthUser, employees]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 text-white">
      {error ? (
        <div className="flex items-center gap-3 bg-red-500/20 border border-red-500/50 p-4 rounded-2xl text-red-200 text-sm max-w-md shadow-xl">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Completing sign in with Google...</p>
        </div>
      )}
    </div>
  );
}
