-- Pruebas aisladas: todas las filas se revierten al finalizar.
begin;
insert into auth.users(id,email) values
  ('55555555-5555-4555-8555-555555555555','inventory-admin@pelucars.example'),
  ('66666666-6666-4666-8666-666666666666','inventory-seller@pelucars.example');
insert into public.profiles(id,full_name,role,is_enabled,contact_phone,contact_email) values
  ('55555555-5555-4555-8555-555555555555','Inventory Admin','admin',true,null,null),
  ('66666666-6666-4666-8666-666666666666','Inventory Seller','seller',true,'+5491112345678','contacto@pelucars.example');
set local role anon;
do $$ begin
  begin perform 1 from public.vehicle_catalog; raise exception 'Anon leyo catalogo'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.search_vehicle_catalog('','',false,null,null,'USD',0,null); raise exception 'Anon filtro precios'; exception when insufficient_privilege then null; end;
  begin perform public.save_vehicle(null,'QA','Auto',null); raise exception 'Anon creo ficha'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $$
declare v uuid; u uuid; t timestamptz; new_t timestamptz; code text;
begin
  v := public.save_vehicle(null,'QA INVENTORY','Modelo',null);
  if (select available_count from public.vehicle_catalog where id=v) <> 0 then raise exception 'Stock inicial incorrecto'; end if;
  begin perform public.save_vehicle(null,' qa   inventory ',' MODELO ',null); raise exception 'Duplico ficha'; exception when unique_violation then null; end;
  u := public.save_inventory_unit(null,v,'QA-001',2022::smallint,'Version A','Manual',10000,15000,'USD','available',null,null);
  perform set_config('test.inventory.unit_id',u::text,true);
  select internal_code into code from public.inventory_units where id=u;
  if code !~ '^PEL-[0-9]+$' then raise exception 'Codigo no automatico'; end if;
  if (select available_count from public.vehicle_catalog where id=v) <> 1 then raise exception 'Falta stock disponible'; end if;
  begin perform public.save_inventory_unit(null,v,'QA-002',null,null,null,null,1,null,'available',null,null); raise exception 'Precio sin moneda'; exception when check_violation then null; end;
  begin perform public.save_inventory_unit(null,v,'QA-002',null,null,null,null,null,'USD','available',null,null); raise exception 'Moneda sin precio'; exception when check_violation then null; end;
  begin perform public.save_inventory_unit(null,v,'QA-002',null,null,null,-1,null,null,'available',null,null); raise exception 'Kilometraje negativo'; exception when check_violation then null; end;
  begin perform public.save_inventory_unit(null,v,'QA-002',null,null,null,null,1.001,'USD','available',null,null); raise exception 'Redondeo silencioso'; exception when check_violation then null; end;
  begin perform public.save_inventory_unit(null,v,'QA-002',null,null,null,null,null,null,'sold',null,null); raise exception 'Venta por inventario'; exception when check_violation then null; end;
  select updated_at into t from public.vehicles where id=v;
  begin perform public.set_vehicle_archived(v,true,t); raise exception 'Baja con stock'; exception when check_violation then null; end;
  select updated_at into t from public.inventory_units where id=u;
  perform public.save_inventory_unit(u,v,'QA-001',2022::smallint,'Version A','Manual',10000,null,null,'withdrawn',null,t);
  if (select internal_code from public.inventory_units where id=u) <> code then raise exception 'Cambio identidad al editar'; end if;
  if (select available_count from public.vehicle_catalog where id=v) <> 0 then raise exception 'Retirada suma stock'; end if;
  begin perform public.save_inventory_unit(u,v,'QA-001',2022::smallint,null,null,null,null,null,'available',null,t); raise exception 'Sobrescribio cambio concurrente'; exception when serialization_failure then null; end;
  select updated_at into t from public.vehicles where id=v;
  perform public.save_vehicle(v,'QA INVENTORY','Modelo editado',t);
  begin perform public.save_vehicle(v,'QA INVENTORY','Viejo',t); raise exception 'Sobrescribio ficha'; exception when serialization_failure then null; end;
  select updated_at into new_t from public.vehicles where id=v;
  perform public.set_vehicle_archived(v,true,new_t);
  begin perform public.save_inventory_unit(null,v,'QA-003',null,null,null,null,null,null,'available',null,null); raise exception 'Unidad en ficha dada de baja'; exception when check_violation then null; end;
  select updated_at into t from public.vehicles where id=v;
  perform public.set_vehicle_archived(v,false,t);
  if (select available_count from public.vehicle_catalog where id=v) <> 0 then raise exception 'Restaurar altera stock'; end if;
  if not exists(select 1 from public.inventory_events where unit_id=u and action='unit_updated') then raise exception 'Falta auditoria'; end if;
