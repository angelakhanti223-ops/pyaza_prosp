import Image from "next/image";
import { siteImageUrl, type SiteImages } from "@/lib/siteImagesApi";

const CARDS = [
  {
    key: "why_us_solo" as const,
    seed: "sletat-solo",
    title: "Индивидуальный подбор тура",
    text: "Подбираем путёвку под ваш бюджет, направление и даты — от горящих туров до авторских маршрутов",
  },
  {
    key: "why_us_family" as const,
    seed: "sletat-family",
    title: "Семейный отдых с детьми",
    text: "Отели с детской анимацией, бассейнами и программами для всей семьи — от Турции до курортов России",
  },
  {
    key: "why_us_cruise" as const,
    seed: "sletat-cruise",
    title: "Морские и речные круизы",
    text: "Круизные маршруты по России, Европе и другим направлениям — с подбором каюты под ваш бюджет",
  },
  {
    key: "why_us_excursion" as const,
    seed: "sletat-excursion",
    title: "Экскурсионные туры",
    text: "Авторские маршруты по историческим городам и природным достопримечательностям России и мира",
  },
  {
    key: "why_us_support" as const,
    seed: "sletat-support",
    title: "Поддержка на всех этапах",
    text: "Отвечаем на вопросы, помогаем с документами и остаёмся на связи 24/7 в течение всей поездки",
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
