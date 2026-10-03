"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Coins,
  FileText,
  Phone,
  Plane,
  Plus,
  Search,
  Target,
  Users,
  WalletCards,
} from "lucide-react";
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
} from "@/lib/managementDashboardApi";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";

const COLORS = {
  ivory: "#F4EFE7",
  linen: "#D8C8B6",
  sand: "#B7A48F",
  terracotta: "#B96F4E",
  clay: "#C98563",
  brown: "#684B38",
  charcoal: "#292725",
  deepSea: "#234B52",
  seaGlass: "#AAC8C3",
  sage: "#7C8A6A",
};

const MONTH_LABELS = [
  "", "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

const MONTH_GENITIVE = [
  "", "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const MANAGER_COLORS = ["#684B38", "#B96F4E", "#234B52", "#7C8A6A"];
const LEADS_TARGET = 200;
const DEALS_TARGET = 30;
const TOUR_AMOUNT_TARGET = 4_000_000;
const COMMISSION_TARGET = 200_000;
const SALARY_FUND_TARGET = 90_000;

function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0) + " ₽";
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0);
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

function percent(value: number, target: number): number {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

function metricPercent(value: number, target: number): number {
  return Math.min(percent(value, target), 120);
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-[#684B38]/10 bg-white/76 shadow-[0_18px_60px_rgba(41,39,37,0.07)] backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#292725]">{title}</h2>
      {action}
    </div>
  );
}

function Progress({ value, color = COLORS.terracotta }: { value: number; color?: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-[#D8C8B6]/55">
      <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }} />
    </div>
  );
}

function SparkBars({ tone = "warm" }: { tone?: "warm" | "sea" }) {
  const heights = [14, 18, 11, 24, 31, 39];
  const color = tone === "sea" ? COLORS.deepSea : COLORS.terracotta;
  return (
    <div className="flex h-12 items-end gap-1.5">
      {heights.map((height, index) => (
        <span
          key={index}
          className="w-1.5 rounded-full opacity-75"
          style={{ height, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  planLabel,
  progress,
  tone = "warm",
  detail,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  planLabel: string;
  progress: number;
  tone?: "warm" | "sea";
  detail?: string;
}) {
  const color = tone === "sea" ? COLORS.deepSea : COLORS.terracotta;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFE7] text-[#B96F4E] shadow-inner">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-[#292725]/72">{title}</p>
            <p className="mt-1 font-serif text-4xl font-semibold leading-none text-[#292725]">{value}</p>
            {detail && <p className="mt-2 text-xs text-[#292725]/48">{detail}</p>}
          </div>
        </div>
        <SparkBars tone={tone} />
      </div>
      <div className="mt-5 rounded-2xl bg-[#F4EFE7]/80 p-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-[#684B38]"><Target size={17} /> {planLabel}</span>
          <span className="font-semibold text-[#292725]">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} color={color} />
      </div>
    </Card>
  );
}

function MiniLineChart({ rows }: { rows: { label: string; leads: number; deals: number }[] }) {
  const width = 720;
  const height = 210;
  const padding = 24;
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.leads, row.deals]));
  const toX = (index: number) => padding + (index * (width - padding * 2)) / Math.max(rows.length - 1, 1);
  const toY = (value: number) => height - padding - (value * (height - padding * 2)) / maxValue;
  const leadsPoints = rows.map((row, index) => `${toX(index)},${toY(row.leads)}`).join(" ");
  const dealsPoints = rows.map((row, index) => `${toX(index)},${toY(row.deals)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[700px]">
        {[0, 1, 2, 3].map((line) => {
          const y = padding + (line * (height - padding * 2)) / 3;
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#D8C8B6" strokeOpacity="0.5" />;
        })}
        <polyline fill="none" stroke={COLORS.deepSea} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={leadsPoints} />
        <polyline fill="none" stroke={COLORS.terracotta} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={dealsPoints} />
        {rows.map((row, index) => (
          <Fragment key={row.label}>
            <circle cx={toX(index)} cy={toY(row.leads)} r="5" fill={COLORS.deepSea} />
            <circle cx={toX(index)} cy={toY(row.deals)} r="5" fill={COLORS.terracotta} />
            <text x={toX(index)} y={height - 5} textAnchor="middle" fontSize="12" fill="#81766B">{row.label}</text>
          </Fragment>
        ))}
      </svg>
    </div>
  );
}

function Funnel({ data }: { data: DashboardData | null }) {
  const rows = (data?.conversion ?? []).filter((row) => row.count > 0).slice(0, 5);
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="text-sm text-[#292725]/45">Нет данных по воронке за период.</p>;
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div key={row.status} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
          <span className="truncate text-[#292725]/72">{row.status_display}</span>
          <div className="h-9 w-[180px] overflow-hidden rounded-full bg-[#F4EFE7]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(18, percent(row.count, max))}%`, backgroundColor: index < 2 ? COLORS.deepSea : index < 4 ? COLORS.sand : COLORS.terracotta }}
            />
          </div>
          <span className="min-w-9 text-right font-semibold text-[#292725]">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

