/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { 
  ArrowRight, LayoutGrid, List, Sparkles, MapPin, 
  Heart, X, ArrowUpDown, Filter, ChevronRight, Phone, 
  HelpCircle, Shield, Building, User, CheckCircle2,
  Search, SearchX, ArrowLeft 
} from 'lucide-react';
import { 
  ACTIVITIES_DATA, 
  INITIAL_CONVERSATIONS, 
  TOP_CATEGORIES,
  DISTRICTS_TIRASPOL,
  INITIAL_REQUESTS,
  INITIAL_MODERATION_REPORTS,
  FREQUENT_SEARCH_QUERIES,
  ORGANIZATIONS_DATA,
  CITIES,
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
import { FiltersSidebar, FilterState } from './components/FiltersSidebar';
import { ActivityCard } from './components/ActivityCard';
import { TransnistriaMap, PMR_CITIES_COORDINATES } from './components/TransnistriaMap';
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
  // Navigation & View Mode (auto-detected by viewport width)
  const [currentTab, setCurrentTab] = useState<'home' | 'catalog' | 'map' | 'about'>('home');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // User Role (§2: Не зарегистрирован — Гость; 3 роли для зарегистрированных в закулисье)
  const [currentRole, setCurrentRole] = useState<UserRole>('guest');
  const [userName, setUserName] = useState('Гость');
  const [userEmail, setUserEmail] = useState('');

  // Automatic device detection (phone vs desktop)
  useEffect(() => {
    const handleDeviceCheck = () => {
      // Screens under 768px (phones) automatically show mobile layout, larger show desktop
      const isMobile = window.innerWidth < 768;
      setViewMode(isMobile ? 'mobile' : 'desktop');
    };
    handleDeviceCheck();
    window.addEventListener('resize', handleDeviceCheck);
    return () => window.removeEventListener('resize', handleDeviceCheck);
  }, []);

  // Core Data
  const [activities, setActivities] = useState<ActivityItem[]>(ACTIVITIES_DATA);
  const [missingRequests, setMissingRequests] = useState<MissingRequest[]>(INITIAL_REQUESTS);
  const [reports, setReports] = useState<ModerationReport[]>(INITIAL_MODERATION_REPORTS);

  // Search & Filter state (synced with localStorage & URL)
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('talentro_city');
      if (saved && (CITIES as readonly string[]).includes(saved)) return saved;
    } catch {}
    return 'Тирасполь';
  });

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    try {
      localStorage.setItem('talentro_city', city);
    } catch {}
    triggerLoading();
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopCategory, setSelectedTopCategory] = useState<TopCategoryId | 'all'>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleToggleCategory = (catId: TopCategoryId | 'all') => {
    if (catId === 'all') {
      setSelectedCategories([]);
      setSelectedTopCategory('all');
    } else {
      setSelectedCategories((prev) => {
        if (prev.includes(catId)) {
          const next = prev.filter((c) => c !== catId);
          setSelectedTopCategory(next.length === 1 ? (next[0] as TopCategoryId) : next.length === 0 ? 'all' : (next[next.length - 1] as TopCategoryId));
          return next;
        } else {
          const next = [...prev, catId];
          setSelectedTopCategory(catId);
          return next;
        }
      });
    }
    triggerLoading();
  };

  const handleClearCategories = () => {
    setSelectedCategories([]);
    setSelectedTopCategory('all');
    triggerLoading();
  };

  const [selectedKind, setSelectedKind] = useState<ActivityKind>('activity');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Все районы');
  const [selectedAge, setSelectedAge] = useState<number | null>(null);

  // Modern interactive filter state (matching user specification)
  const [filterState, setFilterState] = useState<FilterState>({
    geo: [],
    category: [],
    priceMode: 'range',
    priceMin: null,
    priceMax: null,
    format: [],
    ageMin: null,
    ageMax: null,
    weekday: [],
    time: [],
    verified: false,
    nearby: false,
    photo: false,
  });

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Real browser geolocation when "Рядом со мной" is activated
  useEffect(() => {
    if (filterState.nearby && !userCoords) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            console.warn('Geolocation error:', err);
            const fallback =
              PMR_CITIES_COORDINATES[selectedCity] ||
              PMR_CITIES_COORDINATES['Тирасполь'];
            setUserCoords({ lat: fallback.lat, lng: fallback.lng });
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        const fallback =
          PMR_CITIES_COORDINATES[selectedCity] ||
          PMR_CITIES_COORDINATES['Тирасполь'];
        setUserCoords({ lat: fallback.lat, lng: fallback.lng });
      }
    }
  }, [filterState.nearby, userCoords, selectedCity]);

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
      prev.map((a) => (a.id === activityId ? { ...a, reviews: [newRev, ...a.reviews], upvotes: a.upvotes + 1 } : a))
    );

    setDetailActivity((current) =>
      current && current.id === activityId
        ? { ...current, reviews: [newRev, ...current.reviews], upvotes: current.upvotes + 1 }
        : current
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

  // Helper for real geolocation distance
  function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

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

      // Geo tree filter
      if (filterState.geo.length > 0) {
        const matchGeo = act.locations.some((l) =>
          filterState.geo.some((g) => {
            const [city, dist] = g.split('/');
            if (l.city.toLowerCase() !== city.toLowerCase()) return false;
            if (dist && l.district && l.district.toLowerCase() !== dist.toLowerCase()) return false;
            return true;
          })
        );
        if (!matchGeo) return false;
      } else {
        // Filter by selectedCity if no specific geo tree node is chosen
        const matchCity = act.locations.some(
          (l) => l.city.toLowerCase() === selectedCity.toLowerCase()
        );
        if (!matchCity) return false;
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

      // Category tree filter
      if (filterState.category.length > 0) {
        const matchCat = filterState.category.some((catPath) => {
          const leaf = catPath.split('/').pop()?.toLowerCase() || '';
          return (
            act.subcategory.toLowerCase().includes(leaf) ||
            act.topCategoryLabel.toLowerCase().includes(leaf) ||
            catPath.toLowerCase().includes(act.subcategory.toLowerCase())
          );
        });
        if (!matchCat) return false;
      } else if (selectedCategories.length > 0 && !selectedCategories.includes('all')) {
        if (!selectedCategories.includes(act.topCategory)) return false;
      } else if (selectedTopCategory !== 'all') {
        if (act.topCategory !== selectedTopCategory) return false;
      }

      // Price filter
      if (filterState.priceMode === 'free') {
        const hasFree = act.groups.some((g) => g.priceFrom === 0);
        if (!hasFree) return false;
      } else {
        if (filterState.priceMin !== null) {
          const hasMin = act.groups.some((g) => (g.priceTo || g.priceFrom) >= filterState.priceMin!);
          if (!hasMin) return false;
        }
        if (filterState.priceMax !== null) {
          const hasMax = act.groups.some((g) => g.priceFrom <= filterState.priceMax!);
          if (!hasMax) return false;
        }
      }

      // Format filter
      if (filterState.format.length > 0) {
        const matchFmt = filterState.format.some(
          (fmt) =>
            (fmt === 'Онлайн' && (act.format === 'online' || act.format === 'both')) ||
            (fmt === 'Офлайн' && (act.format === 'offline' || act.format === 'both'))
        );
        if (!matchFmt) return false;
      }

      // Age filter
      if (filterState.ageMin !== null) {
        const matchAgeMin = act.groups.some((g) => g.ageTo >= filterState.ageMin!);
        if (!matchAgeMin) return false;
      }
      if (filterState.ageMax !== null) {
        const matchAgeMax = act.groups.some((g) => g.ageFrom <= filterState.ageMax!);
        if (!matchAgeMax) return false;
      }

      // Weekdays
      if (filterState.weekday.length > 0) {
        const matchDay = act.groups.some((g) =>
          g.scheduleLines.some((s) => filterState.weekday.includes(s.day))
        );
        if (!matchDay) return false;
      }

      // Time of day
      if (filterState.time.length > 0) {
        const matchTime = act.groups.some((g) =>
          g.scheduleLines.some((s) => {
            return filterState.time.some((t) => {
              if (t === 'Утро') return s.startTime < '12:00';
              if (t === 'День') return s.startTime >= '12:00' && s.startTime < '17:00';
              if (t === 'Вечер') return s.startTime >= '17:00';
              return true;
            });
          })
        );
        if (!matchTime) return false;
      }

      // Verified only
      if (filterState.verified && !act.verifiedAt) {
        return false;
      }

      // Photo only
      if (filterState.photo && (!act.photos || act.photos.length === 0)) {
        return false;
      }

      // Nearby (real geolocation radius)
      if (filterState.nearby && userCoords) {
        const minDistance = Math.min(
          ...act.locations.map((l) => getDistanceKm(userCoords.lat, userCoords.lng, l.lat, l.lng))
        );
        const inPmr =
          userCoords.lat >= 46.0 &&
          userCoords.lat <= 48.5 &&
          userCoords.lng >= 28.3 &&
          userCoords.lng <= 30.2;
        if (inPmr && minDistance > 6) {
          return false;
        }
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
      return (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes);
    });
  }, [
    activities,
    currentRole,
    selectedKind,
    selectedCity,
    searchQuery,
    filterState,
    selectedTopCategory,
    selectedCategories,
    userCoords,
    selectedSort,
  ]);

  const popularActivities = useMemo(() => {
    const cityPopular = activities.filter(
      (a) => a.upvotes >= 20 && a.status === 'published' && a.locations.some(l => l.city.toLowerCase() === selectedCity.toLowerCase())
    );
    if (cityPopular.length >= 2) return cityPopular;
    return activities.filter((a) => a.upvotes >= 20 && a.status === 'published');
  }, [activities, selectedCity]);

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
    setSelectedCategories([]);
    setFilterState({
      geo: [],
      category: [],
      priceMode: 'range',
      priceMin: null,
      priceMax: null,
      format: [],
      ageMin: null,
      ageMax: null,
      weekday: [],
      time: [],
      verified: false,
      nearby: false,
      photo: false,
    });
    setSelectedSort('popular');
    triggerLoading();
  };

  return (
    <div className="min-h-screen bg-[#F7F6FC] text-[#1F1B3D] flex flex-col font-sans">
      {viewMode === 'mobile' ? (
        <main className="w-full min-h-screen bg-[#F7F6FC] flex-1 overflow-x-hidden">
          <MobileAppView
            activities={activities}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onOpenDetail={(act) => setDetailActivity(act)}
            onOpenBooking={(act) => setBookingActivity(act)}
            selectedCity={selectedCity}
            onSelectCity={handleCityChange}
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
            currentRole={currentRole}
            userName={userName}
            userEmail={userEmail}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onOpenProfileModal={() => setIsProfileOpen(true)}
            onSwitchToDesktop={() => setViewMode('desktop')}
          />
        </main>
      ) : (
        /* Desktop View matching Image 1 & ТЗ */
        <>
          <DesktopHeader
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            selectedCity={selectedCity}
            onSelectCity={handleCityChange}
            favoritesCount={favorites.length}
            onOpenFavorites={() => {
              if (currentRole === 'guest') setIsLoginModalOpen(true);
              else setIsFavoritesOpen(true);
            }}
            onOpenProfile={() => {
              if (currentRole === 'guest') setIsLoginModalOpen(true);
              else setIsProfileOpen(true);
            }}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onOpenMessages={() => setIsMessagesOpen(true)}
            currentRole={currentRole}
            onOpenOwnerCabinet={() => setIsOwnerCabinetOpen(true)}
            onOpenModeratorCabinet={() => setIsModeratorCabinetOpen(true)}
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
                    Карта занятий и филиалов: {selectedCity} и ПМР
                  </h2>
                  <p className="text-xs text-[#5B5870]">
                    Точные координаты секций в г. {selectedCity} и по всей республике.
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
                  selectedCity={selectedCity}
                  onSelectCity={handleCityChange}
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
                  onCityChange={handleCityChange}
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
                selectedCategories={selectedCategories}
                onToggleCategory={handleToggleCategory}
                onClearCategories={handleClearCategories}
                onOpenMap={() => setCurrentTab('map')}
              />

              {/* Dedicated Search Bar when on Catalog page (fixes missing search bar on Image 2) */}
              {currentTab === 'catalog' && (
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 pb-1 w-full">
                  <div className="relative flex items-center bg-white rounded-2xl border border-[#E5E4F2] shadow-xs px-4 py-3 focus-within:border-[#6545C6] focus-within:ring-2 focus-within:ring-[#6545C6]/20 transition-all">
                    <Search className="w-5 h-5 text-[#6545C6] shrink-0 mr-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск по названию секции, студии, виду спорта, танцам, репетиторам или району..."
                      className="w-full bg-transparent text-sm text-[#1F1B3D] placeholder-[#858394] outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="p-1 hover:bg-[#EEEAFB] text-[#858394] hover:text-[#1F1B3D] rounded-full transition-colors cursor-pointer"
                        title="Очистить поиск"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 5 Frequent Search Queries on empty search (§3.1.11, Table 16) */}
              {!searchQuery && (
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-3 pb-0 w-full flex items-center gap-2 overflow-x-auto hide-scrollbar text-xs">
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
              <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 w-full flex flex-col lg:flex-row gap-6 items-start">
                {/* Left Column: Filters Sidebar (Exact 264px Canonical Width) */}
                <div className="w-full lg:w-[264px] shrink-0">
                  <FiltersSidebar
                    filterState={filterState}
                    onFilterChange={(nextState) => {
                      setFilterState(nextState);
                      triggerLoading();
                    }}
                    onResetFilters={handleResetFilters}
                    onBack={() => setCurrentTab('home')}
                  />
                </div>

                {/* Right Column: Listings Content */}
                <div className="flex-1 w-full space-y-7">
                  {/* Popular Directions matching Image 2 */}
                  {currentTab === 'home' && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2.5">
                          <h3 className="text-lg font-black text-[#1F1B3D]">
                            Популярные направления
                          </h3>
                          <span className="text-xs text-[#858394]">
                            Выбирают чаще всего
                          </span>
                        </div>
                        <button
                          onClick={() => setCurrentTab('catalog')}
                          className="text-xs font-bold text-[#6545C6] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Смотреть все</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                        {popularActivities.slice(0, 6).map((act) => {
                          const ratingScore = Math.min(5.0, 4.5 + Math.min(0.5, act.upvotes * 0.01)).toFixed(1);
                          const totalRev = Math.max(12, act.upvotes + act.reviews.length * 3);
                          const isFav = favorites.includes(act.id);
                          return (
                            <div
                              key={act.id}
                              onClick={() => setDetailActivity(act)}
                              className="group bg-white rounded-2xl border border-[#E5E4F2] hover:border-[#6545C6]/40 shadow-xs hover:shadow-md transition-all p-2.5 cursor-pointer flex flex-col justify-between"
                            >
                              <div>
                                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#EEEAFB] mb-2">
                                  <img
                                    src={act.photos[0]}
                                    alt={act.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleFavorite(act.id);
                                    }}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-colors shadow-xs"
                                  >
                                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'text-[#FF4444] fill-[#FF4444]' : 'text-[#5B5870]'}`} />
                                  </button>
                                </div>
                                <h4 className="font-extrabold text-xs text-[#1F1B3D] truncate group-hover:text-[#6545C6] mb-1">
                                  {act.title}
                                </h4>
                                <div className="flex items-center gap-1.5 text-[11px] mb-1.5">
                                  <div className="flex items-center gap-0.5 font-bold text-[#1F1B3D]">
                                    <span className="text-[#FBBF24]">★</span>
                                    <span>{ratingScore}</span>
                                    <span className="text-[#858394] font-normal">({totalRev})</span>
                                  </div>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#EEEAFB] text-[#6545C6] font-semibold truncate max-w-[70px]">
                                    {act.topCategoryLabel.split(' ')[0]}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs font-black text-[#1F1B3D]">
                                от {act.groups[0]?.priceFrom || 1500} ₽ / месяц
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Main Catalog Feed matching Image 2 */}
                  <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E4F2]">
                      <div className="flex items-baseline gap-2.5">
                        <h3 className="text-lg font-black text-[#1F1B3D]">
                          {currentTab === 'catalog' ? 'Каталог секций и услуг' : 'Все занятия и услуги'}
                        </h3>
                        <span className="text-xs text-[#858394]">
                          Найдено {filteredActivities.length} {filteredActivities.length === 1 ? 'вариант' : filteredActivities.length < 5 ? 'варианта' : 'вариантов'}
                        </span>
                      </div>

                      {/* Sorting & Layout Toggles */}
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <select
                            value={selectedSort}
                            onChange={(e) => setSelectedSort(e.target.value as any)}
                            className="bg-white border border-[#E5E4F2] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1F1B3D] focus:ring-1 focus:ring-[#6545C6] cursor-pointer"
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

                    {/* Skeletons on loading */}
                    {isLoading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <div key={n} className="bg-white rounded-2xl p-3 border border-slate-200 animate-pulse space-y-2">
                            <div className="aspect-[4/3] bg-slate-200 rounded-xl" />
                            <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                            <div className="h-3 bg-slate-200 rounded w-1/2" />
                            <div className="h-7 bg-slate-200 rounded-lg" />
                          </div>
                        ))}
                      </div>
                    ) : filteredActivities.length === 0 ? (
                      /* Empty state */
                      <div className="space-y-6">
                        <div className="bg-white rounded-3xl p-8 text-center border border-[#E5E4F2] space-y-4">
                          <div className="w-14 h-14 mx-auto rounded-full bg-[#EEEAFB] flex items-center justify-center text-[#6545C6]">
                            <SearchX className="w-7 h-7" />
                          </div>
                          <h4 className="text-lg font-black text-[#1F1B3D]">
                            {searchQuery.trim()
                              ? `Ничего не найдено по запросу «${searchQuery}»`
                              : 'Ничего не найдено по выбранным фильтрам'}
                          </h4>
                          <p className="text-xs text-[#5B5870] max-w-md mx-auto">
                            {searchQuery.trim()
                              ? 'Проверьте правильность написания или попробуйте изменить поисковую фразу.'
                              : 'Попробуйте снять фильтр по району, сбросить категорию или расширить возрастной диапазон.'}
                          </p>
                          <div className="flex flex-wrap justify-center gap-3 pt-1">
                            {searchQuery.trim() && (
                              <button
                                onClick={() => setSearchQuery('')}
                                className="px-5 py-2.5 bg-[#6545C6] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer hover:bg-[#8064D8] transition-colors"
                              >
                                Очистить строку поиска
                              </button>
                            )}
                            <button
                              onClick={handleResetFilters}
                              className="px-5 py-2.5 bg-[#EEEAFB] text-[#6545C6] text-xs font-bold rounded-xl cursor-pointer hover:bg-[#D9D0F5] transition-colors"
                            >
                              Сбросить все фильтры
                            </button>
                            <button
                              onClick={() => setIsMissingRequestOpen(true)}
                              className="px-5 py-2.5 bg-white border border-[#E5E4F2] text-[#1F1B3D] text-xs font-bold rounded-xl cursor-pointer hover:bg-[#FAF9FD] transition-colors"
                            >
                              Оставить заявку «Не нашли занятие»
                            </button>
                          </div>
                        </div>

                        {/* 3 Cards «Рядом по теме» */}
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
                      /* Listings Grid in 6 columns on large screen */
                      <div className={viewLayout === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3' : 'space-y-4'}>
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
                  <img
                    src="/assets/talentro-logo.png"
                    alt="Talentro"
                    className="h-8 w-auto object-contain mb-1.5"
                  />
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

              <div className="flex items-center justify-between pt-2 border-t border-[#E5E4F2]/50 text-[11px] text-[#858394]">
                <span>© 2026 Talentro. Единая платформа поиска кружков и секций в ПМР.</span>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'desktop' ? 'mobile' : 'desktop')}
                  className="hover:text-[#6545C6] transition-colors cursor-pointer"
                >
                  {viewMode === 'desktop' ? '📱 Предпросмотр мобильного вида' : '💻 Режим ПК'}
                </button>
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
        currentRole={currentRole}
        userName={userName}
        userEmail={userEmail}
        onChangeRole={(newRole) => {
          setCurrentRole(newRole);
          if (newRole === 'user') {
            setUserName('Анна Петрова');
            setUserEmail('anna.petrova@mail.ru');
          } else if (newRole === 'owner') {
            setUserName('Художественная студия «Палитра»');
            setUserEmail('palitra.pmr@mail.ru');
          } else if (newRole === 'moderator') {
            setUserName('Модератор Talentro');
            setUserEmail('moderator@talentro-pmr.org');
          }
        }}
        onOpenOwnerCabinet={() => setIsOwnerCabinetOpen(true)}
        onOpenModeratorCabinet={() => setIsModeratorCabinetOpen(true)}
        onLogout={() => {
          setCurrentRole('guest');
          setUserName('Гость');
          setUserEmail('');
        }}
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
        onSuccessLogin={(name, email, role) => {
          setUserName(name);
          setUserEmail(email);
          setCurrentRole(role);
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
