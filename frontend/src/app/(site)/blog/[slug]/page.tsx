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
const REALISTIC_SLIDE_VERSION = "clean20261003";
const REALISTIC_SLIDES = {
  sea: `/blog/october/sea.svg?v=${REALISTIC_SLIDE_VERSION}`,
  family: `/blog/october/family.svg?v=${REALISTIC_SLIDE_VERSION}`,
  city: `/blog/october/excursions.svg?v=${REALISTIC_SLIDE_VERSION}`,
  villa: `/blog/october/cruises.svg?v=${REALISTIC_SLIDE_VERSION}`,
};

const OCTOBER_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: REALISTIC_SLIDES.sea,
    alt: "Тёплое море и пляжный отдых в октябре",
    title: "Продлить лето у моря",
    description: "Пляжные направления подойдут тем, кто хочет солнце, купание и спокойный ритм без летней суеты.",
  },
  {
    src: REALISTIC_SLIDES.family,
    alt: "Семейный отдых с детьми в октябре",
    title: "Выбрать комфортный семейный формат",
    description: "Для поездки с детьми важны короткая логистика, питание в отеле и понятная инфраструктура рядом.",
  },
  {
    src: REALISTIC_SLIDES.city,
    alt: "Экскурсионная поездка и прогулки по городам осенью",
    title: "Уехать в экскурсионный маршрут",
    description: "Октябрь удобен для прогулок, древних городов и насыщенных программ без изнуряющей жары.",
  },
  {
    src: REALISTIC_SLIDES.villa,
    alt: "Круизный маршрут в октябре",
    title: "Посмотреть несколько городов за одну поездку",
    description: "Круиз подходит, когда хочется маршрута, но без постоянной смены отелей и лишней логистики.",
  },
];

const NOVEMBER_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: REALISTIC_SLIDES.city,
    alt: "Осенний экскурсионный город",
    title: "Сменить серую погоду на новые впечатления",
    description: "В ноябре хорошо работают города, короткие маршруты, СПА, гастрономия и экскурсионные поездки.",
  },
  {
    src: REALISTIC_SLIDES.sea,
    alt: "Тёплые морские направления в ноябре",
    title: "Улететь из осени к тёплому морю",
    description: "Ноябрь подходит для направлений, где уже комфортнее после летней жары и можно планировать пляжный отдых.",
  },
  {
    src: REALISTIC_SLIDES.family,
    alt: "Семейный отель у моря в ноябре",
    title: "Подобрать спокойный семейный отдых",
    description: "Для поездки с детьми особенно важны перелёт, питание, пляж, тёплый бассейн и удобная территория отеля.",
  },
  {
    src: REALISTIC_SLIDES.villa,
    alt: "Комбинированный маршрут в ноябре",
    title: "Посмотреть несколько мест за одну поездку",
    description: "Круизы и комбинированные маршруты подойдут тем, кто хочет больше впечатлений без постоянной смены отелей вручную.",
  },
];

const JANUARY_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: REALISTIC_SLIDES.sea,
    alt: "Тёплое море и пляжный отдых в январе",
    title: "Улететь из зимы к морю",
    description: "Январь подходит для направлений, где можно сменить морозы на солнце, пляж и спокойный ритм отдыха.",
  },
  {
    src: REALISTIC_SLIDES.family,
    alt: "Семейный отдых в январе",
    title: "Выбрать комфортный формат для семьи",
    description: "Для январского отпуска важны перелёт, питание, тёплый бассейн, пляж и понятная логистика до отеля.",
  },
  {
    src: REALISTIC_SLIDES.city,
    alt: "Экскурсионный маршрут в январе",
    title: "Добавить экскурсии и прогулки",
    description: "Январь можно планировать не только как пляж: подойдут города, маршруты, гастрономия и мягкий климат.",
  },
  {
    src: REALISTIC_SLIDES.villa,
    alt: "Премиальный островной отдых в январе",
    title: "Собрать отпуск с впечатлениями",
    description: "Острова, круизы и комбинированные поездки подходят, когда хочется не просто отеля, а полноценного сценария отдыха.",
  },
];

