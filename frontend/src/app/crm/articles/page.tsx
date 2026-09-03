"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Newspaper, Search } from "lucide-react";
import { listCrmArticles, type ArticleCrmListItem, type ArticleStatus } from "@/lib/crmApi";

const STATUS_STYLES: Record<ArticleStatus, string> = {
  draft: "bg-black/5 text-foreground/60",
  published: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

export default function CrmArticlesPage() {
  const [articles, setArticles] = useState<ArticleCrmListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listCrmArticles().then((data) => {
      setArticles(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.category_name ?? "").toLowerCase().includes(q)
    );
  }, [articles, search]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-navy">Статьи</h1>
        <Link
          href="/crm/articles/new"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue"
        >
          + Новая статья
        </Link>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          placeholder="Поиск по названию или категории…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
        />
      </div>

      {loading ? (
        <p className="text-sm text-foreground/50">Загрузка…</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-foreground/40">Статей пока нет</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-foreground/40">Ничего не найдено по «{search}»</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Заголовок</th>
                <th className="px-4 py-3 font-medium">Категория</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Просмотры</th>
                <th className="px-4 py-3 font-medium">Автор</th>
                <th className="px-4 py-3 font-medium">Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => (
                <tr key={article.id} className="border-b border-black/5 last:border-0 hover:bg-blue-light/20">
                  <td className="px-4 py-3">
                    <Link href={`/crm/articles/${article.id}`} className="flex items-center gap-2 font-medium text-navy hover:underline">
                      <Newspaper size={14} className="shrink-0 text-blue" />
                      {article.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground/60">{article.category_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[article.status]}`}>
                      {article.status_display}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/60">
                    <span className="flex items-center gap-1.5">
                      <Eye size={13} className="text-foreground/30" />
                      {article.views}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/50">{article.author?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground/40">{new Date(article.updated_at).toLocaleDateString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
