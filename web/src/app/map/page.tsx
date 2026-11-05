import type { Metadata } from "next";
import { MapClient } from "@/components/map/MapClient";
import { activities, categories, cities, districts, superCategories } from "@/lib/data";
import {
  catalogMarkers,
  filterCatalog,
  markersFromActivities,
  parseFilters,
  type CatalogMarker,
} from "@/lib/filters";
import { ApiError, isApiEnabled } from "@/lib/api";
import {
  fetchCatalogFromApi,
  fetchDictionariesFromApi,
  fetchDistrictsForCity,
} from "@/lib/api-server";
import { readView } from "@/lib/session";
import type { Category, City, District, SuperCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Карта занятий",
  description:
    "Карта секций, кружков и услуг Приднестровья: метки по точкам проведения, радиус «рядом со мной» и кластеры. Тайлы © OpenStreetMap contributors.",
  alternates: { canonical: "/map" },
};

export const dynamic = "force-dynamic";

/** `limit` бэкенда: больше сотни строк он не принимает, поэтому и меток не больше. */
const MAX_MARKERS = 100;

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const { mode } = await readView();
  const demo = mode === "demo";
  const useApi = isApiEnabled();

  let markers: CatalogMarker[] = [];
  let activitiesCount = 0;
  let loadError: string | undefined;
  let emptyReason: string | undefined;
  let counts: { bySuper: Record<string, number>; byCategory: Record<string, number>; total: number } | undefined;
  let dictionary: {
    superCategories: SuperCategory[];
    categories: Category[];
    cities: City[];
    districts: District[];
  } = { superCategories, categories, cities, districts };

  if (useApi) {
    try {
      const [catalog, real, cityDistricts] = await Promise.all([
        fetchCatalogFromApi(filters, 1, MAX_MARKERS),
        fetchDictionariesFromApi(),
        filters.city ? fetchDistrictsForCity(filters.city) : Promise.resolve([]),
      ]);
      dictionary = { ...real, districts: cityDistricts };
      activitiesCount = catalog.total;
      // Координаты у строк канона есть (`lat`/`lng` точки), поэтому метки
      // строим из тех же занятий, что и каталог, — отдельного запроса не нужно.
      markers = markersFromActivities(catalog.results.map((item) => item.activity));
      if (!markers.length && catalog.results.length) {
        emptyReason =
          "У занятий этой выборки точки без координат: бэкенд их ещё не заполнил. В каталоге они видны по адресу.";
      }
    } catch (error) {
      loadError =
        error instanceof ApiError
          ? error.message
          : `Запрос к каталогу завершился непредвиденной ошибкой: ${String(error)}`;
    }
  } else if (demo) {
    activitiesCount = filterCatalog(filters).length;
    markers = catalogMarkers(filters);
    const bySuper: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const activity of activities) {
      bySuper[activity.superSlug] = (bySuper[activity.superSlug] ?? 0) + 1;
      byCategory[activity.categorySlug] = (byCategory[activity.categorySlug] ?? 0) + 1;
    }
    counts = { bySuper, byCategory, total: activities.length };
  } else {
    loadError =
      "Карта недоступна: на сервере не задан адрес бэкенда (NEXT_PUBLIC_API_URL). " +
      "Показать примеры можно только тестировщику.";
  }

  return (
    <MapClient
      filters={filters}
      markers={markers}
      activitiesCount={activitiesCount}
      emptyReason={emptyReason}
      loadError={loadError}
      categories={dictionary.categories}
      superCategories={dictionary.superCategories}
      cities={dictionary.cities}
      districts={dictionary.districts}
      counts={counts}
      canon={useApi}
    />
  );
}