end $$;
reset role;
-- La futura venta es la unica operacion que podra producir este estado.
update public.inventory_units set status='sold' where id=current_setting('test.inventory.unit_id')::uuid;
set local role authenticated;
do $$ declare u public.inventory_units; begin
  select * into u from public.inventory_units where id=current_setting('test.inventory.unit_id')::uuid;
  begin perform public.save_inventory_unit(u.id,u.vehicle_id,u.internal_code,u.model_year,null,null,null,null,null,'available',null,u.updated_at); raise exception 'Se reabrio una venta'; exception when check_violation then null; end;
end $$;
-- Año, transmisión y disponibilidad deben coincidir en la misma unidad.
do $$ declare v uuid; manual_unit uuid; auto_unit uuid; matching_unit uuid; code text; begin
  v := public.save_vehicle(null,'QA FILTERS','Modelo',null);
  manual_unit := public.save_inventory_unit(null,v,null,2022::smallint,null,'Manual',null,null,null,'available',null,null);
  auto_unit := public.save_inventory_unit(null,v,null,2021::smallint,null,'Automática',null,null,null,'available',null,null);
  if (select internal_code from public.inventory_units where id=manual_unit) = (select internal_code from public.inventory_units where id=auto_unit) then raise exception 'Codigos duplicados'; end if;
  if exists(select 1 from public.search_vehicle_catalog('QA FILTERS','',false,2022::smallint,'automatic')) then raise exception 'Cruzo unidades distintas'; end if;
  matching_unit := public.save_inventory_unit(null,v,null,2022::smallint,null,'CVT',null,null,null,'withdrawn',null,null);
  if (select matching_units from public.search_vehicle_catalog('QA FILTERS','',false,2022::smallint,'automatic')) is distinct from 1 then raise exception 'No reconoce transmision equivalente'; end if;
  if exists(select 1 from public.search_vehicle_catalog('QA FILTERS','available',false,2022::smallint,'automatic')) then raise exception 'Devuelve retirada como disponible'; end if;
  perform public.save_inventory_unit(matching_unit,v,'CODIGO-ALTERADO',2022::smallint,null,'CVT',null,null,null,'available',null,(select updated_at from public.inventory_units where id=matching_unit));
  if (select matching_units from public.search_vehicle_catalog('qa filters','available',false,2022::smallint,'automatic')) is distinct from 1 then raise exception 'Falta coincidencia disponible'; end if;
  if exists(select 1 from public.search_vehicle_catalog('QA FILTERS','empty',false,null,null)) then raise exception 'Stock vacio incorrecto'; end if;
  if exists(select 1 from public.search_vehicle_catalog('%','',false,null,null) where id=v) then raise exception 'Busqueda trata texto como comodin'; end if;
  if not exists(select 1 from public.inventory_filter_years() where model_year=2022) then raise exception 'Falta opcion de anio'; end if;
