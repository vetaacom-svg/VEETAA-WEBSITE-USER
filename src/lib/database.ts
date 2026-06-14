import { supabase } from './supabase-client';
import { Db } from '../data/tables';
import { UserProfile, Order, OrderStatus } from '../types';

function normalizeInvoiceImages(
  storeInvoiceBase64?: string | null,
  customImagesBase64?: string[] | null
): string[] {
  const out: string[] = [];

  const pushIfValid = (v: unknown) => {
    if (typeof v !== 'string') return;
    const s = v.trim();
    if (!s) return;
    out.push(s);
  };

  if (Array.isArray(customImagesBase64)) {
    customImagesBase64.forEach(pushIfValid);
  }

  if (storeInvoiceBase64 && typeof storeInvoiceBase64 === 'string') {
    const raw = storeInvoiceBase64.trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) arr.forEach(pushIfValid);
      } catch {
        pushIfValid(raw);
      }
    } else {
      pushIfValid(raw);
    }
  }

  // De-duplicate while preserving order
  return Array.from(new Set(out));
}

export async function fetchProfileByPhone(phone: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from(Db.profiles).select('*').eq('phone', phone).single();
  if (error || !data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    isLoggedIn: true,
    language: data.language || 'fr',
  };
}

export async function fetchProfileById(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from(Db.profiles).select('*').eq('id', id).single();
  if (error || !data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    isLoggedIn: true,
    language: data.language || 'fr',
  };
}

export async function updateProfile(
  userId: string | undefined,
  phone: string,
  updates: { fullName?: string; language?: string }
): Promise<{ success: boolean; error?: string }> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.fullName) dbUpdates.full_name = updates.fullName;
  if (updates.language) dbUpdates.language = updates.language;
  dbUpdates.updated_at = new Date().toISOString();
  if (!userId) return { success: false, error: 'Missing user ID' };
  const { error } = await supabase.from(Db.profiles).update(dbUpdates).eq('id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function fetchFavorites(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from(Db.favorites).select('store_id').eq('user_id', userId);
  if (error || !data) return [];
  return data.map((f) => f.store_id);
}

export async function addFavorite(userId: string, storeId: string): Promise<boolean> {
  const { error } = await supabase.from(Db.favorites).insert({ user_id: userId, store_id: storeId });
  return !error;
}

export async function removeFavorite(userId: string, storeId: string): Promise<boolean> {
  const { error } = await supabase.from(Db.favorites).delete().eq('user_id', userId).eq('store_id', storeId);
  return !error;
}

export async function fetchOrdersByUserId(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from(Db.orders)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((o) => ({
    ...(() => {
      const imgs = normalizeInvoiceImages(o.store_invoice_base64, o.custom_images_base64);
      return {
        storeInvoiceBase64: o.store_invoice_base64,
        storeInvoiceImages: imgs,
      };
    })(),
    id: o.id.toString(),
    userId: o.user_id || undefined,
    storeId: o.store_id || undefined,
    customerName: o.customer_name,
    phone: o.phone || '',
    location: o.delivery_lat && o.delivery_lng ? { lat: o.delivery_lat, lng: o.delivery_lng } : null,
    items: o.items || [],
    textOrder: o.text_order_notes,
    prescriptionImage: o.prescription_base64,
    paymentReceiptImage: o.payment_receipt_base64,
    total: o.total_products ?? 0,
    totalFinal: o.total_final ?? undefined,
    deliveryFee: o.delivery_fee ?? 0,
    status: o.status as OrderStatus,
    paymentMethod: o.payment_method as 'cash' | 'transfer',
    timestamp: new Date(o.created_at).getTime(),
    category: o.category_name || 'Autre',
    storeName: o.store_name,
    storeRating: o.store_rating != null ? Number(o.store_rating) : undefined,
    driverRating: o.driver_rating != null ? Number(o.driver_rating) : undefined,
    statusHistory: o.status_history,
    isArchived: o.is_archived ?? undefined,
    assignedDriverId: o.assigned_driver_id || undefined,
  }));
}

export async function saveOrderToDb(order: Order): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const dbOrder = {
    user_id: order.userId,
    store_id: order.storeId,
    customer_name: order.customerName,
    status: order.status,
    total_products: order.total,
    total_final: order.totalFinal ?? (order.total + (order.deliveryFee ?? 15)),
    delivery_fee: order.deliveryFee ?? 15,
    payment_method: order.paymentMethod,
    payment_receipt_base64: order.paymentReceiptImage,
    prescription_base64: order.prescriptionImage,
    text_order_notes: order.textOrder,
    delivery_lat: order.location?.lat,
    delivery_lng: order.location?.lng,
    delivery_note: order.delivery_note ?? null,
    category_name: order.category,
    store_name: order.storeName,
    items: order.items,
  };
  const { data, error } = await supabase.from(Db.orders).insert([dbOrder]).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, orderId: data.id };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
  const { error } = await supabase.from(Db.orders).update({ status }).eq('id', orderId);
  return !error;
}

export async function updateDriverRating(orderId: string, driverRating: number): Promise<boolean> {
  if (driverRating < 1 || driverRating > 5) return false;
  const { error } = await supabase.from(Db.orders).update({ driver_rating: driverRating }).eq('id', orderId);
  if (error) {
    console.error('Error updating driver rating:', error);
    return false;
  }
  return true;
}
