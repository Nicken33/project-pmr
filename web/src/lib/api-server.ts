import { cache } from "react";
import {
  fetchActivities,
  fetchActivity,
  fetchCategories,
  fetchCities,
  fetchDistricts,
  fetchOrganization,
  isApiEnabled,
  type ApiActivity,
  type ApiActivityDetail,
  type ApiCategory,
  type ApiLesson,
  type ApiMedia,
  type ApiOrganization,
  type ApiPlace,
  type ActivityQuery,
} from "@/lib/api";
import type {
  Activity,
  ActivityFormat,
  AgeGroup,
  CatalogResult,
  Category,
  City,
  District,
  FilterState,
  Location,
  Organization,
  ScheduleRow,
  SuperCategory,
  Weekday,
} from "@/lib/types";

/**
 * Канонический контракт `/api/v1` → модель витрины (§7).
 *
 * Правил тут два, и оба из-за того, что бэкенд отдаёт меньше, чем хочется:
 *   · поля, которого в контракте нет, не выдумываем — `reviews` и голоса
 *     остаются пустыми/нулевыми, «отзывов нет» честнее несуществующего рейтинга;
 *   · город и район приходят титулами, а не слагами, поэтому подписи
 *     (`citySlug`, `districtSlug`) заполняем из справочника, а если его нет —
 *     самим титулом: отображению это не вредит, а выдуманный slug был бы хуже.
 */

const WEEKDAYS: Weekday[] = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** `price_period` в схеме CHECK: 'session' | 'month' | 'course' | NULL. */
const PRICE_PERIODS: Record<string, NonNullable<AgeGroup["pricePeriod"]>> = {
  session: "занятие",
  month: "месяц",
  course: "курс",
};

/** Справочник городов и районов, нужный чтобы из титула получить slug. */
export interface Places {
  cities: City[];
  districts: District[];
}

/**
 * Города и районы приходят титулами, а модель витрины живёт на слагах.
 * Слаг находится в справочнике; если города там затерялся нет — оставляем титул:
 * он хотя бы показывает то, что сказал бэкенд, а не выдуманное имя.
 */
async function resolvePlaces(cityTitles: Array<string | undefined>): Promise<Places> {
  const { cities } = await loadDictionaries();
  const slugs = new Set(
    cityTitles
      .map((title) => (title ? cities.find((city) => city.title === title)?.slug : undefined))
      .filter((slug): slug is string => Boolean(slug)),
  );
  const perCity = await Promise.all([...slugs].map((city) => loadDistricts(city)));
  return { cities, districts: perCity.flat() };
}

const loadDictionaries = cache(fetchDictionariesFromApi);
const loadDistricts = cache(fetchDistrictsForCity);

export function citySlugByTitle(places: Places, title: string): string {
  return places.cities.find((city) => city.title === title)?.slug ?? title;
}

export function districtSlugByTitle(places: Places, title: string): string {
  return places.districts.find((district) => district.title === title)?.slug ?? title;
}

function toWeekday(value: number): Weekday | undefined {
  return value >= 1 && value <= 7 ? WEEKDAYS[value - 1] : undefined;
}

function toScheduleRow(lesson: ApiLesson): ScheduleRow | undefined {
  const day = toWeekday(lesson.weekday);
  if (!day) return undefined;
  return {
    day,
    start: lesson.time_from,
    end: lesson.time_to,
    ...(lesson.note ? { note: lesson.note } : {}),
    ...(lesson.seats != null ? { seats: lesson.seats } : {}),
  };
}

function toPricePeriod(value: string | null): AgeGroup["pricePeriod"] {
  return value ? PRICE_PERIODS[value] : undefined;
}

function normalizeMediaPath(path: string | null | undefined): string {
  if (!path) return "";
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/media/")) return trimmed;
  if (trimmed.startsWith("media/")) return `/${trimmed}`;
  if (trimmed.startsWith("/")) return `/media${trimmed}`;
  return `/media/${trimmed}`;
}

function mediaPaths(media: (ApiMedia | { path?: string })[] | undefined): string[] {
  return (media ?? [])
    .map((item) => normalizeMediaPath(item.path))
    .filter(Boolean);
}

