// ЗАГОТОВКИ API: этих маршрутов в Go-бэке пока НЕТ.
// Фронт уже вызывает их, но только если включён флаг (src/features.ts).
// Полный контракт каждого маршрута — в BACKEND_INTEGRATION.md (раздел «Нужно сделать»).
// Таблицы для них уже есть в схеме базы: review_votes, review_comments, requests, search_queries.
import { api } from './client'
import type { ReviewComment, User } from './types'

const id = (v: string) => encodeURIComponent(v)

export const Planned = {
  /** Голос за отзыв: value 1 / -1 / null (снять). Ответ — новые счётчики. Flag: review_votes */
  voteReview: (reviewId: string, value: 1 | -1 | null) =>
    api<{ plus: number; minus: number }>(`/api/v1/reviews/${id(reviewId)}/vote`, { json: { value } }),

  /** Комментарии под отзывом. Flag: review_comments */
  reviewComments: (reviewId: string) => api<{ items: ReviewComment[] }>(`/api/v1/reviews/${id(reviewId)}/comments`),
  addReviewComment: (reviewId: string, text: string) => api<ReviewComment>(`/api/v1/reviews/${id(reviewId)}/comments`, { json: { text } }),

  /** Заявка «Не нашли занятие» (таблица requests). Flag: not_found_requests */
  notFoundRequest: (b: { query: string; city_id: string | null; contact: string | null }) =>
    api<{ id: string }>('/api/v1/requests', { json: b }),

  /** Частые запросы для пустого поиска (таблица search_queries). Flag: popular_searches */
  popularSearches: () => api<{ items: string[] }>('/api/v1/search/popular'),

  /** Аватар пользователя: multipart file. Ответ — пользователь с avatar_path. Flag: avatar */
  uploadAvatar: (file: File) => {
    const f = new FormData()
    f.append('file', file)
    return api<User & { avatar_path?: string }>('/api/v1/me/avatar', { form: f })
  },

  /** Логотип организации: multipart file. Flag: org_logo */
  uploadOrgLogo: (file: File) => {
    const f = new FormData()
    f.append('file', file)
    return api<{ logo_path: string }>('/api/v1/me/organization/logo', { form: f })
  },

  /** Вернуть снятую с публикации анкету (is_active = true, без новой модерации). Flag: republish */
  republish: (activityId: string) => api<unknown>(`/api/v1/me/activities/${id(activityId)}/republish`, { method: 'POST' }),
}
