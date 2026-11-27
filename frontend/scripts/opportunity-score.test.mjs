import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { leadScoreSchema } from '../src/lib/crm/score-read.ts';

test('score cutoff/version, evidence and conversation permissions after reassignment', async () => {
  const db=new PGlite(), root=new URL('../../supabase/',import.meta.url);
  const id=n=>`ee000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
  const one=async(sql,args=[]) => (await q(sql,args))[0];
  const version='pelucars_score_v1_prototipo';
  const get=()=>one('select * from public.get_current_lead_score($1,$2)',[id(10),version]);
  const match=()=>one('select * from public.get_lead_unit_matches($1,$2)',[id(10),[id(40)]]);
  const result={version_reglas:version,total:15,banda:'baja',informacion_limitada:true,motivos_limitacion:['Plazo sin informar'],
    desglose:{plazo:{puntos:0,motivo:'Sin informar',evidencias:[]},intencion:{puntos:0,motivo:'Sin informar',evidencias:[]},
      busqueda:{puntos:15,motivo:'Búsqueda explícita',evidencias:['Busco Corolla']},presupuesto:{puntos:0,motivo:'Sin informar',evidencias:[]}}};
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;`);
    for(const file of (await readdir(new URL('migrations/',root))).filter(f=>f.endsWith('.sql')).sort())
      await db.exec(await readFile(new URL('migrations/'+file,root),'utf8'));
    await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');
      insert into public.profiles(id,full_name,role,is_enabled,contact_phone,contact_email) values
      ('${id(1)}','Admin','admin',true,null,null),
      ('${id(2)}','Seller','seller',true,'+12025550124','seller@example.test'),
      ('${id(3)}','Other','seller',true,'+12025550125','other@example.test');
      insert into public.customers(id,phone_e164) values('${id(5)}','+12025550123');
      insert into public.leads(id,customer_id,source) values('${id(10)}','${id(5)}','demo');
      update public.leads set budget_max=20000,budget_currency='USD',budget_scope='valor_total' where id='${id(10)}';
      insert into public.vehicles(id,brand,model,source,created_by) values('${id(30)}','Toyota','Corolla','demo','${id(1)}');
      insert into public.lead_interests(id,lead_id,vehicle_id,requested_text,year_min,transmission)
        values('${id(40)}','${id(10)}','${id(30)}','Corolla automático desde 2020',2020,'Automática');
      insert into public.inventory_units(vehicle_id,internal_code,model_year,transmission,listed_price,currency) values
        ('${id(30)}','TEST-1',2022,'Automática',19000,'USD'),
        ('${id(30)}','TEST-2',2018,'Automática',18000,'USD'),
        ('${id(30)}','TEST-3',2022,'Manual',18000,'USD'),
        ('${id(30)}','TEST-4',2022,'Automática',23000,'USD'),
        ('${id(30)}','TEST-5',2022,'Automática',null,null),
        ('${id(30)}','TEST-6',2022,'Automática',19000,'ARS');
      set role service_role;`);
    const receive=async(n,body)=>(await one('select * from public.receive_bot_message($1,$2,$3,$4,$5,$6,$7,$8)',
      [id(20),id(10),'demo','+12025550123','demo','local','score-'+n,body])).message_id;
    const old=await receive(1,'Busco Corolla'),recent=await receive(2,'Quiero comprar dentro de 15 días');
    const newer={...result,total:35,banda:'media',desglose:{...result.desglose,plazo:{puntos:20,motivo:'8 a 30 días',evidencias:['dentro de 15 días']}}};
    const save=(message,payload)=>one('select * from public.save_bot_score($1,$2,$3)',[id(20),message,payload]);
    const saved=await save(recent,newer);
    const late=await save(old,result);
    assert.notEqual(saved.evaluation_id,late.evaluation_id);
    assert.equal((await save(recent,newer)).outcome,'unchanged');
    const outbound=await one("select (public.reserve_bot_reply($1,$2,'Gracias','question',0)).*",[id(20),recent]);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id(1)}',false);`);
    assert.deepEqual(await match(),{interest_id:id(40),available_count:6,matching_count:1,unknown_count:2},'Year, transmission and price must match the same unit');
    await db.exec(`reset role; update public.leads set budget_scope='dinero_a_agregar' where id='${id(10)}'; set role authenticated;`);
    assert.deepEqual(await match(),{interest_id:id(40),available_count:6,matching_count:0,unknown_count:4},'Money to add must not be used as total price');
    await db.exec(`reset role; update public.leads set budget_scope='valor_total' where id='${id(10)}';
      update public.inventory_units set status='withdrawn' where vehicle_id='${id(30)}' and model_year=2022 and transmission='Automática' and currency='USD' and listed_price=19000;
      set role authenticated;`);
    assert.equal((await match()).matching_count,0,'Attributes on different units cannot be combined');
    assert.equal((await get()).id,saved.evaluation_id,'Late storage of old evaluation must not become current');
    assert.equal((await get()).score,35);
    assert.equal((await get()).evidence.length,2);
    const httpScore=JSON.parse(JSON.stringify(await get()));
    assert.equal(leadScoreSchema.safeParse(httpScore).success,true,JSON.stringify(leadScoreSchema.safeParse(httpScore).error));
    assert.equal(leadScoreSchema.safeParse({...await get(),result:{...newer,motivos_limitacion:[{}]}}).success,false);
    assert.equal((await q('select * from public.get_current_lead_score($1,$2)',[id(10),'another_version'])).length,0);
    assert.equal((await q('select * from public.get_current_lead_score($1,$2)',[id(99),version])).length,0,'No evaluation is not zero');
    const msgs=await q('select * from public.lead_messages where lead_id=$1',[id(10)]);
    assert.equal(msgs.length,3);
    assert.equal(msgs.find(m=>m.id===outbound.id).send_state,'pending');
    assert.equal(msgs.find(m=>m.id===outbound.id).history_position,null);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(2)}',false);`);
    assert.equal(await match(),undefined,'Unit counts must not reveal a pending interest');
    assert.equal(await get(),undefined); assert.equal((await q('select * from public.lead_messages')).length,0);
    await assert.rejects(save(recent,newer),{code:'42501'});
    await q('select public.claim_lead($1)',[id(10)]);
    assert.equal((await match()).available_count,5);
    assert.equal((await get()).score,35); assert.equal((await q('select * from public.lead_messages')).length,3);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(1)}',false);`);
    await q('select public.assign_lead($1,$2,$3,$4)',[id(10),id(3),'Test', (await one('select updated_at from public.leads where id=$1',[id(10)])).updated_at]);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(2)}',false);`);
    assert.equal(await get(),undefined); assert.equal((await q('select * from public.score_evidence')).length,0);
    assert.equal(await match(),undefined);
    assert.equal((await q('select * from public.lead_messages')).length,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(3)}',false);`);
    assert.equal((await get()).score,35); assert.equal((await q('select * from public.lead_messages')).length,3);
    await db.exec(`reset role; update public.profiles set is_enabled=false where id='${id(3)}'; set role authenticated;`);
    assert.equal(await get(),undefined); assert.equal((await q('select * from public.lead_messages')).length,0);
    await db.exec('reset role; set role anon;');
    await assert.rejects(get(),{code:'42501'}); await assert.rejects(q('select * from public.lead_messages'),{code:'42501'});
  } finally { await db.close(); }
});
