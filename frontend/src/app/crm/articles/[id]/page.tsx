"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye, Trash2 } from "lucide-react";
import { deleteCrmArticle, getCrmArticle, updateCrmArticle, type ArticleCrmDetail, type ArticleCrmInput } from "@/lib/crmApi";
import ArticleForm from "@/components/crm/ArticleForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function CrmArticlePage() {
  const params = useParams<{ id: string }>();
  const articleId = Number(params.id);
  const router = useRouter();

  const [article, setArticle] = useState<ArticleCrmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getCrmArticle(articleId).then((data) => {
      if (active) {
        setArticle(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [articleId]);

  async function handleSubmit(input: ArticleCrmInput) {
    setSaving(true);
    try {
      const updated = await updateCrmArticle(articleId, input);
      setArticle(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Удалить статью безвозвратно?")) return;
    await deleteCrmArticle(articleId);
    router.push("/crm/articles");
  }

  if (loading) return <p className="text-sm text-foreground/50">Загрузка…</p>;
  if (!article) return <p className="text-sm text-foreground/50">Статья не найдена.</p>;

  return (
    <div>
      <button
        onClick={() => router.push("/crm/articles")}
        className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"
      >
        <ArrowLeft size={15} />
        Статьи
      </button>

      <div className="max-w-2xl rounded-2xl border border-black/5 bg-white p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-navy">{article.title}</h1>
            <p className="mt-1 flex items-center gap-1 text-xs text-foreground/50">
              <Eye size={13} />
              {article.views} просмотров
            </p>
          </div>
          <div className="flex items-center gap-3">
            {article.status === "published" && (
              <a
                href={`${SITE_URL}/blog/${article.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-blue hover:underline"
              >
                <ExternalLink size={13} />
                Открыть на сайте
              </a>
            )}
            <button
              onClick={handleDelete}
              aria-label="Удалить"
              className="flex h-8 w-8 items-center justify-center rounded-full text-navy/50 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <ArticleForm initial={article} onSubmit={handleSubmit} submitLabel="Сохранить" saving={saving} />
      </div>
    </div>
  );
}
