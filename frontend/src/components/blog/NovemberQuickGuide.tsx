const guideCards = [
  {
    title: "Тёплое море",
    text: "В ноябре для пляжного отдыха чаще смотрят Египет, ОАЭ, Мальдивы, Таиланд и отдельные направления Азии. Главное — выбрать курорт по сезону.",
    accent: "для пляжа",
  },
  {
    title: "Отдых с детьми",
    text: "Семьям важны перелёт, питание, пляж, тёплый бассейн, территория отеля и свежие отзывы именно за ноябрь.",
    accent: "для семей",
  },
  {
    title: "Азия и экзотика",
    text: "Таиланд и Вьетнам в ноябре уже интереснее, но требуют точного выбора региона, пляжа и логистики.",
    accent: "для впечатлений",
  },
  {
    title: "Города, СПА и круизы",
    text: "Если не нужен пляж каждый день, ноябрь подходит для Стамбула, ОАЭ, России, СПА-отдыха и круизных маршрутов.",
    accent: "для маршрутов",
  },
];

const checklist = [
  "пляжный отдых или спокойная перезагрузка без обязательного купания;",
  "комфортный перелёт и удобство вылета для вашей семьи;",
  "тип питания: завтраки, полупансион, полный пансион или all inclusive;",
  "сезонность конкретного курорта, а не только страны;",
  "итоговый бюджет с учётом трансфера, багажа, экскурсий и доплат.",
];

export default function NovemberQuickGuide() {
  return (
    <section className="mt-8 space-y-8">
      <div className="rounded-3xl bg-blue-light/60 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue">Короткий вывод</p>
        <h2 className="mt-3 text-xl font-bold text-navy">Куда ехать в ноябре: быстрый ориентир</h2>
        <p className="mt-3 text-sm leading-6 text-foreground/75">
          Ноябрь — месяц, когда летние направления уже почти ушли в межсезонье, зато начинают сильнее
          смотреться Египет, ОАЭ, Таиланд, Мальдивы и некоторые азиатские курорты. Для удачного отдыха
          важно выбирать не просто страну, а конкретный курорт, отель, пляж и формат поездки.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {guideCards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-blue-light bg-white p-5 shadow-sm">
            <p className="mb-3 inline-flex rounded-full bg-blue-light px-3 py-1 text-xs font-medium text-blue">
              {card.accent}
            </p>
            <h3 className="text-base font-bold text-navy">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-foreground/70">{card.text}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-blue-light p-5 sm:p-7">
        <h2 className="text-lg font-bold text-navy">Что проверить перед бронированием</h2>
        <ol className="mt-4 space-y-2 text-sm leading-6 text-foreground/75">
          {checklist.map((item, index) => (
            <li key={item} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-light text-xs font-bold text-blue">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
