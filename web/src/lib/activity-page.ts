import { cache } from "react";
import { ApiError } from "@/lib/api";
import { fetchActivityFromApi, isApiEnabled } from "@/lib/api-server";
import { activities, categories, superCategories } from "@/lib/data";
import { getActivityBySlug } from "@/lib/filters";
import type { Activity, Organization } from "@/lib/types";
import { getOrganization } from "@/lib/utils";

export interface ActivityPageData {
  activity: Activity;
  organization: Organization;
  similar: Activity[];
  categoryTitle: string;
  superTitle: string;
}

/**
 * Данные карточки занятия — общие для самой страницы и для её отзывов.
 *
 * Слаг приходит из бэкенда, поэтому ни `generateStaticParams`, ни
 * `dynamicParams = false`: с ними канонический `tiraspol-studiya-palitra`
 * отвечал 404. `cache()` даёт `generateMetadata` и рендеру один запрос вместо
 * двух. Моки — только когда адрес бэкенда не задан вовсе (§6).
 */
export const loadActivityPage = cache(
  async (slug: string): Promise<ActivityPageData | null> => {
    if (isApiEnabled()) {
      try {
        const page = await fetchActivityFromApi(slug);
        if (!page.organization) return null;
        return {
          activity: page.activity,
          organization: page.organization,
          similar: page.similar,
          categoryTitle: page.categoryTitle || "Другое",
          superTitle: page.superTitle || "Занятия",
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }

    const activity = getActivityBySlug(slug);
    const organization = activity ? getOrganization(activity.organizationSlug) : undefined;
    if (!activity || !organization) return null;
    const similar = activities
      .filter(
        (item) =>
          item.slug !== activity.slug &&
          (item.superSlug === activity.superSlug || item.categorySlug === activity.categorySlug),
      )
      .sort((a, b) => b.votesPlus - a.votesPlus)
      .slice(0, 6);
    return {
      activity,
      organization,
      similar,
      categoryTitle: categories.find((item) => item.slug === activity.categorySlug)?.title ?? "Другое",
      superTitle: superCategories.find((item) => item.slug === activity.superSlug)?.shortTitle ?? "Занятия",
    };
  },
);
