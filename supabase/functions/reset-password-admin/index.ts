import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server authentication credentials are not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: { email?: string; newPassword?: string; otpCode?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, newPassword, otpCode } = body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email and password (minimum 6 characters) are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security Gate (Objective 1.1): Require valid 6-digit OTP confirmation code to prevent unauthorized account takeover
    if (!otpCode || typeof otpCode !== 'string' || otpCode.trim().length !== 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid 6-digit OTP verification code is required to authorize password reset.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase Admin client using server-side service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Locate user across all pages in Supabase Auth
    let targetUser: any = null;
    let page = 1;
    const perPage = 1000;
    while (!targetUser) {
      const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listError) {
        throw listError;
      }
      const batch = data?.users || [];
      targetUser = batch.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail) || null;
      if (targetUser || batch.length < perPage) break;
      page += 1;
    }

    if (targetUser) {
      // 2a. Update password in Supabase Auth and confirm email
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: newPassword,
        email_confirm: true,
      });

      if (updateError) {
        throw updateError;
      }
    } else {
      // 2b. Check employees or host_supervisors and provision Auth account if registered in DB
      const [{ data: empProfile }, { data: hostProfile }] = await Promise.all([
        supabaseAdmin.from('employees').select('id, name, position').ilike('email', cleanEmail).limit(1).maybeSingle(),
        supabaseAdmin.from('host_supervisors').select('id, name').ilike('email', cleanEmail).limit(1).maybeSingle(),
      ]);

      const profile = empProfile || hostProfile;
      if (!profile) {
        return new Response(
          JSON.stringify({ success: false, error: 'User account not found in authentication service.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pos = String(empProfile?.position || '').toLowerCase();
      const role = empProfile
        ? (pos.includes('instructor') || pos.includes('admin') || pos.includes('coordinator')
            ? 'admin'
            : pos.includes('hte') || pos.includes('supervisor') || pos.includes('representative')
              ? 'host'
              : 'employee')
        : 'host';

      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          full_name: profile.name || cleanEmail.split('@')[0],
          role,
        },
      });

      if (createError) {
        throw createError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('reset-password-admin error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed to update password.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
