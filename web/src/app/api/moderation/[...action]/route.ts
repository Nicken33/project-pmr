import { apiBaseUrl } from "@/lib/api";
import {
  NO_SNIFF,
  bearerAuthHeader,
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

  if (path.length === 2 && (name === "activities" || name === "applications")) {
    const id = path[1];
    if (!/^\d{1,19}$/.test(id)) return null;
    return `/api/v1/moderation/activities/${id}`;
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
  const targetType=params.get("target_type");
  if(targetType && ["card","review","media"].includes(targetType))kept.set("target_type",targetType);
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

function normalizeMediaPath(path: unknown): string {
  if (typeof path !== "string" || !path.trim()) return "";
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/media/")) return trimmed;
  if (trimmed.startsWith("media/")) return `/${trimmed}`;
  if (trimmed.startsWith("/")) return `/media${trimmed}`;
  return `/media/${trimmed}`;
}

function toApiApp(card: Record<string, unknown>, index = 1) {
  const numId = Number(card.id) || index;

  // Photos
  const rawPhotos = Array.isArray(card.photos) ? card.photos : [];
  const photos: string[] = [];
  for (const item of rawPhotos) {
    const p =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "path" in item
          ? String((item as { path?: unknown }).path ?? "")
          : "";
    const normalized = normalizeMediaPath(p);
    if (normalized && !photos.includes(normalized)) {
      photos.push(normalized);
    }
  }
  if (typeof card.cover_path === "string") {
    const coverNormalized = normalizeMediaPath(card.cover_path);
    if (coverNormalized && !photos.includes(coverNormalized)) {
      photos.unshift(coverNormalized);
    }
  }

  // Videos
  const rawVideos = Array.isArray(card.videos) ? card.videos : [];
  const videos: string[] = [];
  for (const item of rawVideos) {
    const p =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "path" in item
          ? String((item as { path?: unknown }).path ?? "")
          : "";
    const normalized = normalizeMediaPath(p);
    if (normalized && !videos.includes(normalized)) {
      videos.push(normalized);
    }
  }

  // Groups
  const rawGroups = Array.isArray(card.groups) ? card.groups : [];
  const groups = rawGroups.map((g: Record<string, unknown>, gIdx: number) => {
    const rawSchedules = Array.isArray(g.schedules) ? g.schedules : [];
    const loc = (g.location && typeof g.location === "object" ? g.location : {}) as Record<string, unknown>;
    return {
      id: Number(g.id) || gIdx + 1,
      name: typeof g.name === "string" ? g.name : null,
      age_from: typeof g.age_from === "number" ? g.age_from : null,
      age_to: typeof g.age_to === "number" ? g.age_to : null,
      price_from:
        typeof g.price_from === "number"
          ? g.price_from
          : typeof g.price_from === "string"
            ? Number(g.price_from)
            : null,
      price_to:
        typeof g.price_to === "number"
          ? g.price_to
          : typeof g.price_to === "string"
            ? Number(g.price_to)
            : null,
      price_period: typeof g.price_period === "string" ? g.price_period : "month",
      location_id: Number(loc.id || g.location_id) || 1,
      seats: typeof g.seats === "number" ? g.seats : null,
      schedules: rawSchedules.map((s: Record<string, unknown>) => ({
        weekday: Number(s.weekday) || 1,
        time_from: typeof s.time_from === "string" ? s.time_from : "10:00",
        time_to: typeof s.time_to === "string" ? s.time_to : "11:00",
        note: typeof s.note === "string" ? s.note : null,
        seats: typeof s.seats === "number" ? s.seats : null,
      })),
    };
  });

  // Locations
  const locsMap = new Map<string, Record<string, unknown>>();
  if (Array.isArray(card.locations)) {
    for (const loc of card.locations) {
      if (loc && typeof loc === "object") {
        const item = loc as Record<string, unknown>;
        if (item.address || item.id) {
          locsMap.set(String(item.id ?? item.address), item);
        }
      }
    }
  }
  for (const g of rawGroups) {
    if (g && typeof g === "object" && g.location && typeof g.location === "object") {
      const gl = g.location as Record<string, unknown>;
      if (gl.address || gl.id) {
        locsMap.set(String(gl.id ?? gl.address), gl);
      }
    }
  }
  if (locsMap.size === 0 && (card.address || card.city)) {
    locsMap.set("root", {
      id: 1,
      name: null,
      city: typeof card.city === "string" ? card.city : "Тирасполь",
      district: typeof card.district === "string" ? card.district : null,
      address: typeof card.address === "string" ? card.address : "",
      latitude: typeof card.latitude === "number" ? card.latitude : null,
      longitude: typeof card.longitude === "number" ? card.longitude : null,
      phone: typeof card.phone === "string" ? card.phone : null,
    });
  }
  const locations = Array.from(locsMap.values()).map((loc, lIdx) => ({
    id: Number(loc.id) || lIdx + 1,
    name: typeof loc.name === "string" ? loc.name : null,
    city: typeof loc.city === "string" ? loc.city : typeof card.city === "string" ? card.city : "Тирасполь",
    district: typeof loc.district === "string" ? loc.district : null,
    address: typeof loc.address === "string" ? loc.address : "",
    lat:
      typeof loc.latitude === "number"
        ? loc.latitude
        : typeof loc.lat === "number"
          ? loc.lat
          : null,
    lng:
      typeof loc.longitude === "number"
        ? loc.longitude
        : typeof loc.lng === "number"
          ? loc.lng
          : null,
    phone: typeof loc.phone === "string" ? loc.phone : null,
  }));

  const categorySlug =
    typeof card.category_slug === "string"
      ? card.category_slug
      : typeof card.direction === "string"
        ? card.direction
        : null;

  return {
    id: numId,
    card_id: numId,
    slug: typeof card.slug === "string" ? card.slug : "",
    title: typeof card.name === "string" ? card.name : typeof card.title === "string" ? card.title : "",
    kind: typeof card.record_type === "string" ? card.record_type : "activity",
    status: typeof card.status === "string" ? card.status : "pending",
    card_status: typeof card.status === "string" ? card.status : null,
    description: typeof card.description === "string" ? card.description : null,
    format: typeof card.class_format === "string" ? card.class_format : "offline",
    lesson_type: typeof card.class_type === "string" ? card.class_type : "group",
    phone: typeof card.phone === "string" ? card.phone : null,
    category: typeof card.direction === "string" ? card.direction : null,
    category_slug: categorySlug,
    super_category: null,
    super_category_slug: null,
    organization_id: Number(card.organization_id) || 0,
    organization_slug:
      typeof card.organization_slug === "string"
        ? card.organization_slug
        : typeof card.organization === "string"
          ? card.organization
          : "",
    organization_name:
      typeof card.organization === "string"
        ? card.organization
        : typeof card.organization_name === "string"
          ? card.organization_name
          : "",
    organization_type: "commercial",
    organization_city: typeof card.city === "string" ? card.city : null,
    groups,
    locations,
    photos,
    videos,
    groups_count: groups.length,
    locations_count: locations.length,
    submitted_at: typeof card.created_at === "string" ? card.created_at : null,
    reject_reason: typeof card.rejection_reason === "string" ? card.rejection_reason : null,
    decided_at: null,
    created_at: typeof card.created_at === "string" ? card.created_at : new Date().toISOString(),
    updated_at: typeof card.updated_at === "string" ? card.updated_at : new Date().toISOString(),
  };
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
  const commonHeaders = {
    accept: "application/json",
    // В бэкенд идёт одна кука — сессия модератора (см. `sessionCookieHeader`).
    ...headerPair("cookie", sessionCookieHeader(request.headers.get("cookie"))),
    ...bearerAuthHeader(request.headers.get("cookie")),
    // Признаки браузера для CSRF-защиты бэкенда (`SameSiteGuard`).
    ...siteHintHeaders(request.headers),
    // Адрес посетителя: счётчики частоты бэкенда (§12.2) ведутся по IP.
    ...clientIpHeaders(request.headers),
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
  };

  let upstream = await fetch(`${base}${upstreamPath}${pickQuery(url.search)}`, {
    method,
    headers: commonHeaders,
    body,
    cache: "no-store",
    redirect: "manual",
  }).catch(() => null);

  // Fallback для бэкенда Go:
  // 1) Очередь: /api/v1/moderation/queue -> /api/v1/moderation/activities
  if (upstream?.status === 404 && upstreamPath === "/api/v1/moderation/queue" && method === "GET") {
    const fallback = await fetch(`${base}/api/v1/moderation/activities${pickQuery(url.search)}`, {
      method: "GET",
      headers: commonHeaders,
      cache: "no-store",
      redirect: "manual",
    }).catch(() => null);
    if (fallback) upstream = fallback;
  }

  // 2) Решение: /api/v1/moderation/applications/{id}/decision -> /api/v1/moderation/activities/{id}/approve|reject
  const decisionMatch = upstreamPath.match(/^\/api\/v1\/moderation\/applications\/(\d+)\/decision$/);
  if (upstream?.status === 404 && decisionMatch && method === "POST") {
    const cardId = decisionMatch[1];
    let parsedBody: { action?: string; reason?: string; comment?: string } = {};
    try {
      parsedBody = body ? JSON.parse(body) : {};
    } catch {
      // ignore
    }
    const isApprove = parsedBody.action === "approve";
    const subPath = isApprove ? "approve" : "reject";
    const subBody = isApprove
      ? undefined
      : JSON.stringify({ comment: parsedBody.reason || parsedBody.comment || "Отклонено" });

    const fallback = await fetch(`${base}/api/v1/moderation/activities/${cardId}/${subPath}`, {
      method: "POST",
      headers: commonHeaders,
      body: subBody,
      cache: "no-store",
      redirect: "manual",
    }).catch(() => null);
    if (fallback) upstream = fallback;
  }

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
  if (text === "") {
    return new Response(null, { status: upstream.status, headers: replyHeaders });
  }

  let finalPayload = text;
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json) && upstreamPath === "/api/v1/moderation/queue") {
      const items = await Promise.all(
        json.map(async (item: Record<string, unknown>, idx: number) => {
          const cardId = item.id;
          if (cardId) {
            try {
              const detailRes = await fetch(`${base}/api/v1/moderation/activities/${cardId}`, {
                method: "GET",
                headers: commonHeaders,
                cache: "no-store",
              });
              if (detailRes.ok) {
                const detailJson = await detailRes.json();
                if (detailJson && typeof detailJson === "object") {
                  return toApiApp(detailJson as Record<string, unknown>, idx + 1);
                }
              }
            } catch {
              // fallback to item
            }
          }
          return toApiApp(item, idx + 1);
        }),
      );
      finalPayload = JSON.stringify({
        items,
        total: items.length,
        page: 1,
        limit: Math.max(20, items.length),
      });
    } else if (
      (upstreamPath.startsWith("/api/v1/moderation/activities/") ||
        upstreamPath.startsWith("/api/v1/moderation/applications/")) &&
      !upstreamPath.endsWith("/decision") &&
      json &&
      typeof json === "object" &&
      !("items" in json)
    ) {
      finalPayload = JSON.stringify(toApiApp(json as Record<string, unknown>));
    } else if (
      decisionMatch &&
      json &&
      typeof json === "object" &&
      !("application" in json) &&
      ("id" in json || "slug" in json)
    ) {
      finalPayload = JSON.stringify({
        application: toApiApp(json as Record<string, unknown>),
        journal_entry: null,
        replayed: false,
      });
    }
  } catch {
    // raw text
  }

  return new Response(finalPayload, {
    status: upstream.status,
    headers: replyHeaders,
  });
}

function headerPair(name: string, value: string): Record<string, string> {
  return value ? { [name]: value } : {};
}
