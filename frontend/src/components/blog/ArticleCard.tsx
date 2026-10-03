import Link from "next/link";
import { mediaUrl, type ArticleListItem } from "@/lib/articlesApi";

const imageUrl = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1200&q=85`;

const PREVIEW_BY_SLUG: Record<string, string> = {
  "gde-otdohnut-v-yanvare": imageUrl("photo-1507525428034-b723cf961d3e"),
  "gde-otdohnut-v-noyabre": imageUrl("photo-1502602898657-3e91760cbb34"),
  "gde-otdohnut-v-dekabre": imageUrl("photo-1573843981267-be1999ff37cd"),
  "gde-otdohnut-v-oktyabre": imageUrl("photo-1519046904884-53103b34b206"),
  "gde-otdohnut-v-sentyabre": imageUrl("photo-1524231757912-21f4fe3a7200"),
  "gde-otdohnut-na-novyj-god": imageUrl("photo-1488646953014-85cb44e25828"),
  "gde-otdohnut-na-osennih-kanikulah": imageUrl("photo-1510414842594-a61c69b5ae57"),
  "kakie-gory-i-sklon-vam-podoydut": imageUrl("photo-1454496522488-7a8e488e8606"),
};

const FALLBACK_PREVIEW_BY_TOPIC = {
  sea: imageUrl("photo-1507525428034-b723cf961d3e"),
  island: imageUrl("photo-1573843981267-be1999ff37cd"),
  city: imageUrl("photo-1502602898657-3e91760cbb34"),
  warm: imageUrl("photo-1519046904884-53103b34b206"),
  mountain: imageUrl("photo-1454496522488-7a8e488e8606"),
};

function fallbackPreview(article: ArticleListItem) {
  const bySlug = PREVIEW_BY_SLUG[article.slug];
  if (bySlug) return bySlug;

  const title = article.title.toLowerCase();
  if (title.includes("январ")) return PREVIEW_BY_SLUG["gde-otdohnut-v-yanvare"];
  if (title.includes("ноябр")) return PREVIEW_BY_SLUG["gde-otdohnut-v-noyabre"];
  if (title.includes("декабр")) return PREVIEW_BY_SLUG["gde-otdohnut-v-dekabre"];
  if (title.includes("октябр")) return PREVIEW_BY_SLUG["gde-otdohnut-v-oktyabre"];
  if (title.includes("сентябр")) return PREVIEW_BY_SLUG["gde-otdohnut-v-sentyabre"];
  if (title.includes("новый год")) return PREVIEW_BY_SLUG["gde-otdohnut-na-novyj-god"];
  if (title.includes("каникул")) return PREVIEW_BY_SLUG["gde-otdohnut-na-osennih-kanikulah"];
  if (title.includes("гор") || title.includes("склон") || title.includes("лыж") || title.includes("сноуборд")) {
    return FALLBACK_PREVIEW_BY_TOPIC.mountain;
  }
  if (title.includes("мальдив")) return FALLBACK_PREVIEW_BY_TOPIC.island;
  if (title.includes("море") || title.includes("пляж")) return FALLBACK_PREVIEW_BY_TOPIC.sea;
  if (title.includes("город") || title.includes("экскурс")) return FALLBACK_PREVIEW_BY_TOPIC.city;
  if (title.includes("тепл")) return FALLBACK_PREVIEW_BY_TOPIC.warm;

  return null;
}

export default function ArticleCard({ article }: { article: ArticleListItem }) {
  const seasonalPreview = PREVIEW_BY_SLUG[article.slug];
  const backendImage = mediaUrl(article.featured_image);
  const image = seasonalPreview ?? backendImage ?? fallbackPreview(article) ?? "/placeholders/article.svg";

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
