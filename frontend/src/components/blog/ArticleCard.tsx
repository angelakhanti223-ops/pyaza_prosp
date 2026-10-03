import Link from "next/link";
import { mediaUrl, type ArticleListItem } from "@/lib/articlesApi";

const CLEAN_IMAGE_SOURCES = {
  sea: "https://images.unsplash.com/photo-1676685309061-75cdbfd5f75f?auto=format&fit=crop&w=1200&q=85",
  family: "https://images.unsplash.com/photo-1769149255670-aa0ad6428dd6?auto=format&fit=crop&w=1200&q=85",
  city: "https://images.unsplash.com/photo-1665996977813-ee520a6608ea?auto=format&fit=crop&w=1200&q=85",
  villa: "https://images.unsplash.com/photo-1769389352398-f7b694034eb5?auto=format&fit=crop&w=1200&q=85",
};

const PREVIEW_BY_SLUG: Record<string, string> = {
  "gde-otdohnut-v-oktyabre": "/blog/october/sea.svg",
  "gde-otdohnut-v-noyabre": "/blog/october/excursions.svg",
  "gde-otdohnut-v-dekabre": "/blog/october/cruises.svg",
  "gde-otdohnut-v-yanvare": "/blog/october/sea.svg",
  "gde-otdohnut-v-sentyabre": "/blog/october/excursions.svg",
  "gde-otdohnut-na-novyj-god": "/blog/october/cruises.svg",
  "gde-otdohnut-na-osennih-kanikulah": "/blog/october/family.svg",
};

function resolvePreviewSource(src: string) {
  if (src.includes("/blog/october/sea.")) return CLEAN_IMAGE_SOURCES.sea;
  if (src.includes("/blog/october/family.")) return CLEAN_IMAGE_SOURCES.family;
  if (src.includes("/blog/october/excursions.")) return CLEAN_IMAGE_SOURCES.city;
  if (src.includes("/blog/october/cruises.")) return CLEAN_IMAGE_SOURCES.villa;
  return src;
}

function fallbackPreview(article: ArticleListItem) {
  const bySlug = PREVIEW_BY_SLUG[article.slug];
  if (bySlug) return bySlug;

  const title = article.title.toLowerCase();
  if (title.includes("январ")) return "/blog/october/sea.svg";
  if (title.includes("мальдив")) return "/blog/october/sea.svg";
  if (title.includes("декабр")) return "/blog/october/cruises.svg";
  if (title.includes("ноябр")) return "/blog/october/excursions.svg";
  if (title.includes("сентябр")) return "/blog/october/excursions.svg";
  if (title.includes("октябр")) return "/blog/october/sea.svg";

  return null;
}

export default function ArticleCard({ article }: { article: ArticleListItem }) {
  const backendImage = mediaUrl(article.featured_image);
  const image = resolvePreviewSource(backendImage ?? fallbackPreview(article) ?? "/placeholders/article.svg");

  return (
    <Link
      href={`/blog/${article.slug}`}
      className="block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[3/2] bg-blue-light/40">
        <img
          src={image}
          alt={article.title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="p-4">
        {article.category && (
          <span className="inline-flex rounded-full bg-blue-light px-2.5 py-0.5 text-xs font-medium text-blue">
            {article.category.name}
          </span>
        )}
        <p className="mt-2 text-sm font-semibold text-navy">{article.title}</p>
        {article.excerpt && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/60">{article.excerpt}</p>
        )}
        <p className="mt-2 text-xs text-foreground/40">
          {new Date(article.published_at).toLocaleDateString("ru-RU")}
        </p>
        {article.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <span key={tag.id} className="text-[11px] text-blue">
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
