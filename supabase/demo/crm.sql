-- Carga explícita de demostración, autorizada el 20/11/2026. No se ejecuta al desplegar.
-- LoadCrmDemo conserva ediciones. ResetCrmDemo restablece únicamente esta muestra.
begin;
-- RESET_MODE
select pg_advisory_xact_lock(20261120, 1504);
do $$
declare
  admin_id uuid; seller_id uuid; vehicle_id uuid; vehicle_name text;
  customer_ids uuid[] := array['d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000005']::uuid[];
  lead_ids uuid[] := array['e2000001-0000-4000-8000-000000000001','e2000002-0000-4000-8000-000000000002','e2000003-0000-4000-8000-000000000003','e2000004-0000-4000-8000-000000000004','e2000005-0000-4000-8000-000000000005','e2000006-0000-4000-8000-000000000006','e2000007-0000-4000-8000-000000000007']::uuid[];
  names text[] := array['DEMO · Lucía Torres','DEMO · Mateo Rivas','DEMO · Paula Méndez','DEMO · Clara Silva','DEMO · Nicolás Vega'];
  -- Números del bloque ficticio 202-555-01xx, no contactos de personas reales.
  phones text[] := array['+12025550101','+12025550102','+12025550103','+12025550104','+12025550105'];
  customers_for_leads integer[] := array[1,2,3,2,1,4,5];
  final_states text[] := array['new_inquiry','new_inquiry','follow_up','awaiting_stock','lost','new_inquiry','new_inquiry'];
  interests text[] := array['Sedán automático, desde 2020','Auto compacto para uso diario',null,'Camioneta diésel, desde 2018','Consulta anterior por un auto familiar','Primer auto, caja manual','SUV automático para uso familiar'];
  reasons text[] := array[null,null,'DEMO: se inició el seguimiento comercial.','DEMO: se espera una unidad compatible.','DEMO: el cliente pospuso la compra.'];
  budgets numeric[] := array[25000,15000,22000,30000,18000,12000,28000];
  i integer; inserted integer; customer_count integer := 0; lead_count integer := 0;
  owner_id uuid; arrived_at timestamptz; changed_at timestamptz;
