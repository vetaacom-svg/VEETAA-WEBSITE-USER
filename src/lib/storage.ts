import type { CartItem } from '../types';

type JsonValidator = (value: unknown) => boolean;
const MEMORY_STORAGE = new Map<string, string>();

function canUseStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probeKey = '__veetaa_session_storage_probe__';
    window.sessionStorage.setItem(probeKey, '1');
    window.sessionStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function canUseLocalStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probeKey = '__veetaa_local_storage_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}


function isQuotaExceededError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return e.name === 'QuotaExceededError' || e.code === 22;
}

const CART_KEY = 'veetaa_cart';

/**
 * Clés « données métier » dans sessionStorage (hors session Supabase `veetaa-auth-token` et profil `veetaa_user`).
 * Les retirer libère de la place (~5 Mo max navigateur) sans déconnecter.
 */
export const VEETAA_CLEARABLE_DATA_KEYS = [
  CART_KEY,
  'veetaa_favorites',
  'veetaa_notification_preferences',
  'userLocation',
  'veetaa_app_settings_cache_v1',
  'veetaa_map_picker_height_px',
  'veetaa_live_map_frame_height_px',
  'veetaa_admin_live_map_frame_h',
  'veetaa_admin_live_map_frame_h_v2',
] as const;

/** Supprime panier, favoris, cache carte, cache paramètres, etc. Garde la connexion (token + veetaa_user). */
export function clearVeetaaSessionDataPreservingAuth(): void {
  for (const k of VEETAA_CLEARABLE_DATA_KEYS) {
    safeRemoveItem(k);
    MEMORY_STORAGE.delete(k);
  }
}

/** Taille UTF-8 approximative des seules clés effaçables (hors token / profil). */
export function measureVeetaaClearableSessionBytes(): number {
  if (typeof window === 'undefined' || !canUseStorage()) return 0;
  try {
    const enc = new TextEncoder();
    let n = 0;
    for (const k of VEETAA_CLEARABLE_DATA_KEYS) {
      const v = window.sessionStorage.getItem(k);
      if (v) n += enc.encode(k).length + enc.encode(v).length;
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * Seuil par défaut (~2,5 Mo) : au-delà, risque de `QuotaExceededError` sur sessionStorage (~5 Mo total).
 * Ajustable via `VITE_AUTO_CLEAR_STORAGE_BYTES` (nombre entier, octets).
 */
function getAutoClearThresholdBytes(): number {
  const raw = import.meta.env.VITE_AUTO_CLEAR_STORAGE_BYTES;
  if (raw) {
    const n = parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n) && n > 512 * 1024) return n;
  }
  return Math.floor(2.5 * 1024 * 1024);
}

/**
 * Si les données effaçables dépassent le seuil : nettoyage identique au bouton Paramètres (sans déconnexion).
 * Retourne `true` si un vidage a eu lieu → l’appelant doit en général `location.reload()` pour resynchroniser React.
 */
export function autoClearVeetaaDataIfHeavy(): boolean {
  if (!canUseStorage()) return false;
  sanitizeVeetaaStorage();
  const threshold = getAutoClearThresholdBytes();
  if (measureVeetaaClearableSessionBytes() < threshold) return false;
  clearVeetaaSessionDataPreservingAuth();
  sanitizeVeetaaStorage();
  return true;
}

/** Nettoyage léger quand l’utilisateur revient sur l’onglet (évite l’accumulation sans recharger). */
let sanitizeVisTimeout: number | null = null;
export function scheduleVeetaaStorageSanitizeOnVisible(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const run = () => {
    sanitizeVisTimeout = null;
    sanitizeVeetaaStorage();
  };
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState !== 'visible') return;
      if (sanitizeVisTimeout != null) window.clearTimeout(sanitizeVisTimeout);
      sanitizeVisTimeout = window.setTimeout(run, 400);
    },
    { passive: true }
  );
}

/** Panier allégé pour le stockage : pas de base64 (photos ordonnance / pièces jointes). */
export function stripCartForStorage(items: CartItem[]): CartItem[] {
  return items.map((item) => {
    const next = { ...item };
    if (next.image_base64 && next.image_base64.length > 0) {
      delete next.image_base64;
    }
    return next;
  });
}

function emergencyFreeSessionStorage(): void {
  try {
    sessionStorage.removeItem('veetaa_app_settings_cache_v1');
    sessionStorage.removeItem(CART_KEY);
  } catch {
    /* ignore */
  }
}

export function safeGetItem(key: string): string | null {
  if (!canUseStorage()) return MEMORY_STORAGE.get(key) ?? null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return MEMORY_STORAGE.get(key) ?? null;
  }
}

