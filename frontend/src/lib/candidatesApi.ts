const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type Candidate = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  position: string;
  city: string;
  status: string;
  status_display: string;
  notes: string;
  created_at: string;
  consent_at: string;
  consent_version: string;
  pdf_url: string;
};

export const CANDIDATE_STATUSES = [
  ["new", "Новая анкета"], ["review", "На рассмотрении"],
  ["interview", "Собеседование"], ["hired", "Принят"], ["rejected", "Отказ"],
];

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method === "PATCH") {
    await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: "include" });
    const csrf = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
    if (csrf) headers.set("X-CSRFToken", decodeURIComponent(csrf[1]));
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include", cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || "Не удалось выполнить запрос. Попробуйте ещё раз.");
  return json;
}

export function listCandidates(params: { search: string; status: string; page: number }, signal?: AbortSignal) {
  const query = new URLSearchParams({ search: params.search, status: params.status, page: String(params.page) });
  return request<{ count: number; results: Candidate[] }>(`/api/crm/candidates/?${query}`, { signal });
}

export function updateCandidate(id: string, data: { status: string; notes: string }) {
  return request<Candidate>(`/api/crm/candidates/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export function candidatePdfUrl(candidate: Candidate, download = false) {
  return `${API_BASE}${candidate.pdf_url}${download ? "?download=1" : ""}`;
}
