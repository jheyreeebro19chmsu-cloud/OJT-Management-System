import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { authAPI } from '../services/authApi';
import supabaseAuth from '../services/supabaseAuth';
import { useApp } from '../store/AppContext';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const app = useApp();

  useEffect(() => {
    (async () => {
      const pendingRole = localStorage.getItem('pending_oauth_role');
      const res = await supabaseAuth.handleOAuthCallback();
      if ((res as any).error) {
        // fallback: redirect home
        navigate('/register');
        return;
      }

      // v2 returns { data: { session, provider }, error }
      // Try to read user from session
      const session = (res as any).data?.session ?? null;
      const user = session?.user ?? null;

      if (!user) {
        navigate('/register');
        return;
      }

      const email = user.email || '';
      const name = user.user_metadata?.full_name || user.user_metadata?.name || '';

      // If role present, complete registration locally or redirect to appropriate form
      if (pendingRole === 'hte') {
        // for HTE, navigate to HTE registration completion where company details are collected
        localStorage.setItem('oauth_email', email);
        localStorage.setItem('oauth_name', name);
        navigate('/register?h=hte');
        return;
      }

      // For students/instructors - try server-side OAuth registration, fallback to local account
      const parts = name.trim().split(/\s+/);
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ') || '';
      try {
        if (pendingRole === 'instructor') {
          await authAPI.registerOauthInstructor({ email, first_name, last_name });
        } else {
          await authAPI.registerOauthStudent({ email, first_name, last_name });
        }
      } catch (err) {
        // fallback to local registration
        const existing = app?.employees.find((e) => e.email.toLowerCase() === email.toLowerCase());
        if (!existing) {
          app?.registerEmployee({
            name: name || email,
            email,
            department: '',
            position: 'OJT Trainee',
            companyName: '',
            supervisorName: '',
            schoolName: '',
            course: '',
            employeeId: `OJT-${Date.now()}`,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            requiredHours: 486,
            faceRegistered: false,
            active: true,
          });
        }
      }

      navigate('/app');
    })();
  }, []);

  return <div className="p-8">Processing OAuth callback...</div>;
}
