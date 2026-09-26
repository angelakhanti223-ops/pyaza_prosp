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

function slugify(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `section-${index}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string) {
  return normalizeText(text)
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitLongPlainParagraph(paragraph: HTMLParagraphElement) {
  if (paragraph.dataset.kbSplit === "1") return;
  if (paragraph.closest(".kb-smart-card")) return;
  if (paragraph.querySelector("a, img, table, ul, ol, br")) return;
  const text = normalizeText(paragraph.textContent ?? "");
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

function directHeading(element: HTMLElement) {
  return Array.from(element.children).find((child) => ["H3", "H4"].includes(child.tagName)) as HTMLElement | undefined;
}

function uniqueList(items: string[], limit = 5) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const clean = normalizeText(item).replace(/^[•\-–—\s]+/, "").replace(/[.;,\s]+$/, "");
    if (!clean || clean.length < 6) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

function pickSentences(sentences: string[], words: string[], limit = 3) {
  return uniqueList(
    sentences.filter((sentence) => {
      const lower = sentence.toLowerCase();
      return words.some((word) => lower.includes(word));
    }),
    limit,
  );
}

function splitItems(value: string, limit = 7) {
  return uniqueList(
    value
      .split(/[,;]\s*/)
      .map((item) => item.trim())
      .filter(Boolean),
    limit,
  );
}

function extractAfterMarker(text: string, markers: string[], stopMarkers: string[], limit = 7) {
  const lower = text.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx === -1) continue;
    let part = text.slice(idx + marker.length);
    let end = part.length;
    const partLower = part.toLowerCase();
    for (const stop of stopMarkers) {
      const stopIdx = partLower.indexOf(stop.toLowerCase());
      if (stopIdx > 10 && stopIdx < end) end = stopIdx;
    }
    part = part.slice(0, end).split(/[.!?…]/)[0] ?? "";
    const items = splitItems(part, limit);
    if (items.length) return items;
  }
  return [];
}

function renderList(title: string, items: string[], tone: "blue" | "gold" | "green" | "red" = "blue") {
  if (!items.length) return "";
  return `
    <div class="kb-smart-block kb-smart-block-${tone}">
      <p class="kb-smart-label">${escapeHtml(title)}</p>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderParagraphs(sentences: string[]) {
  const result: string[] = [];
  let buffer: string[] = [];
  let length = 0;

  const push = () => {
    if (!buffer.length) return;
    result.push(`<p>${escapeHtml(buffer.join(" "))}</p>`);
    buffer = [];
    length = 0;
  };

  for (const sentence of sentences) {
    if (length + sentence.length > 360) push();
    buffer.push(sentence);
    length += sentence.length;
  }
  push();
  return result.join("");
}

function enhanceLongCard(card: HTMLElement) {
  if (card.dataset.kbEnhanced === "1") return;
  if (card.closest(".kb-smart-card")) return;

  const heading = directHeading(card);
  if (!heading) return;

  const title = normalizeText(heading.textContent ?? "");
  const bodyText = normalizeText(
    Array.from(card.children)
      .filter((child) => child !== heading)
      .map((child) => child.textContent ?? "")
      .join(" "),
  );

  if (!title || bodyText.length < 520) return;

  const sentences = splitSentences(bodyText);
  if (sentences.length < 4) return;

  const brief = sentences.slice(0, Math.min(2, sentences.length));
  const who = pickSentences(sentences, ["подходит", "подойдут", "для семей", "семьям", "парам", "гостям", "дет", "шопинг", "культур", "спокой", "актив"], 3);
  const notFor = pickSentences(sentences, ["не под", "кому не", "не стоит", "минус", "недостат"], 2);
  const important = pickSentences(sentences, ["важно", "учитывать", "провер", "депозит", "сезон", "перел", "виза", "безвиз", "аэропорт", "трансфер"], 4);
  const hotels = extractAfterMarker(
    bodyText,
    ["отели:", "отели 5*:", "городские и пляжные отели 5*:", "рекомендуемые отели:", "пляжные отели:", "шопинг:"],
    ["подходит", "из презентации", "важно", "кому", "основные", "районы", "лето", "высокий сезон"],
    7,
  );
  const areas = extractAfterMarker(
    bodyText,
    ["районы для проживания:", "основные пляжные районы —", "основные пляжные районы:"],
    ["шопинг", "отели", "подходит", "из презентации"],
    5,
  );

  const detailSentences = sentences.slice(brief.length);
  const blocks = [
    renderList("Кому предлагать", who, "green"),
    renderList("Кому не предлагать / ограничения", notFor, "red"),
    renderList("Что проверить перед продажей", important, "gold"),
    renderList("Районы", areas, "blue"),
    renderList("Отели / ориентиры", hotels, "blue"),
  ].join("");

  card.dataset.kbEnhanced = "1";
  card.classList.add("kb-smart-card");
  card.innerHTML = `
    <div class="kb-smart-head">
      <h3>${escapeHtml(title)}</h3>
      <span>карточка направления</span>
    </div>
    <div class="kb-smart-brief">${renderParagraphs(brief)}</div>
    ${blocks ? `<div class="kb-smart-grid">${blocks}</div>` : ""}
    <details class="kb-smart-details">
      <summary>Полное описание</summary>
      <div>${renderParagraphs(detailSentences)}</div>
    </details>
  `;
}

function enhanceKnowledgeContent(container: HTMLElement) {
  container.querySelectorAll<HTMLParagraphElement>("p").forEach(splitLongPlainParagraph);

  container.querySelectorAll<HTMLElement>(".grid").forEach((grid) => {
    grid.classList.add("kb-one-column-grid");
  });

  const candidates = Array.from(container.querySelectorAll<HTMLElement>("div, section, article"));
  candidates.forEach(enhanceLongCard);
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

      enhanceKnowledgeContent(container);

      const headings = Array.from(container.querySelectorAll<HTMLElement>("h2, h3"));
      const items = headings.map((heading, index) => {
        if (!heading.id) heading.id = slugify(heading.textContent ?? "", index);
        return {
          id: heading.id,
          label: (heading.textContent ?? "").trim(),
          level: heading.tagName === "H3" ? 3 : 2,
        };
      });
      setToc(items.filter((item) => item.label).slice(0, 18));
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
      const details = target.closest("details");
      if (details) details.setAttribute("open", "true");
      target.classList.add("kb-highlight-active");
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
                <button onClick={() => setEditing(true)} aria-label="Редактировать" className="flex h-9 w-9 items-center justify-center rounded-full text-navy/50 hover:bg-blue-light hover:text-navy">
                  <Pencil size={16} />
                </button>
                <button onClick={handleDelete} aria-label="Удалить" className="flex h-9 w-9 items-center justify-center rounded-full text-navy/50 hover:bg-red-50 hover:text-red-600">
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
                    placeholder="Например: депозит, семейным, Dubai Marina, трансфер, бонус…"
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
              .kb-content .grid, .kb-content .kb-one-column-grid { display: flex !important; flex-direction: column !important; gap: 16px !important; }
              .kb-content .grid > * { width: 100% !important; max-width: 100% !important; }
              .kb-content .kb-smart-card { border: 1px solid rgba(9,42,94,.12) !important; border-left: 5px solid #f0c76a !important; border-radius: 18px !important; background: #fff !important; padding: 18px 20px !important; box-shadow: 0 6px 20px rgba(9,42,94,.05); }
              .kb-content .kb-smart-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid rgba(0,0,0,.06); padding-bottom: 10px; margin-bottom: 12px; }
              .kb-content .kb-smart-head h3 { margin: 0; font-size: 20px; line-height: 1.25; }
              .kb-content .kb-smart-head span { flex: none; border-radius: 999px; background: #f8ecd0; padding: 5px 10px; font-size: 11px; font-weight: 700; color: #9a6a00; text-transform: uppercase; letter-spacing: .04em; }
              .kb-content .kb-smart-brief { border-radius: 14px; background: #f7fbff; padding: 10px 12px; color: rgba(15,23,42,.82); }
              .kb-content .kb-smart-brief p { margin: 0; max-width: none; }
              .kb-content .kb-smart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
              .kb-content .kb-smart-block { border-radius: 14px; padding: 12px 14px; border: 1px solid rgba(0,0,0,.06); }
              .kb-content .kb-smart-block-blue { background: #f7fbff; }
              .kb-content .kb-smart-block-gold { background: #fff8e8; }
              .kb-content .kb-smart-block-green { background: #f1fbf5; }
              .kb-content .kb-smart-block-red { background: #fff4f4; }
              .kb-content .kb-smart-label { margin: 0 0 6px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: rgba(9,42,94,.65); }
              .kb-content .kb-smart-block ul { margin: 0; padding-left: 18px; }
              .kb-content .kb-smart-block li { margin: 4px 0; line-height: 1.5; }
              .kb-content .kb-smart-details { margin-top: 12px; border-top: 1px dashed rgba(0,0,0,.12); padding-top: 10px; }
              .kb-content .kb-smart-details summary { cursor: pointer; color: #1f64d1; font-weight: 700; font-size: 13px; }
              .kb-content .kb-smart-details p { max-width: 88ch; }
              .kb-content :where(section, article, h2, h3) { scroll-margin-top: 90px; }
              @media (max-width: 900px) { .kb-content .kb-smart-grid { grid-template-columns: 1fr; } }
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
