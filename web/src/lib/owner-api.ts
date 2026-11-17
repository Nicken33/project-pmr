import type {
  ActivityFormat,
  ActivityKind,
  ActivityType,
  ApplicationStatus,
} from "@/lib/types";
import { normalizeMediaPath } from "@/lib/utils";
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
export const PHOTO_MAX_EDGE = 1600;
export const VIDEO_MAX_DURATION_SECONDS = 30;
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
  messengers: OwnerMessenger[];
  locations: OwnerOrganizationLocation[];
}

export interface OwnerOrganizationLocation {
  id: string;
  name: string;
  city: string;
  district: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  groups_count: number;
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
  record_type: ActivityKind;
  direction_id: string;
  description?: string | null;
  class_format: ActivityFormat;
  class_type?: ActivityType;
  phone?: string | null;
  locations: { key: string; id?: string; name?: string | null; city_id: string; district_id?: string | null; address: string; latitude: number; longitude: number; phone?: string | null; source_type: string; source_url?: string | null }[];
  groups: { name: string; age_from: number | null; age_to: number | null; price_from: number; price_to?: number | null; price_period?: string | null; location_key: string; seats: number | null; schedules: { weekday: number; start_time: string; end_time: string; note?: string | null; seats?: number | null }[] }[];
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
  city_id: number;
  messengers?: { channel: "telegram" | "viber" | "whatsapp" | "instagram"; contact: string }[];
}

export interface OwnerMessenger {
  channel: "telegram" | "viber" | "whatsapp" | "instagram";
  contact: string;
}

/** Значения API/БД; подписи для людей задаются в форме кабинета. */
export const ORGANIZATION_TYPES = [
  "school",
  "studio",
  "art_house",
  "sports_school",
  "private_master",
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
    submittedAt: row.status === "on_moderation" || row.status === "pending" ? row.updated_at : undefined,
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
  const result = await call<unknown>("/activities");
  const rows = Array.isArray(result) ? result : ((result as { items?: unknown[] } | null)?.items ?? []);
  const all = rows.map(normalizeOwnedCard).map(toCardView);
  const start = (page - 1) * limit;
  return { items: all.slice(start, start + limit), total: all.length, page, limit };
}

export async function fetchMyActivity(id: string): Promise<OwnerCardDetail> {
  return normalizeOwnedDetail(await call<unknown>(`/activities/${numericId(id)}`));
}

/** Создание (201) и правка (200) возвращают плоский `OwnedCard` — без вложенных
 *  групп, точек и медиа. Деталь кабинета перечитывается отдельным GET, чтобы не
 *  выдумывать срезы из плоского ответа. */
export function createMyActivity(input: OwnerCardInput): Promise<OwnerCard> {
  return call<{ id: string; slug: string; status: string }>("/activities", { method: "POST", body: JSON.stringify(input) }).then((row) => ({ id: row.id, slug: row.slug, name: input.name, record_type: input.record_type, status: row.status, is_active: false } as unknown as OwnerCard));
}

