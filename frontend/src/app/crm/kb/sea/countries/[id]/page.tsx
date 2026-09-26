"use client";

import { use } from "react";
import Link from "next/link";
import { fetchSeaCountry, seaPhotoUrl, type SeaPhoto } from "@/lib/seaKbApi";
import { useSea } from "@/components/sea-kb/useSea";
import { Bullets, Card, Crumbs, Loading, PhotoGallery, SeasonTable, Text, toList } from "@/components/sea-kb/parts";

export default function SeaCountryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: c, error } = useSea(`country:${id}`, () => fetchSeaCountry(id));
  if (!c) return <Loading error={error} />;

  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : undefined);
  const arr = (k: string) => (Array.isArray(c[k]) ? toList(c[k] as string[]).filter((x) => typeof x === "string") : []);
  const photos = (c.photos ?? []) as SeaPhoto[];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Crumbs items={[{ label: "База ЮВА", href: "/crm/kb/sea" }, { label: c.name }]} />
        <h1 className="text-2xl font-bold text-navy">{c.name}</h1>
      </div>

      <Card title="Обзор">
        <div className="flex flex-col gap-3">
          <Text label="" value={c.overview} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Text label="Валюта" value={c.currency} />
            <Text label="Разница во времени" value={str("time_difference")} />
            <Text label="Перелёт" value={c.flights} />
          </div>
        </div>
      </Card>

      {arr("entry_rules").length > 0 && (
        <Card title="Правила въезда">
          <Bullets items={arr("entry_rules")} />
        </Card>
      )}
      {arr("important").length > 0 && (
        <Card title="Важно знать">
          <Bullets items={arr("important")} />
        </Card>
      )}

      <Card title="Сезонность по направлениям">
        <div className="flex flex-col gap-5">
          {c.destinations.map((d, i) => (
            <div key={d.id}>
              <Link href={`/crm/kb/sea/destinations/${d.id}`} className="mb-1 inline-block text-sm font-semibold text-blue hover:underline">
                {d.name}
              </Link>
              <SeasonTable seasonality={d.seasonality} showLegend={i === c.destinations.length - 1} />
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">Направления</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.destinations.map((d) => (
            <Link
              key={d.id}
              href={`/crm/kb/sea/destinations/${d.id}`}
              className="overflow-hidden rounded-2xl border border-black/5 bg-white transition-shadow hover:shadow-md"
            >
              <div className="aspect-[16/9] bg-blue-light">
                {d.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seaPhotoUrl(d.photo)} alt={d.name} loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-navy">{d.name}</h3>
                <p className="text-xs text-foreground/50">
                  {[d.type, d.hotels_count ? `${d.hotels_count} отелей в базе` : null].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1.5 line-clamp-3 text-xs text-foreground/70">{d.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {arr("events").length > 0 && (
        <Card title="События и праздники">
          <Bullets items={arr("events")} />
        </Card>
      )}
      {arr("combos").length > 0 && (
        <Card title="Комбинации">
          <Bullets items={arr("combos")} />
        </Card>
      )}
      {photos.length > 0 && (
        <Card title="Фото">
          <PhotoGallery photos={photos} />
        </Card>
      )}
    </div>
  );
}
