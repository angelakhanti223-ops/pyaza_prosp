"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fetchSeaHotels } from "@/lib/seaKbApi";
import { useSea } from "@/components/sea-kb/useSea";
import { Crumbs, HotelCard, Loading } from "@/components/sea-kb/parts";

const selectCls = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm";

export default function SeaHotelsPage() {
  const { data, error } = useSea("hotels", fetchSeaHotels);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [destination, setDestination] = useState("");
  const [stars, setStars] = useState("");
  const [forWhom, setForWhom] = useState("");

  const options = useMemo(() => {
    const hotels = data ?? [];
    const countries = new Map<string, string>();
    const destinations = new Map<string, { name: string; country: string }>();
    const starSet = new Set<number>();
    const whom = new Set<string>();
    for (const h of hotels) {
      countries.set(h.country, h.country_name);
      destinations.set(h.destination, { name: h.destination_name, country: h.country });
      if (h.stars) starSet.add(h.stars);
      h.for_whom.forEach((w) => whom.add(w));
    }
    return {
      countries: [...countries],
      destinations: [...destinations].filter(([, d]) => !country || d.country === country),
      stars: [...starSet].sort((a, b) => b - a),
      whom: [...whom].sort(),
    };
  }, [data, country]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (h) =>
        (!country || h.country === country) &&
        (!destination || h.destination === destination) &&
        (!stars || String(h.stars) === stars) &&
        (!forWhom || h.for_whom.includes(forWhom)) &&
        (!needle || `${h.name} ${h.brand} ${h.area} ${h.positioning}`.toLowerCase().includes(needle)),
    );
  }, [data, q, country, destination, stars, forWhom]);

  if (!data) return <Loading error={error} />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Crumbs items={[{ label: "База ЮВА", href: "/crm/kb/sea" }, { label: "Отели" }]} />
        <h1 className="text-2xl font-bold text-navy">Отели ЮВА</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию, бренду, району…"
          className={`${selectCls} min-w-[240px] flex-1`}
        />
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setDestination("");
          }}
          className={selectCls}
        >
          <option value="">Все страны</option>
          {options.countries.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select value={destination} onChange={(e) => setDestination(e.target.value)} className={selectCls}>
          <option value="">Все направления</option>
          {options.destinations.map(([id, d]) => (
            <option key={id} value={id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={stars} onChange={(e) => setStars(e.target.value)} className={selectCls}>
          <option value="">Любые звёзды</option>
          {options.stars.map((s) => (
            <option key={s} value={String(s)}>
              {s}★
            </option>
          ))}
        </select>
        <select value={forWhom} onChange={(e) => setForWhom(e.target.value)} className={selectCls}>
          <option value="">Для кого: любые</option>
          {options.whom.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-foreground/50">
        Найдено: {filtered.length} из {data.length}.{" "}
        <Link href="/crm/kb/sea/perks" className="text-blue hover:underline">
          Плюшки для агентов
        </Link>
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground/50">Ничего не найдено.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((h) => (
            <HotelCard key={h.id} hotel={h} />
          ))}
        </div>
      )}
    </div>
  );
}
