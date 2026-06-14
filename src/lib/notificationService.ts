import { supabase } from './supabase-client';
import { Db } from '../data/tables';
import { Notification, NotificationPreferences, NotificationType } from '../types';

export async function getUserNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean; type?: NotificationType } = {}
) {
  const { limit = 50, unreadOnly = false, type } = options;
  let query = supabase
    .from(Db.notifications)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (unreadOnly) query = query.eq('read', false);
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  return { data: data as Notification[] | null, error };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(Db.notifications)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count || 0;
}

export async function markAsRead(notificationId: string) {
  return await supabase.from(Db.notifications).update({ read: true }).eq('id', notificationId);
}

export async function markAllAsRead(userId: string) {
  return await supabase.from(Db.notifications).update({ read: true }).eq('user_id', userId).eq('read', false);
}

export async function deleteNotification(notificationId: string) {
  return await supabase.from(Db.notifications).delete().eq('id', notificationId);
}

export async function deleteAllRead(userId: string) {
  return await supabase.from(Db.notifications).delete().eq('user_id', userId).eq('read', true);
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: unknown
) {
  const { data: notification, error } = await supabase
    .from(Db.notifications)
    .insert({ user_id: userId, type, title, message, data })
    .select()
    .single();
  return { data: notification as Notification | null, error };
}

export function subscribeToNotifications(
  userId: string,
  callbacks: {
    onInsert?: (notification: Notification) => void;
    onUpdate?: (notification: Notification) => void;
    onDelete?: (notificationId: string) => void;
  }
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: Db.notifications, filter: `user_id=eq.${userId}` },
      (payload) => callbacks.onInsert?.(payload.new as Notification)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: Db.notifications, filter: `user_id=eq.${userId}` },
      (payload) => callbacks.onUpdate?.(payload.new as Notification)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: Db.notifications, filter: `user_id=eq.${userId}` },
      (payload) => callbacks.onDelete?.(payload.old.id)
    )
    .subscribe();
  return channel;
}

export async function unsubscribeFromNotifications(channel: ReturnType<typeof supabase.channel>) {
  await supabase.removeChannel(channel);
}

export async function getPreferences(userId: string) {
  const { data, error } = await supabase
    .from(Db.notificationPreferences)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { data: null, error };
  if (data) return { data: data as NotificationPreferences | null, error: null };
  const defaultPrefs = {
    user_id: userId,
    order_updates: true,
    delivery_alerts: true,
    promotions: true,
    new_products: false,
    chat_messages: true,
    email_notifications: false,
  };
  const { data: newData, error: upsertError } = await supabase
    .from(Db.notificationPreferences)
    .upsert(defaultPrefs, { onConflict: 'user_id' })
    .select()
    .single();
  return { data: newData as NotificationPreferences | null, error: upsertError };
}

export async function savePreferences(
  userId: string,
  preferences: Omit<NotificationPreferences, 'user_id' | 'updated_at'>
) {
  const { data, error } = await supabase
    .from(Db.notificationPreferences)
    .upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data: data as NotificationPreferences | null, error };
}

export async function saveDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web') {
  return await supabase
    .from(Db.deviceTokens)
    .upsert({ user_id: userId, token, platform, last_used_at: new Date().toISOString() })
    .select()
    .single();
}

export async function getDeviceTokens(userId: string) {
  return await supabase.from(Db.deviceTokens).select('*').eq('user_id', userId);
}

export async function removeDeviceToken(token: string) {
  return await supabase.from(Db.deviceTokens).delete().eq('token', token);
}

export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    order_update: '📦',
    delivery_alert: '🚚',
    promotion: '🏷️',
    new_product: '✨',
    chat_message: '💬',
    system: '🔔',
  };
  return icons[type] || '🔔';
}

export function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    order_update: 'text-orange-500 bg-orange-50',
    delivery_alert: 'text-blue-500 bg-blue-50',
    promotion: 'text-red-500 bg-red-50',
    new_product: 'text-emerald-500 bg-emerald-50',
    chat_message: 'text-purple-500 bg-purple-50',
    system: 'text-slate-500 bg-slate-50',
  };
  return colors[type] || 'text-slate-500 bg-slate-50';
}

export function formatNotificationTime(timestamp: string): string {
  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffMs = now.getTime() - notificationTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return notificationTime.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
