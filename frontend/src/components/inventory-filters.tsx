"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { emptyInventoryFilters, inventorySearchParams, priceFilterError, type InventoryFilters } from "@/lib/inventory/filters";

export function CatalogFilters({ filters, years }: { filters: InventoryFilters; years: number[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState({ query: filters.query, source: filters.query });
  const [optimistic, setOptimistic] = useOptimistic({ ...filters, query: draft.query });
  const [pending, startTransition] = useTransition();
  // Conservar espacios al escribir; sincronizar enlaces/atrás cuando termina la navegación.
  if (!pending && draft.source !== filters.query) {
    setDraft({ source: filters.query, query: draft.query.trim() === filters.query ? draft.query : filters.query });
  }
  const request = useRef(0);
  useEffect(() => {
    const cancel = () => { request.current++; };
    window.addEventListener("popstate", cancel);
    return () => { cancel(); window.removeEventListener("popstate", cancel); };
  }, []);
  function update(next: InventoryFilters, delay = 0) {
    const version = ++request.current;
    setDraft({ query: next.query, source: filters.query });
    startTransition(async () => {
      setOptimistic(next);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (request.current !== version) return;
      startTransition(() => router.replace(`/vehiculos?${inventorySearchParams(next)}`, { scroll: false }));
    });
  }
  const yearOptions = [...new Set([...years, ...(optimistic.year ? [Number(optimistic.year)] : [])])].sort((a, b) => b - a);
  const priceError = priceFilterError(optimistic);
  return <div className="inventory-filter-area" data-pending={pending || undefined}>
    <form className="inventory-filters" action="/vehiculos" onSubmit={(event) => { event.preventDefault(); update(optimistic); }}>
      <label className="inventory-search"><span>Marca o modelo</span><div><Search size={17} aria-hidden="true" /><input name="q" type="search" value={draft.query} maxLength={120} autoComplete="off" placeholder="Escribí para buscar…" onChange={(event) => update({ ...optimistic, query: event.target.value }, 300)} /></div></label>
      <label><span>Stock</span><select name="stock" value={optimistic.stock} onChange={(event) => update({ ...optimistic, stock: event.target.value })}><option value="">Todos</option><option value="available">Disponibles</option><option value="empty">Sin stock</option></select></label>
      <label><span>Transmisión</span><select name="transmission" value={optimistic.transmission} onChange={(event) => update({ ...optimistic, transmission: event.target.value })}><option value="">Todas</option><option value="automatic">Automática</option><option value="manual">Manual</option><option value="other">Otra</option></select></label>
      <label><span>Año</span><select name="year" value={optimistic.year} onChange={(event) => update({ ...optimistic, year: event.target.value })}><option value="">Todos</option>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <label><span>Catálogo</span><select name="archived" value={String(optimistic.archived)} onChange={(event) => update({ ...optimistic, archived: event.target.value === "true" })}><option value="false">Activos</option><option value="true">Dados de baja</option></select></label>
      <button className="button secondary inventory-reset" type="button" onClick={() => update(emptyInventoryFilters)}><X size={15} aria-hidden="true" />Limpiar</button>
      <fieldset className="inventory-price-filters">
        <legend>Precio publicado</legend>
        <div className="inventory-price-inputs">
          <label><span>Moneda</span><select name="currency" value={optimistic.currency} onChange={(event) => update({ ...optimistic, currency: event.target.value })} aria-describedby="price-filter-help"><option value="">Todas · sin convertir</option><option value="USD">USD · Dólares</option><option value="ARS">ARS · Pesos</option>{optimistic.currency && !["ARS", "USD"].includes(optimistic.currency) && <option value={optimistic.currency}>Moneda no válida</option>}</select></label>
          <label><span>Precio mínimo</span><input name="min_price" inputMode="decimal" value={optimistic.minPrice} maxLength={15} placeholder="Sin mínimo" autoComplete="off" aria-invalid={!!priceError} aria-describedby={priceError ? "price-filter-error price-filter-help" : "price-filter-help"} onChange={(event) => update({ ...optimistic, minPrice: event.target.value }, 300)} /></label>
          <label><span>Precio máximo</span><input name="max_price" inputMode="decimal" value={optimistic.maxPrice} maxLength={15} placeholder="Sin máximo" autoComplete="off" aria-invalid={!!priceError} aria-describedby={priceError ? "price-filter-error price-filter-help" : "price-filter-help"} onChange={(event) => update({ ...optimistic, maxPrice: event.target.value }, 300)} /></label>
        </div>
        <p id="price-filter-help">Elegí una moneda para usar el rango. Los importes se comparan sin conversión; las unidades sin precio quedan fuera del filtro.</p>
        {priceError && <p id="price-filter-error" className="field-error" role="alert">{priceError}</p>}
      </fieldset>
    </form>
    <p className="inventory-filter-feedback" role="status" aria-live="polite">{pending ? "Actualizando resultados…" : "Los filtros se aplican automáticamente."}</p>
  </div>;
}
