"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { fetchManagementDashboard, type ManagementDashboardData } from "@/lib/managementDashboardApi";
import { CONVERSION_RULE, conversionExplanation, formatConversionPercent } from "@/lib/managementConversion";
import { fetchOfficeGoals, updateOfficeGoals, type OfficeGoalActivity, type OfficeGoalsData } from "@/lib/officeGoalsApi";
import ManagerConversion from "@/components/crm/ManagerConversion";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0) + " ₽";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value || 0);
}

function percent(value: number, target: number): number {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "gold" | "green" | "red" | "navy" }) {
  const fillClass =
    tone === "gold" ? "bg-gold" : tone === "green" ? "bg-emerald-500" : tone === "red" ? "bg-red-500" : tone === "navy" ? "bg-navy" : "bg-blue";
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-light">
      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

function KpiCard({
  title,
  actual,
  target,
  subtitle,
  formatter = formatNumber,
  tone = "blue",
}: {
  title: string;
  actual: number | null;
  target: number;
  subtitle: string;
  formatter?: (value: number) => string;
  tone?: "blue" | "gold" | "green" | "red" | "navy";
}) {
  const progress = actual === null ? null : percent(actual, target);
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">{title}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-navy">{actual === null ? "—" : formatter(actual)}</p>
          <p className="mt-1 text-xs text-foreground/45">цель: {formatter(target)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${progress !== null && progress >= 100 ? "bg-emerald-50 text-emerald-700" : "bg-blue-light text-navy"}`}>
          {progress === null ? "Нет расчёта" : `Выполнение цели: ${progress}%`}
        </span>
      </div>
      <ProgressBar value={progress ?? 0} tone={progress !== null && progress >= 100 ? "green" : tone} />
      <p className="mt-3 min-h-9 text-xs leading-5 text-foreground/55">{subtitle}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white/70 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-navy">{title}</h2>
        {subtitle && <p className="mt-1 text-sm leading-6 text-foreground/50">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function GoalCheckbox({ goal, disabled, onChange }: { goal: OfficeGoalActivity; disabled: boolean; onChange: (id: string, completed: boolean) => void }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-3xl border p-5 shadow-sm ${goal.completed ? "border-emerald-200 bg-emerald-50" : "border-black/5 bg-white"}`}>
    <input type="checkbox" checked={goal.completed} disabled={disabled} onChange={event => onChange(goal.id, event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#17365d]" />
    <span className="min-w-0"><span className="block font-semibold text-navy">{goal.title}</span><span className="mt-2 block text-sm text-foreground/80">{goal.target}</span><span className="mt-3 block text-xs leading-5 text-foreground/55">{goal.note}</span><span className="mt-2 block text-xs font-semibold text-navy">{goal.completed ? "Выполнено" : "Ещё не отмечено"}</span></span>
  </label>;
}

export default function OfficeGoalsPage() {
  const [selectedMonth, setSelectedMonth] = useState(11);
  const month = useMemo(() => ({ year: 2026, month: selectedMonth }), [selectedMonth]);
  const monthName = selectedMonth === 10 ? "октябрь" : "ноябрь";
  const monthLabel = selectedMonth === 10 ? "Октябрь 2026" : "Ноябрь 2026";
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [receipts, setReceipts] = useState("");
  const [goals, setGoals] = useState<OfficeGoalsData | null>(null);
  const [planError, setPlanError] = useState("");
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const actualsRequest = fetchManagementDashboard("custom_month", month)
      .then((result) => {
        // An older server may ignore year/month; reject mismatched actuals.
        if (!result.period.from.startsWith(`2026-${selectedMonth}-01`) || !result.period.to.startsWith(`2026-${selectedMonth}-${new Date(2026, selectedMonth, 0).getDate()}`)) {
          throw new Error("Факт за выбранный месяц пока недоступен. План показан отдельно.");
        }
        if (active) setData(result);
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Не удалось загрузить факт выбранного месяца"); });
    const goalsRequest = fetchOfficeGoals(month)
      .then(result => { if (active) { setGoals(result); setReceipts(result.commission_receipts_actual === null ? "" : String(result.commission_receipts_actual)); } })
      .catch(err => { if (active) setPlanError(err instanceof Error ? err.message : "Не удалось загрузить цели выбранного месяца"); });
    Promise.all([actualsRequest, goalsRequest]).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry, month, selectedMonth]);

  const actuals = useMemo(() => ({
    leads: data?.conversion.incoming_count ?? null,
    conversion: data?.conversion.percent ?? null,
    dealAmount: data?.money.deal_amount_total ?? null,
    commissionRate: data?.money.commission_rate_percent ?? null,
  }), [data]);

  async function saveChange(values: Parameters<typeof updateOfficeGoals>[1]) {
    if (saving) return;
    setSaving(true); setSaveMessage(""); setSaveError("");
    try { setGoals(await updateOfficeGoals(month, values)); setSaveMessage("Изменения сохранены"); }
    catch (err) { setSaveError(err instanceof Error ? err.message : "Не удалось сохранить изменения"); }
    finally { setSaving(false); }
  }

  const checkbox = (goal: OfficeGoalActivity) => <GoalCheckbox key={goal.id} goal={goal} disabled={saving} onChange={(id, completed) => { void saveChange({ activity_id: id, completed }); }} />;
  const targets = goals?.targets;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[32px] border border-black/5 bg-gradient-to-br from-navy via-blue to-gold/80 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Офис · {monthName} 2026</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Цели офиса на {monthName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">Продажи, комиссия, развитие направлений и задачи команды. План и факт за выбранный месяц.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/crm/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25">График смен <CalendarDays size={15} /></Link>
            <Link href="/crm/management-dashboard" className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25">Управленческий дашборд <ArrowRight size={15} /></Link>
          </div>
        </div>
      </div>

      <label className="flex flex-wrap items-center gap-3 text-sm font-semibold text-navy">Месяц
        <select aria-label="Месяц целей" value={selectedMonth} disabled={saving} onChange={event => {
          setSelectedMonth(Number(event.target.value)); setGoals(null); setData(null); setError(""); setPlanError(""); setSaveError(""); setSaveMessage(""); setLoading(true); setReceipts("");
        }} className="rounded-xl border border-black/15 bg-white px-4 py-3">
          <option value={10}>Октябрь 2026</option><option value={11}>Ноябрь 2026</option>
        </select>
      </label>

      {planError && <div role="alert" className="rounded-3xl bg-red-50 p-5 text-sm text-red-700">{planError}<button type="button" className="ml-3 underline" onClick={() => { setPlanError(""); setError(""); setData(null); setLoading(true); setRetry(value => value + 1); }}>Повторить</button></div>}
      {error && <div role="alert" className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}<button type="button" onClick={() => { setError(""); setData(null); setLoading(true); setRetry(value => value + 1); }} className="ml-3 font-semibold underline">Повторить</button></div>}
      {loading && <p role="status" className="text-sm text-foreground/50">Загружаем план и факт за выбранный месяц…</p>}

      {saveError && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{saveError}</div>}
      <p role="status" aria-live="polite" className="text-sm text-foreground/55">{saving ? "Сохраняем…" : saveMessage}</p>
      {goals && targets && <>
      <Section title={`Главные KPI: ${monthLabel}`} subtitle="Цели и фактические показатели относятся к выбранному месяцу.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard title="Стоимость туров" actual={actuals.dealAmount} target={targets.turnover} formatter={formatMoney} tone="navy" subtitle="Полная стоимость туров, впервые перешедших в предоплату, оплату или успешную продажу в выбранном месяце." />
          <KpiCard title="Лиды" actual={actuals.leads} target={targets.leads} subtitle="Все входящие обращения, созданные в CRM за выбранный месяц." />
          <KpiCard title="Конверсия" actual={actuals.conversion} target={targets.conversion} formatter={formatConversionPercent} tone="green" subtitle={data ? conversionExplanation(data.conversion) : "Продажи периода ÷ все входящие периода × 100%."} />
          <KpiCard title={goals.commission_basis === "cash_receipts" ? "Поступление комиссии" : "Комиссия"} actual={goals.commission_basis === "cash_receipts" ? goals.commission_receipts_actual : (data?.money.commission_total ?? null)} target={targets.receipts} formatter={formatMoney} tone="gold" subtitle={goals.commission_basis === "cash_receipts" ? "Факт заполняется отдельно по подтверждённым поступлениям; полная комиссия по брони его не заменяет." : "Октябрьская цель по комиссии офиса. Сохранён прежний расчёт по данным управленческого дашборда."} />
          {targets.commissionRate !== null && <KpiCard title="Комиссия с новых бронирований" actual={actuals.commissionRate} target={targets.commissionRate} formatter={formatConversionPercent} tone="gold" subtitle={`Цель — ${formatConversionPercent(targets.commissionRate)} от полной стоимости туров. Факт: сумма комиссии ÷ сумма стоимости тех же туров. Расчёт по ${data?.money.commission_rate_deals_count ?? 0} бронированиям с заполненными суммами в рублях.`} />}
        </div>
        <p className="mt-4 text-xs leading-5 text-foreground/55">{CONVERSION_RULE}</p>
        {targets.commissionRate !== null && <p className="mt-2 text-xs leading-5 text-foreground/55">При обороте {formatMoney(targets.turnover)} комиссия {formatConversionPercent(targets.commissionRate)} составит {formatMoney(targets.turnover * targets.commissionRate / 100)} по полным суммам бронирований. План поступления {formatMoney(targets.receipts)} учитывается отдельно: большинство заявок оплачиваются частями.</p>}
      </Section>

      {goals.commission_basis === "cash_receipts" && <Section title="Фактическое поступление комиссии" subtitle="Укажите накопленную сумму поступлений за ноябрь. Пустое поле означает, что факт ещё не внесён.">
        <form onSubmit={event => { event.preventDefault(); void saveChange({ commission_receipts_actual: receipts === "" ? null : receipts }); }} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-sm text-navy">Поступило за ноябрь, ₽<input type="number" inputMode="decimal" min="0" step="0.01" value={receipts} onChange={event => setReceipts(event.target.value)} disabled={saving} className="rounded-xl border border-black/15 bg-white px-4 py-3" /></label>
          <button type="submit" disabled={saving} className="rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Сохранить сумму</button>
        </form>
      </Section>}

      {!loading && !error && data && <ManagerConversion rows={data.manager_rows} office={data.conversion} periodLabel={monthLabel} />}

      {goals.activities.some(goal => goal.category === "operators") && <Section title="Бронирования у туроператоров" subtitle={`Эти суммы входят в общий план продаж ${formatMoney(targets.turnover)}.`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.activities.filter(goal => goal.category === "operators").map(checkbox)}
        </div>
      </Section>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Команда, обучение и мероприятия">
          <div className="grid grid-cols-1 gap-4">{goals.activities.filter(goal => goal.category === "development").map(checkbox)}</div>
        </Section>
        <Section title="Сайт, CRM и рекламные материалы">
          <div className="grid grid-cols-1 gap-4">{goals.activities.filter(goal => goal.category === "product").map(checkbox)}</div>
        </Section>
      </div>

      {goals.activities.some(goal => goal.category === "social") && <Section title="Соцсети и входящий поток"><div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{goals.activities.filter(goal => goal.category === "social").map(checkbox)}</div></Section>}
      {goals.activities.some(goal => goal.category === "control") && <Section title="Операционный чек-лист"><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{goals.activities.filter(goal => goal.category === "control").map(checkbox)}</div></Section>}
      </>}
    </div>
  );
}