/** Плоская строка списка — та же точка, но без вложенного объекта `locations`. */
function locationFromListItem(item: ApiActivity, places: Places): Location[] {
  if (item.location_id == null) return [];
  const districtTitle = item.district ?? "";
  return [
    {
      id: String(item.location_id),
      ...(item.location_name ? { name: item.location_name } : {}),
      citySlug: citySlugByTitle(places, item.city),
      cityTitle: item.city,
      ...(districtTitle
        ? {
            districtSlug: districtSlugByTitle(places, districtTitle),
            districtTitle,
          }
        : {}),
      address: item.address ?? "",
      lat: item.lat ?? 0,
      lng: item.lng ?? 0,
      ...(item.phone ? { phone: item.phone } : {}),
    },
  ];
}

function groupFromListItem(item: ApiActivity): AgeGroup[] {
  if (item.group_id == null) return [];
  return [
    {
      id: String(item.group_id),
      ...(item.group_name ? { title: item.group_name } : {}),
      ageFrom: item.age.min,
      ageTo: item.age.max,
      priceFrom: item.price,
      ...(item.price_to != null ? { priceTo: item.price_to } : {}),
      ...(toPricePeriod(item.price_period)
        ? { pricePeriod: toPricePeriod(item.price_period) }
        : {}),
      locationId: item.location_id == null ? "" : String(item.location_id),
      schedule: [],
    },
  ];
}

function toAgeGroup(
  group: ApiActivityDetail["groups"][number],
): AgeGroup {
  return {
    id: String(group.id),
    ...(group.name ? { title: group.name } : {}),
    ageFrom: group.age_from,
    ageTo: group.age_to,
    priceFrom: group.price_from,
    ...(group.price_to != null ? { priceTo: group.price_to } : {}),
    ...(toPricePeriod(group.price_period)
      ? { pricePeriod: toPricePeriod(group.price_period) }
      : {}),
    locationId: String(group.location_id),
    ...(group.seats != null ? { seats: group.seats } : {}),
    schedule: group.schedules
      .map(toScheduleRow)
      .filter((row): row is ScheduleRow => row !== undefined),
  };
}

function toLocationFromDetail(
  location: ApiActivityDetail["locations"][number],
  places: Places,
): Location {
  const districtTitle = location.district ?? "";
  return {
    id: String(location.id),
    ...(location.name ? { name: location.name } : {}),
    citySlug: citySlugByTitle(places, location.city),
    cityTitle: location.city,
    ...(districtTitle
      ? { districtSlug: districtSlugByTitle(places, districtTitle), districtTitle }
      : {}),
    address: location.address,
    // Координат у точки может не быть — карта такую метку не рисует, а адрес всё
    // равно показывает, поэтому ноль вместо null.
    lat: location.lat ?? 0,
    lng: location.lng ?? 0,
    ...(location.phone ? { phone: location.phone } : {}),
  };
}

function toOrganization(org: ApiOrganization | null): Organization | undefined {
  if (!org) return undefined;
  return {
    id: String(org.id),
    slug: org.slug,
    name: org.name,
    type: org.type,
    description: org.description ?? "",
    phone: org.phone ?? "",
    ...(org.city ? { city: org.city } : {}),
    ...(org.address ? { address: org.address } : {}),
    // Дату сверки имеем только как `contacts_verified_at` — чужих дат не ставим.
    ...(org.contacts_verified_at ? { verifiedAt: org.contacts_verified_at } : {}),
    ...(org.email ? { email: org.email } : {}),
    ...(org.site ? { site: org.site } : {}),
  };
}

/**
 * Организация из плоских полей карточки — на случай, когда `organization` в
 * деталях null. Это те же данные того же ответа, просто без описания.
 */
function organizationFromCard(card: ApiActivity): Organization | undefined {
  if (!card.org_slug || !card.org_name) return undefined;
  return {
    id: String(card.org_id),
    slug: card.org_slug,
    name: card.org_name,
    type: card.org_type ?? "",
    description: "",
    phone: card.phone ?? "",
    ...(card.city ? { city: card.city } : {}),
    ...(card.address ? { address: card.address } : {}),
  };
}

