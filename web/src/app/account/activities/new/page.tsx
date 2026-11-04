import type { Metadata } from "next";
import { ApplicationForm } from "@/components/account/ApplicationForm";
import { categories, cities, districts, organizations, superCategories } from "@/lib/data";

export const metadata: Metadata = {
  title: "Новая анкета",
  description:
    "Форма занятия или услуги по шагам: основное, группы и расписание, точки проведения, контакты, фото.",
};

export const dynamic = "force-dynamic";

export default function NewApplicationPage() {
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
