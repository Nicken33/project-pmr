import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FavoritesClient } from "@/components/favorites/FavoritesClient";
import { activities } from "@/lib/data";
import { cookies } from "next/headers";
import type { Activity } from "@/lib/types";
import { fetchFavoriteCatalogFromApi } from "@/lib/api-server";
import { readView } from "@/lib/session";

export const metadata: Metadata = {
  title: "Избранное",
  description:
    "Сохранённые занятия и услуги Talentro — открываются с ближайшей точкой и подходящей группой.",
};

export const dynamic = "force-dynamic";

/** Список сохранённых slug'ов; каталог нужен, чтобы пересобрать группу и точку. */


export default async function FavoritesPage() {
  const { mode, session } = await readView();
  // Избранное — свойство аккаунта, а не демо-витрина, поэтому граница решается по сессии:
  // requireDemo отрезал бы реальных пользователей с Google-входом.
  if (mode === "demo") return <FavoritesClient catalog={activities} />;
  // Гостя список не касается: до входа в этом браузере может лежать черновик,
  // а витрина обязана показывать только серверное избранное. Точку входа оставляем
  // живую — в шапке и меню «Избранное» видно всем, поэтому сюда ведёт вход, а не 404.
  if (!session?.authenticated) redirect("/login?next=%2Ffavorites");

  let catalog: Activity[]=[];
  let loadError="";
  try {catalog=await fetchFavoriteCatalogFromApi((await cookies()).toString());}
  catch(error){loadError=error instanceof Error ? error.message : "Не удалось загрузить избранное";}
  return <FavoritesClient catalog={catalog} loadError={loadError} />;
}
