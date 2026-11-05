import type {
  ActivityFormat,
  AgeGroup,
  Application,
  ApplicationStatus,
  ContentReport,
  Location,
  ModerationEntry,
  ScheduleRow,
  Weekday,
} from "@/lib/types";

/**
 * Клиент кабинета модерации (§3.9, §12.1).
 *
 * Все запросы идут через серверный прокси `/api/moderation/*`, а не прямо на
 * бэкенд: кука сессии HttpOnly и между origin не переезжает, а CORS настраивает
 * не витрина. Коды и тела ответов — те же, что проверяет
 * `docs/acceptance/moderation-smoke.sh`.
 */

const ENDPOINT = "/api/moderation";

export interface ModerationPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Статус и поля — то, на чём строит состояния кабинета: 401, 403, 409, 400. */
export class ModerationApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ModerationApiError";
    this.status = status;
    this.fields = fields;
  }
}

interface ApiApplication {
  id: number;
  card_id: number;
  slug: string;
  title: string;
  kind: string;
  status: string;
  card_status: string | null;
  description: string | null;
  format: string;
  lesson_type: string | null;
  phone: string | null;
  category: string | null;
  category_slug: string | null;
  super_category: string | null;
  super_category_slug: string | null;
  organization_id: number;
  organization_slug: string;
  organization_name: string;
  organization_type: string;
  organization_city: string | null;
  groups: ApiGroup[];
  locations: ApiLocation[];
  photos: string[];
  groups_count: number;
  locations_count: number;
  submitted_at: string | null;
  reject_reason: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiLocation {
  id: number;
  name: string | null;
  city: string;
  district: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
}

interface ApiGroup {
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

interface ApiLesson {
  weekday: number;
  time_from: string;
  time_to: string;
  note: string | null;
  seats: number | null;
}

interface ApiJournalEntry {
  id: number;
  application_id: number;
  card_id: number;
  card_slug: string;
  card_title: string;
  organization_slug: string;
  actor_id: number;
  actor_name: string;
  action: string;
  reason: string | null;
  comment: string | null;
  created_at: string;
}

interface ApiReport {
  id: number;
  target_type: string;
  target_id: number;
  target_excerpt: string | null;
  reason: string;
  detail: string | null;
  status: string;
  hide_reason: string | null;
  reporter_name: string | null;
  card_id: number | null;
  card_slug: string | null;
  card_title: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiDecisionResult {
  application: ApiApplication | null;
  journal_entry: ApiJournalEntry | null;
  report?: ApiReport | null;
  /** У решения по жалобе сервер поля `replayed` не отдаёт — его просто нет. */
  replayed?: boolean;
}

const WEEKDAYS: Weekday[] = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Бэкенд нумерует дни от понедельника (ISO); вне диапазона день не выдумываем. */
export function toWeekday(value: number): Weekday | null {
  return value >= 1 && value <= 7 ? WEEKDAYS[value - 1] : null;
}

function applicationStatus(value: string): ApplicationStatus {
  if (value === "approved") return "published";
  if (value === "rejected") return "rejected";
  if (value === "draft") return "draft";
  return "pending";
}

export function toApplication(row: ApiApplication): Application {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    kind: row.kind === "service" ? "service" : "activity",
    categorySlug: row.category_slug ?? "",
    superSlug: row.super_category_slug ?? "",
    organizationSlug: row.organization_slug,
    status: applicationStatus(row.status),
    description: row.description ?? "",
    format: row.format as ActivityFormat,
    type: row.lesson_type as Application["type"],
    photos: row.photos ?? [],
    locations: (row.locations ?? []).map(
      (item): Location => ({
        id: String(item.id),
        name: item.name ?? undefined,
        citySlug: item.city,
        districtSlug: item.district ?? undefined,
        cityTitle: item.city,
        districtTitle: item.district ?? undefined,
        address: item.address,
        // В кабинете карта не рисуется, а координаты в типе обязательны: NULL
        // остаётся нулём и ничем, кроме адреса, не показывается.
        lat: item.lat ?? 0,
        lng: item.lng ?? 0,
        phone: item.phone ?? undefined,
      }),
    ),
    groups: (row.groups ?? []).map(
      (item): AgeGroup => ({
        id: String(item.id),
        title: item.name ?? undefined,
        ageFrom: item.age_from,
        ageTo: item.age_to,
        priceFrom: item.price_from,
        priceTo: item.price_to ?? undefined,
        pricePeriod: item.price_period as AgeGroup["pricePeriod"],
        locationId: String(item.location_id),
        seats: item.seats ?? undefined,
        schedule: (item.schedules ?? []).flatMap((lesson): ScheduleRow[] => {
          const day = toWeekday(lesson.weekday);
          if (!day) return [];
          return [{ day, start: lesson.time_from, end: lesson.time_to, note: lesson.note ?? undefined, seats: lesson.seats ?? undefined }];
        }),
      }),
    ),
    phone: row.phone ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    rejectReason: row.reject_reason ?? undefined,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    byOwner: false,
  };
}

export function toJournalEntry(row: ApiJournalEntry): ModerationEntry {
  return {
    id: String(row.id),
    applicationTitle: row.card_title,
    organizationSlug: row.organization_slug,
    actor: row.actor_name,
    decision: row.action === "reject" ? "rejected" : "published",
    comment: row.comment ?? row.reason ?? undefined,
    createdAt: row.created_at,
  };
}

export function toReport(row: ApiReport): ContentReport {
  return {
    id: String(row.id),
    targetType: row.target_type as ContentReport["targetType"],
    targetExcerpt: row.target_excerpt ?? "",
    author: row.reporter_name ?? "Аноним",
    reason: row.reason,
    detail: row.detail ?? undefined,
    activitySlug: row.card_slug ?? "",
    activityTitle: row.card_title ?? "",
    createdAt: row.created_at,
    status: row.status === "hidden" ? "hidden" : row.status === "dismissed" ? "dismissed" : "open",
    hideReason: row.hide_reason ?? undefined,
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}${path}`, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
    });
  } catch {
    throw new ModerationApiError(0, "Сервер модерации не отвечает");
  }

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    const error = (payload as { error?: { code?: number; message?: string; fields?: Record<string, string> } })?.error;
    throw new ModerationApiError(
      response.status,
      error?.message ?? `Ответ ${response.status}`,
      error?.fields ?? {},
    );
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface DecisionInput {
  action: "approve" | "reject";
  reason?: string;
  comment?: string;
}

export interface ReportDecisionInput {
  action: "hide" | "dismiss";
  reason?: string;
}

function listQuery(page: number, limit: number, status?: string): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (status) params.set("status", status);
  return `?${params.toString()}`;
}

/**
 * Идентификатор из ответа сервера попадает в путь запроса, поэтому он у нас ровно
 * то, что принимает бэкенд: положительное int64. Всё остальное отклоняем здесь, а
 * не отправляем в прокси: кабинет читает id из чужого JSON, и подменённый
 * `1/../../queue` не должен становиться адресом.
 */
function numericId(value: string): string {
  if (!/^\d{1,19}$/.test(value)) {
    throw new ModerationApiError(0, "Сервер прислал некорректный номер записи");
  }
  return value;
}

export async function fetchQueue(page = 1, limit = 20, status = "pending"): Promise<ModerationPage<Application>> {
  const result = await call<ModerationPage<ApiApplication>>(`/queue${listQuery(page, limit, status)}`);
  return { ...result, items: result.items.map(toApplication) };
}

export async function fetchJournal(page = 1, limit = 20): Promise<ModerationPage<ModerationEntry>> {
  const result = await call<ModerationPage<ApiJournalEntry>>(`/journal${listQuery(page, limit)}`);
  return { ...result, items: result.items.map(toJournalEntry) };
}

export async function fetchReports(page = 1, limit = 20, status = "open"): Promise<ModerationPage<ContentReport>> {
  const result = await call<ModerationPage<ApiReport>>(`/reports${listQuery(page, limit, status)}`);
  return { ...result, items: result.items.map(toReport) };
}

/**
 * Решение по анкете. Повтор того же решения — 200 с `replayed: true` и без новой
 * строки журнала, переписка принятого решения — 409.
 */
export async function decideApplication(
  id: string,
  input: DecisionInput,
): Promise<{ application: Application | null; replayed: boolean }> {
  const result = await call<ApiDecisionResult>(`/decision/application/${numericId(id)}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return {
    application: result.application ? toApplication(result.application) : null,
    replayed: result.replayed === true,
  };
}

/** У решения по жалобе сервер поля `replayed` не отдаёт: повтор возвращает ту же запись. */
export async function decideReport(
  id: string,
  input: ReportDecisionInput,
): Promise<{ report: ContentReport | null; replayed: boolean }> {
  const result = await call<ApiDecisionResult>(`/decision/report/${numericId(id)}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { report: result.report ? toReport(result.report) : null, replayed: result.replayed === true };
}
