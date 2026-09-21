import type { Metadata } from "next";
import SiteCtaBlock from "@/components/cta/SiteCtaBlock";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

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

export default function ToursPage() {
  return (
    <div>
      <PageHero
        title="Туры и путёвки в Пензе"
        text="Подбираем туры под ваш бюджет, даты и стиль отдыха: пляжный отдых, горящие туры, экскурсии, семейные поездки и круизы."
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