const FEBRUARY_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/february/thailand.jpg",
    alt: "Лодки у тропического пляжа и скал в Таиланде",
    title: "Сменить февраль на тропики",
    description: "Таиланд подойдёт для тёплого моря, островных прогулок и пляжного отпуска. Выберем побережье и пляж под ваши планы.",
  },
  {
    src: "/blog/february/dubai.jpg",
    alt: "Панорама Дубая с небоскрёбами на закате",
    title: "Увидеть Дубай без летней жары",
    description: "Февраль удобен для прогулок, музеев и развлечений в ОАЭ. Для купания проверим пляж и бассейн с подогревом.",
  },
  {
    src: "/blog/february/maldives.jpg",
    alt: "Виллы над бирюзовой лагуной на Мальдивах",
    title: "Замедлиться на Мальдивах",
    description: "Островной отпуск — это море, лагуна и спокойный ритм. Сравним пляж, риф, питание и трансфер до отеля.",
  },
  {
    src: "/blog/february/mountains.jpg",
    alt: "Заснеженные горные вершины под голубым небом",
    title: "Провести отпуск среди снежных гор",
    description: "Если хочется зимы, выбирайте горный отдых. Для катания учтём уровень трасс, обучение, подъёмники и дорогу до курорта.",
  },
];

const MARCH_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/march/island.jpg",
    alt: "Белый песчаный берег, бирюзовая лагуна и виллы над водой",
    title: "Встретить весну у тёплого океана",
    description: "Мальдивы подойдут для спокойного мартовского отпуска. Сравним пляж, лагуну, риф и удобство трансфера до острова.",
  },
  {
    src: "/blog/march/egypt.jpg",
    alt: "Пирамиды Египта и караван верблюдов на закате",
    title: "Открыть Египет за пределами отеля",
    description: "Пляжный отдых можно дополнить историей и экскурсиями. Подберём курорт и маршрут с учётом времени в дороге.",
  },
  {
    src: "/blog/march/vietnam.jpg",
    alt: "Скалистые острова и лодки в бухте Халонг во Вьетнаме",
    title: "Добавить к морю маршрут по Вьетнаму",
    description: "Пляжи юга можно совместить с новыми впечатлениями. Для поездки на север учтём более прохладную погоду и переезды.",
  },
  {
    src: "/blog/march/family.jpg",
    alt: "Бассейн у моря, пальмы и тенистые зонтики на территории курортного отеля",
    title: "Спланировать каникулы всей семьёй",
    description: "Для семейного отдыха в марте важны удобная дорога, питание, бассейн и подходящий пляж. Даты каникул уточним по вашей школе.",
  },
];

const APRIL_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/april/egypt.jpg",
    alt: "Пирамида в Гизе среди песков под голубым небом",
    title: "Соединить Красное море и историю Египта",
    description: "Апрельский отпуск можно дополнить экскурсиями к древним памятникам. Подберём отель и маршрут с удобной дорогой.",
  },
  {
    src: "/blog/april/reef.jpg",
    alt: "Дайвер рядом с коралловым рифом и стаей тропических рыб",
    title: "Открыть подводный мир",
    description: "Для отдыха у рифов сравним пляж, вход в воду и условия морских выездов. Подходящую программу выберем с учётом вашего опыта.",
  },
  {
    src: "/blog/april/vietnam.jpg",
    alt: "Золотой мост на гигантских каменных ладонях возле Дананга во Вьетнаме",
    title: "Добавить к пляжу впечатления Вьетнама",
    description: "Побережье можно совместить с культурой и необычными достопримечательностями. Учтём расположение отеля и длительность выездов.",
  },
  {
    src: "/blog/april/thailand.jpg",
    alt: "Тайский храм с золотыми башнями и резными крышами",
    title: "Познакомиться с традициями Таиланда",
    description: "В апреле отмечают Сонгкран — тайский Новый год. Для поездки учтём жару, праздничные даты и ваши планы на отдых.",
  },
];

