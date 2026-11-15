/**
 * API слой приложения
 * - Сгенерированные типы из OpenAPI
 * - Кастомный fetch клиент с credentials: 'include'
 * - TanStack Query хуки
 * - Мапперы API типов → Frontend типов
 */

// Сгенерированные типы и сервисы
export * from './generated';

// Клиент
export { customFetch, api, type ApiError, isApiError } from './client';

// Хуки
export {
  useActivities,
  useActivity,
  useSession,
  useCategories,
  useCities,
} from './hooks';

// Мапперы
export { mapCardToActivity, mapActivityToActivityItem } from './mappers';

// Типы для хуков
export type { UseActivitiesParams, UseActivitiesResult } from './hooks';