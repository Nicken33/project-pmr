import React, { useState } from 'react';
import { Filters as FiltersState } from '@/types';
import { cities } from '@/mocks/data';
import { categoryOptions, defaultFilters, isAge, priceOptions } from '@/lib/filter';

interface FiltersProps {
  filters: FiltersState;
  onChange: (patch: Partial<FiltersState>) => void;
  onReset?: () => void;
}

const selectClass =
  'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200';

const Filters: React.FC<FiltersProps> = ({ filters, onChange, onReset }) => {
  const [ageDraft, setAgeDraft] = useState<string>(
    filters.age === undefined ? '' : String(filters.age),
  );

  const handleAgeChange = (value: string) => {
    setAgeDraft(value);
    if (value.trim() === '') {
      onChange({ age: undefined });
      return;
    }
    if (isAge(value)) {
      onChange({ age: Number(value) });
    }
  };

  const ageIsWrong = ageDraft.trim() !== '' && !isAge(ageDraft);

  const handleReset = () => {
    setAgeDraft('');
    (onReset ?? (() => onChange({ ...defaultFilters })))();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold mb-6 text-gray-800">Фильтры</h3>

      <div className="space-y-6">
        <div>
          <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700 mb-2">
            Поиск
          </label>
          <input
            id="searchQuery"
            type="search"
            value={filters.searchQuery ?? ''}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
            placeholder="Название, направление, тег"
            className={selectClass}
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
            Город
          </label>
          <select
            id="city"
            value={filters.city ?? ''}
            onChange={(e) => onChange({ city: e.target.value as FiltersState['city'] })}
            className={selectClass}
          >
            <option value="">Все города</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            Категория
          </label>
          <select
            id="category"
            value={filters.category ?? ''}
            onChange={(e) => onChange({ category: e.target.value as FiltersState['category'] })}
            className={selectClass}
          >
            <option value="">Все категории</option>
            {categoryOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
            Возраст ребёнка
          </label>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={3}
            max={17}
            value={ageDraft}
            onChange={(e) => handleAgeChange(e.target.value)}
            placeholder="Например, 10"
            aria-invalid={ageIsWrong}
            className={`${selectClass} ${ageIsWrong ? 'border-red-500' : ''}`}
          />
          {ageIsWrong && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              Укажите возраст числом от 3 до 17.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="priceType" className="block text-sm font-medium text-gray-700 mb-2">
            Тип оплаты
          </label>
          <select
            id="priceType"
            value={filters.priceType ?? ''}
            onChange={(e) =>
              onChange({ priceType: e.target.value as FiltersState['priceType'] })
            }
            className={selectClass}
          >
            <option value="">Любой тип</option>
            {priceOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
        >
          Сбросить фильтры
        </button>
      </div>
    </div>
  );
};

export default Filters;
