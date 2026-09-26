"use client";

import { use } from "react";
import { fetchSeaHotel } from "@/lib/seaKbApi";
import { useSea } from "@/components/sea-kb/useSea";
import {
  Bullets,
  Card,
  ContactCard,
  Crumbs,
  Loading,
  NeedsCheck,
  PerkGroupView,
  PhotoGallery,
  Stars,
  Text,
} from "@/components/sea-kb/parts";

const STATUS: Record<string, string> = { soft_opening: "Софт-опенинг", opening_soon: "Скоро открытие" };

export default function SeaHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: h, error } = useSea(`hotel:${id}`, () => fetchSeaHotel(id));
  if (!h) return <Loading error={error} />;

  const hc = h.hotel_contacts ? Object.entries(h.hotel_contacts).filter(([, v]) => v) : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Crumbs
          items={[
            { label: "База ЮВА", href: "/crm/kb/sea" },
            { label: h.country_name, href: `/crm/kb/sea/countries/${h.country}` },
            { label: h.destination_name, href: `/crm/kb/sea/destinations/${h.destination}` },
            { label: h.name },
          ]}
        />
        <h1 className="text-2xl font-bold text-navy">
          {h.name} <Stars value={h.stars} />
        </h1>
        <p className="text-sm text-foreground/50">
          {[h.brand, h.category, h.area, h.status && STATUS[h.status]].filter(Boolean).join(" · ")}
        </p>
      </div>

      <NeedsCheck items={h.needs_check} />

      {h.photos && h.photos.length > 0 && (
        <Card title="Галерея">
          <PhotoGallery photos={h.photos} />
        </Card>
      )}

      <Card title="Об отеле">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Text label="Позиционирование" value={h.positioning} />
          <Text label="Расположение" value={h.location} />
          <Text label="Трансфер из аэропорта" value={h.airport_transfer} />
          <Text label="Пляж" value={h.beach} />
          <Text label="Открытие" value={h.opened} />
          <Text label="Реновация" value={h.renovation} />
          <Text label="Всего номеров" value={h.rooms_total} />
          <Text label="Дети" value={h.kids} />
          <Text label="СПА и wellness" value={h.spa_wellness} />
        </div>
        {h.for_whom && h.for_whom.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {h.for_whom.map((w) => (
              <span key={w} className="rounded-full bg-blue-light px-2.5 py-1 text-xs text-navy">
                {w}
              </span>
            ))}
          </div>
        )}
      </Card>

      {h.rooms && h.rooms.length > 0 && (
        <Card title="Номера">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-foreground/40">
                  <th className="py-2 pr-3">Категория</th>
                  <th className="py-2 pr-3">м²</th>
                  <th className="py-2 pr-3">Гостей</th>
                  <th className="py-2 pr-3">Кол-во</th>
                  <th className="py-2">Примечания</th>
                </tr>
              </thead>
              <tbody>
                {h.rooms.map((r, i) => (
                  <tr key={i} className="border-b border-black/5 align-top">
                    <td className="py-2 pr-3 font-medium text-navy">{r.name}</td>
                    <td className="py-2 pr-3">{r.size_sqm ?? "—"}</td>
                    <td className="py-2 pr-3">{r.max_occupancy ?? "—"}</td>
                    <td className="py-2 pr-3">{r.count ?? "—"}</td>
                    <td className="py-2 text-foreground/70">{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(h.meal_plans?.length || h.food?.restaurants?.length || h.food?.notes) && (
        <Card title="Питание">
          <div className="flex flex-col gap-3">
            {h.meal_plans && h.meal_plans.length > 0 && <Text label="Типы питания" value={h.meal_plans.join(", ")} />}
            <Text label="" value={h.food?.notes} />
            {h.food?.restaurants && h.food.restaurants.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
                {h.food.restaurants.map((r, i) => (
                  <li key={i}>
                    <span className="font-semibold text-navy">{r.name}</span>
                    {r.cuisine && <span className="text-foreground/50"> · {r.cuisine}</span>}
                    {r.notes && <span> — {r.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {h.highlights && h.highlights.length > 0 && (
        <Card title="Фишки">
          <Bullets items={h.highlights} />
        </Card>
      )}
      {h.infrastructure && h.infrastructure.length > 0 && (
        <Card title="Инфраструктура">
          <Bullets items={h.infrastructure} />
        </Card>
      )}

      {((h.pros && h.pros.length > 0) || (h.cons && h.cons.length > 0)) && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card title="Плюсы">
            <Bullets items={h.pros} tone="pro" />
          </Card>
          <Card title="Минусы">
            <Bullets items={h.cons} tone="con" />
          </Card>
        </div>
      )}

      {h.deposit && (
        <Card title="Депозит">
          <p className="whitespace-pre-line text-sm text-foreground/80">{h.deposit}</p>
        </Card>
      )}
      {h.sales_tips && h.sales_tips.length > 0 && (
        <Card title="Советы по продаже" className="border-gold/40 bg-gold/5">
          <Bullets items={h.sales_tips} />
        </Card>
      )}
      {h.special_offers && h.special_offers.length > 0 && (
        <Card title="Спецпредложения">
          <Bullets items={h.special_offers} />
        </Card>
      )}

      {(h.agent_perks || (h.agent_programs && h.agent_programs.length > 0)) && (
        <Card title={`Бонусы агенту${h.agent_perks ? ` — ${h.agent_perks.network}` : ""}`} className="border-gold/40">
          {h.agent_programs && h.agent_programs.length > 0 && (
            <div className="mb-3">
              <Bullets items={h.agent_programs} />
            </div>
          )}
          {h.agent_perks && <PerkGroupView group={h.agent_perks} showHotels />}
        </Card>
      )}

      {(h.contact_objects.length > 0 || hc.length > 0) && (
        <Card title="Контакты">
          {hc.length > 0 && (
            <div className="mb-3 flex flex-col gap-1 text-sm text-foreground/80">
              {hc.map(([k, v]) => (
                <p key={k}>
                  <span className="text-foreground/50">{k}: </span>
                  {v}
                </p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {h.contact_objects.map((c) => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
        </Card>
      )}

      {h.sources && h.sources.length > 0 && (
        <p className="text-[11px] text-foreground/40">Источники: {h.sources.join("; ")}</p>
      )}
    </div>
  );
}
