"use client";

import Link from "next/link";
import { ArrowRight, Map, Search, ShieldCheck } from "lucide-react";
import type { FilterState, SuperCategory } from "@/lib/types";
import { popularQueries } from "@/lib/data";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/Icon";

interface CategoryStripProps {
  filters: FilterState;
  superCategories: SuperCategory[];
  categories: { slug: string; title: string; superSlug: string; kind: string }[];
  onSuperChange: (slug: string) => void;
  onServices: () => void;
}

export function CategoryStrip({
  filters,
  superCategories,
  categories,
  onSuperChange,
  onServices,
}: CategoryStripProps) {
  const activeSuper = superCategories.find((item) => item.slug === filters.superCategory);
  const activeCategory = categories.find((item) => item.slug === filters.category);
  const activeTitle =
    filters.kind === "service"
      ? "Услуги"
      : activeCategory?.title ?? activeSuper?.shortTitle ?? "Все направления";
  const activeSub =
    filters.kind === "service"
      ? "Мастера красоты, репетиторы, фотографы и другие специалисты"
      : activeSuper
        ? categories
            .filter((category) => category.superSlug === activeSuper.slug)
            .map((category) => category.title.toLowerCase())
            .slice(0, 6)
            .join(", ")
        : "Творчество, спорт, обучение, технологии и практика";

  return (
    <div className="categoryStripWrap">
      <div className="categoryStrip" role="group" aria-label="Направления занятий">
        <button
          type="button"
          className={cn("categoryTile", !filters.superCategory && !filters.kind && "isActive")}
          onClick={() => onSuperChange("")}
          aria-pressed={!filters.superCategory && !filters.kind}
          aria-label="Все направления"
        >
          <CategoryIcon name="layout-grid" size={27} />
        </button>
        {superCategories
          .filter((superCategory) => superCategory.slug !== "other")
          .map((superCategory) => (
            <button
              key={superCategory.slug}
              type="button"
              className={cn("categoryTile", filters.superCategory === superCategory.slug && "isActive")}
              onClick={() => onSuperChange(superCategory.slug)}
              aria-pressed={filters.superCategory === superCategory.slug}
              aria-label={superCategory.title}
              title={superCategory.title}
            >
              <CategoryIcon name={superCategory.icon} size={27} />
            </button>
          ))}
        <button
          type="button"
          className={cn("categoryTile", filters.kind === "service" && "isActive")}
          onClick={onServices}
          aria-pressed={filters.kind === "service"}
          aria-label="Только услуги"
          title="Услуги"
        >
          <CategoryIcon name="sparkles" size={26} />
        </button>
        <button
          type="button"
          className={cn("categoryTile", filters.superCategory === "other" && "isActive")}
          onClick={() => onSuperChange("other")}
          aria-pressed={filters.superCategory === "other"}
          aria-label="Другое"
          title="Другое"
        >
          <CategoryIcon name="layout-grid" size={26} />
        </button>
        <Link
          href="/map"
          role="listitem"
          className="categoryTile categoryTile--map"
          aria-label="Открыть карту"
          title="Карта"
        >
          <Map size={27} />
        </Link>
      </div>
      <div className="categoryCaption">
        <span>
          <strong>{activeTitle}</strong>
          <small>{activeSub}</small>
        </span>
        <Link href="/map" className="categoryCaptionLink">
          На карте <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

export function CatalogHero({
  initialQuery,
  onSearch,
  total,
}: {
  initialQuery: string;
  onSearch: (query: string) => void;
  total: number;
}) {
  return (
    <section className="catalogHero" aria-labelledby="hero-title">
      <div className="heroGlow heroGlow--one" aria-hidden="true" />
      <div className="heroGlow heroGlow--two" aria-hidden="true" />
      <div className="heroCopy">
        <span className="heroKicker">
          <ShieldCheck size={15} /> Каталог Приднестровья
        </span>
        <h1 id="hero-title">
          Найди занятие
          <br />
          <span>по душе</span>
        </h1>
        <p>
          Секции, кружки, услуги и хобби рядом с вами. Сравнивайте группы,
          цены и расписание — без звонков по всем подряд.
        </p>
        <form
          className="heroSearch"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onSearch(String(data.get("q") ?? ""));
          }}
        >
          <Search size={20} className="heroSearchIcon" />
          <input
            type="search"
            name="q"
            defaultValue={initialQuery}
            placeholder="Поиск секций, услуг, занятий…"
            aria-label="Поиск занятий и услуг"
            autoComplete="off"
          />
          <button type="submit" className="btn btn--primary heroSearchButton">
            Найти
          </button>
        </form>
        <div className="heroQuick">
          <span>Часто ищут:</span>
          {popularQueries.slice(0, 5).map((query) => (
            <button key={query} type="button" onClick={() => onSearch(query)}>
              {query}
            </button>
          ))}
          <span className="heroCount">{total} вариантов в каталоге</span>
        </div>
      </div>
      <div className="heroArt" aria-hidden="true">
        <img src="/brand/hero-illustration.png" alt="" />
      </div>
    </section>
  );
}
