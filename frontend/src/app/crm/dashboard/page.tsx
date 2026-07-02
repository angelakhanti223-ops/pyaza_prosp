"use client";

import { useEffect, useState } from "react";
import { fetchDashboard, type DashboardData } from "@/lib/dashboardApi";
import { listManagers, type CrmUser } from "@/lib/crmApi";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import SimpleBarChart from "@/components/dashboard/SimpleBarChart";

const PERIODS: { value: string; label: string }[] = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

export default function CrmDashboardPage() {
  const { user } = useCrmAuth();
  const isHead = user?.is_head ?? false;

  const [period, setPeriod] = useState("30d");
  const [managerId, setManagerId] = useState<string>("");
  const [managers, setManagers] = useState<CrmUser[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isHead) listManagers().then(setManagers);
  }, [isHead]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      setLoading(true);
      fetchDashboard({ period, manager: managerId ? Number(managerId) : undefined }).then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [period, managerId]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-navy">
          Дашборд {data?.scope === "department" ? "отдела" : "менеджера"}
        </h1>

        <div className="flex gap-2">
          {isHead && (
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            >
              <option value="">Весь отдел</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          )}
          <div className="flex overflow-hidden rounded-xl border border-black/10 bg-white text-sm">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3.5 py-2 ${period === p.value ? "bg-navy text-white" : "text-navy/70 hover:bg-blue-light"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading || !data ? (
        <p className="text-sm text-foreground/50">Загрузка…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <p className="text-xs text-foreground/50">Новых заявок за период</p>
              <p className="mt-1 text-2xl font-bold text-navy">{data.new_leads_count}</p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <p className="text-xs text-foreground/50">Сумма сделок (оплачено)</p>
              <p className="mt-1 text-2xl font-bold text-navy">{formatMoney(data.deal_amount_total)}</p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <p className="text-xs text-foreground/50">Комиссия</p>
              <p className="mt-1 text-2xl font-bold text-gold">{formatMoney(data.commission_total)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-navy">Заявки по статусам воронки</h2>
              <div className="flex flex-col gap-2">
                {data.leads_by_status.map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/70">{row.status_display}</span>
                    <span className="font-semibold text-navy">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-navy">Конверсия по этапам воронки</h2>
              <div className="flex flex-col gap-3">
                {data.conversion.map((row) => (
                  <div key={row.status}>
                    <div className="flex items-center justify-between text-xs text-foreground/60">
                      <span>{row.status_display}</span>
                      <span>
                        {row.count} · {row.percent}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-blue-light">
                      <div className="h-full rounded-full bg-blue" style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-navy">Динамика заявок по дням</h2>
            <SimpleBarChart
              data={data.daily_dynamics.map((d) => ({
                label: new Date(d.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
                value: d.count,
              }))}
            />
          </div>

          {data.commission_by_manager && (
            <div className="rounded-2xl border border-black/5 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-navy">Комиссия по менеджерам</h2>
              {data.commission_by_manager.length === 0 ? (
                <p className="text-sm text-foreground/40">Нет оплаченных заявок за период</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-foreground/50">
                    <tr>
                      <th className="pb-2 font-medium">Менеджер</th>
                      <th className="pb-2 font-medium">Сделок</th>
                      <th className="pb-2 font-medium">Комиссия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commission_by_manager.map((row) => (
                      <tr key={row.manager_id} className="border-t border-black/5">
                        <td className="py-2 text-navy">{row.manager_name}</td>
                        <td className="py-2 text-foreground/70">{row.deals}</td>
                        <td className="py-2 font-semibold text-gold">{formatMoney(row.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
