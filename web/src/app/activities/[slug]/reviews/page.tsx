import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { ReviewsBlock } from "@/components/activity/ReviewsBlock";
import { activities } from "@/lib/data";
import { getActivityBySlug } from "@/lib/filters";
import { getOrganization } from "@/lib/utils";

export function generateStaticParams() {
  return activities.map((activity) => ({ slug: activity.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const activity = getActivityBySlug(slug);
  if (!activity) return { title: "Занятие не найдено" };
  const count = activity.reviews.length;
  return {
    title: `Отзывы (${count}): ${activity.title}`,
    description:
      count > 0
        ? `Все отзывы посетителей: ${activity.title} — ${activity.shortDescription ?? activity.description}`
        : `Отзывов пока нет. Поделитесь опытом: ${activity.title}.`,
    alternates: { canonical: `/activities/${activity.slug}/reviews` },
  };
}

export default async function ActivityReviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const activity = getActivityBySlug(slug);
  if (!activity) notFound();
  const organization = getOrganization(activity.organizationSlug);
  if (!organization) notFound();

  return (
    <div className="reviewsPage container">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">
          <ArrowLeft size={14} /> Каталог
        </Link>
        <span>/</span>
        <Link href={`/activities/${activity.slug}`}>{activity.title}</Link>
      </nav>

      <header className="reviewsPageHead">
        <span className="eyebrow">
          <MessageCircle size={13} /> Мнения посетителей
        </span>
        <h1>
          Отзывы ({activity.reviews.length}) — {activity.title}
        </h1>
        <p>
          <Link href={`/organizations/${organization.slug}`}>{organization.name}</Link> ·{" "}
          {activity.kind === "service" ? "услуга" : "занятие"} без предварительной модерации отзывов: автор
          публикуется сразу, жалоба уходит модератору.
        </p>
      </header>

      <ReviewsBlock activity={activity} />

      <div className="reviewsPageFoot">
        <Link href={`/activities/${activity.slug}`} className="btn btn--soft">
          <ArrowLeft size={16} /> Вернуться к карточке
        </Link>
        <p>
          Отзыв можно удалить или править самому автору; скрытый отзыв остаётся видимым только ему с
          причиной скрытия.
        </p>
      </div>
    </div>
  );
}
