import type { Metadata } from "next";
import { FavoritesClient } from "@/components/favorites/FavoritesClient";

export const metadata: Metadata = {
  title: "Избранное",
  description: "Сохранённые занятия и услуги Talentro — открываются с ближайшей точкой и подходящей группой.",
};

export default function FavoritesPage() {
  return <FavoritesClient />;
}
