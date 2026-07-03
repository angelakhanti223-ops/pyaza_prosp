import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

export const metadata: Metadata = {
  title: "Акции и горящие туры — Слетать.ру",
  description:
    "Актуальные акции, горящие туры и сезонные скидки от туристического агентства Слетать.ру в Пензе. Оставьте заявку — пришлём подборку под ваши даты.",
};

export default function PromotionsPage() {
  return (
    <div>
      <PageHero
        title="Акции и горящие туры"
        text="Собираем актуальные предложения от туроператоров — эта страница пополняется. Оставьте заявку, и мы пришлём вам подборку лучших вариантов на ваши даты."
      />
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm leading-relaxed text-foreground/70">
          Горящие туры и сезонные скидки меняются каждый день — чтобы не пропустить выгодное
          предложение под ваши даты, оставьте заявку и укажите желаемое направление.
        </p>
        <div className="mt-8">
          <OpenLeadFormButton className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
            Узнать об акциях
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}