export function safeSetItem(key: string, value: string): void {
  const tryMemory = () => {
    MEMORY_STORAGE.set(key, value);
  };

  if (!canUseStorage()) {
    tryMemory();
    return;
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch (e) {
    if (isQuotaExceededError(e)) {
      if (key === CART_KEY) {
        try {
          const parsed = JSON.parse(value) as CartItem[];
          if (Array.isArray(parsed)) {
            const lite = stripCartForStorage(parsed);
            const liteStr = JSON.stringify(lite);
            try {
              window.sessionStorage.setItem(key, liteStr);
              return;
            } catch {
              emergencyFreeSessionStorage();
              try {
                window.sessionStorage.setItem(key, liteStr);
                return;
              } catch {
                /* fall through */
              }
            }
          }
        } catch {
          emergencyFreeSessionStorage();
          try {
            window.sessionStorage.setItem(key, '[]');
            return;
          } catch {
            /* fall through */
          }
        }
      } else {
        emergencyFreeSessionStorage();
        try {
          window.sessionStorage.setItem(key, value);
          return;
        } catch {
          /* fall through */
        }
      }
    }
    tryMemory();
  }
}

export function safeRemoveItem(key: string): void {
  if (!canUseStorage()) {
    MEMORY_STORAGE.delete(key);
    return;
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    MEMORY_STORAGE.delete(key);
  }
}

export function safeGetJSON<T>(key: string, validate?: JsonValidator): T | null {
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as T;
    if (validate && !validate(parsed)) {
      safeRemoveItem(key);
      return null;
    }
    return parsed;
  } catch {
    safeRemoveItem(key);
    return null;
  }
}

export function safeSetJSON(key: string, value: unknown): void {
  try {
    safeSetItem(key, JSON.stringify(value));
  } catch {
    /* ignore serialization errors */
  }
}

export function localGetItem(key: string): string | null {
  if (!canUseLocalStorage()) return MEMORY_STORAGE.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return MEMORY_STORAGE.get(key) ?? null;
  }
}

export function localSetItem(key: string, value: string): void {
  if (!canUseLocalStorage()) {
    MEMORY_STORAGE.set(key, value);
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    MEMORY_STORAGE.set(key, value);
  }
}

export function localRemoveItem(key: string): void {
  if (!canUseLocalStorage()) {
    MEMORY_STORAGE.delete(key);
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    MEMORY_STORAGE.delete(key);
  }
}

export function localGetJSON<T>(key: string, validate?: JsonValidator): T | null {
  const raw = localGetItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as T;
    if (validate && !validate(parsed)) {
      localRemoveItem(key);
      return null;
    }
    return parsed;
  } catch {
    localRemoveItem(key);
    return null;
  }
}

export function localSetJSON(key: string, value: unknown): void {
  try {
    localSetItem(key, JSON.stringify(value));
  } catch {
    /* ignore serialization errors */
  }
}


function isObjectLike(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function validateSupabaseSessionLike(v: unknown): boolean {
  if (!isObjectLike(v)) return false;
  const hasAccessToken = typeof v.access_token === 'string' || typeof v.currentSession === 'object';
  const hasUserLike = typeof v.user === 'object' || typeof v.currentUser === 'object' || typeof v.expires_at === 'number';
  return hasAccessToken || hasUserLike;
}

function validateCartItems(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  for (const row of v) {
    if (!isObjectLike(row)) return false;
    if (typeof row.quantity !== 'number') return false;
  }
  return true;
}

/** Au démarrage : retire les base64 du panier persisté et les données corrompues. */
export function sanitizeVeetaaStorage(): void {
  if (canUseLocalStorage()) {
    localGetJSON('veetaa-auth-token', validateSupabaseSessionLike);
    localGetJSON('veetaa_user', isObjectLike);
  }

  if (!canUseStorage()) return;


  const cartRaw = safeGetItem(CART_KEY);
  if (cartRaw) {
    try {
      const arr = JSON.parse(cartRaw) as unknown;
      if (Array.isArray(arr) && validateCartItems(arr)) {
        const stripped = stripCartForStorage(arr as CartItem[]);
        const next = JSON.stringify(stripped);
        if (next !== cartRaw) {
          safeSetItem(CART_KEY, next);
        }
      } else {
        safeRemoveItem(CART_KEY);
      }
    } catch {
      safeRemoveItem(CART_KEY);
    }
  }

  safeGetJSON('veetaa_favorites', Array.isArray);
  safeGetJSON('veetaa_notification_preferences', isObjectLike);
  safeGetJSON('userLocation', isObjectLike);
  safeGetJSON('veetaa_app_settings_cache_v1', isObjectLike);

  const nonCriticalKeys = [
    'veetaa_map_picker_height_px',
    'veetaa_live_map_frame_height_px',
    'veetaa_admin_live_map_frame_h',
    'veetaa_admin_live_map_frame_h_v2',
  ];
  nonCriticalKeys.forEach((k) => {
    const v = safeGetItem(k);
    if (v == null) return;
    if (!/^\d+$/.test(v.trim())) safeRemoveItem(k);
  });
}
