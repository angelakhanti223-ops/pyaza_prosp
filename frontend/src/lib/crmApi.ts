import type { ArticleCategory, ArticleTag } from "./articlesApi";
import type { UonLeadRecord, UonRequestRecord } from "./uonApi";

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
  uon_request_id: string;
  initial_comment: string;
  consent_personal_data_at: string | null;
  updated_at: string;
  comments: LeadComment[];
  status_history: LeadStatusHistoryEntry[];
  attachments: LeadAttachment[];
  tasks: LeadTask[];
  uon_sync_logs: LeadUonSyncLog[];
  uon_lead: UonLeadRecord | null;
  uon_request: UonRequestRecord | null;
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
    // DRF returns either {"detail": "..."} for non-field errors, or
    // {"field": ["message", ...], ...} for validation errors — surface the
    // real message either way instead of a generic fallback.
    const fieldErrors = Object.values(data).flat().filter((v): v is string => typeof v === "string");
    throw new Error(data.detail || fieldErrors.join(" ") || "Ошибка запроса");
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

export async function createLead(data: {
  name: string;
  phone: string;
  email?: string;
  direction?: number | null;
  initial_comment?: string;
  source?: string;
  assigned_manager?: number | null;
  consent: boolean;
}): Promise<LeadDetail> {
  return apiJson<LeadDetail>("/api/crm/leads/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateLead(
  id: number,
  data: Partial<{
    name: string;
    phone: string;
    email: string;
    direction: number | null;
    initial_comment: string;
    status: LeadStatus;
    assigned_manager: number;
    deal_amount: string;
    commission: string;
  }>
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

export async function triggerUonSync(): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>("/api/crm/integrations/uon-sync/", { method: "POST" });
}

export async function createUonRequest(leadId: number): Promise<LeadDetail> {
  return apiJson<LeadDetail>(`/api/crm/leads/${leadId}/create-uon-request/`, { method: "POST" });
}

export async function pushUonRequestUpdate(
  requestRecordId: number,
  data: Partial<{ status_id: string; manager_id: string; reservation_number: string }>
): Promise<UonRequestRecord> {
  return apiJson<UonRequestRecord>(`/api/crm/uon/requests/${requestRecordId}/push-update/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- База знаний ---

export type KnowledgeArticleListItem = {
  id: number;
  title: string;
  direction: number | null;
  direction_name: string | null;
  author: CrmUser | null;
  updated_at: string;
};

export type KnowledgeArticleDetail = KnowledgeArticleListItem & {
  content: string;
  created_at: string;
};

export async function listKnowledgeArticles(): Promise<KnowledgeArticleListItem[]> {
  const data = await apiJson<KnowledgeArticleListItem[] | { results: KnowledgeArticleListItem[] }>(
    "/api/crm/knowledge-base/"
  );
  return Array.isArray(data) ? data : data.results;
}

export async function getKnowledgeArticle(id: number): Promise<KnowledgeArticleDetail> {
  return apiJson<KnowledgeArticleDetail>(`/api/crm/knowledge-base/${id}/`);
}

export async function createKnowledgeArticle(data: {
  title: string;
  direction?: number | null;
  content: string;
}): Promise<KnowledgeArticleDetail> {
  return apiJson<KnowledgeArticleDetail>("/api/crm/knowledge-base/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateKnowledgeArticle(
  id: number,
  data: Partial<{ title: string; direction: number | null; content: string }>
): Promise<KnowledgeArticleDetail> {
  return apiJson<KnowledgeArticleDetail>(`/api/crm/knowledge-base/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeArticle(id: number): Promise<void> {
  await apiJson<void>(`/api/crm/knowledge-base/${id}/`, { method: "DELETE" });
}

// --- Статьи (публичный блог сайта) ---

export type ArticleStatus = "draft" | "published" | "archived";

export const ARTICLE_STATUS_OPTIONS: { value: ArticleStatus; label: string }[] = [
  { value: "draft", label: "Черновик" },
  { value: "published", label: "Опубликовано" },
  { value: "archived", label: "Архив" },
];

export type ArticleCrmListItem = {
  id: number;
  title: string;
  slug: string;
  status: ArticleStatus;
  status_display: string;
  category: number | null;
  category_name: string | null;
  author: CrmUser | null;
  published_at: string | null;
  updated_at: string;
};

export type ArticleCrmDetail = ArticleCrmListItem & {
  excerpt: string;
  content: string;
  featured_image: string | null;
  tags: ArticleTag[];
  seo_title: string;
  seo_description: string;
  og_image: string | null;
  created_at: string;
};

export type ArticleCrmInput = {
  title: string;
  slug?: string;
  category?: number | null;
  tag_names?: string[];
  excerpt?: string;
  content: string;
  featured_image?: File | null;
  status: ArticleStatus;
  published_at?: string | null;
  seo_title?: string;
  seo_description?: string;
  og_image?: File | null;
};

function articleFormData(data: ArticleCrmInput): FormData {
  const formData = new FormData();
  formData.append("title", data.title);
  if (data.slug) formData.append("slug", data.slug);
  if (data.category != null) formData.append("category", String(data.category));
  for (const name of data.tag_names ?? []) formData.append("tag_names", name);
  formData.append("excerpt", data.excerpt ?? "");
  formData.append("content", data.content);
  if (data.featured_image) formData.append("featured_image", data.featured_image);
  formData.append("status", data.status);
  if (data.published_at) formData.append("published_at", data.published_at);
  formData.append("seo_title", data.seo_title ?? "");
  formData.append("seo_description", data.seo_description ?? "");
  if (data.og_image) formData.append("og_image", data.og_image);
  return formData;
}

export async function listCrmArticles(): Promise<ArticleCrmListItem[]> {
  const data = await apiJson<ArticleCrmListItem[] | { results: ArticleCrmListItem[] }>("/api/crm/articles/");
  return Array.isArray(data) ? data : data.results;
}

export async function getCrmArticle(id: number): Promise<ArticleCrmDetail> {
  return apiJson<ArticleCrmDetail>(`/api/crm/articles/${id}/`);
}

export async function createCrmArticle(data: ArticleCrmInput): Promise<ArticleCrmDetail> {
  return apiJson<ArticleCrmDetail>("/api/crm/articles/", { method: "POST", body: articleFormData(data) });
}

export async function updateCrmArticle(id: number, data: ArticleCrmInput): Promise<ArticleCrmDetail> {
  return apiJson<ArticleCrmDetail>(`/api/crm/articles/${id}/`, { method: "PATCH", body: articleFormData(data) });
}

export async function deleteCrmArticle(id: number): Promise<void> {
  await apiJson<void>(`/api/crm/articles/${id}/`, { method: "DELETE" });
}

export async function listArticleCategoriesForCrm(): Promise<ArticleCategory[]> {
  return apiJson<ArticleCategory[]>("/api/articles/categories/");
}

export async function createArticleCategory(name: string): Promise<ArticleCategory> {
  return apiJson<ArticleCategory>("/api/crm/articles/categories/", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

// --- Команда (публичная страница «Команда») ---

export type TeamMemberCrm = {
  id: number;
  name: string;
  role: string;
  bio: string;
  photo: string | null;
  phone: string;
  email: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TeamMemberInput = {
  name: string;
  role: string;
  bio?: string;
  photo?: File | null;
  phone?: string;
  email?: string;
  order?: number;
  is_active?: boolean;
};

function teamMemberFormData(data: TeamMemberInput): FormData {
  const formData = new FormData();
  formData.append("name", data.name);
  formData.append("role", data.role);
  formData.append("bio", data.bio ?? "");
  if (data.photo) formData.append("photo", data.photo);
  formData.append("phone", data.phone ?? "");
  formData.append("email", data.email ?? "");
  formData.append("order", String(data.order ?? 0));
  formData.append("is_active", String(data.is_active ?? true));
  return formData;
}

export async function listCrmTeamMembers(): Promise<TeamMemberCrm[]> {
  const data = await apiJson<TeamMemberCrm[] | { results: TeamMemberCrm[] }>("/api/crm/team/");
  return Array.isArray(data) ? data : data.results;
}

export async function getCrmTeamMember(id: number): Promise<TeamMemberCrm> {
  return apiJson<TeamMemberCrm>(`/api/crm/team/${id}/`);
}

export async function createCrmTeamMember(data: TeamMemberInput): Promise<TeamMemberCrm> {
  return apiJson<TeamMemberCrm>("/api/crm/team/", { method: "POST", body: teamMemberFormData(data) });
}

export async function updateCrmTeamMember(id: number, data: TeamMemberInput): Promise<TeamMemberCrm> {
  return apiJson<TeamMemberCrm>(`/api/crm/team/${id}/`, { method: "PATCH", body: teamMemberFormData(data) });
}

export async function deleteCrmTeamMember(id: number): Promise<void> {
  await apiJson<void>(`/api/crm/team/${id}/`, { method: "DELETE" });
}

// --- Сертификаты (публичная страница «Сертификаты») ---

export type CertificateCrm = {
  id: number;
  title: string;
  image: string;
  description: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CertificateInput = {
  title: string;
  image?: File | null;
  description?: string;
  order?: number;
  is_active?: boolean;
};

function certificateFormData(data: CertificateInput): FormData {
  const formData = new FormData();
  formData.append("title", data.title);
  if (data.image) formData.append("image", data.image);
  formData.append("description", data.description ?? "");
  formData.append("order", String(data.order ?? 0));
  formData.append("is_active", String(data.is_active ?? true));
  return formData;
}

export async function listCrmCertificates(): Promise<CertificateCrm[]> {
  const data = await apiJson<CertificateCrm[] | { results: CertificateCrm[] }>("/api/crm/certificates/");
  return Array.isArray(data) ? data : data.results;
}

export async function getCrmCertificate(id: number): Promise<CertificateCrm> {
  return apiJson<CertificateCrm>(`/api/crm/certificates/${id}/`);
}

export async function createCrmCertificate(data: CertificateInput): Promise<CertificateCrm> {
  return apiJson<CertificateCrm>("/api/crm/certificates/", { method: "POST", body: certificateFormData(data) });
}

export async function updateCrmCertificate(id: number, data: CertificateInput): Promise<CertificateCrm> {
  return apiJson<CertificateCrm>(`/api/crm/certificates/${id}/`, { method: "PATCH", body: certificateFormData(data) });
}

export async function deleteCrmCertificate(id: number): Promise<void> {
  await apiJson<void>(`/api/crm/certificates/${id}/`, { method: "DELETE" });
}
