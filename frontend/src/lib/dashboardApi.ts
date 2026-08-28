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

export type DashboardDirectionRow = {
  direction: string;
  count: number;
};

export type DashboardData = {
  new_leads_count: number;
  leads_by_status: DashboardStatusRow[];
  conversion: DashboardConversionRow[];
  commission_total: number;
  deal_amount_total: number;
  deals_count: number;
  avg_deal_amount: number;
  avg_commission: number;
  by_direction: DashboardDirectionRow[];
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

export type PlanRow = {
  manager_id: number;
  manager_name: string;
  target: number;
  actual: number;
  percent: number;
  salary: number;
};

export type PlanData = {
  year: number;
  month: number;
  rows: PlanRow[];
  target_total: number;
  actual_total: number;
};

export async function fetchPlan(params: { year?: number; month?: number } = {}): Promise<PlanData> {
  const qs = new URLSearchParams();
  if (params.year) qs.set("year", String(params.year));
  if (params.month) qs.set("month", String(params.month));

  const res = await fetch(`${API_BASE_URL}/api/crm/plan/?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error("Не удалось загрузить план");
  return res.json();
}

export type WorkSummaryLeadRow = {
  status: string;
  status_display: string;
  count: number;
};

export type WorkSummaryRequestRow = {
  status_name: string;
  count: number;
};

export type WorkSummaryData = {
  leads_total: number;
  leads_by_status: WorkSummaryLeadRow[];
  requests_total: number;
  requests_by_status: WorkSummaryRequestRow[];
  tasks: { today: number; overdue: number };
};

export async function fetchWorkSummary(): Promise<WorkSummaryData> {
  const res = await fetch(`${API_BASE_URL}/api/crm/summary/`, { credentials: "include" });
  if (!res.ok) throw new Error("Не удалось загрузить сводку");
  return res.json();
}
