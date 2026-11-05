import path from "node:path";
import type { NextConfig } from "next";
import { mediaProxyTarget } from "./src/lib/media";

// photos бэкенда — относительные /media/…; проксируем их на origin Go-сервиса,
// чтобы /media/… стал тем же origin, что и сайт, и next/image работал без
// remotePatterns. Префикс /media специфичен: /_next/static и /api/auth не
// задевает, а flat-форма rewrites идёт после проверки public/** — моки дизайнера
// в public/images продолжают отдаваться с диска.
const mediaDestination = mediaProxyTarget(process.env.NEXT_PUBLIC_API_URL);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Индикатор Next.js («N» с Turbopack-спиралью) в левом нижнем углу — только
  // для dev; на прод-сборке его нет. Ошибки компиляции и рантайма он не скрывает.
  devIndicators: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    // Пустой массив, когда NEXT_PUBLIC_API_URL не задан: локальная разработка
    // без бэкенда не должна падать на мёртвом прокси.
    return mediaDestination ? [{ source: "/media/:path*", destination: mediaDestination }] : [];
  },
};

export default nextConfig;
