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
  } catch (error) {
    console.error('Failed to send email:', error);
    return { error };
  }
};
