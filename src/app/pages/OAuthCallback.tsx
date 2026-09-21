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

        const pendingRole = (localStorage.getItem('pending_oauth_role') || '').trim().toLowerCase();
        const explicitRole = pendingRole === 'admin' ? 'admin' : pendingRole === 'hte' ? 'hte' : pendingRole === 'trainee' ? 'trainee' : null;
        const authUser = session.user;
        const matchedUser = await loginWithOAuthUser(authUser, explicitRole);

        if (matchedUser) {
          localStorage.removeItem('pending_oauth_role');
          const effectiveRole = pendingRole === 'admin' ? 'admin' : pendingRole === 'hte' ? 'hte' : matchedUser.role;

          // Direct to role-specific dashboard
          if (effectiveRole === 'admin') {
            const adminUser = { ...matchedUser, role: 'admin' as const };
            localStorage.setItem('ojt_user', JSON.stringify(adminUser));
            localStorage.setItem('ojt_current_user', JSON.stringify(adminUser));
            navigate('/admin');
            return;
          } else if (effectiveRole === 'hte' || effectiveRole === 'host') {
            const hteUser = { ...matchedUser, role: 'hte' as const };
            localStorage.setItem('ojt_user', JSON.stringify(hteUser));
            localStorage.setItem('ojt_hte_user', JSON.stringify(hteUser));
            localStorage.setItem('ojt_current_user', JSON.stringify(hteUser));
            navigate('/hte');
            return;
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
            localStorage.setItem('ojt_current_user', JSON.stringify(enrichedUser));
            navigate('/app');
            return;
          }
        } else {
          // Direct fallback check against database in case context state hadn't updated yet
          const email = (authUser.email || '').trim().toLowerCase();
          if (email) {
            try {
              const { data: dbEmp } = await supabase
                .from('employees')
                .select('*')
                .ilike('email', email)
                .limit(1)
                .maybeSingle();

              if (dbEmp) {
                localStorage.removeItem('pending_oauth_role');
                const isInstructor =
                  dbEmp.role === 'admin' ||
                  dbEmp.position === 'OJT Instructor' ||
                  dbEmp.position === 'Administrator';
                const isHte =
                  dbEmp.role === 'hte' ||
                  dbEmp.position === 'HTE Representative' ||
                  dbEmp.position === 'Training Supervisor';

                const role = isInstructor ? 'admin' : isHte ? 'hte' : 'employee';
                const resolvedUser = {
                  id: dbEmp.id,
                  name: dbEmp.name || `${dbEmp.first_name || ''} ${dbEmp.last_name || ''}`.trim() || email,
                  email: dbEmp.email || email,
                  role,
                  employeeId: dbEmp.employee_id || dbEmp.id,
                  photo: dbEmp.photo || authUser.user_metadata?.avatar_url || '',
                  faceRegistered: dbEmp.face_registered ?? false,
                };

                localStorage.setItem('ojt_user', JSON.stringify(resolvedUser));
                localStorage.setItem('ojt_current_user', JSON.stringify(resolvedUser));
                if (role === 'admin') navigate('/admin');
                else if (role === 'hte') navigate('/hte');
                else navigate('/app');
                return;
              }

              const { data: dbHost } = await supabase
                .from('host_supervisors')
                .select('*')
                .ilike('email', email)
                .limit(1)
                .maybeSingle();

              if (dbHost) {
                localStorage.removeItem('pending_oauth_role');
                const resolvedHost = {
                  id: dbHost.id,
                  name: dbHost.name || email,
                  email: dbHost.email || email,
                  role: 'hte' as const,
                  employeeId: dbHost.employee_id || dbHost.id,
                  photo: authUser.user_metadata?.avatar_url || '',
                  faceRegistered: false,
                };
                localStorage.setItem('ojt_user', JSON.stringify(resolvedHost));
                localStorage.setItem('ojt_hte_user', JSON.stringify(resolvedHost));
                localStorage.setItem('ojt_current_user', JSON.stringify(resolvedHost));
                navigate('/hte');
                return;
              }
            } catch (dbCheckErr) {
              console.warn('Direct OAuth fallback check notice:', dbCheckErr);
            }
          }

          // If the user signed in as Instructor or HTE, never route to Trainee registration
          if (pendingRole === 'admin') {
            localStorage.removeItem('pending_oauth_role');
            const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'OJT Instructor';
            const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '';
            const fallbackAdmin = {
              id: authUser.id,
              name: fullName,
              email: authUser.email || '',
              role: 'admin' as const,
              employeeId: `ADM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
              photo: avatarUrl,
              faceRegistered: false,
            };
            localStorage.setItem('ojt_user', JSON.stringify(fallbackAdmin));
            localStorage.setItem('ojt_current_user', JSON.stringify(fallbackAdmin));
            navigate('/admin');
            return;
          }
          if (pendingRole === 'hte') {
            localStorage.removeItem('pending_oauth_role');
            const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'HTE Representative';
            const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '';
            const fallbackHte = {
              id: authUser.id,
              name: fullName,
              email: authUser.email || '',
              role: 'hte' as const,
              employeeId: `HTE-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
              photo: avatarUrl,
              faceRegistered: false,
            };
            localStorage.setItem('ojt_user', JSON.stringify(fallbackHte));
            localStorage.setItem('ojt_hte_user', JSON.stringify(fallbackHte));
            localStorage.setItem('ojt_current_user', JSON.stringify(fallbackHte));
            navigate('/hte');
            return;
          }

          // First-time Trainee Google user — route to /register to complete trainee profile
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
