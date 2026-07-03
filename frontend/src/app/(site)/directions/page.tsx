import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import { fetchDirections } from "@/lib/api";

export const metadata: Metadata = {
  title: "Направления — Слетать.ру",
  description: "Актуальные направления для отдыха от сети туристических агентств Слетать.ру.",
};

export default async function DirectionsPage() {
  const directions = await fetchDirections();

  return (
    <div>
      <PageHero
        title="Направления"
        text="Собрали популярные у наших клиентов направления. Не нашли своё — расскажите, куда хотите, и мы подберём вариант."
      />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {directions.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {directions.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-black/5 bg-white px-5 py-4 text-center text-sm font-semibold text-navy shadow-sm"
              >
                {d.name}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-foreground/50">Список направлений скоро появится здесь.</p>
        )}
        <div className="mt-10 text-center">
          <OpenLeadFormButton className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
            Подобрать тур
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}
