import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, MapPin, Phone } from "lucide-react";
import LeadForm from "@/components/lead-form/LeadForm";
import { busTourRequestComment } from "@/lib/busTourRequest";
import styles from "./request.module.css";

export const metadata: Metadata = {
  title: "Заявка на подбор тура | Слетать.ру — Пенза",
  description: "Расскажите о вашем будущем путешествии. Подберём направление и отель, обсудим даты и бюджет. Оставить заявку на подбор тура онлайн.",
  alternates: { canonical: "/request" },
};

export default async function TourRequestPage({ searchParams }: {
  searchParams: Promise<{ cruise?: string | string[]; departure?: string | string[]; bus_tour?: string | string[] }>;
}) {
  const params = await searchParams;
  const busComment = busTourRequestComment(params.bus_tour);
  const cruiseNames = ["Orchestra", "Lirica", "World Europa", "Preziosa", "Fantasia", "Seaview", "Magnifica"];
  const cruise = typeof params.cruise === "string" && cruiseNames.includes(params.cruise) ? params.cruise : null;
  const departure = typeof params.departure === "string" && /^(?:[6-9]|1[0-9])$/.test(params.departure) ? Number(params.departure) : null;
  const nights = cruise === "Magnifica" ? 10 : 7;
  const cruiseComment = cruise && departure
    ? `Интересует морской круиз MSC ${cruise}, ${departure}–${departure + nights} декабря 2027, ${nights} ночей, 2 взрослых. Прошу уточнить наличие кают и итоговую стоимость.`
    : undefined;
  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="request-title">
          <p className={styles.eyebrow}>СЛЕТАТЬ.РУ · ПЕНЗА</p>
          <h1 id="request-title">Ваш следующий<br />отпуск начинается <span>здесь.</span></h1>
          <p className={styles.description}>Море, новые города или время для себя — поможем найти путешествие под ваши планы.</p>
          <div className={styles.photo}>
            <Image src="/blog/february/maldives.jpg" alt="Бирюзовая лагуна и песчаный берег на Мальдивах" fill sizes="(max-width: 767px) 100vw, 540px" className="object-cover" priority />
            <span>От идеи до возвращения домой</span>
          </div>
          <div className={styles.office}><MapPin size={17} aria-hidden="true" /><span>Пенза, ТЦ «Проспект»<br /><small>Пр-т Строителей, 49А</small></span></div>
        </section>

        <section className={styles.card} aria-labelledby="form-title">
          <div className={styles.cardHeading}><span>ДАВАЙТЕ СПЛАНИРУЕМ ОТДЫХ</span><ArrowUpRight size={24} aria-hidden="true" /></div>
          <h2 id="form-title">Куда отправимся?</h2>
          <p className={styles.formIntro}>Оставьте контакты — обсудим ваши пожелания и подберём варианты тура.</p>
          <div className={styles.form}>
            <LeadForm key={busComment ?? cruiseComment ?? "general"} compact openDetails={Boolean(busComment)} initialComment={busComment ?? cruiseComment} submissionContext="Заявка на подбор тура со страницы /request" submitLabel="Подобрать мне тур" />
          </div>
          <p className={styles.note}>Это заявка на подбор. Даты, отель и стоимость согласуем с вами до бронирования.</p>
          <div className={styles.direct}>
            <p>Удобнее поговорить?</p>
            <a href="tel:+79502302555"><Phone size={17} aria-hidden="true" />8 950 230-25-55</a>
          </div>
        </section>
      </div>

      <section className={styles.steps} aria-labelledby="steps-title">
        <h2 id="steps-title">Дальше всё просто</h2>
        <ol>
          <li><span>01</span><div><h3>Обсудим поездку</h3><p>Уточним даты, состав туристов и бюджет.</p></div></li>
          <li><span>02</span><div><h3>Подберём варианты</h3><p>Поможем сравнить отели и выбрать подходящий тур.</p></div></li>
          <li><span>03</span><div><h3>Подготовим к отдыху</h3><p>Расскажем о документах и деталях путешествия.</p></div></li>
        </ol>
      </section>
    </div>
  );
}
