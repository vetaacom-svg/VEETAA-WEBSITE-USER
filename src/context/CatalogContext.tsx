import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase-client';
import { SUPABASE_CONFIG } from '../config/supabase-config';
import { catalogRepo } from '../data/repos/catalogRepo';
import { CategoryID, Store, Product, ProductSubCategory, SubCategory } from '../types';
import { resolveProductMenuSection } from '../lib/productMenuSection';
import { CATEGORY_COLORS } from '../constants';
import { useLocation } from './LocationContext';

export interface CatalogContextValue {
  categoriesData: { id: CategoryID; name: string; icon?: string | null; color?: string }[];
  storesData: Store[];
  subCategoriesData: SubCategory[];
  productSubCategoriesData: ProductSubCategory[];
  storesWithProducts: Store[];
  newProductsData: Product[];
  loadingCatalog: boolean;
  loadMoreStores: () => Promise<void>;
  hasMoreStores: boolean;
  searchProducts: (query: string, options?: { signal?: AbortSignal }) => Promise<Product[]>;
  /** Réseau + mise en cache. Option `signal` pour annuler (changement de magasin / démontage). */
  fetchStoreProducts: (storeId: string, options?: { signal?: AbortSignal }) => Promise<Product[]>;
  /**
   * Cache mémoire des menus par magasin (après au moins un fetch réussi).
   * Complexité : O(1) lecture (Map).
   */
  peekCachedStoreProducts: (storeId: string) => { hit: boolean; products: Product[] };
  fetchStoreById: (storeId: string) => Promise<Store | null>;
  fetchProductById: (productId: string) => Promise<Product | null>;
  /** Relance le chargement catalogue (accueil / magasins). */
  reloadCatalog: () => Promise<void>;
  /** Dernière erreur Supabase / timeout sur le chargement catalogue (affichage utilisateur). */
  catalogLoadError: string | null;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

const PAGE_SIZE = 30;

/** Délai max par requête initiale (réseau lent / proxy / Brave). Ce n’est pas une limite SQL côté Supabase. */
const CATALOG_QUERY_TIMEOUT_MS = 35_000;
const SEARCH_QUERY_TIMEOUT_MS = 18_000;
const CATALOG_QUERY_RETRIES = 2;
const CATALOG_RETRY_DELAYS_MS = [800, 1800];
const IS_DEV = import.meta.env.DEV;
const devLog = (...args: unknown[]) => {
  if (IS_DEV) console.log(...args);
};
const devWarn = (...args: unknown[]) => {
  if (IS_DEV) console.warn(...args);
};

async function supabaseWithTimeout<T>(
  label: string,
  execute: () => PromiseLike<T>,
  timeoutMs: number = CATALOG_QUERY_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`catalog-timeout:${label}`)), timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(execute()), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function formatDbError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const code = 'code' in err && (err as { code?: string }).code ? `${(err as { code: string }).code}: ` : '';
    return `${code}${String((err as { message: string }).message)}`;
  }
  return String(err);
}

/** Erreur { message: 'timeout', details } renvoyée par safeQuery — pas une erreur PostgreSQL. */
function isClientFetchTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const o = error as { message?: string; details?: unknown };
  if (o.message === 'timeout') return true;
  const d = o.details;
  return d instanceof Error && String(d.message).startsWith('catalog-timeout:');
}

function isAbortLike(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { message?: string; code?: string; details?: unknown };
  const msg = String(e.message || '').toLowerCase();
  const code = String(e.code || '');
  if (code === '20') return true;
  if (msg.includes('aborterror') || msg.includes('signal is aborted') || msg.includes('aborted')) return true;
  if (e.details && typeof e.details === 'string') {
    const d = e.details.toLowerCase();
    if (d.includes('aborterror') || d.includes('signal is aborted') || d.includes('aborted')) return true;
  }
  return false;
}

