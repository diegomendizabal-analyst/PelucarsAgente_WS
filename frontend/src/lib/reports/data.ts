import { getDataMode } from "@/lib/demo-mode";
import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";
import { reportArgs, type ReportFilters, type ReportMetric } from "./filters";

export type Report = {
  generated_at: string;
  sellers: { id: string; full_name: string; role: string; is_enabled: boolean }[];
  period: { inquiries: number; customers: number; received: number; reassigned: number; assigned: number; unassigned: number; median_minutes: number | null; lost: number | null };
  current: { portfolio: number; pending: number | null; awaiting_stock: number; oldest_pending_at: string | null; states: { status: string; count: number }[] };
  demand: { vehicle_id: string | null; label: string; count: number; awaiting_stock: number }[];
  losses: { reason: string; count: number }[];
};
export type ReportDetail = { generated_at: string; total: number; rows: { id: string; reference_number: number; full_name: string | null; commercial_status: string; created_at: string }[] };
export type ReportResult<T> = { status: "ready"; data: T } | { status: "unavailable" | "error" | "empty" };

async function query<T>(name: string, args: Record<string, unknown>): Promise<ReportResult<T>> {
  await requireAdmin();
  const mode = await getDataMode();
  if (mode.empty) return {status:"empty"};
  args = {...args,p_source:mode.leadSource};
  try {
    const client = await createSessionClient();
    const { data, error } = await client.rpc(name, args);
    if (error) return { status: error.code === "PGRST202" ? "unavailable" : "error" };
    if (!data) return { status: "error" };
    return { status: "ready", data: data as T };
  } catch { return { status: "error" }; }
}
export function getAdminReport(filters: ReportFilters) {
  return query<Report>("get_admin_report", reportArgs(filters));
}
export async function listReportSellers() {
  await requireAdmin();
  const client = await createSessionClient();
  const rows: Report["sellers"] = [];
  // Selector completo, incluso sin RPC de reportes desplegada. No calcula KPI.
  for (let offset = 0; ; offset += 500) {
    const result = await client.from("profiles").select("id,full_name,role,is_enabled")
      .order("full_name").order("id").range(offset, offset + 499);
    if (result.error) return { rows: [], error: true };
    rows.push(...result.data);
    if (result.data.length < 500) return { rows, error: false };
  }
}
export function getReportDetail(filters: ReportFilters, metric: ReportMetric, page: number, vehicle: string | null) {
  return query<ReportDetail>("list_admin_report_details", { ...reportArgs(filters), p_metric: metric, p_page: page, p_vehicle: vehicle });
}
