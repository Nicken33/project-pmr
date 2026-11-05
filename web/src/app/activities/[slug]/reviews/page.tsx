import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { ReviewsBlock } from "@/components/activity/ReviewsBlock";
import { loadActivityPage } from "@/lib/activity-page";

/**
 * Страница отзывов карточки.
 *
 * Данные те же, что у самой карточки (`loadActivityPage`), а `dynamicParams =
 * false` отсюда убран: канонический слаг нельзя перечислить на этапе сборки, и
 * со сборкой он превращался в 404 прямо из работающей карточки.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadActivityPage(slug);
  if (!data) return { title: "Занятие не найдено" };
  const { activity } = data;
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
  const data = await loadActivityPage(slug);
  if (!data) notFound();
  const { activity, organization } = data;

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
          {activity.kind === "service" ? "услуга" : "занятие"}. Отзыв остаётся в вашем браузере:
          сервера приёма отзывов ещё нет, поэтому модератор его не видит.
        </p>
      </header>

      <ReviewsBlock activity={activity} />

      <div className="reviewsPageFoot">
        <Link href={`/activities/${activity.slug}`} className="btn btn--soft">
          <ArrowLeft size={16} /> Вернуться к карточке
        </Link>
        <p>
          Сохранённый отзыв можно убрать или переписать — это тоже состояние вашего браузера.
          Модерация отзывов появится вместе с сервером приёма.
        </p>
      </div>
    </div>
  );
}
