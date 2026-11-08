import type { Metadata } from "next";
import { OwnerCabinet } from "@/components/account/OwnerCabinet";
import { requireDemo } from "@/lib/session";

export const metadata: Metadata = {
  title: "Кабинет владельца",
  description:
    "Свои анкеты со статусами проверки и причиной отказа, профиль организации и точки проведения.",
};

/* Списки анкет и организаций не приходят с сервера: серверный компонент,
   который передаёт их пропсами, попадает ими же в RSC-поток, и анонимный
   GET /account получает чужие анкеты в теле ответа. Загружает клиент.
   Отфильтровать «это анкеты текущего владельца» на клиенте нельзя — в моках
   стоит флаг byOwner без привязки к аккаунту. Настоящая привязка появится
   вместе с серверной авторизацией (§12.1–12.4). */
export default async function AccountPage() {
  // Граница real/demo (§6): 404 до любого обращения к данным, иначе анкеты
  // успеют попасть в RSC-поток ответа.
  await requireDemo();
  return <OwnerCabinet />;
}
