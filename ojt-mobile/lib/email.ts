import { Alert } from 'react-native';

/**
 * Sends a welcome email using Resend API via Fetch (Mobile Friendly)
 * Note: In a production app, this should be handled by your backend.
 */
export async function sendWelcomeEmailMobile(toEmail: string, name: string) {
  // Use the same API key logic or a hardcoded placeholder if needed
  // Note: For mobile, it's better to get this from an environment variable or config
  const RESEND_API_KEY = 're_JjQxYuJ5_ARGQvfjVip2y8vqnykCBRpUZ'; 

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'OJT System <onboarding@resend.dev>',
        to: [toEmail],
        subject: 'Welcome to OJT Management System (Mobile)',
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h1 style="color: #2563eb;">Welcome, ${name}!</h1>
            <p>You have successfully registered through our mobile app.</p>
            <p>You can now start recording your OJT hours directly from your phone.</p>
          </div>
        `,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Resend Mobile Error:', result);
    }
    return result;
  } catch (error) {
    console.error('Failed to send mobile email:', error);
  }
}

/**
 * Sends an OTP email using Resend API via Fetch
 */
export async function sendOtpEmailMobile(toEmail: string, otpCode: string) {
  const RESEND_API_KEY = 're_JjQxYuJ5_ARGQvfjVip2y8vqnykCBRpUZ'; 

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'OJT System <onboarding@resend.dev>',
        to: [toEmail],
        subject: 'Your OJT Confirmation Code',
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 20px;">
            <h2 style="color: #1e293b;">Verification Code</h2>
            <p>Please use the following code to complete your OJT registration:</p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: 800; letter-spacing: 5px; color: #2563eb;">${otpCode}</span>
            </div>
          </div>
        `,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Failed to send mobile OTP:', error);
  }
}
