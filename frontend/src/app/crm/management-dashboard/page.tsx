"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Plane, WalletCards } from "lucide-react";
import {
  fetchManagementDashboard,
  type ManagementDashboardData,
  type ManagementPeriod,
} from "@/lib/managementDashboardApi";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";

const PERIODS: { value: ManagementPeriod; label: string }[] = [
  { value: "current_week", label: "Неделя" },
  { value: "current_month", label: "Месяц" },
  { value: "last_month", label: "Прошлый месяц" },
  { value: "current_year", label: "Год" },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0) + " ₽";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value || 0);
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
  icon?: ReactNode;
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-navy">{title}</h2>
      {children}
    </section>
  );
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

  if (!canView) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-6">
        <h1 className="text-xl font-bold text-navy">Управленческий дашборд</h1>
        <p className="mt-2 text-sm text-foreground/60">Этот раздел доступен руководителю, admin и Елене.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Управленческий дашборд</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Деньги считаются по выбранному периоду: неделя, текущий месяц, прошлый месяц или год.
          </p>
          {data && (
            <p className="mt-1 text-xs text-foreground/45">
              Период: {data.period.label} · {new Date(data.period.from).toLocaleDateString("ru-RU")} — {new Date(data.period.to).toLocaleDateString("ru-RU")}
            </p>
          )}
        </div>

        <div className="flex overflow-hidden rounded-xl border border-black/10 bg-white text-sm">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              className={`px-3.5 py-2 ${period === item.value ? "bg-navy text-white" : "text-navy/70 hover:bg-blue-light"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {loading || !data ? (
        <p className="text-sm text-foreground/50">Загрузка управленческого дашборда…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Задачи сегодня" value={data.operational.tasks_today} subtitle="невыполненные задачи на сегодня" href="/crm/leads?task_filter=today" icon={<CalendarClock size={18} />} />
            <StatCard title="Просроченные задачи" value={data.operational.tasks_overdue} subtitle="требуют немедленной реакции" href="/crm/leads?task_filter=overdue" tone={data.operational.tasks_overdue > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
            <StatCard title="Контакты сегодня" value={data.operational.contacts_today} subtitle="по дате следующего контакта" href="/crm/leads" icon={<CalendarClock size={18} />} />
            <StatCard title="Просроченные контакты" value={data.operational.contacts_overdue} subtitle="есть риск потери заявки" href="/crm/leads" tone={data.operational.contacts_overdue > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Оплаты до 7 дней" value={data.operational.payments_soon_count} subtitle={formatMoney(data.operational.payments_soon_amount)} href="/crm/leads" tone="warning" icon={<WalletCards size={18} />} />
            <StatCard title="Просроченные оплаты" value={data.operational.payments_overdue_count} subtitle={formatMoney(data.operational.payments_overdue_amount)} href="/crm/leads" tone={data.operational.payments_overdue_count > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
            <StatCard title="Вылеты до 7 дней" value={data.operational.departures_soon} subtitle="проверить документы и связь" href="/crm/leads" icon={<Plane size={18} />} />
            <StatCard title="Документы к выдаче" value={data.operational.docs_to_issue} subtitle="по ближайшим вылетам" href="/crm/leads" tone="warning" icon={<CheckCircle2 size={18} />} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Комиссия за период" value={formatMoney(data.money.commission_total)} subtitle="по первому денежному статусу" tone="money" />
            <StatCard title="Продано за период" value={data.money.deals_count} subtitle={formatMoney(data.money.deal_amount_total)} tone="money" />
            <StatCard title="Потенциал активных" value={formatMoney(data.operational.active_potential_commission)} subtitle="комиссия в незакрытых заявках" tone="money" />
            <StatCard title="Остаток к оплате" value={formatMoney(data.operational.active_balance)} subtitle="по активным заявкам" tone="money" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section title="Где застряли заявки">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatCard title="Без следующего контакта" value={data.operational.no_next_contact} subtitle="в рабочих статусах" href="/crm/leads" tone={data.operational.no_next_contact > 0 ? "warning" : "success"} />
                <StatCard title="Без ответственного" value={data.operational.no_manager} subtitle="нужно назначить менеджера" href="/crm/leads" tone={data.operational.no_manager > 0 ? "warning" : "success"} />
                <StatCard title="Активные за период" value={data.money.active_period_count} subtitle="созданы в выбранном периоде" href="/crm/leads" />
                <StatCard title="Причины потерь" value={data.reason_rows.reduce((sum, row) => sum + row.count, 0)} subtitle="закрытые в выбранном периоде" />
              </div>
            </Section>

            <Section title="Воронка за выбранный период">
              <div className="flex flex-col gap-2">
                {data.status_rows.length === 0 && <p className="text-sm text-foreground/45">Нет заявок за выбранный период.</p>}
                {data.status_rows.map((row) => (
                  <Link key={row.status} href={`/crm/leads?status=${row.status}`} className="flex items-center justify-between rounded-xl bg-blue-light/35 px-3 py-2 text-sm hover:bg-blue-light">
                    <span className="text-foreground/70">{row.status_display}</span>
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
                    <th className="pb-3 text-right">Активные сейчас</th>
                    <th className="pb-3 text-right">Новые за период</th>
                    <th className="pb-3 text-right">Проср. контакты</th>
                    <th className="pb-3 text-right">Проср. оплаты</th>
                    <th className="pb-3 text-right">Продажи за период</th>
                    <th className="pb-3 text-right">Комиссия за период</th>
                    <th className="pb-3 text-right">Неусп./провал</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {data.manager_rows.map((row) => (
                    <tr key={`${row.manager_id ?? "none"}-${row.manager_name}`}>
                      <td className="py-3 font-medium text-navy">{row.manager_name}</td>
                      <td className="py-3 text-right">{row.active}</td>
                      <td className="py-3 text-right">{row.new_leads}</td>
                      <td className={`py-3 text-right ${row.overdue_contacts > 0 ? "font-semibold text-red-600" : ""}`}>{row.overdue_contacts}</td>
                      <td className={`py-3 text-right ${row.overdue_payments > 0 ? "font-semibold text-red-600" : ""}`}>{row.overdue_payments}</td>
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
                {data.source_rows.length === 0 && <p className="text-sm text-foreground/45">Нет источников за выбранный период.</p>}
                {data.source_rows.map((row) => (
                  <div key={row.source} className="rounded-xl bg-blue-light/30 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-navy">{row.source_display}</span>
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

            <Section title="Причины потерь за период">
              {data.reason_rows.length === 0 ? (
                <p className="text-sm text-foreground/45">Пока нет закрытых заявок с причинами потерь.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.reason_rows.map((row) => (
                    <div key={row.reason} className="flex items-center justify-between rounded-xl bg-blue-light/30 px-3 py-2 text-sm">
                      <span className="text-foreground/75">{row.reason}</span>
                      <span className="font-semibold text-navy">{row.count}</span>
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
