"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount, requireAdmin } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";
import { assignmentSchema, crmErrors, statusSchema } from "@/lib/crm/validation";
import type { CrmFormState } from "@/lib/crm/types";
import { getDataMode } from "@/lib/demo-mode";
import { getLead } from "@/lib/crm/data";
function failure(code?: string): CrmFormState {
  if (code === "P0002") return { error: "La oportunidad ya no está disponible para esta acción. Actualizá la bandeja." };
  if (code === "40001") return { error: "La oportunidad cambió. Actualizá la ficha antes de volver a guardar." };
  if (code === "23514") return { error: "Revisá el responsable, el estado y el motivo. Las oportunidades cerradas no se modifican desde aquí." };
  return { error: "No pudimos confirmar la operación. Actualizá la ficha antes de reintentar." };
}
function refresh() { revalidatePath("/", "layout"); }
export async function claimOpportunity(_previous: CrmFormState, form: FormData): Promise<CrmFormState> {
  await requireAccount(); const id = z.guid().safeParse(form.get("id"));
  if (!id.success) return { error: "Identificador no válido." };
  const mode = await getDataMode();
  if (mode.empty) return {error:"Activá los datos demo para gestionar oportunidades."};
  const client = await createSessionClient();
  const pending = await client.rpc("list_pending_leads_for_source",{p_source:mode.leadSource}).eq("id",id.data);
  if(pending.error || !pending.data?.length) return failure("P0002");
  const result = await client.rpc("claim_lead",{p_id:id.data});
  if (result.error || !result.data) return failure(result.error?.code);
  refresh(); redirect(`/oportunidades/${result.data}`);
}
export async function assignOpportunity(_previous: CrmFormState, form: FormData): Promise<CrmFormState> {
  await requireAdmin(); const parsed = assignmentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return {error:"Revisá los campos indicados.",fieldErrors:crmErrors(parsed.error)};
  if (!(await getLead(parsed.data.id)).lead) return failure("P0002");
  const data=parsed.data; const client=await createSessionClient();
  const result=await client.rpc("assign_lead",{p_id:data.id,p_assignee:data.assignee,p_reason:data.reason,p_expected_updated_at:data.updated_at});
  if (result.error) return failure(result.error.code);
  refresh(); return {success:"Responsable actualizado.",id:data.id};
}
export async function changeOpportunityStatus(_previous: CrmFormState, form: FormData): Promise<CrmFormState> {
  await requireAccount(); const parsed=statusSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return {error:"Revisá los campos indicados.",fieldErrors:crmErrors(parsed.error)};
  if (!(await getLead(parsed.data.id)).lead) return failure("P0002");
  const data=parsed.data; const client=await createSessionClient();
  const result=await client.rpc("set_lead_status",{p_id:data.id,p_status:data.status,p_reason:data.reason,p_expected_updated_at:data.updated_at});
  if (result.error) return failure(result.error.code);
  refresh(); return {success:"Estado actualizado.",id:data.id};
}
