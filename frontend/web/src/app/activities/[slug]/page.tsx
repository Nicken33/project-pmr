import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityDetail } from "@/components/activity/ActivityDetail";
import type { Activity } from "@/lib/types";
import { formatAge, formatPrice, getCity } from "@/lib/filters";
import { loadActivityPage } from "@/lib/activity-page";

export const dynamic = "force-dynamic";

/**
 * Карточка занятия.
 *
 * Данные берёт `loadActivityPage` — он же отдаёт их странице отзывов, поэтому
 * канонический слаг не превращается в 404 на середине пути.
 */
function activitySummary(activity: Activity) {
  const group = activity.groups[activity.featuredGroupIndex ?? 0] ?? activity.groups[0];
  const location =
    activity.locations.find((item) => item.id === activity.featuredLocationId) ??
    activity.locations.find((item) => item.id === group?.locationId) ??
    activity.locations[0];
  // Название точки бэкенд отдаёт текстом рядом со слагом, и справочник витрины
  // здесь fallback, а не источник правды.
  const place = location ? (location.cityTitle ?? getCity(location.citySlug)?.title ?? "") : "";
  const parts = [
    group ? formatAge(group) : "",
    group ? formatPrice(group) : "",
    place,
  ].filter(Boolean);
  return parts.join(" · ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadActivityPage(slug);
  if (!data) return { title: "Занятие не найдено" };
  const { activity, organization, categoryTitle } = data;
  const summary = activitySummary(activity);
  const description = [
    summary ? `${summary}.` : "",
    activity.shortDescription ?? activity.description,
    organization.name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const image = activity.photos[0];
  return {
    title: activity.title,
    description,
    alternates: { canonical: `/activities/${activity.slug}` },
    openGraph: {
      type: "article",
      title: `${activity.title} — ${summary || organization.name || "Talentro"}`,
      description,
      url: `/activities/${activity.slug}`,
      ...(image ? { images: [{ url: image, alt: activity.title, width: 1200, height: 630 }] } : {}),
    },
    ...(image
      ? {
          twitter: {
            card: "summary_large_image" as const,
            title: activity.title,
            description,
            images: [image],
          },
        }
      : {}),
    keywords: [activity.title, categoryTitle, "занятия", "Приднестровье"].filter(Boolean),
  };
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await loadActivityPage(slug);
  if (!data) notFound();
  const { activity, organization, similar, categoryTitle, superTitle } = data;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": activity.kind === "service" ? "LocalBusiness" : "SportsActivityLocation",
    name: activity.title,
    description: activity.description,
    ...(activity.photos.length ? { image: activity.photos } : {}),
    ...(organization.phone ? { telephone: organization.phone } : {}),
    url: `/activities/${activity.slug}`,
    address: activity.locations.map((location) => ({
      "@type": "PostalAddress",
      streetAddress: location.address,
      addressLocality: location.cityTitle ?? location.citySlug,
      addressCountry: "MD",
    })),
    // ТЗ 10.2: звёздных рейтингов нет — поэтому aggregateRating не публикуем.
  };

  const requestedGroup = typeof query.group === "string" ? query.group : undefined;
  const requestedLocation = typeof query.location === "string" ? query.location : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ActivityDetail
        activity={activity}
        organization={organization}
        categoryTitle={categoryTitle}
        superTitle={superTitle}
        similar={similar}
        initialGroupId={activity.groups.some((group) => group.id === requestedGroup)
          ? requestedGroup
          : undefined}
        initialLocationId={activity.locations.some((item) => item.id === requestedLocation)
          ? requestedLocation
          : undefined}
      />
    </>
  );
}
