import { z } from "zod";

export type ReportFilters = { from: string; to: string; seller: string; source: "real" | "demo" };
export type SearchValues = Record<string, string | string[] | undefined>;
export const reportMetrics = ["inquiries", "received", "reassigned", "portfolio", "pending", "awaiting_stock", "lost", "demand"] as const;
export type ReportMetric = typeof reportMetrics[number];
const date = z.iso.date().refine(value => value >= "2000-01-01" && value <= "2100-12-31");
const schema = z.object({
  from: date, to: date, seller: z.union([z.literal(""), z.uuid()]), source: z.enum(["real", "demo"]),
}).refine(value => value.from <= value.to, { message: "La fecha desde debe ser anterior o igual a hasta." });

export function defaultReportFilters(now = new Date()): ReportFilters {
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = new Date(`${to}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to, seller: "", source: "real" };
}

export function parseReportFilters(params: SearchValues, now = new Date()) {
  const defaults = defaultReportFilters(now);
  // No descartar silenciosamente un parámetro duplicado o mal formado.
  return schema.safeParse(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params[key] ?? value])));
}

export function reportQuery(filters: ReportFilters) { return new URLSearchParams(filters).toString(); }
export function reportArgs(filters: ReportFilters) {
  return { p_from: filters.from, p_to: filters.to, p_seller: filters.seller || null, p_source: filters.source === "real" ? "whatsapp_bot" : "demo" };
}
