"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Search, Trash2, X } from "lucide-react";
import {
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  updateKnowledgeArticle,
  type KnowledgeArticleDetail,
} from "@/lib/crmApi";
import { fetchDirections, type Direction } from "@/lib/api";

type CardKind = "region" | "hotel" | "attraction" | "airline" | "perk" | "contact" | "other";

type SmartCard = {
  id: string;
  kind: CardKind;
  title: string;
  section: string;
  summary: string;
  tags: string[];
  who: string[];
  season: string[];
  avoid: string[];
  focus: string[];
  check: string[];
  detailsHtml: string;
  searchText: string;
};

type ParsedKnowledge = {
  lead: string;
  tags: string[];
  cards: SmartCard[];
  season: string[];
  audience: string[];
  avoid: string[];
  checks: string[];
  sourceHtml: string;
  stats: {
    regions: number;
    hotels: number;
    attractions: number;
    airlines: number;
    perks: number;
    contacts: number;
  };
};

const KIND_LABEL: Record<CardKind, string> = {
  region: "Регион / страна",
  hotel: "Отель",
  attraction: "Что посмотреть",
  airline: "Авиакомпания",
  perk: "Плюшка агенту",
  contact: "Контакт",
  other: "Карточка",
};

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function splitSentences(value: string) {
  return cleanText(value)
    .split(/(?<=[.!?…])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cut(value: string, limit = 230) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

function uniq(values: string[], limit = 8) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = cleanText(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function stripTitle(text: string, title: string) {
  const cleaned = cleanText(text);
  const titleText = cleanText(title);
  return cleaned.startsWith(titleText) ? cleanText(cleaned.slice(titleText.length)) : cleaned;
}

function getText(element: Element | null | undefined) {
  return cleanText(element?.textContent ?? "");
}

function extractByRegex(text: string, regex: RegExp, limit = 5) {
  return uniq(
    splitSentences(text)
      .filter((sentence) => regex.test(sentence))
      .map((sentence) => cut(sentence, 210)),
    limit,
  );
}

function findPreviousHeading(root: Element, element: Element) {
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4"));
  let result = "";
  for (const heading of headings) {
    if (heading === element) break;
    const relation = heading.compareDocumentPosition(element);
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) result = getText(heading);
  }
  return result;
}

function makeId(value: string, index: number) {
  const base = value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${base || "card"}-${index}`;
}

function classifyCard(title: string, text: string, section: string): CardKind {
  const all = `${title} ${section} ${text}`.toLowerCase();
  if (/авиакомпан|перевозчик|airline|emirates|etihad|flydubai|air arabia|qatar airways|turkish|oman air|gulf air|аэрофлот|победа|red wings|azur/.test(all)) {
    return "airline";
  }
  if (/контакт|whatsapp|telegram|телефон|почта|email|sales|reservation|представител/.test(all)) return "contact";
  if (/плюшк|бонус|комисс|day pass|fam trip|агент|incentive|loyalty|апгрейд/.test(all)) return "perk";
  if (/отел|hotel|resort|rixos|jumeirah|address|hilton|radisson|fairmont|anantara|rotana|marriott|waldorf|wyndham|sheraton|intercontinental|hyatt|ritz|centara|movenpick|doubletree|hampton|pullman/.test(all)) return "hotel";
  if (/достопримечатель|музе|парк|зоопарк|zoo|остров|маршрут|что посмотреть|экскурс|ресторан|ночная жизнь|yas|louvre|ferrari|warner|аквапарк|island|beach club/.test(all)) return "attraction";
  if (/страна|регион|эмират|курорт|район|дубай|абу-даби|шардж|рас-эль-хайм|фуджейр|аджман|аль-айн|аль-дафра|jbr|marina|palm|саадият|deira|downtown/.test(all)) return "region";
  return "other";
}

function tagsFor(title: string, text: string, kind: CardKind) {
  const all = `${title} ${text}`.toLowerCase();
  const tags: string[] = [];
  if (kind === "region") tags.push("регион");
  if (kind === "airline") tags.push("логистика");
  if (kind === "hotel") tags.push("отель");
  if (kind === "attraction") tags.push("досуг");
  if (/семь|дет/.test(all)) tags.push("семьям");
  if (/пляж|море|остров|beach/.test(all)) tags.push("пляж");
  if (/шопинг|молл|торгов/.test(all)) tags.push("шопинг");
  if (/премиум|luxury|5\*|5 звезд|5★/.test(all)) tags.push("премиум");
  if (/музе|культур|истор/.test(all)) tags.push("культура");
  if (/парк|аквапарк|развлеч|zoo|yas|ferrari|warner/.test(all)) tags.push("развлечения");
  if (/депозит/.test(all)) tags.push("депозит");
  if (/all inclusive|все включено|ультра|ai/.test(all)) tags.push("all inclusive");
  if (/прям|рейс|аэропорт|стыков|багаж/.test(all)) tags.push("перелёт");
  return uniq(tags, 8);
}

function seasonFor(title: string, text: string, kind: CardKind) {
  const all = `${title} ${text}`.toLowerCase();
  const found = extractByRegex(text, /сезон|летом|зимой|октябр|ноябр|декабр|январ|феврал|март|апрел|май|июн|июл|август|сентябр|жарко|дожд|рейс|расписан|чартер/i, 3);
  if (kind === "airline") {
    return uniq([
      ...found,
      "Расписание, частоту рейсов, багаж, тариф и стыковки проверять на даты заявки: авиасетка меняется по сезону.",
    ], 4);
  }
  if (found.length) return found;
  if (/оаэ|дубай|абу-даби|шардж|рас-эль-хайм|фуджейр|аджман|эмират|оман|катар|бахрейн|сауд/.test(all)) {
    return [
      "Октябрь–апрель — основной комфортный сезон для пляжа, прогулок, парков, экскурсий и семейного отдыха.",
      "Май–сентябрь — жаркий период: продавать через хорошие отели, бассейны, моллы, аквапарки и выгодную цену.",
      "Перед продажей проверить температуру, пляж, трансфер, депозит, закрытия инфраструктуры и авиапрограмму.",
    ];
  }
  if (/мальдив/.test(all)) {
    return [
      "Декабрь–апрель — высокий сезон и более стабильная погода.",
      "Май–октябрь — ниже цены, но выше риск дождей и волн: проверять атолл, трансфер, риф и питание.",
    ];
  }
  if (/юва|таиланд|вьетнам|индонез|малайз|шри-ланк/.test(all)) {
    return [
      "Сезонность зависит от курорта и побережья: перед продажей проверять месяц, дожди, волны и трансфер.",
      "Для клиента важно привязать рекомендацию к датам: где спокойнее море, где лучше экскурсии, где возможны ливни.",
    ];
  }
  return ["Сезонность в базе не выделена. Перед продажей проверить погоду, море, ограничения отеля и авиапрограмму на даты клиента."];
}

function whoFor(title: string, text: string, kind: CardKind) {
  const found = extractByRegex(text, /подходит|для гостей|для турист|для семей|семь|дет|парам|молодеж|шопинг|музе|культур|пляж|экскурс|премиум|бюджет|эконом/i, 4);
  if (found.length) return found;
  const lower = `${title} ${text}`.toLowerCase();
  if (kind === "airline") return ["Туристам, для которых важны логистика, время вылета, багаж, аэропорт прилёта и понятная стыковка."];
  if (kind === "hotel") return ["Подбирать под сценарий клиента: семья, пара, премиум, пляж, all inclusive, спокойный отдых или городская инфраструктура."];
  if (kind === "attraction") return ["Использовать как аргумент в подборе: семьи, активный отдых, экскурсии, красивый маршрут или программа на непляжный день."];
  if (/дубай/.test(lower)) return ["Активным туристам, семьям, любителям шопинга, парков, ресторанов, городской инфраструктуры и первого знакомства с ОАЭ."];
  if (/абу-даби/.test(lower)) return ["Семьям, парам, премиум-клиентам, любителям музеев, парков развлечений, спокойных пляжей и культуры."];
  if (/шардж/.test(lower)) return ["Бюджетным туристам и семьям, если подходит спокойный формат и логистика до Дубая."];
  if (/рас-эль-хайм/.test(lower)) return ["Тем, кто хочет спокойный пляж, отельную территорию и меньше городской суеты."];
  return ["Туристам, которым подходит формат направления. Перед подбором уточнить ожидания: пляж, город, экскурсии, бюджет и состав семьи."];
}

function avoidFor(text: string, kind: CardKind) {
  const found = extractByRegex(text, /не подходит|не предлагать|не стоит|минус|дорого|далеко|долго|только|кроме|однако|важно учитывать|огранич|депозит|жарко/i, 4);
  if (found.length) return found;
  if (kind === "airline") return ["Не предлагать без проверки багажа, стыковки, аэропорта, времени вылета и правил тарифа."];
  if (kind === "attraction") return ["Не обещать без проверки актуальной стоимости, часов работы, доступности мест и трансфера."];
  return ["Не предлагать без уточнения ожиданий: пляж, город, all inclusive, детская инфраструктура, жара, бюджет и депозиты."];
}

function focusFor(text: string, kind: CardKind) {
  const regex = kind === "airline"
    ? /рейс|маршрут|стыков|аэропорт|багаж|питание|терминал|класс|лоукост|тариф/i
    : kind === "hotel"
      ? /пляж|питание|номер|дет|территор|депозит|реновац|бассейн|ресторан|трансфер/i
      : kind === "attraction"
        ? /стоимость|билет|завтрак|парк|музей|остров|маршрут|такси|трансфер|время|бронировать/i
        : /район|пляж|остров|отел|аэропорт|шопинг|парк|музе|молл|марина|центр|курорт|остров/i;
  return extractByRegex(text, regex, 5);
}

function checkFor(text: string, kind: CardKind) {
  const regex = kind === "airline"
    ? /багаж|стыков|терминал|аэропорт|питание|тариф|возврат|обмен|время вылета|пересад|лоукост|ручн/i
    : /депозит|трансфер|пляж|аэропорт|район|реновац|закрыт|виза|правил|налог|сбор|питание|вход в море|парк|билет|бронь/i;
  const found = extractByRegex(text, regex, 5);
  if (found.length) return found;
  return kind === "airline"
    ? ["Багаж и ручную кладь", "Аэропорт вылета/прилёта", "Время стыковки", "Питание и тариф", "Условия возврата и обмена"]
    : ["Район и трансфер", "Пляж и формат отдыха", "Депозит и обязательные сборы", "Реновации / закрытия", "Авиапрограмму на даты клиента"];
}

function makeCard(element: HTMLElement, root: Element, index: number): SmartCard | null {
  const heading = element.querySelector<HTMLElement>("h1,h2,h3,h4,strong,b");
  const title = cut(getText(heading) || getText(element.querySelector("p")), 90);
  const fullText = getText(element);
  if (!title || fullText.length < 60) return null;
  const section = findPreviousHeading(root, element);
  const kind = classifyCard(title, fullText, section);
  if (kind === "other" && fullText.length > 900) return null;
  const text = stripTitle(fullText, title);
  const summary = cut(splitSentences(text)[0] ?? text, 240);
  return {
    id: makeId(title, index),
    kind,
    title,
    section,
    summary,
    tags: tagsFor(title, text, kind),
    who: whoFor(title, text, kind),
    season: seasonFor(title, text, kind),
    avoid: avoidFor(text, kind),
    focus: focusFor(text, kind),
    check: checkFor(text, kind),
    detailsHtml: element.innerHTML,
    searchText: `${title} ${section} ${fullText}`.toLowerCase(),
  };
}

function parseKnowledge(content: string, title: string): ParsedKnowledge {
  if (typeof window === "undefined") {
    return emptyParsed(content);
  }

  const doc = new DOMParser().parseFromString(`<main>${content}</main>`, "text/html");
  const root = doc.body.querySelector("main");
  if (!root) return emptyParsed(content);

  const cards: SmartCard[] = [];
  const seen = new Set<string>();
  const add = (element: HTMLElement) => {
    const card = makeCard(element, root, cards.length);
    if (!card) return;
    const key = `${card.kind}:${card.title.toLowerCase()}:${card.summary.toLowerCase().slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    cards.push(card);
  };

  Array.from(root.querySelectorAll<HTMLElement>(".grid > *, article, section, [class*='card']")).forEach((element) => {
    const parentCard = element.parentElement?.closest("article,section,[class*='card']");
    if (parentCard && parentCard !== element && !element.parentElement?.className.includes("grid")) return;
    add(element);
  });

  if (cards.length < 4) {
    Array.from(root.querySelectorAll<HTMLElement>("h2,h3,h4")).forEach((heading) => {
      const wrapper = doc.createElement("section");
      wrapper.appendChild(heading.cloneNode(true));
      let current = heading.nextElementSibling;
      let guard = 0;
      while (current && !/^H[234]$/.test(current.tagName) && guard < 8) {
        wrapper.appendChild(current.cloneNode(true));
        current = current.nextElementSibling;
        guard += 1;
      }
      add(wrapper);
    });
  }

  const allText = getText(root);
  const lead = cut(splitSentences(allText).slice(0, 2).join(" "), 320);
  const season = seasonFor(title, allText, classifyCard(title, allText, ""));
  const tags = uniq(cards.flatMap((card) => card.tags), 10);
  const audience = uniq(cards.flatMap((card) => card.who), 7);
  const avoid = uniq(cards.flatMap((card) => card.avoid), 7);
  const checks = uniq([
    ...cards.flatMap((card) => card.check),
    "Авиапрограмму и багаж на даты заявки",
    "Депозит, туристический налог и обязательные сборы",
    "Пляж, трансфер и расстояние до ключевых мест",
    "Реновации, закрытия бассейнов/ресторанов и актуальные отзывы",
  ], 10);

  return {
    lead,
    tags,
    cards,
    season,
    audience,
    avoid,
    checks,
    sourceHtml: content,
    stats: {
      regions: cards.filter((c) => c.kind === "region").length,
      hotels: cards.filter((c) => c.kind === "hotel").length,
      attractions: cards.filter((c) => c.kind === "attraction").length,
      airlines: cards.filter((c) => c.kind === "airline").length,
      perks: cards.filter((c) => c.kind === "perk").length,
      contacts: cards.filter((c) => c.kind === "contact").length,
    },
  };
}

function emptyParsed(sourceHtml: string): ParsedKnowledge {
  return {
    lead: "",
    tags: [],
    cards: [],
    season: [],
    audience: [],
    avoid: [],
    checks: [],
    sourceHtml,
    stats: { regions: 0, hotels: 0, attractions: 0, airlines: 0, perks: 0, contacts: 0 },
  };
}

function SectionList({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "good" | "warn" | "blue" }) {
  if (!items.length) return null;
  const cls = tone === "good" ? "bg-green-50 border-green-100" : tone === "warn" ? "bg-orange-50 border-orange-100" : tone === "blue" ? "bg-blue-light/50 border-blue/10" : "bg-cream border-black/5";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy/55">{title}</p>
      <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-foreground/75">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SmartCardView({ card }: { card: SmartCard }) {
  return (
    <article className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground/40">{KIND_LABEL[card.kind]}</p>
          <h3 className="mt-1 text-lg font-bold text-navy">{card.title}</h3>
          {card.section && <p className="mt-1 text-xs text-foreground/45">{card.section}</p>}
        </div>
        <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold text-gold-dark">{KIND_LABEL[card.kind]}</span>
      </div>

      {card.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-blue-light px-2.5 py-1 text-[11px] font-semibold text-navy">
              {tag}
            </span>
          ))}
        </div>
      )}

      {card.summary && <p className="mt-3 max-w-4xl text-sm leading-relaxed text-foreground/70">{card.summary}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionList title="Кому предлагать" items={card.who} tone="good" />
        <SectionList title={card.kind === "airline" ? "Сезонность / расписание" : "Сезонность"} items={card.season} tone="blue" />
        <SectionList title="Кому не предлагать / ограничения" items={card.avoid} tone="warn" />
        <SectionList title={card.kind === "airline" ? "Маршрут и особенности" : card.kind === "attraction" ? "Что важно" : "Районы / отели / ориентиры"} items={card.focus} />
        <div className="lg:col-span-2">
          <SectionList title="Проверить перед продажей" items={card.check} tone="blue" />
        </div>
      </div>

      <details className="mt-4 border-t border-dashed border-black/10 pt-3">
        <summary className="cursor-pointer text-sm font-semibold text-blue">Полное описание из базы</summary>
        <div className="prose prose-sm mt-3 max-w-none text-foreground/70 prose-headings:text-navy prose-a:text-blue" dangerouslySetInnerHTML={{ __html: card.detailsHtml }} />
      </details>
    </article>
  );
}

