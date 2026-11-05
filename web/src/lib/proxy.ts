/**
 * Общие проверки серверных прокси (`app/api/auth`, `app/api/moderation`).
 *
 * Прокси — единственное место, где адрес бэкенда знают браузеры посетителей,
 * поэтому он же и единственное место, где недоверенный ввод посетителя
 * превращается в запрос от имени сервера. Здесь собраны ровно те ограничения,
 * которые иначе каждый прокси придумал бы по-своему.
 */

/** Имя обязано совпадать с `auth.CookieName` в `backend/Talentro/internal/auth/session.go`. */
export const SESSION_COOKIE = "talentro_session";

/**
 * В бэкенд уходит только кука сессии.
 *
 * Прокси стоит на том же origin, что и весь сайт, поэтому `request.headers.cookie`
 * содержит и куки Next, и всё, что посадит любой будущий первый-party-сервис.
 * Пересылать их каноническому API нечем: бэкенд читает ровно одну куку, а
 * утечка остальных была бы нашей ошибкой, а не его запросом.
 */
export function sessionCookieHeader(raw: string | null): string {
  if (!raw) return "";
  for (const part of raw.split(";")) {
    const pair = part.trim();
    if (pair.startsWith(`${SESSION_COOKIE}=`)) return pair;
  }
  return "";
}

/**
 * Признаки, по которым бэкенд отличает браузерный запрос с чужого сайта:
 * их пересылают прокси вверх как есть, ничего не придумывая.
 */
export const SITE_HINT_HEADERS = ["origin", "sec-fetch-site"] as const;

/**
 * Заголовки браузера-отправителя для CSRF-защиты бэкенда.
 *
 * `SameSiteGuard` (`backend/Talentro/internal/delivery/http/same_site.go`) на
 * POST/PUT/PATCH/DELETE отказывает (403 по конверту §9), если видит прямой
 * признак чужого сайта: `Sec-Fetch-Site: cross-site` либо `Origin` вне
 * `ALLOWED_ORIGINS`, непарсящийся или `null`. Оба признака проставляет сам
 * браузер и оба нельзя подделать из чужого JS: `Sec-Fetch-Site` — forbidden
 * header, а `Origin` при междоменном fetch браузер жертвы прикладывает честно.
 * Поэтому пересылка «как есть» корректна: прокси не смягчает и не ужесточает
 * вердикт, а лишь не скрывает его.
 *
 * Без пересылки защита была бы формальной: браузер ходит в API не напрямую, а
 * через этот прокси, и бэкенд видел бы запрос без всяких признаков — «похож на
 * не-браузер» — и не отказывал бы никогда.
 *
 * Отсутствующий заголовок не отправляется вовсе, в том числе не уходит пустой
 * строкой: запросы без Origin — это мобильный клиент (Flutter Dio дергает API
 * напрямую) и серверный рендер, а пустой `Origin` бэкенд разобрать не может и
 * ответил бы 403 там, где вход работает.
 */
export function siteHintHeaders(headers: Headers): Record<string, string> {
  const hints: Record<string, string> = {};
  for (const name of SITE_HINT_HEADERS) {
    const value = headers.get(name);
    if (value) hints[name] = value;
  }
  return hints;
}

/** Редирект бэкенда наружу — не пересылаем: адрес в `Location` задаёт не витрина. */
export function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

/**
 * Content-Type ответа посетителю.
 *
 * Проксирует JSON-эндпоинты, поэтому любой другой тип — либо обход контракта,
 * либо HTML от чего-то, что стоит за бэкендом. В браузере такой ответ стал бы
 * разметкой, поэтому наружу идут только JSON и безобидный текст.
 */
export function safeContentType(value: string | null): string {
  if (value && value.toLowerCase().includes("json")) return value;
  return "text/plain; charset=utf-8";
}

export const NO_SNIFF = { "x-content-type-options": "nosniff" };
