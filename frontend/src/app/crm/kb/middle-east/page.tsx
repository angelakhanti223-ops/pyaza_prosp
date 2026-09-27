"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Search, SlidersHorizontal, X } from "lucide-react";

type CountryId = "uae" | "qatar" | "bahrain" | "saudi" | "oman";
type EmirateId = "dubai" | "abu-dhabi" | "ras-al-khaimah" | "sharjah" | "fujairah" | "ajman";
type HotelType = "beach" | "city" | "resort" | "island" | "family" | "premium";
type Audience = "families" | "couples" | "premium" | "active" | "budget" | "quiet";
type MealTag = "all-inclusive" | "breakfast" | "half-board" | "ultra-all-inclusive" | "not-ai";
type BeachTag = "good-beach" | "own-beach" | "public-beach" | "no-beach" | "beach-shuttle";
type EntertainmentTag = "entertainment" | "quiet" | "kids-club" | "waterpark" | "near-parks" | "city-entertainment";

type HotelCard = {
  id: string;
  name: string;
  country: CountryId;
  emirate?: EmirateId;
  region: string;
  stars?: string;
  hotelTypes: HotelType[];
  meals: MealTag[];
  beach: BeachTag[];
  audience: Audience[];
  entertainment: EntertainmentTag[];
  positioning: string;
  who: string[];
  features: string[];
  minuses: string[];
  check: string[];
  search: string;
};

const COUNTRIES: Record<CountryId, string> = {
  uae: "ОАЭ",
  qatar: "Катар",
  bahrain: "Бахрейн",
  saudi: "Саудовская Аравия",
  oman: "Оман",
};

const EMIRATES: Record<EmirateId, string> = {
  dubai: "Дубай",
  "abu-dhabi": "Абу-Даби",
  "ras-al-khaimah": "Рас-эль-Хайма",
  sharjah: "Шарджа",
  fujairah: "Фуджейра",
  ajman: "Аджман",
};

