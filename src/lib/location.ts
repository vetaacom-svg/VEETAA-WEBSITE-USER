export const MOROCCAN_CITIES = [
  { name: 'Casablanca', lat: 33.5731, lon: -7.5898 },
  { name: 'Fes', lat: 34.0181, lon: -5.0089 },
  { name: 'Marrakech', lat: 31.6295, lon: -7.9811 },
  { name: 'Tangier', lat: 35.7595, lon: -5.8347 },
  { name: 'Rabat', lat: 34.0209, lon: -6.8416 },
  { name: 'Agadir', lat: 30.4278, lon: -9.5981 },
  { name: 'Meknes', lat: 33.8869, lon: -5.5454 },
  { name: 'Oujda', lat: 34.6741, lon: -1.9086 },
  { name: 'Tetouan', lat: 35.5791, lon: -5.3675 },
  { name: 'Kenitra', lat: 34.2632, lon: -6.5898 },
  { name: 'Safi', lat: 32.2832, lon: -8.7669 },
  { name: 'El Jadida', lat: 33.2561, lon: -8.5092 },
  { name: 'Settat', lat: 32.9914, lon: -7.6219 },
  { name: 'Khouribga', lat: 32.8857, lon: -6.9065 },
  { name: 'Beni Mellal', lat: 32.3372, lon: -6.3498 },
  { name: 'Mohammedia', lat: 33.6866, lon: -7.3833 },
  { name: 'Ksar el-Kebir', lat: 35.0014, lon: -5.9089 },
];

export const findNearestCity = (lat: number, lon: number): string => {
  let nearest = MOROCCAN_CITIES[0];
  let minDistance = Infinity;
  MOROCCAN_CITIES.forEach((city) => {
    const distance = Math.sqrt(Math.pow(city.lat - lat, 2) + Math.pow(city.lon - lon, 2));
    if (distance < minDistance) {
      minDistance = distance;
      nearest = city;
    }
  });
  return nearest.name;
};

const NOMINATIM_TIMEOUT_MS = 2800;

export const getCityFromCoordinates = async (lat: number, lon: number): Promise<string> => {
  const fallback = findNearestCity(lat, lon);
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), NOMINATIM_TIMEOUT_MS);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      { headers: { 'User-Agent': 'Veetaa-Delivery-Web' }, signal: ac.signal }
    );
    clearTimeout(t);
    if (response.ok) {
      const data = await response.json();
      const cityName =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.municipality ||
        data.address?.state ||
        fallback;
      return cityName;
    }
  } catch (e) {
    if ((e as Error)?.name !== 'AbortError') console.error('Reverse geocoding failed:', e);
  }
  return fallback;
};

export const KENITRA_CENTER = { lat: 34.26101, lon: -6.5802 };
export const MAX_DELIVERY_RADIUS_KM = 25;

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const isLocationServiceable = (
  lat: number,
  lon: number,
  deliveryZone?: 'kenitra' | 'all_morocco'
): boolean => {
  if (deliveryZone === 'all_morocco') return true;
  if (!lat || !lon) return false;
  const distance = calculateDistance(lat, lon, KENITRA_CENTER.lat, KENITRA_CENTER.lon);
  return distance <= MAX_DELIVERY_RADIUS_KM;
};

/** Defaults when `settings` table has no rows for these keys */
export const DEFAULT_DELIVERY_FEE_SETTINGS = {
  baseFeeDh: 15,
  includedKm: 1,
  perKmDh: 6,
} as const;

export type DeliveryFeeSettings = {
  baseFeeDh: number;
  includedKm: number;
  perKmDh: number;
};

/** True when store row has usable coordinates (not null / not 0,0 placeholder). */
export const storeHasValidCoords = (lat?: number | null, lng?: number | null): boolean => {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
};

function resolveStoreCoords(store: StoreDeliveryInput): { latitude?: number; longitude?: number } {
  return {
    latitude: store.latitude ?? store.lat,
    longitude: store.longitude ?? store.lng,
  };
}

