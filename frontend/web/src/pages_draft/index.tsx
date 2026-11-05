import type { GetServerSideProps } from "next";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import type { Activity, CatalogResult, FilterState } from "@/lib/types";
import { activities, categories, cities, districts, superCategories } from "@/lib/data";
import { filterCatalog, parseFilters } from "@/lib/filters";

const PAGE_SIZE = 20;

interface HomeProps {
  initialFilters: FilterState;
  results: CatalogResult[];
  nearby: Activity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  recommended: Activity[];
  categories: typeof categories;
  superCategories: typeof superCategories;
  cities: typeof cities;
  districts: typeof districts;
  counts: {
    bySuper: Record<string, number>;
    byCategory: Record<string, number>;
    total: number;
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async (context) => {
  const params = context.query;
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

  return {
    props: {
      initialFilters: filters,
      results: pageResults,
      nearby,
      total: results.length,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
      recommended,
      categories,
      superCategories,
      cities,
      districts,
      counts: { bySuper, byCategory, total: activities.length },
    },
  };
};

export default function Home(props: HomeProps) {
  return <CatalogClient {...props} />;
}
