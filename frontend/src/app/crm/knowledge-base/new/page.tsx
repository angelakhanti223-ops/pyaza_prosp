"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createKnowledgeArticle } from "@/lib/crmApi";
import { fetchDirections, type Direction } from "@/lib/api";

export default function CrmNewKnowledgeArticlePage() {
  const router = useRouter();
  const [directions, setDirections] = useState<Direction[]>([]);
  const [title, setTitle] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDirections().then(setDirections);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const article = await createKnowledgeArticle({
        title,
        direction: directionId ? Number(directionId) : undefined,
        content,
      });
      router.push(`/crm/knowledge-base/${article.id}`);
    } finally {
      setSaving(false);
    }
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

      <div className="max-w-2xl rounded-2xl border border-black/5 bg-white p-6 sm:p-8">
        <h1 className="mb-5 text-xl font-bold text-navy">Новая статья</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            required
            type="text"
            placeholder="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
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
            required
            placeholder="Текст статьи (можно HTML-разметку)…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-xs outline-none focus:border-blue"
          />
          <p className="text-xs text-foreground/40">
            Для готового HTML-документа (например, выгрузки из чата) удобнее импорт через
            manage.py import_knowledge_html — картинки сохранятся отдельными файлами.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="mt-1 self-start rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue disabled:opacity-60"
          >
            {saving ? "Создаём…" : "Создать статью"}
          </button>
        </form>
      </div>
    </div>
  );
}
