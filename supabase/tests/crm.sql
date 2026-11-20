-- Datos aislados. La transacción se revierte incluso tras verificar mutaciones.
begin;
insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','crm-admin@pelucars.example'),
 ('a1000000-0000-4000-8000-000000000002','crm-seller-one@pelucars.example'),
 ('a1000000-0000-4000-8000-000000000003','crm-seller-two@pelucars.example');
insert into public.profiles(id,full_name,role,is_enabled,contact_phone,contact_email) values
 ('a1000000-0000-4000-8000-000000000001','CRM Admin','admin',true,null,null),
 ('a1000000-0000-4000-8000-000000000002','CRM Seller One','seller',true,'+5491112345601','one@pelucars.example'),
 ('a1000000-0000-4000-8000-000000000003','CRM Seller Two','seller',true,'+5491112345602','two@pelucars.example');
insert into public.customers(id,full_name,phone_e164) values
 ('b1000000-0000-4000-8000-000000000001','Nombre privado uno','+5491198765401'),
 ('b1000000-0000-4000-8000-000000000002','Nombre privado dos','+5491198765402'),
 ('b1000000-0000-4000-8000-000000000003','Nombre privado tres','+5491198765403');
insert into public.leads(id,customer_id,assigned_to,waiting_since,summary,budget_max,budget_currency) values
 ('c1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',null,now(),'Resumen privado uno',25000,'USD'),
 ('c1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003',null,'Otra consulta del mismo cliente',null,null),
 ('c1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002',null,'Consulta propia',null,null),
 ('c1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000003',null,now(),'Otra en espera',null,null);
insert into public.lead_interests(lead_id,requested_text) values
 ('c1000000-0000-4000-8000-000000000001','Interés privado'),('c1000000-0000-4000-8000-000000000002','Interés de otro vendedor');
set local role anon;
do $$ begin
  begin perform 1 from public.customers; raise exception 'Anon lee clientes'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.list_pending_leads(); raise exception 'Anon ve cola'; exception when insufficient_privilege then null; end;
  begin perform public.claim_lead('c1000000-0000-4000-8000-000000000001'); raise exception 'Anon toma'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
