import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

export const metadata: Metadata = {
  title: "Круизы — Слетать.ру",
  description: "Морские и речные круизы по самым красивым маршрутам от сети туристических агентств Слетать.ру.",
};

export default function CruisesPage() {
  return (
    <div>
      <PageHero
        title="Круизы"
        text="Морские и речные круизы по самым красивым маршрутам — от коротких речных путешествий до многодневных морских лайнеров."
      />
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm leading-relaxed text-foreground/70">
          Подберём круиз под ваши даты и бюджет: расскажите, что вам интересно — направление,
          длительность, класс каюты — и мы найдём подходящий вариант.
        </p>
        <div className="mt-8">
          <OpenLeadFormButton className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
            Подобрать круиз
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}
