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
 * Прокси кабинета владельца на тот же origin, что и сайт.
 *
 * Порядок тот же, что в `app/api/moderation/[...action]/route.ts`: Next пересылает
 * куку посетителя и возвращает ему ответ бэкенда. Прямых вызовов `/api/v1/me/*` из
 * браузера нет — HttpOnly-кука сессии между origin не переезжает, а CORS настраивает
 * не эта зона.
 *
 * Белый список сегментов обязателен: `params` распаковывает `%2F`, и без проверки
 * прокси стал бы свободным пересылающим адресом того же бэкенда.
 */

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ action: string[] }> };
type Method = "GET" | "POST" | "PUT" | "DELETE";

interface Upstream {
  path: string;
  methods: readonly Method[];
  /** Загрузка файла: тело идёт потоком и не разбирается витриной. */
  upload?: "photo" | "video";
}

/** Правка карточки с группами и расписанием — JSON; больше этого витрине не читать. */
const MAX_JSON_BODY = 64 << 10;

/** Пределы бэкенда (§7, медиа). Проверяем только заявленную длину, не буферизуя тело. */
const PHOTO_LIMIT = 10 << 20;
const VIDEO_LIMIT = 50 << 20;
/** Границы multipart, имя поля и заголовки части — накладные расходы сверх файла. */
const MULTIPART_OVERHEAD = 64 << 10;

const NUMERIC_ID = /^\d{1,19}$/;

export async function GET(request: Request, context: Context) {
  return relay(request, await context.params, "GET");
}

export async function POST(request: Request, context: Context) {
  return relay(request, await context.params, "POST");
}

export async function PUT(request: Request, context: Context) {
  return relay(request, await context.params, "PUT");
}

export async function DELETE(request: Request, context: Context) {
  return relay(request, await context.params, "DELETE");
}

/**
 * Путь бэкенда из белого списка. `null` — запрос не похож ни на один разрешённый,
 * и до бэкенда он доходить не должен. Идентификаторы попадают в путь только целым
 * числом, поэтому `..%2F..%2F` через них не подставить.
 */
export function resolveUpstream(segments: string[]): Upstream | null {
  const path = (segments ?? []).filter(Boolean);
  const [name] = path;
  if (!name) return null;

  if (path.length === 1 && name === "organization") {
    return { path: "/api/v1/me/organization", methods: ["GET", "PUT"] };
  }
  // Справочники для форм кабинета: публичные, только чтение. Браузер не ходит на
  // бэкенд напрямую (CORS и HttpOnly-кука), поэтому направление и город форма
  // читает тем же прокси. Тела и параметров у этих маршрутов нет.
  if (path.length === 1 && name === "categories") {
    return { path: "/api/v1/categories", methods: ["GET"] };
  }
  if (path.length === 1 && name === "cities") {
    return { path: "/api/v1/cities", methods: ["GET"] };
  }
  if (name !== "activities") return null;

  if (path.length === 1) {
    return { path: "/api/v1/me/activities", methods: ["GET", "POST"] };
  }

  const id = path[1];
  if (!NUMERIC_ID.test(id)) return null;
  const base = `/api/v1/me/activities/${id}`;

  if (path.length === 2) return { path: base, methods: ["GET", "PUT"] };

  const action = path[2];
  if (path.length === 3 && (action === "submit" || action === "unpublish")) {
    return { path: `${base}/${action}`, methods: ["POST"] };
  }
  if (path.length === 3 && (action === "photos" || action === "videos")) {
    return {
      path: `${base}/${action}`,
      methods: ["POST"],
      upload: action === "photos" ? "photo" : "video",
    };
  }
  if (path.length === 4 && action === "media" && NUMERIC_ID.test(path[3])) {
    return { path: `${base}/media/${path[3]}`, methods: ["DELETE"] };
  }

  return null;
}

/** Список листается страницами; остальные параметры посетителя в адрес бэкенда не идут. */
export function pickQuery(search: string): string {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of ["page", "limit"]) {
    const value = params.get(key);
    if (value && /^\d{1,7}$/.test(value)) kept.set(key, value);
  }
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

/**
 * Тело запроса к бэкенду.
 *
 * JSON читается в строку с пределом — как в прокси модерации. Multipart не
 * разбирается вовсе: `request.body` уходит потоком, поэтому 50 МиБ видео не
 * ложатся в память витрины. `duplex: "half"` обязателен для потокового тела в
 * Node--fetch; Next сохраняет это поле в своём патче fetch.
 */
