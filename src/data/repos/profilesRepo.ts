import { supabase, supabaseAnon } from '../../lib/supabase-client';
import { Db } from '../tables';

export function profileByIdQuery(id: string) {
  return supabaseAnon.from(Db.profiles).select('*').eq('id', id);
}

export async function updateProfileRow(userId: string, updates: Record<string, unknown>) {
  return supabase.from(Db.profiles).update(updates).eq('id', userId);
}