begin
  select p.id into admin_id from public.profiles p join auth.users u on u.id=p.id
    where u.email='admin@pelucars.example' and p.role='admin' and p.is_enabled;
  if admin_id is null then raise exception 'Se requiere la cuenta Administrador Demo habilitada.'; end if;
  select p.id into seller_id from public.profiles p where p.role='seller' and p.is_enabled order by p.created_at,p.id limit 1;
  -- No habilita ni crea cuentas. Si no hay vendedor habilitado, el admin recibe la muestra.
  seller_id := coalesce(seller_id,admin_id);
  select v.id, v.brand || ' ' || v.model into vehicle_id, vehicle_name from public.vehicles v
    where v.archived_at is null order by v.brand,v.model,v.id limit 1;
  interests[3] := coalesce(vehicle_name,'Auto para uso familiar');
  if current_setting('pelucars.reset_crm_demo',true)='on' then
    -- Lista cerrada de UUID + origen. Cualquier colisión o vínculo externo revierte todo.
    if exists(select 1 from public.leads where id=any(lead_ids) and (source<>'demo' or not(customer_id=any(customer_ids))))
      or exists(select 1 from public.leads where customer_id=any(customer_ids) and not(id=any(lead_ids))) then
      raise exception 'La muestra tiene vínculos ajenos al seed. No se reinicia.';
    end if;
    for i in 1..5 loop
      if exists(select 1 from public.customers where id=customer_ids[i] and (phone_e164<>phones[i] or full_name is distinct from names[i])) then
        raise exception 'Un cliente de la muestra fue sustituido. No se reinicia.';
      end if;
    end loop;
    delete from public.lead_notifications where lead_id=any(lead_ids);
    delete from public.lead_assignments where lead_id=any(lead_ids);
    delete from public.lead_status_history where lead_id=any(lead_ids);
    delete from public.lead_interests where lead_id=any(lead_ids);
    delete from public.leads where id=any(lead_ids) and source='demo';
    delete from public.customers where id=any(customer_ids);
  end if;
  for i in 1..5 loop
    if exists(select 1 from public.customers c where c.id=customer_ids[i] and c.phone_e164<>phones[i]) then
      raise exception 'Un identificador de demo coincide con otro cliente. Se cancela la carga.';
    end if;
    insert into public.customers(id,full_name,phone_e164) values(customer_ids[i],names[i],phones[i]) on conflict(id) do nothing;
    get diagnostics inserted = row_count;
    customer_count := customer_count + inserted;
  end loop;
  -- Primero los históricos; las nuevas consultas ejercitan la regla real de recurrencia.
  foreach i in array array[5,4,3,1,2,6,7] loop
    if exists(select 1 from public.leads l where l.id=lead_ids[i]) then
      if exists(select 1 from public.leads l where l.id=lead_ids[i] and (l.source<>'demo' or l.customer_id<>customer_ids[customers_for_leads[i]])) then
        raise exception 'Un identificador de demo coincide con otra oportunidad. Se cancela la carga.';
      end if;
      continue;
    end if;
    owner_id := case when i<=2 or i>=6 then null when i=4 then seller_id else admin_id end;
    arrived_at := now() - case i when 1 then interval '45 minutes' when 2 then interval '2 hours' when 3 then interval '2 days' when 4 then interval '3 days' when 5 then interval '10 days' when 6 then interval '20 minutes' else interval '10 minutes' end;
    changed_at := case when i=5 then arrived_at + interval '2 days' else arrived_at + interval '1 hour' end;
    insert into public.leads(id,customer_id,assigned_to,source,summary,budget_max,budget_currency,
      financing_needed,trade_in_details,purchase_timeframe,created_at,updated_at,waiting_since)
    values(lead_ids[i],customer_ids[customers_for_leads[i]],owner_id,'demo',
      'DATOS FICTICIOS DE DEMOSTRACIÓN. ' || interests[i] || '. Ejemplo para revisar asignaciones, estados e historial; no proviene de una conversación real.',
      budgets[i],'USD',case when i=1 then false when i=2 then true else null end,
      case when i=3 then 'DEMO: usado a evaluar, sin tasación' else null end,
      case when i=1 then 'Este mes (ejemplo)' when i=2 then 'Dentro de tres meses (ejemplo)' else null end,
      arrived_at,arrived_at,case when owner_id is null then arrived_at else null end);
    -- Completa las fechas/etiquetas de los eventos iniciales generados por el trigger.
    update public.lead_status_history set changed_at=arrived_at,actor_name='Carga de demostración',reason='DEMO: ingreso ficticio para pruebas.' where lead_id=lead_ids[i];
    update public.lead_assignments set occurred_at=arrived_at,actor_name='Carga de demostración',reason=case when i<=2 then 'DEMO: vuelve al responsable de la consulta más reciente.' else 'DEMO: responsable inicial de la muestra.' end where lead_id=lead_ids[i];
    if i between 3 and 5 then
      update public.lead_notifications set read_at=now() where lead_id=lead_ids[i];
    end if;
    insert into public.lead_interests(lead_id,vehicle_id,requested_text,year_min,transmission,created_at,updated_at)
      values(lead_ids[i],case when i=3 then vehicle_id else null end,interests[i],case when i=1 then 2020 when i=4 then 2018 else null end,
        case when i=1 then 'Automática' else null end,arrived_at,arrived_at);
    if i between 3 and 5 then
      update public.leads set commercial_status=final_states[i],updated_at=changed_at,
        closed_at=case when i=5 then changed_at else null end,loss_reason=case when i=5 then reasons[i] else null end where id=lead_ids[i];
      insert into public.lead_status_history(lead_id,old_value,new_value,actor_name,source,reason,changed_at)
        values(lead_ids[i],'new_inquiry',final_states[i],'Carga de demostración','intake',reasons[i],changed_at);
    end if;
    lead_count := lead_count + 1;
  end loop;
  raise notice 'Carga demo: % clientes y % oportunidades nuevos. Los existentes no se modificaron.',customer_count,lead_count;
end $$;
commit;
