-- Muestras adicionales autorizadas el 24/11. Idempotente y sin reset.
-- Sólo modifica registros recién insertados en esta ejecución. No crea cuentas.
begin;
select pg_advisory_xact_lock(20261124,1);
do $$
#variable_conflict use_variable
declare admin_id uuid; owners uuid[]; customer_id uuid; lead_id uuid; vehicle_id uuid; unit_id uuid;
 owner_id uuid; final_owner uuid; arrived timestamptz; first_at timestamptz; closing timestamptz;
 i integer; j integer; inserted integer; new_leads integer:=0; status_value text;
 brands text[]:=array['DEMO Toyota','DEMO Ford','DEMO Volkswagen','DEMO Peugeot'];
 models text[]:=array['Corolla','Ranger','Golf','208'];
begin
 select id into admin_id from public.profiles where role='admin' and is_enabled order by created_at,id limit 1;
 if admin_id is null then raise exception 'Se requiere un admin existente habilitado'; end if;
 select array_agg(id order by role,created_at,id) into owners from public.profiles where is_enabled;
 for i in 1..4 loop
  vehicle_id:=md5('pelucars-reports-demo-20261124-vehicle-'||i)::uuid;
  if exists(select 1 from public.vehicles v where v.id=vehicle_id and v.source<>'demo') then raise exception 'Colisión de vehículo'; end if;
  insert into public.vehicles(id,brand,model,created_by,source) values(vehicle_id,brands[i],models[i],admin_id,'demo') on conflict(id) do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
   insert into public.inventory_events(vehicle_id,actor_id,action,changes) values(vehicle_id,admin_id,'vehicle_created','{"demo_batch":"reports-20261124"}');
  end if;
  if i<4 then
   for j in 1..3 loop
    unit_id:=md5('pelucars-reports-demo-20261124-unit-'||i||'-'||j)::uuid;
    if exists(select 1 from public.inventory_units u where u.id=unit_id and u.vehicle_id<>vehicle_id) then raise exception 'Colisión de unidad'; end if;
    insert into public.inventory_units(id,vehicle_id,model_year,version,transmission,mileage_km,listed_price,currency,status,received_at)
     values(unit_id,vehicle_id,2012+j*4,'Versión de muestra '||j,case when j=2 then 'Automática' else 'Manual' end,
      120000-j*30000,case when j=3 then 18000000+i*4000000 else 12000+i*5000+j*2000 end,
      case when j=3 then 'ARS' else 'USD' end,case when i=3 then 'withdrawn' else 'available' end,current_date-j)
     on conflict(id) do nothing;
    get diagnostics inserted=row_count;
    if inserted=1 then insert into public.inventory_events(vehicle_id,unit_id,actor_id,action,changes)
      values(vehicle_id,unit_id,admin_id,'unit_created','{"demo_batch":"reports-20261124"}'); end if;
   end loop;
  end if;
 end loop;
 for i in 1..24 loop
  customer_id:=md5('pelucars-reports-demo-20261124-customer-'||i)::uuid;
  lead_id:=md5('pelucars-reports-demo-20261124-lead-'||i)::uuid;
  if exists(select 1 from public.customers c where c.id=customer_id and c.phone_e164<>('+1202555'||lpad((110+i)::text,4,'0'))) then raise exception 'Colisión de cliente'; end if;
  if exists(select 1 from public.leads l where l.id=lead_id and (l.source<>'demo' or l.customer_id<>customer_id)) then raise exception 'Colisión de consulta'; end if;
  if exists(select 1 from public.leads l where l.id=lead_id) then continue; end if;
  insert into public.customers(id,full_name,phone_e164) values(customer_id,'DEMO Reportes · Cliente '||i,'+1202555'||lpad((110+i)::text,4,'0')) on conflict(id) do nothing;
  arrived:=now()-make_interval(days=>case when i>20 then 35+i else i end);
  first_at:=arrived+make_interval(mins=>15+i*7);
  owner_id:=case when i%5=0 then null else owners[1+((i-1)%array_length(owners,1))] end;
  insert into public.leads(id,customer_id,assigned_to,source,created_at,updated_at,waiting_since,summary,budget_max,budget_currency)
   values(lead_id,customer_id,owner_id,'demo',arrived,arrived,case when owner_id is null then arrived else null end,
    'MUESTRA FICTICIA para Reportes. Sin conversación real ni venta registrada.',case when i%3=0 then 35000000 else 30000 end,case when i%3=0 then 'ARS' else 'USD' end);
  update public.lead_status_history h set changed_at=arrived,actor_name='Carga de demostración',reason='DEMO: consulta ficticia' where h.lead_id=lead_id;
  update public.lead_assignments a set occurred_at=first_at,actor_name='Carga de demostración',reason='DEMO: primera asignación' where a.lead_id=lead_id;
  if owner_id is not null and i%3=0 and array_length(owners,1)>1 then
   final_owner:=owners[1+(i%array_length(owners,1))];
   update public.leads l set assigned_to=final_owner where l.id=lead_id;
   insert into public.lead_assignments(lead_id,previous_assignee_id,assignee_id,assignee_name,previous_assignee_name,mode,reason,occurred_at)
    values(lead_id,owner_id,final_owner,(select full_name from public.profiles where id=final_owner),(select full_name from public.profiles where id=owner_id),
     'reassignment','DEMO: reasignación de muestra',first_at+interval '2 hours');
  end if;
  status_value:=case i%4 when 0 then 'lost' when 1 then 'new_inquiry' when 2 then 'follow_up' else 'awaiting_stock' end;
  closing:=arrived+interval '12 hours';
  if status_value<>'new_inquiry' then
   update public.leads l set commercial_status=status_value,updated_at=closing,closed_at=case when status_value='lost' then closing else null end,
    loss_reason=case when status_value='lost' then case when i%8=0 then 'DEMO: pospuso la compra' else 'DEMO: eligió otra propuesta' end else null end where l.id=lead_id;
   insert into public.lead_status_history(lead_id,old_value,new_value,actor_name,source,reason,changed_at)
    values(lead_id,'new_inquiry',status_value,'Carga de demostración','intake','DEMO: evolución ficticia',closing);
  end if;
  vehicle_id:=case when i%6=0 then null else md5('pelucars-reports-demo-20261124-vehicle-'||(1+(i%4)))::uuid end;
  insert into public.lead_interests(lead_id,vehicle_id,requested_text,year_min,year_max)
   values(lead_id,vehicle_id,case when vehicle_id is null then 'DEMO: búsqueda abierta sin modelo' else 'DEMO: interés de muestra en catálogo' end,2016,2024);
  -- No llena la campana con avisos históricos generados por esta carga.
  update public.lead_notifications n set read_at=now() where n.lead_id=lead_id;
  new_leads:=new_leads+1;
 end loop;
 raise notice 'Demo Reportes: % oportunidades agregadas; existentes conservadas.',new_leads;
end $$;
commit;
