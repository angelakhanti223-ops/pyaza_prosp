const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ManagementPeriod = "current_week" | "current_month" | "last_month" | "current_year";

export type ManagementOperational = {
  tasks_today: number;
  tasks_overdue: number;
  contacts_today: number;
  contacts_overdue: number;
  no_next_contact: number;
  payments_soon_count: number;
  payments_soon_amount: number;
  payments_overdue_count: number;
  payments_overdue_amount: number;
  departures_soon: number;
  docs_to_issue: number;
  active_potential_commission: number;
  active_balance: number;
  no_manager: number;
};

export type ManagementMoney = {
  commission_total: number;
  deal_amount_total: number;
  deals_count: number;
  active_period_count: number;
};

export type ManagementManagerRow = {
  manager_id: number | null;
  manager_name: string;
  active: number;
  new_leads: number;
  overdue_contacts: number;
  overdue_payments: number;
  sold: number;
  commission: number;
  lost: number;
  failed: number;
};

export type ManagementStatusRow = {
  status: string;
  status_display: string;
  count: number;
};

export type ManagementSourceRow = {
  source: string;
  source_display: string;
  count: number;
  sold: number;
  commission: number;
};

export type ManagementReasonRow = {
  reason: string;
  count: number;
};

export type ManagementDashboardData = {
  period: { code: ManagementPeriod; label: string; from: string; to: string };
  operational: ManagementOperational;
  money: ManagementMoney;
  manager_rows: ManagementManagerRow[];
  status_rows: ManagementStatusRow[];
  source_rows: ManagementSourceRow[];
  reason_rows: ManagementReasonRow[];
};

export async function fetchManagementDashboard(period: ManagementPeriod): Promise<ManagementDashboardData> {
  const qs = new URLSearchParams({ period });
  const res = await fetch(`${API_BASE_URL}/api/crm/management-dashboard/?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error("Не удалось загрузить управленческий дашборд");
  return res.json();
}
