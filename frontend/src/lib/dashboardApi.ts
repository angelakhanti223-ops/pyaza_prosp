const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type DashboardStatusRow = {
  status: string;
  status_display: string;
  count: number;
};

export type DashboardConversionRow = DashboardStatusRow & {
  percent: number;
};

export type DashboardDailyRow = {
  date: string;
  count: number;
};

export type DashboardManagerCommission = {
  manager_id: number;
  manager_name: string;
  commission: number;
  deals: number;
};

export type DashboardData = {
  new_leads_count: number;
  leads_by_status: DashboardStatusRow[];
  conversion: DashboardConversionRow[];
  commission_total: number;
  deal_amount_total: number;
  daily_dynamics: DashboardDailyRow[];
  period: { from: string; to: string };
  scope: "personal" | "department";
  commission_by_manager?: DashboardManagerCommission[];
};

export async function fetchDashboard(params: { period?: string; manager?: number } = {}): Promise<DashboardData> {
  const qs = new URLSearchParams();
  qs.set("period", params.period ?? "30d");
  if (params.manager) qs.set("manager", String(params.manager));

  const res = await fetch(`${API_BASE_URL}/api/crm/dashboard/?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error("Не удалось загрузить дашборд");
  return res.json();
}
