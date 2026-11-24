"use client";

import { Search, X } from "lucide-react";
import { emptyInventoryFilters, inventorySearchParams, priceFilterError, yearFilterError, type InventoryFilters } from "@/lib/inventory/filters";
import { useAutoFilters } from "./auto-filters";
import { RangeFilter } from "./range-filter";

export function CatalogFilters({ filters, years }: { filters: InventoryFilters; years: number[] }) {
  const { value, pending, update } = useAutoFilters(filters, next => `/vehiculos?${inventorySearchParams(next)}`, next => !priceFilterError(next) && !yearFilterError(next));
  const error = priceFilterError(value) || yearFilterError(value);
  const minYear = years.length ? Math.min(...years) : 1980;
  const maxYear = years.length ? Math.max(...years) : 2030;
  return <div className="inventory-filter-area" data-pending={pending || undefined}>
    <form className="inventory-filters" onSubmit={event => { event.preventDefault(); update(value, 0); }}>
      <label className="inventory-search"><span>Marca o modelo</span><div><Search size={17} aria-hidden="true" /><input name="q" type="search" value={value.query} maxLength={120} autoComplete="off" placeholder="Escribí para buscar…" onChange={e => update({ ...value, query: e.target.value })} /></div></label>
      <label><span>Stock</span><select name="stock" value={value.stock} onChange={e => update({ ...value, stock: e.target.value }, 0)}><option value="">Todos</option><option value="available">Disponibles</option><option value="empty">Sin stock</option></select></label>
      <label><span>Transmisión</span><select name="transmission" value={value.transmission} onChange={e => update({ ...value, transmission: e.target.value }, 0)}><option value="">Todas</option><option value="automatic">Automática</option><option value="manual">Manual</option><option value="other">Otra</option></select></label>
      <label><span>Catálogo</span><select name="archived" value={String(value.archived)} onChange={e => update({ ...value, archived: e.target.value === "true" }, 0)}><option value="false">Activos</option><option value="true">Dados de baja</option></select></label>
      <button className="button secondary inventory-reset" type="button" onClick={() => update(emptyInventoryFilters, 0)}><X size={15} aria-hidden="true" />Limpiar</button>
      <div className="inventory-range-grid">
        <RangeFilter label="Año del vehículo" name="year" lower={value.minYear} upper={value.maxYear} min={minYear} max={maxYear} onChange={(minYear, maxYear) => update({ ...value, minYear, maxYear })} />
        <RangeFilter label="Presupuesto" name="price" lower={value.minPrice} upper={value.maxPrice} min={0} max={value.currency === "ARS" ? 100000000 : 100000} step={0.01} disabled={!value.currency} onChange={(minPrice, maxPrice) => update({ ...value, minPrice, maxPrice })} accessory={<select aria-label="Moneda del presupuesto" name="currency" value={value.currency} onChange={e => update({ ...value, currency: e.target.value, minPrice: "", maxPrice: "" }, 0)}><option value="">Moneda</option><option value="USD">USD</option><option value="ARS">ARS</option></select>} />
      </div>
    </form>
    {error && <p className="field-error" role="alert">{error}</p>}
    <span className="sr-only" role="status">{pending ? "Actualizando resultados…" : ""}</span>
  </div>;
}
