import type { Metadata } from "next";
import "./globals.css";
import { DIKIDI_SCRIPT_URL } from "./dikidi";

export const metadata: Metadata = {
  metadataBase: new URL("https://assol-salon.ru"),
  title: "Салон красоты Ассоль в Пушкино — стрижки, окрашивание, маникюр",
  description: "Салон красоты Ассоль в Пушкино на Московском проспекте, 44. Стрижки, окрашивание, маникюр, педикюр, брови и депиляция. Онлайн-запись.",
  keywords: ["салон красоты Пушкино", "парикмахерская Пушкино", "маникюр Пушкино", "окрашивание волос Пушкино", "Ассоль салон красоты"],
  openGraph: { title: "Ассоль — салон красоты в Пушкино", description: "Красота, в которой вы — это вы. Услуги, цены и онлайн-запись.", locale: "ru_RU", type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ассоль — салон красоты в Пушкино" }] },
  twitter: { card: "summary_large_image", title: "Ассоль — салон красоты в Пушкино", description: "Красота, в которой вы — это вы.", images: ["/og.png"] },
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        {/* DIKIDI binds the booking links during the initial page lifecycle. */}
        <script type="text/javascript" src={DIKIDI_SCRIPT_URL} defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
