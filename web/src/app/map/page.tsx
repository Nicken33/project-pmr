import type { Metadata } from "next";
import { MapClient } from "@/components/map/MapClient";
import { activities, categories, cities, districts, superCategories } from "@/lib/data";
import { catalogMarkers, filterCatalog, parseFilters, type CatalogMarker } from "@/lib/filters";
import { ApiError, isApiEnabled } from "@/lib/api";
import { fetchCatalogFromApi } from "@/lib/api-server";

export const metadata: Metadata = {
  title: "Карта занятий",
  description:
    "Карта секций, кружков и услуг Приднестровья: метки по точкам проведения, радиус «рядом со мной» и кластеры. Тайлы © OpenStreetMap contributors.",
  alternates: { canonical: "/map" },
};

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let markers: CatalogMarker[] = [];
  let activitiesCount = 0;
  let loadError: string | undefined;
  let emptyReason: string | undefined;
  let counts: { bySuper: Record<string, number>; byCategory: Record<string, number>; total: number } = {
    bySuper: {},
    byCategory: {},
    total: 0,
  };

  if (isApiEnabled()) {
    try {
      const { results } = await fetchCatalogFromApi(filters);
      activitiesCount = results.length;
      // models.Card не содержит координат, а без них метку построить нечем.
      emptyReason =
        "Бэкенд пока не отдаёт координаты точек, поэтому на карте нет ни одной метки. Занятия из того же запроса видны в каталоге.";
    } catch (error) {
      loadError =
        error instanceof ApiError
          ? error.message
          : `Запрос к каталогу завершился непредвиденной ошибкой: ${String(error)}`;
    }
  } else {
    activitiesCount = filterCatalog(filters).length;
    markers = catalogMarkers(filters);

    const bySuper: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const activity of activities) {
      bySuper[activity.superSlug] = (bySuper[activity.superSlug] ?? 0) + 1;
      byCategory[activity.categorySlug] = (byCategory[activity.categorySlug] ?? 0) + 1;
    }
    counts = { bySuper, byCategory, total: activities.length };
  }

  return (
    <MapClient
      filters={filters}
      markers={markers}
      activitiesCount={activitiesCount}
      emptyReason={emptyReason}
      loadError={loadError}
      categories={categories}
      superCategories={superCategories}
      cities={cities}
      districts={districts}
      counts={counts}
    />
  );
}
