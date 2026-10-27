import React from 'react';
import { RotateCcw, ShieldCheck, Clock } from 'lucide-react';
import { DISTRICTS_TIRASPOL, TOP_CATEGORIES } from '../data/mockData';
import { TopCategoryId, ActivityKind, FormatType } from '../types';

interface FiltersSidebarProps {
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
  selectedAge: number | null;
  onAgeChange: (age: number | null) => void;
  selectedKind: ActivityKind;
  onKindChange: (kind: ActivityKind) => void;
  selectedTopCategories: TopCategoryId[];
  onToggleCategory: (cat: TopCategoryId) => void;
  isFreeOnly: boolean;
  onToggleFreeOnly: (val: boolean) => void;
  isVerifiedOnly: boolean;
  onToggleVerifiedOnly: (val: boolean) => void;
  maxPrice: number;
  onMaxPriceChange: (val: number) => void;
  selectedFormat: FormatType | 'all';
  onFormatChange: (format: FormatType | 'all') => void;
  timeOfDay: 'all' | 'morning' | 'afternoon' | 'evening';
  onTimeOfDayChange: (time: 'all' | 'morning' | 'afternoon' | 'evening') => void;
  totalFilteredCount: number;
  onResetFilters: () => void;
}

export const FiltersSidebar: React.FC<FiltersSidebarProps> = ({
  selectedDistrict,
  onDistrictChange,
  selectedAge,
  onAgeChange,
  selectedKind,
  onKindChange,
  selectedTopCategories,
  onToggleCategory,
  isFreeOnly,
  onToggleFreeOnly,
  isVerifiedOnly,
  onToggleVerifiedOnly,
  maxPrice,
  onMaxPriceChange,
  selectedFormat,
  onFormatChange,
  timeOfDay,
  onTimeOfDayChange,
  totalFilteredCount,
  onResetFilters,
}) => {
  const ageOptions = [5, 7, 8, 10, 12, 14, 16];

  return (
    <aside className="w-full bg-white rounded-2xl p-5 border border-[#E5E4F2] shadow-sm flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E4F2]">
        <h3 className="font-extrabold text-base text-[#1F1B3D]">Фильтры</h3>
        <button
          onClick={onResetFilters}
          className="text-xs font-semibold text-[#858394] hover:text-[#6545C6] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Сбросить всё</span>
        </button>
      </div>

      {/* Type: Занятия / Услуги (§3.1 п.3) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#1F1B3D]">Тип объекта</label>
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F7F6FC] rounded-xl border border-[#E5E4F2]">
          <button
            onClick={() => onKindChange('activity')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedKind === 'activity'
                ? 'bg-[#6545C6] text-white shadow-sm'
                : 'text-[#5B5870] hover:text-[#1F1B3D]'
            }`}
          >
            Занятия
          </button>
          <button
            onClick={() => onKindChange('service')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedKind === 'service'
                ? 'bg-[#6545C6] text-white shadow-sm'
                : 'text-[#5B5870] hover:text-[#1F1B3D]'
            }`}
          >
            Услуги
          </button>
        </div>
      </div>

      {/* Age Section (§5.2: возраст ребёнка одно число) */}
      {selectedKind === 'activity' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#1F1B3D]">Возраст ребёнка (лет)</label>
            <span className="text-xs text-[#6545C6] font-semibold">
              {selectedAge !== null ? `${selectedAge} лет` : 'Любой'}
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-4 gap-1">
            <button
              onClick={() => onAgeChange(null)}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedAge === null
                  ? 'bg-[#6545C6] text-white'
                  : 'bg-[#F7F6FC] text-[#5B5870] hover:bg-[#EEEAFB]'
              }`}
            >
              Любой
            </button>
            {ageOptions.map((age) => (
              <button
                key={age}
                onClick={() => onAgeChange(selectedAge === age ? null : age)}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedAge === age
                    ? 'bg-[#6545C6] text-white shadow-sm'
                    : 'bg-[#F7F6FC] text-[#5B5870] hover:bg-[#EEEAFB]'
                }`}
              >
                {age} лет
              </button>
            ))}
          </div>
        </div>
      )}

      {/* District / Районы (§5.4: список районов города) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#1F1B3D]">Район города (Тирасполь)</label>
        <select
          value={selectedDistrict}
          onChange={(e) => onDistrictChange(e.target.value)}
          className="w-full bg-[#F7F6FC] border border-[#E5E4F2] text-xs font-semibold text-[#1F1B3D] rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#6545C6] cursor-pointer"
        >
          {DISTRICTS_TIRASPOL.map((dist) => (
            <option key={dist} value={dist}>
              {dist}
            </option>
          ))}
        </select>
      </div>

      {/* Categories Checkboxes (§4: 9 верхних категорий) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#1F1B3D]">Направления</label>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {TOP_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
            const isChecked = selectedTopCategories.includes(cat.id as TopCategoryId);
            return (
              <label
                key={cat.id}
                className="flex items-center gap-2.5 text-xs text-[#5B5870] hover:text-[#1F1B3D] cursor-pointer select-none py-0.5"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleCategory(cat.id as TopCategoryId)}
                  className="w-4 h-4 rounded border-[#C7C5D8] text-[#6545C6] focus:ring-[#6545C6]"
                />
                <span className={isChecked ? 'font-bold text-[#1F1B3D]' : ''}>
                  {cat.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Price / Стоимость (§5.3: бесплатно или до N руб.) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#1F1B3D]">Стоимость</label>
          <span className="text-xs font-semibold text-[#6545C6]">
            {isFreeOnly ? 'Только бесплатно' : `до ${maxPrice.toLocaleString()} ₽`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="5000"
          step="250"
          value={maxPrice}
          disabled={isFreeOnly}
          onChange={(e) => onMaxPriceChange(Number(e.target.value))}
          className="w-full accent-[#6545C6] cursor-pointer"
        />
        <label className="flex items-center gap-2 text-xs text-[#5B5870] cursor-pointer">
          <input
            type="checkbox"
            checked={isFreeOnly}
            onChange={(e) => onToggleFreeOnly(e.target.checked)}
            className="w-4 h-4 rounded border-[#C7C5D8] text-[#6545C6] focus:ring-[#6545C6]"
          />
          <span>Бесплатные занятия (0 руб.)</span>
        </label>
      </div>

      {/* Verified only filter (§5.5) */}
      <div className="pt-1">
        <label className="flex items-center gap-2 text-xs text-[#5B5870] cursor-pointer">
          <input
            type="checkbox"
            checked={isVerifiedOnly}
            onChange={(e) => onToggleVerifiedOnly(e.target.checked)}
            className="w-4 h-4 rounded border-[#C7C5D8] text-[#6545C6] focus:ring-[#6545C6]"
          />
          <span className="flex items-center gap-1 font-semibold text-[#1F1B3D]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1E9E4A]" />
            Только проверенные (до 90 дней)
          </span>
        </label>
      </div>

      {/* Day / Time of day filter (§5.6) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#1F1B3D] flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-[#858394]" />
          Время занятий
        </label>
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#F7F6FC] rounded-xl border border-[#E5E4F2] text-[11px]">
          <button
            onClick={() => onTimeOfDayChange('all')}
            className={`py-1 rounded-lg font-bold transition-all ${timeOfDay === 'all' ? 'bg-[#6545C6] text-white' : 'text-[#5B5870]'}`}
          >
            Все
          </button>
          <button
            onClick={() => onTimeOfDayChange('morning')}
            className={`py-1 rounded-lg font-bold transition-all ${timeOfDay === 'morning' ? 'bg-[#6545C6] text-white' : 'text-[#5B5870]'}`}
          >
            Утро
          </button>
          <button
            onClick={() => onTimeOfDayChange('afternoon')}
            className={`py-1 rounded-lg font-bold transition-all ${timeOfDay === 'afternoon' ? 'bg-[#6545C6] text-white' : 'text-[#5B5870]'}`}
          >
            День
          </button>
          <button
            onClick={() => onTimeOfDayChange('evening')}
            className={`py-1 rounded-lg font-bold transition-all ${timeOfDay === 'evening' ? 'bg-[#6545C6] text-white' : 'text-[#5B5870]'}`}
          >
            Вечер
          </button>
        </div>
      </div>

      {/* Format: Онлайн / Офлайн */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#1F1B3D]">Формат</label>
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F6FC] rounded-xl border border-[#E5E4F2] text-xs">
          <button
            onClick={() => onFormatChange('all')}
            className={`py-1 rounded-lg font-bold transition-all ${selectedFormat === 'all' ? 'bg-[#6545C6] text-white' : 'text-[#5B5870]'}`}
          >
            Любой
          </button>
          <button
            onClick={() => onFormatChange('offline')}
            className={`py-1 rounded-lg font-bold transition-all ${selectedFormat === 'offline' ? 'bg-[#6545C6] text-white' : 'text-[#5B5870]'}`}
          >
            Офлайн
          </button>
          <button
            onClick={() => onFormatChange('online')}
            className={`py-1 rounded-lg font-bold transition-all ${selectedFormat === 'online' ? 'bg-[#6545C6] text-white' : 'text-[#5B5870]'}`}
          >
            Онлайн
          </button>
        </div>
      </div>

      {/* Results Count Button */}
      <div className="pt-2">
        <button
          onClick={() => {}}
          className="w-full py-3 bg-[#6545C6] hover:bg-[#8064D8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#6545C6]/20 cursor-pointer"
        >
          Найдено: {totalFilteredCount} {totalFilteredCount === 1 ? 'объект' : totalFilteredCount < 5 ? 'объекта' : 'объектов'}
        </button>
      </div>
    </aside>
  );
};
