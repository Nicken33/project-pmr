"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  Grid2X2,
  List,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import type {
  Activity,
  CatalogResult,
  Category,
  City,
  District,
  FilterState,
  SuperCategory,
} from "@/lib/types";
import { defaultFilters, activeFilterCount, filtersToParams } from "@/lib/filters";
import { cn, plural } from "@/lib/utils";
import { ActivityCard } from "@/components/catalog/ActivityCard";
import { FilterSidebar, MobileFilterSheet } from "@/components/catalog/FilterSidebar";
import { CatalogHero, CategoryStrip } from "@/components/catalog/Hero";

interface CatalogClientProps {
  initialFilters: FilterState;
  results: CatalogResult[];
  /** Текст ошибки загрузки бэкенда: каталог показывает её вместо пустого результата (§3.1.8). */
  loadError?: string;
  nearby: Activity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  recommended: Activity[];
  categories: Category[];
  superCategories: SuperCategory[];
  cities: City[];
  districts: District[];
  counts: {
    bySuper: Record<string, number>;
    byCategory: Record<string, number>;
    total: number;
  };
}

export function CatalogClient({
  initialFilters,
  results,
  loadError,
  nearby,
  total,
  page,
  pageSize,
  totalPages,
  recommended,
  categories,
  superCategories,
  cities,
  districts,
  counts,
}: CatalogClientProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [isPending, startTransition] = useTransition();
  const resultsRef = useRef<HTMLDivElement>(null);

  /* URL — источник истины: локальные фильтры обновляем вместе с пропсами во
     время рендера. Remount всего каталога сбрасывал бы скелетон и прокрутку на
     каждое нажатие. */
  const initialKey = JSON.stringify([initialFilters, page]);
  const [syncedKey, setSyncedKey] = useState(initialKey);
  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey);
    setFilters(initialFilters);
  }

  useEffect(() => {
    document.body.style.overflow = mobileFilters ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileFilters]);

  const navigate = (nextFilters: FilterState, nextPage = 1, keepScroll = true) => {
    setFilters(nextFilters);
    const params = filtersToParams(nextFilters);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/?${query}` : "/", { scroll: keepScroll });
    });
  };

  const updateFilters = (patch: Partial<FilterState>) => {
    const next: FilterState = { ...filters, ...patch };
    if (Object.keys(patch).some((key) => key !== "activity" && key !== "sort" && key !== "view")) {
      next.activity = "";
    }
    if (patch.superCategory !== undefined && patch.category === undefined) next.category = "";
    if (patch.category !== undefined && patch.category) {
      const category = categories.find((item) => item.slug === patch.category);
      if (category) next.superCategory = category.superSlug;
    }
    if (patch.kind !== undefined && patch.kind) {
      next.superCategory = "";
      next.category = "";
    }
    if (patch.near === true && !next.city) next.city = "tiraspol";
    if (patch.free === true) next.priceMax = "";
    navigate(next, 1);
  };

  const resetFilters = () => {
    navigate({ ...defaultFilters, view: filters.view, sort: "relevance" }, 1);
  };

  const scrollToResults = () => {
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const activeCount = activeFilterCount(filters);
  const activeCategory = categories.find((category) => category.slug === filters.category);
  const activeSuper = superCategories.find((superCategory) => superCategory.slug === filters.superCategory);
  const activeCity = cities.find((city) => city.slug === filters.city);
  const formatLabels: Record<string, string> = {
    offline: "Офлайн",
    online: "Онлайн",
    both: "Офлайн и онлайн",
  };
  const timeLabels: Record<string, string> = {
    morning: "Утро",
    day: "День",
    evening: "Вечер",
  };

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (filters.q) {
    chips.push({ key: "q", label: `«${filters.q}»`, onRemove: () => updateFilters({ q: "" }) });
  }
  if (filters.kind === "service") {
    chips.push({ key: "kind", label: "Услуги", onRemove: () => updateFilters({ kind: "" }) });
  }
  if (activeCategory) {
    chips.push({
      key: "category",
      label: activeCategory.title,
      onRemove: () => updateFilters({ category: "" }),
    });
  } else if (activeSuper) {
    chips.push({
      key: "super",
      label: activeSuper.shortTitle,
      onRemove: () => updateFilters({ superCategory: "" }),
    });
  }
  if (activeCity) {
    chips.push({
      key: "city",
      label: activeCity.title,
      onRemove: () => updateFilters({ city: "", district: [], near: false }),
    });
  }
  for (const districtSlug of filters.district) {
    const district = districts.find((item) => item.slug === districtSlug);
    if (!district) continue;
    chips.push({
      key: `district-${districtSlug}`,
      label: district.title,
      onRemove: () =>
        updateFilters({ district: filters.district.filter((item) => item !== districtSlug) }),
    });
  }
  if (filters.near) {
    chips.push({
      key: "near",
      label: `Рядом · ${Number(filters.radius) / 1000} км`,
      onRemove: () => updateFilters({ near: false }),
    });
  }
  if (filters.age) {
    chips.push({
      key: "age",
      label: `От ${filters.age} лет`,
      onRemove: () => updateFilters({ age: "" }),
    });
  }
  if (filters.priceMax) {
    chips.push({
      key: "price",
      label: `до ${Number(filters.priceMax).toLocaleString("ru-RU")} ₽`,
      onRemove: () => updateFilters({ priceMax: "" }),
    });
  }
  if (filters.free) {
    chips.push({ key: "free", label: "Бесплатно", onRemove: () => updateFilters({ free: false }) });
  }
  if (filters.format) {
    chips.push({
      key: "format",
      label: formatLabels[filters.format] ?? filters.format,
      onRemove: () => updateFilters({ format: "" }),
    });
  }
  if (filters.day) {
    chips.push({
      key: "day",
      label: filters.day,
      onRemove: () => updateFilters({ day: "" }),
    });
  }
  if (filters.time) {
    chips.push({
      key: "time",
      label: timeLabels[filters.time] ?? filters.time,
      onRemove: () => updateFilters({ time: "" }),
    });
  }
  if (filters.verified) {
    chips.push({
      key: "verified",
      label: "Проверенные",
      onRemove: () => updateFilters({ verified: false }),
    });
  }

  const variantsWord = plural(total, "вариант", "варианта", "вариантов");

  return (
    <div className="catalogLayout container">
      <div className="catalogSidebarColumn">
        <FilterSidebar
          filters={filters}
          onChange={updateFilters}
          onReset={resetFilters}
          resultCount={total}
          categories={categories}
          superCategories={superCategories}
          cities={cities}
          districts={districts}
          counts={counts}
        />
      </div>

      <div className="catalogMain">
        <CatalogHero
          key={`hero-${filters.q}`}
          initialQuery={filters.q}
          total={counts.total}
          onSearch={(query) => {
            updateFilters({ q: query });
            scrollToResults();
          }}
        />

        <CategoryStrip
          filters={filters}
          superCategories={superCategories}
          categories={categories}
          onSuperChange={(slug) => {
            updateFilters({ superCategory: slug, category: "", kind: "" });
            scrollToResults();
          }}
          onServices={() => {
            updateFilters({ kind: filters.kind === "service" ? "" : "service", superCategory: "", category: "" });
            scrollToResults();
          }}
        />

        {recommended.length ? (
          <section className="recommendedSection" aria-labelledby="recommended-title">
            <div className="sectionHeadRow">
              <div>
                <span className="eyebrow">
                  <Sparkles size={13} /> Выбор редакции
                </span>
                <h2 id="recommended-title">Рекомендуемое</h2>
              </div>
              <button
                type="button"
                className="sectionLink"
                onClick={() => {
                  resetFilters();
                  scrollToResults();
                }}
              >
                Смотреть все <ChevronRight size={15} />
              </button>
            </div>
            <div className="recommendedGrid">
              {recommended.map((activity) => (
                <ActivityCard key={activity.slug} activity={activity} compact />
              ))}
            </div>
          </section>
        ) : null}

        <section className="catalogResults" ref={resultsRef} id="catalog" aria-labelledby="catalog-title">
          <div className="catalogResultsHead">
            <div>
              <h2 id="catalog-title">Все занятия и услуги</h2>
              <p>
                Найдено <strong>{total}</strong> {variantsWord}
                {activeCount ? " по вашим фильтрам" : " в Приднестровье"}
              </p>
            </div>
            <div className="catalogTools">
              <button
                type="button"
                className="btn btn--soft catalogFilterButton"
                onClick={() => setMobileFilters(true)}
              >
                <SlidersHorizontal size={16} />
                Фильтры
                {activeCount ? <span className="toolBadge">{activeCount}</span> : null}
              </button>
              <label className="sortSelect">
                <ArrowDownUp size={15} />
                <span className="srOnly">Сортировка</span>
                <select
                  value={filters.sort}
                  onChange={(event) => navigate({ ...filters, sort: event.target.value }, 1)}
                  aria-label="Сортировка"
                >
                  <option value="relevance">По популярности</option>
                  <option value="rating">По оценкам</option>
                  <option value="new">Сначала новые</option>
                  <option value="near">Сначала ближние</option>
                  <option value="free">Сначала бесплатные</option>
                  <option value="updated">Недавно обновлённые</option>
                </select>
              </label>
              <div className="viewToggle" role="group" aria-label="Вид каталога">
                <button
                  type="button"
                  className={cn(filters.view === "grid" && "isActive")}
                  aria-label="Сеткой"
                  aria-pressed={filters.view === "grid"}
                  onClick={() => navigate({ ...filters, view: "grid" }, page)}
                >
                  <Grid2X2 size={17} />
                </button>
                <button
                  type="button"
                  className={cn(filters.view === "list" && "isActive")}
                  aria-label="Списком"
                  aria-pressed={filters.view === "list"}
                  onClick={() => navigate({ ...filters, view: "list" }, page)}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>

          {chips.length ? (
            <div className="activeFilters" aria-label="Активные фильтры">
              <span className="activeFiltersLabel">Выбрано:</span>
              {chips.map((chip) => (
                <button key={chip.key} type="button" className="activeFilterChip" onClick={chip.onRemove}>
                  {chip.label}
                  <X size={13} />
                  <span className="srOnly">Убрать фильтр</span>
                </button>
              ))}
              <button type="button" className="activeFiltersReset" onClick={resetFilters}>
                Сбросить всё
              </button>
            </div>
          ) : null}

          {isPending ? (
            <div className="catalogPending" aria-live="polite" aria-busy="true">
              <div className="catalogPendingBar" />
              <div className={cn("catalogGrid", filters.view === "list" && "catalogGrid--list")}>
                {Array.from({ length: Math.min(5, pageSize) }).map((_, index) => (
                  <ActivityCard key={index} skeleton />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="emptyState catalogEmpty" role="alert">
              <span className="emptyStateIcon">
                <WifiOff size={30} />
              </span>
              <h3>Каталог не загрузился</h3>
              <p>{loadError}. Данные могли не дойти — попробуйте ещё раз.</p>
              <div className="emptyStateActions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => router.refresh()}
                  disabled={isPending}
                >
                  Повторить
                </button>
                <Link href="/request" className="btn btn--soft">
                  Оставить заявку
                </Link>
              </div>
            </div>
          ) : results.length ? (
            <>
              <div className={cn("catalogGrid", filters.view === "list" && "catalogGrid--list")}>
                {results.map(({ activity, match }, index) => (
                  <ActivityCard
                    key={`${activity.slug}-${match.groupId}-${match.locationId}`}
                    activity={activity}
                    initialGroupId={match.groupId}
                    initialLocationId={match.locationId}
                    rank={filters.sort === "relevance" && !activeCount ? index + 1 : undefined}
                  />
                ))}
              </div>

              {page < totalPages ? (
                <div className="catalogMore">
                  <button
                    type="button"
                    className="btn btn--soft catalogMoreButton"
                    onClick={() => navigate(filters, page + 1, false)}
                    disabled={isPending}
                  >
                    <ChevronDown size={17} />
                    {isPending ? "Загружаем…" : "Показать ещё"}
                  </button>
                  <span className="catalogMoreNote">
                    Показано {results.length} из {total} {variantsWord}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="emptyState catalogEmpty">
              <span className="emptyStateIcon">
                <MapPin size={30} />
              </span>
              <h3>Пока ничего не нашлось</h3>
              <p>
                Попробуйте убрать один из фильтров или расширить географию. Если занятия
                действительно нет — оставьте заявку, и мы поищем вместе.
              </p>
              <div className="emptyStateActions">
                <button type="button" className="btn btn--primary" onClick={resetFilters}>
                  Сбросить фильтры
                </button>
                <Link href="/request" className="btn btn--soft">
                  Оставить заявку
                </Link>
              </div>
              {nearby.length ? (
                <div className="nearbyFallback">
                  <p className="nearbyTitle">Рядом по теме — эти карточки без ваших фильтров</p>
                  <div className="nearbyGrid">
                    {nearby.map((activity) => (
                      <ActivityCard key={activity.slug} activity={activity} compact />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <MobileFilterSheet
        open={mobileFilters}
        onClose={() => setMobileFilters(false)}
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
        resultCount={total}
        categories={categories}
        superCategories={superCategories}
        cities={cities}
        districts={districts}
        counts={counts}
      />
    </div>
  );
}