do $$ declare keys text[]; t timestamptz; begin
  if exists(select 1 from public.leads where id in ('c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002')) then raise exception 'Ve pendientes o ajenas'; end if;
  if exists(select 1 from public.customers where id='b1000000-0000-4000-8000-000000000001') then raise exception 'Ve identidad pendiente'; end if;
  if exists(select 1 from public.lead_interests) then raise exception 'Ve intereses ajenos'; end if;
  if exists(select 1 from public.lead_timeline where lead_id='c1000000-0000-4000-8000-000000000001') then raise exception 'Ve historial pendiente'; end if;
  if (select count(*) from public.list_pending_leads() where id in ('c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004')) <> 2 then raise exception 'No ve proyeccion'; end if;
  select array_agg(k order by k) into keys from public.list_pending_leads() p cross join lateral jsonb_object_keys(to_jsonb(p)) k where p.id='c1000000-0000-4000-8000-000000000001';
  if keys is distinct from array['assignment_state','id','reference_number','waiting_since'] then raise exception 'Proyeccion filtra columnas privadas'; end if;
  if (select inquiry_count from public.customer_directory where id='b1000000-0000-4000-8000-000000000002') <> 1 then raise exception 'Contador propio incorrecto'; end if;
  begin update public.leads set assigned_to=auth.uid(); raise exception 'Escritura directa'; exception when insufficient_privilege then null; end;
  begin insert into public.customers(phone_e164) values('+5491198765409'); raise exception 'Alta manual expuesta'; exception when insufficient_privilege then null; end;
  begin perform public.assign_lead('c1000000-0000-4000-8000-000000000001',auth.uid(),'Sin permiso',now()); raise exception 'Vendedor asigna'; exception when insufficient_privilege then null; end;
  begin perform public.set_lead_status('c1000000-0000-4000-8000-000000000001','lost','No autorizado',now()); raise exception 'Cambia pendiente'; exception when no_data_found then null; end;
  perform public.claim_lead('c1000000-0000-4000-8000-000000000001');
  perform public.claim_lead('c1000000-0000-4000-8000-000000000004');
  if (select count(*) from public.leads) <> 3 then raise exception 'Toma sin tope provisional no funciona'; end if;
  if exists(select 1 from public.list_pending_leads() where id='c1000000-0000-4000-8000-000000000001') then raise exception 'Asignada permanece en cola'; end if;
  if (select inquiry_count from public.customer_directory where id='b1000000-0000-4000-8000-000000000001') <> 1 then raise exception 'Contador revela consulta ajena'; end if;
  if not exists(select 1 from public.lead_interests where lead_id='c1000000-0000-4000-8000-000000000001') then raise exception 'No recibe detalle tras tomar'; end if;
  begin perform public.claim_lead('c1000000-0000-4000-8000-000000000001'); raise exception 'Doble toma'; exception when no_data_found then null; end;
  select updated_at into t from public.leads where id='c1000000-0000-4000-8000-000000000001';
  perform public.set_lead_status('c1000000-0000-4000-8000-000000000001','awaiting_stock','Espera unidad',t);
  if (select closed_at from public.leads where id='c1000000-0000-4000-8000-000000000001') is not null then raise exception 'Espera stock cierra'; end if;
  begin perform public.set_lead_status('c1000000-0000-4000-8000-000000000001','follow_up','Cambio viejo',t); raise exception 'Sobrescribe concurrente'; exception when serialization_failure then null; end;
  select updated_at into t from public.leads where id='c1000000-0000-4000-8000-000000000004';
  begin perform public.set_lead_status('c1000000-0000-4000-8000-000000000004','sold','Venta falsa',t); raise exception 'Vende sin venta'; exception when check_violation then null; end;
  begin perform public.set_lead_status('c1000000-0000-4000-8000-000000000004','lost','',t); raise exception 'Pierde sin motivo'; exception when check_violation then null; end;
  perform public.set_lead_status('c1000000-0000-4000-8000-000000000004','lost','El cliente desistio',t);
  select updated_at into t from public.leads where id='c1000000-0000-4000-8000-000000000004';
  begin perform public.set_lead_status('c1000000-0000-4000-8000-000000000004','follow_up','Reabre',t); raise exception 'Reabre sin regla'; exception when check_violation then null; end;
  if (select accepts_assignments from public.profiles where id=auth.uid()) then raise exception 'Estado cambio disponibilidad'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$ declare t timestamptz; begin
  if (select inquiry_count from public.customer_directory where id='b1000000-0000-4000-8000-000000000001')<>2 then raise exception 'Admin no ve historial completo'; end if;
  select updated_at into t from public.leads where id='c1000000-0000-4000-8000-000000000001';
  begin perform public.assign_lead('c1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','',t); raise exception 'Reasigna sin motivo'; exception when check_violation then null; end;
  perform public.assign_lead('c1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','Reasignacion administrativa',t);
  begin perform public.assign_lead('c1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','Vieja version',t); raise exception 'Reasignacion vieja'; exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.leads where id='c1000000-0000-4000-8000-000000000001') or exists(select 1 from public.customers where id='b1000000-0000-4000-8000-000000000001') then raise exception 'Anterior conserva acceso'; end if;
  if exists(select 1 from public.lead_interests where lead_id='c1000000-0000-4000-8000-000000000001') or exists(select 1 from public.lead_timeline where lead_id='c1000000-0000-4000-8000-000000000001') then raise exception 'Relacion filtra tras reasignacion'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select inquiry_count from public.customer_directory where id='b1000000-0000-4000-8000-000000000001')<>2 then raise exception 'Nuevo no accede'; end if;
  if not exists(select 1 from public.lead_assignments where lead_id='c1000000-0000-4000-8000-000000000001' and mode='reassignment') then raise exception 'Falta historial'; end if;
end $$;
reset role;
update public.profiles set is_enabled=false where id='a1000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.leads) or exists(select 1 from public.customer_directory) or exists(select 1 from public.lead_timeline) then raise exception 'Deshabilitado lee'; end if;
  begin perform 1 from public.list_pending_leads(); raise exception 'Deshabilitado ve cola'; exception when insufficient_privilege then null; end;
  begin perform public.claim_lead('c1000000-0000-4000-8000-000000000001'); raise exception 'Deshabilitado toma'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin perform public.assign_lead('c1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','Deshabilitado',(select updated_at from public.leads where id='c1000000-0000-4000-8000-000000000003')); raise exception 'Asigna deshabilitado'; exception when check_violation then null; end;
end $$;
reset role;
rollback;
select 'OK: proyeccion de tres campos, RLS, historial por oportunidad, toma, estados, reasignacion y deshabilitacion; rollback completo' as result;
