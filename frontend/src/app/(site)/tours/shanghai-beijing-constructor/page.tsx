import type { Metadata } from "next";
import ShanghaiBeijingConstructor from "@/components/tours/ShanghaiBeijingConstructor";

export const metadata: Metadata = {
  title: "Конструктор тура: Шанхай + Пекин | Слетать.ру",
  description:
    "Соберите индивидуальный тур Шанхай + Пекин на двоих: выберите перелёт, отели, поезд, трансферы и экскурсии — стоимость пересчитывается сразу.",
};

export default function ShanghaiBeijingConstructorPage() {
  return <ShanghaiBeijingConstructor />;
}
