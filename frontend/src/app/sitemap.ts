import type { MetadataRoute } from "next";
import { fetchArticles } from "@/lib/articlesApi";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const STATIC_PATHS = [
  "",
  "/tours",
  "/directions",
  "/cruises",
  "/promotions",
  "/blog",
  "/about",
  "/contacts",
  "/privacy",
  "/terms",
];

async function fetchAllPublishedArticles() {
  const slugs: { slug: string; published_at: string }[] = [];
  let page = 1;

  while (true) {
    const res = await fetchArticles({ page });
    slugs.push(...res.results.map((a) => ({ slug: a.slug, published_at: a.published_at })));
    if (!res.next) break;
    page += 1;
  }

  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await fetchAllPublishedArticles();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: new Date(a.published_at),
  }));

  return [...staticEntries, ...articleEntries];
}
