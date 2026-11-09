import type {
  ActivityFormat,
  ActivityKind,
  ActivityType,
  ApplicationStatus,
} from "@/lib/types";
import type {
  ApiActivity,
  ApiCategory,
  ApiGroup,
  ApiLocation,
  ApiMedia,
  ApiOrganization,
  ApiPage,
  ApiPlace,
} from "@/lib/api";

/**
 * Клиент кабинета владельца.
 *
 * Все запросы идут через серверный прокси `/api/me/*`, а не прямо на бэкенд:
 * кука сессии HttpOnly и между origin не переезжает, а CORS настраивает не
 * витрина. Поля ответов — канонические (`kind`, `org_id`, `format`,
 * `lesson_type`, `photo`, `groups[].schedules[].time_from/time_to`), те же, что
 * разбирает `lib/api.ts`; ошибки — конверт §9 `{error:{code,message,fields}}`.
 */

const ENDPOINT = "/api/me";

/** Пределы бэкенда. Клиент проверяет их для удобства, но решает сервер. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4"] as const;

export type UploadKind = "photo" | "video";

/** Статус и поля — то, на чём кабинет строит состояния: 401, 403, 404, 409, 413, 415, 503. */
export class OwnerApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "OwnerApiError";
    this.status = status;
    this.fields = fields;
  }
}

/**
 * Медиа карточки в детали кабинета: канонический `models.Media`
 * (`path/caption/source_url/author/order_num`) плюс числовой `id`, которым
 * адресуют удаление. `id` необязательный только как честный запас: если сервер
 * его вдруг не пришлёт, плитка рисуется, а удаление не предлагается.
 */
export interface OwnerMedia extends ApiMedia {
  id?: number;
}

/** Ответ загрузки (201): `models.CardMedia` — медиа плюс id, card_id и kind. */
export interface UploadedMedia extends ApiMedia {
  id: number;
  card_id: number;
  kind: UploadKind;
}

/** Ответ удаления (200): `models.MediaDeleted`. */
export interface DeletedMedia {
  deleted: boolean;
  id: number;
  card_id: number;
}

/**
 * Карточка владельца — `models.OwnedCard`: канонический `Card` (те же имена, что
 * разбирает `lib/api.ts`) плюс `owner_id`, `is_active`, `reject_reason`,
 * `created_at`. Поля кабины сервер отдаёт всегда — выдумывать их не нужно.
 */
export interface OwnerCard extends ApiActivity {
  owner_id: number | null;
  is_active: boolean;
  reject_reason: string | null;
  created_at: string;
}

/** Деталь кабинета — `models.OwnedActivity`: карточка плюс вложенные срезы. */
export interface OwnerCardDetail extends OwnerCard {
  organization: ApiOrganization | null;
  locations: ApiLocation[];
  groups: ApiGroup[];
  photos: OwnerMedia[];
  videos: OwnerMedia[];
}

/** Подача на проверку (200): карточка после перехода и строка заявки модератора. */
export interface OwnerSubmitResult {
  card: OwnerCard;
  application_id: number;
  submitted_at: string;
}

/** Снятие с публикации (200): только карточка после перехода. */
export interface OwnerUnpublishResult {
  card: OwnerCard;
}

