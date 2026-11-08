/**
 * Транспорт до Go-бэкенда.
 *
 * Два источника правды:
 *   · каталог — канонический `/api/v1/*` (`backend/Talentro` на ветке Агента 2);
 *   · сессия — `/api/auth/*` того сервиса, где живёт auth-срез (`authBaseUrl()`).
 *
 * Адреса разные, поэтому и переменные две. Когда auth переедет в канонический
 * бэкенд, `NEXT_PUBLIC_AUTH_URL` просто перестают задавать — она повторяет
 * `NEXT_PUBLIC_API_URL` по умолчанию.
 */

import type { ActivityFormat, ActivityKind, ActivityType } from "@/lib/types";
import type { SessionState } from "@/lib/view-mode";

export interface ApiCard {
  /** int64 в JSON строкой (`json:"id,string"`). */
  id: string;
  name: string;
  org_id: number;
  city: string;
  age: { min: number | null; max: number | null };
  link: string | null;
  description: string | null;
  district: string | null;
  price: number | null;
  category: string | null;
}

export interface ApiHealth {
  status: "ok" | "error";
  database: "connected" | "disconnected";
}

export interface CardQuery {
  city_name?: string;
  city?: number;
  direction?: number;
  age?: number;
  price_max?: number;
  q?: string;
}

/** `models.Card` из списка `/api/v1/activities`: занятие плюс подобранная группа и точка. */
export interface ApiActivity {
  /** int64 в JSON строкой (`json:"id,string"`). */
  id: string;
  slug: string;
  name: string;
  kind: ActivityKind;
  org_id: number;
  city: string;
  age: { min: number | null; max: number | null };
  link: string | null;
  description: string | null;
  district: string | null;
  price: number | null;
  category: string | null;
  org_slug: string | null;
  org_name: string | null;
  org_type: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  location_id: number | null;
  location_name: string | null;
  group_id: number | null;
  group_name: string | null;
  price_to: number | null;
  price_period: string | null;
  seats: number | null;
  category_id: number | null;
  category_slug: string | null;
  super_category: string | null;
  super_category_slug: string | null;
  format: ActivityFormat | null;
  lesson_type: ActivityType | null;
  status: string;
  verified: boolean;
  photo: string | null;
  groups_count: number;
  locations_count: number;
  updated_at: string;
}

/** `models.Media` — фото занятия, точки и видео из одной таблицы. */
export interface ApiMedia {
  path: string;
  caption: string | null;
  source_url: string | null;
  author: string | null;
  order_num: number;
}

/** `models.Lesson` — строка расписания; weekday 1=Пн … 7=Вс, время «ЧЧ:ММ». */
export interface ApiLesson {
  weekday: number;
  time_from: string;
  time_to: string;
  note: string | null;
  seats: number | null;
}

export interface ApiGroup {
  id: number;
  name: string | null;
  age_from: number | null;
  age_to: number | null;
  price_from: number | null;
  price_to: number | null;
  price_period: string | null;
  location_id: number;
  seats: number | null;
  schedules: ApiLesson[];
}

export interface ApiLocation {
  id: number;
  name: string | null;
  city: string;
  district: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  contacts_verified_at: string | null;
  groups_count: number;
  photos: ApiMedia[];
}

export interface ApiOrganization {
  id: number;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  site: string | null;
  address: string | null;
  city: string | null;
  contacts_verified_at: string | null;
}

/** `models.Activity` — карточка целиком (§9.3): группы, точки, фото, организация. */
export interface ApiActivityDetail extends ApiActivity {
  organization: ApiOrganization | null;
  locations: ApiLocation[];
  groups: ApiGroup[];
  photos: ApiMedia[];
  videos: ApiMedia[];
}

/** Страница организации: сама организация и её опубликованные занятия. */
export interface ApiOrganizationPage {
  organization: ApiOrganization | null;
  activities: ApiActivity[];
  total: number;
}

/** `models.Category` — узел дерева направлений; у корневого узла есть `children`. */
export interface ApiCategory {
  id: number;
  slug: string;
  name: string;
  kind: string;
  icon: string;
  order_num: number;
  children?: ApiCategory[];
}

export interface ApiPlace {
  id: number;
  slug: string;
  name: string;
  city_id?: number;
}

export interface ApiPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Параметры, которые бэкенд действительно применяет (`parseCardFilter`).
 * Всё остальное он молча игнорирует, а `sort` и `kind` с неизвестным значением
 * отвергает 400 — поэтому тип строгий и без выдуманных полей.
 */
