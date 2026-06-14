export type Language = 'fr' | 'ar' | 'en';

export type View =
  | 'WELCOME'
  | 'LOGIN'
  | 'SIGNUP'
  | 'OTP_VERIFICATION'
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFICATION'
  | 'EMAIL_VERIFIED'
  | 'EMAIL_OTP_VERIFY'
  | 'PERMISSIONS'
  | 'HOME'
  | 'OUT_OF_ZONE'
  | 'BLOCKED'
  | 'VPN_BLOCKED'
  | 'CATEGORY'
  | 'STORE'
  | 'CHECKOUT'
  | 'PAYMENT'
  | 'CONFIRMATION'
  | 'FAVORITES'
  | 'SETTINGS'
  | 'PROFILE_EDIT'
  | 'TRACKING'
  | 'HISTORY'
  | 'HELP'
  | 'PRODUCT_ORDER'
  | 'PRIVACY'
  | 'NOTIFICATIONS'
  | 'ALL_STORES';

export enum CategoryID {
  FOOD = 'food',
  PHARMACIE = 'pharmacie',
  BOULANGERIE = 'boulangerie',
  PRESSING = 'pressing',
  LEGUMES = 'legumes',
  MARKET = 'market',
  EXPRESS = 'express',
}

/** Sous-catégorie catalogue (magasins) — peut avoir un parent (ex. Snack → Tacos). */
export interface SubCategory {
  id: string;
  name: string;
  category_id: string;
  parent_id?: string | null;
}

/** Sous-sous-catégorie menu produit (liée à store_sub_categories en base). */
export interface ProductSubCategory {
  id: string;
  name: string;
  store_sub_category_id: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
  storeId?: string;
  storeName?: string;
  category?: CategoryID;
  /** Libellé affiché dans les onglets menu (Tacos, Pizza, Burger, Jus…). */
  menuSection?: string;
  subCategoryId?: string;
  productSubCategoryId?: string;
  storeSubCategoryId?: string;
  productImages?: string[];
  priceEditable?: boolean;
  isAvailable?: boolean;
  isFeatured?: boolean;
  discountPrice?: number;
  userVisibleFields?: string[];
  userFieldLabels?: Record<string, string>;
}

export interface DeliveryZone {
  id: string;
  name: string;
  radius_km: number;
  center_lat: number;
  center_lng: number;
  is_active: boolean;
}

export interface Store {
  id: string;
  name: string;
  category: CategoryID;
  type: 'products' | 'menu-image' | 'text-only' | 'prescription';
  image: string;
  products?: Product[];
  menuImage?: string;
  rating?: number;
  deliveryTimeMin?: number;
  deliveryFee?: number;
  description?: string;
  mapsUrl?: string;
  sub_category?: string;
  store_sub_category_id?: string;
  isOpen?: boolean;
  isFeatured?: boolean;
  hasProducts?: boolean;
  is_deleted?: boolean;
  is_new?: boolean;
  /** Canonical coordinates (preferred) */
  latitude?: number;
  longitude?: number;
  /** Backward-compat aliases kept during transition */
  lat?: number;
  lng?: number;
  isActive?: boolean;
  createdAt?: string;
  userVisibleFields?: string[];
  userFieldLabels?: Record<string, string>;
  deliveryBaseFee?: number;
  deliveryIncludedKm?: number;
  deliveryFeePerKm?: number;
  deliveryFixedFee?: number;
  zone_id?: string;
}

export interface CartItem {
  product?: Product;
  quantity: number;
  note?: string;
  image_base64?: string;
  storeId?: string;
  storeName?: string;
}

export type OrderStatus =
  | 'pending'
  | 'en_attente'
  | 'accepted'
  | 'verification'
  | 'en_verification'
  | 'preparing'
  | 'treatment'
  | 'traitement'
  | 'en_traitement'
  | 'delivering'
  | 'course'
  | 'en_course'
  | 'progress'
  | 'progression'
  | 'en_progression'
  | 'delivered'
  | 'livree'
  | 'refused'
  | 'refusee'
  | 'unavailable'
  | 'indisponible';

export interface Order {
  id: string;
  userId?: string;
  storeId?: string;
  customerName: string;
  phone: string;
  location: { lat: number; lng: number } | null;
  items: CartItem[];
  textOrder?: string;
  prescriptionImage?: string;
  paymentReceiptImage?: string;
  total: number;
  totalFinal?: number;
  status: OrderStatus;
  paymentMethod: 'cash' | 'transfer';
  rib?: string;
  timestamp: number;
  storeRating?: number;
  driverRating?: number;
  category: string;
  storeName?: string;
  delivery_note?: string;
  deliveryFee?: number;
  storeInvoiceBase64?: string;
  storeInvoiceImages?: string[];
  statusHistory?: unknown;
  isArchived?: boolean;
  assignedDriverId?: string;
}

export interface UserProfile {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  isLoggedIn: boolean;
  language?: Language;
  /** Défini côté base (`profiles.is_admin`) — ne jamais faire confiance au seul stockage local. */
  isAdmin?: boolean;
}

export type NotificationType =
  | 'order_update'
  | 'delivery_alert'
  | 'promotion'
  | 'new_product'
  | 'chat_message'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
  expires_at?: string;
}

export interface NotificationPreferences {
  user_id: string;
  order_updates: boolean;
  delivery_alerts: boolean;
  promotions: boolean;
  new_products: boolean;
  chat_messages: boolean;
  email_notifications: boolean;
  updated_at: string;
}
