"use client";

import { useEffect, useState } from "react";
import { Clock3, Eye, RefreshCw, TrendingUp } from "lucide-react";
import { getArticleAnalytics, getPageAnalytics, type ArticleAnalyticsNumbers, type ArticleAnalyticsReport } from "@/lib/crmApi";

type Period = { start: string; end: string };
type Metric = "views" | "time";
type AnalyticsReport = Omit<ArticleAnalyticsReport, "articles"> & {
  items: (ArticleAnalyticsNumbers & { id: string; title: string; path?: string })[];
};
const numbers = new Intl.NumberFormat("ru-RU");
const inputClass = "min-w-0 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-blue";

function today() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function shiftDate(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function lastDays(days: number): Period {
  const end = today();
  return { start: shiftDate(end, 1 - days), end };
}

export function readingTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded} с`;
  const minutes = Math.floor(rounded / 60);
  return rounded % 60 ? `${minutes} мин ${rounded % 60} с` : `${minutes} мин`;
}

function dateLabel(date: string, year = false) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", ...(year ? { year: "numeric" } : {}) });
}

function changeLabel(percent: number | null) {
  return percent === null ? "Новые просмотры" : `${percent > 0 ? "+" : ""}${numbers.format(percent)}%`;
}

function DynamicsChart({ daily, metric }: { daily: ArticleAnalyticsReport["daily"]; metric: Metric }) {
  const values = daily.map((day) => metric === "views" ? day.views : day.avg_seconds);
  const maximum = Math.max(metric === "views" ? 2 : 60, ...values.map((value) => value ?? 0));
  const max = metric === "views" ? Math.ceil(maximum / 2) * 2 : Math.ceil(maximum / 10) * 10;
  const plot = { left: 58, top: 18, width: 810, height: 180 };
  const step = plot.width / daily.length;
  const x = (index: number) => plot.left + (index + 0.5) * step;
  const y = (value: number) => plot.top + plot.height * (1 - value / max);
  const segments: string[] = [];
  let current = "";
  values.forEach((value, index) => {
    if (value === null) { if (current) segments.push(current); current = ""; }
    else current += `${current ? " L" : "M"}${x(index)},${y(value)}`;
  });
  if (current) segments.push(current);
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white p-2">
      <svg viewBox="0 0 900 246" role="img" aria-label={metric === "views" ? "Динамика просмотров по дням" : "Среднее время просмотра по дням"} className="h-60 w-full min-w-[520px]">
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line x1={plot.left} x2={868} y1={y(max * fraction)} y2={y(max * fraction)} stroke="#e7edf5" />
            <text x={49} y={y(max * fraction) + 4} textAnchor="end" fontSize="11" fill="#68778d">{metric === "views" ? numbers.format(Math.round(max * fraction)) : readingTime(max * fraction)}</text>
          </g>
        ))}
        {metric === "time" && segments.map((segment, index) => <path key={index} d={segment} fill="none" stroke="#b5842c" strokeWidth={2.5} />)}
        {daily.map((day, index) => {
          const value = values[index];
          const label = `${dateLabel(day.date, true)}: ${metric === "views" ? `${day.views} просмотров` : readingTime(day.avg_seconds)}`;
          return (
            <g key={day.date}>
              {value !== null && (metric === "views" ? (
                <rect x={x(index) - Math.max(1, step * 0.34)} y={y(value)} width={Math.max(2, step * 0.68)} height={plot.height * value / max} rx={Math.min(4, step / 4)} fill="#1a5fc8" tabIndex={0} aria-label={label}><title>{label}</title></rect>
              ) : (
                <circle cx={x(index)} cy={y(value)} r={3} fill="#b5842c" tabIndex={0} aria-label={label}><title>{label}</title></circle>
              ))}
              {(index === 0 || index === daily.length - 1 || index % Math.max(1, Math.ceil(daily.length / 6)) === 0) && <text x={x(index)} y={225} textAnchor="middle" fontSize="11" fill="#68778d">{dateLabel(day.date)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ArticleAnalytics({ scope = "articles" }: { scope?: "articles" | "pages" }) {
  const site = scope === "pages";
  const [period, setPeriod] = useState<Period>(() => lastDays(30));
  const [draft, setDraft] = useState(period);
  const [articleId, setArticleId] = useState("");
  const [metric, setMetric] = useState<Metric>("views");
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; data: AnalyticsReport | null; error: string }>({ key: "", data: null, error: "" });
  const key = `${period.start}/${period.end}/${articleId}/${refresh}`;
  const loading = result.key !== key;
  const report = !loading && !result.error ? result.data : null;
  const options = result.data?.items ?? [];

  useEffect(() => {
    let active = true;
    const request = site
      ? getPageAnalytics({ ...period, ...(articleId ? { path: articleId } : {}) }).then(data => ({ ...data, items: data.pages.map(page => ({ ...page, id: page.path })) }))
      : getArticleAnalytics({ ...period, ...(articleId ? { article_id: Number(articleId) } : {}) }).then(data => ({ ...data, items: data.articles.map(article => ({ ...article, id: String(article.id) })) }));
    request.then((data) => {
      if (active) setResult({ key, data, error: "" });
    }).catch((error: unknown) => {
      if (active) setResult((previous) => ({ key, data: previous.data, error: error instanceof TypeError ? "Нет соединения с сервером. Проверьте подключение и обновите статистику." : error instanceof Error ? error.message : "Не удалось загрузить статистику" }));
    });
    return () => { active = false; };
  }, [period, articleId, key, site]);

  const selectDays = (days: number) => {
    const next = lastDays(days);
    setDraft(next);
    setPeriod(next);
  };

  return (
    <section className="mb-8 min-w-0 rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="article-analytics-title" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="article-analytics-title" className="flex items-center gap-2 text-lg font-bold text-navy"><TrendingUp size={20} className="text-blue" />{site ? "Статистика сайта" : "Статистика статей"}</h2>
          <p className="mt-1 text-xs leading-5 text-foreground/55">{site ? "Только публичные страницы · просмотры и активное время · московское время" : "Просмотры по дням и среднее время просмотра · московское время"}</p>
        </div>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-navy hover:bg-blue-light disabled:opacity-40"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Обновить</button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Быстрый выбор периода">
        {[7, 30, 90].map((days) => <button key={days} type="button" onClick={() => selectDays(days)} aria-pressed={period.end === today() && period.start === shiftDate(today(), 1 - days)} className={`rounded-full px-4 py-2 text-xs font-semibold ${period.end === today() && period.start === shiftDate(today(), 1 - days) ? "bg-navy text-white" : "bg-blue-light text-navy"}`}>{days} дней</button>)}
      </div>
      <form className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_2fr] xl:items-end" onSubmit={(event) => { event.preventDefault(); setPeriod({ ...draft }); }}>
        <label className="grid min-w-0 gap-1 text-xs text-foreground/55">С даты<input aria-label="Начало периода" type="date" required max={draft.end || today()} value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} className={inputClass} /></label>
        <label className="grid min-w-0 gap-1 text-xs text-foreground/55">По дату<input aria-label="Конец периода" type="date" required min={draft.start} max={today()} value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} className={inputClass} /></label>
        <button type="submit" className="rounded-full bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy">Показать</button>
        <label className="grid min-w-0 gap-1 text-xs text-foreground/55"> {site ? "Страница" : "Статья"}<select aria-label={site ? "Выбрать страницу для статистики" : "Выбрать статью для статистики"} value={articleId} onChange={(event) => setArticleId(event.target.value)} className={inputClass}><option value="">{site ? "Все публичные страницы" : "Все статьи"}</option>{options.map((article) => <option key={article.id} value={article.id}>{article.title}{article.path ? ` · ${article.path}` : ""}</option>)}</select></label>
      </form>

      {loading && <div className="flex min-h-72 items-center justify-center text-sm text-foreground/50" role="status">Загружаем статистику…</div>}
      {!loading && result.error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700" role="alert">{result.error}<button type="button" className="ml-3 underline" onClick={() => setRefresh((value) => value + 1)}>Попробовать ещё раз</button></div>}
      {report && <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-blue-light/65 p-4"><p className="flex items-center gap-1.5 text-xs text-foreground/55"><Eye size={14} />Просмотры за период</p><p className="mt-2 text-3xl font-bold text-navy" data-testid="period-views">{numbers.format(report.totals.views)}</p><p className="mt-1 text-[11px] text-foreground/45">{dateLabel(report.period.start)} — {dateLabel(report.period.end, true)}</p></div>
          <div className="rounded-2xl bg-blue-light/65 p-4"><p className="text-xs text-foreground/55">К предыдущему периоду</p><p className={`mt-2 text-2xl font-bold ${report.totals.change_percent !== null && report.totals.change_percent < 0 ? "text-amber-700" : "text-navy"}`}>{changeLabel(report.totals.change_percent)}</p><p className="mt-1 text-[11px] text-foreground/45">Было {numbers.format(report.totals.previous_views)} · {dateLabel(report.period.previous_start)} — {dateLabel(report.period.previous_end)}</p></div>
          <div className="rounded-2xl bg-[#fbf7ed] p-4"><p className="flex items-center gap-1.5 text-xs text-foreground/55"><Clock3 size={14} />Среднее время просмотра</p><p className="mt-2 text-2xl font-bold text-navy" data-testid="average-time">{readingTime(report.totals.avg_seconds)}</p><p className="mt-1 text-[11px] text-foreground/45">С измерением: {numbers.format(report.totals.measured_views)} из {numbers.format(report.totals.views)} просмотров</p></div>
          <div className="rounded-2xl bg-blue-light/65 p-4"><p className="text-xs text-foreground/55">Всего просмотров</p><p className="mt-2 text-3xl font-bold text-navy">{numbers.format(report.totals.all_time_views)}</p><p className="mt-1 text-[11px] text-foreground/45">{site ? "С начала сбора статистики всех страниц" : "Включая исторический счётчик"}</p></div>
        </div>

        {report.totals.views === 0 && <p className="mt-4 rounded-xl bg-blue-light/60 p-3 text-xs leading-5 text-foreground/65">{site ? "За выбранный период новых измерений нет. Динамика и время появятся после посещений публичных страниц. Прежняя статистика статей доступна в разделе «Статьи»." : "За выбранный период новых измерений нет. Динамика и время появятся после просмотров статей на сайте; старые общие просмотры сохранены."}</p>}
        <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-navy">Динамика по дням</h3>
          <div className="flex gap-1 rounded-full bg-blue-light p-1" aria-label="Показатель графика">
            <button type="button" onClick={() => setMetric("views")} aria-pressed={metric === "views"} className={`rounded-full px-3 py-1.5 text-xs ${metric === "views" ? "bg-white font-semibold text-blue shadow-sm" : "text-foreground/55"}`}>Просмотры</button>
            <button type="button" onClick={() => setMetric("time")} aria-pressed={metric === "time"} className={`rounded-full px-3 py-1.5 text-xs ${metric === "time" ? "bg-white font-semibold text-blue shadow-sm" : "text-foreground/55"}`}>Время просмотра</button>
          </div>
        </div>
        <DynamicsChart daily={report.daily} metric={metric} />
        <p className="mt-2 text-[11px] leading-5 text-foreground/50">Время считается, пока вкладка {site ? "со страницей" : "со статьёй"} видима и активна. Прочерк означает отсутствие измерений, а 0 с — короткий просмотр. Дни без измерений времени на графике не соединяются.</p>

        <details className="mt-5 border-t border-black/5 pt-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-navy">{site ? "Показатели по страницам" : "Показатели по статьям"}</summary>
          <div className="mt-3 overflow-x-auto rounded-xl border border-black/5">
            <table className="w-full min-w-[720px] text-left text-xs">
              <caption className="sr-only">{site ? "Просмотры и время просмотра каждой публичной страницы за выбранный период" : "Просмотры и время просмотра каждой статьи за выбранный период"}</caption>
              <thead className="bg-blue-light/50 text-foreground/55"><tr><th className="px-3 py-3 font-medium">{site ? "Страница" : "Статья"}</th><th className="px-3 py-3 font-medium">За период</th><th className="px-3 py-3 font-medium">Изменение</th><th className="px-3 py-3 font-medium">Среднее время</th><th className="px-3 py-3 font-medium">С измерением</th><th className="px-3 py-3 font-medium">Всего</th></tr></thead>
              <tbody>{report.items.filter((article) => !articleId || article.id === articleId).map((article) => <tr key={article.id} className="border-t border-black/5"><td className="max-w-xs px-3 py-3"><button type="button" onClick={() => setArticleId(String(article.id))} className="text-left font-medium text-blue hover:underline">{article.title}</button>{article.path && <p className="mt-1 break-all text-[11px] text-foreground/45">{article.path}</p>}</td><td className="px-3 py-3 font-semibold text-navy">{numbers.format(article.views)}</td><td className="px-3 py-3 text-foreground/60">{changeLabel(article.change_percent)}</td><td className="whitespace-nowrap px-3 py-3 text-navy">{readingTime(article.avg_seconds)}</td><td className="px-3 py-3 text-foreground/60">{article.measured_views} / {article.views}</td><td className="px-3 py-3 text-foreground/60">{numbers.format(article.all_time_views)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
        <details className="mt-4 text-[11px] leading-5 text-foreground/50"><summary className="cursor-pointer">Данные графика в таблице</summary><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th>Дата</th><th>Просмотры</th><th>Среднее время</th></tr></thead><tbody>{report.daily.map((day) => <tr key={day.date}><td>{dateLabel(day.date, true)}</td><td>{day.views}</td><td>{readingTime(day.avg_seconds)}</td></tr>)}</tbody></table></div></details>
        <p className="mt-4 text-[11px] leading-5 text-foreground/45">{report.first_recorded_at ? `Новые данные собираются с ${new Date(report.first_recorded_at).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}. ` : "Новый сбор статистики ещё не получил просмотров. "}{site ? "CRM, админка, API и анкеты кандидатов исключены. Просмотры считаются по открытиям страниц, а не по уникальным людям. Старые счётчики статей показаны отдельно в разделе «Статьи»." : "Исторические просмотры нельзя распределить по датам или восстановить их длительность."} Обновлено: {new Date(report.generated_at).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" })}.</p>
      </>}
    </section>
  );
}
