import React, { useState } from 'react';
import { 
  Home, Grid, MapPin, Heart, User, Search, SlidersHorizontal, 
  ChevronDown, Clock, ArrowRight, Bell, Share2, X, Plus, Phone, ThumbsUp,
  Palette, Trophy, Laptop, GraduationCap, Compass, Sparkles, Check, CheckCircle2
} from 'lucide-react';
import { ActivityItem, TopCategoryId, ActivityKind, Booking, Conversation, UserRole } from '../types';
import { TransnistriaMap } from './TransnistriaMap';
import { CITIES } from '../data/mockData';

interface MobileAppViewProps {
  activities: ActivityItem[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenDetail: (activity: ActivityItem) => void;
  onOpenBooking: (activity: ActivityItem) => void;
  selectedCity: string;
  onSelectCity: (city: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: TopCategoryId | 'all';
  onSelectCategory: (cat: TopCategoryId | 'all') => void;
  selectedType: ActivityKind;
  onSelectType: (type: ActivityKind) => void;
  selectedDistrict: string;
  onSelectDistrict: (dist: string) => void;
  selectedAge: number | null;
  onSelectAge: (age: number | null) => void;
  bookings: Booking[];
  conversations: Conversation[];
  onSendMessage: (conversationId: string, text: string) => void;
  onCancelBooking: (id: string) => void;
  currentRole?: UserRole;
  userName?: string;
  userEmail?: string;
  onOpenLogin?: () => void;
  onOpenProfileModal?: () => void;
  onSwitchToDesktop?: () => void;
}

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  activities,
  favorites,
  onToggleFavorite,
  onOpenDetail,
  onOpenBooking,
  selectedCity,
  onSelectCity,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  selectedType,
  onSelectType,
  selectedDistrict,
  onSelectDistrict,
  selectedAge,
  onSelectAge,
  bookings,
  conversations,
  onCancelBooking,
  currentRole = 'guest',
  userName = 'Гость',
  userEmail = '',
  onOpenLogin,
  onOpenProfileModal,
  onSwitchToDesktop,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'catalog' | 'map' | 'favorites' | 'profile'>('home');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [catalogLayout, setCatalogLayout] = useState<'grid' | 'list'>('list');

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    const matchCat = selectedCategory === 'all' || act.topCategory === selectedCategory;
    const matchType = act.kind === selectedType;
    const matchDistrict = selectedDistrict === 'Все районы' || act.locations.some(l => l.district === selectedDistrict);
    const matchAge = selectedAge === null || act.groups.some(g => g.ageFrom <= selectedAge && g.ageTo >= selectedAge);
    const matchSearch =
      searchQuery.trim() === '' ||
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.locations.some(l => l.district?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      act.subcategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.topCategoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchType && matchDistrict && matchAge && matchSearch;
  });

  const popularActivities = activities.filter((a) => a.upvotes >= 20);
  const favoriteItems = activities.filter((a) => favorites.includes(a.id));

