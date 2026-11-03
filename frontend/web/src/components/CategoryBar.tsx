import React from 'react';
import { 
  LayoutGrid, Palette, Dumbbell, Laptop, GraduationCap, 
  PawPrint, Mountain, Wrench, Users, MoreHorizontal, Map, X 
} from 'lucide-react';
import { TopCategoryId, ActivityKind } from '../types';

interface CategoryBarProps {
  selectedType: ActivityKind;
  onSelectType: (type: ActivityKind) => void;
  selectedCategories: string[]; // multi-select array of TopCategoryId
  onToggleCategory: (catId: TopCategoryId | 'all') => void;
  onClearCategories: () => void;
  onOpenMap: () => void;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  selectedType,
  onSelectType,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  onOpenMap,
}) => {
  const categories: {
    id: TopCategoryId | 'all';
    label: string;
    line1: string;
    line2?: string;
    icon: React.ElementType;
  }[] = [
    { id: 'all', label: 'Все', line1: 'Все', icon: LayoutGrid },
    { id: 'art', label: 'Творчество и искусство', line1: 'Творчество', line2: 'и искусство', icon: Palette },
    { id: 'sport', label: 'Спорт', line1: 'Спорт', icon: Dumbbell },
    { id: 'tech', label: 'Технологии и игры', line1: 'Технологии', line2: 'и игры', icon: Laptop },
    { id: 'education', label: 'Обучение', line1: 'Обучение', icon: GraduationCap },
    { id: 'animals', label: 'Животные и природа', line1: 'Животные', line2: 'и природа', icon: PawPrint },
    { id: 'travel', label: 'Путешествия и активный отдых', line1: 'Путешествия', line2: 'и активный отдых', icon: Mountain },
    { id: 'craft', label: 'Практика', line1: 'Практика', icon: Wrench },
    { id: 'social', label: 'Социальные', line1: 'Социальные', icon: Users },
    { id: 'other', label: 'Другое', line1: 'Другое', icon: MoreHorizontal },
  ];

  const isAllSelected = selectedCategories.length === 0 || selectedCategories.includes('all');

  return (
    <div className="bg-white border-y border-[#E5E4F2] px-4 sm:px-8 py-3.5 select-none">
      <div className="max-w-7xl mx-auto flex items-start justify-between gap-3 overflow-x-auto hide-scrollbar py-1">
        {/* Category Icons Row with multi-select support */}
        <div className="flex items-start gap-2.5 sm:gap-4 shrink-0">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = cat.id === 'all' 
              ? isAllSelected 
              : selectedCategories.includes(cat.id);

            return (
              <button
                key={cat.id}
                onClick={() => onToggleCategory(cat.id)}
                title={isSelected ? `${cat.label} (нажмите, чтобы убрать)` : `${cat.label} (нажмите, чтобы выбрать)`}
                className={`flex flex-col items-center gap-1.5 py-1 px-1 rounded-xl transition-all cursor-pointer group focus:outline-none shrink-0 ${
                  isSelected
                    ? 'text-[#6545C6]'
                    : 'text-[#5B5870] hover:text-[#1F1B3D]'
                }`}
                style={{ width: '84px' }}
              >
                {/* Square Icon tile */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#6545C6] text-white shadow-md shadow-[#6545C6]/30 ring-2 ring-[#6545C6]/20 scale-105'
                      : 'bg-[#F7F6FC] group-hover:bg-[#EEEAFB] text-[#5B5870] group-hover:text-[#6545C6]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Text Label */}
                <div className="w-full flex flex-col items-center justify-center text-center leading-tight">
                  <span
                    className={`text-[11px] font-semibold whitespace-nowrap truncate max-w-full ${
                      isSelected ? 'font-bold text-[#6545C6]' : 'text-[#5B5870] group-hover:text-[#1F1B3D]'
                    }`}
                  >
                    {cat.line1}
                  </span>
                  {cat.line2 ? (
                    <span
                      className={`text-[10px] whitespace-nowrap truncate max-w-full ${
                        isSelected ? 'font-semibold text-[#6545C6]' : 'text-[#858394]'
                      }`}
                    >
                      {cat.line2}
                    </span>
                  ) : (
                    <span className="text-[10px] invisible leading-none">&nbsp;</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 11th Tile: "На карте" Button */}
        <button
          onClick={onOpenMap}
          className="flex flex-col items-center gap-1.5 py-1 px-1 rounded-xl transition-all cursor-pointer group focus:outline-none shrink-0 text-[#6545C6]"
          style={{ width: '84px' }}
          title="Открыть интерактивную карту ПМР"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#EEEAFB] group-hover:bg-[#D9D0F5] text-[#6545C6] transition-colors shadow-xs">
            <Map className="w-5 h-5" />
          </div>
          <div className="w-full flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px] font-bold text-[#6545C6] whitespace-nowrap">
              На карте
            </span>
            <span className="text-[10px] invisible leading-none">&nbsp;</span>
          </div>
        </button>
      </div>

      {/* Multi-Category helper chips when one or more are selected */}
      {selectedCategories.length > 0 && !selectedCategories.includes('all') && (
        <div className="max-w-7xl mx-auto mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-[#F2EEFB]">
          <span className="text-xs text-[#858394] font-medium">Выбрано категорий ({selectedCategories.length}):</span>
          {selectedCategories.map((catId) => {
            const found = categories.find((c) => c.id === catId);
            if (!found) return null;
            return (
              <span
                key={catId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EEEAFB] text-[#6545C6] rounded-lg text-xs font-bold"
              >
                <span>{found.label}</span>
                <button
                  type="button"
                  onClick={() => onToggleCategory(catId as TopCategoryId)}
                  className="hover:text-red-500 cursor-pointer"
                  title="Удалить"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={onClearCategories}
            className="text-xs text-[#858394] hover:text-[#6545C6] underline font-semibold ml-1 cursor-pointer"
          >
            Сбросить все
          </button>
        </div>
      )}
    </div>
  );
};
