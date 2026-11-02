import type { Metadata } from "next";
import TravelHoroscope from "@/components/travel-horoscope/TravelHoroscope";

export const metadata: Metadata = {
  title: "Звёздный маршрут 2027 — прогноз путешествий по знаку зодиака | Слетать.ру",
  description: "Введите дату рождения и узнайте свой знак зодиака, идеи направлений и месяцы для путешествий в 2027 году. Подбор тура от Слетать.ру, Пенза.",
  alternates: { canonical: "/travel-horoscope-2027" },
};

export default function TravelHoroscopePage() {
  return <TravelHoroscope />;
}
