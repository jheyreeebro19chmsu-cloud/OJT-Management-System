/**
 * Backend-proxied Resend implementation
 * Calls the Railway backend to send emails securely without CORS issues
 */

import { API_BASE, SECURITY_API_KEY as API_KEY } from '../services/config';
import { isSecurityApiConfigured } from '../services/securityApi';

const sendEmail = async (payload: any) => {
  if (!API_BASE || !isSecurityApiConfigured()) {
    console.debug('[Resend] Backend email proxy not configured or inactive. Skipping email proxy.');
    return { data: { simulated: true } };
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

    if (!response.ok) {
      return { error: `Email service returned ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    return { data };
  } catch (error: any) {
    console.warn('[Resend] Could not reach email proxy service:', error?.message || error);
    return { error: error?.message || String(error) };
  }
};

export const sendWelcomeEmail = async (toEmail: string, name: string) => {
  return sendEmail({
    to: toEmail,
    subject: 'Welcome to OJT Management System',
    html: `
      <div style="font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome, ${name}!</h1>
        <p>Your registration for the OJT Management System was successful.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      </div>
    `,
  });
};

export const sendOtpEmail = async (toEmail: string, otpCode: string, purpose: 'verification' | 'password_reset' = 'verification') => {
  const isReset = purpose === 'password_reset';
  const title = isReset ? 'Password Reset Code' : 'Verification Code';
  const desc = isReset
    ? 'We received a request to reset the password for your OJT account. Use the code below to complete your password reset:'
    : 'Use the verification code below to complete your action in the OJT Management System:';

  return sendEmail({
    to: toEmail,
    subject: isReset ? 'Your Password Reset Code - OJT Management System' : 'Your OJT Confirmation Code',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; text-align: center; padding: 36px 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="display: inline-block; padding: 12px; background-color: #eff6ff; border-radius: 12px; margin-bottom: 16px;">
          <span style="font-size: 28px;">🔐</span>
        </div>
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 22px; font-weight: 700;">${title}</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">${desc}</p>
        <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; padding: 18px; border-radius: 12px; margin: 0 0 24px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">${otpCode}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
        <p style="color: #cbd5e1; font-size: 11px; margin: 0;">Carlos Hilado Memorial State University • OJT Management System</p>
      </div>
    `,
  });
};
