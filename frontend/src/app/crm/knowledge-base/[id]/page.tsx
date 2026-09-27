"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Search, Trash2, X } from "lucide-react";
import {
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  updateKnowledgeArticle,
  type KnowledgeArticleDetail,
} from "@/lib/crmApi";
import { fetchDirections, type Direction } from "@/lib/api";

type TocItem = { id: string; label: string };

function text(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `section-${index}`;
}

function getPlainText(html: string) {
  if (typeof window === "undefined") return "";
  const element = document.createElement("div");
  element.innerHTML = html;
  return text(element.innerText || element.textContent || "");
}

function clearMarks(container: HTMLElement | null) {
  if (!container) return;
  container.querySelectorAll("mark.kb-search-mark").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
    parent.normalize();
  });
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
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getKnowledgeArticle(articleId)
      .then((data) => {
        if (!active) return;
        setArticle(data);
        setTitle(data.title);
        setDirectionId(data.direction ? String(data.direction) : "");
        setContent(data.content ?? "");
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setArticle(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  useEffect(() => {
    fetchDirections().then(setDirections).catch(() => setDirections([]));
  }, []);

  useEffect(() => {
    if (!article || editing) return;
    const timer = window.setTimeout(() => {
      const container = contentRef.current;
      if (!container) return;
      const headings = Array.from(container.querySelectorAll<HTMLElement>("h2, h3"));
      const items = headings
        .map((heading, index) => {
          if (!heading.id) heading.id = slugify(heading.textContent ?? "", index);
          return { id: heading.id, label: text(heading.textContent) };
        })
        .filter((item) => item.label)
        .slice(0, 24);
      setToc(items);
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

  function handleSearch() {
    const container = contentRef.current;
    clearMarks(container);
    const needle = query.trim().toLowerCase();
    if (!container || !needle) {
      setMatches(0);
      return;
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);

    let count = 0;
    for (const textNode of nodes) {
      const original = textNode.textContent || "";
      const lower = original.toLowerCase();
      if (!lower.includes(needle)) continue;

      const fragment = document.createDocumentFragment();
      let last = 0;
      let index = lower.indexOf(needle);
      while (index !== -1) {
        fragment.appendChild(document.createTextNode(original.slice(last, index)));
        const mark = document.createElement("mark");
        mark.className = "kb-search-mark";
        mark.textContent = original.slice(index, index + needle.length);
        fragment.appendChild(mark);
        count += 1;
        last = index + needle.length;
        index = lower.indexOf(needle, last);
      }
      fragment.appendChild(document.createTextNode(original.slice(last)));
      textNode.parentNode?.replaceChild(fragment, textNode);
    }

    setMatches(count);
    const first = container.querySelector<HTMLElement>("mark.kb-search-mark");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetSearch() {
    setQuery("");
    setMatches(0);
    clearMarks(contentRef.current);
  }

  const plainText = article ? getPlainText(article.content ?? "") : "";
  const quickTags = [
    "сезон",
    "дети",
    "пляж",
    "депозит",
    "багаж",
    "авиакомпания",
    "отель",
    "контакты",
  ];

  if (loading) return <p className="text-sm text-foreground/50">Загрузка…</p>;
  if (!article) return <p className="text-sm text-red-600">База не загрузилась. Обнови страницу или проверь доступ к API.</p>;

  return (
    <div className="pb-10">
      <button
        onClick={() => router.push("/crm/knowledge-base")}
        className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"
      >
        <ArrowLeft size={15} />
        База знаний
      </button>

      {editing ? (
        <div className="rounded-2xl border border-black/5 bg-white p-6">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-lg font-bold text-navy outline-none focus:border-blue"
            />
            <select
              value={directionId}
              onChange={(event) => setDirectionId(event.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue sm:w-64"
            >
              <option value="">Без направления</option>
              {directions.map((direction) => (
                <option key={direction.id} value={direction.id}>
                  {direction.name}
                </option>
              ))}
            </select>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={24}
              className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-xs outline-none focus:border-blue"
            />
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
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-blue/10 bg-gradient-to-br from-blue-light/70 via-white to-cream p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-4xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue">Внутренняя база турагентства</p>
                <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">{article.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/70">
                  {plainText ? plainText.slice(0, 340) + (plainText.length > 340 ? "…" : "") : "Содержание базы загружено ниже."}
                </p>
                <p className="mt-2 text-xs text-foreground/40">
                  {article.direction_name && <>{article.direction_name} · </>}
                  {article.author?.full_name && <>{article.author.full_name} · </>}
                  обновлено {new Date(article.updated_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Редактировать"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-navy/60 hover:text-navy"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={handleDelete}
                  aria-label="Удалить"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-navy/60 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-black/5 bg-white/80 p-3 sm:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                  placeholder="Поиск по базе: отель, страна, авиакомпания, депозит, дети, сезон…"
                  className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
                />
              </div>
              <button onClick={handleSearch} className="rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue">
                Найти
              </button>
              <button onClick={resetSearch} className="inline-flex items-center justify-center gap-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm text-foreground/60 hover:bg-white">
                <X size={14} /> Сброс
              </button>
            </div>
            {query.trim() && <p className="mt-2 text-xs text-foreground/50">Найдено совпадений: {matches}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setQuery(tag);
                    window.setTimeout(handleSearch, 0);
                  }}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-blue-light"
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>

          {toc.length > 0 && (
            <nav className="sticky top-0 z-20 mt-4 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-sm backdrop-blur">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {toc.map((item) => (
                  <a key={item.id} href={`#${item.id}`} className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-navy hover:border-blue hover:text-blue">
                    {item.label}
                  </a>
                ))}
              </div>
            </nav>
          )}

          <style>{`
            .kb-content { font-size: 15px; line-height: 1.75; }
            .kb-content mark.kb-search-mark { background: #fde68a; border-radius: 3px; padding: 0 2px; }
            .kb-content h1, .kb-content h2 { margin-top: 34px; border-top: 1px solid rgba(0,0,0,.08); padding-top: 24px; font-size: 24px; line-height: 1.25; color: #092a5e; }
            .kb-content h3 { margin-top: 24px; font-size: 19px; line-height: 1.35; color: #092a5e; }
            .kb-content h4 { margin-top: 18px; font-size: 15px; font-weight: 800; color: #092a5e; }
            .kb-content p { max-width: 88ch; margin: 10px 0; color: rgba(15,23,42,.78); }
            .kb-content ul, .kb-content ol { margin: 10px 0 16px 0; padding-left: 22px; }
            .kb-content li { margin: 6px 0; color: rgba(15,23,42,.78); }
            .kb-content table { display: block; width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 13px; }
            .kb-content th, .kb-content td { border: 1px solid rgba(0,0,0,.08); padding: 10px 12px; vertical-align: top; }
            .kb-content th { background: #f1f6ff; color: #092a5e; font-weight: 800; }
            .kb-content img { max-width: 100%; max-height: 460px; object-fit: cover; border-radius: 16px; }
            .kb-content .grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important; gap: 16px !important; }
            .kb-content .grid > * { border: 1px solid rgba(9,42,94,.10) !important; border-left: 5px solid #f0c76a !important; border-radius: 18px !important; background: #fff !important; padding: 18px !important; box-shadow: 0 10px 26px rgba(9,42,94,.05); }
            .kb-content .grid > * p { max-width: none; }
            .kb-content :where(h1,h2,h3,h4) { scroll-margin-top: 110px; }
            @media (max-width: 760px) { .kb-content .grid { grid-template-columns: 1fr !important; } }
          `}</style>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-5 sm:p-7">
            <div ref={contentRef} className="kb-content max-w-none" dangerouslySetInnerHTML={{ __html: article.content ?? "" }} />
          </section>
        </>
      )}
    </div>
  );
}
