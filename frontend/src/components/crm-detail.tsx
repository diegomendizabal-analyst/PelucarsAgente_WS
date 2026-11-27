import { Inbox, Users } from "lucide-react";
import { requireAccount } from "@/lib/auth/session";
import { crmPage, getLead, leadContext, leadBotContext, listAssignees, getCustomer, listLeads } from "@/lib/crm/data";
import { crmDate, leadReference, leadStatuses } from "@/lib/crm/types";
import { BackLink, EmptyState, PageHeading, Panel } from "./ui";
import { CrmError, CrmPagination, CrmTimeline, LeadRows } from "./crm-views";
import { ManageLead, OpportunityManagement, RefreshCrm } from "./crm-controls";
import { InterestCard, OpportunityNeeds, OpportunityScore } from "./opportunity-information";
import { OpportunityConversation } from "./opportunity-conversation";
type Props={params:Promise<{id:string}>;searchParams:Promise<Record<string,string | string[] | undefined>>};

export async function OpportunityDetail({params,searchParams}:Props) {
  const [{id},search,account]=await Promise.all([params,searchParams,requireAccount()]);
  const {lead,error,unavailable}=await getLead(id);
  if(error)return <><BackLink href="/oportunidades">Volver a oportunidades</BackLink><RefreshCrm/>{unavailable ? <Panel title="Ficha pendiente de integración"><p className="crm-placeholder">La base todavía no tiene habilitados los nuevos datos de oportunidades.</p></Panel> : <CrmError/>}</>;
  if(!lead)return <><BackLink href="/oportunidades">Volver a oportunidades</BackLink><EmptyState icon={Inbox} title="Oportunidad no disponible" description="No encontramos una oportunidad a la que tengas acceso con ese identificador."/></>;
  const page=crmPage(search.page), interestPage=crmPage(search.interests_page);
  const [context,assignees,bot]=await Promise.all([leadContext(id,page,interestPage),account.role==='admin' ? listAssignees() : Promise.resolve({rows:[],error:false}),leadBotContext(id)]);
  const pagination=(eventPage=page,interests=interestPage)=>`/oportunidades/${id}?page=${eventPage}&interests_page=${interests}`;
  const interestCard=(interest:typeof context.interests[number])=><InterestCard key={interest.id} interest={interest} match={context.matches.find(m=>m.interest_id===interest.id)} matchState={context.matchState}/>;
  const previous=context.interests.filter(interest=>interest.status==='replaced');
  return <><div className="op-navigation"><BackLink href="/oportunidades">Volver a oportunidades</BackLink><RefreshCrm/></div>
    <header className="op-header">
      <div className="op-identity"><div className="op-meta"><span>{leadReference(lead.reference_number)}</span><span className="op-status">{leadStatuses[lead.commercial_status]}</span>{lead.source==='demo' && <span className="op-demo">Demo</span>}</div>
        <h1>{lead.customer.full_name ?? 'Nombre sin informar'}</h1>
        <a className="op-phone" href={`tel:${lead.customer.phone_e164}`}>{lead.customer.phone_e164}</a>
        {lead.customer.provider_profile_name && <p className="crm-detail-note">{lead.customer.provider_profile_name===lead.customer.full_name ? 'Nombre del perfil de WhatsApp' : `Perfil de WhatsApp: ${lead.customer.provider_profile_name}`} · identidad no verificada.</p>}
        <p className="op-owner">Responsable: <strong>{lead.responsible?.full_name ?? 'Sin asignar'}</strong></p>
        <p className="crm-detail-note">Consulta recibida el {crmDate(lead.created_at)}</p>
      </div>
      <OpportunityScore score={bot.score} state={bot.scoreState}/>
    </header>
    <div className="crm-detail-layout op-layout">
      <OpportunityNeeds lead={lead}/>
      <OpportunityManagement>{assignees.error ? <CrmError/> : <ManageLead key={lead.updated_at} lead={lead} assignees={assignees.rows} admin={account.role==='admin'}/>}</OpportunityManagement>
      <div className="crm-detail-main">
      <Panel title="Vehículo buscado" description="La búsqueda original se conserva aunque luego se ofrezca otra alternativa.">{context.error ? <CrmError/> : <>
        {context.interests.length ? <>{context.interests.filter(interest=>interest.status!=='replaced').map(interestCard)}
          {previous.length > 0 && <details className="op-previous"><summary>Búsquedas anteriores ({previous.length} en esta página)</summary>{previous.map(interestCard)}</details>}</>
          : <p className="crm-placeholder">No hay búsquedas guardadas en esta página.</p>}
        <CrmPagination page={interestPage} count={context.interestCount} href={next=>pagination(page,next)}/></>}</Panel>
      <OpportunityConversation key={`${id}:${lead.updated_at}:${bot.conversation.state}:${bot.unconfirmed.state}:${[...bot.conversation.messages,...bot.unconfirmed.messages].map(m=>`${m.id}:${m.send_state}:${m.history_position}`).join(',')}`} leadId={id} initial={bot.conversation} unconfirmed={bot.unconfirmed}/>
      <Panel title="Historial operativo" description="Asignaciones y cambios de estado. No forma parte de la conversación.">{context.error ? <CrmError/> : <><CrmTimeline events={context.events}/><CrmPagination page={page} count={context.count} href={next=>pagination(next)}/></>}</Panel>
      {lead.loss_reason && <Panel title="Motivo de pérdida"><p className="crm-placeholder">{lead.loss_reason}</p></Panel>}
    </div></div>
  </>;
}
export async function CustomerDetail({params,searchParams}:Props) {
  const [{id},search]=await Promise.all([params,searchParams]); const {customer,error}=await getCustomer(id);
  if(error)return <><RefreshCrm/><CrmError/></>;
  if(!customer)return <><BackLink href="/clientes">Volver a clientes</BackLink><EmptyState icon={Users} title="Cliente no disponible" description="No encontramos un cliente a cuyo historial tengas acceso."/></>;
  const page=crmPage(search.page); const leads=await listLeads({customerId:id,page});
  return <><BackLink href="/clientes">Volver a clientes</BackLink><PageHeading eyebrow="HISTORIAL DEL CLIENTE" title={customer.full_name ?? 'Nombre sin informar'} description={customer.phone_e164} action={<RefreshCrm/>}/>
    <section className="panel"><div className="panel-heading"><div><h2>Consultas</h2><p>{customer.inquiry_count} {customer.inquiry_count===1 ? 'consulta accesible' : 'consultas accesibles'}. Cada búsqueda conserva su estado y responsable.</p></div></div>{leads.error ? <CrmError/> : <><LeadRows rows={leads.rows}/><CrmPagination page={page} count={leads.count} href={next=>`/clientes/${id}?page=${next}`}/></>}</section>
    <div className="crm-future"><Panel title="Compras"><p className="crm-placeholder">El historial de compras se conectará al implementar ventas. Las actividades manuales y los contadores de recontacto quedan para una versión posterior.</p></Panel></div>
  </>;
}
