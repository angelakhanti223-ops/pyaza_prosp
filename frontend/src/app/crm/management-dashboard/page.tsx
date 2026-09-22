"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Gauge,
  Megaphone,
  Plane,
  WalletCards,
} from "lucide-react";
import {
  fetchManagementDashboard,
  type ManagementDashboardData,
  type ManagementDrilldownKey,
  type ManagementPeriod,
} from "@/lib/managementDashboardApi";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";

const PERIODS: { value: ManagementPeriod; label: string; short: string }[] = [
  { value: "current_week", label: "Текущая неделя", short: "Неделя" },
  { value: "current_month", label: "Текущий месяц", short: "Месяц" },
  { value: "last_month", label: "Прошлый месяц", short: "Прошлый месяц" },
  { value: "current_year", label: "Текущий год", short: "Год" },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0) + " ₽";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value || 0);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function canViewManagementDashboard(user: { username: string; full_name: string; is_head: boolean } | null | undefined) {
  const username = user?.username?.toLowerCase() ?? "";
  const fullName = user?.full_name?.toLowerCase() ?? "";
  return Boolean(user?.is_head || username === "admin" || username === "elena" || fullName.includes("елена"));
}

function toneClasses(tone: "default" | "danger" | "warning" | "success" | "money" | "info") {
  if (tone === "danger") return "border-red-100 bg-gradient-to-br from-red-50 to-white text-red-700";
  if (tone === "warning") return "border-orange-100 bg-gradient-to-br from-orange-50 to-white text-orange-700";
  if (tone === "success") return "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white text-emerald-700";
  if (tone === "money") return "border-gold/20 bg-gradient-to-br from-gold/15 to-white text-navy";
  if (tone === "info") return "border-blue/10 bg-gradient-to-br from-blue-light to-white text-navy";
  return "border-black/5 bg-white text-navy";
}

