import type { Metadata } from "next";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import type { Activity } from "@/lib/types";
import { activities, categories, cities, districts, superCategories } from "@/lib/data";
import { filterCatalog, parseFilters } from "@/lib/filters";

export const metadata: Metadata = {
  title: "Talentro — занятия и услуги Приднестровья",
  description:
    "Каталог секций, кружков, студий и услуг для детей и взрослых в Тирасполе, Бендерах и других городах Приднестровья. Сравните группы, цены и расписание.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const results = filterCatalog(filters);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const requestedPage = Number(first(params.page));
  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.min(totalPages, Math.trunc(requestedPage)))
    : 1;
  // «показать ещё» долистывает накопительно (§3.1.7), поэтому берём срез до страницы.
  const pageResults = results.slice(0, page * PAGE_SIZE);

  // Пустой результат: три карточки «рядом по теме» со снятыми фильтрами (§3.1.8).
  let nearby: Activity[] = [];
  if (results.length === 0) {
    const sameDirection = activities.filter(
      (activity) =>
        activity.categorySlug === filters.category || activity.superSlug === filters.superCategory,
    );
    const pool = sameDirection.length ? sameDirection : activities;
    nearby = [...pool]
      .sort((a, b) => b.votesPlus - a.votesPlus)
      .slice(0, 3);
  }

  const bySuper: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const activity of activities) {
    bySuper[activity.superSlug] = (bySuper[activity.superSlug] ?? 0) + 1;
    byCategory[activity.categorySlug] = (byCategory[activity.categorySlug] ?? 0) + 1;
  }

  const recommendedSlugs = [
    "programmirovanie-dlya-detey-kiberhod",
    "hudozhestvennaya-studiya-palitra",
    "massazh-spa-ritual",
    "futbolnaya-sekciya-chempion",
    "gruming-salon-lapki",
    "tancevalnaya-studiya-graciya",
  ];
  const recommended = recommendedSlugs
    .map((slug) => activities.find((activity) => activity.slug === slug))
    .filter((activity): activity is Activity => Boolean(activity));

  return (
    <CatalogClient
      initialFilters={filters}
      results={pageResults}
      nearby={nearby}
      total={results.length}
      page={page}
      pageSize={PAGE_SIZE}
      totalPages={totalPages}
      recommended={recommended}
      categories={categories}
      superCategories={superCategories}
      cities={cities}
      districts={districts}
      counts={{ bySuper, byCategory, total: activities.length }}
    />
  );
}
