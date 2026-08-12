import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://assol-salon.ru"),
  title: "Салон красоты Ассоль в Пушкино — стрижки, окрашивание, маникюр",
  description: "Салон красоты Ассоль в Пушкино на Московском проспекте, 44. Стрижки, окрашивание, маникюр, педикюр, брови, депиляция и массаж. Онлайн-запись.",
  keywords: ["салон красоты Пушкино", "парикмахерская Пушкино", "маникюр Пушкино", "окрашивание волос Пушкино", "Ассоль салон красоты"],
  openGraph: { title: "Ассоль — салон красоты в Пушкино", description: "Красота, в которой вы — это вы. Услуги, цены и онлайн-запись.", locale: "ru_RU", type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ассоль — салон красоты в Пушкино" }] },
  twitter: { card: "summary_large_image", title: "Ассоль — салон красоты в Пушкино", description: "Красота, в которой вы — это вы.", images: ["/og.png"] },
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
