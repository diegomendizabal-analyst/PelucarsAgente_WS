import { Suspense } from "react";
import Loading from "@/app/loading";
import Link from "next/link";
import { CarFront, PackageCheck, Package } from "lucide-react";
import { requireAccount } from "@/lib/auth/session";
import { getVehicle, listUnits, pageNumber } from "@/lib/inventory/data";
import { ArchiveControl, UnitList } from "@/components/inventory-controls";
import { InventoryError, InventoryPagination } from "@/components/inventory-views";
import { BackLink, EmptyState, Metric, Notice, PageHeading } from "@/components/ui";
import { inventorySearchParams, parseInventoryFilters, priceFilterError, priceFilterSummary } from "@/lib/inventory/filters";

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
  const filtered = !!(filters.year || filters.transmission || filters.stock === "available" || filters.currency || filters.minPrice || filters.maxPrice);
  const data = await listUnits(id, page, filters);
  const admin = account.role === "admin";
  return <><BackLink href={`/vehiculos?${inventorySearchParams(filters)}`}>Volver a vehículos</BackLink><PageHeading eyebrow="CATÁLOGO E INVENTARIO" title={`${vehicle.brand} ${vehicle.model}`} description="Características, precio y disponibilidad de cada unidad física." action={admin && !vehicle.archived_at ? <Link className="button secondary" href={`/vehiculos/${id}/editar`}>Editar marca y modelo</Link> : undefined} />
    {vehicle.archived_at && <Notice>Esta ficha está dada de baja. Sus unidades e historial se conservan. {admin ? "Restaurala para volver a editar o agregar unidades." : "Podés consultar los datos registrados."}</Notice>}
    <div className="metrics-grid inventory-metrics"><Metric icon={PackageCheck} label="Disponibles" value={vehicle.available_count} caption="Unidades que cuentan como stock" /><Metric icon={Package} label="Unidades registradas" value={vehicle.units_count} caption="Todas las unidades de esta ficha" /><Metric icon={CarFront} label="Fuera de stock" value={vehicle.units_count - vehicle.available_count} caption="Retiradas o vendidas" /></div>
    {priceFilterError(filters) && <Notice>{priceFilterError(filters)}</Notice>}
    {filtered && <div className="inventory-filter-summary"><span>Unidades que coinciden: {[filters.year, filters.transmission === "automatic" ? "Automática" : filters.transmission === "manual" ? "Manual" : filters.transmission === "other" ? "Otra transmisión" : "", filters.stock === "available" ? "Disponibles" : "", priceFilterSummary(filters)].filter(Boolean).join(" · ")}. Los totales corresponden a toda la ficha.</span><Link className="text-link" href={`/vehiculos/${id}`}>Ver todas las unidades</Link></div>}
    {data.error ? <InventoryError /> : <section className="panel"><UnitList vehicle={vehicle} units={data.units} admin={admin} filtered={filtered} /><InventoryPagination page={page} count={data.count} href={(next) => `/vehiculos/${id}?${inventorySearchParams(filters, next)}`} /></section>}
    {admin && <ArchiveControl key={vehicle.updated_at} vehicle={vehicle} />}
  </>;
}
