import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/account/ApplicationForm";
import { OwnerActivityEditClient } from "@/components/account/OwnerActivityEditClient";
import { applications, categories, cities, districts, organizations, superCategories } from "@/lib/data";
import { readView } from "@/lib/session";

// Раздел закрыт (§6): доступ решает кука сессии на каждом запросе.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { mode } = await readView();
  const application = mode === "demo" ? applications.find((item) => item.id === id) : undefined;
  return {
    title: application ? `Правка анкеты: ${application.title}` : `Правка секции #${id}`,
    description: "Владелец правит анкету по шагам; правка группы или точки возвращает карточку на проверку.",
    robots: { index: false },
  };
}

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { mode, session } = await readView();
  const isOwner =
    session?.role === "owner_activity" ||
    session?.role === "owner_service" ||
    session?.role === "section_owner" ||
    session?.role === "service_owner" ||
    session?.role === "moderator" ||
    session?.role === "admin";

  if (!isOwner && mode !== "demo") {
    notFound();
  }

  const application = mode === "demo" ? applications.find((item) => item.id === id && item.byOwner) : undefined;
  if (application) {
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

  return <OwnerActivityEditClient id={id} sessionRole={session?.role} />;
}
