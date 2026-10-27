import React, { useState, useMemo } from 'react';
import { 
  Palette, Dumbbell, Laptop, GraduationCap, PawPrint, 
  Heart, Wrench, Mountain, Users, MapPin, ZoomIn, ZoomOut, 
  RotateCcw, Search, Navigation, Layers, Compass, ExternalLink 
} from 'lucide-react';
import { ActivityItem, TopCategoryId, LocationPoint } from '../types';

interface TransnistriaMapProps {
  activities: ActivityItem[];
  selectedCategory: TopCategoryId | 'all';
  onSelectCategory: (cat: TopCategoryId | 'all') => void;
  onOpenDetail: (activity: ActivityItem) => void;
  onOpenBooking: (activity: ActivityItem) => void;
  isCompact?: boolean;
}

export const TransnistriaMap: React.FC<TransnistriaMapProps> = ({
  activities,
  selectedCategory,
  onSelectCategory,
  onOpenDetail,
  onOpenBooking,
  isCompact = false,
}) => {
  const [mapMode, setMapMode] = useState<'pmr' | 'tiraspol'>('pmr');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePinId, setActivePinId] = useState<string | null>('act-1');
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearRadius, setNearRadius] = useState<'500m' | '1km' | '3km' | '10km'>('3km');

  // Filter activities for map
  const mapActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchCat = selectedCategory === 'all' || act.topCategory === selectedCategory;
      const matchSearch =
        searchQuery.trim() === '' ||
        act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.locations.some(l => l.district?.toLowerCase().includes(searchQuery.toLowerCase()) || l.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        act.subcategory.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activities, selectedCategory, searchQuery]);

  // Generate location markers (one per point, but activity stays unified)
  const locationMarkers = useMemo(() => {
    const markers: { activity: ActivityItem; location: LocationPoint; key: string }[] = [];
    mapActivities.forEach((act) => {
      act.locations.forEach((loc) => {
        markers.push({
          activity: act,
          location: loc,
          key: `${act.id}-${loc.id}`,
        });
      });
    });
    return markers;
  }, [mapActivities]);

  const activeActivity = useMemo(() => {
    return activities.find((a) => a.id === activePinId) || mapActivities[0] || null;
  }, [activities, activePinId, mapActivities]);

  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  // Prevent whole page from scrolling when zooming or panning map with wheel
  React.useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoomLevel((prev) => Math.min(Math.max(0.6, prev + delta), 3.5));
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(0.6, prev + delta), 3.5));
  };

  const handleReset = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setNearMeActive(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...pan };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxPan = 600 * zoomLevel;
    const newX = Math.min(Math.max(-maxPan, initialPanRef.current.x + dx), maxPan);
    const newY = Math.min(Math.max(-maxPan, initialPanRef.current.y + dy), maxPan);
    setPan({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  const pmrCities = [
    { name: 'Каменка', x: '21%', y: '8%', count: 1 },
    { name: 'Рыбница', x: '42%', y: '24%', count: 2 },
    { name: 'Дубоссары', x: '52%', y: '49%', count: 2 },
    { name: 'Григориополь', x: '62%', y: '62%', count: 1 },
    { name: 'Бендеры', x: '63%', y: '78%', count: 4 },
    { name: 'Тирасполь', x: '74%', y: '77%', count: 12 },
    { name: 'Слободзея', x: '76%', y: '85%', count: 2 },
    { name: 'Днестровск', x: '87%', y: '92%', count: 1 },
  ];

  const handleSelectCity = (cityName: string) => {
    const match = activities.find(a => 
      a.locations.some(l => l.city.toLowerCase() === cityName.toLowerCase()) ||
      a.title.toLowerCase().includes(cityName.toLowerCase())
    );
    if (match) {
      setActivePinId(match.id);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[520px] lg:min-h-[620px] bg-[#EEF2F6] rounded-2xl overflow-hidden border border-[#C7C5D8]/40 shadow-sm flex flex-col">
      {/* Top Map Controls Header */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-none">
        {/* Search input and mode switch */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 max-w-md pointer-events-auto shadow-md rounded-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858394]" />
            <input
              type="text"
              placeholder="Поиск секций рядом, улиц, районов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/95 backdrop-blur-md pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-white/60 focus:outline-none focus:ring-2 focus:ring-[#6545C6] text-[#1F1B3D]"
            />
          </div>

          {/* Region Mode Switcher */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md pointer-events-auto border border-white/60">
            <button
              onClick={() => setMapMode('tiraspol')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                mapMode === 'tiraspol'
                  ? 'bg-[#6545C6] text-white shadow-sm'
                  : 'text-[#5B5870] hover:text-[#1F1B3D]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              Тирасполь
            </button>
            <button
              onClick={() => setMapMode('pmr')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                mapMode === 'pmr'
                  ? 'bg-[#6545C6] text-white shadow-sm'
                  : 'text-[#5B5870] hover:text-[#1F1B3D]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Приднестровье (ПМР)
            </button>
          </div>
        </div>

        {/* «Рядом со мной» radius chips (§3.5.6: 500м / 1км / 3км / 10км) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setNearMeActive(!nearMeActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              nearMeActive
                ? 'bg-[#34D399] text-white shadow-md'
                : 'bg-white/95 text-[#5B5870] hover:bg-white hover:text-[#1F1B3D]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Рядом со мной</span>
          </button>

          {nearMeActive && (
            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-sm border border-white/60 animate-in fade-in">
              {(['500m', '1km', '3km', '10km'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setNearRadius(r)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
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
      </div>

      {/* Map Zoom Controls on Right */}
      <div className="absolute right-4 top-28 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-white/60">
        <button
          onClick={() => handleZoom(0.2)}
          title="Приблизить"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5B5870] hover:bg-[#EEEAFB] hover:text-[#6545C6] transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-0.2)}
          title="Отдалить"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5B5870] hover:bg-[#EEEAFB] hover:text-[#6545C6] transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-200 my-0.5" />
        <button
          onClick={handleReset}
          title="Сбросить масштаб"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5B5870] hover:bg-[#EEEAFB] hover:text-[#6545C6] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* SVG / Image Map Container with Interactive Pan and Zoom */}
      <div
        ref={mapContainerRef}
        className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center select-none cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="w-full h-full will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transition: isDragging ? 'none' : 'transform 0.22s ease-out',
            transformOrigin: 'center center',
          }}
        >
          {mapMode === 'tiraspol' ? (
            /* Detailed Map of Tiraspol with Districts, Dniester River, Bridges, and Roads */
            <svg
              viewBox="0 0 1000 700"
              className="w-full h-full object-cover"
              style={{ backgroundColor: '#F0F4F8' }}
            >
              <defs>
                <linearGradient id="dniesterWater" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A8D8F0" />
                  <stop offset="50%" stopColor="#8AC6EB" />
                  <stop offset="100%" stopColor="#6CAED8" />
                </linearGradient>
                <linearGradient id="parkGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E2F4DF" />
                  <stop offset="100%" stopColor="#D5EED1" />
                </linearGradient>
                <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.3" floodColor="#1F1B3D" />
                </filter>
              </defs>

              {/* Districts */}
              <rect x="60" y="240" width="280" height="260" rx="20" fill="#EBF2F8" />
              <rect x="360" y="100" width="340" height="200" rx="24" fill="#E9EEF5" />
              <rect x="360" y="310" width="280" height="240" rx="24" fill="#E4E9F2" />
              <rect x="660" y="280" width="290" height="300" rx="24" fill="#E8EDF6" />
              <rect x="240" y="90" width="200" height="150" rx="16" fill="#EFF3F9" />

              {/* Catherine Park (Екатерининский парк) */}
              <path
                d="M 440 430 C 470 410, 520 410, 550 435 C 540 465, 480 470, 440 430 Z"
                fill="url(#parkGreen)"
              />
              <text x="470" y="445" fontSize="10" fill="#4E8D42" fontWeight="600" opacity="0.8">
                Екатерининский парк
              </text>

              {/* Sheriff Complex Grounds */}
              <rect x="180" y="280" width="120" height="90" rx="8" fill="#DDE8F2" stroke="#BCCFE0" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="190" y="325" fontSize="10" fill="#4F718F" fontWeight="700">
                СК «Шериф»
              </text>

              {/* The River Dniester (Река Днестр) */}
              <path
                d="M 20 620 C 140 600, 240 590, 360 560 C 460 535, 540 560, 620 620 C 700 680, 800 660, 980 620 L 980 680 L 20 680 Z"
                fill="url(#dniesterWater)"
              />
              <text x="480" y="585" fontSize="14" fill="#478BB8" fontWeight="700" letterSpacing="4">
                РЕКА ДНЕСТР
              </text>

              {/* Bridges over Dniester */}
              <line x1="490" y1="530" x2="505" y2="590" stroke="#8E99A8" strokeWidth="6" strokeLinecap="round" />
              <line x1="490" y1="530" x2="505" y2="590" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />

              {/* Main Major Road Arteries */}
              <path
                d="M 120 420 L 340 420 L 460 410 L 640 430 L 880 430"
                fill="none"
                stroke="#D3DBE6"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 120 420 L 340 420 L 460 410 L 640 430 L 880 430"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <text x="465" y="402" fontSize="9" fill="#758296" fontWeight="600">
                ул. 25 Октября
              </text>

              <path
                d="M 60 320 L 360 320 L 640 310 L 940 310"
                fill="none"
                stroke="#D3DBE6"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 60 320 L 360 320 L 640 310 L 940 310"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <text x="210" y="312" fontSize="9" fill="#758296" fontWeight="600">
                ул. Карла Либкнехта
              </text>

              <path
                d="M 680 310 L 740 410 L 790 520"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <text x="750" y="460" fontSize="9" fill="#758296" fontWeight="600">
                ул. Юности (Балка)
              </text>

              {/* District Labels */}
              <text x="440" y="355" fontSize="13" fill="#1F1B3D" fontWeight="800" opacity="0.85">
                ЦЕНТР ГОРОДА
              </text>
              <text x="730" y="340" fontSize="13" fill="#1F1B3D" fontWeight="800" opacity="0.85">
                БАЛКА (ОКТЯБРЬСКИЙ)
              </text>
              <text x="140" y="270" fontSize="12" fill="#1F1B3D" fontWeight="800" opacity="0.85">
                ЗАПАДНЫЙ РАЙОН
              </text>
              <text x="440" y="150" fontSize="12" fill="#1F1B3D" fontWeight="800" opacity="0.85">
                СЕВЕРНЫЙ РАЙОН
              </text>

              {/* Location Markers with Coordinates */}
              {locationMarkers.map(({ activity, location, key }) => {
                const isSelected = activity.id === activePinId;
                // Calculate SVG coordinates from lat/lng in Tiraspol bounds
                // Tiraspol lat: 46.820 - 46.860, lng: 29.540 - 29.670
                const px = ((location.lng - 29.540) / (29.670 - 29.540)) * 900 + 50;
                const py = 700 - (((location.lat - 46.820) / (46.860 - 46.820)) * 600 + 50);

                return (
                  <g
                    key={key}
                    className="cursor-pointer transition-transform duration-200"
                    onClick={() => setActivePinId(activity.id)}
                    transform={`translate(${px}, ${py}) scale(${isSelected ? 1.25 : 1})`}
                    style={{ transformOrigin: `${px}px ${py}px` }}
                  >
                    {isSelected && (
                      <circle cx={0} cy={-14} r="24" fill="#6545C6" opacity="0.25" className="animate-ping" />
                    )}

                    <path
                      d="M 0 0 C -10 -14, -14 -22, -14 -30 C -14 -38, -8 -44, 0 -44 C 8 -44, 14 -38, 14 -30 C 14 -22, 10 -14, 0 0 Z"
                      fill={isSelected ? '#6545C6' : '#8064D8'}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      filter="url(#pinShadow)"
                    />
                    <circle cx={0} cy={-29} r="9" fill="#FFFFFF" />
                    <circle cx={0} cy={-29} r="7" fill={isSelected ? '#6545C6' : '#8064D8'} />

                    {isSelected && (
                      <g transform="translate(0, -52)">
                        <rect x={-60} y={-18} width={120} height={22} rx={6} fill="#1F1B3D" opacity="0.92" />
                        <text x={0} y={-4} textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="700">
                          {activity.title.length > 18 ? activity.title.slice(0, 16) + '...' : activity.title}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            /* Full Transnistria PMR Authentic Clean Map */
            <div className="relative w-full h-full min-h-[580px] flex items-center justify-center p-2 sm:p-4">
              <div className="relative inline-block max-w-full max-h-full">
                <img
                  src="/assets/aistudio/image_bc1eb853.png"
                  alt="Карта Приднестровья (ПМР)"
                  className="max-h-[640px] sm:max-h-[720px] w-auto object-contain drop-shadow-lg select-none pointer-events-none"
                  draggable={false}
                />

                {/* Overlaid interactive city pins on authentic map */}
                {pmrCities.map((city) => {
                  const isSelected = activeActivity?.locations.some(
                    (l) => l.city.toLowerCase() === city.name.toLowerCase()
                  ) || (city.name === 'Тирасполь' && !activeActivity?.locations.some(l => l.city.toLowerCase() !== 'тирасполь'));

                  return (
                    <button
                      key={city.name}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCity(city.name);
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-10 transition-transform duration-200 hover:scale-110 active:scale-95"
                      style={{ left: city.x, top: city.y }}
                      title={`Секции в г. ${city.name}`}
                    >
                      {isSelected && (
                        <span className="absolute -inset-1.5 rounded-full bg-[#6545C6]/40 animate-ping" />
                      )}
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-md text-[10px] sm:text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#6545C6] text-white ring-2 ring-white scale-105'
                            : 'bg-white/95 text-[#1F1B3D] hover:bg-[#6545C6] hover:text-white border border-[#E5E4F2]'
                        }`}
                      >
                        <MapPin className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-[#6545C6]'}`} />
                        <span>{city.name}</span>
                        <span
                          className={`px-1 rounded-full text-[9px] ${
                            isSelected ? 'bg-white text-[#6545C6]' : 'bg-[#EEEAFB] text-[#6545C6]'
                          }`}
                        >
                          {city.count}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Floating Bottom Card Preview for Active Pin */}
        {activeActivity && (
          <div className="absolute bottom-6 left-4 right-4 z-20 max-w-lg mx-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-4 shadow-xl border border-white/80 flex items-center justify-between gap-3 sm:gap-4 transition-all">
              <div
                className="flex items-center gap-3 sm:gap-4 cursor-pointer flex-1 min-w-0"
                onClick={() => onOpenDetail(activeActivity)}
              >
                <img
                  src={activeActivity.photos[0]}
                  alt={activeActivity.title}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 bg-[#EEEAFB]"
                  referrerPolicy="no-referrer"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#5B5870] mb-0.5">
                    <span className="text-[#34D399] font-bold">+{activeActivity.upvotes}</span>
                    <span>·</span>
                    <span className="text-[#6545C6] font-semibold">{activeActivity.topCategoryLabel}</span>
                  </div>
                  <h4 className="font-bold text-sm sm:text-base text-[#1F1B3D] truncate">
                    {activeActivity.title}
                  </h4>
                  <p className="text-xs text-[#858394] truncate mb-1">
                    📍 {activeActivity.locations[0]?.city}, {activeActivity.locations[0]?.address}
                  </p>
                  <p className="font-extrabold text-sm sm:text-base text-[#1F1B3D]">
                    от {activeActivity.groups[0]?.priceFrom} руб. ПМР / {activeActivity.groups[0]?.period}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                {/* Mobile-only call button */}
                <a
                  href={`tel:${activeActivity.phone}`}
                  className="sm:hidden px-3 sm:px-4 py-2 bg-[#34D399] hover:bg-[#2bb883] text-white text-xs font-bold rounded-xl shadow-sm transition-colors text-center"
                >
                  Позвонить
                </a>
                <button
                  onClick={() => onOpenDetail(activeActivity)}
                  className="px-4 py-2 bg-[#6545C6] hover:bg-[#8064D8] text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                >
                  Подробнее
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pan / Zoom Interactive Guide Badge */}
        <div className="absolute top-20 right-4 z-10 hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[10px] text-[#5B5870] font-semibold border border-white/80 shadow-xs pointer-events-none">
          <span>Перемещайте карту зажатием • Зум колесиком или +/-</span>
        </div>

        {/* Required OpenStreetMap Attribution (§3.5.4 & §12.7) */}
        <div className="absolute bottom-1 right-2 z-10 text-[10px] text-[#858394] bg-white/80 px-2 py-0.5 rounded-md pointer-events-auto">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a> (ODbL)
        </div>
      </div>
    </div>
  );
};
