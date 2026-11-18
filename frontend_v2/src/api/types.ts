// Типы ответов Go API (см. README бэка). ID приходят строками.

export type AccountType = 'user' | 'section_owner' | 'service_owner' | 'moderator'

export interface User {
  id: string
  email: string
  name: string
  account_type: AccountType
  /** ЗАГОТОВКА: появится вместе с POST /api/v1/me/avatar */
  avatar_path?: string
}

export interface AuthToken {
  token: string
  user: User
}

export interface CardAge {
  min_age: number | null
  max_age: number | null
}

export interface CardRating {
  score: number
  votes_count: number
  likes: number
  dislikes: number
}

export interface Schedule {
  weekday: number // 1 = Пн … 7 = Вс
  start_time: string
  end_time: string
  note?: string
}

export interface GroupLocation {
  id: string
  city_id: string
  city: string
  district_id?: string
  district?: string
  address: string
  latitude?: number
  longitude?: number
  phone?: string
}

export interface Group {
  id: string
  name?: string
  age_from?: number
  age_to?: number
  price_from: number
  price_to?: number
  price_period?: string
  location: GroupLocation
  schedules: Schedule[] | null
  seats?: number
}

export interface Photo {
  id: string
  path: string
  alt_text?: string
  position: number
  is_cover: boolean
}

export interface Video {
  id: string
  path: string
  position: number
}

export type ActivityStatus = 'draft' | 'pending' | 'published' | 'rejected'

export interface Card {
  id: string
  slug: string
  name: string
  description?: string
  record_type: 'activity' | 'service'
  status: ActivityStatus
  city_id: string
  city: string
  district_id?: string
  district?: string
  direction_id: string
  direction: string
  organization_id?: string
  organization?: string
  class_type: 'individual' | 'group' | 'both'
  class_format: 'online' | 'offline' | 'both'
  price_from?: number
  price_to?: number
  price_period?: string
  age_from?: number
  age_to?: number
  age: CardAge
  address?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  website?: string
  cover_path?: string
  cover_alt?: string
  contacts_checked_at?: string
  created_at: string
  updated_at: string
  verified: boolean
  rating: CardRating
  schedules?: Schedule[]
  groups?: Group[]
  photos?: Photo[]
  videos?: Video[]
}

export interface Messenger {
  channel: 'telegram' | 'viber' | 'whatsapp' | 'instagram'
  contact: string
}

export interface CardDetails extends Card {
  messengers?: Messenger[]
}

export interface OwnedActivity extends Card {
  rejection_reason?: string
  is_active: boolean
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface City {
  id: string
  name: string
  sort_order?: number
}

export interface District {
  id: string
  city_id: string
  name: string
  sort_order?: number
}

export interface Category {
  id: string
  name: string
  record_type: 'activity' | 'service' | 'both'
  sort_order: number
  children?: Category[]
}

export interface OrganizationLocation {
  id: string
  name?: string
  city_id: string
  city: string
  district_id?: string
  district?: string
  address: string
  latitude?: number
  longitude?: number
  phone?: string
  groups_count: number
}

export type OrganizationType = 'school' | 'studio' | 'art_house' | 'sports_school' | 'private_master'

export interface Organization {
  id: string
  slug: string
  name: string
  type: OrganizationType
  description?: string
  phone: string
  email?: string
  website?: string
  city_id?: string
  address?: string
  latitude?: number
  longitude?: number
  contacts_checked_at?: string
  messengers?: Messenger[]
  locations: OrganizationLocation[]
  cards?: Card[]
}

export interface OrganizationInput {
  name: string
  organization_type: OrganizationType
  description: string | null
  phone: string
  email: string | null
  website: string | null
  city_id: number
  district_id: number
  messengers: Messenger[]
}

export interface Review {
  id: string
  activity_id: string
  author_id: string
  author_name: string
  text: string
  created_at: string
  photos?: Photo[]
  videos?: Video[]
  /** ЗАГОТОВКА (нет в API): голоса и число ответов, см. BACKEND_INTEGRATION.md */
  votes?: { plus: number; minus: number }
  comments_count?: number
}

/** Медиа отзыва: POST /api/v1/reviews/{id}/photos|videos (есть в бэке репозитория) */
export interface ReviewMedia {
  id: string
  path: string
  media_type: 'photo' | 'video'
  position: number
  alt_text?: string
}

export type ReportTarget = 'card' | 'review' | 'media'

/** Жалоба: POST /api/v1/reports, очередь — GET /api/v1/moderation/reports */
export interface ContentReport {
  id: string
  target_type: ReportTarget
  target_id: string
  card_id: string
  card_slug: string
  card_title: string
  target_excerpt: string
  reporter_name: string
  reason: string
  detail: string
  status: 'open' | 'hidden' | 'dismissed'
  hide_reason: string | null
  created_at: string
  updated_at: string
}

/** ЗАГОТОВКА: комментарий под отзывом (таблица review_comments) */
export interface ReviewComment {
  id: string
  review_id: string
  author_id: string
  author_name: string
  text: string
  is_organization: boolean
  created_at: string
}

export interface ModerationItem {
  id: string
  slug: string
  name: string
  status: ActivityStatus
  rejection_reason?: string
  photos: Photo[]
}

// Тело создания/обновления секции владельцем
export interface ActivityInput {
  name: string
  description: string | null
  /** service — только для service_owner (тогда class_type = null) */
  record_type: 'activity' | 'service'
  direction_id: string
  class_type: 'individual' | 'group' | 'both' | null
  class_format: 'online' | 'offline' | 'both'
  phone: string | null
  locations: LocationInput[]
  groups: GroupInput[]
}

export interface LocationInput {
  key: string
  id?: string
  name: string | null
  city_id: string
  district_id: string | null
  address: string
  latitude: number | null
  longitude: number | null
  phone: string | null
  source_type: string
  source_url: string | null
}

export interface GroupInput {
  name: string | null
  age_from: number | null
  age_to: number | null
  price_from: number
  price_to: number | null
  price_period: string | null
  location_key: string
  seats: number | null
  schedules: ScheduleInput[]
}

export interface ScheduleInput {
  weekday: number
  start_time: string
  end_time: string
  note: string | null
  seats: number | null
}
