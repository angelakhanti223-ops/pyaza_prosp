const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type SeaPhoto = {
  file: string;
  type: string;
  caption: string;
  is_render: boolean;
};

export function seaPhotoUrl(file: string): string {
  return `${API_BASE_URL}/media/sea/${file}`;
}

export type SeaContact = {
  id: string;
  name: string;
  role?: string;
  company?: string;
  represents?: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  telegram?: string;
  other_links?: string[] | string;
  notes?: string;
  needs_check?: string[] | string;
  hotel_ids?: string[];
};

export type SeaPerk = {
  type: string;
  title: string;
  description?: string;
  conditions?: string;
  valid_until?: string;
  how_to_get?: string;
};

export type SeaPerkGroup = {
  id: string;
  network: string;
  kind?: string;
  brands?: string[];
  applies_to?: string;
  perks: SeaPerk[];
  needs_check?: string[];
  contact_objects: SeaContact[];
  hotels: { id: string; name: string; country_name: string }[];
};

export type SeaSeasonality = {
  months: string[];
  note?: string;
  source?: string;
};

export type SeaCountrySummary = {
  id: string;
  name: string;
  overview: string;
  destinations_count: number;
  hotels_count: number;
  photo: string | null;
};

export type SeaOverview = {
  meta: { title?: string; disclaimer?: string; legend?: Record<string, string>; version?: string; generated?: string };
  region: { name?: string; overview?: string; sales_accents?: string[]; ready_tours?: (string | Record<string, string>)[]; agent_perks_note?: string };
  countries: SeaCountrySummary[];
};

export type SeaDestinationSummary = {
  id: string;
  name: string;
  type: string;
  country: string;
  description: string;
  seasonality: SeaSeasonality | null;
  hotels_count: number | null;
  photo: string | null;
};

export type SeaCountry = {
  id: string;
  name: string;
  overview?: string;
  entry_rules?: string[];
  currency?: string;
  flights?: string;
  important?: string[];
  events?: string[];
  combos?: string[];
  photos?: SeaPhoto[];
  destinations: SeaDestinationSummary[];
  [extra: string]: unknown;
};

export type SeaHotelSummary = {
  id: string;
  name: string;
  brand: string;
  stars: number | null;
  category: string;
  country: string;
  country_name: string;
  destination: string;
  destination_name: string;
  area: string;
  status: string;
  positioning: string;
  for_whom: string[];
  detail_level: string;
  needs_check_count: number;
  photo: string | null;
};

export type SeaDestination = {
  id: string;
  name: string;
  country: string;
  country_name: string;
  type?: string;
  description?: string;
  seasonality?: SeaSeasonality;
  how_to_get?: string;
  attractions?: string[];
  features?: string[];
  pros?: string[];
  cons?: string[];
  recommended_hotels_other?: string[];
  photos?: SeaPhoto[];
  hotels: SeaHotelSummary[];
};

export type SeaRoom = { name: string; size_sqm?: number | string; max_occupancy?: number | string; count?: number | string; notes?: string };

export type SeaHotel = {
  id: string;
  name: string;
  brand?: string;
  stars?: number | null;
  category?: string;
  country: string;
  country_name: string;
  destination: string;
  destination_name: string;
  area?: string;
  status?: string;
  opened?: string;
  renovation?: string;
  rooms_total?: string;
  location?: string;
  airport_transfer?: string;
  positioning?: string;
  for_whom?: string[];
  beach?: string;
  rooms?: SeaRoom[];
  meal_plans?: string[];
  food?: { restaurants?: { name: string; cuisine?: string; notes?: string }[]; notes?: string };
  infrastructure?: string[];
  kids?: string;
  spa_wellness?: string;
  highlights?: string[];
  pros?: string[];
  cons?: string[];
  deposit?: string;
  sales_tips?: string[];
  special_offers?: string[];
  agent_programs?: string[];
  hotel_contacts?: Record<string, string>;
  photos?: SeaPhoto[];
  sources?: string[];
  needs_check?: string[];
  detail_level?: string;
  contact_objects: SeaContact[];
  agent_perks: SeaPerkGroup | null;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(res.status === 404 ? "Не найдено" : data.detail || "Ошибка запроса");
  }
  return res.json();
}

export const fetchSeaOverview = () => get<SeaOverview>("/api/sea-kb/overview/");
export const fetchSeaCountry = (id: string) => get<SeaCountry>(`/api/sea-kb/countries/${id}/`);
export const fetchSeaDestination = (id: string) => get<SeaDestination>(`/api/sea-kb/destinations/${id}/`);
export const fetchSeaHotels = () => get<SeaHotelSummary[]>("/api/sea-kb/hotels/");
export const fetchSeaHotel = (id: string) => get<SeaHotel>(`/api/sea-kb/hotels/${id}/`);
export const fetchSeaPerks = () => get<SeaPerkGroup[]>("/api/sea-kb/agent-perks/");
export const fetchSeaContacts = () => get<SeaContact[]>("/api/sea-kb/contacts/");
