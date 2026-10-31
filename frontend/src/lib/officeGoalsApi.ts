import { apiJson } from "./crmApi";

export type OfficeGoalActivity = { id: string; completed: boolean; title: string; target: string; note: string; category: "development" | "product" | "operators" | "social" | "control" };
export type OfficeGoalsData = {
  year: number;
  month: number;
  targets: { turnover: number; receipts: number; leads: number; conversion: number; commissionRate: number | null; russianExpress: number | null; resortSpace: number | null; articles: number | null };
  commission_basis: "cash_receipts" | "bookings";
  commission_receipts_actual: number | null;
  activities: OfficeGoalActivity[];
};

export async function fetchOfficeGoals(month: { year: number; month: number }): Promise<OfficeGoalsData> {
  const qs = new URLSearchParams({ year: String(month.year), month: String(month.month) });
  return apiJson<OfficeGoalsData>(`/api/crm/office-goals/?${qs}`, { cache: "no-store" });
}

export async function updateOfficeGoals(month: { year: number; month: number }, values: { activity_id?: string; completed?: boolean; commission_receipts_actual?: string | null }): Promise<OfficeGoalsData> {
  const qs = new URLSearchParams({ year: String(month.year), month: String(month.month) });
  return apiJson<OfficeGoalsData>(`/api/crm/office-goals/?${qs}`, { method: "PATCH", body: JSON.stringify(values) });
}