function MonthScale({ title }: { title: string }) {
  const lower = title.toLowerCase();
  const isMaldives = /мальдив/.test(lower);
  const values = isMaldives
    ? ["best", "best", "best", "good", "mixed", "rain", "rain", "rain", "rain", "mixed", "good", "best"]
    : ["best", "best", "best", "best", "hot", "hot", "hot", "hot", "hot", "best", "best", "best"];
  const label: Record<string, string> = { best: "комфортно", good: "хорошо", mixed: "переменно", rain: "дожди", hot: "жарко" };
  const cls: Record<string, string> = {
    best: "bg-green-100 text-green-800 border-green-200",
    good: "bg-lime-100 text-lime-800 border-lime-200",
    mixed: "bg-yellow-100 text-yellow-800 border-yellow-200",
    rain: "bg-blue-light text-blue border-blue/20",
    hot: "bg-orange-100 text-orange-800 border-orange-200",
  };
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12">
      {MONTHS.map((month, index) => (
        <div key={month} className={`rounded-2xl border p-3 text-center ${cls[values[index]]}`}>
          <p className="text-xs font-bold">{month}</p>
          <p className="mt-1 text-[11px]">{label[values[index]]}</p>
        </div>
      ))}
    </div>
  );
}

function CardsSection({ id, title, description, cards }: { id: string; title: string; description: string; cards: SmartCard[] }) {
  if (!cards.length) return null;
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground/40">{description}</p>
        <h2 className="mt-1 text-2xl font-bold text-navy">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {cards.map((card) => (
          <SmartCardView key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export default function CrmKnowledgeArticlePage() {
  const params = useParams<{ id: string }>();
  const articleId = Number(params.id);
  const router = useRouter();

  const [article, setArticle] = useState<KnowledgeArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [title, setTitle] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    getKnowledgeArticle(articleId).then((data) => {
      if (!active) return;
      setArticle(data);
      setTitle(data.title);
      setDirectionId(data.direction ? String(data.direction) : "");
      setContent(data.content);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [articleId]);

  useEffect(() => {
    fetchDirections().then(setDirections);
  }, []);

  const parsed = useMemo(() => (article ? parseKnowledge(article.content, article.title) : emptyParsed("")), [article]);
  const search = query.trim().toLowerCase();
  const cards = useMemo(() => {
    if (!search) return parsed.cards;
    return parsed.cards.filter((card) => card.searchText.includes(search));
  }, [parsed.cards, search]);

  const byKind = (kind: CardKind) => cards.filter((card) => card.kind === kind);
  const nav = [
    ["overview", "Обзор", true],
    ["season", "Сезонность", true],
    ["audience", "Кому предлагать", true],
    ["regions", "Регионы", byKind("region").length > 0],
    ["hotels", "Отели", byKind("hotel").length > 0],
    ["attractions", "Достопримечательности", byKind("attraction").length > 0],
    ["airlines", "Авиакомпании", byKind("airline").length > 0],
    ["perks", "Плюшки", byKind("perk").length > 0],
    ["contacts", "Контакты", byKind("contact").length > 0],
    ["checklist", "Чек-лист", true],
    ["source", "Исходник", true],
  ] as const;

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateKnowledgeArticle(articleId, {
        title,
        direction: directionId ? Number(directionId) : null,
        content,
      });
      setArticle(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Удалить статью безвозвратно?")) return;
    await deleteKnowledgeArticle(articleId);
    router.push("/crm/knowledge-base");
  }

  if (loading) return <p className="text-sm text-foreground/50">Загрузка…</p>;
  if (!article) return <p className="text-sm text-foreground/50">Статья не найдена.</p>;

  return (
    <div>
      <button
        onClick={() => router.push("/crm/knowledge-base")}
        className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"
      >
        <ArrowLeft size={15} />
        База знаний
      </button>

      <div className="rounded-3xl border border-black/5 bg-white p-5 sm:p-7">
        {editing ? (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-lg font-bold text-navy outline-none focus:border-blue"
            />
            <select
              value={directionId}
              onChange={(e) => setDirectionId(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue sm:w-64"
            >
              <option value="">Без направления</option>
              {directions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={22}
              className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-xs outline-none focus:border-blue"
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-blue disabled:opacity-60">
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
              <button onClick={() => setEditing(false)} className="rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-foreground/60 hover:bg-blue-light/40">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="rounded-3xl border border-blue/10 bg-gradient-to-br from-blue-light/50 via-white to-gold/10 p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground/45">Внутренняя база турагентства</p>
                  <h1 className="mt-2 text-3xl font-bold leading-tight text-navy">{article.title}</h1>
                  {parsed.lead && <p className="mt-3 text-sm leading-7 text-foreground/70">{parsed.lead}</p>}
                  {parsed.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {parsed.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(true)} aria-label="Редактировать" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-navy/60 shadow-sm hover:text-navy">
                    <Pencil size={16} />
                  </button>
                  <button onClick={handleDelete} aria-label="Удалить" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-navy/60 shadow-sm hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-foreground/45">Регионы</p><p className="text-2xl font-bold text-navy">{parsed.stats.regions}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-foreground/45">Отели</p><p className="text-2xl font-bold text-navy">{parsed.stats.hotels}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-foreground/45">Что посмотреть</p><p className="text-2xl font-bold text-navy">{parsed.stats.attractions}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-foreground/45">Авиакомпании</p><p className="text-2xl font-bold text-navy">{parsed.stats.airlines}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-foreground/45">Плюшки</p><p className="text-2xl font-bold text-navy">{parsed.stats.perks}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-foreground/45">Контакты</p><p className="text-2xl font-bold text-navy">{parsed.stats.contacts}</p></div>
              </div>
            </section>

            <div className="sticky top-0 z-20 mt-4 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-sm backdrop-blur">
              <div className="flex flex-wrap gap-2">
                {nav.filter(([, , show]) => show).map(([href, label]) => (
                  <a key={href} href={`#${href}`} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-navy hover:border-blue hover:text-blue">
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-black/5 bg-cream p-4">
              <p className="text-sm font-semibold text-navy">Поиск по базе</p>
              <div className="relative mt-2">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Искать: сезон, депозит, авиакомпания, отель, район, дети, пляж…"
                  className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-10 text-sm outline-none focus:border-blue"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-foreground/50 hover:text-navy">
                    <X size={15} />
                  </button>
                )}
              </div>
              {query && <p className="mt-2 text-xs text-foreground/45">Найдено карточек: {cards.length}</p>}
            </div>

            <div className="mt-7 flex flex-col gap-10">
              <section id="overview" className="scroll-mt-28">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground/40">Старт для менеджера</p>
                <h2 className="mt-1 text-2xl font-bold text-navy">Обзор</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <SectionList title="Быстрый вывод" items={parsed.lead ? [parsed.lead] : ["База структурирована для быстрого подбора: сезонность, кому продавать, регионы, отели, авиакомпании, контакты и чек-лист."]} tone="blue" />
                  <SectionList title="Кому продавать" items={parsed.audience.length ? parsed.audience.slice(0, 5) : ["Семьям, парам, премиум-клиентам и туристам, которым подходит формат направления."]} tone="good" />
                  <SectionList title="Сразу проверить" items={parsed.checks.slice(0, 5)} tone="warn" />
                </div>
              </section>

              <section id="season" className="scroll-mt-28">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground/40">Когда продавать</p>
                <h2 className="mt-1 text-2xl font-bold text-navy">Сезонность</h2>
                <div className="mt-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                  <MonthScale title={article.title} />
                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <SectionList title="Ориентир по сезону" items={parsed.season} tone="blue" />
                    <SectionList title="Продавать через" items={["комфортную логистику", "отели и районы под сценарий клиента", "досуг / парки / экскурсии", "цену и спецпредложения вне пика"]} tone="good" />
                    <SectionList title="Проверить" items={["погоду на даты", "море / пляж / волны", "трансфер", "депозиты и сборы", "актуальную авиапрограмму"]} tone="warn" />
                  </div>
                </div>
              </section>

              <section id="audience" className="scroll-mt-28">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground/40">Продажная логика</p>
                <h2 className="mt-1 text-2xl font-bold text-navy">Кому предлагать / кому не предлагать</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SectionList title="Кому предлагать" items={parsed.audience.length ? parsed.audience : ["Тем, кому подходит формат направления. Уточнить состав семьи, бюджет, ожидания от пляжа, города и экскурсий."]} tone="good" />
                  <SectionList title="Кому не предлагать / осторожно" items={parsed.avoid.length ? parsed.avoid : ["Не предлагать без проверки сезона, логистики, района, пляжа, депозита и актуальных условий отеля."]} tone="warn" />
                </div>
              </section>

              <CardsSection id="regions" title="Регионы / страны" description="карточки с сезонностью, кому продавать и что проверить" cards={byKind("region")} />
              <CardsSection id="hotels" title="Отели" description="карточки отелей в рабочем формате менеджера" cards={byKind("hotel")} />
              <CardsSection id="attractions" title="Достопримечательности и досуг" description="что использовать как аргумент в продаже" cards={byKind("attraction")} />
              <CardsSection id="airlines" title="Авиакомпании и логистика" description="маршруты, багаж, стыковки и что проверить" cards={byKind("airline")} />
              <CardsSection id="perks" title="Плюшки агентам" description="бонусы, day pass, fam trip, комиссии и спецусловия" cards={byKind("perk")} />
              <CardsSection id="contacts" title="Контакты" description="представители, отели, sales/reservations" cards={byKind("contact")} />

              <section id="checklist" className="scroll-mt-28">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground/40">Перед отправкой подборки</p>
                <h2 className="mt-1 text-2xl font-bold text-navy">Чек-лист менеджера</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <SectionList title="Логистика" items={["аэропорт прилёта", "трансфер", "время вылета", "багаж", "стыковка"]} tone="blue" />
                  <SectionList title="Отель" items={["пляж", "депозит", "питание", "реновация", "family room / extra bed"]} tone="good" />
                  <SectionList title="Направление" items={["сезонность", "жара / дожди / волны", "визовые правила", "налоги и сборы"]} tone="warn" />
                  <SectionList title="Продажа" items={["кому подходит", "кому не подходит", "главный аргумент", "риск недовольства"]} />
                </div>
              </section>

              {cards.filter((card) => card.kind === "other").length > 0 && (
                <CardsSection id="other" title="Дополнительные карточки" description="прочие материалы базы" cards={cards.filter((card) => card.kind === "other")} />
              )}

              <section id="source" className="scroll-mt-28">
                <details className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                  <summary className="cursor-pointer text-base font-bold text-blue">Исходный текст базы</summary>
                  <div className="prose prose-sm mt-5 max-w-none text-foreground/75 prose-headings:text-navy prose-a:text-blue prose-img:rounded-xl" dangerouslySetInnerHTML={{ __html: parsed.sourceHtml }} />
                </details>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
