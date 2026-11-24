-- Ejecutar sólo en base local aislada. Todos los datos se revierten.
begin;
insert into auth.users(id,email) values
 ('a9000000-0000-4000-8000-000000000001','report-admin@example.test'),
 ('a9000000-0000-4000-8000-000000000002','report-a@example.test'),
 ('a9000000-0000-4000-8000-000000000003','report-b@example.test'),
 ('a9000000-0000-4000-8000-000000000004','report-disabled@example.test');
insert into public.profiles(id,full_name,role,is_enabled,contact_phone,contact_email) values
 ('a9000000-0000-4000-8000-000000000001','Admin reportes','admin',true,null,null),
 ('a9000000-0000-4000-8000-000000000002','Vendedor A','seller',true,'+5491100000091','a@example.test'),
 ('a9000000-0000-4000-8000-000000000003','Vendedor B','seller',false,'+5491100000092','b@example.test'),
 ('a9000000-0000-4000-8000-000000000004','Admin deshabilitado','admin',false,null,null);
insert into public.customers(id,phone_e164)
 select md5('report-customer-'||i)::uuid,'+54912'||lpad(i::text,8,'0') from generate_series(1,1009) i;
insert into public.leads(id,customer_id,assigned_to,waiting_since,created_at,source)
 select md5('report-lead-'||i)::uuid,md5('report-customer-'||i)::uuid,
 case when i=1008 then null else 'a9000000-0000-4000-8000-000000000002'::uuid end,
 case when i=1008 then '2026-09-01T03:00:00Z'::timestamptz else null end,
 case when i=1005 then '2026-11-02T02:59:59.999999Z'::timestamptz
   when i=1006 then '2026-11-01T02:59:59.999999Z'::timestamptz
   when i=1007 then '2026-11-02T03:00:00Z'::timestamptz
   when i=1008 then '2026-09-01T03:00:00Z'::timestamptz
   else '2026-11-01T03:00:00Z'::timestamptz end,
 case when i=1009 then 'demo' else 'whatsapp_bot' end from generate_series(1,1009) i;
update public.leads set customer_id=md5('report-customer-1')::uuid where id=md5('report-lead-2')::uuid;
update public.lead_assignments a set occurred_at=l.created_at+case when l.id=md5('report-lead-1005')::uuid then interval '0' else interval '1 hour' end
 from public.leads l where l.id=a.lead_id;
insert into public.lead_assignments(lead_id,previous_assignee_id,assignee_id,assignee_name,mode,occurred_at)
 values (md5('report-lead-1')::uuid,'a9000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000003','Vendedor B','reassignment','2026-11-01T05:00:00Z'),
 (md5('report-lead-1')::uuid,'a9000000-0000-4000-8000-000000000003','a9000000-0000-4000-8000-000000000002','Vendedor A','reassignment','2026-11-01T06:00:00Z'),
 (md5('report-lead-1')::uuid,'a9000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000003','Vendedor B','reassignment','2026-11-01T07:00:00Z');
