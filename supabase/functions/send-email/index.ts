import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

Deno.serve(async (req) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Retrieve secret key from environment (never from request body)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_API_KEY secret is not configured in Supabase Edge Functions.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Parse and validate request body
    let body: SendEmailPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON request payload.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { to, subject, html, from } = body;

    // Normalize and validate recipient emails
    const recipients = (Array.isArray(to) ? to : [to])
      .map((e) => (typeof e === 'string' ? e.trim() : ''))
      .filter((e) => EMAIL_REGEX.test(e));

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No valid recipient email addresses provided.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subject cannot be empty.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email HTML content cannot be empty.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Call Resend API securely
    const sender = from || 'OJT System <onboarding@resend.dev>';

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: recipients,
        subject: subject.trim(),
        html,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API returned error:', resendResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: resendResult?.message || 'Failed to deliver email through Resend.',
          details: resendResult,
        }),
        {
          status: resendResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: resendResult }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Edge function internal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal Server Error while sending email.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
