import { apiJson } from "./crmApi";

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
  const data = await apiJson<TourOperator[] | { results: TourOperator[] }>("/api/crm/tour-operators/");
  return Array.isArray(data) ? data : data.results;
}
