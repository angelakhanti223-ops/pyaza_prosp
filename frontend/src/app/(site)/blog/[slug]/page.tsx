import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchArticle, mediaUrl } from "@/lib/articlesApi";
import ArticleCard from "@/components/blog/ArticleCard";
import ShareButtons from "@/components/blog/ShareButtons";
import ImageCarousel from "@/components/blog/ImageCarousel";
import ArticleHeroCarousel, { type ArticleHeroSlide } from "@/components/blog/ArticleHeroCarousel";
import OctoberQuickGuide from "@/components/blog/OctoberQuickGuide";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const OCTOBER_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/october/sea.svg",
    alt: "Тёплое море и пляжный отдых в октябре",
    title: "Продлить лето у моря",
    description: "Пляжные направления подойдут тем, кто хочет солнце, купание и спокойный ритм без летней суеты.",
  },
  {
    src: "/blog/october/family.svg",
    alt: "Семейный отдых с детьми в октябре",
    title: "Выбрать комфортный семейный формат",
    description: "Для поездки с детьми важны короткая логистика, питание в отеле и понятная инфраструктура рядом.",
  },
  {
    src: "/blog/october/excursions.svg",
    alt: "Экскурсионная поездка и прогулки по городам осенью",
    title: "Уехать в экскурсионный маршрут",
    description: "Октябрь удобен для прогулок, древних городов и насыщенных программ без изнуряющей жары.",
  },
  {
    src: "/blog/october/cruises.svg",
    alt: "Круизный маршрут в октябре",
    title: "Посмотреть несколько городов за одну поездку",
    description: "Круиз подходит, когда хочется маршрута, но без постоянной смены отелей и лишней логистики.",
  },
];

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) return {};

  const title = article.seo_title || article.title;
  const description = article.seo_description || article.excerpt || undefined;
  const image = mediaUrl(article.og_image) ?? mediaUrl(article.featured_image) ?? undefined;

  return {
    title: `${title} — Слетать.ру`,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { title, description, images: image ? [image] : undefined },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) notFound();

  const url = `${SITE_URL}/blog/${article.slug}`;
  const image = mediaUrl(article.featured_image);
  const isOctoberArticle = article.slug === "gde-otdohnut-v-oktyabre";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: article.title,
        description: article.seo_description || article.excerpt,
        image: image ? [image] : undefined,
        datePublished: article.published_at,
        author: { "@type": "Organization", name: "Слетать.ру" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Блог", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
        ],
      },
    ],
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-4 text-xs text-foreground/40">
        <Link href="/blog" className="hover:text-blue">
          Блог
        </Link>
        {article.category && (
          <>
            {" / "}
            <Link href={`/blog?category=${article.category.slug}`} className="hover:text-blue">
              {article.category.name}
            </Link>
          </>
        )}
      </nav>

      <h1 className="text-2xl font-bold text-navy sm:text-3xl">{article.title}</h1>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-foreground/40">
          {new Date(article.published_at).toLocaleDateString("ru-RU")}
        </p>
        <ShareButtons url={url} title={article.title} />
      </div>

      {isOctoberArticle ? (
        <ArticleHeroCarousel slides={OCTOBER_ARTICLE_SLIDES} />
      ) : (
        image && (
          <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl">
            <Image src={image} alt={article.title} fill sizes="768px" className="object-cover" unoptimized priority />
          </div>
        )
      )}

      {isOctoberArticle && <OctoberQuickGuide />}

      <div
        className="prose prose-sm mt-8 max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      <ImageCarousel images={article.gallery_images} />

      {article.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-blue-light px-3 py-1 text-xs text-blue">
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      {article.related_articles.length > 0 && (
        <div className="mt-14">
          <h2 className="mb-4 text-lg font-bold text-navy">Похожие статьи</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {article.related_articles.map((related) => (
              <ArticleCard key={related.id} article={related} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
