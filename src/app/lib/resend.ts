import { Resend } from 'resend';

// Get API Key from environment variables
const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Helper to send a welcome email to a new trainee
 */
export const sendWelcomeEmail = async (toEmail: string, name: string) => {
  if (!resend) {
    console.warn('Resend API Key is missing. Email not sent.');
    return { error: 'API Key missing' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'OJT System <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Welcome to OJT Management System',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome, ${name}!</h1>
          <p>Your registration for the OJT Management System was successful.</p>
          <p>You can now log in to the portal to track your hours and manage your requirements.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #64748b; font-size: 12px;">This is an automated message from your OJT Coordinator.</p>
        </div>
      `,
    });

    return { data, error };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { error: error.message || String(error) };
  }
};

/**
 * Helper to send an OTP code for registration
 */
export const sendOtpEmail = async (toEmail: string, otpCode: string) => {
  if (!resend) return { error: 'API Key missing' };

  try {
    const { data, error } = await resend.emails.send({
      from: 'OJT System <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Your OJT Confirmation Code',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; text-align: center; padding: 40px; border: 1px solid #e2e8f0; border-radius: 20px;">
          <h2 style="color: #1e293b;">Verification Code</h2>
          <p style="color: #64748b;">Please use the following code to complete your OJT registration:</p>
          <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #2563eb;">${otpCode}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">This code will expire shortly. Do not share this code with anyone.</p>
        </div>
      `,
    });

    return { data, error };
  } catch (error: any) {
    console.error('Failed to send OTP:', error);
    return { error: error.message || String(error) };
  }
};
