import type { Metadata } from "next";
import ChinaTourConstructor from "@/components/tours/ChinaTourConstructor";

const URL = "https://flypenza.ru/tours/china-constructor";
export const metadata: Metadata = {
  title: "Рассчитать тур в Китай онлайн — конструктор путешествия | Слетать.ру",
  description: "Соберите маршрут по Китаю: Пекин, Шанхай, Хайнань, горы Аватар и Фуронг. Выберите отели, ночи и экскурсии и получите предварительный расчёт на двоих.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Ваш Китай. Ваш маршрут. — Слетать.ру",
    description: "Соберите путешествие в своём ритме и отправьте сборку на точный расчёт.",
    url: URL,
    images: [{ url: "/tours/china-constructor/beijing.jpg", alt: "Великая Китайская стена" }],
  },
};

export default function ChinaConstructorPage() {
  return <ChinaTourConstructor />;
}
