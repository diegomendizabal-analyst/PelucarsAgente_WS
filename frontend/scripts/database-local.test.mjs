// PostgreSQL WASM en memoria: sin red, credenciales, seed ni cambios remotos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const root = new URL('../../supabase/', import.meta.url);
test('migraciones y regresiones SQL en PostgreSQL aislado', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;`);
    for(const file of (await readdir(new URL('migrations/',root))).filter(f=>f.endsWith('.sql')).sort()) {
      try { await db.exec(await readFile(new URL(`migrations/${file}`,root),'utf8')); }
      catch(error) { throw new Error(`Migración ${file}: ${error.message}`); }
    }
    for(const file of ['identity.sql','inventory.sql','inventory-conversion.sql','inventory-source-uniqueness.sql','crm.sql','crm-recurrence.sql','reports.sql']) {
      try { await db.exec(await readFile(new URL(`tests/${file}`,root),'utf8')); }
      catch(error) { throw new Error(`Prueba ${file}: ${error.message}`); }
    }
    assert.equal((await db.query('select count(*)::int as count from public.leads')).rows[0].count,0,'Las pruebas revierten todas las muestras');
    await db.exec(`insert into auth.users(id,email) values ('aa900000-0000-4000-8000-000000000001','local-admin@example.test'),('aa900000-0000-4000-8000-000000000002','local-seller@example.test');
      insert into public.profiles(id,full_name,role,is_enabled,contact_phone,contact_email) values
      ('aa900000-0000-4000-8000-000000000001','Local admin','admin',true,null,null),
      ('aa900000-0000-4000-8000-000000000002','Local seller','seller',true,'+12025550199','local-seller@example.test');
      insert into public.vehicles(id,brand,model,created_by) values('bb900000-0000-4000-8000-000000000001','Real','Conservar','aa900000-0000-4000-8000-000000000001');`);
    const seed = await readFile(new URL('demo/reports.sql',root),'utf8');
    await db.exec(seed);
    assert.equal((await db.query("select count(*)::int as n from public.leads where source='demo'")).rows[0].n,24);
    await db.exec("update public.leads set summary='Edición que debe preservarse' where id=md5('pelucars-reports-demo-20261124-lead-1')::uuid;");
    const snapshot = await db.query("select jsonb_agg(to_jsonb(l) order by id) as data from public.leads l");
    await db.exec(seed);
    assert.deepEqual((await db.query("select jsonb_agg(to_jsonb(l) order by id) as data from public.leads l")).rows,snapshot.rows,'Recargar no duplica ni altera muestras editadas');
    assert.equal((await db.query("select count(*)::int as n from public.vehicles where source='demo'")).rows[0].n,4);
    assert.equal((await db.query("select count(*)::int as n from public.inventory_units")).rows[0].n,9);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','aa900000-0000-4000-8000-000000000001',false);`);
    const search=async (min,max,currency,source) => (await db.query(`select count(*)::int as n from public.search_vehicle_catalog_range('', '', false, $1::smallint,$2::smallint,'',$3,null,null,$4)`,[min,max,currency,source])).rows[0].n;
    assert.equal(await search(null,null,null,'real'),1,'La muestra no contamina el catálogo real');
    assert.equal(await search(null,null,null,'demo'),4);
    assert.equal(await search(2016,2020,'USD','demo'),3);
    assert.equal(await search(2024,2024,'USD','demo'),0,'Año y moneda deben coincidir en una sola unidad');
    assert.equal(await search(2024,2016,null,'demo'),0,'No acepta rango invertido');
    const counts=(await db.query("select source,count(*)::int as n from public.customer_directory_by_source group by source")).rows;
    assert.deepEqual(counts,[{source:'demo',n:24}]);
    const realReport=(await db.query("select public.get_admin_report('2026-01-01','2100-12-31',null,'whatsapp_bot') as r")).rows[0].r;
    assert.equal(realReport.period.inquiries,0,'No hay consultas reales inventadas');
  } finally { await db.close(); }
});
