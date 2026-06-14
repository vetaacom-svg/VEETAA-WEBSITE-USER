import React, { useState, useMemo, useEffect } from 'react';
import { Store, Language, SubCategory } from '../types';
import { TRANSLATIONS } from '../constants';
import { Search, X, Star, LayoutGrid, Grid3X3 } from 'lucide-react';
import { sanitizeSearchInput } from '../lib/security';
import SubCategoryFilterBar from '../components/SubCategoryFilterBar';
import { storeMatchesSubCategoryFilter, subCategoryMatchNames } from '../lib/subCategoryTree';

interface AllStoresProps {
  stores: Store[];
  language: Language;
  categories?: { id: string; name: string }[];
  subCategories: SubCategory[];
  onSelectStore: (store: Store) => void;
}

const STORE_IMAGE_FALLBACK = '/store-placeholder.svg';
const withStoreFallback = (src?: string | null) => (src && src.trim() ? src : STORE_IMAGE_FALLBACK);
const onStoreImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src.includes(STORE_IMAGE_FALLBACK)) return;
  img.onerror = null;
  img.src = STORE_IMAGE_FALLBACK;
};

const AllStores: React.FC<AllStoresProps> = ({ stores, language, categories = [], subCategories, onSelectStore }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedParentSubId, setSelectedParentSubId] = useState<string | null>(null);
  const [selectedChildSubId, setSelectedChildSubId] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState(2);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || t(categoryId);
  };

  const filteredStores = useMemo(() => {
    return stores.filter(store => {
      const matchesSearch = store.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        store.category.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (store.sub_category && store.sub_category.toLowerCase().includes(debouncedSearch.toLowerCase()));
      const matchesCategory = !selectedCategory || store.category === selectedCategory;
      let matchesSubCategory = true;
      if (selectedCategory && (selectedParentSubId || selectedChildSubId)) {
        const normCat = String(selectedCategory).toLowerCase().trim();
        if (selectedChildSubId) {
          const child = subCategories.find((sc) => sc.id === selectedChildSubId);
          if (child) {
            const names = subCategoryMatchNames(subCategories, normCat, {
              id: child.id,
              name: child.name,
              isChild: true,
            });
            matchesSubCategory = storeMatchesSubCategoryFilter(store.sub_category, names);
          }
        } else if (selectedParentSubId) {
          const parent = subCategories.find((sc) => sc.id === selectedParentSubId);
          if (parent) {
            const names = subCategoryMatchNames(subCategories, normCat, {
              id: parent.id,
              name: parent.name,
              isChild: false,
            });
            matchesSubCategory = storeMatchesSubCategoryFilter(store.sub_category, names);
          }
        }
      }
      return matchesSearch && matchesCategory && matchesSubCategory;
    });
  }, [stores, debouncedSearch, selectedCategory, selectedParentSubId, selectedChildSubId, subCategories]);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      <div className="px-2 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            {t('allStores')}
          </h2>
          {/* Grid Selector */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-2 shadow-inner">
            <button 
              onClick={() => setGridCols(2)} 
              className={`p-2 rounded-xl transition-all ${gridCols === 2 ? 'bg-white text-orange-600 shadow-md' : 'text-slate-400'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setGridCols(3)} 
              className={`p-2 rounded-xl transition-all ${gridCols === 3 ? 'bg-white text-orange-600 shadow-md' : 'text-slate-400'}`}
            >
              <Grid3X3 size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(sanitizeSearchInput(e.target.value))}
            placeholder={t('searchPlaceholder')}
            className={`w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 ${language === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 outline-none transition-all shadow-sm`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1.5 bg-slate-200/50 hover:bg-slate-200 rounded-full transition-colors`}
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-2 px-2">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedParentSubId(null);
              setSelectedChildSubId(null);
            }}
            className={`flex-shrink-0 px-4 py-2 rounded-xl font-black text-xs transition-all ${!selectedCategory
              ? 'bg-orange-600 text-white shadow-md shadow-orange-100'
              : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}
          >
            {language === 'fr' ? 'Tous' : language === 'en' ? 'All' : 'الكل'}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedParentSubId(null);
                setSelectedChildSubId(null);
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-black text-xs transition-all ${selectedCategory === cat.id
                ? 'bg-orange-600 text-white shadow-md shadow-orange-100'
                : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {selectedCategory && (
          <SubCategoryFilterBar
            language={language}
            categoryId={selectedCategory}
            subCategories={subCategories}
            selectedParentId={selectedParentSubId}
            selectedChildId={selectedChildSubId}
            onSelectParent={setSelectedParentSubId}
            onSelectChild={setSelectedChildSubId}
            compact
          />
        )}
      </div>

      <div className={`grid ${gridCols === 2 ? 'grid-cols-2' : 'grid-cols-3'} sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 px-2 transition-all duration-300`}>
        {filteredStores.length > 0 ? (
          filteredStores.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              categoryName={getCategoryName(store.category)}
              onSelectStore={onSelectStore}
            />
          ))
        ) : (
          <div className="col-span-3 py-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-slate-400 font-bold text-sm">{t('noResults')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const StoreCard = React.memo<{ store: Store; categoryName: string; onSelectStore: (s: Store) => void }>(
  ({ store, categoryName, onSelectStore }) => (
    <div
      onClick={() => onSelectStore(store)}
      className="group bg-white rounded-[2rem] border border-slate-50 overflow-hidden shadow-sm hover:shadow-2xl transition-all active:scale-[0.97] cursor-pointer flex flex-col h-full relative"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden shrink-0">
        <img
          src={withStoreFallback(store.image)}
          onError={onStoreImageError}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
          alt={store.name}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        
        {/* Category Pill Overlay */}
        <div className="absolute top-3 left-3 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/20 shadow-sm">
           <span className="text-[8px] font-black text-white uppercase tracking-widest">{categoryName}</span>
        </div>

        {/* Rating Overlay */}
        <div className="absolute bottom-3 right-3 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg flex items-center gap-1 shadow-sm">
           <Star size={10} className="text-amber-500 fill-amber-500" />
           <span className="text-[10px] font-black text-slate-800">{store.rating || '4.5'}</span>
        </div>

        {/* Status indicator */}
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.8)] bg-emerald-500 border border-white" />
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h4 className="font-black text-slate-900 text-sm line-clamp-1 group-hover:text-orange-600 transition-colors uppercase tracking-tight">{store.name}</h4>
        {store.sub_category && (
          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest truncate">{store.sub_category}</p>
        )}
      </div>
    </div>
  )
);

export default AllStores;
