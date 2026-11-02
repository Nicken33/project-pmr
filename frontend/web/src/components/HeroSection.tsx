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
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F2EEFB] via-[#F7F6FC] to-[#F7F6FC] pt-6 pb-6 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Headline, Subtitle, Search Widget */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
          <div className="space-y-2.5">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1F1B3D] tracking-tight leading-[1.12]">
              Найди занятие <br />
              <span className="text-[#6545C6]">по душе</span>
            </h1>
            <p className="text-sm sm:text-base text-[#5B5870] max-w-lg leading-relaxed">
              Секции, кружки, услуги и хобби рядом с вами. <br className="hidden sm:inline" />
              Развивайся. Открывай новое. Вдохновляйся.
            </p>
          </div>

          {/* Search Box Card matching Image 2 */}
          <div className="bg-white p-2 rounded-2xl shadow-xl shadow-[#6545C6]/5 border border-[#E5E4F2] flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
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
            <div className="flex items-center gap-1.5 px-3 py-1 shrink-0">
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
              className="px-6 py-2.5 bg-[#6545C6] hover:bg-[#8064D8] active:bg-[#5B3EBA] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-[#6545C6]/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>Найти</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Hero Visual Artwork Card matching Image 2 perfectly */}
        <div className="lg:col-span-5 relative flex justify-center items-center">
          <div className="relative w-full max-w-[460px] aspect-[16/11] rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-gradient-to-tr from-[#EEEAFB] via-[#E8E2FB] to-[#F7F6FC]">
            {/* Background Illustration / Photo */}
            <img
              src="/src/assets/images/hero_creative_arts_1792908981359.jpg"
              alt="Творчество и секции в Приднестровье"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />

            {/* Soft purple gradient scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1F1B3D]/30 via-transparent to-white/20 pointer-events-none" />

            {/* Top-Left Calligraphy Sticker (contained strictly inside) */}
            <div className="absolute top-3 left-3 z-10 bg-white/85 backdrop-blur-md px-3 py-1 rounded-xl shadow-md border border-white/60 -rotate-3 select-none pointer-events-none">
              <span className="font-script text-sm sm:text-base text-[#6545C6] leading-tight block">
                Твори Развивайся Открывай мир ♡
              </span>
            </div>

            {/* Top-Right Calligraphy Sticker (contained strictly inside) */}
            <div className="absolute top-3 right-3 z-10 bg-white/85 backdrop-blur-md px-3 py-1 rounded-xl shadow-md border border-white/60 rotate-2 select-none pointer-events-none">
              <span className="font-script text-sm sm:text-base text-[#8064D8] leading-tight block">
                Вдохновение · Развитие · Возможности
              </span>
            </div>

            {/* Bottom Subtle Pill */}
            <div className="absolute bottom-3 left-3 bg-[#1F1B3D]/70 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold text-white select-none">
              Приднестровье · Секции и студии
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
