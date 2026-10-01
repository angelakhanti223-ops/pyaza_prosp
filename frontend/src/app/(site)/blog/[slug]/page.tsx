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
import NovemberQuickGuide from "@/components/blog/NovemberQuickGuide";
import DecemberQuickGuide from "@/components/blog/DecemberQuickGuide";
import ArticleLeadButtons from "@/components/blog/ArticleLeadButtons";

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

const NOVEMBER_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/seasonal/warm-sea-selection.svg",
    alt: "Скрин подбора тёплых морских направлений",
    title: "Улететь из осени к тёплому морю",
    description: "Ноябрь хорошо подходит для направлений, где уже комфортнее после летней жары и можно планировать пляжный отдых.",
  },
  {
    src: "/blog/seasonal/family-hotel-check.svg",
    alt: "Скрин проверки семейного отеля",
    title: "Подобрать спокойный семейный отдых",
    description: "Для поездки с детьми особенно важны перелёт, питание, пляж, тёплый бассейн и удобная территория отеля.",
  },
  {
    src: "/blog/seasonal/city-route-screenshot.svg",
    alt: "Скрин экскурсионного маршрута",
    title: "Сменить серую погоду на новые впечатления",
    description: "В ноябре можно выбирать не только море, но и города, СПА, гастрономию, экскурсии и короткие перезагрузки.",
  },
  {
    src: "/blog/seasonal/new-year-mountain-spa.svg",
    alt: "Скрин зимнего SPA-отдыха",
    title: "Посмотреть несколько мест за одну поездку",
    description: "Круизы и комбинированные маршруты подойдут тем, кто хочет больше впечатлений без постоянной смены отелей вручную.",
  },
];

const DECEMBER_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/seasonal/warm-sea-selection.svg",
    alt: "Скрин подбора пляжного тура в декабре",
    title: "Улететь к солнцу перед Новым годом",
    description: "Декабрь подходит для Египта, ОАЭ, Таиланда, Мальдив и других направлений, где можно сменить зиму на море.",
  },
  {
    src: "/blog/seasonal/family-hotel-check.svg",
    alt: "Скрин проверки семейного отеля в декабре",
    title: "Выбрать отдых для семьи",
    description: "Для поездки с детьми важны перелёт, питание, тёплый бассейн, пляж, трансфер и спокойная логистика.",
  },
  {
    src: "/blog/seasonal/city-route-screenshot.svg",
    alt: "Скрин новогоднего городского маршрута",
    title: "Поймать новогоднюю атмосферу",
    description: "Стамбул, Россия, горы, СПА и городские поездки подойдут тем, кто хочет не только пляж.",
  },
  {
    src: "/blog/seasonal/new-year-mountain-spa.svg",
    alt: "Скрин зимнего отдыха в горах и SPA",
    title: "Собрать маршрут с впечатлениями",
    description: "Круизы и комбинированные поездки хороши, когда хочется праздника, смены мест и удобной логистики.",
  },
];

const AUTUMN_HOLIDAYS_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/seasonal/family-hotel-check.svg",
    alt: "Скрин подбора семейного отеля на осенние каникулы",
    title: "Начать с формата семьи",
    description: "На каникулах важны возраст детей, перелёт, питание, бассейн, пляж и то, насколько легко будет отдыхать без лишней логистики.",
  },
  {
    src: "/blog/seasonal/warm-sea-selection.svg",
    alt: "Скрин подбора моря на осенние каникулы",
    title: "Выбрать море без случайности",
    description: "Египет, ОАЭ и Турция отличаются погодой, пляжами, ветром, питанием и отельной инфраструктурой — сравниваем до брони.",
  },
  {
    src: "/blog/seasonal/city-route-screenshot.svg",
    alt: "Скрин экскурсионного маршрута на осенние каникулы",
    title: "Собрать короткий маршрут",
    description: "Казань, Санкт-Петербург, Москва, Калининград, Кавказ и Сочи подходят, если хочется сменить обстановку без дальнего перелёта.",
  },
  {
    src: "/blog/seasonal/new-year-mountain-spa.svg",
    alt: "Скрин спокойного отдыха, SPA и гор на осенние каникулы",
    title: "Добавить отдых без суеты",
    description: "SPA-отели, санатории и горные курорты хорошо работают для перезагрузки, когда пляж не главная цель поездки.",
  },
];

