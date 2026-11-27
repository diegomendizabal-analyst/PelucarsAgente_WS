// Real PostgreSQL in WASM, isolated in memory. No credentials or remote writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('structured intake: retries, stale writes, manual edits, catalogue and RLS', async () => {
  const db = new PGlite();
  const root = new URL('../../supabase/', import.meta.url);
  const id = n => `dd000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const q = async (sql,args=[]) => (await db.query(sql,args)).rows;
  const one = async (sql,args=[]) => (await q(sql,args))[0];
  const extraction = { vehiculo_buscado:'Toyota Corolla automático desde 2020',caracteristicas:['automático'],
    presupuesto_importe:0,presupuesto_moneda:null,presupuesto_alcance:'dinero_a_agregar',
    tiene_usado:null,decision_entrega_usado:'indecisa',usado_detalle:'Focus 2016',
    plazo_compra:'El mes que viene',necesita_financiacion:false,resumen_consulta:'Busca Corolla, duda si entrega su Focus.' };
  const attributes = {marca:'Toyota',modelo:'Corolla',anio_minimo:2020,transmision:'Automática'};
  const save = (message,payload=extraction,attrs=attributes,name='Perfil del proveedor') =>
    one('select * from public.save_bot_lead_details($1,$2,$3,$4,$5)',[id(20),message,payload,attrs,name]);
  const receive = async n => (await one('select * from public.receive_bot_message($1,$2,$3,$4,$5,$6,$7,$8)',
    [id(20),id(10),'demo','+12025550123','demo','local','message-'+n,'Cliente '+n])).message_id;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;`);
    for (const file of (await readdir(new URL('migrations/',root))).filter(f=>f.endsWith('.sql')).sort()) {
      try { await db.exec(await readFile(new URL('migrations/'+file,root),'utf8')); }
      catch(e) { throw new Error(file+': '+e.message+' '+JSON.stringify({position:e.position,internalPosition:e.internalPosition,where:e.where})); }
    }
    await db.exec(`insert into auth.users(id) values ('${id(1)}'),('${id(2)}'),('${id(3)}');
      insert into public.profiles(id,full_name,role,is_enabled,contact_phone,contact_email) values
      ('${id(1)}','Admin','admin',true,null,null),
      ('${id(2)}','Seller','seller',true,'+12025550124','seller@example.test'),
      ('${id(3)}','Other','seller',true,'+12025550125','other@example.test');
      insert into public.customers(id,phone_e164) values ('${id(5)}','+12025550123');
      insert into public.leads(id,customer_id,source) values ('${id(10)}','${id(5)}','demo');
      insert into public.vehicles(id,brand,model,source,created_by) values
      ('${id(30)}','Toyota','Corolla','real','${id(1)}'),('${id(31)}','Toyota','Corolla','demo','${id(1)}');
      set role service_role;`);
    const m1=await receive(1), m2=await receive(2), m3=await receive(3);
    assert.equal((await save(m2)).outcome,'applied');
    const snapshot=await one('select to_jsonb(l) as lead from public.leads l where id=$1',[id(10)]);
    const l=snapshot.lead;
    assert.equal(l.budget_max,0); assert.equal(l.budget_currency,null); assert.equal(l.financing_needed,false);
    assert.equal(l.trade_in_decision,'indecisa'); assert.equal(l.budget_scope,'dinero_a_agregar');
    assert.equal((await one('select full_name from public.customers where id=$1',[id(5)])).full_name,'Perfil del proveedor');
    const interest=await one('select * from public.lead_interests where lead_id=$1',[id(10)]);
    assert.equal(interest.vehicle_id,id(31)); assert.equal(interest.year_min,2020);
    assert.equal(interest.requested_text,extraction.vehiculo_buscado);
    assert.equal((await save(m2)).outcome,'unchanged');
    assert.deepEqual(await one('select to_jsonb(l) as lead from public.leads l where id=$1',[id(10)]),snapshot);
    assert.equal((await save(m1)).outcome,'stale');
    assert.equal((await one('select count(*)::int n from public.lead_interests')).n,1);
    await assert.rejects(save(m2,{...extraction,presupuesto_importe:1}),{code:'PT409'});
    await assert.rejects(save(m3,{...extraction,tiene_usado:false}),{code:'22023'});
    await assert.rejects(save(m3,{...extraction,presupuesto_importe:1.123}),{code:'22023'});
    await assert.rejects(save(m3,extraction,{...attributes,anio_minimo:'2020'}),{code:'22023'});

    // A partial model or a model present only in real must never link into demo.
    const corrected={...extraction,vehiculo_buscado:'Corolla u otro automático',presupuesto_importe:null,
      presupuesto_moneda:'USD',presupuesto_alcance:null,decision_entrega_usado:'descartada',tiene_usado:false};
    assert.equal((await save(m3,corrected,{modelo:'Corolla'})).outcome,'applied');
    assert.equal((await one("select vehicle_id from public.lead_interests where status='active'")).vehicle_id,null);
    assert.equal((await one("select count(*)::int n from public.lead_interests where status='replaced'")).n,1);
    assert.equal((await one('select budget_max from public.leads where id=$1',[id(10)])).budget_max,null);
    const m4=await receive(4);
    await db.exec(`update public.leads set financing_needed=true where id='${id(10)}';`);
    await assert.rejects(save(m4),{code:'PT409'});
    assert.equal((await one('select financing_needed from public.leads where id=$1',[id(10)])).financing_needed,true);
    await db.exec(`update public.leads set financing_needed=false where id='${id(10)}';
      update public.lead_interests set requested_text='Edición del equipo' where lead_id='${id(10)}' and status='active';`);
    await assert.rejects(save(m4),{code:'PT409'});
    await q("update public.lead_interests set requested_text=$1 where lead_id=$2 and status='active'",[corrected.vehiculo_buscado,id(10)]);
    await db.exec(`update public.customers set full_name='Nombre del equipo' where id='${id(5)}';`);
    assert.equal((await one('select provider_profile_name from public.customers where id=$1',[id(5)])).provider_profile_name,null);
    await db.exec(`reset role; insert into public.vehicles(id,brand,model,source,created_by)
      values('${id(32)}','Ford','Focus','real','${id(1)}'); set role service_role;`);
    assert.equal((await save(m4,{...extraction,vehiculo_buscado:'Ford Focus'},{marca:'Ford',modelo:'Focus'})).outcome,'applied');
    assert.equal((await one("select vehicle_id from public.lead_interests where status='active'")).vehicle_id,null);
    assert.equal((await one('select full_name from public.customers where id=$1',[id(5)])).full_name,'Nombre del equipo');
    const m5=await receive(5);
    await db.exec(`update public.leads set summary='Resumen manual' where id='${id(10)}';`);
    await assert.rejects(save(m5),{code:'PT409'});
    assert.equal((await one("select requested_text from public.lead_interests where status='active'")).requested_text,'Ford Focus');

    // Existing RLS and narrow pending projection protect the new columns too.
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id(2)}',false);`);
    assert.equal((await q('select * from public.leads')).length,0);
    assert.equal((await q('select * from public.lead_interests')).length,0);
    const pending=await one("select * from public.list_pending_leads_for_source('demo')");
    assert.deepEqual(Object.keys(pending).sort(),['assignment_state','id','reference_number','waiting_since']);
    await assert.rejects(save(m5),{code:'42501'});
    await q('select public.claim_lead($1)',[id(10)]);
    assert.equal((await q('select * from public.lead_interests')).length,3);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(1)}',false);`);
    const version=(await one('select updated_at from public.leads where id=$1',[id(10)])).updated_at;
    await q('select public.assign_lead($1,$2,$3,$4)',[id(10),id(3),'Reasignación local',version]);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(2)}',false);`);
    assert.equal((await q('select * from public.lead_interests')).length,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(3)}',false);`);
    assert.equal((await q('select * from public.lead_interests')).length,3);
  } finally { await db.close(); }
});
