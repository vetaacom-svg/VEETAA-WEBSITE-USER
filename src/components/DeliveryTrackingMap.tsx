import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Package, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

/* ────────── Custom Map Icons ────────── */

const storeIcon = L.divIcon({
  html: `<div style="
    width:36px;height:36px;
    background:linear-gradient(135deg,#1e293b 0%,#334155 100%);
    border:3px solid white;
    border-radius:12px;
    box-shadow:0 4px 14px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
  "><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg></div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const deliveryIcon = L.divIcon({
  html: `<div style="
    width:36px;height:36px;
    background:linear-gradient(135deg,#ea580c 0%,#f97316 100%);
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 4px 14px rgba(249,115,22,0.5);
    display:flex;align-items:center;justify-content:center;
  "><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

const driverIcon = L.divIcon({
  html: `<div style="
    width:42px;height:42px;
    background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 0 0 6px rgba(59,130,246,0.25), 0 4px 14px rgba(37,99,235,0.5);
    display:flex;align-items:center;justify-content:center;
    animation: driverPulse 2s ease-in-out infinite;
  "><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 15h12M15 15V9a2 2 0 0 0-2-2H9L7 15"/><rect x="8" y="3" width="4" height="4" rx="0.5" fill="white"/></svg></div>`,
  className: '',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

/* ────────── Helper: Fit map bounds ────────── */

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const prevPointsCount = useRef(points.length);

  useEffect(() => {
    if (points.length >= 2) {
      const shouldFit = prevPointsCount.current !== points.length || prevPointsCount.current < 2;
      prevPointsCount.current = points.length;

      if (shouldFit) {
        const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [map, points]);
  return null;
}

/* ────────── Helper: Fetch OSRM route ────────── */

async function fetchOSRMRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<[number, number][] | null> {
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000);
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) return null;
    // GeoJSON is [lng, lat], we need [lat, lng]
    return data.routes[0].geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] as [number, number]
    );
  } catch {
    return null;
  }
}

/* ────────── Interpolation along route ────────── */

function interpolateRoute(route: [number, number][], progress: number): [number, number] {
  if (route.length === 0) return [0, 0];
  if (route.length === 1 || progress <= 0) return route[0];
  if (progress >= 1) return route[route.length - 1];

  // Calculate total length
  let totalDist = 0;
  const segDists: number[] = [];
  for (let i = 1; i < route.length; i++) {
    const d = Math.sqrt(
      Math.pow(route[i][0] - route[i - 1][0], 2) +
      Math.pow(route[i][1] - route[i - 1][1], 2)
    );
    segDists.push(d);
    totalDist += d;
  }

  const targetDist = totalDist * progress;
  let accumulated = 0;
  for (let i = 0; i < segDists.length; i++) {
    if (accumulated + segDists[i] >= targetDist) {
      const segProgress = (targetDist - accumulated) / segDists[i];
      return [
        route[i][0] + (route[i + 1][0] - route[i][0]) * segProgress,
        route[i][1] + (route[i + 1][1] - route[i][1]) * segProgress,
      ];
    }
    accumulated += segDists[i];
  }
  return route[route.length - 1];
}

/* ────────── Main Component ────────── */

interface DeliveryTrackingMapProps {
  /** Customer delivery location */
  deliveryLocation: { lat: number; lng: number };
  /** Store location (optional — if not provided, map only shows delivery pin) */
  storeLocation?: { lat: number; lng: number } | null;
  /** Store name */
  storeName?: string;
  /** Order status — driver marker only appears when 'en_course' / 'delivering' / 'progression' */
  orderStatus?: string;
  /** Real-time driver location */
  driverLocation?: { lat: number; lng: number } | null;
}

function getDistanceMeters(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (p1.lat * Math.PI) / 180;
  const phi2 = (p2.lat * Math.PI) / 180;
  const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

const DeliveryTrackingMap: React.FC<DeliveryTrackingMapProps> = ({
  deliveryLocation,
  storeLocation,
  storeName,
  orderStatus,
  driverLocation,
}) => {
  const [activeRouteCoords, setActiveRouteCoords] = useState<[number, number][] | null>(null);
  const [remainingRouteCoords, setRemainingRouteCoords] = useState<[number, number][] | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [driverProgress, setDriverProgress] = useState(0);
  const lastFetchedDriverLoc = useRef<{ lat: number; lng: number } | null>(null);

  const isDriverActive =
    !!driverLocation ||
    ['en_course', 'delivering', 'progression', 'en_progression', 'progress'].includes(
      orderStatus || ''
    );

  // Fetch route(s) dynamically depending on driver coordinates and order status
  useEffect(() => {
    let active = true;

    const loadRoutes = async () => {
      setLoadingRoute(true);
      
      const isDeliveringState = ['en_course', 'delivering', 'progression', 'en_progression', 'progress', 'delivered', 'livree'].includes(
        orderStatus || ''
      );

      // Scenario 1: Real driver coordinates are available
      if (driverLocation && Number.isFinite(driverLocation.lat) && Number.isFinite(driverLocation.lng) && !(driverLocation.lat === 0 && driverLocation.lng === 0)) {
        
        // Throttling: only reload route if driver has moved > 30 meters
        if (lastFetchedDriverLoc.current) {
          const dist = getDistanceMeters(driverLocation, lastFetchedDriverLoc.current);
          if (dist < 30 && activeRouteCoords) {
            setLoadingRoute(false);
            return;
          }
        }
        
        lastFetchedDriverLoc.current = driverLocation;

        if (isDeliveringState) {
          // Driver is delivering directly to client
          const coords = await fetchOSRMRoute(driverLocation, deliveryLocation);
          if (!active) return;
          if (coords && coords.length > 1) {
            setActiveRouteCoords(coords);
          } else {
            setActiveRouteCoords([[driverLocation.lat, driverLocation.lng], [deliveryLocation.lat, deliveryLocation.lng]]);
          }
          setRemainingRouteCoords(null);
        } else {
          // Driver is heading to the store first
          const p1 = fetchOSRMRoute(driverLocation, storeLocation || deliveryLocation);
          const p2 = storeLocation ? fetchOSRMRoute(storeLocation, deliveryLocation) : Promise.resolve(null);
          
          const [coords1, coords2] = await Promise.all([p1, p2]);
          if (!active) return;

          if (coords1 && coords1.length > 1) {
            setActiveRouteCoords(coords1);
          } else {
            const startLat = driverLocation.lat;
            const startLng = driverLocation.lng;
            const endLat = storeLocation?.lat || deliveryLocation.lat;
            const endLng = storeLocation?.lng || deliveryLocation.lng;
            setActiveRouteCoords([[startLat, startLng], [endLat, endLng]]);
          }

          if (coords2 && coords2.length > 1) {
            setRemainingRouteCoords(coords2);
          } else if (storeLocation) {
            setRemainingRouteCoords([[storeLocation.lat, storeLocation.lng], [deliveryLocation.lat, deliveryLocation.lng]]);
          } else {
            setRemainingRouteCoords(null);
          }
        }
      } 
      // Scenario 2: No real-time driver coordinates (fallback/simulation or driver not assigned yet)
      else {
        lastFetchedDriverLoc.current = null;
        if (storeLocation) {
          const coords = await fetchOSRMRoute(storeLocation, deliveryLocation);
          if (!active) return;
          if (coords && coords.length > 1) {
            setActiveRouteCoords(coords);
          } else {
            setActiveRouteCoords([[storeLocation.lat, storeLocation.lng], [deliveryLocation.lat, deliveryLocation.lng]]);
          }
        } else {
          setActiveRouteCoords(null);
        }
        setRemainingRouteCoords(null);
      }
      
      setLoadingRoute(false);
    };

    loadRoutes();

    return () => {
      active = false;
    };
  }, [
    storeLocation?.lat,
    storeLocation?.lng,
    deliveryLocation.lat,
    deliveryLocation.lng,
    driverLocation?.lat,
    driverLocation?.lng,
    orderStatus
  ]);

  // Animate driver progress when active (fallback simulation only)
  useEffect(() => {
    if (!isDriverActive || !activeRouteCoords || driverLocation) {
      setDriverProgress(0);
      return;
    }
    // Simulate driver moving along the route
    setDriverProgress(0.15); // Start at 15%
    const interval = setInterval(() => {
      setDriverProgress((p) => {
        if (p >= 0.85) return 0.85; // Don't go past 85%
        return p + 0.002; // Slow increment
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isDriverActive, activeRouteCoords, driverLocation]);

  const driverPosition = useMemo(() => {
    if (driverLocation && Number.isFinite(driverLocation.lat) && Number.isFinite(driverLocation.lng) && !(driverLocation.lat === 0 && driverLocation.lng === 0)) {
      return [driverLocation.lat, driverLocation.lng] as [number, number];
    }
    if (!activeRouteCoords || !isDriverActive) return null;
    return interpolateRoute(activeRouteCoords, driverProgress);
  }, [activeRouteCoords, driverProgress, isDriverActive, driverLocation]);

  const mapPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [[deliveryLocation.lat, deliveryLocation.lng]];
    if (storeLocation) pts.push([storeLocation.lat, storeLocation.lng]);
    if (driverLocation && Number.isFinite(driverLocation.lat) && Number.isFinite(driverLocation.lng) && !(driverLocation.lat === 0 && driverLocation.lng === 0)) {
      pts.push([driverLocation.lat, driverLocation.lng]);
    }
    return pts;
  }, [deliveryLocation, storeLocation, driverLocation]);

  const center = useMemo(() => {
    if (storeLocation) {
      return {
        lat: (deliveryLocation.lat + storeLocation.lat) / 2,
        lng: (deliveryLocation.lng + storeLocation.lng) / 2,
      };
    }
    return deliveryLocation;
  }, [deliveryLocation, storeLocation]);

  return (
    <div className="relative w-full rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-50 bg-white">
      {/* Map Header */}
      <div className="px-5 md:px-8 py-4 md:py-5 flex items-center justify-between bg-white border-b border-slate-50">
        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
          <Navigation size={14} className="text-blue-500" />
          Suivi de Livraison
        </h3>
        {loadingRoute && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Chargement...</span>
          </div>
        )}
        {isDriverActive && !loadingRoute && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-wider">
              Livreur en route
            </span>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative h-[260px] md:h-[340px]">
        <style>{`
          @keyframes driverPulse {
            0%, 100% { box-shadow: 0 0 0 6px rgba(59,130,246,0.25), 0 4px 14px rgba(37,99,235,0.5); }
            50% { box-shadow: 0 0 0 12px rgba(59,130,246,0.15), 0 4px 20px rgba(37,99,235,0.6); }
          }
          .delivery-map-container .leaflet-control-zoom { border: none !important; box-shadow: none !important; }
          .delivery-map-container .leaflet-control-zoom a {
            width: 36px !important; height: 36px !important;
            line-height: 36px !important; font-size: 18px !important;
            background: rgba(255,255,255,0.95) !important;
            color: #334155 !important;
            border: none !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
            font-weight: 400 !important;
            transition: all 0.2s ease !important;
          }
          .delivery-map-container .leaflet-control-zoom a:hover {
            background: white !important;
            color: #f97316 !important;
          }
          .delivery-map-container .leaflet-control-zoom a:first-child {
            border-radius: 10px 10px 0 0 !important;
            border-bottom: 1px solid rgba(0,0,0,0.06) !important;
          }
          .delivery-map-container .leaflet-control-zoom a:last-child {
            border-radius: 0 0 10px 10px !important;
          }
        `}</style>
        <div className="delivery-map-container" style={{ width: '100%', height: '100%' }}>
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={14}
            zoomControl={false}
            attributionControl={false}
            style={{ width: '100%', height: '100%', touchAction: 'manipulation' }}
          >
            <ZoomControl position="bottomright" />
            <TileLayer
              attribution=""
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={mapPoints} />

            {/* Active Route polyline */}
            {activeRouteCoords && activeRouteCoords.length > 1 && (
              <>
                {/* Shadow line */}
                <Polyline
                  positions={activeRouteCoords}
                  pathOptions={{
                    color: '#94a3b8',
                    weight: 6,
                    opacity: 0.3,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                {/* Main route line */}
                <Polyline
                  positions={activeRouteCoords}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '12, 8',
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            )}

            {/* Remaining Route polyline (Store to Client while driver is heading to store) */}
            {remainingRouteCoords && remainingRouteCoords.length > 1 && (
              <>
                <Polyline
                  positions={remainingRouteCoords}
                  pathOptions={{
                    color: '#94a3b8',
                    weight: 4,
                    opacity: 0.5,
                    dashArray: '4, 6',
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            )}

            {/* Store marker */}
            {storeLocation && (
              <Marker position={[storeLocation.lat, storeLocation.lng]} icon={storeIcon} />
            )}

            {/* Delivery point marker */}
            <Marker position={[deliveryLocation.lat, deliveryLocation.lng]} icon={deliveryIcon} />

            {/* Driver marker (animated) */}
            {driverPosition && isDriverActive && (
              <Marker position={driverPosition} icon={driverIcon} />
            )}
          </MapContainer>
        </div>
      </div>

      {/* Map Legend */}
      <div className="px-5 md:px-8 py-3 md:py-4 bg-slate-50/50 border-t border-slate-50 flex flex-wrap items-center gap-x-5 gap-y-2">
        {storeLocation && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-800 rounded-md border-2 border-white shadow-sm flex items-center justify-center">
              <Package size={8} className="text-white" />
            </div>
            <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {storeName || 'Magasin'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
            <MapPin size={8} className="text-white" />
          </div>
          <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Point de livraison
          </span>
        </div>
        {isDriverActive && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
              <Navigation size={8} className="text-white" />
            </div>
            <span className="text-[9px] md:text-[10px] font-bold text-blue-600 uppercase tracking-wider">
              Livreur
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryTrackingMap;
