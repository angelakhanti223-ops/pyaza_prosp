// Client components always run in the browser, where API_BASE_URL must be the
// public-facing host. Server components (e.g. fetchDirections called from a
// page.tsx) run inside the frontend container and need the Docker-internal
// host instead — see articlesApi.ts for the same split.
const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000"
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type Direction = {
  id: number;
  name: string;
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

export function createLead(payload: LeadPayload) {
  return postJson("/api/leads/", payload);
}

export function subscribe(payload: SubscribePayload) {
  return postJson("/api/subscribe/", payload);
}

export { ApiError };
