import Image from "next/image";
import Link from "next/link";
import { mediaUrl, type ArticleListItem } from "@/lib/articlesApi";

export default function ArticleCard({ article }: { article: ArticleListItem }) {
  const backendImage = mediaUrl(article.featured_image);
  const image = backendImage ?? "/placeholders/article.svg";

  return (
    <Link
      href={`/blog/${article.slug}`}
      className="block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[3/2]">
        <Image
          src={image}
          alt={article.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          // The Next.js image optimizer refuses to fetch from private/loopback IPs
          // (SSRF protection) for our own backend media, so skip optimization for it.
          unoptimized
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
