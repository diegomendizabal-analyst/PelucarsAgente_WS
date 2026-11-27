import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const root=new URL('../../supabase/',import.meta.url);
const admin='ca100000-0000-4000-8000-000000000001';
const extraction=vehicle=>({vehiculo_buscado:vehicle,caracteristicas:[],presupuesto_importe:null,presupuesto_moneda:null,
  presupuesto_alcance:null,tiene_usado:null,decision_entrega_usado:'no_informada',usado_detalle:null,
  plazo_compra:null,necesita_financiacion:null,resumen_consulta:vehicle});
const nativeSql='select * from public.save_bot_lead_details_with_catalog($1,$2,$3,$4,$5,$6)';
async function setup(){
  const db=new PGlite();
  const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
  const one=async(sql,args=[]) => (await q(sql,args))[0];
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for(const name of (await readdir(new URL('migrations/',root))).filter(f=>f.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL('migrations/'+name,root),'utf8'));
  await db.exec(`insert into auth.users(id) values('${admin}');
    insert into public.profiles(id,full_name,role,is_enabled) values('${admin}','Admin','admin',true);
    insert into private.bot_processing_limits values('demo','catalog-line',3600,100,200),('whatsapp_bot','catalog-line',3600,100,200);
    set role service_role;`);
  let serial=0;
  const receive=async(body,phone='+12025550123',source='demo',line='catalog-line')=>{
    const r=await one('select * from public.receive_bot_contact_message($1,$2,$3,$4,$5,$6)',[source,phone,'test',line,'msg-'+(++serial),body]);
    return r;
  };
  const resolve=async r=>{
    assert.equal((await one('select * from public.claim_bot_contact_message($1)',[r.receipt_id])).claimed,true);
    return {...await one('select * from public.resolve_bot_contact_message($1,$2)',[r.receipt_id,'new_search']),receipt_id:r.receipt_id};
  };
  const incoming=async(...args)=>resolve(await receive(...args));
  const finish=t=>one('select public.complete_bot_contact_turn($1)',[t.receipt_id]);
  const params=(t,brand='Ford',model='Ranger',quote='Busco Ford Ranger')=>[
    t.conversation_id,t.message_id,extraction(brand+' '+model),{marca:brand,modelo:model},null,
    {status:'unambiguous',role:'sought_vehicle',message_id:t.message_id,quote}];
  const save=(...args)=>one(nativeSql,params(...args));
  const owner=async sql=>{await db.exec('reset role');try{return await db.exec(sql);}finally{await db.exec('set role service_role');}};
  return {db,q,one,receive,resolve,incoming,finish,params,save,owner};
}

