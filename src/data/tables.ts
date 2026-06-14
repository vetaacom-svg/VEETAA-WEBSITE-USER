/**
 * Noms de tables Supabase — source unique pour éviter les fautes de frappe et faciliter les migrations.
 */
export const Db = {
  profiles: 'profiles',
  orders: 'orders',
  favorites: 'favorites',
  categories: 'categories',
  stores: 'stores',
  products: 'products',
  subCategories: 'sub_categories',
  storeSubCategories: 'store_sub_categories',
  productSubCategories: 'product_sub_categories',
  settings: 'settings',
  announcements: 'announcements',
  promoCodes: 'promo_codes',
  ribs: 'ribs',
  supportInfo: 'support_info',
  socialLinks: 'social_links',
  notifications: 'notifications',
  notificationPreferences: 'notification_preferences',
  deviceTokens: 'device_tokens',
  supportTickets: 'support_tickets',
  supportMessages: 'support_messages',
} as const;

export type DbTable = (typeof Db)[keyof typeof Db];
