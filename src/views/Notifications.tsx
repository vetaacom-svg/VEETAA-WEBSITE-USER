import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Package, Truck, CheckCircle, MessageSquare, Tag, AlertCircle, Trash2, Check, X } from 'lucide-react';
import { Language, Notification } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase } from '../lib/supabase-client';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  subscribeToNotifications,
  getPreferences,
  savePreferences,
  formatNotificationTime,
  getNotificationColor
} from '../lib/notificationService';
import { safeGetJSON, safeSetJSON } from '../lib/storage';

interface NotificationsProps {
  language: Language;
  onBack: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ language, onBack }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  // Notification preferences state
  const [preferences, setPreferences] = useState({
    order_updates: true,
    delivery_alerts: true,
    promotions: true,
    new_products: false,
    chat_messages: true,
    email_notifications: false
  });

  // Get current user
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadNotifications(user.id);
        loadPreferences(user.id);
        setupRealtimeSubscription(user.id);
      } else {
        // Fallback to session storage for non-authenticated users
        loadLocalPreferences();
        setLoading(false);
      }
    };
    initUser();
  }, []);

  // Load notifications from database
  const loadNotifications = async (uid: string) => {
    setLoading(true);
    const { data, error } = await getUserNotifications(uid, {
      limit: 100,
      unreadOnly: activeTab === 'unread'
    });

    if (!error && data) {
      setNotifications(data);
    }

    // Get unread count
    const count = await getUnreadCount(uid);
    setUnreadCount(count);

    setLoading(false);
  };

  // Load preferences from database
  const loadPreferences = async (uid: string) => {
    const { data, error } = await getPreferences(uid);
    if (!error && data) {
      setPreferences({
        order_updates: data.order_updates,
        delivery_alerts: data.delivery_alerts,
        promotions: data.promotions,
        new_products: data.new_products,
        chat_messages: data.chat_messages,
        email_notifications: data.email_notifications
      });
    }
  };

  // Load preferences from session storage (fallback)
  const loadLocalPreferences = () => {
    const savedPreferences = safeGetJSON<typeof preferences>('veetaa_notification_preferences');
    if (savedPreferences) setPreferences(savedPreferences);
  };

  // Setup real-time subscription
  const setupRealtimeSubscription = (uid: string) => {
    const channel = subscribeToNotifications(uid, {
      onInsert: (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      },
      onUpdate: (notification) => {
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? notification : n)
        );
        if (notification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      },
      onDelete: (notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Toggle preference
  const togglePreference = async (key: keyof typeof preferences) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);

    // Save to database if user is authenticated
    if (userId) {
      await savePreferences(userId, updated);
    } else {
      // Fallback to session storage
      safeSetJSON('veetaa_notification_preferences', updated);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle navigation based on notification data
    if (notification.data?.order_id) {
      // Navigation callback can be wired later if needed.
    }
  };

  // Handle delete notification
  const handleDelete = async (notificationId: string) => {
    await deleteNotification(notificationId);
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    if (userId) {
      await markAllAsRead(userId);
      if (userId) loadNotifications(userId);
    }
  };

  // Handle delete all read
  const handleDeleteAllRead = async () => {
    if (userId) {
      await deleteAllRead(userId);
      if (userId) loadNotifications(userId);
    }
  };

  const notificationTypes = [
    {
      key: 'order_updates' as const,
      icon: <Package className="w-5 h-5" />,
      title: language === 'ar' ? 'تحديثات الطلب' : language === 'en' ? 'Order Updates' : 'Mises à jour de commande',
      description: language === 'ar'
        ? 'احصل على إشعارات حول حالة طلباتك'
        : language === 'en'
          ? 'Get notifications about your order status'
          : 'Recevez des notifications sur l\'état de vos commandes',
      color: 'text-orange-500 bg-orange-50'
    },
    {
      key: 'delivery_alerts' as const,
      icon: <Truck className="w-5 h-5" />,
      title: language === 'ar' ? 'تنبيهات التوصيل' : language === 'en' ? 'Delivery Alerts' : 'Alertes de livraison',
      description: language === 'ar'
        ? 'عندما يكون السائق في الطريق إليك'
        : language === 'en'
          ? 'When the driver is on their way to you'
          : 'Quand le livreur est en route vers vous',
      color: 'text-blue-500 bg-blue-50'
    },
    {
      key: 'promotions' as const,
      icon: <Tag className="w-5 h-5" />,
      title: language === 'ar' ? 'العروض والخصومات' : language === 'en' ? 'Offers & Discounts' : 'Offres et réductions',
      description: language === 'ar'
        ? 'اطلع على أحدث العروض الترويجية والخصومات'
        : language === 'en'
          ? 'Stay updated on the latest promotions and discounts'
          : 'Restez informé des dernières promotions et réductions',
      color: 'text-red-500 bg-red-50'
    },
    {
      key: 'new_products' as const,
      icon: <CheckCircle className="w-5 h-5" />,
      title: language === 'ar' ? 'منتجات جديدة' : language === 'en' ? 'New Products' : 'Nouveaux produits',
      description: language === 'ar'
        ? 'عندما تتوفر منتجات أو متاجر جديدة'
        : language === 'en'
          ? 'When new products or stores become available'
          : 'Quand de nouveaux produits ou magasins sont disponibles',
      color: 'text-emerald-500 bg-emerald-50'
    },
    {
      key: 'chat_messages' as const,
      icon: <MessageSquare className="w-5 h-5" />,
      title: language === 'ar' ? 'رسائل الدعم' : language === 'en' ? 'Support Messages' : 'Messages de support',
      description: language === 'ar'
        ? 'عندما يرد فريق الدعم على رسائلك'
        : language === 'en'
          ? 'When support team replies to your messages'
          : 'Quand l\'équipe de support répond à vos messages',
      color: 'text-purple-500 bg-purple-50'
    },
    {
      key: 'email_notifications' as const,
      icon: <Bell className="w-5 h-5" />,
      title: language === 'ar' ? 'إشعارات البريد الإلكتروني' : language === 'en' ? 'Email Notifications' : 'Notifications par email',
      description: language === 'ar'
        ? 'استلم إشعارات عبر البريد الإلكتروني'
        : language === 'en'
          ? 'Receive notifications via email'
          : 'Recevez des notifications par email',
      color: 'text-amber-500 bg-amber-50'
    }
  ];

  const activeCount = Object.values(preferences).filter(Boolean).length;
  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 px-1">
        <div className="p-3 bg-blue-100 rounded-xl mr-2">
          <Bell className="w-7 h-7 text-blue-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-black text-slate-800">{t('notifications')}</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            {unreadCount > 0 && `${unreadCount} ${language === 'fr' ? 'non lues' : language === 'en' ? 'unread' : 'غير مقروءة'}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-all ${activeTab === 'all'
            ? 'bg-orange-600 text-white'
            : 'bg-slate-100 text-slate-600'
            }`}
        >
          {language === 'fr' ? 'Toutes' : language === 'en' ? 'All' : 'الكل'} ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('unread')}
          className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-all ${activeTab === 'unread'
            ? 'bg-orange-600 text-white'
            : 'bg-slate-100 text-slate-600'
            }`}
        >
          {language === 'fr' ? 'Non lues' : language === 'en' ? 'Unread' : 'غير مقروءة'} ({unreadCount})
        </button>
      </div>

      {/* Notification Actions */}
      {notifications.length > 0 && (
        <div className="flex gap-2 px-1">
          <button
            onClick={handleMarkAllAsRead}
            className="flex-1 bg-emerald-50 text-emerald-700 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {language === 'fr' ? 'Tout marquer lu' : language === 'en' ? 'Mark all read' : 'تحديد الكل كمقروء'}
          </button>
          <button
            onClick={handleDeleteAllRead}
            className="flex-1 bg-red-50 text-red-700 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {language === 'fr' ? 'Supprimer lues' : language === 'en' ? 'Delete read' : 'حذف المقروءة'}
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-2 px-1">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">
              {language === 'fr' ? 'Aucune notification' : language === 'en' ? 'No notifications' : 'لا توجد إشعارات'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer ${notification.read ? 'border-slate-100' : 'border-orange-200 bg-orange-50/30'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${getNotificationColor(notification.type)}`}>
                  {notification.type === 'order_update' && <Package className="w-5 h-5" />}
                  {notification.type === 'delivery_alert' && <Truck className="w-5 h-5" />}
                  {notification.type === 'promotion' && <Tag className="w-5 h-5" />}
                  {notification.type === 'new_product' && <CheckCircle className="w-5 h-5" />}
                  {notification.type === 'chat_message' && <MessageSquare className="w-5 h-5" />}
                  {notification.type === 'system' && <Bell className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-black text-slate-800 text-sm">{notification.title}</h3>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-orange-600 rounded-full flex-shrink-0 mt-1"></div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notification.message}</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">
                    {formatNotificationTime(notification.created_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(notification.id);
                  }}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 text-slate-400 hover:text-red-600" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preferences Section */}
      <div className="border-t border-slate-200 pt-6 mt-6">
        <h3 className="text-lg font-black text-slate-800 mb-4 px-1">
          {language === 'fr' ? 'Préférences' : language === 'en' ? 'Preferences' : 'التفضيلات'}
        </h3>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mx-1 mb-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-blue-700 leading-relaxed">
                {language === 'ar'
                  ? 'يمكنك التحكم في الإشعارات التي تريد تلقيها. يمكنك تغيير هذه الإعدادات في أي وقت.'
                  : language === 'en'
                    ? 'You can control which notifications you want to receive. You can change these settings anytime.'
                    : 'Vous pouvez contrôler les notifications que vous souhaitez recevoir. Vous pouvez modifier ces paramètres à tout moment.'}
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="space-y-3 px-1">
          {notificationTypes.map((type) => (
            <div
              key={type.key}
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${type.color}`}>
                  {type.icon}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="font-black text-slate-800 text-sm sm:text-base mb-1">{type.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{type.description}</p>
                </div>
                <button
                  onClick={() => togglePreference(type.key)}
                  className={`relative flex-shrink-0 w-14 h-8 rounded-full transition-all duration-300 shadow-inner ${preferences[type.key] ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-slate-300'
                    }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${preferences[type.key] ? 'left-7' : 'left-1'
                      }`}
                  >
                    {preferences[type.key] && (
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 px-1 mt-4">
          <button
            onClick={() => {
              const allOn = {
                order_updates: true,
                delivery_alerts: true,
                promotions: true,
                new_products: true,
                chat_messages: true,
                email_notifications: true
              };
              setPreferences(allOn);
              if (userId) {
                savePreferences(userId, allOn);
              } else {
                safeSetJSON('veetaa_notification_preferences', allOn);
              }
            }}
            className="flex-1 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4" />
            {language === 'ar' ? 'تفعيل الكل' : language === 'en' ? 'Enable All' : 'Tout activer'}
          </button>
          <button
            onClick={() => {
              const allOff = {
                order_updates: false,
                delivery_alerts: false,
                promotions: false,
                new_products: false,
                chat_messages: false,
                email_notifications: false
              };
              setPreferences(allOff);
              if (userId) {
                savePreferences(userId, allOff);
              } else {
                safeSetJSON('veetaa_notification_preferences', allOff);
              }
            }}
            className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <BellOff className="w-4 h-4" />
            {language === 'ar' ? 'تعطيل الكل' : language === 'en' ? 'Disable All' : 'Tout désactiver'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
