import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { Footer } from "@/components/layout/Footer";
import { Header, MobileTabBar } from "@/components/layout/Header";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://talentro.example";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Talentro — занятия и услуги Приднестровья",
    template: "%s — Talentro",
  },
  description:
    "Найдите секцию, кружок, студию или мастера рядом с домом. Каталог занятий и услуг Приднестровья с ценами, расписанием и картой.",
  applicationName: "Talentro",
  keywords: [
    "занятия",
    "секции",
    "кружки",
    "Тирасполь",
    "Бендеры",
    "Приднестровье",
    "каталог",
    "дети",
  ],
  authors: [{ name: "Talentro" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "Talentro",
    title: "Talentro — занятия и услуги Приднестровья",
    description:
      "Секции, кружки, услуги и хобби рядом с вами. Сравнивайте группы, цены и расписание.",
    images: [
      {
        url: "/brand/hero-illustration.png",
        width: 1920,
        height: 650,
        alt: "Talentro — твори, развивайся, открывай мир",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talentro — занятия и услуги Приднестровья",
    description: "Каталог секций, кружков и услуг рядом с домом.",
    images: ["/brand/hero-illustration.png"],
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icons/favicon-32.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Talentro",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#6d48db",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <a href="#main" className="skipLink">
          Перейти к содержимому
        </a>
        <div className="siteBackdrop" aria-hidden="true" />
        <AppProviders>
          <Header />
          <main id="main" className="siteMain">
            {children}
          </main>
          <Footer />
          <MobileTabBar />
          <ServiceWorkerRegister />
        </AppProviders>
      </body>
    </html>
  );
}
