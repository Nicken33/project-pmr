export type ActivityKind = "activity" | "service";
export type ActivityType = "individual" | "group" | "both";
export type ActivityFormat = "online" | "offline" | "both";
export type ActivityStatus = "draft" | "pending" | "published" | "rejected";

export type Weekday =
  | "Пн"
  | "Вт"
  | "Ср"
  | "Чт"
  | "Пт"
  | "Сб"
  | "Вс";

export interface SuperCategory {
  slug: string;
  title: string;
  shortTitle: string;
  icon: string;
  color: string;
}

export interface Category {
  slug: string;
  title: string;
  superSlug: string;
  kind: ActivityKind | "both";
  icon: string;
  order: number;
}

export interface City {
  slug: string;
  title: string;
  order: number;
}

export interface District {
  slug: string;
  citySlug: string;
  title: string;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  /** Тип организации — текст из справочника бэкенда, перечислять его на фронте нельзя. */
  type: string;
  description: string;
  phone: string;
  /** Город из ответа бэкенда (`city`) — подписываем адрес, не ища его в mock-справочнике. */
  city?: string;
  address?: string;
  email?: string;
  site?: string;
  messengers?: Partial<Record<"telegram" | "viber" | "whatsapp" | "instagram", string>>;
  logo?: string;
  cover?: string;
  verifiedAt?: string;
}

export interface Location {
  id: string;
  name?: string;
  citySlug: string;
  districtSlug?: string;
  /**
   * Названия из ответа бэкенда. Слаг сам по себе ничего читателю не говорит, а
   * спраочник витрины — это моки; когда у занятия есть реальная точка, показываем
   * то имя, которое отдал сервер, а не то, что нашлось в mock-списке.
   */
  cityTitle?: string;
  districtTitle?: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
}

export interface ScheduleRow {
  day: Weekday;
  start: string;
  end: string;
  note?: string;
  seats?: number;
}

export interface AgeGroup {
  id: string;
  title?: string;
  /** Канон допускает NULL: возраст не задан — показываем «уточняется», а не 0. */
  ageFrom: number | null;
  ageTo: number | null;
  /** NULL — цена не указана (в схеме CHECK `price_from` может отсутствовать). */
  priceFrom: number | null;
  priceTo?: number;
  pricePeriod?: "тренировка" | "месяц" | "курс" | "час" | "визит" | "занятие";
  locationId: string;
  schedule: ScheduleRow[];
  seats?: number;
}

export interface ReviewComment {
  id: string;
  author: string;
  avatarColor: string;
  text: string;
  createdAt: string;
  isOrganization?: boolean;
  votesPlus?: number;
  replies?: ReviewComment[];
}

export interface Review {
  id: string;
  author: string;
  avatarColor: string;
  text: string;
  createdAt: string;
  votesPlus: number;
  votesMinus: number;
  photos?: string[];
  video?: string;
  videoDuration?: string;
  comments?: ReviewComment[];
}

export interface Activity {
  id: string;
  slug: string;
  title: string;
  organizationSlug: string;
  /** Название организации из ответа бэкенда (`org_name`) — вместо поиска по mock-списку. */
  organizationTitle?: string;
  categorySlug: string;
  /** Название направления из ответа бэкенда (`category`) — вместо поиска по mock-справочнику. */
  categoryTitle?: string;
  superSlug: string;
  /** Название верхнего уровня из ответа бэкенда (`super_category`). */
  superTitle?: string;
  kind: ActivityKind;
  type?: ActivityType;
  format: ActivityFormat;
  serviceMode?: "выезд" | "на месте" | "оба";
  photos: string[];
  description: string;
  shortDescription?: string;
  verifiedAt?: string;
  updatedAt: string;
  createdAt: string;
  votesPlus: number;
  votesMinus: number;
  reviews: Review[];
  locations: Location[];
  groups: AgeGroup[];
  featuredGroupIndex?: number;
  featuredLocationId?: string;
  isNew?: boolean;
  promoted?: boolean;
}

export interface FilterState {
  q: string;
  kind: "" | ActivityKind;
  superCategory: string;
  category: string;
  city: string;
  district: string[];
  activity: string;
  age: string;
  priceMax: string;
  free: boolean;
  format: "" | ActivityFormat;
  verified: boolean;
  day: string;
  time: "" | "morning" | "day" | "evening";
  near: boolean;
  radius: string;
  sort: string;
  view: "grid" | "list";
}

export interface CatalogMatch {
  groupId: string;
  locationId: string;
}

export interface CatalogResult {
  activity: Activity;
  match: CatalogMatch;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "owner" | "moderator";
  avatarColor: string;
  organizationSlug?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: "default" | "success" | "danger";
}

export type ApplicationStatus = "draft" | "pending" | "published" | "rejected";

/** Анкета организации или мастера: то, что создаёт владелец и модератор (§3.8–3.9). */
export interface Application {
  id: string;
  slug: string;
  title: string;
  kind: ActivityKind;
  categorySlug: string;
  superSlug: string;
  organizationSlug: string;
  status: ApplicationStatus;
  description: string;
  shortDescription?: string;
  format: ActivityFormat;
  type?: ActivityType;
  serviceMode?: "выезд" | "на месте" | "оба";
  photos: string[];
  locations: Location[];
  groups: AgeGroup[];
  phone?: string;
  verifiedAt?: string;
  submittedAt?: string;
  rejectReason?: string;
  updatedAt: string;
  createdAt: string;
  byOwner: boolean;
}

export interface ModerationEntry {
  id: string;
  applicationTitle: string;
  organizationSlug: string;
  actor: string;
  decision: "published" | "rejected";
  comment?: string;
  createdAt: string;
}

export interface ContentReport {
  id: string;
  targetType: "review" | "comment" | "media" | "card";
  targetExcerpt: string;
  author: string;
  reason: string;
  detail?: string;
  activitySlug: string;
  activityTitle: string;
  createdAt: string;
  status: "open" | "hidden" | "dismissed";
  hideReason?: string;
}

export interface GapRequest {
  id: string;
  query: string;
  citySlug?: string;
  email?: string;
  createdAt: string;
  decision?: "taken" | "exists" | "rejected";
  note?: string;
}

export interface SearchGap {
  query: string;
  citySlug?: string;
  misses: number;
  lastAt: string;
}

/** Блокировка участника (§8, таблица 15 · §12.15). */
export interface Blocking {
  id: string;
  user: string;
  reason: string;
  note?: string;
  term: "7 дней" | "навсегда";
  actor: string;
  createdAt: string;
  liftedAt?: string;
}
