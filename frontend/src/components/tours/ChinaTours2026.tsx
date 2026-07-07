"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

type Category = "first" | "nature" | "beach" | "premium" | "hongkong";

type Tour = {
  id: number;
  title: string;
  days: string;
  price: string;
  rub: string;
  dates: string;
  route: string;
  hotels: string;
  food: string;
  category: Category[];
  bestFor: string;
  highlight: string;
  program: string;
  image: string;
};

const FILTERS: { value: "all" | Category; label: string }[] = [
  { value: "all", label: "Все туры" },
  { value: "first", label: "Первый Китай" },
  { value: "nature", label: "Природа и Аватар" },
  { value: "beach", label: "Пляж + экскурсии" },
  { value: "premium", label: "Длинные маршруты" },
  { value: "hongkong", label: "Гонконг" },
];

const TOURS: Tour[] = [
  {
    id: 1,
    title: "Пекин + Шанхай",
    days: "7 дней / 6 ночей",
    price: "от $917",
    rub: "≈ 75 080 ₽",
    dates: "заезды до 26.10.26",
    route: "Пекин — Шанхай",
    hotels: "Holiday Inn Express Beijing Dongzhimen 4*, Kingtown Hotel Plaza Shanghai 4* или аналоги",
    food: "завтраки + 4 обеда",
    category: ["first"],
    bestFor: "первая поездка в Китай и классика: Стена, Гугун, Шанхай",
    highlight: "12 экскурсий уже включены: Великая стена, Гугун, Храм Неба, Шанхайская башня и круиз по Хуанпу.",
    program:
      "День 1 — прилёт в Пекин и Храм Неба. День 2 — Великая стена, Летний дворец, олимпийские объекты. День 3 — Тяньаньмэнь, Гугун, переезд в Шанхай на скоростном поезде. День 4 — экскурсия по Шанхаю и вечерний круиз. Дни 5–6 — свободное время. День 7 — вылет домой.",
    image: "/tours/china-2026/tour-1-beijing-shanghai.jpg",
  },
  {
    id: 2,
    title: "Чжанцзяцзе — Чунцин",
    days: "8 дней / 7 ночей",
    price: "от $1698",
    rub: "≈ 139 020 ₽",
    dates: "до 20.10.26, вторник и пятница",
    route: "Чунцин — Чжанцзяцзе — Чунцин",
    hotels: "Zhangjiajie Yunju 4*, Chongqing Wudeng 4* или аналог",
    food: "завтраки + 4 обеда + 1 ужин",
    category: ["nature"],
    bestFor: "горы Аватара, стеклянный мост и необычный Чунцин",
    highlight: "Гарантированные места на Tianjin Airlines и насыщенная природная программа.",
    program:
      "День 1 — вылет. День 2 — прилёт и экскурсия по Чунцину. День 3 — переезд в Чжанцзяцзе, озеро Баофэн. День 4 — Тяньмэньшань. День 5 — нацпарк Чжанцзяцзе и горы Аватара. День 6 — стеклянный мост, VR-аттракцион, чайный мастер-класс, переезд в Чунцин. День 7 — свободный день. День 8 — вылет домой.",
    image: "/tours/china-2026/tour-2-zhangjiajie-chongqing.jpg",
  },
  {
    id: 3,
    title: "Шэньчжэнь и пейзажи Гуйлиня",
    days: "8 дней / 7 ночей",
    price: "от $1858",
    rub: "≈ 152 120 ₽",
    dates: "11.06, 09.07, 13.08, 03.09, 17.09, 15.10.26",
    route: "Шэньчжэнь — Гуйлинь — Яншо — Гуанчжоу — Фошань — Шэньчжэнь",
    hotels: "отели 4*: Holiday Inn Express, Hampton by Hilton, Wingate by Wyndham и др.",
    food: "завтраки + 1 обед + 6 ужинов",
    category: ["nature"],
    bestFor: "Гуйлинь, река Ли, юг Китая и гастрономичные ужины",
    highlight: "Красивый маршрут по югу Китая с круизами, Гуйлинем, Фошанем и шоу львов.",
    program:
      "День 1 — вылет. День 2 — Шэньчжэнь: Наньтоу и Oct Loft. День 3 — поезд в Гуйлинь, пещера Тростниковой Флейты. День 4 — круиз по реке Ли в Яншо. День 5 — Гуанчжоу и вечерний круиз по Чжуцзян. День 6 — Фошань, храм предков и шоу львов. День 7 — сад Цинхуэй и возврат в Шэньчжэнь. День 8 — вылет домой.",
    image: "/tours/china-2026/tour-3-shenzhen-guilin.jpg",
  },
  {
    id: 4,
    title: "Гонконг и пейзажи Гуйлиня",
    days: "8 дней / 7 ночей",
    price: "от $2008",
    rub: "≈ 164 400 ₽",
    dates: "13.08, 03.09, 17.09, 15.10.26",
    route: "Шэньчжэнь — Гуйлинь — Яншо — Гонконг — Шэньчжэнь",
    hotels: "отели 4*, включая Best Western Plus Kowloon в Гонконге",
    food: "завтраки + 1 обед + 3 ужина",
    category: ["hongkong", "nature"],
    bestFor: "свободные дни в Гонконге плюс красивые пейзажи Гуйлиня",
    highlight: "Комбинация природы Гуйлиня и трёх ночей в Гонконге.",
    program:
      "День 1 — вылет. День 2 — Шэньчжэнь. День 3 — Гуйлинь и пещера Тростниковой Флейты. День 4 — круиз по реке Ли. День 5 — переезд в Гонконг. Дни 6–7 — свободные дни в Гонконге. День 8 — возврат в Шэньчжэнь и вылет домой.",
    image: "/tours/china-2026/tour-4-hongkong-guilin.jpg",
  },
  {
    id: 5,
    title: "Шанхай — Хайнань — Пекин",
    days: "14 дней / 13 ночей",
    price: "от $2319",
    rub: "≈ 189 860 ₽",
    dates: "пятницы: 26.06–11.12.26 и 15.01–19.03.27",
    route: "Шанхай — Хайнань — Пекин",
    hotels: "Broadway Mansions Hotel 5*, отель на Хайнане по выбору, Sunworld/Ritan Hotel",
    food: "завтраки + 2 обеда",
    category: ["beach", "premium"],
    bestFor: "когда хочется и экскурсии, и полноценный пляжный отдых",
    highlight: "Большой комбинированный тур: Шанхай, 8 ночей на Хайнане и финал в Пекине.",
    program:
      "Дни 1–3 — вылет, прилёт и экскурсия по Шанхаю: Жемчужина Востока, Юйюань, Вайтань. День 4 — перелёт на Хайнань. Дни 5–11 — пляжный отдых. День 12 — перелёт в Пекин. День 13 — Великая стена, Тяньаньмэнь, Гугун. День 14 — вылет домой.",
    image: "/tours/china-2026/tour-5-shanghai-hainan-beijing.jpg",
  },
  {
    id: 6,
    title: "Хайнань + Пекин",
    days: "15 дней / 14 ночей",
    price: "от $1877",
    rub: "≈ 153 670 ₽",
    dates: "субботы: 27.06–12.12.26 и 09.01–20.03.27",
    route: "Хайнань — Пекин",
    hotels: "отель на Хайнане по выбору, в Пекине 4–5*: Sunworld/Ritan",
    food: "завтраки + 1 обед",
    category: ["beach", "premium"],
    bestFor: "пляжный отдых на Хайнане с короткой экскурсионной частью",
    highlight: "10 ночей на Хайнане и Пекин с Великой стеной, Тяньаньмэнь и Гугуном.",
    program:
      "Дни 1–2 — вылет и перелёт на Хайнань. Дни 3–11 — пляжный отдых. День 12 — перелёт в Пекин. День 13 — Великая стена и Гугун. День 14 — свободный день. День 15 — вылет домой.",
    image: "/tours/china-2026/tour-6-hainan-beijing.jpg",
  },
  {
    id: 7,
    title: "От гор Аватара до древних городов",
    days: "11 или 12 дней",
    price: "от $1960",
    rub: "≈ 160 470 ₽",
    dates: "26.05–13.10.26 по вторникам, 12.06–16.10.26 по пятницам",
    route: "Чунцин — Чэнду — Фуронг — Чжанцзяцзе — Чунцин",
    hotels: "Holiday Inn & Suites Chongqing Nanan 4*, Chengdu AC Hotel 4*, Wyndham 5*, Zhangjiajie Soluxe 5*",
    food: "завтраки + 5–6 обедов + 2 ужина",
    category: ["nature", "premium"],
    bestFor: "самый насыщенный маршрут: панды, древние города и Чжанцзяцзе",
    highlight: "Гарантированные места Tianjin Airlines, отели 4–5* и крупная экскурсионная программа.",
    program:
      "Маршрут включает Чунцин, Цыцикоу, Чэнду, центр панд в Дуцзянъяне, храм Ухоу, переулки Куаньчжай, ночной Фуронг, Тяньмэньшань, Чжанцзяцзе, чайную плантацию и стеклянный мост.",
    image: "/tours/china-2026/tour-7-avatar-mountains.jpg",
  },
  {
    id: 8,
    title: "Панда — Аватар — Фуронг",
    days: "10 дней / 9 ночей",
    price: "от $1910",
    rub: "≈ 156 370 ₽",
    dates: "07.09–28.12.26 по понедельникам",
    route: "Чэнду — Фуронг — Чжанцзяцзе — Чунцин — Чэнду",
    hotels: "отели уровня тура №7: 4–5*",
    food: "завтраки + 5 обедов + 3 ужина",
    category: ["nature"],
    bestFor: "панды, Фуронг, Чжанцзяцзе и новогодний вылет",
    highlight: "Маршрут с пандами, ночным Фуронгом, горами Аватара и Чунцином.",
    program:
      "День 1 — вылет. День 2 — Чэнду. День 3 — панды и музеи Чэнду. День 4 — переезд в Чжанцзяцзе через Фужунчжэнь. День 5 — Тяньмэньшань. День 6 — Чжанцзяцзе. День 7 — стеклянный мост и Чунцин. День 8 — Чунцин. День 9 — возврат в Чэнду и свободный день. День 10 — вылет домой.",
    image: "/tours/china-2026/tour-8-panda-avatar-furong.jpg",
  },
  {
    id: 9,
    title: "Пекин и живописный Гуйлинь",
    days: "8 дней / 7 ночей",
    price: "от $2088",
    rub: "≈ 170 950 ₽",
    dates: "29.05, 05.09, 12.09, 19.09, 10.10, 17.10.26",
    route: "Пекин — Гуйлинь — Яншо — Пекин",
    hotels: "Beijing Landmark Hotels 4*, King's Park Plaza 4*, Grand Rezen Dikay Hotel Yangshuo 4*",
    food: "завтраки + 5 обедов",
    category: ["first", "nature"],
    bestFor: "классика Пекина плюс рисовые террасы и река Лицзян",
    highlight: "Пекин, Великая стена, чайная церемония, Лунцзи, Яншо и пещера Тростниковой Флейты.",
    program:
      "День 1 — вылет. День 2 — Пекин. День 3 — Великая стена, чайная церемония, перелёт в Гуйлинь. День 4 — деревни и рисовые террасы Лунцзи. День 5 — круиз по реке Лицзян в Яншо. День 6 — возврат в Гуйлинь, пещера и парк. День 7 — свободный день в Пекине. День 8 — вылет домой.",
    image: "/tours/china-2026/tour-9-beijing-guilin.jpg",
  },
  {
    id: 10,
    title: "Пекин — Чунцин — Аватар",
    days: "10 дней / 9 ночей",
    price: "от $2160",
    rub: "≈ 176 840 ₽",
    dates: "21.08–31.12.26, включая Новый год",
    route: "Пекин — Чунцин — Чжанцзяцзе — Чунцин — Пекин",
    hotels: "Beijing Landmark Hotels 4*, Chongqing World Hotel 4*, Zhangjiajie Soluxe Hotel 5*",
    food: "завтраки + 5 обедов + 1 ужин",
    category: ["first", "nature"],
    bestFor: "хочется и Пекин, и Чжанцзяцзе в одной поездке",
    highlight: "Сильная комбинация: Пекин, Великая стена, Чунцин, Тяньмэньшань, Чжанцзяцзе и стеклянный мост.",
    program:
      "День 1 — вылет. День 2 — Пекин. День 3 — Великая стена и чайная церемония. День 4 — перелёт в Чунцин. День 5 — переезд в Чжанцзяцзе, Тяньмэньшань. День 6 — Чжанцзяцзе. День 7 — стеклянный мост и чайная плантация. День 8 — возврат в Чунцин. День 9 — перелёт в Пекин и свободный вечер. День 10 — вылет домой.",
    image: "/tours/china-2026/tour-10-beijing-chongqing-avatar.jpg",
  },
];

