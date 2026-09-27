"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
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

  useEffect(() => {
    let active = true;
    getKnowledgeArticle(articleId)
      .then((data) => {
        if (!active) return;
        setArticle(data);
        setTitle(data.title);
        setDirectionId(data.direction ? String(data.direction) : "");
        setContent(data.content);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [articleId]);

  useEffect(() => {
    fetchDirections().then(setDirections).catch(() => setDirections([]));
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

            <p className="text-xs text-foreground/40">
              Режим редактирования HTML. Основная база выводится без авторазбора, чтобы страница не ломалась.
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
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/40">Внутренняя база турагентства</p>
                <h1 className="mt-1 text-2xl font-bold text-navy">{article.title}</h1>
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

            <div className="mt-6 rounded-2xl border border-blue/10 bg-blue-light/25 p-4 text-sm text-foreground/70">
              Страница восстановлена в стабильном режиме: весь контент базы выводится как есть, без автоматического распознавания и перестройки блоков.
            </div>

            <style>{`
              .kb-content { font-size: 15px; line-height: 1.75; }
              .kb-content nav#nav a { display: block; padding: 3px 0; }
              .kb-content #q, .kb-content #hits { display: none; }
              .kb-content h1, .kb-content h2, .kb-content h3 { color: #092a5e; }
              .kb-content h2 { margin-top: 32px; border-top: 1px solid rgba(0,0,0,.08); padding-top: 24px; }
              .kb-content h3 { margin-top: 22px; }
              .kb-content p { max-width: 92ch; }
              .kb-content img { max-width: 100%; border-radius: 14px; }
              .kb-content table { display: block; width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 13px; }
              .kb-content th, .kb-content td { border: 1px solid rgba(0,0,0,.08); padding: 10px 12px; vertical-align: top; }
              .kb-content th { background: #f1f6ff; color: #092a5e; font-weight: 700; }
            `}</style>

            <div
              className="kb-content prose prose-sm mt-6 max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </>
        )}
      </div>
    </div>
  );
}
