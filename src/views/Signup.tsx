import React, { useEffect, useState } from 'react';
import { User, Phone, Mail, ArrowRight, Lock } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';
import { supabase, supabaseAnon, getEmailRedirectUrl } from '../lib/supabase-client';
import { Db } from '../data/tables';
import { normalizeMoroccoPhone, phoneToSyntheticEmail } from '../lib/authIdentity';
import { sanitizeEmailInput, sanitizePlainText } from '../lib/security';
import OtpVerificationCard from '../components/OtpVerificationCard';
import TurnstileWidget from '../components/TurnstileWidget';

interface SignupProps {
  language: Language;
  onSignup: (name: string, email: string, password: string, phone?: string) => void;
  onGoToLogin: () => void;
}

const GENERIC_OTP_ERROR = 'Une erreur est survenue. Veuillez reessayer.';

const Signup: React.FC<SignupProps> = ({ language, onSignup, onGoToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verifiedPhoneE164, setVerifiedPhoneE164] = useState('');
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = window.setTimeout(() => setResendSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSecondsLeft]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sanitizePlainText(name, 80).trim().length < 3) {
      setError(t('enterFullName'));
      return;
    }
    const cleanEmail = sanitizeEmailInput(email);
    if (cleanEmail && !cleanEmail.includes('@')) {
      setError(t('invalidEmail') || 'Email invalide');
      return;
    }
    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }
    const phoneInfo = normalizeMoroccoPhone(phone);
    if (!phoneInfo) {
      setError(t('phoneError9Digits'));
      return;
    }
    if (!turnstileToken) {
      setError('Veuillez confirmer que vous êtes humain.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const verifiedPhoneE164 = phoneInfo.e164;
      const effectiveEmail = cleanEmail || phoneToSyntheticEmail(verifiedPhoneE164);
      const cleanName = sanitizePlainText(name, 80).trim();

      try {
        const { data: existingUser } = await supabaseAnon.from(Db.profiles).select('email').eq('email', effectiveEmail).single();
        if (existingUser) {
          setIsLoading(false);
          setError(t('emailAlreadyExists'));
          return;
        }
      } catch (emailCheckError: unknown) {
        const err = emailCheckError as { code?: string };
        if (err.code !== 'PGRST116') console.error('Error checking email:', emailCheckError);
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email: effectiveEmail,
        password,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
          data: { full_name: cleanName, phone: verifiedPhoneE164, phone_verified: true },
        },
      });

      setIsLoading(false);
      if (signupError) {
        let errMsg = signupError.message;
        if (
          errMsg.includes('profiles_phone_key') ||
          errMsg.includes('profiles_phone_unique') ||
          (errMsg.includes('phone') && (errMsg.includes('unique') || errMsg.includes('duplicate')))
        ) {
          errMsg =
            language === 'ar'
              ? 'رقم الهاتف هذا مسجل بالفعل لصالح حساب آخر.'
              : language === 'en'
                ? 'This phone number is already registered with another account.'
                : 'Ce numéro de téléphone est déjà associé à un autre compte.';
        }
        setError(errMsg);
        return;
      }
      if (data?.user) onSignup(cleanName, effectiveEmail, password, verifiedPhoneE164);
    } catch (err) {
      setIsLoading(false);
      let errMsg = err instanceof Error ? err.message : 'Erreur lors de la création du compte.';
      if (
        errMsg.includes('profiles_phone_key') ||
        errMsg.includes('profiles_phone_unique') ||
        (errMsg.includes('phone') && (errMsg.includes('unique') || errMsg.includes('duplicate')))
      ) {
        errMsg =
          language === 'ar'
            ? 'رقم الهاتف هذا مسجل بالفعل لصالح حساب آخر.'
            : language === 'en'
              ? 'This phone number is already registered with another account.'
              : 'Ce numéro de téléphone est déjà associé à un autre compte.';
      }
      setError(errMsg);
    }
  };

  const handleResendOtp = async () => {};
  const verifyOtpAndCreateAccount = async (code: string) => {};

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');

    // Supporte les saisies avec préfixe pays (212...) mais impose
    // l'affichage final local en 10 chiffres: 0XXXXXXXXX.
    let local = digits;
    if (local.startsWith('212')) {
      local = `0${local.slice(3)}`;
    }

    // Bloque les saisies trop longues au lieu de les accepter silencieusement.
    if (local.length > 10) {
      setError(t('phoneError9Digits'));
      return;
    }

    setPhone(local);
    if (error) setError('');
  };

  return (
    <div className="veetaa-login-page">
      <div className="veetaa-login-card">
        <div className="veetaa-login-header">
          <h2 className="veetaa-login-title">{t('welcomeSignup')}</h2>
          <p className="veetaa-login-subtitle">{t('createAccount')}</p>
        </div>

        <form onSubmit={sendOtp} className="veetaa-login-form">
          <div className="veetaa-field">
            <label className="veetaa-label">{t('fullName')}</label>
            <div className="veetaa-input-wrap">
              <User className="veetaa-input-icon" aria-hidden />
              <input
                type="text"
                placeholder={t('fullNamePlaceholder')}
                className="veetaa-input"
                value={name}
                onChange={(e) => { setName(sanitizePlainText(e.target.value, 80)); setError(''); }}
                required
              />
            </div>
          </div>

          <div className="veetaa-field">
            <label className="veetaa-label">{t('email')} ({t('optional')})</label>
            <div className="veetaa-input-wrap">
              <Mail className="veetaa-input-icon" aria-hidden />
              <input
                type="email"
                placeholder="exemple@email.com"
                className="veetaa-input"
                value={email}
                onChange={(e) => { setEmail(sanitizeEmailInput(e.target.value)); setError(''); }}
              />
            </div>
          </div>

          <div className="veetaa-field">
            <label className="veetaa-label">{t('phone')}</label>
            <div className="veetaa-signup-phone-row">
              <div className="veetaa-signup-phone-prefix">+212</div>
              <div className="veetaa-input-wrap">
                <Phone className="veetaa-input-icon" aria-hidden />
                <input
                  type="tel"
                  placeholder="6XX XXX XXX"
                  className="veetaa-input"
                  value={phone}
                  onChange={handlePhoneChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="veetaa-field">
            <label className="veetaa-label">{t('password')}</label>
            <div className="veetaa-input-wrap">
              <Lock className="veetaa-input-icon" aria-hidden />
              <input
                type="password"
                placeholder="••••••••"
                className="veetaa-input"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                required
                minLength={6}
              />
            </div>
            {error && <p className="veetaa-error">{error}</p>}
          </div>

          {!otpSent && (
            <TurnstileWidget
              siteKey="0x4AAAAAADgOUFfM6YkR96a6"
              onVerify={(token) => {
                setTurnstileToken(token);
                setError('');
              }}
              onExpire={() => setTurnstileToken('')}
              onError={() => setError('Échec de la vérification Cloudflare Turnstile')}
            />
          )}

          {!otpSent ? (
            <button type="submit" disabled={isLoading} className="veetaa-btn-primary">
              {isLoading ? t('loading') : t('signup') || "S'inscrire"}
              <ArrowRight className="veetaa-btn-icon" aria-hidden />
            </button>
          ) : (
            <></>
          )}
        </form>

        <div className="veetaa-login-links">
          <p className="veetaa-login-link-p">
            {t('alreadyHaveAccount')}{' '}
            <button type="button" onClick={onGoToLogin} className="veetaa-link">
              {t('login')}
            </button>
          </p>
        </div>
      </div>

      {otpSent && (
        <div className="otp-overlay" role="dialog" aria-modal="true">
          <div className="otp-overlay-card">
            <OtpVerificationCard
              titleTop="OTP"
              titleBottom="Verification Code"
              message={`${t('enterCodeSentTo') || 'Entrez le code envoye a'} ${verifiedPhoneE164}`}
              actionLabel={t('verify') || 'Verifier'}
              isLoading={isLoading}
              onVerify={verifyOtpAndCreateAccount}
              onResend={handleResendOtp}
              resendSecondsLeft={resendSecondsLeft}
              resendLabel={t('resendCode') || 'Renvoyer code'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Signup;
