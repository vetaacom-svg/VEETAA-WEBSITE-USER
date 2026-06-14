
import React, { useState, useMemo } from 'react';
import { CategoryID, Store, Language, SubCategory } from '../types';
import { TRANSLATIONS } from '../constants';
import { Heart, Star } from 'lucide-react';
import SubCategoryFilterBar from '../components/SubCategoryFilterBar';
import {
  childSubCategories,
  storeMatchesSubCategoryFilter,
  subCategoryMatchNames,
} from '../lib/subCategoryTree';

interface CategoryDetailProps {
  language: Language;
  category: CategoryID;
  stores: Store[];
  categories: { id: CategoryID; name: string; icon?: any; color?: string }[];
  favorites: string[];
  subCategories: SubCategory[];
  onToggleFavorite: (id: string) => void;
  onSelectStore: (store: Store) => void;
}

const CategoryDetail: React.FC<CategoryDetailProps> = ({ language, category, stores, categories, subCategories, favorites, onToggleFavorite, onSelectStore }) => {
  const [selectedParentSubId, setSelectedParentSubId] = useState<string | null>(null);
  const [selectedChildSubId, setSelectedChildSubId] = useState<string | null>(null);
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const normalizedCategory = String(category).toLowerCase().trim();

  const filteredStoresByCategory = stores.filter((s) => String(s.category).toLowerCase().trim() === normalizedCategory);
  const categoryInfo = categories.find((c) => String(c.id).toLowerCase().trim() === normalizedCategory);

  const filteredStores = useMemo(() => {
    if (!selectedParentSubId && !selectedChildSubId) return filteredStoresByCategory;

    if (selectedChildSubId) {
      const child = subCategories.find((sc) => sc.id === selectedChildSubId);
      if (!child) return filteredStoresByCategory;
      const names = subCategoryMatchNames(subCategories, normalizedCategory, {
        id: child.id,
        name: child.name,
        isChild: true,
      });
      return filteredStoresByCategory.filter((s) => storeMatchesSubCategoryFilter(s.sub_category, names));
    }

    const parent = subCategories.find((sc) => sc.id === selectedParentSubId);
    if (!parent) return filteredStoresByCategory;
    const kids = childSubCategories(subCategories, normalizedCategory, parent.id);
    const names = subCategoryMatchNames(subCategories, normalizedCategory, {
      id: parent.id,
      name: parent.name,
      isChild: false,
    });
    if (kids.length === 0) {
      return filteredStoresByCategory.filter((s) => storeMatchesSubCategoryFilter(s.sub_category, names));
    }
    return filteredStoresByCategory.filter((s) => storeMatchesSubCategoryFilter(s.sub_category, names));
  }, [filteredStoresByCategory, selectedParentSubId, selectedChildSubId, subCategories, normalizedCategory]);

  const isDirectOrder = [CategoryID.EXPRESS, CategoryID.BOULANGERIE, CategoryID.PRESSING, CategoryID.MARKET]
    .includes(normalizedCategory as CategoryID);

  if (isDirectOrder && filteredStoresByCategory.length === 0) {
    const systemStore: Store = {
      id: `sys-${normalizedCategory}`,
      name: `${t(normalizedCategory)} ${t('expressService')}`,
      category: normalizedCategory as CategoryID,
      type: 'text-only',
      image: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?auto=format&fit=crop&q=80&w=400',
    };
    return (
      <div className="p-10 pt-12 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in slide-in-from-bottom duration-500">
        <div className="w-32 h-32 flex items-center justify-center">
          {categoryInfo?.icon && (typeof categoryInfo.icon === 'string' ? <img src={categoryInfo.icon} alt={categoryInfo.name} className="w-full h-full object-contain" /> : categoryInfo.icon)}
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{categoryInfo?.name || t(normalizedCategory)} {t('expressService')}</h2>
          <p className="text-slate-500 max-w-[280px] mx-auto text-sm font-bold">{t('ourCouriersHandleEverything')}</p>
        </div>
        <button
          onClick={() => onSelectStore(systemStore)}
          className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-slate-200 active:scale-95 transition-all"
        >
          {t('orderNow')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 pt-2">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 flex items-center justify-center">
          {categoryInfo?.icon && (typeof categoryInfo.icon === 'string' ? <img src={categoryInfo.icon} alt={categoryInfo.name} className="w-full h-full object-contain" /> : categoryInfo.icon)}
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{categoryInfo?.name || t(normalizedCategory)}</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredStoresByCategory.length} {t('establishments')}</p>
        </div>
      </div>

      <SubCategoryFilterBar
        language={language}
        categoryId={normalizedCategory}
        subCategories={subCategories}
        selectedParentId={selectedParentSubId}
        selectedChildId={selectedChildSubId}
        onSelectParent={setSelectedParentSubId}
        onSelectChild={setSelectedChildSubId}
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3 px-2">
        {filteredStores.map(store => (
          <div
            key={store.id}
            onClick={() => onSelectStore(store)}
            className="flex flex-col h-full bg-white rounded-2xl border border-slate-50 shadow-sm relative overflow-hidden group active:scale-[0.98] transition-all cursor-pointer"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(store.id); }}
              className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-md rounded-full z-10 shadow-sm"
            >
              <Heart className={`w-4 h-4 ${favorites.includes(store.id) ? 'text-red-500 fill-red-500' : 'text-slate-300'}`} />
            </button>
            <div className="relative aspect-square w-full overflow-hidden shrink-0">
              <img
                src={store.image}
                loading="lazy"
                className="w-full h-full object-cover"
                alt={store.name}
              />
            </div>
            <div className="p-2 space-y-1.5 flex flex-col flex-1 min-h-[60px]">
              <div className="flex justify-between items-start gap-1">
                <h3 className="font-bold text-xs text-slate-900 line-clamp-2 leading-tight flex-1 min-w-0">{store.name}</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                  <span className="text-[9px] font-black text-amber-700">4.8</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-500">25-40 min</span>
              </div>
              <div className="flex gap-1 pt-1 overflow-hidden">
                <span className="text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 shrink-0">{t('open')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default CategoryDetail;
