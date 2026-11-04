/**
 * Транспорт до Go-бэкенда (backend/Talentro).
 *
 * На сервере сейчас ровно два маршрута — `internal/delivery/http/route.go`:
 *   GET /health
 *   GET /api/cards
 * Поэтому здесь нет клиентов для `/organizations`, `/me`, `/moderation` и прочих
 * эндпоинтов из §9 ТЗ: их не существует, и вызов упал бы в 404.
 */

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

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
}

/** Каталог читается из API только когда явно задан адрес бэкенда. */
export function isApiEnabled(): boolean {
  return apiBaseUrl() !== "";
}

async function request<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${apiBaseUrl()}/${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new ApiError(0, `Бэкенд недоступен: ${url.host} не отвечает`);
  }

  if (!response.ok) {
    throw new ApiError(response.status, `Ответ ${response.status} от ${url.pathname}`);
  }
  return (await response.json()) as T;
}

export function fetchHealth(): Promise<ApiHealth> {
  return request<ApiHealth>("health");
}

export function fetchCards(query: CardQuery = {}): Promise<ApiCard[]> {
  return request<ApiCard[]>("api/cards", {
    city_name: query.city_name,
    city: query.city === undefined ? undefined : String(query.city),
    direction: query.direction === undefined ? undefined : String(query.direction),
    age: query.age === undefined ? undefined : String(query.age),
    price_max: query.price_max === undefined ? undefined : String(query.price_max),
    q: query.q,
  });
}
