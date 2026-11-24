import { Suspense } from "react";
import Loading from "@/app/loading";
import Link from "next/link";
import { CarFront, PackageCheck, Package } from "lucide-react";
import { requireAccount } from "@/lib/auth/session";
import { getVehicle, listUnits, pageNumber } from "@/lib/inventory/data";
import { ArchiveControl, UnitList } from "@/components/inventory-controls";
import { InventoryError, InventoryPagination } from "@/components/inventory-views";
import { InventoryQuote } from "@/components/inventory-quote";
import { BackLink, EmptyState, Metric, Notice, PageHeading } from "@/components/ui";
import { inventorySearchParams, parseInventoryFilters, priceFilterError, priceFilterSummary, yearFilterSummary, yearFilterError } from "@/lib/inventory/filters";
import { crmPage, listVehicleLeads } from "@/lib/crm/data";
import { CrmError, CrmPagination, LeadRows } from "@/components/crm-views";

export const metadata = { title: "Ficha de vehículo" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function Page(props: Props) { return <Suspense fallback={<Loading />}><Details {...props} /></Suspense>; }

async function Details({ params, searchParams }: Props) {
  const [{ id }, search, account] = await Promise.all([params, searchParams, requireAccount()]);
  const { vehicle, error } = await getVehicle(id);
  if (error) return <InventoryError />;
  if (!vehicle) return <><BackLink href="/vehiculos">Volver a vehículos</BackLink><EmptyState icon={CarFront} title="Vehículo no disponible" description="No encontramos una ficha con ese identificador en el catálogo actual." /></>;
  const page = pageNumber(search.page);
  const filters = parseInventoryFilters(search);
  const filtered = !!(filters.minYear || filters.maxYear || filters.transmission || filters.stock === "available" || filters.currency || filters.minPrice || filters.maxPrice);
  const leadsPage = crmPage(search.leads_page);
  const [data, leads] = await Promise.all([listUnits(id, page, filters), listVehicleLeads(id, leadsPage)]);
  const admin = account.role === "admin";
  return <><BackLink href={`/vehiculos?${inventorySearchParams(filters)}`}>Volver a vehículos</BackLink><PageHeading eyebrow="CATÁLOGO E INVENTARIO" title={`${vehicle.brand} ${vehicle.model}`} description="Características, precio y disponibilidad de cada unidad física." action={admin && !vehicle.archived_at ? <Link className="button secondary" href={`/vehiculos/${id}/editar`}>Editar marca y modelo</Link> : undefined} />
    {vehicle.archived_at && <Notice>Esta ficha está dada de baja. Sus unidades e historial se conservan. {admin ? "Restaurala para volver a editar o agregar unidades." : "Podés consultar los datos registrados."}</Notice>}
    <div className="metrics-grid inventory-metrics"><Metric icon={PackageCheck} label="Disponibles" value={vehicle.available_count} caption="Unidades que cuentan como stock" /><Metric icon={Package} label="Unidades registradas" value={vehicle.units_count} caption="Todas las unidades de esta ficha" /><Metric icon={CarFront} label="Fuera de stock" value={vehicle.units_count - vehicle.available_count} caption="Retiradas o vendidas" /></div>
    {(priceFilterError(filters) || yearFilterError(filters)) && <Notice>{priceFilterError(filters) || yearFilterError(filters)}</Notice>}
    {filtered && <div className="inventory-filter-summary"><span>Unidades que coinciden: {[yearFilterSummary(filters), filters.transmission === "automatic" ? "Automática" : filters.transmission === "manual" ? "Manual" : filters.transmission === "other" ? "Otra transmisión" : "", filters.stock === "available" ? "Disponibles" : "", priceFilterSummary(filters)].filter(Boolean).join(" · ")}. Los totales corresponden a toda la ficha.</span><Link className="text-link" href={`/vehiculos/${id}`}>Ver todas las unidades</Link></div>}
    <InventoryQuote quote={data.quote} error={data.quoteError} />
    {data.error ? <InventoryError /> : data.quoteError ? null : <section className="panel"><UnitList vehicle={vehicle} units={data.units} admin={admin} filtered={filtered} budgetCurrency={filters.currency === "ARS" || filters.currency === "USD" ? filters.currency : undefined} /><InventoryPagination page={page} count={data.count} href={(next) => `/vehiculos/${id}?${inventorySearchParams(filters, next)}`} /></section>}
    {admin && <ArchiveControl key={vehicle.updated_at} vehicle={vehicle} />}
    <section className="panel crm-future"><div className="panel-heading"><div><h2>Oportunidades interesadas</h2><p>Intereses activos vinculados a este modelo. {admin ? "Todas las oportunidades autorizadas." : "Sólo las oportunidades a tu cargo."} Incluye cerradas; el estado indica cuáles esperan stock. La coincidencia de modelo no garantiza compatibilidad con una unidad.</p></div></div>
      {leads.error ? <CrmError /> : <><LeadRows rows={leads.rows} /><CrmPagination page={leadsPage} count={leads.count} href={next => `/vehiculos/${id}?${inventorySearchParams(filters, page)}&leads_page=${next}`} /></>}
    </section>
  </>;
}
