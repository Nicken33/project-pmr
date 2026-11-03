import React from 'react';
import { Search, MapPin, ArrowRight, ChevronDown, X } from 'lucide-react';
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
    <section className="px-4 sm:px-6 lg:px-8 pt-4 pb-2 max-w-[1440px] mx-auto w-full">
      {/* 01 Шапка (герой-секция) unified card matching mockup */}
      <div className="relative overflow-hidden rounded-[26px] sm:rounded-[30px] bg-gradient-to-r from-white via-[#FAF7FF] to-[#ECE3FD] border border-[#E5E4F2] shadow-xs p-5 sm:p-7 lg:p-9 min-h-[210px] lg:min-h-[240px] flex flex-col justify-between">
        
        {/* Right side high-fidelity 8K 3D artwork with smooth edge blending */}
        <div className="hidden md:block absolute right-0 top-0 bottom-0 w-[50%] lg:w-[54%] pointer-events-none select-none z-0 overflow-hidden">
          <img
            src="/assets/hero_header_3d_artwork.jpg"
            alt="Твори Развивайся Открывай мир"
            className="w-full h-full object-cover object-right"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 18%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 18%)',
            }}
          />
        </div>

        {/* Main Content (Headline & Subtitle) */}
        <div className="relative z-10 max-w-xl space-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-[40px] font-black text-[#1F1B3D] tracking-tight leading-[1.12]">
            Найди занятие <br />
            <span className="text-[#6545C6]">по душе</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5B5870] font-medium leading-relaxed max-w-md">
            Секции, кружки, услуги и хобби рядом с вами. <br className="hidden sm:inline" />
            Развивайся. Открывай новое. Вдохновляйся.
          </p>
        </div>

        {/* Floating 3-part interactive Search Row matching Image 1:1 */}
        <div className="relative z-10 mt-4 sm:mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-2xl">
          {/* Query input pill */}
          <div className="flex-1 min-w-0 relative flex items-center bg-white rounded-2xl border border-[#E5E4F2] px-3.5 py-2.5 shadow-xs focus-within:border-[#6545C6] focus-within:ring-2 focus-within:ring-[#6545C6]/20 transition-all">
            <Search className="w-4 h-4 text-[#858394] shrink-0 mr-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
              placeholder="Поиск секций, услуг, преподавателей..."
              className="w-full text-xs sm:text-sm text-[#1F1B3D] placeholder-[#858394] outline-none bg-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="p-1 hover:bg-[#EEEAFB] text-[#858394] hover:text-[#1F1B3D] rounded-full transition-colors cursor-pointer"
                title="Очистить"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* City selector pill */}
          <div className="relative flex items-center bg-white rounded-2xl border border-[#E5E4F2] px-3.5 py-2.5 shadow-xs hover:border-[#6545C6] transition-all shrink-0">
            <MapPin className="w-4 h-4 text-[#6545C6] mr-1.5 shrink-0" />
            <select
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="text-xs sm:text-sm font-bold text-[#1F1B3D] bg-transparent focus:outline-none cursor-pointer pr-5 appearance-none"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#5B5870] absolute right-3 pointer-events-none" />
          </div>

          {/* Submit button */}
          <button
            onClick={onSearchSubmit}
            className="px-6 py-2.5 bg-[#6545C6] hover:bg-[#5538B5] active:bg-[#482E9E] text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-[#6545C6]/25 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Найти</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
};
