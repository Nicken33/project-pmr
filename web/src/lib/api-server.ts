import { cache } from "react";
import {
  fetchActivities,
  fetchActivity,
  fetchCategories,
  fetchCities,
  fetchDistricts,
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

function mediaPaths(media: ApiMedia[] | undefined): string[] {
  return (media ?? []).map((item) => item.path);
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
    superSlug: item.super_category_slug ?? "",
    kind: item.kind,
    ...(item.lesson_type ? { type: item.lesson_type } : {}),
    format: (item.format ?? "offline") as ActivityFormat,
    photos: item.photo ? [item.photo] : [],
    description: item.description ?? "",
    updatedAt: item.updated_at,
    createdAt: item.updated_at,
    // Даты проверки у занятия в каноне нет — есть только признак `verified` и
    // `contacts_verified_at` у организации и точек.
    ...(item.verified ? { verifiedAt: item.updated_at } : {}),
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
    photos: mediaPaths(detail.photos),
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
 * Отдаём только то, что `parseCardFilter` действительно применяет. Не
 * поддерживаются и поэтому не отправляются: направление верхнего уровня
 * (`superCategory`), часть дня (`time`) и сортировка «по рейтингу» — голосов в
 * каноне нет. Их скрывает интерфейс, а не адаптер: молча проигнорированный
 * фильтр выглядел бы как сломанная кнопка.
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
    category: filters.category || undefined,
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
    case "new":
    case "updated":
      return "updated";
    case "free":
      return "price";
    case "name":
      return "name";
    case "verified":
      return "verified";
    default:
      // relevance, near и rating бэкендом не считаются: неизвестное значение он
      // отвергает 400, поэтому вместо него отдаём默认排序 бэкенда.
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

/** Фильтры, которые канон не применяет — интерфейс обязан их убрать, а не показать. */
export function unsupportedFilters(filters: FilterState): string[] {
  const unsupported: string[] = [];
  if (filters.superCategory && !filters.category) unsupported.push("superCategory");
  if (filters.time) unsupported.push("time");
  if (filters.sort === "rating") unsupported.push("sort=rating");
  if (filters.activity) unsupported.push("activity");
  return unsupported;
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

/** Узлы дерева направлений: верхний уровень — суперкатегории, дети — категории. */
export function toDictionaries(raw: ApiCategory[]): {
  superCategories: SuperCategory[];
  categories: Category[];
} {
  const superCategories: SuperCategory[] = [];
  const categories: Category[] = [];
  raw.forEach((node, index) => {
    superCategories.push({
      slug: node.slug,
      title: node.name,
      shortTitle: node.name,
      icon: node.icon,
      // Цвет направления в каноне не хранится: берём из палитры по порядку,
      // чтобы чипы не сливались, но и не выглядели случайными.
      color: PALETTE[index % PALETTE.length],
    });
    (node.children ?? []).forEach((child, childIndex) => {
      categories.push({
        slug: child.slug,
        title: child.name,
        superSlug: node.slug,
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
      .map((city) => ({ slug: city.slug, title: city.name, order: 0 }))
      .sort((a, b) => a.order - b.order),
  };
}

export async function fetchDistrictsForCity(city: string): Promise<District[]> {
  const raw = await fetchDistricts(city);
  return raw.map((district: ApiPlace) => ({
    slug: district.slug,
    citySlug: city,
    title: district.name,
  }));
}

export { isApiEnabled };
