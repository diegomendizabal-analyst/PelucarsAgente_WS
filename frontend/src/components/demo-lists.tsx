"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, CarFront, Inbox, LockKeyhole, Plus, Search, UserRound, Users } from "lucide-react";
import { demoAttempts, demoClients, demoFollowups, demoMatches, demoMoney, demoOpportunities, demoPurchases, demoVehicles, vehicleName } from "@/lib/demo-data";
import { usePreviewRole } from "./app-shell";
import { EmptyState, Metric, Notice, PageHeading, PreviewLink } from "./ui";

export function DemoOpportunityInbox() {
  const [tab, setTab] = useState("espera");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const waiting = demoOpportunities.filter((item) => !item.assigned);
  const mine = demoOpportunities.filter((item) => item.assigned);
  const rows = (tab === "espera" ? waiting : mine).filter((item) => {
    const client = demoClients.find((client) => client.id === item.clientId)!;
    const vehicle = demoVehicles.find((vehicle) => vehicle.id === item.vehicleId)!;
    return demoMatches(`${client.name} ${vehicleName(vehicle)}`, search) && (!status || item.state === status);
  });

  return <>
    <PageHeading eyebrow="GESTIÓN COMERCIAL" title="Oportunidades" description="Cada consulta, con el contexto que necesitás para dar el siguiente paso." />
    <div className="metrics-grid">
      <Metric label="En espera" caption="Pendientes de responsable" icon={Inbox} value={waiting.length} />
      <Metric label="Mis oportunidades" caption="Vendedor de demostración" icon={UserRound} value={mine.length} />
      <Metric label="Agenda de recontactos" caption="Tareas programadas, no intentos" icon={CalendarClock} value={demoFollowups.length} />
    </div>
    <Notice>Ejemplos ficticios. “Mis oportunidades” representa al vendedor de demostración en ambas vistas. Los estados y puntajes son ilustrativos; las reglas definitivas siguen pendientes.</Notice>
    <section className="panel" aria-label="Bandeja de oportunidades">
      <div className="tabs" aria-label="Bandejas">
        {[{ id: "espera", label: "En espera", count: waiting.length }, { id: "mias", label: "Mis oportunidades", count: mine.length }].map((item) => (
          <button type="button" key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? "selected" : ""} onClick={() => setTab(item.id)}>{item.label}<span>{item.count}</span></button>
        ))}
      </div>
      <div className="filter-bar">
        <label className="search-field"><Search size={18} /><input type="search" aria-label="Buscar oportunidades" placeholder="Buscar por cliente o interés…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select aria-label="Filtrar oportunidades por estado" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option>{Array.from(new Set(demoOpportunities.map((item) => item.state))).map((state) => <option key={state}>{state}</option>)}</select>
      </div>
      <div className="list-columns" aria-hidden="true"><span>CLIENTE / INTERÉS</span><span>SCORE DEMO</span><span>RESPONSABLE</span><span>ESTADO</span></div>
      <div className="demo-list">{rows.map((item) => {
        const client = demoClients.find((client) => client.id === item.clientId)!;
        const vehicle = demoVehicles.find((vehicle) => vehicle.id === item.vehicleId)!;
        return <Link key={item.id} href={`/oportunidades/${item.id}`} className="demo-row opportunity-row">
          <div className="demo-person"><span className="demo-avatar">{client.initials}</span><span><strong>{client.name}</strong><small>{vehicleName(vehicle)} · {vehicle.year}</small></span></div>
          <div><span className="demo-score">{item.score}<small>/100</small></span></div>
          <div className="demo-cell"><small>Responsable</small>{item.assigned ? "Vendedor de demostración" : "Sin asignar"}</div>
          <div><span className="demo-badge">{item.state}</span></div>
        </Link>;
      })}</div>
      {rows.length === 0 && <EmptyState icon={Inbox} title="Sin coincidencias" description="Probá otra búsqueda o cambiá el estado dentro de esta bandeja." />}
      <div className="panel-footer"><span>{rows.length} oportunidades de ejemplo</span><Link href="/oportunidades/vista-previa">Ver ficha vacía</Link></div>
    </section>
  </>;
}

