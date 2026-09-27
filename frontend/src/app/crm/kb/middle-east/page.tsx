"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";

type CountryId = "uae" | "qatar" | "bahrain" | "saudi" | "oman";
type EmirateId = "dubai" | "abu-dhabi" | "ras-al-khaimah" | "sharjah" | "fujairah" | "ajman" | "none";
type QuickFilter =
  | "all-inclusive"
  | "good-beach"
  | "city"
  | "couples"
  | "families"
  | "entertainment"
  | "quiet"
  | "kids-club"
  | "waterpark"
  | "premium";

type CountryInfo = {
  id: CountryId;
  name: string;
  cover: string;
  short: string;
  bestFor: string[];
  sellFirst: string[];
  weather: { period: string; label: string; note: string; tone: "good" | "hot" | "ok" }[];
  regions: string[];
  attractions: { name: string; type: string; note: string }[];
  checks: string[];
};

type HotelCard = {
  id: string;
  name: string;
  country: CountryId;
  emirate?: Exclude<EmirateId, "none">;
  region: string;
  image: string;
  stars: string;
  filters: QuickFilter[];
  positioning: string;
  who: string[];
  features: string[];
  minuses: string[];
  check: string[];
};

const COUNTRIES: CountryInfo[] = [
  {
    id: "uae",
    name: "ОАЭ",
    cover: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80",
    short: "Самое гибкое направление Ближнего Востока: пляж, город, парки, шопинг, премиальные отели и короткая логистика.",
    bestFor: ["семьи", "пары", "первое знакомство с Ближним Востоком", "премиум", "короткие поездки"],
    sellFirst: ["Дубай — город + пляж + шопинг", "Абу-Даби — музеи, Яс, Саадият", "Рас-эль-Хайма — пляжные resort и all inclusive", "Фуджейра — спокойный пляж"],
    weather: [
      { period: "Окт–ноя", label: "очень комфортно", note: "лучший старт сезона: пляж, прогулки, экскурсии", tone: "good" },
      { period: "Дек–фев", label: "высокий сезон", note: "комфортно, дороже, сильный спрос", tone: "good" },
      { period: "Мар–апр", label: "комфортно", note: "хорошо для семей, пляжа и парков", tone: "good" },
      { period: "Май–сен", label: "жарко", note: "продавать через цену, бассейны, моллы и хорошие отели", tone: "hot" },
    ],
    regions: ["Дубай", "Абу-Даби", "Рас-эль-Хайма", "Шарджа", "Фуджейра", "Аджман"],
    attractions: [
      { name: "Yas Island", type: "с детьми", note: "Ferrari World, Warner Bros, Yas Waterworld" },
      { name: "Louvre Abu Dhabi", type: "культура", note: "хороший аргумент для Абу-Даби" },
      { name: "Dubai Marina / JBR", type: "город + пляж", note: "рестораны, прогулки, пляжная зона" },
      { name: "Palm Jumeirah", type: "премиум", note: "вау-отели, Atlantis, пляжный формат" },
    ],
    checks: ["депозит", "пляж и трансфер", "район отеля", "питание", "реновации", "фактическую авиапрограмму"],
  },
  {
    id: "qatar",
    name: "Катар",
    cover: "https://images.unsplash.com/photo-1568563196292-32596b8d9d8e?auto=format&fit=crop&w=1200&q=80",
    short: "Доха, городская архитектура, музеи, stopover и премиальные отели. Хорошо продавать как короткую поездку или дополнение к перелёту Qatar Airways.",
    bestFor: ["пары", "stopover", "премиум", "городской отдых", "музеи"],
    sellFirst: ["Доха", "городские 5*", "музеи", "короткие программы 2–4 ночи"],
    weather: [
      { period: "Ноя–март", label: "лучший сезон", note: "комфортно для города и экскурсий", tone: "good" },
      { period: "Апр–май", label: "тепло", note: "можно продавать, но уточнять переносимость жары", tone: "ok" },
      { period: "Июн–сен", label: "очень жарко", note: "только осознанно, через отель и городские активности", tone: "hot" },
      { period: "Окт", label: "переходный сезон", note: "лучше, чем лето, но всё ещё жарко", tone: "ok" },
    ],
    regions: ["Доха", "The Pearl", "West Bay", "Lusail"],
    attractions: [
      { name: "Museum of Islamic Art", type: "музей", note: "культура и архитектура" },
      { name: "Souq Waqif", type: "прогулки", note: "атмосферный рынок и рестораны" },
      { name: "The Pearl", type: "город", note: "марина, рестораны, прогулки" },
    ],
    checks: ["локация отеля", "алкогольная политика", "трансфер", "питание", "стыковки"],
  },
  {
    id: "bahrain",
    name: "Бахрейн",
    cover: "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80",
    short: "Небольшое направление для спокойного отдыха, городских отелей, коротких поездок и комбинирования с другими странами Персидского залива.",
    bestFor: ["короткие поездки", "пары", "спокойный городской отдых", "комбинации"],
    sellFirst: ["Манама", "городские отели", "короткая программа", "комбинация с ОАЭ/Катаром"],
    weather: [
      { period: "Ноя–март", label: "комфортно", note: "лучше для прогулок и экскурсий", tone: "good" },
      { period: "Апр–май", label: "тепло", note: "можно продавать при правильных ожиданиях", tone: "ok" },
      { period: "Июн–сен", label: "жарко", note: "не лучший период для активных прогулок", tone: "hot" },
      { period: "Окт", label: "становится лучше", note: "переход к сезону", tone: "ok" },
    ],
    regions: ["Манама", "Amwaj Islands", "Seef"],
    attractions: [
      { name: "Bahrain National Museum", type: "музей", note: "короткая культурная программа" },
      { name: "Manama Souq", type: "прогулки", note: "рынок и местный колорит" },
      { name: "Amwaj Islands", type: "пляж", note: "отели и спокойный отдых" },
    ],
    checks: ["пляжный формат", "локация", "алкогольная политика", "трансфер", "ожидания по развлечениям"],
  },
  {
    id: "saudi",
    name: "Саудовская Аравия",
    cover: "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80",
    short: "Направление для новых впечатлений, культуры, событий, Красного моря и премиальных проектов. Продавать аккуратно: важны правила страны и ожидания клиента.",
    bestFor: ["новые направления", "культура", "премиум", "события", "экскурсионный интерес"],
    sellFirst: ["Эр-Рияд", "Джидда", "Красное море", "культурные маршруты"],
    weather: [
      { period: "Ноя–март", label: "лучший период", note: "комфортнее для экскурсий", tone: "good" },
      { period: "Апр–май", label: "тепло/жарко", note: "нужно уточнять маршрут", tone: "ok" },
      { period: "Июн–сен", label: "очень жарко", note: "продавать только осознанно", tone: "hot" },
      { period: "Окт", label: "переходный период", note: "лучше для старта сезона", tone: "ok" },
    ],
    regions: ["Эр-Рияд", "Джидда", "Красное море", "Аль-Ула"],
    attractions: [
      { name: "AlUla", type: "культура", note: "ключевой экскурсионный магнит" },
      { name: "Jeddah Corniche", type: "город", note: "Красное море и прогулки" },
      { name: "Riyadh Boulevard", type: "события", note: "развлекательные кварталы" },
    ],
    checks: ["правила въезда", "дресс-код/локальные нормы", "маршрут", "уровень сервиса", "сезонность"],
  },
  {
    id: "oman",
    name: "Оман",
    cover: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?auto=format&fit=crop&w=1200&q=80",
    short: "Более спокойный и природный Ближний Восток: горы, море, Маскат, экскурсии, уединённые отели и мягкий премиум без суеты Дубая.",
    bestFor: ["пары", "спокойный премиум", "природа", "экскурсии", "небанальное направление"],
    sellFirst: ["Маскат", "пляжные отели", "горы", "экскурсионные маршруты"],
    weather: [
      { period: "Окт–апр", label: "лучший сезон", note: "комфортно для моря и экскурсий", tone: "good" },
      { period: "Май–июн", label: "жарко", note: "нужна аккуратная продажа", tone: "hot" },
      { period: "Июл–авг", label: "зависит от региона", note: "в Салале сезон харифа, в других регионах жарко", tone: "ok" },
      { period: "Сен", label: "переходный", note: "становится лучше ближе к октябрю", tone: "ok" },
    ],
    regions: ["Маскат", "Салала", "Джебель-Ахдар", "Мусандам"],
    attractions: [
      { name: "Sultan Qaboos Grand Mosque", type: "культура", note: "главная точка Маската" },
      { name: "Jebel Akhdar", type: "горы", note: "природа и премиальные отели" },
      { name: "Wadi Shab", type: "природа", note: "маршрут для активных туристов" },
    ],
    checks: ["регион и сезон", "трансфер", "пляж", "питание", "уровень уединённости"],
  },
];

