"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRightLeft, Bot, CalendarClock, CarFront, History, Inbox, LockKeyhole, MessageSquare, ReceiptText, Sparkles, UserRound } from "lucide-react";
import { demoAttempts, demoClients, demoCount, demoDate, demoFollowups, demoMoney, demoOpportunities, demoPurchases, demoVehicles, vehicleName, type DemoOpportunity, type DemoVehicle } from "@/lib/demo-data";
import { usePreviewRole } from "./app-shell";
import { BackLink, EmptyState, Metric, Notice, PageHeading, Panel, PendingButton } from "./ui";
import { RecordArrow, RecordCell, RecordIdentity, SectionIntro, StatusBadge, TimelineEvent } from "./record-ui";

const historyPresentation = {
  received: { icon: Inbox, label: "Recepción de consulta" },
  assigned: { icon: UserRound, label: "Cambio de responsable" },
  state: { icon: ArrowRightLeft, label: "Cambio de estado" },
};

function Details({ items }: { items: [string, ReactNode][] }) {
  return <dl className="details-grid">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function SectionButtons({ items, value, onChange }: { items: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="tabs" aria-label="Secciones de la ficha">{items.map((item) => <button type="button" key={item} aria-pressed={value === item} className={value === item ? "selected" : ""} onClick={() => onChange(item)}>{item}</button>)}</div>;
}

function Attempts({ opportunityIds }: { opportunityIds: string[] }) {
  const rows = demoAttempts.filter((item) => opportunityIds.includes(item.opportunityId));
  return rows.length ? <ol className="activity-timeline">{rows.map((item) => <TimelineEvent key={item.id}
    at={item.at} icon={MessageSquare} label={`Intento realizado · ${item.channel}`} title={item.result}
    description="Contacto realizado y respuesta recibida. Cuenta como un intento de recontacto." actor={item.owner}>
    <Link className="text-link" href={`/oportunidades/${item.opportunityId}`}>Ver oportunidad asociada →</Link>
  </TimelineEvent>)}</ol> : <EmptyState icon={CalendarClock} title="Sin intentos de recontacto" description="Este ejemplo todavía no tiene contactos realizados por un vendedor." compact />;
}

export function DemoOpportunityDetail({ opportunity }: { opportunity: DemoOpportunity }) {
  const role = usePreviewRole();
  const [tab, setTab] = useState("Conversación");
  const client = demoClients.find((client) => client.id === opportunity.clientId)!;
  const vehicle = demoVehicles.find((vehicle) => vehicle.id === opportunity.vehicleId)!;
  const followups = demoFollowups.filter((item) => item.opportunityId === opportunity.id);
  function showEvidence() {
    setTab("Conversación");
    requestAnimationFrame(() => {
      const message = document.getElementById(opportunity.evidence.messageId);
      message?.focus();
      message?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }

  return <>
    <BackLink href="/">Volver a oportunidades</BackLink>
    <PageHeading eyebrow="OPORTUNIDAD DE DEMOSTRACIÓN" title={client.name} description={`${vehicleName(vehicle)} · ${vehicle.version} · ${vehicle.year}`} action={!opportunity.assigned && <PendingButton>Tomar oportunidad</PendingButton>} />
    <div className="detail-grid">
      <div className="stack">
        <Panel title="Cliente e interés" action={<Link className="text-link" href={`/clientes/${client.id}`}>Ver historial del cliente →</Link>}>
          <Details items={[
            ["Cliente", client.name], ["Contacto", client.email], ["Zona ilustrativa", client.zone],
            ["Vehículo de interés", <Link key="vehicle" className="text-link" href={`/vehiculos/${vehicle.id}`}>{vehicleName(vehicle)} →</Link>],
            ["Presupuesto de ejemplo", opportunity.budget], ["Plazo de compra", opportunity.timeframe],
          ]} />
        </Panel>
        <section className="panel">
          <SectionButtons items={["Conversación", "Seguimiento", "Historial"]} value={tab} onChange={setTab} />
          {tab === "Conversación" && <div className="panel-body">
            <SectionIntro title="Conversación" count={opportunity.messages.length} description="Mensajes de ejemplo. El fragmento resaltado fundamenta el score ilustrativo." />
            <div className="demo-conversation">{opportunity.messages.map((message) => {
              const isEvidence = message.id === opportunity.evidence.messageId;
              const start = isEvidence ? message.text.indexOf(opportunity.evidence.quote) : -1;
              return <article key={message.id} id={message.id} tabIndex={-1} className={`demo-message ${message.sender === "Cliente" ? "incoming" : "outgoing"}`}>
                <header><span className="message-author">{message.sender === "Bot" ? <Bot size={15} /> : <UserRound size={15} />}<strong>{message.sender === "Cliente" ? client.name : message.sender === "Bot" ? "Bot · ejemplo" : "Vendedor de demostración"}</strong></span><time dateTime={message.at}>{demoDate(message.at)}</time></header>
                <p>{start >= 0 ? <>{message.text.slice(0, start)}<mark>{opportunity.evidence.quote}</mark>{message.text.slice(start + opportunity.evidence.quote.length)}</> : message.text}</p>
                {isEvidence && <span className="message-evidence-label"><Sparkles size={12} /> Evidencia del score</span>}
              </article>;
            })}</div>
            <div className="activity-actions"><PendingButton>Enviar mensaje</PendingButton></div>
          </div>}
          {tab === "Seguimiento" && <div className="panel-body">
            <section className="activity-group">
              <SectionIntro title="Próximas actividades" count={followups.length} description="Tareas de la agenda de ejemplo. Programar una tarea no cuenta como intento realizado." />
              {followups.length ? <ol className="activity-timeline">{followups.map((item) => <TimelineEvent key={item.id}
                at={item.at} icon={CalendarClock} label="Recontacto programado" title={item.text} description="Llamada pendiente de realizar en este ejemplo." actor={item.owner} />)}</ol>
                : <EmptyState icon={CalendarClock} title="Sin tareas programadas" description="La oportunidad está a la espera de seguimiento." compact />}
            </section>
            <section className="activity-group">
              <SectionIntro title="Intentos realizados" count={demoAttempts.filter((item) => item.opportunityId === opportunity.id).length} description="Contactos efectivamente realizados, con su canal y resultado." />
              <Attempts opportunityIds={[opportunity.id]} />
            </section>
            <div className="activity-actions"><PendingButton>Registrar seguimiento</PendingButton></div>
          </div>}
          {tab === "Historial" && <div className="panel-body">
            <SectionIntro title="Recorrido de la oportunidad" count={opportunity.history.length} description="Del ingreso al seguimiento: cambios de estado y responsable, en orden cronológico." />
            <ol className="activity-timeline">{opportunity.history.map((event) => <TimelineEvent key={`${event.at}-${event.kind}`}
              at={event.at} icon={historyPresentation[event.kind].icon} label={historyPresentation[event.kind].label}
              title={event.title} description={event.description} actor={event.actor} />)}</ol>
          </div>}
        </section>
      </div>
      <aside className="stack">
        <Panel title="Gestión de la oportunidad"><div className="panel-body form-stack">
          <label>Responsable<select disabled value={opportunity.assigned ? "asignado" : "espera"}><option value="asignado">Vendedor de demostración</option><option value="espera">Sin asignar</option></select></label>
          {role === "admin" && <PendingButton>Asignar responsable</PendingButton>}
          <label>Estado de ejemplo<select disabled value={opportunity.state}><option>{opportunity.state}</option></select></label>
          <PendingButton>Actualizar estado</PendingButton>
          <p className="field-help">El catálogo de estados y las reglas de asignación siguen pendientes.</p>
        </div></Panel>
        <Panel title="Score y evidencia" action={<Sparkles size={18} />}><div className="panel-body">
          <div className="score-value">{opportunity.score}<span> / 100 · ilustrativo</span></div>
          <div className="score-track" aria-hidden="true"><span style={{ width: `${opportunity.score}%` }} /></div>
          <p className="field-help">Valor escrito para la demo. No hay motor de scoring ni escala definitiva.</p>
          <div className="evidence-placeholder"><span className="eyebrow">FRAGMENTO DEL MENSAJE</span><blockquote>{opportunity.evidence.quote}</blockquote><p>{opportunity.evidence.reason}</p><button type="button" className="button secondary" onClick={showEvidence}>Ver mensaje original</button></div>
        </div></Panel>
      </aside>
    </div>
  </>;
}

export function DemoClientDetail({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState("Consultas");
  const client = demoClients.find((client) => client.id === clientId)!;
  const opportunities = demoOpportunities.filter((item) => item.clientId === client.id);
  const ids = opportunities.map((item) => item.id);
  const attempts = demoAttempts.filter((item) => ids.includes(item.opportunityId));
  const purchases = demoPurchases.filter((item) => item.clientId === client.id);
  return <>
    <BackLink href="/clientes">Volver a clientes</BackLink>
    <PageHeading eyebrow="CLIENTE DE DEMOSTRACIÓN" title={client.name} description="Consultas, recontactos y compras en una sola ficha." />
    <Panel title="Datos del cliente"><Details items={[["Nombre", client.name], ["Correo ficticio", client.email], ["Teléfono", client.phone], ["Zona ilustrativa", client.zone]]} /></Panel>
    <div className="metrics-grid four">
      <Metric label="Consultas" caption="Oportunidades comerciales" icon={History} value={opportunities.length} />
      <Metric label="Mensajes" caption="Entrantes y salientes" icon={MessageSquare} value={opportunities.reduce((total, item) => total + item.messages.length, 0)} />
      <Metric label="Recontactos" caption="Intentos realizados" icon={CalendarClock} value={attempts.length} />
      <Metric label="Compras" caption="Operaciones históricas" icon={CarFront} value={purchases.length} />
    </div>
    <section className="panel">
      <SectionButtons items={["Consultas", "Recontactos", "Compras"]} value={tab} onChange={setTab} />
      {tab === "Consultas" && <div className="demo-list">{opportunities.map((item) => {
        const vehicle = demoVehicles.find((vehicle) => vehicle.id === item.vehicleId)!;
        return <Link key={item.id} className="demo-row history-row" href={`/oportunidades/${item.id}`}>
          <RecordIdentity avatar={<CarFront size={21} />} title={vehicleName(vehicle)} subtitle={`${vehicle.version} · ${vehicle.year}`} />
          <RecordCell label="Estado"><StatusBadge tone={item.assigned ? "neutral" : "accent"}>{item.state}</StatusBadge></RecordCell>
          <RecordCell label="Fecha de consulta"><time dateTime={item.messages[0].at}>{demoDate(item.messages[0].at)}</time></RecordCell><RecordArrow />
        </Link>;
      })}</div>}
      {tab === "Recontactos" && <div className="panel-body"><SectionIntro title="Historial de recontactos" count={attempts.length} description="Los intentos realizados en todas las consultas de este cliente." /><Attempts opportunityIds={ids} /></div>}
      {tab === "Compras" && <div className="panel-body"><SectionIntro title="Compras anteriores" count={purchases.length} description="Operaciones históricas de ejemplo, independientes del inventario actual." />
        {purchases.length ? <ol className="activity-timeline">{purchases.map((item) => <TimelineEvent key={item.id}
          at={item.date} icon={ReceiptText} label="Compra histórica · ejemplo" title={item.description}
          description={item.note} amount={demoMoney(item.amount, item.currency)} />)}</ol>
          : <EmptyState icon={CarFront} title="Sin compras anteriores" description="Este cliente de ejemplo todavía no registra compras." compact />}
      </div>}
    </section>
  </>;
}

export function DemoVehicleDetail({ vehicle, editing = false }: { vehicle: DemoVehicle; editing?: boolean }) {
  const role = usePreviewRole();
  const path = `/vehiculos/${vehicle.id}`;
  return <>
    <BackLink href={editing ? path : "/vehiculos"}>{editing ? "Volver al detalle" : "Volver a vehículos"}</BackLink>
    <PageHeading eyebrow="VEHÍCULO DE DEMOSTRACIÓN" title={`${editing ? "Editar " : ""}${vehicleName(vehicle)}`} description={`${vehicle.version} · ${vehicle.year}`} action={!editing && (role === "admin" ? <Link className="button secondary" href={`${path}/editar`}>Ver formulario de edición</Link> : <span className="read-only"><LockKeyhole size={15} /> Sólo lectura</span>)} />
    <Notice>Vehículo ficticio. Precio y stock son ejemplos para revisar el diseño, no información comercial real. Los cambios no se guardan.</Notice>
    {editing ? (role === "admin" ? <Panel title="Datos del vehículo"><form className="panel-body form-grid" onSubmit={(event) => event.preventDefault()}>
      <label>Marca *<input name="marca" required defaultValue={vehicle.brand} /></label>
      <label>Modelo *<input name="modelo" required defaultValue={vehicle.model} /></label>
      <label>Versión<input name="version" defaultValue={vehicle.version} /></label>
      <label>Año *<input name="anio" required type="number" step="1" defaultValue={vehicle.year} /></label>
      <label>Precio *<input name="precio" required type="number" min="0" step="0.01" defaultValue={vehicle.price} /></label>
      <label>Moneda *<select name="moneda" required defaultValue={vehicle.currency}><option value="ARS">ARS · Peso argentino</option><option value="USD">USD · Dólar estadounidense</option></select></label>
      <label>Stock *<input name="stock" required type="number" min="0" step="1" defaultValue={vehicle.stock} /></label>
      <div className="full-width form-actions"><Link className="button secondary" href={path}>Volver sin guardar</Link><PendingButton>Guardar cambios</PendingButton></div>
    </form></Panel> : <section className="panel"><EmptyState icon={LockKeyhole} title="Vista de vendedor: sólo consulta" description="Cambiá a Admin en el selector de demostración para revisar la edición." compact /></section>) : <>
      <Panel title="Información del vehículo"><Details items={[["Marca", vehicle.brand], ["Modelo", vehicle.model], ["Versión", vehicle.version], ["Año", vehicle.year], ["Precio ficticio", demoMoney(vehicle.price, vehicle.currency)], ["Moneda", vehicle.currency], ["Stock ficticio", demoCount(vehicle.stock, "unidad", "unidades")], ["Estado del registro", "Activo · ejemplo"]]} /></Panel>
      {role === "admin" && <div className="danger-zone"><div><h2>Baja del vehículo</h2><p>Acción visual pendiente de implementación.</p></div><PendingButton>Dar de baja</PendingButton></div>}
    </>}
  </>;
}
