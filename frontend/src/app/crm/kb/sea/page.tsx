"use client";

import Link from "next/link";
import { fetchSeaOverview, seaPhotoUrl } from "@/lib/seaKbApi";
import { useSea } from "@/components/sea-kb/useSea";
import { Bullets, Card, Loading } from "@/components/sea-kb/parts";

export default function SeaKbHome() {
  const { data, error } = useSea("overview", fetchSeaOverview);
  if (!data) return <Loading error={error} />;
  const { meta, region, countries } = data;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">{meta.title ?? "База знаний ЮВА"}</h1>
        {meta.disclaimer && <p className="mt-1 text-xs text-foreground/50">{meta.disclaimer}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/crm/kb/sea/hotels" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark">
          Все отели и поиск
        </Link>
        <Link href="/crm/kb/sea/perks" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-gold-dark">
          Плюшки для агентов
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <Link
            key={c.id}
            href={`/crm/kb/sea/countries/${c.id}`}
            className="overflow-hidden rounded-2xl border border-black/5 bg-white transition-shadow hover:shadow-md"
          >
            <div className="aspect-[16/9] bg-blue-light">
              {c.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={seaPhotoUrl(c.photo)} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-4">
              <h2 className="text-lg font-bold text-navy">{c.name}</h2>
              <p className="text-xs text-foreground/50">
                {c.destinations_count} направлений · {c.hotels_count} отелей
              </p>
              <p className="mt-2 line-clamp-3 text-sm text-foreground/70">{c.overview}</p>
            </div>
          </Link>
        ))}
      </div>

      {region.overview && (
        <Card title="О регионе">
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">{region.overview}</p>
        </Card>
      )}
      {region.sales_accents && region.sales_accents.length > 0 && (
        <Card title="Акценты в продаже">
          <Bullets items={region.sales_accents} />
        </Card>
      )}
      {region.ready_tours && region.ready_tours.length > 0 && (
        <Card title="Готовые туры">
          <Bullets
            items={region.ready_tours.map((t) =>
              typeof t === "string" ? t : Object.values(t).filter(Boolean).join(" — "),
            )}
          />
        </Card>
      )}
      {region.agent_perks_note && <p className="text-xs text-foreground/50">{region.agent_perks_note}</p>}
    </div>
  );
}
