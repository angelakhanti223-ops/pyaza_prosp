import { BookOpen, Check, ChevronRight, FileText, Flower2, Landmark, Newspaper, Sparkles, Target, TrendingUp } from "lucide-react";
import type { OfficeGoalActivity, OfficeGoalsData } from "@/lib/officeGoalsApi";
import type { ManagementDashboardData } from "@/lib/managementDashboardApi";
import { formatConversionPercent } from "@/lib/managementConversion";
import type { ReactNode } from "react";
import ManagerConversion from "./ManagerConversion";
import { CONVERSION_RULE } from "@/lib/managementConversion";

const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
const number = (v: number) => new Intl.NumberFormat("ru-RU").format(v);
const progress = (actual: number | null, target: number) => actual === null || target <= 0 ? null : Math.round(actual / target * 100);
const tones = {
  blue: { ink: "#4479C1", light: "#EDF4FF", line: "#7CA8E5" },
  peach: { ink: "#B96742", light: "#FFF2E9", line: "#E9AD89" },
  green: { ink: "#418772", light: "#ECF7F0", line: "#7CBBA1" },
  violet: { ink: "#8670B5", light: "#F3EFFB", line: "#B7A4DB" },
};
type Tone = keyof typeof tones;

function Bar({ value, color }: { value: number | null; color: string }) {
  return <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%`, background: color }} /></div>;
}

function Metric({ title, actual, target, formatter = number, tone, note }: { title: string; actual: number | null; target: number; formatter?: (v: number) => string; tone: Tone; note: string }) {
  const pct = progress(actual, target); const colors = tones[tone];
  return <article className="min-w-0 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_24px_#23334d04]">
    <div className="flex items-start justify-between gap-2"><h2 className="text-sm font-medium leading-5 text-slate-500">{title}</h2><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors.line }} /></div>
    <p className="mt-4 break-words text-2xl font-semibold tracking-tight text-slate-800">{actual === null ? "—" : formatter(actual)}</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs"><span className="text-slate-500">План {formatter(target)}</span><span className="font-medium" style={{ color: colors.ink }}>{pct === null ? "Нет факта" : `${pct}%`}</span></div>
    <Bar value={pct} color={colors.line} /><p className="mt-3 text-xs leading-5 text-slate-400">{note}</p>
  </article>;
}

function CheckRow({ goal, saving, onToggle, compact = false }: { goal: OfficeGoalActivity; saving: boolean; onToggle: (id: string, checked: boolean) => void; compact?: boolean }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-3 transition-colors ${goal.completed ? "bg-emerald-50/70" : "hover:bg-slate-50"}`}>
    <input type="checkbox" checked={goal.completed} disabled={saving} onChange={e => onToggle(goal.id, e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded-md accent-[#6A9BCE]" />
    <span className="min-w-0"><span className={`block text-sm font-medium ${goal.completed ? "text-emerald-800" : "text-slate-700"}`}>{goal.title}</span>{!compact && <span className="mt-1 block text-xs leading-5 text-slate-400">{goal.target}{goal.note ? `. ${goal.note}` : ""}</span>}</span>
    {goal.completed && <Check size={15} className="ml-auto mt-1 shrink-0 text-emerald-500" />}
  </label>;
}

function Checklist({ title, caption, icon, goals, tone, saving, onToggle, compact, children }: { title: string; caption?: string; icon: ReactNode; goals: OfficeGoalActivity[]; tone: Tone; saving: boolean; onToggle: (id: string, checked: boolean) => void; compact?: boolean; children?: ReactNode }) {
  if (!goals.length) return null;
  const done = goals.filter(g => g.completed).length; const colors = tones[tone];
  return <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6">
    <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ color: colors.ink, background: colors.light }}>{icon}</span><div className="min-w-0 flex-1"><h2 className="font-semibold text-slate-800">{title}</h2>{caption && <p className="mt-0.5 text-xs text-slate-400">{caption}</p>}</div><span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: colors.ink, background: colors.light }}>{done} / {goals.length}</span></div>
    <div className="space-y-1">{goals.map(goal => <CheckRow key={goal.id} goal={goal} saving={saving} onToggle={onToggle} compact={compact} />)}</div>{children}
  </section>;
}

export type OfficeGoalsBoardProps = {
  month: number; goals: OfficeGoalsData | null; data: ManagementDashboardData | null;
  loading: boolean; saving: boolean; receipts: string; error: string; saveMessage: string;
  onMonth: (month: number) => void; onReceipts: (value: string) => void; onSaveReceipts: () => void;
  onToggle: (id: string, checked: boolean) => void; onRetry: () => void;
};

