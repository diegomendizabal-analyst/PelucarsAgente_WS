"use client";

import { useState } from "react";
import { CalendarClock, CarFront, History, MessageSquare, Search, Users } from "lucide-react";
import { BackLink, BlankDetails, EmptyState, Metric, Notice, PageHeading, Panel, PreviewLink } from "./ui";

export function ClientsList() {
  const [search, setSearch] = useState("");
  return <><PageHeading eyebrow="RELACIONES COMERCIALES" title="Clientes" description="Una persona, todas sus consultas. Conservá el contexto de cada relación." /><section className="panel"><div className="filter-bar"><label className="search-field"><Search size={18} /><input type="search" aria-label="Buscar clientes" placeholder="Buscar por nombre o teléfono…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="subtle-label">Historial unificado</span></div><EmptyState icon={Users} title={search ? "Todavía no hay datos para buscar" : "Cada cliente tiene su historia"} description="Acá podrás consultar sus oportunidades, intentos de recontacto y compras anteriores, sin duplicar su ficha."><PreviewLink href="/clientes/vista-previa">Explorar historial vacío</PreviewLink></EmptyState><div className="panel-footer">Sin clientes conectados</div></section></>;
}
const historySections = [
  { id: "consultas", label: "Consultas", icon: History, title: "Sin consultas registradas", description: "Cada oportunidad comercial será una consulta independiente, con su interés, estado y responsable.", href: "/oportunidades/vista-previa" },
  { id: "recontactos", label: "Recontactos", icon: CalendarClock, title: "Sin intentos de recontacto", description: "Cada intento realizado mostrará fecha, canal, vendedor, resultado y oportunidad asociada. Una tarea programada todavía no cuenta como intento." },
  { id: "compras", label: "Compras", icon: CarFront, title: "Sin compras registradas", description: "Las compras conservarán su fecha, los vehículos adquiridos y los importes históricos. Un cliente podrá tener más de una compra." },
];
export function ClientDetail() {
  const [tab, setTab] = useState("consultas");
  const current = historySections.find((item) => item.id === tab)!;
  return <><BackLink href="/clientes">Volver a clientes</BackLink><PageHeading eyebrow="ESTRUCTURA DE HISTORIAL · SIN REGISTRO" title="Historial del cliente" description="El recorrido completo de una relación comercial." /><Notice>Vista previa sin cliente seleccionado. Los contadores representan conceptos distintos y se mostrarán cuando existan datos.</Notice><Panel title="Datos del cliente"><BlankDetails labels={["Nombre completo", "Teléfono principal", "Correo electrónico", "Zona"]} /></Panel><div className="metrics-grid four"><Metric label="Consultas" caption="Oportunidades comerciales" icon={History} /><Metric label="Mensajes" caption="Entrantes y salientes" icon={MessageSquare} /><Metric label="Recontactos" caption="Intentos realizados" icon={CalendarClock} /><Metric label="Compras" caption="Operaciones de compra" icon={CarFront} /></div><section className="panel"><div className="tabs" aria-label="Historial del cliente">{historySections.map((item) => <button type="button" key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? "selected" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</div><EmptyState icon={current.icon} title={current.title} description={current.description}>{current.href && <PreviewLink href={current.href}>Explorar ficha de consulta vacía</PreviewLink>}</EmptyState></section></>;
}
