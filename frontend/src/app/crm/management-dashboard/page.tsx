"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Plane, WalletCards } from "lucide-react";
import { fetchDashboard, fetchPlan, fetchWorkSummary, type DashboardData, type PlanData, type WorkSummaryData } from "@/lib/dashboardApi";
import { listLeads, STATUS_OPTIONS, type LeadListItem, type LeadStatus } from "@/lib/crmApi";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";

const CLOSED_STATUSES: LeadStatus[] = ["closed_won", "closed_lost", "failed", "not_target"];
const MONEY_STATUSES: LeadStatus[] = ["prepaid", "paid", "closed_won"];
const WORK_STATUSES: LeadStatus[] = ["new", "follow_up", "in_progress", "selection", "options_proposed", "booked", "prepaid", "waiting_payment"];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value) + " ₽";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(23, 59, 59, 999);
  return next;
}

function asDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isToday(value: string | null) {
  const date = asDate(value);
  if (!date) return false;
  return date >= startOfToday() && date <= endOfToday();
}

function isPast(value: string | null) {
  const date = asDate(value);
  return Boolean(date && date.getTime() < Date.now());
}

function isWithinDays(value: string | null, days: number) {
  const date = asDate(value);
  if (!date) return false;
  const start = startOfToday();
  const end = addDays(start, days);
  return date >= start && date <= end;
}

