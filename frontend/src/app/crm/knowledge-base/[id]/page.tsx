"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Info, Pencil, Search, Trash2, X } from "lucide-react";
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

      <div className="rounded-2xl border border-black/5 bg-white p-5 sm:p-7">
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
            <p className="text-xs text-foreground/40">
              HTML-разметка. Для больших правок лучше держать единый формат: кому предлагать, кому не предлагать, фишки, минусы, бонусы агенту, контакты, что проверить перед продажей.
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
                <p className="text-xs font-semibold uppercase tracking-wide text-blue">
                  {article.direction_name || "Внутренняя база"}
                </p>
                <h1 className="mt-1 text-2xl font-bold leading-tight text-navy">{article.title}</h1>
                <p className="mt-1 text-xs text-foreground/40">
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

            <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/10 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-dark">
                <Info size={15} /> Как читать базу
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-navy/80 md:grid-cols-2">
                <p>• ищи отель, курорт, сеть, бонус, контакт или фамилию представителя;</p>
                <p>• проверяй: кому подходит, кому не предлагать, плюсы/минусы, условия агенту и контакты.</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-black/5 bg-cream p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">Поиск внутри этой базы</p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Например: контакты, бонус, семейный, пляж, вилла, отель…"
                    defaultValue=""
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue"
                  >
                    Найти
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-foreground/60 hover:bg-blue-light/40"
                  >
                    Сброс
                  </button>
                  <div ref={matchControlsRef} className="hidden items-center gap-1 rounded-full bg-white px-2 py-1">
                    <span ref={counterRef} className="mr-1 text-xs text-foreground/50" />
                    <button onClick={() => goToMatch(-1)} aria-label="Предыдущее совпадение" className="rounded p-1 text-foreground/50 hover:bg-blue-light hover:text-navy">
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => goToMatch(1)} aria-label="Следующее совпадение" className="rounded p-1 text-foreground/50 hover:bg-blue-light hover:text-navy">
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <p ref={noResultsRef} className="mt-1.5 hidden text-xs text-foreground/40">Ничего не найдено.</p>
            </div>

            <style>{`
              .kb-content { font-size: 15px; line-height: 1.75; }
              .kb-content nav#nav { margin: 18px 0; padding: 14px 16px; border-radius: 16px; background: #f7fbff; border: 1px solid rgba(15, 48, 87, .08); }
              .kb-content nav#nav a { display: block; padding: 4px 0; color: #0a63b7; text-decoration: none; }
              .kb-content #q, .kb-content #hits { display: none; }
              .kb-content h2 { margin-top: 34px; padding-top: 18px; border-top: 1px solid rgba(15, 48, 87, .10); font-size: 20px; line-height: 1.35; }
              .kb-content h3 { margin-top: 24px; font-size: 16px; line-height: 1.4; }
              .kb-content p { margin-top: 10px; margin-bottom: 10px; }
              .kb-content ul, .kb-content ol { padding-left: 20px; }
              .kb-content li { margin: 5px 0; }
              .kb-content table { width: 100%; display: block; overflow-x: auto; border-collapse: separate; border-spacing: 0; margin: 18px 0; border: 1px solid rgba(15, 48, 87, .10); border-radius: 16px; background: white; }
              .kb-content thead { background: #eef7ff; }
              .kb-content th { color: #082b5f; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
              .kb-content th, .kb-content td { padding: 10px 12px; border-bottom: 1px solid rgba(15, 48, 87, .08); vertical-align: top; }
              .kb-content tr:last-child td { border-bottom: 0; }
              .kb-content img { max-width: 100%; border-radius: 16px; margin: 16px 0; }
              .kb-content blockquote { margin: 18px 0; padding: 14px 18px; border-left: 4px solid #d9a52b; border-radius: 12px; background: #fff9e8; color: #082b5f; }
              .kb-content hr { margin: 28px 0; border-color: rgba(15, 48, 87, .10); }
              .kb-content mark.kb-highlight { background: #fde68a; border-radius: 3px; padding: 0 2px; }
              .kb-content mark.kb-highlight-active { background: #f59e0b; }
            `}</style>

            <div
              ref={contentRef}
              className="kb-content prose prose-sm mt-6 max-w-none rounded-2xl border border-black/5 bg-white text-foreground/80 prose-headings:text-navy prose-a:text-blue prose-strong:text-navy"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </>
        )}
      </div>
    </div>
  );
}