const AUGUST_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/august/side.jpg",
    alt: "Античные колонны храма Аполлона в Сиде на фоне облачного неба",
    title: "Соединить море и историю в Сиде",
    description: "К августовскому пляжу можно добавить античные памятники и вечерние прогулки. Выберем отель, откуда удобно добираться к интересным местам.",
  },
  {
    src: "/blog/august/srilanka.jpg",
    alt: "Дерево у песчаного пляжа и океан в Тринкомали на Шри-Ланке",
    title: "Открыть восток Шри-Ланки",
    description: "Для августа сравним Тринкомали, Нилавели и Пасикуду. Учтём пляж, размещение, трансфер и время на культурную часть путешествия.",
  },
  {
    src: "/blog/august/bali.jpg",
    alt: "Храм у скалистого берега океана на Бали",
    title: "Добавить к океану впечатления Бали",
    description: "Храмы и природные места дополнят пляжный отпуск. Составим маршрут так, чтобы осталось время и на новые открытия, и на спокойный отдых.",
  },
  {
    src: "/blog/august/baikal.jpg",
    alt: "Прибрежные скалы и сосны на острове Ольхон у Байкала",
    title: "Увидеть летний Байкал",
    description: "Пейзажи, прогулки и маршруты по России подойдут для другого завершения лета. Выберем программу по вашим интересам, дороге и желаемой нагрузке.",
  },
];

const JULY_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/july/bodrum.jpg",
    alt: "Белые дома, яхтенная гавань и замок Бодрума на турецком побережье",
    title: "Уехать к бухтам Бодрума",
    description: "Море, прогулки и исторические места можно соединить в одном отпуске. Выберем отель с удобным пляжем и расположением под ваш июльский ритм.",
  },
  {
    src: "/blog/july/bali.jpg",
    alt: "Зелёные рисовые террасы Тегаллаланг в районе Убуда на Бали",
    title: "Увидеть зелёный Бали",
    description: "К океану можно добавить рисовые террасы, храмы и внутреннюю часть острова. Продуманное размещение поможет провести больше времени на отдыхе и меньше в дороге.",
  },
  {
    src: "/blog/july/tunisia.jpg",
    alt: "Улица Сиди-Бу-Саида с белыми стенами, синим домом и зеленью",
    title: "Прогуляться по Сиди-Бу-Саиду",
    description: "Пляжный отпуск в Тунисе можно дополнить историей и красивыми улицами. Выберем подходящий выезд с учётом расстояний и летней жары.",
  },
  {
    src: "/blog/july/karelia.jpg",
    alt: "Тихое озеро с отражением хвойного леса в Карелии",
    title: "Сменить ритм в Карелии",
    description: "Озёра, лесные пейзажи и дни без плотного расписания подойдут для другой стороны летнего отпуска. Подберём маршрут по вашим интересам и желаемой нагрузке.",
  },
];

const JUNE_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/june/turkey.jpg",
    alt: "Бирюзовая вода и светлый пляж Капуташ на турецком побережье",
    title: "Начать лето у Средиземного моря",
    description: "В Турции можно совместить пляж, удобный отель и исторические места. Подберём побережье и расположение под ваши июньские планы.",
  },
  {
    src: "/blog/june/vietnam.jpg",
    alt: "Река, набережная и цветные фонарики в Хойане во Вьетнаме",
    title: "Добавить к пляжу атмосферу Хойана",
    description: "Центральный Вьетнам интересен сочетанием моря, прогулок и местной культуры. Выберем удобную базу для отдыха и выездов.",
  },
  {
    src: "/blog/june/petersburg.jpg",
    alt: "Освещённый Литейный мост и отражения в Неве в Санкт-Петербурге",
    title: "Посвятить поездку Петербургу",
    description: "Музеи, дворцовые маршруты и прогулки у воды создадут свой сценарий начала лета. Насыщенность программы подберём под ваш ритм.",
  },
  {
    src: "/blog/june/altai.jpg",
    alt: "Озеро с отражением неба между лесистыми склонами на Алтае",
    title: "Сменить суету на природные пейзажи",
    description: "Алтай и другие природные маршруты подойдут тем, кому хочется простора и новых впечатлений. Учтём дорогу, условия размещения и сложность программы.",
  },
];

