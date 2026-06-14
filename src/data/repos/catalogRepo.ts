import { supabaseAnon } from '../../lib/supabase-client';
import { Db } from '../tables';

/**
 * Visibilité catalogue côté client : afficher sauf si `is_available` est explicitement `false`.
 */
const productVisibleOr = 'is_available.eq.true,is_available.is.null';

/**
 * Accès catalogue — utilisé par CatalogContext et vues ; pas de logique métier ici.
 * Toutes les requêtes utilisent `supabaseAnon` (pas de session auth) pour ne jamais
 * être bloquées par un refresh de token en cours au chargement de la page.
 */
export const catalogRepo = {
  categories: () => supabaseAnon.from(Db.categories).select('*').order('display_order', { ascending: true }),

  storesPage: (from: number, to: number) =>
    supabaseAnon
      .from(Db.stores)
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to),

  /** parent_id : uniquement si la migration SQL a été appliquée sur Supabase. */
  subCategories: () =>
    supabaseAnon.from(Db.subCategories).select('id, name, category_id, created_at').order('name', { ascending: true }),

  storeSubCategories: () =>
    supabaseAnon.from(Db.storeSubCategories).select('id, name, category_id, created_at').order('name', { ascending: true }),

  productSubCategories: () =>
    supabaseAnon.from(Db.productSubCategories).select('id, name, store_sub_category_id, created_at').order('name', { ascending: true }),

  newProducts: () =>
    supabaseAnon.from(Db.products).select('*').or(productVisibleOr).order('created_at', { ascending: false }).limit(20),

  storeById: (storeId: string) => supabaseAnon.from(Db.stores).select('*').eq('id', storeId).single(),

  productById: (productId: string) =>
    supabaseAnon.from(Db.products).select('*').eq('id', productId).or(productVisibleOr).maybeSingle(),

  productsByStore: (storeId: string) =>
    supabaseAnon
      .from(Db.products)
      .select(
        `
        *,
        product_sub_categories ( id, name, store_sub_category_id ),
        sub_categories ( id, name )
      `
      )
      .eq('store_id', storeId)
      .or(productVisibleOr)
      .order('created_at', { ascending: false }),

  productsByStorePlain: (storeId: string) =>
    supabaseAnon
      .from(Db.products)
      .select('*')
      .eq('store_id', storeId)
      .or(productVisibleOr)
      .order('created_at', { ascending: false }),

  searchProductsByName: (pattern: string) =>
    supabaseAnon.from(Db.products).select('*').or(productVisibleOr).ilike('name', pattern).limit(20),

  announcements: () =>
    supabaseAnon.from(Db.announcements).select('*').eq('active', true).order('created_at', { ascending: false }).limit(5),

  deliveryZones: () =>
    supabaseAnon.from('delivery_zones').select('*').eq('is_active', true),
};