end $$;
do $$ declare v uuid; u uuid; begin
  v := public.save_vehicle(null,'QA PRICES','Modelo',null);
  perform public.save_inventory_unit(null,v,null,2022::smallint,null,'Manual',null,10000,'USD','available',null,null);
  perform public.save_inventory_unit(null,v,null,2021::smallint,null,'Automática',null,25000,'USD','available',null,null);
  perform public.save_inventory_unit(null,v,null,2022::smallint,null,'Automática',null,25000,'ARS','available',null,null);
  perform public.save_inventory_unit(null,v,null,2022::smallint,null,'Automática',null,null,null,'available',null,null);
  if exists(select 1 from public.search_vehicle_catalog('QA PRICES','available',false,2022::smallint,'automatic','USD',20000,30000)) then raise exception 'Precio cruzo moneda, anio o unidad'; end if;
  u := public.save_inventory_unit(null,v,null,2022::smallint,null,'Automática',null,25000.50,'USD','withdrawn',null,null);
  if exists(select 1 from public.search_vehicle_catalog('QA PRICES','available',false,2022::smallint,'automatic','USD',20000,30000)) then raise exception 'Precio incluyo retirada'; end if;
  if (select matching_units from public.search_vehicle_catalog('QA PRICES','',false,2022::smallint,'automatic','USD',25000.50,25000.50)) is distinct from 1 then raise exception 'Limites no inclusivos'; end if;
  if (select matching_units from public.search_vehicle_catalog('QA PRICES','',false,null,null,'USD',null,10000)) is distinct from 1 then raise exception 'Maximo abierto incorrecto'; end if;
  if (select matching_units from public.search_vehicle_catalog('QA PRICES','',false,null,null,'USD',25000,null)) is distinct from 2 then raise exception 'Minimo abierto incorrecto'; end if;
  if (select matching_units from public.search_vehicle_catalog('QA PRICES','',false,null,null,'ARS',null,null)) is distinct from 1 then raise exception 'Filtro moneda incorrecto'; end if;
  if exists(select 1 from public.search_vehicle_catalog('QA PRICES','',false,null,null,null,0,30000)) then raise exception 'Importes sin moneda'; end if;
  if exists(select 1 from public.search_vehicle_catalog('QA PRICES','',false,null,null,'USD',30000,20000)) then raise exception 'Rango invertido'; end if;
  if exists(select 1 from public.search_vehicle_catalog('QA PRICES','',false,null,null,'USD',-1,null)) then raise exception 'Rango negativo'; end if;
end $$;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$ begin
  if not exists(select 1 from public.vehicle_catalog where brand='QA INVENTORY') then raise exception 'Vendedor no consulta'; end if;
  if not exists(select 1 from public.search_vehicle_catalog('QA FILTERS','available',false,2022::smallint,'automatic')) then raise exception 'Vendedor no puede filtrar'; end if;
  if not exists(select 1 from public.search_vehicle_catalog('QA PRICES','available',false,null,null,'USD',0,10000)) then raise exception 'Vendedor no puede filtrar precios'; end if;
  begin perform public.save_vehicle(null,'QA','Prohibido',null); raise exception 'Vendedor creo ficha'; exception when insufficient_privilege then null; end;
  begin perform public.save_inventory_unit(null,gen_random_uuid(),'QA-004',null,null,null,null,null,null,'available',null,null); raise exception 'Vendedor creo unidad'; exception when insufficient_privilege then null; end;
  begin perform public.set_vehicle_archived(gen_random_uuid(),true,now()); raise exception 'Vendedor dio baja'; exception when insufficient_privilege then null; end;
  begin update public.inventory_units set status='available'; raise exception 'Vendedor modifico directo'; exception when insufficient_privilege then null; end;
  begin delete from public.vehicles; raise exception 'Vendedor borro'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.inventory_events) then raise exception 'Vendedor ve auditoria'; end if;
end $$;
reset role;
update public.profiles set is_enabled=false where id='66666666-6666-4666-8666-666666666666';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.vehicle_catalog) or exists(select 1 from public.inventory_units) then raise exception 'Deshabilitado conserva lectura'; end if;
  if exists(select 1 from public.search_vehicle_catalog('','',false,null,null)) or exists(select 1 from public.inventory_filter_years()) then raise exception 'Filtros omiten RLS'; end if;
  if exists(select 1 from public.search_vehicle_catalog('','',false,null,null,'USD',0,null)) then raise exception 'Filtro de precio omite RLS'; end if;
end $$;
reset role;
rollback;
select 'OK: catalogo/unidades, permisos, precios, stock, bajas, concurrencia, ventas protegidas y auditoria; rollback completo' as result;
