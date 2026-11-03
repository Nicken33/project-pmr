import React from 'react';

export default function ProfilePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Личный кабинет</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Мои данные</h2>
            {/* TODO (QodeX): Подключить форму редактирования профиля */}
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Избранное</h2>
            {/* TODO (QodeX): Подключить список избранных организаций */}
          </div>
        </div>
      </div>
    </main>
  );
}
