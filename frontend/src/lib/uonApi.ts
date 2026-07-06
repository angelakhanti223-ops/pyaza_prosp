const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type UonRequestRecord = {
  id: number;
  uon_id: string;
  name: string;
  phone: string;
  email: string;
  status_name: string;
  manager_name: string;
  source_name: string;
  comment: string;
  uon_created_at: string | null;
  synced_at: string;
};

export type UonDealRecord = {
  id: number;
  uon_id: string;
  name: string;
  status_name: string;
  manager_name: string;
  amount: string | null;
  request_uon_id: string;
  uon_created_at: string | null;
  synced_at: string;
};

export type UonClientRecord = {
  id: number;
  uon_id: string;
  name: string;
  phone: string;
  email: string;
  uon_created_at: string | null;
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

export function listUonRequests(): Promise<UonRequestRecord[]> {
  return listAll<UonRequestRecord>("/api/crm/uon/requests/");
}

export function listUonDeals(): Promise<UonDealRecord[]> {
  return listAll<UonDealRecord>("/api/crm/uon/deals/");
}

export function listUonClients(): Promise<UonClientRecord[]> {
  return listAll<UonClientRecord>("/api/crm/uon/clients/");
}
