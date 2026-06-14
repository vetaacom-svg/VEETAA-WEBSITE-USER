import { supabase } from '../../lib/supabase-client';
import { Db } from '../tables';

export type InsertOrderPayload = Record<string, unknown>;

export async function insertOrderRow(payload: InsertOrderPayload) {
  return supabase.from(Db.orders).insert(payload).select('id').single();
}

export async function updateOrderRatings(orderId: string, storeRating: number, driverRating: number) {
  return supabase.from(Db.orders).update({ store_rating: storeRating, driver_rating: driverRating }).eq('id', orderId);
}
