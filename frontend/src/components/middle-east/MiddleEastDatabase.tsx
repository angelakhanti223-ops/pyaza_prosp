"use client";

import { useState } from "react";
import type { Airline, Country, Hotel, MideastMeta, Webinar } from "@/lib/mideastApi";
import HotelsTab from "./HotelsTab";
import CountriesTab from "./CountriesTab";
import AirlinesTab from "./AirlinesTab";
import SourcesTab from "./SourcesTab";

type Props = {
  hotels: Hotel[];
  countries: Country[];
  airlines: Airline[];
  webinars: Webinar[];
  meta: MideastMeta;
};

type Tab = "hotels" | "countries" | "airlines" | "sources";

const TABS: { value: Tab; label: string }[] = [
  { value: "hotels", label: "Отели" },
  { value: "countries", label: "Страны" },
  { value: "airlines", label: "Авиакомпании" },
  { value: "sources", label: "Источники" },
];

export default function MiddleEastDatabase({ hotels, countries, airlines, webinars, meta }: Props) {
  const [tab, setTab] = useState<Tab>("hotels");

  return (
    <div>
      <section className="bg-gradient-to-b from-blue-light to-white">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-navy shadow-sm">
            База направления
          </span>
          <h1 className="mt-5 text-3xl font-bold text-navy sm:text-4xl">База отелей Ближнего Востока</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-foreground/70">
            {hotels.length} отелей ОАЭ, Катара, Бахрейна, Саудовской Аравии и Омана — с фото, фильтрами по пляжу,
            спа, детям и типу питания, плюс страноведческие досье и обзор авиакомпаний направления.
          </p>
          <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-3">
            <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-xl font-bold text-navy">{hotels.length}</p>
              <p className="mt-1 text-[11px] font-medium text-foreground/50">отелей в базе</p>
            </div>
            <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-xl font-bold text-navy">{countries.length}</p>
              <p className="mt-1 text-[11px] font-medium text-foreground/50">стран</p>
            </div>
            <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-xl font-bold text-navy">{airlines.length}</p>
              <p className="mt-1 text-[11px] font-medium text-foreground/50">авиакомпаний</p>
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.value ? "bg-navy text-white" : "text-navy/70 hover:bg-blue-light"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {tab === "hotels" && <HotelsTab hotels={hotels} />}
        {tab === "countries" && <CountriesTab countries={countries} />}
        {tab === "airlines" && <AirlinesTab airlines={airlines} />}
        {tab === "sources" && <SourcesTab webinars={webinars} meta={meta} />}
      </div>
    </div>
  );
}
