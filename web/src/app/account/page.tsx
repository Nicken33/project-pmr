import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerCabinet } from "@/components/account/OwnerCabinet";
import { readView } from "@/lib/session";

export const metadata: Metadata = {
  title: "Кабинет владельца",
  description:
    "Свои анкеты со статусами проверки и причиной отказа, профиль организации и точки проведения.",
};

/* Граница кабинета (§6, §12.1–12.4): страница открывает раздел, права решает
   сервер. Списки карточек и организацию грузит клиент через прокси `/api/me/*`,
   который сверяет куку сессии с базой на каждый запрос, — в RSC-поток ответа
   чужие анкеты не попадают. Анониму закрытый раздел не открывается вовсе.
   Кабинет владельца закрыт остальным ролям. Тестировщик (режим `demo`) видит
   демонстрационную витрину на локальном наборе. */
export default async function AccountPage() {
  const { mode, session } = await readView();
  const isOwner =
    session?.role === "owner_activity" ||
    session?.role === "owner_service" ||
    session?.role === "section_owner" ||
    session?.role === "service_owner";
  if (!isOwner && mode !== "demo") notFound();
  return <OwnerCabinet demo={!isOwner && mode === "demo"} sessionRole={session?.role} />;
}
