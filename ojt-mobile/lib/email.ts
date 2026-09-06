import { Alert } from 'react-native';

/**
 * Sends a welcome email using Resend API via Fetch (Mobile Friendly)
 * Note: In a production app, this should be handled by your backend.
 */
export async function sendWelcomeEmailMobile(toEmail: string, name: string) {
  const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY || ''; 
  if (!RESEND_API_KEY) {
    console.debug('No EXPO_PUBLIC_RESEND_API_KEY configured');
    return { success: true };
  }

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
          <div style="font-family: 'Times New Roman', Times, serif; padding: 20px;">
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
export async function sendOtpEmailMobile(toEmail: string, nameOrOtp: string, optionalOtp?: string) {
  const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY || ''; 
  if (!RESEND_API_KEY) {
    console.debug('No EXPO_PUBLIC_RESEND_API_KEY configured');
    return { success: true };
  }
  const otpCode = optionalOtp || nameOrOtp;
  const name = optionalOtp ? nameOrOtp : 'User';

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
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h2 style="color: #1e293b;">Hello ${name},</h2>
            <h3 style="color: #2563eb;">OJT Email Verification Code</h3>
            <p style="color: #475569;">Please use the following code to complete your OJT registration:</p>
            <div style="background: #eff6ff; padding: 18px; border-radius: 12px; margin: 20px auto; max-width: 260px; border: 1px solid #bfdbfe;">
              <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #1d4ed8;">${otpCode}</span>
            </div>
            <p style="font-size: 12px; color: #94a3b8;">If you did not request this code, please disregard this email.</p>
          </div>
        `,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Failed to send mobile OTP:', error);
  }
}
