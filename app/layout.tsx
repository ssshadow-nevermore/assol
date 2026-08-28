import type { Metadata } from "next";
import "./globals.css";
import { getSiteData } from "./site-data";

export const metadata: Metadata = {
  metadataBase: new URL("https://assolkrasota.ru"),
  title: "Салон красоты Ассоль в Пушкино — стрижки, окрашивание, маникюр",
  description: "Салон красоты Ассоль в Пушкино на Московском проспекте, 44. Стрижки, окрашивание, маникюр, педикюр, брови и депиляция. Онлайн-запись.",
  keywords: ["салон красоты Пушкино", "парикмахерская Пушкино", "маникюр Пушкино", "окрашивание волос Пушкино", "Ассоль салон красоты"],
  openGraph: { title: "Ассоль — салон красоты в Пушкино", description: "Красота, в которой вы — это вы. Услуги, цены и онлайн-запись.", locale: "ru_RU", type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ассоль — салон красоты в Пушкино" }] },
  twitter: { card: "summary_large_image", title: "Ассоль — салон красоты в Пушкино", description: "Красота, в которой вы — это вы.", images: ["/og.png"] },
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const siteData = await getSiteData();
  const dikidiScriptUrl = siteData.links.dikidi_script.url;
  return (
    <html lang="ru">
      <head>
        {/* DIKIDI binds the booking links during the initial page lifecycle. */}
        <script type="text/javascript" src={dikidiScriptUrl} defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
