/**
 * Backend-proxied Resend implementation
 * Calls the Railway backend to send emails securely without CORS issues
 */

const API_BASE = import.meta.env.VITE_DJANGO_API_URL;
const API_KEY = import.meta.env.VITE_SECURITY_API_KEY;

const sendEmail = async (payload: any) => {
  if (!API_BASE) {
    return { error: 'VITE_DJANGO_API_URL is not set' };
  }

  try {
    const response = await fetch(`${API_BASE}/email/send/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY || '',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || data.message || 'Failed to send email via backend' };
    }

    return { data };
  } catch (error: any) {
    console.error('Email proxy error:', error);
    return { error: error.message || String(error) };
  }
};

export const sendWelcomeEmail = async (toEmail: string, name: string) => {
  return sendEmail({
    to: toEmail,
    subject: 'Welcome to OJT Management System',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome, ${name}!</h1>
        <p>Your registration for the OJT Management System was successful.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      </div>
    `,
  });
};

export const sendOtpEmail = async (toEmail: string, otpCode: string) => {
  return sendEmail({
    to: toEmail,
    subject: 'Your OJT Confirmation Code',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; text-align: center; padding: 40px; border: 1px solid #e2e8f0; border-radius: 20px;">
        <h2 style="color: #1e293b;">Verification Code</h2>
        <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #2563eb;">${otpCode}</span>
        </div>
      </div>
    `,
  });
};
