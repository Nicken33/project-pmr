import React, { useState } from 'react';
import { Heart, ChevronDown, MapPin, User, LogIn } from 'lucide-react';
import { CITIES } from '../data/mockData';
import { UserRole } from '../types';

interface DesktopHeaderProps {
  currentTab: 'home' | 'catalog' | 'map' | 'about';
  onSelectTab: (tab: 'home' | 'catalog' | 'map' | 'about') => void;
  selectedCity: string;
  onSelectCity: (city: string) => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onOpenProfile: () => void;
  onOpenMessages: () => void;
  currentRole: UserRole;
  onOpenOwnerCabinet?: () => void;
  onOpenModeratorCabinet?: () => void;
  onOpenLogin?: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  currentTab,
  onSelectTab,
  selectedCity,
  onSelectCity,
  favoritesCount,
  onOpenFavorites,
  onOpenProfile,
  onOpenMessages,
  currentRole,
  onOpenOwnerCabinet,
  onOpenModeratorCabinet,
  onOpenLogin,
}) => {
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E4F2] px-4 sm:px-8 py-3 transition-all select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-8 shrink-0">
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center group text-left cursor-pointer focus:outline-none"
          >
            <img
              src="/assets/talentro-logo.png"
              alt="Talentro"
              className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-102"
            />
          </button>

          {/* Navigation Links matching Image 2 */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-semibold">
            <button
              onClick={() => onSelectTab('home')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'home'
                  ? 'bg-[#EEEAFB] text-[#6545C6] font-bold'
                  : 'text-[#5B5870] hover:text-[#1F1B3D] hover:bg-[#F7F6FC]'
              }`}
            >
              Главная
            </button>
            <button
              onClick={() => onSelectTab('catalog')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'catalog'
                  ? 'bg-[#EEEAFB] text-[#6545C6] font-bold'
                  : 'text-[#5B5870] hover:text-[#1F1B3D] hover:bg-[#F7F6FC]'
              }`}
            >
              Каталог
            </button>
            <button
              onClick={() => onSelectTab('map')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'map'
                  ? 'bg-[#EEEAFB] text-[#6545C6] font-bold'
                  : 'text-[#5B5870] hover:text-[#1F1B3D] hover:bg-[#F7F6FC]'
              }`}
            >
              Карта
            </button>
            <button
              onClick={() => onSelectTab('about')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'about'
                  ? 'bg-[#EEEAFB] text-[#6545C6] font-bold'
                  : 'text-[#5B5870] hover:text-[#1F1B3D] hover:bg-[#F7F6FC]'
              }`}
            >
              О проекте
            </button>
          </nav>
        </div>

        {/* Right Zone matching Image 2: City Dropdown, Favorites Heart, User Avatar/Login */}
        <div className="flex items-center gap-3 shrink-0">
          {/* City Dropdown: 📍 Тирасполь ∨ */}
          <div className="relative">
            <button
              onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#1F1B3D] hover:text-[#6545C6] px-2.5 py-1.5 rounded-xl hover:bg-[#EEEAFB] transition-colors cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-[#6545C6]" />
              <span>{selectedCity}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#858394]" />
            </button>

            {cityDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-[#E5E4F2] py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[11px] font-bold text-[#858394] uppercase tracking-wider">
                  Города Приднестровья
                </div>
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      onSelectCity(city);
                      setCityDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors flex items-center justify-between cursor-pointer ${
                      selectedCity === city
                        ? 'bg-[#EEEAFB] text-[#6545C6] font-bold'
                        : 'text-[#1F1B3D] hover:bg-[#F7F6FC]'
                    }`}
                  >
                    <span>{city}</span>
                    {selectedCity === city && <span className="text-[#6545C6] font-bold">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Favorites Heart Button matching Image 2 */}
          <button
            onClick={onOpenFavorites}
            className="relative p-2 rounded-xl text-[#5B5870] hover:text-[#FF4444] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
            title="Избранные занятия"
          >
            <Heart className="w-5 h-5" />
            {favoritesCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#6545C6] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* User Status: Avatar matching Image 2 */}
          {currentRole === 'guest' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenLogin || onOpenProfile}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#6545C6] hover:bg-[#EEEAFB] border border-[#6545C6]/30 rounded-xl transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Войти</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#6545C6]/30 transition-all cursor-pointer"
              title="Открыть профиль"
            >
              <div className={`w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm flex items-center justify-center text-white font-bold text-xs ${
                currentRole === 'owner'
                  ? 'bg-gradient-to-tr from-[#0284C7] to-[#38BDF8]'
                  : currentRole === 'moderator'
                  ? 'bg-gradient-to-tr from-[#E11D48] to-[#FB7185]'
                  : 'bg-gradient-to-tr from-[#6545C6] to-[#A998EA]'
              }`}>
                {currentRole === 'owner' ? 'П' : currentRole === 'moderator' ? 'М' : 'АП'}
              </div>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