const WHATSAPP_LINK =
  "https://wa.me/79502302555?text=" +
  encodeURIComponent(
    "Здравствуйте, Елена! Хочу подобрать тур в Китай.\n\nИнтересует:\n1. Даты:\n2. Количество туристов:\n3. Бюджет:\n4. Какой тур понравился:",
  );

function TourCard({ tour }: { tour: Tour }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3]">
        <Image src={tour.image} alt={tour.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-dark/80 to-transparent p-4 pt-10">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            Тур №{tour.id} · {tour.days}
          </span>
          <h3 className="mt-2 text-lg font-bold text-white">{tour.title}</h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-baseline justify-between rounded-xl bg-blue-light/60 px-4 py-3">
          <strong className="text-xl font-bold text-navy">{tour.price}</strong>
          <span className="text-xs font-semibold text-foreground/50">{tour.rub}</span>
        </div>

        <ul className="mb-4 flex flex-col gap-2 text-xs text-foreground/70">
          <li>
            <span className="font-semibold text-navy">Даты:</span> {tour.dates}
          </li>
          <li>
            <span className="font-semibold text-navy">Маршрут:</span> {tour.route}
          </li>
          <li>
            <span className="font-semibold text-navy">Отели:</span> {tour.hotels}
          </li>
          <li>
            <span className="font-semibold text-navy">Питание:</span> {tour.food}
          </li>
        </ul>

        <div className="mb-4 rounded-xl bg-gold/10 p-3 text-xs font-medium leading-relaxed text-navy">
          {tour.highlight}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-auto flex items-center justify-between gap-2 border-t border-black/5 pt-3 text-sm font-semibold text-blue"
        >
          Посмотреть программу по дням
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <p className="mt-2 text-xs leading-relaxed text-foreground/60">{tour.program}</p>
        )}
      </div>
    </article>
  );
}