// Helper to construct the full image URL accurately
export const resolveImageUrl = (path: string | null | undefined, bucket: string = 'stores'): string => {
  if (!path) return 'https://images.unsplash.com/photo-1594212699903-ec8a3ecc50f1?w=600';
  if (path.startsWith('http')) return path;
  const projectUrl = SUPABASE_CONFIG.URL;
  const cleanPath = (path || '').startsWith('/') ? (path || '').slice(1) : (path || '');
  if (cleanPath.startsWith(bucket + '/')) return `${projectUrl}/storage/v1/object/public/${cleanPath}`;
  return `${projectUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
};

export const CatalogProvider: React.FC<{ children: ReactNode; language: string }> = ({ children, language }) => {
  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [storesData, setStoresData] = useState<Store[]>([]);
  const [subCategoriesData, setSubCategoriesData] = useState<SubCategory[]>([]);
  const [productSubCategoriesData, setProductSubCategoriesData] = useState<ProductSubCategory[]>([]);
  const [newProductsData, setNewProductsData] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false); // Start as false - load in background
  const [page, setPage] = useState(0);
  const [hasMoreStores, setHasMoreStores] = useState(true);
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);

  /** Cache menu par store_id : évite spinner au retour sur la page. Écriture O(1), lecture O(1). */
  const storeProductsCacheRef = useRef<Map<string, Product[]>>(new Map());
  const catalogFetchGenRef = useRef(0);
  const catalogAbortRef = useRef<AbortController | null>(null);

  // STORE MAPPING: Adapté au schéma SQL existant
  const mapStore = useCallback((s: any): Store => ({
    id: s.id,
    name: s.name,
    image: resolveImageUrl(s.image_url, 'stores'),
    menuImage: resolveImageUrl(s.menu_image_url, 'stores'),
    isOpen: s.is_open ?? true,
    rating: Number(s.rating || 4.5),
    deliveryTimeMin: s.delivery_time_min || 25,
    deliveryFee: Number(s.delivery_fee || 15),
    description: s.description || '',
    mapsUrl: s.maps_url || '',
    // Canonical DB fields: latitude / longitude. Keep lat/lng mirrors for backward compatibility.
    latitude: Number(s.latitude || s.lat || 0),
    longitude: Number(s.longitude || s.lng || 0),
    lat: Number(s.latitude || s.lat || 0),
    lng: Number(s.longitude || s.lng || 0),
    isActive: s.is_active ?? true,
    is_new: s.is_new ?? false,  // Champ optionnel, fallback à false
    isFeatured: s.is_featured ?? false,
    hasProducts: s.has_products ?? true,
    userVisibleFields: s.user_visible_fields || ['gallery', 'custom_note', 'budget', 'image'],
    userFieldLabels: s.user_field_labels || {},
    createdAt: s.created_at,
    products: [],
    // Ajout des propriétés dynamiques de livraison (null si non défini spécifiquement pour ce magasin)
    deliveryBaseFee: s.delivery_base_fee ?? null,
    deliveryIncludedKm: s.delivery_included_km ?? null,
    deliveryFeePerKm: s.delivery_fee_per_km ?? null,
    deliveryFixedFee: s.delivery_fixed_fee ?? null,
    zone_id: s.zone_id,
    category: s.category_id || 'food',  // Utilise category_id du SQL
    sub_category: s.sub_category ?? undefined,
    store_sub_category_id: s.store_sub_category_id ?? undefined,
    type: s.type || 'products'  // Utilise type du SQL
  }), []);

  // PRODUCT MAPPING: Maps confirmed columns in the SQL 'products' table
  const mapProduct = useCallback((p: any): Product => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    image: resolveImageUrl(p.image_url, 'products'),
    storeId: p.store_id || (p.stores as any)?.id,
    storeName: (p.stores as any)?.name,
    description: p.description,
    isAvailable: p.is_available ?? true,
    productImages: p.product_images || [],
    priceEditable: p.price_editable ?? true,
    userVisibleFields: p.user_visible_fields,
    userFieldLabels: p.user_field_labels,
    menuSection: resolveProductMenuSection(p),
    subCategoryId: p.sub_category_id ?? undefined,
    productSubCategoryId: p.product_sub_category_id ?? undefined,
    storeSubCategoryId: p.store_sub_category_id ?? (p.product_sub_categories && !Array.isArray(p.product_sub_categories) ? p.product_sub_categories.store_sub_category_id : undefined) ?? undefined,
  }), []);

  useEffect(() => {
    let cancelled = false;
    void catalogRepo.productSubCategories().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        devWarn('[CATALOG] productSubCategories:', error);
        return;
      }
      if (data) setProductSubCategoriesData(data as ProductSubCategory[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchInitialData = useCallback(async () => {
    catalogAbortRef.current?.abort();
    const ac = new AbortController();
    catalogAbortRef.current = ac;
    const runId = ++catalogFetchGenRef.current;

    setLoadingCatalog(true);
    setCatalogLoadError(null);
    setPage(0);
    setHasMoreStores(true);
    devLog('%c🔵 [CATALOG] ===== STARTING INITIAL FETCH =====', 'color: blue; font-weight: bold; font-size: 14px;');
    devLog('Language:', language);
    
    try {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const runQueryWithRetries = async (
        label: string,
        run: () => PromiseLike<{ data: unknown; error: unknown }>
      ): Promise<{ data: unknown; error: unknown }> => {
        let lastError: unknown = null;
        for (let attempt = 0; attempt <= CATALOG_QUERY_RETRIES; attempt += 1) {
          if (ac.signal.aborted) return { data: null, error: { message: 'aborted' } };
          try {
            const result = await supabaseWithTimeout(label, run);
            const hasError =
              !!result &&
              typeof result === 'object' &&
              'error' in result &&
              (result as { error?: unknown }).error != null;
            if (!hasError) return result;

            const err = (result as { error?: unknown }).error;
            if (!isClientFetchTimeout(err)) return result;
            lastError = err;
          } catch (e) {
            if (ac.signal.aborted) return { data: null, error: { message: 'aborted' } };
            lastError = e;
          }

          if (attempt < CATALOG_QUERY_RETRIES) {
            const delay = CATALOG_RETRY_DELAYS_MS[attempt] ?? 1000;
            devWarn(`[CATALOG] ${label} tentative ${attempt + 1} échouée, retry dans ${delay}ms...`);
            await sleep(delay);
          }
        }
        return { data: null, error: { message: 'timeout', details: lastError } };
      };

      const safeQuery = async (label: string, run: () => PromiseLike<{ data: unknown; error: unknown }>) => {
        try {
          if (ac.signal.aborted) return { data: null, error: { message: 'aborted' } };
          return await runQueryWithRetries(label, run);
        } catch (e) {
          if (ac.signal.aborted) return { data: null, error: { message: 'aborted' } };
          devWarn(`[CATALOG] ${label} timeout ou erreur:`, e);
          return { data: null, error: { message: 'timeout', details: e } };
        }
      };

      const queries = [
        safeQuery('categories', () => catalogRepo.categories().abortSignal(ac.signal)),
        safeQuery('stores', () => catalogRepo.storesPage(0, PAGE_SIZE - 1).abortSignal(ac.signal)),
        safeQuery('sub_categories', () => catalogRepo.subCategories().abortSignal(ac.signal)),
        safeQuery('products', () => catalogRepo.newProducts().abortSignal(ac.signal)),
      ];

      devLog('%c⏳ [CATALOG] Waiting for all queries...', 'color: orange;');
      const results = await Promise.allSettled(queries);
      devLog('%c✅ [CATALOG] All queries settled', 'color: green;');

      if (runId !== catalogFetchGenRef.current) {
        devLog('%c[CATALOG] Résultat ignoré (chargement plus récent ou remontage)', 'color: gray;');
        return;
      }

      /** Pagination magasins : la 1ʳᵉ requête ne charge qu’une page ; on enchaîne ici (async) avant le forEach. */
      let catalogResults = results;
      const storesSlot = results[1];
      if (storesSlot.status === 'fulfilled' && !ac.signal.aborted) {
        const { data: rawData, error } = storesSlot.value as { data: unknown; error: unknown };
        if (!error && Array.isArray(rawData) && rawData.length === PAGE_SIZE) {
          let allRows: any[] = [...rawData];
          let from = PAGE_SIZE;
          let lastPageLen = rawData.length;
          while (lastPageLen === PAGE_SIZE && !ac.signal.aborted) {
            const { data: nextBatch, error: pageErr } = await catalogRepo
              .storesPage(from, from + PAGE_SIZE - 1)
              .abortSignal(ac.signal);
            if (pageErr || !nextBatch?.length) break;
            allRows = [...allRows, ...nextBatch];
            lastPageLen = nextBatch.length;
            from += PAGE_SIZE;
          }
          catalogResults = [...results] as typeof results;
          catalogResults[1] = {
            status: 'fulfilled',
            value: { data: allRows, error: null },
          };
        }
      }

      const aggregatedErrors: string[] = [];

      // Process results regardless of success/failure
      catalogResults.forEach((result, idx) => {
        const queryNames = ['CATEGORIES', 'STORES', 'SUB_CATEGORIES', 'PRODUCTS'];
        const queryName = queryNames[idx];
        
        devLog(`%c📊 [CATALOG] Processing [${idx}] ${queryName}...`, 'color: cyan;');
        
        if (result.status === 'fulfilled') {
          const { data: rawData, error } = result.value as { data: unknown; error: unknown };
          const data = Array.isArray(rawData) ? rawData : null;

          if (error) {
            const msg = typeof error === 'object' && error && 'message' in error ? String((error as { message: string }).message) : '';
            if (msg === 'aborted') return;
            devWarn(`[CATALOG] [${queryName}] ERROR:`, error);
            if (isClientFetchTimeout(error)) {
              aggregatedErrors.push(
                `${queryName}: délai réseau (le navigateur n’a pas reçu la réponse — ce n’est pas une erreur dans vos tables SQL)`
              );
            } else {
              aggregatedErrors.push(`${queryName}: ${formatDbError(error)}`);
            }
            if (idx === 1) {
              setStoresData([]);
              setHasMoreStores(false);
            }
          } else if (data) {
            devLog(`%c🟢 [CATALOG] [${queryName}] Success! Received ${data.length} items`, 'color: green;');
            
            if (idx === 0) { // categories
              devLog('Sample categories:', data.slice(0, 2));
              
              const uniqueCategories = new Map();
              data.forEach((cat: any) => {
                const id = String(cat.id).toLowerCase().trim();
                if (!uniqueCategories.has(id)) {
                  uniqueCategories.set(id, {
                    id,
                    name: language === 'ar' ? cat.name_ar : language === 'en' ? cat.name_en : cat.name_fr,
                    icon: resolveImageUrl(cat.image_url, 'categories'),
                    color: cat.color_class || CATEGORY_COLORS[id] || 'bg-slate-500',
                  });
                }
              });
              
              const mapped = Array.from(uniqueCategories.values());
              devLog('Mapped unique categories:', mapped);
              setCategoriesData(mapped);
              devLog('%c✅ Categories state updated (deduplicated)', 'color: green;');
            } else if (idx === 1) { // stores (données déjà fusionnées page par page ci-dessus si besoin)
              devLog('Sample stores:', data.slice(0, 2));
              const mapped = data.map(mapStore);
              devLog('Mapped stores (total):', mapped.length);
              setStoresData(mapped);
              setPage(Math.max(0, Math.ceil(data.length / PAGE_SIZE) - 1));
              setHasMoreStores(false);
              devLog('%c✅ Stores state updated (all pages)', 'color: green;');
            } else if (idx === 2) { // sub_categories
              devLog('Sample sub_categories:', data.slice(0, 2));
              setSubCategoriesData(data as SubCategory[]);
              devLog('%c✅ Sub-categories state updated', 'color: green;');
            } else if (idx === 3) { // products
              devLog('Sample products:', data.slice(0, 2));
              const mapped = data.map(mapProduct);
              devLog('Mapped products:', mapped.slice(0, 2));
              setNewProductsData(mapped);
              devLog('%c✅ Products state updated', 'color: green;');
            }
          } else if (idx === 1) {
            setStoresData([]);
            setHasMoreStores(false);
            aggregatedErrors.push(`${queryName}: aucune donnée (timeout ou accès refusé — vérifier RLS Supabase).`);
          }
        } else {
          devWarn(`[CATALOG] [${queryName}] REJECTED:`, result.reason);
        }
      });

      if (aggregatedErrors.length > 0) {
        const allTimeouts = aggregatedErrors.every((line) => line.includes('délai réseau'));
        setCatalogLoadError(
          allTimeouts
            ? "Les requêtes vers Supabase ont expiré (réseau/DNS). Ce n'est pas une erreur SQL. Vérifiez la connexion Internet/DNS, puis réessayez."
            : aggregatedErrors.join(' · ')
        );
      } else {
        setCatalogLoadError(null);
      }

      devLog('%c🟢 [CATALOG] ===== FETCH CYCLE COMPLETED =====', 'color: green; font-weight: bold; font-size: 14px;');
    } catch (error) {
      if (runId === catalogFetchGenRef.current) {
        console.error('[CATALOG] Unexpected error in fetchInitialData:', error);
        setCatalogLoadError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (runId === catalogFetchGenRef.current) {
        setLoadingCatalog(false);
        devLog('%c✅ [CATALOG] Loading flag set to FALSE', 'color: green;');
      }
    }
  }, [language, mapStore, mapProduct]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const loadMoreStores = async () => {
    devLog('🔵 [CATALOG] loadMoreStores called');
    devLog('🔵 [CATALOG] hasMoreStores:', hasMoreStores, 'page:', page);
    
    if (!hasMoreStores) {
      devLog('🟡 [CATALOG] No more stores to load');
      return;
    }
    
    const nextPage = page + 1;
    const rangeStart = nextPage * PAGE_SIZE;
    const rangeEnd = (nextPage + 1) * PAGE_SIZE - 1;
    
    devLog('🔵 [CATALOG] Loading stores range:', rangeStart, 'to', rangeEnd);
    
    const { data, error } = await catalogRepo.storesPage(rangeStart, rangeEnd);
    
    devLog('🔵 [CATALOG] loadMoreStores result:', {
      errorCode: error?.code,
      errorMessage: error?.message,
      dataCount: data?.length || 0
    });
    
    if (!error && data) {
      devLog('🟢 [CATALOG] Adding', data.length, 'new stores');
      if (data.length < PAGE_SIZE) {
        setHasMoreStores(false);
        devLog('🟢 [CATALOG] hasMoreStores set to FALSE');
      }
      setStoresData(prev => [...prev, ...data.map(mapStore)]);
      setPage(nextPage);
      devLog('🟢 [CATALOG] Page updated to:', nextPage);
    } else {
      devWarn('[CATALOG] loadMoreStores error:', error);
      setHasMoreStores(false);
      if (error) setCatalogLoadError((prev) => (prev ? `${prev} · ` : '') + `Pagination magasins: ${formatDbError(error)}`);
    }
  };

  const searchProducts = useCallback(async (query: string, options?: { signal?: AbortSignal }): Promise<Product[]> => {
    const q = query.trim();
    if (!q) return [];

    try {
      const { data, error } = await supabaseWithTimeout(
        'search-products',
        () => {
          let builder = catalogRepo.searchProductsByName(`%${q}%`);
          if (options?.signal) builder = builder.abortSignal(options.signal);
          return builder;
        },
        SEARCH_QUERY_TIMEOUT_MS
      );

      if (error) {
        devWarn('[CATALOG] searchProducts:', formatDbError(error));
        return [];
      }
      return (data ?? []).map(mapProduct);
    } catch (e) {
      if (options?.signal?.aborted) return [];
      devWarn('[CATALOG] searchProducts timeout ou erreur:', e);
      return [];
    }
  }, [mapProduct]);

  const peekCachedStoreProducts = useCallback((storeId: string): { hit: boolean; products: Product[] } => {
    const m = storeProductsCacheRef.current;
    if (!m.has(storeId)) return { hit: false, products: [] };
    return { hit: true, products: m.get(storeId)! };
  }, []);

  const fetchStoreProducts = useCallback(async (storeId: string, options?: { signal?: AbortSignal }): Promise<Product[]> => {
    const runQuery = (withJoins: boolean) => {
      let q = withJoins ? catalogRepo.productsByStore(storeId) : catalogRepo.productsByStorePlain(storeId);
      if (options?.signal) q = q.abortSignal(options.signal);
      return q;
    };

    let { data, error } = await runQuery(true);

    if (error && !options?.signal?.aborted && !isAbortLike(error)) {
      devWarn('[CATALOG] fetchStoreProducts (join) retry sans jointure:', formatDbError(error));
      ({ data, error } = await runQuery(false));
    }

    if (error) {
      if (options?.signal?.aborted || isAbortLike(error)) return [];
      devWarn('[CATALOG] fetchStoreProducts error:', error);
      return [];
    }

    const mapped = (data ?? []).map(mapProduct);
    storeProductsCacheRef.current.set(storeId, mapped);
    return mapped;
  }, [mapProduct]);

  const fetchStoreById = useCallback(async (storeId: string): Promise<Store | null> => {
    devLog('🔵 [CATALOG] fetchStoreById called for storeId:', storeId);
    
    const { data, error } = await catalogRepo.storeById(storeId);
    
    devLog('🔵 [CATALOG] fetchStoreById result:', {
      errorCode: error?.code,
      errorMessage: error?.message,
      dataExists: !!data,
      data
    });
    
    if (error || !data) {
      devWarn('[CATALOG] fetchStoreById error:', error);
      return null;
    }
    
    const mapped = mapStore(data);
    devLog('🟢 [CATALOG] Store fetched and mapped:', mapped);
    return mapped;
  }, [mapStore]);

  const fetchProductById = useCallback(
    async (productId: string): Promise<Product | null> => {
      const { data, error } = await catalogRepo.productById(productId);
      if (error || !data) {
        if (error) devWarn('[CATALOG] fetchProductById:', error);
        return null;
      }
      return mapProduct(data);
    },
    [mapProduct]
  );

  const { activeZone } = useLocation();

  const storesWithProducts = useMemo(() => {
    // If we have an active zone, only show stores belonging to that zone
    if (activeZone) {
      return storesData.filter(s => String(s.zone_id) === String(activeZone.id));
    }
    // No zone detected yet (location still loading or not granted) → show all stores
    // so the home page is never permanently empty while location resolves.
    return storesData;
  }, [storesData, activeZone]);

  const value = useMemo(() => ({
    categoriesData,
    storesData,
    subCategoriesData,
    productSubCategoriesData,
    storesWithProducts,
    newProductsData,
    loadingCatalog,
    loadMoreStores,
    hasMoreStores,
    searchProducts,
    fetchStoreProducts,
    peekCachedStoreProducts,
    fetchStoreById,
    fetchProductById,
    reloadCatalog: fetchInitialData,
    catalogLoadError
  }), [categoriesData, storesData, subCategoriesData, productSubCategoriesData, newProductsData, loadingCatalog, loadMoreStores, hasMoreStores, searchProducts, fetchStoreProducts, peekCachedStoreProducts, fetchStoreById, fetchProductById, fetchInitialData, catalogLoadError]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export const useCatalog = () => {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
};
