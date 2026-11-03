import type { Metadata } from "next";
import { MapClient } from "@/components/map/MapClient";
import { activities, categories, cities, districts, superCategories } from "@/lib/data";
import { catalogMarkers, filterCatalog, parseFilters } from "@/lib/filters";

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
  const results = filterCatalog(filters);
  const markers = catalogMarkers(filters);

  const bySuper: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const activity of activities) {
    bySuper[activity.superSlug] = (bySuper[activity.superSlug] ?? 0) + 1;
    byCategory[activity.categorySlug] = (byCategory[activity.categorySlug] ?? 0) + 1;
  }

  return (
    <MapClient
      filters={filters}
      markers={markers}
      activitiesCount={results.length}
      categories={categories}
      superCategories={superCategories}
      cities={cities}
      districts={districts}
      counts={{ bySuper, byCategory, total: activities.length }}
    />
  );
}
