import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { Store, Product, CategoryID, Language } from '../types';
import { useNavigate } from 'react-router-dom';
import { Heart, Star, ChevronLeft, ChevronRight, X, ZoomIn, ShoppingBag, Clock, MapPin, Search, ThumbsUp, Info, Camera, Send, Share2, Loader2, List } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { useCatalog } from '../context/CatalogContext';
import { menuSectionsForStore, MENU_OTHER, resolveProductMenuSection, type MenuSectionGroup } from '../lib/productMenuSection';
import { sanitizePlainText } from '../lib/security';
import { supabase } from '../lib/supabase-client';

interface StoreDetailProps {
  store: Store;
  language: Language;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelectProduct: (product: Product) => void;
  cartCount: number;
  onViewCart: () => void;
  onCheckout?: (text?: string, image?: string | string[], price?: number) => void;
  userLocation?: { lat: number; lon: number; city: string } | null;
}

const ImageGallery: React.FC<{ images: string[]; compact?: boolean }> = ({ images, compact = false }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const zoomContainerRef = useRef<HTMLDivElement>(null);

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  return (
    <>
      <div className={`relative w-full rounded-[2.5rem] overflow-hidden group shadow-xl ${compact ? 'bg-slate-50 border border-slate-100 max-h-[320px] flex items-center justify-center' : 'aspect-square bg-slate-900'}`}>
        <div className="w-full h-full flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {images.map((img, idx) => (
            <div key={idx} className="flex-shrink-0 w-full h-full flex items-center justify-center cursor-zoom-in" onClick={() => setIsFullscreen(true)}>
              <img src={img} alt="" className="max-w-full max-h-full object-contain p-2" />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-lg"><ChevronLeft size={20} /></button>
            <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-lg"><ChevronRight size={20} /></button>
          </>
        )}
      </div>
      {isFullscreen && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 animate-premium" onClick={() => setIsFullscreen(false)}>
          <button className="absolute top-10 right-10 p-4 bg-white/10 text-white rounded-full"><X size={32} /></button>
          <img src={images[currentIndex]} className="max-w-full max-h-full object-contain" alt="" />
        </div>
      )}
    </>
  );
};

