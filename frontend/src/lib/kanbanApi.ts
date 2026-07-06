import type { CrmUser } from "./crmApi";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type KanbanColumn = {
  id: number;
  name: string;
  order: number;
};

export type TaskKind = "lead" | "appeal" | "general";
export type TaskPriority = "urgent_important" | "important" | null;

export type KanbanTask = {
  id: number;
  title: string;
  description: string;
  column: number;
  assignee: CrmUser | null;
  lead: number | null;
  lead_name: string | null;
  deadline: string | null;
  is_recurring: boolean;
  kind: TaskKind;
  priority: TaskPriority;
  order: number;
  created_at: string;
  updated_at: string;
};

export type TaskInput = {
  title: string;
  description?: string;
  column: number;
  assignee_id?: number | null;
  lead?: number | null;
  deadline?: string | null;
  is_recurring?: boolean;
};

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfCookie() {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (method !== "GET") {
    let csrfToken = getCookie("csrftoken");
    if (!csrfToken) {
      await ensureCsrfCookie();
      csrfToken = getCookie("csrftoken");
    }
    if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  }

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const res = await apiFetch(path, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Ошибка запроса");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function listColumns(): Promise<KanbanColumn[]> {
  return apiJson<KanbanColumn[]>("/api/crm/kanban/columns/");
}

export async function listTasks(params: { assignee?: number } = {}): Promise<KanbanTask[]> {
  const qs = new URLSearchParams();
  if (params.assignee) qs.set("assignee", String(params.assignee));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const data = await apiJson<KanbanTask[] | { results: KanbanTask[] }>(`/api/crm/kanban/tasks/${query}`);
  return Array.isArray(data) ? data : data.results;
}

export async function createTask(input: TaskInput): Promise<KanbanTask> {
  return apiJson<KanbanTask>("/api/crm/kanban/tasks/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTask(
  id: number,
  input: Partial<Omit<TaskInput, "column">>
): Promise<KanbanTask> {
  return apiJson<KanbanTask>(`/api/crm/kanban/tasks/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function moveTask(id: number, column: number, order: number): Promise<KanbanTask> {
  return apiJson<KanbanTask>(`/api/crm/kanban/tasks/${id}/move/`, {
    method: "POST",
    body: JSON.stringify({ column, order }),
  });
}

export async function deleteTask(id: number): Promise<void> {
  await apiJson(`/api/crm/kanban/tasks/${id}/`, { method: "DELETE" });
}
