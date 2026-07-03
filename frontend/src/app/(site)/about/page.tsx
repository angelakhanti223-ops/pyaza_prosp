import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

export const metadata: Metadata = {
  title: "О нас — Слетать.ру",
  description:
    "Слетать.ру — сеть туристических агентств в Пензе. Более 20 лет на рынке, свыше 90 000 довольных клиентов.",
};

const FACTS = [
  { value: "20+", label: "лет на рынке туризма" },
  { value: "90 000+", label: "довольных путешественников" },
  { value: "50+", label: "направлений по всему миру" },
];

export default function AboutPage() {
  return (
    <div>
      <PageHero
        title="О компании Слетать.ру"
        text="Сеть туристических агентств в Пензе. Подбираем путешествия под бюджет и стиль отдыха каждого клиента вот уже больше 20 лет."
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-4 text-center">
          {FACTS.map((f) => (
            <div key={f.label}>
              <p className="text-2xl font-bold text-gold sm:text-3xl">{f.value}</p>
              <p className="mt-1 text-xs text-foreground/60">{f.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm leading-relaxed text-foreground/70">
          Мы работаем онлайн по всей России и очно принимаем гостей в офисе в Пензе.
          Помогаем на каждом этапе — от подбора тура до возвращения домой: работаем прозрачно,
          без скрытых платежей и навязанных услуг, и остаёмся на связи 24/7 в течение всей поездки.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-foreground/70">
          Наш офис находится по адресу: г. Пенза, Пр-т Строителей, 49А, ТЦ «Проспект».
          Ежедневно с 9:00 до 21:00.
        </p>

        <div className="mt-10 text-center">
          <OpenLeadFormButton className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
            Подобрать тур
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}
