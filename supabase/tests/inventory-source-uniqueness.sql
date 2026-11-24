-- Sólo PostgreSQL local: reproducción de la colisión real/demo y regresión.
begin;
insert into auth.users(id,email) values ('dd810000-0000-4000-8000-000000000001','catalog-scope@example.test');
insert into public.profiles(id,full_name,role,is_enabled) values
 ('dd810000-0000-4000-8000-000000000001','Catalog scope admin','admin',true);
select set_config('request.jwt.claim.sub','dd810000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare real_id uuid; demo_id uuid; origin text; n integer;
begin
 real_id := public.save_vehicle_for_source(null,'Toyota','Corolla',null,'real');
 select count(*) into n from public.search_vehicle_catalog_range('Toyota Corolla','',false,null,null,'',null,null,null,'demo');
 assert n=0,'Un modelo real no debe aparecer en el catálogo demo';
 demo_id := public.save_vehicle_for_source(null,'Toyota','Corolla',null,'demo');
 assert real_id<>demo_id,'El mismo modelo tiene identidades independientes por origen';
 foreach origin in array array['real','demo'] loop
  begin
   perform public.save_vehicle_for_source(null,'  TOYOTA  ','  cOrOlLa  ',null,origin);
   raise exception 'Se aceptó un duplicado normalizado en %',origin;
  exception when unique_violation then null;
  end;
  select count(*) into n from public.search_vehicle_catalog_range('Toyota Corolla','',false,null,null,'',null,null,null,origin)
   where id=case when origin='real' then real_id else demo_id end;
  assert n=1,'Cada catálogo debe devolver su propio modelo';
  select count(*) into n from public.search_vehicle_catalog_range('Toyota Corolla','',false,null,null,'',null,null,null,origin)
   where id=case when origin='real' then demo_id else real_id end;
  assert n=0,'Las búsquedas no deben cruzar orígenes';
 end loop;
end $$;
reset role;
-- También probar el índice directamente, sin depender de que la RPC limpie texto.
insert into public.vehicles(brand,model,source,created_by) values
 ('Land Rover','Range Rover','real','dd810000-0000-4000-8000-000000000001'),
 ('Land Rover','Range Rover','demo','dd810000-0000-4000-8000-000000000001');
do $$
declare origin text;
begin
 foreach origin in array array['real','demo'] loop
  begin
   insert into public.vehicles(brand,model,source,created_by) values
    (E'  LAND\t  ROVER  ',E'  range   ROVER  ',origin,'dd810000-0000-4000-8000-000000000001');
   raise exception 'El índice aceptó espacios internos/mayúsculas en %',origin;
  exception when unique_violation then null;
  end;
 end loop;
 begin
  update public.vehicles set source='real' where source='demo' and brand='Toyota' and model='Corolla';
  raise exception 'El índice permitió una colisión al cambiar el origen';
 exception when unique_violation then null;
 end;
end $$;
rollback;