const FILTERS = [
  { id: "all-inclusive", label: "All inclusive" },
  { id: "good-beach", label: "Хороший пляж" },
  { id: "city", label: "Городские отели" },
  { id: "couples", label: "Для пар" },
  { id: "families", label: "Для семей" },
  { id: "entertainment", label: "С программой" },
  { id: "quiet", label: "Без активной программы" },
  { id: "kids-club", label: "Детский клуб" },
  { id: "waterpark", label: "Аквапарк" },
  { id: "premium", label: "Премиум" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const HOTELS: HotelCard[] = [
  {
    id: "rixos-bab-al-bahr",
    name: "Rixos Bab Al Bahr 5*",
    country: "uae",
    emirate: "ras-al-khaimah",
    region: "Al Marjan Island",
    stars: "5*",
    hotelTypes: ["beach", "resort", "family"],
    meals: ["all-inclusive", "ultra-all-inclusive"],
    beach: ["good-beach", "own-beach"],
    audience: ["families", "active"],
    entertainment: ["entertainment", "kids-club"],
    positioning: "Семейный пляжный resort с all inclusive в Рас-эль-Хайме.",
    who: ["семьям с детьми", "туристам, которым нужен all inclusive", "тем, кто хочет пляжный отдых спокойнее Дубая"],
    features: ["формат all inclusive", "сильный семейный сценарий", "собственный пляж", "подходит для отдыха без частых выездов"],
    minuses: ["далеко от Дубая", "не городской отдых", "важно проверять депозит и актуальный формат питания"],
    check: ["депозит", "тип номера", "условия all inclusive", "трансфер из аэропорта", "актуальную программу для детей"],
    search: "риксос rixos bab al bahr рас аль хайма all inclusive семьи пляж дети программа",
  },
  {
    id: "doubletree-marjan-island",
    name: "DoubleTree by Hilton Resort & Spa Marjan Island 5*",
    country: "uae",
    emirate: "ras-al-khaimah",
    region: "Al Marjan Island",
    stars: "5*",
    hotelTypes: ["beach", "resort", "family"],
    meals: ["all-inclusive", "half-board"],
    beach: ["good-beach", "own-beach"],
    audience: ["families", "active"],
    entertainment: ["kids-club", "waterpark", "entertainment"],
    positioning: "Пляжный семейный resort на острове Аль-Марджан с активностями для детей.",
    who: ["семьям", "клиентам, которым нужен пляж + детская инфраструктура", "тем, кто рассматривает Рас-эль-Хайму вместо Дубая"],
    features: ["детская инфраструктура", "пляжный формат", "территория", "можно продавать как семейную альтернативу Турции"],
    minuses: ["до Дубая далеко", "активность и загрузка зависят от сезона", "нужно проверять питание и категорию номера"],
    check: ["наличие нужного питания", "детский клуб", "депозит", "трансфер", "реновации/закрытия зон"],
    search: "doubletree hilton marjan island рас аль хайма семьи дети пляж аквапарк all inclusive",
  },
  {
    id: "hampton-marjan-island",
    name: "Hampton by Hilton Marjan Island 4*",
    country: "uae",
    emirate: "ras-al-khaimah",
    region: "Al Marjan Island",
    stars: "4*",
    hotelTypes: ["beach", "resort"],
    meals: ["breakfast", "half-board", "all-inclusive"],
    beach: ["good-beach", "own-beach"],
    audience: ["families", "couples", "budget"],
    entertainment: ["quiet"],
    positioning: "Более простой и понятный пляжный вариант на Аль-Марджан для спокойного отдыха.",
    who: ["парам", "семьям без запроса на luxury", "туристам, которым нужен пляж по более мягкому бюджету"],
    features: ["пляжный формат", "понятная сетка Hilton", "хорошо для спокойного отдыха"],
    minuses: ["не luxury", "не городской отдых", "развлекательная программа может быть ограниченной"],
    check: ["какое питание доступно", "пляжные условия", "депозит", "трансфер", "состав гостей и ожидания по развлечениям"],
    search: "hampton hilton marjan island пляж пары семьи бюджет спокойно all inclusive",
  },
  {
    id: "atlantis-the-palm",
    name: "Atlantis The Palm 5*",
    country: "uae",
    emirate: "dubai",
    region: "Palm Jumeirah",
    stars: "5*",
    hotelTypes: ["beach", "premium", "family", "resort"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["good-beach", "own-beach"],
    audience: ["families", "premium", "active"],
    entertainment: ["waterpark", "kids-club", "entertainment", "near-parks"],
    positioning: "Знаковый отель Дубая для вау-эффекта, семей и развлечений.",
    who: ["семьям с детьми", "премиум-клиентам", "туристам, которым нужен отель-аттракцион"],
    features: ["аквапарк и развлечения", "сильный бренд", "собственный пляж", "подходит для первого яркого знакомства с Дубаем"],
    minuses: ["высокий чек", "много гостей", "не для тихого уединенного отдыха"],
    check: ["условия входа в аквапарк", "питание", "депозит", "категорию номера", "загруженность на даты"],
    search: "atlantis palm дубай пальма аквапарк семьи премиум пляж развлечения",
  },
  {
    id: "address-beach-resort",
    name: "Address Beach Resort 5*",
    country: "uae",
    emirate: "dubai",
    region: "JBR / Dubai Marina",
    stars: "5*",
    hotelTypes: ["beach", "city", "premium"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["good-beach", "public-beach"],
    audience: ["couples", "premium", "active"],
    entertainment: ["city-entertainment"],
    positioning: "Премиальный городской пляжный отель в зоне JBR/Marina.",
    who: ["парам", "клиентам, которым важны рестораны и городская инфраструктура", "туристам, которые хотят пляж + прогулки"],
    features: ["локация JBR/Marina", "город + пляж", "премиальный визуальный формат", "подходит для красивого отдыха и контента"],
    minuses: ["не all inclusive", "район активный", "цена выше среднего"],
    check: ["пляжные условия", "депозит", "питание", "вид из номера", "пешую доступность нужной инфраструктуры"],
    search: "address beach resort дубай jbr marina пары город пляж премиум",
  },
  {
    id: "riu-dubai",
    name: "Hotel Riu Dubai 4*",
    country: "uae",
    emirate: "dubai",
    region: "Deira Islands",
    stars: "4*",
    hotelTypes: ["beach", "resort", "family"],
    meals: ["all-inclusive"],
    beach: ["own-beach", "good-beach"],
    audience: ["families", "budget", "active"],
    entertainment: ["entertainment", "kids-club"],
    positioning: "Один из понятных вариантов Дубая для запроса all inclusive.",
    who: ["семьям", "туристам, которые хотят Дубай, но просят all inclusive", "клиентам, которым важен пляжный формат"],
    features: ["all inclusive", "пляжный формат", "подходит для семей", "проще объяснять туристам, привыкшим к Турции"],
    minuses: ["локация не JBR/Marina", "до части достопримечательностей нужна логистика", "не luxury"],
    check: ["трансфер/такси до нужных мест", "условия all inclusive", "пляж", "депозит", "ожидания по уровню отеля"],
    search: "riu dubai all inclusive дубай семьи пляж дейра deira islands",
  },
  {
    id: "anantara-santorini-abu-dhabi",
    name: "Anantara Santorini Abu Dhabi Retreat 5*",
    country: "uae",
    emirate: "abu-dhabi",
    region: "Ghantoot / между Дубаем и Абу-Даби",
    stars: "5*",
    hotelTypes: ["beach", "premium", "resort"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["own-beach", "good-beach"],
    audience: ["couples", "premium", "quiet"],
    entertainment: ["quiet"],
    positioning: "Камерный премиальный retreat для пар и спокойного отдыха.",
    who: ["парам", "премиум-клиентам", "туристам, которым нужен спокойный отель без массовой анимации"],
    features: ["камерность", "премиальный формат", "спокойная атмосфера", "подходит для романтического отдыха"],
    minuses: ["не для активных семей", "не all inclusive", "нужно объяснять локацию"],
    check: ["возрастные/семейные ограничения", "питание", "депозит", "трансфер", "ожидания по развлечениям"],
    search: "anantara santorini abu dhabi couples пары премиум тихий пляж retreat",
  },
  {
    id: "emirates-palace-mandarin",
    name: "Emirates Palace Mandarin Oriental Abu Dhabi 5*",
    country: "uae",
    emirate: "abu-dhabi",
    region: "Abu Dhabi Corniche",
    stars: "5*",
    hotelTypes: ["beach", "premium"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["own-beach", "good-beach"],
    audience: ["premium", "couples", "families"],
    entertainment: ["quiet"],
    positioning: "Иконический luxury-отель Абу-Даби для премиального пляжного отдыха.",
    who: ["премиум-клиентам", "парам", "семьям с высоким бюджетом", "туристам, которым важен статус отеля"],
    features: ["сильный luxury-бренд", "пляж", "архитектура", "подходит для статусной продажи"],
    minuses: ["высокий чек", "не all inclusive", "не формат активной анимации"],
    check: ["депозит", "питание", "категорию номера", "пляжные условия", "дресс-код/рестораны"],
    search: "emirates palace mandarin oriental abu dhabi премиум luxury пляж пары семьи",
  },
  {
    id: "saadiyat-rotana",
    name: "Saadiyat Rotana Resort & Villas 5*",
    country: "uae",
    emirate: "abu-dhabi",
    region: "Saadiyat Island",
    stars: "5*",
    hotelTypes: ["beach", "premium", "family"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["own-beach", "good-beach"],
    audience: ["families", "couples", "premium"],
    entertainment: ["kids-club", "quiet"],
    positioning: "Пляжный resort на Саадияте с хорошим морем и спокойным премиальным форматом.",
    who: ["семьям", "парам", "клиентам, которым важен качественный пляж", "тем, кто хочет спокойнее Дубая"],
    features: ["Саадият", "пляж", "подходит для спокойного отдыха", "есть семейный сценарий"],
    minuses: ["не городской Дубай", "не all inclusive", "цена зависит от сезона"],
    check: ["пляж/море на даты", "детская инфраструктура", "депозит", "питание", "трансфер до парков/музеев"],
    search: "saadiyat rotana abu dhabi саадият пляж семьи пары премиум",
  },
  {
    id: "fairmont-bab-al-bahr",
    name: "Fairmont Bab Al Bahr 5*",
    country: "uae",
    emirate: "abu-dhabi",
    region: "Abu Dhabi / Creek",
    stars: "5*",
    hotelTypes: ["city", "beach", "premium"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["own-beach"],
    audience: ["families", "couples", "premium"],
    entertainment: ["quiet"],
    positioning: "Городской 5* у воды в Абу-Даби, удобный для комбинирования пляжа и города.",
    who: ["парам", "семьям", "клиентам, которым нужен комфортный city + beach формат"],
    features: ["виды", "городская логистика", "пляжный элемент", "хорошо для спокойного отдыха"],
    minuses: ["не островной resort", "не all inclusive", "нужно проверять пляжные ожидания клиента"],
    check: ["пляж", "питание", "депозит", "локацию относительно нужных объектов", "тип номера"],
    search: "fairmont bab al bahr abu dhabi city beach пары семьи премиум",
  },
  {
    id: "bahi-ajman-palace",
    name: "Bahi Ajman Palace 5*",
    country: "uae",
    emirate: "ajman",
    region: "Ajman Beach",
    stars: "5*",
    hotelTypes: ["beach", "resort"],
    meals: ["breakfast", "half-board", "all-inclusive"],
    beach: ["own-beach", "good-beach"],
    audience: ["families", "couples", "budget", "quiet"],
    entertainment: ["quiet"],
    positioning: "Пляжный вариант в Аджмане для спокойного отдыха и более мягкого бюджета.",
    who: ["семьям", "парам", "туристам, которым нужен пляж без активного Дубая", "клиентам с ограниченным бюджетом на ОАЭ"],
    features: ["пляж", "спокойнее Дубая", "часто бюджетнее популярных зон", "можно рассматривать для размеренного отдыха"],
    minuses: ["меньше городской инфраструктуры", "до Дубая нужна логистика", "развлечения ограничены"],
    check: ["питание", "трансфер до Дубая", "пляж", "депозит", "ожидания по активности"],
    search: "bahi ajman palace аджман пляж семьи пары all inclusive спокойно",
  },
  {
    id: "intercontinental-doha-beach",
    name: "InterContinental Doha Beach & Spa 5*",
    country: "qatar",
    region: "Doha / West Bay Lagoon",
    stars: "5*",
    hotelTypes: ["beach", "city", "premium"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["own-beach", "good-beach"],
    audience: ["couples", "families", "premium"],
    entertainment: ["city-entertainment"],
    positioning: "Доха: городской 5* с пляжем для комбинации пляжа, ресторанов и города.",
    who: ["парам", "семьям", "премиум-клиентам", "тем, кто хочет Катар не только как транзит"],
    features: ["пляж в городе", "рестораны", "удобно для Дохи", "подходит для короткого отдыха"],
    minuses: ["не all inclusive", "не массовый курортный формат", "важно проверять правила и сезон"],
    check: ["пляж", "питание", "депозит", "локацию", "правила въезда и перелёт"],
    search: "intercontinental doha beach qatar катар доха пляж город пары семьи",
  },
  {
    id: "banana-island-doha",
    name: "Banana Island Resort Doha by Anantara 5*",
    country: "qatar",
    region: "Banana Island",
    stars: "5*",
    hotelTypes: ["island", "beach", "premium", "resort"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["own-beach", "good-beach"],
    audience: ["couples", "families", "premium", "quiet"],
    entertainment: ["quiet", "kids-club"],
    positioning: "Островной resort в Катаре для пляжа и спокойного премиального отдыха.",
    who: ["парам", "семьям", "премиум-клиентам", "тем, кто хочет островной формат рядом с Дохой"],
    features: ["остров", "пляж", "уединение", "премиальный формат"],
    minuses: ["не городской отель", "логистика на остров", "не all inclusive"],
    check: ["трансфер на остров", "питание", "депозит", "детскую инфраструктуру", "погодные условия"],
    search: "banana island anantara doha qatar остров пляж пары семьи премиум тихий",
  },
  {
    id: "ritz-carlton-bahrain",
    name: "The Ritz-Carlton Bahrain 5*",
    country: "bahrain",
    region: "Manama / Seef",
    stars: "5*",
    hotelTypes: ["beach", "city", "premium"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["own-beach", "good-beach"],
    audience: ["couples", "premium", "families"],
    entertainment: ["quiet", "city-entertainment"],
    positioning: "Премиальный city + beach в Бахрейне.",
    who: ["парам", "премиум-клиентам", "семьям с запросом на высокий уровень", "коротким поездкам"],
    features: ["пляж", "городская локация", "сильный бренд", "подходит для короткого премиального отдыха"],
    minuses: ["не all inclusive", "Бахрейн нужно правильно позиционировать", "не массовое пляжное направление"],
    check: ["питание", "пляж", "депозит", "перелёт", "ожидания клиента от направления"],
    search: "ritz carlton bahrain бахрейн манама пляж город пары премиум",
  },
  {
    id: "shangri-la-al-husn-oman",
    name: "Shangri-La Al Husn, Muscat 5*",
    country: "oman",
    region: "Muscat",
    stars: "5*",
    hotelTypes: ["beach", "premium", "resort"],
    meals: ["breakfast", "half-board", "not-ai"],
    beach: ["own-beach", "good-beach"],
    audience: ["couples", "premium", "quiet"],
    entertainment: ["quiet"],
    positioning: "Спокойный премиальный пляжный отдых в Омане.",
    who: ["парам", "премиум-клиентам", "туристам, которым нужен не Дубай", "клиентам на спокойный отпуск"],
    features: ["природа и море", "спокойствие", "премиальный сервис", "не массовое направление"],
    minuses: ["не all inclusive", "меньше развлечений", "нужно проверять перелёт и сезон"],
    check: ["питание", "пляж", "трансфер", "сезон", "ожидания по вечерней жизни"],
    search: "shangri la al husn oman оман маскат пляж пары премиум тихий",
  },
  {
    id: "rixos-obhur-jeddah",
    name: "Rixos Obhur Jeddah Resort & Villas 5*",
    country: "saudi",
    region: "Jeddah / Red Sea",
    stars: "5*",
    hotelTypes: ["beach", "resort", "family"],
    meals: ["all-inclusive"],
    beach: ["own-beach", "good-beach"],
    audience: ["families", "premium", "active"],
    entertainment: ["entertainment", "kids-club"],
    positioning: "Пляжный resort в Саудовской Аравии с понятным all inclusive форматом.",
    who: ["семьям", "клиентам, которые хотят новый формат Красного моря", "тем, кому важен all inclusive"],
    features: ["all inclusive", "пляжный формат", "семейный resort", "новое направление для повторных туристов"],
    minuses: ["направление требует аккуратного объяснения", "проверять правила и перелёт", "не всем подходит по ожиданиям"],
    check: ["правила въезда", "перелёт", "питание", "пляж", "культурные особенности"],
    search: "rixos obhur jeddah саудовская аравия джидда all inclusive семьи пляж",
  },
];

function hasFilter(hotel: HotelCard, filter: FilterId) {
  if (filter === "all-inclusive") return hotel.meals.includes("all-inclusive") || hotel.meals.includes("ultra-all-inclusive");
  if (filter === "good-beach") return hotel.beach.includes("good-beach") || hotel.beach.includes("own-beach");
  if (filter === "city") return hotel.hotelTypes.includes("city");
  if (filter === "couples") return hotel.audience.includes("couples");
  if (filter === "families") return hotel.audience.includes("families");
  if (filter === "premium") return hotel.audience.includes("premium") || hotel.hotelTypes.includes("premium");
  if (filter === "entertainment") return hotel.entertainment.includes("entertainment") || hotel.entertainment.includes("city-entertainment") || hotel.entertainment.includes("near-parks");
  if (filter === "quiet") return hotel.entertainment.includes("quiet");
  if (filter === "kids-club") return hotel.entertainment.includes("kids-club");
  if (filter === "waterpark") return hotel.entertainment.includes("waterpark");
  return false;
}

function labelList(values: string[]) {
  return values.join(" · ");
}

export default function MiddleEastKnowledgePage() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<CountryId | "all">("all");
  const [emirate, setEmirate] = useState<EmirateId | "all">("all");
  const [filters, setFilters] = useState<FilterId[]>([]);

  const filteredHotels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HOTELS.filter((hotel) => {
      if (country !== "all" && hotel.country !== country) return false;
      if (emirate !== "all" && hotel.emirate !== emirate) return false;
      if (filters.length && !filters.every((filter) => hasFilter(hotel, filter))) return false;
      const haystack = `${hotel.name} ${COUNTRIES[hotel.country]} ${hotel.emirate ? EMIRATES[hotel.emirate] : ""} ${hotel.region} ${hotel.positioning} ${hotel.search} ${hotel.who.join(" ")} ${hotel.features.join(" ")} ${hotel.minuses.join(" ")}`.toLowerCase();
      return !q || haystack.includes(q);
    });
  }, [query, country, emirate, filters]);

  const grouped = useMemo(() => {
    const result = new Map<string, HotelCard[]>();
    for (const hotel of filteredHotels) {
      const key = hotel.country === "uae" && hotel.emirate ? `${COUNTRIES.uae} / ${EMIRATES[hotel.emirate]}` : COUNTRIES[hotel.country];
      result.set(key, [...(result.get(key) ?? []), hotel]);
    }
    return Array.from(result.entries());
  }, [filteredHotels]);

  function toggleFilter(id: FilterId) {
    setFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function resetFilters() {
    setQuery("");
    setCountry("all");
    setEmirate("all");
    setFilters([]);
  }

  return (
    <div className="pb-12">
      <Link href="/crm/knowledge-base" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground/50 hover:text-navy">
        <ArrowLeft size={15} />
        База знаний
      </Link>

      <section className="rounded-3xl border border-blue/10 bg-gradient-to-br from-blue-light/60 via-white to-cream p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">структурная база отелей</p>
        <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <h1 className="text-3xl font-bold text-navy">Ближний Восток: страны, эмираты и отели</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/65">
              Отдельная рабочая страница для быстрого подбора: all inclusive, пляж, городские отели, пары, семьи,
              развлекательная программа, тихий отдых, фишки и минусы. ОАЭ разделены по эмиратам.
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
            <p className="text-xs text-foreground/45">В базе сейчас</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><span className="block text-2xl font-bold text-navy">{HOTELS.length}</span> отелей</div>
              <div><span className="block text-2xl font-bold text-navy">6</span> эмиратов ОАЭ</div>
              <div><span className="block text-2xl font-bold text-navy">5</span> стран</div>
              <div><span className="block text-2xl font-bold text-navy">10</span> фильтров</div>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-10 mt-5 rounded-2xl border border-black/5 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_210px_auto] xl:items-center">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: Rixos, пляж, JBR, пары, дети, депозит, all inclusive…"
              className="w-full rounded-xl border border-black/10 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
            />
          </div>
          <select
            value={country}
            onChange={(e) => {
              const value = e.target.value as CountryId | "all";
              setCountry(value);
              if (value !== "uae") setEmirate("all");
            }}
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue"
          >
            <option value="all">Все страны</option>
            {Object.entries(COUNTRIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select
            value={emirate}
            onChange={(e) => {
              setCountry("uae");
              setEmirate(e.target.value as EmirateId | "all");
            }}
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue"
          >
            <option value="all">Все эмираты ОАЭ</option>
            {Object.entries(EMIRATES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <button onClick={resetFilters} className="inline-flex items-center justify-center gap-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-foreground/60 hover:bg-blue-light/40">
            <X size={15} />
            Сбросить
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleFilter(item.id)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${filters.includes(item.id) ? "bg-navy text-white" : "bg-blue-light/60 text-navy hover:bg-blue-light"}`}
            >
              {filters.includes(item.id) && <CheckCircle2 size={13} />}
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-foreground/45">
          <SlidersHorizontal size={14} />
          Найдено: {filteredHotels.length}. Фильтры работают вместе: можно выбрать “All inclusive” + “Хороший пляж” + “Для семей”.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickCard title="All inclusive" value={HOTELS.filter((h) => hasFilter(h, "all-inclusive")).length} text="быстро найти отели с AI/UAI" />
        <QuickCard title="Хороший пляж" value={HOTELS.filter((h) => hasFilter(h, "good-beach")).length} text="собственный или сильный пляжный сценарий" />
        <QuickCard title="Для семей" value={HOTELS.filter((h) => hasFilter(h, "families")).length} text="дети, территория, клубы, активность" />
        <QuickCard title="Для пар" value={HOTELS.filter((h) => hasFilter(h, "couples")).length} text="романтика, спокойствие, premium" />
      </section>

      <section className="mt-7 space-y-7">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-foreground/55">
            Ничего не найдено. Убери часть фильтров или измени поисковый запрос.
          </div>
        ) : grouped.map(([groupName, hotels]) => (
          <div key={groupName}>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-foreground/35">страна / эмират</p>
                <h2 className="text-xl font-bold text-navy">{groupName}</h2>
              </div>
              <span className="rounded-full bg-blue-light px-3 py-1 text-xs font-semibold text-navy">{hotels.length} отелей</span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {hotels.map((hotel) => <HotelResultCard key={hotel.id} hotel={hotel} />)}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function QuickCard({ title, value, text }: { title: string; value: number; text: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <p className="text-xs text-foreground/45">{title}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      <p className="mt-1 text-xs leading-5 text-foreground/55">{text}</p>
    </div>
  );
}

function HotelResultCard({ hotel }: { hotel: HotelCard }) {
  const location = hotel.country === "uae" && hotel.emirate ? `${COUNTRIES.uae} / ${EMIRATES[hotel.emirate]} / ${hotel.region}` : `${COUNTRIES[hotel.country]} / ${hotel.region}`;
  const chips = [
    ...hotel.meals.map((item) => item === "all-inclusive" ? "All inclusive" : item === "ultra-all-inclusive" ? "Ultra AI" : item === "breakfast" ? "Завтраки" : item === "half-board" ? "HB" : "не AI"),
    ...hotel.beach.map((item) => item === "good-beach" ? "хороший пляж" : item === "own-beach" ? "свой пляж" : item === "public-beach" ? "городской пляж" : item === "beach-shuttle" ? "шаттл на пляж" : "без пляжа"),
    ...hotel.audience.map((item) => item === "families" ? "семьи" : item === "couples" ? "пары" : item === "premium" ? "премиум" : item === "active" ? "активным" : item === "budget" ? "бюджетнее" : "тихий отдых"),
  ];

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-blue">{location}</p>
          <h3 className="mt-1 text-lg font-bold text-navy">{hotel.name}</h3>
        </div>
        {hotel.stars && <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-navy">{hotel.stars}</span>}
      </div>
      <p className="mt-3 text-sm leading-6 text-foreground/70">{hotel.positioning}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from(new Set(chips)).slice(0, 10).map((chip) => (
          <span key={chip} className="rounded-full bg-blue-light/70 px-2.5 py-1 text-[11px] font-semibold text-navy">{chip}</span>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoBox title="Кому предлагать" items={hotel.who} tone="good" />
        <InfoBox title="Фишки отеля" items={hotel.features} tone="good" />
        <InfoBox title="Минусы / осторожно" items={hotel.minuses} tone="warn" />
        <InfoBox title="Проверить" items={hotel.check} tone="check" />
      </div>
      <p className="mt-3 text-xs text-foreground/40">Тип: {labelList(hotel.hotelTypes)} · Развлечения: {labelList(hotel.entertainment)}</p>
    </article>
  );
}

function InfoBox({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warn" | "check" }) {
  const cls = tone === "warn" ? "bg-orange-50 border-orange-100" : tone === "check" ? "bg-slate-50 border-slate-100" : "bg-emerald-50 border-emerald-100";
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-navy/60">{title}</p>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-foreground/70">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}
