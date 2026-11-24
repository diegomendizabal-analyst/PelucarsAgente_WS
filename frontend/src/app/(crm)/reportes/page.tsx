import { Suspense } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { ReportFiltersForm } from "@/components/report-filters";
import { getDataMode } from "@/lib/demo-mode";
import Loading from "@/app/loading";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminReport, listReportSellers } from "@/lib/reports/data";
import { defaultReportFilters, parseReportFilters, reportQuery, type ReportMetric, type SearchValues } from "@/lib/reports/filters";
import { crmDate, leadStatuses } from "@/lib/crm/types";
import { PageHeading, Panel, Notice } from "@/components/ui";
import { RefreshCrm } from "@/components/crm-controls";

export const metadata = { title: "Reportes" };
export default function Page({ searchParams }: { searchParams: Promise<SearchValues> }) {
  return <Suspense fallback={<Loading />}><Reports searchParams={searchParams} /></Suspense>;
}
const unavailable = "No disponible — pendiente de integración";

function Card({ label, value, help, href }: { label: string; value: number | string; help: string; href?: string }) {
  return <article className="metric report-card"><h3>{label}</h3><strong className={typeof value === "string" ? "report-text-value" : undefined}>{value}</strong>{href && <Link className="text-link" href={href}>Ver oportunidades →</Link>}<details className="report-card-help"><summary aria-label={`Definición: ${label}`} title={`Definición: ${label}`}><Info size={15} aria-hidden="true" /></summary><p>{help}</p></details></article>;
}

