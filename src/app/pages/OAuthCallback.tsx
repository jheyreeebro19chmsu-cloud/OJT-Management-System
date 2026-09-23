import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, UserPlus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { User } from '../types';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Verifying Google credentials...');
  const [isSuccess, setIsSuccess] = useState(false);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    // Safety watchdog: after 8 seconds, if still loading, provide user control
    const watchdogTimer = setTimeout(() => {
      setError((prev) => prev || 'Sign in took longer than expected. Please select an option below to proceed.');
    }, 8000);

    const processOAuth = async () => {
      try {
        // 1. Check for error parameters in query string or hash fragment
        const searchParams = new URLSearchParams(window.location.search);
        const hashString = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hashString);

        const urlError = searchParams.get('error') || hashParams.get('error');
        const urlErrorDesc = searchParams.get('error_description') || hashParams.get('error_description');

        if (urlError || urlErrorDesc) {
          const cleanMsg = urlErrorDesc
            ? decodeURIComponent(urlErrorDesc.replace(/\+/g, ' '))
            : urlError;
          console.error('Google OAuth URL error:', cleanMsg);
          clearTimeout(watchdogTimer);
          setError(`Google Sign-In notice: ${cleanMsg}`);
          return;
        }

        let session: any = null;

        // 2. PKCE Authorization Code grant (?code=...)
        const code = searchParams.get('code');
        if (code) {
          setStatusMessage('Exchanging authorization code...');
          try {
            const { data: codeData, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (!codeErr && codeData?.session) {
              session = codeData.session;
            }
          } catch (codeEx) {
            console.warn('exchangeCodeForSession exception:', codeEx);
          }
        }

        // 3. Implicit grant hash fragment (#access_token=...&refresh_token=...)
        if (!session) {
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            setStatusMessage('Restoring session from tokens...');
            try {
              const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (!sessionErr && sessionData?.session) {
                session = sessionData.session;
              }
            } catch (hashEx) {
              console.warn('setSession from hash exception:', hashEx);
            }
          }
        }

        // 4. Fallback to existing Supabase session in storage
        if (!session) {
          setStatusMessage('Checking active session...');
          try {
            const { data: storedSession } = await supabase.auth.getSession();
            if (storedSession?.session) {
              session = storedSession.session;
            }
          } catch (getSessErr) {
            console.warn('getSession error:', getSessErr);
          }
        }

        // 5. Direct localStorage scan for Supabase auth token
        if (!session && typeof window !== 'undefined') {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              try {
                const parsed = JSON.parse(localStorage.getItem(key) || '{}');
                if (parsed?.access_token && parsed?.user) {
                  session = parsed;
                  break;
                }
              } catch {}
            }
          }
        }

        // 6. Wait briefly for onAuthStateChange in case background exchange is finishing
        if (!session) {
          session = await new Promise((resolve) => {
            let done = false;
            const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
              if (newSession && !done) {
                done = true;
                authListener?.subscription?.unsubscribe();
                resolve(newSession);
              }
            });

            setTimeout(() => {
              if (!done) {
                done = true;
                authListener?.subscription?.unsubscribe();
                resolve(null);
              }
            }, 3000);
          });
        }

        if (!session?.user) {
          clearTimeout(watchdogTimer);
          setError('Unable to retrieve Google session. Please ensure your Google account is verified and try again.');
          return;
        }

        const authUser = session.user;
        const email = (authUser.email || '').trim().toLowerCase();
        const fullName =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split('@')[0] ||
          'User';
        const givenName = authUser.user_metadata?.given_name || authUser.user_metadata?.first_name || '';
        const familyName = authUser.user_metadata?.family_name || authUser.user_metadata?.last_name || '';
        const photoUrl =
          authUser.user_metadata?.avatar_url ||
          authUser.user_metadata?.picture ||
          '';
        const pendingRole = (localStorage.getItem('pending_oauth_role') || '').trim().toLowerCase();

        setStatusMessage('Checking system records for your account...');

        // 7. Check if user already exists in the system (database or local storage)
        let dbEmp: any = null;
        let dbHost: any = null;

        if (isSupabaseConfigured() && email) {
          try {
            const cleanEmail = email.trim().toLowerCase();
            const [empByIdRes, empByEmailRes, hostByIdRes, hostByEmailRes] = await Promise.allSettled([
              Promise.race([
                supabase
                  .from('employees')
                  .select('id, name, employee_id, email, position, photo, face_registered')
                  .eq('id', authUser.id)
                  .maybeSingle(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
              ]),
              Promise.race([
                supabase
                  .from('employees')
                  .select('id, name, employee_id, email, position, photo, face_registered')
                  .ilike('email', cleanEmail)
                  .maybeSingle(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
              ]),
              Promise.race([
                supabase
                  .from('host_supervisors')
                  .select('id, name, email, position, company_name')
                  .eq('id', authUser.id)
                  .maybeSingle(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
              ]),
              Promise.race([
                supabase
                  .from('host_supervisors')
                  .select('id, name, email, position, company_name')
                  .ilike('email', cleanEmail)
                  .maybeSingle(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
              ]),
            ]);

            if (empByIdRes.status === 'fulfilled' && (empByIdRes.value as any)?.data) {
              dbEmp = (empByIdRes.value as any).data;
            } else if (empByEmailRes.status === 'fulfilled' && (empByEmailRes.value as any)?.data) {
              dbEmp = (empByEmailRes.value as any).data;
            }

            if (hostByIdRes.status === 'fulfilled' && (hostByIdRes.value as any)?.data) {
              dbHost = (hostByIdRes.value as any).data;
            } else if (hostByEmailRes.status === 'fulfilled' && (hostByEmailRes.value as any)?.data) {
              dbHost = (hostByEmailRes.value as any).data;
            }
          } catch (dbErr) {
            console.warn('Database user search error:', dbErr);
          }
        }

        // Fallback to authUser user_metadata if account role was already established
        if (!dbEmp && !dbHost && authUser.user_metadata?.role === 'admin') {
          dbEmp = {
            id: authUser.id,
            name: fullName,
            email,
            position: 'OJT Instructor',
            employee_id: authUser.user_metadata?.employee_id || 'ADM-INSTRUCTOR',
            photo: photoUrl,
          };
        } else if (!dbEmp && !dbHost && authUser.user_metadata?.role === 'hte') {
          dbHost = {
            id: authUser.id,
            name: fullName,
            email,
            position: 'HTE Representative',
            company_name: 'Host Training Establishment',
          };
        }

        // Check local storage backup if DB returned null or offline
        if (!dbEmp && !dbHost && typeof window !== 'undefined') {
          try {
            const cachedEmps = JSON.parse(localStorage.getItem('ojt_employees') || '[]');
            dbEmp = cachedEmps.find((e: any) => e.email && e.email.trim().toLowerCase() === email);

            const cachedHosts = JSON.parse(localStorage.getItem('ojt_host_supervisors') || '[]');
            dbHost = cachedHosts.find((h: any) => h.email && h.email.trim().toLowerCase() === email);
          } catch {}
        }

        clearTimeout(watchdogTimer);

        // ═══════════════════════════════════════════════════════════════════════
        // CASE A: User ALREADY EXISTS in the system -> SIGN THEM IN DIRECTLY!
        // ═══════════════════════════════════════════════════════════════════════
        if (dbEmp || dbHost) {
          setIsSuccess(true);
          setStatusMessage(`Welcome back, ${dbEmp?.name || dbHost?.name || fullName}! Signing you in...`);

          localStorage.removeItem('pending_oauth_role');
          localStorage.removeItem('oauth_email');
          localStorage.removeItem('oauth_name');
          localStorage.removeItem('oauth_given_name');
          localStorage.removeItem('oauth_family_name');
          localStorage.removeItem('oauth_photo');
          localStorage.removeItem('oauth_user_id');

          if (dbEmp) {
            const isInstructor =
              dbEmp.role === 'admin' ||
              dbEmp.position === 'OJT Instructor' ||
              dbEmp.position === 'Administrator' ||
              (dbEmp.position && String(dbEmp.position).toLowerCase().includes('instructor')) ||
              (dbEmp.position && String(dbEmp.position).toLowerCase().includes('admin'));

            const isHte =
              dbEmp.role === 'hte' ||
              dbEmp.role === 'host' ||
              dbEmp.position === 'HTE Representative' ||
              dbEmp.position === 'Training Supervisor' ||
              (dbEmp.position && String(dbEmp.position).toLowerCase().includes('hte'));

            const role: User['role'] = isInstructor ? 'admin' : isHte ? 'hte' : 'employee';
            const resolvedUser: User = {
              id: dbEmp.id,
              name: dbEmp.name || `${dbEmp.first_name || ''} ${dbEmp.last_name || ''}`.trim() || fullName,
              email: dbEmp.email || email,
              role,
              employeeId: dbEmp.employee_id || dbEmp.id,
              photo: dbEmp.photo || photoUrl,
              faceRegistered: dbEmp.face_registered ?? false,
            };

            setCurrentUser(resolvedUser);
            localStorage.setItem('ojt_user', JSON.stringify(resolvedUser));
            localStorage.setItem('ojt_current_user', JSON.stringify(resolvedUser));
            if (role === 'hte') {
              localStorage.setItem('ojt_hte_user', JSON.stringify(resolvedUser));
            }

            const targetPath = role === 'admin' ? '/admin' : role === 'hte' ? '/hte' : '/app';
            setTimeout(() => navigate(targetPath, { replace: true }), 300);
            return;
          }

          if (dbHost) {
            const resolvedHost: User = {
              id: dbHost.id,
              name: dbHost.name || fullName,
              email: dbHost.email || email,
              role: 'hte',
              employeeId: dbHost.employee_id || dbHost.id,
              photo: photoUrl || '',
              faceRegistered: false,
            };

            setCurrentUser(resolvedHost);
            localStorage.setItem('ojt_user', JSON.stringify(resolvedHost));
            localStorage.setItem('ojt_hte_user', JSON.stringify(resolvedHost));
            localStorage.setItem('ojt_current_user', JSON.stringify(resolvedHost));

            setTimeout(() => navigate('/hte', { replace: true }), 300);
            return;
          }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // CASE B: User DOES NOT EXIST in system -> DIRECT TO SIGN UP WITH GOOGLE!
        // ═══════════════════════════════════════════════════════════════════════
        setIsSuccess(true);
        setStatusMessage('Google account verified! Redirecting to complete registration...');

        localStorage.setItem('oauth_email', email);
        localStorage.setItem('oauth_name', fullName);
        if (givenName) localStorage.setItem('oauth_given_name', givenName);
        if (familyName) localStorage.setItem('oauth_family_name', familyName);
        if (photoUrl) localStorage.setItem('oauth_photo', photoUrl);
        localStorage.setItem('oauth_user_id', authUser.id);

        if (pendingRole === 'admin') {
          localStorage.setItem('pending_oauth_role', 'admin');
          setTimeout(() => navigate('/register?role=admin', { replace: true }), 300);
        } else if (pendingRole === 'hte') {
          localStorage.setItem('pending_oauth_role', 'hte');
          setTimeout(() => navigate('/register?role=hte', { replace: true }), 300);
        } else {
          // Default Trainee registration
          localStorage.setItem('pending_oauth_role', 'trainee');
          setTimeout(() => navigate('/register?role=trainee', { replace: true }), 300);
        }
      } catch (err: any) {
        console.error('OAuth callback processing error:', err);
        clearTimeout(watchdogTimer);
        setError(err?.message || 'An unexpected error occurred while signing in with Google.');
      }
    };

    processOAuth();

    return () => {
      clearTimeout(watchdogTimer);
    };
  }, [navigate, setCurrentUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 text-white selection:bg-blue-600 selection:text-white">
      {error ? (
        <div className="flex flex-col items-center max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-100">Sign-In Notice</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full pt-2">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-md"
            >
              <ArrowLeft size={14} />
              <span>Return to Sign In</span>
            </Link>
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors shadow-md"
            >
              <UserPlus size={14} />
              <span>Sign Up with Google</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {isSuccess ? (
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 size={24} />
            </div>
          ) : (
            <div className="relative">
              <div className="w-12 h-12 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              </div>
            </div>
          )}
          <div className="text-center space-y-1">
            <p className="text-slate-200 text-sm font-semibold tracking-wide">{statusMessage}</p>
            <p className="text-slate-500 text-xs">Carlos Hilado Memorial State University • OJT Management System</p>
          </div>
        </div>
      )}
    </div>
  );
}
