import React from 'react';
import { MapPinOff, ArrowRight, MessageCircle } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface OutOfZoneViewProps {
  language: Language;
  onContactSupport: () => void;
  currentCity?: string | null;
}

const OutOfZoneView: React.FC<OutOfZoneViewProps> = ({ language, onContactSupport, currentCity }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const content = {
    fr: {
      title: 'Bientôt chez vous ! 🚀',
      subtitle: `Nous avons détecté que vous êtes à ${currentCity || 'votre position actuelle'}.`,
      message: 'Pour le moment, Veetaa livre exclusivement sur Kenitra pour garantir une rapidité exceptionnelle. Nous arrivons très bientôt dans votre ville !',
      btnSupport: 'Contacter le support',
      footer: 'Vous êtes bien à Kenitra ? Actualisez votre position.',
    },
    en: {
      title: 'Coming Soon! 🚀',
      subtitle: `We detected you're in ${currentCity || 'your current location'}.`,
      message: 'Currently, Veetaa delivers exclusively in Kenitra to ensure exceptional speed. We are coming to your city very soon!',
      btnSupport: 'Contact Support',
      footer: 'Are you in Kenitra? Refresh your location.',
    },
    ar: {
      title: 'قادمون قريبا! 🚀',
      subtitle: `لقد اكتشفنا أنك في ${currentCity || 'موقعك الحالي'}.`,
      message: 'حاليا ، تقوم Veetaa بالتوصيل حصريا في القنيطرة لضمان سرعة استثنائية. سنصل إلى مدينتك قريبا جدا!',
      btnSupport: 'اتصل بالدعم',
      footer: 'هل أنت في القنيطرة؟ قم بتحديث موقعك.',
    }
  };

  const active = content[language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'fr'];

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-white overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-orange-50/50 to-transparent -z-10" />
      
      <div className="relative mb-8">
        <div className="w-32 h-32 bg-orange-100 rounded-[2.5rem] flex items-center justify-center animate-bounce-slow">
          <MapPinOff size={56} className="text-orange-600" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-50">
          <span className="text-2xl">📍</span>
        </div>
      </div>

      <div className="text-center space-y-4 max-w-sm">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
          {active.title}
        </h1>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100 mb-2">
           <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
           <span className="text-xs font-bold text-slate-600">{active.subtitle}</span>
        </div>
        <p className="text-slate-500 font-medium leading-relaxed">
          {active.message}
        </p>
      </div>

      <div className="mt-12 w-full max-w-xs space-y-3">
        <button
          onClick={onContactSupport}
          className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-sm shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <MessageCircle size={20} />
          {active.btnSupport}
        </button>
        
        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-white text-slate-700 py-4 rounded-[2rem] font-bold text-xs border border-slate-100 flex items-center justify-center gap-2 active:bg-slate-50 transition-colors"
        >
          {active.footer}
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Decorative elements */}
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-orange-50 rounded-full blur-3xl opacity-60" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60" />
    </div>
  );
};

export default OutOfZoneView;
