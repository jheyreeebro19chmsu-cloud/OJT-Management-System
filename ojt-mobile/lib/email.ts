import { Alert } from 'react-native';

/**
 * Sends a welcome email using Resend API via Fetch (Mobile Friendly)
 * Note: In a production app, this should be handled by your backend.
 */
export async function sendWelcomeEmailMobile(toEmail: string, name: string) {
  // Use the same API key logic or a hardcoded placeholder if needed
  // Note: For mobile, it's better to get this from an environment variable or config
  const RESEND_API_KEY = 'YOUR_RESEND_API_KEY'; 

  if (RESEND_API_KEY === 'YOUR_RESEND_API_KEY') {
    console.warn('Mobile: Resend API Key not set. Email skipped.');
    return;
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
