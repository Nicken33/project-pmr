export type UserRole = 'guest' | 'user' | 'owner' | 'moderator';

export type ActivityKind = 'activity' | 'service';
export type ActivityType = 'individual' | 'group' | 'both';
export type FormatType = 'offline' | 'online' | 'both';

export type TopCategoryId =
  | 'art'
  | 'sport'
  | 'tech'
  | 'education'
  | 'animals'
  | 'travel'
  | 'craft'
  | 'social'
  | 'other';

export interface ScheduleLine {
  id?: string;
  day: 'Понедельник' | 'Вторник' | 'Среда' | 'Четверг' | 'Пятница' | 'Суббота' | 'Воскресенье' | string;
  startTime: string; // "16:00"
  endTime: string;   // "18:00"
  note?: string;     // e.g. "сбор в 16:45, форма не нужна"
  seatsLeft?: number;
}

export interface ActivityGroup {
  id: string;
  activityId: string;
  title?: string; // e.g. "5–7 лет", "старшая группа"
  ageFrom: number;
  ageTo: number;
  priceFrom: number; // 0 = бесплатно
  priceTo?: number;  // e.g. 400
  period: 'тренировка' | 'месяц' | 'курс';
  locationId: string; // points to LocationPoint
  scheduleLines: ScheduleLine[];
  seatsLeft?: number;
}

export interface LocationPoint {
  id: string;
  orgId: string;
  title?: string; // e.g. "Основной зал", "Филиал на Балке"
  city: string;   // e.g. "Тирасполь"
  district?: string; // e.g. "Центр", "Балка", "Западный"
  address: string; // e.g. "ул. 25 Октября, 74"
  lat: number;
  lng: number;
  phone?: string;
  verifiedAt?: string;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  isOwnerReply?: boolean; // «ответ организации»
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  activityId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string; // 60–600 chars
  media?: string[];
  createdAt: string;
  isEdited?: boolean;
  upvotes: number;
  downvotes: number;
  userVote?: 1 | -1 | null;
  status: 'published' | 'hidden';
  hideReason?: string;
  comments: ReviewComment[];
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  type: 'школа' | 'студия' | 'дом творчества' | 'спортшкола' | 'частный мастер';
  description?: string;
  phone: string;
  email?: string;
  website?: string;
  messengers: {
    telegram?: string;
    viber?: string;
    whatsapp?: string;
    instagram?: string;
  };
  verifiedAt?: string;
  consentRecord?: string; // for private masters
  sourceUrl?: string;
}

export interface ActivityItem {
  id: string;
  slug: string;
  title: string;
  orgId: string;
  organization: Organization;
  kind: ActivityKind; // 'activity' | 'service'
  topCategory: TopCategoryId;
  topCategoryLabel: string;
  subcategory: string; // specific direction e.g. "рисование", "робототехника"
  activityType: ActivityType; // 'individual' | 'group' | 'both'
  format: FormatType; // 'offline' | 'online' | 'both'
  description: string;
  phone: string; // +373 777 12345
  messengers: {
    telegram?: string;
    viber?: string;
    whatsapp?: string;
    instagram?: string;
  };
  photos: string[]; // first is cover
  verifiedAt?: string; // e.g. "15.04.2026" or undefined -> "данные ориентировочные"
  source: 'сайт' | 'звонок' | 'соцсети' | 'лично';
  sourceUrl?: string;
  status: 'published' | 'pending' | 'rejected' | 'draft';
  rejectReason?: string;
  isActive: boolean;
  createdAt: string;
  
  // Votes (NO STARS - §10.2: only +/- votes)
  upvotes: number;
  downvotes: number;
  userVote?: 1 | -1 | null;

  // Connected entities (from Tables 1-A and 1-B)
  groups: ActivityGroup[];
  locations: LocationPoint[];
  reviews: ReviewItem[];

  // For services (Table 1: service fields)
  serviceType?: string; // e.g. "выезд / на месте"
  pricePerHourOrVisit?: string;
}

export interface Booking {
  id: string;
  activityId: string;
  activityTitle: string;
  format: 'trial' | 'subscription';
  date: string;
  time: string;
  name: string;
  phone: string;
  comment?: string;
  status: 'confirmed' | 'pending' | 'completed';
  price: number;
  createdAt: string;
  address: string;
}

export interface Conversation {
  id: string;
  activityId: string;
  activityTitle: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: {
    id: string;
    senderName: string;
    text: string;
    time: string;
    isUser: boolean;
  }[];
}

export interface MissingRequest {
  id: string;
  queryText: string;
  city?: string;
  email?: string;
  createdAt: string;
  status: 'new' | 'in_progress' | 'exists';
}

export interface ModerationReport {
  id: string;
  targetType: 'review' | 'activity' | 'comment';
  targetId: string;
  targetTitle: string;
  reason: string;
  reporterEmail?: string;
  createdAt: string;
  status: 'open' | 'hidden' | 'dismissed';
}
