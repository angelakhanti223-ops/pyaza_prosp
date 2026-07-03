import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import { fetchDirections } from "@/lib/api";

export const metadata: Metadata = {
  title: "Направления для отдыха — куда поехать | Слетать.ру",
  description:
    "Популярные направления для туров и путёвок от туристического агентства Слетать.ру: пляжный отдых, экскурсии и круизы по России и за рубежом.",
};

export default async function DirectionsPage() {
  const directions = await fetchDirections();

  return (
    <div>
      <PageHero
        title="Куда поехать: направления для отдыха"
        text="Собрали направления, которые чаще всего выбирают наши клиенты — от пляжного отдыха до экскурсионных туров. Не нашли своё? Расскажите, куда хотите, и мы подберём вариант."
      />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm leading-relaxed text-foreground/70">
          Ниже — актуальный список направлений, с которыми мы работаем. Для каждого подбираем
          отели, авиаперелёт и трансфер под ваш бюджет и даты.
        </p>
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
