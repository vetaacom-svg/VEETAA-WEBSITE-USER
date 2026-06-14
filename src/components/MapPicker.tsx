import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Navigation, Loader2, GripHorizontal } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { safeGetItem, safeSetItem } from '../lib/storage';

const icon = L.divIcon({
  html: `<div style="width:24px;height:24px;background:#f97316;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const myLocationIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const MOROCCO_CENTER = { lat: 31.7917, lng: -7.0926 } as const;
const MAP_HEIGHT_STORAGE_KEY = 'veetaa_map_picker_height_px';

function readStoredMapHeightPx(): number {
  if (typeof window === 'undefined') return 380;
  const raw = safeGetItem(MAP_HEIGHT_STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  const maxH = Math.min(Math.round(window.innerHeight * 0.92), 920);
  if (Number.isFinite(n) && n >= 240 && n <= maxH) return n;
  return Math.round(Math.min(window.innerHeight * 0.44, 440));
}

/** Recalcule les tuiles Leaflet quand la hauteur du conteneur change */
function InvalidateMapSize({ isDesktop, mobileH }: { isDesktop: boolean; mobileH: number }) {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    return () => cancelAnimationFrame(id);
  }, [map, isDesktop, mobileH]);
  return null;
}

interface MapPickerProps {
  initialCenter?: { lat: number; lng: number };
  initialAddressDetails?: string;
  onSelect: (coords: { lat: number; lng: number }, addressDetails?: string) => void;
  onClose: () => void;
  language?: 'fr' | 'ar' | 'en';
}

function LocationMarker({ position, onUpdate }: { position: { lat: number; lng: number } | null; onUpdate: (p: { lat: number; lng: number }) => void }) {
  const handleMapClick = useCallback((e: { latlng: { lat: number; lng: number } }) => {
    onUpdate({ lat: e.latlng.lat, lng: e.latlng.lng });
  }, [onUpdate]);
  useMapEvents({ click: handleMapClick });
  return position ? <Marker position={[position.lat, position.lng]} icon={icon} /> : null;
}

/** Flies the map to a target when it changes */
function FlyToHandler({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  const lastFlown = useRef<string>('');
  if (target) {
    const key = `${target.lat},${target.lng}`;
    if (key !== lastFlown.current) {
      lastFlown.current = key;
      map.flyTo([target.lat, target.lng], 16, { duration: 1.2 });
    }
  }
  return null;
}

/** Shows the blue dot for "my location" */
function MyLocationMarker({ coords }: { coords: { lat: number; lng: number } | null }) {
  if (!coords) return null;
  return <Marker position={[coords.lat, coords.lng]} icon={myLocationIcon} />;
}

const MapPicker: React.FC<MapPickerProps> = ({ initialCenter, initialAddressDetails, onSelect, onClose, language = 'fr' }) => {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initialCenter ? { lat: initialCenter.lat, lng: initialCenter.lng } : null
  );
  const [addressDetails, setAddressDetails] = useState(initialAddressDetails ?? '');
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  /** Hauteur carte en &lt; lg (mobile) : glisser la poignée vers le bas pour agrandir */
  const [mobileMapHeightPx, setMobileMapHeightPx] = useState(readStoredMapHeightPx);
  const mobileMapHeightRef = useRef(mobileMapHeightPx);
  mobileMapHeightRef.current = mobileMapHeightPx;

  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktopLayout(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const mapResizeDrag = useRef<{ startY: number; startH: number } | null>(null);
  const mapGripRef = useRef<HTMLDivElement>(null);

  const center = position ?? initialCenter ?? MOROCCO_CENTER;
  const t = (fr: string, ar: string, en: string) => (language === 'ar' ? ar : language === 'en' ? en : fr);
  const handleConfirm = useCallback(() => {
    if (position) onSelect(position, addressDetails.trim() || undefined);
    onClose();
  }, [position, addressDetails, onSelect, onClose]);

  const onResizeGripPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isDesktopLayout) return;
      e.preventDefault();
      e.stopPropagation();
      const pid = e.pointerId;
      mapResizeDrag.current = { startY: e.clientY, startH: mobileMapHeightRef.current };
      try {
        mapGripRef.current?.setPointerCapture(pid);
      } catch {
        /* */
      }

      const onMove = (ev: PointerEvent) => {
        const d = mapResizeDrag.current;
        if (!d) return;
        ev.preventDefault();
        const dy = ev.clientY - d.startY;
        const maxH = Math.min(Math.round(window.innerHeight * 0.92), 920);
        const next = Math.round(Math.min(Math.max(d.startH + dy, 240), maxH));
        setMobileMapHeightPx(next);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        mapResizeDrag.current = null;
        try {
          mapGripRef.current?.releasePointerCapture(pid);
        } catch {
          /* */
        }
        try {
          safeSetItem(MAP_HEIGHT_STORAGE_KEY, String(mobileMapHeightRef.current));
        } catch {
          /* */
        }
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [isDesktopLayout]
  );

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(coords);
        setPosition(coords);
        setFlyTarget(coords);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col lg:flex-row max-lg:overflow-y-auto lg:overflow-hidden"
      style={{ minHeight: '100vh', width: '100vw' }}
    >
      <style>{`
        .map-picker-zoom-style .leaflet-control-zoom { border: none !important; box-shadow: none !important; }
        .map-picker-zoom-style .leaflet-control-zoom a {
          width: 44px !important; height: 44px !important;
          line-height: 44px !important; font-size: 24px !important;
          background: rgba(255,255,255,0.96) !important;
          color: #334155 !important;
          border: none !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.12) !important;
          font-weight: 400 !important;
          transition: all 0.2s ease !important;
          display: block !important;
        }
        .map-picker-zoom-style .leaflet-control-zoom a:hover {
          background: white !important;
          color: #f97316 !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18) !important;
          transform: scale(1.03);
        }
        .map-picker-zoom-style .leaflet-control-zoom a:first-child {
          border-radius: 12px 12px 0 0 !important;
          border-bottom: 1px solid rgba(0,0,0,0.06) !important;
        }
        .map-picker-zoom-style .leaflet-control-zoom a:last-child {
          border-radius: 0 0 12px 12px !important;
        }
        .map-picker-zoom-style .leaflet-container { cursor: grab !important; }
        .map-picker-zoom-style .leaflet-container:active,
        .map-picker-zoom-style .leaflet-dragging .leaflet-grab { cursor: grabbing !important; }
        .map-picker-zoom-style .leaflet-interactive,
        .map-picker-zoom-style .leaflet-marker-icon { cursor: pointer !important; }
      `}</style>

      {/* SIDEBAR (Desktop: left 30%) / BOTTOM PANEL (Mobile) */}
      <div className="w-full lg:w-[30%] lg:min-w-[340px] lg:max-w-[420px] bg-slate-900 flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-[1001] order-last lg:order-first h-auto lg:h-full shrink-0">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900">
          <h3 className="font-black text-white text-lg">
            {t('Choisir sur la carte', 'اختر على الخريطة', 'Choose on map')}
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors active:scale-95"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-start gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left block">Coordonnées GPS</label>
            <div className="px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-800 text-slate-400 font-mono text-sm leading-none flex items-center h-[46px] text-left">
              {position ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` : t('Position non définie', 'موقع غير محدد', 'Position not set')}
            </div>
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left block">Détails de l'adresse</label>
            <textarea
              value={addressDetails}
              onChange={(e) => setAddressDetails(e.target.value)}
              placeholder={t('N° maison, résidence, immeuble...', 'رقم المنزل، السكن، المبنى...', 'House no., residence, building...')}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent min-h-[120px] resize-none"
              maxLength={200}
            />
          </div>

          <div className="mt-auto pt-4">
            <button
              onClick={handleConfirm}
              disabled={!position}
              className="w-full py-4 px-6 bg-orange-500 text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-orange-600 transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20 text-sm uppercase tracking-wider"
            >
              <MapPin className="w-5 h-5 shrink-0" />
              <span>{t('Utiliser cette position', 'استخدام هذا الموقع', 'Use this location')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAP AREA — mobile : hauteur réglable par poignée ; desktop : pleine hauteur */}
      <div
        className="relative map-picker-zoom-style order-first lg:order-last min-h-0 bg-slate-800 border-b border-slate-700 lg:border-none shrink-0 max-lg:flex-none max-lg:w-full lg:flex-1 lg:h-full"
        style={
          isDesktopLayout
            ? { height: '100%' }
            : { height: mobileMapHeightPx, minHeight: 260 }
        }
      >
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={14}
          zoomControl={false}
          attributionControl={false}
          style={{ width: '100%', height: '100%', touchAction: 'manipulation' }}
        >
          <ZoomControl position="bottomleft" />
          <TileLayer
            attribution=""
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} onUpdate={(p) => { setPosition(p); setFlyTarget(null); }} />
          <MyLocationMarker coords={myLocation} />
          <FlyToHandler target={flyTarget} />
          <InvalidateMapSize isDesktop={isDesktopLayout} mobileH={mobileMapHeightPx} />
        </MapContainer>

        {/* Poignée redimensionnement (mobile / tablette) */}
        <div
          ref={mapGripRef}
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('Glisser pour agrandir la carte', 'اسحب لتكبير الخريطة', 'Drag to resize the map')}
          className="lg:hidden absolute bottom-0 left-0 right-0 z-[1002] flex flex-col items-center justify-center gap-0.5 py-2 cursor-row-resize select-none bg-slate-900/85 border-t border-slate-600/80 active:bg-slate-800"
          style={{ touchAction: 'none' }}
          onPointerDown={onResizeGripPointerDown}
        >
          <GripHorizontal className="w-10 h-5 text-slate-400" strokeWidth={2.5} aria-hidden />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {t('Agrandir la carte', 'تكبير الخريطة', 'Resize map')}
          </span>
        </div>

        {/* Floating "My Location" GPS button */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute max-lg:bottom-14 lg:bottom-[22px] left-20 z-[1000] flex items-center gap-2 px-4 py-3 bg-white rounded-2xl shadow-xl border border-slate-100 hover:shadow-2xl active:scale-95 transition-all touch-manipulation"
          title={t('Ma position', 'موقعي', 'My location')}
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          ) : (
            <Navigation className="w-5 h-5 text-blue-500" />
          )}
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider hidden sm:inline">
            {isLocating
              ? t('Localisation...', 'جاري التحديد...', 'Locating...')
              : t('Ma position', 'موقعي', 'My location')}
          </span>
        </button>
      </div>

    </div>
  );
};

export default MapPicker;
