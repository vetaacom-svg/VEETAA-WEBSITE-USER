import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { TRANSLATIONS } from '../constants';
import { CategoryID, Language, Product, Store } from '../types';
import { Heart, Star, MapPin, Search, ChevronDown, Loader2, Navigation, LayoutGrid, Zap, Grid, List, ChevronRight, ShoppingBag } from 'lucide-react';
import { catalogRepo } from '../data/repos/catalogRepo';
import { useCatalog } from '../context/CatalogContext';
import { sanitizeSearchInput } from '../lib/security';


interface HomeProps {
  onSelectCategory: (id: CategoryID) => void;
  onSelectStore: (store: Store) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  language: Language;
  isExplorerMode: boolean;
  onToggleExplorer: (active: boolean) => void;
  onSelectProduct: (product: Product) => void;
  stores?: Store[];
  categories?: { id: CategoryID; name: string; icon?: any; color?: string }[];
  onSeeMoreStores?: () => void;
  userLocation: { lat: number; lon: number; city: string } | null;
  loadingLocation: boolean;
  locationError: string | null;
  onRefreshLocation: () => void;
  deliveryZones?: { id: string; name: string; center_lat: number; center_lng: number }[];
  onSelectCity?: (city: { lat: number; lon: number; city: string }) => void;
}

const STORE_IMAGE_FALLBACK = '/store-placeholder.svg';
const withStoreFallback = (src?: string | null) => (src && src.trim() ? src : STORE_IMAGE_FALLBACK);
const onStoreImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src.includes(STORE_IMAGE_FALLBACK)) return;
  img.onerror = null;
  img.src = STORE_IMAGE_FALLBACK;
};

