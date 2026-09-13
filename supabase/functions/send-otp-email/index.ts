import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendOtpPayload {
  to: string;
  code: string;
  purpose?: 'password_reset' | 'verification';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_API_KEY secret is not configured in Supabase Edge Functions.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: SendOtpPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { to, code, purpose = 'password_reset' } = body;
    const cleanTo = (to || '').trim().toLowerCase();

    if (!cleanTo || !EMAIL_REGEX.test(cleanTo)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid recipient email address.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Verification code is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isReset = purpose === 'password_reset';
    const title = isReset ? 'Password Reset Code' : 'Verification Code';
    const desc = isReset
      ? 'We received a request to reset the password for your OJT account. Use the confirmation code below to reset your password:'
      : 'Use the confirmation code below to verify your account in the OJT Management System:';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; text-align: center; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="display: inline-block; padding: 12px; background-color: #eff6ff; border-radius: 12px; margin-bottom: 16px;">
          <span style="font-size: 28px;">🔐</span>
        </div>
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 22px; font-weight: 700;">${title}</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">${desc}</p>
        <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; padding: 16px; border-radius: 12px; margin: 0 0 24px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">${code.trim()}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">This code will expire in 10 minutes. If you did not request this, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
        <p style="color: #cbd5e1; font-size: 11px; margin: 0;">Carlos Hilado Memorial State University • OJT Management System</p>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OJT System <onboarding@resend.dev>',
        to: [cleanTo],
        subject: isReset ? 'Your Password Reset Code - OJT Management System' : 'Your OJT Confirmation Code',
        html: htmlContent,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API returned error:', resendResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: resendResult?.message || 'Failed to deliver OTP email via Resend.',
          details: resendResult,
        }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: resendResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('send-otp-email error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
