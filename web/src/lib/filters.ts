import { activities as allActivities, categories, cities, districts } from "@/lib/data";
import type {
  Activity,
  ActivityFormat,
  ActivityKind,
  AgeGroup,
  CatalogMatch,
  CatalogResult,
  FilterState,
  Location,
} from "@/lib/types";

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export const defaultFilters: FilterState = {
  q: "",
  kind: "",
  superCategory: "",
  category: "",
  city: "",
  district: [],
  activity: "",
  age: "",
  priceMax: "",
  free: false,
  format: "",
  verified: false,
  day: "",
  time: "",
  near: false,
  radius: "3000",
  sort: "relevance",
  view: "grid",
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): FilterState {
  const districtRaw = params.district;
  const district = Array.isArray(districtRaw)
    ? districtRaw
    : districtRaw
      ? districtRaw.split(",").map((v) => v.trim()).filter(Boolean)
      : [];

  const sort = first(params.sort);
  return {
    q: first(params.q),
    kind: (first(params.kind) as FilterState["kind"]) || "",
    superCategory: first(params.super) || first(params.category_super),
    category: first(params.category),
    city: first(params.city),
    district,
    activity: first(params.activity),
    age: first(params.age),
    priceMax: first(params.price_max),
    free: first(params.free) === "1",
    format: (first(params.format) as ActivityFormat) || "",
    verified: first(params.verified) === "1",
    day: first(params.day),
    time: (first(params.time) as FilterState["time"]) || "",
    near: first(params.near) === "1" || Boolean(first(params.near)),
    radius: first(params.radius) || "3000",
    sort: ["relevance", "near", "rating", "new", "free", "updated"].includes(sort)
      ? sort
      : "relevance",
    view: first(params.view) === "list" ? "list" : "grid",
  };
}

export function filtersToParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.superCategory) params.set("super", filters.superCategory);
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.district.length) params.set("district", filters.district.join(","));
  if (filters.activity) params.set("activity", filters.activity);
  if (filters.age) params.set("age", filters.age);
  if (filters.priceMax) params.set("price_max", filters.priceMax);
  if (filters.free) params.set("free", "1");
  if (filters.format) params.set("format", filters.format);
  if (filters.verified) params.set("verified", "1");
  if (filters.day) params.set("day", filters.day);
  if (filters.time) params.set("time", filters.time);
  if (filters.near) {
    params.set("near", "1");
    params.set("radius", filters.radius);
  }
  if (filters.sort && filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.view === "list") params.set("view", "list");
  return params;
}

