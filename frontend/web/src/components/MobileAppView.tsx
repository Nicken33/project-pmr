import React, { useState } from 'react';
import { 
  Home, Grid, MapPin, Heart, User, Search, SlidersHorizontal, 
  ChevronDown, Clock, ArrowRight, Bell, Share2, X, Plus, Phone, ThumbsUp 
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
  onSendMessage,
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
  const [favoritesTab, setFavoritesTab] = useState<'activities' | 'teachers'>('activities');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    const matchCat = selectedCategory === 'all' || act.topCategory === selectedCategory;
    const matchType = act.kind === selectedType;
    const matchDistrict = selectedDistrict === 'Все районы' || act.locations.some(l => l.district === selectedDistrict);
    const matchAge = selectedAge === null || act.groups.some(g => g.ageFrom <= selectedAge && g.ageTo >= selectedAge);
    const matchSearch =
      searchQuery.trim() === '' ||
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.locations.some(l => l.district?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchType && matchDistrict && matchAge && matchSearch;
  });

  const popularActivities = activities.filter((a) => a.upvotes >= 20);
  const favoriteItems = activities.filter((a) => favorites.includes(a.id));

  return (
    <div className="w-full sm:max-w-md mx-auto bg-white min-h-screen sm:min-h-[780px] shadow-2xl sm:rounded-[36px] overflow-hidden sm:border-8 border-slate-900 flex flex-col relative select-none">
      {/* Optional Desktop Switcher when previewing on desktop */}
      {onSwitchToDesktop && (
        <div className="hidden sm:flex items-center justify-between px-4 py-1.5 bg-slate-100 border-b border-slate-200 text-xs">
          <span className="text-[10px] text-slate-500 font-semibold">Предпросмотр смартфона</span>
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="text-[11px] font-bold text-[#6545C6] hover:underline cursor-pointer"
          >
            💻 Вернуться к ПК
          </button>
        </div>
      )}

      {/* iOS Top Status Bar */}
      <div className="h-10 bg-white flex items-center justify-between px-6 pt-2 shrink-0 select-none">
        <span className="text-xs font-black text-[#1F1B3D]">9:41</span>
        <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto" />
        <div className="flex items-center gap-1.5 text-xs text-[#1F1B3D]">
          <span className="text-[10px]">5G</span>
          <div className="w-4 h-2.5 border border-slate-800 rounded-sm p-0.5 flex items-center">
            <div className="w-full h-full bg-slate-800 rounded-xs" />
          </div>
        </div>
      </div>

      {/* Main Body per Tab */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* TAB 1: ГЛАВНАЯ */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Top Brand & City Header */}
            <div className="px-5 pt-3 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">t</span>
                </div>
                <span className="text-lg font-black text-[#1F1B3D]">Talentro</span>
                <span className="text-xs font-semibold text-[#6545C6] bg-[#EEEAFB] px-2 py-0.5 rounded-full">
                  {selectedCity}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('profile')}
                className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] text-white text-[11px] font-bold flex items-center justify-center cursor-pointer shadow-xs"
                title="Профиль"
              >
                {currentRole === 'guest' ? 'Г' : currentRole === 'owner' ? 'П' : currentRole === 'moderator' ? 'М' : 'АП'}
              </button>
            </div>

            {/* Hero Card */}
            <div className="px-5">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#EEEAFB] via-[#F7F6FC] to-[#D9D0F5]/50 p-5 shadow-sm border border-[#E5E4F2]">
                <div className="max-w-[200px]">
                  <h2 className="text-xl font-black text-[#1F1B3D] leading-tight">
                    Найди занятие <br />
                    <span className="text-[#6545C6]">по душе</span>
                  </h2>
                  <p className="text-[11px] text-[#5B5870] mt-1 leading-relaxed">
                    Секции, кружки и услуги рядом с вами в Тирасполе.
                  </p>
                </div>
                <img
                  src="/src/assets/images/hero_creative_arts_1792908981359.jpg"
                  alt="Talentro Hero"
                  className="absolute right-0 bottom-0 w-32 h-32 object-cover rounded-tl-3xl opacity-90"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Search Bar + Filter Trigger */}
            <div className="px-5 flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Поиск секций, услуг..."
                  className="w-full bg-[#F7F6FC] border border-[#E5E4F2] pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6]"
                />
              </div>
              <button
                onClick={() => setShowFilterSheet(true)}
                className="p-2.5 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] rounded-xl transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Categories Carousel */}
            <div className="pl-5">
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pr-5 py-1">
                <button
                  onClick={() => onSelectCategory('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-[#6545C6] text-white shadow-sm'
                      : 'bg-[#F7F6FC] text-[#5B5870]'
                  }`}
                >
                  Все
                </button>
                <button
                  onClick={() => onSelectCategory('art')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                    selectedCategory === 'art'
                      ? 'bg-[#6545C6] text-white shadow-sm'
                      : 'bg-[#F7F6FC] text-[#5B5870]'
                  }`}
                >
                  Творчество
                </button>
                <button
                  onClick={() => onSelectCategory('sport')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                    selectedCategory === 'sport'
                      ? 'bg-[#6545C6] text-white shadow-sm'
                      : 'bg-[#F7F6FC] text-[#5B5870]'
                  }`}
                >
                  Спорт
                </button>
                <button
                  onClick={() => onSelectCategory('tech')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                    selectedCategory === 'tech'
                      ? 'bg-[#6545C6] text-white shadow-sm'
                      : 'bg-[#F7F6FC] text-[#5B5870]'
                  }`}
                >
                  Технологии
                </button>
                <button
                  onClick={() => onSelectCategory('education')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                    selectedCategory === 'education'
                      ? 'bg-[#6545C6] text-white shadow-sm'
                      : 'bg-[#F7F6FC] text-[#5B5870]'
                  }`}
                >
                  Обучение
                </button>
              </div>
            </div>

            {/* Popular Section */}
            <div className="px-5">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-extrabold text-sm text-[#1F1B3D]">
                  Популярные направления
                </h3>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="text-xs text-[#6545C6] font-semibold flex items-center gap-0.5"
                >
                  <span>Все</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Horizontal Cards Scroll */}
              <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-2">
                {popularActivities.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onOpenDetail(act)}
                    className="w-44 shrink-0 bg-white rounded-2xl border border-[#E5E4F2] overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
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
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-[#FF4444]"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            favorites.includes(act.id) ? 'fill-[#FF4444]' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-2.5 space-y-1">
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-[#34D399] font-bold">+{act.upvotes}</span>
                        <span className="text-[#858394]">({act.reviews.length} отзывов)</span>
                      </div>
                      <h4 className="font-bold text-xs text-[#1F1B3D] truncate">
                        {act.title}
                      </h4>
                      <p className="text-[11px] font-extrabold text-[#6545C6]">
                        от {act.groups[0]?.priceFrom} руб. ПМР
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feed of all activities */}
            <div className="px-5 space-y-3 pt-2">
              <h3 className="font-extrabold text-sm text-[#1F1B3D]">
                Все секции ({filteredActivities.length})
              </h3>

              <div className="space-y-3">
                {filteredActivities.slice(0, 6).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onOpenDetail(act)}
                    className="p-3 rounded-2xl bg-white border border-[#E5E4F2] shadow-sm flex items-center gap-3 cursor-pointer hover:border-[#6545C6]"
                  >
                    <img
                      src={act.photos[0]}
                      alt={act.title}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-[11px] text-[#858394]">
                        <span className="text-[#34D399] font-bold">+{act.upvotes}</span>
                        <span className="text-[#6545C6] font-semibold">{act.topCategoryLabel}</span>
                      </div>
                      <h4 className="font-bold text-xs text-[#1F1B3D] truncate">
                        {act.title}
                      </h4>
                      <p className="text-[11px] text-[#858394] truncate">
                        {act.locations[0]?.district}, {act.locations[0]?.address}
                      </p>
                      <p className="text-xs font-black text-[#1F1B3D]">
                        от {act.groups[0]?.priceFrom} руб. ПМР / {act.groups[0]?.period}
                      </p>
                    </div>

                    <a
                      href={`tel:${act.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2.5 bg-[#34D399] text-white rounded-xl shadow-xs"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: КАТАЛОГ */}
        {activeTab === 'catalog' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#1F1B3D]">Каталог секций</h2>
              <button
                onClick={() => setShowFilterSheet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EEEAFB] text-[#6545C6] text-xs font-bold rounded-xl"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Фильтры</span>
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Поиск по названию или району..."
                className="w-full bg-[#F7F6FC] border border-[#E5E4F2] pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6]"
              />
            </div>

            <div className="space-y-3">
              {filteredActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => onOpenDetail(act)}
                  className="p-3.5 rounded-2xl bg-white border border-[#E5E4F2] shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-[#6545C6]"
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
                      📍 {act.locations[0]?.district}, {act.locations[0]?.address}
                    </p>
                    <p className="text-xs font-black text-[#1F1B3D]">
                      от {act.groups[0]?.priceFrom} руб. ПМР
                    </p>
                  </div>
                  <a
                    href={`tel:${act.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-2 bg-[#34D399] text-white text-xs font-bold rounded-xl flex items-center gap-1 shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Звонок</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: КАРТА */}
        {activeTab === 'map' && (
          <div className="h-full min-h-[580px] p-2">
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

        {/* TAB 4: ИЗБРАННОЕ */}
        {activeTab === 'favorites' && (
          <div className="p-5 space-y-4">
            <h2 className="text-lg font-black text-[#1F1B3D]">Избранное</h2>
            {favoriteItems.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#858394]">
                В избранном пока пусто. Добавляйте понравившиеся студии сердечком!
              </div>
            ) : (
              <div className="space-y-3">
                {favoriteItems.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onOpenDetail(act)}
                    className="p-3 rounded-2xl bg-white border border-[#E5E4F2] shadow-sm flex items-center gap-3 cursor-pointer"
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
                      <p className="text-[10px] text-[#858394] truncate">
                        {act.locations[0]?.district}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(act.id);
                      }}
                      className="p-2 text-[#FF4444]"
                    >
                      <Heart className="w-4 h-4 fill-[#FF4444]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ПРОФИЛЬ */}
        {activeTab === 'profile' && (
          <div className="p-5 space-y-4">
            {currentRole === 'guest' ? (
              <div className="p-6 bg-[#F7F6FC] rounded-2xl border border-[#E5E4F2] text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#EEEAFB] text-[#6545C6] flex items-center justify-center mx-auto shadow-sm">
                  <User className="w-7 h-7" />
                </div>
                <h3 className="font-extrabold text-base text-[#1F1B3D]">Вы вошли как Гость</h3>
                <p className="text-xs text-[#5B5870] max-w-xs mx-auto">
                  Зарегистрируйтесь или войдите, чтобы сохранять секции в Избранное, голосовать и управлять записями.
                </p>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="w-full py-3 bg-[#6545C6] hover:bg-[#8064D8] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Войти / Регистрация
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-[#F7F6FC] rounded-2xl border border-[#E5E4F2]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#6545C6] to-[#A998EA] flex items-center justify-center text-white font-bold text-base shrink-0">
                    {userName ? userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'АП'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-sm text-[#1F1B3D] truncate">{userName}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        currentRole === 'owner'
                          ? 'bg-[#6545C6]/15 text-[#6545C6]'
                          : currentRole === 'moderator'
                          ? 'bg-[#E11D48]/15 text-[#E11D48]'
                          : 'bg-[#059669]/15 text-[#059669]'
                      }`}>
                        {currentRole === 'owner' ? 'Владелец' : currentRole === 'moderator' ? 'Модератор' : 'Участник'}
                      </span>
                    </div>
                    <p className="text-xs text-[#858394] truncate">{userEmail || 'Тирасполь, ПМР'}</p>
                  </div>
                </div>

                {onOpenProfileModal && (
                  <button
                    type="button"
                    onClick={onOpenProfileModal}
                    className="p-2 text-[#6545C6] hover:bg-[#EEEAFB] rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Настройки
                  </button>
                )}
              </div>
            )}

            <div>
              <h4 className="font-bold text-xs text-[#1F1B3D] mb-2">Мои записи на занятия ({bookings.length})</h4>
              {bookings.length === 0 ? (
                <div className="p-4 bg-[#F7F6FC] rounded-xl text-center text-xs text-[#858394]">
                  Нет активных записей
                </div>
              ) : (
                <div className="space-y-2">
                  {bookings.map((b) => (
                    <div key={b.id} className="p-3 bg-white border border-[#E5E4F2] rounded-xl text-xs space-y-1.5 shadow-sm">
                      <div className="flex justify-between font-bold text-[#1F1B3D]">
                        <span className="truncate">{b.activityTitle}</span>
                        <span className="text-[#1E9E4A] font-semibold text-[10px]">✓ Подтверждено</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[#5B5870]">
                        <span>{b.date} в {b.time}</span>
                        <span className="font-bold">{b.format === 'trial' ? 'Бесплатно' : `${b.price} ₽`}</span>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => onCancelBooking(b.id)}
                          className="text-[10px] text-[#FF4444] font-semibold hover:underline"
                        >
                          Отменить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Tab Navigation Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-[#E5E4F2] grid grid-cols-5 items-center px-2 z-30">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'home' ? 'text-[#6545C6]' : 'text-[#858394]'}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Главная</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'catalog' ? 'text-[#6545C6]' : 'text-[#858394]'}`}
        >
          <Grid className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Каталог</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'map' ? 'text-[#6545C6]' : 'text-[#858394]'}`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Карта</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex flex-col items-center gap-1 cursor-pointer relative ${activeTab === 'favorites' ? 'text-[#6545C6]' : 'text-[#858394]'}`}
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
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'profile' ? 'text-[#6545C6]' : 'text-[#858394]'}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Профиль</span>
        </button>
      </div>

      {/* Filter Bottom Sheet */}
      {showFilterSheet && (
        <div className="absolute inset-0 bg-black/50 z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-5 space-y-4 max-h-[85%] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E4F2]">
              <h3 className="font-extrabold text-base text-[#1F1B3D]">Фильтры</h3>
              <button
                onClick={() => setShowFilterSheet(false)}
                className="p-1 rounded-full text-[#858394]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1F1B3D]">Возраст ребёнка</label>
              <div className="grid grid-cols-6 gap-1">
                {[null, 5, 7, 8, 12, 14].map((age, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectAge(age)}
                    className={`py-1.5 text-xs font-bold rounded-lg ${selectedAge === age ? 'bg-[#6545C6] text-white' : 'bg-[#F7F6FC] text-[#5B5870]'}`}
                  >
                    {age === null ? 'Все' : age}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1F1B3D]">Район</label>
              <select
                value={selectedDistrict}
                onChange={(e) => onSelectDistrict(e.target.value)}
                className="w-full p-2.5 bg-[#F7F6FC] rounded-xl text-xs font-semibold text-[#1F1B3D] border border-[#E5E4F2]"
              >
                <option value="Все районы">Все районы</option>
                <option value="Центр">Центр</option>
                <option value="Балка">Балка</option>
                <option value="Западный">Западный</option>
                <option value="Бородинка">Бородинка</option>
                <option value="Северный">Северный</option>
              </select>
            </div>

            <button
              onClick={() => setShowFilterSheet(false)}
              className="w-full py-3 bg-[#6545C6] text-white text-xs font-bold rounded-xl"
            >
              Показать результаты ({filteredActivities.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