const StoreDetail: React.FC<StoreDetailProps> = ({
  store,
  language,
  favorites,
  onToggleFavorite,
  onSelectProduct,
  onCheckout,
  cartCount = 0,
  onViewCart,
  userLocation
}) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const { fetchStoreProducts, peekCachedStoreProducts, newProductsData } = useCatalog();
  const navigate = useNavigate();

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Veetaa - ${store.name}`,
          text: `Découvrez ${store.name} sur Veetaa !`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Lien copié dans le presse-papier !');
      }
    } catch (err) {
      console.log('Error sharing', err);
    }
  };

  const [heartAnim, setHeartAnim] = useState(false);
  const handleToggleFavorite = () => {
    onToggleFavorite(store.id);
    // Trigger animation only when adding to favorites
    if (!favorites.includes(store.id)) {
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 500);
    }
  };

  const isDirectOrderStore = store.hasProducts === false;

  /** Stabilise les deps du chargement si le parent recrée le tableau `products`. */
  const storeEmbeddedKey = useMemo(() => {
    if (!store.products?.length) return '';
    return store.products.map((p) => p.id).join('|');
  }, [store.products]);

  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(() => !isDirectOrderStore);
  /** Incrémenté à chaque run d’effet : évite que la promesse annulée (Strict Mode / abort) laisse le spinner bloqué. */
  const menuLoadGenRef = useRef(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customOrderText, setCustomOrderText] = useState('');
  const [customOrderImages, setCustomOrderImages] = useState<string[]>([]);
  const [customOrderPrice, setCustomOrderPrice] = useState(0);
  const [storeSubCategories, setStoreSubCategories] = useState<{ id: string; name: string }[]>([]);

  /**
   * Chargement menu — stratégie & complexité :
   * - Données déjà sur `store.products` : affichage O(1) (aucune attente réseau).
   * - Cache mémoire (Map par store_id) : lecture O(1), évite le spinner au retour sur le magasin.
   * - Amorce depuis `newProductsData` : filtre O(P), P = taille de la liste (bornée par l’API, ex. 20).
   * - Réseau : une requête Supabase ; `AbortSignal` annule si l’utilisateur change de magasin — évite courses O(k) inutiles.
   * - Regroupement `groupedProducts` (useMemo) : O(n) sur n = nombre de produits affichés.
   */
  useEffect(() => {
    setSelectedCategory(null);
    if (!isDirectOrderStore && store.id) {
      supabase
        .from('store_sub_categories')
        .select('id, name')
        .eq('store_id', store.id)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (!error && data) {
            setStoreSubCategories(data);
          }
        });
    }
  }, [store.id, isDirectOrderStore]);

  useLayoutEffect(() => {
    if (isDirectOrderStore) {
      setLocalProducts([]);
      setLoadingProducts(false);
      return;
    }

    const myGen = ++menuLoadGenRef.current;
    const ac = new AbortController();
    const MENU_FETCH_MS = 28_000;
    const timeoutId = window.setTimeout(() => ac.abort(), MENU_FETCH_MS);

    const embedded = store.products?.length ? store.products : null;
    const { hit, products: cached } = peekCachedStoreProducts(store.id);
    const bootCandidates = newProductsData.filter((p) => String(p.storeId) === String(store.id));

    const instant =
      embedded?.length ? embedded : hit ? cached : bootCandidates.length > 0 ? bootCandidates : null;

    if (instant !== null) {
      setLocalProducts(instant);
      setLoadingProducts(false);
    } else {
      setLocalProducts([]);
      setLoadingProducts(true);
    }

    void fetchStoreProducts(store.id, { signal: ac.signal })
      .then((prods) => {
        if (myGen !== menuLoadGenRef.current) return;
        setLocalProducts(prods);
        setLoadingProducts(false);
      })
      .catch(() => {
        if (myGen !== menuLoadGenRef.current) return;
        setLoadingProducts(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      ac.abort();
    };
  }, [
    store.id,
    isDirectOrderStore,
    storeEmbeddedKey,
    fetchStoreProducts,
    peekCachedStoreProducts,
    newProductsData,
  ]);

  const menuSections = useMemo(() => {
    const sections: MenuSectionGroup<Product>[] = [];
    const groupMap = new Map<string, Product[]>();
    const otherProducts: Product[] = [];

    localProducts.forEach(p => {
      let matchedId = p.storeSubCategoryId;
      
      if (!matchedId) {
        const menuName = p.menuSection || '';
        const matchByName = storeSubCategories.find(c => c.name.toLowerCase() === menuName.toLowerCase());
        if (matchByName) {
          matchedId = matchByName.id;
        }
      }

      if (matchedId) {
        if (!groupMap.has(matchedId)) {
          groupMap.set(matchedId, []);
        }
        groupMap.get(matchedId)!.push(p);
      } else {
        otherProducts.push(p);
      }
    });

    storeSubCategories.forEach(cat => {
      const prods = groupMap.get(cat.id) || [];
      if (prods.length > 0) {
        sections.push({
          key: cat.id,
          label: cat.name,
          products: prods
        });
      }
    });

    if (otherProducts.length > 0) {
      sections.push({
        key: MENU_OTHER,
        label: MENU_OTHER,
        products: otherProducts
      });
    }

    return sections;
  }, [localProducts, storeSubCategories]);

  const activeSection = useMemo(
    () => menuSections.find((s) => s.key === selectedCategory) ?? null,
    [menuSections, selectedCategory]
  );

  const renderProductCard = (product: Product) => (
    <div
      key={product.id}
      onClick={() => navigate(`/store/${store.id}/product/${product.id}`, { state: { product } })}
      className="bg-white p-3 md:p-5 rounded-3xl md:rounded-[2.5rem] border border-slate-50 shadow-sm hover:shadow-2xl transition-all group cursor-pointer flex flex-col h-full"
    >
      <div className="relative overflow-hidden rounded-2xl md:rounded-[2rem] mb-3 md:mb-5 aspect-square">
        <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={product.name} />
        {product.isFeatured && (
          <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-amber-400 text-amber-950 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl shadow-lg border border-amber-200 animate-pulse">
            ⭐ Élite
          </div>
        )}
        <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 md:px-4 md:py-1.5 rounded-xl flex flex-col items-end">
          {product.discountPrice ? (
            <>
              <span className="text-[9px] md:text-[10px] line-through text-slate-400 font-bold">{product.price} DH</span>
              <span className="text-[11px] md:text-[13px] font-black text-white">{product.discountPrice} DH</span>
            </>
          ) : (
            <span className="text-[11px] md:text-[12px] font-black text-white">{product.price} DH</span>
          )}
        </div>
      </div>
      <div className="px-1 md:px-2 flex-1 flex flex-col">
        <h4 className="text-[13px] md:text-lg font-black text-slate-900 line-clamp-2 leading-tight mb-1 md:mb-2">{product.name}</h4>
        <p className="hidden md:block text-slate-400 text-xs font-bold line-clamp-2 mb-4 md:mb-6">{product.description}</p>
        <div className="mt-auto pt-2">
          <button type="button" className="w-full py-2.5 md:py-4 bg-slate-100 group-hover:bg-orange-600 text-slate-900 group-hover:text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all">
            {t('select')}
          </button>
        </div>
      </div>
    </div>
  );

  const renderProductGrid = (items: Product[]) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-8 px-1 md:px-0">
      {items.map(renderProductCard)}
    </div>
  );

  const renderDividedMenu = (sections: MenuSectionGroup<Product>[]) => (
    <div className="space-y-12">
      {sections.map((section) => (
        <section key={section.key} id={`menu-section-${section.key}`} className="scroll-mt-28">
          <div className="flex items-center gap-3 mb-5 px-1">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 m-0">
              {section.label === MENU_OTHER ? (language === 'en' ? 'Other' : 'Autres') : section.label}
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              {section.products.length}
            </span>
          </div>
          {renderProductGrid(section.products)}
        </section>
      ))}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24 animate-premium">
      {/* Dynamic Breadcrumbs / Header UI */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3 md:gap-4">
          <img src={store.image} className="w-20 h-20 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-3xl object-cover shadow-2xl border-4 border-white" alt={store.name} />
          <div>
            <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter leading-tight truncate max-w-[200px] md:max-w-none">
              {store.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{t(store.category)}</span>
              <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-[11px] font-black text-amber-700">{store.rating ?? '4.8'}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Clock size={12} /> {store.deliveryTimeMin ?? '25-40'} min</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3">
          <button onClick={handleShare} className="p-3 md:p-4 bg-white shadow-xl rounded-2xl hover:bg-slate-50 active:scale-95 transition-all outline-none border border-slate-50">
            <Share2 size={18} className="text-slate-600" />
          </button>
          <button onClick={handleToggleFavorite} className={`p-3 md:p-4 shadow-xl rounded-2xl active:scale-95 transition-all outline-none border ${favorites.includes(store.id) ? 'bg-red-50 border-red-100 text-red-500 hover:bg-red-100' : 'bg-white border-slate-50 text-slate-400 hover:bg-slate-50'}`}>
            <Heart size={18} fill={favorites.includes(store.id) ? "currentColor" : "none"} className={heartAnim ? 'animate-heartbeat' : ''} />
          </button>
        </div>
      </div>

      <div className="px-2 md:px-4">
        {/* CASE 1: Store has a catalog (hasProducts = true) */}
        {!isDirectOrderStore && (
          <div className="space-y-8">
            {loadingProducts ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                <Loader2 size={40} className="animate-spin text-orange-600" />
                <p className="font-black text-slate-400 uppercase text-xs tracking-widest">Chargement du menu...</p>
              </div>
            ) : localProducts.length > 0 ? (
              <div className="space-y-10">
                {menuSections.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      className={`px-6 py-3 rounded-2xl text-sm font-black transition-all whitespace-nowrap ${
                        !selectedCategory
                          ? 'bg-orange-600 text-white shadow-xl scale-105'
                          : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {language === 'en' ? 'All' : language === 'ar' ? 'الكل' : 'Tout'}
                    </button>
                    {menuSections.map((section) => (
                      <button
                        key={section.key}
                        type="button"
                        onClick={() => setSelectedCategory(section.key)}
                        className={`px-6 py-3 rounded-2xl text-sm font-black transition-all whitespace-nowrap ${
                          selectedCategory === section.key
                            ? 'bg-orange-600 text-white shadow-xl scale-105'
                            : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {section.label === MENU_OTHER ? (language === 'en' ? 'Other' : 'Autres') : section.label}
                      </button>
                    ))}
                  </div>
                )}

                {!selectedCategory
                  ? renderDividedMenu(menuSections)
                  : activeSection
                    ? renderProductGrid(activeSection.products)
                    : renderDividedMenu(menuSections)}
              </div>
            ) : (
              <div className="p-20 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">🏜️</div>
                <h4 className="text-xl font-black text-slate-800 mb-2">Carte bientôt disponible</h4>
                <p className="text-slate-400 font-bold text-sm">Ce magasin prépare ses délicieux produits pour l'application.</p>
              </div>
            )}
          </div>
        )}

        {/* CASE 2: "Store is itself the product" (has_products = false) */}
        {isDirectOrderStore && (
          <div className="mx-auto space-y-6 md:space-y-12">
            <div className="bg-slate-900 rounded-3xl md:rounded-[3rem] p-4 md:p-12 text-center text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-600/20 to-transparent" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 md:w-24 md:h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-3 md:mb-8 text-2xl md:text-5xl">
                  {store.type === 'prescription' ? '💊' : store.type === 'text-only' ? '✍️' : '📦'}
                </div>
                <h3 className="text-xl md:text-4xl font-black tracking-tighter mb-1 md:mb-4 whitespace-nowrap">{t('customOrder')}</h3>
                <p className="text-slate-400 font-bold text-[10px] md:text-sm max-w-md mx-auto leading-none md:leading-relaxed truncate w-full">
                  {store.userFieldLabels?.custom_order_description || t('customOrderDescription')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl md:rounded-[3rem] p-3 md:p-10 shadow-2xl border border-slate-50 space-y-4 md:space-y-10">
              {store.userVisibleFields?.includes('custom_note') && (
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-widest px-2">{store.userFieldLabels?.custom_note || t('writeOrderPlaceholder')}</label>
                  <textarea
                    value={customOrderText}
                    onChange={(e) => setCustomOrderText(sanitizePlainText(e.target.value, 1200))}
                    placeholder={store.userFieldLabels?.custom_note_placeholder || t('writeOrderPlaceholder')}
                    className="w-full p-4 md:p-8 bg-slate-50 border-none rounded-2xl md:rounded-[2.5rem] text-sm md:text-lg font-bold text-slate-900 focus:ring-4 focus:ring-orange-100 transition-all min-h-[100px] md:min-h-[200px]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {store.userVisibleFields?.includes('budget') && (
                  <div className="space-y-4">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-2">{store.userFieldLabels?.budget || t('yourBudget')}</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={customOrderPrice || ''}
                        onChange={(e) => setCustomOrderPrice(Number(e.target.value))}
                        className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl text-xl md:text-2xl font-black text-slate-900 border-none focus:ring-4 focus:ring-orange-100"
                        placeholder="0"
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">DH</span>
                    </div>
                  </div>
                )}
                {store.userVisibleFields?.includes('image') && (
                  <div className="space-y-4">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-2">{t('addImage')}</label>
                    <label className="block w-full cursor-pointer group">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          files.forEach(file => {
                            const r = new FileReader();
                            r.onloadend = () => setCustomOrderImages(prev => [...prev.slice(0, 4), r.result as string]);
                            r.readAsDataURL(file);
                          });
                        }}
                      />
                      <div className={`p-4 md:p-6 bg-slate-50 border-2 border-dashed rounded-2xl flex items-center justify-center gap-4 transition-all ${customOrderImages.length > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 group-hover:border-orange-600'}`}>
                        {customOrderImages.length > 0 ? (
                          <ThumbsUp className="text-emerald-500" />
                        ) : (
                          <Camera size={24} className="text-slate-400 group-hover:text-orange-600" />
                        )}
                        <span className="font-black text-slate-500 text-xs uppercase tracking-widest">
                          {customOrderImages.length > 0 ? `${customOrderImages.length} Images ajoutées` : t('addImage')}
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <button
                onClick={() => onCheckout?.(sanitizePlainText(customOrderText, 1200), customOrderImages, customOrderPrice)}
                disabled={!customOrderText && customOrderImages.length === 0}
                className="w-full py-6 bg-slate-900 text-white rounded-[2rem] text-xl font-black uppercase tracking-tighter hover:bg-orange-600 active:scale-95 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
              >
                Confirmer la Commande
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreDetail;
