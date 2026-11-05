import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-url";

// Тот же источник адреса, что у metadataBase и sitemap: три файла должны
// называть один и тот же origin.
const siteUrl = siteOrigin();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Кабинеты и избранное анониму не показывают ничего, но в RSC-потоке их
      // HTML уже содержит чужие анкеты и очереди — в индексе этим делать нечего.
      disallow: ["/account", "/moderation", "/favorites", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    // Host по стандарту Яндекса — голый хост без схемы и порта-https; берём его
    // из того же NEXT_PUBLIC_SITE_URL, что и sitemap.
    host: new URL(siteUrl).host,
  };
}
