import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Индикатор Next.js («N» с Turbopack-спиралью) в левом нижнем углу — только
  // для dev; на прод-сборке его нет. Ошибки компиляции и рантайма он не скрывает.
  devIndicators: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
