import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, ChevronRight, HelpCircle, AlertTriangle, MessageCircleQuestion, Ticket } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { getSupportInfo, SupportInfo } from '../lib/ribService';

interface HelpProps {
  language: Language;
  onBack: () => void;
}

const Help: React.FC<HelpProps> = ({ language, onBack }) => {
  const navigate = useNavigate();
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [supportInfo, setSupportInfo] = useState<SupportInfo | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    getSupportInfo()
      .then(setSupportInfo)
      .catch(() => setSupportInfo(null));
  }, []);

  const faqs = language === 'ar' ? [
    'أين طلبي؟',
    'وصل الطلب باردًا',
    'لديّ مشكلة في الدفع',
    'تعديل عنوان التوصيل'
  ] : language === 'en' ? [
    'Where is my order?',
    'The order arrived cold',
    'I have a payment problem',
    'Change my delivery address'
  ] : [
    'Où est ma commande ?',
    'La commande est arrivée froide',
    "J'ai un problème de paiement",
    'Modifier mon adresse de livraison'
  ];

  const faqAnswerKeys = [
    'faqOrderWhereAnswer',
    'faqOrderColdAnswer',
    'faqPaymentProblemAnswer',
    'faqChangeAddressAnswer',
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50/50 py-4 md:py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        
        {/* Header Options */}
        <div className="flex items-center gap-3 md:gap-4 bg-white/60 backdrop-blur-md p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200/60 shadow-sm">
          <button 
            onClick={onBack} 
            className="p-2 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-slate-800 hover:scale-105 active:scale-95 transition-all outline-none"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 md:gap-3">
             <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg md:rounded-xl flex items-center justify-center shadow-md">
                <HelpCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
             </div>
             <h2 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight">{t('helpSupport')}</h2>
          </div>
        </div>

        {/* Emergency Banner */}
        <div className="relative w-full bg-slate-900 text-white p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden group">
          {/* Ambient Glow */}
          <div className="absolute -top-16 -right-16 w-48 h-48 md:w-64 md:h-64 bg-orange-500/20 blur-[40px] md:blur-[60px] rounded-full pointer-events-none transition-all group-hover:bg-orange-500/30" />
          
          <div className="relative z-10 space-y-4 md:space-y-8">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 md:space-y-2">
                <div className="flex items-center gap-2 md:gap-3 mb-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                  </span>
                  <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{t('emergency')}</h3>
                </div>
                <p className="text-lg md:text-2xl font-bold leading-tight max-w-[240px] md:max-w-[280px]">
                  {t('agentsAvailable')}
                </p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/5 shrink-0">
                <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-orange-400" />
              </div>
            </div>

            {supportInfo && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <a 
                  href={`tel:${supportInfo.phone}`}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 md:gap-3 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 active:scale-95 transition-all border border-orange-400/30"
                >
                  <Phone className="w-4 h-4 md:w-5 md:h-5" />
                  {t('callLabel')}
                </a>
                <a
                  href={`mailto:${supportInfo.email}`}
                  className="w-full bg-white/10 backdrop-blur-md text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 md:gap-3 shadow-lg hover:bg-white/15 active:scale-95 transition-all border border-white/10 hover:border-white/20"
                >
                  <Mail className="w-4 h-4 md:w-5 md:h-5" />
                  {t('mailUs')}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Tickets / Claims Section */}
        <button
          onClick={() => navigate('/tickets')}
          className="w-full bg-white border border-slate-200 p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm hover:shadow-lg hover:border-slate-300 transition-all flex items-center justify-between group active:scale-[0.98]"
        >
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 text-indigo-500 rounded-xl md:rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Ticket className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="text-left space-y-0.5">
              <h3 className="text-sm md:text-base font-black text-slate-800">Mes Réclamations</h3>
              <p className="text-[10px] md:text-xs font-semibold text-slate-500">Suivre mes tickets de support</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-300 group-hover:text-slate-800 transition-colors" />
        </button>

        {/* FAQ Section */}
        <div className="space-y-4 md:space-y-6">
          <div className="flex items-center gap-2 md:gap-3 px-2">
             <MessageCircleQuestion className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
             <h4 className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">{t('commonQuestions')}</h4>
          </div>
          
          <div className="space-y-2 md:space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaqIndex === i;
              return (
                <div key={i} className="w-full group">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex((prev) => (prev === i ? null : i))}
                    className={`w-full flex items-center justify-between p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all duration-300 ${
                      isOpen 
                        ? 'bg-white border-orange-200 shadow-md shadow-orange-500/5' 
                        : 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300'
                    }`}
                    aria-expanded={isOpen}
                  >
                    <span className={`text-xs md:text-base font-bold transition-colors ${isOpen ? 'text-orange-600' : 'text-slate-700'}`}>
                      {faq}
                    </span>
                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-400'}`}>
                      <ChevronRight
                        className={`w-3 h-3 md:w-4 md:h-4 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''} ${language === 'ar' && !isOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>
                  
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
                  >
                    <div className="p-4 md:p-5 bg-orange-50/50 backdrop-blur-sm rounded-xl md:rounded-2xl border border-orange-100 text-left">
                      <p className="text-xs md:text-sm font-semibold text-slate-700 leading-relaxed">{t(faqAnswerKeys[i])}</p>
                      {supportInfo && (
                        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-orange-200/50 flex flex-wrap gap-3 items-center justify-between">
                          <p className="text-[9px] md:text-[10px] font-black text-orange-600/60 uppercase tracking-widest">
                            Besoin d'aide ?
                          </p>
                          <a href={`tel:${supportInfo.phone}`} className="inline-flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-white border border-orange-200 rounded-lg text-[10px] md:text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors">
                            <Phone className="w-3 h-3" />
                            {supportInfo.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
