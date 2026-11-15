/**
 * Путь к фото бэкенда.
 *
 * Go-сервис отдаёт `photos` путями вида `/media/palitra-1.jpg`, и они
 * относительны к его origin. Сайт на стенде живёт на другом порту, поэтому
 * без rewrites `<img src="/media/…">` и `next/image` уходят на origin сайта
 * и получают 404.
 */

/**
 * destination для rewrite-прокси медиа, либо null — тогда проксируем ничего.
 *
 * Пустой адрес бэкенда означает «локальная разработка без Go-сервиса»:
 * моки лежат в `public/images/**` и в прокси не нуждаются.
 */
export function mediaProxyTarget(apiBaseUrl: string | undefined): string | null {
  const base = (apiBaseUrl ?? "").trim().replace(/\/+$/, "");
  // destination rewrite обязан быть абсолютным URL, иначе Next роняет старт.
  if (!/^https?:\/\//i.test(base)) return null;
  return `${base}/media/:path*`;
}
