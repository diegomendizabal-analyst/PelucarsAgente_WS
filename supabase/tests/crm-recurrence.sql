-- Aislado de las muestras persistentes. Todos los cambios se revierten.
begin;
insert into auth.users(id,email) values
 ('a3000000-0000-4000-8000-000000000001','recurrence-admin@pelucars.example'),
 ('a3000000-0000-4000-8000-000000000002','recurrence-one@pelucars.example'),
 ('a3000000-0000-4000-8000-000000000003','recurrence-two@pelucars.example');
insert into public.profiles(id,full_name,role,is_enabled,accepts_assignments,contact_phone,contact_email) values
 ('a3000000-0000-4000-8000-000000000001','Recurrence Admin','admin',true,false,null,null),
 ('a3000000-0000-4000-8000-000000000002','Recurrence One','seller',true,false,'+12025550191','one@pelucars.example'),
 ('a3000000-0000-4000-8000-000000000003','Recurrence Two','seller',true,false,'+12025550192','two@pelucars.example');
insert into public.customers(id,full_name,phone_e164) values
 ('b3000000-0000-4000-8000-000000000001','Recurrente','+12025550193'),
 ('b3000000-0000-4000-8000-000000000002','Nuevo','+12025550194');
insert into public.leads(id,customer_id,assigned_to,waiting_since,created_at,commercial_status,closed_at,loss_reason) values
 ('c3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002',null,now()-interval '10 days','lost',now()-interval '9 days','Compra pospuesta');
insert into public.leads(id,customer_id,created_at) values
 ('c3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001',now()-interval '2 days'),
 ('c3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000002',now());
do $$ begin
  if not exists(select 1 from public.leads where id='c3000000-0000-4000-8000-000000000002' and assigned_to='a3000000-0000-4000-8000-000000000002' and waiting_since is null) then raise exception 'No retiene responsable ocupado'; end if;
  if not exists(select 1 from public.leads where id='c3000000-0000-4000-8000-000000000003' and assigned_to is null) then raise exception 'Asigna cliente nuevo'; end if;
  if not exists(select 1 from public.lead_notifications where lead_id='c3000000-0000-4000-8000-000000000002' and recipient_id='a3000000-0000-4000-8000-000000000002' and read_at is null) then raise exception 'Falta aviso recurrente'; end if;
  if (select count(distinct reference_number) from public.leads where customer_id in ('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002'))<>3 then raise exception 'Referencias repetidas'; end if;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.lead_notifications; raise exception 'Anon lee avisos'; exception when insufficient_privilege then null; end;
  begin perform public.read_lead_notification(gen_random_uuid()); raise exception 'Anon marca aviso'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000002',true);
do $$ declare n uuid; begin
  select id into n from public.lead_notifications where lead_id='c3000000-0000-4000-8000-000000000002';
  if n is null then raise exception 'Destinatario no ve aviso'; end if;
  if public.read_lead_notification(n)<>'c3000000-0000-4000-8000-000000000002'::uuid then raise exception 'Destino incorrecto'; end if;
  if exists(select 1 from public.lead_notifications where id=n and read_at is null) then raise exception 'No marca leído'; end if;
  begin update public.lead_notifications set recipient_id=auth.uid(); raise exception 'Escritura directa'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);
do $$ declare t timestamptz; begin
  if exists(select 1 from public.lead_notifications where lead_id='c3000000-0000-4000-8000-000000000002') then raise exception 'Admin lee avisos personales ajenos'; end if;
  select updated_at into t from public.leads where id='c3000000-0000-4000-8000-000000000002';
  perform public.assign_lead('c3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000003','Cambio de responsable',t);
end $$;
reset role;
insert into public.leads(id,customer_id,created_at) values('c3000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000001',now()-interval '1 day');
do $$ begin
  if not exists(select 1 from public.leads where id='c3000000-0000-4000-8000-000000000004' and assigned_to='a3000000-0000-4000-8000-000000000003') then raise exception 'No elige responsable vigente de la más reciente'; end if;
end $$;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.lead_notifications where lead_id in ('c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000004')) then raise exception 'Anterior conserva avisos'; end if;
  perform public.claim_lead('c3000000-0000-4000-8000-000000000003');
  if exists(select 1 from public.lead_notifications where lead_id='c3000000-0000-4000-8000-000000000003') then raise exception 'Toma propia genera aviso redundante'; end if;
end $$;
reset role;
update public.profiles set is_enabled=false where id='a3000000-0000-4000-8000-000000000003';
insert into public.leads(id,customer_id,created_at) values('c3000000-0000-4000-8000-000000000005','b3000000-0000-4000-8000-000000000001',now());
do $$ begin
  if not exists(select 1 from public.leads where id='c3000000-0000-4000-8000-000000000005' and assigned_to is null and waiting_since is not null) then raise exception 'Deshabilitado no vuelve a espera'; end if;
end $$;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.lead_notifications) then raise exception 'Deshabilitado ve avisos'; end if;
end $$;
reset role;
rollback;
select 'OK: recurrencia por última consulta, responsable ocupado/deshabilitado, referencias únicas, avisos y aislamiento por destinatario; rollback completo' as result;
