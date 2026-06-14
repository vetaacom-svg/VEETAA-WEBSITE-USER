
import React from 'react';
import { Mail, CheckCircle2 } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase, getEmailRedirectUrl } from '../lib/supabase-client';

interface EmailVerificationProps {
  language: Language;
  email: string;
  onGoToLogin: () => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ language, email, onGoToLogin }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [isResending, setIsResending] = React.useState(false);
  const [resendStatus, setResendStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const handleResend = async () => {
    if (isResending) return;
    setIsResending(true);
    setResendStatus('idle');
    setErrorMessage('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: getEmailRedirectUrl()
        }
      });

      if (error) {
        setResendStatus('error');
        // Handle specific Supabase errors if needed
        if (error.status === 429) {
          setErrorMessage(t('tooManyRequests') || 'Trop de tentatives. Veuillez attendre.');
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setResendStatus('success');
      }
    } catch (err: any) {
      setResendStatus('error');
      setErrorMessage(err.message || 'Une erreur est survenue.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-white">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-emerald-500 w-24 h-24 rounded-full flex items-center justify-center shadow-xl">
              <Mail className="w-12 h-12 text-white" />
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-lg">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {t('verifyEmail')}
          </h1>
          <p className="text-slate-600 leading-relaxed">
            {t('verifyEmailMessage')}
          </p>
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-orange-700 break-all">
              {email}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {t('checkSpamFolder')}
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={onGoToLogin}
          className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-orange-200 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
        >
          {t('goToLogin')}
        </button>

        {/* Info */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
          <h3 className="font-black text-sm text-slate-700 flex items-center gap-2">
            <Mail className="w-4 h-4 text-orange-600" />
            {t('didntReceiveEmail')}
          </h3>
          <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
            <li>{t('checkSpamFolder')}</li>
            <li>{t('waitFewMinutes')}</li>
            <li>{t('checkEmailTypo')}</li>
          </ul>

          <div className="pt-2 border-t border-slate-200 mt-2">
            {resendStatus === 'success' ? (
              <p className="text-sm text-emerald-600 font-bold text-center animate-in fade-in">
                {t('emailResent') || 'Email renvoyé avec succès checkez votre boite mail!'}
              </p>
            ) : (
              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={isResending}
                  className="text-sm text-orange-600 font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? (t('sending') || 'Envoi en cours...') : (t('resendEmail') || 'Renvoyer l\'email de confirmation')}
                </button>
                {resendStatus === 'error' && (
                  <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
