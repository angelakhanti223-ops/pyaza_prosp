const guideCards = [
  {
    title: "Море и солнце",
    text: "Египет, ОАЭ, Таиланд, Мальдивы и Шри-Ланка — основные варианты, если хочется тепла и пляжа.",
  },
  {
    title: "Новый год",
    text: "На праздничные даты лучше бронировать заранее: хорошие отели, семейные номера и удобные рейсы уходят быстрее.",
  },
  {
    title: "С детьми",
    text: "Смотрите не только страну, но и перелёт, питание, тёплый бассейн, пляж, трансфер и свежие семейные отзывы.",
  },
  {
    title: "СПА, города и горы",
    text: "Россия, Стамбул, горные отели, СПА и круизы подойдут, если пляж не является главной целью отпуска.",
  },
];

const checklist = [
  "проверьте даты: начало декабря и Новый год сильно отличаются по цене",
  "сравните не только страну, но и конкретный курорт",
  "уточните пляж, ветреность, бассейн с подогревом и питание",
  "не откладывайте семейные номера и праздничные даты до последнего",
];

export default function DecemberQuickGuide() {
  return (
    <section className="mt-8 rounded-3xl border border-blue-light bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue">Короткий вывод</p>
      <h2 className="mt-2 text-2xl font-bold text-navy">Как выбирать отдых в декабре</h2>
      <p className="mt-3 text-sm leading-6 text-foreground/70">
        Декабрь требует более точного выбора: начало месяца, школьные каникулы и Новый год дают разную цену,
        доступность отелей и ожидания от отдыха.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {guideCards.map((card) => (
          <div key={card.title} className="rounded-2xl bg-blue-light/60 p-4">
            <h3 className="text-sm font-bold text-navy">{card.title}</h3>
            <p className="mt-2 text-xs leading-5 text-foreground/70">{card.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-gold/15 p-4">
        <h3 className="text-sm font-bold text-navy">Перед бронированием</h3>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-foreground/70">
          {checklist.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
