import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, MapPin, Phone } from "lucide-react";
import { OrganizationClient, type OrgDirection } from "@/components/organization/OrganizationClient";
import { UnavailablePanel } from "@/components/layout/StatePanel";
import { loadOrganizationPage } from "@/lib/organization-page";
import { formatDateLong, plural } from "@/lib/utils";

/* Ни generateStaticParams, ни dynamicParams = false (§6): слаги организаций
   приходят из базы, а статический список моков отсекал бы настоящие страницы 404. */
export const dynamic = "force-dynamic";

function countActivities(directions: OrgDirection[]): number {
  return directions.reduce((sum, direction) => sum + direction.activities.length, 0);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadOrganizationPage(slug);
  if (page.kind !== "ok") return { title: "Организация не найдена" };
  const { organization, directions, primaryCity } = page.data;
  const count = countActivities(directions);
  const description = `${organization.type} · ${count} ${plural(
    count,
    "анкета",
    "анкеты",
    "анкет",
  )}${primaryCity ? ` · ${primaryCity}` : ""}. ${organization.description}`;
  return {
    title: organization.name,
    description,
    alternates: { canonical: `/organizations/${organization.slug}` },
    openGraph: {
      title: organization.name,
      description,
      url: `/organizations/${organization.slug}`,
      ...(organization.cover
        ? { images: [{ url: organization.cover, alt: organization.name, width: 1200, height: 630 }] }
        : {}),
    },
  };
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await loadOrganizationPage(slug);
  if (page.kind === "notFound") notFound();
  if (page.kind === "unavailable") {
    return (
      <div className="orgPage container">
        <UnavailablePanel title="Данные организации недоступны" message={page.message} />
      </div>
    );
  }

  const { organization, locations, directions, primaryCity } = page.data;
  const count = countActivities(directions);
  const hasServices = directions.some((direction) =>
    direction.activities.some((activity) => activity.kind === "service"),
  );
  // Телефона у организации может не быть: ссылка tel: с пустым номером была бы битой.
  const phoneHref = organization.phone
    ? `tel:${organization.phone.replace(/[^\d+]/g, "")}`
    : undefined;

  return (
    <div className="orgPage container">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">
          <ArrowLeft size={14} /> Каталог
        </Link>
        <span>/</span>
        <span>Организация</span>
      </nav>

      <header className="orgHero">
        {organization.cover ? (
          <div className="orgHeroCover">
            <img src={organization.cover} alt="" />
          </div>
        ) : null}
        <div className="orgHeroBody">
          <div className="orgHeroTags">
            {organization.type ? (
              <span className="badge badge--category">{organization.type}</span>
            ) : null}
            {organization.verifiedAt ? (
              <span className="badge badge--verified">
                <BadgeCheck size={12} /> Контакты сверены {formatDateLong(organization.verifiedAt)}
              </span>
            ) : (
              <span className="badge badge--warning">Данные не сверялись</span>
            )}
            {hasServices ? <span className="badge badge--service">Есть услуги</span> : null}
          </div>
          <h1>{organization.name}</h1>
          {organization.description ? <p className="orgLead">{organization.description}</p> : null}
          <div className="orgHeroMeta">
            <span>
              <MapPin size={14} /> {primaryCity}
              {locations.length > 1 ? `, ${locations.length} точек` : ""}
            </span>
            <span>
              <BadgeCheck size={14} /> {count} {plural(count, "анкета", "анкеты", "анкет")} в
              каталоге
            </span>
            {phoneHref ? (
              <a href={phoneHref}>
                <Phone size={14} /> {organization.phone}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <OrganizationClient organization={organization} locations={locations} directions={directions} />
    </div>
  );
}
