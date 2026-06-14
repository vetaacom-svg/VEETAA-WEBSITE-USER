import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface BlockedViewProps {
  language: Language;
  onLogout: () => void;
}

const BlockedView: React.FC<BlockedViewProps> = ({ language, onLogout }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const title = language === 'ar'
    ? 'تم حظر حسابك'
    : language === 'en'
      ? 'Your account has been blocked'
      : 'Votre compte a été bloqué';
  const message = language === 'ar'
    ? 'يرجى الاتصال بالدعم إذا كنت تعتقد أن هذا خطأ.'
    : language === 'en'
      ? 'Please contact support if you believe this is an error.'
      : 'Veuillez contacter le support si vous pensez qu\'il s\'agit d\'une erreur.';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-red-50">
      <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-6">
        <ShieldAlert className="w-12 h-12 text-red-600" />
      </div>
      <h1 className="text-xl font-black text-slate-800 text-center mb-2">{title}</h1>
      <p className="text-sm text-slate-500 text-center mb-8 max-w-sm">{message}</p>
      <button
        onClick={onLogout}
        className="bg-slate-900 text-white py-4 px-8 rounded-2xl font-black active:scale-95"
      >
        {language === 'ar' ? 'تسجيل الخروج' : language === 'en' ? 'Sign out' : 'Se déconnecter'}
      </button>
    </div>
  );
};

export default BlockedView;
