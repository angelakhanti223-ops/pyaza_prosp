const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// "Заявка" в U-ON (/request) — рабочая сделка с полным пайплайном (статус,
// бронирование, ...), появляется, когда менеджер начинает вести обращение.
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

// "Обращение" в U-ON (/lead) — самая ранняя стадия контакта, отдельная сущность
// от заявки со своей последовательностью ID.
export type UonLeadRecord = {
  id: number;
  uon_id: string;
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

// Собирается из tourists[] заявки (самый полный источник данных о человеке
// в API U-ON) либо, если туристов нет (обращения/lead), из основных client_*-полей.
export type UonClientRecord = {
  id: number;
  uon_id: string;
  name: string;
  surname: string;
  patronymic: string;
  name_en: string;
  surname_en: string;
  phone: string;
  phone_home: string;
  email: string;
  sex: string;
  birthday: string | null;
  passport_number: string;
  passport_issued_by: string;
  passport_date: string | null;
  zagran_number: string;
  zagran_expire: string | null;
  address: string;
  company: string;
  inn: string;
  telegram: string;
  whatsapp: string;
  viber: string;
  social_vk: string;
  instagram: string;
  country: string;
  city: string;
  nationality: string;
  notes: string;
  is_main_contact: boolean;
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

export function listUonLeads(): Promise<UonLeadRecord[]> {
  return listAll<UonLeadRecord>("/api/crm/uon/leads/");
}

export function listUonClients(): Promise<UonClientRecord[]> {
  return listAll<UonClientRecord>("/api/crm/uon/clients/");
}