/** Плоская строка каталога → карточка. Группа и точка в ней уже подобранные. */
export function activityToCard(item: ApiActivity, places: Places): Activity {
  return {
    id: item.id,
    slug: item.slug,
    title: item.name,
    organizationSlug: item.org_slug ?? "",
    ...(item.org_name ? { organizationTitle: item.org_name } : {}),
    categorySlug: item.category_slug ?? "",
    ...(item.category ? { categoryTitle: item.category } : {}),
    superSlug: item.super_category_slug ?? "",
    ...(item.super_category ? { superTitle: item.super_category } : {}),
    kind: item.kind,
    ...(item.lesson_type ? { type: item.lesson_type } : {}),
    format: (item.format ?? "offline") as ActivityFormat,
    photos: (() => {
      const rawPhotos = (item as unknown as { photos?: { path?: string }[] }).photos;
      if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
        return mediaPaths(rawPhotos);
      }
      const cover = (item as unknown as { cover_path?: string }).cover_path || item.photo;
      return cover ? [normalizeMediaPath(cover)].filter(Boolean) : [];
    })(),
    description: item.description ?? "",
    updatedAt: item.updated_at,
    createdAt: item.updated_at,
    // Даты проверки у занятия в каноне нет — `verified` это признак
    // `cards.contacts_verified_at >= current_date - 90`, а не timestamp. Дату
    // редактирования под неё подставлять нельзя (§11): бейдж показываем по
    // самому признаку, а дата остаётся пустой, пока сервер её не отдаст.
    contactsVerified: item.verified,
    votesPlus: 0,
    votesMinus: 0,
    reviews: [],
    locations: locationFromListItem(item, places),
    groups: groupFromListItem(item),
  };
}

/** Карточка целиком (`GET /api/v1/activities/{slug}`): все группы, точки и фото. */
export function detailToActivity(detail: ApiActivityDetail, places: Places): Activity {
  return {
    ...activityToCard(detail, places),
    photos: (() => {
      const photos = mediaPaths(detail.photos);
      if (photos.length > 0) return photos;
      const cover = (detail as unknown as { cover_path?: string }).cover_path || detail.photo;
      return cover ? [normalizeMediaPath(cover)].filter(Boolean) : [];
    })(),
    locations: (detail.locations ?? []).map((item) => toLocationFromDetail(item, places)),
    groups: (detail.groups ?? []).map(toAgeGroup),
  };
}

export function organizationFromDetail(detail: ApiActivityDetail): Organization | undefined {
  return toOrganization(detail.organization);
}

/**
 * Фильтр витрины → параметры каталога.
 *
 * Отдаём только то, что бэкенд действительно применяет. Наднаправление
 * (`superCategory`) канон принимает тем же параметром `category`: сверено на
 * стенде — `category=creative-arts` отдаёт только занятия этого направления.
 * Не отправляются: часть дня (`time` — канон ждёт `ЧЧ:ММ`, а не «утро/вечер»),
 * сортировки «по рейтингу» (голосов в каноне нет), «по близости» (порядок
 * `near` не меняет, близость — это фильтр `near`, а не сортировка) и «сначала
 * новые» (даты создания карточки канон не отдаёт). Всё перечисленное считает
 * `unsupportedFilters`, а не только то, что скрыл интерфейс: молча проигнорированный
 * фильтр посетитель читает как сработавший.
 */
export function toActivityQuery(filters: FilterState, page = 1, limit = 20): ActivityQuery {
  const age = Number(filters.age);
  const priceMax = Number(filters.priceMax);
  const dayIndex = filters.day ? WEEKDAYS.indexOf(filters.day as Weekday) : -1;
  const center = filters.near ? NEAR_CENTERS[filters.city] : undefined;

  const query: ActivityQuery = {
    q: filters.q.trim() || undefined,
    kind: filters.kind || undefined,
    city: filters.city || undefined,
    district: filters.district.length ? filters.district.join(",") : undefined,
    category: filters.category || filters.superCategory || undefined,
    age: filters.age && Number.isFinite(age) ? age : undefined,
    price_max: filters.priceMax && Number.isFinite(priceMax) ? priceMax : undefined,
    free: filters.free || undefined,
    online:
      filters.format === "online" ? true : filters.format === "offline" ? false : undefined,
    verified: filters.verified || undefined,
    day: dayIndex >= 0 ? dayIndex + 1 : undefined,
    near: center,
    radius: center ? Number(filters.radius) || undefined : undefined,
    sort: toSort(filters.sort),
    page,
    limit,
  };
  return query;
}

