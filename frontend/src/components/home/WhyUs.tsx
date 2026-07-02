import Image from "next/image";

const CARDS = [
  {
    seed: "sletat-solo",
    title: "Индивидуальный подбор",
    text: "Учитываем бюджет, стиль отдыха и ваши пожелания",
  },
  {
    seed: "sletat-family",
    title: "Семейный отдых",
    text: "Лучшие отели и программы для отдыха с детьми",
  },
  {
    seed: "sletat-cruise",
    title: "Круизы",
    text: "Морские и речные круизы по самым красивым маршрутам",
  },
  {
    seed: "sletat-excursion",
    title: "Экскурсионные туры",
    text: "Авторские маршруты, впечатления и новые открытия",
  },
  {
    seed: "sletat-support",
    title: "Поддержка без стресса",
    text: "Решим любые вопросы быстро и профессионально",
  },
];

export default function WhyUs() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">
        Почему туристы выбирают нас
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {CARDS.map((card) => (
          <div
            key={card.seed}
            className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={`https://picsum.photos/seed/${card.seed}/400/300`}
                alt={card.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                className="object-cover"
              />
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-navy">{card.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/60">{card.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
