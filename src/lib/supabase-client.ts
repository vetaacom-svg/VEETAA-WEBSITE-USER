// Client Supabase moderne avec gestion d'erreurs robuste
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, validateConfig, getSupabaseDirectUrl, getSupabaseApiUrl } from '../config/supabase-config';
import { Db } from '../data/tables';

// Validation au démarrage
const configErrors = validateConfig();
if (configErrors.length > 0) {
  console.error('%c❌ ERREURS DE CONFIGURATION SUPABASE:', 'color: red; font-weight: bold; font-size: 14px;');
  configErrors.forEach(error => console.error(`- ${error}`));
}

const SUPABASE_DIRECT_URL = getSupabaseDirectUrl();
/** URL réelle des appels API (en dev : souvent le proxy Vite, pas *.supabase.co). */
const SUPABASE_CLIENT_URL =
  typeof window !== 'undefined' ? getSupabaseApiUrl() : getSupabaseDirectUrl();
const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_DELAYS_MS = [800, 1800];
const MEMORY_AUTH_STORAGE = new Map<string, string>();

type SupabaseAuthStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(new DOMException('Request timeout', 'TimeoutError')), timeoutMs);
  return c.signal;
}

function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  const c = new AbortController();
  const onAbort = () => c.abort();
  if (a.aborted || b.aborted) c.abort();
  else {
    a.addEventListener('abort', onAbort, { once: true });
    b.addEventListener('abort', onAbort, { once: true });
  }
  return c.signal;
}

function isRetriableNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException) {
    if (err.name === 'AbortError') return false;
    if (err.name === 'TimeoutError') return true;
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound')
  );
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function canUseLocalStorageSafely(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probeKey = '__veetaa_storage_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

// Utilise localStorage pour que la session survive aux rechargements de page (F5).
// sessionStorage est vidé à chaque refresh, ce qui déconnectait l'utilisateur.
function createSafeAuthStorage(): SupabaseAuthStorage {
  if (canUseLocalStorageSafely()) {
    return {
      getItem: (key) => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return MEMORY_AUTH_STORAGE.get(key) ?? null;
        }
      },
      setItem: (key, value) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          MEMORY_AUTH_STORAGE.set(key, value);
        }
      },
      removeItem: (key) => {
        try {
          window.localStorage.removeItem(key);
        } catch {
          MEMORY_AUTH_STORAGE.delete(key);
        }
      },
    };
  }
  return {
    getItem: (key) => MEMORY_AUTH_STORAGE.get(key) ?? null,
    setItem: (key, value) => {
      MEMORY_AUTH_STORAGE.set(key, value);
    },
    removeItem: (key) => {
      MEMORY_AUTH_STORAGE.delete(key);
    },
  };
}

async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const attempts = 1 + RETRY_DELAYS_MS.length;
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const signal = mergeSignals(init?.signal ?? undefined, createTimeoutSignal(REQUEST_TIMEOUT_MS));
      const res = await fetch(input, { ...init, signal });
      if (isRetriableStatus(res.status) && i < attempts - 1) {
        await sleep(RETRY_DELAYS_MS[i] ?? 500);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (!isRetriableNetworkError(e) || i >= attempts - 1) throw e;
      await sleep(RETRY_DELAYS_MS[i] ?? 500);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network request failed');
}

// Même URL que `getSupabaseApiUrl()` en navigateur (dev → proxy Vite par défaut).
export const supabase = createClient(SUPABASE_CLIENT_URL, SUPABASE_CONFIG.ANON_KEY, {
  auth: {
    storage: createSafeAuthStorage(),
    autoRefreshToken: true,
    // Session dans localStorage (clé `veetaa-auth-token`) ; survit aux rechargements F5.
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'veetaa-auth-token',
    // Pas de PKCE : le flux implicit évite les échanges de code manquants au rechargement (F5).
    // flowType non spécifié → défaut Supabase v2 ('implicit' dans les navigateurs).
    // Pas de lock personnalisé → le client Supabase utilise son BroadcastChannel interne
    // qui empêche les double-rafraîchissements de token (Refresh Token Reuse Attack).
  },
  // Options globales pour éviter les timeouts
  global: {
    headers: {
      'X-Client-Info': 'veetaa-website/1.0.0'
    },
    fetch: resilientFetch,
  },
  realtime: {
    transport: typeof window !== 'undefined' ? class extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        let finalUrl = String(url);
        if (finalUrl.includes('realtime/v1/websocket') && SUPABASE_DIRECT_URL) {
          const directWsBase = SUPABASE_DIRECT_URL.replace(/^http/, 'ws');
          finalUrl = finalUrl.replace(/^wss?:\/\/[^\/]+/, directWsBase);
        }
        super(finalUrl, protocols);
      }
    } : undefined,
  }
});

/**
 * Client Supabase anonyme dédié aux requêtes catalogue (catégories, magasins, produits).
 * N'a JAMAIS de session auth → n'est JAMAIS bloqué par un refresh de token en cours.
 * Utiliser ce client pour toute lecture de données publiques (RLS anon).
 */
export const supabaseAnon = createClient(SUPABASE_CLIENT_URL, SUPABASE_CONFIG.ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'veetaa-catalog/1.0.0' },
    fetch: resilientFetch,
  },
});

if (import.meta.env.DEV && typeof window !== 'undefined') {
  console.info(
    '%cVeetaa%c Supabase API → %c' + SUPABASE_CLIENT_URL + (SUPABASE_CLIENT_URL.includes('supabase.co') ? '' : ' (proxy Vite)'),
    'color:#ea580c;font-weight:bold',
    'color:#64748b',
    'color:#0f172a;font-family:monospace'
  );
}

// Fonction de test de connexion avec retry et debug CORS
export const testSupabaseConnection = async (): Promise<{ success: boolean; error?: string; details?: any }> => {
  if (import.meta.env.DEV) {
    console.log('%c🔍 TEST DE CONNEXION SUPABASE', 'color: blue; font-weight: bold;');
    console.log('🌐 URL:', SUPABASE_CLIENT_URL);
    console.log('🔑 Key length:', SUPABASE_CONFIG.ANON_KEY.length);
  }
  
  try {
    // Test via le client anon (jamais bloqué par refresh de token).
    if (import.meta.env.DEV) console.log('🔍 Test: Requête Supabase anon...');
    const { data, error } = await supabaseAnon.from(Db.categories).select('count', { count: 'exact', head: true });

    if (import.meta.env.DEV) console.log('📊 Supabase Response:', { data, error });
    
    if (error) {
      console.error('❌ Supabase Auth/Connection Error:', error.message);
      return {
        success: false,
        error: `Supabase Error: ${error.message}`,
        details: { error, code: error.code, details: error.details }
      };
    }
    
    return {
      success: true,
      details: { categoriesCount: data?.[0] || 'Connected' }
    };
    
  } catch (err) {
    console.error('❌ Exception complète:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur inconnue',
      details: {
        stack: err instanceof Error ? err.stack : null,
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err)
      }
    };
  }
};

export const getEmailRedirectUrl = () =>
  (import.meta.env.VITE_EMAIL_REDIRECT_URL || 'https://confirmed-email.vercel.app/').trim();

export async function invokeEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<{ data?: T; error?: string }> {
  const base = typeof window !== 'undefined' ? getSupabaseApiUrl() : getSupabaseDirectUrl();
  const url = `${base.replace(/\/$/, '')}/functions/v1/${name}`;
  const key = SUPABASE_CONFIG.ANON_KEY;
  const res = await resilientFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: (data as { error?: string }).error || 'Request failed' };
  }
  return { data: data as T };
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export default supabase;
