/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_EMAIL_REDIRECT_URL?: string
  readonly VITE_ANTI_VPN_ENDPOINT?: string
  /** 'false' pour désactiver le proxy Vite (appels directs vers Supabase en dev) */
  readonly VITE_SUPABASE_DEV_PROXY?: string
  /** 'true' en prod : utilise l’origine du site + rewrites (ex. vercel.json) — compatible Brave */
  readonly VITE_SUPABASE_SAME_ORIGIN?: string
  /** 'true' : toujours appeler l’URL HTTPS Supabase (ignore proxy / rewrites) */
  readonly VITE_SUPABASE_ALWAYS_DIRECT?: string
  /** Seuil (octets) pour vider auto panier/favoris/cache session ; défaut ~2,5 Mo */
  readonly VITE_AUTO_CLEAR_STORAGE_BYTES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
