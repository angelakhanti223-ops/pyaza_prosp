import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { LeadFormProvider } from "@/components/lead-form/LeadFormContext";
import LeadFormModal from "@/components/lead-form/LeadFormModal";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Слетать.ру — сеть туристических агентств",
  description:
    "Подберём путешествие под ваш бюджет и стиль отдыха. Пляжный отдых, экскурсионные туры, круизы и авторские маршруты. Более 90 000 счастливых путешественников доверяют нам свой отдых.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-foreground">
        <LeadFormProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <LeadFormModal />
        </LeadFormProvider>
      </body>
    </html>
  );
}
