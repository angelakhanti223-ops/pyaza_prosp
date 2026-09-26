"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Search, Trash2, X } from "lucide-react";
import {
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  updateKnowledgeArticle,
  type KnowledgeArticleDetail,
} from "@/lib/crmApi";
import { fetchDirections, type Direction } from "@/lib/api";

type TocItem = { id: string; label: string; level: number };

const CARD_CONTEXT_RE = /эмират|регион|страны|страна|авиакомпан|перевозчик|airline/i;
const AIRLINE_RE = /авиакомпан|перевозчик|airline|emirates|etihad|qatar|flydubai|air arabia|aeroflot|аэрофлот|победа|azur|red wings|turkish|oman air|gulf air/i;
const COUNTRY_RE = /дубай|абу-даби|шардж|рас-эль-хайм|фуджейр|аджман|оаэ|оман|катар|бахрейн|сауд|иордан|мальдив|шри-ланк|таиланд|вьетнам|индонез|малайз/i;

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function splitSentences(value: string) {
  return cleanText(value)
    .split(/(?<=[.!?…])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cut(value: string, limit = 240) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

function slugify(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `section-${index}`;
}

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function findPreviousHeadingText(root: HTMLElement, element: Element) {
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4"));
  let result = "";
  for (const heading of headings) {
    if (heading === element) break;
    if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
      result = cleanText(heading.textContent);
    }
  }
  return result;
}

function extractByRegex(text: string, regex: RegExp, limit = 4) {
  return splitSentences(text)
    .filter((sentence) => regex.test(sentence))
    .map((sentence) => cut(sentence, 220))
    .filter((sentence, index, array) => array.indexOf(sentence) === index)
    .slice(0, limit);
}

function chipsForCard(title: string, text: string, isAirline: boolean) {
  const all = `${title} ${text}`.toLowerCase();
  const chips: string[] = [];

  if (isAirline) chips.push("Авиакомпания");
  else chips.push("Страна / регион");

  if (/безвиз|без виз/.test(all)) chips.push("Безвиз / простой въезд");
  if (/прям/.test(all)) chips.push("Прямые рейсы");
  if (/стыков/.test(all)) chips.push("Стыковки");
  if (/багаж/.test(all)) chips.push("Багаж проверить");
  if (/депозит/.test(all)) chips.push("Депозиты");
  if (/семь|дет/.test(all)) chips.push("Семьи");
  if (/пляж|море|остров/.test(all)) chips.push("Пляж");
  if (/шопинг|торгов/.test(all)) chips.push("Шопинг");
  if (/музе|культур|экскурс/.test(all)) chips.push("Экскурсии");
  if (/парк|аквапарк|развлеч/.test(all)) chips.push("Развлечения");

  return [...new Set(chips)].slice(0, 7);
}

function countrySeasonality(title: string, text: string) {
  const all = `${title} ${text}`.toLowerCase();
  const existing = extractByRegex(text, /сезон|октябр|ноябр|декабр|январ|феврал|март|апрел|май|июн|июл|август|сентябр|летом|зимой|жарко|дожд/i, 3);
  if (existing.length >= 2) return existing;

  if (/дубай|абу-даби|шардж|рас-эль-хайм|фуджейр|аджман|оаэ|оман|катар|бахрейн|сауд/.test(all)) {
    return [
      "Лучший период продаж: октябрь–апрель — комфортнее для прогулок, экскурсий, пляжа и семейного отдыха.",
      "Май–сентябрь — жаркий низкий сезон: продавать через хорошие отели, бассейны, аквапарки, моллы, рестораны и выгодные цены.",
      "Перед продажей проверить: депозит, пляж/трансфер до пляжа, закрытия бассейнов и ресторанов, фактическую авиапрограмму на даты клиента.",
    ];
  }

  if (/мальдив/.test(all)) {
    return [
      "Ориентир по сезону: декабрь–апрель — высокий сезон, май–октябрь — больше риск дождей, но часто лучше цены.",
      "Для продажи важно проверять не только погоду, но и трансфер, тип виллы, питание, риф, насекомых и условия для детей.",
    ];
  }

  if (/таиланд|вьетнам|индонез|малайз|шри-ланк/.test(all)) {
    return [
      "Сезонность зависит от конкретного курорта: перед продажей проверять месяц поездки, побережье, дожди, волны и трансфер.",
      "В карточке нужна привязка к датам клиента: где море спокойнее, где лучше экскурсии, где возможны ливни или волны.",
    ];
  }

  return ["Сезонность в исходной карточке не выделена. Перед продажей проверить погоду, море, ограничения отеля и авиапрограмму на даты клиента."];
}

function airlineSeasonality(text: string) {
  const found = extractByRegex(text, /сезон|летает|рейс|расписан|добавля|октябр|ноябр|декабр|чартер|регуляр/i, 3);
  return [
    ...(found.length ? found : []),
    "Расписание, частота рейсов, багаж и стыковки проверять по датам заявки: авиасетка меняется по сезону и направлению.",
  ].slice(0, 4);
}

function inferWho(title: string, text: string, isAirline: boolean) {
  const found = extractByRegex(
    text,
    /подходит|для гостей|для турист|для семей|семь|дет|парам|молодеж|шопинг|музе|культур|пляж|экскурс|премиум|эконом|бюджет/i,
    4,
  );
  if (found.length) return found;

  const lower = title.toLowerCase();
  if (isAirline) return ["Туристам, для которых важны удобная логистика, понятный багаж, время вылета и адекватная стыковка."];
  if (/дубай/.test(lower)) return ["Тем, кому нужны шопинг, парки развлечений, городская инфраструктура, пляжи и активная программа."];
  if (/абу-даби/.test(lower)) return ["Семьям и туристам, которым нужны культура, музеи, парки развлечений, спокойные отели и пляжный отдых."];
  if (/шардж/.test(lower)) return ["Бюджетным туристам и семьям, если подходит более спокойный формат и трансферная логистика до Дубая."];
  if (/рас-эль-хайм/.test(lower)) return ["Тем, кто хочет более спокойный пляжный отдых, отели с территорией и меньше городской суеты."];
  return ["Туристам, которым подходит формат направления, описанный в карточке. Уточнить ожидания клиента перед подбором."];
}

function inferDoNotOffer(text: string, isAirline: boolean) {
  const found = extractByRegex(text, /не подходит|не предлагать|не стоит|минус|дорого|далеко|долго|только|кроме|но |однако|важно учитывать|огранич/i, 3);
  if (found.length) return found;
  if (isAirline) return ["Не предлагать без проверки багажа, стыковки, аэропорта прилёта/вылета и правил тарифа."];
  return ["Не предлагать без уточнения ожиданий: нужен ли пляж, город, экскурсии, all inclusive, детская инфраструктура и бюджет."];
}

function inferCheck(text: string, isAirline: boolean) {
  const regex = isAirline
    ? /багаж|стыков|терминал|аэропорт|питание|тариф|возврат|обмен|время вылета|пересад|лоукост|ручн/i
    : /депозит|трансфер|пляж|аэропорт|район|реновац|закрыт|виза|правил|налог|сбор|питание|вход в море|парк|билет/i;
  const found = extractByRegex(text, regex, 5);
  if (found.length) return found;
  return isAirline
    ? ["Багаж и ручную кладь", "Время стыковки и аэропорт пересадки", "Условия тарифа: возврат, обмен, питание", "Ночную стыковку и удобство для детей"]
    : ["Район проживания и трансфер", "Пляж и формат отдыха", "Депозит и обязательные сборы", "Реновации / закрытия бассейнов и ресторанов", "Авиапрограмму на даты клиента"];
}

function inferFocus(text: string, isAirline: boolean) {
  const regex = isAirline
    ? /рейс|маршрут|стыков|аэропорт|багаж|питание|терминал|класс|лоукост/i
    : /район|пляж|остров|отел|аэропорт|шопинг|парк|музе|молл|марина|центр|курорт|остров/i;
  return extractByRegex(text, regex, 5);
}

function appendSection(parent: HTMLElement, title: string, items: string[], className = "") {
  const cleanItems = items.map(cleanText).filter(Boolean).slice(0, 6);
  if (!cleanItems.length) return;
  const section = createEl("div", `kb-smart-section ${className}`.trim());
  section.appendChild(createEl("p", "kb-smart-section-title", title));
  const ul = createEl("ul", "kb-smart-list");
  for (const item of cleanItems) {
    const li = createEl("li", "", item);
    ul.appendChild(li);
  }
  section.appendChild(ul);
  parent.appendChild(section);
}

function transformSmartCard(card: HTMLElement, contextText: string) {
  if (card.dataset.kbSmartCard === "1") return;
  const originalHtml = card.innerHTML;
  const heading = card.querySelector<HTMLElement>("h1,h2,h3,h4,strong,b");
  const title = cleanText(heading?.textContent);
  const fullText = cleanText(card.innerText);
  if (!title || fullText.length < 240) return;

  const context = contextText.toLowerCase();
  const isAirline = AIRLINE_RE.test(`${context} ${title} ${fullText}`) && !COUNTRY_RE.test(title);
  const isCountry = !isAirline && (COUNTRY_RE.test(`${title} ${fullText}`) || /эмират|регион|страна/.test(context));
  if (!isAirline && !isCountry) return;

  const bodyText = cleanText(fullText.replace(title, ""));
  const overview = cut(splitSentences(bodyText)[0] ?? bodyText, 260);
  const chips = chipsForCard(title, bodyText, isAirline);

  card.dataset.kbSmartCard = "1";
  card.classList.add("kb-smart-card");
  card.innerHTML = "";

  const header = createEl("div", "kb-smart-header");
  const titleWrap = createEl("div", "");
  titleWrap.appendChild(createEl("p", "kb-smart-kicker", isAirline ? "Авиакомпания / логистика" : "Страна / регион"));
  titleWrap.appendChild(createEl("h3", "kb-smart-title", title));
  header.appendChild(titleWrap);
  card.appendChild(header);

  if (chips.length) {
    const chipsWrap = createEl("div", "kb-smart-chips");
    for (const chip of chips) chipsWrap.appendChild(createEl("span", "kb-smart-chip", chip));
    card.appendChild(chipsWrap);
  }

  if (overview) card.appendChild(createEl("p", "kb-smart-summary", overview));

  const grid = createEl("div", "kb-smart-body");
  appendSection(grid, "Кому предлагать", inferWho(title, bodyText, isAirline), "kb-positive");
  appendSection(grid, isAirline ? "Сезонность / расписание" : "Сезонность", isAirline ? airlineSeasonality(bodyText) : countrySeasonality(title, bodyText), "kb-season");
  appendSection(grid, "Кому не предлагать / ограничения", inferDoNotOffer(bodyText, isAirline), "kb-warning");
  appendSection(grid, isAirline ? "Маршрут и особенности" : "Районы / отели / ориентиры", inferFocus(bodyText, isAirline), "kb-focus");
  appendSection(grid, "Проверить перед продажей", inferCheck(bodyText, isAirline), "kb-check");
  card.appendChild(grid);

  const details = createEl("details", "kb-smart-details") as HTMLDetailsElement;
  const summary = createEl("summary", "kb-smart-details-title", "Полное описание из базы");
  const detailsBody = createEl("div", "kb-smart-details-body");
  detailsBody.innerHTML = originalHtml;
  details.appendChild(summary);
  details.appendChild(detailsBody);
  card.appendChild(details);
}

function splitLongPlainParagraph(paragraph: HTMLParagraphElement) {
  if (paragraph.dataset.kbSplit === "1") return;
  if (paragraph.closest(".kb-smart-card")) return;
  if (paragraph.querySelector("a, img, table, ul, ol, br")) return;
  const text = cleanText(paragraph.textContent);
  if (text.length < 420) return;

  const sentences = splitSentences(text);
  if (sentences.length < 3) return;

  const fragment = document.createDocumentFragment();
  let buffer = "";
  const push = () => {
    const value = buffer.trim();
    if (!value) return;
    const p = document.createElement("p");
    p.dataset.kbSplit = "1";
    p.textContent = value;
    fragment.appendChild(p);
    buffer = "";
  };

  for (const sentence of sentences) {
    if ((buffer + " " + sentence).trim().length > 280) push();
    buffer = `${buffer} ${sentence}`.trim();
  }
  push();
  paragraph.replaceWith(fragment);
}

function normalizeKnowledgeContent(container: HTMLElement): TocItem[] {
  container.querySelectorAll<HTMLElement>(".grid").forEach((grid) => {
    const context = findPreviousHeadingText(container, grid);
    const text = cleanText(grid.innerText);
    if (!CARD_CONTEXT_RE.test(`${context} ${text}`)) return;
    const children = Array.from(grid.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const hasLongCards = children.some((child) => cleanText(child.innerText).length > 260 && child.querySelector("h1,h2,h3,h4,strong,b"));
    if (!hasLongCards) return;
    grid.classList.add("kb-smart-card-list");
    children.forEach((child) => transformSmartCard(child, context));
  });

  container.querySelectorAll<HTMLParagraphElement>("p").forEach(splitLongPlainParagraph);

  const headings = Array.from(container.querySelectorAll<HTMLElement>("h2, h3")).filter((heading) => !heading.closest(".kb-smart-card"));
  return headings
    .map((heading, index) => {
      if (!heading.id) heading.id = slugify(heading.textContent ?? "", index);
      return {
        id: heading.id,
        label: cleanText(heading.textContent),
        level: heading.tagName === "H3" ? 3 : 2,
      };
    })
    .filter((item) => item.label)
    .slice(0, 18);
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
  const [toc, setToc] = useState<TocItem[]>([]);

  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const matchControlsRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const noResultsRef = useRef<HTMLParagraphElement>(null);
  const matchCountValue = useRef(0);
  const currentMatchValue = useRef(-1);

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

  useEffect(() => {
    if (!article || editing) return;
    const timer = window.setTimeout(() => {
      const container = contentRef.current;
      if (!container) return;
      setToc(normalizeKnowledgeContent(container));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [article, editing]);

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

  function clearHighlights() {
    const container = contentRef.current;
    if (!container) return;
    container.querySelectorAll("mark.kb-highlight").forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    });
  }

  function updateCounterDisplay() {
    if (counterRef.current) {
      counterRef.current.textContent = `${currentMatchValue.current + 1}/${matchCountValue.current}`;
    }
    if (matchControlsRef.current) {
      matchControlsRef.current.style.display = matchCountValue.current > 0 ? "flex" : "none";
    }
    if (noResultsRef.current) {
      const query = searchInputRef.current?.value.trim() ?? "";
      noResultsRef.current.style.display = query && matchCountValue.current === 0 ? "block" : "none";
    }
  }

  function scrollToMatch(index: number, marks: NodeListOf<HTMLElement>) {
    marks.forEach((m) => m.classList.remove("kb-highlight-active"));
    const target = marks[index];
    if (target) {
      target.classList.add("kb-highlight-active");
      const details = target.closest("details") as HTMLDetailsElement | null;
      if (details) details.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleSearch() {
    clearHighlights();
    const container = contentRef.current;
    const needle = (searchInputRef.current?.value ?? "").trim().toLowerCase();
    if (!container || !needle) {
      matchCountValue.current = 0;
      currentMatchValue.current = -1;
      updateCounterDisplay();
      return;
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const tag = node.parentElement?.tagName;
        return tag === "SCRIPT" || tag === "STYLE" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) textNodes.push(node as Text);

    let count = 0;
    for (const textNode of textNodes) {
      const text = textNode.textContent || "";
      const lower = text.toLowerCase();
      if (!lower.includes(needle)) continue;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let idx = lower.indexOf(needle);
      while (idx !== -1) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
        const mark = document.createElement("mark");
        mark.className = "kb-highlight";
        mark.textContent = text.slice(idx, idx + needle.length);
        frag.appendChild(mark);
        count += 1;
        lastIndex = idx + needle.length;
        idx = lower.indexOf(needle, lastIndex);
      }
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.parentNode?.replaceChild(frag, textNode);
    }

    matchCountValue.current = count;
    currentMatchValue.current = count > 0 ? 0 : -1;
    updateCounterDisplay();
    if (count > 0) scrollToMatch(0, container.querySelectorAll<HTMLElement>("mark.kb-highlight"));
  }

  function goToMatch(delta: number) {
    const container = contentRef.current;
    if (!container || matchCountValue.current === 0) return;
    const marks = container.querySelectorAll<HTMLElement>("mark.kb-highlight");
    const next = (currentMatchValue.current + delta + matchCountValue.current) % matchCountValue.current;
    currentMatchValue.current = next;
    updateCounterDisplay();
    scrollToMatch(next, marks);
  }

  function handleClearSearch() {
    if (searchInputRef.current) searchInputRef.current.value = "";
    clearHighlights();
    matchCountValue.current = 0;
    currentMatchValue.current = -1;
    updateCounterDisplay();
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

      <div className="rounded-2xl border border-black/5 bg-white p-6 sm:p-8">
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
              rows={20}
              className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-xs outline-none focus:border-blue"
            />
            <p className="text-xs text-foreground/40">
              HTML-разметка. Для крупной базы лучше делать структуру: h2 → блок → списки → карточки.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-blue disabled:opacity-60"
              >
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-foreground/60 hover:bg-blue-light/40"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-navy">{article.title}</h1>
                <p className="mt-1 text-xs text-foreground/40">
                  {article.direction_name && <>{article.direction_name} · </>}
                  {article.author?.full_name && <>{article.author.full_name} · </>}
                  обновлено {new Date(article.updated_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Редактировать"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-navy/50 hover:bg-blue-light hover:text-navy"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={handleDelete}
                  aria-label="Удалить"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-navy/50 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-blue/10 bg-blue-light/30 p-4">
              <p className="text-sm font-semibold text-navy">Поиск по этой базе</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Например: сезон, багаж, депозит, Dubai Marina, стыковка, семейным…"
                    defaultValue=""
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-24 text-sm outline-none focus:border-blue"
                  />
                  <div ref={matchControlsRef} className="absolute right-9 top-1/2 hidden -translate-y-1/2 items-center gap-1">
                    <span ref={counterRef} className="mr-1 text-xs text-foreground/50" />
                    <button onClick={() => goToMatch(-1)} aria-label="Предыдущее совпадение" className="rounded p-1 text-foreground/50 hover:bg-blue-light hover:text-navy">
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => goToMatch(1)} aria-label="Следующее совпадение" className="rounded p-1 text-foreground/50 hover:bg-blue-light hover:text-navy">
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <button onClick={handleClearSearch} aria-label="Очистить поиск" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-foreground/50 hover:bg-blue-light hover:text-navy">
                    <X size={14} />
                  </button>
                </div>
                <button onClick={handleSearch} className="rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue">
                  Найти
                </button>
              </div>
              <p ref={noResultsRef} className="mt-1.5 hidden text-xs text-foreground/40">Ничего не найдено.</p>
            </div>

            {toc.length > 0 && (
              <div className="mt-5 rounded-2xl border border-black/5 bg-cream p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">Содержание</p>
                <div className="flex flex-wrap gap-2">
                  {toc.map((item) => (
                    <a key={item.id} href={`#${item.id}`} className={`rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-navy hover:border-blue hover:text-blue ${item.level === 3 ? "opacity-80" : "font-semibold"}`}>
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <style>{`
              .kb-content { font-size: 15px; line-height: 1.75; }
              .kb-content nav#nav a { display: block; padding: 3px 0; }
              .kb-content #q, .kb-content #hits { display: none; }
              .kb-content mark.kb-highlight { background: #fde68a; border-radius: 3px; padding: 0 2px; }
              .kb-content mark.kb-highlight-active { background: #f59e0b; color: #111827; }
              .kb-content h2 { margin-top: 34px; border-top: 1px solid rgba(0,0,0,.08); padding-top: 24px; font-size: 22px; line-height: 1.25; }
              .kb-content h3 { margin-top: 22px; font-size: 18px; line-height: 1.35; }
              .kb-content h4 { margin-top: 18px; font-size: 15px; font-weight: 700; color: #092a5e; }
              .kb-content p { margin: 10px 0; max-width: 82ch; }
              .kb-content ul, .kb-content ol { margin: 10px 0 16px 0; padding-left: 20px; }
              .kb-content li { margin: 6px 0; }
              .kb-content table { display: block; width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 13px; }
              .kb-content th, .kb-content td { border: 1px solid rgba(0,0,0,.08); padding: 10px 12px; vertical-align: top; }
              .kb-content th { background: #f1f6ff; color: #092a5e; font-weight: 700; }
              .kb-content img { max-height: 420px; object-fit: cover; }
              .kb-content .kb-smart-card-list { display: grid !important; grid-template-columns: 1fr !important; gap: 16px !important; }
              .kb-content .kb-smart-card { border: 1px solid rgba(9,42,94,.10) !important; border-left: 5px solid #f0c76a !important; border-radius: 18px !important; background: #fff !important; padding: 18px !important; box-shadow: 0 10px 26px rgba(9,42,94,.05); }
              .kb-smart-header { display: flex; justify-content: space-between; gap: 12px; }
              .kb-smart-kicker { margin: 0 0 3px !important; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: rgba(9,42,94,.45); }
              .kb-smart-title { margin: 0 !important; padding: 0 !important; border: 0 !important; font-size: 20px !important; line-height: 1.25 !important; color: #092a5e !important; }
              .kb-smart-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
              .kb-smart-chip { display: inline-flex; align-items: center; border-radius: 999px; background: #eef5ff; color: #092a5e; padding: 5px 9px; font-size: 11px; font-weight: 700; }
              .kb-smart-summary { max-width: 92ch !important; margin: 12px 0 0 !important; color: rgba(15,23,42,.72); }
              .kb-smart-body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
              .kb-smart-section { border-radius: 14px; border: 1px solid rgba(0,0,0,.06); background: #f8fafc; padding: 12px 14px; }
              .kb-smart-section-title { margin: 0 0 6px !important; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: rgba(9,42,94,.55); }
              .kb-smart-list { margin: 0 !important; padding-left: 18px !important; }
              .kb-smart-list li { margin: 4px 0 !important; font-size: 13px; line-height: 1.55; color: rgba(15,23,42,.78); }
              .kb-season { background: #fff8e6; border-color: rgba(240,199,106,.45); }
              .kb-positive { background: #f0fdf4; border-color: rgba(34,197,94,.18); }
              .kb-warning { background: #fff7ed; border-color: rgba(249,115,22,.20); }
              .kb-check { background: #f8fafc; }
              .kb-focus { background: #eff6ff; border-color: rgba(37,99,235,.14); }
              .kb-smart-details { margin-top: 12px; border-top: 1px dashed rgba(0,0,0,.12); padding-top: 10px; }
              .kb-smart-details-title { cursor: pointer; font-size: 12px; font-weight: 700; color: #1d4ed8; }
              .kb-smart-details-body { margin-top: 8px; color: rgba(15,23,42,.65); }
              .kb-content :where(section, article, h2, h3) { scroll-margin-top: 90px; }
              @media (max-width: 920px) { .kb-smart-body { grid-template-columns: 1fr; } }
            `}</style>
            <div
              ref={contentRef}
              className="kb-content prose prose-sm mt-6 max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </>
        )}
      </div>
    </div>
  );
}
