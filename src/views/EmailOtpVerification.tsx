import React, { useState } from 'react';
import { ShieldCheck, ArrowLeft, Lock } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';
import { invokeEdgeFunction } from '../lib/supabase-client';

interface EmailOtpVerificationProps {
  language: Language;
  email: string;
  purpose: 'email_verify' | 'password_reset';
  onVerified: () => void;
  onBack: () => void;
}

const EmailOtpVerification: React.FC<EmailOtpVerificationProps> = ({
  language, email, purpose, onVerified, onBack
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value !== '' && index < 5) {
      document.getElementById(`email-otp-${index + 1}`)?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError(t('code6Digits') || 'Le code doit contenir 6 chiffres');
      return;
    }
    if (purpose === 'password_reset') {
      if (newPassword.length < 6) {
        setError(t('passwordTooShort'));
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t('passwordsDoNotMatch') || 'Les mots de passe ne correspondent pas');
        return;
      }
    }
    setIsLoading(true);
    setError('');
    const { data, error: err } = await invokeEdgeFunction('verify-otp', {
      email,
      code,
      purpose,
      ...(purpose === 'password_reset' && { newPassword }),
    });
    setIsLoading(false);
    if (err) {
      setError(err);
      return;
    }
    if (data && (data as { success?: boolean }).success) {
      onVerified();
    } else {
      setError(t('invalidCode') || 'Code invalide ou expiré');
    }
  };

  const handleResend = async () => {
    if (isResending) return;
    setIsResending(true);
    setError('');
    setOtp(['', '', '', '', '', '']);
    const { error: err } = await invokeEdgeFunction('send-otp', { email, purpose });
    setIsResending(false);
    if (err) setError(err);
  };

  const isComplete = otp.every((v) => v !== '');
  const canSubmit = purpose === 'email_verify'
    ? isComplete
    : isComplete && newPassword.length >= 6 && newPassword === confirmPassword;

  return (
    <div className="veetaa-login-page">
      <div className="veetaa-login-card">
        <button onClick={onBack} className="absolute top-8 left-8 p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
  
        <div className="veetaa-login-header">
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto text-orange-600 mb-8 shadow-xl shadow-orange-100">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="veetaa-login-title">
            {purpose === 'email_verify' ? t('verifyEmail') : (t('resetPassword') || 'Password Reset')}
          </h2>
          <p className="veetaa-login-subtitle">
            {t('enterCodeSentTo') || 'Enter the code sent to'}{' '}
            <span className="text-slate-900 font-black">{email}</span>
          </p>
        </div>
  
        <div className="flex justify-center gap-3 mb-10">
          {otp.map((digit, i) => (
            <input
              key={i}
              id={`email-otp-${i}`}
              type="tel"
              maxLength={1}
              className="w-12 h-16 text-center text-2xl font-black bg-slate-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all shadow-sm"
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
            />
          ))}
        </div>
  
        {purpose === 'password_reset' && (
          <div className="veetaa-login-form !gap-6 mb-8">
            <div className="veetaa-field">
              <label className="veetaa-label">{t('newPassword')}</label>
              <div className="veetaa-input-wrap">
                <Lock className="veetaa-input-icon" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="veetaa-input"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                  minLength={6}
                />
              </div>
            </div>
            <div className="veetaa-field">
              <label className="veetaa-label">{t('confirmPassword') || 'Confirm Password'}</label>
              <div className="veetaa-input-wrap">
                <Lock className="veetaa-input-icon" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="veetaa-input"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  minLength={6}
                />
              </div>
            </div>
          </div>
        )}
  
        {error && <p className="veetaa-error text-center mb-6">{error}</p>}
  
        <button
          onClick={handleVerify}
          disabled={!canSubmit || isLoading}
          className="veetaa-btn-primary"
        >
          {isLoading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" /> : t('verify')}
        </button>
  
        <div className="veetaa-login-links">
          <button
            onClick={handleResend}
            disabled={isResending}
            className="veetaa-link text-sm"
          >
            {isResending ? t('sending') : t('resendCode') || 'Resend Code'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailOtpVerification;
