"use client";

import { leadStatuses } from "@/lib/crm/types";
import { useAutoFilters } from "./auto-filters";

export function CustomerFilters({ query }: { query: string }) {
  const { value, pending, update } = useAutoFilters({ query }, next => `/clientes?${new URLSearchParams({ q: next.query.trim() })}`, () => true);
  return <form className="crm-toolbar" data-pending={pending || undefined} onSubmit={event => { event.preventDefault(); update(value, 0); }}>
    <label>Buscar cliente<input name="q" type="search" value={value.query} maxLength={160} autoComplete="off" placeholder="Nombre o teléfono" onChange={event => update({ query: event.target.value })} /></label>
    <span className="filter-status" role="status">{pending ? "Actualizando resultados…" : ""}</span>
  </form>;
}

export function OpportunityFilters({ tab, status }: { tab: "mine" | "all"; status: string }) {
  const { value, pending, update } = useAutoFilters({ tab, status }, next => `/oportunidades?${new URLSearchParams(next)}`, () => true);
  return <form className="crm-toolbar" data-pending={pending || undefined} onSubmit={event => { event.preventDefault(); update(value, 0); }}>
    <label>Estado<select name="status" value={value.status} onChange={event => update({ tab, status: event.target.value }, 0)}><option value="">Todos los estados</option>{Object.entries(leadStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <span className="filter-status" role="status">{pending ? "Actualizando resultados…" : ""}</span>
  </form>;
}
