import Link from "next/link";
import { crmDate, type BotReadState, type Interest, type Lead, type LeadScore, type UnitMatch } from "@/lib/crm/types";
import { Panel } from "./ui";

const tradeInLabels = {confirmada:"Entrega confirmada",descartada:"No entrega un usado",indecisa:"Todavía no decidió",no_informada:"Sin informar"};
export function OpportunityNeeds({lead}:{lead:Lead}) {
  const amount=(value:number)=>`${lead.budget_currency ?? 'Moneda sin informar'} ${value.toLocaleString('es-AR',{maximumFractionDigits:2})}`;
  const budget=lead.budget_min === null && lead.budget_max === null
    ? (lead.budget_currency ? `Importe sin informar · ${lead.budget_currency}` : 'Sin informar')
    : [lead.budget_min !== null ? `Desde ${amount(lead.budget_min)}` : '',lead.budget_max !== null ? `Hasta ${amount(lead.budget_max)}` : ''].filter(Boolean).join(' · ');
  return <Panel title="Resumen de la consulta" action={<Link className="text-link" prefetch={false} href={`/clientes/${lead.customer_id}`}>Historial del cliente →</Link>}>
    <div className="crm-description op-summary"><p>{lead.summary ?? 'Resumen pendiente de guardar.'}</p></div>
    <dl className="op-commercial">
      <div><dt>Presupuesto y alcance</dt><dd>{budget}<span>{lead.budget_scope==='valor_total' ? 'Valor total del vehículo' : lead.budget_scope==='dinero_a_agregar' ? 'Dinero a agregar' : 'Alcance sin informar'}</span>{lead.budget_scope==='dinero_a_agregar' && <small>No equivale al valor total del vehículo.</small>}</dd></div>
      <div><dt>Plazo de compra</dt><dd>{lead.purchase_timeframe ?? 'Sin informar'}</dd></div>
      <div><dt>Entrega de usado</dt><dd>{lead.trade_in_decision ? tradeInLabels[lead.trade_in_decision] : 'Pendiente de registrar'}<span>{lead.trade_in_details ?? 'Detalles sin informar'}</span></dd></div>
      <div><dt>Financiación</dt><dd>{lead.financing_needed===null ? 'Sin informar' : lead.financing_needed ? 'Solicita financiación' : 'No solicita financiación'}</dd></div>
    </dl>
    <p className="op-data-note">Datos guardados por campo. El resumen puede incluir información aún pendiente de registrar aquí; un campo vacío no significa «No».</p>
  </Panel>;
}

export function InterestCard({interest,match,matchState='ready'}:{interest:Interest;match?:UnitMatch;matchState?:BotReadState}) {
  const previous=interest.status==='replaced',primary=!previous && interest.is_primary;
  const year=interest.year_min && interest.year_max
    ? interest.year_min===interest.year_max ? String(interest.year_min) : `${interest.year_min} a ${interest.year_max}`
    : interest.year_min ? `Desde ${interest.year_min}` : interest.year_max ? `Hasta ${interest.year_max}` : 'Sin informar';
  return <article className={`crm-interest${primary ? ' crm-interest-primary' : ''}`}>
    <div className="crm-interest-top"><span className="crm-interest-label">{previous ? 'Búsqueda anterior' : primary ? 'Búsqueda principal' : 'Otra búsqueda'}</span>
      {interest.vehicle_id && <Link className="text-link" prefetch={false} href={`/vehiculos/${interest.vehicle_id}`}>Ver marca/modelo en catálogo →</Link>}
    </div>
    <p className="op-search-label">Búsqueda original</p><h3>{interest.requested_text}</h3>
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
  const band=score ? score.score < 30 ? 'low' : score.score < 60 ? 'medium' : 'high' : '';
  return <section className={`op-score op-score-${band}`} aria-label="Score comercial">
    <h2>Score comercial</h2>
    {state!=='ready' ? <ReadNotice state={state} subject="Score"/> : !score ? <><strong className="op-score-pending">Pendiente</strong><p className="crm-detail-note">Sin evaluación guardada.</p></> : <>
      <div className="op-score-total"><strong>{score.score}<span>/100</span></strong><span className="op-score-band">{band==='low' ? 'Bajo' : band==='medium' ? 'Medio' : 'Alto'}</span></div>
      <p className="crm-detail-note">No representa una probabilidad de venta.</p>
      <details className="op-score-detail"><summary>Ver detalle y evidencias</summary><div className="op-score-content" tabIndex={0} role="region" aria-label="Desglose, evidencias y limitaciones del score">
      <h3>Evaluación guardada</h3><p className="crm-detail-note">Hasta el mensaje del {crmDate(score.cutoff_at)}. Guardado el {crmDate(score.evaluated_at)}.</p>
      <dl className="crm-score-breakdown">{Object.entries(score.result.desglose).map(([code,detail])=><div key={code}>
        <dt>{signalLabels[code] ?? code}<strong>{detail.puntos} puntos</strong></dt><dd>{detail.motivo}
          {score.evidence.filter(e=>e.signal_code===code).map((e,index)=><blockquote key={`${e.message_id}-${index}`}>{e.quoted_text}</blockquote>)}
        </dd>
      </div>)}</dl>
      <div className="crm-score-limitations"><h3>Limitaciones</h3>{score.result.motivos_limitacion.length
        ? <ul>{score.result.motivos_limitacion.map((reason,index)=><li key={index}>{reason}</li>)}</ul>
        : <p>{score.result.informacion_limitada ? 'El evaluador informó limitaciones sin detallar sus motivos.' : 'El evaluador no informó limitaciones adicionales.'}</p>}
        <p>El score no representa una probabilidad de venta ni confirma disponibilidad o financiación aprobada.</p>
        <p>Reglas del prototipo pendientes de aprobación comercial. Versión: {score.rules_version}.</p>
      </div>
      </div></details>
    </>}
  </section>;
}
