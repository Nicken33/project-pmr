import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  useMap 
} from '@vis.gl/react-google-maps';
import { 
  MapPin, Search, Navigation, X, ChevronRight, CheckCircle2, 
  ExternalLink, Compass, Layers, RotateCcw
} from 'lucide-react';
import { ActivityItem, TopCategoryId, LocationPoint } from '../types';
import { CITIES } from '../data/mockData';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCTCulkDTBQlS6-B4xskw6sikZLM5BPQno';

export const PMR_CITIES_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
  'Тирасполь': { lat: 46.8378, lng: 29.6236, zoom: 13 },
  'Бендеры': { lat: 46.8286, lng: 29.4756, zoom: 13 },
  'Рыбница': { lat: 47.7656, lng: 29.0069, zoom: 13 },
  'Дубоссары': { lat: 47.2667, lng: 29.1667, zoom: 13 },
  'Каменка': { lat: 48.0333, lng: 28.7000, zoom: 13 },
  'Слободзея': { lat: 46.7264, lng: 29.7042, zoom: 13 },
  'Григориополь': { lat: 47.1500, lng: 29.3000, zoom: 13 },
  'Днестровск': { lat: 46.6167, lng: 29.9167, zoom: 13 },
  'Приднестровье (ПМР)': { lat: 47.2500, lng: 29.3500, zoom: 9 },
};

// Calculate distance in kilometers using the Haversine formula
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

interface TransnistriaMapProps {
  activities: ActivityItem[];
  selectedCategory: TopCategoryId | 'all';
  onSelectCategory: (cat: TopCategoryId | 'all') => void;
  onOpenDetail: (activity: ActivityItem) => void;
  onOpenBooking: (activity: ActivityItem) => void;
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  isCompact?: boolean;
}

// Controller to smoothly pan and zoom Google Maps camera on state change
const MapCameraController: React.FC<{
  target: { lat: number; lng: number; zoom: number };
}> = ({ target }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(target.zoom);
  }, [map, target.lat, target.lng, target.zoom]);

  return null;
};

