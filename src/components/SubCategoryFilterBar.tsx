import React from 'react';
import type { Language } from '../types';
import {
  childSubCategories,
  flatSubCategoriesForCategory,
  type SubCategoryRow,
} from '../lib/subCategoryTree';

interface SubCategoryFilterBarProps {
  language: Language;
  categoryId: string;
  subCategories: SubCategoryRow[];
  selectedParentId: string | null;
  selectedChildId: string | null;
  onSelectParent: (id: string | null) => void;
  onSelectChild: (id: string | null) => void;
  compact?: boolean;
}

const allLabel = (language: Language) =>
  language === 'fr' ? 'Tout' : language === 'en' ? 'All' : 'الكل';

const SubCategoryFilterBar: React.FC<SubCategoryFilterBarProps> = ({
  language,
  categoryId,
  subCategories,
  selectedParentId,
  selectedChildId,
  onSelectParent,
  onSelectChild,
  compact = false,
}) => {
  const levelOne = flatSubCategoriesForCategory(subCategories, categoryId);
  const levelTwo = selectedParentId
    ? childSubCategories(subCategories, categoryId, selectedParentId)
    : [];

  const chipClass = (active: boolean) =>
    compact
      ? `flex-shrink-0 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
          active
            ? 'bg-orange-600 text-white shadow-md'
            : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
        }`
      : `flex-shrink-0 px-5 py-2.5 rounded-2xl font-black text-xs transition-all ${
          active
            ? 'bg-orange-600 text-white shadow-md shadow-orange-100'
            : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
        }`;

  if (levelOne.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className={`flex gap-2 overflow-x-auto pb-1 no-scrollbar ${compact ? '' : '-mx-4 px-4'}`}>
        <button type="button" onClick={() => { onSelectParent(null); onSelectChild(null); }} className={chipClass(!selectedParentId)}>
          {allLabel(language)}
        </button>
        {levelOne.map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => {
              if (selectedParentId === sub.id) {
                onSelectParent(null);
                onSelectChild(null);
              } else {
                onSelectParent(sub.id);
                onSelectChild(null);
              }
            }}
            className={chipClass(selectedParentId === sub.id && !selectedChildId)}
          >
            {sub.name}
          </button>
        ))}
      </div>

      {levelTwo.length > 0 && (
        <div className={`flex gap-2 overflow-x-auto pb-2 no-scrollbar pl-1 ${compact ? '' : '-mx-4 px-4'}`}>
          <span className="flex-shrink-0 self-center text-[10px] font-black uppercase text-slate-400 tracking-widest pr-1">
            {language === 'en' ? 'Type' : language === 'ar' ? 'نوع' : 'Type'}
          </span>
          <button
            type="button"
            onClick={() => onSelectChild(null)}
            className={chipClass(!selectedChildId)}
          >
            {language === 'en' ? 'All types' : language === 'ar' ? 'الكل' : 'Tous types'}
          </button>
          {levelTwo.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => onSelectChild(child.id)}
              className={chipClass(selectedChildId === child.id)}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubCategoryFilterBar;
