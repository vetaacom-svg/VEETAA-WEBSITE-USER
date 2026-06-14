
import React, { useState, useRef, useEffect } from 'react';
import { Product, CategoryID, Language } from '../types';
import { Camera, FileText, ShoppingCart, CheckCircle2, X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { sanitizePlainText } from '../lib/security';

// Icône personnalisée Coupe d'Hygie pour la zone d'upload
const HygieiaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 512 512" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M256 0c-44.2 0-80 35.8-80 80 0 16.6 5.1 32 13.8 44.8C117.7 143.7 64 203.6 64 275.6v20.4H0v32h512v-32h-64v-20.4c0-72-53.7-131.9-125.8-150.8 8.7-12.8 13.8-28.2 13.8-44.8 0-44.2-35.8-80-80-80zm0 32c26.5 0 48 21.5 48 48s-21.5 48-48 48-48-21.5-48-48 21.5-48 48-48zm0 128c61.9 0 112 50.1 112 112v13.6c-41.5 6.3-84.6 10.4-112 10.4s-70.5-4.1-112-10.4V272c0-61.9 50.1-112 112-112zm0 168c34.8 0 83.2-5.4 128-13.3v7.3c0 88.4-71.6 160-160 160S96 452.4 96 364v-7.3c44.8 7.9 93.2 13.3 128 13.3zm-32 152v32h64v-32H224z" />
  </svg>
);

