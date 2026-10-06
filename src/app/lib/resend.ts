/**
 * Resend Email Service via Serverless API & Direct Fallback
 * Securely triggers transactional emails through /api/send-otp, direct Resend API, and Supabase Edge Functions.
 */

import { supabase } from './supabase';

const RESEND_API_KEY = (import.meta as any).env?.VITE_RESEND_API_KEY;

export const sendOtpEmail = async (
  toEmail: string,
  otpCode: string,
  purpose: 'verification' | 'password_reset' = 'verification'
): Promise<{ data?: any; error?: string }> => {
  const cleanTo = toEmail.trim().toLowerCase();
  const cleanCode = otpCode.trim();

  // 1. Primary path: Serverless endpoint /api/send-otp
  try {
    const res = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: cleanTo,
        code: cleanCode,
        purpose,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      return { data: json.data || json };
    }
    const errJson = await res.json().catch(() => null);
    if (errJson?.error) {
      console.warn('[Resend] /api/send-otp returned error:', errJson.error);
    }
  } catch (apiErr) {
    console.warn('[Resend] /api/send-otp network error, trying fallbacks:', apiErr);
  }

  // 2. Secondary path: Direct Resend API
  if (RESEND_API_KEY) {
    try {
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
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">${cleanCode}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">This code will expire in 10 minutes. If you did not request this, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">Carlos Hilado Memorial State University • OJT Management System</p>
        </div>
      `;

      const directRes = await fetch('https://api.resend.com/emails', {
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

      if (directRes.ok) {
        const dJson = await directRes.json();
        return { data: dJson };
      }
    } catch (dErr) {
      console.warn('[Resend] Direct API call error, trying edge function:', dErr);
    }
  }

  // 3. Tertiary path: Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('send-otp-email', {
      body: {
        to: cleanTo,
        code: cleanCode,
        purpose,
      },
    });

    if (error) {
      console.warn('[Resend] send-otp-email edge function error:', error);
      return { error: 'Failed to deliver confirmation email. Please check your internet connection or email address.' };
    }

    if (data && data.success === false) {
      return { error: data.error || 'Failed to send verification email.' };
    }

    return { data };
  } catch (err: any) {
    console.error('[Resend] invoke error:', err);
    return { error: 'Failed to deliver confirmation email. Please try again.' };
  }
};

export const sendWelcomeEmail = async (toEmail: string, name: string): Promise<{ data?: any; error?: string }> => {
  const cleanTo = toEmail.trim().toLowerCase();

  // Try direct Resend first if key is available
  if (RESEND_API_KEY) {
    try {
      const directRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'OJT System <onboarding@resend.dev>',
          to: [cleanTo],
          subject: 'Welcome to OJT Management System',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">Welcome, ${name}!</h2>
              <p>Your registration for the OJT Management System was successful.</p>
            </div>
          `,
        }),
      });

      if (directRes.ok) {
        const dJson = await directRes.json();
        return { data: dJson };
      }
    } catch (dErr) {
      console.warn('[Resend] direct sendWelcomeEmail error:', dErr);
    }
  }

  // Fallback: Supabase edge function
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: [cleanTo],
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
      return { error: error.message || 'Failed to send welcome email.' };
    }

    return { data };
  } catch (err: any) {
    return { error: err?.message || String(err) };
  }
};
