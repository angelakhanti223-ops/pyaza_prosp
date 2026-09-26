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

type CardKind = "region" | "airline" | "hotel" | "attraction" | "perk" | "contact" | "other";

type SmartCard = {
  id: string;
  kind: CardKind;
  title: string;
  section: string;
  summary: string;
  tags: string[];
  who: string[];
  season: string[];
  focus: string[];
  avoid: string[];
  check: string[];
  html: string;
  searchText: string;
};

type ParsedKnowledge = {
  lead: string;
  tags: string[];
  cards: SmartCard[];
  sourceHtml: string;
};

const KIND_LABEL: Record<CardKind, string> = {
  region: "Страна / регион",
  airline: "Авиакомпания / логистика",
  hotel: "Отель",
  attraction: "Что посмотреть",
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

function textOf(element: Element | null | undefined) {
  return cleanText(element?.textContent ?? "");
}

function stripTitle(text: string, title: string) {
  const cleaned = cleanText(text);
  const cleanTitle = cleanText(title);
  return cleaned.toLowerCase().startsWith(cleanTitle.toLowerCase())
    ? cleanText(cleaned.slice(cleanTitle.length))
    : cleaned;
}

function extractByRegex(text: string, regex: RegExp, limit = 5) {
  return uniq(
    splitSentences(text)
      .filter((sentence) => regex.test(sentence))
      .map((sentence) => cut(sentence, 220)),
    limit,
  );
}

function idFrom(value: string, index: number) {
  const base = value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${base || "card"}-${index}`;
}

function previousHeading(root: Element, element: Element) {
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4"));
  let result = "";
  for (const heading of headings) {
    if (heading === element) break;
    if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) result = textOf(heading);
  }
  return result;
}

function titleFrom(element: Element, index: number) {
  const heading = element.querySelector("h1,h2,h3,h4,strong,b");
  const headingText = textOf(heading);
  if (headingText) return cut(headingText, 90);
  const firstSentence = splitSentences(textOf(element))[0];
  return cut(firstSentence || `Карточка ${index + 1}`, 80);
}

function classify(title: string, text: string, section: string): CardKind {
  const all = `${section} ${title} ${text}`.toLowerCase();
  const sectionLower = section.toLowerCase();

  if (/авиакомпан|перевозчик|airline|логистик|перел[её]т|рейс|emirates|etihad|flydubai|air arabia|qatar airways|turkish|oman air|gulf air|аэрофлот|победа|red wings|azur/.test(all)) return "airline";
  if (/контакт|whatsapp|telegram|телефон|email|почта|sales|reservation|представител/.test(all)) return "contact";
  if (/плюшк|бонус|комисс|day pass|fam trip|агент|incentive|loyalty|апгрейд/.test(all)) return "perk";
  if (/отел|hotel|resort|rixos|jumeirah|address|hilton|radisson|fairmont|anantara|rotana|marriott|waldorf|wyndham|sheraton|intercontinental|hyatt|ritz|centara|movenpick|doubletree|hampton|pullman/.test(all)) return "hotel";
  if (/страны|регионы|эмираты|регион/.test(sectionLower)) return "region";
  if (/достопримечатель|что посмотреть|экскурс|досуг|музе|парк|зоопарк|zoo|остров|ресторан|ночная жизнь|yas|louvre|ferrari|warner|аквапарк|beach club/.test(sectionLower)) return "attraction";
  if (/достопримечатель|музе|парк|зоопарк|zoo|маршрут|что посмотреть|экскурс|ресторан|ночная жизнь|yas|louvre|ferrari|warner|аквапарк|beach club/.test(all)) return "attraction";
  if (/страна|регион|эмират|курорт|район|дубай|абу-даби|шардж|рас-эль-хайм|фуджейр|аджман|аль-айн|аль-дафра|jbr|marina|palm|саадият|deira|downtown/.test(all)) return "region";
  return "other";
}

function tagsFor(title: string, text: string, kind: CardKind) {
  const all = `${title} ${text}`.toLowerCase();
  const tags: string[] = [KIND_LABEL[kind]];
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
        ? /стоимость|билет|завтрак|бронировать|трансфер|дорога|отель|парк|музей|семь|дет/i
        : /район|пляж|остров|отел|аэропорт|шопинг|парк|музе|молл|марина|центр|курорт|трансфер/i;
  const found = extractByRegex(text, regex, 5);
  if (found.length) return found;
  if (kind === "airline") return ["Маршрут, аэропорт, время вылета, стыковка, багаж, питание, тариф."];
  if (kind === "region") return ["Район проживания, пляж, логистика до аэропорта, формат отдыха и подходящие отели."];
  return ["Ключевые особенности объекта нужно проверить по актуальным данным перед предложением клиенту."];
}

function checkFor(text: string, kind: CardKind) {
  const regex = kind === "airline"
    ? /багаж|стыков|терминал|аэропорт|питание|тариф|возврат|обмен|ручн|время вылета/i
    : /депозит|трансфер|пляж|аэропорт|район|реновац|закрыт|виза|налог|сбор|питание|вход в море|билет|стоимость/i;
  const found = extractByRegex(text, regex, 5);
  if (found.length) return found;
  if (kind === "airline") return ["Багаж и ручная кладь", "Аэропорт и терминал", "Стыковка", "Питание", "Возврат/обмен тарифа"];
  if (kind === "attraction") return ["Стоимость", "Часы работы", "Наличие мест", "Как добраться", "Нужен ли предзаказ"];
  return ["Район", "Пляж / трансфер", "Депозит", "Питание", "Реновации и закрытия", "Авиапрограмма"];
}

function fallbackGlobalSeason(text: string) {
  const lower = text.toLowerCase();
  if (/оаэ|дубай|абу-даби|шардж|рас-эль-хайм|эмират/.test(lower)) {
    return [
      "Октябрь–апрель — комфортный сезон.",
      "Май–сентябрь — жаркий период, продавать через цену, хорошие отели и инфраструктуру.",
      "Всегда проверять депозит, пляж, трансфер и фактическую авиапрограмму.",
    ];
  }
  if (/мальдив/.test(lower)) return ["Декабрь–апрель — высокий сезон.", "Май–октябрь — ниже цены, но выше риск дождей и волн."];
  if (/юва|таиланд|вьетнам|шри-ланк|малайз/.test(lower)) return ["Сезонность зависит от курорта и побережья.", "Проверять месяц поездки, море, волны, дожди и трансфер."];
  return ["Сезонность не выделена в базе. Проверять по датам заявки."];
}

function buildCard(element: Element, index: number, root: Element): SmartCard | null {
  const rawText = textOf(element);
  if (rawText.length < 60) return null;
  const section = previousHeading(root, element);
  const title = titleFrom(element, index);
  const body = stripTitle(rawText, title);
  const kind = classify(title, body, section);
  const summary = cut(splitSentences(body)[0] || body, 260);
  return {
    id: idFrom(`${kind}-${title}`, index),
    kind,
    title,
    section,
    summary,
    tags: tagsFor(title, body, kind),
    who: whoFor(title, body, kind),
    season: seasonFor(title, body, kind),
    focus: focusFor(body, kind),
    avoid: avoidFor(body, kind),
    check: checkFor(body, kind),
    html: element.innerHTML,
    searchText: cleanText(`${title} ${section} ${rawText}`).toLowerCase(),
  };
}

function parseKnowledge(html: string): ParsedKnowledge {
  if (typeof window === "undefined") {
    return { lead: "", tags: [], cards: [], sourceHtml: html, };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="kb-root">${html}</div>`, "text/html");
  const root = doc.querySelector("#kb-root") as HTMLElement;
  const fullText = textOf(root);

  const candidates: Element[] = [];
  root.querySelectorAll(".grid > *, .cards > *, section > article, article").forEach((element) => {
    if (textOf(element).length >= 60) candidates.push(element);
  });

  if (candidates.length === 0) {
    root.querySelectorAll("h2, h3").forEach((heading) => {
      const wrapper = doc.createElement("section");
      wrapper.appendChild(heading.cloneNode(true));
      let next = heading.nextElementSibling;
      while (next && !/^H[23]$/.test(next.tagName)) {
        wrapper.appendChild(next.cloneNode(true));
        next = next.nextElementSibling;
      }
      if (textOf(wrapper).length >= 80) candidates.push(wrapper);
    });
  }

  const seen = new Set<string>();
  const cards = candidates
    .map((candidate, index) => buildCard(candidate, index, root))
    .filter((card): card is SmartCard => Boolean(card))
    .filter((card) => {
      const key = `${card.kind}-${card.title}-${card.summary}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const lead = cut(splitSentences(fullText).find((sentence) => sentence.length > 80) || fullText, 340);
  const tags = uniq([
    ...cards.flatMap((card) => card.tags),
    ...(fullText.toLowerCase().includes("оаэ") ? ["ОАЭ"] : []),
    ...(fullText.toLowerCase().includes("мальдив") ? ["Мальдивы"] : []),
    ...(fullText.toLowerCase().includes("юва") ? ["ЮВА"] : []),
  ], 12);

  return { lead, tags, cards, sourceHtml: html };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-navy">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BulletBlock({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "green" | "amber" | "blue" }) {
  if (!items.length) return null;
  const toneClass = tone === "green" ? "bg-green-50" : tone === "amber" ? "bg-amber-50" : tone === "blue" ? "bg-blue-light/40" : "bg-cream";
  return (
    <div className={`rounded-2xl border border-black/5 p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-foreground/50">{title}</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-foreground/80">
        {items.map((item, index) => <li key={index}>• {item}</li>)}
      </ul>
    </div>
  );
}

function SmartCardView({ card }: { card: SmartCard }) {
  return (
    <article className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-foreground/40">{KIND_LABEL[card.kind]}</p>
          <h3 className="mt-1 text-lg font-bold text-navy">{card.title}</h3>
          {card.section && <p className="mt-0.5 text-xs text-foreground/40">{card.section}</p>}
        </div>
      </div>
      {card.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.map((tag) => <span key={tag} className="rounded-full bg-blue-light px-2.5 py-1 text-[11px] font-semibold text-navy">{tag}</span>)}
        </div>
      )}
      {card.summary && <p className="mt-3 text-sm leading-6 text-foreground/75">{card.summary}</p>}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BulletBlock title={card.kind === "airline" ? "Кому использовать" : "Кому предлагать"} items={card.who} tone="green" />
        <BulletBlock title={card.kind === "airline" ? "Расписание / сезонность" : "Сезонность"} items={card.season} tone="blue" />
        <BulletBlock title={card.kind === "airline" ? "Маршрут и особенности" : "Районы / особенности"} items={card.focus} />
        <BulletBlock title="Осторожно" items={card.avoid} tone="amber" />
        <div className="lg:col-span-2"><BulletBlock title="Проверить перед продажей" items={card.check} tone="amber" /></div>
      </div>
      <details className="mt-4 rounded-2xl border border-dashed border-black/10 bg-cream/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-blue">Полное описание из базы</summary>
        <div className="kb-source mt-3 text-sm leading-6 text-foreground/70" dangerouslySetInnerHTML={{ __html: card.html }} />
      </details>
    </article>
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
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, [articleId]);

  useEffect(() => { fetchDirections().then(setDirections); }, []);

  const parsed = useMemo(() => parseKnowledge(article?.content ?? ""), [article?.content]);
  const q = query.trim().toLowerCase();
  const cards = useMemo(() => q ? parsed.cards.filter((card) => card.searchText.includes(q)) : parsed.cards, [parsed.cards, q]);
  const regions = cards.filter((card) => card.kind === "region");
  const airlines = cards.filter((card) => card.kind === "airline");
  const hotels = cards.filter((card) => card.kind === "hotel");
  const attractions = cards.filter((card) => card.kind === "attraction");
  const perks = cards.filter((card) => card.kind === "perk");
  const contacts = cards.filter((card) => card.kind === "contact");
  const other = cards.filter((card) => card.kind === "other");
  const season = fallbackGlobalSeason(cleanText(article?.content));

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateKnowledgeArticle(articleId, { title, direction: directionId ? Number(directionId) : null, content });
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

  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(false)} className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"><ArrowLeft size={15} />Назад</button>
        <div className="rounded-2xl border border-black/5 bg-white p-6">
          <div className="flex flex-col gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-black/10 px-3 py-2 text-lg font-bold text-navy outline-none focus:border-blue" />
            <select value={directionId} onChange={(e) => setDirectionId(e.target.value)} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue sm:w-64">
              <option value="">Без направления</option>
              {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={24} className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-xs outline-none focus:border-blue" />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-blue disabled:opacity-60">{saving ? "Сохраняем…" : "Сохранить"}</button>
              <button onClick={() => setEditing(false)} className="rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-foreground/60 hover:bg-blue-light/40">Отмена</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => router.push("/crm/knowledge-base")} className="flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"><ArrowLeft size={15} />База знаний</button>

      <div className="rounded-3xl border border-black/5 bg-gradient-to-br from-blue-light/50 via-white to-cream p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground/40">Внутренняя база турагентства</p>
            <h1 className="mt-1 text-2xl font-bold text-navy">{article.title}</h1>
            <p className="mt-2 text-sm leading-6 text-foreground/70">{parsed.lead || "Рабочая база для подбора: направления, отели, логистика, кому предлагать, контакты и проверки перед продажей."}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {parsed.tags.map((tag) => <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-navy shadow-sm">{tag}</span>)}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} aria-label="Редактировать" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-navy/60 hover:text-navy"><Pencil size={16} /></button>
            <button onClick={handleDelete} aria-label="Удалить" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-navy/60 hover:text-red-600"><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-6">
          <a href="#regions" className="rounded-2xl bg-white p-3 text-center shadow-sm"><p className="text-lg font-bold text-navy">{regions.length}</p><p className="text-[11px] text-foreground/50">регионы</p></a>
          <a href="#hotels" className="rounded-2xl bg-white p-3 text-center shadow-sm"><p className="text-lg font-bold text-navy">{hotels.length}</p><p className="text-[11px] text-foreground/50">отели</p></a>
          <a href="#attractions" className="rounded-2xl bg-white p-3 text-center shadow-sm"><p className="text-lg font-bold text-navy">{attractions.length}</p><p className="text-[11px] text-foreground/50">объекты</p></a>
          <a href="#airlines" className="rounded-2xl bg-white p-3 text-center shadow-sm"><p className="text-lg font-bold text-navy">{airlines.length}</p><p className="text-[11px] text-foreground/50">авиа</p></a>
          <a href="#perks" className="rounded-2xl bg-white p-3 text-center shadow-sm"><p className="text-lg font-bold text-navy">{perks.length}</p><p className="text-[11px] text-foreground/50">плюшки</p></a>
          <a href="#contacts" className="rounded-2xl bg-white p-3 text-center shadow-sm"><p className="text-lg font-bold text-navy">{contacts.length}</p><p className="text-[11px] text-foreground/50">контакты</p></a>
        </div>
      </div>

      <div className="sticky top-0 z-20 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <a href="#overview" className="rounded-full bg-blue-light px-3 py-1.5 text-navy">Обзор</a>
            <a href="#season" className="rounded-full bg-blue-light px-3 py-1.5 text-navy">Сезонность</a>
            <a href="#regions" className="rounded-full bg-blue-light px-3 py-1.5 text-navy">Регионы</a>
            <a href="#airlines" className="rounded-full bg-blue-light px-3 py-1.5 text-navy">Авиакомпании</a>
            <a href="#hotels" className="rounded-full bg-blue-light px-3 py-1.5 text-navy">Отели</a>
            <a href="#source" className="rounded-full bg-blue-light px-3 py-1.5 text-navy">Исходник</a>
          </div>
          <div className="relative min-w-[260px] flex-1 lg:max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: регион, отель, авиакомпания, депозит…" className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-blue" />
            {query && <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-foreground/50 hover:bg-blue-light"><X size={14} /></button>}
          </div>
        </div>
      </div>

      <Section id="overview" title="Обзор для менеджера">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <BulletBlock title="Кому продавать" items={uniq(cards.flatMap((card) => card.who), 6)} tone="green" />
          <BulletBlock title="Осторожно" items={uniq(cards.flatMap((card) => card.avoid), 6)} tone="amber" />
          <BulletBlock title="Проверить" items={uniq(cards.flatMap((card) => card.check), 6)} tone="blue" />
        </div>
      </Section>

      <Section id="season" title="Сезонность">
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-12 gap-1">
            {MONTHS.map((month, index) => {
              const comfortable = [0, 1, 2, 3, 9, 10, 11].includes(index);
              const hot = [4, 5, 6, 7, 8].includes(index);
              return <div key={month} className={`rounded-xl px-2 py-3 text-center text-xs font-semibold ${comfortable ? "bg-green-100 text-green-800" : hot ? "bg-orange-100 text-orange-800" : "bg-blue-light text-navy"}`}>{month}</div>;
            })}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {season.map((item, index) => <div key={index} className="rounded-2xl border border-black/5 bg-cream p-4 text-sm leading-6 text-foreground/75">{item}</div>)}
        </div>
      </Section>

      <Section id="regions" title="Страны и регионы">
        {regions.length ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{regions.map((card) => <SmartCardView key={card.id} card={card} />)}</div> : <p className="text-sm text-foreground/50">Региональные карточки не распознаны автоматически. Смотри исходную базу ниже.</p>}
      </Section>

      <Section id="airlines" title="Авиакомпании и логистика">
        {airlines.length ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{airlines.map((card) => <SmartCardView key={card.id} card={card} />)}</div> : <p className="text-sm text-foreground/50">Блок авиакомпаний не распознан автоматически. Смотри исходную базу ниже.</p>}
      </Section>

      {hotels.length > 0 && <Section id="hotels" title="Отели"><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{hotels.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {attractions.length > 0 && <Section id="attractions" title="Достопримечательности и досуг"><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{attractions.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {perks.length > 0 && <Section id="perks" title="Плюшки агентам"><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{perks.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {contacts.length > 0 && <Section id="contacts" title="Контакты"><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{contacts.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {other.length > 0 && <Section id="other" title="Другие карточки"><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{other.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}

      <Section id="checklist" title="Чек-лист перед продажей">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <BulletBlock title="Логистика" items={["аэропорт прилёта", "трансфер", "время вылета", "багаж", "стыковка"]} />
          <BulletBlock title="Отель" items={["пляж", "депозит", "питание", "реновация", "детская инфраструктура"]} />
          <BulletBlock title="Направление" items={["сезонность", "жара / дожди / волны", "визовые правила", "налоги и сборы"]} />
          <BulletBlock title="Продажа" items={["кому подходит", "кому не подходит", "главный аргумент", "что может вызвать недовольство"]} />
        </div>
      </Section>

      <Section id="source" title="Исходная база">
        <details open={cards.length === 0} className="rounded-2xl border border-dashed border-black/10 bg-cream/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-blue">Показать / скрыть исходный текст</summary>
          <div className="kb-source mt-4 text-sm leading-7 text-foreground/75" dangerouslySetInnerHTML={{ __html: parsed.sourceHtml }} />
        </details>
      </Section>

      <style>{`
        .kb-source h1, .kb-source h2, .kb-source h3 { color: #092a5e; font-weight: 700; margin-top: 22px; }
        .kb-source p { margin: 8px 0; max-width: 92ch; }
        .kb-source ul, .kb-source ol { padding-left: 20px; margin: 10px 0; }
        .kb-source img { max-width: 100%; border-radius: 14px; }
        .kb-source table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
        .kb-source td, .kb-source th { border: 1px solid rgba(0,0,0,.1); padding: 8px; }
      `}</style>
    </div>
  );
}