export function updateMyActivity(id: string, input: OwnerCardInput): Promise<OwnerCard> {
  return call<unknown>(`/activities/${numericId(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  }).then(normalizeOwnedCard);
}

export function deleteMyActivity(id: string): Promise<void> {
  return call<void>(`/activities/${numericId(id)}`, { method: "DELETE" });
}

/** 409 — карточка уже на проверке; сообщение сервера показываем как есть. */
export function submitMyActivity(id: string): Promise<OwnerSubmitResult> {
  return call<unknown>(`/activities/${numericId(id)}/submit`, { method: "POST" }).then((value) => ({ card: normalizeOwnedCard(value), application_id: 0, submitted_at: new Date().toISOString() }));
}

export function unpublishMyActivity(id: string): Promise<OwnerUnpublishResult> {
  return call<unknown>(`/activities/${numericId(id)}/unpublish`, { method: "POST" }).then((value) => ({ card: normalizeOwnedCard(value) }));
}

interface RawGroupLocation {
  id?: string | number;
  city_id?: string | number;
  district_id?: string | number | null;
  city?: string;
  district?: string | null;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
}

interface RawSchedule {
  weekday: number;
  start_time: string;
  end_time: string;
  note?: string | null;
  seats?: number | null;
}

interface RawGroup {
  id?: string | number;
  name?: string | null;
  age_from?: number | null;
  age_to?: number | null;
  price_from?: number | null;
  price_to?: number | null;
  price_period?: string | null;
  seats?: number | null;
  location?: RawGroupLocation;
  schedules?: RawSchedule[];
}

interface RawMedia {
  id?: string | number;
  path: string;
  alt_text?: string | null;
  position?: number;
}

function normalizeOwnedCard(value: unknown): OwnerCard {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const toNum = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
  const groups = Array.isArray(row.groups) ? (row.groups as RawGroup[]) : [];
  const locations = new Set(groups.map((g) => String(g.location?.id ?? "")).filter(Boolean));
  const photos = Array.isArray(row.photos) ? (row.photos as RawMedia[]) : [];
  const photo = photos[0]?.path ?? (typeof row.cover_path === "string" ? row.cover_path : null);
  return {
    ...row,
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    kind: row.record_type === "service" ? "service" : "activity",
    org_id: toNum(row.organization_id) ?? 0,
    org_name: String(row.organization ?? ""),
    category: String(row.direction ?? ""),
    category_id: toNum(row.direction_id),
    format: (row.class_format as ActivityFormat | null) ?? null,
    lesson_type: (row.class_type as ActivityType | null) ?? null,
    photo,
    groups_count: groups.length,
    locations_count: locations.size,
    updated_at: String(row.updated_at ?? ""),
    reject_reason: (row.rejection_reason as string | null) ?? (row.reject_reason as string | null) ?? null,
    is_active: row.is_active !== false,
    status: (row.status as string) ?? "draft",
    owner_id: null,
    created_at: String(row.created_at ?? ""),
  } as OwnerCard;
}

function normalizeOwnedDetail(value: unknown): OwnerCardDetail {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const card = normalizeOwnedCard(row);
  const groupRows = Array.isArray(row.groups) ? (row.groups as RawGroup[]) : [];
  const locMap = new Map<string, ApiLocation>();
  const groups: ApiGroup[] = groupRows.map((g) => {
    const loc = g.location ?? {};
    const id = Number(loc.id ?? 0);
    locMap.set(String(id), {
      id,
      city_id: Number(loc.city_id ?? 0),
      district_id: loc.district_id == null ? null : Number(loc.district_id),
      name: null,
      city: loc.city ?? "",
      district: loc.district ?? null,
      address: loc.address ?? "",
      lat: loc.latitude ?? null,
      lng: loc.longitude ?? null,
      phone: loc.phone ?? null,
      contacts_verified_at: null,
      groups_count: 0,
      photos: [],
    });
    return {
      id: Number(g.id),
      name: g.name ?? null,
      age_from: g.age_from ?? null,
      age_to: g.age_to ?? null,
      price_from: g.price_from ?? 0,
      price_to: g.price_to ?? null,
      price_period: g.price_period ?? null,
      location_id: id,
      seats: g.seats ?? null,
      schedules: (g.schedules ?? []).map((s) => ({
        weekday: s.weekday,
        time_from: s.start_time,
        time_to: s.end_time,
        note: s.note ?? null,
        seats: s.seats ?? null,
      })),
    };
  });
  const photos = Array.isArray(row.photos) ? (row.photos as RawMedia[]) : [];
  const videos = Array.isArray(row.videos) ? (row.videos as RawMedia[]) : [];
  return {
    ...card,
    organization: null,
    groups,
    locations: [...locMap.values()],
    photos: photos.map((p) => ({
      id: Number(p.id),
      path: normalizeMediaPath(p.path),
      caption: p.alt_text ?? null,
      source_url: null,
      author: null,
      order_num: p.position ?? 0,
    })),
    videos: videos.map((p) => ({
      id: Number(p.id),
      path: normalizeMediaPath(p.path),
      caption: null,
      source_url: null,
      author: null,
      order_num: p.position ?? 0,
    })),
  } as OwnerCardDetail;
}

/** 404 — у вошедшего нет своей организации; это не ошибка транспорта. */
export function fetchMyOrganization(): Promise<OwnedOrganization> {
  return call<unknown>("/organization").then(normalizeOwnedOrganization);
}

export function updateMyOrganization(input: OwnerOrganizationInput): Promise<OwnedOrganization> {
  return call<unknown>("/organization", {
    method: "PUT",
    body: JSON.stringify({
      name: input.name,
      organization_type: input.type,
      description: input.description ?? null,
      phone: input.phone,
      email: input.email ?? null,
      website: input.site ?? null,
      city_id: input.city_id,
      messengers: input.messengers ?? [],
    }),
  }).then(normalizeOwnedOrganization);
}

/** Backend models use `website`, `latitude` and string-encoded int64 IDs. */
function normalizeOwnedOrganization(value: unknown): OwnedOrganization {
  if (!value || typeof value !== "object") throw new OwnerApiError(0, "Сервер прислал некорректный профиль организации");
  const row = value as Record<string, unknown>;
  const numeric = (candidate: unknown): number | null => {
    if (candidate === null || candidate === undefined || candidate === "") return null;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    id: numeric(row.id) ?? 0,
    slug: typeof row.slug === "string" ? row.slug : "",
    name: typeof row.name === "string" ? row.name : "",
    type: typeof row.type === "string" ? row.type : "",
    description: typeof row.description === "string" ? row.description : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    email: typeof row.email === "string" ? row.email : null,
    site: typeof row.website === "string" ? row.website : typeof row.site === "string" ? row.site : null,
    address: typeof row.address === "string" ? row.address : null,
    city: typeof row.city === "string" ? row.city : null,
    contacts_verified_at:
      typeof row.contacts_checked_at === "string"
        ? row.contacts_checked_at
        : typeof row.contacts_verified_at === "string"
          ? row.contacts_verified_at
          : null,
    city_id: numeric(row.city_id),
    lat: numeric(row.latitude ?? row.lat),
    lng: numeric(row.longitude ?? row.lng),
    owner_id: numeric(row.owner_id),
    publish_basis: typeof row.publication_basis === "string" ? row.publication_basis : "",
    is_active: row.is_active !== false,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    messengers: Array.isArray(row.messengers)
      ? row.messengers.filter(
          (item): item is OwnerMessenger =>
            !!item &&
            typeof item === "object" &&
            ["telegram", "viber", "whatsapp", "instagram"].includes(
              String((item as Record<string, unknown>).channel),
            ) &&
            typeof (item as Record<string, unknown>).contact === "string",
        )
      : [],
    locations: Array.isArray(row.locations) ? row.locations.map((value) => {
      const location = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      return { id: String(location.id ?? ""), name: typeof location.name === "string" ? location.name : "", city: String(location.city ?? ""), district: typeof location.district === "string" ? location.district : null, address: String(location.address ?? ""), lat: numeric(location.latitude), lng: numeric(location.longitude), phone: typeof location.phone === "string" ? location.phone : null, groups_count: Number(location.groups_count ?? 0) };
    }) : [],
  };
}

/**
 * Справочники для форм кабинета. Браузер не ходит на бэкенд напрямую (CORS и
 * HttpOnly-кука), поэтому публичные `/api/v1/categories` и `/api/v1/cities`
 * читаются тем же прокси `/api/me/*` — только GET, без тела.
 */
export function fetchOwnerCategories(): Promise<ApiCategory[]> {
  return call<unknown>("/categories").then((raw) => normalizeCategories(raw));
}

function normalizeCategories(raw: unknown): ApiCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => {
    const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return { id: Number(row.id), slug: String(row.slug ?? ""), name: String(row.name ?? ""), kind: String(row.record_type ?? row.kind ?? "both"), icon: String(row.icon ?? ""), order_num: Number(row.sort_order ?? row.order_num ?? 0), children: normalizeCategories(row.children) };
  });
}

