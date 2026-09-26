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

type CardKind = "country" | "airline" | "hotel" | "attraction" | "perk" | "contact" | "other";

type SmartCard = {
  id: string;
  kind: CardKind;
  title: string;
  subtitle: string;
  summary: string;
  tags: string[];
  who: string[];
  season: string[];
  logistics: string[];
  avoid: string[];
  check: string[];
  detailsHtml: string;
  searchText: string;
};

type ParsedKnowledge = {
  title: string;
  lead: string;
  heroTags: string[];
  cards: SmartCard[];
  sourceHtml: string;
  stats: Record<CardKind, number>;
};

const EMPTY_STATS: Record<CardKind, number> = {
  country: 0,
  airline: 0,
  hotel: 0,
  attraction: 0,
  perk: 0,
  contact: 0,
  other: 0,
};

const KIND_LABEL: Record<CardKind, string> = {
  country: "Страны / регионы",
  airline: "Авиакомпании",
  hotel: "Отели",
  attraction: "Что посмотреть",
  perk: "Плюшки агентам",
  contact: "Контакты",
  other: "Прочее",
};

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
function splitSentences(value: string) {
  return cleanText(value).split(/(?<=[.!?…])\s+/).map((item) => item.trim()).filter(Boolean);
}
function cut(value: string, limit = 230) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}
function uniq(values: string[], limit = 7) {
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
function extractByRegex(text: string, regex: RegExp, limit = 5) {
  return uniq(splitSentences(text).filter((sentence) => regex.test(sentence)).map((sentence) => cut(sentence, 220)), limit);
}
function makeId(value: string, index: number) {
  const base = value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 45);
  return `${base || "card"}-${index}`;
}
function previousHeading(root: Element, element: Element) {
  let result = "";
  for (const heading of Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4"))) {
    if (heading === element) break;
    if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) result = cleanText(heading.textContent);
  }
  return result;
}
function cardTitle(element: Element) {
  const heading = element.querySelector("h1,h2,h3,h4,strong,b");
  return cleanText(heading?.textContent ?? "");
}
function classifyCard(title: string, text: string, section: string): CardKind {
  const all = `${title} ${section} ${text}`.toLowerCase();
  if (/авиакомпан|перевозчик|airline|emirates|etihad|flydubai|air arabia|qatar airways|turkish|oman air|gulf air|аэрофлот|победа|red wings|azur|royal jordanian/.test(all)) return "airline";
  if (/контакт|whatsapp|telegram|телефон|email|sales|reservation|представител/.test(all)) return "contact";
  if (/плюшк|бонус|комисс|day pass|fam trip|агент|incentive|loyalty|апгрейд/.test(all)) return "perk";
  if (/отел|hotel|resort|rixos|jumeirah|address|hilton|radisson|fairmont|anantara|rotana|marriott|waldorf|wyndham|sheraton|intercontinental|hyatt|ritz|centara|movenpick|doubletree|hampton|pullman/.test(all)) return "hotel";
  if (/достопримечатель|музе|парк|зоопарк|zoo|остров|маршрут|что посмотреть|экскурс|ресторан|ночная жизнь|yas|louvre|ferrari|warner|аквапарк|island|beach club|национальный музей|emirates zoo/.test(all)) return "attraction";
  if (/страна|регион|эмират|курорт|район|дубай|абу-даби|шардж|рас-эль-хайм|фуджейр|аджман|аль-айн|аль-дафра|jbr|marina|palm|саадият|deira|downtown|оаэ|катар|оман|бахрейн|сауд/.test(all)) return "country";
  return "other";
}
function tagsFor(title: string, text: string, kind: CardKind) {
  const all = `${title} ${text}`.toLowerCase();
  const tags: string[] = [];
  if (kind === "country") tags.push("страна / регион");
  if (kind === "airline") tags.push("перелёт");
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
  if (/прям|рейс|аэропорт|стыков|багаж/.test(all)) tags.push("авиа");
  return uniq(tags, 8);
}
function countrySeason(title: string, text: string) {
  const all = `${title} ${text}`.toLowerCase();
  const found = extractByRegex(text, /сезон|летом|зимой|октябр|ноябр|декабр|январ|феврал|март|апрел|май|июн|июл|август|сентябр|жарко|дожд/i, 3);
  if (found.length) return found;
  if (/оаэ|дубай|абу-даби|шардж|рас-эль-хайм|фуджейр|аджман|эмират|оман|катар|бахрейн|сауд/.test(all)) {
    return [
      "Октябрь–апрель — основной комфортный сезон: пляж, прогулки, парки, экскурсии и семейный отдых.",
      "Май–сентябрь — жаркий низкий сезон: продавать через хорошие отели, бассейны, моллы, аквапарки и выгодную цену.",
      "Летом обязательно проговаривать жару и уточнять, что клиент готов к отдыху в формате отель + бассейн + моллы.",
    ];
  }
  return ["Сезонность в карточке не выделена. Перед продажей проверить погоду, море, ограничения отеля и авиапрограмму на даты клиента."];
}
function airlineSeason(text: string) {
  return uniq([...extractByRegex(text, /сезон|рейс|летает|расписан|чартер|регуляр|октябр|ноябр|декабр|частот/i, 3), "Расписание, частоту рейсов, багаж, тариф и стыковки проверять на даты заявки: авиасетка меняется по сезону."], 4);
}
function whoFor(title: string, text: string, kind: CardKind) {
  const found = extractByRegex(text, /подходит|для гостей|для турист|для семей|семь|дет|парам|молодеж|шопинг|музе|культур|пляж|экскурс|премиум|бюджет|эконом/i, 4);
  if (found.length) return found;
  const all = `${title} ${text}`.toLowerCase();
  if (kind === "airline") return ["Туристам, для которых важны время вылета, аэропорт прилёта, багаж и удобная стыковка."];
  if (/дубай/.test(all)) return ["Активным туристам, семьям, любителям шопинга, парков, ресторанов, пляжа и первого знакомства с ОАЭ."];
  if (/абу-даби/.test(all)) return ["Семьям, парам, премиум-клиентам, любителям музеев, парков развлечений, спокойных пляжей и культуры."];
  if (/шардж/.test(all)) return ["Бюджетным туристам и семьям, если подходит спокойный формат и логистика до Дубая."];
  if (/рас-эль-хайм/.test(all)) return ["Туристам, которым нужен спокойный пляж, территория отеля и меньше городской суеты."];
  return ["Туристам, которым подходит формат направления. Перед подбором уточнить: пляж, город, экскурсии, бюджет и состав семьи."];
}
function avoidFor(text: string, kind: CardKind) {
  const found = extractByRegex(text, /не подходит|не предлагать|не стоит|минус|дорого|далеко|долго|только|кроме|однако|важно учитывать|огранич|депозит|жарко/i, 4);
  if (found.length) return found;
  if (kind === "airline") return ["Не предлагать без проверки багажа, стыковки, аэропорта, времени вылета и правил тарифа."];
  return ["Не предлагать без уточнения ожиданий: пляж, город, all inclusive, детская инфраструктура, жара, бюджет и депозиты."];
}
function logisticsFor(text: string, kind: CardKind) {
  const regex = kind === "airline" ? /рейс|маршрут|стыков|аэропорт|багаж|питание|терминал|класс|лоукост|тариф|прям/i : kind === "country" ? /район|пляж|остров|отел|аэропорт|шопинг|парк|музе|молл|марина|центр|курорт|трансфер|дорога|минут|час/i : /пляж|питание|номер|дет|территор|депозит|реновац|бассейн|ресторан|трансфер|стоимость|билет/i;
  return extractByRegex(text, regex, 5);
}
function checkFor(text: string, kind: CardKind) {
  const regex = kind === "airline" ? /багаж|стыков|терминал|аэропорт|питание|тариф|возврат|обмен|время вылета|ручн|лоукост/i : /депозит|трансфер|пляж|аэропорт|район|реновац|закрыт|виза|правил|налог|сбор|питание|вход в море|парк|билет/i;
  const found = extractByRegex(text, regex, 6);
  if (found.length) return found;
  return kind === "airline" ? ["Багаж и ручная кладь", "Аэропорт прилёта/вылета", "Время стыковки", "Питание на борту", "Условия тарифа: возврат и обмен"] : ["Район проживания", "Пляж и трансфер", "Депозит и обязательные сборы", "Питание", "Реновации / закрытия инфраструктуры"];
}
function parseKnowledgeHtml(html: string, title: string): ParsedKnowledge {
  const root = document.createElement("div");
  root.innerHTML = html;
  root.querySelectorAll("script,style").forEach((node) => node.remove());
  const lead = cut(cleanText(root.querySelector("p")?.textContent ?? root.textContent), 360);
  const cards: SmartCard[] = [];
  Array.from(root.querySelectorAll<HTMLElement>(".grid")).forEach((grid, gridIndex) => {
    const section = previousHeading(root, grid);
    Array.from(grid.children).forEach((child, childIndex) => {
      if (!(child instanceof HTMLElement)) return;
      const text = cleanText(child.innerText);
      const heading = cardTitle(child) || splitSentences(text)[0] || section || `Карточка ${cards.length + 1}`;
      if (text.length < 40) return;
      const kind = classifyCard(heading, text, section);
      if (kind === "other" && text.length < 220) return;
      const body = cleanText(text.startsWith(heading) ? text.slice(heading.length) : text);
      cards.push({
        id: makeId(heading, gridIndex * 100 + childIndex),
        kind,
        title: heading,
        subtitle: section,
        summary: cut(splitSentences(body)[0] ?? body, kind === "country" || kind === "airline" ? 260 : 220),
        tags: tagsFor(heading, body, kind),
        who: whoFor(heading, body, kind),
        season: kind === "airline" ? airlineSeason(body) : countrySeason(heading, body),
        logistics: logisticsFor(body, kind),
        avoid: avoidFor(body, kind),
        check: checkFor(body, kind),
        detailsHtml: child.innerHTML,
        searchText: `${heading} ${section} ${text}`.toLowerCase(),
      });
    });
  });
  const stats = { ...EMPTY_STATS };
  cards.forEach((card) => { stats[card.kind] += 1; });
  const heroTags = uniq([...cards.flatMap((card) => card.tags), stats.country ? "страны / регионы" : "", stats.airline ? "авиакомпании" : "", stats.hotel ? "отели" : "", stats.perk ? "плюшки агентам" : "", stats.contact ? "контакты" : ""], 10);
  return { title, lead, heroTags, cards, sourceHtml: html, stats };
}
function CardBullets({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "good" | "warn" | "season" }) {
  if (!items.length) return null;
  return <div className={`kb-info-box kb-info-${tone}`}><p className="kb-info-title">{title}</p><ul>{items.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}</ul></div>;
}
function SmartCardView({ card }: { card: SmartCard }) {
  return (
    <article className={`kb-card kb-card-${card.kind} ${card.kind === "country" || card.kind === "airline" ? "kb-card-primary" : ""}`} id={card.id}>
      <div className="kb-card-head"><div><p className="kb-kicker">{KIND_LABEL[card.kind]}</p><h3>{card.title}</h3>{card.subtitle && <p className="kb-subtitle">{card.subtitle}</p>}</div><span className="kb-kind-pill">{card.kind === "country" ? "направление" : card.kind === "airline" ? "логистика" : KIND_LABEL[card.kind]}</span></div>
      {card.tags.length > 0 && <div className="kb-tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      {card.summary && <p className="kb-summary">{card.summary}</p>}
      {card.kind === "country" && <div className="kb-country-layout"><CardBullets title="Кому предлагать" items={card.who} tone="good" /><CardBullets title="Сезонность" items={card.season} tone="season" /><CardBullets title="Районы / отели / ориентиры" items={card.logistics} /><CardBullets title="Осторожно" items={card.avoid} tone="warn" /><CardBullets title="Проверить перед продажей" items={card.check} /></div>}
      {card.kind === "airline" && <div className="kb-airline-layout"><CardBullets title="Кому использовать" items={card.who} tone="good" /><CardBullets title="Расписание / сезонность" items={card.season} tone="season" /><CardBullets title="Маршрут и особенности" items={card.logistics} /><CardBullets title="Ограничения" items={card.avoid} tone="warn" /><CardBullets title="Проверить" items={card.check} /></div>}
      {card.kind !== "country" && card.kind !== "airline" && <div className="kb-compact-grid"><CardBullets title="Кому / зачем" items={card.who} tone="good" /><CardBullets title="Проверить" items={card.check} /><CardBullets title="Осторожно" items={card.avoid} tone="warn" /></div>}
      <details className="kb-details"><summary>Полное описание</summary><div dangerouslySetInnerHTML={{ __html: card.detailsHtml }} /></details>
    </article>
  );
}
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="kb-section"><h2>{title}</h2>{children}</section>;
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
  const [parsed, setParsed] = useState<ParsedKnowledge | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => { let active = true; getKnowledgeArticle(articleId).then((data) => { if (!active) return; setArticle(data); setTitle(data.title); setDirectionId(data.direction ? String(data.direction) : ""); setContent(data.content); setLoading(false); }); return () => { active = false; }; }, [articleId]);
  useEffect(() => { fetchDirections().then(setDirections); }, []);
  useEffect(() => { if (!article || editing) return; setParsed(parseKnowledgeHtml(article.content, article.title)); }, [article, editing]);
  const filteredCards = useMemo(() => { if (!parsed) return []; const value = query.trim().toLowerCase(); if (!value) return parsed.cards; return parsed.cards.filter((card) => card.searchText.includes(value)); }, [parsed, query]);
  const byKind = (kind: CardKind) => filteredCards.filter((card) => card.kind === kind);
  async function handleSave() { setSaving(true); try { const updated = await updateKnowledgeArticle(articleId, { title, direction: directionId ? Number(directionId) : null, content }); setArticle(updated); setEditing(false); } finally { setSaving(false); } }
  async function handleDelete() { if (!confirm("Удалить статью безвозвратно?")) return; await deleteKnowledgeArticle(articleId); router.push("/crm/knowledge-base"); }
  if (loading) return <p className="text-sm text-foreground/50">Загрузка…</p>;
  if (!article) return <p className="text-sm text-foreground/50">Статья не найдена.</p>;
  if (editing) return <div><button onClick={() => setEditing(false)} className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"><ArrowLeft size={15} /> Назад</button><div className="rounded-2xl border border-black/5 bg-white p-6 sm:p-8"><div className="flex flex-col gap-3"><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-black/10 px-3 py-2 text-lg font-bold text-navy outline-none focus:border-blue" /><select value={directionId} onChange={(e) => setDirectionId(e.target.value)} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue sm:w-64"><option value="">Без направления</option>{directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={24} className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-xs outline-none focus:border-blue" /><div className="flex gap-2"><button onClick={handleSave} disabled={saving} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-blue disabled:opacity-60">{saving ? "Сохраняем…" : "Сохранить"}</button><button onClick={() => setEditing(false)} className="rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-foreground/60 hover:bg-blue-light/40">Отмена</button></div></div></div></div>;
  if (!parsed) return <p className="text-sm text-foreground/50">Разбираем базу…</p>;
  const countries = byKind("country"); const airlines = byKind("airline"); const hotels = byKind("hotel"); const attractions = byKind("attraction"); const perks = byKind("perk"); const contacts = byKind("contact"); const other = byKind("other");
  const navItems = [["overview", "Обзор"], ["season", "Сезонность"], ["countries", "Страны / регионы"], ["airlines", "Авиакомпании"], ["hotels", "Отели"], ["attractions", "Что посмотреть"], ["perks", "Плюшки"], ["contacts", "Контакты"], ["checklist", "Чек-лист"], ["source", "Исходник"]];
  return (
    <div className="kb-page">
      <button onClick={() => router.push("/crm/knowledge-base")} className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"><ArrowLeft size={15} /> База знаний</button>
      <div className="kb-hero"><div><p className="kb-kicker">Внутренняя база турагентства</p><h1>{article.title}</h1>{parsed.lead && <p className="kb-hero-lead">{parsed.lead}</p>}<div className="kb-tags kb-hero-tags">{parsed.heroTags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="kb-hero-side"><p className="kb-side-title">Быстрый вывод</p><p><b>Лучше продавать:</b> октябрь–апрель, если это Ближний Восток / ОАЭ.</p><p><b>Осторожно:</b> май–сентябрь, жара, депозиты, пляж и трансфер.</p><p><b>Проверить:</b> авиапрограмма, багаж, район, питание, депозит, закрытия инфраструктуры.</p></div><div className="kb-actions"><button onClick={() => setEditing(true)} title="Редактировать"><Pencil size={16} /></button><button onClick={handleDelete} title="Удалить"><Trash2 size={16} /></button></div></div>
      <div className="kb-search-panel"><div className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: страна, регион, авиакомпания, отель, депозит, сезон, багаж…" className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-10 text-sm outline-none focus:border-blue" />{query && <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-foreground/50 hover:bg-blue-light"><X size={14} /></button>}</div><p>Найдено карточек: {filteredCards.length} из {parsed.cards.length}</p></div>
      <nav className="kb-anchor-nav">{navItems.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
      <Section id="overview" title="Обзор"><div className="kb-stat-grid"><div><b>{parsed.stats.country}</b><span>стран / регионов</span></div><div><b>{parsed.stats.airline}</b><span>авиакомпаний</span></div><div><b>{parsed.stats.hotel}</b><span>отелей</span></div><div><b>{parsed.stats.attraction}</b><span>объектов / идей</span></div><div><b>{parsed.stats.perk}</b><span>плюшек агентам</span></div><div><b>{parsed.stats.contact}</b><span>контактов</span></div></div></Section>
      <Section id="season" title="Сезонность"><div className="kb-months">{MONTHS.map((month, index) => <span key={month} className={index >= 9 || index <= 3 ? "kb-month-good" : index >= 4 && index <= 8 ? "kb-month-hot" : ""}>{month}</span>)}</div><div className="kb-compact-grid"><CardBullets title="Лучший период" items={["Октябрь–апрель — комфортный сезон для пляжа, прогулок, экскурсий и семейного отдыха."]} tone="good" /><CardBullets title="Жаркий период" items={["Май–сентябрь — продавать аккуратно: бассейны, моллы, хорошие отели, цена, готовность клиента к жаре."]} tone="warn" /><CardBullets title="Перед продажей" items={["Проверить фактическую погоду, море, трансфер, депозит, закрытия инфраструктуры и авиапрограмму на даты клиента."]} /></div></Section>
      {countries.length > 0 && <Section id="countries" title="Страны и регионы"><div className="kb-card-list kb-country-list">{countries.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {airlines.length > 0 && <Section id="airlines" title="Авиакомпании и логистика"><div className="kb-card-list kb-airline-list">{airlines.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {hotels.length > 0 && <Section id="hotels" title="Отели"><div className="kb-card-list">{hotels.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {attractions.length > 0 && <Section id="attractions" title="Достопримечательности и идеи для продажи"><div className="kb-card-list">{attractions.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {perks.length > 0 && <Section id="perks" title="Плюшки агентам"><div className="kb-card-list">{perks.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {contacts.length > 0 && <Section id="contacts" title="Контакты"><div className="kb-card-list">{contacts.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      {other.length > 0 && <Section id="other" title="Прочее"><div className="kb-card-list">{other.map((card) => <SmartCardView key={card.id} card={card} />)}</div></Section>}
      <Section id="checklist" title="Чек-лист перед продажей"><div className="kb-checklist"><CardBullets title="Логистика" items={["аэропорт прилёта", "трансфер", "время вылета", "багаж", "стыковка"]} /><CardBullets title="Отель" items={["пляж", "депозит", "питание", "реновация", "family room / extra bed"]} /><CardBullets title="Направление" items={["сезонность", "жара / дожди / волны", "визовые правила", "налоги и сборы"]} /><CardBullets title="Продажа" items={["кому подходит", "кому не подходит", "главный аргумент для клиента", "что может вызвать недовольство"]} /></div></Section>
      <Section id="source" title="Исходный текст базы"><details className="kb-source-details"><summary>Показать исходную базу полностью</summary><div className="kb-source" dangerouslySetInnerHTML={{ __html: parsed.sourceHtml }} /></details></Section>
      <style>{`.kb-page{color:#1f3557}.kb-page section{scroll-margin-top:95px}.kb-hero{position:relative;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr);gap:20px;border-radius:28px;background:linear-gradient(135deg,#eef6ff,#fff8ea);border:1px solid rgba(9,42,94,.08);padding:28px}.kb-kicker{margin:0 0 6px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(9,42,94,.5)}.kb-hero h1{margin:0;color:#092a5e;font-size:30px;line-height:1.15}.kb-hero-lead{margin-top:12px;max-width:900px;line-height:1.65;color:rgba(31,53,87,.78)}.kb-hero-side{border-radius:22px;background:rgba(255,255,255,.78);border:1px solid rgba(0,0,0,.05);padding:18px;font-size:13px;line-height:1.55}.kb-side-title{margin:0 0 8px;color:#092a5e;font-weight:800}.kb-actions{position:absolute;top:18px;right:18px;display:flex;gap:8px}.kb-actions button{display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:#fff;color:#092a5e;border:1px solid rgba(0,0,0,.06)}.kb-tags{display:flex;flex-wrap:wrap;gap:6px}.kb-tags span,.kb-kind-pill{border-radius:999px;background:#eef5ff;color:#092a5e;padding:5px 10px;font-size:11px;font-weight:800}.kb-hero-tags{margin-top:16px}.kb-search-panel{display:flex;align-items:center;gap:14px;margin:18px 0;border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.06);padding:12px}.kb-search-panel p{margin:0;white-space:nowrap;font-size:12px;color:rgba(31,53,87,.55)}.kb-anchor-nav{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px;padding:12px;border-radius:18px;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border:1px solid rgba(0,0,0,.06)}.kb-anchor-nav a{border-radius:999px;border:1px solid rgba(9,42,94,.12);padding:7px 11px;color:#092a5e;font-size:12px;font-weight:700;text-decoration:none}.kb-section{margin-top:26px}.kb-section h2{margin:0 0 14px;color:#092a5e;font-size:22px}.kb-stat-grid,.kb-compact-grid,.kb-checklist{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.kb-stat-grid div{border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.06);padding:16px}.kb-stat-grid b{display:block;color:#092a5e;font-size:26px;line-height:1}.kb-stat-grid span{margin-top:5px;display:block;font-size:12px;color:rgba(31,53,87,.55)}.kb-months{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;margin-bottom:12px}.kb-months span{border-radius:10px;background:#f1f5f9;padding:10px 4px;text-align:center;font-size:11px;font-weight:800;color:rgba(31,53,87,.65)}.kb-month-good{background:#dcfce7!important;color:#166534!important}.kb-month-hot{background:#ffedd5!important;color:#9a3412!important}.kb-card-list{display:grid;grid-template-columns:1fr;gap:16px}.kb-country-list,.kb-airline-list{gap:20px}.kb-card{border-radius:22px;background:#fff;border:1px solid rgba(9,42,94,.08);padding:20px;box-shadow:0 12px 28px rgba(9,42,94,.05)}.kb-card-primary{border-left:6px solid #f0c76a}.kb-card-airline{border-left-color:#93c5fd}.kb-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.kb-card h3{margin:0;color:#092a5e;font-size:20px;line-height:1.25}.kb-subtitle{margin:4px 0 0;color:rgba(31,53,87,.45);font-size:12px}.kb-summary{max-width:92ch;margin:12px 0 0;color:rgba(31,53,87,.78);line-height:1.65}.kb-country-layout,.kb-airline-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.kb-info-box{border-radius:16px;border:1px solid rgba(0,0,0,.06);background:#f8fafc;padding:13px 15px}.kb-info-good{background:#f0fdf4;border-color:rgba(34,197,94,.20)}.kb-info-warn{background:#fff7ed;border-color:rgba(249,115,22,.22)}.kb-info-season{background:#fff8e6;border-color:rgba(240,199,106,.45)}.kb-info-title{margin:0 0 7px;color:rgba(9,42,94,.62);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.kb-info-box ul{margin:0;padding-left:18px}.kb-info-box li{margin:5px 0;font-size:13px;line-height:1.55;color:rgba(31,53,87,.82)}.kb-details{margin-top:14px;border-top:1px dashed rgba(0,0,0,.12);padding-top:10px}.kb-details summary,.kb-source-details summary{cursor:pointer;color:#1d4ed8;font-size:12px;font-weight:800}.kb-details div,.kb-source{margin-top:10px;color:rgba(31,53,87,.70);font-size:13px;line-height:1.65}.kb-source{border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.06);padding:18px}.kb-source .grid{display:grid;grid-template-columns:1fr;gap:12px}@media(max-width:980px){.kb-hero,.kb-country-layout,.kb-airline-layout,.kb-stat-grid,.kb-compact-grid,.kb-checklist{grid-template-columns:1fr}.kb-months{grid-template-columns:repeat(6,1fr)}.kb-search-panel{flex-direction:column;align-items:stretch}}`}</style>
    </div>
  );
}
