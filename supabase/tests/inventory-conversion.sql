begin;
insert into auth.users(id,email) values
 ('cc800000-0000-4000-8000-000000000001','budget-admin@example.test'),
 ('cc800000-0000-4000-8000-000000000002','budget-seller@example.test');
insert into public.profiles(id,full_name,role,is_enabled,contact_phone,contact_email) values
 ('cc800000-0000-4000-8000-000000000001','Budget admin','admin',true,null,null),
 ('cc800000-0000-4000-8000-000000000002','Budget seller','seller',true,'+12025550177','budget-seller@example.test');
select set_config('request.jwt.claim.sub','cc800000-0000-4000-8000-000000000001',true);
insert into public.vehicles(id,brand,model,source,created_by)
 select md5('budget-model-'||n)::uuid,'Budget test','Model '||n,'demo','cc800000-0000-4000-8000-000000000001'::uuid from generate_series(1,25)n;
insert into public.inventory_units(vehicle_id,model_year,transmission,listed_price,currency,status)
 select md5('budget-model-'||n)::uuid,2024,'Automática',100,'USD','available' from generate_series(1,25)n;
insert into public.inventory_units(vehicle_id,model_year,transmission,listed_price,currency,status)
 values (md5('budget-model-1')::uuid,2020,'Manual',100000,'ARS','available'),
 (md5('budget-model-1')::uuid,2024,'Manual',100.01,'USD','withdrawn'),
 (md5('budget-model-1')::uuid,2024,'Manual',null,null,'available');
set local role authenticated;
do $$
declare n integer; amount numeric;
begin
 select count(*) into n from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',100000,100000,'demo',1000);
 assert n=25,'La comparación incluye modelos fuera de la primera página';
 select count(*) over() into n from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',100000,100000,'demo',1000) limit 1;
 assert n=25,'Total calculado antes de paginar';
 select matching_units into n from public.search_vehicle_catalog_budget('Model 1','',false,null,null,'','ARS',100000,100000,'demo',1000) where id=md5('budget-model-1')::uuid;
 assert n=2,'Una unidad USD y otra ARS coinciden sin duplicar modelo';
 select count(*) into n from public.search_inventory_units_budget('demo',md5('budget-model-1')::uuid,null,null,'','','USD',100,100,1000);
 assert n=2,'USD incluye equivalentes ARS y precio original USD';
 select count(*) into n from public.search_inventory_units_budget('demo',md5('budget-model-1')::uuid,null,null,'','','ARS',100000,100000,1000);
 assert n=2,'Ficha y catálogo usan idéntica selección';
 select equivalent_price into amount from public.search_inventory_units_budget('demo',md5('budget-model-1')::uuid,2020::smallint,null,'','','USD',null,null,1000);
 assert amount=100,'Equivalente ARS/USD sin modificar precio';
 select count(*) into n from public.search_vehicle_catalog_budget('Model 1','available',false,2024::smallint,2024::smallint,'manual','ARS',null,100000,'demo',1000);
 assert n=0,'Precio, año, transmisión y stock deben coincidir en una misma unidad';
 select count(*) into n from public.search_inventory_units_budget('demo',md5('budget-model-1')::uuid,null,null,'','','ARS',100000.01,null,1000);
 assert n=1,'Extremo inferior abierto excluye valores inferiores sin redondeo';
 select count(*) into n from public.search_inventory_units_budget('demo',md5('budget-model-1')::uuid,null,null,'','available','ARS',100000.01,null,1000);
 assert n=0,'Unidades retiradas no aparecen al pedir disponibles';
 select count(*) into n from public.search_inventory_units_budget('demo',md5('budget-model-1')::uuid,null,null,'','','USD',null,null,2000);
 assert n=3,'Los precios desconocidos no se usan como cero';
 select count(*) into n from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',null,null,'real',1000);
 assert n=0,'Sin mezclar fuentes';
 select count(*) into n from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',null,null,'demo',null);
 assert n=0,'Sin tasa no hay equivalencias';
 select count(*) into n from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',null,null,'demo',0);
 assert n=0,'Tasa cero no produce división ni resultados';
 select count(*) into n from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',null,null,'demo','NaN'::numeric);
 assert n=0,'Tasa NaN rechazada';
 select count(*) into n from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',100,10,'demo',1000);
 assert n=0,'Rango invertido rechazado';
 assert (select listed_price=100000 and currency='ARS' from public.inventory_units where vehicle_id=md5('budget-model-1')::uuid and model_year=2020),'Precio original conservado';
end $$;
select set_config('request.jwt.claim.sub','cc800000-0000-4000-8000-000000000002',true);
do $$ begin
 assert (select count(*)=25 from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',null,100000,'demo',1000)),'Vendedor habilitado puede buscar';
end $$;
reset role;
update public.profiles set is_enabled=false where id='cc800000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
 assert (select count(*)=0 from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',null,null,'demo',1000)),'RLS bloquea vendedor deshabilitado';
end $$;
set local role anon;
do $$ begin
 perform * from public.search_vehicle_catalog_budget('','',false,null,null,'','ARS',null,null,'demo',1000);
 raise exception 'Anon debe rechazarse';
 exception when insufficient_privilege then null;
end $$;
reset role;
rollback;
