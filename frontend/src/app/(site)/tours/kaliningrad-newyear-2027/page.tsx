import type { Metadata } from "next";
import KaliningradFamilyTours from "@/components/tours/kaliningrad/KaliningradFamilyTours";
const title="Калининград на Новый год 2027 — туры для семьи 2+1 | Слетать.ру";
const description="Новогодние каникулы в Калининграде на 6–7 ночей: 2 взрослых и ребёнок 9 лет. 14 вариантов дат и отелей, программы экскурсий и отдельный расчёт перелёта из Москвы, Саратова и Самары.";
export const metadata: Metadata={title,description,alternates:{canonical:"/tours/kaliningrad-newyear-2027"},openGraph:{title,description,url:"/tours/kaliningrad-newyear-2027",type:"website",locale:"ru_RU"}};
export default function KaliningradPage(){return <KaliningradFamilyTours/>;}
