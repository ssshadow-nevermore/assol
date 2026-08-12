import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Запись в салон — Ассоль",
  description: "Выберите услугу, мастера, удобные дату и время для записи в салон красоты Ассоль в Пушкино.",
  alternates: { canonical: "/booking" },
};

export default function BookingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
