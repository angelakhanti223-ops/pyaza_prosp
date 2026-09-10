"use client";

import { useMemo, useState } from "react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import styles from "./ShanghaiBeijingConstructor.module.css";
import {
  EXCURSIONS,
  FLIGHTS,
  HOTELS,
  TRANSPORT,
  type ExcursionOption,
} from "./shanghaiBeijingConstructorData";

const DEFAULT_TRANSPORT = TRANSPORT.map((t) => t.id);

function formatPrice(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

export default function ShanghaiBeijingConstructor() {
  const [flightId, setFlightId] = useState(FLIGHTS[0].id);
  const [shanghaiHotelId, setShanghaiHotelId] = useState(HOTELS.shanghai[0].id);
  const [beijingHotelId, setBeijingHotelId] = useState(HOTELS.beijing[0].id);
  const [transportIds, setTransportIds] = useState<string[]>(DEFAULT_TRANSPORT);
  const [excursionIds, setExcursionIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; show: boolean }>({ text: "", show: false });

  const flight = FLIGHTS.find((f) => f.id === flightId)!;
  const shanghai = HOTELS.shanghai.find((h) => h.id === shanghaiHotelId)!;
  const beijing = HOTELS.beijing.find((h) => h.id === beijingHotelId)!;
  const selectedTransport = TRANSPORT.filter((t) => transportIds.includes(t.id));
  const selectedExcursions = EXCURSIONS.filter((e) => excursionIds.includes(e.id));

  const hotelTotal = shanghai.price + beijing.price;
  const transportTotal = selectedTransport.reduce((sum, t) => sum + t.price, 0);
  const excursionTotal = selectedExcursions.reduce((sum, e) => sum + e.price, 0);
  const total = flight.price + hotelTotal + transportTotal + excursionTotal;

  const excursionsByCity = useMemo(() => {
    const groups: Record<string, ExcursionOption[]> = { Шанхай: [], Пекин: [] };
    for (const item of EXCURSIONS) groups[item.city].push(item);
    return groups;
  }, []);

  function toggleTransport(id: string) {
    setTransportIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleExcursion(id: string) {
    setExcursionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleCity(city: "Шанхай" | "Пекин") {
    const cityIds = excursionsByCity[city].map((e) => e.id);
    const allChecked = cityIds.every((id) => excursionIds.includes(id));
    setExcursionIds((prev) =>
      allChecked ? prev.filter((id) => !cityIds.includes(id)) : [...new Set([...prev, ...cityIds])]
    );
  }

  function buildEstimateText(): string {
    const lines = [
      "ТУР ШАНХАЙ + ПЕКИН",
      "05–16 ноября 2026 · 2 взрослых · 10 ночей",
      "",
      `Перелёт: ${flight.name} — ${formatPrice(flight.price)}`,
      `Шанхай: ${shanghai.name} — ${formatPrice(shanghai.price)}`,
      `Пекин: ${beijing.name} — ${formatPrice(beijing.price)}`,
      "",
      "Поезд и трансферы:",
      ...(selectedTransport.length ? selectedTransport.map((t) => `• ${t.name} — ${formatPrice(t.price)}`) : ["• не выбраны"]),
      "",
      "Экскурсии:",
      ...(selectedExcursions.length ? selectedExcursions.map((e) => `• ${e.name} — ${formatPrice(e.price)}`) : ["• не выбраны"]),
      "",
      `ИТОГО ЗА ДВОИХ: ${formatPrice(total)}`,
      `На человека: ${formatPrice(Math.round(total / 2))}`,
      "Комиссия 7% включена. Стоимость может измениться при бронировании.",
    ];
    return lines.join("\n");
  }

  function showToast(text: string) {
    setToast({ text, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 1800);
  }

  async function copyEstimate() {
    const text = buildEstimateText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast("Расчёт скопирован");
  }

  function resetBuilder() {
    setFlightId(FLIGHTS[0].id);
    setShanghaiHotelId(HOTELS.shanghai[0].id);
    setBeijingHotelId(HOTELS.beijing[0].id);
    setTransportIds(DEFAULT_TRANSPORT);
    setExcursionIds([]);
    window.scrollTo({ top: 260, behavior: "smooth" });
  }

  const selectionSummary = [
    flight.name,
    shanghai.name,
    beijing.name,
    selectedTransport.length ? `Транспортных услуг: ${selectedTransport.length}` : "Транспорт не выбран",
    selectedExcursions.length ? `Экскурсий: ${selectedExcursions.length}` : "Экскурсии не выбраны",
  ];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Индивидуальный тур</span>
          <h1>Шанхай + Пекин</h1>
          <p>Соберите поездку на двоих: выберите перелёт, отели, поезд, трансферы и экскурсии.</p>
          <div className={styles.facts} aria-label="Параметры поездки">
            <span className={styles.fact}>05–16 ноября 2026</span>
            <span className={styles.fact}>10 ночей</span>
            <span className={styles.fact}>2 взрослых</span>
            <span className={styles.fact}>Завтраки включены</span>
          </div>
        </div>
      </header>

      <main className={styles.layout}>
        <div className={styles.builder}>
          <section className={styles.section} aria-labelledby="flight-title">
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitleWrap}>
                <span className={styles.sectionNumber}>1</span>
                <div>
                  <h2 id="flight-title">Авиаперелёт</h2>
                  <p className={styles.sectionNote}>Туда — в Шанхай, обратно — из Пекина. Тарифы невозвратные.</p>
                </div>
              </div>
            </div>
            <div className={styles.choiceGrid}>
              {FLIGHTS.map((f) => (
                <label key={f.id} className={styles.choice}>
                  <input type="radio" name="flight" checked={flightId === f.id} onChange={() => setFlightId(f.id)} />
                  <span className={`${styles.choiceCard} ${flightId === f.id ? styles.choiceCardChecked : ""}`}>
                    <span className={styles.choiceTop}>
                      <span className={styles.choiceName}>{f.name}</span>
                      <span className={styles.price}>{formatPrice(f.price)}</span>
                    </span>
                    <span className={styles.meta}>{f.meta}</span>
                    <span className={styles.flightRoute}>{f.route}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="hotel-title">
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitleWrap}>
                <span className={styles.sectionNumber}>2</span>
                <div>
                  <h2 id="hotel-title">Отели</h2>
                  <p className={styles.sectionNote}>Можно сочетать категории 4★ и 5★ в разных городах.</p>
                </div>
              </div>
            </div>
            <div className={styles.cityBlock}>
              <p className={styles.cityLabel}>Шанхай · 06–11 ноября · 5 ночей</p>
              <div className={`${styles.choiceGrid} ${styles.choiceGridFlush}`}>
                {HOTELS.shanghai.map((h) => (
                  <label key={h.id} className={styles.choice}>
                    <input
                      type="radio"
                      name="shanghaiHotel"
                      checked={shanghaiHotelId === h.id}
                      onChange={() => setShanghaiHotelId(h.id)}
                    />
                    <span className={`${styles.choiceCard} ${shanghaiHotelId === h.id ? styles.choiceCardChecked : ""}`}>
                      <span className={styles.choiceTop}>
                        <span className={styles.choiceName}>{h.name}</span>
                        <span className={styles.price}>{formatPrice(h.price)}</span>
                      </span>
                      <span className={styles.meta}>{h.room}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.cityBlock}>
              <p className={styles.cityLabel}>Пекин · 11–16 ноября · 5 ночей</p>
              <div className={`${styles.choiceGrid} ${styles.choiceGridFlush}`}>
                {HOTELS.beijing.map((h) => (
                  <label key={h.id} className={styles.choice}>
                    <input
                      type="radio"
                      name="beijingHotel"
                      checked={beijingHotelId === h.id}
                      onChange={() => setBeijingHotelId(h.id)}
                    />
                    <span className={`${styles.choiceCard} ${beijingHotelId === h.id ? styles.choiceCardChecked : ""}`}>
                      <span className={styles.choiceTop}>
                        <span className={styles.choiceName}>{h.name}</span>
                        <span className={styles.price}>{formatPrice(h.price)}</span>
                      </span>
                      <span className={styles.meta}>{h.room}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="transport-title">
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitleWrap}>
                <span className={styles.sectionNumber}>3</span>
                <div>
                  <h2 id="transport-title">Поезд и трансферы</h2>
                  <p className={styles.sectionNote}>Отметьте только те услуги, которые нужно включить в пакет.</p>
                </div>
              </div>
            </div>
            <div className={styles.lineList}>
              {TRANSPORT.map((t) => {
                const checked = transportIds.includes(t.id);
                return (
                  <label key={t.id} className={styles.checkRow}>
                    <input type="checkbox" checked={checked} onChange={() => toggleTransport(t.id)} />
                    <span className={`${styles.box} ${checked ? styles.boxChecked : ""}`} aria-hidden="true" />
                    <span className={styles.checkLabel}>
                      {t.name}
                      {t.sub && <span className={styles.checkSub}>{t.sub}</span>}
                    </span>
                    <span className={styles.price}>{formatPrice(t.price)}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="excursion-title">
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitleWrap}>
                <span className={styles.sectionNumber}>4</span>
                <div>
                  <h2 id="excursion-title">Экскурсии</h2>
                  <p className={styles.sectionNote}>Выберите несколько вариантов. Стоимость указана за двоих.</p>
                </div>
              </div>
            </div>
            {(["Шанхай", "Пекин"] as const).map((city) => {
              const cityIds = excursionsByCity[city].map((e) => e.id);
              const allChecked = cityIds.every((id) => excursionIds.includes(id));
              return (
                <div key={city}>
                  <div className={styles.groupBar}>
                    <span className={styles.groupTitle}>{city}</span>
                    <button type="button" className={styles.linkButton} onClick={() => toggleCity(city)}>
                      {allChecked ? "Снять все" : "Выбрать все"}
                    </button>
                  </div>
                  <div className={styles.lineList}>
                    {excursionsByCity[city].map((item) => {
                      const checked = excursionIds.includes(item.id);
                      return (
                        <div key={item.id} className={styles.excursionItem}>
                          <label className={styles.checkRow}>
                            <input type="checkbox" checked={checked} onChange={() => toggleExcursion(item.id)} />
                            <span className={`${styles.box} ${checked ? styles.boxChecked : ""}`} aria-hidden="true" />
                            <span className={styles.checkLabel}>
                              {item.name}
                              <span className={styles.checkSub}>{item.duration}</span>
                            </span>
                            <span className={styles.price}>{formatPrice(item.price)}</span>
                          </label>
                          <details className={styles.excursionDetails}>
                            <summary>Показать программу</summary>
                            <p className={styles.excursionDescription}>{item.description}</p>
                            <ul className={styles.excursionProgram}>
                              {item.program.map((point, i) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                            {item.note && (
                              <p className={styles.excursionNote}>
                                <strong>Обратите внимание:</strong> {item.note}
                              </p>
                            )}
                          </details>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        <aside className={styles.summary} aria-live="polite">
          <div className={styles.summaryTop}>
            <p className={styles.summaryKicker}>Стоимость тура за двоих</p>
            <p className={styles.total}>{formatPrice(total)}</p>
            <div className={styles.perPerson}>{formatPrice(Math.round(total / 2))} на человека</div>
            <span className={styles.commissionPill}>Комиссия 7% уже включена</span>
          </div>
          <div className={styles.summaryBody}>
            <div className={styles.summaryLine}>
              <span>Авиаперелёт</span>
              <span>{formatPrice(flight.price)}</span>
            </div>
            <div className={styles.summaryLine}>
              <span>Отели, 10 ночей</span>
              <span>{formatPrice(hotelTotal)}</span>
            </div>
            <div className={styles.summaryLine}>
              <span>Поезд и трансферы</span>
              <span>{formatPrice(transportTotal)}</span>
            </div>
            <div className={styles.summaryLine}>
              <span>Экскурсии</span>
              <span>{formatPrice(excursionTotal)}</span>
            </div>
            <div className={`${styles.summaryLine} ${styles.summaryLineMajor}`}>
              <span>Итого</span>
              <span>{formatPrice(total)}</span>
            </div>
            <ul className={styles.selectionList}>
              {selectionSummary.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
            <OpenLeadFormButton className={styles.action} comment={buildEstimateText()}>
              Оставить заявку с этим расчётом
            </OpenLeadFormButton>
            <button type="button" className={`${styles.action} ${styles.actionSecondary}`} onClick={copyEstimate}>
              Скопировать расчёт
            </button>
            <button type="button" className={`${styles.action} ${styles.actionSecondary}`} onClick={() => window.print()}>
              Распечатать / сохранить PDF
            </button>
            <button type="button" className={styles.reset} onClick={resetBuilder}>
              Сбросить выбор
            </button>
            <p className={styles.finePrint}>
              Стоимость актуальна на момент расчёта и может измениться при бронировании. В авиабилетах и ж/д билетах
              применяются невозвратные тарифы. Цены рассчитаны для двух взрослых и уже включают 7%.
            </p>
          </div>
        </aside>
      </main>

      <div className={`${styles.toast} ${toast.show ? styles.toastShow : ""}`} role="status">
        {toast.text}
      </div>
    </div>
  );
}
