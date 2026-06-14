import { supabaseAnon } from './supabase-client';
import { Db } from '../data/tables';
import { safeGetJSON, safeSetItem } from './storage';

export type DeliveryZone = 'kenitra' | 'all_morocco';

export interface AppSettings {
  support_number: string;
  whatsapp_number?: string;
  delivery_zone?: DeliveryZone;
  /** DH added for each km beyond `delivery_included_km` */
  delivery_fee_per_km?: number;
  /** Minimum order delivery fee (DH) when distance-based fee applies */
  delivery_base_fee?: number;
  /** Distance (km) included in the base fee; beyond this, `delivery_fee_per_km` applies */
  delivery_included_km?: number;
  [key: string]: string | DeliveryZone | number | undefined;
}

const SETTINGS_CACHE_KEY = 'veetaa_app_settings_cache_v1';

export const getSettingValue = async (key: string): Promise<string | null> => {
  try {
    const { data, error } = await supabaseAnon.from(Db.settings).select('value').eq('key', key).single();
    if (error) return null;
    return data?.value || null;
  } catch {
    return null;
  }
};

export const getAllSettings = async (): Promise<AppSettings> => {
  try {
    const { data, error } = await supabaseAnon.from(Db.settings).select('key, value');
    if (error) return getCachedOrDefaultSettings();
    const settings: AppSettings = {
      support_number: '+212600000000',
      delivery_zone: 'kenitra',
    };
    data?.forEach((setting) => {
      if (setting.key === 'delivery_zone' && (setting.value === 'kenitra' || setting.value === 'all_morocco')) {
        settings.delivery_zone = setting.value;
      } else if (setting.key === 'delivery_fee_per_km') {
        const n = parseFloat(String(setting.value));
        settings.delivery_fee_per_km = isNaN(n) || n < 0 ? undefined : n;
      } else if (setting.key === 'delivery_base_fee') {
        const n = parseFloat(String(setting.value));
        settings.delivery_base_fee = isNaN(n) || n < 0 ? undefined : n;
      } else if (setting.key === 'delivery_included_km' || setting.key === 'delivery_free_km') {
        const n = parseFloat(String(setting.value));
        settings.delivery_included_km = isNaN(n) || n < 0 ? undefined : n;
      } else {
        settings[setting.key] = setting.value;
      }
    });
    if (!settings.support_number && settings.support_phone) {
      settings.support_number = settings.support_phone as string;
    }
    safeSetItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    return settings;
  } catch {
    return getCachedOrDefaultSettings();
  }
};

export const getSupportNumber = async (): Promise<string> => {
  const number = await getSettingValue('support_number');
  if (number) return number;
  const phone = await getSettingValue('support_phone');
  return phone || '+212600000000';
};

export const getWhatsAppNumber = async (): Promise<string> => {
  const number = await getSettingValue('whatsapp_number');
  if (!number) return getSupportNumber();
  return number;
};

const SETTINGS_POLL_MS = 12_000;
const REALTIME_WATCHDOG_MS = 10_000;

export const subscribeToSettings = (callback: (settings: AppSettings) => void): (() => void) => {
  const syncNow = () => {
    void getAllSettings().then(callback);
  };

  syncNow();

  if (typeof window === 'undefined') {
    return () => {};
  }

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  const startPolling = () => {
    if (pollTimer !== undefined) return;
    pollTimer = setInterval(() => {
      syncNow();
    }, SETTINGS_POLL_MS);
  };
  const stopPolling = () => {
    if (pollTimer !== undefined) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  };

  const watchdog = window.setTimeout(() => {
    startPolling();
  }, REALTIME_WATCHDOG_MS);

  const onFocusLike = () => syncNow();
  const onOnline = () => syncNow();
  window.addEventListener('focus', onFocusLike);
  document.addEventListener('visibilitychange', onFocusLike);
  window.addEventListener('online', onOnline);

  const subscription = supabaseAnon
    .channel('settings-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: Db.settings }, async () => {
      syncNow();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        window.clearTimeout(watchdog);
        stopPolling();
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        window.clearTimeout(watchdog);
        startPolling();
      }
    });

  return () => {
    window.clearTimeout(watchdog);
    stopPolling();
    window.removeEventListener('focus', onFocusLike);
    document.removeEventListener('visibilitychange', onFocusLike);
    window.removeEventListener('online', onOnline);
    void subscription.unsubscribe();
  };
};

const getDefaultSettings = (): AppSettings => ({
  support_number: '+212600000000',
  whatsapp_number: '+212600000000',
  delivery_zone: 'all_morocco',
});

function getCachedOrDefaultSettings(): AppSettings {
  const cached = safeGetJSON<AppSettings>(SETTINGS_CACHE_KEY);
  if (cached && typeof cached === 'object') {
    return {
      ...getDefaultSettings(),
      ...cached,
    };
  }
  return getDefaultSettings();
}