export function DemoClientsList() {
  const [search, setSearch] = useState("");
  const rows = demoClients.filter((client) => demoMatches(`${client.name} ${client.email}`, search));
  return <>
    <PageHeading eyebrow="RELACIONES COMERCIALES" title="Clientes" description="Una persona, todas sus consultas. Explorá dos historias de demostración." />
    <section className="panel">
      <div className="filter-bar"><label className="search-field"><Search size={18} /><input type="search" aria-label="Buscar clientes" placeholder="Buscar por nombre o correo…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="subtle-label">Datos ficticios</span></div>
      <div className="demo-list">{rows.map((client) => {
        const opportunities = demoOpportunities.filter((item) => item.clientId === client.id);
        const attempts = demoAttempts.filter((item) => opportunities.some((opportunity) => opportunity.id === item.opportunityId));
        return <Link key={client.id} href={`/clientes/${client.id}`} className="demo-row client-row">
          <div className="demo-person"><span className="demo-avatar">{client.initials}</span><span><strong>{client.name}</strong><small>{client.email}</small></span></div>
          <span className="demo-cell"><small>Consultas</small>{opportunities.length}</span>
          <span className="demo-cell"><small>Intentos de recontacto</small>{attempts.length}</span>
          <span className="demo-cell"><small>Compras</small>{demoPurchases.filter((item) => item.clientId === client.id).length}</span>
        </Link>;
      })}</div>
      {rows.length === 0 && <EmptyState icon={Users} title="Sin coincidencias" description="Probá buscar Ana o Bruno para explorar sus fichas." />}
      <div className="panel-footer"><span>{rows.length} clientes de ejemplo</span><Link href="/clientes/vista-previa">Ver historial vacío</Link></div>
    </section>
  </>;
}

export function DemoVehiclesList() {
  const role = usePreviewRole();
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState("");
  const rows = demoVehicles.filter((vehicle) => demoMatches(`${vehicleName(vehicle)} ${vehicle.version}`, search) && (!stock || (stock === "con-stock" ? vehicle.stock > 0 : vehicle.stock === 0)));
  return <>
    <PageHeading eyebrow="INVENTARIO COMERCIAL" title="Vehículos" description="Dos vehículos de ejemplo para recorrer el inventario. Precios y stock ficticios." action={role === "admin" ? <Link href="/vehiculos/nuevo" className="button primary"><Plus size={17} />Alta de vehículo · diseño</Link> : <span className="read-only"><LockKeyhole size={15} /> Sólo lectura</span>} />
    <section className="panel">
      <div className="filter-bar">
        <label className="search-field"><Search size={18} /><input type="search" aria-label="Buscar vehículos" placeholder="Buscar por marca, modelo o versión…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select aria-label="Filtrar por stock" value={stock} onChange={(event) => setStock(event.target.value)}><option value="">Todo el stock</option><option value="con-stock">Con stock</option><option value="sin-stock">Sin stock</option></select>
      </div>
      <div className="list-columns" aria-hidden="true"><span>VEHÍCULO</span><span>AÑO</span><span>PRECIO DEMO</span><span>STOCK DEMO</span></div>
      <div className="demo-list">{rows.map((vehicle) => <Link key={vehicle.id} href={`/vehiculos/${vehicle.id}`} className="demo-row vehicle-row">
        <div className="demo-person"><span className="demo-avatar"><CarFront size={22} /></span><span><strong>{vehicleName(vehicle)}</strong><small>{vehicle.version}</small></span></div>
        <span className="demo-cell"><small>Año</small>{vehicle.year}</span>
        <span className="demo-cell"><small>Precio ficticio</small>{demoMoney(vehicle.price, vehicle.currency)}</span>
        <span className="demo-badge">{vehicle.stock ? `${vehicle.stock} unidad` : "Sin stock"}</span>
      </Link>)}</div>
      {rows.length === 0 && <EmptyState icon={CarFront} title="Sin coincidencias" description="Probá otra marca o cambiá el filtro de stock." />}
      <div className="panel-footer"><span>{rows.length} vehículos de ejemplo</span><Link href="/vehiculos/vista-previa">Ver detalle vacío</Link></div>
    </section>
    <div className="demo-bottom-link"><PreviewLink href="/">Volver a oportunidades</PreviewLink></div>
  </>;
}