export function activeFilterCount(filters: FilterState): number {
  let count = 0;
  if (filters.q) count++;
  if (filters.kind) count++;
  if (filters.category) count++;
  else if (filters.superCategory) count++;
  if (filters.city) count++;
  if (filters.district.length) count++;
  if (filters.age) count++;
  if (filters.priceMax) count++;
  if (filters.free) count++;
  if (filters.format) count++;
  if (filters.verified) count++;
  if (filters.day) count++;
  if (filters.time) count++;
  if (filters.near) count++;
  return count;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

function scheduleMatches(group: AgeGroup, day: string, time: string): boolean {
  if (!day && !time) return true;
  return group.schedule.some((row) => {
    if (day && row.day !== day) return false;
    if (!time) return true;
    const hour = Number(row.start.split(":")[0]);
    if (time === "morning") return hour < 12;
    if (time === "day") return hour >= 12 && hour < 17;
    return hour >= 17 && hour < 21;
  });
}

function locationMatches(location: Location, city: string, district: string[]): boolean {
  if (city && location.citySlug !== city) return false;
  if (district.length && !district.includes(location.districtSlug ?? "")) return false;
  return true;
}

function groupMatches(
  group: AgeGroup,
  filters: FilterState,
  kind: ActivityKind,
): boolean {
  if (kind === "activity") {
    if (filters.age) {
      const age = Number(filters.age);
      // Возраст группы может не быть указан — такое занятие под фильтр возраста
      // не попадает, но и выдумывать ему границы мы не вправе.
      if (
        Number.isFinite(age) &&
        (group.ageFrom === null || group.ageTo === null || !(group.ageFrom <= age && group.ageTo >= age))
      ) {
        return false;
      }
    }
  } else if (filters.age) {
    return false;
  }
  if (filters.priceMax) {
    const max = Number(filters.priceMax);
    if (Number.isFinite(max) && group.priceFrom !== null && group.priceFrom > max) return false;
  }
  if (filters.free && group.priceFrom !== 0) return false;
  if (!scheduleMatches(group, filters.day, filters.time)) return false;
  return true;
}

function isRecent(date: string | undefined, days: number): boolean {
  if (!date) return false;
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= days * 86_400_000;
}

function stringScore(activity: Activity, query: string): number {
  if (!query) return 0;
  const q = normalize(query);
  const category = categories.find((c) => c.slug === activity.categorySlug);
  const fields: Array<[string, number]> = [
    [activity.title, 12],
    [activity.organizationSlug.replace(/-/g, " "), 6],
    [activity.description, 2],
    [category?.title ?? "", 5],
    [activity.shortDescription ?? "", 3],
  ];
  let score = 0;
  for (const [value, weight] of fields) {
    const normalized = normalize(value);
    if (normalized === q) score += weight * 3;
    else if (normalized.startsWith(q)) score += weight * 2;
    else if (normalized.includes(q)) score += weight;
    else {
      const words = q.split(/\s+/).filter((word) => word.length > 2);
      if (words.some((word) => normalized.includes(word))) score += weight / 2;
    }
  }
  return score;
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const cityCenters: Record<string, { lat: number; lng: number }> = {
  tiraspol: { lat: 46.8403, lng: 29.6433 },
  bendery: { lat: 46.8277, lng: 29.4778 },
  rybnica: { lat: 47.7667, lng: 29.0 },
  dubossary: { lat: 47.2667, lng: 29.1667 },
  kamenka: { lat: 48.0333, lng: 28.7 },
  slobodzeya: { lat: 46.7309, lng: 29.7062 },
  grigoriopol: { lat: 47.15, lng: 29.3 },
  dnestrovsk: { lat: 46.6167, lng: 29.6833 },
};

function chooseGroup(activity: Activity, filters: FilterState): AgeGroup | undefined {
  const matchingLocationIds = new Set(
    activity.locations
      .filter((loc) => locationMatches(loc, filters.city, filters.district))
      .map((loc) => loc.id),
  );
  const candidates = activity.groups.filter(
    (group) =>
      groupMatches(group, filters, activity.kind) &&
      (matchingLocationIds.size === 0 || matchingLocationIds.has(group.locationId)),
  );
  if (candidates.length) {
    return (
      candidates.find(
        (group) => filters.city && activity.locations.find((l) => l.id === group.locationId)
          ?.citySlug === filters.city,
      ) ?? candidates[0]
    );
  }
  if (!filters.age && !filters.priceMax && !filters.free && !filters.day && !filters.time) {
    const preferred = activity.groups[activity.featuredGroupIndex ?? 0];
    if (preferred && matchingLocationIds.has(preferred.locationId)) return preferred;
    return activity.groups.find((g) => matchingLocationIds.has(g.locationId)) ?? activity.groups[0];
  }
  return undefined;
}

function chooseLocation(
  activity: Activity,
  group: AgeGroup,
  filters: FilterState,
): Location | undefined {
  const groupLocation = activity.locations.find((loc) => loc.id === group.locationId);
  if (groupLocation) return groupLocation;
  return (
    activity.locations.find((loc) => locationMatches(loc, filters.city, filters.district)) ??
    activity.locations[0]
  );
}

/** Минимальная из известных цен группы; MAX_SAFE_INTEGER — «цены нет нигде». */
function lowestPrice(activity: Activity): number {
  const prices = activity.groups
    .map((group) => group.priceFrom)
    .filter((price): price is number => price !== null);
  return prices.length ? Math.min(...prices) : Number.MAX_SAFE_INTEGER;
}

export function filterCatalog(
  filters: FilterState,
  source: Activity[] = allActivities,
): CatalogResult[] {
  const results: Array<CatalogResult & { distance: number; score: number }> = [];
  const center = filters.city ? cityCenters[filters.city] : cityCenters.tiraspol;

  for (const activity of source) {
    if (filters.activity && activity.slug !== filters.activity) continue;
    if (filters.q) {
      const score = stringScore(activity, filters.q);
      if (score <= 0) continue;
    }
    if (filters.kind && activity.kind !== filters.kind) continue;
    if (filters.category) {
      if (activity.categorySlug !== filters.category) continue;
    } else if (filters.superCategory && activity.superSlug !== filters.superCategory) {
      continue;
    }
    if (filters.format && activity.format !== filters.format) continue;
    if (filters.verified && !isRecent(activity.verifiedAt, 90)) continue;

    const hasMatchingLocation = activity.locations.some((loc) =>
      locationMatches(loc, filters.city, filters.district),
    );
    if ((filters.city || filters.district.length) && !hasMatchingLocation) continue;

    const group = chooseGroup(activity, filters);
    if (!group) continue;
    const location = chooseLocation(activity, group, filters);
    if (!location) continue;

    const distance = distanceKm(center, location);
    if (filters.near) {
      const radius = Number(filters.radius) || 3000;
      if (distance * 1000 > radius) continue;
    }

    results.push({
      activity,
      match: { groupId: group.id, locationId: location.id } satisfies CatalogMatch,
      distance,
      score: stringScore(activity, filters.q),
    });
  }

  const sort = filters.sort;
  results.sort((a, b) => {
    if (sort === "near") return a.distance - b.distance;
    if (sort === "rating") {
      const aVotes = a.activity.votesPlus + a.activity.votesMinus;
      const bVotes = b.activity.votesPlus + b.activity.votesMinus;
      const aRated = aVotes >= 3 ? a.activity.votesPlus / Math.max(aVotes, 1) : -1;
      const bRated = bVotes >= 3 ? b.activity.votesPlus / Math.max(bVotes, 1) : -1;
      if (bRated !== aRated) return bRated - aRated;
      return bVotes - aVotes;
    }
    if (sort === "new") {
      return +new Date(b.activity.createdAt) - +new Date(a.activity.createdAt);
    }
    if (sort === "free") {
      const aFree = a.activity.groups.some((g) => g.priceFrom === 0) ? 0 : 1;
      const bFree = b.activity.groups.some((g) => g.priceFrom === 0) ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      // Группа без цены в конце: «цена не указана» — не «самое дешёвое».
      return lowestPrice(a.activity) - lowestPrice(b.activity);
    }
    if (sort === "updated") {
      return +new Date(b.activity.updatedAt) - +new Date(a.activity.updatedAt);
    }
    if (filters.q) {
      if (b.score !== a.score) return b.score - a.score;
    }
    if (Boolean(a.activity.promoted) !== Boolean(b.activity.promoted)) {
      return a.activity.promoted ? -1 : 1;
    }
    return b.activity.votesPlus - a.activity.votesPlus;
  });

  return results.map(({ activity, match }) => ({ activity, match }));
}

export function getActivityBySlug(slug: string): Activity | undefined {
  return allActivities.find((activity) => activity.slug === slug);
}

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function getCity(slug: string) {
  return cities.find((city) => city.slug === slug);
}

export function getDistrict(slug: string) {
  return districts.find((district) => district.slug === slug);
}

export function getDistrictsForCity(citySlug: string) {
  return districts.filter((district) => district.citySlug === citySlug);
}

export function categoriesForSuper(superSlug: string) {
  if (!superSlug) return categories;
  return categories.filter((category) => category.superSlug === superSlug);
}

export function countBySuper(source: Activity[] = allActivities) {
  const counts: Record<string, number> = {};
  for (const activity of source) {
    counts[activity.superSlug] = (counts[activity.superSlug] ?? 0) + 1;
  }
  return counts;
}

export const weekdays = DAYS;

/** Одна метка = одна точка проведения, попавшая под фильтр каталога (§3.5.1, §3.5.5). */
export interface CatalogMarker {
  id: string;
  activitySlug: string;
  activityTitle: string;
  organizationSlug: string;
  kind: ActivityKind;
  groupId: string;
  locationId: string;
  locationName?: string;
  lat: number;
  lng: number;
  address: string;
  citySlug: string;
  cityTitle: string;
  districtTitle?: string;
  groupTitle: string;
  price: string;
}

export function catalogMarkers(filters: FilterState): CatalogMarker[] {
  const results = filterCatalog(filters);
  const markers: CatalogMarker[] = [];
  const seen = new Set<string>();

  for (const { activity } of results) {
    const allowedLocations = activity.locations.filter((location) =>
      locationMatches(location, filters.city, filters.district),
    );
    const matchingGroups = activity.groups.filter((group) =>
      groupMatches(group, filters, activity.kind),
    );

    for (const location of allowedLocations) {
      // Под фильтр возраста попала только часть групп — метки остальных точек не показываем (§3.5.5).
      const groupAtLocation = matchingGroups.find((group) => group.locationId === location.id);
      if (!groupAtLocation) continue;

      const key = `${activity.id}:${location.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      markers.push({
        id: key,
        activitySlug: activity.slug,
        activityTitle: activity.title,
        organizationSlug: activity.organizationSlug,
        kind: activity.kind,
        groupId: groupAtLocation.id,
        locationId: location.id,
        locationName: location.name,
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        citySlug: location.citySlug,
        cityTitle: cities.find((city) => city.slug === location.citySlug)?.title ?? "",
        districtTitle: location.districtSlug
          ? districts.find((district) => district.slug === location.districtSlug)?.title
          : undefined,
        groupTitle: groupAtLocation.title || formatAge(groupAtLocation),
        price: formatPrice(groupAtLocation),
      });
    }
  }

  return markers;
}

export function formatPrice(group?: AgeGroup): string {
  if (!group || group.priceFrom === null) return "Цена не указана";
  if (group.priceFrom === 0) return "Бесплатно";
  const period = group.pricePeriod ? ` / ${group.pricePeriod}` : "";
  if (group.priceTo && group.priceTo !== group.priceFrom) {
    return `${group.priceFrom}–${group.priceTo} руб. ПМР${period}`;
  }
  return `${group.priceFrom} руб. ПМР${period}`;
}

/** Компактная цена для карточки каталога: без «ПМР», чтобы строка не обрезалась. */
export function formatPriceCard(group?: AgeGroup): string {
  if (!group || group.priceFrom === null) return "Цена по запросу";
  if (group.priceFrom === 0) return "Бесплатно";
  const period = group.pricePeriod ? ` / ${group.pricePeriod}` : "";
  if (group.priceTo && group.priceTo !== group.priceFrom) {
    return `${group.priceFrom}–${group.priceTo} руб.${period}`;
  }
  return `${group.priceFrom} руб.${period}`;
}

export function formatAge(group?: AgeGroup): string {
  if (!group || group.ageFrom === null || group.ageTo === null) return "";
  if (group.ageFrom === group.ageTo) return `${group.ageFrom} лет`;
  return `${group.ageFrom}–${group.ageTo} лет`;
}

export function formatSchedule(group?: AgeGroup): string {
  if (!group || !group.schedule.length) return "";
  const byTime = new Map<string, string[]>();
  for (const row of group.schedule) {
    const key = `${row.start}–${row.end}`;
    byTime.set(key, [...(byTime.get(key) ?? []), row.day]);
  }
  return [...byTime.entries()]
    .map(([time, days]) => `${days.join(", ")} ${time}`)
    .join(" · ");
}