update public.leads set assigned_to='a9000000-0000-4000-8000-000000000003',commercial_status='awaiting_stock' where id=md5('report-lead-1')::uuid;
update public.leads set commercial_status='lost',closed_at='2026-11-01T08:00:00Z',loss_reason='Desistió' where id=md5('report-lead-3')::uuid;
insert into public.vehicles(id,brand,model,created_by) values ('d9000000-0000-4000-8000-000000000001','Reporte','Modelo','a9000000-0000-4000-8000-000000000001');
insert into public.lead_interests(lead_id,vehicle_id,requested_text,is_primary) values
 (md5('report-lead-1')::uuid,'d9000000-0000-4000-8000-000000000001','Modelo',true),
 (md5('report-lead-1')::uuid,'d9000000-0000-4000-8000-000000000001','Otra versión',false),
 (md5('report-lead-2')::uuid,null,'Búsqueda genérica',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; d jsonb; begin
 r:=public.get_admin_report('2026-11-01','2026-11-01');
 if (r#>>'{period,inquiries}')::int<>1005 then raise exception 'Límites locales o agregado truncado: %',r; end if;
 if (r#>>'{period,customers}')::int<>1004 then raise exception 'Clientes no deduplicados'; end if;
 -- Una consulta anterior al período recibe su primera asignación dentro de él.
 if (r#>>'{period,received}')::int<>1006 or (r#>>'{period,reassigned}')::int<>1 then raise exception 'Asignaciones duplicadas'; end if;
 if (r#>>'{period,median_minutes}')::numeric<>60 then raise exception 'Mediana incorrecta'; end if;
 if (r#>>'{current,portfolio}')::int<>1007 or (r#>>'{current,pending}')::int<>1 then raise exception 'Cartera limitada al período'; end if;
 if (r#>>'{period,lost}')::int<>1 then raise exception 'Pérdidas incorrectas'; end if;
 if (r#>>'{demand,0,count}')::int<>1 or (r#>>'{demand,1,count}')::int<>1 then raise exception 'Intereses multiplican demanda'; end if;
 if not exists(select 1 from jsonb_array_elements(r->'sellers') p where p->>'id'='a9000000-0000-4000-8000-000000000003') then raise exception 'Falta vendedor histórico deshabilitado'; end if;
 d:=public.list_admin_report_details('2026-11-01','2026-11-01',null,'whatsapp_bot','inquiries',2);
 if (d->>'total')::int<>1005 or jsonb_array_length(d->'rows')<>20 then raise exception 'Detalle paginado cambia total'; end if;
 d:=public.list_admin_report_details('2026-11-01','2026-11-01',null,'whatsapp_bot','inquiries',100);
 if (d->>'total')::int<>1005 or jsonb_array_length(d->'rows')<>0 then raise exception 'Página vacía pierde total'; end if;
 d:=public.list_admin_report_details('2026-11-01','2026-11-01',null,'whatsapp_bot','demand',1,'d9000000-0000-4000-8000-000000000001');
 if (d->>'total')::int<>1 then raise exception 'Detalle de demanda duplica'; end if;
 r:=public.get_admin_report('2026-11-01','2026-11-01','a9000000-0000-4000-8000-000000000003');
 if (r#>>'{period,inquiries}')::int<>0 or (r#>>'{period,received}')::int<>1 or (r#>>'{current,portfolio}')::int<>1 then raise exception 'Atribución usa dueño actual para todo'; end if;
 if r#>'{period,lost}'<>'null'::jsonb or r#>'{current,pending}'<>'null'::jsonb or r#>'{period,median_minutes}'<>'null'::jsonb then raise exception 'Ausencia convertida en cero'; end if;
 r:=public.get_admin_report('2026-11-01','2026-11-01',null,'demo');
 if (r#>>'{period,inquiries}')::int<>1 or (r#>>'{current,portfolio}')::int<>1 then raise exception 'Mezcla demo y real'; end if;
 r:=public.get_admin_report('2020-01-01','2020-01-01');
 if (r#>>'{period,inquiries}')::int<>0 or r#>'{period,median_minutes}'<>'null'::jsonb then raise exception 'Vacío incorrecto'; end if;
 begin perform public.get_admin_report('2026-11-02','2026-11-01'); raise exception 'Acepta rango invertido'; exception when invalid_parameter_value then null; end;
 begin perform public.get_admin_report('2026-11-01','2026-11-01',null,'all'); raise exception 'Acepta fuentes mezcladas'; exception when invalid_parameter_value then null; end;
 begin perform public.list_admin_report_details('2026-11-01','2026-11-01',null,'demo','sql',1); raise exception 'Acepta métrica arbitraria'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.get_admin_report('2026-11-01','2026-11-01',auth.uid()); raise exception 'Vendedor lee reportes propios'; exception when insufficient_privilege then null; end;
 begin perform public.list_admin_report_details('2026-11-01','2026-11-01'); raise exception 'Vendedor lee detalle'; exception when insufficient_privilege then null; end;
 begin perform private.report_scope('2026-11-01','2026-11-01',auth.uid(),'demo'); raise exception 'Vendedor elude wrapper'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000004',true);
do $$ begin
 begin perform public.get_admin_report('2026-11-01','2026-11-01'); raise exception 'Admin deshabilitado lee reportes'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.get_admin_report('2026-11-01','2026-11-01'); raise exception 'Anónimo lee reportes'; exception when insufficient_privilege then null; end;
end $$;
rollback;
