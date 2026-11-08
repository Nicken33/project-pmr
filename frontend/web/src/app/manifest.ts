import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Talentro — занятия и услуги Приднестровья",
    short_name: "Talentro",
    description:
      "Каталог секций, кружков, студий и услуг для детей и взрослых в Приднестровье.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f4ff",
    theme_color: "#6d48db",
    lang: "ru",
    dir: "ltr",
    categories: ["education", "lifestyle", "kids"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Каталог", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Карта", url: "/map", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      {
        name: "Избранное",
        url: "/favorites",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
