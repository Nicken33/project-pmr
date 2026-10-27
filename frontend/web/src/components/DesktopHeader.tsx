import React, { useState } from 'react';
import { Heart, Bell, ChevronDown, Smartphone, Monitor, Shield, Building, User } from 'lucide-react';
import { CITIES } from '../data/mockData';
import { UserRole } from '../types';
import { RoleSwitcher } from './RoleSwitcher';

interface DesktopHeaderProps {
  currentTab: 'home' | 'catalog' | 'map' | 'about';
  onSelectTab: (tab: 'home' | 'catalog' | 'map' | 'about') => void;
  selectedCity: string;
  onSelectCity: (city: string) => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onOpenProfile: () => void;
  onOpenMessages: () => void;
  viewMode?: 'desktop' | 'mobile';
  onToggleViewMode?: (mode: 'desktop' | 'mobile') => void;
  currentRole: UserRole;
  onChangeRole?: (role: UserRole) => void;
  onOpenOwnerCabinet?: () => void;
  onOpenModeratorCabinet?: () => void;
  onOpenRules?: () => void;
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E4F2] px-4 sm:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-6 shrink-0">
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 group text-left cursor-pointer"
          >
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M12 2C12.5 5.5 15.5 8.5 19 9C15.5 9.5 12.5 12.5 12 16C11.5 12.5 8.5 9.5 5 9C8.5 8.5 11.5 5.5 12 2Z" />
                <circle cx="8" cy="16" r="3" opacity="0.6" />
                <circle cx="16" cy="16" r="3" opacity="0.6" />
              </svg>
            </div>
            <span className="text-2xl font-black tracking-tight text-[#1F1B3D] group-hover:text-[#6545C6] transition-colors">
              Talentro
            </span>
          </button>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold">
            <button
              onClick={() => onSelectTab('home')}
              className={`transition-colors cursor-pointer ${
                currentTab === 'home'
                  ? 'text-[#6545C6] border-b-2 border-[#6545C6] pb-0.5'
                  : 'text-[#5B5870] hover:text-[#1F1B3D]'
              }`}
            >
              Главная
            </button>
            <button
              onClick={() => onSelectTab('catalog')}
              className={`transition-colors cursor-pointer ${
                currentTab === 'catalog'
                  ? 'text-[#6545C6] border-b-2 border-[#6545C6] pb-0.5'
                  : 'text-[#5B5870] hover:text-[#1F1B3D]'
              }`}
            >
              Каталог
            </button>
            <button
              onClick={() => onSelectTab('map')}
              className={`transition-colors cursor-pointer ${
                currentTab === 'map'
                  ? 'text-[#6545C6] border-b-2 border-[#6545C6] pb-0.5'
                  : 'text-[#5B5870] hover:text-[#1F1B3D]'
              }`}
            >
              Карта
            </button>
          </nav>
        </div>

        {/* Right Zone: City, Favorites, Notifications, User Auth */}
        <div className="flex items-center gap-3 shrink-0">
          {/* City Dropdown */}
          <div className="relative">
            <button
              onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#1F1B3D] bg-[#F7F6FC] hover:bg-[#EEEAFB] px-3 py-2 rounded-xl border border-[#E5E4F2] transition-colors cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#6545C6]" />
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

          {/* Favorites Heart Button */}
          <button
            onClick={onOpenFavorites}
            className="relative p-2 rounded-xl text-[#5B5870] hover:text-[#6545C6] hover:bg-[#EEEAFB] transition-colors cursor-pointer"
            title="Избранное"
          >
            <Heart className="w-5 h-5" />
            {favoritesCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#6545C6] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Notifications Bell (Section 15 TDS) */}
          {currentRole !== 'guest' && (
            <button
              onClick={onOpenMessages}
              className="relative p-2 rounded-xl text-[#5B5870] hover:text-[#6545C6] hover:bg-[#EEEAFB] transition-colors cursor-pointer"
              title="Уведомления и сообщения"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#6545C6] rounded-full" />
            </button>
          )}

          {/* Special Quick Action for Owner or Moderator */}
          {currentRole === 'owner' && onOpenOwnerCabinet && (
            <button
              onClick={onOpenOwnerCabinet}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Building className="w-3.5 h-3.5" />
              <span>Кабинет владельца</span>
            </button>
          )}

          {currentRole === 'moderator' && onOpenModeratorCabinet && (
            <button
              onClick={onOpenModeratorCabinet}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#E11D48] text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Кабинет модератора</span>
            </button>
          )}

          {/* User Status: Guest ("Войти") or Registered User Avatar */}
          {currentRole === 'guest' ? (
            <button
              onClick={onOpenLogin || onOpenProfile}
              className="flex items-center gap-2 px-4 py-2 bg-[#6545C6] hover:bg-[#5335ad] text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>Войти</span>
            </button>
          ) : (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full hover:bg-[#EEEAFB] transition-colors cursor-pointer border border-[#E5E4F2]"
              title="Открыть профиль и настройки"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] flex items-center justify-center text-white font-bold text-xs">
                {currentRole === 'owner' ? 'П' : currentRole === 'moderator' ? 'М' : 'АП'}
              </div>
              <span className="text-xs font-semibold text-[#1F1B3D] hidden xl:inline">
                {currentRole === 'owner' ? '«Палитра»' : currentRole === 'moderator' ? 'Модератор' : 'Анна'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
