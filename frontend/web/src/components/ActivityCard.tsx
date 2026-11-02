import React from 'react';
import { motion } from 'motion/react';
import { Heart, MapPin, Clock, Users, Star } from 'lucide-react';
import { ActivityItem } from '../types';

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
  isGuest,
  onGuestAction,
  filterAge,
  index = 0,
}) => {
  // Find matching group or first group
  const activeGroup = activity.groups.find(
    (g) => filterAge !== null && filterAge !== undefined && g.ageFrom <= filterAge && g.ageTo >= filterAge
  ) || activity.groups[0];

  const activeLocation = activity.locations.find((l) => l.id === activeGroup?.locationId) || activity.locations[0];

  // Rating calculation (4.5 to 5.0 base with upvotes)
  const ratingScore = Math.min(5.0, 4.5 + Math.min(0.5, activity.upvotes * 0.01)).toFixed(1);
  const totalReviews = Math.max(12, activity.upvotes + activity.reviews.length * 3);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.03, 0.2),
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group bg-white rounded-2xl border border-[#E5E4F2] hover:border-[#6545C6]/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
    >
      <div>
        {/* Thumbnail Image with Favorite Heart */}
        <div 
          onClick={() => onOpenDetail(activity)}
          className="relative aspect-[4/3] w-full overflow-hidden bg-[#EEEAFB] cursor-pointer"
        >
          <img
            src={activity.photos[0] || '/src/assets/images/hero_creative_arts_1792908981359.jpg'}
            alt={activity.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />

          {/* Favorite Heart Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isGuest) onGuestAction();
              else onToggleFavorite(activity.id);
            }}
            aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
            className="absolute top-2 right-2 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer z-10"
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
              isFavorite
                ? 'bg-white text-[#FF4444] shadow-md scale-105'
                : 'bg-white/80 text-[#5B5870] hover:bg-white hover:text-[#FF4444]'
            }`}>
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#FF4444]' : ''}`} />
            </div>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 space-y-2">
          {/* Title */}
          <h4
            onClick={() => onOpenDetail(activity)}
            className="font-extrabold text-xs sm:text-[13px] text-[#1F1B3D] group-hover:text-[#6545C6] transition-colors cursor-pointer truncate"
            title={activity.title}
          >
            {activity.title}
          </h4>

          {/* Rating & Category tag matching Image 2 */}
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex items-center gap-1 font-bold text-[#1F1B3D]">
              <Star className="w-3.5 h-3.5 fill-[#FBBF24] text-[#FBBF24]" />
              <span>{ratingScore}</span>
              <span className="text-[#858394] font-normal">({totalReviews})</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#EEEAFB] text-[#6545C6] font-semibold truncate max-w-[80px]">
              {activity.topCategoryLabel.split(' ')[0]}
            </span>
          </div>

          {/* Details Metadata matching Image 2 */}
          <div className="space-y-1 text-[11px] text-[#5B5870] pt-1 border-t border-[#F2EEFB]">
            {/* Age */}
            {activeGroup && (
              <div className="flex items-center gap-1.5 truncate">
                <Users className="w-3 h-3 text-[#858394] shrink-0" />
                <span>{activeGroup.ageFrom}–{activeGroup.ageTo} лет</span>
              </div>
            )}

            {/* Location */}
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3 h-3 text-[#858394] shrink-0" />
              <span className="truncate">{activeLocation.district || activeLocation.city || 'Центр города'}</span>
            </div>

            {/* Schedule */}
            {activeGroup && activeGroup.scheduleLines[0] && (
              <div className="flex items-center gap-1.5 truncate">
                <Clock className="w-3 h-3 text-[#858394] shrink-0" />
                <span className="truncate">
                  {activeGroup.scheduleLines[0].day} {activeGroup.scheduleLines[0].startTime}–{activeGroup.scheduleLines[0].endTime}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Price + "Подробнее" button matching Image 2 */}
      <div className="p-3 pt-0 space-y-2">
        <div className="text-xs font-black text-[#1F1B3D]">
          {activeGroup?.priceFrom === 0 ? (
            <span className="text-[#1E9E4A]">Бесплатно</span>
          ) : (
            <span>от {activeGroup?.priceFrom || 1500} ₽ / {activeGroup?.period || 'месяц'}</span>
          )}
        </div>

        {/* Primary Action Button: Подробнее (lavender style from Image 2) */}
        <button
          onClick={() => onOpenDetail(activity)}
          className="w-full py-2 bg-[#EEEAFB] hover:bg-[#D9D0F5] text-[#6545C6] font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
        >
          Подробнее
        </button>
      </div>
    </motion.article>
  );
};
