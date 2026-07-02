// This module is fetched from server components, which run inside the
// frontend container — "localhost" there is the container itself, not the
// backend service. Server-side requests go over the Docker network instead.
const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000"
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ArticleCategory = {
  id: number;
  name: string;
  slug: string;
};

export type ArticleTag = {
  id: number;
  name: string;
  slug: string;
};

export type ArticleListItem = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  featured_image: string | null;
  category: ArticleCategory | null;
  published_at: string;
};

export type ArticleDetail = ArticleListItem & {
  content: string;
  tags: ArticleTag[];
  seo_title: string;
  seo_description: string;
  og_image: string | null;
  related_articles: ArticleListItem[];
};

export type ArticleListPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ArticleListItem[];
};

export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

export async function fetchArticles(params: { category?: string; page?: number } = {}): Promise<ArticleListPage> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const query = qs.toString() ? `?${qs.toString()}` : "";

  const res = await fetch(`${API_BASE_URL}/api/articles/${query}`, { cache: "no-store" });
  if (!res.ok) return { count: 0, next: null, previous: null, results: [] };
  return res.json();
}

export async function fetchArticleCategories(): Promise<ArticleCategory[]> {
  const res = await fetch(`${API_BASE_URL}/api/articles/categories/`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchArticle(slug: string): Promise<ArticleDetail | null> {
  const res = await fetch(`${API_BASE_URL}/api/articles/${slug}/`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}
