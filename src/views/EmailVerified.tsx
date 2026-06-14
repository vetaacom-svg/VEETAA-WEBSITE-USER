
import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface EmailVerifiedProps {
  language: Language;
  onContinue: () => void;
}

const EmailVerified: React.FC<EmailVerifiedProps> = ({ language, onContinue }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-50 to-white">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-emerald-500 w-32 h-32 rounded-full flex items-center justify-center shadow-2xl">
              <CheckCircle2 className="w-20 h-20 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">
            {t('emailVerified') || 'Email vérifié !'}
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            {t('emailVerifiedMessage') || 'Votre adresse email a été vérifiée avec succès. Vous pouvez maintenant vous connecter.'}
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={onContinue}
          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-emerald-200 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          {t('continueToLogin') || 'Continuer vers la connexion'}
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Additional info */}
        <div className="text-center pt-4">
          <p className="text-sm text-slate-500">
            {t('accountReady') || 'Votre compte est maintenant prêt à être utilisé'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerified;
