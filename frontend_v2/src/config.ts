// Все внешние адреса — только здесь. Значения берутся из .env (см. .env.example).

/**
 * Адрес Go API без завершающего «/». По умолчанию сборка обращается напрямую к серверу API;
 * при разработке (npm run dev / demo) — к тому же адресу через прокси Vite.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'https://vma8759072.s-vps.cloud')).replace(/\/+$/, '')

/** Client ID Google для входа через Google. Пусто — кнопка входа через Google скрыта. */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** Полный URL файла из MEDIA_DIR бэка. */
export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE_URL}/media/${path.replace(/^\/+/, '').replace(/^media\//, '')}`
}

/** Город по умолчанию для карты, если у карточки нет координат (Тирасполь). */
export const DEFAULT_MAP_CENTER: [number, number] = [46.8403, 29.6433]

/** Почта команды для претензий и просьб убрать запись (ТЗ §12.13). */
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL || 'talentro.pmr@gmail.com'
