import { apiBaseUrl } from "@/lib/api";
import {
  NO_SNIFF,
  clientIpHeaders,
  isRedirect,
  safeContentType,
  sessionCookieHeader,
  siteHintHeaders,
} from "@/lib/proxy";

/**
 * Прокси кабинета модерации на тот же origin, что и сайт.
 *
 * Прямых вызовов `/api/v1` из браузера нет: бэкенд живёт на другом порту стенда,
 * HttpOnly-кука сессии между origin не переезжает, а CORS настраивает не эта зона.
 * Порядок тот же, что в `app/api/auth/[...action]/route.ts`: Next пересылает куку
 * посетителя и возвращает ему ответ бэкенда.
 *
 * Белый список сегментов обязателен: `params` распаковывает `%2F`, и без проверки
 * прокси стал бы свободным пересылающим адресом того же бэкенда. Поэтому сюда
 * попадают только шесть форм ответа, а всё остальное отсекается до fetch.
 */

const LIST_NAMES = new Set(["queue", "journal", "reports"]);
const DECISION_TARGETS = new Set(["application", "report"]);

/** Ровно столько же, сколько принимает бэкенд (`maxDecisionBody`): larger тело
 *  нам не читать вовсе — буферизовать его в витрине смысла нет. */
const MAX_DECISION_BODY = 8 << 10;

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ action: string[] }> };

export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  return relay(request, action, "GET");
}

export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  return relay(request, action, "POST");
}

/**
 * Путь бэкенда из белого списка. `null` — запрос не похож ни на один разрешённый,
 * и до бэкенда он доходить не должен.
 */
export function resolveUpstream(segments: string[]): string | null {
  const path = segments.filter(Boolean);
  const [name] = path;
  if (!name) return null;

  if (path.length === 1 && LIST_NAMES.has(name)) {
    return `/api/v1/moderation/${name}`;
  }

  // decision/<application|report>/<числовой id>: `.` и `..` в сегментах не проходят
  // ни одно из условий, поэтому `..%2F..%2Fqueue` сюда не доходит. id попадает в
  // путь только целым числом — подставить произвольный адрес через него нельзя.
  if (path.length === 3 && name === "decision" && DECISION_TARGETS.has(path[1])) {
    const id = path[2];
    if (!/^\d{1,19}$/.test(id)) return null;
    return `/api/v1/moderation/${path[1]}s/${id}/decision`;
  }

  return null;
}

/**
 * Разрешённые значения фильтра статуса (§8): сервер на всё остальное отвечает
 * 400 со своим текстом, но пересылать в адрес бэкенда произвольную строку из
 * запроса посетителя не нужно и здесь.
 */
const STATUS_VALUES = new Set(["pending", "approved", "rejected", "open", "hidden", "dismissed"]);

/** Список модерации листается страницами и фильтруется по статусу — остальные параметры не пересылаем. */
export function pickQuery(search: string): string {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of ["page", "limit"]) {
    const value = params.get(key);
    if (value && /^\d{1,7}$/.test(value)) kept.set(key, value);
  }
  const status = params.get("status");
  if (status && STATUS_VALUES.has(status)) kept.set("status", status);
  const query = kept.toString();
  return query ? `?${query}` : "";
}

/** Конверт ошибки §9 — тем же форматом, что у бэкенда, чтобы клиент парсил одно. */
function envelope(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { code: status, message } }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      vary: "Cookie",
      ...NO_SNIFF,
    },
  });
}

async function relay(
  request: Request,
  action: string[],
  method: "GET" | "POST",
): Promise<Response> {
  const base = apiBaseUrl();
  if (base === "") {
    return envelope(503, "Серверной очереди модерации нет — адрес API не настроен");
  }

  const upstreamPath = resolveUpstream(action ?? []);
  if (!upstreamPath) {
    return envelope(404, "Неизвестный раздел модерации");
  }
  if (method === "POST" && !upstreamPath.endsWith("/decision")) {
    return envelope(405, "Списки модерации только для чтения");
  }

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    if (body.length > MAX_DECISION_BODY) {
      return envelope(413, "Слишком длинное решение модератора");
    }
  }

  const url = new URL(request.url);
  const upstream = await fetch(`${base}${upstreamPath}${pickQuery(url.search)}`, {
    method,
    headers: {
      accept: "application/json",
      // В бэкенд идёт одна кука — сессия модератора (см. `sessionCookieHeader`).
      ...headerPair("cookie", sessionCookieHeader(request.headers.get("cookie"))),
      // Признаки браузера для CSRF-защиты бэкенда (`SameSiteGuard`). Решение
      // модератора — POST под кукой сессии, то есть ровно тот запрос, который
      // эта защита обязана видеть: не перешлём — сервер видел бы вход вовсе без
      // origin и не отказывал бы чужому сайту. Подставить эти заголовки со своей
      // страницы браузеру нечем, а права по-прежнему решает роль из базы, не они.
      ...siteHintHeaders(request.headers),
      // Адрес посетителя: счётчики частоты бэкенда (§12.2) ведутся по IP, а без
      // заголовка видят адрес витрины и считают всех модераторов одним окном.
      ...clientIpHeaders(request.headers),
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
    // Редиректы не сопровождаем: при переходе на другой host `fetch` повторил бы
    // запрос с кукой, а адрес перехода назначает не витрина.
    redirect: "manual",
  }).catch(() => null);

  if (!upstream || isRedirect(upstream.status)) {
    return envelope(502, "Сервер модерации недоступен");
  }

  const replyHeaders = new Headers({
    "content-type": safeContentType(upstream.headers.get("content-type")),
    "cache-control": "private, no-store",
    // Ответ зависит от куки сессии: без Vary общий кэш слоя между браузером и
    // Next отдал бы одну очередь (или один отказ) другому посетителю.
    vary: "Cookie",
    ...NO_SNIFF,
  });

  // 204 и 304 по стандарту тела не имеют, и Response с телом на них бросается.
  if (upstream.status === 204 || upstream.status === 304) {
    return new Response(null, { status: upstream.status, headers: replyHeaders });
  }

  const text = await upstream.text();
  return new Response(text === "" ? null : text, {
    status: upstream.status,
    headers: replyHeaders,
  });
}

function headerPair(name: string, value: string): Record<string, string> {
  return value ? { [name]: value } : {};
}