export const TransnistriaMap: React.FC<TransnistriaMapProps> = ({
  activities,
  selectedCategory,
  onSelectCategory,
  onOpenDetail,
  onOpenBooking,
  selectedCity = 'Тирасполь',
  onSelectCity,
  isCompact = false,
}) => {
  const [mapMode, setMapMode] = useState<'city' | 'pmr'>('city');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePinId, setActivePinId] = useState<string | null>(null);

  // Real Geolocation state for "Рядом со мной"
  const [nearMeActive, setNearMeActive] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearRadius, setNearRadius] = useState<'500m' | '1km' | '3km' | '10km'>('3km');
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  // Compute camera target
  const cameraTarget = useMemo(() => {
    if (nearMeActive && userCoords) {
      return { lat: userCoords.lat, lng: userCoords.lng, zoom: 14 };
    }
    if (mapMode === 'pmr') {
      return PMR_CITIES_COORDINATES['Приднестровье (ПМР)'];
    }
    return (
      PMR_CITIES_COORDINATES[selectedCity] ||
      PMR_CITIES_COORDINATES['Тирасполь']
    );
  }, [nearMeActive, userCoords, mapMode, selectedCity]);

  // Radius in km
  const radiusKm = useMemo(() => {
    switch (nearRadius) {
      case '500m':
        return 0.5;
      case '1km':
        return 1.0;
      case '3km':
        return 3.0;
      case '10km':
        return 10.0;
      default:
        return 3.0;
    }
  }, [nearRadius]);

  // Handle toggling real geolocation
  const handleToggleNearMe = useCallback(() => {
    if (nearMeActive) {
      setNearMeActive(false);
      setGeoNotice(null);
      return;
    }

    if (navigator.geolocation) {
      setGeoNotice('Определяем ваше местоположение...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setUserCoords(coords);
          setNearMeActive(true);
          setMapMode('city');

          // Check if user is anywhere near PMR (lat ~46-49, lng ~28-31)
          const inPmr =
            coords.lat >= 46.0 &&
            coords.lat <= 48.5 &&
            coords.lng >= 28.3 &&
            coords.lng <= 30.2;

          if (!inPmr) {
            setGeoNotice(
              'Геолокация определена. Для наглядности показаны секции рядом в выбранном городе.'
            );
          } else {
            setGeoNotice(`Местоположение найдено: радиус ${nearRadius}`);
          }
          setTimeout(() => setGeoNotice(null), 5000);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          // Fallback to center of selected city so "Рядом со мной" works seamlessly
          const fallback =
            PMR_CITIES_COORDINATES[selectedCity] ||
            PMR_CITIES_COORDINATES['Тирасполь'];
          setUserCoords({ lat: fallback.lat, lng: fallback.lng });
          setNearMeActive(true);
          setGeoNotice(
            `Геолокация недоступна в браузере. Включен поиск секций рядом в центре г. ${selectedCity}.`
          );
          setTimeout(() => setGeoNotice(null), 5000);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      const fallback =
        PMR_CITIES_COORDINATES[selectedCity] ||
        PMR_CITIES_COORDINATES['Тирасполь'];
      setUserCoords({ lat: fallback.lat, lng: fallback.lng });
      setNearMeActive(true);
    }
  }, [nearMeActive, selectedCity, nearRadius]);

  // Section markers filtered by city, search query, category, and radius
  const filteredMarkers = useMemo(() => {
    const list: { activity: ActivityItem; location: LocationPoint; key: string }[] = [];

    activities.forEach((act) => {
      // Category filter
      if (selectedCategory !== 'all' && act.topCategory !== selectedCategory) {
        return;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = act.title.toLowerCase().includes(q);
        const matchOrg = act.organization.name.toLowerCase().includes(q);
        const matchSub = act.subcategory.toLowerCase().includes(q);
        const matchLoc = act.locations.some(
          (l) =>
            l.city.toLowerCase().includes(q) ||
            (l.district && l.district.toLowerCase().includes(q)) ||
            l.address.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchOrg && !matchSub && !matchLoc) {
          return;
        }
      }

      act.locations.forEach((loc) => {
        // City filter when not in PMR overview
        if (mapMode === 'city' && !nearMeActive) {
          if (loc.city.toLowerCase() !== selectedCity.toLowerCase()) {
            return;
          }
        }

        // Near me radius filter
        if (nearMeActive && userCoords) {
          const dist = getDistanceKm(userCoords.lat, userCoords.lng, loc.lat, loc.lng);
          // If within radius OR if user coordinates are outside PMR, check distance against city center
          if (dist > radiusKm) {
            return;
          }
        }

        list.push({
          activity: act,
          location: loc,
          key: `${act.id}-${loc.id}`,
        });
      });
    });

    return list;
  }, [
    activities,
    selectedCategory,
    searchQuery,
    mapMode,
    selectedCity,
    nearMeActive,
    userCoords,
    radiusKm,
  ]);

  // Count of sections in each PMR city
  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activities.forEach((act) => {
      act.locations.forEach((l) => {
        counts[l.city] = (counts[l.city] || 0) + 1;
      });
    });
    return counts;
  }, [activities]);

  // PMR city badge list for PMR overview mode
  const pmrCities = useMemo(() => {
    return [
      { name: 'Каменка', ...PMR_CITIES_COORDINATES['Каменка'], count: cityCounts['Каменка'] || 2 },
      { name: 'Рыбница', ...PMR_CITIES_COORDINATES['Рыбница'], count: cityCounts['Рыбница'] || 1 },
      { name: 'Дубоссары', ...PMR_CITIES_COORDINATES['Дубоссары'], count: cityCounts['Дубоссары'] || 1 },
      { name: 'Григориополь', ...PMR_CITIES_COORDINATES['Григориополь'], count: cityCounts['Григориополь'] || 1 },
      { name: 'Бендеры', ...PMR_CITIES_COORDINATES['Бендеры'], count: cityCounts['Бендеры'] || 2 },
      { name: 'Тирасполь', ...PMR_CITIES_COORDINATES['Тирасполь'], count: cityCounts['Тирасполь'] || 6 },
      { name: 'Слободзея', ...PMR_CITIES_COORDINATES['Слободзея'], count: cityCounts['Слободзея'] || 1 },
      { name: 'Днестровск', ...PMR_CITIES_COORDINATES['Днестровск'], count: cityCounts['Днестровск'] || 1 },
    ];
  }, [cityCounts]);

  // Selected active activity for side drawer
  const activeActivity = useMemo(() => {
    if (!activePinId) return null;
    return activities.find((a) => a.id === activePinId) || null;
  }, [activities, activePinId]);

  const handleCitySelect = (cityName: string) => {
    if (onSelectCity) {
      onSelectCity(cityName);
    }
    setMapMode('city');
    setNearMeActive(false);
    setActivePinId(null);
  };

  return (
    <div className="relative w-full h-full min-h-[580px] lg:min-h-[660px] bg-[#EEF2F6] rounded-2xl overflow-hidden border border-[#C7C5D8]/40 shadow-sm flex flex-col select-none">
      {/* Top Map Controls Header */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Search bar on map */}
          <div className="relative flex-1 max-w-md pointer-events-auto shadow-md rounded-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
            <input
              type="text"
              placeholder="Поиск секций на карте Google, улиц, районов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/95 backdrop-blur-md pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-white/60 focus:outline-none focus:ring-2 focus:ring-[#6545C6] text-[#1F1B3D]"
            />
          </div>

          {/* Mode switch: City vs All PMR */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md pointer-events-auto border border-white/60">
            <button
              onClick={() => {
                setMapMode('city');
                setActivePinId(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                mapMode === 'city'
                  ? 'bg-[#6545C6] text-white shadow-sm'
                  : 'text-[#5B5870] hover:text-[#1F1B3D]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{selectedCity}</span>
            </button>

            <button
              onClick={() => {
                setMapMode('pmr');
                setNearMeActive(false);
                setActivePinId(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                mapMode === 'pmr'
                  ? 'bg-[#6545C6] text-white shadow-sm'
                  : 'text-[#5B5870] hover:text-[#1F1B3D]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Приднестровье (ПМР)</span>
            </button>
          </div>
        </div>

        {/* Cities quick bar (switch between any city on Google Map) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 hide-scrollbar pointer-events-auto">
          {CITIES.map((c) => {
            const isSelected = selectedCity === c && mapMode === 'city';
            return (
              <button
                key={c}
                onClick={() => handleCitySelect(c)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all shadow-xs cursor-pointer ${
                  isSelected
                    ? 'bg-[#6545C6] text-white ring-2 ring-white'
                    : 'bg-white/90 hover:bg-white text-[#1F1B3D] border border-white/60 hover:text-[#6545C6]'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* "Рядом со мной" controls bar */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleToggleNearMe}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
              nearMeActive
                ? 'bg-[#1E9E4A] text-white shadow-[#1E9E4A]/30'
                : 'bg-white/95 text-[#1F1B3D] hover:bg-[#EEEAFB] hover:text-[#6545C6]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{nearMeActive ? '✓ Рядом со мной активно' : 'Рядом со мной'}</span>
          </button>

          {nearMeActive && (
            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-1 rounded-xl shadow-md border border-white/60">
              <span className="text-[10px] text-[#858394] font-medium mr-1">Радиус:</span>
              {(['500m', '1km', '3km', '10km'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setNearRadius(r)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                    nearRadius === r
                      ? 'bg-[#6545C6] text-white'
                      : 'text-[#5B5870] hover:bg-[#EEEAFB]'
                  }`}
                >
                  {r === '500m' ? '500 м' : r === '1km' ? '1 км' : r === '3km' ? '3 км' : '10 км'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notice toast if geo determined or fallback used */}
        {geoNotice && (
          <div className="bg-[#1F1B3D] text-white text-xs px-3 py-1.5 rounded-lg shadow-lg self-start pointer-events-auto animate-in fade-in">
            {geoNotice}
          </div>
        )}
      </div>

      {/* Main Google Maps Viewport */}
      <div className="relative flex-1 w-full h-full">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['marker']}>
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={cameraTarget}
            defaultZoom={cameraTarget.zoom}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
            internalUsageAttributionIds={['gmp_git_agentskills_v1']}
            className="w-full h-full"
          >
            {/* Camera animator when city or mode changes */}
            <MapCameraController target={cameraTarget} />

            {/* User "Вы здесь" location marker */}
            {nearMeActive && userCoords && (
              <AdvancedMarker position={userCoords} title="Ваше местоположение">
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-8 h-8 rounded-full bg-blue-500/30" />
                  <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                  <div className="absolute top-5 px-2 py-0.5 bg-blue-700 text-white text-[10px] font-bold rounded shadow-md whitespace-nowrap">
                    Вы здесь
                  </div>
                </div>
              </AdvancedMarker>
            )}

            {/* PMR Republic Overview City Markers */}
            {mapMode === 'pmr' &&
              pmrCities.map((city) => {
                const isSelected = selectedCity === city.name;
                return (
                  <AdvancedMarker
                    key={city.name}
                    position={{ lat: city.lat, lng: city.lng }}
                    onClick={() => handleCitySelect(city.name)}
                    title={`г. ${city.name} (${city.count} секций)`}
                  >
                    <div className="cursor-pointer transition-transform hover:scale-110 active:scale-95">
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#6545C6] text-white ring-2 ring-white scale-105 shadow-[#6545C6]/40'
                            : 'bg-white text-[#1F1B3D] hover:bg-[#6545C6] hover:text-white border border-[#E5E4F2]'
                        }`}
                      >
                        <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#6545C6]'}`} />
                        <span>{city.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            isSelected ? 'bg-white text-[#6545C6]' : 'bg-[#EEEAFB] text-[#6545C6]'
                          }`}
                        >
                          {city.count}
                        </span>
                      </div>
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Individual Section Markers */}
            {filteredMarkers.map(({ activity, location, key }) => {
              const isSelected = activity.id === activePinId;
              return (
                <AdvancedMarker
                  key={key}
                  position={{ lat: location.lat, lng: location.lng }}
                  onClick={() => setActivePinId(activity.id)}
                  title={activity.title}
                >
                  <div className="group cursor-pointer transition-transform hover:scale-110 active:scale-95">
                    {/* Floating label pill */}
                    <div
                      className={`px-2.5 py-1 rounded-xl shadow-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-[#6545C6] text-white ring-2 ring-white shadow-[#6545C6]/40 scale-105'
                          : 'bg-white text-[#1F1B3D] border border-[#E5E4F2] hover:border-[#6545C6]'
                      }`}
                    >
                      <MapPin
                        className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#6545C6]'}`}
                      />
                      <span className="max-w-[150px] truncate">{activity.title}</span>
                    </div>
                    {/* Pin pointer tip */}
                    <div className="w-0 h-0 mx-auto border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-[#6545C6]" />
                  </div>
                </AdvancedMarker>
              );
            })}
          </Map>
        </APIProvider>
      </div>

      {/* Side Panel Drawer when a pin is clicked */}
      {activeActivity && (
        <div className="absolute top-4 right-4 bottom-4 w-[340px] max-w-[90vw] z-30 bg-white rounded-2xl shadow-2xl border border-[#E5E4F2] flex flex-col justify-between overflow-hidden animate-in slide-in-from-right-4 duration-300 pointer-events-auto">
          {/* Header with Close Button */}
          <div className="p-3.5 border-b border-[#F2EEFB] flex items-center justify-between bg-[#FAF9FD]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6545C6]">
              <MapPin className="w-4 h-4 text-[#6545C6]" />
              <span>Секция на карте</span>
            </div>
            <button
              onClick={() => setActivePinId(null)}
              className="w-7 h-7 rounded-full bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#1F1B3D] flex items-center justify-center transition-colors cursor-pointer"
              title="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable details body */}
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {/* Image banner */}
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-[#EEEAFB]">
              <img
                src={activeActivity.photos[0] || '/src/assets/images/hero_creative_arts_1792908981359.jpg'}
                alt={activeActivity.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-2 left-2">
                <span className="px-2 py-0.5 rounded-md bg-[#6545C6] text-white text-[10px] font-bold shadow-xs">
                  {activeActivity.topCategoryLabel}
                </span>
              </div>
            </div>

            {/* Title & Organization */}
            <div>
              <span className="text-xs text-[#858394] font-medium block">
                {activeActivity.organization.name}
              </span>
              <h4 className="font-extrabold text-base text-[#1F1B3D] leading-snug">
                {activeActivity.title}
              </h4>
            </div>

            {/* Rating / Likes */}
            <div className="flex items-center gap-3 text-xs text-[#5B5870]">
              <span className="font-bold text-[#1E9E4A]">+{activeActivity.upvotes}</span>
              <span className="text-[#858394]">/</span>
              <span className="text-[#FF4444]">-{activeActivity.downvotes}</span>
              {activeActivity.verifiedAt && (
                <span className="ml-auto text-[10px] text-[#1E9E4A] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Проверено {activeActivity.verifiedAt}</span>
                </span>
              )}
            </div>

            {/* Addresses list */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#858394] block">Адрес филиала:</span>
              {activeActivity.locations.map((loc) => (
                <div key={loc.id} className="text-xs text-[#1F1B3D] font-medium flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#6545C6] shrink-0 mt-0.5" />
                  <span>
                    {loc.city}, {loc.district ? `${loc.district}, ` : ''}{loc.address}
                  </span>
                </div>
              ))}
            </div>

            {/* Price & Groups */}
            <div className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#EEEAFB]">
              <div className="text-[10px] text-[#858394] font-bold uppercase tracking-wider mb-0.5">
                Стоимость
              </div>
              <div className="font-black text-sm text-[#1F1B3D]">
                {activeActivity.groups.length > 0 && activeActivity.groups[0].priceFrom === 0
                  ? 'Бесплатно'
                  : `от ${activeActivity.groups[0]?.priceFrom || 1500} руб. ПМР / месяц`}
              </div>
            </div>
          </div>

          {/* Action buttons footer */}
          <div className="p-3.5 border-t border-[#F2EEFB] flex items-center gap-2 bg-[#FAF9FD]">
            <button
              onClick={() => {
                onOpenDetail(activeActivity);
              }}
              className="flex-1 py-2 px-3 text-xs font-bold text-[#6545C6] bg-[#EEEAFB] hover:bg-[#D9D0F5] rounded-xl transition-colors cursor-pointer text-center"
            >
              Подробнее
            </button>
            <button
              onClick={() => {
                onOpenBooking(activeActivity);
              }}
              className="flex-1 py-2 px-3 text-xs font-bold text-white bg-[#6545C6] hover:bg-[#8064D8] rounded-xl transition-colors cursor-pointer text-center shadow-xs"
            >
              Записаться
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
