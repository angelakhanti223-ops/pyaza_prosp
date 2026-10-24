import type { Metadata } from "next";
import SiteCtaBlock from "@/components/cta/SiteCtaBlock";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import { fetchSiteImages, siteImageUrl } from "@/lib/siteImagesApi";

export const metadata: Metadata = {
  title: "Туры и путёвки в Пензе — купить тур онлайн | Слетать.ру",
  description:
    "Купить тур в Пензе: пляжный отдых, горящие туры, экскурсионные программы, семейные поездки и круизы. Подбор путёвки под ваш бюджет.",
};

const TOUR_TYPES = [
  { title: "Пляжный отдых", text: "Турция, Египет, ОАЭ, Таиланд, Мальдивы и другие направления для отдыха у моря." },
  { title: "Горящие туры", text: "Путёвки на ближайшие даты вылета, если поездка нужна в короткие сроки." },
  { title: "Экскурсионные туры", text: "Маршруты по историческим городам, культурным и природным достопримечательностям." },
  { title: "Семейный отдых", text: "Отели с детской инфраструктурой с учётом возраста детей и формата отдыха." },
  { title: "Индивидуальные туры", text: "Маршрут под ваши даты, бюджет и пожелания — от отеля до документов." },
  { title: "Круизы", text: "Морские и речные круизы с подбором каюты под ваш бюджет." },
];

export default async function ToursPage() {
  const siteImages = await fetchSiteImages();
  const heroImage = siteImageUrl(siteImages.tours_hero);

  return (
    <div>
      <PageHero
        title="Туры и путёвки в Пензе"
        text="Подбираем туры под ваш бюджет, даты и стиль отдыха: пляжный отдых, горящие туры, экскурсии, семейные поездки и круизы."
        image={heroImage}
        imageAlt="Подбор тура и путёвки в туристическом агентстве Слетать.ру"
      />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-foreground/70">
          Расскажите, куда хотите поехать, когда планируете отпуск и какой формат отдыха вам нужен.
          Менеджер подготовит варианты и поможет сравнить их по цене, отелю, перелёту и условиям.
        </p>

        <SiteCtaBlock
          className="mt-10"
          title="Подобрать тур под ваш бюджет"
          text="Укажите страну, даты, состав и комфортный бюджет — менеджер подготовит несколько вариантов для сравнения."
          primaryLabel="Получить подборку туров"
          comment="Заявка со страницы туров"
        />

        <a
          href="/tours/russia-january-2027"
          className="mt-10 block rounded-3xl border border-navy/10 bg-blue-light p-6 transition hover:shadow-md sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-blue">Россия · Январь 2027</p>
          <h2 className="mt-3 text-2xl font-bold text-navy">Откройте Россию этой зимой</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/70">
            30 программ в Санкт-Петербург, Карелию, на Байкал и в Калининград.
            Сравните даты, цены на двоих и программы экскурсий.
          </p>
          <span className="mt-5 inline-block rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">
            Выбрать путешествие →
          </span>
        </a>

        <a
          href="/tours/china-constructor"
          className="mt-10 block rounded-3xl border border-[#ded2c4] bg-[#f7f3ed] p-6 transition hover:shadow-md sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#684b38]">EMOTIONS · Онлайн-конструктор</p>
          <h2 className="mt-3 text-2xl font-bold text-navy">Рассчитать свой тур в Китай</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/70">
            Пекин, Шанхай, Хайнань, горы Аватар и Фуронг. Выберите города, ночи,
            отели и экскурсии — предварительная стоимость на двоих пересчитается сразу.
          </p>
          <span className="mt-5 inline-block rounded-full bg-[#684b38] px-5 py-3 text-sm font-semibold text-white">
            Собрать путешествие →
          </span>
        </a>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TOUR_TYPES.map((t) => (
            <div key={t.title} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-navy">{t.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-foreground/60">{t.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <OpenLeadFormButton className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
            Подобрать тур
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}
