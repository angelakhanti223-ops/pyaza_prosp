"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Compass,
  FileText,
  Layers3,
  LineChart,
  Luggage,
  Plane,
  RefreshCw,
  Route,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import {
  fetchDashboard,
  fetchPlan,
  fetchWorkSchedule,
  fetchWorkSummary,
  type DashboardData,
  type PlanData,
  type WorkScheduleData,
  type WorkSummaryData,
} from "@/lib/dashboardApi";
import {
  fetchManagementDashboard,
  type ManagementDashboardData,
  type ManagementPeriod,
} from "@/lib/managementDashboardApi";

const COLORS = {
  ivory: "#F4EFE7",
  linen: "#D8C8B6",
  sand: "#B7A48F",
  terracotta: "#B96F4E",
  clay: "#C98563",
  brown: "#684B38",
  charcoal: "#292725",
  sea: "#234B52",
  seaGlass: "#AAC8C3",
  sage: "#7C8A6A",
};

const PERIOD_OPTIONS: { code: ManagementPeriod; label: string; note: string }[] = [
  { code: "current_week", label: "Неделя", note: "контроль темпа" },
  { code: "current_month", label: "Месяц", note: "план / факт" },
  { code: "last_month", label: "Прошлый", note: "разбор результата" },
  { code: "current_year", label: "Год", note: "стратегия" },
];

const MONTH_GENITIVE = [
  "",
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MANAGER_COLORS = [COLORS.brown, COLORS.terracotta, COLORS.sea, COLORS.sage];
const LEADS_TARGET = 200;
const DEALS_TARGET = 30;
const TOUR_AMOUNT_TARGET = 4_000_000;
const COMMISSION_TARGET = 200_000;

type Tone = "warm" | "sea" | "sage" | "sand";

type ManagerPerformanceRow = {
  manager_id: number | null;
  manager_name: string;
  active: number;
  new_leads: number;
  sold: number;
  commission: number;
  conversion_percent: number;
  overdue_contacts: number;
  overdue_payments: number;
  lost: number;
  failed: number;
  target?: number;
  actual?: number;
  percent?: number;
  salary?: number;
};

type FunnelRow = {
  label: string;
  value: number;
};

type DailyPoint = {
  label: string;
  leads: number;
  deals: number;
  commission: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatMoney(value: number | null | undefined): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0)} ₽`;
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value: number | null | undefined): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0)}%`;
}