/** Сортировки канона: updated | price | name | verified. Остальные — «как есть». */
function toSort(sort: string): ActivityQuery["sort"] {
  switch (sort) {
    case "updated":
      return "updated";
    case "free":
      return "price";
    case "name":
      return "name";
    case "verified":
      return "verified";
    default:
      // relevance, new, near и rating бэкендом не считаются: неизвестное значение
      // он отвергает 400, а `new` он подменил бы сортировкой по правке — это
      // другая дата и другое обещание. Вместо них отдаём порядок бэкенда.
      return undefined;
  }
}

const NEAR_CENTERS: Record<string, string> = {
  tiraspol: "46.8403,29.6433",
  bendery: "46.8277,29.4778",
  rybnitsa: "47.7667,29.0",
  dubossary: "47.2667,29.1667",
  kamenka: "48.0333,28.7",
  slobodzeja: "46.7309,29.7062",
  grigoriopol: "47.15,29.3",
  dnestrovsk: "46.6167,29.6833",
};

/** Сортировки, которых у канона нет: посетителю говорим, что они не сработали. */
const UNSUPPORTED_SORTS = new Set(["new", "near", "rating"]);

/** Фильтры, которые канон не применяет — интерфейс обязан их убрать, а не показать. */
export function unsupportedFilters(filters: FilterState): string[] {
  const unsupported: string[] = [];
  if (filters.time) unsupported.push("time");
  if (UNSUPPORTED_SORTS.has(filters.sort)) unsupported.push(`sort=${filters.sort}`);
  if (filters.activity) unsupported.push("activity");
  // «Рядом» работает только с центром отсчёта: без города (или с городом, которого
  // нет в NEAR_CENTERS) near и radius в запрос не попадают, и посетитель получает
  // весь каталог, думая, что видит выборку в трёх километрах.
  if (filters.near && !NEAR_CENTERS[filters.city]) unsupported.push("near");
  return unsupported;
}

/** Человеческие имена того, что канон не применил: их показывает каталог. */
export function unsupportedLabels(filters: FilterState): string[] {
  const names: Record<string, string> = {
    time: "время суток",
    "sort=rating": "сортировка по оценкам",
    "sort=near": "сортировка по близости",
    "sort=new": "сортировка «сначала новые»",
    near: "радиус вокруг города",
    activity: "занятие по адресу",
  };
  return unsupportedFilters(filters).map((key) => names[key] ?? key);
}

export interface ApiCatalogResult {
  results: CatalogResult[];
  total: number;
  page: number;
  pages: number;
}

export async function fetchCatalogFromApi(
  filters: FilterState,
  page = 1,
  limit = 20,
): Promise<ApiCatalogResult> {
  const query = toActivityQuery(filters, page, limit);
  const data = await fetchActivities(query);
  const places = await resolvePlaces(data.items.map((item) => item.city));
  const results = data.items.map((item) => ({
    activity: activityToCard(item, places),
    // Бэкенд сам подбирает группу и точку под фильтр — match брать от строки, а
    // не пересчитывать на фронте (§5.2).
    match: {
      groupId: item.group_id == null ? "" : String(item.group_id),
      locationId: item.location_id == null ? "" : String(item.location_id),
    },
  }));
  return {
    results,
    total: data.total,
    page: data.page,
    pages: Math.max(1, Math.ceil(data.total / (data.limit || limit))),
  };
}

export interface ApiActivityPage {
  activity: Activity;
  organization: Organization | undefined;
  /** Занятия того же направления — блок «похожие», тоже из бэкенда, не из моков. */
  similar: Activity[];
  categoryTitle: string;
  superTitle: string;
}

