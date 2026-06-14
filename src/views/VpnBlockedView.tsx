import React from 'react';
import { ShieldOff } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface VpnBlockedViewProps {
  language: Language;
}

const VpnBlockedView: React.FC<VpnBlockedViewProps> = ({ language }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const title = language === 'ar'
    ? 'غير مسموح باستخدام VPN أو الوكيل'
    : language === 'en'
      ? 'VPN or proxy is not allowed'
      : 'L\'utilisation d\'un VPN ou d\'un proxy n\'est pas autorisée';
  const message = language === 'ar'
    ? 'يرجى إيقاف تشغيل VPN أو الوكيل للوصول إلى التطبيق.'
    : language === 'en'
      ? 'Please disable VPN or proxy to access the app.'
      : 'Veuillez désactiver le VPN ou le proxy pour accéder à l\'application.';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-amber-50">
      <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mb-6">
        <ShieldOff className="w-12 h-12 text-amber-600" />
      </div>
      <h1 className="text-xl font-black text-slate-800 text-center mb-2">{title}</h1>
      <p className="text-sm text-slate-500 text-center max-w-sm">{message}</p>
    </div>
  );
};

export default VpnBlockedView;
