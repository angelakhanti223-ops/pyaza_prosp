"use client";

import { use } from "react";
import { fetchSeaDestination } from "@/lib/seaKbApi";
import { useSea } from "@/components/sea-kb/useSea";
import { Bullets, Card, Crumbs, HotelCard, Loading, PhotoGallery, SeasonTable, Text } from "@/components/sea-kb/parts";

export default function SeaDestinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: d, error } = useSea(`dest:${id}`, () => fetchSeaDestination(id));
  if (!d) return <Loading error={error} />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Crumbs
          items={[
            { label: "База ЮВА", href: "/crm/kb/sea" },
            { label: d.country_name, href: `/crm/kb/sea/countries/${d.country}` },
            { label: d.name },
          ]}
        />
        <h1 className="text-2xl font-bold text-navy">{d.name}</h1>
        {d.type && <p className="text-sm text-foreground/50">{d.type}</p>}
      </div>

      <Card title="Описание">
        <div className="flex flex-col gap-3">
          <Text label="" value={d.description} />
          <Text label="Как добраться" value={d.how_to_get} />
          {d.features && d.features.length > 0 && <Bullets items={d.features} />}
        </div>
      </Card>

      <Card title="Сезонность">
        <SeasonTable seasonality={d.seasonality} />
      </Card>

      {d.attractions && d.attractions.length > 0 && (
        <Card title="Достопримечательности">
          <Bullets items={d.attractions} />
        </Card>
      )}

      {((d.pros && d.pros.length > 0) || (d.cons && d.cons.length > 0)) && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card title="Плюсы">
            <Bullets items={d.pros} tone="pro" />
          </Card>
          <Card title="Минусы">
            <Bullets items={d.cons} tone="con" />
          </Card>
        </div>
      )}

      {d.photos && d.photos.length > 0 && (
        <Card title="Фото">
          <PhotoGallery photos={d.photos} />
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">Отели ({d.hotels.length})</h2>
        {d.hotels.length === 0 ? (
          <p className="text-sm text-foreground/50">Карточек отелей пока нет.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.hotels.map((h) => (
              <HotelCard key={h.id} hotel={h} />
            ))}
          </div>
        )}
        {d.recommended_hotels_other && d.recommended_hotels_other.length > 0 && (
          <div className="mt-4">
            <Card title="Ещё рекомендуют (без карточки)">
              <Bullets items={d.recommended_hotels_other} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
