"use client";

import { fetchSeaPerks } from "@/lib/seaKbApi";
import { useSea } from "@/components/sea-kb/useSea";
import { Card, Crumbs, Loading, PerkGroupView } from "@/components/sea-kb/parts";

export default function SeaPerksPage() {
  const { data, error } = useSea("perks", fetchSeaPerks);
  if (!data) return <Loading error={error} />;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Crumbs items={[{ label: "База ЮВА", href: "/crm/kb/sea" }, { label: "Плюшки для агентов" }]} />
        <h1 className="text-2xl font-bold text-navy">Плюшки для агентов</h1>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {data.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="rounded-full bg-white px-3 py-1 text-blue ring-1 ring-black/5 hover:bg-blue-light">
            {g.network}
          </a>
        ))}
      </div>
      {data.map((g) => (
        <div key={g.id} id={g.id} className="scroll-mt-20">
          <Card title={g.network}>
            {g.brands && g.brands.length > 0 && <p className="mb-2 text-xs text-foreground/50">Бренды: {g.brands.join(", ")}</p>}
            <PerkGroupView group={g} />
          </Card>
        </div>
      ))}
    </div>
  );
}
