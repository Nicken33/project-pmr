/**
 * Мапперы для преобразования API типов в frontend типы (ActivityItem)
 */
import type { ActivityItem, ActivityKind, TopCategoryId, LocationPoint, ActivityGroup } from '../types';
import type { Card, Activity, Location, Group, Lesson, Organization, Media } from './generated';

/**
 * Маппит Card (каталог) в ActivityItem (frontend)
 */
export function mapCardToActivity(card: Card): ActivityItem {
  // Преобразуем формат
  const formatMap: Record<string, 'online' | 'offline' | 'both'> = {
    online: 'online',
    offline: 'offline',
    both: 'both',
  };

  // Преобразуем статус
  const statusMap: Record<string, 'draft' | 'pending' | 'published' | 'rejected'> = {
    draft: 'draft',
    on_moderation: 'pending',
    rejected: 'rejected',
    published: 'published',
  };

  // Преобразуем kind
  const kindMap: Record<string, ActivityKind> = {
    activity: 'activity',
    service: 'service',
  };

  const locations: LocationPoint[] = [{
    id: card.location_id ?? 0,
    orgId: card.org_id.toString(),
    city: card.city,
    district: card.district,
    address: card.address ?? '',
    lat: card.lat ?? 0,
    lng: card.lng ?? 0,
  }];

  // Для Card в каталоге группы не раскрыты, создаем минимальную группу
  const groups: ActivityGroup[] = [{
    id: card.group_id ?? 0,
    activityId: card.id,
    title: card.group_name ?? card.name,
    ageFrom: card.age?.from ?? 0,
    ageTo: card.age?.to ?? 0,
    priceFrom: card.price ?? 0,
    priceTo: card.price_to ?? card.price ?? 0,
    currency: 'RUB',
    scheduleLines: [],
  }];

  return {
    id: card.id,
    kind: kindMap[card.kind] || 'activity',
    title: card.name,
    description: card.description ?? '',
    shortDescription: '',
    photos: card.photo ? [card.photo] : [],
    coverPhoto: card.photo ?? undefined,
    format: formatMap[card.format] || 'offline',
    organization: {
      id: card.org_id.toString(),
      name: card.org_name,
      description: '',
      logo: undefined,
      verified: false,
      website: card.link ?? undefined,
      phone: card.phone || undefined,
      email: undefined,
    },
    orgId: card.org_id.toString(),
    locations,
    groups,
    topCategory: mapCategoryToTopCategory(card.category ?? ''),
    topCategoryLabel: getTopCategoryLabel(card.category ?? ''),
    subcategory: card.category ?? '',
    tags: [],
    status: statusMap[card.status] || 'draft',
    isActive: card.status === 'published',
    verifiedAt: card.contacts_verified_at ?? undefined,
    createdAt: card.updated_at,
    updatedAt: card.updated_at,
    upvotes: 0,
    downvotes: 0,
    userVote: null,
    reviews: [],
  };
}

/**
 * Маппит Activity (детальная) в ActivityItem (frontend)
 */
export function mapActivityToActivityItem(activity: Activity): ActivityItem {
  const formatMap: Record<string, 'online' | 'offline' | 'both'> = {
    online: 'online',
    offline: 'offline',
    both: 'both',
  };

  const statusMap: Record<string, 'draft' | 'pending' | 'published' | 'rejected'> = {
    draft: 'draft',
    on_moderation: 'pending',
    rejected: 'rejected',
    published: 'published',
  };

  const kindMap: Record<string, ActivityKind> = {
    activity: 'activity',
    service: 'service',
  };

  const locations: LocationPoint[] = (activity.locations || []).map((loc: Location) => ({
    id: loc.id,
    orgId: activity.org_id.toString(),
    city: loc.city,
    district: loc.district,
    address: loc.address,
    lat: loc.lat ?? 0,
    lng: loc.lng ?? 0,
  }));

  const groups: ActivityGroup[] = (activity.groups || []).map((g: Group) => ({
    id: g.id,
    activityId: activity.id,
    title: g.name ?? '',
    ageFrom: g.age_from ?? 0,
    ageTo: g.age_to ?? 0,
    priceFrom: g.price_from ?? 0,
    priceTo: g.price_to ?? g.price_from ?? 0,
    currency: 'RUB',
    scheduleLines: (g.schedules || []).map((sl: Lesson) => ({
      day: weekdayNumberToString(sl.weekday),
      startTime: sl.time_from,
      endTime: sl.time_to,
    })),
  }));

  const org = activity.organization;
  const orgData = {
    id: org?.id.toString() ?? activity.org_id.toString(),
    name: org?.name ?? activity.org_name,
    description: org?.description ?? '',
    logo: undefined,
    verified: !!org?.contacts_verified_at,
    website: org?.site ?? undefined,
    phone: org?.phone || undefined,
    email: org?.email ?? undefined,
  };

  // Фото из медиа
  const photos = (activity.photos || []).map((m: Media) => m.path);
  const coverPhoto = photos[0];

  return {
    id: activity.id,
    kind: kindMap[activity.kind] || 'activity',
    title: activity.name,
    description: activity.description ?? '',
    shortDescription: '',
    photos,
    coverPhoto,
    format: formatMap[activity.format] || 'offline',
    organization: orgData,
    orgId: activity.org_id.toString(),
    locations,
    groups,
    topCategory: mapCategoryToTopCategory(activity.category ?? ''),
    topCategoryLabel: getTopCategoryLabel(activity.category ?? ''),
    subcategory: activity.category ?? '',
    tags: [],
    status: statusMap[activity.status] || 'draft',
    isActive: activity.status === 'published',
    verifiedAt: activity.contacts_verified_at ?? undefined,
    createdAt: activity.updated_at,
    updatedAt: activity.updated_at,
    upvotes: 0,
    downvotes: 0,
    userVote: null,
    reviews: [],
  };
}

