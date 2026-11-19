// Все маршруты Go API в одном месте. Пути и поля — строго по README бэка.
import { api } from './client'
import type {
  AccountType,
  ActivityInput,
  AuthToken,
  Card,
  CardDetails,
  Category,
  City,
  District,
  ContentReport,
  ModerationItem,
  ReportTarget,
  ReviewMedia,
  Organization,
  OrganizationInput,
  OwnedActivity,
  Paged,
  Photo,
  Review,
  User,
  VerificationPending,
  Video,
} from './types'

export interface SearchParams {
  q?: string
  city?: string
  district?: string[]
  category?: string
  age?: number
  price_max?: number
  free?: boolean
  kind?: 'activity' | 'service'
  online?: boolean
  verified?: boolean
  day?: number
  time?: 'morning' | 'day' | 'evening'
  near?: string
  radius?: number
  sort?: 'relevance' | 'near' | 'rating' | 'new' | 'free' | 'updated_week'
  page?: number
  limit?: number
}

const id = (v: string) => encodeURIComponent(v)

export const Api = {
  // Каталог и справочники
  search: (p: SearchParams, signal?: AbortSignal) => api<Paged<Card>>('/api/v1/activities', { query: { ...p }, signal }),
  activity: (identifier: string) => api<CardDetails>(`/api/v1/activities/${id(identifier)}`),
  reviews: (activityId: string, page = 1, limit = 20) =>
    api<Paged<Review>>(`/api/v1/activities/${id(activityId)}/reviews`, { query: { page, limit } }),
  cities: () => api<City[]>('/api/v1/cities'),
  districts: (city?: string) => api<District[]>('/api/v1/districts', { query: { city } }),
  categories: () => api<Category[]>('/api/v1/categories'),
  recommended: (city?: string) => api<Paged<Card>>('/api/v1/recommended', { query: { city } }),
  organization: (orgId: string) => api<Organization>(`/api/v1/organizations/${id(orgId)}`),

  // Аккаунт
  /** 202 {needs_email_verification} — письмо отправлено, входа ещё нет. Старый API отвечал 200 {token,user}. */
  register: (b: { email: string; password: string; name: string; account_type: AccountType }) =>
    api<AuthToken | VerificationPending>('/api/v1/auth/register', { json: b }),
  verifyEmail: (token: string) => api<{ message: string }>('/api/v1/auth/email-verification/confirm', { json: { token } }),
  resendVerification: (email: string) => api<{ message: string }>('/api/v1/auth/email-verification/resend', { json: { email } }),
  login: (b: { email: string; password: string }) => api<AuthToken>('/api/v1/auth/login', { json: b }),
  google: (b: { credential: string; account_type?: AccountType }) =>
    api<AuthToken | { needs_account_type: true; email: string; name: string }>('/api/auth/google', { json: b }),
  resetRequest: (email: string) => api<unknown>('/api/v1/auth/password-reset/request', { json: { email } }),
  resetConfirm: (token: string, password: string) =>
    api<unknown>('/api/v1/auth/password-reset/confirm', { json: { token, password } }),
  me: () => api<User>('/api/v1/me'),
  /** email передавать текущий: смена почты запрещена (400 email_change_requires_verification) */
  updateMe: (b: { email: string; name: string }) => api<User>('/api/v1/me', { method: 'PUT', json: b }),

  // Избранное, голоса, отзывы
  favorites: (page = 1, limit = 100) => api<Paged<Card>>('/api/v1/me/favorites', { query: { page, limit } }),
  addFavorite: (cardId: string) => api<void>('/api/v1/me/favorites', { json: { card_id: cardId } }),
  removeFavorite: (cardId: string) => api<void>(`/api/v1/me/favorites/${id(cardId)}`, { method: 'DELETE' }),
  vote: (activityId: string, value: 1 | -1 | null) =>
    api<{ plus: number; minus: number }>(`/api/v1/activities/${id(activityId)}/vote`, { json: { value } }),
  addReview: (activityId: string, text: string) => api<Review>(`/api/v1/activities/${id(activityId)}/reviews`, { json: { text } }),

  // Медиа отзыва (до 5 фото и 1 видео) и жалобы — есть в бэке репозитория project-pmr
  uploadReviewMedia: (reviewId: string, kind: 'photos' | 'videos', file: File, caption?: string) => {
    const f = new FormData()
    f.append('file', file)
    if (caption) f.append('caption', caption)
    return api<ReviewMedia>(`/api/v1/reviews/${id(reviewId)}/${kind}`, { form: f })
  },
  deleteReviewMedia: (reviewId: string, mediaId: string) =>
    api<void>(`/api/v1/reviews/${id(reviewId)}/media/${id(mediaId)}`, { method: 'DELETE' }),
  report: (b: { target_type: ReportTarget; target_id: string; reason: string; detail: string }) =>
    api<ContentReport>('/api/v1/reports', { json: b }),
  moderationReports: (q: { target_type?: ReportTarget; status?: 'open' | 'hidden' | 'dismissed'; page?: number; limit?: number }) =>
    api<Paged<ContentReport>>('/api/v1/moderation/reports', { query: q }),
  decideReport: (reportId: string, b: { action: 'hide' | 'dismiss'; reason?: string }) =>
    api<{ report: ContentReport }>(`/api/v1/moderation/reports/${id(reportId)}/decision`, { json: b }),

  // Модерация
  moderationQueue: (status: 'pending' | 'published' | 'rejected' = 'pending') =>
    api<ModerationItem[]>('/api/v1/moderation/activities', { query: { status } }),
  moderationItem: (activityId: string) => api<OwnedActivity>(`/api/v1/moderation/activities/${id(activityId)}`),
  approve: (activityId: string) => api<unknown>(`/api/v1/moderation/activities/${id(activityId)}/approve`, { method: 'POST' }),
  reject: (activityId: string, comment: string) =>
    api<unknown>(`/api/v1/moderation/activities/${id(activityId)}/reject`, { json: { comment } }),

  // Кабинет владельца
  myOrganization: () => api<Organization>('/api/v1/me/organization'),
  saveOrganization: (b: OrganizationInput) => api<Organization>('/api/v1/me/organization', { method: 'PUT', json: b }),
  myActivities: () => api<OwnedActivity[]>('/api/v1/me/activities'),
  myActivity: (activityId: string) => api<OwnedActivity>(`/api/v1/me/activities/${id(activityId)}`),
  createActivity: (b: ActivityInput) => api<{ id: string; slug: string; status: string }>('/api/v1/me/activities', { json: b }),
  updateActivity: (activityId: string, b: ActivityInput) =>
    api<unknown>(`/api/v1/me/activities/${id(activityId)}`, { method: 'PUT', json: b }),
  deleteActivity: (activityId: string) => api<void>(`/api/v1/me/activities/${id(activityId)}`, { method: 'DELETE' }),
  submitActivity: (activityId: string) => api<unknown>(`/api/v1/me/activities/${id(activityId)}/submit`, { method: 'POST' }),
  unpublishActivity: (activityId: string) =>
    api<unknown>(`/api/v1/me/activities/${id(activityId)}/unpublish`, { method: 'POST' }),
  uploadPhoto: (activityId: string, file: File, caption?: string) => {
    const f = new FormData()
    f.append('activity_id', activityId)
    f.append('file', file)
    if (caption) f.append('caption', caption)
    return api<Photo>('/api/v1/upload', { form: f })
  },
  uploadVideo: (activityId: string, file: File) => {
    const f = new FormData()
    f.append('file', file)
    return api<Video>(`/api/v1/me/activities/${id(activityId)}/videos`, { form: f })
  },
  deleteMedia: (activityId: string, mediaId: string) =>
    api<void>(`/api/v1/me/activities/${id(activityId)}/media/${id(mediaId)}`, { method: 'DELETE' }),
}

const OWNER_TYPES = new Set(['section_owner', 'service_owner', 'owner_activity', 'owner_service'])
export const isOwner = (u?: User | null) => !!u && OWNER_TYPES.has(u.account_type)
