import type { MetadataRoute } from "next";

// Копия паттерна из layout.tsx: тот же fallback, чтобы robots, sitemap и
// metadataBase не разъезжались, когда NEXT_PUBLIC_SITE_URL не задан.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://talentro.example").replace(
  /\/+$/,
  "",
);

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