const EMIRATES: { id: Exclude<EmirateId, "none">; name: string }[] = [
  { id: "dubai", name: "Дубай" },
  { id: "abu-dhabi", name: "Абу-Даби" },
  { id: "ras-al-khaimah", name: "Рас-эль-Хайма" },
  { id: "sharjah", name: "Шарджа" },
  { id: "fujairah", name: "Фуджейра" },
  { id: "ajman", name: "Аджман" },
];

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "all-inclusive", label: "All inclusive" },
  { id: "good-beach", label: "Хороший пляж" },
  { id: "city", label: "Городские" },
  { id: "couples", label: "Для пар" },
  { id: "families", label: "Для семей" },
  { id: "entertainment", label: "С программой" },
  { id: "quiet", label: "Без активной программы" },
  { id: "kids-club", label: "Детский клуб" },
  { id: "waterpark", label: "Аквапарк" },
  { id: "premium", label: "Премиум" },
];

const HOTELS: HotelCard[] = [
  {
    id: "rixos-bab-al-bahr",
    name: "Rixos Bab Al Bahr 5*",
    country: "uae",
    emirate: "ras-al-khaimah",
    region: "Al Marjan Island",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80",
    stars: "5*",
    filters: ["all-inclusive", "good-beach", "families", "entertainment", "kids-club"],
    positioning: "Семейный пляжный resort с all inclusive в Рас-эль-Хайме.",
    who: ["семьям с детьми", "тем, кто хочет all inclusive", "туристам, которым нужен отельный отдых без частых выездов"],
    features: ["all inclusive", "собственный пляж", "семейная инфраструктура", "активный формат"],
    minuses: ["далеко от Дубая", "не городской отдых", "проверять депозит и фактический формат питания"],
    check: ["депозит", "питание", "детскую программу", "трансфер", "категорию номера"],
  },
  {
    id: "doubletree-marjan-island",
    name: "DoubleTree by Hilton Resort & Spa Marjan Island 5*",
    country: "uae",
    emirate: "ras-al-khaimah",
    region: "Al Marjan Island",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80",
    stars: "5*",
    filters: ["all-inclusive", "good-beach", "families", "kids-club", "waterpark", "entertainment"],
    positioning: "Пляжный семейный resort на острове Аль-Марджан с активностями для детей.",
    who: ["семьям", "клиентам с запросом на пляж + дети", "туристам, которым Дубай дорогой или слишком городской"],
    features: ["детская инфраструктура", "пляж", "территория", "можно продавать как альтернативу Турции"],
    minuses: ["до Дубая далеко", "загрузка зависит от сезона", "нужно проверять питание"],
    check: ["тип питания", "детский клуб", "аквапарк", "депозит", "реновации"],
  },
  {
    id: "riu-dubai",
    name: "Hotel Riu Dubai 4*",
    country: "uae",
    emirate: "dubai",
    region: "Deira Islands",
    image: "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=900&q=80",
    stars: "4*",
    filters: ["all-inclusive", "good-beach", "families", "entertainment", "kids-club"],
    positioning: "Один из понятных вариантов Дубая для запроса all inclusive.",
    who: ["семьям", "туристам, которые хотят Дубай и all inclusive", "клиентам, привыкшим к Турции"],
    features: ["all inclusive", "пляжный формат", "понятный семейный продукт", "Дубай"],
    minuses: ["локация не JBR/Marina", "до части достопримечательностей нужна логистика", "не luxury"],
    check: ["трансфер", "пляж", "условия all inclusive", "депозит", "ожидания по уровню"],
  },
  {
    id: "atlantis-the-palm",
    name: "Atlantis The Palm 5*",
    country: "uae",
    emirate: "dubai",
    region: "Palm Jumeirah",
    image: "https://images.unsplash.com/photo-1582672060674-bc2bd808a8b5?auto=format&fit=crop&w=900&q=80",
    stars: "5*",
    filters: ["good-beach", "families", "premium", "waterpark", "entertainment", "kids-club"],
    positioning: "Знаковый отель Дубая для вау-эффекта, семей и развлечений.",
    who: ["семьям с детьми", "премиум-клиентам", "тем, кто хочет отель-аттракцион"],
    features: ["аквапарк", "сильный бренд", "собственный пляж", "вау-эффект"],
    minuses: ["высокий чек", "много гостей", "не для тихого отдыха"],
    check: ["условия аквапарка", "питание", "депозит", "категорию номера", "загрузку на даты"],
  },
  {
    id: "address-beach-resort",
    name: "Address Beach Resort 5*",
    country: "uae",
    emirate: "dubai",
    region: "JBR / Dubai Marina",
    image: "https://images.unsplash.com/photo-1526495124232-a04e1849168c?auto=format&fit=crop&w=900&q=80",
    stars: "5*",
    filters: ["good-beach", "city", "couples", "premium"],
    positioning: "Премиальный городской пляжный отель в зоне JBR/Marina.",
    who: ["парам", "тем, кому нужны рестораны и прогулки", "клиентам, которые хотят пляж + город"],
    features: ["локация JBR/Marina", "город + пляж", "красивый визуальный формат", "премиальный уровень"],
    minuses: ["не all inclusive", "район активный", "цена выше среднего"],
    check: ["пляжные условия", "депозит", "питание", "вид из номера", "локацию относительно нужных мест"],
  },
  {
    id: "anantara-santorini-abu-dhabi",
    name: "Anantara Santorini Abu Dhabi Retreat 5*",
    country: "uae",
    emirate: "abu-dhabi",
    region: "Ghantoot / между Дубаем и Абу-Даби",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=80",
    stars: "5*",
    filters: ["good-beach", "couples", "premium", "quiet"],
    positioning: "Камерный премиальный retreat для пар и спокойного отдыха.",
    who: ["парам", "премиум-клиентам", "туристам без запроса на массовую анимацию"],
    features: ["камерность", "премиальный формат", "спокойная атмосфера", "романтический отдых"],
    minuses: ["не для активных семей", "не all inclusive", "нужно объяснять локацию"],
    check: ["возрастные/семейные ограничения", "питание", "депозит", "трансфер", "ожидания по развлечениям"],
  },
];