/**
 * Livraison = frais de base du magasin (ou défaut) + km au-delà du seuil × tarif/km (settings).
 * Ex. base magasin 15 DH, seuil 1 km, +3 DH/km → à 2 km : 15 + (2−1)×3 = 18 DH.
 */
export const calculateDeliveryFee = (distanceKm: number, settings: Partial<DeliveryFeeSettings> = {}): number => {
  const { baseFeeDh, includedKm, perKmDh } = { ...DEFAULT_DELIVERY_FEE_SETTINGS, ...settings };
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return Math.round(baseFeeDh);
  const extraKm = Math.max(0, distanceKm - includedKm);
  return Math.round(baseFeeDh + extraKm * perKmDh);
};

export type StoreDeliveryInput = {
  name?: string;
  deliveryFee?: number;
  mapsUrl?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  deliveryBaseFee?: number;
  deliveryIncludedKm?: number;
  deliveryFeePerKm?: number;
  deliveryFixedFee?: number;
};

/**
 * Frais de base DH pour un magasin :
 * 1. `stores.delivery_base_fee` si renseigné (priorité explicite).
 * 2. Sinon `max(barème global admin, stores.delivery_fee)` : la colonne legacy `delivery_fee`
 *    remonte le minimum magasin quand il est **plus haut** que le global ; le global reste un **plancher**
 *    si le magasin a une valeur trop basse ou obsolète (évite 13 DH qui écrasaient 15 DH admin).
 */
export function resolveStoreBaseDeliveryDh(store: StoreDeliveryInput, globalBaseDh: number): number {
  if (store.deliveryBaseFee != null && Number.isFinite(store.deliveryBaseFee) && store.deliveryBaseFee >= 0) {
    return Math.round(store.deliveryBaseFee);
  }
  const legacy = store.deliveryFee;
  if (legacy != null && Number.isFinite(legacy) && legacy > 0) {
    return Math.round(Math.max(globalBaseDh, legacy));
  }
  return Math.round(globalBaseDh);
}

export function deliveryFeeForStoreFromUser(
  store: StoreDeliveryInput,
  userLocation: { lat: number; lng: number } | null,
  globalBaseFallback: number,
  includedKm: number,
  perKm: number
): { feeDh: number; distanceKm: number } {
  const storeBase = resolveStoreBaseDeliveryDh(store, globalBaseFallback);
  const storeIncluded = store.deliveryIncludedKm ?? includedKm;
  const storePerKm = store.deliveryFeePerKm ?? perKm;
  const storeFixed = store.deliveryFixedFee ?? 0;
  
  if (storeFixed > 0) {
    return { feeDh: Math.round(storeFixed), distanceKm: 0 };
  }

  if (!userLocation) {
    return { feeDh: Math.round(storeBase), distanceKm: 0 };
  }

  const baseCoords = resolveStoreCoords(store);
  const storeLat = baseCoords.latitude;
  const storeLng = baseCoords.longitude;
  let effectiveLat = storeLat;
  let effectiveLng = storeLng;
  if (!storeHasValidCoords(effectiveLat, effectiveLng)) {
    const parsed = parseCoordsFromMapsUrl(store.mapsUrl);
    if (parsed) {
      effectiveLat = parsed.lat;
      effectiveLng = parsed.lng;
    }
  }

  if (!storeHasValidCoords(effectiveLat, effectiveLng)) {
    return { feeDh: Math.round(storeBase), distanceKm: 0 };
  }

  const d = calculateDistance(Number(effectiveLat), Number(effectiveLng), userLocation.lat, userLocation.lng);
  const feeDh = calculateDeliveryFee(d, {
    baseFeeDh: storeBase,
    includedKm: storeIncluded,
    perKmDh: storePerKm,
  });
  return { feeDh, distanceKm: d };
}

