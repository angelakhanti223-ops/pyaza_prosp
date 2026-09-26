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

function splitLongPlainParagraph(paragraph: HTMLParagraphElement) {
  if (paragraph.dataset.kbSplit === "1") return;
  if (paragraph.querySelector("a, img, table, ul, ol, br")) return;
  const text = (paragraph.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length < 420) return;

  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
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

      container.querySelectorAll<HTMLParagraphElement>("p").forEach(splitLongPlainParagraph);

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
              .kb-content .grid { display: flex !important; flex-direction: column !important; gap: 14px !important; }
              .kb-content .grid > * { width: 100% !important; max-width: 100% !important; }
              .kb-content .grid > div, .kb-content .grid > section, .kb-content .grid > article { border-left: 4px solid #f0c76a !important; padding: 18px 20px !important; }
              .kb-content .grid > * p { max-width: 88ch; }
              .kb-content :where(section, article, h2, h3) { scroll-margin-top: 90px; }
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
