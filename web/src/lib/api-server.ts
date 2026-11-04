import { cities } from "@/lib/data";
import { fetchCards, isApiEnabled, type ApiCard } from "@/lib/api";
import type { Activity, CatalogResult, FilterState } from "@/lib/types";

/**
 * Карточка из `GET /api/cards` → модель каталога.
 *
 * `repository.SearchCards` заполняет только id, name, city и возрастные границы:
 * фото, адреса, координаты, группы и цены в ответе нет (`category`, `price`,
 * `district` всегда null — их не читает `rows.Scan`). Поэтому `photos`,
 * `locations` и `groups` остаются пустыми: карточка покажет «Фото нет»,
 * «Адрес уточняется» и «Цена не указана» вместо выдуманных значений.
 */
export function cardToActivity(card: ApiCard): Activity {
  const now = new Date().toISOString();
  return {
    id: card.id,
    slug: card.id,
    title: card.name,
    organizationSlug: "",
    categorySlug: card.category ?? "",
    superSlug: "other",
    kind: "activity",
    format: "offline",
    photos: [],
    description: card.description ?? "",
    updatedAt: now,
    createdAt: now,
    votesPlus: 0,
    votesMinus: 0,
    reviews: [],
    locations: [],
    groups: [],
  };
}

/** Фильтр каталога → параметры, которые бэкенд действительно применяет. */
export function toCardQuery(filters: FilterState) {
  const city = cities.find((item) => item.slug === filters.city);
  const age = Number(filters.age);
  return {
    city_name: city?.title,
    age: filters.age && Number.isFinite(age) ? age : undefined,
  };
}

export interface ApiCatalogResult {
  results: CatalogResult[];
  total: number;
}

export async function fetchCatalogFromApi(filters: FilterState): Promise<ApiCatalogResult> {
  const cards = await fetchCards(toCardQuery(filters));
  let activities = cards.map(cardToActivity);

  // `q` бэкенд разбирает, но в SQL условие закомментировано, поэтому поиск
  // досчитываем здесь — иначе каталог показал бы неотфильтрованный результат.
  const needle = filters.q.trim().toLowerCase().replace(/ё/g, "е");
  if (needle) {
    const matches = (value: string) => value.toLowerCase().replace(/ё/g, "е").includes(needle);
    activities = activities.filter(
      (activity) => matches(activity.title) || matches(activity.description),
    );
  }

  return {
    results: activities.map((activity) => ({
      activity,
      match: { groupId: "", locationId: "" },
    })),
    total: activities.length,
  };
}

export { isApiEnabled };
