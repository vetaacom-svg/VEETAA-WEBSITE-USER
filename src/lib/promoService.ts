import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import { Db } from '../data/tables';

/** Budget total pour toute la validation (plusieurs requêtes). */
const PROMO_VALIDATE_BUDGET_MS = 48_000;
/** Plafond par requête HTTP (le fetch peut ignorer AbortSignal : on force une résolution). */
const PROMO_PER_QUERY_CAP_MS = 18_000;

function withDeadlineSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), ms);
  return {
    signal: ac.signal,
    clear: () => {
      window.clearTimeout(t);
    },
  };
}

/** Résout/rejette au plus tard après `ms` même si le fetch Supabase ne bouge jamais. */
function promiseWithHardTimeout<T>(source: PromiseLike<T>, ms: number): Promise<T> {
  const promise = Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const tid = window.setTimeout(() => {
      reject(Object.assign(new Error('PromoDeadline'), { name: 'PromoDeadline' }));
    }, ms);
    promise.then(
      (v) => {
        window.clearTimeout(tid);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(tid);
        reject(e);
      },
    );
  });
}

function isPromoDeadline(err: unknown): boolean {
  return err instanceof Error && (err as Error).name === 'PromoDeadline';
}

function remainingMs(deadlineAt: number): number {
  return Math.max(1, Math.min(PROMO_PER_QUERY_CAP_MS, deadlineAt - Date.now()));
}

/** Espace normalisés — même logique que la saisie utilisateur vs base. */
export function normalizePromoCodeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Évite que % et _ dans le code soient interprétés comme jokers ILIKE. */
function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Même convention que le checkout : `[PROMO:<code>] ` dans delivery_note. */
function deliveryNoteHasPromoCode(note: string | null | undefined, promoCodeFromRow: string): boolean {
  if (!note) return false;
  const want = normalizePromoCodeInput(promoCodeFromRow);
  const re = /\[PROMO:([^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(note)) !== null) {
    if (normalizePromoCodeInput(m[1]) === want) return true;
  }
  return false;
}

function mapPromoFetchError(error: { message?: string; code?: string; details?: string }): string {
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '');
  if (code === 'PGRST116' || msg.includes('0 rows')) return 'Code promo invalide ou inexistant.';
  if (msg.includes('permission denied') || msg.includes('policy') || code === '42501') {
    return 'Impossible de lire les codes promo (droits base de données). Vérifiez les politiques RLS sur promo_codes.';
  }
  if (msg.includes('jwt') || msg.includes('invalid') && msg.includes('token')) {
    return 'Session expirée. Reconnectez-vous puis réessayez.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Réseau indisponible. Vérifiez la connexion et réessayez.';
  }
  return `Erreur technique (${code || '?'}): ${error.message || 'vérifiez la console.'}`;
}

export interface PromoCode {
  id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  expiry_date?: string | null;
  min_order_amount: number;
}

type PromoSelectResult = { data: PromoCode[] | null; error: PostgrestError | null };
type OrderNotesResult = { data: { delivery_note: string | null }[] | null; error: PostgrestError | null };
type OrderCountResult = { count: number | null; error: PostgrestError | null };

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string; details?: string };
  if (e.name === 'AbortError') return true;
  const m = String(e.message || e.details || '').toLowerCase();
  return m.includes('abort') || m.includes('signal is aborted');
}

