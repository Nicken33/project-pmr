import type { Metadata } from "next";
import { FavoritesClient } from "@/components/favorites/FavoritesClient";
import { activities } from "@/lib/data";
import { defaultFilters } from "@/lib/filters";
import { fetchCatalogFromApi } from "@/lib/api-server";
import { readView } from "@/lib/session";

export const metadata: Metadata = {
  title: "Избранное",
  description: "Сохранённые занятия и услуги Talentro — открываются с ближайшей точкой и подходящей группой.",
};

export const dynamic = "force-dynamic";

/** Список сохранённых slug'ов; каталог нужен, чтобы пересобрать группу и точку. */
const CATALOG_WINDOW = 100;

export default async function FavoritesPage() {
  const { mode } = await readView();
  // §6: моки уезжают в RSC-поток только тестировщику. Список избранного лежит в
  // localStorage посетителя, поэтому страница остаётся доступной и без демо-режима —
  // просто с каноническим каталогом вместо витрины.
  if (mode === "demo") return <FavoritesClient catalog={activities} />;

  const catalog = await fetchCatalogFromApi(defaultFilters, 1, CATALOG_WINDOW)
    .then((result) => result.results.map((row) => row.activity))
    // Бэкенд недоступен — пустой список честнее мок-витрины в ответе анонима.
    .catch(() => []);

  return <FavoritesClient catalog={catalog} />;
}
