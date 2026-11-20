import Link from "next/link";
import { Inbox, Users } from "lucide-react";
import { requireAccount } from "@/lib/auth/session";
import { crmPage, getLead, leadContext, listAssignees, getCustomer, listLeads } from "@/lib/crm/data";
import { crmDate, leadReference, leadStatuses, type Interest } from "@/lib/crm/types";
import { BackLink, EmptyState, PageHeading, Panel } from "./ui";
import { CrmError, CrmPagination, CrmTimeline, LeadRows } from "./crm-views";
import { ManageLead, RefreshCrm } from "./crm-controls";
type Props={params:Promise<{id:string}>;searchParams:Promise<Record<string,string | string[] | undefined>>};

function InterestCard({interest}:{interest:Interest}) {
  const previous=interest.status==='replaced';
  const primary=!previous && interest.is_primary;
  const label=previous ? 'Interés anterior' : primary ? 'Interés principal' : 'Otro interés';
  const year=interest.year_min && interest.year_max
    ? interest.year_min===interest.year_max ? String(interest.year_min) : `${interest.year_min} a ${interest.year_max}`
    : interest.year_min ? `Desde ${interest.year_min}` : interest.year_max ? `Hasta ${interest.year_max}` : null;
  return <article className={`crm-interest${primary ? ' crm-interest-primary' : ''}`}>
    <div className="crm-interest-top"><span className="crm-interest-label">{label}</span>
      {interest.vehicle_id && <Link className="text-link" href={`/vehiculos/${interest.vehicle_id}`}>Ver ficha del vehículo →</Link>}
    </div>
    <h3>{interest.requested_text}</h3>
    {(interest.requested_version || year || interest.transmission) && <dl className="crm-interest-specs">
      {interest.requested_version && <div><dt>Versión</dt><dd>{interest.requested_version}</dd></div>}
      {year && <div><dt>Año buscado</dt><dd>{year}</dd></div>}
      {interest.transmission && <div><dt>Transmisión</dt><dd>{interest.transmission}</dd></div>}
    </dl>}
  </article>;
}
export async function OpportunityDetail({params,searchParams}:Props) {
  const [{id},search,account]=await Promise.all([params,searchParams,requireAccount()]);
  const {lead,error}=await getLead(id);
  if(error)return <><RefreshCrm/><CrmError/></>;
  if(!lead)return <><BackLink href="/">Volver a oportunidades</BackLink><EmptyState icon={Inbox} title="Oportunidad no disponible" description="No encontramos una oportunidad a la que tengas acceso con ese identificador."/></>;
  const page=crmPage(search.page), interestPage=crmPage(search.interests_page);
  const [context,assignees]=await Promise.all([leadContext(id,page,interestPage),account.role==='admin' ? listAssignees() : Promise.resolve({rows:[],error:false})]);
  const money=(value:number | null)=>value===null ? null : `${lead.budget_currency} ${value.toLocaleString('es-AR')}`;
  return <><BackLink href="/">Volver a oportunidades</BackLink><PageHeading eyebrow="OPORTUNIDAD COMERCIAL" title={lead.customer.full_name ?? 'Nombre sin informar'} description={`Consulta ${leadReference(lead.reference_number)} · ${leadStatuses[lead.commercial_status]}`} action={<RefreshCrm/>}/>
    <div className="crm-detail-layout"><div className="crm-detail-main">
      <Panel title="Cliente y necesidad" action={<Link className="text-link" prefetch={false} href={`/clientes/${lead.customer_id}`}>Ver historial del cliente →</Link>}>
        <dl className="details-grid"><div><dt>Teléfono</dt><dd><a href={`tel:${lead.customer.phone_e164}`}>{lead.customer.phone_e164}</a></dd></div><div><dt>Ingreso de la consulta</dt><dd>{crmDate(lead.created_at)}</dd></div><div><dt>Presupuesto declarado</dt><dd>{[lead.budget_min!==null ? `Desde ${money(lead.budget_min)}` : '',lead.budget_max!==null ? `Hasta ${money(lead.budget_max)}` : ''].filter(Boolean).join(' · ') || 'Sin informar'}</dd></div><div><dt>Financiación</dt><dd>{lead.financing_needed===null ? 'Sin informar' : lead.financing_needed ? 'Solicita financiación' : 'No solicita financiación'}</dd></div><div><dt>Plazo de compra</dt><dd>{lead.purchase_timeframe ?? 'Sin informar'}</dd></div><div><dt>Usado ofrecido</dt><dd>{lead.trade_in_details ?? 'Sin informar'}</dd></div></dl>
        <div className="crm-description">
          <h3>Nota:</h3>
          <p>{lead.summary ?? 'Todavía no hay un resumen registrado.'}</p>
        </div>
      </Panel>
      <Panel title="Interés del cliente" description="La búsqueda original se conserva aunque luego se ofrezca otra alternativa.">{context.error ? <CrmError/> : <>{context.interests.length ? context.interests.map(interest=><InterestCard key={interest.id} interest={interest}/>) : <p className="crm-placeholder">No hay intereses registrados en esta página.</p>}<CrmPagination page={interestPage} count={context.interestCount} href={next=>`/oportunidades/${id}?page=${page}&interests_page=${next}`}/></>}</Panel>
      <Panel title="Historial de cambios" description="Ingresos, asignaciones y estados registrados por el sistema.">{context.error ? <CrmError/> : <><CrmTimeline events={context.events}/><CrmPagination page={page} count={context.count} href={next=>`/oportunidades/${id}?page=${next}&interests_page=${interestPage}`}/></>}</Panel>
      <Panel title="Conversación, score y seguimiento"><p className="crm-placeholder">La conversación y las evidencias se incorporarán al conectar el bot. Todavía no hay un motor de score ni registro de actividades habilitado en esta etapa.</p></Panel>
      {lead.loss_reason && <Panel title="Motivo de pérdida"><p className="crm-placeholder">{lead.loss_reason}</p></Panel>}
    </div>{assignees.error ? <CrmError/> : <ManageLead key={lead.updated_at} lead={lead} assignees={assignees.rows} admin={account.role==='admin'}/>}</div>
  </>;
}
export async function CustomerDetail({params,searchParams}:Props) {
  const [{id},search]=await Promise.all([params,searchParams]); const {customer,error}=await getCustomer(id);
  if(error)return <><RefreshCrm/><CrmError/></>;
  if(!customer)return <><BackLink href="/clientes">Volver a clientes</BackLink><EmptyState icon={Users} title="Cliente no disponible" description="No encontramos un cliente a cuyo historial tengas acceso."/></>;
  const page=crmPage(search.page); const leads=await listLeads({customerId:id,page});
  return <><BackLink href="/clientes">Volver a clientes</BackLink><PageHeading eyebrow="HISTORIAL DEL CLIENTE" title={customer.full_name ?? 'Nombre sin informar'} description={customer.phone_e164} action={<RefreshCrm/>}/>
    <section className="panel"><div className="panel-heading"><div><h2>Consultas</h2><p>{customer.inquiry_count} {customer.inquiry_count===1 ? 'consulta accesible' : 'consultas accesibles'}. Cada búsqueda conserva su estado y responsable.</p></div></div>{leads.error ? <CrmError/> : <><LeadRows rows={leads.rows}/><CrmPagination page={page} count={leads.count} href={next=>`/clientes/${id}?page=${next}`}/></>}</section>
    <div className="crm-future"><Panel title="Recontactos y compras"><p className="crm-placeholder">El historial de actividades y ventas se incorporará en las siguientes etapas. Los mensajes, las consultas y los intentos de recontacto se contabilizarán por separado.</p></Panel></div>
  </>;
}
