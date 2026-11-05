import React from 'react';

export default function AddSectionPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Добавление новой секции</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-6">Информация о секции</h2>
          {/* TODO (QodeX): Подключить форму добавления секции */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Основные данные</h3>
                {/* Поля для названия, описания и т.д. */}
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Контакты</h3>
                {/* Поля для адреса, телефона и т.д. */}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Дополнительно</h3>
              {/* Поля для тегов, возраста и т.д. */}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
