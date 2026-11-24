import { getDataMode } from "@/lib/demo-mode";
import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import Loading from "@/app/loading";
import { requireAdmin } from "@/lib/auth/session";
import { getReportDetail } from "@/lib/reports/data";
import { parseReportFilters, reportMetrics, reportQuery, type SearchValues } from "@/lib/reports/filters";
import { crmDate, leadReference, leadStatuses, type LeadStatus } from "@/lib/crm/types";
import { BackLink, PageHeading, Notice } from "@/components/ui";
import { CrmPagination } from "@/components/crm-views";
import { RefreshCrm } from "@/components/crm-controls";
const labels = { inquiries: "Consultas ingresadas", received: "Oportunidades recibidas", reassigned: "Recibidas por reasignación", portfolio: "Cartera abierta", pending: "Pendientes de asignación", awaiting_stock: "En espera de stock", lost: "Oportunidades perdidas", demand: "Demanda por modelo" };
export default function Page({ searchParams }: { searchParams: Promise<SearchValues> }) { return <Suspense fallback={<Loading />}><Detail searchParams={searchParams} /></Suspense>; }
async function Detail({ searchParams }: { searchParams: Promise<SearchValues> }) {
  await requireAdmin();
  const search = await searchParams;
  const mode = await getDataMode();
  const filters = parseReportFilters({...search,source:mode.toolsEnabled ? "demo" : "real"});
  const metric = z.enum(reportMetrics).safeParse(search.metric);
  const page = z.coerce.number().int().min(1).max(100000).safeParse(search.page ?? 1);
  const vehicle = search.vehicle === "generic" ? null : search.vehicle;
  if (!filters.success || !metric.success || !page.success || (metric.data === "demand" && vehicle !== null && !z.guid().safeParse(vehicle).success) || (filters.data.seller && ["pending", "lost"].includes(metric.data))) return <><BackLink href="/reportes">Volver a reportes</BackLink><Notice>Filtros de detalle inválidos. Volvé al reporte para elegir un indicador disponible.</Notice></>;
  const query = `${reportQuery(filters.data)}&metric=${metric.data}${metric.data === "demand" ? `&vehicle=${vehicle ?? "generic"}` : ""}`;
  const result = await getReportDetail(filters.data, metric.data, page.data, metric.data === "demand" ? vehicle as string | null : null);
  return <><BackLink href={`/reportes?${reportQuery(filters.data)}`}>Volver a reportes</BackLink><PageHeading eyebrow="DETALLE DEL INDICADOR" title={labels[metric.data]} description={`${filters.data.source === "real" ? "Datos reales" : "Datos demo"} · ${["portfolio", "pending", "awaiting_stock", "demand"].includes(metric.data) ? "Situación actual, sin límite de período" : `${filters.data.from} al ${filters.data.to}`} · ${filters.data.seller ? "Vendedor seleccionado" : "Todos los vendedores"}`} action={<RefreshCrm />} />
    {result.status !== "ready" ? <Notice>{result.status === "empty" ? "Sin datos: las muestras demo estan ocultas." : result.status === "unavailable" ? "No disponible — pendiente de integración" : "No pudimos consultar el detalle. Usá Actualizar para reintentar."}</Notice> : <section className="panel"><p className="report-note">Actualizado: {crmDate(result.data.generated_at)}. Puede variar respecto del reporte si hubo cambios.</p>{result.data.rows.length ? <ul className="report-detail-list">{result.data.rows.map(row => <li key={row.id}><Link href={`/oportunidades/${row.id}`} prefetch={false}><strong>{leadReference(row.reference_number)} · {row.full_name ?? "Nombre sin informar"}</strong><span>{leadStatuses[row.commercial_status as LeadStatus]} · Ingreso {crmDate(row.created_at)} →</span></Link></li>)}</ul> : <p className="crm-placeholder">Sin oportunidades en esta página.</p>}<CrmPagination page={page.data} count={result.data.total} href={next => `/reportes/detalle?${query}&page=${next}`} /></section>}
  </>;
}
