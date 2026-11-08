import React from 'react';

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Каталог кружков и секций</h1>
        <p className="text-lg text-gray-600 mb-8">
          Найдите подходящие занятия для вашего ребенка в Приднестровье
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TODO (QodeX): Подключить компонент списка организаций */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Популярные категории</h2>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">Спортивные секции</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-700">Творческие кружки</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-gray-700">Языковые курсы</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Быстрый поиск</h2>
            {/* TODO (QodeX): Подключить компонент фильтров */}
          </div>
        </div>
      </div>
    </main>
  );
}
