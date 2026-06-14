import React, { useState } from 'react';
import { Order, Language } from '../types';
import { Check, MapPin, Home as HomeIcon, Star, AlertCircle, ArrowRight } from 'lucide-react';
import { TRANSLATIONS } from '../constants';

interface ConfirmationProps {
  language: Language;
  order: Order;
  onHome: () => void;
  onTrack: () => void;
  onRate?: (id: string, deliveryRating: number) => void;
}

const Confirmation: React.FC<ConfirmationProps> = ({ language, order, onHome, onTrack, onRate }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [deliveryRating, setDeliveryRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState(false);

  const handleRatingSubmit = () => {
    if (deliveryRating > 0 && onRate) {
      onRate(order.id, deliveryRating);
      setHasRated(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-900 relative overflow-hidden font-sans">
      {/* Background ambient effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[600px] bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative z-10 flex flex-col items-center text-center space-y-8 sm:space-y-10 border border-slate-100">
        
        {/* Header Success Section */}
        <div className="space-y-6 flex flex-col items-center w-full">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-[1.5rem] sm:rounded-[2rem] rotate-12 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 relative transform hover:rotate-0 transition-transform duration-500 cursor-default">
            <div className="absolute inset-0 bg-white/30 blur-md rounded-[1.5rem] sm:rounded-[2rem] animate-pulse"></div>
            <Check strokeWidth={3.5} className="w-10 h-10 sm:w-12 sm:h-12 -rotate-12 relative z-10" />
          </div>
          
          <div className="space-y-3 px-2">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
              {t('orderConfirmed')} <span className="inline-block animate-bounce" style={{ animationDuration: '2s' }}>🚀</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm sm:text-base max-w-[280px] sm:max-w-xs mx-auto">
              {t('orderConfirmedMsg')} <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-lg font-black ml-1 shadow-sm">#{order.id}</span>
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4 text-left transition-all hover:bg-amber-500/20">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
             <h4 className="text-[10px] sm:text-xs font-black text-amber-900 uppercase tracking-widest opacity-80">Validation en cours</h4>
             <p className="text-xs sm:text-sm text-amber-800 font-bold leading-relaxed">{t('adminValidationMessage')}</p>
          </div>
        </div>

        {/* Tracking Button */}
        <div className="w-full">
          <button
            onClick={onTrack}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-1 active:translate-y-0 transition-all group overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <MapPin className="w-5 h-5 relative z-10 group-hover:animate-bounce" style={{ animationDuration: '1s' }} />
            <span className="relative z-10">{t('trackMyDelivery')}</span>
            <ArrowRight className="w-4 h-4 relative z-10 opacity-50 ml-1 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-slate-100"></div>

        {/* Delivery Rating Section */}
        <div className="w-full space-y-4">
          {!hasRated ? (
            <div className="space-y-5">
              <h3 className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">{t('deliveryRatingPrompt')}</h3>
              
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setDeliveryRating(star)}
                    className="transition-all active:scale-90 p-1 hover:scale-110"
                  >
                    <Star
                      className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors duration-300 ${star <= deliveryRating
                        ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_2px_8px_rgba(250,204,21,0.5)]'
                        : 'text-slate-200 fill-transparent hover:text-slate-300'
                        }`}
                    />
                  </button>
                ))}
              </div>

              {deliveryRating > 0 && (
                <button
                  onClick={handleRatingSubmit}
                  className="w-full bg-slate-900 border border-slate-700 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest active:scale-[0.98] hover:bg-slate-800 transition-all shadow-lg"
                >
                  {t('submitRating')}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 border border-emerald-100 animate-in fade-in zoom-in duration-500">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-emerald-700 font-black text-sm uppercase tracking-wide">{t('thankYouRating')}</p>
                <p className="text-emerald-600/80 text-xs font-medium mt-1">{t('ratingSaved')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Return to Home */}
        <button
          onClick={onHome}
          className="w-full text-slate-400 hover:text-slate-900 py-3 font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all outline-none group"
        >
          <HomeIcon className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
          {t('backHome')}
        </button>

      </div>
    </div>
  );
};

export default Confirmation;
