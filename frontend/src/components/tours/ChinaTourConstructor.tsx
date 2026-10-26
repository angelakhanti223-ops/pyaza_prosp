"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowRight, Check, MapPin, Plane, SlidersHorizontal } from "lucide-react";
import SiteCtaBlock from "@/components/cta/SiteCtaBlock";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import { useLeadForm } from "@/components/lead-form/LeadFormContext";
import { initChinaTourBuilder } from "@/lib/chinaTourBuilder";
import { chinaTourBuilderMarkup } from "./chinaTourBuilderMarkup";
import styles from "./ChinaTourConstructor.module.css";

const builderHtml = { __html: chinaTourBuilderMarkup };
const CUSTOM_REQUEST = "Хочу подобрать индивидуальный тур в Китай. Помогите выбрать маршрут, даты и отели под мой бюджет.";

export default function ChinaTourConstructor() {
  const root = useRef<HTMLDivElement>(null);
  const { open } = useLeadForm();
  const openRef = useRef(open);
  const [estimate, setEstimate] = useState(CUSTOM_REQUEST);
  const [excursionSlot, setExcursionSlot] = useState<HTMLElement | null>(null);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    if (!root.current) return;
    return initChinaTourBuilder(root.current, {
      onRequest: comment => openRef.current(comment),
      onChange: comment => {
        setEstimate(comment);
        setExcursionSlot(root.current?.querySelector<HTMLElement>("#excursion-cta") ?? null);
      },
    });
  }, []);

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="china-title">
        <div className={styles.heroInner}>
          <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
            <Link href="/">Главная</Link><span>/</span><Link href="/tours">Туры</Link><span>/</span><span>Китай</span>
          </nav>
          <span className={styles.eyebrow}><Plane size={15} /> Индивидуальные путешествия</span>
          <h1 id="china-title">Ваш Китай.<br /><span>Ваш маршрут.</span></h1>
          <p className={styles.intro}>Мегаполисы, парящие горы или отдых у моря? Соберите путешествие в своём ритме — стоимость пересчитается сразу.</p>
          <div className={styles.heroActions}>
            <a href="#china-builder" className={styles.primary}>Рассчитать путешествие <ArrowDown size={17} /></a>
            <OpenLeadFormButton comment={CUSTOM_REQUEST} className={styles.secondary}>Помогите с выбором <ArrowRight size={17} /></OpenLeadFormButton>
          </div>
          <div className={styles.heroFacts}>
            <span><MapPin size={15} /> 5 городов Китая</span>
            <span><SlidersHorizontal size={15} /> Отели и экскурсии на выбор</span>
            <span><Check size={16} /> Поддержка на всех этапах</span>
          </div>
        </div>
        <div className={styles.imageCaption}>Великая Китайская стена · Пекин</div>
      </section>

      <div className={styles.content}>
        <div className={styles.steps} aria-label="Как работает конструктор">
          <div><span>01</span><p><b>Выберите маршрут</b>Начните с готовой идеи или добавьте свои города.</p></div>
          <div><span>02</span><p><b>Настройте путешествие</b>Ночи, отели, транспорт и впечатления — под вас.</p></div>
          <div><span>03</span><p><b>Получите точный расчёт</b>Менеджер проверит цены и наличие на ваши даты.</p></div>
        </div>
        <div id="china-builder" className={styles.builder} ref={root} dangerouslySetInnerHTML={builderHtml} />
        {excursionSlot && createPortal(
          <SiteCtaBlock
            compact
            eyebrow="Китай · Больше впечатлений"
            title="Не нашли свои экскурсии или хотите большего?"
            text="Оставьте заявку — подберём экскурсии под ваши интересы и добавим их в маршрут. Расскажите, что мечтаете увидеть: составим программу вместе."
            primaryLabel="Подобрать мои экскурсии"
            comment={`Хочу другие экскурсии или более насыщенную программу по Китаю. Мои пожелания:\n\nТекущая сборка:\n${estimate}`}
          />,
          excursionSlot,
        )}

        <section id="china-request" className={styles.request} aria-label="Получить расчёт тура в Китай">
          <SiteCtaBlock
            eyebrow="Слетать.ру · На связи с вами"
            title="Ваш маршрут готов. Давайте воплотим его в путешествие"
            text="Отправьте сборку — проверим перелёты и отели на ваши даты, уточним пожелания и подготовим точный расчёт. Или напишите в удобный мессенджер."
            primaryLabel="Получить точный расчёт"
            comment={estimate}
          />
        </section>
        <p className={styles.disclaimer}>Предварительный расчёт на двоих по тарифам из подборки. Актуальные цены, наличие и условия подтвердим перед бронированием. Заявка бесплатна и не обязывает к покупке.</p>
      </div>
    </div>
  );
}
