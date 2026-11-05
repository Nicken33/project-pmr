import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModerationClient } from "@/components/moderation/ModerationClient";
import { readView } from "@/lib/session";

export const metadata: Metadata = {
  title: "Модерация",
  description:
    "Очередь анкет на проверке, жалобы на отзывы и медиа, журнал решений и дефициты каталога.",
};

/* Граница кабинета (§12.1): страница открывает раздел, права — сервер. Список
   анкет и жалоб грузит клиент через прокси `/api/moderation/*`, который сверяет
   куку сессии с базой на каждый запрос: 404 здесь значит «раздела нет», а не
   «доступ разрешён». Тестировщик (режим `demo`, §6) видит демонстрационную
   витрину кабинета, потому что сервер отвечает ему 403 — модератор он не. */
export default async function ModerationPage() {
  const { mode, session } = await readView();
  const isModerator = session?.role === "moderator";
  if (!isModerator && mode !== "demo") notFound();
  return <ModerationClient demo={!isModerator && mode === "demo"} />;
}