export function fetchOwnerCities(): Promise<ApiPlace[]> {
  return call<ApiPlace[]>("/cities");
}

export function fetchOwnerDistricts(city: string): Promise<ApiPlace[]> {
  return call<ApiPlace[]>(`/districts?city=${encodeURIComponent(city)}`);
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
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    if (hasChildren) {
      for (const child of node.children ?? []) {
        if (child.kind === kind || child.kind === "both") {
          options.push({ id: child.id, title: child.name });
        }
      }
    } else {
      // Корневая категория без подкатегорий (например, «Другое», «Практические навыки» и т.п.)
      if (node.kind === kind || node.kind === "both") {
        options.push({ id: node.id, title: node.name });
      }
    }
  }
  return options;
}

/**
 * Проверка файла до отправки — удобство, а не граница: тип и размер решает
 * сервер (413 и 415). SVG не принимаем: бэкенд его отвергает.
 */
export function checkUpload(
  file: File,
  kind: UploadKind,
  options: { skipSizeLimit?: boolean } = {},
): string | null {
  const types: readonly string[] = kind === "photo" ? PHOTO_TYPES : VIDEO_TYPES;
  const limit = kind === "photo" ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES;
  if (!types.includes(file.type)) {
    return kind === "photo"
      ? "Нужен файл JPEG, PNG или WebP — SVG сервер не принимает"
      : "Нужен файл MP4";
  }
  if (!options.skipSizeLimit && file.size > limit) {
    return kind === "photo" ? "Фото больше 10 МиБ" : "Видео больше 50 МиБ";
  }
  if (file.size === 0) return "Файл пустой";
  return null;
}

/** Ограничивает фото до 1600 px и перекодирует тяжёлые файлы в WebP. */
export async function prepareOwnerUpload(file: File, kind: UploadKind): Promise<File> {
  if (kind === "video") {
    const duration = await videoDuration(file);
    if (duration > VIDEO_MAX_DURATION_SECONDS) {
      throw new Error(`Видео длиннее ${VIDEO_MAX_DURATION_SECONDS} секунд`);
    }
    return file;
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Не удалось открыть изображение. Выберите другой файл.");
  });
  try {
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && file.size <= PHOTO_MAX_BYTES) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить изображение");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Не удалось сжать изображение"))),
        "image/webp",
        0.86,
      );
    });
    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.webp`, { type: "image/webp", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => finish(new Error("Не удалось определить длительность видео")), 10000);
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const finish = (error?: Error) => {
      const duration = video.duration;
      cleanup();
      if (error) reject(error);
      else if (Number.isFinite(duration)) resolve(duration);
      else reject(new Error("Не удалось определить длительность видео"));
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish(new Error("Не удалось прочитать видео"));
    video.src = url;
  });
}

export function uploadMedia(id: string, file: File, kind: UploadKind): Promise<UploadedMedia> {
  const form = new FormData();
  form.append("file", file);
  form.append("activity_id", numericId(id));
  return call<UploadedMedia>(`/activities/${numericId(id)}/${kind === "photo" ? "photos" : "videos"}`, {
    method: "POST",
    body: form,
  }).then((res) => ({
    ...res,
    path: normalizeMediaPath(res.path),
  }));
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
