/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { 
  ArrowRight, LayoutGrid, List, Sparkles, MapPin, 
  Heart, X, ArrowUpDown, Filter, ChevronRight, Phone, 
  HelpCircle, Shield, Building, User, CheckCircle2 
} from 'lucide-react';
import { 
  ACTIVITIES_DATA, 
  INITIAL_CONVERSATIONS, 
  TOP_CATEGORIES,
  DISTRICTS_TIRASPOL,
  INITIAL_REQUESTS,
  INITIAL_MODERATION_REPORTS,
  FREQUENT_SEARCH_QUERIES,
  ORGANIZATIONS_DATA
} from './data/mockData';
import { 
  ActivityItem, 
  TopCategoryId, 
  ActivityKind, 
  FormatType, 
  Booking, 
  Conversation, 
  UserRole,
  MissingRequest,
  ModerationReport,
  Organization
} from './types';
import { DesktopHeader } from './components/DesktopHeader';
import { HeroSection } from './components/HeroSection';
import { CategoryBar } from './components/CategoryBar';
import { FiltersSidebar } from './components/FiltersSidebar';
import { ActivityCard } from './components/ActivityCard';
import { TransnistriaMap } from './components/TransnistriaMap';
import { ActivityDetailModal } from './components/ActivityDetailModal';
import { BookingModal } from './components/BookingModal';
import { ProfileModal } from './components/ProfileModal';
import { MessagesModal } from './components/MessagesModal';
import { AboutSection } from './components/AboutSection';
import { MobileAppView } from './components/MobileAppView';
import { RulesModal } from './components/RulesModal';
import { MissingRequestModal } from './components/MissingRequestModal';
import { ModeratorCabinet } from './components/ModeratorCabinet';
import { OwnerCabinet } from './components/OwnerCabinet';
import { LoginModal } from './components/LoginModal';
import { OrganizationModal } from './components/OrganizationModal';

