/**
 * Базовый адрес витрины для metadataBase, robots.txt и sitemap.xml.
 *
 * Выдуманного домена в фолбэке нет: несуществующий origin в SEO-файлах — это
 * обещание, которого не существует. Если NEXT_PUBLIC_SITE_URL не задан, берём
 * адрес, который дал сам хостинг (Vercel), а на локальной сборке — localhost.
 */

function stripSlashes(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function withScheme(value: string): string {
  const bare = stripSlashes(value);
  if (!bare) return "";
  return /^https?:\/\//i.test(bare) ? bare : `https://${bare}`;
}

export function siteOrigin(env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const explicit = withScheme(env.NEXT_PUBLIC_SITE_URL ?? "");
  if (explicit) return explicit;

  const hosted = withScheme(
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
      env.NEXT_PUBLIC_VERCEL_URL ??
      env.VERCEL_URL ??
      "",
  );
  if (hosted) return hosted;

  return "http://localhost:3000";
}