test('catalog: create/reuse same source, immutable retries, audit and zero inventory',async()=>{
  const {db,q,one,incoming,finish,params,save,owner}=await setup();
  try{
    const a=await incoming('Busco Ford Ranger');
    const first=await save(a); assert.equal(first.catalog_outcome,'created'); assert(first.vehicle_id);
    const vehicle=await one('select * from public.vehicles where id=$1',[first.vehicle_id]);
    assert.equal(vehicle.source,'demo'); assert.equal(vehicle.origin,'intake'); assert.equal(vehicle.created_by,null);
    assert.equal(vehicle.brand,'Ford'); assert.equal(vehicle.model,'Ranger');
    assert.equal((await one('select vehicle_id from public.lead_interests where lead_id=$1',[a.lead_id])).vehicle_id,vehicle.id);
    const event=await one('select actor_id,action,changes from public.inventory_events where vehicle_id=$1',[vehicle.id]);
    assert.equal(event.actor_id,null); assert.equal(event.action,'vehicle_created'); assert.equal(event.changes.actor,'bot');
    assert.equal(event.changes.source_message_id,a.message_id);
    assert.equal((await save(a)).outcome,'unchanged');
    await finish(a);
    const b=await incoming('Busco FORD RANGER');
    const reused=await save(b,' ford  ','ranger','Busco FORD RANGER');
    assert.equal(reused.catalog_outcome,'reused'); assert.equal(reused.vehicle_id,vehicle.id);
    assert.deepEqual(await one('select * from public.vehicles where id=$1',[vehicle.id]),vehicle,'Reuse never rewrites spelling/timestamps');
    assert.equal((await one('select count(*)::int n from public.inventory_events')).n,1);
    await finish(b);
    const otherOrigin=await incoming('Busco Ford Ranger','+12025550124','whatsapp_bot');
    const real=await save(otherOrigin); assert.notEqual(real.vehicle_id,vehicle.id);
    assert.equal((await one('select source from public.vehicles where id=$1',[real.vehicle_id])).source,'real');
    await finish(otherOrigin);
    assert.equal((await one('select count(*)::int n from public.inventory_units')).n,0);
    // A later human edit does not authorize replay to change catalogue or interests.
    await owner(`update public.vehicles set model='Ranger revisada' where id='${vehicle.id}'`);
    assert.equal((await save(a)).outcome,'unchanged');
    assert.equal((await one('select model from public.vehicles where id=$1',[vehicle.id])).model,'Ranger revisada');
    const conflict=params(a);conflict[5].quote='Ford Ranger';
    await assert.rejects(one(nativeSql,conflict),{code:'PT409'});
    assert.equal((await one('select count(*)::int n from public.inventory_units')).n,0);
    // Nullable authors are permitted only for genuine intake/audit records.
    await assert.rejects(q("insert into public.vehicles(brand,model,origin) values('Bad','Author','admin')"),{code:'23514'});
    await assert.rejects(q("insert into public.inventory_events(vehicle_id,action,changes) values($1,'vehicle_updated','{}')",[vehicle.id]),{code:'23514'});
  }finally{await db.close();}
});

test('catalog: missing/ambiguous attributes, trade-in separation, archived models, evidence and atomic rollback',async()=>{
  const {db,one,incoming,finish,params,save,owner}=await setup();
  try{
    const a=await incoming('Busco Ford Ranger y entrego Volkswagen Amarok 2017');
    const wrong=params(a,'Volkswagen','Amarok','entrego Volkswagen Amarok 2017');wrong[2]=extraction('Ford Ranger');
    await assert.rejects(one(nativeSql,wrong),{code:'22023'});
    const role=params(a);role[5].role='trade_in';await assert.rejects(one(nativeSql,role),{code:'22023'});
    const fake=params(a);fake[5].quote='Quiero Ford Ranger';await assert.rejects(one(nativeSql,fake),{code:'22023'});
    const incomplete=params(a);delete incomplete[3].marca;await assert.rejects(one(nativeSql,incomplete),{code:'22023'});
    const alternatives=params(a,'Ford','Ranger o Amarok','Busco Ford Ranger y entrego Volkswagen Amarok 2017');
    await assert.rejects(one(nativeSql,alternatives),{code:'22023'});
    const foreign=await incoming('Busco Ford Ranger','+12025550124');
    const foreignEvidence=params(a);foreignEvidence[5].message_id=foreign.message_id;await assert.rejects(one(nativeSql,foreignEvidence),{code:'22023'});
    await finish(foreign);
    assert.equal((await one('select count(*)::int n from public.vehicles')).n,0);
    assert.equal((await one('select summary from public.leads where id=$1',[a.lead_id])).summary,null);
    const valid=await save(a);await finish(a);
    const uncertain=await incoming('Corolla o Civic');
    const ambiguous=params(uncertain,'Toyota','Corolla','Corolla o Civic');ambiguous[5]={status:'ambiguous'};
    assert.equal((await one(nativeSql,ambiguous)).catalog_outcome,'unresolved');
    assert.equal((await one("select vehicle_id from public.lead_interests where lead_id=$1 and status='active'",[a.lead_id])).vehicle_id,null);
    await finish(uncertain);
    const missing=await incoming('Quiero una camioneta');
    const partial=params(missing);partial[2]=extraction('Una camioneta');partial[3]={};partial[5]={status:'insufficient'};
    assert.equal((await one(nativeSql,partial)).vehicle_id,null);await finish(missing);
    assert.equal((await one('select count(*)::int n from public.vehicles')).n,1);
    await owner(`update public.vehicles set archived_at=now() where id='${valid.vehicle_id}'`);
    const archived=await incoming('Busco Ford Ranger');const result=await save(archived);
    assert.equal(result.catalog_outcome,'archived');assert.equal(result.vehicle_id,null);
    assert((await one('select archived_at from public.vehicles where id=$1',[valid.vehicle_id])).archived_at);
    await finish(archived);
    const malformed=await incoming('Busco Nissan Sentra');
    const bad=params(malformed,'Nissan','Sentra','Busco Nissan Sentra');bad[2].tiene_usado=true;
    await assert.rejects(one(nativeSql,bad),{code:'22023'});
    assert.equal((await one("select count(*)::int n from public.vehicles where brand='Nissan'")).n,0);
    // Failure after model insertion/audit must roll back the whole transaction.
    await owner(`create function private.fail_catalog_request() returns trigger language plpgsql as $$ begin raise exception 'test rollback'; end $$;
      create trigger test_catalog_rollback before insert on private.bot_catalog_requests for each row execute function private.fail_catalog_request();`);
    await assert.rejects(save(malformed,'Nissan','Sentra','Busco Nissan Sentra'),{code:'P0001'});
    assert.equal((await one("select count(*)::int n from public.vehicles where brand='Nissan'")).n,0);
    assert.equal((await one('select count(*)::int n from public.inventory_events')).n,1);
    assert.equal((await one('select count(*)::int n from public.inventory_units')).n,0);
  }finally{await db.close();}
});

