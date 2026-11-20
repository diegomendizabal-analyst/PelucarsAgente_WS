export type Vehicle = {
  id: string; brand: string; model: string; archived_at: string | null; updated_at: string;
  units_count: number; available_count: number; matching_units?: number;
};
export type InventoryUnit = {
  id: string; vehicle_id: string; internal_code: string; model_year: number | null;
  version: string | null; transmission: string | null; mileage_km: number | null;
  listed_price: number | null; currency: "ARS" | "USD" | null;
  status: "available" | "withdrawn" | "sold"; received_at: string | null; updated_at: string;
};
export type InventoryFormState = { error?: string; success?: string; id?: string; fieldErrors?: Record<string, string> };
export const unitStatus = { available: "Disponible", withdrawn: "Retirada", sold: "Vendida" };
export function unitPrice(unit: Pick<InventoryUnit, "listed_price" | "currency">) {
  return unit.listed_price === null || !unit.currency ? "Precio sin informar" : `${unit.currency} ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(unit.listed_price)}`;
}
