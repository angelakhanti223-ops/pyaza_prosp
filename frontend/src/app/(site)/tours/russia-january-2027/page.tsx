import type { Metadata } from "next";
import Link from "next/link";
import JanuaryTours from "@/components/tours/JanuaryTours";

const title = "Туры по России в январе 2027 — программы и цены на двоих | Слетать.ру";
const description = "30 экскурсионных туров в Санкт-Петербург, Карелию, на Байкал и в Калининград. Даты января 2027, программы, цены на двоих и отдельный ориентир по перелёту из Москвы.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/tours/russia-january-2027" },
  openGraph: { title, description, url: "/tours/russia-january-2027", type: "website", locale: "ru_RU" },
};

export default function JanuaryToursPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-blue-light to-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav aria-label="Хлебные крошки" className="mb-8 flex flex-wrap gap-2 text-xs text-navy/60">
            <Link href="/" className="hover:underline">Главная</Link><span aria-hidden="true">/</span>
            <Link href="/tours" className="hover:underline">Туры</Link><span aria-hidden="true">/</span>
            <span aria-current="page">Россия · январь 2027</span>
          </nav>
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-blue">Зимние путешествия · январь 2027</p>
              <h1 className="max-w-3xl text-3xl font-bold leading-tight text-navy sm:text-5xl">Откройте Россию этой зимой</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-foreground/70 sm:text-base">Дворцы Петербурга, зимний Байкал, карельские леса и города Балтики. Выберите маршрут и даты — мы уточним наличие мест и поможем организовать поездку.</p>
            </div>
            <aside className="rounded-3xl border border-gold/30 bg-cream p-6 sm:p-8">
              <p className="text-3xl font-bold text-navy">30 программ</p>
              <p className="mt-3 text-sm leading-6 text-foreground/70">На 4–7 ночей, для двух взрослых. Стоимость тура и ориентир по перелёту из Москвы показаны отдельно.</p>
              <p className="mt-4 text-xs leading-5 text-foreground/55">Цены из подборки от 23–24 октября 2026 года. Перед бронированием подтвердим стоимость и условия.</p>
            </aside>
          </div>
        </div>
      </section>
      <JanuaryTours />
    </div>
  );
}