export interface ActivityQuery {
  q?: string;
  kind?: ActivityKind;
  city?: string;
  district?: string;
  category?: string;
  age?: number;
  price_max?: number;
  free?: boolean;
  online?: boolean;
  verified?: boolean;
  day?: number;
  near?: string;
  radius?: number;
  sort?: "updated" | "price" | "name" | "verified";
  page?: number;
  limit?: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function trim(value = "") {
  return value.replace(/\/+$/, "");
}

export function apiBaseUrl(): string {
  return trim(process.env.NEXT_PUBLIC_API_URL ?? "");
}

/** Адрес сервиса, который раздаёт сессию. По умолчанию совпадает с каталогом. */
export function authBaseUrl(): string {
  return trim(process.env.NEXT_PUBLIC_AUTH_URL ?? "") || apiBaseUrl();
}

/** Каталог читается из API только когда явно задан адрес бэкенда. */
export function isApiEnabled(): boolean {
  return apiBaseUrl() !== "";
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** Запрос с куками сессии. Браузеру они нужны, серверному рендеру — тоже. */
  withSession?: boolean;
  /** Кука анонимного посетителя, пересланная серверным компонентом. */
  cookie?: string;
  signal?: AbortSignal;
}

/**
 * Ошибка бэкенда → текст для посетителя.
 *
 * Канон отдаёт конверт §9 `{error:{code,message,fields}}`
 * (`backend/Talentro/internal/httpx/response.go`), а не голый статус. Без тела
 * витрина показывала «Ответ 400 от /api/v1/activities» там, где сервер честно
 * назвал причину и поле: неприменимая сортировка, район без города, слишком
 * много попыток входа. Поля дописываем к сообщению — «проверь поля» само по
 * себе посетителю ничего не говорит.
 */
async function apiErrorFrom(response: Response, pathname: string): Promise<ApiError> {
  const fallback = `Ответ ${response.status} от ${pathname}`;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return new ApiError(response.status, fallback);
  }

  const error =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: unknown }).error
      : null;
  if (!error || typeof error !== "object") return new ApiError(response.status, fallback);

  const { message, fields } = error as { message?: unknown; fields?: unknown };
  const text = typeof message === "string" && message.trim() ? message.trim() : fallback;
  const hints =
    fields && typeof fields === "object" && !Array.isArray(fields)
      ? Object.entries(fields as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]))
          .map(([name, hint]) => `${name} — ${hint}`)
          .join("; ")
      : "";

  return new ApiError(response.status, hints ? `${text}: ${hints}` : text);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = path.startsWith("api/auth/") ? authBaseUrl() : apiBaseUrl();
  const url = new URL(`${base}/${path}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      cache: "no-store",
      // Без этого браузер не приложит HttpOnly-куку сессии к запросу на другом
      // порту стенда, а серверный рендер не передаст её бэкенду вовсе.
      credentials: options.withSession ? "include" : "same-origin",
      headers: {
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...(options.cookie ? { cookie: options.cookie } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, `Бэкенд недоступен: ${url.host} не отвечает`);
  }

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    throw await apiErrorFrom(response, url.pathname);
  }
  return (await response.json()) as T;
}

export function fetchHealth(): Promise<ApiHealth> {
  return request<ApiHealth>("health");
}

export function fetchCards(query: CardQuery = {}): Promise<ApiCard[]> {
  const params: Record<string, string | undefined> = {
    city_name: query.city_name,
    city: query.city === undefined ? undefined : String(query.city),
    direction: query.direction === undefined ? undefined : String(query.direction),
    age: query.age === undefined ? undefined : String(query.age),
    price_max: query.price_max === undefined ? undefined : String(query.price_max),
    q: query.q,
  };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const tail = search.toString();
  return request<ApiCard[]>(`api/cards${tail ? `?${tail}` : ""}`);
}

export function fetchActivities(query: ActivityQuery = {}): Promise<ApiPage<ApiActivity>> {
  return request<ApiPage<ApiActivity>>(`api/v1/activities${search(query)}`);
}

export function fetchActivity(slug: string): Promise<ApiActivityDetail> {
  // `encodeURIComponent` обязателен: slug живёт в пути, а «/» внутри него
  // превратил бы запрос в чужой маршрут.
  return request<ApiActivityDetail>(`api/v1/activities/${encodeURIComponent(slug)}`);
}

export function fetchOrganization(slug: string): Promise<ApiOrganizationPage> {
  return request<ApiOrganizationPage>(`api/v1/organizations/${encodeURIComponent(slug)}`);
}

export function fetchCategories(): Promise<ApiCategory[]> {
  return request<ApiCategory[]>("api/v1/categories");
}

export function fetchCities(): Promise<ApiPlace[]> {
  return request<ApiPlace[]>("api/v1/cities");
}

/** Районы бэкенд отдаёт только для одного города — без `city` отвечает 400 (§5.4). */
export function fetchDistricts(city: string): Promise<ApiPlace[]> {
  return request<ApiPlace[]>(`api/v1/districts?city=${encodeURIComponent(city)}`);
}

function search(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "" || value === null) continue;
    // `online=0` и `online=1` значат разное (`format = 'offline'` против
    // `format IN ('online','both')`), поэтому false отправляется, а не вырезается.
    if (typeof value === "boolean") {
      params.set(key, value ? "1" : "0");
      continue;
    }
    params.set(key, String(value));
  }
  const tail = params.toString();
  return tail ? `?${tail}` : "";
}

/**
 * Сессия для серверного рендера: `/api/auth/me` с кукой посетителя.
 *
 * Ошибка транспорта сюда не долетает — вызывающий трактует `null` как
 * «аноним», а состояние бэкенда покажет запрос каталога.
 */
export async function fetchSession(cookie: string): Promise<SessionState | null> {
  if (authBaseUrl() === "" || cookie === "") return null;
  try {
    return await request<SessionState>("api/auth/me", { cookie });
  } catch {
    return null;
  }
}
