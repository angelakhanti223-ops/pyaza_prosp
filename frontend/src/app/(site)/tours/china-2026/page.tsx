import type { Metadata } from "next";
import ChinaTours2026 from "@/components/tours/ChinaTours2026";
export const metadata: Metadata = {
 title: "Экскурсионные туры в Китай — 51 маршрут | Слетать.ру",
 description: "Пекин, Шанхай, панды, горы Аватара и Хайнань. 51 маршрут с фотографиями и программами, 10 предложений с расчётом на двоих. Подбор под ваши даты.",
 alternates: { canonical: "/tours/china-november-2026" },
};
export default function ChinaToursPage() { return <ChinaTours2026 />; }
