import dynamic from 'next/dynamic';
import React, { useMemo, useState } from 'react';
import Filters from '@/components/Filters';
import { defaultFilters, filterOrganizations, mergeFilters } from '@/lib/filter';
import { mockOrganizations } from '@/mocks/data';
import { Filters as FiltersState } from '@/types';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function MapPage() {
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => filterOrganizations(mockOrganizations, filters), [filters]);
  const activeId = visible.some((org) => org.id === selectedId) ? selectedId : null;

  const handleChange = (patch: Partial<FiltersState>) =>
    setFilters((current) => mergeFilters(current, patch));

  const handleReset = () => {
    setFilters(defaultFilters);
    setSelectedId(null);
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Карта Приднестровья</h1>
        <p className="text-lg text-gray-600 mb-8">
          Найдите кружки и секции на карте региона
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <Map
                organizations={visible}
                activeCity={filters.city ?? ''}
                selectedId={activeId}
                onSelect={setSelectedId}
              />
            </div>
          </div>

          <div className="space-y-6">
            <Filters filters={filters} onChange={handleChange} onReset={handleReset} />

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">
                Найдено: {visible.length}
              </h2>
              {visible.length === 0 ? (
                <p className="text-gray-600">
                  По выбранным фильтрам ничего не найдено. Измените город, категорию или возраст.
                </p>
              ) : (
                <ul className="space-y-3">
                  {visible.map((org) => (
                    <li key={org.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(org.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors duration-200 ${
                          org.id === activeId
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className="block font-medium text-gray-800">{org.name}</span>
                        <span className="block text-sm text-gray-600">{org.address}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
