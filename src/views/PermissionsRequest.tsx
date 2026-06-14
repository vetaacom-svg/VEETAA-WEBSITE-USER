
import React, { useState, useEffect } from 'react';
import { MapPin, PhoneCall, Contact, Bell, CheckCircle2, ChevronRight } from 'lucide-react';
import { requestNotificationPermission, checkNotificationPermission } from '../lib/notifications';
import { TRANSLATIONS } from '../constants';

interface PermissionsProps {
  onGranted: () => void;
  language?: 'fr' | 'ar' | 'en';
}

const PermissionsRequest: React.FC<PermissionsProps> = ({ onGranted, language = 'fr' }) => {
  const [granted, setGranted] = useState({
    location: false,
    calls: false,
    contacts: false,
    notifications: false
  });

  const t = TRANSLATIONS[language];
  const isNativePlatform = false;

  useEffect(() => {
    // Check initial permissions status on native platforms
    if (isNativePlatform) {
      checkPermissions();
    }
  }, [isNativePlatform]);

  const checkPermissions = async () => {
    if (!isNativePlatform) return;
    try {
      const notificationPermission = await checkNotificationPermission();
      if (notificationPermission === 'granted') {
        setGranted(prev => ({ ...prev, notifications: true }));
      }
    } catch (error) {
      console.log('Permission check error:', error);
    }
  };

  const handleGrant = async (type: keyof typeof granted) => {
    console.log('Requesting permission for:', type, 'Native platform:', isNativePlatform);
    
    if (type === 'location') {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => setGranted(prev => ({ ...prev, location: true })),
            () => setGranted(prev => ({ ...prev, location: true }))
          );
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
        alert('Error requesting location permission: ' + error);
      }
    } else if (type === 'notifications') {
      try {
        if (isNativePlatform) {
          console.log('Requesting notification permission...');
          const result = await requestNotificationPermission();
          if (result) {
            setGranted(prev => ({ ...prev, notifications: true }));
          }
        } else {
          // Web fallback - just mark as granted
          setGranted(prev => ({ ...prev, notifications: true }));
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    } else if (type === 'calls') {
      // Phone permissions are requested when user tries to make a call
      // Just mark as granted for UI flow
      setGranted(prev => ({ ...prev, calls: true }));
    } else if (type === 'contacts') {
      // Contacts permissions are requested when user tries to access contacts
      // Just mark as granted for UI flow
      setGranted(prev => ({ ...prev, contacts: true }));
    }
  };

  const allGranted = granted.location && granted.calls && granted.contacts && granted.notifications;

  return (
    <div className="min-h-screen p-8 flex flex-col justify-center space-y-8 animate-in slide-in-from-bottom duration-500 relative">
      <button 
        onClick={onGranted}
        className="absolute top-8 right-8 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors flex items-center gap-1"
      >
        {t.skipPermissions} <ChevronRight className="w-4 h-4" />
      </button>

      <div className="space-y-2">
        <h2 className="text-3xl font-black text-slate-800 leading-tight">{t.permissionsRequired} 🔐</h2>
        <p className="text-slate-500">{t.permissionsMessage}</p>
      </div>

      <div className="space-y-4">
        {/* Location */}
        <div className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${granted.location ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${granted.location ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <MapPin className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm">{t.locationPermission}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{t.locationDesc}</p>
          </div>
          {!granted.location ? (
            <button onClick={() => handleGrant('location')} className="bg-orange-600 text-white text-[10px] font-black px-4 py-2 rounded-xl">{t.authorize}</button>
          ) : (
            <CheckCircle2 className="text-emerald-500 w-6 h-6" />
          )}
        </div>

        {/* Calls */}
        <div className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${granted.calls ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${granted.calls ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <PhoneCall className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm">{t.callsPermission}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{t.callsDesc}</p>
          </div>
          {!granted.calls ? (
            <button onClick={() => handleGrant('calls')} className="bg-orange-600 text-white text-[10px] font-black px-4 py-2 rounded-xl">{t.authorize}</button>
          ) : (
            <CheckCircle2 className="text-emerald-500 w-6 h-6" />
          )}
        </div>

        {/* Contacts */}
        <div className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${granted.contacts ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${granted.contacts ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <Contact className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm">{t.contactsPermission}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{t.contactsDesc}</p>
          </div>
          {!granted.contacts ? (
            <button onClick={() => handleGrant('contacts')} className="bg-orange-600 text-white text-[10px] font-black px-4 py-2 rounded-xl">{t.authorize}</button>
          ) : (
            <CheckCircle2 className="text-emerald-500 w-6 h-6" />
          )}
        </div>

        {/* Notifications */}
        <div className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${granted.notifications ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${granted.notifications ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <Bell className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm">{t.notificationsPermission || 'Notifications'}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{t.notificationsDesc || (language === 'ar' ? 'تلقي تحديثات الطلب' : language === 'en' ? 'Receive order updates' : 'Recevoir les mises à jour de commande')}</p>
          </div>
          {!granted.notifications ? (
            <button onClick={() => handleGrant('notifications')} className="bg-orange-600 text-white text-[10px] font-black px-4 py-2 rounded-xl">{t.authorize}</button>
          ) : (
            <CheckCircle2 className="text-emerald-500 w-6 h-6" />
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <button 
          onClick={onGranted}
          disabled={!allGranted}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all shadow-lg ${allGranted ? 'bg-orange-600 text-white shadow-orange-200 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          {t.continueToApp}
        </button>
        
        <button 
          onClick={onGranted}
          className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
        >
          {t.ignoreForNow}
        </button>
      </div>
    </div>
  );
};

export default PermissionsRequest;
