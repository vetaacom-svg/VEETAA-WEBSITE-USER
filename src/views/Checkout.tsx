
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { CartItem, Store, Order, CategoryID, UserProfile, Language } from '../types';

import { MapPin, User, Banknote, Landmark, CheckCircle, Camera, X, AlertCircle, Navigation, ShoppingCart, Plus, Minus, FileText, ShieldCheck, Map, ArrowLeft, CreditCard, ShoppingBag, Trash2, Tag, Loader2 } from 'lucide-react';
import { validatePromoCode, PromoCode, incrementPromoUsage, normalizePromoCodeInput } from '../lib/promoService';

const MapPicker = lazy(() => import('../components/MapPicker'));

import { TRANSLATIONS } from '../constants';
import { getRibs, Rib } from '../lib/ribService';
import { compressDataUrlWithTimeout } from '../lib/imageUtils';

import { getCityFromCoordinates, isLocationServiceable, averageDeliveryFeesFromStores, DEFAULT_DELIVERY_FEE_SETTINGS } from '../lib/location';
import { resolveImageUrl } from '../context/CatalogContext';
import type { DeliveryZone } from '../lib/settingsService';

interface CheckoutProps {
  language: Language;
  user: UserProfile | null;
  cart: CartItem[];
  textOrder: string;
  prescriptionImage: string | null;
  total: number;
  /** DH per km beyond `deliveryIncludedKm` (from `settings.delivery_fee_per_km`) */
  deliveryFeePerKm?: number;
  /** Base delivery DH (`settings.delivery_base_fee`, default 15) */
  deliveryBaseFee?: number;
  /** First km included in base fee (`settings.delivery_included_km` or `delivery_free_km`, default 1) */
  deliveryIncludedKm?: number;
  selectedStore: Store | null;
  /** Tous les magasins distincts du panier ; frais de livraison = moyenne des frais par magasin. */
  deliveryStores?: Store[];
  selectedCategory: CategoryID;
  onPlaceOrder: (order: Order) => void | Promise<void>;
  onUpdateCartItem?: (index: number, quantity: number) => void;
  onRemoveCartItem?: (index: number) => void;
  onClearCart?: () => void;
  onBack?: () => void;
  userLocation?: { lat: number; lon: number; city: string } | null;
  deliveryZone?: DeliveryZone;
}

