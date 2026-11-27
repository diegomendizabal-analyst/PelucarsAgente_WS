// PostgreSQL WASM, no network or shared credentials. The test alone replaces the
// private database clock; no production RPC accepts time from callers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../../supabase/', import.meta.url);
const id = n => `d0700000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const start = '2026-11-01T12:00:00Z';
const extraction = text => ({vehiculo_buscado:text,caracteristicas:[],presupuesto_importe:null,
  presupuesto_moneda:null,presupuesto_alcance:null,tiene_usado:null,decision_entrega_usado:'no_informada',
  usado_detalle:null,plazo_compra:null,necesita_financiacion:null,resumen_consulta:text});
async function setup(beforeMigration) {
  const db = new PGlite();
  const q = async (sql,args=[]) => (await db.query(sql,args)).rows;
  const one = async (sql,args=[]) => (await q(sql,args))[0];
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of (await readdir(new URL('migrations/',root))).filter(f=>f.endsWith('.sql')).sort()) {
    if (file.includes('bot_contact_cycles')) await beforeMigration?.(db);
    await db.exec(await readFile(new URL('migrations/'+file,root),'utf8'));
  }
  await db.exec(`create or replace function private.bot_clock() returns timestamptz
    language sql volatile set search_path='' as $$ select current_setting('test.bot_now')::timestamptz $$;
    select set_config('test.bot_now','${start}',false); set role service_role;`);
  const clock = t => q("select set_config('test.bot_now',$1,false)",[t]);
  const owner = async sql => { await db.exec('reset role'); try { return await db.exec(sql); } finally { await db.exec('set role service_role'); } };
  const limits = (line='line-a',contact=100,total=200) => owner(`insert into private.bot_processing_limits values('demo','${line}',3600,${contact},${total})`);
  const receive = (key,body='Busco Corolla',phone='+12025550123',line='line-a',provider='demo') => one(
    'select * from public.receive_bot_contact_message($1,$2,$3,$4,$5,$6)', ['demo',phone,provider,line,key,body]);
  const claim = r => one('select * from public.claim_bot_contact_message($1)',[r.receipt_id]);
  const resolve = (r,decision='new_search',lead=null) => one('select * from public.resolve_bot_contact_message($1,$2,$3)',[r.receipt_id,decision,lead]);
  const turn = r => one('select * from public.get_bot_contact_turn($1)',[r.receipt_id]);
  const reserve = (t,kind,used,body=kind) => one('select * from public.reserve_bot_reply($1,$2,$3,$4,$5)',[t.conversation_id,t.message_id,body,kind,used]);
  const finish = r => one('select public.complete_bot_contact_turn($1)',[r.receipt_id]);
  return {db,q,one,clock,owner,limits,receive,claim,resolve,turn,reserve,finish};
}

test('D07: atomic routing, preference history, early close, fixed pause and a new persisted cycle', async () => {
  const h=await setup(); const {db,q,one,clock,owner,limits,receive,claim,resolve,turn,reserve,finish}=h;
  try {
    const first=await receive('first');
    assert.equal((await claim(first)).reason,'limits_not_configured');
    assert.equal((await one('select count(*)::int n from public.customers')).n,0);
    await limits();
    assert.equal((await receive('first')).created,false);
    await assert.rejects(receive('first','Changed'),{code:'22023'});
    await assert.rejects(receive('first','Busco Corolla','+12025550124'),{code:'22023'});
    assert.equal((await claim(first)).claimed,true);
    assert.equal((await claim(first)).claimed,false);
    const second=await receive('second','Ahora prefiero Civic');
    assert.equal((await claim(second)).reason,'busy');
    const a=await resolve(first);
    assert.deepEqual(await resolve(first),a);
    await assert.rejects(resolve(first,'additional_purchase'),{code:'PT409'});
    assert.equal((await one('select count(*)::int n from public.leads')).n,1);
    await q('select * from public.save_bot_lead_details($1,$2,$3)',[a.conversation_id,a.message_id,extraction('Corolla')]);
    const question=await reserve(a,'question',0);
    assert.equal(question.bot_slot,1);
    assert.equal((await claim(second)).claimed,true);
    const b=await resolve(second,'same_search',a.lead_id);
    assert.equal(b.lead_id,a.lead_id); assert.equal(b.cycle_id,a.cycle_id);
    await q('select * from public.save_bot_lead_details($1,$2,$3)',[b.conversation_id,b.message_id,extraction('Civic')]);
    assert.deepEqual(await q('select requested_text,status from public.lead_interests order by created_at,id'),[
      {requested_text:'Corolla',status:'replaced'},{requested_text:'Civic',status:'active'}]);
    const queued=await receive('queued','También otra compra');
    const close=await reserve(b,'closing',1);
    assert.equal(close.bot_slot,2);
    const closed=await turn(second);
    assert.equal(closed.closed_at.toISOString(),new Date(start).toISOString());
    assert.equal(closed.pause_until.toISOString(),'2026-11-04T12:00:00.000Z');
    assert.equal((await claim(queued)).reason,'paused');
    assert.equal((await one('select count(*)::int n from public.messages where sender_kind=\'customer\'')).n,3);
    assert.equal((await one('select * from public.claim_bot_reply($1,$2)',[a.conversation_id,question.id])).claimed,false);
    assert.equal((await one('select * from public.claim_bot_reply($1,$2)',[b.conversation_id,close.id])).claimed,true);
    await q('select public.record_bot_reply_result($1,$2,$3)',[b.conversation_id,close.id,'unknown']);
    await clock('2026-11-02T12:00:00Z');
    await q('select public.record_bot_reply_result($1,$2,$3)',[b.conversation_id,close.id,'failed']);
    assert.equal((await turn(second)).pause_until.toISOString(),closed.pause_until.toISOString());
    assert.equal((await reserve(b,'closing',1)).id,close.id,'Idempotent old reservation does not prolong pause');
    await assert.rejects(q('select * from public.save_bot_lead_summary($1,$2,$3)',[b.conversation_id,b.message_id,'late']),{code:'PT409'});
    assert.equal((await one('select * from public.save_bot_lead_details($1,$2,$3)',
      [b.conversation_id,b.message_id,extraction('Civic')])).outcome,'unchanged','Persisted requests remain safely retryable after closure');
    await assert.rejects(q('select * from public.receive_bot_message($1,$2,$3,$4,$5,$6,$7,$8)',
      [id(99),a.lead_id,'demo','+12025550123','other-provider','line-a','bypass','More']),{code:'PT409'});
    await clock('2026-11-04T11:59:59.999999Z');
    const muted=await receive('muted','Quiero otra compra independiente');
    assert.equal(muted.disposition,'paused');
    assert.equal((await claim(muted)).claimed,false);
    await assert.rejects(resolve(muted,'additional_purchase'),{code:'PT409'});
    const providerChange=await receive('other-provider','Otro evento del mismo contacto','+12025550123','line-a','provider-b');
    assert.equal(providerChange.disposition,'paused');
    const changedProviderTurn=await turn(providerChange);
    assert.equal(changedProviderTurn.cycle_id,b.cycle_id);
    assert.equal(changedProviderTurn.reserved_slots,2,'Provider changes do not bypass the contact gate');
    assert.equal((await one('select body from public.messages where id=$1',[changedProviderTurn.message_id])).body,'Otro evento del mismo contacto');
    const leadCount=(await one('select count(*)::int n from public.leads')).n;
    await clock('2026-11-04T12:00:00Z');
    assert.equal((await one('select count(*)::int n from public.leads')).n,leadCount,'Time alone creates nothing');
    assert.equal((await claim(muted)).claimed,false,'Muted messages never become queued AI');
    const next=await receive('next','Sigo buscando Civic');
    assert.equal((await claim(next)).claimed,true,'Exact 72h is eligible');
    const n=await resolve(next,'same_search',a.lead_id);
    assert.equal(n.lead_id,a.lead_id); assert.notEqual(n.cycle_id,a.cycle_id); assert.notEqual(n.conversation_id,a.conversation_id);
    assert.equal((await turn(next)).reserved_slots,0);
    assert.equal((await turn(second)).reserved_slots,2,'Historical budget is not reset');
    const position=(await one('select history_position from public.messages where id=$1',[n.message_id])).history_position;
    const context=await q('select * from public.bot_opportunity_history($1,$2)',[n.conversation_id,position]);
    assert.deepEqual(context.map(m=>m.body),['Busco Corolla','Ahora prefiero Civic','También otra compra','Quiero otra compra independiente']);
    assert(!context.some(m=>m.message_id===n.message_id),'Current input appended once by caller');
    const score={version_reglas:'pelucars_score_v1_prototipo',total:15,banda:'baja',informacion_limitada:true,motivos_limitacion:['Pendiente'],
      desglose:{plazo:{puntos:0,motivo:'Sin informar',evidencias:[]},intencion:{puntos:0,motivo:'Sin informar',evidencias:[]},
        busqueda:{puntos:15,motivo:'Búsqueda explícita',evidencias:['Quiero otra compra independiente']},presupuesto:{puntos:0,motivo:'Sin informar',evidencias:[]}}};
    const savedScore=await one('select * from public.save_bot_score($1,$2,$3)',[n.conversation_id,n.message_id,score]);
    assert.equal(savedScore.outcome,'applied','Literal evidence from a muted prior cycle is usable only on a new eligible cutoff');
    await assert.rejects(q('select * from public.save_bot_score($1,$2,$3)',[b.conversation_id,muted.receipt_id,score]),{code:'PT409'});
    await finish(next);
    assert.equal((await one('select * from public.save_bot_score($1,$2,$3)',[n.conversation_id,n.message_id,score])).outcome,'unchanged');
    const thanks=await receive('thanks','Gracias'); await claim(thanks); await resolve(thanks,'noncommercial');
    assert.equal((await one('select count(*)::int n from public.leads')).n,1);
    await owner(`update public.leads set commercial_status='lost',closed_at=now(),loss_reason='Test only' where id='${a.lead_id}'`);
    const fresh=await receive('fresh','Nueva búsqueda'); await claim(fresh);
    const f=await resolve(fresh,'new_search',a.lead_id);
    assert.notEqual(f.lead_id,a.lead_id); assert.equal(f.cycle_id,n.cycle_id,'A new opportunity does not reset the active cycle');
    assert.equal((await one('select commercial_status from public.leads where id=$1',[a.lead_id])).commercial_status,'lost');
  } finally { await db.close(); }
});

test('D07: shared cycle budget, explicit independent purchase, permissions, limits and line isolation', async () => {
  const {db,q,one,limits,receive,claim,resolve,reserve,turn,finish,owner,clock}=await setup();
  try {
    await limits('line-a',4,5); await limits('line-b');
    const r=await receive('one'); await claim(r); const a=await resolve(r); await reserve(a,'question',0);
    const r2=await receive('two'); await claim(r2); const b=await resolve(r2,'additional_purchase');
    assert.notEqual(a.lead_id,b.lead_id); assert.equal(a.cycle_id,b.cycle_id);
    const answer=await reserve(b,'question',1); assert.equal(answer.bot_slot,2);
    const r3=await receive('three'); await claim(r3);
    await assert.rejects(resolve(r3),{code:'PT409'},'Two open searches require explicit routing');
    const c=await resolve(r3,'same_search',a.lead_id);
    await assert.rejects(reserve(c,'question',2),{code:'22023'});
    await reserve(c,'closing',2);
    assert.equal((await turn(r2)).reserved_slots,3);
    const otherLine=await receive('one','Civic','+12025550123','line-b');
    assert.equal((await claim(otherLine)).claimed,true);
    const other=await resolve(otherLine,'same_search',a.lead_id); await finish(otherLine);
    assert.notEqual(other.cycle_id,a.cycle_id);
    await clock('2026-11-04T12:00:01Z');
    const after=await receive('after'); assert.equal((await claim(after)).claimed,true);
    const resumed=await resolve(after,'same_search',a.lead_id); await finish(after);
    const q1=await receive('q1'),q2=await receive('q2');
    assert.equal((await claim(q2)).reason,'earlier_pending');
    assert.equal((await claim(q1)).claimed,true); await resolve(q1,'noncommercial');
    await claim(q2); await resolve(q2,'noncommercial');
    const q3=await receive('q3'); await claim(q3); await resolve(q3,'noncommercial');
    assert.equal((await claim(await receive('limited'))).reason,'processing_limit');
    const noCustomer=await receive('no-customer','Gracias','+12025550124'); await claim(noCustomer); await resolve(noCustomer,'noncommercial');
    assert.equal((await one('select count(*)::int n from public.customers')).n,1);
    assert.equal((await claim(await receive('line-limited','Consulta','+12025550125'))).reason,'processing_limit');
    await db.exec('reset role; set role anon');
    await assert.rejects(receive('forbidden'),{code:'42501'});
    await assert.rejects(q('select * from public.list_bot_contact_queue($1)',[r.receipt_id]),{code:'42501'});
    await db.exec('reset role; set role authenticated');
    await assert.rejects(claim(r),{code:'42501'});
    await assert.rejects(q('select * from private.bot_contacts'),{code:'42501'});
    await db.exec('reset role; set role service_role');
    await assert.rejects(q('update public.conversations set bot_state=\'collecting\' where id=$1',[a.conversation_id]),{code:'42501'});
    await assert.rejects(q('insert into public.conversations(id,lead_id,provider,business_phone_id) values($1,$2,$3,$4)',
      [id(88),a.lead_id,'demo','line-a']),{code:'42501'});
    await assert.rejects(q('select private.bot_clock()'),{code:'42501'});
    await assert.rejects(q('select private.require_bot_turn($1,$2)',[resumed.conversation_id,resumed.message_id]),{code:'42501'});
    await assert.rejects(q('select public.set_bot_conversation_state($1,$2,$3)',[resumed.conversation_id,'collecting','waiting_assignment']),{code:'PT409'});
  } finally { await db.close(); }
});

test('D07: uncertain historical closure blocks processing instead of inventing a date', async () => {
  const h=await setup(async db=>{
    await db.exec(`insert into public.customers(id,phone_e164) values('${id(1)}','+12025550123');
      insert into public.leads(id,customer_id,source) values('${id(2)}','${id(1)}','demo');
      insert into public.conversations(id,lead_id,provider,business_phone_id,bot_state)
      values('${id(3)}','${id(2)}','demo','line-a','stopped');`);
  });
  try {
    await h.limits(); const r=await h.receive('unknown');
    assert.equal(r.disposition,'review'); assert.equal(r.pause_until,null);
    assert.equal((await h.claim(r)).claimed,false);
    assert.equal((await h.one('select count(*)::int n from public.messages')).n,1);
    await h.clock('2027-01-01T12:00:00Z');
    assert.equal((await h.receive('later')).disposition,'review');
  } finally { await h.db.close(); }
});

test('D07: migration preserves legacy history and derives pause from reserved closure, not sent_at', async () => {
  let old;
  const h=await setup(async db=>{
    await db.exec(`insert into public.customers(id,phone_e164) values('${id(1)}','+12025550123');
      insert into public.leads(id,customer_id,source) values('${id(2)}','${id(1)}','demo'); set role service_role;`);
    const a=(await db.query('select * from public.receive_bot_message($1,$2,$3,$4,$5,$6,$7,$8)',
      [id(3),id(2),'demo','+12025550123','demo','line-a','historical','Consulta original'])).rows[0];
    old=(await db.query('select * from public.reserve_bot_reply($1,$2,$3,$4,$5)',[id(3),a.message_id,'Cierre','closing',0])).rows[0];
    await db.exec(`reset role; update public.messages set created_at='${start}' where id='${old.id}';`);
  });
  try {
    const duplicate=await h.receive('historical','Consulta original'); assert.equal(duplicate.disposition,'historical');
    const muted=await h.receive('new'); assert.equal(muted.disposition,'paused');
    assert.equal(muted.pause_until.toISOString(),'2026-11-04T12:00:00.000Z');
    assert.equal((await h.one('select * from public.get_bot_conversation($1)',[id(3)])).reserved_slots,1);
    assert.equal((await h.one('select send_state from public.messages where id=$1',[old.id])).send_state,'pending');
    await h.db.exec('reset role; set role authenticated');
    assert.equal((await h.q('select * from public.lead_messages')).length,0,'No unassigned details exposed');
  } finally { await h.db.close(); }
});
