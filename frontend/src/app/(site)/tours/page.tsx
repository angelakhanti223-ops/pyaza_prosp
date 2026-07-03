import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

export const metadata: Metadata = {
  title: "Туры — Слетать.ру",
  description:
    "Пляжный отдых, экскурсионные туры, круизы и авторские маршруты от сети туристических агентств Слетать.ру. Подберём тур под ваш бюджет и стиль отдыха.",
};

const TOUR_TYPES = [
  { title: "Пляжный отдых", text: "Турция, Египет, ОАЭ, Таиланд, Мальдивы — для спокойного отдыха у моря." },
  { title: "Экскурсионные туры", text: "Авторские маршруты по историческим городам и природным достопримечательностям." },
  { title: "Семейный отдых", text: "Отели и программы, подобранные с учётом отдыха с детьми любого возраста." },
  { title: "Индивидуальные туры", text: "Составим маршрут под ваши даты, бюджет и пожелания с нуля." },
];

export default function ToursPage() {
  return (
    <div>
      <PageHero
        title="Туры на любой вкус"
        text="Пляжный отдых, экскурсии, семейные и индивидуальные туры — подберём вариант под ваш бюджет и стиль отдыха."
      />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
