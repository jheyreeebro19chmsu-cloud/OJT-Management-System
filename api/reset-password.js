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

    // 1. Locate user in Supabase Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing auth users:', listError);
      return res.status(500).json({ success: false, error: listError.message || 'Failed to access auth service.' });
    }

    const targetUser = users.find((u) => (u.email || '').toLowerCase() === cleanEmail);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User account not found in authentication service.',
      });
    }

    // 2. Update password in Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('Error updating password via admin API:', updateError);
      return res.status(500).json({ success: false, error: updateError.message || 'Failed to update password.' });
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