export default function App() {
  // Navigation & View Mode
  const [currentTab, setCurrentTab] = useState<'home' | 'catalog' | 'map' | 'about'>('home');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // User Role (§2: Гость, Участник, Владелец, Модератор)
  const [currentRole, setCurrentRole] = useState<UserRole>('user');
  const [userName, setUserName] = useState('Анна Петрова');
  const [userEmail, setUserEmail] = useState('anna.petrova@mail.ru');

  // Core Data
  const [activities, setActivities] = useState<ActivityItem[]>(ACTIVITIES_DATA);
  const [missingRequests, setMissingRequests] = useState<MissingRequest[]>(INITIAL_REQUESTS);
  const [reports, setReports] = useState<ModerationReport[]>(INITIAL_MODERATION_REPORTS);

  // Search & Filter state (synced with URL / history as per §3.1.3 & §5.8)
  const [selectedCity, setSelectedCity] = useState<string>('Тирасполь');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopCategory, setSelectedTopCategory] = useState<TopCategoryId | 'all'>('all');
  const [selectedKind, setSelectedKind] = useState<ActivityKind>('activity');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Все районы');
  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const [selectedTopCategories, setSelectedTopCategories] = useState<TopCategoryId[]>([]);
  const [isFreeOnly, setIsFreeOnly] = useState(false);
  const [isVerifiedOnly, setIsVerifiedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [selectedFormat, setSelectedFormat] = useState<FormatType | 'all'>('all');
  const [timeOfDay, setTimeOfDay] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [selectedSort, setSelectedSort] = useState<'popular' | 'rating' | 'price_asc' | 'price_desc' | 'new'>('popular');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(false);

  // User state: Favorites & Bookings
  const [favorites, setFavorites] = useState<string[]>(['act-1', 'act-3']);
  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: 'BK-847291',
      activityId: 'act-1',
      activityTitle: 'Художественная студия «Палитра»',
      format: 'trial',
      date: 'Ср 14 мая',
      time: '16:00',
      name: 'Анна Петрова',
      phone: '+373 777 12 345',
      status: 'confirmed',
      price: 0,
      createdAt: 'Сегодня, 10:15',
      address: 'Тирасполь, ул. 25 Октября, 74',
    },
  ]);

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);

  // Modals state
  const [detailActivity, setDetailActivity] = useState<ActivityItem | null>(null);
  const [bookingActivity, setBookingActivity] = useState<ActivityItem | null>(null);
  const [activeOrgModal, setActiveOrgModal] = useState<Organization | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [rulesDefaultTab, setRulesDefaultTab] = useState<'terms' | 'publish' | 'privacy' | 'about'>('about');
  const [isMissingRequestOpen, setIsMissingRequestOpen] = useState(false);
  const [isModeratorCabinetOpen, setIsModeratorCabinetOpen] = useState(false);
  const [isOwnerCabinetOpen, setIsOwnerCabinetOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Simulated quick filter loading effect
  const triggerLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 150);
  };

  // Toggle favorite
  const handleToggleFavorite = (id: string) => {
    if (currentRole === 'guest') {
      setIsLoginModalOpen(true);
      return;
    }
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Live Voting (+/-) (§10.2: NO STARS)
  const handleVote = (activityId: string, direction: 1 | -1) => {
    if (currentRole === 'guest') {
      setIsLoginModalOpen(true);
      return;
    }
    setActivities((prev) =>
      prev.map((act) => {
        if (act.id !== activityId) return act;
        let up = act.upvotes;
        let down = act.downvotes;
        let userVote: 1 | -1 | null = direction;

        if (act.userVote === direction) {
          // revoke vote
          if (direction === 1) up = Math.max(0, up - 1);
          if (direction === -1) down = Math.max(0, down - 1);
          userVote = null;
        } else {
          // change or new vote
          if (act.userVote === 1) up = Math.max(0, up - 1);
          if (act.userVote === -1) down = Math.max(0, down - 1);
          if (direction === 1) up += 1;
          if (direction === -1) down += 1;
        }

        return { ...act, upvotes: up, downvotes: down, userVote };
      })
    );
  };

  // Add review (§3.3.14)
  const handleAddReview = (activityId: string, text: string) => {
    const newRev = {
      id: 'rev-' + Date.now(),
      activityId,
      authorId: 'u-current',
      authorName: userName,
      text,
      createdAt: 'Сегодня, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      upvotes: 0,
      downvotes: 0,
      status: 'published' as const,
      comments: [],
    };

    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, reviews: [newRev, ...a.reviews] } : a))
    );
  };

  // Report activity / data outdated (§3.3.10)
  const handleReportActivity = (activityId: string, title: string, reason: string) => {
    const newReport: ModerationReport = {
      id: 'rep-' + Date.now(),
      targetType: 'activity',
      targetId: activityId,
      targetTitle: title,
      reason,
      createdAt: 'Сегодня',
      status: 'open',
    };
    setReports((prev) => [newReport, ...prev]);
  };

  // Moderator actions (§3.9)
  const handleApproveActivity = (id: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'published', verifiedAt: 'Сегодня' } : a))
    );
    alert('Анкета успешно одобрена и опубликована в каталоге!');
  };

  const handleRejectActivity = (id: string, reason: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'rejected', rejectReason: reason } : a))
    );
    alert(`Анкета отклонена с причиной: "${reason}". Уведомление отправлено владельцу.`);
  };

  const handleQuickEditActivity = (id: string, city: string, district: string, subcategory: string) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const updatedLocations = a.locations.map((l) => ({ ...l, city, district }));
        return { ...a, subcategory, locations: updatedLocations };
      })
    );
    alert('Служебные поля сохранены!');
  };

  const handleResolveReport = (reportId: string, action: 'hide' | 'dismiss') => {
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    alert(action === 'hide' ? 'Запись скрыта из каталога по жалобе.' : 'Жалоба отклонена.');
  };

  // Owner creation (§3.8)
  const handleCreateActivity = (newAct: ActivityItem) => {
    setActivities((prev) => [newAct, ...prev]);
    alert('Анкета создана и направлена на проверку модераторам Talentro!');
  };

  const handleToggleActive = (id: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
  };

  // Filter and Sort activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Must be active and published for guest/user
      if (currentRole !== 'moderator' && (!act.isActive || act.status !== 'published')) {
        return false;
      }

      // Kind (activity vs service)
      if (act.kind !== selectedKind) {
        return false;
      }

      // Query (q)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = act.title.toLowerCase().includes(q);
        const matchOrg = act.organization.name.toLowerCase().includes(q);
        const matchDesc = act.description.toLowerCase().includes(q);
        const matchCat = act.topCategoryLabel.toLowerCase().includes(q) || act.subcategory.toLowerCase().includes(q);
        const matchDist = act.locations.some(l => l.district?.toLowerCase().includes(q) || l.address.toLowerCase().includes(q));
        if (!matchTitle && !matchOrg && !matchDesc && !matchCat && !matchDist) return false;
      }

      // Top category
      if (selectedTopCategory !== 'all' && act.topCategory !== selectedTopCategory) {
        return false;
      }
      if (selectedTopCategories.length > 0 && !selectedTopCategories.includes(act.topCategory)) {
        return false;
      }

      // District
      if (selectedDistrict !== 'Все районы') {
        const hasDist = act.locations.some((l) => l.district === selectedDistrict);
        if (!hasDist) return false;
      }

      // Age filter (§5.2: возраст ребёнка одно число)
      if (selectedAge !== null && act.kind === 'activity') {
        const hasMatchingGroup = act.groups.some(
          (g) => g.ageFrom <= selectedAge && g.ageTo >= selectedAge
        );
        if (!hasMatchingGroup) return false;
      }

      // Free filter (§5.3)
      if (isFreeOnly) {
        const hasFreeGroup = act.groups.some((g) => g.priceFrom === 0);
        if (!hasFreeGroup) return false;
      }

      // Max price
      const lowestPrice = Math.min(...act.groups.map((g) => g.priceFrom));
      if (lowestPrice > maxPrice) {
        return false;
      }

      // Verified only (§5.5)
      if (isVerifiedOnly && !act.verifiedAt) {
        return false;
      }

      // Format
      if (selectedFormat !== 'all') {
        if (act.format !== selectedFormat && act.format !== 'both') return false;
      }

      return true;
    }).sort((a, b) => {
      if (selectedSort === 'rating') return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
      if (selectedSort === 'price_asc') {
        const minA = Math.min(...a.groups.map(g => g.priceFrom));
        const minB = Math.min(...b.groups.map(g => g.priceFrom));
        return minA - minB;
      }
      if (selectedSort === 'price_desc') {
        const minA = Math.min(...a.groups.map(g => g.priceFrom));
        const minB = Math.min(...b.groups.map(g => g.priceFrom));
        return minB - minA;
      }
      return (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes); // default popular/relevant
    });
  }, [
    activities,
    currentRole,
    selectedKind,
    searchQuery,
    selectedTopCategory,
    selectedTopCategories,
    selectedDistrict,
    selectedAge,
    isFreeOnly,
    isVerifiedOnly,
    maxPrice,
    selectedFormat,
    selectedSort,
  ]);

  const popularActivities = useMemo(() => {
    return activities.filter((a) => a.upvotes >= 20 && a.status === 'published');
  }, [activities]);

  const favoriteActivities = useMemo(() => {
    return activities.filter((a) => favorites.includes(a.id));
  }, [activities, favorites]);

  const handleOpenOrg = (orgId: string) => {
    const org = ORGANIZATIONS_DATA[orgId] || activities.find(a => a.orgId === orgId)?.organization;
    if (org) {
      setActiveOrgModal(org);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTopCategory('all');
    setSelectedKind('activity');
    setSelectedDistrict('Все районы');
    setSelectedAge(null);
    setSelectedTopCategories([]);
    setIsFreeOnly(false);
    setIsVerifiedOnly(false);
    setMaxPrice(5000);
    setSelectedFormat('all');
    setTimeOfDay('all');
    setSelectedSort('popular');
  };

  return (
    <div className="min-h-screen bg-[#F7F6FC] text-[#1F1B3D] flex flex-col font-sans">
      {/* Top Bar Banner with View Switch and Status */}
      <div className="bg-[#1F1B3D] text-white px-4 py-2 text-xs font-semibold">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
            <span className="truncate">
              Talentro — Единый каталог секций и услуг Приднестровья (Тирасполь, Бендеры, Рыбница)
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-slate-300 hidden sm:inline text-[11px]">
              Роль: <strong className="text-white">{currentRole === 'guest' ? 'Гость' : currentRole === 'owner' ? 'Владелец' : currentRole === 'moderator' ? 'Модератор' : 'Участник'}</strong>
            </span>
            <button
              onClick={() => setViewMode(viewMode === 'desktop' ? 'mobile' : 'desktop')}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-white font-bold transition-colors cursor-pointer text-[11px]"
            >
              {viewMode === 'desktop' ? '📱 Режим Смартфона' : '🖥️ Режим ПК'}
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'mobile' ? (
        /* Mobile Smartphone Mockup View */
        <main className="py-6 px-3 flex-1 flex items-center justify-center">
          <MobileAppView
            activities={activities}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onOpenDetail={(act) => setDetailActivity(act)}
            onOpenBooking={(act) => setBookingActivity(act)}
            selectedCity={selectedCity}
            onSelectCity={setSelectedCity}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedTopCategory as any}
            onSelectCategory={(c) => setSelectedTopCategory(c as any)}
            selectedType={selectedKind as any}
            onSelectType={(k) => setSelectedKind(k as any)}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={setSelectedDistrict}
            selectedAge={selectedAge}
            onSelectAge={setSelectedAge}
            bookings={bookings}
            conversations={conversations}
            onSendMessage={(convId, text) => {}}
            onCancelBooking={(id) => setBookings(bookings.filter(b => b.id !== id))}
          />
        </main>
      ) : (
        /* Desktop View matching Image 1 & ТЗ */
        <>
          <DesktopHeader
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            selectedCity={selectedCity}
            onSelectCity={setSelectedCity}
            favoritesCount={favorites.length}
            onOpenFavorites={() => {
              if (currentRole === 'guest') setIsLoginModalOpen(true);
              else setIsFavoritesOpen(true);
            }}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenMessages={() => setIsMessagesOpen(true)}
            viewMode={viewMode}
            onToggleViewMode={setViewMode}
            currentRole={currentRole}
            onChangeRole={setCurrentRole}
            onOpenOwnerCabinet={() => setIsOwnerCabinetOpen(true)}
            onOpenModeratorCabinet={() => setIsModeratorCabinetOpen(true)}
            onOpenRules={() => {
              setRulesDefaultTab('about');
              setIsRulesOpen(true);
            }}
          />

          {currentTab === 'about' ? (
            <main className="flex-1 px-4 sm:px-8 py-8">
              <AboutSection />
            </main>
          ) : currentTab === 'map' ? (
            /* Interactive Map View with OSM Attribution */
            <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-[#1F1B3D]">
                    Карта занятий и филиалов Приднестровья
                  </h2>
                  <p className="text-xs text-[#5B5870]">
                    Точные координаты секций в Тирасполе вдоль русла Днестра и по всей республике.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentTab('catalog')}
                  className="px-4 py-2 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Вернуться в каталог ➔
                </button>
              </div>

              <div className="h-[680px] w-full">
                <TransnistriaMap
                  activities={activities}
                  selectedCategory={selectedTopCategory}
                  onSelectCategory={setSelectedTopCategory}
                  onOpenDetail={(act) => setDetailActivity(act)}
                  onOpenBooking={(act) => setBookingActivity(act)}
                />
              </div>
            </main>
          ) : (
            /* Main Home / Catalog View */
            <main className="flex-1 flex flex-col">
              {currentTab === 'home' && (
                <HeroSection
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  selectedCity={selectedCity}
                  onCityChange={setSelectedCity}
                  onSearchSubmit={() => setCurrentTab('catalog')}
                />
              )}

              {/* Category Icons & Type bar */}
              <CategoryBar
                selectedType={selectedKind as any}
                onSelectType={(t) => {
                  setSelectedKind(t as any);
                  triggerLoading();
                }}
                selectedCategory={selectedTopCategory as any}
                onSelectCategory={(c) => {
                  setSelectedTopCategory(c as any);
                  triggerLoading();
                }}
                onOpenMap={() => setCurrentTab('map')}
              />

              {/* 5 Frequent Search Queries on empty search (§3.1.11, Table 16) */}
              {!searchQuery && (
                <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-0 w-full flex items-center gap-2 overflow-x-auto hide-scrollbar text-xs">
                  <span className="text-[#858394] shrink-0 font-medium">Часто ищут:</span>
                  {FREQUENT_SEARCH_QUERIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => setSearchQuery(q)}
                      className="px-3 py-1 bg-white hover:bg-[#EEEAFB] hover:text-[#6545C6] rounded-full border border-[#E5E4F2] text-[#5B5870] font-semibold transition-all shrink-0 cursor-pointer shadow-xs"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* 2-Column Desktop Grid Layout */}
              <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 w-full flex flex-col lg:flex-row gap-8 items-start">
                {/* Left Column: Filters Sidebar */}
                <div className="w-full lg:w-72 shrink-0">
                  <FiltersSidebar
                    selectedDistrict={selectedDistrict}
                    onDistrictChange={(d) => {
                      setSelectedDistrict(d);
                      triggerLoading();
                    }}
                    selectedAge={selectedAge}
                    onAgeChange={(a) => {
                      setSelectedAge(a);
                      triggerLoading();
                    }}
                    selectedKind={selectedKind}
                    onKindChange={(k) => {
                      setSelectedKind(k);
                      triggerLoading();
                    }}
                    selectedTopCategories={selectedTopCategories}
                    onToggleCategory={(cat) => {
                      setSelectedTopCategories(
                        selectedTopCategories.includes(cat)
                          ? selectedTopCategories.filter((c) => c !== cat)
                          : [...selectedTopCategories, cat]
                      );
                      triggerLoading();
                    }}
                    isFreeOnly={isFreeOnly}
                    onToggleFreeOnly={(val) => {
                      setIsFreeOnly(val);
                      triggerLoading();
                    }}
                    isVerifiedOnly={isVerifiedOnly}
                    onToggleVerifiedOnly={(val) => {
                      setIsVerifiedOnly(val);
                      triggerLoading();
                    }}
                    maxPrice={maxPrice}
                    onMaxPriceChange={(val) => {
                      setMaxPrice(val);
                      triggerLoading();
                    }}
                    selectedFormat={selectedFormat}
                    onFormatChange={(fmt) => {
                      setSelectedFormat(fmt);
                      triggerLoading();
                    }}
                    timeOfDay={timeOfDay}
                    onTimeOfDayChange={(t) => {
                      setTimeOfDay(t);
                      triggerLoading();
                    }}
                    totalFilteredCount={filteredActivities.length}
                    onResetFilters={handleResetFilters}
                  />
                </div>

                {/* Right Column: Listings Content */}
                <div className="flex-1 w-full space-y-8">
                  {/* Popular Scroller on Home */}
                  {currentTab === 'home' && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-black text-[#1F1B3D]">
                            Популярные направления
                          </h3>
                          <p className="text-xs text-[#858394]">
                            Выбирают чаще всего в Приднестровье
                          </p>
                        </div>
                        <button
                          onClick={() => setCurrentTab('catalog')}
                          className="text-xs font-bold text-[#6545C6] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Смотреть все</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {popularActivities.slice(0, 4).map((act) => (
                          <div
                            key={act.id}
                            onClick={() => setDetailActivity(act)}
                            className="group bg-white rounded-2xl border border-[#E5E4F2] hover:border-[#6545C6] shadow-sm hover:shadow-md transition-all p-3 cursor-pointer flex flex-col justify-between"
                          >
                            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#EEEAFB] mb-2">
                              <img
                                src={act.photos[0]}
                                alt={act.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-[#6545C6] font-extrabold uppercase">
                                {act.topCategoryLabel}
                              </span>
                              <h4 className="font-black text-xs text-[#1F1B3D] truncate group-hover:text-[#6545C6]">
                                {act.title}
                              </h4>
                              <p className="text-[11px] font-extrabold text-[#1F1B3D]">
                                от {act.groups[0]?.priceFrom} руб. ПМР
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Main Catalog Feed */}
                  <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E4F2]">
                      <div>
                        <h3 className="text-xl font-black text-[#1F1B3D]">
                          {currentTab === 'catalog' ? 'Каталог секций и услуг' : 'Все занятия и услуги'}
                        </h3>
                        <p className="text-xs text-[#858394]">
                          Найдено: {filteredActivities.length} {filteredActivities.length === 1 ? 'запись' : 'записей'}
                        </p>
                      </div>

                      {/* Sorting & Layout Toggles */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[#858394] hidden sm:inline">Сортировка:</span>
                          <select
                            value={selectedSort}
                            onChange={(e) => setSelectedSort(e.target.value as any)}
                            className="bg-white border border-[#E5E4F2] rounded-xl px-3 py-1.5 font-semibold text-[#1F1B3D] focus:ring-2 focus:ring-[#6545C6] cursor-pointer"
                          >
                            <option value="popular">По популярности</option>
                            <option value="rating">По рейтингу (+/-)</option>
                            <option value="price_asc">Сначала недорогие</option>
                            <option value="price_desc">Сначала дорогие</option>
                          </select>
                        </div>

                        <div className="flex items-center p-1 bg-[#EEEAFB] rounded-xl">
                          <button
                            onClick={() => setViewLayout('grid')}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              viewLayout === 'grid' ? 'bg-white text-[#6545C6] shadow-sm' : 'text-[#858394]'
                            }`}
                          >
                            <LayoutGrid className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewLayout('list')}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              viewLayout === 'list' ? 'bg-white text-[#6545C6] shadow-sm' : 'text-[#858394]'
                            }`}
                          >
                            <List className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Skeletons on loading (§3.1.9) */}
                    {isLoading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse space-y-3">
                            <div className="aspect-[16/10] bg-slate-200 rounded-xl" />
                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                            <div className="h-3 bg-slate-200 rounded w-1/2" />
                            <div className="h-8 bg-slate-200 rounded" />
                          </div>
                        ))}
                      </div>
                    ) : filteredActivities.length === 0 ? (
                      /* Empty state (§3.1.8: кнопка сброса + 3 карточки «рядом по теме» + форма «не нашли») */
                      <div className="space-y-6">
                        <div className="bg-white rounded-3xl p-8 text-center border border-[#E5E4F2] space-y-4">
                          <h4 className="text-lg font-black text-[#1F1B3D]">
                            Ничего не найдено по выбранным фильтрам
                          </h4>
                          <p className="text-xs text-[#5B5870] max-w-md mx-auto">
                            Попробуйте расширить диапазон возраста или снять фильтр по району.
                          </p>
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={handleResetFilters}
                              className="px-5 py-2.5 bg-[#6545C6] text-white text-xs font-bold rounded-xl shadow-md"
                            >
                              Сбросить все фильтры
                            </button>
                            <button
                              onClick={() => setIsMissingRequestOpen(true)}
                              className="px-5 py-2.5 bg-[#EEEAFB] text-[#6545C6] text-xs font-bold rounded-xl"
                            >
                              Оставить заявку «Не нашли занятие»
                            </button>
                          </div>
                        </div>

                        {/* 3 Cards «Рядом по теме» (§3.1.8) */}
                        <div className="space-y-3">
                          <h5 className="font-bold text-xs text-[#858394] uppercase tracking-wider">
                            Возможно, вам будет интересно (популярное в Приднестровье):
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {activities.slice(0, 3).map((act, idx) => (
                              <ActivityCard
                                key={act.id}
                                activity={act}
                                isFavorite={favorites.includes(act.id)}
                                onToggleFavorite={handleToggleFavorite}
                                onOpenDetail={(a) => setDetailActivity(a)}
                                onOpenBooking={(a) => setBookingActivity(a)}
                                isGuest={currentRole === 'guest'}
                                onGuestAction={() => setIsLoginModalOpen(true)}
                                onVote={handleVote}
                                filterAge={selectedAge}
                                index={idx}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Listings Grid with smooth emergence animation */
                      <div className={viewLayout === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-4'}>
                        <AnimatePresence mode="popLayout">
                          {filteredActivities.map((act, idx) => (
                            <ActivityCard
                              key={act.id}
                              activity={act}
                              isFavorite={favorites.includes(act.id)}
                              onToggleFavorite={handleToggleFavorite}
                              onOpenDetail={(a) => setDetailActivity(a)}
                              onOpenBooking={(a) => setBookingActivity(a)}
                              isGuest={currentRole === 'guest'}
                              onGuestAction={() => setIsLoginModalOpen(true)}
                              onVote={handleVote}
                              filterAge={selectedAge}
                              index={idx}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </main>
          )}

          {/* Desktop Footer complying with §3.11, §3.12, §12.7, §12.13 */}
          <footer className="bg-white border-t border-[#E5E4F2] py-10 px-4 sm:px-8 mt-12">
            <div className="max-w-7xl mx-auto space-y-6 text-xs text-[#858394]">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="font-black text-xl text-[#1F1B3D]">Talentro</span>
                  <p className="text-xs text-[#5B5870] mt-1 max-w-md">
                    Единая платформа для поиска детских и взрослых кружков, спортивных секций и услуг в Приднестровье.
                  </p>
                </div>

                {/* Footer Legal & Nav Links */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-semibold">
                  <button
                    onClick={() => {
                      setRulesDefaultTab('about');
                      setIsRulesOpen(true);
                    }}
                    className="hover:text-[#6545C6] transition-colors cursor-pointer"
                  >
                    О проекте
                  </button>
                  <button
                    onClick={() => {
                      setRulesDefaultTab('terms');
                      setIsRulesOpen(true);
                    }}
                    className="hover:text-[#6545C6] transition-colors cursor-pointer"
                  >
                    Условия пользования (/terms)
                  </button>
                  <button
                    onClick={() => {
                      setRulesDefaultTab('publish');
                      setIsRulesOpen(true);
                    }}
                    className="hover:text-[#6545C6] transition-colors cursor-pointer"
                  >
                    Правила публикации
                  </button>
                  <button
                    onClick={() => {
                      setRulesDefaultTab('privacy');
                      setIsRulesOpen(true);
                    }}
                    className="hover:text-[#6545C6] transition-colors cursor-pointer"
                  >
                    Обработка данных (ПМР)
                  </button>
                  <button
                    onClick={() => setIsMissingRequestOpen(true)}
                    className="text-[#6545C6] font-bold hover:underline cursor-pointer"
                  >
                    + Не нашли занятие?
                  </button>
                </div>
              </div>

              {/* Disclaimer (§12.13 ТЗ: прямой текст) */}
              <div className="p-3 bg-[#F7F6FC] rounded-xl border border-slate-200 text-[11px] leading-relaxed">
                <strong>Дисклеймер (§12.13 ТЗ):</strong> Каталог «Talentro» является неофициальным информационным сервисом, создан для конкурса и не является официальным сайтом перечисленных организаций. Данные взяты из открытых источников и актуальны на дату проверки. Картографические тайлы: © OpenStreetMap contributors (ODbL). Почта для обращений: team@talentro-pmr.org.
              </div>
            </div>
          </footer>
        </>
      )}

      {/* Modals and Drawers */}
      <ActivityDetailModal
        activity={detailActivity}
        isOpen={!!detailActivity}
        onClose={() => setDetailActivity(null)}
        isFavorite={detailActivity ? favorites.includes(detailActivity.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onStartBooking={(act) => {
          setDetailActivity(null);
          setBookingActivity(act);
        }}
        isGuest={currentRole === 'guest'}
        onGuestAction={() => setIsLoginModalOpen(true)}
        onVote={handleVote}
        onAddReview={handleAddReview}
        onReportActivity={handleReportActivity}
        onOpenOrgPage={handleOpenOrg}
      />

      <BookingModal
        activity={bookingActivity}
        isOpen={!!bookingActivity}
        onClose={() => setBookingActivity(null)}
        onConfirmBooking={(b) => setBookings([b, ...bookings])}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        bookings={bookings}
        onCancelBooking={(id) => setBookings(bookings.filter((b) => b.id !== id))}
        favoritesCount={favorites.length}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        onOpenMessages={() => setIsMessagesOpen(true)}
      />

      <MessagesModal
        isOpen={isMessagesOpen}
        onClose={() => setIsMessagesOpen(false)}
        conversations={conversations}
        onSendMessage={(convId, text) => {}}
      />

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        defaultTab={rulesDefaultTab}
      />

      <MissingRequestModal
        isOpen={isMissingRequestOpen}
        onClose={() => setIsMissingRequestOpen(false)}
        onSubmitRequest={(req) => setMissingRequests([req, ...missingRequests])}
      />

      <ModeratorCabinet
        isOpen={isModeratorCabinetOpen}
        onClose={() => setIsModeratorCabinetOpen(false)}
        activities={activities}
        onApproveActivity={handleApproveActivity}
        onRejectActivity={handleRejectActivity}
        onQuickEditActivity={handleQuickEditActivity}
        reports={reports}
        onResolveReport={handleResolveReport}
        missingRequests={missingRequests}
      />

      <OwnerCabinet
        isOpen={isOwnerCabinetOpen}
        onClose={() => setIsOwnerCabinetOpen(false)}
        myActivities={activities.filter((a) => a.orgId === 'org-1')}
        onCreateActivity={handleCreateActivity}
        onToggleActive={handleToggleActive}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccessLogin={(name, email) => {
          setUserName(name);
          setUserEmail(email);
          setCurrentRole('user');
        }}
        onOpenTerms={() => {
          setIsLoginModalOpen(false);
          setRulesDefaultTab('terms');
          setIsRulesOpen(true);
        }}
      />

      <OrganizationModal
        organization={activeOrgModal}
        isOpen={!!activeOrgModal}
        onClose={() => setActiveOrgModal(null)}
        orgActivities={activities.filter((a) => a.orgId === activeOrgModal?.id)}
        onSelectActivity={(act) => {
          setActiveOrgModal(null);
          setDetailActivity(act);
        }}
      />
    </div>
  );
}
