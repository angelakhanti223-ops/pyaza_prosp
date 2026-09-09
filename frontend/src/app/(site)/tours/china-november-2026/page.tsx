import type { Metadata } from "next";
import ChinaNovember2026 from "@/components/tours/ChinaNovember2026";

export const metadata: Metadata = {
  title: "Китай с ноября 2026 — туры на двоих | Слетать.ру",
  description:
    "15 туров по Китаю с ноября 2026: Пекин, Шанхай, горы Аватара, Гуйлинь, Хайнань. Реальные операторы (Space Travel, ITM group, PAC GROUP), цены за двух взрослых, подробная программа по дням.",
};

export default function ChinaNovember2026Page() {
  return <ChinaNovember2026 />;
}
