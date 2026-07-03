import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

export const metadata: Metadata = {
  title: "Круизы — морские и речные туры | Слетать.ру",
  description:
    "Купить круиз через турагентство Слетать.ру: морские и речные маршруты по России и за рубежом, подбор каюты и даты под ваш бюджет.",
};

const CRUISE_TYPES = [
  {
    title: "Речные круизы по России",
    text: "Маршруты по Волге, Дону и другим рекам — от коротких путешествий на выходные до многодневных туров.",
  },
  {
    title: "Морские круизы",
    text: "Средиземное море, Юго-Восточная Азия и другие направления на лайнерах разного класса.",
  },
  {
    title: "Подбор каюты",
    text: "Поможем выбрать класс каюты и палубу исходя из бюджета и состава компании.",
  },
];

export default function CruisesPage() {
  return (
    <div>
      <PageHero
        title="Круизы: морские и речные маршруты"
        text="Морские и речные круизы по самым красивым маршрутам — от коротких речных путешествий до многодневных морских лайнеров."
      />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {CRUISE_TYPES.map((c) => (
            <div key={c.title} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-navy">{c.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-foreground/60">{c.text}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-foreground/70">
          Подберём круиз под ваши даты и бюджет: расскажите, что вам интересно — направление,
          длительность, класс каюты — и мы найдём подходящий вариант.
        </p>
        <div className="mt-8 text-center">
          <OpenLeadFormButton className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
            Подобрать круиз
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}
