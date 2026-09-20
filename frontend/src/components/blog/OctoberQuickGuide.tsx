const guideCards = [
  {
    title: "Море и солнце",
    text: "Египет, ОАЭ, Таиланд, Вьетнам и островные направления подходят, если нужен тёплый отдых без осенней прохлады.",
    accent: "для пляжного отпуска",
  },
  {
    title: "Отдых с детьми",
    text: "Лучше выбирать короткий перелёт, питание в отеле, понятную инфраструктуру и спокойный пляж рядом с отелем.",
    accent: "для семей",
  },
  {
    title: "Экскурсии",
    text: "Октябрь удобен для городов, древних маршрутов и насыщенных программ: уже не жарко, но ещё комфортно гулять.",
    accent: "для прогулок",
  },
  {
    title: "Круизы",
    text: "Формат подходит тем, кто хочет увидеть несколько городов за одну поездку и не менять отель вручную.",
    accent: "для маршрутов",
  },
];

const checklist = [
  "какая погода нужна: пляжная, экскурсионная или смешанная;",
  "сколько часов перелёта комфортно для взрослых и детей;",
  "важно ли питание в отеле: BB, HB, FB или AI;",
  "нужна ли близость к достопримечательностям, пляжу или торговым улицам;",
  "какой бюджет комфортен с учётом перелёта, проживания и экскурсий.",
];

export default function OctoberQuickGuide() {
  return (
    <section className="mt-8 space-y-8">
      <div className="rounded-3xl bg-blue-light/60 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue">Короткий вывод</p>
        <h2 className="mt-3 text-xl font-bold text-navy">Куда ехать в октябре: быстрый ориентир</h2>
        <p className="mt-3 text-sm leading-6 text-foreground/75">
          Октябрь — удобный месяц для тех, кто хочет продлить лето, но не любит пиковые цены и жару.
          Для пляжа лучше смотреть тёплые направления, для экскурсий — города и маршруты с мягкой погодой,
          для семьи — отели с понятной логистикой и питанием.
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
        <h2 className="text-lg font-bold text-navy">Что сравнить перед бронированием</h2>
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
