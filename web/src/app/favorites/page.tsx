import type { Metadata } from "next";
import Link from "next/link";
import { Heart, LogIn, Search } from "lucide-react";
import { FavoritesClient } from "@/components/favorites/FavoritesClient";
import { activities } from "@/lib/data";
import { defaultFilters } from "@/lib/filters";
import { fetchCatalogFromApi } from "@/lib/api-server";
import { readView } from "@/lib/session";

export const metadata: Metadata = {
  title: "Избранное",
  description:
    "Сохранённые занятия и услуги Talentro — открываются с ближайшей точкой и подходящей группой.",
};

export const dynamic = "force-dynamic";

/** Список сохранённых slug'ов; каталог нужен, чтобы пересобрать группу и точку. */
const CATALOG_WINDOW = 100;

/** Гостю — 200 без каталога в ответе: ни моков, ни лишнего RSC-потока. */
function GuestFavorites() {
  return (
    <div className="favoritesPage container">
      <div className="emptyState surface favoritesEmpty">
        <span className="emptyStateIcon">
          <Heart size={28} />
        </span>
        <h3>Избранное появляется после входа</h3>
        <p>
          Гостю доступны каталог, поиск, фильтры и карта. Войдите, чтобы сохранять занятия и
          открывать их здесь с ближайшей точкой и подходящей группой.
        </p>
        <p className="favoritesHint">
          Сервера для избранного в продукте пока нет: список живёт в этом браузере и на другое
          устройство не переезжает.
        </p>
        <div className="emptyStateActions">
          <Link href="/login?next=/favorites" className="btn btn--primary btn--lg">
            <LogIn size={17} /> Войти
          </Link>
          <Link href="/" className="btn btn--soft btn--lg">
            <Search size={16} /> В каталог
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function FavoritesPage() {
  const { mode, session } = await readView();
  // Избранное — свойство аккаунта, а не демо-витрина, поэтому граница решается по сессии:
  // requireDemo отрезал бы реальных пользователей с Google-входом.
  if (mode === "demo") return <FavoritesClient catalog={activities} />;
  if (!session?.authenticated) return <GuestFavorites />;

  const catalog = await fetchCatalogFromApi(defaultFilters, 1, CATALOG_WINDOW)
    .then((result) => result.results.map((row) => row.activity))
    // Бэкенд недоступен — пустой список честнее мок-витрины в ответе посетителя.
    .catch(() => []);

  return <FavoritesClient catalog={catalog} />;
}