const Home: React.FC<HomeProps> = ({
  onSelectCategory,
  onSelectStore,
  favorites,
  onToggleFavorite,
  language,
  isExplorerMode,
  onToggleExplorer,
  onSelectProduct,
  stores,
  categories,
  onSeeMoreStores,
  userLocation,
  loadingLocation,
  locationError,
  onRefreshLocation,
  deliveryZones = [],
  onSelectCity
}) => {
  const { searchProducts, hasMoreStores, loadMoreStores, loadingCatalog, newProductsData, reloadCatalog, catalogLoadError } = useCatalog();

  const [activeBanner, setActiveBanner] = useState(0);
  const [searching, setSearching] = useState(false);

  const [catalogLoadStuck, setCatalogLoadStuck] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [serverSearchProducts, setServerSearchProducts] = useState<Product[]>([]);
  const [scrollInfo, setScrollInfo] = useState({
    isScrollable: false,
    isAtTop: true,
    isAtBottom: false,
    scrollProgress: 0
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isScrollable = element.scrollHeight > element.clientHeight;
    const isAtTop = element.scrollTop === 0;
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 10;
    const scrollProgress = element.scrollHeight > element.clientHeight 
      ? element.scrollTop / (element.scrollHeight - element.clientHeight) 
      : 0;
    
    setScrollInfo({
      isScrollable,
      isAtTop,
      isAtBottom,
      scrollProgress
    });
  }, []);

  const searchQueryNorm = searchQuery.trim().toLowerCase();

  const filteredStoresForSearch = useMemo(() => {
    if (!searchQueryNorm) return [];
    return (stores || []).filter(
      (s) =>
        s.name.toLowerCase().includes(searchQueryNorm) ||
        String(s.category).toLowerCase().includes(searchQueryNorm)
    );
  }, [searchQueryNorm, stores]);

  const localProductMatches = useMemo(() => {
    if (!searchQueryNorm) return [];
    return newProductsData.filter((p) => p.name.toLowerCase().includes(searchQueryNorm)).slice(0, 20);
  }, [searchQueryNorm, newProductsData]);

  /** Pendant le fetch réseau : aperçu local ; après : résultats serveur, ou local si le serveur est vide. */
  const displayedSearchProducts = useMemo(() => {
    if (!searchQueryNorm) return [];
    if (searching) return localProductMatches;
    return serverSearchProducts.length > 0 ? serverSearchProducts : localProductMatches;
  }, [searchQueryNorm, searching, serverSearchProducts, localProductMatches]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setServerSearchProducts([]);
      setSearching(false);
      return;
    }
    setServerSearchProducts([]);
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const prods = await searchProducts(searchQuery.trim(), { signal: ac.signal });
        if (ac.signal.aborted) return;
        setServerSearchProducts(prods);
      } finally {
        if (!ac.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [searchQuery, searchProducts]);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showCityModal, setShowCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const storeSource = stores && stores.length > 0 ? stores : [];
  const categorySource = categories && categories.length > 0 ? categories : [];
  const cityOptions = useMemo(
    () =>
      (deliveryZones || [])
        .filter((z: any) => z?.name)
        .map((z: any) => ({
          id: String(z.id),
          name: String(z.name),
          lat: Number(z.center_lat),
          lon: Number(z.center_lng),
        }))
        .filter((z: any) => Number.isFinite(z.lat) && Number.isFinite(z.lon))
        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr')),
    [deliveryZones]
  );
  const filteredCityOptions = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return cityOptions;
    return cityOptions.filter((city: any) => city.name.toLowerCase().includes(q));
  }, [cityOptions, citySearch]);

  const cityModal = showCityModal
    ? createPortal(
      <div className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCityModal(false)}>
        <div className="w-full max-w-xl rounded-3xl border border-orange-200/60 bg-white shadow-2xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
              {language === 'en' ? 'Choose your city' : 'Choisissez votre ville'}
            </h3>
            <button
              type="button"
              onClick={() => setShowCityModal(false)}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black"
            >
              ×
            </button>
          </div>

          <input
            value={citySearch}
            onChange={(e) => setCitySearch(sanitizeSearchInput(e.target.value))}
            placeholder={language === 'en' ? 'Search city...' : 'Rechercher une ville...'}
            className="w-full mb-4 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
          />

          <div className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {filteredCityOptions.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 m-0">
                {language === 'en' ? 'No city found.' : 'Aucune ville trouvee.'}
              </p>
            ) : (
              filteredCityOptions.map((city: any) => (
                <button
                  key={city.id}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors"
                  onClick={() => {
                    onSelectCity?.({ lat: city.lat, lon: city.lon, city: city.name });
                    setShowCityModal(false);
                  }}
                >
                  <p className="m-0 font-bold text-slate-900">{city.name}</p>
                  <p className="m-0 text-xs text-slate-500">
                    {language === 'en' ? 'Available delivery zone' : 'Zone de livraison disponible'}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onRefreshLocation();
                setShowCityModal(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-orange-600 transition-colors"
            >
              {language === 'en' ? 'Use my location' : 'Utiliser ma localisation'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  /** Si le catalogue ne répond pas, évite le squelette infini : après 14 s on affiche l’UI + message. */
  useEffect(() => {
    if (storeSource.length > 0 || categorySource.length > 0) {
      setCatalogLoadStuck(false);
      return;
    }
    if (!loadingCatalog) return;
    const timer = window.setTimeout(() => setCatalogLoadStuck(true), 14_000);
    return () => window.clearTimeout(timer);
  }, [loadingCatalog, storeSource.length, categorySource.length]);



  const hasSearchResults = searchQuery.trim().length > 0;

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data } = await catalogRepo.announcements();
      if (data && data.length > 0) setAnnouncements(data);
      else {
        setAnnouncements([
          { title: t('freeDelivery'), content: t('onFirstOrder'), images: [], color: 'from-orange-400 to-orange-600' },
          { title: t('pharmacy247'), content: t('medsIn15'), images: [], color: 'from-emerald-400 to-emerald-600' },
          { title: t('bakeryPromo'), content: t('bakeryDiscount'), images: [], color: 'from-amber-400 to-amber-600' },
        ]);
      }
    };
    fetchAnnouncements();
  }, [language]);

  useEffect(() => {
    if (announcements.length > 0) {
      const timer = setInterval(() => {
        setActiveBanner(prev => (prev + 1) % announcements.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [announcements.length]);

  if (loadingCatalog && storeSource.length === 0) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="veetaa-home animate-premium">
      {catalogLoadStuck && (
        <div className="mx-4 lg:mx-auto max-w-5xl mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900 m-0">{t('catalogSlowLoadHint')}</p>
            {catalogLoadError && (
              <p className="text-xs font-mono text-red-800 mt-2 break-words m-0 opacity-90" role="status">
                {catalogLoadError}
              </p>
            )}
          </div>
          <button
            type="button"
            className="shrink-0 px-5 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-orange-600 transition-colors"
            onClick={() => {
              setCatalogLoadStuck(false);
              void reloadCatalog();
            }}
          >
            {t('retry')}
          </button>
        </div>
      )}
      <div className="veetaa-dashboard-layout">
        
        {/* === LEFT SIDEBAR === */}
        <aside className="veetaa-sidebar-nav hidden lg:block !sticky !top-28">
           <h3 className="veetaa-sidebar-title flex items-center gap-2 mb-6">
              <List size={18} className="text-orange-600" />
              {t('services')}
              <ChevronDown size={16} className="ml-auto text-orange-600 animate-bounce" />
           </h3>
           
           <div 
              className="veetaa-services-scroll-container veetaa-scroll-fade pr-2 -mr-2 space-y-2"
              onScroll={handleScroll}
            >
              {/* Badge d'indication de scroll */}
              {scrollInfo.isScrollable && !scrollInfo.isAtTop && (
                <div className="veetaa-scroll-badge">
                  {scrollInfo.isAtBottom ? 'Fin' : 'Scroll'}
                </div>
              )}
              
              {/* Indicateur de progression */}
              {scrollInfo.isScrollable && (
                <div 
                  className="veetaa-scroll-indicator" 
                  style={{
                    top: `${50 + (scrollInfo.scrollProgress * 100 - 50)}%`,
                    opacity: scrollInfo.scrollProgress > 0 ? 1 : 0.3
                  }}
                />
              )}
              
              {categorySource.map((cat, index) => (
                <div key={`${cat.id}-${index}`} onClick={() => onSelectCategory(cat.id)} className="veetaa-service-link group !py-4 transition-all">
                   <div className="veetaa-service-link-icon !w-14 !h-14">
                      {typeof cat.icon === 'string' ? <img src={cat.icon} alt={cat.name} className="w-10 h-10 object-contain" /> : <div className="text-slate-400 group-hover:text-orange-600 scale-125 transition-transform">{cat.icon}</div>}
                   </div>
                   <span className="veetaa-service-link-label !text-base !font-black uppercase tracking-tight">{cat.name}</span>
                   <ChevronRight size={18} className="ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-orange-600" />
                </div>
              ))}
           </div>

           <Link to="/settings/help" className="mt-10 block bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2.5rem] text-white relative overflow-hidden shadow-[0_20px_40px_-15px_rgba(249,115,22,0.5)] group hover:-translate-y-1 transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-orange-900/20 rounded-full blur-2xl" />
              <div className="relative p-8 z-10 flex flex-col h-full">
                 <p className="text-[10px] font-black uppercase text-orange-200 tracking-[0.2em] mb-2 drop-shadow-sm">Centre de Support</p>
                 <div className="mt-auto px-6 py-4 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm flex items-center justify-between group-hover:bg-white group-hover:text-orange-600 transition-all duration-300 shadow-sm">
                    <span className="text-[11px] font-black uppercase tracking-widest">Besoin d'aide ?  </span>
                    <ChevronRight size={16} className="text-white group-hover:text-orange-600 transition-colors" />
                 </div>
              </div>
           </Link>
        </aside>

        {/* === MAIN CONTENT === */}
        <main className="veetaa-main-desktop">
          {!isExplorerMode && (
            <section className="veetaa-command-center">
              <div
                className="veetaa-location-bar cursor-pointer"
                onClick={() => setShowCityModal(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setShowCityModal(true);
                }}
              >
                <div className="p-3 bg-orange-100 rounded-xl text-orange-600">
                  <MapPin size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('deliveringTo')}</p>
                  <p className="text-base font-bold truncate">{userLocation?.city || t('unavailable')}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefreshLocation();
                  }}
                  className="p-3 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <Navigation size={20} className="text-slate-600" />
                </button>
              </div>

              <div className="veetaa-search-wrap">
                <Search className={`veetaa-search-icon ${searching ? 'animate-pulse' : ''}`} size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(sanitizeSearchInput(e.target.value))}
                  placeholder={t('searchPlaceholder')}
                  className="veetaa-search-input"
                />
              </div>
            </section>
          )}

          {/* MOBILE CATEGORY SCROLL */}
          {!hasSearchResults && categorySource.length > 0 && (
            <div className="lg:hidden flex gap-3 overflow-x-auto no-scrollbar py-4 px-1 snap-x mt-4">
              {categorySource.map((cat, index) => (
                <button key={`mcat-${cat.id}-${index}`} onClick={() => onSelectCategory(cat.id)} className="flex flex-col items-center gap-2 min-w-[76px] snap-start hover:scale-105 active:scale-95 transition-transform outline-none group">
                  <div className="w-16 h-16 rounded-[1.3rem] bg-white shadow-md flex items-center justify-center p-3 border border-slate-50 group-hover:border-orange-200 group-hover:bg-orange-50 transition-colors">
                    {typeof cat.icon === 'string' ? <img src={cat.icon} alt={cat.name} className="w-full h-full object-contain drop-shadow-sm" /> : <div className="text-slate-400 group-hover:text-orange-600 scale-125 transition-transform">{cat.icon}</div>}
                  </div>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter text-center line-clamp-1 group-hover:text-orange-600 transition-colors">{cat.name}</span>
                </button>
              ))}
            </div>
          )}

          {hasSearchResults && (
            <div className="veetaa-search-results mb-10">
              {searching && displayedSearchProducts.length === 0 && filteredStoresForSearch.length === 0 && (
                <div className="flex items-center justify-center gap-3 p-8 text-slate-500 font-bold text-sm">
                  <Loader2 className="animate-spin shrink-0 text-orange-600" size={22} aria-hidden />
                  <span>{t('searchScanning')}</span>
                </div>
              )}
              {displayedSearchProducts.length > 0 && (
                <div>
                  <h3 className="veetaa-section-title"><ShoppingBag size={20} /> {t('products')}</h3>
                  <div className="veetaa-search-row no-scrollbar">
                    {displayedSearchProducts.map((p, idx) => (
                      <SearchProductCard key={`${p.id}-${idx}`} product={p} onSelectProduct={onSelectProduct} />
                    ))}
                  </div>
                </div>
              )}
              {filteredStoresForSearch.length > 0 && (
                <div className="mt-6">
                  <h3 className="veetaa-section-title"><LayoutGrid size={20} /> {t('stores')}</h3>
                  <div className="veetaa-search-row no-scrollbar">
                    {filteredStoresForSearch.map((store) => (
                      <SearchStoreCard key={store.id} store={store} productsLabel={t('products')} onSelectStore={onSelectStore} />
                    ))}
                  </div>
                </div>
              )}
              {!searching && displayedSearchProducts.length === 0 && filteredStoresForSearch.length === 0 && (
                <div className="p-10 text-center text-slate-400 font-bold">{t('tryAnotherSearch')}</div>
              )}
            </div>
          )}

          {!hasSearchResults && !isExplorerMode && announcements.length > 0 && (
            <section className="veetaa-hero">
              <div className="veetaa-hero-slides">
                {announcements.map((announcement, idx) => (
                  <div
                    key={announcement.id || idx}
                    className={`veetaa-hero-slide transition-opacity duration-1000 ${idx === activeBanner ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                    style={{ backgroundImage: announcement.images?.[0] ? `url(${announcement.images[0]})` : undefined }}
                  >
                    {!announcement.images?.[0] && <div className={`absolute inset-0 bg-gradient-to-br ${announcement.color || 'from-orange-500 to-orange-700'}`} />}
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="veetaa-hero-content">
                      <h2 className="veetaa-hero-title !text-3xl lg:!text-5xl">{announcement.title}</h2>
                      <p className="veetaa-hero-text lg:!text-xl">{announcement.content}</p>
                      <button className="veetaa-btn-premium">{t('orderNow')} <Zap size={18} fill="currentColor" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!hasSearchResults && (
            <div className="space-y-16 mt-12 pb-24">
              {/* === SECTION 1: POPULAR STORES (Horizontal) === */}
              {storeSource.filter(s => s.isFeatured).length > 0 && (
                <section className="veetaa-stores-section">
                  <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-3">
                       <Star size={24} className="text-orange-600 fill-orange-600 animate-pulse" />
                       <h3 className="text-2xl font-black text-slate-900 m-0">Magasins Populaires</h3>
                    </div>
                  </div>
                  <div className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar pb-10 px-2 -mx-2 snap-x">
                    {storeSource.filter(s => s.isFeatured).map((store, idx) => (
                      <div key={`pop-${store.id}-${idx}`} className="min-w-[220px] sm:min-w-[320px] snap-start">
                        <HomeStoreCard store={store} viewStoreLabel={t('viewStore')} onSelectStore={onSelectStore} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* === SECTION 2: NEW STORES (Horizontal) === */}
              {storeSource.filter(s => s.is_new).length > 0 && (
                <section className="veetaa-stores-section">
                  <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-3">
                       <Zap size={24} className="text-purple-600 fill-purple-600" />
                       <h3 className="text-2xl font-black text-slate-900 m-0">Nouveaux Magasins</h3>
                    </div>
                  </div>
                  <div className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar pb-10 px-2 -mx-2 snap-x">
                    {storeSource.filter(s => s.is_new).map((store, idx) => (
                      <div key={`new-${store.id}-${idx}`} className="min-w-[220px] sm:min-w-[320px] snap-start">
                        <HomeStoreCard store={store} viewStoreLabel={t('viewStore')} onSelectStore={onSelectStore} showNewBadge />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* === SECTION 3: ALL OTHER STORES (Grid) === */}
              <section className="veetaa-stores-section">
                <div className="flex items-center justify-between mb-8 px-2">
                  <div className="flex items-center gap-3">
                     <LayoutGrid size={24} className="text-slate-400" />
                     <h3 className="text-2xl font-black text-slate-900 m-0">Autres Magasins</h3>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-8 px-1 md:px-2">
                  {storeSource.filter(s => !s.isFeatured && !s.is_new).map((store, idx) => (
                    <HomeStoreCard key={`other-${store.id}-${idx}`} store={store} viewStoreLabel={t('viewStore')} onSelectStore={onSelectStore} />
                  ))}
                </div>

                {storeSource.length === 0 && (
                  <div className="text-center py-16 px-4 rounded-[2rem] bg-slate-50 border border-dashed border-slate-200">
                    <p className="text-slate-600 font-bold m-0 mb-2">{t('noStoresYet')}</p>
                    {!catalogLoadError && !userLocation && (
                      <p className="text-sm text-slate-500 m-0 mb-3 max-w-md mx-auto">
                        {language === 'en'
                          ? 'Choose your delivery city (click “Deliver to” above) or allow location access.'
                          : 'Choisissez votre ville de livraison (cliquez sur « Livrer à » ci-dessus) ou autorisez la géolocalisation.'}
                      </p>
                    )}
                    {!catalogLoadError && userLocation && (
                      <p className="text-sm text-slate-500 m-0 mb-3 max-w-md mx-auto">
                        {language === 'en'
                          ? 'No stores in your zone. Pick another city from the list.'
                          : 'Aucun magasin dans votre zone. Choisissez une autre ville dans la liste.'}
                      </p>
                    )}
                    {catalogLoadError && (
                      <p className="text-xs font-mono text-red-700 break-words m-0 max-w-2xl mx-auto">{catalogLoadError}</p>
                    )}
                    {!catalogLoadError && !userLocation && (
                      <button
                        type="button"
                        onClick={() => setShowCityModal(true)}
                        className="mt-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-colors"
                      >
                        {language === 'en' ? 'Choose a city' : 'Choisir une ville'}
                      </button>
                    )}
                  </div>
                )}
                
                {hasMoreStores && storeSource.length > 0 && (
                  <div className="flex justify-center mt-12 bg-white/40 backdrop-blur-sm p-10 rounded-[3rem] border border-slate-50 shadow-sm">
                    <button 
                      onClick={loadMoreStores} 
                      className="px-12 py-5 bg-slate-900 text-white rounded-[1.5rem] text-[12px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-2xl active:scale-95"
                    >
                      Charger Plus de Magasins
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {cityModal}
    </div>
  );
};

// ... keep SearchProductCard, SearchStoreCard, HomeStoreCard as before ...
const SearchProductCard = React.memo<{ product: Product & { storeName?: string }; onSelectProduct: (p: Product) => void }>(
  ({ product, onSelectProduct }) => (
    <button onClick={() => onSelectProduct(product)} className="veetaa-product-card-mini group">
      <div className="overflow-hidden bg-slate-100">
        <img src={product.image} className="w-full h-24 object-cover group-hover:scale-110 transition-transform duration-500" alt={product.name} />
      </div>
      <div className="p-3">
        <h4 className="font-bold text-[11px] line-clamp-1">{product.name}</h4>
        <p className="text-[9px] text-slate-400 mt-1 font-bold">{product.storeName || 'Store'} · {product.price} DH</p>
      </div>
    </button>
  )
);

const SearchStoreCard = React.memo<{ store: Store; productsLabel: string; onSelectStore: (s: Store) => void }>(
  ({ store, productsLabel, onSelectStore }) => (
    <button onClick={() => onSelectStore(store)} className="veetaa-store-card-mini group">
      <div className="overflow-hidden bg-slate-100">
        <img
          src={withStoreFallback(store.image)}
          onError={onStoreImageError}
          className="w-full h-24 object-cover group-hover:scale-110 transition-transform duration-500"
          alt={store.name}
        />
      </div>
      <div className="p-3">
        <h4 className="font-bold text-[12px] line-clamp-1">{store.name}</h4>
        <p className="text-[9px] text-slate-400 mt-1 font-bold">{store.products?.length || 0} {productsLabel}</p>
      </div>
    </button>
  )
);

const HomeStoreCard = React.memo<{ store: Store; viewStoreLabel: string; onSelectStore: (s: Store) => void; showNewBadge?: boolean }>(
  ({ store, viewStoreLabel, onSelectStore, showNewBadge }) => (
    <div onClick={() => onSelectStore(store)} className="veetaa-store-card group cursor-pointer border-none !shadow-lg hover:!shadow-2xl transition-all h-full flex flex-col">
      <div className="veetaa-store-card-img-wrap overflow-hidden flex-shrink-0">
        <img
          src={withStoreFallback(store.image)}
          onError={onStoreImageError}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
          alt={store.name}
        />
        {showNewBadge && <span className="absolute top-4 left-4 bg-orange-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg">NEW</span>}
        <div className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md rounded-xl shadow-sm hover:bg-orange-600 hover:text-white transition-colors">
          <Heart size={18} />
        </div>
      </div>
      <div className="p-3 md:p-6 flex flex-col flex-1">
        <h4 className="font-black text-[13px] md:text-xl text-slate-900 line-clamp-1 mb-1">{store.name}</h4>
        <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-3 md:mb-6">
           <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{store.category}</span>
           <span className="hidden md:block w-1 h-1 rounded-full bg-slate-200" />
           <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-md md:rounded-lg border border-amber-100">
              <Star size={10} className="text-amber-400 fill-amber-400 md:w-3 md:h-3" />
              <span className="text-[10px] md:text-[11px] font-black text-amber-700">{store.rating ?? '4.8'}</span>
           </div>
        </div>
        <button className="w-full mt-auto py-2.5 md:py-4 bg-slate-100 group-hover:bg-slate-900 text-slate-900 group-hover:text-white rounded-xl md:rounded-2xl text-[10px] md:text-[12px] font-black uppercase tracking-widest transition-all duration-300 transform md:group-hover:-translate-y-1">
          {viewStoreLabel}
        </button>
      </div>
    </div>
  )
);

export default Home;
