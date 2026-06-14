import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { isLocationServiceable, getCityFromCoordinates, findNearestCity, calculateDistance } from '../lib/location';
import { subscribeToSettings, AppSettings } from '../lib/settingsService';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../lib/storage';
import { catalogRepo } from '../data/repos/catalogRepo';
import { DeliveryZone } from '../types';

const MANUAL_CITY_OVERRIDE_KEY = 'veetaa_manual_city_override';

export const fetchUserLocation = async (): Promise<{ lat: number; lon: number; city: string } | null> => {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const city = await getCityFromCoordinates(latitude, longitude);
        resolve({ lat: latitude, lon: longitude, city });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60_000 }
    );
  });
};

interface LocationContextValue {
  userLocation: { lat: number; lon: number; city: string } | null;
  setUserLocation: (l: { lat: number; lon: number; city: string } | null) => void;
  loadingLocation: boolean;
  locationError: string | null;
  refreshLocation: () => Promise<void>;
  isOutOfZone: boolean;
  appSettings: AppSettings;
  deliveryZones: DeliveryZone[];
  activeZone: DeliveryZone | null;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; city: string } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    support_number: '+212600000000',
    delivery_fee_per_km: 0,
    delivery_zone: 'all_morocco',
  });
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  useEffect(() => {
    // Fetch delivery zones on mount
    catalogRepo.deliveryZones().then(({ data }) => {
      if (data) setDeliveryZones(data as DeliveryZone[]);
    });

    return subscribeToSettings((settings) => {
      if (settings) setAppSettings(settings);
    });
  }, []);

  const refreshLocation = useCallback(async () => {
    setLoadingLocation(true);
    const loc = await fetchUserLocation();
    if (loc) {
      setUserLocation(loc);
      safeSetItem('userLocation', JSON.stringify(loc));
      safeRemoveItem(MANUAL_CITY_OVERRIDE_KEY);
      setLocationError(null);
    } else {
      setLocationError('Unable to detect location');
    }
    setLoadingLocation(false);
  }, []);

  // Sync location on mount
  useEffect(() => {
    const hasManualCityOverride = safeGetItem(MANUAL_CITY_OVERRIDE_KEY) === '1';
    const saved = safeGetItem('userLocation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { lat?: number; lon?: number; city?: string };
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
          const city =
            parsed.city && String(parsed.city).trim()
              ? parsed.city
              : findNearestCity(parsed.lat, parsed.lon);
          setUserLocation({ lat: parsed.lat, lon: parsed.lon, city });
        }
      } catch {
        safeRemoveItem('userLocation');
      }
    }
    if (!hasManualCityOverride) {
      refreshLocation();
    }
  }, [refreshLocation]);

  const activeZone = useMemo(() => {
    if (!userLocation || deliveryZones.length === 0) return null;
    
    // Find a zone where user is within the radius
    for (const zone of deliveryZones) {
      if (!zone.center_lat || !zone.center_lng || !zone.radius_km) continue;
      
      const distance = calculateDistance(
        zone.center_lat, 
        zone.center_lng, 
        userLocation.lat, 
        userLocation.lon
      );
      
      if (distance <= zone.radius_km) {
        return zone;
      }
    }
    
    // Fallback: Check if city name matches exactly (for edge cases)
    const exactMatch = deliveryZones.find(z => z.name.toLowerCase() === userLocation.city.toLowerCase());
    return exactMatch || null;
  }, [userLocation, deliveryZones]);

  // NO MORE BLOCKAGE! We just filter stores.
  const isOutOfZone = false;

  const value = {
    userLocation,
    setUserLocation,
    loadingLocation,
    locationError,
    refreshLocation,
    isOutOfZone,
    appSettings,
    deliveryZones,
    activeZone
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
};