/** Try extracting lat/lng from common Google Maps URL formats inside `maps_url`. */
function parseCoordsFromMapsUrl(url?: string): { lat: number; lng: number } | null {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim();
  if (!s) return null;

  // format: ...?q=34.261,-6.58  or ...query=34.261,-6.58
  const q = s.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  if (q) {
    const lat = Number(q[1]);
    const lng = Number(q[2]);
    if (storeHasValidCoords(lat, lng)) return { lat, lng };
  }

  // format: .../@34.261,-6.58,15z
  const at = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (storeHasValidCoords(lat, lng)) return { lat, lng };
  }

  return null;
}

/** Plusieurs magasins : moyenne des frais (et des moyennes de distance pour affichage éventuel). */
export function averageDeliveryFeesFromStores(
  stores: StoreDeliveryInput[],
  userLocation: { lat: number; lng: number } | null,
  globalBaseFallback: number,
  includedKm: number,
  perKm: number
): { averageFeeDh: number; averageBaseFee: number; averageRatePerKm: number; averageIncludedKm: number; averageDistanceKm: number; storeDetails: { name: string; distanceKm: number }[] } {
  if (stores.length === 0) return { averageFeeDh: 0, averageBaseFee: 0, averageRatePerKm: 0, averageIncludedKm: 0, averageDistanceKm: 0, storeDetails: [] };
  
  if (!userLocation) {
    let sum = 0;
    for (const st of stores) {
      sum += resolveStoreBaseDeliveryDh(st, globalBaseFallback);
    }
    const avg = Math.round(sum / stores.length);
    return { averageFeeDh: avg, averageBaseFee: avg, averageRatePerKm: perKm, averageIncludedKm: includedKm, averageDistanceKm: 0, storeDetails: [] };
  }

  // Filtrer les magasins avec une localisation valide
  const storesWithLocation = stores.filter(st => {
    const baseCoords = resolveStoreCoords(st);
    const lat = baseCoords.latitude ?? parseCoordsFromMapsUrl(st.mapsUrl)?.lat;
    const lng = baseCoords.longitude ?? parseCoordsFromMapsUrl(st.mapsUrl)?.lng;
    return storeHasValidCoords(lat, lng);
  });

  // Si aucun magasin n'a de localisation, utiliser les frais de base normaux (ex: 15 DH par défaut)
  if (storesWithLocation.length === 0) {
    let sumFee = 0;
    for (const st of stores) {
      sumFee += resolveStoreBaseDeliveryDh(st, globalBaseFallback);
    }
    const avg = Math.round(sumFee / stores.length);
    return { averageFeeDh: avg, averageBaseFee: avg, averageRatePerKm: perKm, averageIncludedKm: includedKm, averageDistanceKm: 0, storeDetails: [] };
  }

  // S'il y a des magasins avec localisation, on calcule la moyenne SEULEMENT sur ceux-là 
  // pour que les magasins sans coords (distance=0) ne baissent pas faussement la moyenne
  let sumFee = 0;
  let sumDist = 0;
  const storeDetails: { name: string; distanceKm: number }[] = [];
  
  for (const st of storesWithLocation) {
    const r = deliveryFeeForStoreFromUser(st, userLocation, globalBaseFallback, includedKm, perKm);
    sumFee += r.feeDh;
    sumDist += r.distanceKm;
    storeDetails.push({ name: st.name || 'Magasin', distanceKm: r.distanceKm });
  }
  const n = storesWithLocation.length;
  
  // Calculate averages using exact same priority as deliveryFeeForStoreFromUser
  let sumBase = 0;
  let sumRate = 0;
  let sumIncluded = 0;

  for (const st of storesWithLocation) {
     const b = resolveStoreBaseDeliveryDh(st, globalBaseFallback);
     const r = st.deliveryFeePerKm ?? perKm;
     const inc = st.deliveryIncludedKm ?? includedKm;
     
     sumBase += b;
     sumRate += r;
     sumIncluded += inc;
  }

  return {
    averageFeeDh: Math.round(sumFee / n),
    averageBaseFee: Math.round(sumBase / n),
    averageRatePerKm: sumRate / n,
    averageIncludedKm: sumIncluded / n,
    averageDistanceKm: sumDist / n,
    storeDetails
  };
}
