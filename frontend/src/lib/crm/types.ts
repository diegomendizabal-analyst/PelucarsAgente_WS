export const leadStatuses = { new_inquiry: "Nueva consulta", follow_up: "En seguimiento", awaiting_stock: "En espera de stock", lost: "Perdido", sold: "Vendido" } as const;
export type LeadStatus = keyof typeof leadStatuses;
export type Customer = { id: string; full_name: string | null; phone_e164: string; created_at: string; inquiry_count: number; last_inquiry_at: string | null };
export type Lead = {
  id: string; reference_number: number; customer_id: string; assigned_to: string | null; commercial_status: LeadStatus;
  summary: string | null; budget_min: number | null; budget_max: number | null; budget_currency: string | null;
  source: "demo" | "whatsapp_bot"; budget_scope: "valor_total" | "dinero_a_agregar" | null;
  trade_in_decision: "confirmada" | "descartada" | "indecisa" | "no_informada" | null;
  financing_needed: boolean | null; trade_in_details: string | null; purchase_timeframe: string | null;
  waiting_since: string | null; closed_at: string | null; loss_reason: string | null; created_at: string; updated_at: string;
  customer: { full_name: string | null; phone_e164: string; provider_profile_name: string | null };
  responsible: { full_name: string } | null;
};
export type PendingLead = { id: string; reference_number: number; waiting_since: string; assignment_state: string };
export const leadReference = (value: number) => `OP-${String(value).padStart(6,"0")}`;
export type LeadNotification = { id:string; lead_id:string; created_at:string; leads:{reference_number:number} };
export type NotificationFeed = { rows:LeadNotification[]; count:number; error:boolean };
export type Interest = { id: string; vehicle_id: string | null; requested_text: string; year_min: number | null; year_max: number | null; requested_version: string | null; transmission: string | null; status: string; is_primary: boolean; requested_brand: string | null; requested_model: string | null; characteristics: string[] };
export type LeadMessage = { id:string; conversation_id:string; sender_kind:"customer" | "bot"; body:string; history_position:number | null; send_state:"pending" | "sending" | "sent" | "failed" | "unknown" | null; created_at:string; sent_at:string | null; provider:string; bot_state:string };
export const scoreVersion = "pelucars_score_v1_prototipo";
export type LeadScore = { id:string; score:number; rules_version:string; evaluated_at:string; cutoff_message_id:string; cutoff_position:number; cutoff_at:string;
  result:{banda:string; informacion_limitada:boolean; motivos_limitacion:string[]; desglose:Record<string,{puntos:number; motivo:string}>};
  evidence:{signal_code:string; message_id:string; quoted_text:string}[] };
export type BotReadState = "ready" | "unavailable" | "error";
export type UnitMatch = {interest_id:string;available_count:number;matching_count:number;unknown_count:number};
export type Assignment = { id: string; assignee_name: string; previous_assignee_name: string | null; actor_name: string | null; mode: string; reason: string | null; occurred_at: string };
export type StatusEvent = { id: string; old_value: LeadStatus | null; new_value: LeadStatus; actor_name: string | null; reason: string | null; changed_at: string };
export type TimelineItem = { id:string; kind:"assignment" | "status"; old_value:string | null; new_value:string; actor_name:string | null; reason:string | null; occurred_at:string };
export type CrmFormState = { error?: string; success?: string; id?: string; fieldErrors?: Record<string,string> };
export function crmDate(value: string) { return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Buenos_Aires" }).format(new Date(value)); }
export function waitingTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Menos de un minuto";
  if (minutes < 60) return `${minutes} min de espera`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h de espera`;
  return `${Math.floor(minutes / 1440)} días de espera`;
}