const Checkout: React.FC<CheckoutProps> = ({
  language, user, cart, total, deliveryFeePerKm, deliveryBaseFee, deliveryIncludedKm, textOrder, prescriptionImage, selectedStore, deliveryStores, selectedCategory,
  onPlaceOrder, onUpdateCartItem, onRemoveCartItem, onClearCart, onBack, userLocation, deliveryZone
}) => {
  const [location, setLocation] = useState<{ lat: number, lng: number, city?: string, addressDetails?: string } | null>(userLocation ? { lat: userLocation.lat, lng: userLocation.lon, city: userLocation.city } : null);
  const [locError, setLocError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'method' | 'rib' | 'receipt'>('method');
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
  const [selectedRib, setSelectedRib] = useState<string | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ribs, setRibs] = useState<Rib[]>([]);
  const [ribsError, setRibsError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Promo code states
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
  /**
   * Délai de garde uniquement (pas d’abort Supabase avant ça).
   * 8 s était trop court : le client fait déjà retry/timeout réseau (~20 s / tentative) ;
   * annuler à 8 s affichait « délai dépassé » alors que le code était bon.
   */
  const PROMO_HARD_LIMIT_MS = 55_000;
  const confirmInFlightRef = useRef(false);
  const COMPRESS_TIMEOUT_MS = 25_000;
  /** Délai commande : réseau lent / gros payload Supabase / 4G */
  const CONFIRM_TIMEOUT_MS = 120_000;

  const showOrderFeedback = useCallback((msg: string) => {
    setOrderFeedback(msg);
    window.setTimeout(() => setOrderFeedback(null), 10_000);
  }, []);

  useEffect(() => {
    import('../components/MapPicker');
  }, []);

  const {
    effectiveDeliveryFee,
    distanceKm,
    ratePerKm,
    storeDetails,
    /** Barème affiché : même logique que le calcul (global + magasins / legacy delivery_fee). */
    settingsBaseDh,
    settingsIncludedKm,
    settingsPerKmDh,
  } = useMemo(() => {
    const perKm = deliveryFeePerKm != null && deliveryFeePerKm > 0 ? deliveryFeePerKm : DEFAULT_DELIVERY_FEE_SETTINGS.perKmDh;
    const globalBaseFallback = deliveryBaseFee != null && deliveryBaseFee >= 0 ? deliveryBaseFee : DEFAULT_DELIVERY_FEE_SETTINGS.baseFeeDh;
    const includedKm = deliveryIncludedKm != null && deliveryIncludedKm >= 0 ? deliveryIncludedKm : DEFAULT_DELIVERY_FEE_SETTINGS.includedKm;

    const storesList = deliveryStores != null && deliveryStores.length > 0 ? deliveryStores : selectedStore != null ? [selectedStore] : [];

    if (storesList.length === 0) {
      return {
        effectiveDeliveryFee: globalBaseFallback,
        distanceKm: 0,
        ratePerKm: perKm,
        storeDetails: [] as { name: string; distanceKm: number }[],
        settingsBaseDh: globalBaseFallback,
        settingsIncludedKm: includedKm,
        settingsPerKmDh: perKm,
      };
    }

    const agg = averageDeliveryFeesFromStores(
      storesList,
      location ? { lat: location.lat, lng: location.lng } : null,
      globalBaseFallback,
      includedKm,
      perKm
    );

    return {
      effectiveDeliveryFee: agg.averageFeeDh,
      distanceKm: agg.averageDistanceKm,
      storeDetails: agg.storeDetails,
      ratePerKm: perKm,
      settingsBaseDh: agg.averageBaseFee,
      settingsIncludedKm: agg.averageIncludedKm,
      settingsPerKmDh: agg.averageRatePerKm,
    };
  }, [location, selectedStore, deliveryStores, deliveryFeePerKm, deliveryBaseFee, deliveryIncludedKm]);

  const t = useCallback((key: string) => TRANSLATIONS[language][key] || key, [language]);

  useEffect(() => {
    getRibs().then((result) => {
      if (result.error) setRibsError(result.error);
      setRibs(result.data);
    });
  }, []);

  const handleRibClick = async (rib: string) => {
    try {
      await navigator.clipboard.writeText(rib);
      setNotification(t('ribCopied'));
    } catch (err) {
      console.error('Failed to copy', err);
      setNotification(t('copyFailed') || 'Copie impossible');
    }
    setTimeout(() => setNotification(null), 3000);
    setSelectedRib(rib);
    setPaymentStep('receipt');
  };

  const handleLocationError = useCallback(
    (error: Pick<GeolocationPositionError, 'code' | 'message'> & { message?: string }) => {
      if (error.code === 1) {
        setLocError(`${t('permissionDenied')} ${t('locationDeniedHelp')}`);
      } else if (error.code === 3) {
        setLocError(t('locationTimeout'));
      } else if (error.code === 2) {
        setLocError(language === 'fr' ? 'Position indisponible. Activez le GPS ou choisissez sur la carte.' : language === 'ar' ? 'الموقع غير متاح. شغّل GPS أو اختر على الخريطة.' : 'Position unavailable. Turn on GPS or pick on the map.');
      } else {
        setLocError(error.message || t('geolocationNotSupported'));
      }
    },
    [t, language]
  );

  const requestLocation = useCallback(() => {
    setIsLocating(true);
    setLocError(null);

    if (!navigator.geolocation) {
      setLocError(t('geolocationNotSupported'));
      setIsLocating(false);
      return;
    }

    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      setIsLocating(false);
    };

    const outerTimer = window.setTimeout(() => {
      if (!done) {
        setLocError(t('locationTimeout'));
        end();
      }
    }, 22000);

    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          window.clearTimeout(outerTimer);
          try {
            const { latitude, longitude } = pos.coords;
            let city: string;
            try {
              const timeoutPromise = new Promise<string>((_, reject) => {
                window.setTimeout(() => reject(new Error('city-timeout')), 8000);
              });
              city = await Promise.race([
                getCityFromCoordinates(latitude, longitude),
                timeoutPromise,
              ]);
            } catch {
              const { findNearestCity } = await import('../lib/location');
              city = findNearestCity(latitude, longitude);
            }
            setLocation({ lat: latitude, lng: longitude, city });
            if (!isLocationServiceable(latitude, longitude, deliveryZone)) {
              setLocError(t('notAvailableInYourCity'));
            }
          } catch (e) {
            console.error('Location reverse-geocode error:', e);
            setLocError(t('geolocationNotSupported'));
          } finally {
            end();
          }
        },
        (navError) => {
          // Code 1 = user denied permission: expected UX path, avoid noisy red error.
          if (navError?.code === 1) {
            if (import.meta.env.DEV) console.warn('Location permission denied by user.');
          } else {
            console.error('Location error:', navError);
          }
          window.clearTimeout(outerTimer);
          handleLocationError(navError);
          end();
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000,
        }
      );
    } catch (e) {
      console.error('Location init error:', e);
      handleLocationError({ code: 2, message: String(e) });
      window.clearTimeout(outerTimer);
      end();
    }
  }, [t, deliveryZone, handleLocationError]);

  useEffect(() => {
    if (userLocation) {
      setLocation({ lat: userLocation.lat, lng: userLocation.lon, city: userLocation.city });
    }
  }, [userLocation]);

  const handleApplyPromo = async () => {
    if (isVerifyingPromo) return;
    if (!promoInput.trim()) return;
    setIsVerifyingPromo(true);
    setPromoError(null);
    const timeoutMsg =
      language === 'ar'
        ? 'انتهت مهلة التحقق. حاول مرة أخرى.'
        : language === 'en'
          ? 'Verification timed out. Please try again.'
          : 'Délai de vérification dépassé (réseau très lent). Réessayez.';

    try {
      const verifyPromise = validatePromoCode(normalizePromoCodeInput(promoInput), total, user?.id);
      const limitPromise = new Promise<Awaited<ReturnType<typeof validatePromoCode>>>((resolve) => {
        window.setTimeout(() => resolve({ valid: false, error: timeoutMsg }), PROMO_HARD_LIMIT_MS);
      });

      const { valid, promo, error } = await Promise.race([verifyPromise, limitPromise]);
      if (valid && promo) {
        setAppliedPromo(promo);
        setPromoInput('');
      } else {
        setPromoError(error || (language === 'ar' ? 'رمز غير صالح.' : language === 'en' ? 'Invalid code.' : 'Code invalide.'));
      }
    } catch {
      setPromoError(
        language === 'ar'
          ? 'فشل التحقق من الرمز. حاول مرة أخرى.'
          : language === 'en'
            ? 'Failed to verify code. Please try again.'
            : 'Echec de verification du code. Reessayez.'
      );
    } finally {
      setIsVerifyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError(null);
    setPromoInput('');
  };

  const discountAmount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.type === 'percentage') {
      return Math.round((total * appliedPromo.value) / 100);
    } else {
      return appliedPromo.value;
    }
  }, [appliedPromo, total]);

  const finalTotal = Math.max(0, total + effectiveDeliveryFee - discountAmount);

  const handleConfirm = async () => {
    if (!user || !location) return;
    if (method === 'transfer' && !receiptImage) {
      showOrderFeedback(t('pleaseUploadReceipt'));
      return;
    }
    if (confirmInFlightRef.current) return;

    confirmInFlightRef.current = true;
    setIsUploading(true);
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      setIsUploading(false);
      showOrderFeedback(t('confirmTimeout'));
    }, CONFIRM_TIMEOUT_MS);

    try {
      let receiptBase64: string | undefined;
      let prescriptionBase64: string | undefined;

      if (receiptImage) {
        const compressed = await compressDataUrlWithTimeout(receiptImage, 600, 0.4, COMPRESS_TIMEOUT_MS);
        receiptBase64 = compressed.split(',')[1];
      }

      if (prescriptionImage) {
        const compressed = await compressDataUrlWithTimeout(prescriptionImage, 600, 0.4, COMPRESS_TIMEOUT_MS);
        prescriptionBase64 = compressed.split(',')[1];
      }

      if (timedOut) return;

      const order: Order = {
        id: '',
        userId: user.id || undefined,
        storeId: selectedStore?.id,
        customerName: user.fullName,
        phone: user.phone || user.email || '',
        location: location ? { lat: location.lat, lng: location.lng } : null,
        items: cart,
        textOrder: textOrder || undefined,
        prescriptionImage: prescriptionBase64,
        paymentReceiptImage: receiptBase64,
        total,
        totalFinal: finalTotal,
        status: 'pending',
        paymentMethod: method,
        rib: selectedRib || undefined,
        timestamp: Date.now(),
        category: selectedCategory,
        storeName: selectedStore?.name,
        deliveryFee: effectiveDeliveryFee,
        delivery_note: appliedPromo ? `[PROMO:${appliedPromo.code}] ` + (location.addressDetails || '') : (location.addressDetails || undefined)
      };

      await Promise.resolve(onPlaceOrder(order));

      if (timedOut) return;

      if (appliedPromo) {
        incrementPromoUsage(appliedPromo.id).catch(console.error);
      }
    } catch (e) {
      if (!timedOut) {
        console.error(e);
        const isCompressTimeout = e instanceof Error && e.message === 'compress-timeout';
        showOrderFeedback(
          isCompressTimeout
            ? language === 'ar'
              ? 'الصورة ثقيلة جداً. جرّب صورة أصغر.'
              : language === 'en'
                ? 'Image too heavy. Try a smaller photo.'
                : 'Image trop lourde. Réessayez avec une photo plus petite.'
            : t('errorUploadingImages')
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsUploading(false);
      confirmInFlightRef.current = false;
    }
  };

  const handleMapSelect = useCallback(async (coords: { lat: number; lng: number }, addressDetails?: string) => {
    const { findNearestCity } = await import('../lib/location');
    setLocation({ lat: coords.lat, lng: coords.lng, city: findNearestCity(coords.lat, coords.lng), addressDetails });
    setLocError(null);
    setNotification(language === 'fr' ? 'Position sélectionnée' : language === 'ar' ? 'تم اختيار الموقع' : 'Location selected');
    setTimeout(() => setNotification(null), 2000);
    try {
      const city = await getCityFromCoordinates(coords.lat, coords.lng);
      setLocation(prev => prev ? { ...prev, city } : prev);
    } catch {
      /* keep nearest city fallback */
    }
  }, [language]);

  if (cart.length === 0) {
    return (
      <div className="space-y-6 pb-40 min-h-[60vh] flex flex-col">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('finalize')}</h2>
          {onBack && (
            <button onClick={onBack} className="p-4 bg-slate-100 rounded-2xl active:scale-95 transition-all">
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
          <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold text-lg mb-2">{t('cartEmpty')}</p>
          <p className="text-slate-400 text-sm mb-6">{t('cartEmptyHint')}</p>
          {onBack && (
            <button onClick={onBack} className="px-8 py-3 bg-orange-500 text-white font-bold rounded-2xl active:scale-95">
              {t('back')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {orderFeedback && (
        <div
          className="fixed top-4 left-3 right-3 z-[100] mx-auto max-w-lg rounded-2xl bg-red-600 text-white px-4 py-3 text-sm font-bold shadow-xl text-center"
          role="alert"
        >
          {orderFeedback}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-2 md:px-4 pb-48 animate-premium">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-6 md:mb-10 pt-4 md:pt-6 px-2">
          <div className="space-y-1">
            <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">{t('finalize')}</h2>
            <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-black text-slate-400 tracking-widest uppercase">
              <User size={10} className="text-orange-600" />
              <span className="truncate max-w-[100px] md:max-w-none">{user?.fullName}</span>
              <span className="w-1 h-1 rounded-full bg-slate-200" />
              <span className="truncate max-w-[100px] md:max-w-none">{user?.phone || user?.email}</span>
            </div>
          </div>
          {onBack && (
            <button onClick={onBack} className="w-12 h-12 bg-white shadow-sm border border-slate-50 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-all active:scale-90">
              <ArrowLeft className="w-6 h-6 text-slate-800" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 items-start">
          {/* Left Column: Form Details */}
          <div className="lg:col-span-7 space-y-6 md:space-y-10">
            {/* Section 1: Address selection */}
            <section className="space-y-5">
              <div className="flex items-center gap-2 px-2">
                <MapPin size={18} className="text-orange-600" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{t('address')}</h3>
              </div>
              <div className={`p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border transition-all ${location ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${location ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <MapPin size={20} className="md:w-6 md:h-6" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm md:text-base font-black text-slate-900 truncate">{location ? location.city : t('positionRequired')}</p>
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-400 mt-0.5 line-clamp-1">{location?.addressDetails || locError || t('precisionRequired')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  {!location && (
                    <button onClick={requestLocation} disabled={isLocating} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                      {isLocating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                      {isLocating ? t('detecting') : t('useMyLocation')}
                    </button>
                  )}
                  <button onClick={() => setShowMapPicker(true)} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${location ? 'bg-white border border-orange-200 text-orange-600 shadow-sm' : 'bg-orange-600 text-white shadow-lg'}`}>
                    <Map size={16} />
                    {language === 'ar' ? 'Changer' : 'Modifier'}
                  </button>
                </div>
              </div>
            </section>

            {/* Section 2: Payment Method */}
            <section className="space-y-5">
              <div className="flex items-center gap-2 px-2">
                <CreditCard size={18} className="text-orange-600" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{t('paymentMethod')}</h3>
              </div>
              <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 p-1.5 md:p-2 flex gap-2 shadow-sm">
                <button onClick={() => setMethod('cash')} className={`flex-1 flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 rounded-xl md:rounded-[1.75rem] transition-all ${method === 'cash' ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400'}`}>
                  <Banknote size={16} />
                  <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{t('cash')}</span>
                </button>
                <button onClick={() => { setMethod('transfer'); setPaymentStep('rib'); }} className={`flex-1 flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 rounded-xl md:rounded-[1.75rem] transition-all ${method === 'transfer' ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400'}`}>
                  <Landmark size={18} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{t('transfer')}</span>
                </button>
              </div>

              {method === 'transfer' && (
                <div className="bg-orange-50/50 rounded-[2.5rem] p-6 border border-orange-100 animate-in slide-in-from-top-4 space-y-6">
                  {paymentStep === 'rib' && (
                    <div className="space-y-4">
                      {ribs.map((item, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-[1.5rem] border border-orange-100 shadow-sm space-y-3">
                          <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{item.label}</p>
                          <button onClick={() => handleRibClick(item.rib)} className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-orange-600 hover:text-white transition-all group/rib">
                            <span className="text-sm font-black text-slate-700 truncate group-hover/rib:text-white font-mono">{item.rib}</span>
                            <span className="text-[9px] font-black px-3 py-1 bg-white/20 rounded-full group-hover/rib:bg-white group-hover/rib:text-orange-600 uppercase">Copier</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {paymentStep === 'receipt' && (
                    <div className="space-y-4">
                      <div className="p-10 border-2 border-dashed border-orange-200 rounded-[2rem] bg-white flex flex-col items-center justify-center gap-4 cursor-pointer relative overflow-hidden">
                        {receiptImage ? (
                          <div className="absolute inset-0 w-full h-full">
                            <img src={receiptImage} className="w-full h-full object-cover" alt="" />
                            <button onClick={(e) => { e.stopPropagation(); setReceiptImage(null); }} className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-xl shadow-xl hover:scale-110 active:scale-90 transition-all"><X size={16}/></button>
                          </div>
                        ) : (
                          <>
                            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600"><Camera size={28} /></div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('selectReceipt')}</p>
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setReceiptImage(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }} />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section 3: Cart Items */}
            <section className="space-y-5">
              <div className="flex items-center gap-2 px-2">
                <ShoppingBag size={18} className="text-orange-600" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{t('yourOrder')}</h3>
              </div>
              <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 p-3 md:p-4 shadow-sm space-y-3">
                {cart.map((item, idx) => {
                  const lineImg = item.image_base64 && item.image_base64 !== '' ? (item.image_base64.startsWith('data:') ? item.image_base64 : `data:image/jpeg;base64,${item.image_base64}`) : resolveImageUrl(item.product?.image || item.product?.productImages?.[0], 'products');
                  return (
                    <div key={idx} className="flex gap-4 items-center p-2 rounded-2xl hover:bg-slate-50 transition-all group/item">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-50">
                        <img src={lineImg} className="w-full h-full object-cover" alt="" onError={(e) => { e.currentTarget.src = resolveImageUrl(null, 'products'); }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-0.5">{item.storeName}</p>
                        <h4 className="text-xs md:text-sm font-black text-slate-900 truncate">{item.product?.name}</h4>
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-400">{item.quantity} x {item.product?.price} DH</p>
                      </div>
                      <button onClick={() => onRemoveCartItem?.(idx)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition-all"><Trash2 size={16} /></button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column: Summary */}
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <div className="bg-slate-900 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl relative overflow-hidden text-white group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-orange-600/20 blur-3xl -mr-10 -mt-10 group-hover:scale-125 transition-transform duration-1000" />
              <div className="relative z-10 space-y-6 md:space-y-8">
                <div className="flex items-center gap-3 mb-6 md:mb-10">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-orange-500"><ShieldCheck size={20} /></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em]">{t('summary')}</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
                    <span>{t('subtotal')}</span>
                    <span className="text-white">{total} DH</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
                    <span>{t('deliveryFee')}</span>
                    <span className="text-orange-500">+{effectiveDeliveryFee} DH</span>
                  </div>

                  
                  {storeDetails && storeDetails.length > 0 && distanceKm > 0 && (
                    <div className="space-y-2 pt-3 border-t border-slate-800/50 mt-2">
                       {storeDetails.map((sd, i) => (
                          <div key={i} className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                             <span className="truncate max-w-[140px] pr-2">{sd.name}</span>
                             <span className="shrink-0">{sd.distanceKm.toFixed(1)} km</span>
                          </div>
                       ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/50 mt-4 space-y-4">
                  {appliedPromo ? (
                    <div className="flex justify-between items-center bg-green-500/10 rounded-xl p-3 border border-green-500/30">
                      <div className="flex items-center gap-2 text-green-400">
                        <Tag size={16} />
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">{appliedPromo.code}</p>
                          <p className="text-[10px] opacity-80 uppercase leading-none">{appliedPromo.type === 'percentage' ? `${appliedPromo.value}% de réduction` : `-${appliedPromo.value} DH`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400 font-black">-{discountAmount} DH</span>
                        <button onClick={handleRemovePromo} className="text-red-400 p-1"><X size={16} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => {
                            setPromoInput(e.target.value);
                            if (promoError) setPromoError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleApplyPromo();
                            }
                          }}
                          placeholder="Code promo ?"
                          disabled={isVerifyingPromo}
                          aria-invalid={!!promoError}
                          aria-describedby={promoError ? 'checkout-promo-error' : undefined}
                          className={`flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 border outline-none focus:border-orange-500 text-sm uppercase placeholder:normal-case font-mono disabled:opacity-60 ${promoError ? 'border-red-500 ring-1 ring-red-500/40' : 'border-slate-700'}`}
                        />
                        <button
                          type="button"
                          onClick={() => void handleApplyPromo()}
                          disabled={isVerifyingPromo || !promoInput.trim()}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 min-w-[108px] shrink-0 flex items-center justify-center"
                        >
                          {isVerifyingPromo ? <Loader2 size={16} className="animate-spin" /> : 'Appliquer'}
                        </button>
                      </div>
                      {promoError && (
                        <p
                          id="checkout-promo-error"
                          role="alert"
                          className="text-xs font-bold text-red-400 leading-snug flex items-start gap-2 m-0"
                        >
                          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden />
                          <span>{promoError}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t border-slate-800 flex justify-between items-end mt-4">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none">{t('total')}</p>
                      <p className="text-3xl md:text-4xl font-black text-white">{finalTotal} <span className="text-lg text-slate-500">DH</span></p>
                   </div>
                   <p className="text-[9px] font-bold text-slate-500 text-right uppercase tracking-widest">{method === 'cash' ? t('payOnDelivery') : t('transferVerifiedAfter')}</p>
                </div>

                <button onClick={handleConfirm} disabled={!location || (method === 'transfer' && !receiptImage) || isUploading} className="hidden md:flex w-full mt-8 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.4em] transition-all relative overflow-hidden group/btn items-center justify-center gap-3 bg-white text-slate-900 hover:bg-orange-600 hover:text-white shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /><span>{t('placeOrder')}</span></>}
                  </div>
                </button>
              </div>
            </div>

            {/* Sticky Mobile Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 z-50 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('total')}</p>
                  <p className="text-xl font-black text-slate-900 leading-none">{finalTotal} <span className="text-xs text-slate-400">DH</span></p>
                </div>
                <button onClick={handleConfirm} disabled={!location || (method === 'transfer' && !receiptImage) || isUploading} className="flex-1 py-4 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 disabled:bg-slate-100 disabled:text-slate-300">
                  {isUploading ? <Loader2 size={16} className="animate-spin mx-auto" /> : t('placeOrder')}
                </button>
              </div>
            </div>

            {/* Security Banner Info */}
            <div className="mt-8 px-6 py-4 flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl md:rounded-[2rem]">
              <div className="text-emerald-500 bg-emerald-100 p-2 rounded-xl"><ShieldCheck size={18} /></div>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-relaxed">Paiement sécurisé & protection garantie.</p>
            </div>
          </div>
        </div>
      </div>

      {showMapPicker && createPortal(
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-[9999] backdrop-blur-md" />}>
          <MapPicker
            initialCenter={location ?? (userLocation ? { lat: userLocation!.lat, lng: userLocation!.lon } : undefined)}
            initialAddressDetails={location?.addressDetails}
            onSelect={handleMapSelect}
            onClose={() => setShowMapPicker(false)}
            language={language}
          />
        </Suspense>,
        document.body
      )}
    </>
  );
};

export default Checkout;
