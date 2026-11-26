fetch('/bus-assets/winter-2026-2027/tours.json', {credentials:'omit'})
.then(response=>{if(!response.ok)throw new Error('Tours unavailable');return response.json();})
.then(tours=>{

const PHOTOS={"moscow": "/bus-assets/winter-2026-2027/moscow.jpg", "spb": "/bus-assets/winter-2026-2027/spb.jpg", "kazan": "/bus-assets/winter-2026-2027/kazan.jpg", "elbrus": "/bus-assets/winter-2026-2027/elbrus.jpg", "dagestan": "/bus-assets/winter-2026-2027/dagestan.jpg", "ossetia": "/bus-assets/winter-2026-2027/ossetia.jpg", "karelia": "/bus-assets/winter-2026-2027/karelia.jpg", "belarus": "/bus-assets/winter-2026-2027/belarus.jpg", "sochi": "/bus-assets/winter-2026-2027/sochi.jpg", "church": "/bus-assets/winter-2026-2027/church.jpg", "nizhny": "/bus-assets/winter-2026-2027/nizhny.jpg", "yoshkar": "/bus-assets/winter-2026-2027/yoshkar.jpg", "estate": "/bus-assets/winter-2026-2027/estate.jpg", "theater": "/bus-assets/winter-2026-2027/theater.jpg", "family": "/bus-assets/winter-2026-2027/family.jpg", "thermal": "/bus-assets/winter-2026-2027/thermal.jpg"};
const PHOTO_GROUPS={
  moscow:["moscow","theater","estate","city"],
  spb:["spb","theater","estate","city"],
  kazan:["kazan","yoshkar","city"],
  caucasus:["elbrus","ossetia","thermal","dagestan"],
  dagestan:["dagestan","ossetia","city"],
  sochi:["sochi","thermal","family"],
  heritage:["church","estate","nizhny","belarus"],
  belarus:["belarus","church","city"],
  karelia:["karelia","family","thermal"],
  theater:["theater","moscow","spb"],
  family:["family","sochi","karelia"],
  city:["city","nizhny","estate"]
};
function pickGroup(t){const s=(t.title+' '+t.route+' '+(t.program||'')).toLowerCase();
  if(/санкт|петербург|петропавл|царское|эрмитаж|петергоф/.test(s)) return PHOTO_GROUPS.spb;
  if(/москв|кремл|заряд|вднх|кремлевск/.test(s)) return PHOTO_GROUPS.moscow;
  if(/казан|йошкар/.test(s)) return PHOTO_GROUPS.kazan;
  if(/эльбрус|кавказ|кисловод|пятигор|домба|чегем|осети|ингуш|чечн/.test(s)) return PHOTO_GROUPS.caucasus;
  if(/дагест|сул[а-я]*к|дербент/.test(s)) return PHOTO_GROUPS.dagestan;
  if(/сочи|абхаз|красн[а-я]* полян|роза хутор/.test(s)) return PHOTO_GROUPS.sochi;
  if(/минск|беларус/.test(s)) return PHOTO_GROUPS.belarus;
  if(/карели|рускеал|кивач|петрозавод/.test(s)) return PHOTO_GROUPS.karelia;
  if(/театр|цирк|шоу|ёлк|балет|спектакл|на[вв]к|ледов/.test(s)) return PHOTO_GROUPS.theater;
  if(/семейн|детск|ферм|хаск|резиденц|зоопарк/.test(s)) return PHOTO_GROUPS.family;
  if(/усад|тархан|болдин|беков|дворц|храм|монастыр|дивеев|нижн/.test(s)) return PHOTO_GROUPS.heritage;
  return PHOTO_GROUPS.city;
}
const photoFor=t=>{const g=pickGroup(t);return PHOTOS[g[t.id % g.length]]||"";};
const $=s=>document.querySelector(s), nf=new Intl.NumberFormat('ru-RU');let period='holiday';
const themes={city:'Города и история',nature:'Горы и природа',show:'Театры и шоу',family:'Семейные поездки'};
const illustrations={city:'<path d="M0 110V85h22V57h28v28h14V42h18V20h13v22h18v43h12V54h28v56Z" fill="white"/><path d="M87 9v14m-7-7h14" stroke="white" stroke-width="2"/><g fill="#17668b"><path d="M29 65h7v12h-7zm43-12h7v13h-7zm22 0h7v13h-7zm39 10h7v13h-7z"/></g>',nature:'<path d="M0 110L45 46l29 37 40-73 46 100Z" fill="white"/><path d="M114 10L94 46l20-8 16 9zM45 46L30 67l15-5 13 6z" fill="#c3e9f3"/><path d="M0 110L40 85l45 15 45-20 30 30Z" fill="#175c78"/>',show:'<path d="M27 12h108v95H27Z" fill="white" opacity=".23"/><path d="M27 12h108v95H27Z" stroke="white" fill="none" stroke-width="4"/><path d="M27 12q40 25 16 95h-16ZM135 12q-40 25-16 95h16Z" fill="white"/><path d="M82 35l5 14 15 1-12 9 4 15-12-9-12 9 4-15-12-9 15-1Z" fill="#fff"/>',family:'<path d="M15 110h145v-8H15Z" fill="white"/><path d="M105 18l-23 38h14l-29 39h76l-29-39h14Z" fill="white"/><path d="M36 49l-19 28h10L10 99h52L45 77h10Z" fill="white"/><circle cx="64" cy="28" r="5" fill="white"/><circle cx="142" cy="25" r="4" fill="white"/>'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dateOrder(t){return(t.month==='dec'?0:100)+Number(t.date.match(/^\d+/)[0])}
function render(){const q=$('#search').value.trim().toLowerCase(),theme=$('#theme').value,sort=$('#sort').value;const labels={dec:['Декабрь 2026','Все отправления в декабре, включая новогодние выезды'],holiday:['Новогодние праздники','Выезды с 30 декабря по 10 января'],jan:['Январь 2027','Все отправления в январе, включая праздничные выезды']};$('#heading').textContent=labels[period][0];$('#subtitle').textContent=labels[period][1];$('#janNote').classList.toggle('hidden',period!=='jan');document.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.period===period;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});let a=tours.filter(t=>(period==='holiday'?t.holiday:t.month===period)&&(theme==='all'||t.theme===theme)&&(!q||(t.title+' '+t.route+' '+t.description+' '+t.date+' '+t.itinerary.join(' ')).toLowerCase().includes(q)));a.sort((x,y)=>sort==='priceAsc'?x.price-y.price:sort==='priceDesc'?y.price-x.price:dateOrder(x)-dateOrder(y));$('#count').textContent='Найдено: '+a.length;$('#grid').innerHTML=a.length?a.map(t=>`<article class="tour"><div class="visual ${t.theme}">${photoFor(t)?`<img class="tour-photo" alt="Иллюстрация направления" src="${photoFor(t)}" loading="lazy">`:`<svg viewBox="0 0 160 120" aria-hidden="true">${illustrations[t.theme]}</svg>`}<div class="visual-shade"></div><div class="tag">${themes[t.theme]}</div><div class="date">${esc(t.date)}</div></div><div class="cardbody"><h3>${esc(t.title)}</h3><p class="route">${esc(t.route)}</p><p class="description">${esc(t.program||t.extra||'Экскурсионная программа по указанному маршруту.')}</p><div class="bottom"><div class="price">от ${nf.format(t.price)} ₽<small>за человека</small></div><button class="more" type="button" data-id="${t.id}" aria-label="Подробнее: ${esc(t.title)}">Подробнее</button></div></div></article>`).join(''):'<div class="empty">По вашему запросу туров не найдено. Измените фильтр или свяжитесь с менеджером.</div>'}
let current=null;let selectedTour=null;function show(t){current=t;selectedTour=t;const photo=photoFor(t);$('#detailPhoto').classList.toggle('hidden',!photo);if(photo)$('#detailPhoto').src=photo;else $('#detailPhoto').removeAttribute('src');$('#book').href='/request?bus_tour='+encodeURIComponent(t.id);$('#detailTitle').textContent=t.title;$('#detailDate').textContent='Дата выезда: '+t.date;$('#detailRoute').textContent=t.route;$('#detailDeparture').textContent=t.departure;$('#detailProgram').innerHTML=t.itinerary.map(x=>'<li>'+esc(x)+'</li>').join('');$('#detailIncluded').textContent=t.included;$('#detailExtra').textContent=t.optional;$('#optionalSection').classList.toggle('hidden',!t.optional);$('#detailWarning').classList.toggle('hidden',!t.uncertain);$('#detailPrice').textContent='от '+nf.format(t.price)+' ₽';$('#copy').textContent='Скопировать тур';$('#details').showModal()}
$('.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-period]');if(b){period=b.dataset.period;render()}});$('#search').addEventListener('input',render);$('#theme').addEventListener('change',render);$('#sort').addEventListener('change',render);$('#grid').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)show(tours.find(t=>t.id===Number(b.dataset.id)))});$('#close').onclick=()=>$('#details').close();$('#details').addEventListener('click',e=>{if(e.target===$('#details'))$('#details').close()});$('#copy').onclick=async()=>{if(!current)return;let text=`${current.title}\nВыезд: ${current.date}\n${current.route}\n${current.itinerary.join("\n")}\nВ стоимость входит: ${current.included}\n${current.optional ? "Дополнительно: "+current.optional+"\n" : ""}от ${nf.format(current.price)} ₽/чел.\nСлетать.ру, Пенза · 8 950 230-25-55`;try{await navigator.clipboard.writeText(text);$('#copy').textContent='Скопировано'}catch{let a=document.createElement('textarea');a.value=text;$('#details').append(a);a.select();try{if(document.execCommand('copy')){$('#copy').textContent='Скопировано';a.remove()}else{a.setAttribute('aria-label','Текст для копирования')}}catch{a.setAttribute('aria-label','Текст для копирования')}}};render();
}).catch(()=>{document.querySelector('#grid').innerHTML='<div class="empty">Не удалось загрузить туры. Обновите страницу или <a href="/request">оставьте заявку на подбор</a>.</div>';document.querySelector('#count').textContent='';});