function requestBody(
  request: Request,
  method: Method,
  upload: Upstream["upload"],
): { body?: BodyInit; type?: string; error?: Response } {
  if (method === "GET" || method === "DELETE") return {};

  if (upload) {
    const type = request.headers.get("content-type") ?? "";
    if (!/^multipart\/form-data\s*;/i.test(type)) {
      return { error: envelope(415, "Файл отправляется формой multipart/form-data") };
    }
    const limit = (upload === "photo" ? PHOTO_LIMIT : VIDEO_LIMIT) + MULTIPART_OVERHEAD;
    const declared = Number(request.headers.get("content-length"));
    // Без Content-Length (chunked) предел проверяет бэкенд: читать поток ради
    // проверки значило бы буферизовать его целиком.
    if (Number.isFinite(declared) && declared > limit) {
      return {
        error: envelope(
          413,
          upload === "photo" ? "Фото больше 10 МиБ" : "Видео больше 50 МиБ",
        ),
      };
    }
    if (!request.body) return { error: envelope(400, "Файл не передан") };
    return { body: request.body, type };
  }

  return { type: "application/json" };
}

async function relay(
  request: Request,
  { action }: { action: string[] },
  method: Method,
): Promise<Response> {
  const base = apiBaseUrl();
  if (base === "") {
    return envelope(503, "Кабинет владельца не подключён — адрес API не настроен");
  }

  const upstream = resolveUpstream(action ?? []);
  if (!upstream) return envelope(404, "Неизвестный раздел кабинета");
  if (!upstream.methods.includes(method)) {
    return envelope(405, "Метод не поддерживается этим разделом кабинета");
  }

  const prepared = requestBody(request, method, upstream.upload);
  if (prepared.error) return prepared.error;

  let body = prepared.body;
  if (!upstream.upload && (method === "POST" || method === "PUT")) {
    const text = await request.text();
    if (text.length > MAX_JSON_BODY) {
      return envelope(413, "Слишком длинная правка карточки");
    }
    // POST submit/unpublish обходятся без тела; пустую строку в бэкенд не шлём.
    body = text === "" ? undefined : text;
  }

  const url = new URL(request.url);
  const headers: Record<string, string> = {
    accept: "application/json",
    // В бэкенд идёт одна кука — сессия владельца (см. `sessionCookieHeader`).
    ...headerPair("cookie", sessionCookieHeader(request.headers.get("cookie"))),
    // Признаки браузера для CSRF-защиты бэкенда (`SameSiteGuard`): правка и
    // загрузка — запросы под кукой, ровно те, что эта защита обязана видеть.
    ...siteHintHeaders(request.headers),
    // Адрес посетителя для счётчиков частоты бэкенда (§12.2).
    ...clientIpHeaders(request.headers),
    ...(prepared.type ? { "content-type": prepared.type } : {}),
  };
  // Границу multipart задаёт браузер; без content-length Node сам ставит
  // chunked, а подменять заявленную длину витрине незачем.
  const length = request.headers.get("content-length");
  if (upstream.upload && length) headers["content-length"] = length;

  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    body,
    cache: "no-store",
    // Редиректы не сопровождаем: при переходе на другой host fetch повторил бы
    // запрос с кукой, а адрес перехода назначает не витрина.
    redirect: "manual",
    ...(body instanceof ReadableStream ? { duplex: "half" as const } : {}),
  };

  const response = await fetch(
    `${base}${upstream.path}${pickQuery(url.search)}`,
    init,
  ).catch(() => null);

  if (!response || isRedirect(response.status)) {
    return envelope(502, "Сервер кабинета владельца недоступен");
  }

  const replyHeaders = new Headers({
    "content-type": safeContentType(response.headers.get("content-type")),
    "cache-control": "private, no-store",
    // Ответ зависит от куки сессии: без Vary общий кэш отдал бы одну карточку
    // (или один отказ) другому посетителю.
    vary: "Cookie",
    ...NO_SNIFF,
  });
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) replyHeaders.set("retry-after", retryAfter);

  // 204 и 304 по стандарту тела не имеют, и Response с телом на них бросается.
  if (response.status === 204 || response.status === 304) {
    return new Response(null, { status: response.status, headers: replyHeaders });
  }

  const text = await response.text();
  return new Response(text === "" ? null : text, {
    status: response.status,
    headers: replyHeaders,
  });
}

function headerPair(name: string, value: string): Record<string, string> {
  return value ? { [name]: value } : {};
}