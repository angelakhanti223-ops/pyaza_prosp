"use client";
import { useState } from "react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import SiteCtaBlock from "@/components/cta/SiteCtaBlock";
import data from "./data.json";
import styles from "./page.module.css";
type Program = (typeof data.programs)[number];
const money=(n:number)=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
const date=(s:string)=>s.split('-').reverse().join('.');
const cities=[{code:'MOW',name:'Москва'},{code:'RTW',name:'Саратов'},{code:'KUF',name:'Самара'}];
function ProgramCard({program:p}:{program:Program}) {
 const [variantId,setVariantId]=useState(p.variants[0].id),[city,setCity]=useState('MOW'),[withBag,setWithBag]=useState(false);
 const v=p.variants.find(x=>x.id===variantId)??p.variants[0];
 const q=data.flights.quotes.find(x=>x.code===city&&x.start===v.start&&x.end===v.end);
 const bagAvailable=typeof q?.baggagePrice==='number';const effectiveBag=withBag&&bagAvailable;
 const air=q?(effectiveBag?q.baggagePrice!:q.price):null; const compatible=q?.compatible!==false,live=q?.kind==='live';
 function changeDate(start:string){const variants=p.variants.filter(x=>x.start===start);setVariantId((variants.find(x=>x.hotel===v.hotel)??variants[0]).id);}
 const comment=`Калининград · Новый год 2027\n${p.name}\n2 взрослых + ребёнок 9 лет\n${date(v.start)} — ${date(v.end)}, ${p.nights} ночей\nОтель: ${v.hotel}\nНомер: ${v.room}\nТур: ${money(v.price)}\nВылет: ${cities.find(c=>c.code===city)?.name}; ${effectiveBag?'с багажом':'без сдаваемого багажа'}\n${q?`Авиа из подборки: ${money(air!)}. ${q.route}. ${q.out}. ${q.back}. ${q.note}`:'Авиа нужно рассчитать'}\n${air!==null?`Предварительный итог: ${money(v.price+air)}. `:''}${!compatible?'Выбранный рейс не подходит к началу программы. Нужен другой перелёт или дополнительная ночь. ':''}Прошу подтвердить цену, рейсы и наличие мест.`;
 return <article className={styles.card}>
  <div className={styles.cardHead}><p>{p.subtitle}</p><h2>{p.name}</h2><div className={styles.badges}><span>{p.days} дней / {p.nights} ночей</span><span>{p.badge}</span></div></div>
  <div className={styles.cardBody}><p>{p.overview}</p><div className={styles.selectors}>
   <label>Даты поездки<select value={v.start} onChange={e=>changeDate(e.target.value)}>{[...new Set(p.variants.map(x=>x.start))].map(start=>{const x=p.variants.find(x=>x.start===start)!;return <option key={start} value={start}>{date(x.start)} — {date(x.end)}</option>;})}</select></label>
   <label>Вариант проживания<select value={v.id} onChange={e=>setVariantId(e.target.value)}>{p.variants.filter(x=>x.start===v.start).map(x=><option key={x.id} value={x.id}>{x.hotel}</option>)}</select></label>
  </div>
  <div className={styles.tourPrice} aria-live="polite"><span>Тур на всю семью · без проезда</span><strong>{money(v.price)}</strong><h3>{v.hotel}</h3><p>{v.room}</p><p>{v.bed}</p><b>{v.meals}</b><h4>Удобство расположения</h4><p>{v.location}</p></div>
  <section className={styles.air}><h3>Перелёт на всю семью · туда-обратно</h3><div className={styles.selectors}><label>Город вылета<select value={city} onChange={e=>setCity(e.target.value)}>{cities.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label><label>Багаж<select value={effectiveBag?'bag':'base'} onChange={e=>setWithBag(e.target.value==='bag')}><option value="base">Без сдаваемого багажа</option><option value="bag" disabled={!bagAvailable}>С багажом каждому</option></select></label></div>
  <div aria-live="polite">{q?<><p className={styles.status}>{live?'Тариф из подборки от 30.10.2026':'Ориентир календаря — рейсы требуют проверки'}</p><strong className={styles.airAmount}>≈ {money(air!)}</strong><p>{q.route}</p><p>{q.out}</p><p>{q.back}</p><p>{q.hand}</p><p>{effectiveBag?q.baggage:bagAvailable?'Сдаваемый багаж не включён.':'Норма багажа и цена тарифа с багажом уточняются.'}</p><p className={styles.warning}>{q.note}</p><div className={styles.total}><span>{compatible?'Тур + перелёт':'Справочная сумма: перелёт нужно изменить'}</span><strong>≈ {money(v.price+air!)}</strong></div><p className={styles.fine}>{!compatible?'Этот рейс не успевает к первой экскурсии. Другой билет или дополнительная ночь и трансфер не включены в сумму.':!live?'Предварительная сумма по календарному ориентиру. Время рейсов и фактические даты прилёта не подтверждены.':'Стоимость предварительная. Время рейсов местное; места и тариф подтвердим перед оплатой.'}</p></>:<p>Для выбранного сочетания дат и города перелёт рассчитаем по запросу.</p>}</div></section>
  <details className={styles.details}><summary>Программа и что включено</summary><ol>{p.program.map((day,i)=><li key={i}>{day}</li>)}</ol><h3>Включено в стоимость</h3><p>{p.included}</p><h3>Оплачивается отдельно</h3><p>{p.extra}</p><h3>Перед выбором</h3><p>{p.notes}</p></details>
  <OpenLeadFormButton className={styles.primary} comment={comment}>{compatible?'Уточнить стоимость и оставить заявку':'Подобрать подходящий перелёт'}</OpenLeadFormButton></div>
 </article>;
}
export default function KaliningradFamilyTours(){
 const [nights,setNights]=useState('');const programs=data.programs.filter(p=>!nights||p.nights===Number(nights));
 return <div className={styles.page}><section className={styles.hero}><div><p className={styles.eyebrow}>Слетать.ру · Новогодние каникулы 2027</p><h1>Новогодние каникулы<br/>на Балтике</h1><p>Праздничный Калининград, замки и зимнее море. Подборка на 6–7 ночей для двух взрослых и ребёнка 9 лет.</p><div className={styles.badges}><span>Заезды 1, 2 и 3 января</span><span>14 вариантов проживания и дат</span><span>Вся семья в одной цене</span></div></div></section>
 <div className={styles.content}><nav aria-label="Хлебные крошки" className={styles.breadcrumbs}><a href="/">Главная</a> / <a href="/tours">Туры</a> / Калининград · Новый год</nav><div className={styles.notice}><b>Тур и авиабилеты показаны отдельно.</b> Выбирайте даты, отель, город вылета и багаж — предварительная сумма пересчитается. Расчёты перенесены из подборки от 30.10.2026; тарифы и наличие мест требуют подтверждения. Цены — за всю семью, не за человека.</div>
 <div className={styles.toolbar}><p aria-live="polite">Программ: {programs.length} · Семейных вариантов: {programs.reduce((n,p)=>n+p.variants.length,0)}</p><label>Длительность<select value={nights} onChange={e=>setNights(e.target.value)}><option value="">Все программы</option><option value="6">6 ночей</option><option value="7">7 ночей</option></select></label></div>
 <div className={styles.grid}>{programs.map(p=><ProgramCard key={p.id} program={p}/>)}</div>
 <details className={styles.details}><summary>Все 14 семейных вариантов</summary><div className={styles.tableWrap}><table><thead><tr><th>Программа</th><th>Даты</th><th>Размещение</th><th>Ночей</th><th>За семью без проезда</th></tr></thead><tbody>{data.programs.flatMap(p=>p.variants.map(v=><tr key={v.id}><td>{p.name}</td><td>{date(v.start)} — {date(v.end)}</td><td>{v.hotel}<small>{v.room}</small></td><td>{p.nights}</td><td>{money(v.price)}</td></tr>))}</tbody></table></div></details>
 <details className={styles.details}><summary>Сравнить перелёты из Москвы, Саратова и Самары</summary><p>Все суммы на троих туда-обратно. «С багажом» — полная цена перелёта, а не доплата. Это данные подборки от 30.10.2026, а не текущая выдача авиабилетов.</p><div className={styles.tableWrap}><table><thead><tr><th>Город / даты</th><th>Без багажа</th><th>С багажом</th><th>Рейсы и ограничения</th></tr></thead><tbody>{data.flights.quotes.map((q,i)=><tr key={i}><td>{q.city}<small>{date(q.start)} — {date(q.end)}</small><small>{q.kind==='live'?'Тариф из подборки':'Ориентир календаря'}</small></td><td>{money(q.price)}</td><td>{typeof q.baggagePrice==='number'?money(q.baggagePrice):'Уточняется'}<small>{q.baggage}</small></td><td>{q.route}<small>{q.out}</small><small>{q.back}</small><p className={q.compatible===false?styles.warning:''}>{q.note}</p></td></tr>)}</tbody></table></div></details>
 <p className={styles.fine}>Питание сверх включённого, дополнительные экскурсии, багаж сверх выбранного тарифа и услуги вне программы в итог не добавлены. Билеты и места не забронированы. Тип дополнительного места для ребёнка и условия питания подтвердим по выбранному номеру.</p>
 <SiteCtaBlock className="mt-8" title="Хотите другие даты или другой состав семьи?" text="Подберём новогоднюю поездку в Калининград с удобными рейсами, отелем и экскурсиями под ваш бюджет." primaryLabel="Подобрать семейные каникулы" comment="Индивидуальная заявка: Калининград на Новый год 2027" />
 </div></div>;
}