export default function ChinaTours2026() {
  const [filter, setFilter] = useState<"all" | Category>("all");
  const filtered = filter === "all" ? TOURS : TOURS.filter((t) => t.category.includes(filter));

  return (
    <div>
      <section className="bg-gradient-to-b from-blue-light to-white">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-navy shadow-sm">
            🇨🇳 Авторская подборка туров в Китай на 2026 год
          </span>
          <h1 className="mt-5 text-3xl font-bold text-navy sm:text-4xl">
            Китай, который хочется увидеть своими глазами
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-foreground/70">
            Собрала маршруты для разных сценариев отдыха: первая поездка в Китай, горы Аватара, панды, Гуйлинь,
            Гонконг, пляжный Хайнань и комбинированные туры с экскурсиями.
          </p>

          <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-3">
            <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-xl font-bold text-navy">10</p>
              <p className="mt-1 text-[11px] font-medium text-foreground/50">готовых маршрутов</p>
            </div>
            <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-xl font-bold text-navy">от $917</p>
              <p className="mt-1 text-[11px] font-medium text-foreground/50">стоимость тура</p>
            </div>
            <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-xl font-bold text-navy">7–15 дней</p>
              <p className="mt-1 text-[11px] font-medium text-foreground/50">длительность</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#tours"
              className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue"
            >
              Смотреть туры
            </a>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-navy/20 px-6 py-3 text-sm font-semibold text-navy transition-colors hover:bg-blue-light"
            >
              <MessageCircle size={16} />
              Написать в WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section id="tours" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">Подборка туров</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-foreground/60">
          Используйте фильтры, чтобы быстро найти подходящий формат поездки. У каждой карточки есть
          развёрнутая программа по дням.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                filter === f.value
                  ? "border-navy bg-navy text-white"
                  : "border-black/10 bg-white text-navy hover:bg-blue-light"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tour) => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
      </section>

      <section className="bg-blue-light/40 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">Быстрое сравнение</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-foreground/60">
            Таблица помогает сразу увидеть, чем отличаются маршруты — цена, длительность, города и кому лучше
            подойдёт тур.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-navy text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Тур</th>
                  <th className="px-4 py-3 font-medium">Дней</th>
                  <th className="px-4 py-3 font-medium">Цена от</th>
                  <th className="px-4 py-3 font-medium">Маршрут</th>
                  <th className="px-4 py-3 font-medium">Лучше выбрать, если</th>
                </tr>
              </thead>
              <tbody>
                {TOURS.map((tour) => (
                  <tr key={tour.id} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy">{tour.title}</td>
                    <td className="px-4 py-3 text-foreground/70">{tour.days}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {tour.price}
                      <br />
                      <span className="text-xs text-foreground/40">{tour.rub}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{tour.route}</td>
                    <td className="px-4 py-3 text-foreground/70">{tour.bestFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-navy-dark px-6 py-12 text-white sm:px-12">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Напишите, какой Китай вам ближе</h2>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                Нажмите кнопку WhatsApp, пришлите номер понравившегося тура или просто напишите: «Хочу Китай,
                помоги выбрать». Помогу подобрать маршрут под даты, бюджет, состав туристов и темп поездки.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
              <h3 className="text-lg font-bold">Елена Севрюга</h3>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <a href="tel:+79502302555" className="flex items-center gap-2 text-white/90 hover:text-white">
                  <Phone size={16} className="text-gold" />
                  +7 950 230-25-55
                </a>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/90 hover:text-white"
                >
                  <MessageCircle size={16} className="text-gold" />
                  WhatsApp: написать Елене
                </a>
                <a
                  href="https://t.me/esevruga"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/90 hover:text-white"
                >
                  <Send size={16} className="text-gold" />
                  Telegram: @esevruga
                </a>
                <p className="flex items-center gap-2 text-white/70">
                  <MapPin size={16} className="text-gold" />
                  Пенза / онлайн по всей России
                </p>
              </div>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 block rounded-full bg-gold py-3 text-center text-sm font-semibold text-navy-dark transition-colors hover:bg-gold-dark"
              >
                Оставить заявку в WhatsApp
              </a>
              <div className="mt-3">
                <OpenLeadFormButton className="block w-full rounded-full border border-white/30 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Или оставить заявку на сайте
                </OpenLeadFormButton>
              </div>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-foreground/40">
          Цены указаны «от» и требуют проверки на момент бронирования. Итоговая стоимость зависит от даты,
          наличия мест, курса валют, состава туристов и выбранных отелей.
        </p>
      </section>

      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy-dark shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <MessageCircle size={18} />
        Написать в WhatsApp
      </a>
    </div>
  );
}