export async function fetchActivityFromApi(slug: string): Promise<ApiActivityPage> {
  const detail = await fetchActivity(slug);
  const places = await resolvePlaces([
    detail.city,
    ...(detail.locations ?? []).map((location) => location.city),
  ]);
  let similar: Activity[] = [];
  if (detail.category_slug) {
    const related = await fetchActivities({ category: detail.category_slug, limit: 7 });
    similar = related.items
      .filter((item) => item.slug !== detail.slug)
      .slice(0, 6)
      .map((item) => activityToCard(item, places));
  }
  return {
    activity: detailToActivity(detail, places),
    organization: toOrganization(detail.organization) ?? organizationFromCard(detail),
    similar,
    categoryTitle: detail.category ?? "",
    superTitle: detail.super_category ?? "",
  };
}

export interface ApiOrganizationPageData {
  organization: Organization;
  activities: Activity[];
  locations: Location[];
}

/**
 * Страница организации (`GET /api/v1/organizations/{slug}`).
 *
 * Точки проведения в контракте у организации свои не имеет — берём их из её же
 * занятий и склеиваем по `id`: два занятия в одной точке дают одну метку.
 */
export async function fetchOrganizationFromApi(
  slug: string,
): Promise<ApiOrganizationPageData> {
  const data = await fetchOrganization(slug);
  const organization = toOrganization(data.organization);
  if (!organization) throw new Error(`Организация ${slug} не отдаёт данные`);
  const places = await resolvePlaces([
    ...data.activities.map((item) => item.city),
    organization.city ?? "",
  ]);
  const activities = data.activities.map((item) => activityToCard(item, places));
  const seen = new Map<string, Location>();
  for (const activity of activities) {
    for (const location of activity.locations) {
      const existing = seen.get(location.id);
      if (!existing || (!existing.phone && location.phone)) seen.set(location.id, location);
    }
  }
  return { organization, activities, locations: [...seen.values()] };
}

/** Узлы дерева направлений: верхний уровень — суперкатегории, дети — категории. */
export function toDictionaries(raw: ApiCategory[]): {
  superCategories: SuperCategory[];
  categories: Category[];
} {
  const superCategories: SuperCategory[] = [];
  const categories: Category[] = [];
  raw.forEach((node, index) => {
    const superSlug = (node as unknown as { slug?: string; id?: number | string }).slug || (node.id !== undefined ? String(node.id) : "");
    superCategories.push({
      slug: superSlug,
      title: node.name,
      shortTitle: node.name,
      icon: node.icon,
      // Цвет направления в каноне не хранится: берём из палитры по порядку,
      // чтобы чипы не сливались, но и не выглядели случайными.
      color: PALETTE[index % PALETTE.length],
    });
    (node.children ?? []).forEach((child, childIndex) => {
      const childSlug = (child as unknown as { slug?: string; id?: number | string }).slug || (child.id !== undefined ? String(child.id) : "");
      categories.push({
        slug: childSlug,
        title: child.name,
        superSlug: superSlug,
        kind: toKind(child.kind),
        icon: child.icon,
        order: child.order_num || childIndex + 1,
      });
    });
  });
  return { superCategories, categories };
}

const PALETTE = [
  "#8B5CF6",
  "#6366F1",
  "#EC4899",
  "#F59E0B",
  "#22C55E",
  "#0EA5E9",
  "#F43F5E",
  "#14B8A6",
];

function toKind(value: string): Category["kind"] {
  return value === "activity" || value === "service" || value === "both" ? value : "both";
}

export interface ApiDictionaries {
  superCategories: SuperCategory[];
  categories: Category[];
  cities: City[];
}

/** Справочники для real-режима: моки подставлять нельзя (§6). */
export async function fetchDictionariesFromApi(): Promise<ApiDictionaries> {
  const [raw, cities] = await Promise.all([fetchCategories(), fetchCities()]);
  const { superCategories, categories } = toDictionaries(raw);
  return {
    superCategories,
    categories,
    cities: cities
      .map((city) => ({
        slug: city.slug || (city.id !== undefined ? String(city.id) : ""),
        title: city.name,
        order: (city as unknown as { sort_order?: number }).sort_order ?? 0,
      }))
      .sort((a, b) => a.order - b.order),
  };
}

export async function fetchDistrictsForCity(city: string): Promise<District[]> {
  const raw = await fetchDistricts(city);
  return raw.map((district: ApiPlace) => ({
    slug: district.slug || (district.id !== undefined ? String(district.id) : ""),
    citySlug: city,
    title: district.name,
  }));
}

export { isApiEnabled };