const ImageGallery: React.FC<{ images: string[] }> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const lastTouchTimeRef = useRef(0);
  const initialDistanceRef = useRef(0);
  const initialScaleRef = useRef(1);
  const scaleRef = useRef(1);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const lastPanXRef = useRef(0);
  const lastPanYRef = useRef(0);
  scaleRef.current = scale;

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const getPinchDistance = (touches: React.TouchList | TouchList) =>
    Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);

  useEffect(() => {
    const el = zoomContainerRef.current;
    const wrapper = imageWrapperRef.current;
    if (!el || !isFullscreen) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialDistanceRef.current = getPinchDistance(e.touches);
        initialScaleRef.current = scaleRef.current;
      }
      if (e.touches.length === 1) {
        lastPanXRef.current = e.touches[0].pageX;
        lastPanYRef.current = e.touches[0].pageY;
        const now = Date.now();
        if (now - lastTouchTimeRef.current < 350) {
          setScale(s => (s === 1 ? 2.5 : 1));
          setTranslateX(0);
          setTranslateY(0);
        }
        lastTouchTimeRef.current = now;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getPinchDistance(e.touches);
        const newScale = Math.max(1, Math.min(5, initialScaleRef.current * (dist / initialDistanceRef.current)));
        setScale(newScale);
        return;
      }
      if (e.touches.length === 1 && scaleRef.current > 1) {
        e.preventDefault();
        const dx = e.touches[0].pageX - lastPanXRef.current;
        const dy = e.touches[0].pageY - lastPanYRef.current;
        lastPanXRef.current = e.touches[0].pageX;
        lastPanYRef.current = e.touches[0].pageY;
        const containerRect = el.getBoundingClientRect();
        const wrapperRect = wrapper?.getBoundingClientRect();
        const s = scaleRef.current;
        const maxX = wrapperRect && containerRect ? Math.max(0, (wrapperRect.width * s - containerRect.width) / 2) : 9999;
        const maxY = wrapperRect && containerRect ? Math.max(0, (wrapperRect.height * s - containerRect.height) / 2) : 9999;
        setTranslateX(prev => Math.max(-maxX, Math.min(maxX, prev + dx)));
        setTranslateY(prev => Math.max(-maxY, Math.min(maxY, prev + dy)));
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [isFullscreen]);

  return (
    <>
      <div className="relative w-full aspect-square bg-slate-900 rounded-[2.5rem] overflow-hidden group shadow-2xl ring-4 ring-slate-50">
        <div
          className="w-full h-full flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((img, idx) => (
            <div
              key={idx}
              className="w-full h-full flex-shrink-0 flex items-center justify-center p-2 cursor-zoom-in"
              onClick={() => setIsFullscreen(true)}
            >
              <img
                src={img}
                alt={`Product ${idx}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ))}
        </div>

        <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md p-1.5 rounded-full text-white pointer-events-none">
          <ZoomIn className="w-4 h-4" />
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 backdrop-blur-md text-white rounded-full active:scale-90 z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 backdrop-blur-md text-white rounded-full active:scale-90 z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 rounded-full transition-all ${idx === currentIndex ? 'bg-orange-500 w-4' : 'bg-white/40 w-1'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-[100] bg-black/98 flex flex-col"
          onClick={() => { setIsFullscreen(false); setScale(1); setTranslateX(0); setTranslateY(0); }}
        >
          <div className="absolute top-8 right-6 z-[110]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); setScale(1); setTranslateX(0); setTranslateY(0); }}
              className="p-3 bg-slate-900 text-white rounded-full shadow-lg"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div
            ref={zoomContainerRef}
            className="flex-1 w-full flex items-center justify-center overflow-hidden min-h-0"
            style={{ touchAction: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={imageWrapperRef}
              className="inline-flex max-w-full max-h-full items-center justify-center"
              style={{
                transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={images[currentIndex]}
                className="max-w-full max-h-full object-contain select-none pointer-events-none"
                alt="Zoomed"
                draggable={false}
              />
            </div>
          </div>

          <div className="p-6 text-center bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
            <p className="text-white/60 text-xs font-black uppercase tracking-[0.2em]">Pincer avec 2 doigts pour zoomer • Double-tap pour zoom</p>
          </div>
        </div>
      )}
    </>
  );
};

interface ProductOrderViewProps {
  product: Product;
  category: CategoryID;
  language: Language;
  onConfirm: (product: Product, quantity: number, text: string, image: string | null) => void;
}

const ProductOrderView: React.FC<ProductOrderViewProps> = ({ product, category, language, onConfirm }) => {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [price, setPrice] = useState(() => {
    const p = Number(product?.price) || 0;
    return p > 0 && p !== 20 ? p : 0;
  });
  const isPharmacy = category === CategoryID.PHARMACIE;
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const vis = product.userVisibleFields;
  const lab = product.userFieldLabels || {};
  const showName = vis ? vis.includes('name') : true;
  const showPriceField = vis ? vis.includes('price') : true;
  const showPic = vis ? vis.includes('image') : true;
  const showDescription = vis ? vis.includes('description') : true;
  const showCustomCommand = vis ? vis.includes('custom_note') : true;
  const customNotePlaceholder = lab.custom_note?.trim() || (isPharmacy ? t('pharmacyPlaceholder') : t('writeOrderPlaceholder'));
  const label = (key: string, fallback: string) => (lab[key]?.trim() || fallback);

  // Removed isImageZoomed and isMagnified states, and the useEffect related to setZoomEnabled.
  // The ImageGallery component now handles image display and basic zoom/magnification internally.

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const images = [product.image, ...(product.productImages || [])].filter(Boolean) as string[];

  return (
    <div className="p-6 space-y-8 animate-in slide-in-from-bottom-10 duration-500">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="w-48 max-w-full">
          <ImageGallery images={images} />
        </div>
        <div>
          {showName && <h2 className="text-3xl font-black text-slate-800 tracking-tight">{product.name}</h2>}
          {showPriceField && (
            <p className="text-orange-600 font-black text-xl">
              {product.price != null && product.price > 0 && product.price !== 20
                ? `${product.price} DH`
                : (t('priceOnRequest') || 'Sur devis')}
            </p>
          )}
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">{product.storeName}</p>
          {showDescription && product.description && (
            <p className="text-sm text-slate-600 mt-2 font-medium">{product.description}</p>
          )}
        </div>
      </div>

      {(!showPic || showCustomCommand || showPriceField) && (
        <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-8">
          {showCustomCommand && (
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                {isPharmacy ? "Détails de l'ordonnance / Médicaments" : "Instructions spéciales (Cuisson, Note, etc.)"}
              </label>
              <textarea
                className="w-full p-6 bg-white border border-slate-200 rounded-[2rem] focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none min-h-[140px] font-bold text-sm leading-relaxed shadow-sm transition-all"
                placeholder={customNotePlaceholder}
                value={text}
                onChange={(e) => setText(sanitizePlainText(e.target.value, 1200))}
              />
            </div>
          )}

          {showPriceField && (
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                {lab.budget_label?.trim() || lab.budget?.trim() || t('yourBudget')}
              </label>
              <div className="relative w-full max-w-[240px]">
                {product.priceEditable === false && product.price != null && product.price > 0 && product.price !== 20 ? (
                  <div
                    className="w-full bg-slate-100 border border-slate-200 rounded-[2rem] py-4 pl-6 pr-16 text-3xl font-black text-slate-700 text-center"
                    aria-readonly
                  >
                    {product.price} DH
                  </div>
                ) : (
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={price || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setPrice(val ? Number(val) : 0);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-[2rem] py-4 pl-6 pr-16 text-3xl font-black text-slate-900 text-center focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none transition-all shadow-sm"
                    placeholder="0"
                  />
                )}
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">DH</span>
              </div>
            </div>
          )}

          {showPic && (
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                {isPharmacy ? "Uploader votre Ordonnance" : "Photo de référence (Reçu ou Article) (optionnel)"}
              </label>
              <div className={`p-8 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${image ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-orange-300 hover:bg-slate-50'}`}>
                {image ? (
                  <div className="relative w-full h-40">
                    <img src={image} className="w-full h-full object-cover rounded-2xl" alt="Preview" />
                    <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg transition-transform active:scale-90"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-2xl shadow-inner">
                      {isPharmacy ? "💊" : "📸"}
                    </div>
                    <input type="file" accept="image/*" id="product-img" className="hidden" onChange={handleImageUpload} />
                    <label htmlFor="product-img" className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-8 py-3.5 rounded-xl cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg active:shadow-inner">SÉLECTIONNER PHOTO</label>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => {
          const fixedPrice = product.priceEditable === false && product.price != null && product.price > 0 && product.price !== 20;
          const finalPrice = fixedPrice ? product.price! : (Number(price) || 0);
          onConfirm({ ...product, price: finalPrice }, 1, text, image);
        }}
        className="w-full bg-slate-900 text-white py-5 rounded-[2.25rem] font-black text-lg shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95 transition-all uppercase tracking-tight"
      >
        <span>{t('addedToCart') ? t('viewCart') === 'View Cart' ? 'Add to Cart' : 'Ajouter au panier' : 'Ajouter au panier'} • {product.price != null && product.price > 0 && product.price !== 20 ? `${product.price} DH` : (Number(price) || 0) > 0 ? `${Number(price) || 0} DH` : (t('priceOnRequest') || 'Sur devis')}</span>
        <ShoppingCart className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ProductOrderView;
