import { getDataMode } from "@/lib/demo-mode";
import { getInventoryQuote } from "./exchange";
import "server-only";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/auth/session";
import type { InventoryUnit, Vehicle } from "./types";
import { z } from "zod";
import { priceFilterError, yearFilterError, type InventoryFilters } from "./filters";

export const inventoryPageSize = 20;
export function pageNumber(value: string | string[] | undefined) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1; }
export async function listVehicles(filters: InventoryFilters, page: number) {
  await requireAccount();
  const mode = await getDataMode();
  const empty = { vehicles: [] as Vehicle[], count:0, error:false, quote:null, quoteError:false };
  if (mode.empty || priceFilterError(filters) || yearFilterError(filters)) return empty;
  const quote = filters.currency ? await getInventoryQuote() : null;
  if (filters.currency && !quote) return {...empty,quoteError:true};
  const client = await createSessionClient();
  const request = client.rpc(filters.currency ? "search_vehicle_catalog_budget" : "search_vehicle_catalog_range", { p_query: filters.query, p_stock: filters.stock,
    p_source: mode.vehicleSource, p_archived: filters.archived, p_year_min: filters.minYear ? Number(filters.minYear) : null, p_year_max: filters.maxYear ? Number(filters.maxYear) : null, p_transmission: filters.transmission,
    p_currency: filters.currency || null, p_min_price: filters.minPrice.replace(",", ".") || null, p_max_price: filters.maxPrice.replace(",", ".") || null,
    ...(quote ? {p_rate:quote.venta} : {}) }, { count: "exact" });
  const result = await request.order("brand").order("model").order("id").range((page - 1) * inventoryPageSize, page * inventoryPageSize - 1);
  return { vehicles: (result.data ?? []) as Vehicle[], count: result.count ?? 0, error: !!result.error, quote, quoteError:false };
}
export async function inventoryYears() {
  await requireAccount();
  const client = await createSessionClient();
  const mode = await getDataMode(); if (mode.empty) return { years: [], error: false };
  const result = await client.rpc("inventory_filter_years_for_source", {p_source:mode.vehicleSource});
  return { years: (result.data ?? []).map((row: { model_year: number }) => row.model_year), error: !!result.error };
}
export async function getVehicle(id: string) {
  await requireAccount();
  const mode = await getDataMode(); if (mode.empty) return { vehicle: null, error: false };
  if (!z.guid().safeParse(id).success) return { vehicle: null, error: false };
  const client = await createSessionClient();
  const result = await client.from("vehicle_catalog").select("id,brand,model,archived_at,updated_at,units_count,available_count").eq("source",mode.vehicleSource).eq("id", id).maybeSingle();
  return { vehicle: result.data as Vehicle | null, error: !!result.error };
}
export async function listUnits(vehicleId: string, page: number, filters?: InventoryFilters) {
  await requireAccount();
  const empty = { units:[] as InventoryUnit[],count:0,error:false,quote:null,quoteError:false };
  const selected = await getVehicle(vehicleId); if (selected.error || !selected.vehicle) return {...empty,error:selected.error};
  if (filters && (priceFilterError(filters) || yearFilterError(filters))) return empty;
  const client = await createSessionClient();
  if (filters?.currency) {
    const quote = await getInventoryQuote();
    if (!quote) return {...empty,quoteError:true};
    const mode = await getDataMode();
    const result = await client.rpc("search_inventory_units_budget", {
      p_source:mode.vehicleSource,p_vehicle:vehicleId,
      p_year_min:filters.minYear ? Number(filters.minYear) : null,p_year_max:filters.maxYear ? Number(filters.maxYear) : null,
      p_transmission:filters.transmission,p_stock:filters.stock,p_currency:filters.currency,
      p_min_price:filters.minPrice.replace(",", ".") || null,p_max_price:filters.maxPrice.replace(",", ".") || null,p_rate:quote.venta,
    }, {count:"exact"}).order("created_at",{ascending:false}).order("id").range((page-1)*inventoryPageSize,page*inventoryPageSize-1);
    return {units:(result.data ?? []) as InventoryUnit[],count:result.count ?? 0,error:!!result.error,quote,quoteError:false};
  }
  let request = client.from("inventory_units").select("id,vehicle_id,internal_code,model_year,version,transmission,mileage_km,listed_price,currency,status,received_at,updated_at", { count: "exact" }).eq("vehicle_id", vehicleId);
  if (filters?.minYear) request = request.gte("model_year", Number(filters.minYear));
  if (filters?.maxYear) request = request.lte("model_year", Number(filters.maxYear));
  if (filters?.transmission) request = request.eq("transmission_kind", filters.transmission);
  if (filters?.stock === "available") request = request.eq("status", "available");
  const result = await request.order("created_at", { ascending: false }).order("id").range((page - 1) * inventoryPageSize, page * inventoryPageSize - 1);
  return { units: (result.data ?? []) as InventoryUnit[], count: result.count ?? 0, error: !!result.error,quote:null,quoteError:false };
}