function DirectionChart({ data }: { data: DashboardData | null }) {
  const rows = (data?.by_direction ?? []).slice(0, 6);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const colors = [COLORS.deepSea, COLORS.terracotta, COLORS.clay, COLORS.sand, COLORS.sage, COLORS.brown];
  if (!rows.length) return <p className="text-sm text-[#292725]/45">Нет продаж по направлениям за выбранный период.</p>;
  return (
    <div className="grid gap-5 md:grid-cols-[190px_1fr]">
      <div className="relative mx-auto h-44 w-44 rounded-full" style={{ background: `conic-gradient(${rows.map((row, index) => `${colors[index % colors.length]} ${percent(rows.slice(0, index).reduce((s, r) => s + r.count, 0), total)}% ${percent(rows.slice(0, index + 1).reduce((s, r) => s + r.count, 0), total)}%`).join(", ")})` }}>
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
            <span className="text-[#292725]/45">{percent(row.count, total)}%</span>
            <span className="font-semibold text-[#292725]">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkSchedule({ schedule }: { schedule: WorkScheduleData | null }) {
  if (!schedule || schedule.rows.length === 0) return <p className="text-sm text-[#292725]/45">График не заполнен.</p>;

  const today = todayIso();
  const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const managers = Array.from(new Map(schedule.rows.map((row) => [row.manager_id, row.manager_name])).entries())
    .map(([manager_id, manager_name]) => ({ manager_id, manager_name }));
  const workerByDate = new Map<string, number>();
  for (const row of schedule.rows) {
    const from = new Date(`${row.date_from}T00:00:00`);
    const to = new Date(`${row.date_to}T00:00:00`);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      workerByDate.set(isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()), row.manager_id);
    }
  }
  const todayManager = managers.find((manager) => manager.manager_id === workerByDate.get(today));

  return (
    <div>
      {todayManager && (
        <p className="mb-4 text-sm text-[#292725]/55">Сегодня работает: <span className="font-semibold text-[#684B38]">{todayManager.manager_name}</span></p>
      )}
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-grid min-w-[980px] items-center gap-2"
          style={{ gridTemplateColumns: `130px repeat(${daysInMonth}, minmax(24px, 1fr))` }}
        >
          <div />
          {days.map((day) => (
            <div key={day} className={`text-center text-[11px] font-semibold ${isoDate(schedule.year, schedule.month, day) === today ? "text-[#B96F4E]" : "text-[#81766B]"}`}>
              {day}
            </div>
          ))}
          {managers.map((manager, index) => (
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
                    className={`h-9 rounded-xl ${isToday ? "ring-2 ring-[#B96F4E] ring-offset-2" : ""}`}
                    style={{ backgroundColor: working ? MANAGER_COLORS[index % MANAGER_COLORS.length] : "rgba(216, 200, 182, 0.32)" }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-[#292725]/58">
        {managers.map((manager, index) => (
          <span key={manager.manager_id} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: MANAGER_COLORS[index % MANAGER_COLORS.length] }} />
            {manager.manager_name}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuickAction({ title, text, icon, href }: { title: string; text: string; icon: ReactNode; href: string }) {
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-2xl border border-[#684B38]/10 bg-white/65 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4EFE7] text-[#B96F4E]">{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold text-[#292725]">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-[#292725]/55">{text}</span>
      </span>
      <ArrowRight size={16} className="ml-auto mt-1 text-[#B96F4E] opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}

export default function NewDasbordPage() {
  const { user } = useCrmAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [summary, setSummary] = useState<WorkSummaryData | null>(null);
  const [schedule, setSchedule] = useState<WorkScheduleData | null>(null);
  const [management, setManagement] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchDashboard({ period: "current_month" }),
      fetchPlan(),
      fetchWorkSummary(),
      fetchManagementDashboard("current_month").catch(() => null),
    ]).then(([dashboard, planData, summaryData, managementData]) => {
      if (!active) return;
      setData(dashboard);
      setPlan(planData);
      setSummary(summaryData);
      setManagement(managementData);
      return fetchWorkSchedule({ year: dashboard.period.year, month: dashboard.period.month });
    }).then((scheduleData) => {
      if (active && scheduleData) setSchedule(scheduleData);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const salaryTotal = useMemo(() => (plan?.rows ?? []).reduce((sum, row) => sum + Number(row.salary || 0), 0), [plan]);
  const dailyRows = useMemo(() => {
    if (management?.daily_rows?.length) {
      return management.daily_rows.slice(-8).map((row) => ({
        label: new Date(row.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
        leads: row.leads,
        deals: row.deals,
      }));
    }
    return (data?.daily_dynamics ?? []).slice(-8).map((row) => ({
      label: new Date(row.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      leads: row.count,
      deals: 0,
    }));
  }, [data, management]);

  const payments = management?.drilldowns?.payments_soon?.rows?.slice(0, 3) ?? [];
  const userName = (user?.full_name || user?.username || "Елена").split(" ")[0];

  if (loading && !data) {
    return <div className="rounded-[32px] bg-[#F4EFE7] p-8 text-[#292725]/55">Загружаем новый дашборд…</div>;
  }

  return (
    <div className="min-h-full rounded-[34px] bg-[#F4EFE7] p-5 text-[#292725] shadow-inner sm:p-6">
      <div className="mb-6 grid gap-5 xl:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#81766B]">доброе утро,</p>
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <h1 className="font-serif text-5xl font-semibold leading-none tracking-tight text-[#292725]">{userName}</h1>
            <span className="text-3xl text-[#B96F4E]">☼</span>
          </div>
          <p className="mt-2 text-sm text-[#684B38]/72">Пусть сегодня будет много новых путешествий и счастливых клиентов.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-[320px] items-center gap-2 rounded-2xl border border-[#684B38]/10 bg-white/75 px-4 py-3 text-sm text-[#81766B] shadow-sm">
            <Search size={17} />
            Поиск по клиентам, заявкам, турам…
          </div>
          <Link href="/crm/leads/new" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#684B38] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(104,75,56,0.22)] transition hover:bg-[#292725]">
            <Plus size={18} /> Новая заявка
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard title="Лиды за месяц" value={formatNumber(data?.new_leads_count)} icon={<Users size={23} />} planLabel={`План: ${LEADS_TARGET} лидов`} progress={metricPercent(data?.new_leads_count ?? 0, LEADS_TARGET)} tone="sea" detail={data ? `${MONTH_LABELS[data.period.month]} ${data.period.year}` : undefined} />
        <MetricCard title="Продано туров" value={formatNumber(data?.deals_count)} icon={<Briefcase size={23} />} planLabel={`План: ${DEALS_TARGET} туров`} progress={metricPercent(data?.deals_count ?? 0, DEALS_TARGET)} detail={`Стоимость: ${formatMoney(data?.deal_amount_total)}`} />
        <MetricCard title="Комиссия" value={formatMoney(data?.commission_total)} icon={<Coins size={23} />} planLabel={`План: ${formatMoney(COMMISSION_TARGET)}`} progress={metricPercent(data?.commission_total ?? 0, COMMISSION_TARGET)} tone="sea" detail={`Средняя: ${formatMoney(data?.avg_commission)}`} />
        <MetricCard title="Зарплата" value={formatMoney(salaryTotal)} icon={<WalletCards size={23} />} planLabel={`План фонда: ${formatMoney(SALARY_FUND_TARGET)}`} progress={metricPercent(salaryTotal, SALARY_FUND_TARGET)} detail={(plan?.rows ?? []).length ? `${plan?.rows.length} сотрудника в плане` : "План не заполнен"} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <Card className="p-5">
          <SectionTitle title="Динамика: заявки / продажи" action={<span className="rounded-full bg-[#F4EFE7] px-3 py-2 text-xs font-semibold text-[#684B38]">Текущий месяц</span>} />
          <div className="mb-3 flex gap-4 text-xs text-[#292725]/55">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#234B52]" /> Заявки</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#B96F4E]" /> Продажи</span>
          </div>
          <MiniLineChart rows={dailyRows.length ? dailyRows : [{ label: "—", leads: 0, deals: 0 }]} />
        </Card>

        <Card className="p-5">
          <SectionTitle title="Воронка продаж" action={<span className="rounded-full bg-[#F4EFE7] px-3 py-2 text-xs font-semibold text-[#684B38]">За месяц</span>} />
          <Funnel data={data} />
        </Card>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.2fr]">
        <Card className="p-5">
          <SectionTitle title="Продажи по направлениям" />
          <DirectionChart data={data} />
        </Card>
        <Card className="p-5">
          <SectionTitle title="Рабочий график команды" action={<span className="rounded-full bg-[#F4EFE7] px-3 py-2 text-xs font-semibold text-[#684B38]">Сегодня</span>} />
          <WorkSchedule schedule={schedule} />
        </Card>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1fr_0.9fr]">
        <Card className="p-5">
          <SectionTitle title="Задачи на сегодня" action={<Link href="/crm/kanban" className="text-xs font-semibold text-[#B96F4E]">Смотреть все →</Link>} />
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-white/65 p-3"><span className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-[#7C8A6A]" /> Сегодня</span><b>{summary?.tasks.today ?? 0}</b></div>
            <div className="flex items-center justify-between rounded-2xl bg-white/65 p-3"><span className="inline-flex items-center gap-2"><CalendarDays size={17} className="text-[#B96F4E]" /> Просрочено</span><b>{summary?.tasks.overdue ?? 0}</b></div>
            <div className="flex items-center justify-between rounded-2xl bg-white/65 p-3"><span className="inline-flex items-center gap-2"><Plane size={17} className="text-[#234B52]" /> Заявки в работе</span><b>{summary?.requests_total ?? 0}</b></div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Быстрые действия" />
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickAction title="Выдать документы" text="Договоры, ваучеры, билеты клиенту" icon={<FileText size={21} />} href="/crm/management-dashboard" />
            <QuickAction title="Позвонить клиенту" text="Связаться и обсудить детали тура" icon={<Phone size={21} />} href="/crm/leads" />
            <QuickAction title="Ближайшие оплаты" text="Проверить оплаты и остатки" icon={<WalletCards size={21} />} href="/crm/management-dashboard" />
            <QuickAction title="Подобрать тур" text="Найти варианты и отправить клиенту" icon={<Plane size={21} />} href="/crm/leads/new" />
          </div>
        </Card>

        <Card className="overflow-hidden p-5">
          <SectionTitle title="Ближайшие оплаты" action={<Link href="/crm/management-dashboard" className="text-xs font-semibold text-[#B96F4E]">Смотреть все →</Link>} />
          {payments.length ? (
            <div className="flex flex-col gap-3">
              {payments.map((lead) => (
                <Link key={lead.id} href={`/crm/leads/${lead.id}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl bg-white/65 p-3 text-sm transition hover:bg-white">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[#292725]">{lead.name}</span>
                    <span className="text-xs text-[#292725]/45">{lead.full_payment_due_at ? new Date(lead.full_payment_due_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "без даты"}</span>
                  </span>
                  <span className="font-semibold text-[#292725]">{formatMoney(lead.balance_due)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-white/65 p-4 text-sm leading-6 text-[#292725]/55">Данные по ближайшим оплатам доступны руководителю в управленческом дашборде.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
