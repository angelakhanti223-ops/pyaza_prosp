import { apiJson, type CrmUser } from "./crmApi";
import type { KanbanTask } from "./kanbanApi";

export type TravelTrip = {
  key: string; lead_id: number | null; uon_id: string | null; name: string; phone: string;
  direction: string; departure_city: string; departure_date: string | null; return_date: string | null;
  departure_source: "crm" | "uon" | null;
  return_source: "crm" | "uon_tour_end" | "estimated_nights" | null;
  manager_id: number | null; manager_name: string; status: string; task_ids: number[]; href: string;
  issue?: string;
};
export type TaskBucket = "overdue" | "today" | "period" | "no_deadline" | "all";
export type OperationsDashboard = {
  generated_at: string; today: string;
  period: { start: string; end: string; days: number; timezone: string };
  departures: TravelTrip[]; returns: TravelTrip[]; missing_dates: TravelTrip[];
  tasks: KanbanTask[]; task_buckets: Record<TaskBucket, number[]>;
  counts: Record<TaskBucket | "departures" | "returns" | "documents" | "missing_dates", number>;
  managers: CrmUser[];
};

export function getOperationsDashboard(params: { days: number; start?: string; assignee?: string }): Promise<OperationsDashboard> {
  const query = new URLSearchParams({ days: String(params.days) });
  if (params.start) query.set("start", params.start);
  if (params.assignee) query.set("assignee", params.assignee);
  return apiJson(`/api/crm/operations/?${query}`, { cache: "no-store" });
}

export function operationTasks(data: OperationsDashboard, filter: TaskBucket | "urgent" | "documents") {
  if (filter === "documents") return data.tasks.filter(task => task.purpose === "documents");
  const ids = new Set(filter === "urgent"
    ? [...data.task_buckets.overdue, ...data.task_buckets.today]
    : data.task_buckets[filter]);
  return data.tasks.filter(task => ids.has(task.id));
}
