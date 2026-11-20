import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTgwNywiZXhwIjoyMDg4MjY3ODA3fQ.isLQcKDpXplyE9YDjgub4UOhnfBorngVvVRALuQ8aJA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, newPassword, otpCode } = body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Valid email and password (minimum 6 characters) are required.',
      });
    }

    if (!otpCode || typeof otpCode !== 'string' || otpCode.replace(/\D/g, '').length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Valid 6-digit confirmation code is required to authorize password reset.',
      });
    }

    // 1. Locate user across all pages in Supabase Auth
    let targetUser = null;
    let page = 1;
    const perPage = 1000;
    while (!targetUser) {
      const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
      if (listError) {
        console.error('Error listing auth users:', listError);
        return res.status(500).json({ success: false, error: listError.message || 'Failed to access auth service.' });
      }
      const batch = data?.users || [];
      targetUser = batch.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail) || null;
      if (targetUser || batch.length < perPage) break;
      page += 1;
    }

    if (targetUser) {
      // 2a. Update existing user's password and ensure email is confirmed for password sign-in
      const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
        password: newPassword,
        email_confirm: true,
      });

      if (updateError) {
        console.error('Error updating password via admin API:', updateError);
        return res.status(500).json({ success: false, error: updateError.message || 'Failed to update password.' });
      }
    } else {
      // 2b. Check if user profile exists in employees or host_supervisors and provision Auth account
      const [{ data: empProfile }, { data: hostProfile }] = await Promise.all([
        supabase.from('employees').select('id, name, position').ilike('email', cleanEmail).limit(1).maybeSingle(),
        supabase.from('host_supervisors').select('id, name').ilike('email', cleanEmail).limit(1).maybeSingle(),
      ]);

      const profile = empProfile || hostProfile;
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'User account not found in authentication service.',
        });
      }

      const pos = String(empProfile?.position || '').toLowerCase();
      const role = empProfile
        ? (pos.includes('instructor') || pos.includes('admin') || pos.includes('coordinator')
            ? 'admin'
            : pos.includes('hte') || pos.includes('supervisor') || pos.includes('representative')
              ? 'host'
              : 'employee')
        : 'host';

      const { error: createError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          full_name: profile.name || cleanEmail.split('@')[0],
          role,
        },
      });

      if (createError) {
        console.error('Error creating auth user during password reset:', createError);
        return res.status(500).json({ success: false, error: createError.message || 'Failed to create auth credentials.' });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (err) {
    console.error('api/reset-password error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error while resetting password.',
    });
  }
}
