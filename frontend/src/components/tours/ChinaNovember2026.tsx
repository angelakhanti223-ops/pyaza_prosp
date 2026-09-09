"use client";

import { useRef, useState } from "react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import styles from "./ChinaNovember2026.module.css";
import { CHINA_TOURS, FILTERS, type TourCategory } from "./chinaNovember2026Data";

export default function ChinaNovember2026() {
  const [activeFilter, setActiveFilter] = useState<"Все" | TourCategory>("Все");
  const dialogRefs = useRef<Record<string, HTMLDialogElement | null>>({});

  function openTour(id: string) {
    dialogRefs.current[id]?.showModal();
  }

  function closeTour(id: string) {
    dialogRefs.current[id]?.close();
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero} style={{ backgroundImage: "url('/tours/china-november-2026/hero-collage.jpg')" }}>
        <div className={styles.heroInner}>
          <span className={styles.brand}>FLYPENZA · Китай 2026–2027</span>
          <h1>
            Китай с ноября:
            <br />
            от мегаполисов до гор Аватара
          </h1>
          <p>
            Одна страница с экскурсионными, природными и комбинированными маршрутами <b>только по Китаю</b>. Все
            подтверждённые суммы пересчитаны сразу <b>на двух взрослых</b>.
          </p>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <b>15 программ</b>
              <span>после фильтра по датам</span>
            </div>
            <div className={styles.heroStat}>
              <b>с ноября 2026</b>
              <span>и далее</span>
            </div>
            <div className={styles.heroStat}>
              <b>цена за двоих</b>
              <span>без пересчёта в голове</span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.topline}>
          <div>
            <div className={styles.kicker}>Подборка туров</div>
            <h2>Выберите маршрут</h2>
          </div>
          <p>
            Цены ITM ниже показаны только для варианта <b>С ПЕРЕЛЁТОМ</b>. Если оператор одновременно публикует более
            дешёвый тариф без авиабилетов, он в расчёт не используется. Все суммы пересчитаны на 2 взрослых.
          </p>
        </section>

        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`${styles.filter} ${activeFilter === f.value ? styles.filterActive : ""}`}
              onClick={() => setActiveFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <section className={styles.grid}>
          {CHINA_TOURS.map((tour) => {
            const isHidden = activeFilter !== "Все" && tour.category !== activeFilter;
            return (
              <article key={tour.id} className={`${styles.tourCard} ${isHidden ? styles.hidden : ""}`}>
                <div className={styles.photo} style={{ backgroundImage: `url('${tour.image}')` }}>
                  <div className={styles.photoTop}>
                    <span className={styles.operator}>{tour.operator}</span>
                    <span className={styles.badge}>{tour.badge}</span>
                  </div>
                  <div className={styles.photoBottom}>{tour.photoBottom}</div>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.duration}>{tour.duration}</div>
                  <h3>{tour.title}</h3>
                  <p className={styles.route}>{tour.route}</p>
                  <div className={styles.dateLine}>
                    <span>{tour.dateLabel}</span>
                    <b>{tour.dateValue}</b>
                  </div>
                  <div className={styles.cardFooter}>
                    <div className={`${styles.price} ${tour.isQuery ? styles.priceQuery : ""}`}>
                      <strong>{tour.price}</strong>
                      <small>{tour.priceNote}</small>
                    </div>
                    <button type="button" className={styles.detailsBtn} onClick={() => openTour(tour.id)}>
                      Подробнее
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <div className={styles.note}>
          <b>Как читать цены:</b> суммы у ITM group рассчитаны из официальной стоимости на одного человека, умноженной
          на 2 — специально для пары. У Space Travel часть маршрутов продаётся «по запросу»: точную стоимость на двоих
          оператор считает индивидуально. Перед бронированием любую сумму нужно перепроверять — тарифы авиакомпаний и
          блоки мест меняются.
        </div>
      </main>

      {CHINA_TOURS.map((tour) => (
        <dialog
          key={tour.id}
          ref={(el) => {
            dialogRefs.current[tour.id] = el;
          }}
          className={styles.dialog}
          onClick={(e) => {
            const rect = (e.target as HTMLDialogElement).getBoundingClientRect?.();
            if (
              e.target === e.currentTarget &&
              rect &&
              (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
            ) {
              closeTour(tour.id);
            }
          }}
        >
          <button type="button" aria-label="Закрыть" className={styles.close} onClick={() => closeTour(tour.id)}>
            ×
          </button>
          <div className={styles.dialogPhoto} style={{ backgroundImage: `url('${tour.image}')` }}>
            <div className={styles.dialogShade}>
              <span>{tour.operator}</span>
              <h2>{tour.title}</h2>
              <p>{tour.route}</p>
            </div>
          </div>
          <div className={styles.dialogContent}>
            <div className={styles.dialogMeta}>
              <div>
                <small>Продолжительность</small>
                <strong>{tour.dialog.metaDuration}</strong>
              </div>
              <div>
                <small>{tour.dialog.metaDateLabel}</small>
                <strong>{tour.dialog.metaDateValue}</strong>
              </div>
            </div>

            <section className={styles.priceBox}>
              <span>Стоимость для 2 взрослых</span>
              <strong>{tour.dialog.priceBoxValue}</strong>
              <em>{tour.dialog.priceBoxNote}</em>
              <p>{tour.dialog.priceBoxDescription}</p>
            </section>

            {tour.dialog.verifiedFlightText && (
              <div className={styles.verifiedFlight}>✓ Проверено по ITM: {tour.dialog.verifiedFlightText}</div>
            )}

            <section className={styles.fullProgram}>
              <h3>Программа по дням</h3>
              <div className={styles.dayProgram}>
                {tour.dialog.dayProgram.map((d, i) => (
                  <div key={i} className={styles.dayRow}>
                    <div className={styles.dayNo}>{d.day}</div>
                    <div className={styles.dayCopy}>
                      <b>{d.title}</b>
                      <p>{d.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className={styles.compositionGrid}>
              <div className={`${styles.compositionBox} ${styles.compositionIncluded}`}>
                <h4>✓ В стоимость входит</h4>
                <ul>
                  {tour.dialog.included.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className={`${styles.compositionBox} ${styles.compositionExcluded}`}>
                <h4>Не входит / оплачивается отдельно</h4>
                <ul>
                  {tour.dialog.excluded.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={styles.hotelsBox}>
              <h4>Отели / размещение</h4>
              <ul>
                {tour.dialog.hotels.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={styles.operatorNote}>{tour.dialog.operatorNote}</div>

            <div className={styles.dialogActions}>
              <OpenLeadFormButton className={`${styles.sourceLink} ${styles.sourceLinkCta}`}>
                Оставить заявку на этот тур
              </OpenLeadFormButton>
              <a
                className={`${styles.sourceLink} ${styles.sourceLinkGhost}`}
                href={tour.dialog.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tour.dialog.sourceLabel}
              </a>
            </div>
          </div>
        </dialog>
      ))}

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>Источники: Space Travel, «Премьера», ITM group и открытая карточка партнёра по программе «Две столицы».</span>
          <span>Проверено: 09.09.2026 · Все цены требуют подтверждения перед бронированием.</span>
        </div>
      </footer>
    </div>
  );
}
