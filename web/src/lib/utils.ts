import { activities, applications, categories, organizations } from "@/lib/data";
import type { Activity, AgeGroup, Location, Organization } from "@/lib/types";

export function plural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

export function groupWord(n: number) {
  return plural(n, "группа", "группы", "групп");
}

export function addressWord(n: number) {
  return plural(n, "адрес", "адреса", "адресов");
}

export function reviewWord(n: number) {
  return plural(n, "отзыв", "отзыва", "отзывов");
}

export function formatDate(value: string | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateLong(value: string | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function formatRelative(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${plural(days, "день", "дня", "дней")} назад`;
  return formatDate(value);
}

export function getCategoryTitle(slug: string): string {
  return categories.find((category) => category.slug === slug)?.title ?? "Другое";
}

export function getSuperTitle(activity: Activity): string {
  const map: Record<string, string> = {
    tvorchestvo: "Творчество",
    sport: "Спорт",
    tech: "Технологии",
    education: "Обучение",
    nature: "Природа",
    travel: "Путешествия",
    practical: "Практика",
    social: "Сообщество",
    other: "Другое",
  };
  return map[activity.superSlug] ?? "Другое";
}

export function isFree(group?: AgeGroup) {
  return group?.priceFrom === 0;
}

export function ratingLabel(plus: number, minus: number): string {
  const total = plus + minus;
  if (total < 3) return "голосов нет";
  return `${plus} / ${minus}`;
}

export function voteScore(plus: number, minus: number) {
  return plus - minus;
}

/**
 * Цены всех групп занятия в одну строку.
 *
 * «Бесплатно» показываем только когда бесплатны все группы с известной ценой:
 * иначе zeroes выглядели бы как «всё даром». Если часть групп платные, а часть
 * бесплатные — пишем оба, это ровно то, что видно по данным (§3.1.4).
 */
export function priceRange(activity: Activity): string {
  const prices = activity.groups
    .map((group) => group.priceFrom)
    .filter((price): price is number => price !== null);
  if (!prices.length) return "";
  const paid = prices.filter((price) => price > 0);
  if (!paid.length) return "Бесплатно";
  const min = Math.min(...paid);
  const max = Math.max(...paid);
  if (prices.length !== paid.length) return `Бесплатно, платные от ${min} руб. ПМР`;
  return min === max ? `${min} руб. ПМР` : `${min}–${max} руб. ПМР`;
}

export function hhmm(time: string) {
  return time.replace(":", ":");
}

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const avatarColors = [
  "#8B5CF6",
  "#6366F1",
  "#EC4899",
  "#F59E0B",
  "#22C55E",
  "#0EA5E9",
  "#F43F5E",
  "#14B8A6",
];

export function colorFromString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Точки проведения организации: принадлежат ей, занятия только ссылаются на них (§7.11). */
export function getOrganizationLocations(organizationSlug: string): Location[] {
  const seen = new Map<string, Location>();
  for (const activity of activities) {
    if (activity.organizationSlug !== organizationSlug) continue;
    for (const location of activity.locations) {
      const existing = seen.get(location.id);
      if (!existing || (!existing.phone && location.phone)) seen.set(location.id, location);
    }
  }
  for (const application of applications) {
    if (application.organizationSlug !== organizationSlug) continue;
    if (application.status === "published") {
      for (const location of application.locations) {
        if (!seen.has(location.id)) seen.set(location.id, location);
      }
    }
  }
  return [...seen.values()];
}

export function getOrganizationActivities(organizationSlug: string): Activity[] {
  return activities.filter((activity) => activity.organizationSlug === organizationSlug);
}

export function getOrganization(organizationSlug: string | undefined): Organization | undefined {
  if (!organizationSlug) return undefined;
  return organizations.find((organization) => organization.slug === organizationSlug);
}

/** Срок ответа модератора — 2 рабочих дня (§3.9.5). Возвращает, сколько рабочих дней анкета ждёт. */
export function workingDaysWaiting(submittedAt?: string): number {
  if (!submittedAt) return 0;
  const from = new Date(submittedAt);
  if (Number.isNaN(from.getTime())) return 0;
  let days = 0;
  const cursor = new Date(from);
  const now = new Date();
  while (cursor < now) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}

export const MODERATION_SLA_DAYS = 2;

export const statusLabels: Record<string, string> = {
  draft: "Черновик",
  pending: "На проверке",
  published: "Опубликовано",
  rejected: "Отклонено",
};
