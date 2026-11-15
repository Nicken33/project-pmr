import type { Metadata } from "next";
import { ApplicationForm } from "@/components/account/ApplicationForm";
import { categories, cities, districts, organizations, superCategories } from "@/lib/data";
import { readView } from "@/lib/session";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Новая анкета",
  description:
    "Форма занятия или услуги по шагам: основное, группы и расписание, точки проведения, контакты, фото.",
};

export const dynamic = "force-dynamic";

export default async function NewApplicationPage() {
  const { mode, session } = await readView();
  if (mode === "demo") {
    return (
      <ApplicationForm
        application={null}
        organizations={organizations}
        categories={categories}
        superCategories={superCategories}
        cities={cities}
        districts={districts}
      />
    );
  }
  if (!session?.authenticated) redirect("/register?next=%2Faccount");
  if (["section_owner", "service_owner", "owner_activity", "owner_service"].includes(session.role ?? "")) {
    redirect("/account");
  }
  notFound();
}
