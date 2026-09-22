"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  Megaphone,
  Plane,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import {
  fetchManagementDashboard,
  type ManagementDashboardData,
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
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
  tone = "default",
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
  tone?: "default" | "danger" | "warning" | "success" | "money" | "info";
  icon?: ReactNode;
}) {
  const content = (
    <div className={`group h-full rounded-3xl border p-5 shadow-sm transition ${toneClasses(tone)} ${href ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        {icon && <div className="rounded-2xl bg-white/75 p-2.5 shadow-sm opacity-90">{icon}</div>}
      </div>
      {subtitle && <p className="mt-3 min-h-8 text-xs leading-5 opacity-70">{subtitle}</p>}
      {href && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold opacity-80 transition group-hover:gap-2">
          Открыть список <ArrowRight size={13} />
        </p>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy">{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-5 text-foreground/45">{subtitle}</p>}
        </div>
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

export default function ManagementDashboardPage() {
  const { user } = useCrmAuth();
  const [period, setPeriod] = useState<ManagementPeriod>("current_month");
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canView = canViewManagementDashboard(user);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    setLoading(true);
    setError("");
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
    const paymentsTotal = data.operational.payments_soon_count + data.operational.payments_overdue_count;
    const funnelMax = Math.max(...data.status_rows.map((row) => row.count), 1);
    const managerMaxCommission = Math.max(...data.manager_rows.map((row) => row.commission), 1);
    const sourceMax = Math.max(...data.source_rows.map((row) => row.count), 1);
    const reasonMax = Math.max(...data.reason_rows.map((row) => row.count), 1);
    const sourceTotal = data.source_rows.reduce((sum, row) => sum + row.count, 0);
    const soldConversion = percent(data.money.deals_count, data.money.active_period_count);
    return { attentionTotal, paymentsTotal, funnelMax, managerMaxCommission, sourceMax, reasonMax, sourceTotal, soldConversion };
  }, [data]);

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
              Операционный экран руководителя: задачи, контакты, оплаты, вылеты, деньги, менеджеры, источники и причины потерь.
            </p>
            {data && (
              <p className="mt-3 text-xs text-white/60">
                {data.period.label}: {formatDate(data.period.from)} — {formatDate(data.period.to)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl bg-white/10 p-1.5 backdrop-blur">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  period === item.value ? "bg-white text-navy shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
                title={item.label}
              >
                {item.short}
              </button>
            ))}
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
                <p className="mt-1 text-xs text-foreground/45">Кликабельные карточки для быстрого перехода к проблемным заявкам.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Задачи сегодня" value={data.operational.tasks_today} subtitle="невыполненные задачи на сегодня" href="/crm/leads?task_filter=today" tone="info" icon={<CalendarClock size={18} />} />
              <StatCard title="Просроченные задачи" value={data.operational.tasks_overdue} subtitle="срочно разобрать и закрыть" href="/crm/leads?task_filter=overdue" tone={data.operational.tasks_overdue > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
              <StatCard title="Контакты сегодня" value={data.operational.contacts_today} subtitle="по дате следующего контакта" href="/crm/leads" tone="info" icon={<Clock3 size={18} />} />
              <StatCard title="Просроченные контакты" value={data.operational.contacts_overdue} subtitle="есть риск потерять клиента" href="/crm/leads" tone={data.operational.contacts_overdue > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
            </div>
          </section>

          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Оплаты до 7 дней" value={data.operational.payments_soon_count} subtitle={formatMoney(data.operational.payments_soon_amount)} href="/crm/leads" tone="warning" icon={<WalletCards size={18} />} />
              <StatCard title="Просроченные оплаты" value={data.operational.payments_overdue_count} subtitle={formatMoney(data.operational.payments_overdue_amount)} href="/crm/leads" tone={data.operational.payments_overdue_count > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
              <StatCard title="Вылеты до 7 дней" value={data.operational.departures_soon} subtitle="проверить документы и связь" href="/crm/leads" tone="info" icon={<Plane size={18} />} />
              <StatCard title="Документы к выдаче" value={data.operational.docs_to_issue} subtitle="по ближайшим вылетам" href="/crm/leads" tone="warning" icon={<CheckCircle2 size={18} />} />
            </div>
          </section>

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
                <StatCard title="Без следующего контакта" value={data.operational.no_next_contact} subtitle="в рабочих статусах" href="/crm/leads" tone={data.operational.no_next_contact > 0 ? "warning" : "success"} />
                <StatCard title="Без ответственного" value={data.operational.no_manager} subtitle="нужно назначить менеджера" href="/crm/leads" tone={data.operational.no_manager > 0 ? "warning" : "success"} />
              </div>
            </Section>
          </section>

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
              <table className="w-full min-w-[920px] border-separate border-spacing-y-2 text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-foreground/45">
                  <tr>
                    <th className="px-3 pb-2">Менеджер</th>
                    <th className="px-3 pb-2 text-right">Активные</th>
                    <th className="px-3 pb-2 text-right">Новые</th>
                    <th className="px-3 pb-2 text-right">Контакты</th>
                    <th className="px-3 pb-2 text-right">Оплаты</th>
                    <th className="px-3 pb-2 text-right">Продажи</th>
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
                    <tr><td colSpan={8}><EmptyState>Нет данных по менеджерам за выбранный период.</EmptyState></td></tr>
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
                          <p className="mt-1 text-xs text-foreground/45">Конверсия: {percent(row.sold, row.count)}%</p>
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
