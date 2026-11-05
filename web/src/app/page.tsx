import type { Metadata } from "next";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import type { Activity, CatalogResult, Category, City, District, SuperCategory } from "@/lib/types";
import { activities, categories, cities, districts, popularQueries, superCategories } from "@/lib/data";
import { defaultFilters, filterCatalog, parseFilters } from "@/lib/filters";
import { ApiError } from "@/lib/api";
import {
  fetchCatalogFromApi,
  fetchDictionariesFromApi,
  fetchDistrictsForCity,
  isApiEnabled,
  unsupportedLabels,
} from "@/lib/api-server";
import { readView } from "@/lib/session";

export const metadata: Metadata = {
  title: "Talentro — занятия и услуги Приднестровья",
  description:
    "Каталог секций, кружков, студий и услуг для детей и взрослых в Тирасполе, Бендерах и других городах Приднестровья. Сравните группы, цены и расписание.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
/** Больше `limit` бэкенд не принимает (§9.2), поэтому окно листания упирается в сотню. */
const MAX_WINDOW = 100;
/** Три карточки «рядом по теме» при пустом результате (§3.1.8). */
const NEARBY_SIZE = 3;

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
  // Единственная развилка витрины (§6): что реально, а что выставочный образец.
  const { mode } = await readView();
  const demo = mode === "demo";
  const useApi = isApiEnabled();

  let dictionaries: {
    superCategories: SuperCategory[];
    categories: Category[];
    cities: City[];
    districts: District[];
  } = { superCategories, categories, cities, districts };

  if (useApi) {
    const [real, cityDistricts] = await Promise.all([
      fetchDictionariesFromApi(),
      filters.city ? fetchDistrictsForCity(filters.city) : Promise.resolve([]),
    ]);
    dictionaries = { ...real, districts: cityDistricts };
  }

  // Ошибку загрузки не гасим в пустой список: §3.1.8 требует «не удалось
  // загрузить — повторить», а не «ничего не найдено». Моки положены только
  // демо-режиму, а витрина без бэкенда — это ошибка, а не пустой каталог.
  const requestedPage = Number(first(params.page));
  const wanted = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1;

  let results: CatalogResult[];
  let loadError: string | undefined;
  let total = 0;
  let pages = 1;

  if (useApi) {
    // Одно окно на весь список: «показать ещё» долистывает накопительно (§3.1.7),
    // а бэкенд принимает не больше MAX_WINDOW запросов за раз.
    const limit = Math.min(wanted * PAGE_SIZE, MAX_WINDOW);
    try {
      const fetched = await fetchCatalogFromApi(filters, 1, limit);
      results = fetched.results;
      total = fetched.total;
      pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    } catch (error) {
      results = [];
      loadError =
        error instanceof ApiError
          ? error.message
          : `Запрос к каталогу завершился непредвиденной ошибкой: ${String(error)}`;
    }
  } else if (demo) {
    results = filterCatalog(filters);
    total = results.length;
    pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  } else {
    results = [];
    loadError =
      "Каталог недоступен: на сервере не задан адрес бэкенда (NEXT_PUBLIC_API_URL). " +
      "Показать примеры можно только тестировщику.";
  }

  const page = Math.max(1, Math.min(pages, wanted));
  // «показать ещё» долистывает накопительно (§3.1.7), поэтому берём срез до страницы.
  const pageResults = results.slice(0, page * PAGE_SIZE);

  // Пустой результат: три карточки «рядом по теме» со снятыми фильтрами (§3.1.8).
  // Образцы берём из того же источника, что и список: на API это повторный
  // запрос без фильтров, в демо — моки.
  let nearby: Activity[] = [];
  if (!loadError && pageResults.length === 0) {
    if (useApi) {
      // Это второй запрос, но только когда первый оказался пуст: ровно три карточки.
      try {
        const extra = await fetchCatalogFromApi(defaultFilters, 1, NEARBY_SIZE);
        nearby = extra.results.map((item) => item.activity);
      } catch {
        nearby = [];
      }
    } else {
      const sameDirection = activities.filter(
        (activity) =>
          activity.categorySlug === filters.category || activity.superSlug === filters.superCategory,
      );
      const pool = sameDirection.length ? sameDirection : activities;
      nearby = [...pool]
        .sort((a, b) => b.votesPlus - a.votesPlus)
        .slice(0, 3);
    }
  }

  // Счётчики направлений — выставочные: на API у бэкенда их нет, поэтому числа
  // моков были бы неправдой, и сайдбар показывает их только в демо.
  const bySuper: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  if (demo) {
    for (const activity of activities) {
      bySuper[activity.superSlug] = (bySuper[activity.superSlug] ?? 0) + 1;
      byCategory[activity.categorySlug] = (byCategory[activity.categorySlug] ?? 0) + 1;
    }
  }

  const recommendedSlugs = [
    "programmirovanie-dlya-detey-kiberhod",
    "hudozhestvennaya-studiya-palitra",
    "massazh-spa-ritual",
    "futbolnaya-sekciya-chempion",
    "gruming-salon-lapki",
    "tancevalnaya-studiya-graciya",
  ];
  const recommended = demo
    ? recommendedSlugs
        .map((slug) => activities.find((activity) => activity.slug === slug))
        .filter((activity): activity is Activity => Boolean(activity))
    : [];

  return (
    <CatalogClient
      initialFilters={filters}
      results={pageResults}
      loadError={loadError}
      nearby={nearby}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      totalPages={pages}
      recommended={recommended}
      categories={dictionaries.categories}
      superCategories={dictionaries.superCategories}
      cities={dictionaries.cities}
      districts={dictionaries.districts}
      counts={demo ? { bySuper, byCategory, total: activities.length } : undefined}
      canon={useApi}
      demo={demo}
      popular={demo ? popularQueries : []}
      ignored={useApi ? unsupportedLabels(filters) : []}
    />
  );
}
