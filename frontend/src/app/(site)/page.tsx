import Hero from "@/components/home/Hero";
import Advantages from "@/components/home/Advantages";
import StatsBand from "@/components/home/StatsBand";
import WhyUs from "@/components/home/WhyUs";
import ConnectSection from "@/components/home/ConnectSection";
import BookingSteps from "@/components/home/BookingSteps";
import SupportStages from "@/components/home/SupportStages";
import Faq from "@/components/home/Faq";
import NewsletterCTA from "@/components/home/NewsletterCTA";
import MobileStickyCTA from "@/components/cta/MobileStickyCTA";
import SiteCtaBlock from "@/components/cta/SiteCtaBlock";
import { fetchSiteImages } from "@/lib/siteImagesApi";

export default async function Home() {
  const siteImages = await fetchSiteImages();

  return (
    <>
      <Hero image={siteImages.hero_background} />
      <Advantages />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <SiteCtaBlock
          title="Не знаете, куда поехать?"
          text="Оставьте заявку — подберём 3–5 вариантов под ваш бюджет, даты, состав туристов и пожелания по отелю."
          primaryLabel="Получить 3–5 вариантов"
          comment="Заявка с CTA после преимуществ на главной"
        />
      </div>
      <StatsBand />
      <WhyUs images={siteImages} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <SiteCtaBlock
          eyebrow="Проверка цены"
          title="Есть конкретный отель или направление?"
          text="Напишите название отеля, страну или даты — проверим актуальную стоимость у туроператоров и предложим выгодные варианты."
          primaryLabel="Проверить стоимость"
          comment="Заявка с CTA после блока почему мы"
        />
      </div>
      <ConnectSection officeImage={siteImages.office_photo} />
      <BookingSteps />
      <SupportStages />
      <Faq />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <SiteCtaBlock
          eyebrow="Быстрый старт"
          title="Расскажите, какой отдых нужен — дальше всё сделаем мы"
          text="Уточним бюджет, даты, состав туристов, проверим перелёты и отели, а затем пришлём понятную подборку."
          primaryLabel="Рассчитать поездку"
          comment="Заявка с CTA после FAQ на главной"
        />
      </div>
      <NewsletterCTA />
      <MobileStickyCTA />
    </>
  );
}
