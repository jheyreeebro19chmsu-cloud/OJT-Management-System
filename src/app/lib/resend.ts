/**
 * Resend Email Service via Supabase Edge Functions
 * Securely triggers transactional emails through Supabase Edge Functions without exposing API keys or relying on offline backends.
 */

import { supabase } from './supabase';

export const sendOtpEmail = async (
  toEmail: string,
  otpCode: string,
  purpose: 'verification' | 'password_reset' = 'verification'
): Promise<{ data?: any; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-otp-email', {
      body: {
        to: toEmail.trim().toLowerCase(),
        code: otpCode.trim(),
        purpose,
      },
    });

    if (error) {
      console.warn('[Resend] send-otp-email invocation error:', error);
      return { error: error.message || 'Failed to send verification email.' };
    }

    if (data && data.success === false) {
      return { error: data.error || 'Failed to send verification email.' };
    }

    return { data };
  } catch (err: any) {
    console.error('[Resend] invoke error:', err);
    return { error: err?.message || 'Network error while contacting email service.' };
  }
};

export const sendWelcomeEmail = async (toEmail: string, name: string): Promise<{ data?: any; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: [toEmail.trim().toLowerCase()],
        subject: 'Welcome to OJT Management System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Welcome, ${name}!</h2>
            <p>Your registration for the OJT Management System was successful.</p>
          </div>
        `,
      },
    });

    if (error) {
      console.warn('[Resend] sendWelcomeEmail error:', error);
      return { error: error.message || 'Failed to send welcome email.' };
    }

    return { data };
  } catch (err: any) {
    console.error('[Resend] sendWelcomeEmail invoke error:', err);
    return { error: err?.message || String(err) };
  }
};
