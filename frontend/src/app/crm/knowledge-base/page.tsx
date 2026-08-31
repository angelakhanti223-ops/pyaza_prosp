"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { listKnowledgeArticles, type KnowledgeArticleListItem } from "@/lib/crmApi";

export default function CrmKnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listKnowledgeArticles().then((data) => {
      setArticles(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy">База знаний</h1>
        <Link
          href="/crm/knowledge-base/new"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue"
        >
          + Новая статья
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/50">Загрузка…</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-foreground/40">Статей пока нет</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/crm/knowledge-base/${article.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white p-5 transition-colors hover:border-blue/30 hover:bg-blue-light/20"
            >
              <div className="flex items-center gap-2 text-blue">
                <BookOpen size={16} />
                {article.direction_name && (
                  <span className="text-xs font-medium uppercase tracking-wide">{article.direction_name}</span>
                )}
              </div>
              <h2 className="font-semibold text-navy">{article.title}</h2>
              <p className="mt-auto text-xs text-foreground/40">
                {article.author?.full_name && <>{article.author.full_name} · </>}
                {new Date(article.updated_at).toLocaleDateString("ru-RU")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