/** Организация владельца — `models.OwnedOrganization`: канон плюс поля кабины. */
export interface OwnedOrganization extends ApiOrganization {
  city_id: number | null;
  lat: number | null;
  lng: number | null;
  owner_id: number | null;
  publish_basis: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Строка списка кабинета: ровно то, что рисуется, без пустых «групп» из моков. */
export interface OwnerCardView {
  id: string;
  slug: string;
  title: string;
  kind: ActivityKind;
  status: ApplicationStatus;
  /** Статус как его назвал сервер — для честной подписи рядом с пилюлей. */
  rawStatus: string;
  organizationTitle: string;
  categoryTitle: string;
  groupsCount: number;
  locationsCount: number;
  photo: string | null;
  updatedAt: string;
  submittedAt?: string;
  rejectReason?: string;
  isActive: boolean;
}

/**
 * Поля карточки, которые владелец правит, — ровно `models.OwnedCardInput`.
 * `category_id` — числовой id из справочника направлений (не текст); `org_id` —
 * своя организация из `GET /me/organization`; `kind` выводится из роли и свободному
 * выбору не подлежит. Город, район, адрес, координаты, цена и ссылка — не поля
 * карточки: они живут в организации, точках и группах, поэтому в тело не входят.
 * `lesson_type` у услуги отсутствует (CHECK базы), у занятия — необязателен.
 */
export interface OwnerCardInput {
  name: string;
  kind: ActivityKind;
  org_id: number;
  category_id: number;
  description?: string | null;
  format: ActivityFormat;
  lesson_type?: ActivityType | null;
  phone?: string | null;
}

/**
 * Поля организации — `models.OwnedOrganizationInput`. Телефон обязателен (строка,
 * не null); тип — из закрытого списка `ORGANIZATION_TYPES`; город — числовой
 * `city_id` из справочника. Slug, owner_id, publish_basis, contacts_verified_at и
 * is_active только читаются и в тело не входят.
 */
export interface OwnerOrganizationInput {
  name: string;
  type: string;
  description?: string | null;
  phone: string;
  email?: string | null;
  site?: string | null;
  address?: string | null;
  city_id?: number | null;
  lat?: number | null;
  lng?: number | null;
}

/** Закрытый CHECK-список `organizations.type` (§8, табл. 2) — без свободной строки. */
export const ORGANIZATION_TYPES = [
  "школа",
  "студия",
  "дом творчества",
  "спортшкола",
  "частный мастер",
] as const;

export type OwnerPage = ApiPage<OwnerCard>;

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Бэкенд нумерует дни от понедельника (ISO); вне диапазона день не выдумываем. */
export function weekdayTitle(value: number): string | null {
  return value >= 1 && value <= 7 ? WEEKDAYS[value - 1] : null;
}

/** Статус карточки §7 → статус пилюли кабинета. Неизвестное значение — черновик. */
export function ownerStatus(value: string): ApplicationStatus {
  if (value === "published" || value === "approved") return "published";
  if (value === "on_moderation" || value === "pending") return "pending";
  if (value === "rejected") return "rejected";
  return "draft";
}

export function toCardView(row: OwnerCard): OwnerCardView {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.name,
    kind: row.kind === "service" ? "service" : "activity",
    status: ownerStatus(row.status),
    rawStatus: row.status,
    organizationTitle: row.org_name ?? "",
    categoryTitle: row.category ?? "",
    groupsCount: row.groups_count ?? 0,
    locationsCount: row.locations_count ?? 0,
    photo: row.photo,
    updatedAt: row.updated_at,
    rejectReason: row.reject_reason ?? undefined,
    isActive: row.is_active,
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}${path}`, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        // Границу multipart ставит браузер сам: подставленный вручную
        // content-type без boundary сделал бы тело нечитаемым для бэкенда.
        ...(typeof init?.body === "string" ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new OwnerApiError(0, "Сервер кабинета не отвечает");
  }

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    const error = (
      payload as { error?: { code?: number; message?: string; fields?: Record<string, string> } } | null
    )?.error;
    throw new OwnerApiError(
      response.status,
      error?.message ?? (text.trim() || `Ответ ${response.status}`),
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

/**
 * Идентификатор из ответа сервера попадает в путь запроса, поэтому он ровно то,
 * что принимает бэкенд: положительное int64. Подменённый `1/../../organization`
 * не должен становиться адресом.
 */
function numericId(value: string): string {
  if (!/^\d{1,19}$/.test(value)) {
    throw new OwnerApiError(0, "Сервер прислал некорректный номер записи");
  }
  return value;
}

export async function fetchMyActivities(page = 1, limit = 20): Promise<ApiPage<OwnerCardView>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const result = await call<OwnerPage>(`/activities?${params.toString()}`);
  return { ...result, items: (result.items ?? []).map(toCardView) };
}

export function fetchMyActivity(id: string): Promise<OwnerCardDetail> {
  return call<OwnerCardDetail>(`/activities/${numericId(id)}`);
}

/** Создание (201) и правка (200) возвращают плоский `OwnedCard` — без вложенных
 *  групп, точек и медиа. Деталь кабинета перечитывается отдельным GET, чтобы не
 *  выдумывать срезы из плоского ответа. */
export function createMyActivity(input: OwnerCardInput): Promise<OwnerCard> {
  return call<OwnerCard>("/activities", { method: "POST", body: JSON.stringify(input) });
}

export function updateMyActivity(id: string, input: OwnerCardInput): Promise<OwnerCard> {
  return call<OwnerCard>(`/activities/${numericId(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** 409 — карточка уже на проверке; сообщение сервера показываем как есть. */
export function submitMyActivity(id: string): Promise<OwnerSubmitResult> {
  return call<OwnerSubmitResult>(`/activities/${numericId(id)}/submit`, { method: "POST" });
}

export function unpublishMyActivity(id: string): Promise<OwnerUnpublishResult> {
  return call<OwnerUnpublishResult>(`/activities/${numericId(id)}/unpublish`, { method: "POST" });
}

/** 404 — у вошедшего нет своей организации; это не ошибка транспорта. */
export function fetchMyOrganization(): Promise<OwnedOrganization> {
  return call<OwnedOrganization>("/organization");
}

export function updateMyOrganization(input: OwnerOrganizationInput): Promise<OwnedOrganization> {
  return call<OwnedOrganization>("/organization", { method: "PUT", body: JSON.stringify(input) });
}

/**
 * Справочники для форм кабинета. Браузер не ходит на бэкенд напрямую (CORS и
 * HttpOnly-кука), поэтому публичные `/api/v1/categories` и `/api/v1/cities`
 * читаются тем же прокси `/api/me/*` — только GET, без тела.
 */
export function fetchOwnerCategories(): Promise<ApiCategory[]> {
  return call<ApiCategory[]>("/categories");
}

export function fetchOwnerCities(): Promise<ApiPlace[]> {
  return call<ApiPlace[]>("/cities");
}

export interface CategoryOption {
  id: number;
  title: string;
}

/**
 * Выбираемые направления — листья дерева, подходящие виду карточки. Бэкенд
 * проверяет `kind` категории (равен виду карточки либо `both`), поэтому чужие
 * направления в выбор не попадают: иначе сервер ответил бы 400 на category_id.
 */
export function categoryOptions(raw: ApiCategory[], kind: ActivityKind): CategoryOption[] {
  const options: CategoryOption[] = [];
  for (const node of raw) {
    for (const child of node.children ?? []) {
      if (child.kind === kind || child.kind === "both") {
        options.push({ id: child.id, title: child.name });
      }
    }
  }
  return options;
}

/**
 * Проверка файла до отправки — удобство, а не граница: тип и размер решает
 * сервер (413 и 415). SVG не принимаем: бэкенд его отвергает.
 */
export function checkUpload(file: File, kind: UploadKind): string | null {
  const types: readonly string[] = kind === "photo" ? PHOTO_TYPES : VIDEO_TYPES;
  const limit = kind === "photo" ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES;
  if (!types.includes(file.type)) {
    return kind === "photo"
      ? "Нужен файл JPEG, PNG или WebP — SVG сервер не принимает"
      : "Нужен файл MP4";
  }
  if (file.size > limit) {
    return kind === "photo" ? "Фото больше 10 МиБ" : "Видео больше 50 МиБ";
  }
  if (file.size === 0) return "Файл пустой";
  return null;
}

export function uploadMedia(id: string, file: File, kind: UploadKind): Promise<UploadedMedia> {
  const form = new FormData();
  form.append("file", file);
  return call<UploadedMedia>(`/activities/${numericId(id)}/${kind === "photo" ? "photos" : "videos"}`, {
    method: "POST",
    body: form,
  });
}

export function deleteMedia(id: string, mediaId: string): Promise<DeletedMedia> {
  return call<DeletedMedia>(`/activities/${numericId(id)}/media/${numericId(mediaId)}`, { method: "DELETE" });
}

/** Сетевой сбой и чужой тип ошибки приводим к одному статусу: 0 — «сервер не отвечает». */
export function toOwnerError(value: unknown): OwnerApiError {
  return value instanceof OwnerApiError
    ? value
    : new OwnerApiError(0, "Сервер кабинета не отвечает");
}