async function Reports({ searchParams }: { searchParams: Promise<SearchValues> }) {
  await requireAdmin();
  const mode = await getDataMode();
  const parsed = parseReportFilters({...await searchParams,source:mode.toolsEnabled ? "demo" : "real"});
  const filters = parsed.success ? parsed.data : { ...defaultReportFilters(), source: mode.toolsEnabled ? "demo" as const : "real" as const };
  const [result, sellers] = await Promise.all([parsed.success ? getAdminReport(filters) : null, listReportSellers()]);
  const data = result?.status === "ready" ? result.data : null;
  const detail = (metric: ReportMetric, vehicle?: string | null) => `/reportes/detalle?${reportQuery(filters)}&metric=${metric}${metric === "demand" ? `&vehicle=${vehicle ?? "generic"}` : ""}`;
  return <div className="report-page">
    <PageHeading eyebrow="ADMINISTRACIÓN" title="Reportes" description="Consultas, asignaciones y situación comercial de Pelucars." action={<RefreshCrm />} />
    <ReportFiltersForm filters={filters} sellers={sellers.rows} />
    {sellers.error && <Notice>No pudimos cargar los vendedores. Actualizá para reintentar.</Notice>}
    {!parsed.success && <div className="form-feedback error" role="alert">Filtros inválidos. Revisá las fechas, el vendedor y el conjunto de datos. No se consultaron indicadores.</div>}
    {data && <p className="report-updated">Actualizado <time dateTime={data.generated_at}>{crmDate(data.generated_at)}</time></p>}
    {result?.status === "unavailable" && <Notice>Los indicadores operativos están pendientes de habilitación en la base. No se muestran cifras hasta conectar la consulta de Reportes.</Notice>}
    {result?.status === "error" && <div className="form-feedback error" role="alert">No pudimos consultar Reportes. Usá Actualizar para reintentar; no se muestran totales estimados.</div>}
    {data ? <>
      <section className="report-section" aria-labelledby="period-heading"><h2 id="period-heading">Actividad del período</h2>
        <div className="report-grid report-period-grid">
          <Card label="Consultas ingresadas" value={data.period.inquiries} help="Oportunidades creadas en el período." href={detail("inquiries")} />
          <Card label="Clientes que consultaron" value={data.period.customers} help="Clientes distintos de esas consultas; los subtotales por vendedor no son sumables." />
          <Card label="Oportunidades recibidas" value={data.period.received} help="Oportunidades distintas asignadas en el período; incluye reasignaciones." href={detail("received")} />
          <Card label="Recibidas por reasignación" value={data.period.reassigned} help="Oportunidades distintas que llegaron desde otro responsable. Subconjunto de recibidas." href={detail("reassigned")} />
          <Card label="Tiempo a primera asignación" value={data.period.median_minutes === null ? "Sin datos" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(data.period.median_minutes)} min`} help={`Mediana desde el ingreso. Cobertura: ${data.period.assigned} asignadas / ${data.period.inquiries} consultas; ${data.period.unassigned} sin primera asignación. No mide contacto.`} />
        </div>
      </section>
      <section className="report-section" aria-labelledby="current-heading"><h2 id="current-heading">Situación actual <span className="report-scope">Sin límite de período</span></h2>
        <div className="report-grid">
          <Card label="Cartera abierta" value={data.current.portfolio} help="Consultas abiertas, incluyendo las que esperan asignación cuando elegís Todos." href={detail("portfolio")} />
          <Card label="Pendientes de asignación" value={data.current.pending ?? "No aplica"} help={filters.seller ? "Son pendientes globales, sin vendedor. Elegí Todos para consultarlos." : data.current.oldest_pending_at ? `La más antigua espera desde ${crmDate(data.current.oldest_pending_at)}.` : "Sin oportunidades abiertas pendientes de asignación."} href={filters.seller ? undefined : detail("pending")} />
          <Card label="En espera de stock" value={data.current.awaiting_stock} help="Búsquedas abiertas en espera de stock; no son pérdidas." href={detail("awaiting_stock")} />
        </div>
        <section className="report-states" aria-labelledby="states-heading"><h3 id="states-heading">Cartera por estado</h3><dl>{(["new_inquiry", "follow_up", "awaiting_stock"] as const).map(status => <div key={status}><dt>{leadStatuses[status]}</dt><dd>{data.current.states.find(row => row.status === status)?.count ?? 0}</dd></div>)}</dl></section>
      </section>
      <Panel title="Demanda vigente por modelo" description="Intereses activos · Una consulta puede aparecer en varios modelos.">
        {data.demand.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Modelo buscado</th><th>Oportunidades</th><th>En espera de stock</th></tr></thead><tbody>{data.demand.map(row => <tr key={row.vehicle_id ?? "generic"}><th scope="row"><Link className="text-link" href={detail("demand", row.vehicle_id)}>{row.label}</Link></th><td data-label="Consultas">{row.count}</td><td data-label="Espera de stock">{row.awaiting_stock}</td></tr>)}</tbody></table></div> : <p className="crm-placeholder">Sin intereses activos vinculados a oportunidades abiertas para este filtro.</p>}
      </Panel>
    </> : <Panel title="Consultas, asignaciones, cartera y demanda"><p className="crm-placeholder">{result?.status === "unavailable" ? unavailable : result?.status === "empty" ? "Vista de prueba vacía. Activá Datos demo en el menú para mostrar las muestras." : parsed.success ? "Indicadores sin cargar por un error de consulta." : "Indicadores sin cargar: corregí los filtros."}</p></Panel>}
    <section className="report-section" aria-labelledby="results-heading"><h2 id="results-heading">Resultados comerciales <span className="report-scope">Cierres del período</span></h2><div className="report-outcomes">
      <Card label="Oportunidades perdidas" value={data ? data.period.lost ?? unavailable : result?.status === "error" ? "Error de consulta" : unavailable} help={filters.seller ? "Falta integrar el responsable histórico al cierre. No se atribuyen al actor ni al responsable actual." : "Pérdidas del período según fecha de cierre, sin atribución individual."} href={data && !filters.seller ? detail("lost") : undefined} />
    {data && !filters.seller && data.losses.length > 0 && <Panel title="Motivos de pérdida"><dl className="report-distribution">{data.losses.map(row => <div key={row.reason}><dt>{row.reason}</dt><dd>{row.count}</dd></div>)}</dl></Panel>}
    </div></section>
    <div className="report-integrations"><Panel title="Ventas"><p className="report-pending">{unavailable}</p><ul className="report-pending-list"><li>Ventas cerradas</li><li>Montos y ticket promedio · ARS / USD separados</li><li>Tasa de éxito de cierres</li><li>Tiempo hasta venta</li></ul></Panel><Panel title="Score y resultados por banda"><p className="report-pending">{unavailable}</p><p className="report-note">Distribución y resultados por score. Criterios y bandas pendientes de definición.</p></Panel></div>
    <details className="panel report-method"><summary>Cómo se calculan estos reportes</summary><p>Período inclusivo, zona horaria de Buenos Aires. Consultas: oportunidades creadas en el período, atribuidas al primer vendedor del historial. Clientes: personas distintas en esas consultas. Recibidas: oportunidades distintas con asignación al vendedor durante el período. Una oportunidad puede figurar en varios vendedores; Todos deduplica, no suma subtotales.</p><p>Cartera y demanda: oportunidades abiertas al consultar, según responsable actual, sin limitar por fecha de creación. Intereses activos deduplicados por modelo; no garantizan compatibilidad con una unidad. Consultas sin intereses registrados no integran la demanda. Reales y demo se filtran por origen.</p><p>Las pérdidas individuales esperan atribución histórica. Ventas: registro confirmado y vendedor de cierre. Montos separados por moneda, sin conversiones; ticket = importe / ventas de cada moneda; tasa = ventas / (ventas + pérdidas); tiempo hasta venta = mediana desde ingreso hasta fecha comercial. Estas métricas y score esperan integración.</p></details>
  </div>;
}
