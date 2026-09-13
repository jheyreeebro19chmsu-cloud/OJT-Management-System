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

    let body: { email?: string; newPassword?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, newPassword } = body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email and password (minimum 6 characters) are required.' }),
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

    // 1. Locate user by email in Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw listError;
    }

    const targetUser = users.find((u) => (u.email || '').toLowerCase() === cleanEmail);
    if (!targetUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'User account not found in authentication service.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: newPassword,
    });

    if (updateError) {
      throw updateError;
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
