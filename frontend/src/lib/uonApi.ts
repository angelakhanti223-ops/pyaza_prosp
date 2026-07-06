const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// В API U-ON нет отдельного ресурса "сделка" — вся воронка (status_id/status) и
// данные клиента уже находятся прямо в объекте заявки (подтверждено на живом API).
export type UonRequestRecord = {
  id: number;
  uon_id: string;
  reservation_number: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  status_id: string;
  status_name: string;
  manager_name: string;
  source_name: string;
  notes: string;
  is_archive: boolean;
  uon_created_at: string | null;
  synced_at: string;
};

export type UonClientRecord = {
  id: number;
  uon_id: string;
  name: string;
  phone: string;
  email: string;
  synced_at: string;
};

async function apiJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Ошибка запроса");
  }
  return res.json();
}

async function listAll<T>(path: string): Promise<T[]> {
  const data = await apiJson<T[] | { results: T[] }>(path);
  return Array.isArray(data) ? data : data.results;
}

export function listUonRequests(params: { isArchive?: boolean } = {}): Promise<UonRequestRecord[]> {
  const qs = params.isArchive === undefined ? "" : `?is_archive=${params.isArchive ? "1" : "0"}`;
  return listAll<UonRequestRecord>(`/api/crm/uon/requests/${qs}`);
}

export function listUonClients(): Promise<UonClientRecord[]> {
  return listAll<UonClientRecord>("/api/crm/uon/clients/");
}
