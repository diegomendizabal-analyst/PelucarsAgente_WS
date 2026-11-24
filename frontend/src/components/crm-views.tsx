import Link from "next/link";
import { Inbox, Users, ChevronRight, Clock3 } from "lucide-react";
import { EmptyState } from "./ui";
import { ClaimLead } from "./crm-controls";
import { crmDate, leadReference, leadStatuses, waitingTime, type Lead, type PendingLead, type Customer, type TimelineItem, type LeadStatus } from "@/lib/crm/types";
import { crmPageSize } from "@/lib/crm/data";
export function CrmError() { return <div role="alert" className="form-feedback error">No pudimos consultar estos datos. Usá Actualizar para volver a intentarlo.</div>; }
export function CrmPagination({page,count,href}:{page:number;count:number;href:(page:number)=>string}) {
  const pages=Math.max(1,Math.ceil(count/crmPageSize));
  if (pages === 1 && page === 1) return null;
  return <div className="panel-footer crm-pagination"><span>{count} {count===1 ? "registro" : "registros"} · Página {page} de {pages}</span><div>{page>1 && <Link className="button secondary" href={href(page-1)}>Anterior</Link>}{page<pages && <Link className="button secondary" href={href(page+1)}>Siguiente</Link>}</div></div>;
}
export function PendingRows({rows}:{rows:PendingLead[]}) {
  return rows.length ? <div className="crm-pending-list">{rows.map(row=><article className="crm-pending-row" key={row.id}>
    <div><span className="eyebrow">CONSULTA</span><strong className="crm-reference">{leadReference(row.reference_number)}</strong></div>
    <div className="crm-arrival"><time dateTime={row.waiting_since}>{crmDate(row.waiting_since)}</time><span><Clock3 size={14} aria-hidden="true"/>{waitingTime(row.waiting_since)}</span></div>
    <span className="inventory-status">Sin asignar</span><ClaimLead id={row.id}/>
  </article>)}</div> : <EmptyState icon={Inbox} title="No hay consultas en espera" description="Las nuevas consultas aparecerán aquí cuando se conecte su ingreso. Actualizá la bandeja para revisar cambios."/>;
}
export function LeadRows({rows,waiting=false}:{rows:Lead[];waiting?:boolean}) {
  return rows.length ? <div className="crm-lead-list">{rows.map(lead=><article className="crm-lead-row" key={lead.id}>
    <Link className="crm-lead-link" prefetch={false} href={`/oportunidades/${lead.id}`}><span className="crm-avatar">{(lead.customer?.full_name ?? "?").slice(0,1).toUpperCase()}</span><div><h2>{lead.customer?.full_name ?? "Nombre sin informar"}</h2><p>Consulta {leadReference(lead.reference_number)} · {crmDate(lead.created_at)}</p><small>{lead.responsible?.full_name ?? "Sin asignar"}</small></div><span className={`inventory-status ${lead.commercial_status==='lost' ? 'withdrawn' : ''}`}>{leadStatuses[lead.commercial_status]}</span><ChevronRight size={18} aria-hidden="true"/></Link>
    {waiting && <ClaimLead id={lead.id}/>}
  </article>)}</div> : <EmptyState icon={Inbox} title={waiting ? "No hay consultas en espera" : "No hay oportunidades para mostrar"} description={waiting ? "Las consultas quedarán en esta bandeja al incorporarse al sistema." : "Revisá el filtro o tomá una consulta de la bandeja de espera."}/>;
}
export function CustomerRows({rows}:{rows:Customer[]}) {
  return rows.length ? <div>{rows.map(customer=><Link className="crm-customer-row" prefetch={false} key={customer.id} href={`/clientes/${customer.id}`}><span className="crm-avatar">{(customer.full_name ?? "?").slice(0,1).toUpperCase()}</span><div><h2>{customer.full_name ?? "Nombre sin informar"}</h2><p>{customer.phone_e164}</p></div><div className="crm-customer-count"><strong>{customer.inquiry_count} {customer.inquiry_count===1 ? "consulta" : "consultas"}</strong><small>{customer.last_inquiry_at ? crmDate(customer.last_inquiry_at) : "Sin consultas"}</small></div><ChevronRight size={18} aria-hidden="true"/></Link>)}</div> : <EmptyState icon={Users} title="No hay clientes para mostrar" description="Aquí aparecerán los clientes con consultas a las que tengas acceso. También podés probar otra búsqueda."/>;
}
export function CrmTimeline({events}:{events:TimelineItem[]}) {
  if(!events.length)return <p className="crm-placeholder">No hay eventos en esta página.</p>;
  return <ol className="crm-timeline">{events.map(event=><li key={`${event.kind}-${event.id}`}><time dateTime={event.occurred_at}>{crmDate(event.occurred_at)}</time><div><span className="eyebrow">{event.kind==='assignment' ? 'RESPONSABLE' : event.old_value ? 'ESTADO' : 'INGRESO'}</span><h3>{event.kind==='assignment' ? `${event.old_value ? `${event.old_value} → ` : 'Asignada a '}${event.new_value}` : `${event.old_value ? `${leadStatuses[event.old_value as LeadStatus]} → ` : 'Consulta registrada · '}${leadStatuses[event.new_value as LeadStatus]}`}</h3>{event.reason && <p>{event.reason}</p>}<small>{event.actor_name ?? "Ingreso al sistema"}</small></div></li>)}</ol>;
}
