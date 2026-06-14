
import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, Language } from '../types';
import { MapPin, Phone, ChevronLeft, Package, Clock, CheckCircle2, Navigation, Star, PhoneCall, XCircle, ExternalLink, Info, Map as MapIcon } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { makePhoneCall } from '../lib/nativeUtils';
import { getSupportInfo, SupportInfo } from '../lib/ribService';
import { updateDriverRating } from '../lib/database';
import { supabase, supabaseAnon } from '../lib/supabase-client';
import { Db } from '../data/tables';
import DeliveryTrackingMap from '../components/DeliveryTrackingMap';

/** Build image src list from invoice base64 array; use blob URL for large payloads to avoid URL limits on mobile WebView. */
function useStoreInvoiceSources(rawImages: string[] | undefined | null): string[] {
  const [sources, setSources] = useState<string[]>([]);
  const safeRaw = (rawImages || []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  useEffect(() => {
    if (safeRaw.length === 0) {
      setSources([]);
      return;
    }
    const blobUrls: string[] = [];
    const built: string[] = [];
    for (const raw of safeRaw) {
      try {
        const dataUrl = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
        if (dataUrl.length > 200000) {
          const base64Data = raw.startsWith('data:') ? raw.split(',')[1] : raw;
          const binary = atob(base64Data || '');
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'image/png' });
          const blobUrl = URL.createObjectURL(blob);
          blobUrls.push(blobUrl);
          built.push(blobUrl);
        } else {
          built.push(dataUrl);
        }
      } catch (e) {
        console.warn('Store invoice image prepare failed:', e);
        built.push(raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`);
      }
    }
    setSources(built);
    return () => {
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [safeRaw.join('|')]);
  return sources;
}

interface TrackingProps {
  language: Language;
  orders: Order[];
  trackingOrderId?: string | null;
  onBack: () => void;
}

const Tracking: React.FC<TrackingProps> = ({ language, orders, trackingOrderId, onBack }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [supportInfo, setSupportInfo] = useState<SupportInfo | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [hasRated, setHasRated] = useState(false);

  useEffect(() => {
    getSupportInfo().then(setSupportInfo);
  }, []);

  const activeOrder = trackingOrderId
    ? (orders.find((o) => String(o.id) === String(trackingOrderId)) ?? orders[0])
    : orders[0];

  const [liveOrder, setLiveOrder] = useState<Order | null>(activeOrder ?? null);
  const [invoiceIndex, setInvoiceIndex] = useState(0);
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch store coordinates for the map
  useEffect(() => {
    if (!liveOrder?.storeId) return;
    supabaseAnon
      .from(Db.stores)
      .select('latitude, longitude, lat, lng, maps_url')
      .eq('id', liveOrder.storeId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const sLat = data.latitude ?? data.lat;
        const sLng = data.longitude ?? data.lng;
        if (sLat && sLng && Number.isFinite(sLat) && Number.isFinite(sLng) && !(sLat === 0 && sLng === 0)) {
          setStoreLocation({ lat: sLat, lng: sLng });
        } else if (data.maps_url) {
          // Try parsing from Google Maps URL
          const qMatch = data.maps_url.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
          const atMatch = data.maps_url.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
          const m = qMatch || atMatch;
          if (m) {
            const lat = Number(m[1]);
            const lng = Number(m[2]);
            if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
              setStoreLocation({ lat, lng });
            }
          }
        }
      });
  }, [liveOrder?.storeId]);

  useEffect(() => {
    setLiveOrder(activeOrder ?? null);
  }, [activeOrder]);

  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!liveOrder?.id) return;

    const fetchLatestOrder = () => {
      supabaseAnon
        .from(Db.orders)
        .select('*')
        .eq('id', liveOrder.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('[Tracking] Error polling order details:', error);
            return;
          }
          if (!data) return;

          const rawList: string[] = [];
          const pushIfString = (v: unknown) => {
            if (typeof v !== 'string') return;
            const s = v.trim();
            if (s) rawList.push(s);
          };
          if (Array.isArray(data.custom_images_base64)) data.custom_images_base64.forEach(pushIfString);
          if (typeof data.store_invoice_base64 === 'string') {
            const raw = data.store_invoice_base64.trim();
            if (raw.startsWith('[') && raw.endsWith(']')) {
              try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) arr.forEach(pushIfString);
                else pushIfString(raw);
              } catch {
                pushIfString(raw);
              }
            } else {
              pushIfString(raw);
            }
          }

          setLiveOrder((prev) => {
            if (!prev) return prev;
            const nextImages = Array.from(new Set(rawList.length > 0 ? rawList : prev.storeInvoiceImages || []));
            const imagesChanged = JSON.stringify(prev.storeInvoiceImages || []) !== JSON.stringify(nextImages);

            if (
              prev.status !== data.status ||
              prev.assignedDriverId !== data.assigned_driver_id ||
              prev.totalFinal !== data.total_final ||
              prev.deliveryFee !== data.delivery_fee ||
              prev.storeInvoiceBase64 !== data.store_invoice_base64 ||
              imagesChanged
            ) {
              console.log('[Tracking] Order updated via polling/realtime:', data);
              return {
                ...prev,
                status: (data.status as OrderStatus) || prev.status,
                totalFinal: data.total_final ?? prev.totalFinal,
                deliveryFee: data.delivery_fee ?? prev.deliveryFee,
                storeInvoiceBase64: data.store_invoice_base64 ?? prev.storeInvoiceBase64,
                storeInvoiceImages: nextImages,
                statusHistory: data.status_history ?? prev.statusHistory,
                assignedDriverId: data.assigned_driver_id ?? prev.assignedDriverId,
              };
            }
            return prev;
          });
        });
    };

    // Fast-path: Supabase Realtime channel subscription
    const channel = supabaseAnon
      .channel(`order-track-${liveOrder.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: Db.orders, filter: `id=eq.${liveOrder.id}` }, (payload) => {
        console.log('[Tracking] Order postgres_changes UPDATE received:', payload.new);
        fetchLatestOrder();
      })
      .subscribe();

    // Polling fallback every 4 seconds
    const interval = setInterval(fetchLatestOrder, 4000);

    // Initial load
    fetchLatestOrder();

    return () => {
      clearInterval(interval);
      void channel.unsubscribe();
    };
  }, [liveOrder?.id]);

  // Fetch and track assigned driver coordinates in real-time + polling fallback
  useEffect(() => {
    if (!liveOrder?.assignedDriverId) {
      setDriverLocation(null);
      return;
    }

    const driverId = liveOrder.assignedDriverId;

    const fetchDriverLocation = () => {
      supabaseAnon
        .from('drivers')
        .select('last_lat, last_lng')
        .eq('id', driverId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('[Tracking] Error polling driver location:', error);
            return;
          }
          if (data && data.last_lat && data.last_lng) {
            setDriverLocation((prev) => {
              if (prev?.lat === data.last_lat && prev?.lng === data.last_lng) {
                return prev;
              }
              console.log('[Tracking] Driver location loaded/updated:', data);
              return { lat: data.last_lat, lng: data.last_lng };
            });
          }
        });
    };

    // Fast-path: Realtime updates on driver coordinates
    const driverChannel = supabaseAnon
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` },
        (payload) => {
          const row = payload.new as any;
          if (row && row.last_lat && row.last_lng) {
            console.log('[Tracking] Driver postgres_changes UPDATE received:', row);
            setDriverLocation({ lat: row.last_lat, lng: row.last_lng });
          }
        }
      )
      .subscribe();

    // Polling fallback every 4 seconds
    const interval = setInterval(fetchDriverLocation, 4000);

    // Initial load
    fetchDriverLocation();

    return () => {
      clearInterval(interval);
      void driverChannel.unsubscribe();
    };
  }, [liveOrder?.assignedDriverId]);

  const storeInvoiceSources = useStoreInvoiceSources(
    liveOrder?.storeInvoiceImages && liveOrder.storeInvoiceImages.length > 0
      ? liveOrder.storeInvoiceImages
      : liveOrder?.storeInvoiceBase64
      ? [liveOrder.storeInvoiceBase64]
      : []
  );

  useEffect(() => {
    if (invoiceIndex >= storeInvoiceSources.length) setInvoiceIndex(0);
  }, [invoiceIndex, storeInvoiceSources.length]);

  useEffect(() => {
    if (liveOrder && (liveOrder.status === 'delivered' || liveOrder.status === 'livree') && !hasRated && !liveOrder.driverRating) {
      const timer = setTimeout(() => {
        setShowRatingModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [orders, hasRated, liveOrder]);

  const handleRatingSubmit = async () => {
    if (selectedRating > 0 && liveOrder) {
      try {
        await updateDriverRating(liveOrder.id, selectedRating);
        setHasRated(true);
        setShowRatingModal(false);
      } catch (error) {
        console.error('Error submitting rating:', error);
      }
    }
  };

  if (!orders || orders.length === 0 || !liveOrder) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-center">
        <div className="space-y-6">
           <div className="w-24 h-24 bg-white shadow-xl rounded-[2.5rem] flex items-center justify-center mx-auto text-orange-600">
              <Package size={40} />
           </div>
           <h2 className="text-2xl font-black text-slate-800 tracking-tighter">{t('no_active_orders')}</h2>
           <button onClick={onBack} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-orange-600 transition-all">{t('back')}</button>
        </div>
      </div>
    );
  }

  const statusMap: Record<string, { label: string; color: string; bgColor: string; icon: any; step: number }> = {
    'pending': { label: t('en_attente'), color: 'text-slate-400', bgColor: 'bg-slate-100', icon: <Clock />, step: 0 },
    'en_attente': { label: t('en_attente'), color: 'text-slate-400', bgColor: 'bg-slate-100', icon: <Clock />, step: 0 },
    'verification': { label: t('en_verification'), color: 'text-amber-500', bgColor: 'bg-amber-50', icon: <CheckCircle2 />, step: 1 },
    'en_verification': { label: t('en_verification'), color: 'text-amber-500', bgColor: 'bg-amber-50', icon: <CheckCircle2 />, step: 1 },
    'accepted': { label: t('en_verification'), color: 'text-amber-500', bgColor: 'bg-amber-50', icon: <CheckCircle2 />, step: 1 },
    'traitement': { label: t('en_traitement'), color: 'text-blue-500', bgColor: 'bg-blue-50', icon: <Package />, step: 2 },
    'en_traitement': { label: t('en_traitement'), color: 'text-blue-500', bgColor: 'bg-blue-50', icon: <Package />, step: 2 },
    'preparing': { label: t('en_traitement'), color: 'text-blue-500', bgColor: 'bg-blue-50', icon: <Package />, step: 2 },
    'progression': { label: t('en_course'), color: 'text-orange-500', bgColor: 'bg-orange-50', icon: <Navigation />, step: 3 },
    'en_course': { label: t('en_course'), color: 'text-orange-500', bgColor: 'bg-orange-50', icon: <Navigation />, step: 3 },
    'delivering': { label: t('en_course'), color: 'text-orange-500', bgColor: 'bg-orange-50', icon: <Navigation />, step: 3 },
    'livree': { label: t('livree'), color: 'text-emerald-500', bgColor: 'bg-emerald-50', icon: <CheckCircle2 />, step: 4 },
    'delivered': { label: t('livree'), color: 'text-emerald-500', bgColor: 'bg-emerald-50', icon: <CheckCircle2 />, step: 4 }
  };

  const getStatusConfig = (status: string) => statusMap[status] || { label: status, color: 'text-slate-600', bgColor: 'bg-slate-50', icon: <Info />, step: 0 };
  const currentStatus = getStatusConfig(liveOrder.status);
  const activeStep = currentStatus.step;

  const trackingSteps = [
    { id: 0, label: t('en_attente'), icon: <Clock size={20} /> },
    { id: 1, label: t('en_verification'), icon: <CheckCircle2 size={20} /> },
    { id: 2, label: t('en_traitement'), icon: <Package size={20} /> },
    { id: 3, label: t('en_course'), icon: <Navigation size={20} /> },
    { id: 4, label: t('livree'), icon: <CheckCircle2 size={20} /> }
  ];

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-10 animate-premium">
      {/* Header Bar */}
      <div className="sticky top-0 z-[100] bg-white/80 backdrop-blur-2xl border-b border-slate-100 flex items-center justify-between px-4 md:px-6 py-3 md:py-5">
         <button onClick={onBack} className="p-2 md:p-3 bg-slate-50 rounded-xl md:rounded-2xl text-slate-600 hover:bg-orange-600 hover:text-white transition-all shadow-sm">
            <ChevronLeft size={18} />
         </button>
         <h1 className="text-xs md:text-sm font-black text-slate-900 tracking-widest uppercase">{t('tracking')}</h1>
         <div className="w-10" />
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-4 md:pt-10 space-y-4 md:space-y-8">
        {/* Status Metro Design Card */}
        <div className="bg-slate-900 rounded-2xl md:rounded-[3rem] p-6 md:p-10 shadow-2xl relative overflow-hidden text-white group">
           <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-orange-600/30 to-transparent opacity-50 group-hover:scale-110 transition-transform duration-1000" />
           <div className="relative z-10 flex flex-row items-center justify-between gap-4 md:gap-10">
              <div className="space-y-1 md:space-y-2 text-left">
                 <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Status Actuel</p>
                 <h2 className="text-xl md:text-4xl font-black tracking-tighter text-white uppercase">{currentStatus.label}</h2>
                 <p className="text-orange-400 font-bold text-[10px] md:text-sm tracking-tight flex items-center gap-2">
                    <Clock size={14} /> Livraison estimée: <span className="text-white">25-40 min</span>
                 </p>
              </div>
              <div className="w-16 h-16 md:w-32 md:h-32 bg-white/10 backdrop-blur-2xl rounded-xl md:rounded-[2.5rem] flex items-center justify-center text-orange-500 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                 {React.cloneElement(currentStatus.icon as React.ReactElement, { size: window.innerWidth < 768 ? 28 : 48, strokeWidth: 2.5 } as any)}
              </div>
           </div>
           
           {/* Progressive Metro Line */}
           <div className="relative mt-8 md:mt-16 pb-4">
              <div className="absolute top-1/2 left-0 w-full h-0.5 md:h-1 bg-white/10 rounded-full -translate-y-1/2" />
              <div 
                className="absolute top-1/2 left-0 h-0.5 md:h-1 bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.8)] rounded-full -translate-y-1/2 transition-all duration-1000"
                style={{ width: `${(activeStep / (trackingSteps.length - 1)) * 100}%` }} 
              />
              <div className="flex justify-between items-center relative">
                 {trackingSteps.map((step) => {
                   const isDone = step.id <= activeStep;
                   const isCurrent = step.id === activeStep;
                   return (
                     <div key={step.id} className="relative flex flex-col items-center group/step">
                        <div className={`w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-2xl flex items-center justify-center transition-all duration-500 border md:border-2 ${
                          isDone 
                            ? isCurrent ? 'bg-orange-600 border-white scale-110 md:scale-125 z-50 shadow-2xl' : 'bg-white border-orange-600 text-orange-600'
                            : 'bg-slate-800 border-white/10 text-white/20'
                        }`}>
                           {React.cloneElement(step.icon as React.ReactElement, { size: window.innerWidth < 768 ? 14 : 20 } as any)}
                        </div>
                        <span className={`absolute top-full mt-2 md:mt-4 text-[7px] md:text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-opacity ${isCurrent ? 'opacity-100 text-orange-400' : 'opacity-0'}`}>
                           {step.label}
                        </span>
                     </div>
                   );
                 })}
              </div>
           </div>
        </div>

        {/* Delivery Tracking Map */}
        {liveOrder.location && (
          <DeliveryTrackingMap
            deliveryLocation={liveOrder.location}
            storeLocation={storeLocation}
            storeName={liveOrder.storeName}
            orderStatus={liveOrder.status}
            driverLocation={driverLocation}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
           {/* Summary Info */}
           <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 border border-slate-50 shadow-sm space-y-6 md:space-y-8">
              <div className="flex items-center justify-between">
                 <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400">Détails Commande</h3>
                 <span className="bg-slate-100 px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black text-slate-500">#{String(liveOrder.id).slice(0, 8)}</span>
              </div>
              
              <div className="space-y-4 md:space-y-6">
                 {liveOrder.storeName && (
                   <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400"><Package size={18} /></div>
                      <div>
                         <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Magasin</p>
                         <p className="text-sm md:text-lg font-black text-slate-800">{liveOrder.storeName}</p>
                      </div>
                   </div>
                 )}
                 <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400"><MapPin size={18} /></div>
                    <div>
                       <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</p>
                       <p className="text-sm md:text-lg font-black text-slate-800">{liveOrder.customerName}</p>
                    </div>
                 </div>
              </div>

              <div className="pt-6 md:pt-8 border-t border-slate-50 flex items-center justify-between">
                 <div>
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Payé</p>
                    <p className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter">{(liveOrder.totalFinal ?? liveOrder.total + (liveOrder.deliveryFee || 0)).toFixed(2)} DH</p>
                 </div>
                 <div className="text-[8px] md:text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl uppercase tracking-widest border border-emerald-100">Payé Cash</div>
              </div>
           </div>

           {/* Receipt View */}
           <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-3 md:p-4 border border-slate-50 shadow-sm flex flex-col group overflow-hidden">
              <div className="p-4 md:p-6">
                 <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3 md:mb-4 flex items-center gap-2">
                    <Package size={14} className="text-orange-500" /> Facture du Magasin
                 </h3>
                 {storeInvoiceSources.length === 0 && (
                   <div className="flex flex-col items-center justify-center h-40 md:h-48 bg-slate-50 rounded-xl md:rounded-[2rem] border border-dashed border-slate-200">
                      <div className="text-3xl md:text-4xl mb-2">🧾</div>
                      <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Attente de la facture...</p>
                   </div>
                 )}
              </div>
              {storeInvoiceSources.length > 0 && (
                <div className="relative flex-1 rounded-xl md:rounded-[2.5rem] overflow-hidden min-h-[200px]">
                   <img src={storeInvoiceSources[invoiceIndex]} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" alt={`Invoice ${invoiceIndex + 1}`} />
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
                   {storeInvoiceSources.length > 1 && (
                     <div className="absolute left-3 top-3 rounded-full bg-slate-900/65 px-3 py-1 text-[10px] font-black text-white">
                       {invoiceIndex + 1}/{storeInvoiceSources.length}
                     </div>
                   )}
                   {storeInvoiceSources.length > 1 && (
                     <div className="absolute bottom-4 left-4 flex gap-2">
                       <button
                         type="button"
                         className="px-3 py-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white hover:text-orange-600 transition-all text-xs font-black"
                         onClick={() => setInvoiceIndex((i) => (i - 1 + storeInvoiceSources.length) % storeInvoiceSources.length)}
                       >
                         ‹
                       </button>
                       <button
                         type="button"
                         className="px-3 py-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white hover:text-orange-600 transition-all text-xs font-black"
                         onClick={() => setInvoiceIndex((i) => (i + 1) % storeInvoiceSources.length)}
                       >
                         ›
                       </button>
                     </div>
                   )}
                   <button className="absolute bottom-4 right-4 p-3 md:p-4 bg-white/20 backdrop-blur-md rounded-xl md:rounded-2xl text-white hover:bg-white hover:text-orange-600 transition-all">
                      <ExternalLink size={18} />
                   </button>
                </div>
              )}
           </div>
        </div>

        {/* Support Section */}
        {supportInfo && (
          <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 border border-slate-50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
             <div className="flex items-center gap-4 md:gap-5 self-start md:self-auto">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-orange-50 rounded-xl md:rounded-[2rem] flex items-center justify-center text-orange-600 shrink-0"><Star size={22} /></div>
                <div>
                   <h4 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Besoin d'aide ?</h4>
                   <p className="text-slate-400 font-bold text-xs">Contacter notre service client</p>
                </div>
             </div>
             <button 
               onClick={() => supportInfo.phone && makePhoneCall(supportInfo.phone)}
               className="w-full md:w-auto px-8 py-4 md:px-10 md:py-5 bg-orange-600 text-white rounded-xl md:rounded-[1.5rem] font-black text-[10px] md:text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
             >
                <PhoneCall size={18} /> Appeler Support
             </button>
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[500] p-4">
          <div className="bg-white rounded-3xl p-8 md:p-10 max-w-sm w-full shadow-2xl animate-premium space-y-6 md:space-y-8 text-center">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-amber-50 rounded-2xl md:rounded-[2.5rem] flex items-center justify-center mx-auto text-amber-500">
               <Star size={40} fill="currentColor" />
            </div>
            <div className="space-y-1">
               <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter">{t('rate_delivery')}</h3>
               <p className="text-[12px] md:text-sm text-slate-400 font-bold">{t('rate_delivery_description')}</p>
            </div>

            <div className="flex justify-center gap-2 md:gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-all hover:scale-125 active:scale-90"
                >
                  <Star size={32} className={`${star <= (hoverRating || selectedRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-100'}`} />
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 md:gap-3">
               <button onClick={handleRatingSubmit} disabled={selectedRating === 0} className="w-full py-4 bg-orange-600 text-white rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl disabled:opacity-30">
                  {t('submit')}
               </button>
               <button onClick={() => setShowRatingModal(false)} className="w-full py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest">
                  Plus tard
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracking;
