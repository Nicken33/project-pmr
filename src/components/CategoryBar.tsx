import React from 'react';
import { 
  LayoutGrid, Palette, Dumbbell, Laptop, GraduationCap, 
  PawPrint, Mountain, Wrench, Users, Heart, Map 
} from 'lucide-react';
import { TopCategoryId, ActivityKind } from '../types';

interface CategoryBarProps {
  selectedType: ActivityKind;
  onSelectType: (type: ActivityKind) => void;
  selectedCategory: TopCategoryId | 'all';
  onSelectCategory: (cat: TopCategoryId | 'all') => void;
  onOpenMap: () => void;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  selectedType,
  onSelectType,
  selectedCategory,
  onSelectCategory,
  onOpenMap,
}) => {
  const categories = [
    { id: 'all', label: 'Все', icon: LayoutGrid },
    { id: 'art', label: 'Творчество и искусство', icon: Palette },
    { id: 'sport', label: 'Спорт', icon: Dumbbell },
    { id: 'tech', label: 'Технологии и игры', icon: Laptop },
    { id: 'education', label: 'Обучение', icon: GraduationCap },
    { id: 'animals', label: 'Животные и природа', icon: PawPrint },
    { id: 'travel', label: 'Путешествия и активный отдых', icon: Mountain },
    { id: 'craft', label: 'Практика', icon: Wrench },
    { id: 'social', label: 'Социальные', icon: Users },
    { id: 'other', label: 'Другое', icon: Heart },
  ];

  return (
    <div className="bg-white border-y border-[#E5E4F2] px-4 sm:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Type Toggle: Занятия / Услуги */}
        <div className="flex items-center p-1 bg-[#EEEAFB] rounded-xl shrink-0">
          <button
            onClick={() => onSelectType('activity')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedType === 'activity'
                ? 'bg-[#6545C6] text-white shadow-sm'
                : 'text-[#5B5870] hover:text-[#1F1B3D]'
            }`}
          >
            Занятия
          </button>
          <button
            onClick={() => onSelectType('service')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedType === 'service'
                ? 'bg-[#6545C6] text-white shadow-sm'
                : 'text-[#5B5870] hover:text-[#1F1B3D]'
            }`}
          >
            Услуги
          </button>
        </div>

        {/* Scrollable Category Icons List */}
        <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar py-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id as TopCategoryId | 'all')}
                className={`flex flex-col items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 group ${
                  isSelected
                    ? 'text-[#6545C6]'
                    : 'text-[#858394] hover:text-[#1F1B3D]'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#6545C6] text-white shadow-md shadow-[#6545C6]/20'
                      : 'bg-[#F7F6FC] group-hover:bg-[#EEEAFB] text-[#5B5870]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold tracking-tight">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* "На карте" Button */}
        <button
          onClick={onOpenMap}
          className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
        >
          <Map className="w-4 h-4" />
          <span>На карте</span>
        </button>
      </div>
    </div>
  );
};
