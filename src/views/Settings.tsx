import React, { useState } from 'react';
import { UserProfile, Language } from '../types';
import { LogOut, Bell, Shield, Headset, ChevronRight, User, Heart, Edit3, Globe, Sparkles, MapPin, CreditCard, HardDrive } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { clearVeetaaSessionDataPreservingAuth, sanitizeVeetaaStorage } from '../lib/storage';

interface SettingsProps {
  user: UserProfile | null;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLogout: () => void;
  onHelp: () => void;
  onEditProfile?: () => void;
  onGoFavorites?: () => void;
  onNotifications?: () => void;
  onPrivacy?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ user, language, onLanguageChange, onLogout, onHelp, onEditProfile, onGoFavorites, onNotifications, onPrivacy }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [clearingCache, setClearingCache] = useState(false);

  const cacheLabels =
    language === 'ar'
      ? {
          title: 'تفريغ الذاكرة المؤقتة',
          hint: 'سلة، مفضلة، خريطة، إعدادات العرض. تبقى مسجّل الدخول.',
        }
      : language === 'en'
        ? {
            title: 'Clear local data',
            hint: 'Cart, favorites, map UI, display cache. You stay logged in.',
          }
        : {
            title: 'Vider les données locales',
            hint: 'Panier, favoris, cache carte, affichage. Vous restez connecté.',
          };

  const handleClearLocalCache = () => {
    if (clearingCache) return;
    if (!window.confirm(cacheLabels.hint + '\n\n' + (language === 'fr' ? 'Continuer ?' : language === 'ar' ? 'متابعة؟' : 'Continue?'))) return;
    setClearingCache(true);
    try {
      clearVeetaaSessionDataPreservingAuth();
      sanitizeVeetaaStorage();
      window.setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      console.error(e);
      setClearingCache(false);
    }
  };

  const menuSections = [
    {
      title: 'Compte',
      items: [
        { icon: <User className="w-5 h-5" />, label: t('editProfile') || 'Modifier Profil', color: 'text-blue-500 bg-blue-50', action: onEditProfile || (() => { }) },
        { icon: <Heart className="w-5 h-5" />, label: t('favorites'), color: 'text-pink-500 bg-pink-50', action: onGoFavorites || (() => { }) },
        { icon: <CreditCard className="w-5 h-5" />, label: t('paymentMethods') || 'Paiements', color: 'text-orange-500 bg-orange-50', action: () => { } },
      ]
    },
    {
      title: 'Préférences',
      items: [
        { icon: <Bell className="w-5 h-5" />, label: t('notifications'), color: 'text-amber-500 bg-amber-50', action: onNotifications || (() => { }) },
        { icon: <Shield className="w-5 h-5" />, label: t('privacy'), color: 'text-emerald-500 bg-emerald-50', action: onPrivacy || (() => { }) },
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: <Headset className="w-5 h-5" />, label: t('help'), color: 'text-indigo-500 bg-indigo-50', action: onHelp },
        {
          icon: <HardDrive className="w-5 h-5" />,
          label: cacheLabels.title,
          color: 'text-slate-600 bg-slate-100',
          action: handleClearLocalCache,
        },
      ]
    }
  ];

  const languages: { code: Language; label: string; flagSrc: string }[] = [
    { code: 'fr', label: 'Français', flagSrc: 'https://flagcdn.com/w80/fr.png' },
    { code: 'ar', label: 'العربية', flagSrc: 'https://flagcdn.com/w80/ma.png' },
    { code: 'en', label: 'English', flagSrc: 'https://flagcdn.com/w80/gb.png' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-16 animate-premium lg:max-w-4xl lg:mx-auto">
      {/* Header Profile Card */}
      <div className="relative pt-4 md:pt-10 px-4 md:px-6 mb-6 md:mb-10">
        <div className="bg-slate-900 rounded-2xl md:rounded-[3rem] p-6 md:p-10 shadow-2xl relative overflow-hidden text-white group">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-orange-600/30 to-transparent opacity-50 group-hover:scale-110 transition-transform duration-1000" />
          <div className="relative z-10 flex flex-row items-center gap-4 md:gap-8">
            <div className="w-16 h-16 md:w-24 md:h-24 bg-white/10 backdrop-blur-2xl rounded-xl md:rounded-[2.5rem] flex items-center justify-center text-orange-500 shadow-inner group-hover:rotate-6 transition-transform relative">
              <User size={window.innerWidth < 768 ? 32 : 48} strokeWidth={2.5} />
              <button 
                onClick={onEditProfile}
                className="absolute -bottom-1 -right-1 p-2 md:p-3 bg-orange-600 text-white rounded-lg md:rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"
              >
                <Edit3 size={window.innerWidth < 768 ? 14 : 16} />
              </button>
            </div>
            <div className="space-y-0.5 md:space-y-1 text-left">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Profil Client</p>
              <h2 className="text-xl md:text-3xl font-black tracking-tighter text-white uppercase">{user?.fullName || t('guest')}</h2>
              <div className="flex items-center gap-2 text-orange-400 font-bold text-[10px] md:text-sm">
                <MapPin size={window.innerWidth < 768 ? 12 : 14} /> <span>Kenitra, Maroc</span>
                <span className="w-1 h-1 rounded-full bg-slate-700" />
                <span>{user?.phone || '+212 6XX XXX XXX'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-6 md:space-y-12">
        {/* Language Section - Glassmorphism Card */}
        <div className="space-y-4 md:space-y-6">
          <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
            <Globe size={14} className="text-orange-600" /> {t('language')}
          </h3>
          <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-50 p-1.5 md:p-3 flex gap-2 md:gap-3 shadow-sm">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => onLanguageChange(lang.code)}
                className={`flex-1 flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 rounded-xl md:rounded-[1.75rem] transition-all relative overflow-hidden group/lang ${
                  language === lang.code 
                    ? 'bg-slate-900 text-white shadow-2xl scale-105 z-10' 
                    : 'bg-slate-50 text-slate-400'
                }`}
              >
                <img
                  src={lang.flagSrc}
                  alt=""
                  className="w-5 h-3.5 md:w-8 md:h-6 object-cover rounded-sm md:rounded-md border border-white/20"
                />
                <span className="text-[10px] md:text-[11px] font-black uppercase tracking-tight">{lang.label}</span>
                {language === lang.code && <Sparkles className="absolute -top-1 -right-1 w-4 h-4 md:w-6 md:h-6 text-orange-500 opacity-30" />}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Sections */}
        {menuSections.map((section, sidx) => (
          <div key={sidx} className="space-y-4 md:space-y-6">
            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.3em] px-2">{section.title}</h3>
            <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-50 p-1 md:p-4 shadow-sm space-y-1">
              {section.items.map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-4 md:p-5 rounded-xl md:rounded-[1.5rem] hover:bg-slate-50 transition-all group/item overflow-hidden relative"
                >
                  <div className="flex items-center gap-4 md:gap-5 min-w-0">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all group-hover/item:scale-110 ${item.color}`}>
                      {React.cloneElement(item.icon as React.ReactElement, { size: window.innerWidth < 768 ? 18 : 20 } as any)}
                    </div>
                    <span className="font-black text-slate-800 text-xs md:text-base group-hover/item:text-orange-600 transition-colors">{item.label}</span>
                  </div>
                  <ChevronRight 
                    className={`w-4 h-4 md:w-5 md:h-5 text-slate-300 transition-all group-hover/item:text-orange-600 group-hover/item:translate-x-2 ${
                      language === 'ar' ? 'rotate-180 group-hover/item:-translate-x-2' : ''
                    }`} 
                  />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout Button */}
        <div className="pt-6 md:pt-10">
          <button
            onClick={onLogout}
            className="w-full relative overflow-hidden group py-4 md:py-6 bg-red-50 text-red-600 rounded-xl md:rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-[0.4em] active:scale-95 transition-all shadow-sm hover:bg-orange-600 hover:text-white"
          >
            <div className="flex items-center justify-center gap-3 md:gap-4 relative z-10">
              <LogOut size={window.innerWidth < 768 ? 18 : 20} className="group-hover:rotate-12 transition-transform" />
              {t('logout')}
            </div>
            <div className="absolute inset-0 bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          
          <div className="text-center mt-8 md:mt-12 space-y-1 md:space-y-2 pb-10">
            <p className="text-[8px] md:text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">Veetaa Digital SARL</p>
            <p className="text-[7px] md:text-[9px] text-slate-200 font-bold uppercase tracking-widest">Version 1.2.4 (Build 890)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
