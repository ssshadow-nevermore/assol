import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://assol-salon.ru"),
  title: "Салон красоты Ассоль в Пушкино — стрижки, окрашивание, маникюр",
  description: "Салон красоты Ассоль в Пушкино на Московском проспекте, 44. Стрижки, окрашивание, маникюр, педикюр, брови, депиляция и массаж. Онлайн-запись.",
  keywords: ["салон красоты Пушкино", "парикмахерская Пушкино", "маникюр Пушкино", "окрашивание волос Пушкино", "Ассоль салон красоты"],
  openGraph: { title: "Ассоль — салон красоты в Пушкино", description: "Стрижки, окрашивание и уход. Услуги, цены и онлайн-запись.", locale: "ru_RU", type: "website", images: [{ url: "/og-mosaic.png", width: 1200, height: 630, alt: "Ассоль — салон красоты в Пушкино" }] },
  twitter: { card: "summary_large_image", title: "Ассоль — салон красоты в Пушкино", description: "Стрижки, окрашивание и уход.", images: ["/og-mosaic.png"] },
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><head><link href="https://db.onlinewebfonts.com/c/1cd1e7d71e048159076fd90b39846902?family=Open+Sauce+One" rel="stylesheet" /><link href="https://db.onlinewebfonts.com/c/42acf9aa4a6dc2f2886a3f682e337ead?family=Open+Sauce+One+Bold" rel="stylesheet" /></head><body>{children}</body></html>;
}
