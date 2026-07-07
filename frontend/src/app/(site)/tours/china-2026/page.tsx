import type { Metadata } from "next";
import ChinaTours2026 from "@/components/tours/ChinaTours2026";

export const metadata: Metadata = {
  title: "Туры в Китай 2026 — подборка от Слетать.ру",
  description:
    "10 авторских маршрутов по Китаю на 2026 год: Пекин, Шанхай, горы Аватара, панды, Гуйлинь, Гонконг, пляжный Хайнань. Цены от $917, подбор под ваши даты.",
};

export default function ChinaTours2026Page() {
  return <ChinaTours2026 />;
}
