import React from 'react';
import { Search, MapPin, ArrowRight } from 'lucide-react';
import { CITIES } from '../data/mockData';

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  onSearchSubmit: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  searchQuery,
  onSearchChange,
  selectedCity,
  onCityChange,
  onSearchSubmit,
}) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F2EEFB] via-[#F7F6FC] to-transparent pt-6 pb-8 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Headline, Subtitle, Search Widget */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="space-y-3 mb-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1F1B3D] tracking-tight leading-[1.15]">
              Найди занятие <br />
              <span className="text-[#6545C6]">по душе</span>
            </h1>
            <p className="text-sm sm:text-base text-[#5B5870] max-w-lg leading-relaxed">
              Секции, кружки, услуги и хобби рядом с вами в Приднестровье. Развивайся. Открывай новое. Вдохновляйся.
            </p>
          </div>

          {/* Search Box Card */}
          <div className="bg-white p-2 sm:p-2.5 rounded-2xl shadow-xl shadow-[#6545C6]/5 border border-[#E5E4F2] flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
            {/* Query input */}
            <div className="flex-1 flex items-center gap-2.5 px-3 py-1">
              <Search className="w-4 h-4 text-[#858394] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                placeholder="Поиск секций, услуг, преподавателей..."
                className="w-full text-xs sm:text-sm text-[#1F1B3D] placeholder-[#858394] focus:outline-none bg-transparent"
              />
            </div>

            <div className="hidden sm:block w-px h-8 bg-[#E5E4F2]" />

            {/* City select */}
            <div className="flex items-center gap-2 px-3 py-1 shrink-0">
              <MapPin className="w-4 h-4 text-[#6545C6] shrink-0" />
              <select
                value={selectedCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="text-xs sm:text-sm font-semibold text-[#1F1B3D] bg-transparent focus:outline-none cursor-pointer"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit button */}
            <button
              onClick={onSearchSubmit}
              className="px-5 py-2.5 bg-[#6545C6] hover:bg-[#8064D8] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-[#6545C6]/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <span>Найти</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick stats / trust chips */}
          <div className="flex items-center gap-4 mt-6 text-xs text-[#858394]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
              Более 120 секций и студий
            </span>
            <span>·</span>
            <span>Тирасполь и города ПМР</span>
            <span>·</span>
            <span>Бесплатные пробные уроки</span>
          </div>
        </div>

        {/* Right Column: Hero Visual Artwork Card matching Image 1 */}
        <div className="lg:col-span-5 relative flex justify-center items-center">
          {/* Handwritten calligraphy accents */}
          <div className="absolute -top-4 left-4 z-10 font-script text-xl sm:text-2xl text-[#8064D8] -rotate-6 select-none pointer-events-none drop-shadow-sm">
            Твори Развивайся <br /> Открывай мир ♡
          </div>
          <div className="absolute -bottom-2 right-4 z-10 font-script text-xl sm:text-2xl text-[#8064D8] rotate-3 select-none pointer-events-none drop-shadow-sm">
            Вдохновение <br /> Развитие Возможности
          </div>

          {/* Main Visual Image Card with subtle gradient aura */}
          <div className="relative w-full max-w-md aspect-[16/10] sm:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-[#EEEAFB]">
            <img
              src="/src/assets/images/hero_creative_arts_1792908981359.jpg"
              alt="Творчество и вдохновение в Приднестровье"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {/* Subtle lavender gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#6545C6]/20 via-transparent to-transparent pointer-events-none" />

            {/* Corner Badge */}
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-[#6545C6] shadow-md">
              Студии Приднестровья ✨
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
