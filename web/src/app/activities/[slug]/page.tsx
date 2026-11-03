import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityDetail } from "@/components/activity/ActivityDetail";
import { activities, categories, superCategories } from "@/lib/data";
import { formatAge, formatPrice, getActivityBySlug, getCity, getDistrict } from "@/lib/filters";
import { getOrganization } from "@/lib/utils";

export function generateStaticParams() {
  return activities.map((activity) => ({ slug: activity.slug }));
}

export const dynamicParams = false;

function activitySummary(activity: (typeof activities)[number]) {
  const group = activity.groups[activity.featuredGroupIndex ?? 0] ?? activity.groups[0];
  const location =
    activity.locations.find((item) => item.id === activity.featuredLocationId) ??
    activity.locations.find((item) => item.id === group?.locationId) ??
    activity.locations[0];
  const parts = [
    group ? formatAge(group) : "",
    group ? formatPrice(group) : "",
    location ? getDistrict(location.districtSlug ?? "")?.title ?? getCity(location.citySlug)?.title ?? "" : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const activity = getActivityBySlug(slug);
  if (!activity) return { title: "Занятие не найдено" };
  const organization = getOrganization(activity.organizationSlug);
  const category = categories.find((item) => item.slug === activity.categorySlug);
  const summary = activitySummary(activity);
  const description = [
    summary ? `${summary}.` : "",
    activity.shortDescription ?? activity.description,
    organization?.name ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    title: activity.title,
    description,
    alternates: { canonical: `/activities/${activity.slug}` },
    openGraph: {
      type: "article",
      title: `${activity.title} — ${summary || organization?.name || "Talentro"}`,
      description,
      url: `/activities/${activity.slug}`,
      images: [{ url: activity.photos[0], alt: activity.title, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: activity.title,
      description,
      images: [activity.photos[0]],
    },
    keywords: [activity.title, category?.title ?? "", "занятия", "Приднестровье"].filter(Boolean),
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
  const activity = getActivityBySlug(slug);
  if (!activity) notFound();
  const organization = getOrganization(activity.organizationSlug);
  if (!organization) notFound();
  const category = categories.find((item) => item.slug === activity.categorySlug);
  const superCategory = superCategories.find((item) => item.slug === activity.superSlug);
  const requestedGroup = typeof query.group === "string" ? query.group : undefined;
  const requestedLocation = typeof query.location === "string" ? query.location : undefined;
  const similar = activities
    .filter(
      (item) =>
        item.slug !== activity.slug &&
        (item.superSlug === activity.superSlug || item.categorySlug === activity.categorySlug),
    )
    .sort((a, b) => b.votesPlus - a.votesPlus)
    .slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": activity.kind === "service" ? "LocalBusiness" : "SportsActivityLocation",
    name: activity.title,
    description: activity.description,
    image: activity.photos,
    telephone: organization.phone,
    url: `/activities/${activity.slug}`,
    address: activity.locations.map((location) => ({
      "@type": "PostalAddress",
      streetAddress: location.address,
      addressLocality: location.citySlug,
      addressCountry: "MD",
    })),
    // ТЗ 10.2: звёздных рейтингов нет — поэтому aggregateRating не публикуем.
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ActivityDetail
        activity={activity}
        organization={organization}
        categoryTitle={category?.title ?? "Другое"}
        superTitle={superCategory?.shortTitle ?? "Занятия"}
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
