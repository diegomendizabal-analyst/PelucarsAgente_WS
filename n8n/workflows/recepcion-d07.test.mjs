import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const file = process.argv[2] ?? new URL('./recepcion-whatsapp.json', import.meta.url);
const workflow = JSON.parse(readFileSync(file, 'utf8'));
const nodes = new Map(workflow.nodes.map(n => [n.name, n]));
const outputs = (n, k) => (workflow.connections[n]?.main?.[k] ?? []).map(edge => edge.node);
const params = name => nodes.get(name).parameters;

function run(name, json = {}, refs = {}, items = []) {
  const lookup = node => ({item: {json:refs[node]}, itemMatching: () => ({json:refs[node]})});
  return new Function('$json', '$', '$input', params(name).jsCode)(json, lookup, {all: () => items});
}

function reachable(start, blocked) {
  const seen = new Set();
  function visit(name) {
    if (name === blocked || seen.has(name)) return;
    seen.add(name);
    for (const port of workflow.connections[name]?.main ?? [])
      for (const edge of port ?? []) visit(edge.node);
  }
  visit(start);
  return seen;
}

test('el borrador arranca apagado y toda ruta a ambos modelos pasa por la toma', () => {
  assert.equal(workflow.active,false);
  assert.deepEqual(run('Habilitar integración demo',{}, {},[{json:{}}]),[]);
  const gates = ['Habilitar integración demo','Ingresar en orden','¿Pendiente?','Tomar turno','¿Turno autorizado?'];
  for (const name of ['Clasificar intención','Extraer datos de la consulta']) {
    assert(reachable('WhatsApp Trigger').has(name));
    for (const gate of gates) assert(!reachable('WhatsApp Trigger',gate).has(name),gate);
  }
  assert.equal(params('Ingresar en orden').batchSize,1);
  assert.deepEqual(outputs('Ingresar en orden',1),['Guardar entrada']);
  assert.deepEqual(outputs('Guardar entrada',0),['Comprobar ingreso']);
  assert.deepEqual(outputs('Comprobar ingreso',0),['Ingresar en orden']);
  assert.deepEqual(outputs('Ingresar en orden',0),['Procesar cada mensaje']);
  assert.deepEqual(outputs('¿Turno autorizado?',0),['Leer búsquedas abiertas']);
  assert.deepEqual(outputs('¿Turno autorizado?',1),['Procesar cada mensaje']);
  assert.deepEqual(outputs('¿Pendiente?',1),['Procesar cada mensaje']);
  assert.deepEqual(outputs('¿Hay pendiente?',1),['Procesar cada mensaje']);
  assert(!reachable('Notificaciones de estado').has('Guardar entrada'));
  assert(!reachable('WhatsApp Trigger','¿Tomó el envío?').has('Enviar texto por WhatsApp'));
  assert.equal(params('Modelo de clasificación').options.maxRetries,0);
  assert.equal(params('OpenAI Chat Model').options.maxRetries,0);
});

test('un lote conserva texto libre y pies literales; ignora estados, audio sin texto y otros remitentes', () => {
  const source = {from:'DEMO_REMITENTE_META',type:'text',id:'evento-a',text:{body:'  holaa?!\n¿y un cíViC?  '}};
  const event = {field:'messages',metadata:{phone_number_id:'META_PHONE_NUMBER_ID'},messages:[
    source,{...source,id:'evento-b',type:'image',image:{caption:'mi usado 🚗'}},
    {...source,type:'audio'},{...source,from:'otro'}],statuses:[{status:'read'}]};
  const rows=run('Mensajes entrantes',{}, {},[{json:event},{json:{...event,metadata:{phone_number_id:'otra'}}}]);
  assert.deepEqual(rows.map(r=>r.json.text),[source.text.body,'mi usado 🚗']);
  assert.deepEqual(rows.map(r=>r.json.message_id),['evento-a','evento-b']);
});

test('pausa, duplicado procesado y revisión no autorizan IA; tampoco los límites ni un turno ocupado', () => {
  const predicate = name => new Function('$json','return '+params(name).conditions.conditions[0].leftValue.slice(3,-2));
  for (const disposition of ['pending','paused','review','historical','processing','resolved','noncommercial']) {
    const r=run('Comprobar ingreso',{body:[{disposition,created:false,receipt_id:'r'}]},
      {'Mensajes entrantes':{from:'12345678'}});
    assert.equal(predicate('¿Pendiente?')(r.json),disposition==='pending');
  }
  for (const reason of ['claimed','busy','earlier_pending','processing_limit','limits_not_configured','resolved','paused']) {
    const claimed=reason==='claimed';
    const r=run('Comprobar toma del turno',{body:[{claimed,reason,receipt_id:'r',body:claimed?'hola':null}]},{'Comprobar cola':{receipt_id:'r'}});
    assert.equal(predicate('¿Turno autorizado?')(r.json),claimed);
  }
  assert.throws(()=>run('Comprobar toma del turno',{body:[{claimed:true,reason:'busy',receipt_id:'r'}]},{'Comprobar cola':{receipt_id:'r'}}));
});

