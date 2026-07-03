import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

export const metadata: Metadata = {
  title: "Туры и путёвки в Пензе — купить тур онлайн | Слетать.ру",
  description:
    "Купить тур в Пензе: пляжный отдых, горящие туры, экскурсионные программы, семейные поездки и круизы. Подбор путёвки под ваш бюджет — бесплатно, без скрытых платежей.",
};

const TOUR_TYPES = [
  {
    title: "Пляжный отдых",
    text: "Турция, Египет, ОАЭ, Таиланд, Мальдивы и другие направления — для спокойного отдыха у моря с перелётом и трансфером.",
  },
  {
    title: "Горящие туры",
    text: "Путёвки со скидкой на ближайшие даты вылета — быстро подберём вариант, если поездка нужна в короткие сроки.",
  },
  {
    title: "Экскурсионные туры",
    text: "Авторские маршруты по историческим городам России и Европы, культурные и природные достопримечательности.",
  },
  {
    title: "Семейный отдых",
    text: "Отели с детской анимацией и программами, подобранные с учётом возраста детей и особенностей отдыха всей семьёй.",
  },
  {
    title: "Индивидуальные туры",
    text: "Составим маршрут с нуля под ваши даты, бюджет и пожелания — от подбора отеля до оформления документов.",
  },
  {
    title: "Круизы",
    text: "Морские и речные круизы по России и зарубежным маршрутам с подбором каюты под ваш бюджет.",
  },
];

export default function ToursPage() {
  return (
    <div>
      <PageHero
        title="Туры и путёвки в Пензе"
        text="Подбираем туры под ваш бюджет, даты и стиль отдыха: пляжный отдых, горящие туры, экскурсии, семейные поездки и круизы по России и за рубежом."
      />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-foreground/70">
          Туристическое агентство Слетать.ру работает в Пензе больше 20 лет и подбирает туры
          и путёвки для более 90 000 клиентов. Консультация и подбор варианта — бесплатны,
          вы оплачиваете только стоимость самого тура.
        </p>

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
