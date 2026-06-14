// Obligatoire : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans `.env` (voir `.env.example`).
// Aucune clé ni URL de projet ne doit être commitée dans le dépôt.

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * URL utilisée par @supabase/supabase-js (REST, auth, storage, realtime, functions).
 *
 * Dev : par défaut **proxy Vite** (`window.location.origin` → `/rest/v1` …) pour éviter blocages / timeouts
 * vers `*.supabase.co` (Brave, DNS, réseau). Désactiver : `VITE_SUPABASE_DEV_PROXY=false`.
 * Même machine, deux liens ≠ même origine : `http://localhost:3001` et `http://192.168.x.x:3001` (ou `127.0.0.1`)
 * ont des règles Brave / navigateur différentes ; si `localhost` échoue, utiliser `127.0.0.1` ou l’IP LAN qui marche.
 * Prod : `VITE_SUPABASE_SAME_ORIGIN=true` + rewrites (vercel.json) sur le domaine déployé.
 *
 * Forcer l’URL directe partout : `VITE_SUPABASE_ALWAYS_DIRECT=true`
 */
function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  );
}

export function getSupabaseApiUrl(): string {
  const direct = envUrl;

  if (typeof window === 'undefined') return direct;
  if (import.meta.env.VITE_SUPABASE_ALWAYS_DIRECT === 'true') return direct;

  if (import.meta.env.DEV) {
    if (import.meta.env.VITE_SUPABASE_DEV_PROXY === 'false') return direct;
    return window.location.origin;
  }

  if (import.meta.env.VITE_SUPABASE_SAME_ORIGIN === 'true') {
    const host = window.location.hostname;
    const port = window.location.port;
    // `vite preview` (ports par défaut) : proxy actif → garder même origine.
    const vitePreview = port === '4173' || port === '4174';
    if (isLocalHostname(host)) {
      if (vitePreview) return window.location.origin;
      // Autre serveur local (ex. `serve dist`) : /rest/v1 tombe sur index.html → timeouts.
      return direct;
    }
    return window.location.origin;
  }

  return direct;
}

/**
 * URL Supabase directe (HTTPS) sans logique de proxy/same-origin.
 * À utiliser quand on veut bypass total du proxy Vite.
 */
export function getSupabaseDirectUrl(): string {
  return envUrl;
}

const SUPABASE_CONFIG = {
  get URL() {
    return getSupabaseApiUrl();
  },
  get ANON_KEY() {
    return envKey;
  },
  
  // Configuration de timeout pour éviter les requêtes bloquées
  TIMEOUT: 10000,
  
  // Options de retry pour les requêtes échouées
  RETRY_OPTIONS: {
    maxAttempts: 3,
    delay: 1000
  }
};

// Validation de la configuration (clé anon = publique par nature, mais ne doit pas être absente)
const validateConfig = () => {
  const errors: string[] = [];

  if (!envUrl || !/^https?:\/\//.test(envUrl)) {
    errors.push('Définissez VITE_SUPABASE_URL (ex. https://xxx.supabase.co) dans .env à la racine du projet.');
  }

  const keyLooksValid =
    envKey.length >= 20 &&
    (envKey.startsWith('eyJ') || envKey.startsWith('sb_') || envKey.startsWith('sbp_'));
  if (!keyLooksValid) {
    errors.push(
      'Définissez VITE_SUPABASE_ANON_KEY (clé anon / publishable du dashboard Supabase) dans .env.'
    );
  }

  return errors;
};

export { SUPABASE_CONFIG, validateConfig };
