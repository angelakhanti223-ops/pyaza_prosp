const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type CrmUser = {
  id: number;
  username: string;
  full_name: string;
  role: "manager" | "head";
  is_head: boolean;
};

export type LeadStatus =
  | "new"
  | "in_progress"
  | "options_proposed"
  | "booked"
  | "paid"
  | "closed_won"
  | "closed_lost";

export const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "options_proposed", label: "Предложены варианты" },
  { value: "booked", label: "Бронь" },
  { value: "paid", label: "Оплачено" },
  { value: "closed_won", label: "Закрыта (успех)" },
  { value: "closed_lost", label: "Закрыта (отказ)" },
];

export type LeadListItem = {
  id: number;
  name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  status_display: string;
  source: string;
  source_display: string;
  direction: number | null;
  direction_name: string | null;
  assigned_manager: CrmUser | null;
  deal_amount: string | null;
  commission: string | null;
  created_at: string;
};

export type LeadComment = {
  id: number;
  author: CrmUser | null;
  text: string;
  created_at: string;
};

export type LeadStatusHistoryEntry = {
  id: number;
  old_status: LeadStatus | "";
  old_status_display: string;
  new_status: LeadStatus;
  new_status_display: string;
  changed_by: CrmUser | null;
  changed_at: string;
};

export type LeadAttachment = {
  id: number;
  file: string;
  uploaded_by: CrmUser | null;
  uploaded_at: string;
};

export type LeadTask = {
  id: number;
  title: string;
  column: string;
  deadline: string | null;
};

export type LeadUonSyncLog = {
  id: number;
  status: "pending" | "success" | "failed";
  status_display: string;
  attempt_number: number;
  error_message: string;
  created_at: string;
};

export type LeadDetail = LeadListItem & {
  uon_ticket_id: string;
  initial_comment: string;
  consent_personal_data_at: string | null;
  updated_at: string;
  comments: LeadComment[];
  status_history: LeadStatusHistoryEntry[];
  attachments: LeadAttachment[];
  tasks: LeadTask[];
  uon_sync_logs: LeadUonSyncLog[];
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

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await apiFetch(path, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Ошибка запроса");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(username: string, password: string): Promise<CrmUser> {
  await ensureCsrfCookie();
  return apiJson<CrmUser>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<void> {
  await apiJson("/api/auth/logout/", { method: "POST" });
}

export async function fetchMe(): Promise<CrmUser | null> {
  const res = await apiFetch("/api/auth/me/", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function listManagers(): Promise<CrmUser[]> {
  return apiJson<CrmUser[]>("/api/managers/");
}

export async function listLeads(params: { status?: string; search?: string } = {}): Promise<LeadListItem[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const data = await apiJson<LeadListItem[] | { results: LeadListItem[] }>(`/api/crm/leads/${query}`);
  return Array.isArray(data) ? data : data.results;
}

export async function getLead(id: number): Promise<LeadDetail> {
  return apiJson<LeadDetail>(`/api/crm/leads/${id}/`);
}

export async function updateLead(
  id: number,
  data: Partial<{ status: LeadStatus; assigned_manager: number; deal_amount: string; commission: string }>
): Promise<LeadDetail> {
  return apiJson<LeadDetail>(`/api/crm/leads/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function addLeadComment(id: number, text: string): Promise<LeadComment> {
  return apiJson<LeadComment>(`/api/crm/leads/${id}/comments/`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function uploadLeadAttachment(id: number, file: File): Promise<LeadAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  return apiJson<LeadAttachment>(`/api/crm/leads/${id}/attachments/`, {
    method: "POST",
    body: formData,
  });
}

export function mediaUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}
