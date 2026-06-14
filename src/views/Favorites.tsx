
import React from 'react';
import { TRANSLATIONS } from '../constants';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { Language, Store } from '../types';

interface FavoritesProps {
  stores: Store[];
  favorites: string[];
  language: Language;
  onToggleFavorite: (id: string) => void;
  onSelectStore: (store: Store) => void;
}

const Favorites: React.FC<FavoritesProps> = ({ stores, favorites, language, onToggleFavorite, onSelectStore }) => {
  const favoriteStores = stores.filter(s => favorites.includes(s.id));
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight px-2 flex items-center gap-2.5">
        <span className="text-2xl">❤️</span>
        {t('favorites')}
      </h2>

      {favoriteStores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-red-50 rounded-full flex items-center justify-center shadow-lg">
            <Heart className="w-12 h-12 text-red-300 animate-pulse" />
          </div>
          <div className="space-y-1">
            <p className="text-slate-600 font-bold text-lg">{t('noFavorites')}</p>
            <p className="text-slate-400 text-sm">{language === 'ar' ? 'ابدأ بإضافة المتاجر المفضلة لديك' : 'Commencez à ajouter vos magasins préférés'}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 px-2">
          {favoriteStores.map(store => (
            <div
              key={store.id}
              className="relative bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex flex-col"
            >
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(store.id); }}
                className="absolute top-4 right-4 z-20 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-all active:scale-90"
              >
                <Heart className="w-6 h-6 text-red-500 fill-red-500 animate-pulse" />
              </button>
              <div onClick={() => onSelectStore(store)} className="cursor-pointer relative w-full aspect-[4/3] shrink-0 overflow-hidden">
                <img src={store.image} loading="lazy" className="w-full h-full object-cover" alt={store.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>
              <div className="p-2 flex justify-between items-start gap-2 min-h-[60px]">
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-xs line-clamp-2 leading-tight">{store.name}</h4>
                  <p className="text-[10px] text-slate-400 capitalize font-bold mt-1">{t(store.category)}</p>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-xl flex-shrink-0">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-[11px] font-black text-amber-700">{store.rating?.toFixed(1) || '4.8'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