function StatCard({
  title,
  value,
  subtitle,
  href,
  onClick,
  active = false,
  tone = "default",
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  tone?: "default" | "danger" | "warning" | "success" | "money" | "info";
  icon?: ReactNode;
}) {
  const className = `group h-full w-full rounded-3xl border p-5 text-left shadow-sm transition ${toneClasses(tone)} ${href || onClick ? "hover:-translate-y-0.5 hover:shadow-md" : ""} ${active ? "ring-2 ring-navy/25" : ""}`;
  const content = (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        {icon && <div className="rounded-2xl bg-white/75 p-2.5 shadow-sm opacity-90">{icon}</div>}
      </div>
      {subtitle && <p className="mt-3 min-h-8 text-xs leading-5 opacity-70">{subtitle}</p>}
      {(href || onClick) && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold opacity-80 transition group-hover:gap-2">
          {onClick ? "Показать детали" : "Открыть список"} <ArrowRight size={13} />
        </p>
      )}
    </div>
  );

  if (onClick) return <button type="button" onClick={onClick} className="block h-full w-full">{content}</button>;
  return href ? <Link href={href}>{content}</Link> : content;
}

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy">{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-5 text-foreground/45">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "gold" | "red" | "green" }) {
  const fillClass = tone === "red" ? "bg-red-500" : tone === "green" ? "bg-emerald-500" : tone === "gold" ? "bg-gold" : "bg-blue";
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-light">
      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

function RowBar({
  label,
  value,
  max,
  subtitle,
  tone = "blue",
}: {
  label: string;
  value: number;
  max: number;
  subtitle?: string;
  tone?: "blue" | "gold" | "red" | "green";
}) {
  return (
    <div className="rounded-2xl bg-blue-light/30 px-3 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-navy">{label}</span>
        <span className="shrink-0 font-semibold text-navy">{formatNumber(value)}</span>
      </div>
      {subtitle && <p className="mt-1 text-xs text-foreground/45">{subtitle}</p>}
      <ProgressBar value={percent(value, max)} tone={tone} />
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-blue-light/30 px-4 py-5 text-sm text-foreground/45">{children}</p>;
}

function DailyTrend({ data }: { data: ManagementDashboardData }) {
  const step = data.daily_rows.length > 70 ? Math.ceil(data.daily_rows.length / 60) : 1;
  const rows = data.daily_rows.filter((_, index) => index % step === 0 || index === data.daily_rows.length - 1);
  const maxLeads = Math.max(...rows.map((row) => row.leads), 1);
  const maxDeals = Math.max(...rows.map((row) => row.deals), 1);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-h-[210px] min-w-[760px] items-end gap-2 rounded-2xl bg-blue-light/20 px-4 pb-8 pt-4">
        {rows.map((row) => {
          const leadsHeight = 16 + percent(row.leads, maxLeads) * 0.9;
          const dealsHeight = 16 + percent(row.deals, maxDeals) * 0.9;
          return (
            <div key={row.date} className="group relative flex flex-1 min-w-[16px] items-end justify-center gap-0.5">
              <div className="w-2 rounded-t bg-blue" style={{ height: `${leadsHeight}px` }} />
              <div className="w-2 rounded-t bg-gold" style={{ height: `${dealsHeight}px` }} />
              <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden min-w-[150px] rounded-xl bg-navy px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                <p className="font-semibold">{formatDate(row.date)}</p>
                <p className="mt-1 text-white/75">Заявки: {row.leads}</p>
                <p className="text-white/75">Продажи: {row.deals}</p>
                <p className="text-white/75">Комиссия: {formatMoney(row.commission)}</p>
              </div>
              <span className="absolute top-full mt-2 -rotate-45 whitespace-nowrap text-[10px] text-foreground/35">
                {new Date(row.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-foreground/45">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue" /> заявки</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gold" /> продажи</span>
      </div>
    </div>
  );
}

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(data: ManagementDashboardData) {
  const lines: string[] = [];
  lines.push(`Управленческий дашборд;${data.period.label};${formatDate(data.period.from)} - ${formatDate(data.period.to)}`);
  lines.push("");
  lines.push("KPI;Значение");
  lines.push(`Комиссия за период;${data.money.commission_total}`);
  lines.push(`Сумма сделок;${data.money.deal_amount_total}`);
  lines.push(`Продаж;${data.money.deals_count}`);
  lines.push(`Потенциал активных;${data.operational.active_potential_commission}`);
  lines.push(`Остаток к оплате;${data.operational.active_balance}`);
  lines.push("");
  lines.push("Менеджер;Активные;Новые;Просроченные контакты;Просроченные оплаты;Продажи;Комиссия;Конверсия;Неуспешные;Проваленные");
  data.manager_rows.forEach((row) => lines.push([
    row.manager_name, row.active, row.new_leads, row.overdue_contacts, row.overdue_payments, row.sold, row.commission, `${row.conversion_percent}%`, row.lost, row.failed,
  ].map(csvValue).join(";")));
  lines.push("");
  lines.push("Источник;Заявок;Продаж;Комиссия;Конверсия");
  data.source_rows.forEach((row) => lines.push([row.source_display, row.count, row.sold, row.commission, `${row.conversion_percent}%`].map(csvValue).join(";")));
  lines.push("");
  lines.push("Дата;Заявки;Продажи;Комиссия");
  data.daily_rows.forEach((row) => lines.push([row.date, row.leads, row.deals, row.commission].map(csvValue).join(";")));

  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `management-dashboard-${data.period.code}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ManagementDashboardPage() {
  const { user } = useCrmAuth();
  const [period, setPeriod] = useState<ManagementPeriod>("current_month");
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drilldownKey, setDrilldownKey] = useState<ManagementDrilldownKey | null>(null);

  const canView = canViewManagementDashboard(user);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    setLoading(true);
    setError("");
    setDrilldownKey(null);
    fetchManagementDashboard(period)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Не удалось загрузить управленческий дашборд");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, period]);

  const derived = useMemo(() => {
    if (!data) return null;
    const attentionTotal = data.operational.tasks_overdue + data.operational.contacts_overdue + data.operational.payments_overdue_count;
    const funnelMax = Math.max(...data.status_rows.map((row) => row.count), 1);
    const managerMaxCommission = Math.max(...data.manager_rows.map((row) => row.commission), 1);
    const sourceMax = Math.max(...data.source_rows.map((row) => row.count), 1);
    const reasonMax = Math.max(...data.reason_rows.map((row) => row.count), 1);
    const sourceTotal = data.source_rows.reduce((sum, row) => sum + row.count, 0);
    const soldConversion = percent(data.money.deals_count, data.money.active_period_count);
    const selectedDrilldown = drilldownKey ? data.drilldowns[drilldownKey] : null;
    return { attentionTotal, funnelMax, managerMaxCommission, sourceMax, reasonMax, sourceTotal, soldConversion, selectedDrilldown };
  }, [data, drilldownKey]);

  if (!canView) {
    return (
      <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-navy">Управленческий дашборд</h1>
        <p className="mt-2 text-sm text-foreground/60">Этот раздел доступен руководителю, admin и Елене.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-navy/10 bg-gradient-to-br from-navy via-blue to-navy p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
              <Gauge size={14} /> Executive CRM
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Управленческий дашборд</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Операционный экран руководителя: drill-down по проблемам, график динамики, выгрузка CSV и управленческая аналитика.
            </p>
            {data && (
              <p className="mt-3 text-xs text-white/60">
                {data.period.label}: {formatDate(data.period.from)} — {formatDate(data.period.to)}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap gap-2 rounded-2xl bg-white/10 p-1.5 backdrop-blur">
              {PERIODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPeriod(item.value)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${period === item.value ? "bg-white text-navy shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
                  title={item.label}
                >
                  {item.short}
                </button>
              ))}
            </div>
            {data && (
              <button
                type="button"
                onClick={() => downloadCsv(data)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white/80 hover:bg-white/15 hover:text-white"
              >
                <Download size={14} /> Скачать CSV
              </button>
            )}
          </div>
        </div>

        {data && derived && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs text-white/55">Критичных сигналов</p>
              <p className="mt-1 text-2xl font-bold">{derived.attentionTotal}</p>
              <p className="mt-1 text-xs text-white/55">задачи, контакты, оплаты</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs text-white/55">Комиссия за период</p>
              <p className="mt-1 text-2xl font-bold text-gold">{formatMoney(data.money.commission_total)}</p>
              <p className="mt-1 text-xs text-white/55">продаж: {data.money.deals_count}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs text-white/55">Конверсия в продажи</p>
              <p className="mt-1 text-2xl font-bold">{derived.soldConversion}%</p>
              <p className="mt-1 text-xs text-white/55">от заявок выбранного периода</p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {loading || !data || !derived ? (
        <div className="rounded-3xl border border-black/5 bg-white p-6 text-sm text-foreground/50 shadow-sm">
          Загрузка управленческого дашборда…
        </div>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-navy">Сегодня требует внимания</h2>
                <p className="mt-1 text-xs text-foreground/45">Нажми на карточку — ниже откроется детальный список заявок.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Задачи сегодня" value={data.operational.tasks_today} subtitle="невыполненные задачи на сегодня" onClick={() => setDrilldownKey("tasks_today")} active={drilldownKey === "tasks_today"} tone="info" icon={<CalendarClock size={18} />} />
              <StatCard title="Просроченные задачи" value={data.operational.tasks_overdue} subtitle="срочно разобрать и закрыть" onClick={() => setDrilldownKey("tasks_overdue")} active={drilldownKey === "tasks_overdue"} tone={data.operational.tasks_overdue > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
              <StatCard title="Контакты сегодня" value={data.operational.contacts_today} subtitle="по дате следующего контакта" onClick={() => setDrilldownKey("contacts_today")} active={drilldownKey === "contacts_today"} tone="info" icon={<Clock3 size={18} />} />
              <StatCard title="Просроченные контакты" value={data.operational.contacts_overdue} subtitle="есть риск потерять клиента" onClick={() => setDrilldownKey("contacts_overdue")} active={drilldownKey === "contacts_overdue"} tone={data.operational.contacts_overdue > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
            </div>
          </section>

          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Оплаты до 7 дней" value={data.operational.payments_soon_count} subtitle={formatMoney(data.operational.payments_soon_amount)} onClick={() => setDrilldownKey("payments_soon")} active={drilldownKey === "payments_soon"} tone="warning" icon={<WalletCards size={18} />} />
              <StatCard title="Просроченные оплаты" value={data.operational.payments_overdue_count} subtitle={formatMoney(data.operational.payments_overdue_amount)} onClick={() => setDrilldownKey("payments_overdue")} active={drilldownKey === "payments_overdue"} tone={data.operational.payments_overdue_count > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
              <StatCard title="Вылеты до 7 дней" value={data.operational.departures_soon} subtitle="проверить документы и связь" onClick={() => setDrilldownKey("departures_soon")} active={drilldownKey === "departures_soon"} tone="info" icon={<Plane size={18} />} />
              <StatCard title="Документы к выдаче" value={data.operational.docs_to_issue} subtitle="по ближайшим вылетам" onClick={() => setDrilldownKey("docs_to_issue")} active={drilldownKey === "docs_to_issue"} tone="warning" icon={<CheckCircle2 size={18} />} />
            </div>
          </section>

          {derived.selectedDrilldown && (
            <Section
              title={derived.selectedDrilldown.title}
              subtitle="Drill-down: до 20 заявок, которые формируют выбранный показатель."
              action={<button type="button" onClick={() => setDrilldownKey(null)} className="text-xs font-semibold text-foreground/45 hover:text-navy">Скрыть</button>}
            >
              {derived.selectedDrilldown.rows.length === 0 ? (
                <EmptyState>По этому показателю сейчас нет заявок.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-foreground/45">
                      <tr>
                        <th className="pb-3">Клиент</th>
                        <th className="pb-3">Статус</th>
                        <th className="pb-3">Менеджер</th>
                        <th className="pb-3">Контакт</th>
                        <th className="pb-3">Оплата</th>
                        <th className="pb-3">Вылет</th>
                        <th className="pb-3 text-right">Остаток</th>
                        <th className="pb-3 text-right">Комиссия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {derived.selectedDrilldown.rows.map((lead) => (
                        <tr key={lead.id}>
                          <td className="py-3">
                            <Link href={`/crm/leads/${lead.id}`} className="font-semibold text-navy hover:underline">{lead.name}</Link>
                            <p className="mt-0.5 text-xs text-foreground/45">{lead.phone} · {lead.source_display}</p>
                          </td>
                          <td className="py-3 text-foreground/70">{lead.status_display}</td>
                          <td className="py-3 text-foreground/70">{lead.manager_name}</td>
                          <td className="py-3 text-foreground/70">{formatDateTime(lead.next_contact_at)}</td>
                          <td className="py-3 text-foreground/70">{formatDateTime(lead.full_payment_due_at)}</td>
                          <td className="py-3 text-foreground/70">{formatDate(lead.departure_date)}</td>
                          <td className="py-3 text-right text-foreground/70">{formatMoney(lead.balance_due)}</td>
                          <td className="py-3 text-right font-semibold text-navy">{formatMoney(lead.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-gold/20 bg-gradient-to-br from-white via-gold/10 to-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">Деньги</p>
                  <h2 className="mt-1 text-lg font-bold text-navy">Финансовая картина периода</h2>
                  <p className="mt-1 text-xs text-foreground/50">Комиссия считается по первому денежному статусу.</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                  <p className="text-xs text-foreground/45">Комиссия</p>
                  <p className="text-2xl font-bold text-gold">{formatMoney(data.money.commission_total)}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs text-foreground/45">Продано за период</p>
                  <p className="mt-2 text-2xl font-bold text-navy">{data.money.deals_count}</p>
                  <p className="mt-1 text-xs text-foreground/45">{formatMoney(data.money.deal_amount_total)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs text-foreground/45">Потенциал активных</p>
                  <p className="mt-2 text-2xl font-bold text-navy">{formatMoney(data.operational.active_potential_commission)}</p>
                  <p className="mt-1 text-xs text-foreground/45">комиссия в незакрытых заявках</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs text-foreground/45">Остаток к оплате</p>
                  <p className="mt-2 text-2xl font-bold text-navy">{formatMoney(data.operational.active_balance)}</p>
                  <p className="mt-1 text-xs text-foreground/45">по активным заявкам</p>
                </div>
              </div>
            </div>

            <Section title="Где застряли заявки" subtitle="Быстрые управленческие сигналы без лишней детализации.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <StatCard title="Без следующего контакта" value={data.operational.no_next_contact} subtitle="в рабочих статусах" onClick={() => setDrilldownKey("no_next_contact")} active={drilldownKey === "no_next_contact"} tone={data.operational.no_next_contact > 0 ? "warning" : "success"} />
                <StatCard title="Без ответственного" value={data.operational.no_manager} subtitle="нужно назначить менеджера" onClick={() => setDrilldownKey("no_manager")} active={drilldownKey === "no_manager"} tone={data.operational.no_manager > 0 ? "warning" : "success"} />
              </div>
            </Section>
          </section>

          <Section title="Динамика: заявки / продажи" subtitle="Синие столбцы — входящие заявки, золотые — продажи. Комиссия остаётся в подсказке при наведении.">
            <DailyTrend data={data} />
          </Section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section title="Воронка за выбранный период" subtitle="Видно, где сейчас концентрируются заявки.">
              {data.status_rows.length === 0 ? (
                <EmptyState>Нет заявок за выбранный период.</EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.status_rows.map((row) => (
                    <Link key={row.status} href={`/crm/leads?status=${row.status}`}>
                      <RowBar label={row.status_display} value={row.count} max={derived.funnelMax} />
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Причины потерь за период" subtitle="Что чаще всего мешает продаже или уводит клиента.">
              {data.reason_rows.length === 0 ? (
                <EmptyState>Пока нет закрытых заявок с причинами потерь.</EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.reason_rows.map((row) => (
                    <RowBar key={row.reason} label={row.reason} value={row.count} max={derived.reasonMax} tone="red" />
                  ))}
                </div>
              )}
            </Section>
          </div>

          <Section title="Менеджеры: продажи и дисциплина" subtitle="Комиссия считается за выбранный период, просрочки — по текущему состоянию заявок.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-foreground/45">
                  <tr>
                    <th className="px-3 pb-2">Менеджер</th>
                    <th className="px-3 pb-2 text-right">Активные</th>
                    <th className="px-3 pb-2 text-right">Новые</th>
                    <th className="px-3 pb-2 text-right">Контакты</th>
                    <th className="px-3 pb-2 text-right">Оплаты</th>
                    <th className="px-3 pb-2 text-right">Продажи</th>
                    <th className="px-3 pb-2 text-right">Конверсия</th>
                    <th className="px-3 pb-2 text-right">Комиссия</th>
                    <th className="px-3 pb-2 text-right">Потери</th>
                  </tr>
                </thead>
                <tbody>
                  {data.manager_rows.map((row) => (
                    <tr key={`${row.manager_id ?? "none"}-${row.manager_name}`} className="bg-blue-light/25">
                      <td className="rounded-l-2xl px-3 py-3 font-semibold text-navy">{row.manager_name}</td>
                      <td className="px-3 py-3 text-right">{row.active}</td>
                      <td className="px-3 py-3 text-right">{row.new_leads}</td>
                      <td className={`px-3 py-3 text-right ${row.overdue_contacts > 0 ? "font-semibold text-red-600" : "text-foreground/65"}`}>{row.overdue_contacts}</td>
                      <td className={`px-3 py-3 text-right ${row.overdue_payments > 0 ? "font-semibold text-red-600" : "text-foreground/65"}`}>{row.overdue_payments}</td>
                      <td className="px-3 py-3 text-right">{row.sold}</td>
                      <td className="px-3 py-3 text-right">{row.conversion_percent}%</td>
                      <td className="px-3 py-3 text-right">
                        <div className="ml-auto max-w-[170px]">
                          <p className="font-semibold text-navy">{formatMoney(row.commission)}</p>
                          <ProgressBar value={percent(row.commission, derived.managerMaxCommission)} tone="gold" />
                        </div>
                      </td>
                      <td className="rounded-r-2xl px-3 py-3 text-right">{row.lost} / {row.failed}</td>
                    </tr>
                  ))}
                  {data.manager_rows.length === 0 && (
                    <tr><td colSpan={9}><EmptyState>Нет данных по менеджерам за выбранный период.</EmptyState></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section title="Источники заявок" subtitle="Количество, продажи, комиссия и доля от общего потока.">
              {data.source_rows.length === 0 ? (
                <EmptyState>Нет источников за выбранный период.</EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.source_rows.map((row) => (
                    <div key={row.source} className="rounded-2xl bg-blue-light/30 px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-navy">{row.source_display}</span>
                        <span className="text-foreground/60">{formatNumber(row.count)} заявок</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-foreground/50">
                        <span>Продаж: {row.sold} · доля {percent(row.count, derived.sourceTotal)}%</span>
                        <span className="font-semibold text-gold">{formatMoney(row.commission)}</span>
                      </div>
                      <ProgressBar value={percent(row.count, derived.sourceMax)} tone="blue" />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Качество источников" subtitle="Быстрая оценка: откуда приходят заявки и где есть деньги.">
              {data.source_rows.length === 0 ? (
                <EmptyState>Нет данных по источникам.</EmptyState>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {data.source_rows.slice(0, 6).map((row) => (
                    <div key={row.source} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-navy">{row.source_display}</p>
                          <p className="mt-1 text-xs text-foreground/45">Конверсия: {row.conversion_percent}%</p>
                        </div>
                        <Megaphone size={17} className="text-blue" />
                      </div>
                      <p className="mt-3 text-lg font-bold text-gold">{formatMoney(row.commission)}</p>
                      <p className="mt-1 text-xs text-foreground/45">{row.sold} продаж из {row.count} заявок</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
