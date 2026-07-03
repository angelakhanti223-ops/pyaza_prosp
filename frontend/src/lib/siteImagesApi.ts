// Server components fetch this from inside the frontend container, which must
// reach the backend over the Docker network — see articlesApi.ts for the
// same internal/public split rationale.
const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000"
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type SiteImages = {
  hero_background: string | null;
  why_us_solo: string | null;
  why_us_family: string | null;
  why_us_cruise: string | null;
  why_us_excursion: string | null;
  why_us_support: string | null;
  office_photo: string | null;
};

const EMPTY: SiteImages = {
  hero_background: null,
  why_us_solo: null,
  why_us_family: null,
  why_us_cruise: null,
  why_us_excursion: null,
  why_us_support: null,
  office_photo: null,
};

// Media URLs render as <img src> in the browser, so — same reasoning as
// articlesApi.mediaUrl — always normalize to the public-facing origin.
export function siteImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) {
    return path.replace(/^https?:\/\/[^/]+/, PUBLIC_API_BASE_URL);
  }
  return `${PUBLIC_API_BASE_URL}${path}`;
}

export async function fetchSiteImages(): Promise<SiteImages> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/site-images/`, { cache: "no-store" });
    if (!res.ok) return EMPTY;
    return res.json();
  } catch {
    return EMPTY;
  }
}