test('catalog: stale cross-line cutoff never creates or relinks catalogue',async()=>{
  const {db,one,incoming,save,owner}=await setup();
  try{
    await owner("insert into private.bot_processing_limits values('demo','second-line',3600,100,200)");
    const old=await incoming('Busco Nissan Sentra');
    const newer=await incoming('Busco Ford Ranger','+12025550123','demo','second-line');
    assert.equal(newer.lead_id,old.lead_id);
    const current=await save(newer);assert.equal(current.catalog_outcome,'created');
    const stale=await save(old,'Nissan','Sentra','Busco Nissan Sentra');
    assert.equal(stale.outcome,'stale');assert.equal(stale.catalog_outcome,'not_applied');
    assert.equal((await one("select count(*)::int n from public.vehicles where brand='Nissan'")).n,0);
    assert.equal((await one("select vehicle_id from public.lead_interests where lead_id=$1 and status='active'",[old.lead_id])).vehicle_id,current.vehicle_id);
  }finally{await db.close();}
});

test('catalog: no historical backfill, D07 pause and role restrictions',async()=>{
  const {db,q,one,receive,incoming,finish,params,save}=await setup();
  try{
    const a=await incoming('Busco Ford Ranger');
    await one('select * from public.save_bot_lead_details($1,$2,$3,$4)',params(a).slice(0,4));
    const historical=await save(a);assert.equal(historical.catalog_outcome,'not_applied');
    assert.equal((await one('select count(*)::int n from public.vehicles')).n,0);
    await finish(a);
    const b=await incoming('Busco Ford Ranger');await save(b);
    await q("select public.reserve_bot_reply($1,$2,'Cierre','closing',0)",[b.conversation_id,b.message_id]);
    assert.equal((await save(b)).outcome,'unchanged');
    const muted=await receive('Busco Nissan Sentra');assert.equal(muted.disposition,'paused');
    const mutedTurn=await one('select * from public.get_bot_contact_turn($1)',[muted.receipt_id]);
    await assert.rejects(save(mutedTurn,'Nissan','Sentra','Busco Nissan Sentra'),{code:'PT409'});
    assert.equal((await one('select count(*)::int n from public.vehicles')).n,1);
    await db.exec('reset role; set role anon');await assert.rejects(save(b),{code:'42501'});
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${admin}',false)`);
    await assert.rejects(save(b),{code:'42501'});
    assert.equal((await one('select units_count,available_count from public.vehicle_catalog')).available_count,0);
    await assert.rejects(q('select * from private.bot_catalog_requests'),{code:'42501'});
    await db.exec('reset role; set role service_role');
    await assert.rejects(q('select * from private.bot_catalog_requests'),{code:'42501'});
  }finally{await db.close();}
});
