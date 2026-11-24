"use client";

import { parseReportFilters, reportQuery, type ReportFilters } from "@/lib/reports/filters";
import type { Report } from "@/lib/reports/data";
import { useAutoFilters } from "./auto-filters";

export function ReportFiltersForm({ filters, sellers }: { filters: ReportFilters; sellers: Report["sellers"] }) {
  const { value, pending, update } = useAutoFilters(filters, next => `/reportes?${reportQuery(next)}`, next => parseReportFilters(next).success);
  const valid = parseReportFilters(value).success;
  return <div className="report-filter-area" data-pending={pending || undefined}>
    <form className="panel report-filters" onSubmit={event => { event.preventDefault(); update(value, 0); }}>
      <label>Desde<input type="date" name="from" value={value.from} min="2000-01-01" max="2100-12-31" required onChange={e => update({ ...value, from: e.target.value })} /></label>
      <label>Hasta<input type="date" name="to" value={value.to} min="2000-01-01" max="2100-12-31" required onChange={e => update({ ...value, to: e.target.value })} /></label>
      <label>Vendedor<select name="seller" value={value.seller} onChange={e => update({ ...value, seller: e.target.value }, 0)}><option value="">Todos</option>{sellers.map(seller => <option value={seller.id} key={seller.id}>{seller.full_name}{seller.role === "admin" ? " · Admin" : ""}{!seller.is_enabled ? " · Deshabilitado" : ""}</option>)}</select></label>
    </form>
    {!valid && <p className="field-error" role="alert">Revisá las fechas: desde no puede superar a hasta.</p>}
    <span className="sr-only" role="status">{pending ? "Actualizando resultados…" : ""}</span>
  </div>;
}