/**
 * Маппит API категорию в TopCategoryId frontend
 */
function mapCategoryToTopCategory(category: string): TopCategoryId {
  const cat = category.toLowerCase();
  if (cat.includes('творчеств') || cat.includes('art') || cat.includes('творчес') || cat.includes('рисов') || cat.includes('изобразительн')) return 'creativity';
  if (cat.includes('спорт') || cat.includes('физкульт') || cat.includes('sport') || cat.includes('футбол') || cat.includes('баскетбол') || cat.includes('плав')) return 'sport';
  if (cat.includes('наук') || cat.includes('техно') || cat.includes('stem') || cat.includes('робот') || cat.includes('программ') || cat.includes('it')) return 'science';
  if (cat.includes('язык') || cat.includes('лингв') || cat.includes('language') || cat.includes('английск') || cat.includes('немецк')) return 'languages';
  if (cat.includes('подготовк') || cat.includes('школ') || cat.includes('репетитор') || cat.includes('exam') || cat.includes('огэ') || cat.includes('егэ')) return 'preparation';
  if (cat.includes('тьют') || cat.includes('театр') || cat.includes('scene') || cat.includes('актер') || cat.includes('драма')) return 'theater';
  if (cat.includes('музык') || cat.includes('vocal') || cat.includes('инструмент') || cat.includes('music') || cat.includes('пианино') || cat.includes('гитар') || cat.includes('скрипк')) return 'music';
  if (cat.includes('танец') || cat.includes('хореограф') || cat.includes('dance') || cat.includes('балет') || cat.includes('хор')) return 'dance';
  return 'creativity';
}

function getTopCategoryLabel(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('творчеств') || cat.includes('art') || cat.includes('творчес') || cat.includes('рисов') || cat.includes('изобразительн')) return 'Творчество';
  if (cat.includes('спорт') || cat.includes('физкульт') || cat.includes('sport') || cat.includes('футбол') || cat.includes('баскетбол') || cat.includes('плав')) return 'Спорт';
  if (cat.includes('наук') || cat.includes('техно') || cat.includes('stem') || cat.includes('робот') || cat.includes('программ') || cat.includes('it')) return 'Наука и технологии';
  if (cat.includes('язык') || cat.includes('лингв') || cat.includes('language') || cat.includes('английск') || cat.includes('немецк')) return 'Языки';
  if (cat.includes('подготовк') || cat.includes('школ') || cat.includes('репетитор') || cat.includes('exam') || cat.includes('огэ') || cat.includes('егэ')) return 'Подготовка к школе';
  if (cat.includes('тьют') || cat.includes('театр') || cat.includes('scene') || cat.includes('актер') || cat.includes('драма')) return 'Театр';
  if (cat.includes('музык') || cat.includes('vocal') || cat.includes('инструмент') || cat.includes('music') || cat.includes('пианино') || cat.includes('гитар') || cat.includes('скрипк')) return 'Музыка';
  if (cat.includes('танец') || cat.includes('хореограф') || cat.includes('dance') || cat.includes('балет') || cat.includes('хор')) return 'Танцы';
  return 'Творчество';
}

function weekdayNumberToString(day: number): string {
  // Исправим: день недели может быть 0-6 (JS) или 1-7 (ISO). 
  // В ApiLesson сказано: 1 — понедельник … 7 — воскресенье.
  // Если приходит 0, это может быть воскресенье в JS, но бэкенд шлёт ISO.
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  if (day >= 1 && day <= 7) return days[day - 1];
  if (day === 0) return 'Воскресенье'; // на случай, если JS пришел
  return 'Понедельник';
}