import type { Metadata } from "next";
import { OwnerCabinet } from "@/components/account/OwnerCabinet";
import { applications, organizations } from "@/lib/data";

export const metadata: Metadata = {
  title: "Кабинет владельца — Talentro",
  description:
    "Свои анкеты со статусами проверки и причиной отказа, профиль организации и точки проведения.",
};

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <OwnerCabinet
      applications={applications.filter((application) => application.byOwner)}
      organizations={organizations}
    />
  );
}
