import Image from "next/image";
import { siteImageUrl, type SiteImages } from "@/lib/siteImagesApi";

const CARDS = [
  {
    key: "why_us_solo" as const,
    seed: "sletat-solo",
    title: "Индивидуальный подбор",
    text: "Учитываем бюджет, стиль отдыха и ваши пожелания",
  },
  {
    key: "why_us_family" as const,
    seed: "sletat-family",
    title: "Семейный отдых",
    text: "Лучшие отели и программы для отдыха с детьми",
  },
  {
    key: "why_us_cruise" as const,
    seed: "sletat-cruise",
    title: "Круизы",
    text: "Морские и речные круизы по самым красивым маршрутам",
  },
  {
    key: "why_us_excursion" as const,
    seed: "sletat-excursion",
    title: "Экскурсионные туры",
    text: "Авторские маршруты, впечатления и новые открытия",
  },
  {
    key: "why_us_support" as const,
    seed: "sletat-support",
    title: "Поддержка без стресса",
    text: "Решим любые вопросы быстро и профессионально",
  },
];

type Props = {
  images?: Partial<SiteImages>;
};

export default function WhyUs({ images }: Props) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">
        Почему туристы выбирают нас
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {CARDS.map((card) => {
          const managed = siteImageUrl(images?.[card.key] ?? null);
          const image = managed ?? `https://picsum.photos/seed/${card.seed}/400/300`;
          return (
            <div
              key={card.seed}
              className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={image}
                  alt={card.title}
                  fill
                  unoptimized={Boolean(managed)}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-navy">{card.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/60">{card.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
