import Link from "next/link";
import { crmDate, scoreVersion, type BotReadState, type Interest, type Lead, type LeadMessage, type LeadScore, type UnitMatch } from "@/lib/crm/types";
import { Panel } from "./ui";

const tradeInLabels = {confirmada:"Entrega confirmada",descartada:"No entrega un usado",indecisa:"Todavía no decidió",no_informada:"Sin informar"};
export function OpportunityNeeds({lead}:{lead:Lead}) {
  const amount=(value:number)=>`${lead.budget_currency ?? 'Moneda sin informar'} ${value.toLocaleString('es-AR',{maximumFractionDigits:2})}`;
  const budget=lead.budget_min === null && lead.budget_max === null
    ? (lead.budget_currency ? `Importe sin informar · ${lead.budget_currency}` : 'Sin informar')
    : [lead.budget_min !== null ? `Desde ${amount(lead.budget_min)}` : '',lead.budget_max !== null ? `Hasta ${amount(lead.budget_max)}` : ''].filter(Boolean).join(' · ');
  return <Panel title="Cliente y necesidad" action={<Link className="text-link" prefetch={false} href={`/clientes/${lead.customer_id}`}>Ver historial del cliente →</Link>}>
    <dl className="details-grid">
      <div><dt>Teléfono</dt><dd><a href={`tel:${lead.customer.phone_e164}`}>{lead.customer.phone_e164}</a></dd></div>
      <div><dt>Ingreso de la consulta</dt><dd>{crmDate(lead.created_at)}</dd></div>
      <div><dt>Origen de la consulta</dt><dd>{lead.source==='demo' ? 'Demo' : 'WhatsApp'}<small className="crm-detail-note">Procedencia comercial (anuncio, referido u otra): sin identificar.</small></dd></div>
      <div><dt>Nombre</dt><dd>{lead.customer.full_name ?? 'Sin informar'}{lead.customer.provider_profile_name && lead.customer.provider_profile_name===lead.customer.full_name && <small className="crm-detail-note">Nombre de perfil informado por el proveedor; identidad no verificada.</small>}</dd></div>
      <div><dt>Presupuesto declarado</dt><dd>{budget}</dd></div>
      <div><dt>Alcance del presupuesto</dt><dd>{lead.budget_scope==='valor_total' ? 'Valor total del vehículo' : lead.budget_scope==='dinero_a_agregar' ? 'Dinero a agregar' : 'Sin informar'}{lead.budget_scope==='dinero_a_agregar' && <small className="crm-detail-note">No equivale al valor total del vehículo. Revisar la decisión sobre el usado.</small>}</dd></div>
      <div><dt>Entrega de usado</dt><dd>{lead.trade_in_decision ? tradeInLabels[lead.trade_in_decision] : 'Sin informar'}</dd></div>
      <div><dt>Detalles del usado</dt><dd>{lead.trade_in_details ?? 'Sin informar'}</dd></div>
      <div><dt>Financiación</dt><dd>{lead.financing_needed===null ? 'Sin informar' : lead.financing_needed ? 'Solicita financiación' : 'No solicita financiación'}</dd></div>
      <div><dt>Plazo de compra</dt><dd>{lead.purchase_timeframe ?? 'Sin informar'}</dd></div>
    </dl>
    <div className="crm-description"><h3>Resumen de la consulta</h3><p>{lead.summary ?? 'Todavía no hay un resumen registrado.'}</p></div>
  </Panel>;
}

export function InterestCard({interest,match,matchState='ready'}:{interest:Interest;match?:UnitMatch;matchState?:BotReadState}) {
  const previous=interest.status==='replaced',primary=!previous && interest.is_primary;
  const year=interest.year_min && interest.year_max
    ? interest.year_min===interest.year_max ? String(interest.year_min) : `${interest.year_min} a ${interest.year_max}`
    : interest.year_min ? `Desde ${interest.year_min}` : interest.year_max ? `Hasta ${interest.year_max}` : 'Sin informar';
  return <article className={`crm-interest${primary ? ' crm-interest-primary' : ''}`}>
    <div className="crm-interest-top"><span className="crm-interest-label">{previous ? 'Interés anterior' : primary ? 'Interés principal' : 'Otro interés'}</span>
      {interest.vehicle_id && <Link className="text-link" prefetch={false} href={`/vehiculos/${interest.vehicle_id}`}>Ver marca/modelo en catálogo →</Link>}
    </div>
    <h3>{interest.requested_text}</h3>
    <dl className="crm-interest-specs">
      <div><dt>Marca / modelo declarados</dt><dd>{[interest.requested_brand,interest.requested_model].filter(Boolean).join(' ') || 'Sin informar'}</dd></div>
      <div><dt>Año buscado</dt><dd>{year}</dd></div>
      <div><dt>Transmisión</dt><dd>{interest.transmission ?? 'Sin informar'}</dd></div>
      {interest.requested_version && <div><dt>Versión</dt><dd>{interest.requested_version}</dd></div>}
      {!!interest.characteristics?.length && <div><dt>Características</dt><dd>{interest.characteristics.join(' · ')}</dd></div>}
    </dl>
    <p className="crm-detail-note">{interest.vehicle_id ? 'El vínculo corresponde a marca/modelo; no demuestra por sí solo compatibilidad con una unidad.' : 'Sin vínculo inequívoco con el catálogo. La búsqueda se conserva.'}</p>
    {interest.vehicle_id && (matchState==='error' ? <p role="alert" className="crm-detail-note">No pudimos comparar las unidades. Usá Actualizar para reintentar.</p>
      : !match || matchState==='unavailable' ? <p className="crm-detail-note">Comparación con unidades pendiente de integración.</p>
      : <div className="crm-unit-match"><strong>{match.available_count} unidades disponibles del modelo</strong>
        <p>{match.matching_count} cumplen año, transmisión y presupuesto en la misma unidad.</p>
        <p>{match.unknown_count} sin evaluación completa · {match.available_count-match.matching_count-match.unknown_count} no cumplen los criterios conocidos.</p>
        <small>Se compara presupuesto total en la misma moneda. Dinero a agregar, monedas diferentes o datos incompletos no permiten confirmar compatibilidad. Otras características requieren revisión.</small>
      </div>)}
  </article>;
}

