import { cache } from "react";
import type { OrgDirection } from "@/components/organization/OrganizationClient";
import { ApiError } from "@/lib/api";
import { fetchOrganizationFromApi, isApiEnabled } from "@/lib/api-server";
import { categories, organizations } from "@/lib/data";
import { getCity } from "@/lib/filters";
import type { Activity, Location, Organization } from "@/lib/types";
import { getOrganizationActivities, getOrganizationLocations } from "@/lib/utils";
import { readView } from "@/lib/session";

export interface OrganizationPageData {
  organization: Organization;
  locations: Location[];
  directions: OrgDirection[];
  /** Город первой точки — для подзаголовка; берём из данных, а не из mock-справочника. */
  primaryCity: string;
}

export type OrganizationPage =
  | { kind: "ok"; data: OrganizationPageData }
  | { kind: "notFound" }
  | { kind: "unavailable"; message: string };

/** Направления собираем из самих анкет: title направления бэкенд отдаёт в строке занятия. */
function directionsFrom(activities: Activity[]): OrgDirection[] {
  const bySlug = new Map<string, OrgDirection>();
  for (const activity of activities) {
    const slug = activity.categorySlug || "other";
    const existing = bySlug.get(slug);
    if (existing) {
      existing.activities.push(activity);
      continue;
    }
    bySlug.set(slug, {
      categorySlug: slug,
      title: activity.categoryTitle ?? "Другое",
      activities: [activity],
    });
  }
  return [...bySlug.values()];
}

function cityOf(locations: Location[], organization: Organization): string {
  const first = locations[0];
  if (first?.cityTitle) return first.cityTitle;
  if (organization.city) return organization.city;
  if (first) return getCity(first.citySlug)?.title ?? "Приднестровье";
  return "Приднестровье";
}

/**
 * Страница организации (§6).
 *
 * Источник выбирается по тем же правилам, что и каталог: есть адрес бэкенда —
 * канонический `GET /api/v1/organizations/{slug}`; нет — моки только
 * тестировщику. Запрос с адресом, но без ответа — ошибка, а не подставные
 * анкеты.
 */
export const loadOrganizationPage = cache(
  async (slug: string): Promise<OrganizationPage> => {
    const { mode } = await readView();
    const demo = mode === "demo";
    if (isApiEnabled()) {
      try {
        const page = await fetchOrganizationFromApi(slug);
        return {
          kind: "ok",
          data: {
            organization: page.organization,
            locations: page.locations,
            directions: directionsFrom(page.activities),
            primaryCity: cityOf(page.locations, page.organization),
          },
        };
      } catch (error) {
        if (!demo) {
          if (error instanceof ApiError && error.status === 404) return { kind: "notFound" };
          if (error instanceof ApiError) return { kind: "unavailable", message: error.message };
          throw error;
        }
        // Демо: бэкенд может не знать этой организации, а тестировщику раздел
        // нужен — показываем образец (§6).
      }
    } else if (!demo) {
      return {
        kind: "unavailable",
        message:
          "Данные недоступны: на сервере не задан адрес бэкенда (NEXT_PUBLIC_API_URL). " +
          "Показать примеры можно только тестировщику.",
      };
    }

    const organization = organizations.find((item) => item.slug === slug);
    if (!organization) return { kind: "notFound" };
    const activityList = getOrganizationActivities(organization.slug);
    const locations = getOrganizationLocations(organization.slug);
    return {
      kind: "ok",
      data: {
        organization,
        locations,
        directions: directionsFrom(activityList).map((direction) => ({
          ...direction,
          title:
            categories.find((item) => item.slug === direction.categorySlug)?.title ?? direction.title,
        })),
        primaryCity: cityOf(locations, organization),
      },
    };
  },
);
