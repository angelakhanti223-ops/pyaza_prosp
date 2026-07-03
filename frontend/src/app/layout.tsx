import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Слетать.ру — туристическое агентство в Пензе | Туры, путёвки, круизы",
    template: "%s",
  },
  description:
    "Слетать.ру — туристическое агентство в Пензе с опытом более 20 лет. Подбираем туры и путёвки по России и за рубежом: пляжный отдых, горящие туры, экскурсионные программы, семейные поездки и круизы. Онлайн-заявка, поддержка на всех этапах поездки, более 90 000 довольных клиентов.",
  keywords: [
    "туристическое агентство Пенза",
    "турагентство Пенза",
    "туры Пенза",
    "горящие туры",
    "путёвки",
    "пляжный отдых",
    "экскурсионные туры",
    "круизы",
    "семейный отдых",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-foreground">
        {children}
      </body>
    </html>
  );
}
