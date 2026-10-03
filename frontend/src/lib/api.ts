// Client components normally call the public API host from NEXT_PUBLIC_API_BASE_URL.
// In production, if this variable is missing or accidentally points to localhost,
// use same-origin /api/* instead: Caddy proxies /api/* to the backend.
function browserApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  if (typeof window === "undefined") return configured;

  const isLocalPage = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const pointsToLocalhost = configured.includes("localhost") || configured.includes("127.0.0.1");

  if (!configured) return isLocalPage ? "http://localhost:8000" : "";
  if (!isLocalPage && pointsToLocalhost) return "";

  return configured.replace(/\/$/, "");
}

const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000"
    : browserApiBaseUrl();

export type Direction = {
  id: number;
  name: string;
};

export type TeamMember = {
  id: number;
  name: string;
  role: string;
  bio: string;
  photo: string | null;
  phone: string;
  email: string;
};

export type Certificate = {
  id: number;
  title: string;
  image: string;
  description: string;
};

export type LeadPayload = {
  name: string;
  phone: string;
  email?: string;
  direction?: number | null;
  initial_comment?: string;
  consent: boolean;
  source?: "site_form" | "chatbot";
};

export type SubscribePayload = {
  email: string;
  name?: string;
  consent: boolean;
};

class ApiError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    super("Ошибка отправки формы");
    this.fieldErrors = fieldErrors;
  }
}

async function postJson<T>(path: string, payload: T): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data);
  }
}

export async function fetchDirections(): Promise<Direction[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/directions/`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/team/`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchCertificates(): Promise<Certificate[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/certificates/`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export function createLead(payload: LeadPayload) {
  return postJson("/api/leads/", payload);
}

export function subscribe(payload: SubscribePayload) {
  return postJson("/api/subscribe/", payload);
}

export { ApiError };
