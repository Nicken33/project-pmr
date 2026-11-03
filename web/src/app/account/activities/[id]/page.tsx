import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/account/ApplicationForm";
import { applications, categories, cities, districts, organizations, superCategories } from "@/lib/data";

export function generateStaticParams() {
  return applications.filter((application) => application.byOwner).map((application) => ({ id: application.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const application = applications.find((item) => item.id === id);
  if (!application) return { title: "Анкета не найдена" };
  return {
    title: `Правка анкеты: ${application.title}`,
    description: "Владелец правит анкету по шагам; правка группы или точки возвращает карточку на проверку.",
    robots: { index: false },
  };
}

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = applications.find((item) => item.id === id && item.byOwner);
  if (!application) notFound();

  return (
    <ApplicationForm
      application={application}
      organizations={organizations}
      categories={categories}
      superCategories={superCategories}
      cities={cities}
      districts={districts}
    />
  );
}
