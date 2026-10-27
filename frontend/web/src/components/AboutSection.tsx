import React from 'react';
import { Sparkles, MapPin, ShieldCheck, HeartHandshake, Award } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#E5E4F2] shadow-sm max-w-5xl mx-auto my-8 space-y-8">
      <div className="max-w-2xl">
        <span className="px-3 py-1 bg-[#EEEAFB] text-[#6545C6] font-extrabold text-xs rounded-full uppercase tracking-wider">
          О платформе
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-[#1F1B3D] mt-3">
          talentro — кружки, секции и услуги Приднестровья
        </h2>
        <p className="text-sm sm:text-base text-[#5B5870] mt-3 leading-relaxed">
          Мы объединили все проверенные секции, творческие студии, спортивные комплексы и частных специалистов в единый удобный сервис для жителей Тирасполя, Бендер, Рыбницы и других городов ПМР.
        </p>
      </div>

      {/* 4 Key Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#F7F6FC] border border-[#E5E4F2] space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#6545C6] text-white flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-[#1F1B3D]">Карта районов ПМР</h4>
          <p className="text-xs text-[#5B5870]">
            Поиск занятий в шаговой доступности: Центр, Балка, Западный, Бородинка или Стадион «Шериф».
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#F7F6FC] border border-[#E5E4F2] space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#6545C6] text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-[#1F1B3D]">Проверенные студии</h4>
          <p className="text-xs text-[#5B5870]">
            Верификация преподавателей, прозрачные цены в рублях ПМР и реальные отзывы учеников.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#F7F6FC] border border-[#E5E4F2] space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#6545C6] text-white flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-[#1F1B3D]">Пробные занятия</h4>
          <p className="text-xs text-[#5B5870]">
            Большинство секций предлагают бесплатный первый урок перед покупкой абонемента.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#F7F6FC] border border-[#E5E4F2] space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#6545C6] text-white flex items-center justify-center">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-[#1F1B3D]">Онлайн-запись</h4>
          <p className="text-xs text-[#5B5870]">
            Бронирование даты и времени в 1 клик с поддержкой приднестровских номеров IDC (+373 77X).
          </p>
        </div>
      </div>
    </div>
  );
};