function ReadNotice({state,subject}:{state:BotReadState;subject:string}) {
  if(state==='ready') return null;
  return <p className="crm-placeholder" role={state==='error' ? 'alert' : 'status'}>{state==='unavailable'
    ? `${subject}: integración pendiente de habilitar en la base.`
    : `No pudimos cargar ${subject.toLowerCase()}. Usá Actualizar para volver a intentar.`}</p>;
}
const signalLabels:Record<string,string>={plazo:'Plazo de compra',intencion:'Intención',busqueda:'Búsqueda',presupuesto:'Presupuesto'};
export function OpportunityScore({score,state}:{score:LeadScore | null;state:BotReadState}) {
  return <Panel title="Score comercial" description="Evaluación del bot. Reglas del prototipo pendientes de aprobación comercial.">
    {state!=='ready' ? <ReadNotice state={state} subject="Score"/> : !score ? <p className="crm-placeholder">Pendiente de evaluación · versión {scoreVersion}.</p> : <div className="crm-score">
      <div className="crm-score-total"><strong>{score.score}<span> / 100</span></strong><span className="crm-interest-label">Banda {score.result.banda}</span></div>
      <p className="crm-detail-note">Hasta el mensaje del {crmDate(score.cutoff_at)} · versión {score.rules_version}. Guardado el {crmDate(score.evaluated_at)}.</p>
      <dl className="crm-score-breakdown">{Object.entries(score.result.desglose).map(([code,detail])=><div key={code}>
        <dt>{signalLabels[code] ?? code}<strong>{detail.puntos} puntos</strong></dt><dd>{detail.motivo}
          {score.evidence.filter(e=>e.signal_code===code).map((e,index)=><blockquote key={`${e.message_id}-${index}`}>{e.quoted_text}</blockquote>)}
        </dd>
      </div>)}</dl>
      <div className="crm-score-limitations"><h3>Limitaciones</h3>{score.result.motivos_limitacion.length
        ? <ul>{score.result.motivos_limitacion.map((reason,index)=><li key={index}>{reason}</li>)}</ul>
        : <p>{score.result.informacion_limitada ? 'El evaluador informó limitaciones sin detallar sus motivos.' : 'El evaluador no informó limitaciones adicionales.'}</p>}
        <p>El score no confirma disponibilidad, financiación aprobada ni una venta.</p>
      </div>
    </div>}
  </Panel>;
}

const sendLabels={pending:'Pendiente de envío',sending:'Envío en curso, sin confirmación',sent:'Envío confirmado',failed:'Envío fallido',unknown:'Entrega incierta'};
export function OpportunityMessages({messages,state,children}:{messages:LeadMessage[];state:BotReadState;children?:React.ReactNode}) {
  return <Panel title="Conversación con el bot" description="Mensajes recientes primero; los envíos sin confirmar aparecen al inicio. El chat privado del vendedor no se registra aquí.">
    {state!=='ready' ? <ReadNotice state={state} subject="Conversación"/> : <>
      {messages.length ? <ol className="crm-messages">{messages.map(message=><li key={message.id} className={message.sender_kind==='bot' ? 'crm-message-bot' : ''}>
        <header><strong>{message.sender_kind==='customer' ? 'Cliente' : 'Bot'}</strong><time dateTime={message.sent_at ?? message.created_at}>{crmDate(message.sent_at ?? message.created_at)}</time></header>
        {message.sender_kind==='bot' && <small>{message.send_state ? sendLabels[message.send_state] : 'Sin confirmación de envío'}</small>}
        <p>{message.body}</p>
      </li>)}</ol> : <p className="crm-placeholder">No hay mensajes registrados en esta página.</p>}
      {children}
    </>}
  </Panel>;
}
