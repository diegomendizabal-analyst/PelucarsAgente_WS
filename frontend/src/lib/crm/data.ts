import { getDataMode } from "@/lib/demo-mode";
import "server-only";
import { z } from "zod";
import { requireAccount, requireAdmin } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";
import type { Customer, Interest, Lead, PendingLead, TimelineItem } from "./types";
export const crmPageSize = 20;
export const crmPage = (value: string | string[] | undefined) => /^\d+$/.test(String(value)) ? Math.max(1, Math.min(100000, Number(value))) : 1;
const fields = "id,reference_number,customer_id,assigned_to,commercial_status,summary,budget_min,budget_max,budget_currency,financing_needed,trade_in_details,purchase_timeframe,waiting_since,closed_at,loss_reason,created_at,updated_at,customer:customers!customer_id(full_name,phone_e164),responsible:profiles!assigned_to(full_name)";
export async function listPending(page: number) {
  await requireAccount(); const mode = await getDataMode(); if (mode.empty) return { rows: [], count: 0, error: false }; const client = await createSessionClient();
  const result = await client.rpc("list_pending_leads_for_source", {p_source:mode.leadSource}, { count: "exact" }).order("waiting_since").order("id").range((page-1)*crmPageSize,page*crmPageSize-1);
  return { rows: (result.data ?? []) as PendingLead[], count: result.count ?? 0, error: !!result.error };
}
export async function listLeads({ scope = "mine", status = "", customerId, page = 1 }: { scope?: string; status?: string; customerId?: string; page?: number }) {
  const account = await requireAccount(); const client = await createSessionClient();
  const mode = await getDataMode(); if (mode.empty) return { rows: [], count: 0, error: false };
  let request = client.from("leads").select(fields, { count: "exact" }).eq("source",mode.leadSource);
  if (customerId) request = request.eq("customer_id",customerId);
  else if (scope === "waiting" && account.role === "admin") request = request.is("assigned_to",null).is("closed_at",null);
  else if (scope !== "all" || account.role !== "admin") request = request.eq("assigned_to",account.id);
  if (status) request = request.eq("commercial_status",status);
  const result = await request.order(scope === "waiting" ? "waiting_since" : "created_at", { ascending: scope === "waiting" }).order("id").range((page-1)*crmPageSize,page*crmPageSize-1);
  return { rows: (result.data ?? []) as unknown as Lead[], count: result.count ?? 0, error: !!result.error };
}
export async function getLead(id: string) {
  await requireAccount(); if (!z.guid().safeParse(id).success) return { lead: null, error: false };
  const mode = await getDataMode(); if (mode.empty) return { lead: null, error: false };
  const client = await createSessionClient(); const result = await client.from("leads").select(fields).eq("source",mode.leadSource).eq("id",id).maybeSingle();
  return { lead: result.data as unknown as Lead | null, error: !!result.error };
}
export async function leadContext(id: string, page: number, interestPage: number) {
  await requireAccount(); const client = await createSessionClient();
  const mode = await getDataMode();
  const [interests,events] = await Promise.all([
    client.from("lead_interests").select("id,vehicle_id,requested_text,year_min,year_max,requested_version,transmission,status,is_primary,vehicle:vehicles!vehicle_id(source)",{count:"exact"}).eq("lead_id",id).order("created_at").order("id").range((interestPage-1)*crmPageSize,interestPage*crmPageSize-1),
    client.from("lead_timeline").select("id,kind,old_value,new_value,actor_name,reason,occurred_at",{count:"exact"}).eq("lead_id",id).order("occurred_at",{ascending:false}).order("id").range((page-1)*crmPageSize,page*crmPageSize-1),
  ]);
  const scopedInterests = ((interests.data ?? []) as unknown as (Interest & { vehicle: { source: string } | null })[])
    .map(({ vehicle, ...interest }) => ({ ...interest, vehicle_id: vehicle?.source === mode.vehicleSource ? interest.vehicle_id : null }));
  return { interests: scopedInterests, events: (events.data ?? []) as TimelineItem[],
    count: events.count ?? 0, interestCount:interests.count ?? 0, error: !!(interests.error || events.error) };
}
export async function listAssignees() {
  await requireAdmin(); const client = await createSessionClient();
  const result = await client.from("profiles").select("id,full_name,role").eq("is_enabled",true).order("full_name").order("id");
  return { rows: (result.data ?? []) as { id: string; full_name: string; role: string }[], error: !!result.error };
}
export async function listCustomers(query: string, page: number) {
  await requireAccount(); const client = await createSessionClient();
  const mode = await getDataMode(); if (mode.empty) return { rows: [], count: 0, error: false };
  let request = client.from("customer_directory_by_source").select("id,full_name,phone_e164,created_at,inquiry_count,last_inquiry_at",{count:"exact"}).eq("source",mode.leadSource);
  // Buscar por un campo según el contenido evita interpolar expresiones PostgREST.
  if (query) {
    const phone = /^[+\d\s()-]+$/.test(query);
    const term = phone ? query.replace(/[\s()-]/g,"") : query;
    request = request.ilike(phone ? "phone_e164" : "full_name", `%${term.replace(/[\\%_]/g,"\\$&")}%`);
  }
  const result = await request.order("last_inquiry_at",{ascending:false,nullsFirst:false}).order("id").range((page-1)*crmPageSize,page*crmPageSize-1);
  return { rows: (result.data ?? []) as Customer[], count: result.count ?? 0, error: !!result.error };
}
export async function getCustomer(id: string) {
  await requireAccount(); if (!z.guid().safeParse(id).success) return { customer:null,error:false };
  const mode = await getDataMode(); if (mode.empty) return { customer: null, error: false };
  const client = await createSessionClient(); const result = await client.from("customer_directory_by_source").select("id,full_name,phone_e164,created_at,inquiry_count,last_inquiry_at").eq("source",mode.leadSource).eq("id",id).maybeSingle();
  return { customer:result.data as Customer | null,error:!!result.error };
}
export async function listVehicleLeads(vehicleId: string, page: number) {
  const account = await requireAccount(); const client = await createSessionClient();
  const mode = await getDataMode(); if (mode.empty) return { rows: [], count: 0, error: false };
  // El semijoin embebido filtra leads sin multiplicarlos por intereses coincidentes.
  let query = client.from("leads").select(`${fields},lead_interests!inner(vehicle_id,status)`, { count: "exact" })
    .eq("source",mode.leadSource).eq("lead_interests.vehicle_id", vehicleId).eq("lead_interests.status", "active");
  if (account.role !== "admin") query = query.eq("assigned_to", account.id);
  const result = await query.order("created_at", { ascending: false }).order("id")
    .range((page - 1) * crmPageSize, page * crmPageSize - 1);
  return { rows: (result.data ?? []) as unknown as Lead[], count: result.count ?? 0, error: !!result.error };
}
