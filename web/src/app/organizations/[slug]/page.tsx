import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, MapPin, Phone } from "lucide-react";
import { OrganizationClient, type OrgDirection } from "@/components/organization/OrganizationClient";
import { categories, organizations } from "@/lib/data";
import { getCity } from "@/lib/filters";
import {
  formatDateLong,
  getOrganizationActivities,
  getOrganizationLocations,
} from "@/lib/utils";

export function generateStaticParams() {
  return organizations.map((organization) => ({ slug: organization.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const organization = organizations.find((item) => item.slug === slug);
  if (!organization) return { title: "Организация не найдена" };
  const count = getOrganizationActivities(slug).length;
  const points = getOrganizationLocations(slug);
  const city = points.length ? getCity(points[0].citySlug)?.title : undefined;
  const description = `${organization.type} · ${count} ${
    count === 1 ? "анкета" : "анкет"
  }${city ? ` · ${city}` : ""}. ${organization.description}`;
  return {
    title: organization.name,
    description,
    alternates: { canonical: `/organizations/${organization.slug}` },
    openGraph: {
      title: organization.name,
      description,
      url: `/organizations/${organization.slug}`,
      images: organization.cover
        ? [{ url: organization.cover, alt: organization.name, width: 1200, height: 630 }]
        : undefined,
    },
  };
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = organizations.find((item) => item.slug === slug);
  if (!organization) notFound();

  const activityList = getOrganizationActivities(organization.slug);
  const locations = getOrganizationLocations(organization.slug);

  const directions: OrgDirection[] = categories
    .map((category) => ({
      categorySlug: category.slug,
      title: category.title,
      activities: activityList.filter((activity) => activity.categorySlug === category.slug),
    }))
    .filter((direction) => direction.activities.length);

  const primaryCity = locations.length ? getCity(locations[0].citySlug)?.title : "Приднестровье";

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
            <span className="badge badge--category">{organization.type}</span>
            {organization.verifiedAt ? (
              <span className="badge badge--verified">
                <BadgeCheck size={12} /> Проверено {formatDateLong(organization.verifiedAt)}
              </span>
            ) : (
              <span className="badge badge--warning">Данные не сверялись</span>
            )}
            {activityList.some((activity) => activity.kind === "service") ? (
              <span className="badge badge--service">Есть услуги</span>
            ) : null}
          </div>
          <h1>{organization.name}</h1>
          <p className="orgLead">{organization.description}</p>
          <div className="orgHeroMeta">
            <span>
              <MapPin size={14} /> {primaryCity}
              {locations.length > 1 ? `, ${locations.length} точек` : ""}
            </span>
            <span>
              <BadgeCheck size={14} /> {activityList.length}{" "}
              {activityList.length === 1 ? "анкета" : "анкет"} в каталоге
            </span>
            <a href={`tel:${organization.phone.replace(/[^\d+]/g, "")}`}>
              <Phone size={14} /> {organization.phone}
            </a>
          </div>
        </div>
      </header>

      <OrganizationClient organization={organization} locations={locations} directions={directions} />
    </div>
  );
}
