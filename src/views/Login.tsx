import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Lock, Eye, EyeOff, User } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';
import { supabase, supabaseAnon } from '../lib/supabase-client';
import { normalizeMoroccoPhone, phoneToSyntheticEmail } from '../lib/authIdentity';

interface LoginProps {
  language: Language;
  onLogin: (email: string, user?: any) => void | Promise<void>;
  onGoToSignup: () => void;
  onForgotPassword?: (email: string) => void;
  initialEmail?: string;
  initialPassword?: string;
}

/** Délai maximal global pour éviter que l'UI ne reste bloquée indéfiniment */
const LOGIN_FAILSAFE_MS = 25_000;

const Login: React.FC<LoginProps> = ({
  language,
  onLogin,
  onGoToSignup,
  onForgotPassword,
  initialEmail = '',
  initialPassword = '',
}) => {
  // Accepte un e-mail ou un numéro de téléphone marocain
  const [identifier, setIdentifier] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const mountedRef = useRef(true);

  const t = (key: string) => TRANSLATIONS[language][key] || key;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetLoading = (v: boolean) => {
    if (mountedRef.current) setIsLoading(v);
  };

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError(
        language === 'ar'
          ? 'يرجى إدخال الهاتف أو البريد الإلكتروني'
          : language === 'en'
            ? 'Please enter your phone or email'
            : 'Veuillez saisir votre téléphone ou e-mail.'
      );
      return;
    }

    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }

    safeSetLoading(true);

    // Failsafe pour s'assurer que le chargement se désactive quoi qu'il arrive
    const failsafeId = window.setTimeout(() => {
      safeSetLoading(false);
      setError(
        language === 'ar'
          ? 'استغرق الطلب وقتاً طويلاً. يرجى المحاولة مرة أخرى.'
          : language === 'en'
            ? 'The request took too long. Please try again.'
            : 'La requête a pris trop de temps. Veuillez réessayer.'
      );
    }, LOGIN_FAILSAFE_MS);

    try {
      let loginEmail = trimmedIdentifier;
      let isPhone = false;
      let normalizedPhone = '';

      // Si l'identifiant ne contient pas @, c'est probablement un numéro de téléphone
      if (!trimmedIdentifier.includes('@')) {
        const phoneInfo = normalizeMoroccoPhone(trimmedIdentifier);
        if (!phoneInfo) {
          setError(
            language === 'ar'
              ? 'يرجى إدخال رقم هاتف صالح (9 أو 10 أرقام) أو بريد إلكتروني'
              : language === 'en'
                ? 'Please enter a valid phone number (9 or 10 digits) or email'
                : 'Veuillez saisir un numéro de téléphone valide (9 ou 10 chiffres) ou un e-mail.'
          );
          window.clearTimeout(failsafeId);
          safeSetLoading(false);
          return;
        }
        isPhone = true;
        normalizedPhone = phoneInfo.e164;
        // Email synthétique par défaut correspondant au numéro de téléphone
        loginEmail = phoneToSyntheticEmail(phoneInfo.e164);
      }

      // Si c'est un numéro de téléphone, on essaie d'abord de récupérer l'e-mail réel du profil
      if (isPhone) {
        try {
          const profileQuery = supabaseAnon
            .from('profiles')
            .select('email')
            .eq('phone', normalizedPhone)
            .maybeSingle();

          // Timeout de 4 secondes pour la requête de profil
          const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 4000)
          );

          const result = await Promise.race([profileQuery, timeoutPromise]);
          if (result && 'data' in result && result.data?.email) {
            loginEmail = result.data.email;
          }
        } catch (err) {
          console.warn('Could not fetch real email within timeout, falling back to synthetic:', err);
        }
      }

      console.log(`[Login] Attempting sign-in for: ${loginEmail}`);

      // Tentative de connexion par mot de passe
      let signInResult = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      // Si échec et que c'était un numéro de téléphone, on essaie de s'authentifier directement avec le téléphone
      if (signInResult.error && isPhone) {
        console.log(`[Login] Email sign-in failed, trying direct phone sign-in: ${normalizedPhone}`);
        const phoneSignIn = await supabase.auth.signInWithPassword({
          phone: normalizedPhone,
          password,
        });
        if (!phoneSignIn.error && phoneSignIn.data.user) {
          signInResult = phoneSignIn;
          loginEmail = normalizedPhone;
        }
      }

      if (signInResult.error) {
        console.error('[Login] Supabase auth error:', signInResult.error);
        const isInvalid = signInResult.error.message.toLowerCase().includes('invalid login credentials');
        setError(
          isInvalid
            ? (language === 'ar'
                ? 'الهاتف/البريد الإلكتروني أو كلمة المرور غير صحيحة'
                : language === 'en'
                  ? 'Incorrect phone/email or password'
                  : 'Téléphone/E-mail ou mot de passe incorrect')
            : signInResult.error.message
        );
        return;
      }

      if (signInResult.data.user) {
        console.log('[Login] Sign-in successful', signInResult.data.user);
        window.clearTimeout(failsafeId);
        await onLogin(loginEmail, signInResult.data.user);
      }
    } catch (err) {
      console.error('[Login] Unexpected error:', err);
      setError(err instanceof Error ? err.message : t('loginUnexpectedError'));
    } finally {
      window.clearTimeout(failsafeId);
      safeSetLoading(false);
    }
  };

  const handleForgotPasswordClick = () => {
    setError('');
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      setError(
        language === 'ar'
          ? 'يرجى إدخال البريد الإلكتروني أولاً'
          : language === 'en'
            ? 'Please enter your email first'
            : "Veuillez saisir votre e-mail d'abord."
      );
      return;
    }

    if (!trimmedIdentifier.includes('@')) {
      setError(
        language === 'ar'
          ? 'استرجاع كلمة المرور متاح فقط عبر البريد الإلكتروني'
          : language === 'en'
            ? 'Password recovery is only available via email'
            : 'La récupération de mot de passe est uniquement disponible via e-mail.'
      );
      return;
    }

    if (onForgotPassword) {
      onForgotPassword(trimmedIdentifier);
    }
  };

  return (
    <div className="veetaa-login-page">
      <div className="veetaa-login-card">
        <div className="veetaa-login-header">
          <h2 className="veetaa-login-title">{t('welcomeBack')}</h2>
          <p className="veetaa-login-subtitle">
            {language === 'ar'
              ? 'أدخل هاتفك أو بريدك الإلكتروني للمتابعة.'
              : language === 'en'
                ? 'Enter your phone or email to continue.'
                : 'Entrez votre téléphone ou e-mail pour continuer.'}
          </p>
        </div>

        <form onSubmit={validateAndSubmit} className="veetaa-login-form">
          <div className="veetaa-field">
            <label className="veetaa-label">
              {language === 'ar'
                ? 'الهاتف أو البريد الإلكتروني'
                : language === 'en'
                  ? 'Phone or Email'
                  : 'Téléphone ou E-mail'}
            </label>
            <div className="veetaa-input-wrap">
              <User className="veetaa-input-icon" aria-hidden />
              <input
                type="text"
                placeholder={
                  language === 'ar'
                    ? 'مثال: 06XXXXXXXX أو email@example.com'
                    : language === 'en'
                      ? 'e.g. 06XXXXXXXX or email@example.com'
                      : 'Ex: 06XXXXXXXX ou email@example.com'
                }
                className="veetaa-input"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError('');
                }}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="veetaa-field">
            <label className="veetaa-label">{t('password')}</label>
            <div className="veetaa-input-wrap" style={{ position: 'relative' }}>
              <Lock className="veetaa-input-icon" aria-hidden />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="veetaa-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && <p className="veetaa-error">{error}</p>}
          </div>

          <button type="submit" disabled={isLoading} className="veetaa-btn-primary">
            {isLoading ? t('loading') : t('login') || 'Se connecter'}
            <ArrowRight className="veetaa-btn-icon" aria-hidden />
          </button>
        </form>

        <div className="veetaa-login-links">
          <p className="veetaa-login-link-p">
            {t('noAccount')}{' '}
            <button type="button" onClick={onGoToSignup} className="veetaa-link">
              {t('signup')}
            </button>
          </p>
          {onForgotPassword && (
            <p className="veetaa-login-link-p">
              <button type="button" onClick={handleForgotPasswordClick} className="veetaa-link">
                {t('forgotPassword')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
