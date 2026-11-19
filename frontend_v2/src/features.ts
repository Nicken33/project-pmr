// Флаги функций, для которых на бэке ещё НЕТ API.
// Интерфейс уже готов и спрятан. Когда бэк сделает эндпоинт из BACKEND_INTEGRATION.md,
// достаточно добавить имя флага в VITE_FEATURES (через запятую) и пересобрать фронт.
//   VITE_FEATURES=review_votes,review_comments,not_found_requests,org_cover
// «all» включает всё (так работает демо с тестовым API).

export type Feature =
  | 'review_votes' // плюс/минус под отзывом
  | 'review_comments' // ответы и комментарии под отзывом, «ответ организации»
  | 'not_found_requests' // форма «Не нашли занятие?»
  | 'popular_searches' // частые запросы на пустом поиске
  | 'org_cover' // обложка организации
  | 'republish' // вернуть снятую анкету в публикацию

const raw = String(import.meta.env.VITE_FEATURES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export function hasFeature(f: Feature): boolean {
  return raw.includes('all') || raw.includes(f)
}
