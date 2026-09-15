const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000"
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type HotelDetail = { label: string; value: string };

export type Hotel = {
  id: number;
  name: string;
  brand: string;
  brand_group: string;
  country: string;
  region: string;
  location: string;
  category: string;
  status: string;
  rooms: string;
  room_min: string;
  room_types: string;
  meals: string;
  beach: string;
  pools: string;
  kids: string;
  spa: string;
  restaurants: string;
  deposit: string;
  transfer: string;
  russian_staff: string;
  news: string;
  best_for: string;
  not_for: string;
  usp: string[];
  details: HotelDetail[];
  webinar_numbers: number[];
  presentations: string[];
  f_all_inclusive: boolean;
  f_kids_friendly: boolean;
  f_beach: boolean;
  f_spa: boolean;
  f_russian_staff: boolean;
  f_has_presentation: boolean;
  status_flag: string;
  photo: string | null;
};

export type CountryEmirate = { name: string; desc: string };
export type CountryHighlight = { name: string; type: string; emirate: string; desc: string };
export type CountryEvent = { name: string; when: string; desc: string };
export type CountryActivity = { name: string; desc: string };

export type Country = {
  id: number;
  name: string;
  capital: string;
  visa: string;
  currency: string;
  language: string;
  flight: string;
  season: string;
  alcohol: string;
  dress_code: string;
  transport: string;
  safety: string;
  geography: string;
  emirates: CountryEmirate[];
  highlights: CountryHighlight[];
  events: CountryEvent[];
  activities: CountryActivity[];
  selling_points: string[];
  news: string[];
  practical: string[];
  webinar_numbers: number[];
  presentations: string[];
};

export type Airline = {
  id: number;
  name: string;
  country: string;
  hub: string;
  routes_from_russia: string;
  network: string;
  fleet: string;
  classes: string;
  baggage: string;
  loyalty: string;
  stopover: string;
  lounges: string;
  onboard: string;
  notes: string[];
  webinar_numbers: number[];
  presentations: string[];
};

export type Webinar = {
  number: number;
  title: string;
  url: string;
  src: string;
  presentation: string;
};

export type RixosDossier = {
  title: string;
  brand_overview: string;
  concepts: string[];
  kids_programs: string[];
  entertainment: string[];
  hotels_list: string[];
  selling_points: string[];
  news: string[];
};

export type DatasetMeta = {
  built: string;
  source: string;
  presentations_count: number;
  note: string;
};

export type MideastMeta = {
  rixos: RixosDossier;
  dataset: DatasetMeta;
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Не удалось загрузить ${path}`);
  return res.json();
}

export function fetchHotels(): Promise<Hotel[]> {
  return fetchJson<Hotel[]>("/api/mideast/hotels/");
}

export function fetchCountries(): Promise<Country[]> {
  return fetchJson<Country[]>("/api/mideast/countries/");
}

export function fetchAirlines(): Promise<Airline[]> {
  return fetchJson<Airline[]>("/api/mideast/airlines/");
}

export function fetchWebinars(): Promise<Webinar[]> {
  return fetchJson<Webinar[]>("/api/mideast/webinars/");
}

export function fetchMideastMeta(): Promise<MideastMeta> {
  return fetchJson<MideastMeta>("/api/mideast/meta/");
}
