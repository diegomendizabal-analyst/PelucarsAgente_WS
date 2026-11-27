import { Inbox, Users } from "lucide-react";
import { requireAccount } from "@/lib/auth/session";
import { crmPage, getLead, leadContext, leadBotContext, listAssignees, getCustomer, listLeads } from "@/lib/crm/data";
import { leadReference, leadStatuses } from "@/lib/crm/types";
import { BackLink, EmptyState, PageHeading, Panel } from "./ui";
import { CrmError, CrmPagination, CrmTimeline, LeadRows } from "./crm-views";
import { ManageLead, RefreshCrm } from "./crm-controls";
import { InterestCard, OpportunityNeeds, OpportunityScore, OpportunityMessages } from "./opportunity-information";
type Props={params:Promise<{id:string}>;searchParams:Promise<Record<string,string | string[] | undefined>>};

export async function OpportunityDetail({params,searchParams}:Props) {
  const [{id},search,account]=await Promise.all([params,searchParams,requireAccount()]);
  const {lead,error,unavailable}=await getLead(id);
  if(error)return <><BackLink href="/oportunidades">Volver a oportunidades</BackLink><RefreshCrm/>{unavailable ? <Panel title="Ficha pendiente de integración"><p className="crm-placeholder">La base todavía no tiene habilitados los nuevos datos de oportunidades.</p></Panel> : <CrmError/>}</>;
  if(!lead)return <><BackLink href="/oportunidades">Volver a oportunidades</BackLink><EmptyState icon={Inbox} title="Oportunidad no disponible" description="No encontramos una oportunidad a la que tengas acceso con ese identificador."/></>;
  const page=crmPage(search.page), interestPage=crmPage(search.interests_page),messagePage=crmPage(search.messages_page);
  const [context,assignees,bot]=await Promise.all([leadContext(id,page,interestPage),account.role==='admin' ? listAssignees() : Promise.resolve({rows:[],error:false}),leadBotContext(id,messagePage)]);
  const pagination=(eventPage=page,interests=interestPage,messages=messagePage)=>`/oportunidades/${id}?page=${eventPage}&interests_page=${interests}&messages_page=${messages}`;
  return <><BackLink href="/oportunidades">Volver a oportunidades</BackLink><PageHeading eyebrow="OPORTUNIDAD COMERCIAL" title={lead.customer.full_name ?? 'Nombre sin informar'} description={`Consulta ${leadReference(lead.reference_number)} · ${leadStatuses[lead.commercial_status]}`} action={<RefreshCrm/>}/>
    <div className="crm-detail-layout"><div className="crm-detail-main">
      <OpportunityNeeds lead={lead}/>
      <Panel title="Interés del cliente" description="La búsqueda original se conserva aunque luego se ofrezca otra alternativa.">{context.error ? <CrmError/> : <>{context.interests.length ? context.interests.map(interest=><InterestCard key={interest.id} interest={interest} match={context.matches.find(m=>m.interest_id===interest.id)} matchState={context.matchState}/>) : <p className="crm-placeholder">No hay intereses registrados en esta página.</p>}<CrmPagination page={interestPage} count={context.interestCount} href={next=>pagination(page,next)}/></>}</Panel>
      <OpportunityScore score={bot.score} state={bot.scoreState}/>
      <OpportunityMessages messages={bot.messages} state={bot.messageState}><CrmPagination page={messagePage} count={bot.messageCount} href={next=>pagination(page,interestPage,next)}/></OpportunityMessages>
      <Panel title="Historial de cambios" description="Ingresos, asignaciones y estados registrados por el sistema.">{context.error ? <CrmError/> : <><CrmTimeline events={context.events}/><CrmPagination page={page} count={context.count} href={next=>pagination(next)}/></>}</Panel>
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
    <div className="crm-future"><Panel title="Compras"><p className="crm-placeholder">El historial de compras se conectará al implementar ventas. Las actividades manuales y los contadores de recontacto quedan para una versión posterior.</p></Panel></div>
  </>;
}