const NEW_YEAR_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/seasonal/new-year-mountain-spa.svg",
    alt: "Скрин новогоднего отдыха в горах и SPA",
    title: "Выбрать новогодний формат",
    description: "Новый год может быть у моря, в горах, в городе, в SPA-отеле или на острове — сначала выбираем сценарий, потом страну.",
  },
  {
    src: "/blog/seasonal/warm-sea-selection.svg",
    alt: "Скрин подбора тёплого моря на Новый год",
    title: "Уехать к тёплому морю",
    description: "Египет, ОАЭ, Таиланд, Вьетнам, Мальдивы и Шри-Ланка требуют разной логики выбора отеля и бюджета.",
  },
  {
    src: "/blog/seasonal/family-hotel-check.svg",
    alt: "Скрин проверки семейного отеля на Новый год",
    title: "Проверить отель до бронирования",
    description: "На праздники важно заранее уточнить ужин, депозит, подогреваемый бассейн, детскую программу и правила отмены.",
  },
  {
    src: "/blog/seasonal/city-route-screenshot.svg",
    alt: "Скрин городского новогоднего маршрута",
    title: "Сделать праздник с маршрутом",
    description: "Санкт-Петербург, Казань, Калининград, Москва и Кавказ подойдут тем, кто хочет атмосферу, прогулки и впечатления.",
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
  const isNovemberArticle = article.slug === "gde-otdohnut-v-noyabre";
  const isDecemberArticle = article.slug === "gde-otdohnut-v-dekabre";
  const isAutumnHolidaysArticle = article.slug === "gde-otdohnut-na-osennih-kanikulah";
  const isNewYearArticle = article.slug === "gde-otdohnut-na-novyj-god";
  const isSeasonalArticle = isOctoberArticle || isNovemberArticle || isDecemberArticle || isAutumnHolidaysArticle || isNewYearArticle;
  const heroSlides = isNewYearArticle
    ? NEW_YEAR_ARTICLE_SLIDES
    : isAutumnHolidaysArticle
      ? AUTUMN_HOLIDAYS_ARTICLE_SLIDES
      : isDecemberArticle
        ? DECEMBER_ARTICLE_SLIDES
        : isNovemberArticle
          ? NOVEMBER_ARTICLE_SLIDES
          : OCTOBER_ARTICLE_SLIDES;
  const leadComment = `Заявка из статьи: ${article.title}`;

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

      {isSeasonalArticle ? (
        <ArticleHeroCarousel slides={heroSlides} />
      ) : (
        image && (
          <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl">
            <Image src={image} alt={article.title} fill sizes="768px" className="object-cover" unoptimized priority />
          </div>
        )
      )}

      {isOctoberArticle && <OctoberQuickGuide />}
      {isNovemberArticle && <NovemberQuickGuide />}
      {isDecemberArticle && <DecemberQuickGuide />}
      {isSeasonalArticle && (
        <ArticleLeadButtons
          compact
          comment={leadComment}
          title="Хотите понять, куда поехать именно вам?"
          text="Опишите даты, состав туристов и бюджет — подберём направление и отели под ваш формат отдыха, а не просто покажем список туров."
        />
      )}

      <div
        className="prose prose-sm mt-8 max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      <ImageCarousel images={article.gallery_images} />

      {isSeasonalArticle && (
        <ArticleLeadButtons
          comment={leadComment}
          title="Оставить заявку на подбор тура"
          text="Сравним направления, отели, перелёты, питание и сезонность под ваши даты. Можно написать в MAX, Telegram или заполнить заявку на сайте."
        />
      )}

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
