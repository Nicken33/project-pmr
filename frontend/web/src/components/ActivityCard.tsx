import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Phone, MapPin, Clock, Users, ChevronDown, 
  ChevronUp, ThumbsUp, ThumbsDown, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { ActivityItem, ActivityGroup, LocationPoint } from '../types';

interface ActivityCardProps {
  activity: ActivityItem;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenDetail: (activity: ActivityItem) => void;
  onOpenBooking: (activity: ActivityItem) => void;
  isGuest: boolean;
  onGuestAction: () => void;
  onVote: (activityId: string, direction: 1 | -1) => void;
  filterAge?: number | null;
  index?: number;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  isFavorite,
  onToggleFavorite,
  onOpenDetail,
  onOpenBooking,
  isGuest,
  onGuestAction,
  onVote,
  filterAge,
  index = 0,
}) => {
  // Inline expansion states (§3.2, §10.17: local card action, not a modal!)
  const [isGroupsExpanded, setIsGroupsExpanded] = useState(false);
  const [isLocationsExpanded, setIsLocationsExpanded] = useState(false);

  // Active group selection (select matching group if filterAge provided)
  const defaultGroup = activity.groups.find(
    (g) => filterAge !== null && filterAge !== undefined && g.ageFrom <= filterAge && g.ageTo >= filterAge
  ) || activity.groups[0];

  const [activeGroupId, setActiveGroupId] = useState<string>(defaultGroup?.id || activity.groups[0]?.id || '');
  const activeGroup = activity.groups.find((g) => g.id === activeGroupId) || activity.groups[0];

  // Active location is the one connected to activeGroup, or first
  const activeLocation = activity.locations.find((l) => l.id === activeGroup?.locationId) || activity.locations[0];

  // Phone to call: active location phone, or activity phone
  const callPhone = activeLocation?.phone || activity.phone;

  const totalVotes = activity.upvotes + activity.downvotes;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.04, 0.28),
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      layout
      className="group bg-white rounded-2xl border border-[#E5E4F2] hover:border-[#A998EA] shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Media & Badges */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#EEEAFB]">
        <img
          src={activity.photos[0] || '/src/assets/images/hero_creative_arts_1792908981359.jpg'}
          alt={activity.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />

        {/* Favorite Heart Button (touch target >= 44x44px - §10.6) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isGuest) {
              onGuestAction();
            } else {
              onToggleFavorite(activity.id);
            }
          }}
          aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
          className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer z-10"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
            isFavorite
              ? 'bg-white text-[#FF4444] shadow-md scale-105'
              : 'bg-white/80 text-[#5B5870] hover:bg-white hover:text-[#FF4444]'
          }`}>
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#FF4444]' : ''}`} />
          </div>
        </button>

        {/* Category Badge & Verification Status */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          <span className="px-2.5 py-1 bg-[#6545C6] text-white text-[10px] font-bold rounded-lg shadow-sm">
            {activity.topCategoryLabel}
          </span>
          {activity.verifiedAt ? (
            <span className="px-2 py-0.5 bg-white/90 backdrop-blur-md text-[#1E9E4A] text-[9px] font-bold rounded-md flex items-center gap-1 shadow-xs">
              <CheckCircle2 className="w-3 h-3" />
              <span>проверено {activity.verifiedAt}</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-white/90 backdrop-blur-md text-amber-700 text-[9px] font-bold rounded-md flex items-center gap-1 shadow-xs">
              <AlertCircle className="w-3 h-3" />
              <span>данные ориентировочные</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          {/* Organization & Rating (NO STARS - §10.2: only +/- votes) */}
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[#858394] font-semibold truncate max-w-[170px]">
              {activity.organization.name}
            </span>

            {/* Voting widget (+/-) */}
            <div className="flex items-center gap-1.5 shrink-0 bg-[#F7F6FC] px-2 py-1 rounded-lg border border-[#E5E4F2]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isGuest) onGuestAction();
                  else onVote(activity.id, 1);
                }}
                className={`min-w-[24px] min-h-[24px] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
                  activity.userVote === 1 ? 'text-[#34D399]' : 'text-[#5B5870] hover:text-[#34D399]'
                }`}
                title="Полезно"
              >
                <ThumbsUp className="w-3 h-3 mr-0.5" />
                <span>+{activity.upvotes}</span>
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isGuest) onGuestAction();
                  else onVote(activity.id, -1);
                }}
                className={`min-w-[24px] min-h-[24px] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
                  activity.userVote === -1 ? 'text-[#FF4444]' : 'text-[#5B5870] hover:text-[#FF4444]'
                }`}
                title="Не полезно"
              >
                <ThumbsDown className="w-3 h-3 mr-0.5" />
                <span>-{activity.downvotes}</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <h4
            onClick={() => onOpenDetail(activity)}
            className="font-black text-sm sm:text-base text-[#1F1B3D] hover:text-[#6545C6] transition-colors cursor-pointer line-clamp-1"
          >
            {activity.title}
          </h4>

          {/* Address Line + "ещё N адресов" inline toggle (§3.2 п.10) */}
          <div className="mt-2 text-xs text-[#5B5870]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#6545C6] shrink-0" />
                <span className="truncate">
                  {activeLocation.city}, {activeLocation.district && `${activeLocation.district}, `}{activeLocation.address}
                </span>
              </div>

              {activity.locations.length > 1 && (
                <button
                  type="button"
                  aria-expanded={isLocationsExpanded}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLocationsExpanded(!isLocationsExpanded);
                  }}
                  className="min-h-[32px] px-2 text-[11px] font-bold text-[#6545C6] hover:underline flex items-center gap-0.5 shrink-0"
                >
                  <span>ещё {activity.locations.length - 1}</span>
                  {isLocationsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Expanded addresses list */}
            {isLocationsExpanded && (
              <div className="mt-1.5 p-2 bg-[#F7F6FC] rounded-xl border border-slate-200 space-y-1">
                {activity.locations.map((loc) => (
                  <div key={loc.id} className="text-[11px] text-[#1F1B3D]">
                    <span className="font-semibold">{loc.title || loc.district}:</span> {loc.address}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Age & Schedule line */}
          {activeGroup && (
            <div className="mt-1.5 text-xs text-[#5B5870] space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <Users className="w-3.5 h-3.5 text-[#858394] shrink-0" />
                  <span className="font-semibold text-[#1F1B3D]">
                    {activeGroup.ageFrom}–{activeGroup.ageTo} лет
                  </span>
                  <span>·</span>
                  <span className="text-[#858394] truncate">
                    {activeGroup.scheduleLines[0]?.day || 'Регулярно'}, {activeGroup.scheduleLines[0]?.startTime}–{activeGroup.scheduleLines[0]?.endTime}
                  </span>
                </div>

                {/* "N групп" inline expand button (§3.2, §10.17) */}
                {activity.groups.length > 1 && (
                  <button
                    type="button"
                    aria-expanded={isGroupsExpanded}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGroupsExpanded(!isGroupsExpanded);
                    }}
                    className="min-h-[32px] px-2 text-[11px] font-bold text-[#6545C6] hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <span>{activity.groups.length} групп</span>
                    {isGroupsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Inline Expanded Groups selection */}
              {isGroupsExpanded && (
                <div className="mt-1.5 p-2 bg-[#F7F6FC] rounded-xl border border-slate-200 space-y-1.5 animate-in fade-in">
                  <span className="text-[10px] font-bold text-[#858394] uppercase tracking-wider block">
                    Выберите возрастную группу:
                  </span>
                  {activity.groups.map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveGroupId(grp.id);
                      }}
                      className={`w-full text-left p-1.5 rounded-lg text-xs flex justify-between items-center ${
                        activeGroupId === grp.id
                          ? 'bg-[#6545C6] text-white font-bold'
                          : 'bg-white hover:bg-[#EEEAFB] text-[#1F1B3D]'
                      }`}
                    >
                      <span>{grp.title || `${grp.ageFrom}–${grp.ageTo} лет`}</span>
                      <span className="font-mono">
                        {grp.priceFrom === 0 ? 'Бесплатно' : `${grp.priceFrom} ₽/${grp.period}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: Price + CALL Button (§10.1: телефон - самое заметное действие!) */}
        <div className="pt-3 border-t border-[#E5E4F2] flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-[#858394] block leading-none">
              {activeGroup?.title ? activeGroup.title : 'Стоимость'}
            </span>
            {activeGroup?.priceFrom === 0 ? (
              <span className="px-2 py-0.5 rounded-md bg-[#EAF7EE] text-[#1E9E4A] font-black text-xs sm:text-sm">
                Бесплатно
              </span>
            ) : (
              <span className="text-sm sm:text-base font-black text-[#1F1B3D]">
                {activeGroup?.priceFrom}
                {activeGroup?.priceTo ? `–${activeGroup.priceTo}` : ''} руб. ПМР / {activeGroup?.period || 'мес'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Primary Action: ПОЗВОНИТЬ (§10.1) */}
            <a
              href={`tel:${callPhone.replace(/\s+/g, '')}`}
              className="min-h-[44px] px-3.5 bg-[#34D399] hover:bg-[#2bb883] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Позвонить в секцию прямо сейчас"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Позвонить</span>
            </a>

            {/* Secondary Action: Подробнее */}
            <button
              onClick={() => onOpenDetail(activity)}
              className="min-h-[44px] px-3 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Подробнее
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
