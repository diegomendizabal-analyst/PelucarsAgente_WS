import Link from "next/link";
import { CarFront, ChevronRight, LockKeyhole, Plus } from "lucide-react";
import { EmptyState, PageHeading } from "./ui";
import type { Vehicle } from "@/lib/inventory/types";
import { inventoryPageSize } from "@/lib/inventory/data";
import { CatalogFilters } from "./inventory-filters";
import { InventoryQuote } from "./inventory-quote";
import type { DollarQuote } from "@/lib/exchange";
import { inventorySearchParams, type InventoryFilters } from "@/lib/inventory/filters";

export function InventoryError() { return <div className="form-feedback error" role="alert">No pudimos consultar el inventario. <Link href="/vehiculos" className="text-link">Volver a intentar</Link></div>; }
export function InventoryPagination({ page, count, href }: { page: number; count: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(count / inventoryPageSize));
  return <div className="panel-footer inventory-pagination"><span role="status">{count} {count === 1 ? "registro" : "registros"} · Página {page} de {pages}</span><div>{page > 1 && <Link className="button secondary" href={href(page - 1)}>Anterior</Link>}{page < pages && <Link className="button secondary" href={href(page + 1)}>Siguiente</Link>}</div></div>;
}
export function VehicleCatalog({ vehicles, count, page, filters, years, admin, quote, quoteError, error }: { vehicles: Vehicle[]; count: number; page: number; filters: InventoryFilters; years: number[]; admin: boolean; quote: DollarQuote | null; quoteError: boolean; error: boolean }) {
  const href = (next: number) => `/vehiculos?${inventorySearchParams(filters, next)}`;
  const filtered = !!(filters.query || filters.stock || filters.archived || filters.minYear || filters.maxYear || filters.transmission || filters.currency || filters.minPrice || filters.maxPrice || page > 1);
  const characteristics = !!(filters.minYear || filters.maxYear || filters.transmission || filters.currency || filters.minPrice || filters.maxPrice);
  return <>
    <PageHeading eyebrow="INVENTARIO COMERCIAL" title="Vehículos" description="Catálogo por marca y modelo, con disponibilidad por unidad." action={admin ? <Link className="button primary" href="/vehiculos/nuevo"><Plus size={17} />Crear vehículo</Link> : <span className="read-only"><LockKeyhole size={15} />Sólo lectura</span>} />
    <section className="panel inventory-catalog-panel">
      <CatalogFilters filters={filters} years={years} />
      <InventoryQuote quote={quote} error={quoteError} />
      {error ? <InventoryError /> : quoteError ? null : vehicles.length ? <div className="inventory-catalog">{vehicles.map((vehicle) => <Link className="inventory-catalog-row" key={vehicle.id} href={`/vehiculos/${vehicle.id}?${inventorySearchParams(filters)}`}>
        <span className="inventory-car-icon"><CarFront size={24} aria-hidden="true" /></span>
        <div className="inventory-catalog-name"><h2>{vehicle.brand} {vehicle.model}</h2><p>{characteristics
          ? `${vehicle.matching_units} ${vehicle.matching_units === 1 ? "unidad coincide" : "unidades coinciden"} con los filtros`
          : `${vehicle.units_count} ${vehicle.units_count === 1 ? "unidad registrada" : "unidades registradas"} · Precios en la ficha`}</p></div>
        <span className={`inventory-status ${vehicle.archived_at ? "withdrawn" : vehicle.available_count ? "available" : "empty"}`}>{vehicle.archived_at ? "Dado de baja" : vehicle.available_count ? `${vehicle.available_count} ${vehicle.available_count === 1 ? "disponible" : "disponibles"}` : "Sin stock"}</span><ChevronRight size={18} aria-hidden="true" />
      </Link>)}</div> : <EmptyState icon={CarFront} title={filtered ? "No hay vehículos para esta búsqueda" : "El catálogo empieza acá"} description={filtered ? "Probá otra marca o modelo, o quitá algún filtro para ampliar los resultados." : admin ? "Creá una ficha por marca y modelo. Después agregá las unidades que tengas en inventario." : "Los vehículos cargados por administración aparecerán en este listado."}>{filtered && <Link className="button secondary" href="/vehiculos">Ver catálogo activo</Link>}</EmptyState>}
      {!error && !quoteError && <InventoryPagination page={page} count={count} href={href} />}
    </section>
  </>;
}
