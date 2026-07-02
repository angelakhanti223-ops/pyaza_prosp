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
  tags: ArticleTag[];
  published_at: string;
};

export type ArticleGalleryImage = {
  id: number;
  image: string;
  caption: string;
  order: number;
};

export type ArticleDetail = ArticleListItem & {
  content: string;
  seo_title: string;
  seo_description: string;
  og_image: string | null;
  related_articles: ArticleListItem[];
  gallery_images: ArticleGalleryImage[];
};

export type ArticleListPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ArticleListItem[];
};

// Media URLs end up in the browser (as <img src>), so they must always resolve
// against the public-facing host — never the Docker-internal one, even though
// the API fetch that produced them may have run server-side over the internal
// network. DRF builds absolute media URLs from whatever Host the request came
// in on, so a server-side fetch yields "http://backend:8000/media/..." — rewrite
// that origin to the public API base URL.
const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) {
    return path.replace(/^https?:\/\/[^/]+/, PUBLIC_API_BASE_URL);
  }
  return `${PUBLIC_API_BASE_URL}${path}`;
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
