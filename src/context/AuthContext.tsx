import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getEmailRedirectUrl } from '../lib/supabase-client';
import { profileByIdQuery, updateProfileRow } from '../data/repos/profilesRepo';
import { UserProfile, Language } from '../types';


/** Erreurs PostgREST / GoTrue où garder un vieux token bloque toutes les requêtes jusqu’à « effacer les cookies ». */
function looksLikeInvalidAuthSession(err: { message?: string; code?: string; status?: number }): boolean {
  const m = (err.message || '').toLowerCase();
  const code = String(err.code || '');
  if (code === 'PGRST301') return true;
  if (m.includes('invalid refresh token')) return true;
  if (m.includes('refresh token not found')) return true;
  if (m.includes('jwt expired')) return true;
  if (m.includes('invalid jwt')) return true;
  if (err.status === 401 && (m.includes('jwt') || m.includes('bearer'))) return true;
  return false;
}

/** Vide la session Supabase en local (clé `veetaa-auth-token` + profil cache) sans appel réseau obligatoire. */
async function clearStaleSupabaseSession(reason: string) {
  if (import.meta.env.DEV) {
    console.warn(`[auth] ${reason} — nettoyage session locale (stockage type « cookies / données du site »).`);
  }
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    try { localStorage.removeItem('veetaa-auth-token'); } catch {}
  }
  try { localStorage.removeItem('veetaa_user'); } catch {}
}

function looksLikeTransientNetworkError(err: { message?: string; code?: string; status?: number }): boolean {
  const m = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  if (err.status === 408 || err.status === 429 || (typeof err.status === 'number' && err.status >= 500)) return true;
  if (code === 'ECONNRESET' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') return true;
  return (
    m.includes('timeout') ||
    m.includes('failed to fetch') ||
    m.includes('network') ||
    m.includes('fetch')
  );
}

function isSecurityDeniedError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'SecurityError') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes('securityerror') || msg.toLowerCase().includes('request was denied');
}

async function withRetries<T>(run: () => Promise<T>, retries = 2, delaysMs: number[] = [400, 1000]): Promise<T> {
  let lastError: unknown = null;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await run();
    } catch (e) {
      lastError = e;
      if (i >= retries) break;
      const d = delaysMs[i] ?? 600;
      await new Promise((resolve) => setTimeout(resolve, d));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unknown network error');
}

