import type { Metadata } from "next";
import Link from "next/link";
import { fetchArticleCategories, fetchArticles } from "@/lib/articlesApi";
import ArticleCard from "@/components/blog/ArticleCard";

export const metadata: Metadata = {
  title: "Блог — Слетать.ру",
  description: "Полезные статьи и новости о путешествиях от сети туристических агентств Слетать.ру.",
};

type Props = {
  searchParams: Promise<{ category?: string; page?: string }>;
};

export default async function BlogPage({ searchParams }: Props) {
  const { category, page } = await searchParams;
  const pageNumber = Number(page) || 1;

  const [articlesPage, categories] = await Promise.all([
    fetchArticles({ category, page: pageNumber }),
    fetchArticleCategories(),
  ]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(articlesPage.count / pageSize));

  function pageHref(params: { category?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.page && params.page > 1) qs.set("page", String(params.page));
    const query = qs.toString();
    return query ? `/blog?${query}` : "/blog";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-navy sm:text-3xl">Блог</h1>
      <p className="mt-2 text-sm text-foreground/60">
        Идеи для путешествий, советы и новости от Слетать.ру
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={pageHref({})}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
            !category ? "bg-navy text-white" : "bg-blue-light text-blue hover:bg-blue hover:text-white"
          }`}
        >
          Все статьи
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={pageHref({ category: c.slug })}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
              category === c.slug ? "bg-navy text-white" : "bg-blue-light text-blue hover:bg-blue hover:text-white"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {articlesPage.results.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articlesPage.results.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-sm text-foreground/40">Статей пока нет.</p>
      )}

      {totalPages > 1 && (
        <div className="mt-10 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={pageHref({ category, page: p })}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ${
                p === pageNumber ? "bg-navy text-white" : "bg-blue-light text-blue hover:bg-blue hover:text-white"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
