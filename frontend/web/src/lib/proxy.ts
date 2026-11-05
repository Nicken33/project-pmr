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