const MAY_HOLIDAYS_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/may-holidays/coast.jpg",
    alt: "Пляж и бирюзовая лагуна Олюдениза на турецком побережье",
    title: "Встретить май у моря",
    description: "Выберем побережье под ваши ожидания: тёплое купание или отдых с прогулками. Для начала мая особенно важны сезонность и пляж конкретного отеля.",
  },
  {
    src: "/blog/may-holidays/georgia.jpg",
    alt: "Панорама Тбилиси с рекой, мостом и городскими кварталами",
    title: "Открыть для себя Грузию",
    description: "Прогулки по Тбилиси, история и местная кухня — маршрут для тех, кто хочет новых впечатлений. Оставим время и на экскурсии, и на неспешный отдых.",
  },
  {
    src: "/blog/may-holidays/uzbekistan.jpg",
    alt: "Площадь Регистан с историческими медресе в Самарканде",
    title: "Увидеть архитектуру Самарканда",
    description: "Майские можно посвятить истории и красивым городам Узбекистана. Продолжительность маршрута подберём так, чтобы переезды не забрали весь отпуск.",
  },
  {
    src: "/blog/may-holidays/russia.jpg",
    alt: "Купола и минареты мечети Кул-Шариф в Казани",
    title: "Устроить маленький отпуск в России",
    description: "Казань, другие исторические города и короткие маршруты подойдут для нескольких свободных дней. Выберем удобную базу рядом с интересными местами.",
  },
];

const SPRING_HOLIDAYS_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: "/blog/spring-holidays/family.jpg",
    alt: "Взрослые и дети держатся за руки на морском берегу на закате",
    title: "Провести каникулы вместе у моря",
    description: "Начнём с интересов всей семьи: спокойный пляж, удобная дорога и время друг для друга без плотного расписания.",
  },
  {
    src: "/blog/spring-holidays/resort.jpg",
    alt: "Территория курортного отеля и освещённый бассейн вечером",
    title: "Выбрать отель для семейного отдыха",
    description: "Проверим питание, бассейны, подогрев и работу детских программ именно на ваши весенние даты.",
  },
  {
    src: "/blog/spring-holidays/turkey.jpg",
    alt: "Историческая мечеть с куполами и минаретами в Стамбуле",
    title: "Добавить к каникулам историю и открытия",
    description: "Городские прогулки и семейные экскурсии помогут увидеть новое. Маршрут подберём под возраст ребёнка и удобство переездов.",
  },
  {
    src: "/blog/spring-holidays/russia.jpg",
    alt: "Разноцветные купола собора Василия Блаженного в Москве",
    title: "Открыть интересные места в России",
    description: "Музеи, квесты, театры и прогулки подходят для короткой поездки. Оставим время и для впечатлений, и для отдыха.",
  },
];

const DECEMBER_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: REALISTIC_SLIDES.sea,
    alt: "Пляжный тур в декабре",
    title: "Улететь к солнцу перед Новым годом",
    description: "Декабрь подходит для Египта, ОАЭ, Таиланда, Мальдив и других направлений, где можно сменить зиму на море.",
  },
  {
    src: REALISTIC_SLIDES.family,
    alt: "Семейный отель в декабре",
    title: "Выбрать отдых для семьи",
    description: "Для поездки с детьми важны перелёт, питание, тёплый бассейн, пляж, трансфер и спокойная логистика.",
  },
  {
    src: REALISTIC_SLIDES.city,
    alt: "Новогодний городской маршрут",
    title: "Поймать новогоднюю атмосферу",
    description: "Стамбул, Россия, горы, СПА и городские поездки подойдут тем, кто хочет не только пляж.",
  },
  {
    src: REALISTIC_SLIDES.villa,
    alt: "Премиальный зимний отдых у океана",
    title: "Собрать маршрут с впечатлениями",
    description: "Круизы и комбинированные поездки хороши, когда хочется праздника, смены мест и удобной логистики.",
  },
];

