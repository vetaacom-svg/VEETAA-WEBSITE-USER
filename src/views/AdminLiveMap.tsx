import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { KENITRA_CENTER } from '../lib/location';
import { ResizableLiveMapFrame, useLiveMapFrameHeight } from '../components/ResizableLiveMapFrame';

function InvalidateWhenFrameResizes() {
  const map = useMap();
  const h = useLiveMapFrameHeight();
  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    return () => cancelAnimationFrame(id);
  }, [map, h]);
  return null;
}

/**
 * Page Live map (WEB2) : le grand cadre = `ResizableLiveMapFrame` ci-dessous (unique endroit du dépôt).
 * Route : `/admin/carte-live`. Pas de `WebLayout` ici (voir `App.tsx`).
 */
const AdminLiveMap: React.FC = () => {
  const center = { lat: KENITRA_CENTER.lat, lng: KENITRA_CENTER.lon };
  /**
   * Hauteur initiale > fenêtre → le cadre dépasse l’écran et la page défile (overflow-y sur le conteneur).
   * Le stockage de session (`veetaa_admin_live_map_frame_h_v2`) remplace ce défaut
   * (nouvelle clé = anciennes hauteurs trop petites ignorées).
   */
  const defaultFrameHeightPx = useMemo(() => {
    if (typeof window === 'undefined') return 1400;
    const vh = window.innerHeight;
    return Math.min(4800, Math.max(800, Math.round(vh * 2 + 320)));
  }, []);

  return (
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-slate-100 p-4 md:p-8 pb-40">
      <div className="max-w-[1600px] mx-auto space-y-4 pb-16">
        <h1 className="text-xl font-black text-slate-800 tracking-tight">LIVE MAP</h1>

        <ResizableLiveMapFrame
          defaultHeightPx={defaultFrameHeightPx}
          minHeightPx={400}
          storageKey="veetaa_admin_live_map_frame_h_v2"
          gripLabel="TIRER"
          bottomGripTitle="Tirer vers le bas — illimité"
          bottomGripHint="Glissez cette zone ou utilisez les boutons ci-dessus pour beaucoup plus de carte."
          top={
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-slate-900 text-white">
              <span className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-black uppercase">Carte live</span>
              <span className="px-3 py-1.5 rounded-lg text-slate-400 text-xs font-bold uppercase">Commandes</span>
              <span className="px-3 py-1.5 rounded-lg text-slate-400 text-xs font-bold uppercase">Admin magasins</span>
              <span className="ml-auto text-[10px] text-slate-400 font-medium hidden sm:inline">
                35 commande(s) visible(s) sur la carte — bandeau réduit
              </span>
            </div>
          }
          map={
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={13}
              zoomControl={false}
              attributionControl={false}
              className="absolute inset-0 z-0"
              style={{ width: '100%', height: '100%', touchAction: 'manipulation' }}
            >
              <InvalidateWhenFrameResizes />
              <ZoomControl position="topleft" />
              <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </MapContainer>
          }
          bottom={
            <div className="px-4 py-4 space-y-2">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-500" />
                Légende de la carte
              </p>
              <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                <li>Commande active, livreur, magasin — branchez vos marqueurs ici.</li>
                <li>
                  En bas du cadre : boutons <strong>+600</strong> / <strong>+1500</strong> / <strong>2× la fenêtre</strong> et grande
                  poignée — tirage quasi illimité, faites défiler la page.
                </li>
              </ul>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default AdminLiveMap;
