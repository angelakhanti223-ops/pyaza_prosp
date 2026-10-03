import type { Metadata } from "next";
import Link from "next/link";
import ShareButtons from "@/components/blog/ShareButtons";
import ArticleLeadButtons from "@/components/blog/ArticleLeadButtons";
import SkiSlopeQuiz from "@/components/blog/SkiSlopeQuiz";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://flypenza.ru";
const PAGE_URL = `${SITE_URL}/blog/kakie-gory-i-sklon-vam-podoydut`;
const leadComment = "Заявка из статьи-теста: какие горы и какой склон подойдут";

export const metadata: Metadata = {
  title: "Какие горы и какой склон вам подойдут — тест для выбора горнолыжного отдыха",
  description:
    "Пройдите тест и узнайте, какие горы, трассы и курорты подойдут вашему уровню: Россия, Азербайджан, Грузия, Турция, Китай, Франция, Швейцария и другие направления.",
  alternates: { canonical: "/blog/kakie-gory-i-sklon-vam-podoydut" },
};

const trackTypes = [
  {
    color: "🟢",
    title: "Зелёные трассы",
    text: "Для первого раза, детей и тех, кто хочет спокойно попробовать лыжи или сноуборд. Нужны инструктор, прокат, учебная зона и пологий склон.",
    resorts: "Архыз, Красная Поляна, Шахдаг, Туфандаг, Бакуриани, Цахкадзор, Эрджиес, Банско.",
  },
  {
    color: "🔵",
    title: "Синие трассы",
    text: "Для начинающих с опытом, семей и спокойного катания без резких спусков. Важны понятная навигация и кафе на склоне.",
    resorts: "Красная Поляна, Архыз, Гудаури, Бакуриани, Шахдаг, Эрджиес, Ябули, Андорра.",
  },
  {
    color: "🔴",
    title: "Красные трассы",
    text: "Для уверенных лыжников и сноубордистов. Нужны длинные спуски, перепад высот, подъёмники и выбор маршрутов.",
    resorts: "Шерегеш, Эльбрус, Гудаури, Паландокен, Три Долины, Тинь, Валь-д’Изер, Давос, Церматт.",
  },
  {
    color: "⚫",
    title: "Чёрные трассы и фрирайд",
    text: "Для опытных райдеров. Здесь важны гид, страховка, лавинная безопасность, сезон и реальный уровень группы.",
    resorts: "Эльбрус, Шерегеш, Гудаури, Шамони, Вербье, Санкт-Антон, Тинь, Казахстан, Киргизия.",
  },
];

const countries = [
  ["🇦🇿 Азербайджан", "Шахдаг и Туфандаг — хороший вариант для первого зарубежного горнолыжного отдыха, семей и спокойных склонов."],
  ["🇬🇪 Грузия", "Гудаури — простор, активное катание и фрирайд; Бакуриани — спокойнее и семейнее."],
  ["🇹🇷 Турция", "Эрджиес, Паландокен и Улудаг подходят тем, кто хочет совместить отели, питание и зимний формат отдыха."],
  ["🇨🇳 Китай", "Ябули, Бэйдаху, Thaiwoo и Secret Garden — для туристов, которым интересен нестандартный зимний маршрут."],
  ["🇨🇭 Швейцария", "Церматт, Санкт-Мориц, Давос и Вербье — премиальный формат, сильные трассы, сервис и альпийская классика."],
  ["🇫🇷 Франция", "Три Долины, Шамони, Тинь и Валь-д’Изер — масштабное катание, Альпы и курорты для разного уровня."],
  ["🇦🇹 Австрия", "Зёльден, Ишгль, Майрхофен и Кицбюэль — катание, альпийская атмосфера и après-ski."],
  ["🇮🇹 Италия", "Доломиты, Червиния и Ливиньо — красивые виды, гастрономия и мягкая курортная атмосфера."],
];

