"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";
import { editIdentity, inventoryFieldErrors, unitSchema, vehicleSchema } from "@/lib/inventory/validation";
import type { InventoryFormState } from "@/lib/inventory/types";
import { getDataMode } from "@/lib/demo-mode";
import { getVehicle } from "@/lib/inventory/data";

function failure(code: string): InventoryFormState {
  if (code === "23505") return { error: "Ya existe esa marca y modelo, o ese código interno de unidad. Revisá también los registros dados de baja." };
  if (code === "40001") return { error: "Otra persona modificó este registro. Recargá la página para revisar los datos actuales antes de guardar." };
  if (code === "23514") return { error: "La operación no cumple las reglas del inventario. Revisá los datos; una ficha con unidades disponibles no puede darse de baja y una unidad vendida no se edita aquí." };
  if (code === "P0002") return { error: "El registro ya no está disponible. Volvé al listado y revisá su estado." };
  return { error: "No pudimos confirmar la operación. Revisá el listado antes de reintentar." };
}
function refresh(id: string) { revalidatePath("/vehiculos"); revalidatePath(`/vehiculos/${id}`); revalidatePath(`/vehiculos/${id}/editar`); }
export async function saveVehicle(_previous: InventoryFormState, form: FormData): Promise<InventoryFormState> {
  await requireAdmin();
  const mode = await getDataMode();
  if (mode.empty) return { error: "Activá los datos demo antes de guardar." };
  const parsed = vehicleSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: inventoryFieldErrors(parsed.error) };
  const id = form.get("id");
  const identity = id ? editIdentity.safeParse({ id, updated_at: form.get("updated_at") }) : null;
  if (identity && !identity.success) return { error: "Recargá la ficha antes de editar." };
  const client = await createSessionClient();
  const result = await client.rpc("save_vehicle_for_source", { p_id: id || null, p_brand: parsed.data.brand, p_model: parsed.data.model, p_expected_updated_at: identity?.data?.updated_at ?? null, p_source:mode.vehicleSource });
  if (result.error || !result.data) return failure(result.error?.code ?? "");
  refresh(result.data);
  return { success: id ? "Datos del vehículo actualizados." : "Vehículo creado en el catálogo. Ya podés agregar sus unidades.", id: result.data };
}
export async function saveUnit(_previous: InventoryFormState, form: FormData): Promise<InventoryFormState> {
  await requireAdmin();
  const parsed = unitSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: inventoryFieldErrors(parsed.error) };
  const vehicle = z.guid().safeParse(form.get("vehicle_id"));
  const id = form.get("id");
  const identity = id ? editIdentity.safeParse({ id, updated_at: form.get("updated_at") }) : null;
  if (!vehicle.success || (identity && !identity.success)) return { error: "Recargá la ficha antes de guardar." };
  if (!(await getVehicle(vehicle.data)).vehicle) return { error: "Vehículo no disponible en esta vista." };
  const data = parsed.data;
  const client = await createSessionClient();
  const result = await client.rpc("save_inventory_unit", { p_id: id || null, p_vehicle_id: vehicle.data,
    p_internal_code: null, p_model_year: data.model_year, p_version: data.version, p_transmission: data.transmission,
    p_mileage_km: data.mileage_km, p_listed_price: data.listed_price, p_currency: data.currency, p_status: data.status,
    p_received_at: data.received_at, p_expected_updated_at: identity?.data?.updated_at ?? null });
  if (result.error || !result.data) return failure(result.error?.code ?? "");
  refresh(vehicle.data);
  return { success: id ? "Unidad actualizada. El stock refleja su estado actual." : "Unidad agregada al inventario.", id: result.data };
}
export async function archiveVehicle(_previous: InventoryFormState, form: FormData): Promise<InventoryFormState> {
  await requireAdmin();
  const identity = editIdentity.safeParse(Object.fromEntries(form));
  const archived = form.get("archived");
  if (!identity.success || !["true", "false"].includes(String(archived))) return { error: "Recargá la ficha antes de cambiar su estado." };
  if (!(await getVehicle(identity.data.id)).vehicle) return { error: "Vehículo no disponible en esta vista." };
  const client = await createSessionClient();
  const result = await client.rpc("set_vehicle_archived", { p_id: identity.data.id, p_archived: archived === "true", p_expected_updated_at: identity.data.updated_at });
  if (result.error) return failure(result.error.code);
  refresh(identity.data.id);
  return { success: archived === "true" ? "Vehículo dado de baja. Su historial se conserva." : "Vehículo restaurado en el catálogo." };
}
