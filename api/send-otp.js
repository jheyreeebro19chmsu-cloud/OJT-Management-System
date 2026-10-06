const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;

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

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured in environment variables.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { to, code, purpose = 'password_reset' } = body;

    const cleanTo = (to || '').trim().toLowerCase();
    if (!cleanTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
      return res.status(400).json({ error: 'Invalid recipient email address.' });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Verification code is required.' });
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
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Carlos Hilado Memorial State University • OJT Management System</p>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
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
      console.error('Resend API error:', resendResult);
      return res.status(resendResponse.status).json({
        error: resendResult?.message || 'Failed to deliver OTP email via Resend.',
        details: resendResult,
      });
    }

    return res.status(200).json({ success: true, data: resendResult });
  } catch (err) {
    console.error('api/send-otp exception:', err);
    return res.status(500).json({ error: err.message || 'Failed to send verification email' });
  }
}
