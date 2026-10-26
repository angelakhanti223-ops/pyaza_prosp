// Static trusted markup from the supplied calculator; React owns the surrounding page.
export const chinaTourBuilderMarkup = String.raw`
<div class="bar" id="bar"><div><div class="note">Предварительно на двоих</div><div class="sum num" id="barSum">Считаем…</div></div><a class="btn solid" href="#est">Смета</a></div>
  <nav class="tabs" role="tablist" aria-label="Разделы">
    <button type="button" role="tab" id="tab-btn-build" aria-controls="tab-build" data-tab="build">Собрать тур самостоятельно</button>
    <button type="button" role="tab" id="tab-btn-ready" aria-controls="tab-ready" data-tab="ready">Готовые туры</button>
  </nav>
  <nav class="presets" aria-label="Быстрая навигация" style="margin:-8px 0 24px;gap:10px"><a class="chip" href="#tab-build" data-tab-link="build">Конструктор</a><a class="chip" href="#tab-ready" data-tab-link="ready">Готовые программы</a><a class="chip" href="#excursions">Экскурсии</a><a class="chip" href="#know">Перед поездкой</a><a class="chip" href="#china-request" data-act="tolead">Оставить заявку</a></nav>

  <section id="tab-ready" role="tabpanel" aria-labelledby="tab-btn-ready" hidden>
    <div class="row" style="margin-bottom:14px">
      <div style="min-width:0;flex:1 1 360px"><p class="lead" style="margin:0">Готовые программы с русскоязычным гидом, проверенными отелями и продуманным маршрутом.</p>
      <p class="per1">Все цены указаны за 1 человека</p></div>
      <div class="seg" role="group" aria-label="Фильтр туров" id="readyFilter">
        <button type="button" data-f="all" id="rf-all">Все</button>
        <button type="button" data-f="avatar" id="rf-avatar">Горы Аватар</button>
        <button type="button" data-f="city" id="rf-city">Города</button>
        <button type="button" data-f="sea" id="rf-sea">Город + море</button>
      </div>
    </div>
    <div class="cards" id="readyList"></div>
  </section>

  <div class="grid" id="tab-build" role="tabpanel" aria-labelledby="tab-btn-build">
    <div>
      <p id="restoreNotice" class="saved-notice" role="status" hidden></p>
      <p class="calc-basis note">Расчёт на <strong>2 взрослых в одном номере</strong>, с вылетом из Москвы. Для другого состава туристов укажите пожелания в заявке — рассчитаем отдельно. Итог здесь ориентировочный, наличие и тарифы подтвердит менеджер.</p>
      <div class="presets" id="presets" style="margin-bottom:22px">
        <span>Быстрый старт:</span>
      </div>
      <div class="row" style="margin-bottom:12px">
        <label class="month" for="month"><span>Месяц поездки</span>
          <select id="month"></select></label>
        <p class="note" id="holiday" style="margin:0;flex:1 1 260px" hidden></p>
      </div>
      <div class="row">
        <h2>Маршрут</h2>
        <button type="button" class="btn" data-act="simplify">Оставить Пекин и Шанхай</button>
        <div class="seg" role="group" aria-label="Перелёт из Москвы" id="intlSeg">
          <button type="button" data-intl="direct" id="intl-direct">Прямые рейсы</button>
          <button type="button" data-intl="transfer" id="intl-transfer">С пересадками</button>
        </div>
      </div>
      <p class="note" style="margin-top:12px">Уберите ненужные остановки кнопкой «Убрать город». Отели, экскурсии и переезды автоматически пересчитаются для оставшегося маршрута.</p>
      <div class="route" id="route"></div>
      <div class="add" id="addRow"></div>

      <section class="excsec" id="excursions"></section>

      <div class="excursion-cta" id="excursion-cta"></div>

      <section class="extras panel" id="extras"></section>


    </div>

    <aside class="est panel" id="est" aria-label="Предварительная смета тура"></aside>
  </div>

<section class="know" id="know" aria-labelledby="know-h"></section>
`;