function countryName(id: CountryId) {
  return COUNTRIES.find((country) => country.id === id)?.name ?? id;
}

function emirateName(id?: EmirateId) {
  if (!id || id === "none") return "";
  return EMIRATES.find((emirate) => emirate.id === id)?.name ?? id;
}

function toneClass(tone: CountryInfo["weather"][number]["tone"]) {
  if (tone === "good") return "bg-emerald-50 text-emerald-800 border-emerald-100";
  if (tone === "hot") return "bg-orange-50 text-orange-800 border-orange-100";
  return "bg-blue-light/50 text-navy border-blue/10";
}

export default function MiddleEastStructuredKbPage() {
  const [query, setQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryId | "all">("all");
  const [selectedEmirate, setSelectedEmirate] = useState<EmirateId | "all">("all");
  const [activeFilters, setActiveFilters] = useState<QuickFilter[]>([]);
  const [showCountryBlock, setShowCountryBlock] = useState(true);
  const [openCountry, setOpenCountry] = useState<CountryId>("uae");

  const filteredHotels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HOTELS.filter((hotel) => {
      const haystack = [
        hotel.name,
        countryName(hotel.country),
        emirateName(hotel.emirate),
        hotel.region,
        hotel.positioning,
        ...hotel.who,
        ...hotel.features,
        ...hotel.minuses,
        ...hotel.check,
        ...hotel.filters,
      ]
        .join(" ")
        .toLowerCase();
      const countryOk = selectedCountry === "all" || hotel.country === selectedCountry;
      const emirateOk = selectedEmirate === "all" || hotel.emirate === selectedEmirate;
      const filtersOk = activeFilters.every((filter) => hotel.filters.includes(filter));
      const queryOk = !q || haystack.includes(q);
      return countryOk && emirateOk && filtersOk && queryOk;
    });
  }, [query, selectedCountry, selectedEmirate, activeFilters]);

  function toggleFilter(filter: QuickFilter) {
    setActiveFilters((current) => (current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]));
  }

  function clearFilters() {
    setQuery("");
    setSelectedCountry("all");
    setSelectedEmirate("all");
    setActiveFilters([]);
  }

  const selectedCountryInfo = COUNTRIES.find((country) => country.id === openCountry) ?? COUNTRIES[0];

  return (
    <div className="pb-10">
      <Link href="/crm/knowledge-base" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground/50 hover:text-navy">
        <ArrowLeft size={15} />
        База знаний
      </Link>

      <section className="overflow-hidden rounded-3xl border border-blue/10 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_.65fr]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-blue">Структурная база</p>
            <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">Ближний Восток: страны, эмираты и отели</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/65">
              Отдельная база для быстрого подбора: страны, погодный календарь, достопримечательности, эмираты внутри ОАЭ и фильтры по отелям — all inclusive, пляж, город, пары, семьи, развлечения и минусы.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-blue-light/50 p-3">
                <p className="text-xs text-foreground/50">Страны</p>
                <p className="text-xl font-bold text-navy">{COUNTRIES.length}</p>
              </div>
              <div className="rounded-2xl bg-blue-light/50 p-3">
                <p className="text-xs text-foreground/50">Эмираты ОАЭ</p>
                <p className="text-xl font-bold text-navy">{EMIRATES.length}</p>
              </div>
              <div className="rounded-2xl bg-blue-light/50 p-3">
                <p className="text-xs text-foreground/50">Отели в структуре</p>
                <p className="text-xl font-bold text-navy">{HOTELS.length}</p>
              </div>
              <div className="rounded-2xl bg-blue-light/50 p-3">
                <p className="text-xs text-foreground/50">Найдено</p>
                <p className="text-xl font-bold text-navy">{filteredHotels.length}</p>
              </div>
            </div>
          </div>
          <div className="min-h-[260px] bg-blue-light">
            <img src="https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80" alt="Ближний Восток" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setShowCountryBlock((value) => !value)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 className="text-lg font-bold text-navy">Страны: погода, регионы и достопримечательности</h2>
            <p className="mt-1 text-sm text-foreground/50">Этот блок можно скрыть, если нужен только быстрый поиск отелей.</p>
          </div>
          {showCountryBlock ? <ChevronUp size={20} className="text-navy/50" /> : <ChevronDown size={20} className="text-navy/50" />}
        </button>

        {showCountryBlock && (
          <div className="mt-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {COUNTRIES.map((country) => (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => setOpenCountry(country.id)}
                  className={`overflow-hidden rounded-2xl border text-left transition ${openCountry === country.id ? "border-blue bg-blue-light/40" : "border-black/5 bg-white hover:border-blue/30"}`}
                >
                  <div className="h-24 bg-blue-light">
                    <img src={country.cover} alt={country.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-navy">{country.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground/55">{country.short}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-3xl border border-blue/10 bg-gradient-to-br from-blue-light/45 to-white p-5">
              <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-blue">{selectedCountryInfo.name}</p>
                  <h3 className="mt-1 text-xl font-bold text-navy">Кратко о стране</h3>
                  <p className="mt-3 text-sm leading-6 text-foreground/70">{selectedCountryInfo.short}</p>

                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-foreground/45">Кому продавать</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCountryInfo.bestFor.map((item) => (
                        <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-foreground/45">Что продавать в первую очередь</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-foreground/70">
                      {selectedCountryInfo.sellFirst.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="mb-3 text-sm font-bold text-navy">Погодный календарь</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedCountryInfo.weather.map((item) => (
                        <div key={item.period} className={`rounded-2xl border p-3 ${toneClass(item.tone)}`}>
                          <p className="text-sm font-bold">{item.period}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-75">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 opacity-80">{item.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-navy">Регионы / эмираты</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedCountryInfo.regions.map((region) => (
                          <span key={region} className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-navy/75">{region}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-navy">Проверить перед продажей</p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-foreground/70">
                        {selectedCountryInfo.checks.map((item) => <li key={item}>□ {item}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-sm font-bold text-navy">Достопримечательности и аргументы</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {selectedCountryInfo.attractions.map((item) => (
                        <div key={item.name} className="rounded-2xl border border-black/5 bg-cream/50 p-3">
                          <p className="text-sm font-bold text-navy">{item.name}</p>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-blue">{item.type}</p>
                          <p className="mt-1 text-xs leading-5 text-foreground/65">{item.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="sticky top-0 z-10 mt-5 rounded-3xl border border-black/5 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти: all inclusive, хороший пляж, Дубай, пары, детский клуб, минусы…"
              className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedCountry} onChange={(event) => setSelectedCountry(event.target.value as CountryId | "all")} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-blue">
              <option value="all">Все страны</option>
              {COUNTRIES.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
            </select>
            <select value={selectedEmirate} onChange={(event) => setSelectedEmirate(event.target.value as EmirateId | "all")} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-blue">
              <option value="all">Все эмираты ОАЭ</option>
              {EMIRATES.map((emirate) => <option key={emirate.id} value={emirate.id}>{emirate.name}</option>)}
            </select>
            {(query || selectedCountry !== "all" || selectedEmirate !== "all" || activeFilters.length > 0) && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-xl border border-black/10 px-3 py-2 text-sm text-foreground/60 hover:bg-blue-light/40">
                <X size={14} /> сбросить
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-navy/70">
            <SlidersHorizontal size={13} /> быстрые фильтры
          </span>
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => toggleFilter(filter.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeFilters.includes(filter.id) ? "bg-navy text-white" : "bg-blue-light/60 text-navy hover:bg-blue-light"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-navy">Отели: {filteredHotels.length}</h2>
          <p className="text-xs text-foreground/40">Фотографии используются как визуальные обложки. Точные фото отелей лучше заменить при наполнении базы.</p>
        </div>

        {filteredHotels.length === 0 ? (
          <div className="rounded-3xl border border-black/5 bg-white p-8 text-sm text-foreground/55">По выбранным фильтрам отелей нет. Сбрось часть фильтров или уточни поиск.</div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredHotels.map((hotel) => (
              <article key={hotel.id} className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
                <div className="grid md:grid-cols-[260px_1fr]">
                  <div className="relative min-h-[230px] bg-blue-light">
                    <img src={hotel.image} alt={hotel.name} className="h-full w-full object-cover" />
                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy shadow-sm">{hotel.stars}</div>
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-blue-light px-2.5 py-1 text-[11px] font-semibold text-navy">{countryName(hotel.country)}</span>
                      {hotel.emirate && <span className="rounded-full bg-blue-light px-2.5 py-1 text-[11px] font-semibold text-navy">{emirateName(hotel.emirate)}</span>}
                      <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-navy/70">{hotel.region}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-navy">{hotel.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/70">{hotel.positioning}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {hotel.filters.map((filter) => (
                        <span key={filter} className="rounded-full border border-blue/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue">
                          {QUICK_FILTERS.find((item) => item.id === filter)?.label ?? filter}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-emerald-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Кому предлагать</p>
                        <ul className="mt-1 space-y-1 text-xs leading-5 text-emerald-900/80">
                          {hotel.who.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-blue-light/50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-navy/60">Фишки</p>
                        <ul className="mt-1 space-y-1 text-xs leading-5 text-foreground/70">
                          {hotel.features.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-orange-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-orange-800">Минусы / осторожно</p>
                        <ul className="mt-1 space-y-1 text-xs leading-5 text-orange-900/80">
                          {hotel.minuses.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-cream p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-navy/60">Проверить</p>
                        <ul className="mt-1 space-y-1 text-xs leading-5 text-foreground/70">
                          {hotel.check.map((item) => <li key={item}>□ {item}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