export default function SkiSlopeArticlePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: "Какие горы и какой склон вам подойдут?",
    description: metadata.description,
    url: PAGE_URL,
    author: { "@type": "Organization", name: "Слетать.ру Пенза" },
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-4 text-xs text-foreground/40">
        <Link href="/blog" className="hover:text-blue">Блог</Link>
        {" / "}Советы туристам
      </nav>

      <h1 className="text-2xl font-bold text-navy sm:text-3xl">
        Какие горы и какой склон вам подойдут?
      </h1>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-foreground/40">03.10.2026</p>
        <ShareButtons url={PAGE_URL} title="Какие горы и какой склон вам подойдут?" />
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl bg-navy text-white shadow-sm">
        <img
          src="https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1600&q=85"
          alt="Горы и горнолыжные склоны"
          className="h-72 w-full object-cover"
        />
        <div className="p-5 sm:p-7">
          <p className="text-sm leading-6 text-white/75">
            Горы бывают разными. Одним нужен мягкий первый склон, инструктор и отель рядом с подъёмником.
            Другим — длинные красные трассы, скорость, фрирайд, Альпы, вечерняя атмосфера и ощущение настоящей зимней перезагрузки.
          </p>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Этот тест поможет понять, какой формат горного отдыха вам ближе: учебный, семейный, атмосферный,
            активный, фрирайдный или премиальный.
          </p>
        </div>
      </section>

      <SkiSlopeQuiz />

      <div className="prose prose-sm mt-10 max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue">
        <h2>Почему нельзя выбирать горы только по красивым фото</h2>
        <p>
          У каждого курорта свой характер. На одном удобно учиться с нуля, на другом — ехать за длинными трассами,
          на третьем лучше отдыхать с детьми, а на четвёртом стоит планировать поездку только уверенным райдерам.
          Поэтому сначала выбирают не страну, а задачу: учиться, кататься активно, отдыхать с семьёй, получить сервис
          или ехать за фрирайдом.
        </p>

        <h2>Какие бывают трассы</h2>
      </div>

      <div className="mt-5 grid gap-4">
        {trackTypes.map((item) => (
          <section key={item.title} className="rounded-3xl border border-blue-light bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-navy">{item.color} {item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-foreground/70">{item.text}</p>
            <p className="mt-3 text-sm text-foreground/70"><strong>Куда смотреть:</strong> {item.resorts}</p>
          </section>
        ))}
      </div>

      <div className="prose prose-sm mt-10 max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue">
        <h2>Зарубежные горнолыжные направления</h2>
        <p>
          В подбор можно включать не только Россию, но и Азербайджан, Грузию, Турцию, Китай, Швейцарию, Францию,
          Австрию, Италию, Андорру и другие направления. Важно учитывать уровень катания, логистику, сезонность,
          визовые условия, бюджет и формат отдыха.
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {countries.map(([title, text]) => (
          <section key={title} className="rounded-3xl bg-blue-light/45 p-5">
            <h3 className="font-bold text-navy">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-foreground/70">{text}</p>
          </section>
        ))}
      </div>

      <div className="prose prose-sm mt-10 max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue">
        <h2>Как читать результат теста</h2>
        <p>
          Результат теста — это не окончательное бронирование, а направление для подбора. Он показывает тип склонов,
          комфортный уровень трасс и список стран, которые стоит сравнить. После этого уже можно смотреть даты,
          перелёты, трансферы, отели, школы катания, аренду оборудования и страховку.
        </p>
        <p>
          Для новичков важнее учебная зона и инструктор. Для семей — школа, питание, близость к подъёмнику и отдых вне трасс.
          Для уверенных райдеров — протяжённость трасс и перепад высот. Для фрирайда — гиды, снег, лавинная безопасность и страховка.
          Для премиального отдыха — расположение отеля, SPA, рестораны и общий уровень сервиса.
        </p>
      </div>

      <ArticleLeadButtons
        comment={leadComment}
        title="Хотите подобрать горы под ваш уровень?"
        text="Пройдите тест выше или сразу оставьте заявку. Сравним страны, курорты, трассы, отели, перелёты и сезонность под ваш состав туристов."
      />
    </article>
  );
}
