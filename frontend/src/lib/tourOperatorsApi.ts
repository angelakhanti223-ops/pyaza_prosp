const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type TourOperator = {
  id: number;
  brand_name: string;
  legal_name: string;
  inn: string;
  ogrn: string;
  registry_number: string;
  activity_scope: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  payment_details: string;
  note: string;
  is_active: boolean;
};

export async function listTourOperators(): Promise<TourOperator[]> {
  const res = await fetch(`${API_BASE_URL}/api/crm/tour-operators/`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Не удалось загрузить справочник туроператоров");
  const data = (await res.json()) as TourOperator[] | { results: TourOperator[] };
  return Array.isArray(data) ? data : data.results;
}
