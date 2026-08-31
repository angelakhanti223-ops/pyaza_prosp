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

  // Поиск внутри статьи сделан полностью императивно (refs, без useState) —
  // в этой версии React повторный рендер сбрасывает dangerouslySetInnerHTML
  // обратно к article.content, даже когда сама строка не изменилась, и любой
  // setState здесь стирал бы только что вставленные <mark>.
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
    if (count > 0) {
      scrollToMatch(0, container.querySelectorAll<HTMLElement>("mark.kb-highlight"));
    }
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

  if (loading) {
    return <p className="text-sm text-foreground/50">Загрузка…</p>;
  }

  if (!article) {
    return <p className="text-sm text-foreground/50">Статья не найдена.</p>;
  }

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
              HTML-разметка (для форматированного текста удобнее правки через /admin →
              Knowledgebase → Knowledge articles — там полноценный редактор).
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

            <div className="relative mt-6 max-w-md">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Найти в тексте статьи…"
                defaultValue=""
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-24 text-sm outline-none focus:border-blue"
              />
              <div ref={matchControlsRef} className="absolute right-9 top-1/2 hidden -translate-y-1/2 items-center gap-1">
                <span ref={counterRef} className="mr-1 text-xs text-foreground/50" />
                <button
                  onClick={() => goToMatch(-1)}
                  aria-label="Предыдущее совпадение"
                  className="rounded p-1 text-foreground/50 hover:bg-blue-light hover:text-navy"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => goToMatch(1)}
                  aria-label="Следующее совпадение"
                  className="rounded p-1 text-foreground/50 hover:bg-blue-light hover:text-navy"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <button
                onClick={handleClearSearch}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-foreground/50 hover:bg-blue-light hover:text-navy"
              >
                <X size={14} />
              </button>
            </div>
            <p ref={noResultsRef} className="mt-1.5 hidden text-xs text-foreground/40">Ничего не найдено.</p>

            <style>{`
              .kb-content nav#nav a { display: block; padding: 3px 0; }
              .kb-content #q, .kb-content #hits { display: none; }
              .kb-content mark.kb-highlight { background: #fde68a; border-radius: 2px; }
              .kb-content mark.kb-highlight-active { background: #f59e0b; }
            `}</style>
            <div
              ref={contentRef}
              className="kb-content prose prose-sm mt-4 max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </>
        )}
      </div>
    </div>
  );
}