const AUTUMN_HOLIDAYS_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: REALISTIC_SLIDES.family,
    alt: "Семейный отель на осенние каникулы",
    title: "Начать с формата семьи",
    description: "На каникулах важны возраст детей, перелёт, питание, бассейн, пляж и то, насколько легко будет отдыхать без лишней логистики.",
  },
  {
    src: REALISTIC_SLIDES.sea,
    alt: "Море на осенние каникулы",
    title: "Выбрать море без случайности",
    description: "Египет, ОАЭ и Турция отличаются погодой, пляжами, ветром, питанием и отельной инфраструктурой — сравниваем до брони.",
  },
  {
    src: REALISTIC_SLIDES.city,
    alt: "Экскурсионный маршрут на осенние каникулы",
    title: "Собрать короткий маршрут",
    description: "Казань, Санкт-Петербург, Москва, Калининград, Кавказ и Сочи подходят, если хочется сменить обстановку без дальнего перелёта.",
  },
  {
    src: REALISTIC_SLIDES.villa,
    alt: "Спокойный отдых, SPA и премиальный отель на осенние каникулы",
    title: "Добавить отдых без суеты",
    description: "SPA-отели, санатории и горные курорты хорошо работают для перезагрузки, когда пляж не главная цель поездки.",
  },
];

const NEW_YEAR_ARTICLE_SLIDES: ArticleHeroSlide[] = [
  {
    src: REALISTIC_SLIDES.city,
    alt: "Новогодняя городская атмосфера",
    title: "Выбрать новогодний формат",
    description: "Новый год может быть у моря, в горах, в городе, в SPA-отеле или на острове — сначала выбираем сценарий, потом страну.",
  },
  {
    src: REALISTIC_SLIDES.sea,
    alt: "Тёплое море на Новый год",
    title: "Уехать к тёплому морю",
    description: "Египет, ОАЭ, Таиланд, Вьетнам, Мальдивы и Шри-Ланка требуют разной логики выбора отеля и бюджета.",
  },
  {
    src: REALISTIC_SLIDES.family,
    alt: "Семейный отель на Новый год",
    title: "Проверить отель до бронирования",
    description: "На праздники важно заранее уточнить ужин, депозит, подогреваемый бассейн, детскую программу и правила отмены.",
  },
  {
    src: REALISTIC_SLIDES.villa,
    alt: "Островной новогодний отдых",
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
  const isJanuaryArticle = article.slug === "gde-otdohnut-v-yanvare";
  const isFebruaryArticle = article.slug === "gde-otdohnut-v-fevrale";
  const isMarchArticle = article.slug === "gde-otdohnut-v-marte";
  const isAprilArticle = article.slug === "gde-otdohnut-v-aprele";
  const isJuneArticle = article.slug === "gde-otdohnut-v-iyune";
  const isJulyArticle = article.slug === "gde-otdohnut-v-iyule";
  const isAugustArticle = article.slug === "gde-otdohnut-v-avguste";
  const isDecemberArticle = article.slug === "gde-otdohnut-v-dekabre";
  const isAutumnHolidaysArticle = article.slug === "gde-otdohnut-na-osennih-kanikulah";
  const isSpringHolidaysArticle = article.slug === "gde-otdohnut-na-vesennih-kanikulah";
  const isMayHolidaysArticle = article.slug === "gde-otdohnut-na-mayskih-prazdnikah";
  const isNewYearArticle = article.slug === "gde-otdohnut-na-novyj-god";
  const isSeasonalArticle =
    isOctoberArticle ||
    isNovemberArticle ||
    isJanuaryArticle ||
    isFebruaryArticle ||
    isMarchArticle ||
    isAprilArticle ||
    isJuneArticle ||
    isJulyArticle ||
    isAugustArticle ||
    isDecemberArticle ||
    isAutumnHolidaysArticle ||
    isSpringHolidaysArticle ||
    isMayHolidaysArticle ||
    isNewYearArticle;
  const heroSlides = isAugustArticle
    ? AUGUST_ARTICLE_SLIDES
    : isJulyArticle
      ? JULY_ARTICLE_SLIDES
    : isJuneArticle
      ? JUNE_ARTICLE_SLIDES
    : isMayHolidaysArticle
      ? MAY_HOLIDAYS_ARTICLE_SLIDES
    : isSpringHolidaysArticle
      ? SPRING_HOLIDAYS_ARTICLE_SLIDES
    : isAprilArticle
      ? APRIL_ARTICLE_SLIDES
    : isMarchArticle
      ? MARCH_ARTICLE_SLIDES
    : isFebruaryArticle
      ? FEBRUARY_ARTICLE_SLIDES
    : isJanuaryArticle
      ? JANUARY_ARTICLE_SLIDES
    : isNewYearArticle
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
