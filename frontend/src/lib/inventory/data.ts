import "server-only";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/auth/session";
import type { InventoryUnit, Vehicle } from "./types";
import { z } from "zod";
import { priceFilterError, type InventoryFilters } from "./filters";

export const inventoryPageSize = 20;
export function pageNumber(value: string | string[] | undefined) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1; }
export async function listVehicles(filters: InventoryFilters, page: number) {
  await requireAccount();
  if (priceFilterError(filters)) return { vehicles: [], count: 0, error: false };
  const client = await createSessionClient();
  const request = client.rpc("search_vehicle_catalog", { p_query: filters.query, p_stock: filters.stock,
    p_archived: filters.archived, p_year: filters.year ? Number(filters.year) : null, p_transmission: filters.transmission,
    p_currency: filters.currency || null, p_min_price: filters.minPrice.replace(",", ".") || null, p_max_price: filters.maxPrice.replace(",", ".") || null }, { count: "exact" });
  const result = await request.order("brand").order("model").order("id").range((page - 1) * inventoryPageSize, page * inventoryPageSize - 1);
  return { vehicles: (result.data ?? []) as Vehicle[], count: result.count ?? 0, error: !!result.error };
}
export async function inventoryYears() {
  await requireAccount();
  const client = await createSessionClient();
  const result = await client.rpc("inventory_filter_years");
  return { years: (result.data ?? []).map((row: { model_year: number }) => row.model_year), error: !!result.error };
}
export async function getVehicle(id: string) {
  await requireAccount();
  if (!z.uuid().safeParse(id).success) return { vehicle: null, error: false };
  const client = await createSessionClient();
  const result = await client.from("vehicle_catalog").select("id,brand,model,archived_at,updated_at,units_count,available_count").eq("id", id).maybeSingle();
  return { vehicle: result.data as Vehicle | null, error: !!result.error };
}
export async function listUnits(vehicleId: string, page: number, filters?: InventoryFilters) {
  await requireAccount();
  if (filters && priceFilterError(filters)) return { units: [], count: 0, error: false };
  const client = await createSessionClient();
  let request = client.from("inventory_units").select("id,vehicle_id,internal_code,model_year,version,transmission,mileage_km,listed_price,currency,status,received_at,updated_at", { count: "exact" }).eq("vehicle_id", vehicleId);
  if (filters?.year) request = request.eq("model_year", Number(filters.year));
  if (filters?.transmission) request = request.eq("transmission_kind", filters.transmission);
  if (filters?.stock === "available") request = request.eq("status", "available");
  if (filters?.currency) request = request.eq("currency", filters.currency);
  if (filters?.minPrice) request = request.gte("listed_price", filters.minPrice.replace(",", "."));
  if (filters?.maxPrice) request = request.lte("listed_price", filters.maxPrice.replace(",", "."));
  const result = await request.order("created_at", { ascending: false }).order("id").range((page - 1) * inventoryPageSize, page * inventoryPageSize - 1);
  return { units: (result.data ?? []) as InventoryUnit[], count: result.count ?? 0, error: !!result.error };
}
