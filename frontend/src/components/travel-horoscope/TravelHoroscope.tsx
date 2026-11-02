"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUpRight, CalendarDays, Compass, Pause, Play, Sparkles } from "lucide-react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import { horoscopeLeadComment, zodiacForBirthDate, ZODIAC_FORECASTS } from "@/lib/travelZodiac";
import styles from "./travel-horoscope.module.css";

const stars = Array.from({ length: 64 }, (_, index) => ({
  "--x": `${(index * 47 + 13) % 100}%`,
  "--y": `${(index * index * 13 + 7) % 100}%`,
  "--size": `${index % 9 === 0 ? 3 : index % 3 === 0 ? 2 : 1}px`,
  "--delay": `${-(index % 17)}s`,
  "--duration": `${5 + index % 7}s`,
}) as CSSProperties);

export default function TravelHoroscope() {
  const [birthday, setBirthday] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [playStars, setPlayStars] = useState(true);
  const [motionAllowed, setMotionAllowed] = useState(true);
  const [today, setToday] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  const calculated = zodiacForBirthDate(birthday);
  const sign = selectedId ? ZODIAC_FORECASTS.find(item => item.id === selectedId) : calculated;
  const error = !sign && (birthday || submitted)
    ? birthday ? "Проверьте дату рождения: она должна существовать и не быть в будущем." : "Введите дату рождения или выберите свой знак ниже."
    : "";
  const animated = motionAllowed && playStars;

  useEffect(() => {
    const now = new Date();
    setToday(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function showResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!sign) return;
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({ behavior: motionAllowed ? "smooth" : "auto", block: "start" });
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="horoscope-title">
        <div className={`${styles.sky} ${animated ? "" : styles.paused}`} aria-hidden="true">
          <div className={styles.starLayer}>{stars.map((style, index) => <i key={index} style={style} />)}</div>
          <div className={styles.orbit} /><div className={styles.orbitInner} />
          <div className={styles.planet} />
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroTop}>
            <p className={styles.eyebrow}><Sparkles size={15} aria-hidden="true" /> ВАШ ЗВЁЗДНЫЙ МАРШРУТ · 2027</p>
            <button type="button" onClick={() => setPlayStars(value => !value)} disabled={!motionAllowed} aria-pressed={animated} className={styles.motion}>
              {animated ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              {animated ? "Остановить звёзды" : motionAllowed ? "Включить звёзды" : "Анимация отключена"}
            </button>
          </div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <h1 id="horoscope-title">А что, если<br />ваш отпуск<br /><em>уже в звёздах?</em></h1>
              <p>Введите дату рождения и откройте свой прогноз путешествий на 2027 год: куда отправиться, когда и за какими впечатлениями.</p>
              <span className={styles.heroFoot}>12 знаков · 4 стихии · целый мир открытий</span>
            </div>
            <form onSubmit={showResult} noValidate className={styles.dateCard}>
              <span className={styles.cardEyebrow}>ПЕРВАЯ ПОДСКАЗКА — В ВАШЕЙ ДАТЕ</span>
              <h2>Куда зовут звёзды?</h2>
              <label htmlFor="travel-birthday">Введите вашу дату рождения</label>
              <input id="travel-birthday" className="ym-disable-keys" type="date" value={birthday} max={today || undefined} required={!selectedId} aria-invalid={!!error} aria-describedby="birthday-hint birthday-error"
                onChange={event => { setBirthday(event.target.value); setSelectedId(null); setSubmitted(false); }} />
              <p id="birthday-hint" className={styles.hint}>Дата нужна только для определения знака. Она не сохраняется и не отправляется с заявкой.</p>
              <div className={styles.detected} aria-live="polite" aria-atomic="true">
                {sign ? <><span aria-hidden="true">{sign.symbol}</span><div><strong>Ваш знак — {sign.name}</strong><small>Стихия: {sign.element}. Прогноз уже открыт ниже.</small></div></> : <><Compass size={25} aria-hidden="true" /><span>Ваш маршрут начнётся с даты рождения</span></>}
              </div>
              <p id="birthday-error" role={error ? "alert" : undefined} className={styles.error}>{error}</p>
              <button type="submit" className={styles.primary}>Показать мой прогноз <ArrowDown size={18} aria-hidden="true" /></button>
              <p className={styles.calendarNote}>Определяем знак по календарным датам. На границе знаков для точного расчёта нужны время и место рождения.</p>
            </form>
          </div>
        </div>
      </section>

      <div className={styles.body}>
        <section className={styles.choose} aria-label="Выбрать знак зодиака">
          <p>Уже знаете свой знак? <span>Выберите его здесь</span></p>
          <div className={styles.signs}>{ZODIAC_FORECASTS.map(item => (
            <button key={item.id} type="button" aria-pressed={sign?.id === item.id} onClick={() => { setSelectedId(item.id); setBirthday(""); setSubmitted(false); }}>
              <span aria-hidden="true">{item.symbol}</span>{item.name}
            </button>
          ))}</div>
        </section>

        {sign ? (
          <section ref={resultRef} tabIndex={-1} className={styles.result} aria-labelledby="forecast-title" key={sign.id}>
            <div className={styles.resultHead}>
              <div className={styles.seal} aria-hidden="true">{sign.symbol}</div>
              <div><p className={styles.sectionLabel}>ВАШ ПРОГНОЗ ПУТЕШЕСТВИЙ — 2027</p><h2 id="forecast-title">{sign.name} <span>«{sign.archetype}»</span></h2><p className={styles.dates}>{sign.dates} · Стихия: {sign.element}</p></div>
            </div>
            <p className={styles.resultIntro}>{sign.intro}</p>
            <div className={styles.window}><CalendarDays size={23} aria-hidden="true" /><div><h3>Ваши звёздные окна</h3><p>{sign.window}</p></div></div>
            <div className={styles.routeHeading}><h3>Маршруты вашего года</h3><span>Идеи для будущей поездки</span></div>
            <ol className={styles.routes}>{sign.routes.map((route, index) => (
              <li key={route.title}><span className={styles.routeNumber}>{String(index + 1).padStart(2, "0")}</span><div><h4>{route.title}</h4><p>{route.description}</p><OpenLeadFormButton comment={horoscopeLeadComment(sign, route.title)} className={styles.routeCta}>Подобрать этот маршрут <ArrowUpRight size={15} aria-hidden="true" /></OpenLeadFormButton></div></li>
            ))}</ol>
            <div className={styles.details}>
              <div><h3>Звёздный попутчик</h3><p>{sign.companion}</p></div>
              <div><h3>Талисман путешествия</h3><p>{sign.talisman}</p></div>
            </div>
            <p className={styles.tip}><strong>Совет для поездки.</strong> {sign.tip}</p>
            <div className={styles.resultCta}><div><h3>Превратим идею в путешествие?</h3><p>Уточним даты, бюджет и город вылета — и найдём ваши варианты.</p></div><OpenLeadFormButton comment={horoscopeLeadComment(sign)} className={styles.primary}>Подобрать тур <ArrowUpRight size={18} aria-hidden="true" /></OpenLeadFormButton></div>
          </section>
        ) : (
          <div className={styles.empty}><Sparkles size={24} aria-hidden="true" /><p>У каждого знака — свой маршрут.<br /><strong>Введите дату рождения или выберите знак, чтобы открыть ваш.</strong></p></div>
        )}

        <aside className={styles.eclipse} aria-labelledby="eclipse-title">
          <div className={styles.eclipseIcon} aria-hidden="true" /><div><p className={styles.sectionLabel}>ПОВОД ПОСМОТРЕТЬ НА НЕБО</p><h2 id="eclipse-title">2 августа 2027 — солнечное затмение</h2><p>Полоса полного затмения пройдёт через юг Испании и Египет. Если мечтаете о такой поездке, обсудим маршрут, сезон и условия наблюдения отдельно.</p><a href="https://eclipse.gsfc.nasa.gov/OH/OH2027.html" target="_blank" rel="noopener noreferrer">Календарь затмений NASA <ArrowUpRight size={14} aria-hidden="true" /></a></div>
        </aside>
        <div className={styles.editorial}><p>Астропрогноз — развлекательная подборка для вдохновения, а не гарантия событий или погоды. При подборе тура учитываем ваши пожелания, сезон, бюджет, доступность рейсов и действующие правила въезда.</p><p>Материал подготовлен по авторскому «Астропрогнозу путешествий 2027». Сроки цветения сакуры зависят от года и региона: <a href="https://www.japan.travel/en/see-and-do/cherry-blossom-forecast/" target="_blank" rel="noopener noreferrer">Japan National Tourism Organization</a>. Сезоны на Бали: <a href="https://www.indonesia.travel/hk/en/general-information/weather-climate-seasons" target="_blank" rel="noopener noreferrer">Indonesia Travel</a>; на Шри-Ланке: <a href="https://srilanka.travel/weather" target="_blank" rel="noopener noreferrer">Sri Lanka Tourism</a>.</p></div>
      </div>
    </div>
  );
}
