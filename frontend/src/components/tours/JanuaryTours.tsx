"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Hotel, Plane, Search, Users } from "lucide-react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import tours from "@/data/january2027Tours.json";

type Tour = (typeof tours)[number];
const regions = ["Санкт-Петербург", "Калининград", "Байкал", "Карелия"];
const money = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const date = (value: string) => value.split("-").reverse().join(".");
const dates = (start: string, end: string) => `${date(start)} — ${date(end)}`;
const nightsLabel = (n: number) => `${n} ${n === 4 ? "ночи" : "ночей"}`;
const control = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy outline-none focus:border-blue focus:ring-2 focus:ring-blue/20";

function TourCard({ tour, selected, onSelect }: { tour: Tour; selected: number; onSelect: (index: number) => void }) {
  const departure = tour.departures[selected];
  const total = departure.price + tour.flight.amount;
  const comment = [
    "Туры по России · январь 2027",
    `Тур: ${tour.name} (${tour.id})`,
    `Направление: ${tour.region}`,
    `Даты: ${dates(departure.start, departure.end)}, ${nightsLabel(tour.nights)}`,
    "Состав: 2 взрослых",
    `Размещение: ${departure.hotel}`,
    departure.meals ? `Питание: ${departure.meals}` : "",
    `Стоимость тура из подборки: ${money(departure.price)} ₽ за двоих`,
    `Ориентир по перелёту Москва ⇄ ${tour.flight.city}: ≈ ${money(tour.flight.amount)} ₽ за двоих, отдельно`,
    "Прошу уточнить наличие мест, итоговую стоимость и условия бронирования.",
  ].filter(Boolean).join("\n");

  return (
    <article id={`tour-${tour.id}`} data-tour-card={tour.id} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-1 flex-col p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-blue-light px-3 py-1.5 text-xs font-semibold text-blue">{tour.region}</span>
          <span className="text-xs text-foreground/45">{tour.id}</span>
        </div>
        <h2 className="text-xl font-bold leading-snug text-navy sm:text-2xl">{tour.name}</h2>
        {tour.badge && <p className="mt-3 text-xs font-medium text-gold-dark">{tour.badge}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground/65">
          <span className="inline-flex items-center gap-2"><CalendarDays size={15} aria-hidden="true" />{tour.nights + 1} дней / {nightsLabel(tour.nights)}</span>
          <span className="inline-flex items-center gap-2"><Users size={15} aria-hidden="true" />2 взрослых</span>
        </div>
        {tour.nights === 4 && <p className="mt-3 text-xs text-foreground/55">Короткая программа на 4 ночи</p>}
        <div className="mt-5 flex items-start gap-2.5 text-sm leading-6 text-foreground/70">
          <Hotel className="mt-1 shrink-0 text-blue" size={18} aria-hidden="true" /><p data-hotel>{departure.hotel}</p>
        </div>
        {departure.meals && <p data-meals className="mt-2 pl-7 text-xs font-medium text-navy">{departure.meals}</p>}
        <div className="mt-6 border-t border-navy/10 pt-5">
          <label className="block text-xs font-medium text-foreground/65" htmlFor={`date-${tour.id}`}>Даты поездки</label>
          <select id={`date-${tour.id}`} aria-label={`Даты тура ${tour.name}`} value={selected} onChange={e => onSelect(Number(e.target.value))} className={control}>
            {tour.departures.map((d, index) => <option key={d.start} value={index}>{dates(d.start, d.end)}</option>)}
          </select>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
            <p className="text-xs text-foreground/65">Тур за двоих<br /><span className="text-[11px]">без перелёта</span></p>
            <p data-tour-price className="text-3xl font-bold tracking-tight text-navy">{money(departure.price)} <span className="text-xl font-medium">₽</span></p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl bg-blue-light p-4">
          <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
            <div><p className="flex items-center gap-2 font-medium text-navy"><Plane size={16} aria-hidden="true" />Перелёт отдельно</p><p className="mt-1 text-xs text-foreground/60">Москва ⇄ {tour.flight.city} · 2 взрослых</p></div>
            <strong className="whitespace-nowrap text-navy">≈ {money(tour.flight.amount)} ₽</strong>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-foreground/60">Туда-обратно · средний ориентир по январю, не цена конкретных рейсов.</p>
          <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-navy/10 pt-3 text-sm text-navy"><span>Тур + ориентир по авиа</span><strong data-tour-total className="whitespace-nowrap">≈ {money(total)} ₽</strong></div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-foreground/50">Стоимость тура в подборке на {tour.checked}. Наличие и итоговую цену подтвердим при обращении.</p>
        <details className="group mt-5 border-t border-navy/10">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">Программа и что включено<ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
          <div className="pb-5 text-sm leading-6 text-foreground/75">
            <ol aria-label="Программа тура" className="space-y-3">{tour.program.map((item, index) => <li key={index} className="border-l-2 border-gold/50 pl-4">{item}</li>)}</ol>
            <div className="mt-6 rounded-2xl bg-blue-light p-4"><h3 className="font-semibold text-navy">Включено в стоимость</h3><p className="mt-2">{tour.included}</p></div>
            <div className="mt-5"><h3 className="font-semibold text-navy">Оплачивается отдельно</h3><p className="mt-2">{tour.extra}</p></div>
            {tour.note && <div className="mt-5 rounded-2xl border border-gold/20 bg-cream p-4"><h3 className="font-semibold text-navy">Полезно знать</h3><p className="mt-2">{tour.note}</p></div>}
          </div>
        </details>
        <div className="mt-auto pt-3">
          <OpenLeadFormButton comment={comment} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-3 text-sm font-semibold text-navy-dark transition-colors hover:bg-gold-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue">Уточнить и забронировать<ArrowRight size={17} aria-hidden="true" /></OpenLeadFormButton>
        </div>
      </div>
    </article>
  );
}

export default function JanuaryTours() {
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const [nights, setNights] = useState("");
  const [budget, setBudget] = useState("");
  const [sort, setSort] = useState("recommended");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const selectedIndex = (tour: Tour) => selected[tour.id] ?? tour.initialDeparture;
  const visible = tours.filter(tour => {
    const text = [tour.name, tour.region, ...tour.departures.map(d => d.hotel), ...tour.program].join(" ").toLocaleLowerCase("ru");
    return (!region || region === tour.region) && (!nights || Number(nights) === tour.nights) && (!budget || tour.departures[selectedIndex(tour)].price <= Number(budget)) && (!query.trim() || text.includes(query.trim().toLocaleLowerCase("ru")));
  }).sort((a, b) => {
    const left = a.departures[selectedIndex(a)], right = b.departures[selectedIndex(b)];
    if (sort === "price") return left.price - right.price;
    if (sort === "date") return left.start.localeCompare(right.start) || left.price - right.price;
    const rank = (n: number) => n === 6 ? 0 : n === 5 ? 1 : n === 7 ? 2 : 3;
    return rank(a.nights) - rank(b.nights) || a.region.localeCompare(b.region, "ru") || left.price - right.price;
  });
  const reset = () => { setRegion(""); setQuery(""); setNights(""); setBudget(""); setSort("recommended"); };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <section aria-label="Подбор тура">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Направление">
          {["", ...regions].map(name => <button key={name} type="button" aria-pressed={region === name} onClick={() => setRegion(name)} className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue ${region === name ? "border-navy bg-navy text-white" : "border-navy/15 bg-white text-navy hover:bg-blue-light"}`}>{name || "Все направления"}<span className={`ml-2 text-xs ${region === name ? "text-white/65" : "text-foreground/45"}`}>{name ? tours.filter(t => t.region === name).length : tours.length}</span></button>)}
        </div>
        <div className="mt-6 grid gap-4 rounded-3xl border border-navy/10 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
          <label className="min-w-0 text-xs font-medium text-foreground/65"><span className="inline-flex items-center gap-1.5"><Search size={13} aria-hidden="true" />Найти программу</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Название, отель, экскурсия" className={control} /></label>
          <label className="min-w-0 text-xs font-medium text-foreground/65">Длительность<select value={nights} onChange={e => setNights(e.target.value)} className={control}><option value="">Все варианты</option>{[6, 5, 7, 4].map(n => <option key={n} value={n}>{nightsLabel(n)}</option>)}</select></label>
          <label className="min-w-0 text-xs font-medium text-foreground/65">Бюджет тура за двоих<select value={budget} onChange={e => setBudget(e.target.value)} className={control}><option value="">Любой бюджет</option>{[50000, 80000, 120000, 180000].map(n => <option key={n} value={n}>До {money(n)} ₽</option>)}</select></label>
          <label className="min-w-0 text-xs font-medium text-foreground/65">Порядок просмотра<select value={sort} onChange={e => setSort(e.target.value)} className={control}><option value="recommended">Сначала 6 ночей</option><option value="price">Сначала дешевле</option><option value="date">По дате заезда</option></select></label>
        </div>
        <p className="mt-3 text-xs leading-5 text-foreground/55">Бюджет указан без перелёта. Фильтры и сортировка учитывают выбранную в каждой карточке дату.</p>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 py-6">
        <p role="status" className="text-sm text-foreground/65">Найдено программ: <strong className="text-navy">{visible.length}</strong><span className="mx-2 text-foreground/30">·</span>Дат заезда: {visible.reduce((count, t) => count + t.departures.length, 0)}</p>
        <button type="button" onClick={reset} className="min-h-11 text-xs text-blue underline underline-offset-4">Сбросить фильтры</button>
      </div>
      {visible.length ? <div className="grid items-start gap-6 md:grid-cols-2">{visible.map(tour => <TourCard key={tour.id} tour={tour} selected={selectedIndex(tour)} onSelect={index => setSelected(current => ({ ...current, [tour.id]: index }))} />)}</div> : <div className="rounded-3xl border border-dashed border-navy/20 bg-blue-light/40 px-6 py-14 text-center"><h2 className="text-xl font-bold text-navy">Пока нет совпадений</h2><p className="mt-3 text-sm text-foreground/65">Попробуйте другое направление, бюджет или длительность.</p><button type="button" onClick={reset} className="mt-6 min-h-12 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white">Показать все туры</button></div>}
      <section aria-labelledby="travel-notes" className="mt-12 rounded-3xl border border-navy/10 bg-blue-light/50 p-6 sm:p-8">
        <h2 id="travel-notes" className="text-xl font-bold text-navy">Что учесть перед поездкой</h2>
        <div className="mt-5 grid gap-6 text-sm leading-7 text-foreground/70 md:grid-cols-2">
          <div><h3 className="font-semibold text-navy">Стоимость и перелёт</h3><p className="mt-2">Цены из подборки от 23–24.10.2026 указаны за двух взрослых. Перелёт оплачивается отдельно. Ориентиры по авиа рассчитаны на 24.10.2026 по январским тарифам туда-обратно из Москвы и округлены до тысячи рублей. Они сохраняются при смене даты тура. Для Петрозаводска использована ограниченная выборка из двух пар дат.</p><p className="mt-2">Конкретные рейсы, багаж и наличие мест проверим при обращении. Новогодние даты и возвращение в феврале могут стоить дороже. Дорога до Москвы, дополнительные ночи и трансферы не входят в сумму «тур + ориентир по авиа».</p></div>
          <div><h3 className="font-semibold text-navy">Маршрут и встреча</h3><p className="mt-2">Ледовые поездки на Байкале зависят от погоды и состояния льда. Порядок экскурсий может меняться. Программа Карелии рассчитана на утреннюю встречу поезда в Петрозаводске: при перелёте может понадобиться приезд накануне и дополнительная ночь.</p><p className="mt-2">Комбинированные маршруты из Петербурга предполагают прибытие в Пулково или на вокзал Санкт-Петербурга. Перед бронированием согласуем время прибытия, встречу, питание и окончательный состав услуг.</p></div>
        </div>
      </section>
      <div className="mt-10 text-center"><h2 className="text-2xl font-bold text-navy">Поможем выбрать зимнее путешествие</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-foreground/65">Нужны другие даты или поездка с детьми? Подготовим расчёт под ваш состав и пожелания.</p><OpenLeadFormButton comment="Туры по России · январь 2027. Нужен индивидуальный подбор под мои даты и состав." className="mt-6 min-h-12 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue">Подобрать тур по России</OpenLeadFormButton></div>
    </div>
  );
}
