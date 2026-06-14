/** Web: no native push. Stub so app code doesn't break. */
export const isNativePlatform = () => false;

export const initializePushNotifications = async (): Promise<boolean> => false;
export const checkNotificationPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => 'denied';
export const requestNotificationPermission = async (): Promise<boolean> => false;

export interface PushNotificationSchema {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface ActionPerformed {
  notification: PushNotificationSchema & { data?: Record<string, unknown> };
}

export const setupNotificationListeners = (
  _onTokenReceived?: (token: string) => void,
  _onNotificationReceived?: (notification: PushNotificationSchema) => void,
  _onNotificationAction?: (notification: ActionPerformed) => void
) => {};

export const removeNotificationListeners = async () => {};

export interface NotificationPreferences {
  orderUpdates: boolean;
  deliveryAlerts: boolean;
  promotions: boolean;
  newProducts: boolean;
  chatMessages: boolean;
  emailNotifications: boolean;
}

export const getNotificationPreferences = (): NotificationPreferences => ({
  orderUpdates: true,
  deliveryAlerts: true,
  promotions: true,
  newProducts: false,
  chatMessages: true,
  emailNotifications: false,
});

export const saveNotificationPreferences = (_preferences: NotificationPreferences) => {};
export const createLocalNotification = async (_title: string, _body: string) => {};
export const clearAllNotifications = async () => {};
export const getDeliveredNotifications = async () => [];
export const getDeviceToken = (): string | null => null;
