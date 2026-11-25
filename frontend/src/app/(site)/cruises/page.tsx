import type { Metadata } from "next";
import SiteCtaBlock from "@/components/cta/SiteCtaBlock";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import CruiseWidget from "@/components/cruises/CruiseWidget";
import { fetchSiteImages, siteImageUrl } from "@/lib/siteImagesApi";

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

export default async function CruisesPage() {
  const siteImages = await fetchSiteImages();
  const heroImage = siteImageUrl(siteImages.cruises_hero);

  return (
    <div>
      <PageHero
        title="Круизы: морские и речные маршруты"
        text="Морские и речные круизы по самым красивым маршрутам — от коротких речных путешествий до многодневных морских лайнеров."
        image={heroImage}
        imageAlt="Морские и речные круизы"
      />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <SiteCtaBlock
          className="mb-10"
          eyebrow="Подбор круиза"
          title="Поможем выбрать маршрут, лайнер и каюту"
          text="Укажите даты, длительность, желаемое направление и бюджет — подберём круиз и объясним разницу между вариантами."
          primaryLabel="Подобрать круиз"
          comment="Заявка со страницы круизов"
        />

        <a href="/tours/cruises-december-2027" className="mb-10 block overflow-hidden rounded-3xl border border-gold/30 bg-cream transition hover:shadow-md">
          <img src="/cruise-assets/december-2027/world-europa.jpg" alt="Иллюстрация MSC World Europa и обзорная карта маршрута" width={1448} height={1086} loading="lazy" className="max-h-80 w-full object-contain bg-navy" />
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue">MSC Cruises · Декабрь 2027</p>
            <h2 className="mt-3 text-2xl font-bold text-navy">Декабрь с видом на море</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/70">Семь лайнеров, круизы на 7–10 ночей и программы по дням. Сравните маршруты, выберите даты и отправьте заявку на подбор каюты.</p>
            <span className="mt-5 inline-block rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">Смотреть круизы декабря</span>
          </div>
        </a>

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

        <div className="mt-16">
          <h2 className="mb-6 text-center text-lg font-bold text-navy">Поиск и бронирование круизов онлайн</h2>
          <CruiseWidget />
        </div>
      </div>
    </div>
  );
}
