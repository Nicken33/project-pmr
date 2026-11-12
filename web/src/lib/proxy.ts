/**
 * Общие проверки серверных прокси (`app/api/auth`, `app/api/moderation`).
 *
 * Прокси — единственное место, где адрес бэкенда знают браузеры посетителей,
 * поэтому он же и единственное место, где недоверенный ввод посетителя
 * превращается в запрос от имени сервера. Здесь собраны ровно те ограничения,
 * которые иначе каждый прокси придумал бы по-своему.
 */

import { isIP } from "node:net";

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

/** Извлекает значение токена из куки `talentro_session`. */
export function sessionTokenFromCookie(raw: string | null): string {
  const pair = sessionCookieHeader(raw);
  if (!pair) return "";
  return pair.slice(SESSION_COOKIE.length + 1).trim();
}

/** Формирует заголовок `Authorization: Bearer <token>` для запросов к бэкенду. */
export function bearerAuthHeader(raw: string | null): Record<string, string> {
  const token = sessionTokenFromCookie(raw);
  return token ? { authorization: `Bearer ${token}` } : {};
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

/**
 * Адрес посетителя для счётчиков частоты бэкенда (§12.2).
 *
 * `auth.ClientIP` (`backend/Talentro/internal/auth/limiter.go`) берёт адрес из
 * `X-Real-IP`, а при его отсутствии — из левого края `X-Forwarded-For`, и только
 * когда непосредственный пир приватный: за api всегда стоит прокси, и правда
 * заголовков — его ответственность. Этим прокси и является витрина, но адрес она
 * не передавала вовсе, поэтому бэкенд видел адрес сервера и складывал попытки
 * всех посетителей в одно окно — весь сайт держался бы лимитом одного человека
 * (10 входов в минуту и 3 регистрации в час на всех).
 *
 * `X-Real-IP` именно перезаписывается вычисленным значением, а не пересылается
 * как пришёл: то же соглашение зафиксировано в комментарии к `ClientIP`, а
 * чужое значение дало бы посетителю право выбрать себе окно. Единственный
 * источник адреса — цепочка `X-Forwarded-For`, которую собрал фронтальный слой
 * (Vercel, Caddy, любой обратный прокси перед `next start`); свою строку витрина
 * не придумывает и без адреса не шлёт ни одного заголовка.
 *
 * Не-IP в левом крае не пересылается намеренно: таким мусором нельзя ни испортить
 * чужое окно, ни выписать себе новое, а остаётся ровно то поведение, что было до
 * этой правки.
 *
 * Левый адрес заявляет не витрина, а тот, кто стоит перед ней, и посетитель может
 * подставить свой — рубеж от перебора чужих паролей, а не от анонимайзера; права
 * и кука от адреса не зависят.
 */
export function clientIpHeaders(headers: Headers): Record<string, string> {
  const chain = (headers.get("x-forwarded-for") ?? "").trim();
  if (chain === "") return {};
  const [first = ""] = chain.split(",");
  const client = first.trim();
  if (client === "" || isIP(client) === 0) return {};
  // Цепочка уходит целиком, а не одним адресом: правый край — прыжки между
  // клиентом и витриной, и бэкенду они видны не были.
  return { "x-forwarded-for": chain, "x-real-ip": client };
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