test('clasificación conservadora: primera búsqueda, corrección, compra adicional, ambigüedad y límites', () => {
  const candidates=[{opcion:1,id:'h',resumen:'un Honda Civic'}, {opcion:2,id:'f',resumen:'una Ford Ranger'}];
  function resolve(body,decision,opcion,cita,rows=candidates,bounded=true){
    return run('Preparar resolución',{output:{decision,opcion,cita}},{'Contexto de clasificación':{body,candidates:rows,bounded},'Comprobar toma del turno':{receipt_id:'r'}}).json;
  }
  assert.equal(resolve('busco auto','new_search',0,'',[]).p_decision,'new_search');
  assert.equal(resolve('automático','same_search',0,'',candidates.slice(0,1)).p_lead_id,'h');
  assert.equal(resolve('sobre el Civic','same_search',1,'Civic').p_lead_id,'h');
  assert.equal(resolve('sobre el Civic','same_search',2,'Civic').p_decision,'uncertain');
  assert.equal(resolve('nueva preferencia','additional_purchase',0,'segunda compra').p_decision,'uncertain');
  assert.equal(resolve('quiero otro además','additional_purchase',0,'otro además').p_decision,'additional_purchase');
  assert.equal(resolve('hola','noncommercial',0,'').p_decision,'noncommercial');
  assert.equal(resolve('muy extenso','new_search',0,'',[],false).p_decision,'uncertain');
});

test('el turno usa texto de la toma, no hereda el nombre de otro recibo y valida el corte', () => {
  const message={id:'m',conversation_id:'v',bot_cycle_id:'c',sender_kind:'customer',body:'literal',history_position:7};
  const refs={'Comprobar resolución':{message_id:'m',lead_id:'l',conversation_id:'v',cycle_id:'c'},'Comprobar toma del turno':{receipt_id:'r',body:'literal'},'Procesar cada mensaje':{receipt_id:'otro',provider_profile_name:'Otro'}};
  const actual=run('Mensaje registrado',{body:[message]},refs).json;
  assert.equal(actual.provider_profile_name,null);
  const prev={message_id:'anterior',sender_kind:'customer',body:'anterior',history_position:4};
  const history=rows=>run('Preparar contexto',{}, {'Mensaje registrado':actual},[{json:{body:rows}}]);
  assert.equal(history([prev])[0].json.historial,'Cliente: anterior');
  assert.throws(()=>history([prev,prev]));
  assert.throws(()=>history([{...prev,history_position:7}]));
  assert.throws(()=>run('Mensaje registrado',{body:[{...message,body:'otro'}]},refs));
});

test('el tercer cupo solo cierra, un cierre anterior silencia y PT409 sin cambio se detiene', () => {
  const message={message_id:'m',lead_id:'l',conversation_id:'v',cycle_id:'c'};
  const refs={'Mensaje registrado':message,'Extraer datos de la consulta':{output:{decision_entrega_usado:'no_informada',tiene_usado:null}}};
  const decide=(slots,closed_at=null)=>run('Decidir con los cupos actuales',{body:[{...message,disposition:'resolved',reserved_slots:slots,sent_count:0,closed_at}]},refs).json;
  assert.equal(decide(1).reply_kind,'question');
  assert.equal(decide(2).reply_kind,'closing');
  assert.equal(decide(1,'cierre').reply_kind,null);
  const previous={'Decidir con los cupos actuales':{reserved_slots:1,cycle_id:'c'}};
  assert.throws(()=>run('Exigir cambio de ciclo',{body:[{reserved_slots:1,cycle_id:'c'}]},previous));
  assert.doesNotThrow(()=>run('Exigir cambio de ciclo',{body:[{reserved_slots:2,cycle_id:'c'}]},previous));
  assert.deepEqual(outputs('¿Conflicto al resolver?',0),['Conciliar resolución']);
  assert.deepEqual(outputs('Conciliar resolución',0),['Detener por conflicto']);
  assert.deepEqual(outputs('¿Reservar respuesta?',1),['Completar turno sin respuesta']);
});