  const categoryChips: { id: TopCategoryId | 'all'; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Все', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'art', label: 'Творчество', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'sport', label: 'Спорт', icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: 'tech', label: 'Технологии', icon: <Laptop className="w-3.5 h-3.5" /> },
    { id: 'education', label: 'Обучение', icon: <GraduationCap className="w-3.5 h-3.5" /> },
    { id: 'travel', label: 'Путешествия', icon: <Compass className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="w-full min-h-screen bg-[#F7F6FC] flex flex-col relative select-none max-w-lg mx-auto pb-20 overflow-x-hidden">
      {/* Native Mobile App Header (Brand, City dropdown, Actions) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E4F2] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Logo Brand */}
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center cursor-pointer"
          >
            <img
              src="/assets/talentro-logo.png"
              alt="Talentro"
              className="h-8 w-auto object-contain"
            />
          </button>

          {/* City Selector Pill */}
          <div className="relative">
            <button
              onClick={() => setShowCityPicker(!showCityPicker)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] text-xs font-bold transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{selectedCity}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* City Dropdown Menu */}
            {showCityPicker && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowCityPicker(false)} 
                />
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-[#E5E4F2] py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[#858394] uppercase tracking-wider">
                    Выберите город
                  </div>
                  {CITIES.map((city) => (
                    <button
                      key={city}
                      onClick={() => {
                        onSelectCity(city);
                        setShowCityPicker(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#F7F6FC] transition-colors ${
                        selectedCity === city ? 'text-[#6545C6] bg-[#EEEAFB]/50 font-bold' : 'text-[#1F1B3D]'
                      }`}
                    >
                      <span>{city}</span>
                      {selectedCity === city && <Check className="w-3.5 h-3.5 text-[#6545C6]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('favorites')}
              className="relative p-2 rounded-xl text-[#5B5870] hover:bg-[#EEEAFB] transition-colors"
              title="Избранное"
            >
              <Heart className={`w-5 h-5 ${favorites.length > 0 ? 'fill-[#FF4444] text-[#FF4444]' : ''}`} />
              {favorites.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#FF4444] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {favorites.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (onOpenProfileModal) onOpenProfileModal();
                else setActiveTab('profile');
              }}
              className="p-1.5 rounded-full hover:bg-[#EEEAFB] text-[#5B5870] transition-colors"
              title="Профиль"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] text-white flex items-center justify-center shadow-xs">
                <User className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* ================= TAB 1: ГЛАВНАЯ ================= */}
        {activeTab === 'home' && (
          <div className="space-y-5 pt-3">
            {/* Hero Card */}
            <div className="px-4">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#EEEAFB] via-[#F7F6FC] to-[#D9D0F5]/60 p-5 shadow-xs border border-[#E5E4F2]">
                <div className="max-w-[210px] relative z-10 space-y-1.5">
                  <h1 className="text-xl font-black text-[#1F1B3D] leading-tight">
                    Найди занятие <br />
                    <span className="text-[#6545C6]">по душе</span>
                  </h1>
                  <p className="text-[11px] text-[#5B5870] leading-relaxed">
                    Секции, кружки и услуги рядом с вами в Приднестровье.
                  </p>
                </div>
                <img
                  src="/src/assets/images/hero_creative_arts_1792908981359.jpg"
                  alt="Talentro Hero"
                  className="absolute right-0 bottom-0 w-36 h-36 object-cover rounded-tl-3xl opacity-90 pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Search Bar + Filter Trigger */}
            <div className="px-4 flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Поиск секций, услуг, тренеров..."
                  className="w-full bg-white border border-[#E5E4F2] pl-10 pr-3 py-2.5 text-xs rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#6545C6] shadow-xs"
                />
              </div>
              <button
                onClick={() => setShowFilterSheet(true)}
                className="p-3 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] rounded-2xl transition-colors cursor-pointer shrink-0 shadow-xs"
                title="Фильтры"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Category Pills Carousel */}
            <div className="pl-4">
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pr-4 py-1">
                {categoryChips.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCategory(c.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all shadow-xs cursor-pointer ${
                      selectedCategory === c.id
                        ? 'bg-[#6545C6] text-white shadow-md shadow-[#6545C6]/20'
                        : 'bg-white text-[#5B5870] border border-[#E5E4F2] hover:border-[#6545C6]'
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Kind Switcher (Занятия / Услуги) */}
            <div className="px-4">
              <div className="grid grid-cols-2 p-1 bg-white rounded-2xl border border-[#E5E4F2] shadow-xs">
                <button
                  onClick={() => onSelectType('activity')}
                  className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    selectedType === 'activity'
                      ? 'bg-[#6545C6] text-white shadow-xs'
                      : 'text-[#5B5870] hover:text-[#1F1B3D]'
                  }`}
                >
                  Занятия и кружки
                </button>
                <button
                  onClick={() => onSelectType('service')}
                  className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    selectedType === 'service'
                      ? 'bg-[#6545C6] text-white shadow-xs'
                      : 'text-[#5B5870] hover:text-[#1F1B3D]'
                  }`}
                >
                  Услуги и мастера
                </button>
              </div>
            </div>

            {/* Section: Популярные направления */}
            <div className="px-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-[#1F1B3D]">
                    Популярные направления
                  </h3>
                  <p className="text-[11px] text-[#858394]">
                    Наибольший интерес жителей {selectedCity}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="text-xs text-[#6545C6] font-bold flex items-center gap-0.5 cursor-pointer hover:underline"
                >
                  <span>Все</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Horizontal Cards Scroll */}
              <div className="flex items-center gap-3.5 overflow-x-auto hide-scrollbar pb-1">
                {popularActivities.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onOpenDetail(act)}
                    className="w-48 shrink-0 bg-white rounded-2xl border border-[#E5E4F2] overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="relative aspect-[4/3] bg-[#EEEAFB]">
                      <img
                        src={act.photos[0]}
                        alt={act.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(act.id);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#FF4444] shadow-xs cursor-pointer"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            favorites.includes(act.id) ? 'fill-[#FF4444]' : ''
                          }`}
                        />
                      </button>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-md text-[10px] font-bold text-[#6545C6]">
                        {act.topCategoryLabel}
                      </div>
                    </div>

                    <div className="p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-[#34D399] font-black">★ 4.8</span>
                        <span className="text-[#858394]">({act.reviews.length} отзывов)</span>
                      </div>
                      <h4 className="font-bold text-xs text-[#1F1B3D] truncate">
                        {act.title}
                      </h4>
                      <p className="text-[11px] font-black text-[#6545C6]">
                        {act.groups[0]?.priceFrom === 0
                          ? 'Бесплатно'
                          : `от ${act.groups[0]?.priceFrom} руб. / мес.`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Все секции и услуги */}
            <div className="px-4 space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-[#1F1B3D]">
                  Все секции ({filteredActivities.length})
                </h3>
                <span className="text-[11px] text-[#858394]">
                  в {selectedCity}
                </span>
              </div>

              <div className="space-y-3">
                {filteredActivities.slice(0, 10).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onOpenDetail(act)}
                    className="p-3.5 rounded-2xl bg-white border border-[#E5E4F2] shadow-xs flex items-center gap-3 cursor-pointer hover:border-[#6545C6] transition-all"
                  >
                    <img
                      src={act.photos[0]}
                      alt={act.title}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#6545C6] font-bold">{act.topCategoryLabel}</span>
                        <span className="text-[#34D399] font-bold">+{act.upvotes}</span>
                      </div>
                      <h4 className="font-bold text-xs text-[#1F1B3D] truncate">
                        {act.title}
                      </h4>
                      <p className="text-[11px] text-[#858394] truncate">
                        📍 {act.locations[0]?.district || selectedCity}, {act.locations[0]?.address}
                      </p>
                      <p className="text-xs font-black text-[#1F1B3D]">
                        {act.groups[0]?.priceFrom === 0
                          ? 'Бесплатно'
                          : `от ${act.groups[0]?.priceFrom} руб. / ${act.groups[0]?.period || 'мес.'}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(act);
                      }}
                      className="p-2 text-[#6545C6] hover:bg-[#EEEAFB] rounded-xl shrink-0"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: КАТАЛОГ ================= */}
        {activeTab === 'catalog' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-[#1F1B3D]">Каталог</h2>
                <p className="text-[11px] text-[#858394]">
                  Найдено вариантов: {filteredActivities.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilterSheet(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EEEAFB] text-[#6545C6] text-xs font-bold rounded-xl cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Фильтры</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Поиск по названию или району..."
                className="w-full bg-white border border-[#E5E4F2] pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6] shadow-xs"
              />
            </div>

            {/* Activities Listing */}
            <div className="space-y-3">
              {filteredActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => onOpenDetail(act)}
                  className="p-3.5 rounded-2xl bg-white border border-[#E5E4F2] shadow-xs flex items-center justify-between gap-3 cursor-pointer hover:border-[#6545C6] transition-all"
                >
                  <img
                    src={act.photos[0]}
                    alt={act.title}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#858394]">
                      <span className="text-[#34D399] font-bold">+{act.upvotes}</span>
                      <span>·</span>
                      <span className="text-[#6545C6] font-semibold">{act.topCategoryLabel}</span>
                    </div>
                    <h4 className="font-bold text-xs text-[#1F1B3D] truncate">
                      {act.title}
                    </h4>
                    <p className="text-[11px] text-[#858394] truncate">
                      📍 {act.locations[0]?.district || selectedCity}, {act.locations[0]?.address}
                    </p>
                    <p className="text-xs font-black text-[#1F1B3D]">
                      от {act.groups[0]?.priceFrom} руб. ПМР
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail(act);
                    }}
                    className="px-3 py-2 bg-[#EEEAFB] text-[#6545C6] text-xs font-bold rounded-xl shrink-0"
                  >
                    Подробнее
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: КАРТА ================= */}
        {activeTab === 'map' && (
          <div className="h-[calc(100vh-140px)] w-full p-2">
            <TransnistriaMap
              activities={activities}
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              onOpenDetail={onOpenDetail}
              onOpenBooking={onOpenBooking}
              isCompact={true}
            />
          </div>
        )}

        {/* ================= TAB 4: ИЗБРАННОЕ ================= */}
        {activeTab === 'favorites' && (
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-black text-[#1F1B3D]">Избранное</h2>
            {favoriteItems.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#EEEAFB] flex items-center justify-center text-[#6545C6] mx-auto">
                  <Heart className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-sm text-[#1F1B3D]">
                  В избранном пока ничего нет
                </h4>
                <p className="text-xs text-[#858394] max-w-xs mx-auto">
                  Нажимайте на сердечко у интересных секций и занятий, чтобы сохранить их сюда.
                </p>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="px-5 py-2.5 bg-[#6545C6] text-white text-xs font-bold rounded-xl shadow-md"
                >
                  Перейти в каталог
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {favoriteItems.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onOpenDetail(act)}
                    className="p-3.5 rounded-2xl bg-white border border-[#E5E4F2] shadow-xs flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <img
                      src={act.photos[0]}
                      alt={act.title}
                      className="w-14 h-14 rounded-xl object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-[#1F1B3D] truncate">
                        {act.title}
                      </h4>
                      <p className="text-[11px] text-[#6545C6] font-semibold">
                        от {act.groups[0]?.priceFrom} руб. ПМР
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(act.id);
                      }}
                      className="p-2 text-[#FF4444] hover:bg-red-50 rounded-xl"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: ПРОФИЛЬ ================= */}
        {activeTab === 'profile' && (
          <div className="p-4 space-y-5">
            {/* User Profile Card */}
            <div className="p-4 rounded-3xl bg-white border border-[#E5E4F2] shadow-xs flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] text-white flex items-center justify-center font-black text-xl shadow-md">
                {userName.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-base text-[#1F1B3D] truncate">
                  {userName}
                </h3>
                <p className="text-xs text-[#858394] truncate">
                  {userEmail || '+373 777 12 345'}
                </p>
              </div>
            </div>

            {/* My Bookings Section */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-sm text-[#1F1B3D]">
                Мои записи на занятия ({bookings.length})
              </h4>
              {bookings.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-[#E5E4F2] text-center text-xs text-[#858394]">
                  У вас пока нет активных записей.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-2xl bg-white border border-[#E5E4F2] shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#1F1B3D]">{b.activityTitle}</span>
                        <span className="text-[#34D399] font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Подтверждено
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#5B5870]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#6545C6]" />
                          {b.date}, {b.time}
                        </span>
                        <span>·</span>
                        <span>{b.format === 'trial' ? 'Пробное' : 'Абонемент'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-[#E5E4F2] text-[11px]">
                        <span className="text-[#858394] font-mono">#{b.id}</span>
                        <button
                          onClick={() => onCancelBooking(b.id)}
                          className="text-[#FF4444] font-bold hover:underline"
                        >
                          Отменить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Switch to Desktop if testing */}
            {onSwitchToDesktop && (
              <div className="pt-2">
                <button
                  onClick={onSwitchToDesktop}
                  className="w-full py-3 bg-white border border-[#E5E4F2] hover:border-[#6545C6] rounded-2xl text-xs font-bold text-[#6545C6] transition-colors shadow-xs"
                >
                  🖥️ Переключить на версию для ПК
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fixed Bottom Tab Navigation Bar (100% Native Mobile App Style) */}
      <nav className="fixed bottom-0 inset-x-0 h-16 bg-white/95 backdrop-blur-md border-t border-[#E5E4F2] grid grid-cols-5 items-center px-2 z-40 max-w-lg mx-auto pb-[env(safe-area-inset-bottom,0px)]">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'home' ? 'text-[#6545C6]' : 'text-[#858394]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Главная</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'catalog' ? 'text-[#6545C6]' : 'text-[#858394]'
          }`}
        >
          <Grid className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Каталог</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'map' ? 'text-[#6545C6]' : 'text-[#858394]'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Карта</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex flex-col items-center gap-1 cursor-pointer relative transition-colors ${
            activeTab === 'favorites' ? 'text-[#6545C6]' : 'text-[#858394]'
          }`}
        >
          <Heart className="w-5 h-5" />
          {favorites.length > 0 && (
            <span className="absolute top-0 right-3 w-3.5 h-3.5 bg-[#6545C6] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {favorites.length}
            </span>
          )}
          <span className="text-[10px] font-semibold">Избранное</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'profile' ? 'text-[#6545C6]' : 'text-[#858394]'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Профиль</span>
        </button>
      </nav>

      {/* Filter Bottom Sheet (Canvas / Slide-in Drawer) */}
      {showFilterSheet && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="flex-1"
            onClick={() => setShowFilterSheet(false)}
          />
          <div className="bg-white rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250 border-t border-[#E5E4F2] shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E4F2]">
              <div>
                <h3 className="font-extrabold text-base text-[#1F1B3D]">Фильтры</h3>
                <p className="text-[11px] text-[#858394]">Настройте параметры поиска</p>
              </div>
              <button
                onClick={() => setShowFilterSheet(false)}
                className="p-1.5 rounded-full text-[#858394] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Age Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1F1B3D]">Возраст ребёнка</label>
              <div className="grid grid-cols-6 gap-1.5">
                {[null, 5, 7, 8, 12, 14].map((age, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectAge(age)}
                    className={`py-2 text-xs font-bold rounded-xl transition-all ${
                      selectedAge === age
                        ? 'bg-[#6545C6] text-white shadow-xs'
                        : 'bg-[#F7F6FC] text-[#5B5870] hover:bg-[#EEEAFB]'
                    }`}
                  >
                    {age === null ? 'Все' : age}
                  </button>
                ))}
              </div>
            </div>

            {/* District Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1F1B3D]">Район города</label>
              <select
                value={selectedDistrict}
                onChange={(e) => onSelectDistrict(e.target.value)}
                className="w-full p-3 bg-[#F7F6FC] rounded-xl text-xs font-semibold text-[#1F1B3D] border border-[#E5E4F2] focus:outline-none focus:ring-2 focus:ring-[#6545C6]"
              >
                <option value="Все районы">Все районы</option>
                <option value="Центр">Центр</option>
                <option value="Балка">Балка</option>
                <option value="Западный">Западный</option>
                <option value="Бородинка">Бородинка</option>
                <option value="Северный">Северный</option>
              </select>
            </div>

            {/* Action button */}
            <button
              onClick={() => setShowFilterSheet(false)}
              className="w-full py-3.5 bg-[#6545C6] hover:bg-[#8064D8] text-white text-xs font-black rounded-xl shadow-md shadow-[#6545C6]/20 transition-all cursor-pointer"
            >
              Показать результаты ({filteredActivities.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
