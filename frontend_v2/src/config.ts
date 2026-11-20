// Все внешние адреса — только здесь. Значения берутся из .env (см. .env.example).

/**
 * Адрес Go API без завершающего «/».
 * По умолчанию пусто — запросы идут на тот же домен (через прокси Vercel / Vite),
 * что исключает CORS и блокировки сторонних доменов антивирусами/провайдерами.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

/**
 * Прямой адрес сервера для КАРТИНОК/ВИДЕО и ЗАГРУЗКИ файлов (минуя прокси Vercel):
 * через прокси большие файлы приходили обрезанными, а тело запроса ограничено ~4,5 МБ.
 * Бэк разрешает CORS для сайта. При разработке — тот же адрес, что API (прокси Vite).
 */
export const DIRECT_URL = (import.meta.env.VITE_DIRECT_URL || (import.meta.env.DEV ? API_BASE_URL : 'https://vma8759072.s-vps.cloud')).replace(/\/+$/, '')

/** Client ID Google для входа через Google. */
export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '388340404200-aaav30gug0c7ij4c7682cnvepvf5m8rh.apps.googleusercontent.com'

/** Полный URL файла из MEDIA_DIR бэка. */
export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return `${DIRECT_URL}/media/${path.replace(/^\/+/, '').replace(/^media\//, '')}`
}

/** Город по умолчанию для карты, если у карточки нет координат (Тирасполь). */
export const DEFAULT_MAP_CENTER: [number, number] = [46.8403, 29.6433]

/** Почта команды для претензий и просьб убрать запись (ТЗ §12.13). */
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL || 'talentro.pmr@gmail.com'
