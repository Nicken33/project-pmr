import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-url";

// Тот же источник адреса, что у metadataBase и robots.
const siteUrl = siteOrigin();

/**
 * Статическая часть витрины: только страницы, которые реально существуют и
 * открыты анониму.
 *
 * Не попали сюда: `/offline` (страница сама просит `robots: { index: false }`),
 * `/login` и `/register` (формы с `?next=`, не контент), слаги занятий и
 * организаций — они приходят из базы, на сборке их нет, а `force-dynamic`
 * обход в sitemap не отдаёт.
 */
const publicPaths: Array<[string, number]> = [
  ["/", 1],
  ["/map", 0.9],
  ["/request", 0.7],
  ["/about", 0.5],
  ["/rules", 0.3],
  ["/privacy", 0.2],
  ["/terms", 0.2],
];

export default function sitemap(): MetadataRoute.Sitemap {
  // lastMod намеренно нет: дата сборки не равна дате правки текста, а
  // выдуманный lastmod поисковики читают как свежесть.
  return publicPaths.map(([path, priority]) => ({
    url: `${siteUrl}${path}`,
    priority,
  }));
}
