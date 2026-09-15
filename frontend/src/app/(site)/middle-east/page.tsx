import type { Metadata } from "next";
import MiddleEastDatabase from "@/components/middle-east/MiddleEastDatabase";
import { fetchAirlines, fetchCountries, fetchHotels, fetchMideastMeta, fetchWebinars } from "@/lib/mideastApi";

export const metadata: Metadata = {
  title: "База отелей Ближнего Востока — Слетать.ру",
  description:
    "140 отелей ОАЭ, Катара, Бахрейна, Саудовской Аравии и Омана с фото, фильтрами по пляжу/спа/детям/всё включено, страноведческими досье и обзором авиакомпаний направления.",
};

export default async function MiddleEastPage() {
  const [hotels, countries, airlines, webinars, meta] = await Promise.all([
    fetchHotels(),
    fetchCountries(),
    fetchAirlines(),
    fetchWebinars(),
    fetchMideastMeta(),
  ]);

  return (
    <MiddleEastDatabase hotels={hotels} countries={countries} airlines={airlines} webinars={webinars} meta={meta} />
  );
}