export interface AuthContextValue {
  user: UserProfile | null;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  isAuthLoading: boolean;
  isBlocked: boolean;
  setIsBlocked: (b: boolean) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  pendingEmail: string;
  setPendingEmail: (e: string) => void;
  pendingPhone: string;
  setPendingPhone: (p: string) => void;
  pendingName: string;
  setPendingName: (n: string) => void;
  pendingPassword: string;
  setPendingPassword: (p: string) => void;
  pendingOtpPurpose: 'email_verify' | 'password_reset';
  setPendingOtpPurpose: (p: 'email_verify' | 'password_reset') => void;
  handleLogout: () => Promise<void>;
  handleLoginSuccess: (email: string, authUser?: any) => Promise<void>;
  handleForgotPassword: (email: string) => Promise<void>;
  handleSignupSuccess: (name: string, email: string, password?: string, phone?: string) => void;
  handleEmailOtpVerified: () => void;
  handlePasswordResetSuccess: () => void;
  handleProfileSave: (fullName: string, email: string, phone: string) => Promise<void>;
  handlePermissionsGranted: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Sauvegarde le profil utilisateur en localStorage (survit aux rechargements F5). */
function persistUserToStorage(userData: UserProfile): void {
  try { localStorage.setItem('veetaa_user', JSON.stringify(userData)); } catch { /* ignore */ }
}

/** Supprime le profil utilisateur du localStorage. */
function clearUserFromStorage(): void {
  try { localStorage.removeItem('veetaa_user'); } catch { /* ignore */ }
}

/** Lecture instantanée du profil depuis localStorage (avant tout appel réseau). */
function readUserFromStorage(): UserProfile | null {
  try {
    const raw = localStorage.getItem('veetaa_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed?.id && parsed?.isLoggedIn) return parsed;
  } catch { /* ignore */ }
  return null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => readUserFromStorage());
  const [isAuthLoading, setIsAuthLoading] = useState(() => !readUserFromStorage());
  const [isBlocked, setIsBlocked] = useState(false);
  const [language, setLanguageState] = useState<Language>('fr');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [pendingOtpPurpose, setPendingOtpPurpose] = useState<'email_verify' | 'password_reset'>('email_verify');
  const navigate = useNavigate();

  const lastFetchedUserIdRef = useRef<string | null>(null);

  // Unification de la restauration de session et du suivi d'état via onAuthStateChange
  useEffect(() => {
    let active = true;

    // Failsafe timer de 8s pour éviter le blocage du loader
    const failsafeTimer = setTimeout(() => {
      if (active) {
        if (import.meta.env.DEV) {
          console.warn('[auth] Failsafe timer reached (8s) — forcing isAuthLoading to false');
        }
        setIsAuthLoading(false);
      }
    }, 8000);

    // Affiche immédiatement le profil mis en cache dans localStorage
    const cachedUser = readUserFromStorage();
    if (cachedUser) {
      setUser(cachedUser);
      if (cachedUser.language) setLanguageState(cachedUser.language);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (import.meta.env.DEV) {
        console.log(`[auth] onAuthStateChange event: ${event}`, session?.user?.id);
      }

      try {
        if (event === 'SIGNED_OUT' || !session?.user) {
          if (!active) return;
          clearTimeout(failsafeTimer);
          lastFetchedUserIdRef.current = null;
          setUser(null);
          clearUserFromStorage();
          setIsAuthLoading(false);
          return;
        }

        const userId = session.user.id;

        // On construit immédiatement les données utilisateur à partir de la session / du cache
        const cached = readUserFromStorage();
        const baseUserData: UserProfile = {
          id: userId,
          email: session.user.email || '',
          fullName: session.user.user_metadata?.full_name || cached?.fullName || '',
          phone: session.user.user_metadata?.phone || cached?.phone || '',
          language: (session.user.user_metadata?.language as Language) || cached?.language || 'fr',
          isLoggedIn: true,
          isAdmin: cached?.id === userId ? cached.isAdmin : false,
        };

        if (active) {
          setUser(baseUserData);
          if (baseUserData.language) setLanguageState(baseUserData.language);
          setIsAuthLoading(false);
          clearTimeout(failsafeTimer);
        }

        // Si le profil DB a déjà été chargé pour cet utilisateur lors de cette session (et pas USER_UPDATED),
        // on évite le fetch en arrière-plan redondant
        if (lastFetchedUserIdRef.current === userId && event !== 'USER_UPDATED') {
          return;
        }

        lastFetchedUserIdRef.current = userId;

        // Lancement du fetch DB en arrière-plan (non-bloquant)
        (async () => {
          try {
            const { data: profile, error: profileError } = await withRetries(
              async () => await profileByIdQuery(userId).maybeSingle(),
              2
            );

            if (!active) return;

            if (profileError) {
              if (looksLikeInvalidAuthSession(profileError)) {
                await clearStaleSupabaseSession(`onAuthStateChange error: ${profileError.message}`);
                lastFetchedUserIdRef.current = null;
                setUser(null);
                clearUserFromStorage();
              }
              return;
            }

            const userData: UserProfile = {
              id: userId,
              email: session.user.email || '',
              fullName: profile?.full_name || session.user.user_metadata?.full_name || '',
              phone: profile?.phone || session.user.user_metadata?.phone || '',
              language: (profile?.language as Language) || 'fr',
              isLoggedIn: true,
              isAdmin: profile?.is_admin === true,
            };

            setIsBlocked(profile?.is_blocked || false);
            setUser(userData);
            persistUserToStorage(userData);
            if (userData.language) setLanguageState(userData.language);
          } catch (bgErr) {
            console.error('[auth] Background profile sync exception:', bgErr);
          }
        })();

      } catch (e) {
        if (!active) return;
        if (isSecurityDeniedError(e)) {
          lastFetchedUserIdRef.current = null;
          setUser(null);
          clearUserFromStorage();
        }
        console.error('Session sync error:', e);
      } finally {
        if (active) {
          setIsAuthLoading(false);
          clearTimeout(failsafeTimer);
        }
      }
    });

    return () => {
      active = false;
      clearTimeout(failsafeTimer);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsBlocked(false);
    clearUserFromStorage();
    try { localStorage.removeItem('veetaa-auth-token'); } catch { /* ignore */ }
    navigate('/');
  }, [navigate]);

  const setLanguage = useCallback((l: Language) => {
    setLanguageState(l);
    if (user) {
      const updated = { ...user, language: l };
      setUser(updated);
      try { localStorage.setItem('veetaa_user', JSON.stringify(updated)); } catch {}
    }
  }, [user]);

  const handleLoginSuccess = useCallback(async (email: string, authUser?: any) => {
    const userToUse =
      authUser ||
      (
        await Promise.race([
          supabase.auth.getUser().then((r) => r.data?.user ?? null),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2000)),
        ])
      );

    if (userToUse) {
      const cached = readUserFromStorage();
      const userData: UserProfile = {
        id: userToUse.id,
        email: email || userToUse.email || '',
        fullName: userToUse.user_metadata?.full_name || cached?.fullName || '',
        phone: userToUse.user_metadata?.phone || cached?.phone || '',
        language: (userToUse.user_metadata?.language as Language) || cached?.language || 'fr',
        isLoggedIn: true,
        isAdmin: (cached && cached.id === userToUse.id) ? cached.isAdmin : false,
      };
      
      setUser(userData);
      persistUserToStorage(userData);
      try { localStorage.setItem('veetaa_last_email', email); } catch { /* ignore */ }
      if (userData.language) setLanguageState(userData.language);

      // On lance le fetch en tâche de fond (non-bloquant) pour enrichir
      (async () => {
        try {
          const { data: profile } = await profileByIdQuery(userToUse.id).maybeSingle();
          if (profile) {
            const enrichedData: UserProfile = {
              ...userData,
              fullName: profile.full_name || userData.fullName,
              phone: profile.phone || userData.phone,
              language: (profile.language as Language) || userData.language,
              isAdmin: profile.is_admin === true,
            };
            setIsBlocked(profile.is_blocked || false);
            setUser(enrichedData);
            persistUserToStorage(enrichedData);
            if (enrichedData.language) setLanguageState(enrichedData.language);
          }
        } catch (err) {
          console.warn('[auth] handleLoginSuccess bg fetch error:', err);
        }
      })();
    }
  }, []);

  const handleForgotPassword = useCallback(async (email: string) => {
    setPendingEmail(email);
    setPendingOtpPurpose('password_reset');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getEmailRedirectUrl(),
    });
    if (error) throw new Error(error.message);
    navigate('/email-otp-verify');
  }, [navigate]);

  const handleSignupSuccess = useCallback((name: string, email: string, _password?: string, phone?: string) => {
    setPendingEmail(email);
    setPendingName(name);
    setPendingPhone(phone || '');
    navigate('/permissions');
  }, [navigate]);

  const handleEmailOtpVerified = useCallback(() => {
    if (pendingOtpPurpose === 'email_verify') navigate('/permissions');
    else navigate('/password-reset');
  }, [pendingOtpPurpose, navigate]);

  const handlePasswordResetSuccess = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  const handleProfileSave = useCallback(async (fullName: string, email: string, phone: string) => {
    if (!user?.id) return;
    const updates: Record<string, unknown> = {
      full_name: fullName,
      phone,
      updated_at: new Date().toISOString(),
    };
    if (email) updates.email = email;
    const { error } = await updateProfileRow(user.id, updates);
    if (error) throw new Error(error.message);
    const newUser = {
      ...user,
      fullName,
      email: email || user.email || '',
      phone,
    };
    setUser(newUser);
    persistUserToStorage(newUser);
  }, [user]);

  const handlePermissionsGranted = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  const value = useMemo(() => ({
    user,
    setUser,
    isAuthLoading,
    isBlocked,
    setIsBlocked,
    language,
    setLanguage,
    pendingEmail,
    setPendingEmail,
    pendingPhone,
    setPendingPhone,
    pendingName,
    setPendingName,
    pendingPassword,
    setPendingPassword,
    pendingOtpPurpose,
    setPendingOtpPurpose,
    handleLogout,
    handleLoginSuccess,
    handleForgotPassword,
    handleSignupSuccess,
    handleEmailOtpVerified,
    handlePasswordResetSuccess,
    handleProfileSave,
    handlePermissionsGranted
  }), [
    user, isAuthLoading, isBlocked, language, setLanguage, pendingEmail, pendingPhone, pendingName, pendingPassword, pendingOtpPurpose, 
    handleLogout, handleLoginSuccess, handleForgotPassword, handleSignupSuccess, handleEmailOtpVerified, 
    handlePasswordResetSuccess, handleProfileSave, handlePermissionsGranted
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