function canViewManagementDashboard(user: { username: string; full_name: string; is_head: boolean } | null | undefined) {
  const username = user?.username?.toLowerCase() ?? "";
  const fullName = user?.full_name?.toLowerCase() ?? "";
  return Boolean(user?.is_head || username === "admin" || username === "elena" || fullName.includes("елена"));
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
  tone?: "default" | "danger" | "warning" | "success" | "money";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "danger" ? "border-red-100 bg-red-50 text-red-700" :
    tone === "warning" ? "border-orange-100 bg-orange-50 text-orange-700" :
    tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" :
    tone === "money" ? "border-gold/20 bg-gold/10 text-navy" :
    "border-black/5 bg-white text-navy";

  const content = (
    <div className={`rounded-2xl border p-5 transition ${toneClass} ${href ? "hover:-translate-y-0.5 hover:shadow-sm" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-65">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
        </div>
        {icon && <div className="rounded-full bg-white/70 p-2 opacity-80">{icon}</div>}
      </div>
      {subtitle && <p className="mt-2 text-xs opacity-70">{subtitle}</p>}
      {href && <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold opacity-80">Открыть список <ArrowRight size={13} /></p>}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-navy">{title}</h2>
      {children}
    </section>
  );
}

export default function ManagementDashboardPage() {
  const { user } = useCrmAuth();
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [summary, setSummary] = useState<WorkSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const canView = canViewManagementDashboard(user);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    setLoading(true);
    Promise.all([listLeads(), fetchDashboard(), fetchPlan(), fetchWorkSummary()])
      .then(([leadRows, dashboardData, planData, summaryData]) => {
        if (!active) return;
        setLeads(leadRows);
        setDashboard(dashboardData);
        setPlan(planData);
        setSummary(summaryData);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView]);

  const metrics = useMemo(() => {
    const activeLeads = leads.filter((lead) => !CLOSED_STATUSES.includes(lead.status));
    const workableLeads = leads.filter((lead) => WORK_STATUSES.includes(lead.status));
    const contactsToday = workableLeads.filter((lead) => isToday(lead.next_contact_at));
    const contactsOverdue = workableLeads.filter((lead) => isPast(lead.next_contact_at));
    const noNextContact = workableLeads.filter((lead) => !lead.next_contact_at && ["follow_up", "in_progress", "selection", "options_proposed"].includes(lead.status));
    const paymentsSoon = activeLeads.filter((lead) => isWithinDays(lead.full_payment_due_at, 7));
    const paymentsOverdue = activeLeads.filter((lead) => isPast(lead.full_payment_due_at));
    const departuresSoon = activeLeads.filter((lead) => isWithinDays(lead.departure_date, 7));
    const docsToIssue = departuresSoon.filter((lead) => ["paid", "departure", "check_in", "waiting_payment"].includes(lead.status));
    const activePotentialCommission = activeLeads.reduce((sum, lead) => sum + toNumber(lead.commission), 0);
    const activeBalance = activeLeads.reduce((sum, lead) => sum + toNumber(lead.balance_due), 0);
    const overdueBalance = paymentsOverdue.reduce((sum, lead) => sum + toNumber(lead.balance_due), 0);
    const soonBalance = paymentsSoon.reduce((sum, lead) => sum + toNumber(lead.balance_due), 0);
    const noManager = leads.filter((lead) => !lead.assigned_manager);
    const lost = leads.filter((lead) => lead.status === "closed_lost");
    const failed = leads.filter((lead) => lead.status === "failed");

    return {
      activeLeads,
      contactsToday,
      contactsOverdue,
      noNextContact,
      paymentsSoon,
      paymentsOverdue,
      departuresSoon,
      docsToIssue,
      activePotentialCommission,
      activeBalance,
      overdueBalance,
      soonBalance,
      noManager,
      lost,
      failed,
    };
  }, [leads]);

  const managerRows = useMemo(() => {
    const map = new Map<string, {
      name: string;
      active: number;
      newLeads: number;
      overdueContacts: number;
      overduePayments: number;
      sold: number;
      commission: number;
      lost: number;
      failed: number;
    }>();

    for (const lead of leads) {
      const key = lead.assigned_manager?.id ? String(lead.assigned_manager.id) : "no-manager";
      const name = lead.assigned_manager?.full_name || "Не назначен";
      const row = map.get(key) ?? { name, active: 0, newLeads: 0, overdueContacts: 0, overduePayments: 0, sold: 0, commission: 0, lost: 0, failed: 0 };
      if (!CLOSED_STATUSES.includes(lead.status)) row.active += 1;
      if (lead.status === "new") row.newLeads += 1;
      if (isPast(lead.next_contact_at)) row.overdueContacts += 1;
      if (isPast(lead.full_payment_due_at)) row.overduePayments += 1;
      if (MONEY_STATUSES.includes(lead.status)) row.sold += 1;
      if (MONEY_STATUSES.includes(lead.status)) row.commission += toNumber(lead.commission);
      if (lead.status === "closed_lost") row.lost += 1;
      if (lead.status === "failed") row.failed += 1;
      map.set(key, row);
    }

    return Array.from(map.values()).sort((a, b) => b.commission - a.commission || b.active - a.active);
  }, [leads]);

  const sourceRows = useMemo(() => {
    const map = new Map<string, { source: string; count: number; sold: number; commission: number }>();
    for (const lead of leads) {
      const key = lead.source_display || "Не указан";
      const row = map.get(key) ?? { source: key, count: 0, sold: 0, commission: 0 };
      row.count += 1;
      if (MONEY_STATUSES.includes(lead.status)) {
        row.sold += 1;
        row.commission += toNumber(lead.commission);
      }
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => b.commission - a.commission || b.count - a.count).slice(0, 8);
  }, [leads]);

  const reasonRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of leads.filter((item) => ["closed_lost", "failed", "not_target"].includes(item.status))) {
      const reason = lead.failure_reason?.trim() || "Причина не указана";
      map.set(reason, (map.get(reason) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [leads]);

  const statusLabel = useMemo(() => Object.fromEntries(STATUS_OPTIONS.map((item) => [item.value, item.label])), []);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-6">
        <h1 className="text-xl font-bold text-navy">Управленческий дашборд</h1>
        <p className="mt-2 text-sm text-foreground/60">Этот раздел доступен руководителю, admin и Елене.</p>
      </div>
    );
  }

  if (loading) return <p className="text-sm text-foreground/50">Загрузка управленческого дашборда…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Управленческий дашборд</h1>
        <p className="mt-1 text-xs text-foreground/50">
          Операционный экран: задачи, контакты, оплаты, вылеты, деньги, менеджеры и причины потерь.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Задачи сегодня" value={summary?.tasks.today ?? 0} subtitle="невыполненные задачи на сегодня" href="/crm/leads?task_filter=today" icon={<CalendarClock size={18} />} />
        <StatCard title="Просроченные задачи" value={summary?.tasks.overdue ?? 0} subtitle="требуют немедленной реакции" href="/crm/leads?task_filter=overdue" tone={(summary?.tasks.overdue ?? 0) > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
        <StatCard title="Контакты сегодня" value={metrics.contactsToday.length} subtitle="по дате следующего контакта" href="/crm/leads" icon={<CalendarClock size={18} />} />
        <StatCard title="Просроченные контакты" value={metrics.contactsOverdue.length} subtitle="есть риск потери заявки" href="/crm/leads" tone={metrics.contactsOverdue.length > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Оплаты до 7 дней" value={metrics.paymentsSoon.length} subtitle={formatMoney(metrics.soonBalance)} href="/crm/leads" tone="warning" icon={<WalletCards size={18} />} />
        <StatCard title="Просроченные оплаты" value={metrics.paymentsOverdue.length} subtitle={formatMoney(metrics.overdueBalance)} href="/crm/leads" tone={metrics.paymentsOverdue.length > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
        <StatCard title="Вылеты до 7 дней" value={metrics.departuresSoon.length} subtitle="проверить документы и связь" href="/crm/leads" icon={<Plane size={18} />} />
        <StatCard title="Документы к выдаче" value={metrics.docsToIssue.length} subtitle="по ближайшим вылетам" href="/crm/leads" tone="warning" icon={<CheckCircle2 size={18} />} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Комиссия за месяц" value={formatMoney(dashboard?.commission_total ?? 0)} subtitle="засчитанная комиссия" tone="money" />
        <StatCard title="Потенциал активных" value={formatMoney(metrics.activePotentialCommission)} subtitle="комиссия в незакрытых заявках" tone="money" />
        <StatCard title="Остаток к оплате" value={formatMoney(metrics.activeBalance)} subtitle="по активным заявкам" tone="money" />
        <StatCard title="План / факт" value={`${formatMoney(plan?.actual_total ?? 0)} / ${formatMoney(plan?.target_total ?? 0)}`} subtitle="по офису за месяц" tone="money" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Где застряли заявки">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard title="Без следующего контакта" value={metrics.noNextContact.length} subtitle="в рабочих статусах" href="/crm/leads" tone={metrics.noNextContact.length > 0 ? "warning" : "success"} />
            <StatCard title="Без ответственного" value={metrics.noManager.length} subtitle="нужно назначить менеджера" href="/crm/leads" tone={metrics.noManager.length > 0 ? "warning" : "success"} />
            <StatCard title="Неуспешные" value={metrics.lost.length} subtitle="клиент не купил" href="/crm/leads?status=closed_lost" />
            <StatCard title="Проваленные" value={metrics.failed.length} subtitle="ошибка процесса" href="/crm/leads?status=failed" tone={metrics.failed.length > 0 ? "danger" : "success"} />
          </div>
        </Section>

        <Section title="Воронка в работе">
          <div className="flex flex-col gap-2">
            {dashboard?.leads_by_status.filter((row) => row.count > 0).map((row) => (
              <Link key={row.status} href={`/crm/leads?status=${row.status}`} className="flex items-center justify-between rounded-xl bg-blue-light/35 px-3 py-2 text-sm hover:bg-blue-light">
                <span className="text-foreground/70">{statusLabel[row.status] ?? row.status_display}</span>
                <span className="font-semibold text-navy">{row.count}</span>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Менеджеры: продажи и дисциплина">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-foreground/45">
              <tr>
                <th className="pb-3">Менеджер</th>
                <th className="pb-3 text-right">Активные</th>
                <th className="pb-3 text-right">Новые</th>
                <th className="pb-3 text-right">Проср. контакты</th>
                <th className="pb-3 text-right">Проср. оплаты</th>
                <th className="pb-3 text-right">Продажи</th>
                <th className="pb-3 text-right">Комиссия</th>
                <th className="pb-3 text-right">Неусп./провал</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {managerRows.map((row) => (
                <tr key={row.name}>
                  <td className="py-3 font-medium text-navy">{row.name}</td>
                  <td className="py-3 text-right">{row.active}</td>
                  <td className="py-3 text-right">{row.newLeads}</td>
                  <td className={`py-3 text-right ${row.overdueContacts > 0 ? "font-semibold text-red-600" : ""}`}>{row.overdueContacts}</td>
                  <td className={`py-3 text-right ${row.overduePayments > 0 ? "font-semibold text-red-600" : ""}`}>{row.overduePayments}</td>
                  <td className="py-3 text-right">{row.sold}</td>
                  <td className="py-3 text-right font-semibold text-navy">{formatMoney(row.commission)}</td>
                  <td className="py-3 text-right">{row.lost} / {row.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Источники заявок: количество и деньги">
          <div className="flex flex-col gap-2">
            {sourceRows.map((row) => (
              <div key={row.source} className="rounded-xl bg-blue-light/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-navy">{row.source}</span>
                  <span className="text-foreground/60">{formatNumber(row.count)} заявок</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-foreground/50">
                  <span>Продаж: {row.sold}</span>
                  <span className="font-semibold text-gold">{formatMoney(row.commission)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Причины потерь">
          {reasonRows.length === 0 ? (
            <p className="text-sm text-foreground/45">Пока нет закрытых заявок с причинами потерь.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {reasonRows.map((row) => (
                <div key={row.reason} className="flex items-center justify-between rounded-xl bg-blue-light/30 px-3 py-2 text-sm">
                  <span className="text-foreground/75">{row.reason}</span>
                  <span className="font-semibold text-navy">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