export default function OfficeGoalsBoard(p: OfficeGoalsBoardProps) {
  const g = p.goals; const target = g?.targets; const period = p.month === 10 ? "Октябрь 2026" : "Ноябрь 2026";
  const activities = g?.activities.filter(a => a.category !== "operators") ?? [];
  const articles = activities.filter(a => a.id.startsWith("article-"));
  const cards = activities.filter(a => a.id.startsWith("card-"));
  const learning = activities.filter(a => ["thailand-katya", "maldives-elena", "mauritius-elena"].includes(a.id));
  const grouped = new Set([...articles, ...cards, ...learning].map(a => a.id));
  const office = activities.filter(a => !grouped.has(a.id) && a.category !== "social" && a.category !== "control");
  const done = activities.filter(a => a.completed).length;
  const checkboxProps = { saving: p.saving, onToggle: p.onToggle };
  return <div className="-m-2 rounded-[32px] bg-[#F8FAFD] p-3 text-slate-700 sm:p-5">
    <header className="relative overflow-hidden rounded-[28px] border border-white bg-gradient-to-r from-[#EEF5FF] via-[#FBFAFE] to-[#FFF3E9] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-[#788BA5]"><Sparkles size={15} /> Слетать.ру · команда в Пензе</div><h1 className="text-3xl font-semibold tracking-tight text-[#34445F] sm:text-4xl">Цели команды</h1><p className="mt-2 text-sm text-[#8896AA]">{period}{g ? ` · ${done} из ${activities.length} задач отмечено` : ""}</p></div>
        <div role="group" aria-label="Месяц целей" className="inline-flex rounded-2xl border border-white bg-white/60 p-1">{[10, 11].map(month => <button key={month} type="button" disabled={p.saving} aria-pressed={p.month === month} onClick={() => p.onMonth(month)} className={`rounded-xl px-4 py-2.5 text-sm transition-colors ${p.month === month ? "bg-white font-semibold text-[#557EAF] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>{month === 10 ? "Октябрь" : "Ноябрь"}</button>)}</div>
      </div>
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-[#8493A9]"><a href="/crm/dashboard" className="inline-flex items-center gap-1 hover:text-slate-700">График смен <ChevronRight size={13} /></a><a href="/crm/management-dashboard" className="inline-flex items-center gap-1 hover:text-slate-700">Все показатели <ChevronRight size={13} /></a><span className="ml-auto inline-flex items-center gap-1.5" role="status" aria-live="polite">{p.saving ? "Сохраняем…" : p.saveMessage}</span></div>
    </header>
    {p.error && <div role="alert" className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm text-rose-700">{p.error}<button type="button" onClick={p.onRetry} className="ml-3 underline">Обновить</button></div>}
    {p.loading && !g && <div role="status" className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[1,2,3,4,5].map(i => <div key={i} className="h-44 animate-pulse rounded-3xl bg-white" />)}<span className="sr-only">Загружаем цели и показатели</span></div>}
    {g && target && <>
      <div className="mb-3 mt-7 flex items-center gap-2 text-sm font-semibold text-slate-600"><TrendingUp size={17} className="text-[#8CAACE]" /> План и факт <span className="ml-auto text-xs font-normal text-slate-400">{period}</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Стоимость туров" actual={p.data?.money.deal_amount_total ?? null} target={target.turnover} formatter={money} tone="blue" note="Полная стоимость проданных туров" />
        <Metric title={g.commission_basis === "cash_receipts" ? "Поступило комиссии" : "Комиссия"} actual={g.commission_basis === "cash_receipts" ? g.commission_receipts_actual : (p.data?.money.commission_total ?? null)} target={target.receipts} formatter={money} tone="peach" note={g.commission_basis === "cash_receipts" ? "По фактическим поступлениям" : "По данным заявок"} />
        <Metric title="Новые обращения" actual={p.data?.conversion.incoming_count ?? null} target={target.leads} tone="violet" note="Все входящие за месяц" />
        <Metric title="Конверсия" actual={p.data?.conversion.percent ?? null} target={target.conversion} formatter={v => formatConversionPercent(v)} tone="green" note="Продажи месяца ÷ входящие месяца" />
        {target.commissionRate !== null && <Metric title="Комиссия с тура" actual={p.data?.money.commission_rate_percent ?? null} target={target.commissionRate} formatter={v => formatConversionPercent(v)} tone="peach" note={`По ${p.data?.money.commission_rate_deals_count ?? 0} броням с заполненными суммами в ₽`} />}
      </div>
      {g.commission_basis === "cash_receipts" && <form onSubmit={e => { e.preventDefault(); p.onSaveReceipts(); }} className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#F4E4D8] bg-[#FFFAF5] px-5 py-3"><span className="flex items-center gap-2 text-xs font-medium text-[#A17D65]"><Landmark size={15} /> Поступление комиссии за месяц</span><label className="sr-only" htmlFor="commission-receipts">Поступило комиссии, ₽</label><input id="commission-receipts" type="number" inputMode="decimal" min="0" step="0.01" value={p.receipts} onChange={e => p.onReceipts(e.target.value)} disabled={p.saving} placeholder="Введите сумму, ₽" className="min-w-0 flex-1 rounded-xl border border-[#ECDDD0] bg-white px-3 py-2 text-sm outline-none focus:border-[#C6A78D]" /><button type="submit" disabled={p.saving} className="rounded-xl bg-[#EAC7AB] px-4 py-2 text-xs font-semibold text-[#77573F] disabled:opacity-50">Сохранить</button></form>}
      {!!g.operator_progress?.length && <section className="mt-7"><div className="mb-3 flex flex-wrap items-center gap-2"><Target size={17} className="text-[#8CAACE]" /><h2 className="text-sm font-semibold text-slate-600">Бронирования у туроператоров</h2><span className="ml-auto rounded-full bg-[#EDF4FF] px-3 py-1 text-[11px] text-[#799AC2]">Рассчитываем по заявкам</span></div><div className="grid gap-4 lg:grid-cols-3">{g.operator_progress.map((row, i) => {
        const color = [tones.blue, tones.peach, tones.violet][i % 3]; const pct = progress(row.amount, row.target);
        return <article key={row.key} className="rounded-3xl border border-slate-100 bg-white p-5"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-700">{row.name}</h3><span className="rounded-lg px-2 py-1 text-xs font-medium" style={{ color: color.ink, background: color.light }}>{pct === null ? "—" : `${pct}%`}</span></div><p className="mt-5 text-2xl font-semibold tracking-tight text-slate-700">{row.amount === null ? "—" : money(row.amount)}</p><p className="mt-1 text-xs text-slate-400">из {money(row.target)} · заявок {row.bookings_count}</p><Bar value={pct} color={color.line} /><p className="mt-3 text-xs text-slate-400">{row.amount === null ? "Нужны суммы заявок" : row.amount >= row.target ? "Цель достигнута" : `До цели ${money(row.target - row.amount)}`}</p>{row.missing_count > 0 && <p className="mt-2 text-xs text-amber-700">Без суммы или курса: {row.missing_count}. Их стоимость пока не учтена.</p>}</article>;
      })}</div><p className="mt-2 text-[11px] leading-5 text-slate-400">Первое бронирование в выбранном месяце, без отменённых заявок. Эти суммы входят в общий оборот. Валютные заявки пересчитываются по сохранённому курсу оплаты.</p></section>}
      <div className="mb-3 mt-7 flex items-center gap-2 text-sm font-semibold text-slate-600"><Check size={17} className="text-[#8CAACE]" /> Задачи месяца <span className="ml-auto text-xs font-normal text-slate-400">Отметки сохраняются</span></div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Checklist title="Статьи на сайт" caption="Пять публикаций за месяц" icon={<Newspaper size={19} />} goals={articles} tone="blue" {...checkboxProps} compact><a href="/crm/articles" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#7E9EC5]">Открыть статьи <ChevronRight size={13} /></a></Checklist>
        <Checklist title="Изучаем направления" caption="Личная экспертность команды" icon={<BookOpen size={19} />} goals={learning} tone="green" {...checkboxProps} />
        <Checklist title="Развитие офиса" icon={<Flower2 size={19} />} goals={office} tone="peach" {...checkboxProps} />
        <Checklist title="Готовимся к рекламному туру" caption="Визитки на английском" icon={<FileText size={19} />} goals={cards} tone="violet" {...checkboxProps} compact />
        <Checklist title="Соцсети и аудитория" icon={<Sparkles size={19} />} goals={activities.filter(a => a.category === "social")} tone="violet" {...checkboxProps} />
        <Checklist title="Операционные задачи" icon={<Target size={19} />} goals={activities.filter(a => a.category === "control")} tone="blue" {...checkboxProps} compact />
      </div>
      {p.data && <details className="mt-4 rounded-2xl bg-white px-5 py-4"><summary className="cursor-pointer text-xs font-medium text-slate-500">Как считаем конверсию и результаты менеджеров</summary><p className="my-3 text-xs leading-5 text-slate-500">{CONVERSION_RULE}</p><ManagerConversion rows={p.data.manager_rows} office={p.data.conversion} periodLabel={period} /></details>}
    </>}
  </div>;
}
