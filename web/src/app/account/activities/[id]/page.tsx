import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/account/ApplicationForm";
import { applications, categories, cities, districts, organizations, superCategories } from "@/lib/data";
import { readView, requireDemo } from "@/lib/session";

// Раздел закрыт (§6), поэтому страница не собирается статически: доступ решает
// кука сессии на каждом запросе, а предсобранные мок-анкеты утекали бы анонимам.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Заголовок строится из мока, поэтому в real-режиме в <title> он не появляется.
  const { mode } = await readView();
  const application = mode === "demo" ? applications.find((item) => item.id === id) : undefined;
  if (!application) return { title: "Раздел доступен по тестовому входу" };
  return {
    title: `Правка анкеты: ${application.title}`,
    description: "Владелец правит анкету по шагам; правка группы или точки возвращает карточку на проверку.",
    robots: { index: false },
  };
}

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  // Граница closed-раздела (§6): до поиска анкеты по мок-идентификатору.
  await requireDemo();
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