export async function validatePromoCode(
  code: string,
  cartTotal: number,
  userId?: string,
  options?: { signal?: AbortSignal }
): Promise<{ valid: boolean; promo?: PromoCode; error?: string }> {
  const outerSig = options?.signal;
  const normalized = normalizePromoCodeInput(code);
  if (!normalized) {
    return { valid: false, error: 'Saisissez un code promo.' };
  }

  const mergeSig = (a: AbortSignal, b?: AbortSignal): AbortSignal => {
    if (!b) return a;
    const c = new AbortController();
    const stop = () => c.abort();
    if (a.aborted || b.aborted) {
      stop();
      return c.signal;
    }
    a.addEventListener('abort', stop, { once: true });
    b.addEventListener('abort', stop, { once: true });
    return c.signal;
  };

  const deadlineAt = Date.now() + PROMO_VALIDATE_BUDGET_MS;

  try {
    const ms1 = remainingMs(deadlineAt);
    const d1 = withDeadlineSignal(ms1);
    const sig1 = outerSig ? mergeSig(d1.signal, outerSig) : d1.signal;
    try {
      const exactPattern = escapeIlikePattern(normalized);
      let q = supabase.from(Db.promoCodes).select('*').ilike('code', exactPattern).limit(1).abortSignal(sig1);
      let { data: promos, error } = await promiseWithHardTimeout(q as PromiseLike<PromoSelectResult>, ms1);

      if (error) {
        if (isAbortError(error)) {
          return { valid: false, error: 'Délai dépassé (lecture du code). Réessayez.' };
        }
        console.error('Error fetching promo code:', error);
        return { valid: false, error: mapPromoFetchError(error as { message?: string; code?: string }) };
      }

      let promoRow = (promos?.[0] as PromoCode | undefined) ?? undefined;

      if (!promoRow) {
        const ms2 = remainingMs(deadlineAt);
        const broad = `%${escapeIlikePattern(normalized)}%`;
        let q2 = supabase.from(Db.promoCodes).select('*').ilike('code', broad).limit(25).abortSignal(sig1);
        const res2 = await promiseWithHardTimeout(q2 as PromiseLike<PromoSelectResult>, ms2);
        if (res2.error) {
          if (isAbortError(res2.error)) return { valid: false, error: 'Délai dépassé (lecture du code). Réessayez.' };
          return { valid: false, error: mapPromoFetchError(res2.error as { message?: string; code?: string }) };
        }
        const list = (res2.data ?? []) as PromoCode[];
        promoRow = list.find((p) => normalizePromoCodeInput(String(p.code)) === normalized);
      }

      if (!promoRow) {
        return {
          valid: false,
          error:
            'Code inconnu ou ne correspond pas exactement. Vérifiez l’orthographe (espaces, majuscules gérés automatiquement).',
        };
      }

      const promo = promoRow;

      if (!promo.is_active) {
        return { valid: false, error: "Ce code promo n'est plus actif." };
      }

      if (promo.current_uses >= promo.max_uses) {
        return {
          valid: false,
          error: "Ce code promo a atteint sa limite d'utilisation (quota global).",
        };
      }

      if (promo.expiry_date && new Date(promo.expiry_date) < new Date()) {
        return { valid: false, error: 'Ce code promo a expiré.' };
      }

      if (promo.min_order_amount > 0 && cartTotal < promo.min_order_amount) {
        return {
          valid: false,
          error: `Le montant minimum pour ce code est de ${promo.min_order_amount} DH (panier actuel : ${cartTotal} DH).`,
        };
      }

      if (userId) {
        d1.clear();
        const RECENT_ORDERS = 400;
        const ms3 = remainingMs(deadlineAt);
        const d2 = withDeadlineSignal(ms3);
        const sig2 = outerSig ? mergeSig(d2.signal, outerSig) : d2.signal;
        try {
          const recentP = supabase
            .from(Db.orders)
            .select('delivery_note')
            .eq('user_id', userId)
            .not('delivery_note', 'is', null)
            .order('created_at', { ascending: false })
            .limit(RECENT_ORDERS)
            .abortSignal(sig2);
          const recentRes = await promiseWithHardTimeout(recentP as PromiseLike<OrderNotesResult>, ms3);
          d2.clear();

          if (recentRes.error) {
            if (isAbortError(recentRes.error)) {
              return {
                valid: false,
                error:
                  'Vérification de l’historique trop longue ou interrompue. Vérifiez les politiques RLS sur `orders` (SELECT pour l’utilisateur connecté) ou réessayez.',
              };
            }
            console.error('Promo past-orders check:', recentRes.error);
            return { valid: false, error: mapPromoFetchError(recentRes.error as { message?: string; code?: string }) };
          }

          const rows = recentRes.data ?? [];
          const codeStr = String(promo.code);
          if (rows.some((r: { delivery_note: string | null }) => deliveryNoteHasPromoCode(r.delivery_note, codeStr))) {
            return { valid: false, error: "Vous avez déjà utilisé ce code promo sur une commande passée." };
          }

          if (rows.length < RECENT_ORDERS) {
            /* Moins de 400 commandes : historique complet déjà parcouru. */
          } else {
            const ms4 = remainingMs(deadlineAt);
            const d3 = withDeadlineSignal(ms4);
            const sig3 = outerSig ? mergeSig(d3.signal, outerSig) : d3.signal;
            try {
              const tag = escapeIlikePattern(codeStr);
              const notePattern = `%[PROMO:${tag}]%`;
              const oq = supabase
                .from(Db.orders)
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .ilike('delivery_note', notePattern)
                .abortSignal(sig3);
              const { count, error: orderError } = await promiseWithHardTimeout(oq as PromiseLike<OrderCountResult>, ms4);

              if (orderError) {
                if (isAbortError(orderError)) {
                  return {
                    valid: false,
                    error:
                      'Vérification de l’historique trop longue ou interrompue. Vérifiez les politiques RLS sur `orders` (SELECT pour l’utilisateur connecté) ou réessayez.',
                  };
                }
                console.error('Promo past-orders ilike check:', orderError);
                return { valid: false, error: mapPromoFetchError(orderError as { message?: string; code?: string }) };
              }
              if ((count ?? 0) > 0) {
                return { valid: false, error: "Vous avez déjà utilisé ce code promo sur une commande passée." };
              }
            } finally {
              d3.clear();
            }
          }
        } finally {
          d2.clear();
        }
      }

      return { valid: true, promo };
    } finally {
      d1.clear();
    }
  } catch (err) {
    if (isAbortError(err) || isPromoDeadline(err)) {
      return {
        valid: false,
        error: 'Délai dépassé pendant la vérification (réseau ou serveur lent). Réessayez dans un instant.',
      };
    }
    console.error('Validate promo error:', err);
    return { valid: false, error: 'Erreur lors de la vérification du code.' };
  }
}

export async function incrementPromoUsage(promoId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from(Db.promoCodes)
      .select('current_uses')
      .eq('id', promoId)
      .single();

    if (!data) return false;

    await supabase
      .from(Db.promoCodes)
      .update({ current_uses: data.current_uses + 1 })
      .eq('id', promoId);

    return true;
  } catch (e) {
    console.error('Failed to increment promo usage:', e);
    return false;
  }
}
