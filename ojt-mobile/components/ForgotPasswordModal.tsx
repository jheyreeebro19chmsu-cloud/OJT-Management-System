import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { mobileDb } from '../lib/supabaseService';
import { sendOtpEmailMobile } from '../lib/email';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess?: (email: string, newPassword: string) => void;
}

export default function ForgotPasswordModal({
  visible,
  onClose,
  initialEmail = '',
  onSuccess,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<'email' | 'verify_code' | 'new_password'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [otpAttempts, setOtpAttempts] = useState<number>(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState<number>(0);

  useEffect(() => {
    if (visible) {
      setEmail(initialEmail || '');
      setStep('email');
      setOtp('');
      setGeneratedOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setOtpAttempts(0);
      setResendTimer(0);
    }
  }, [visible, initialEmail]);

  // Resend countdown timer
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Step 1: Request & Send 6-Digit Verification Code
  async function handleSendVerificationCode() {
    const cleanEmail = email.trim().toLowerCase();
    setError('');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verify that the email is associated with an employee or host supervisor
      const [{ data: emps }, { data: hosts }] = await Promise.all([
        supabase.from('employees').select('id,email').ilike('email', cleanEmail).limit(1),
        supabase.from('host_supervisors').select('id,email').ilike('email', cleanEmail).limit(1),
      ]);

      const accountExists = (emps && emps.length > 0) || (hosts && hosts.length > 0);

      if (!accountExists) {
        setError('No registered account found with this email address.');
        setLoading(false);
        return;
      }

      // 2. Generate random 6-digit confirmation code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setOtpExpiresAt(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
      setOtpAttempts(0);

      // 3. Send via Supabase Edge Function or Resend API
      try {
        await supabase.functions.invoke('send-otp-email', {
          body: {
            to: cleanEmail,
            code,
            purpose: 'password_reset',
          },
        });
      } catch (fnErr) {
        console.warn('Edge Function OTP notice, falling back to direct Resend API:', fnErr);
        await sendOtpEmailMobile(cleanEmail, code);
      }

      setStep('verify_code');
      setResendTimer(60);
      Alert.alert('Verification Code Sent', `A 6-digit code has been sent to ${cleanEmail}. Please check your inbox.`);
    } catch (err: any) {
      console.error('Password reset send code error:', err);
      setError(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify Code
  function handleVerifyCode() {
    setError('');
    const entered = otp.trim();

    if (!entered || entered.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (Date.now() > otpExpiresAt) {
      setError('Verification code has expired. Please request a new code.');
      return;
    }

    if (otpAttempts >= 5) {
      setGeneratedOtp('');
      setError('Too many invalid attempts. Please request a new verification code.');
      return;
    }

    if (entered !== generatedOtp.trim()) {
      const remaining = 4 - otpAttempts;
      setOtpAttempts((prev) => prev + 1);
      setError(`Invalid verification code. (${remaining} attempts remaining)`);
      return;
    }

    // Successfully verified -> Advance to small New Password form!
    setError('');
    setStep('new_password');
  }

  // Step 3: Submit New Password (at least 8 characters)
  async function handleSubmitNewPassword() {
    setError('');
    const cleanEmail = email.trim().toLowerCase();

    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const res = await mobileDb.resetPasswordDirect(cleanEmail, newPassword);

      if (!res.success) {
        throw new Error(res.message || 'Failed to update password in Supabase Auth.');
      }

      Alert.alert(
        'Password Reset Successful!',
        'Your password has been updated. You can now log in with your new password.',
        [
          {
            text: 'Proceed to Login',
            onPress: () => {
              onSuccess?.(cleanEmail, newPassword);
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Submit new password error:', err);
      setError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBadge}>
                <KeyRound size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Reset Password</Text>
                <Text style={styles.headerSubtitle}>
                  {step === 'email'
                    ? 'Step 1 of 3 • Email Verification'
                    : step === 'verify_code'
                    ? 'Step 2 of 3 • Enter Code'
                    : 'Step 3 of 3 • Set New Password'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={loading}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Error Banner */}
            {Boolean(error) && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#dc2626" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* STEP 1: Enter Email */}
            {step === 'email' && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepInstruction}>
                  Enter the email address registered with your OJT account. We will send a 6-digit verification code.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Registered Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. trainee@chmsu.edu.ph"
                      placeholderTextColor="#94a3b8"
                      value={email}
                      onChangeText={(v) => {
                        setEmail(v);
                        setError('');
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleSendVerificationCode}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Mail size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: Enter 6-Digit Code */}
            {step === 'verify_code' && (
              <View style={styles.stepContainer}>
                <View style={styles.emailPill}>
                  <Text style={styles.emailPillLabel}>Code sent to:</Text>
                  <Text style={styles.emailPillValue}>{email}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setStep('email');
                      setError('');
                    }}
                    style={styles.changeEmailBtn}
                  >
                    <Text style={styles.changeEmailBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.stepInstruction}>
                  Please enter the 6-digit confirmation code sent to your email address:
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>6-Digit Verification Code</Text>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="• • • • • •"
                    placeholderTextColor="#cbd5e1"
                    value={otp}
                    onChangeText={(v) => {
                      setOtp(v.replace(/\D/g, ''));
                      setError('');
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleVerifyCode}
                  disabled={loading}
                >
                  <ShieldCheck size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Verify Code</Text>
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  {resendTimer > 0 ? (
                    <Text style={styles.resendTimerText}>
                      Resend code in {resendTimer}s
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={handleSendVerificationCode}
                      disabled={loading}
                      style={styles.resendBtn}
                    >
                      <RefreshCw size={13} color="#2563eb" style={{ marginRight: 4 }} />
                      <Text style={styles.resendBtnText}>Resend verification code</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* STEP 3: Small Form for New Password (At least 8 characters) */}
            {step === 'new_password' && (
              <View style={styles.stepContainer}>
                <View style={styles.verifiedBadge}>
                  <CheckCircle2 size={16} color="#16a34a" />
                  <Text style={styles.verifiedBadgeText}>
                    Email Verified ({email})
                  </Text>
                </View>

                <Text style={styles.stepInstruction}>
                  Please enter your new password. It must be at least 8 characters long:
                </Text>

                {/* New Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password *</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Minimum 8 characters"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={(v) => {
                        setNewPassword(v);
                        setError('');
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      style={styles.eyeBtn}
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} color="#64748b" />
                      ) : (
                        <Eye size={18} color="#64748b" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm New Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm New Password *</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Re-type new password"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={(v) => {
                        setConfirmPassword(v);
                        setError('');
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeBtn}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} color="#64748b" />
                      ) : (
                        <Eye size={18} color="#64748b" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Password Length Hint */}
                <View style={styles.hintRow}>
                  <Text
                    style={[
                      styles.hintText,
                      newPassword.length >= 8 ? styles.hintSuccess : styles.hintDefault,
                    ]}
                  >
                    {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                  </Text>
                  {confirmPassword.length > 0 && (
                    <Text
                      style={[
                        styles.hintText,
                        newPassword === confirmPassword ? styles.hintSuccess : styles.hintError,
                      ]}
                    >
                      {newPassword === confirmPassword ? '✓ Passwords match' : '✕ Passwords mismatch'}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#16a34a' }]}
                  onPress={handleSubmitNewPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryBtnText}>Submit New Password</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  body: {
    padding: 20,
    maxHeight: 480,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1,
  },
  stepContainer: {
    gap: 14,
  },
  stepInstruction: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    height: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  eyeBtn: {
    padding: 6,
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8faff',
    borderRadius: 12,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: '#1e3a8a',
    letterSpacing: 8,
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 6,
    flexWrap: 'wrap',
  },
  emailPillLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  emailPillValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e3a8a',
    flex: 1,
  },
  changeEmailBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  changeEmailBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  resendTimerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803d',
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -4,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hintDefault: {
    color: '#94a3b8',
  },
  hintSuccess: {
    color: '#16a34a',
  },
  hintError: {
    color: '#dc2626',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