function percent(value: number, target: number): number {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

function progressPercent(value: number, target: number): number {
  return Math.min(Math.max(percent(value, target), 0), 120);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function todayIso(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function getPlanDate(period: ManagementPeriod): { year: number; month: number } {
  const now = new Date();
  if (period === "last_month") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function canViewManagementDashboard(user: { username: string; full_name: string; is_head: boolean } | null | undefined) {
  const username = user?.username?.toLowerCase() ?? "";
  const fullName = user?.full_name?.toLowerCase() ?? "";
  return Boolean(user?.is_head || username === "admin" || username === "elena" || fullName.includes("елена"));
}

function toneColor(tone: Tone): string {
  if (tone === "sea") return COLORS.sea;
  if (tone === "sage") return COLORS.sage;
  if (tone === "sand") return COLORS.sand;
  return COLORS.terracotta;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-[30px] border border-[#684B38]/10 bg-white/80 shadow-[0_24px_70px_rgba(41,39,37,0.08)] backdrop-blur", className)}>
      {children}
    </section>
  );
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#292725]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[#292725]/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Progress({ value, color = COLORS.terracotta }: { value: number; color?: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-[#D8C8B6]/55">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  caption,
  icon: Icon,
  targetLabel,
  progress,
  tone = "warm",
}: {
  title: string;
  value: string;
  caption: string;
  icon: LucideIcon;
  targetLabel: string;
  progress: number;
  tone?: Tone;
}) {
  const color = toneColor(tone);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4EFE7] shadow-inner" style={{ color }}>
            <Icon size={22} />
          </div>
          <div>
            <p className="text-sm font-medium text-[#292725]/65">{title}</p>
            <p className="mt-1 font-serif text-4xl font-semibold leading-none text-[#292725]">{value}</p>
            <p className="mt-2 text-xs text-[#292725]/45">{caption}</p>
          </div>
        </div>
        <div className="flex h-12 items-end gap-1.5">
          {[14, 21, 17, 29, 36, 44].map((height, index) => (
            <span key={index} className="w-1.5 rounded-full opacity-75" style={{ height, backgroundColor: color }} />
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-2xl bg-[#F4EFE7]/85 p-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-[#684B38]"><Target size={16} /> {targetLabel}</span>
          <span className="font-semibold text-[#292725]">{formatPercent(progress)}</span>
        </div>
        <Progress value={progress} color={color} />
      </div>
    </Card>
  );
}

function ControlPill({ label, value, tone = "warm" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="rounded-2xl border border-[#684B38]/10 bg-[#F4EFE7]/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#684B38]/55">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#292725]" style={{ color: toneColor(tone) }}>{value}</p>
    </div>
  );
}

function MiniTrendChart({ rows }: { rows: DailyPoint[] }) {
  if (!rows.length) return <p className="text-sm text-[#292725]/45">Нет динамики за выбранный период.</p>;

  const width = 760;
  const height = 240;
  const padding = 34;
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.leads, row.deals]));
  const toX = (index: number) => padding + (index * (width - padding * 2)) / Math.max(rows.length - 1, 1);
  const toY = (value: number) => height - padding - (value * (height - padding * 2)) / maxValue;
  const leadPoints = rows.map((row, index) => `${toX(index)},${toY(row.leads)}`).join(" ");
  const dealPoints = rows.map((row, index) => `${toX(index)},${toY(row.deals)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px]">
        {[0, 1, 2, 3].map((line) => {
          const y = padding + (line * (height - padding * 2)) / 3;
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#D8C8B6" strokeOpacity="0.55" />;
        })}
        <polyline fill="none" stroke={COLORS.sea} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={leadPoints} />
        <polyline fill="none" stroke={COLORS.terracotta} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={dealPoints} />
        {rows.map((row, index) => (
          <Fragment key={`${row.label}-${index}`}>
            <circle cx={toX(index)} cy={toY(row.leads)} r="5" fill={COLORS.sea} />
            <circle cx={toX(index)} cy={toY(row.deals)} r="5" fill={COLORS.terracotta} />
            <text x={toX(index)} y={height - 8} textAnchor="middle" fontSize="12" fill="#81766B">{row.label}</text>
          </Fragment>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#292725]/55">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#234B52]" /> заявки</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#B96F4E]" /> продажи</span>
      </div>
    </div>
  );
}

function BarList({ rows, emptyText, color = COLORS.terracotta }: { rows: FunnelRow[]; emptyText: string; color?: string }) {
  const visibleRows = rows.filter((row) => row.value > 0).slice(0, 8);
  const maxValue = Math.max(1, ...visibleRows.map((row) => row.value));
  if (!visibleRows.length) return <p className="text-sm text-[#292725]/45">{emptyText}</p>;

  return (
    <div className="space-y-3">
      {visibleRows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-3 text-sm">
          <span className="truncate text-[#292725]/70">{row.label}</span>
          <div className="h-8 overflow-hidden rounded-full bg-[#F4EFE7]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(10, percent(row.value, maxValue))}%`, backgroundColor: color }} />
          </div>
          <span className="min-w-8 text-right font-semibold text-[#292725]">{formatNumber(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

function DirectionDonut({ data }: { data: DashboardData | null }) {
  const rows = (data?.by_direction ?? []).filter((row) => row.count > 0).slice(0, 6);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const colors = [COLORS.sea, COLORS.terracotta, COLORS.clay, COLORS.sand, COLORS.sage, COLORS.brown];

  if (!rows.length || total === 0) return <p className="text-sm text-[#292725]/45">Нет продаж по направлениям за выбранный период.</p>;

  let start = 0;
  const gradient = rows
    .map((row, index) => {
      const end = start + (row.count / total) * 100;
      const segment = `${colors[index % colors.length]} ${start}% ${end}%`;
      start = end;
      return segment;
    })
    .join(", ");

  return (
    <div className="grid gap-5 md:grid-cols-[190px_1fr]">
      <div className="relative mx-auto h-44 w-44 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <span className="font-serif text-4xl font-semibold text-[#292725]">{total}</span>
          <span className="text-xs text-[#292725]/50">туров</span>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-2.5">
        {rows.map((row, index) => (
          <div key={row.direction} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
            <span className="truncate text-[#292725]/72">{row.direction}</span>
            <span className="text-[#292725]/45">{formatPercent(percent(row.count, total))}</span>
            <span className="font-semibold text-[#292725]">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkScheduleCalendar({ schedule }: { schedule: WorkScheduleData | null }) {
  if (!schedule || schedule.rows.length === 0) return <p className="text-sm text-[#292725]/45">График офиса не заполнен.</p>;

  const today = todayIso();
  const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const managers = Array.from(new Map(schedule.rows.map((row) => [row.manager_id, row.manager_name])).entries()).map(
    ([manager_id, manager_name]) => ({ manager_id, manager_name })
  );
  const workerByDate = new Map<string, number>();

  for (const row of schedule.rows) {
    const from = new Date(`${row.date_from}T00:00:00`);
    const to = new Date(`${row.date_to}T00:00:00`);
    for (let day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
      workerByDate.set(isoDate(day.getFullYear(), day.getMonth() + 1, day.getDate()), row.manager_id);
    }
  }

  const todayManager = managers.find((manager) => manager.manager_id === workerByDate.get(today));

  return (
    <div>
      {todayManager && (
        <p className="mb-4 text-sm text-[#292725]/55">
          Сегодня в офисе: <span className="font-semibold text-[#684B38]">{todayManager.manager_name}</span>
        </p>
      )}
      <div className="overflow-x-auto pb-1">
        <div className="inline-grid min-w-[980px] items-center gap-2" style={{ gridTemplateColumns: `130px repeat(${daysInMonth}, minmax(24px, 1fr))` }}>
          <div />
          {days.map((day) => (
            <div key={day} className={cx("text-center text-[11px] font-semibold", isoDate(schedule.year, schedule.month, day) === today ? "text-[#B96F4E]" : "text-[#81766B]")}>
              {day}
            </div>
          ))}
          {managers.map((manager, managerIndex) => (
            <Fragment key={manager.manager_id}>
              <div className="pr-3 text-sm font-semibold leading-4 text-[#292725]">{manager.manager_name}</div>
              {days.map((day) => {
                const dateStr = isoDate(schedule.year, schedule.month, day);
                const working = workerByDate.get(dateStr) === manager.manager_id;
                const isToday = dateStr === today;
                return (
                  <div
                    key={day}
                    title={`${day} ${MONTH_GENITIVE[schedule.month]}: ${working ? manager.manager_name : "не работает"}`}
                    className={cx("h-9 rounded-xl", isToday && "ring-2 ring-[#B96F4E] ring-offset-2")}
                    style={{ backgroundColor: working ? MANAGER_COLORS[managerIndex % MANAGER_COLORS.length] : "rgba(216, 200, 182, 0.35)" }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManagerTable({ rows }: { rows: ManagerPerformanceRow[] }) {
  if (!rows.length) return <p className="text-sm text-[#292725]/45">Нет данных по менеджерам.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[780px] w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#684B38]/10 text-xs uppercase tracking-[0.14em] text-[#684B38]/55">
            <th className="py-3 pr-3 font-semibold">Менеджер</th>
            <th className="px-3 py-3 font-semibold">Активные</th>
            <th className="px-3 py-3 font-semibold">Новые</th>
            <th className="px-3 py-3 font-semibold">Продажи</th>
            <th className="px-3 py-3 font-semibold">Комиссия</th>
            <th className="px-3 py-3 font-semibold">Конверсия</th>
            <th className="px-3 py-3 font-semibold">Риски</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const risk = row.overdue_contacts + row.overdue_payments;
            return (
              <tr key={`${row.manager_id ?? "none"}-${row.manager_name}`} className="border-b border-[#684B38]/8 last:border-0">
                <td className="py-4 pr-3">
                  <p className="font-semibold text-[#292725]">{row.manager_name}</p>
                  {row.target !== undefined && <p className="text-xs text-[#292725]/45">план: {formatMoney(row.target)}</p>}
                </td>
                <td className="px-3 py-4 text-[#292725]/75">{formatNumber(row.active)}</td>
                <td className="px-3 py-4 text-[#292725]/75">{formatNumber(row.new_leads)}</td>
                <td className="px-3 py-4 font-semibold text-[#292725]">{formatNumber(row.sold)}</td>
                <td className="px-3 py-4 font-semibold text-[#292725]">{formatMoney(row.commission)}</td>
                <td className="px-3 py-4 text-[#292725]/75">{formatPercent(row.conversion_percent)}</td>
                <td className="px-3 py-4">
                  <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", risk > 0 ? "bg-[#B96F4E]/12 text-[#B96F4E]" : "bg-[#7C8A6A]/12 text-[#7C8A6A]")}>
                    {risk > 0 ? `${risk} проср.` : "чисто"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function NewDashboardPage() {
  const { user } = useCrmAuth();
  const canManage = canViewManagementDashboard(user);
  const [period, setPeriod] = useState<ManagementPeriod>("current_month");
  const [reloadToken, setReloadToken] = useState(0);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [summary, setSummary] = useState<WorkSummaryData | null>(null);
  const [schedule, setSchedule] = useState<WorkScheduleData | null>(null);
  const [management, setManagement] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const planDate = getPlanDate(period);
    const dashboardPeriod = period === "last_month" ? "last_month" : "current_month";

    async function load() {
      setLoading(true);
      setError("");
      const [nextDashboard, nextPlan, nextSummary, nextSchedule, nextManagement] = await Promise.all([
        fetchDashboard({ period: dashboardPeriod }).catch(() => null),
        fetchPlan(planDate).catch(() => null),
        fetchWorkSummary().catch(() => null),
        fetchWorkSchedule(planDate).catch(() => null),
        canManage ? fetchManagementDashboard(period).catch(() => null) : Promise.resolve(null),
      ]);

      if (!active) return;
      setDashboard(nextDashboard);
      setPlan(nextPlan);
      setSummary(nextSummary);
      setSchedule(nextSchedule);
      setManagement(nextManagement);
      if (!nextDashboard && !nextPlan && !nextSummary && !nextManagement) {
        setError("Не удалось загрузить данные дашборда. Проверь API или авторизацию в CRM.");
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [period, canManage, reloadToken]);

  const leadTotal = management?.manager_rows.reduce((sum, row) => sum + row.new_leads, 0) ?? dashboard?.new_leads_count ?? summary?.leads_total ?? 0;
  const dealsCount = management?.money.deals_count ?? dashboard?.deals_count ?? 0;
  const turnover = management?.money.deal_amount_total ?? dashboard?.deal_amount_total ?? 0;
  const commission = management?.money.commission_total ?? dashboard?.commission_total ?? plan?.actual_total ?? 0;
  const activePotential = management?.operational.active_potential_commission ?? 0;
  const activeBalance = management?.operational.active_balance ?? 0;
  const paymentRisk = (management?.operational.payments_overdue_amount ?? 0) + (management?.operational.payments_soon_amount ?? 0);
  const periodLabel = management?.period.label ?? PERIOD_OPTIONS.find((item) => item.code === period)?.label ?? "Период";
  const planProgress = progressPercent(plan?.actual_total ?? commission, plan?.target_total ?? COMMISSION_TARGET);

  const managerRows: ManagerPerformanceRow[] = useMemo(() => {
    if (management?.manager_rows?.length) return management.manager_rows;
    return (plan?.rows ?? []).map((row) => ({
      manager_id: row.manager_id,
      manager_name: row.manager_name,
      active: 0,
      new_leads: 0,
      sold: 0,
      commission: row.actual,
      conversion_percent: 0,
      overdue_contacts: 0,
      overdue_payments: 0,
      lost: 0,
      failed: 0,
      target: row.target,
      actual: row.actual,
      percent: row.percent,
      salary: row.salary,
    }));
  }, [management, plan]);

  const funnelRows: FunnelRow[] = useMemo(() => {
    if (dashboard?.conversion?.length) {
      return dashboard.conversion.map((row) => ({ label: row.status_display, value: row.count }));
    }
    return (management?.status_rows ?? []).map((row) => ({ label: row.status_display, value: row.count }));
  }, [dashboard, management]);

  const sourceRows: FunnelRow[] = useMemo(
    () => (management?.source_rows ?? []).map((row) => ({ label: row.source_display, value: row.count })),
    [management]
  );

  const reasonRows: FunnelRow[] = useMemo(
    () => (management?.reason_rows ?? []).map((row) => ({ label: row.reason || "Причина не указана", value: row.count })),
    [management]
  );

  const dailyRows: DailyPoint[] = useMemo(() => {
    if (management?.daily_rows?.length) {
      return management.daily_rows.slice(-12).map((row) => ({
        label: formatShortDate(row.date),
        leads: row.leads,
        deals: row.deals,
        commission: row.commission,
      }));
    }
    return (dashboard?.daily_dynamics ?? []).slice(-12).map((row) => ({
      label: formatShortDate(row.date),
      leads: row.count,
      deals: 0,
      commission: 0,
    }));
  }, [dashboard, management]);

  const operations = management?.operational;
  const criticalActions = [
    { label: "Контакты просрочены", value: operations?.contacts_overdue ?? 0, icon: Clock3, tone: "warm" as Tone },
    { label: "Платежи просрочены", value: operations?.payments_overdue_count ?? 0, icon: WalletCards, tone: "warm" as Tone },
    { label: "Без следующего касания", value: operations?.no_next_contact ?? 0, icon: AlertTriangle, tone: "sand" as Tone },
    { label: "Документы к выдаче", value: operations?.docs_to_issue ?? 0, icon: FileText, tone: "sea" as Tone },
    { label: "Вылеты скоро", value: operations?.departures_soon ?? 0, icon: Plane, tone: "sage" as Tone },
  ];

  return (
    <div className="min-h-full rounded-[36px] bg-[#F4EFE7] text-[#292725]">
      <div className="relative overflow-hidden rounded-[36px]">
        <div className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[#AAC8C3]/40 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#C98563]/25 blur-3xl" />
        <div className="relative mx-auto max-w-[1520px] p-4 sm:p-6 lg:p-8">
          <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="overflow-hidden bg-[#292725] p-6 text-white sm:p-8">
              <div className="absolute right-8 top-8 hidden text-white/10 md:block">
                <Plane size={170} strokeWidth={1.2} />
              </div>
              <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                    <Sparkles size={15} /> Executive dashboard
                  </div>
                  <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
                    Управленческая панель турагентства
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-white/64 sm:text-base">
                    Видно главное: лиды, продажи, комиссия, деньги в работе, просрочки, команда, источники и направления. Страница работает на текущих данных CRM.
                  </p>
                </div>
                <div className="grid min-w-[260px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <ControlPill label="Период" value={periodLabel} tone="sand" />
                  <ControlPill label="План комиссии" value={formatPercent(planProgress)} tone="sage" />
                </div>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#684B38]/55">Режим контроля</p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold text-[#292725]">Фокус руководителя</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setReloadToken((value) => value + 1)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#684B38]/10 bg-white px-4 py-2 text-xs font-semibold text-[#684B38] transition hover:bg-[#F4EFE7]"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Обновить
                </button>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setPeriod(option.code)}
                    className={cx(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      period === option.code ? "border-[#B96F4E] bg-[#B96F4E] text-white shadow-[0_14px_34px_rgba(185,111,78,0.28)]" : "border-[#684B38]/10 bg-[#F4EFE7]/70 text-[#292725] hover:bg-white"
                    )}
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className={cx("mt-1 block text-xs", period === option.code ? "text-white/70" : "text-[#292725]/45")}>{option.note}</span>
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-[#F4EFE7]/80 p-4 text-sm text-[#292725]/60">
                {loading ? "Загружаю показатели…" : `Обновлено: ${new Date().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
              </div>
            </Card>
          </div>

          {error && (
            <div className="mb-6 rounded-3xl border border-[#B96F4E]/20 bg-[#B96F4E]/10 p-4 text-sm font-medium text-[#8A4A32]">
              {error}
            </div>
          )}

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Новые заявки" value={formatNumber(leadTotal)} caption="входящий поток за период" icon={Users} targetLabel={`план ${formatNumber(LEADS_TARGET)}`} progress={progressPercent(leadTotal, LEADS_TARGET)} tone="sea" />
            <MetricCard title="Проданные туры" value={formatNumber(dealsCount)} caption="подтвержденные продажи" icon={Luggage} targetLabel={`план ${formatNumber(DEALS_TARGET)}`} progress={progressPercent(dealsCount, DEALS_TARGET)} tone="warm" />
            <MetricCard title="Оборот" value={formatMoney(turnover)} caption="стоимость реализованных туров" icon={CircleDollarSign} targetLabel={formatMoney(TOUR_AMOUNT_TARGET)} progress={progressPercent(turnover, TOUR_AMOUNT_TARGET)} tone="sage" />
            <MetricCard title="Комиссия" value={formatMoney(commission)} caption="валовая комиссия офиса" icon={TrendingUp} targetLabel={formatMoney(plan?.target_total ?? COMMISSION_TARGET)} progress={planProgress} tone="sand" />
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
            <Card className="p-5 sm:p-6">
              <SectionTitle
                title="Динамика продаж"
                subtitle="Сравнение входящих заявок и закрытых продаж по датам"
                action={<span className="inline-flex items-center gap-2 rounded-full bg-[#F4EFE7] px-4 py-2 text-xs font-semibold text-[#684B38]"><LineChart size={15} /> live CRM</span>}
              />
              <MiniTrendChart rows={dailyRows} />
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionTitle title="Деньги в работе" subtitle="Что влияет на кассовый поток" />
              <div className="grid gap-3">
                <div className="rounded-3xl bg-[#234B52] p-5 text-white">
                  <p className="text-sm text-white/62">Потенциальная комиссия активных заявок</p>
                  <p className="mt-2 font-serif text-4xl font-semibold">{formatMoney(activePotential)}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ControlPill label="Остаток к оплате" value={formatMoney(activeBalance)} tone="sea" />
                  <ControlPill label="Платежи в зоне внимания" value={formatMoney(paymentRisk)} tone="warm" />
                </div>
              </div>
            </Card>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="p-5 sm:p-6">
              <SectionTitle title="Операционный контроль" subtitle="Красные зоны, которые требуют касания сегодня" />
              <div className="grid gap-3 sm:grid-cols-2">
                {criticalActions.map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="rounded-3xl border border-[#684B38]/10 bg-[#F4EFE7]/72 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Icon size={21} style={{ color: toneColor(tone) }} />
                      <span className="font-serif text-3xl font-semibold text-[#292725]">{formatNumber(value)}</span>
                    </div>
                    <p className="mt-3 text-sm text-[#292725]/60">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/crm/leads" className="inline-flex items-center gap-2 rounded-full bg-[#292725] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#684B38]">
                  Перейти к заявкам <ArrowRight size={16} />
                </Link>
                <Link href="/crm/kanban" className="inline-flex items-center gap-2 rounded-full border border-[#684B38]/15 px-4 py-2 text-sm font-semibold text-[#684B38] transition hover:bg-white">
                  Канбан <Layers3 size={16} />
                </Link>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionTitle title="Воронка заявок" subtitle="Где сейчас сосредоточен поток клиентов" />
              <BarList rows={funnelRows} emptyText="Нет данных по воронке за выбранный период." color={COLORS.sea} />
            </Card>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <SectionTitle title="Команда и результат" subtitle="Продажи, комиссия, конверсия и риски по менеджерам" />
              <ManagerTable rows={managerRows} />
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionTitle title="Источники лидов" subtitle="Что приводит заявки и где видна отдача" />
              <BarList rows={sourceRows} emptyText="Нет данных по источникам. Для расширенной аналитики нужен управленческий доступ." color={COLORS.terracotta} />
            </Card>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-5 sm:p-6">
              <SectionTitle title="Направления" subtitle="Куда продаются туры за выбранный период" action={<Compass className="text-[#B96F4E]" size={24} />} />
              <DirectionDonut data={dashboard} />
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionTitle title="Причины потерь" subtitle="Материал для корректировки рекламы, скриптов и подборок" />
              <BarList rows={reasonRows} emptyText="Нет зафиксированных причин потерь за выбранный период." color={COLORS.sage} />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className="p-5 sm:p-6">
              <SectionTitle title="График офиса" subtitle="Кто работает в ТЦ «Проспект» по дням месяца" action={<CalendarDays className="text-[#234B52]" size={24} />} />
              <WorkScheduleCalendar schedule={schedule} />
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionTitle title="Управленческие выводы" subtitle="На что смотреть в первую очередь" />
              <div className="space-y-3">
                <div className="rounded-3xl bg-[#292725] p-5 text-white">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={21} className="text-[#AAC8C3]" />
                    <p className="font-semibold">Темп месяца</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    Комиссия закрыта на {formatPercent(planProgress)} от плана. Приоритет — довести активные заявки до оплаты и снять просроченные касания.
                  </p>
                </div>
                <div className="rounded-3xl border border-[#684B38]/10 bg-[#F4EFE7]/75 p-5">
                  <div className="flex items-center gap-3 text-[#684B38]">
                    <Route size={21} />
                    <p className="font-semibold">Маршрут действий</p>
                  </div>
                  <ol className="mt-3 space-y-2 text-sm leading-6 text-[#292725]/62">
                    <li>1. Проверить просроченные контакты и платежи.</li>
                    <li>2. Разобрать источники без продаж.</li>
                    <li>3. Дожать активные заявки с высокой комиссией.</li>
                    <li>4. Сверить график офиса и нагрузку менеджеров.</li>
                  </ol>
                </div>
                <Link href="/crm/management-dashboard" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#B96F4E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a65f40]">
                  Открыть старую управленческую панель <BarChart3 size={16} />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
