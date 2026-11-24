-- Sólo funciones e índices de lectura. No modifica cuentas, seed ni historial.
begin;
create index leads_report_source_created on public.leads(source,created_at,id);
create index assignments_report_time on public.lead_assignments(occurred_at,assignee_id,lead_id);

-- Una fila por oportunidad; ningún join de intereses multiplica los KPI.
-- SECURITY INVOKER conserva RLS y además exige admin, incluso para datos propios.
create function private.report_scope(p_from date,p_to date,p_seller uuid,p_source text)
returns table(lead_id uuid,customer_id uuid,status text,owner_id uuid,created_at timestamptz,
  waiting_since timestamptz,closed_at timestamptz,loss_reason text,first_assignee uuid,
  first_at timestamptz,cohort boolean,received boolean,reassigned boolean,current_scope boolean)
language plpgsql stable security invoker set search_path='' as $$
declare start_at timestamptz; end_at timestamptz;
begin
  if not private.is_enabled_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to or p_from<'2000-01-01'::date or p_to>'2100-12-31'::date
    or p_source is null or p_source not in ('whatsapp_bot','demo') then
    raise exception 'Invalid report filters' using errcode='22023';
  end if;
  if p_seller is not null and not exists(select 1 from public.profiles where id=p_seller) then
    raise exception 'Invalid seller' using errcode='22023';
  end if;
  start_at := p_from::timestamp at time zone 'America/Buenos_Aires';
  end_at := (p_to+1)::timestamp at time zone 'America/Buenos_Aires';
  return query
    select l.id,l.customer_id,l.commercial_status,l.assigned_to,l.created_at,l.waiting_since,l.closed_at,l.loss_reason,
      first_assignment.assignee_id,first_assignment.occurred_at,
      l.created_at>=start_at and l.created_at<end_at and (p_seller is null or first_assignment.assignee_id=p_seller),
      exists(select 1 from public.lead_assignments a where a.lead_id=l.id and a.occurred_at>=start_at and a.occurred_at<end_at
        and (p_seller is null or a.assignee_id=p_seller)),
      exists(select 1 from public.lead_assignments a where a.lead_id=l.id and a.occurred_at>=start_at and a.occurred_at<end_at
        and a.previous_assignee_id is not null and (p_seller is null or a.assignee_id=p_seller)),
      l.closed_at is null and (p_seller is null or l.assigned_to=p_seller)
    from public.leads l
    left join lateral (select a.assignee_id,a.occurred_at from public.lead_assignments a
      where a.lead_id=l.id order by a.occurred_at,a.id limit 1) first_assignment on true
    where l.source=p_source;
end; $$;
revoke all on function private.report_scope(date,date,uuid,text) from public,anon;
grant execute on function private.report_scope(date,date,uuid,text) to authenticated;

create function public.get_admin_report(p_from date,p_to date,p_seller uuid default null,p_source text default 'whatsapp_bot')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not private.is_enabled_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  with scope as materialized (select * from private.report_scope(p_from,p_to,p_seller,p_source)),
  losses as (select * from scope where status='lost'
    and closed_at>=p_from::timestamp at time zone 'America/Buenos_Aires'
    and closed_at<(p_to+1)::timestamp at time zone 'America/Buenos_Aires'),
  demand as (select i.vehicle_id,coalesce(v.brand||' '||v.model,'Búsqueda sin modelo vinculado') as label,
      count(distinct s.lead_id) as count,count(distinct s.lead_id) filter(where s.status='awaiting_stock') as awaiting_stock
    from scope s join public.lead_interests i on i.lead_id=s.lead_id and i.status='active'
    left join public.vehicles v on v.id=i.vehicle_id where s.current_scope
    group by i.vehicle_id,v.brand,v.model)
  select jsonb_build_object(
    'generated_at',statement_timestamp(),
    'sellers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.full_name,p.id),'[]'::jsonb)
      from (select id,full_name,role,is_enabled from public.profiles p where role='seller'
        or exists(select 1 from public.lead_assignments a where a.assignee_id=p.id)
        or exists(select 1 from public.leads l where l.assigned_to=p.id)) p),
    'period',(select jsonb_build_object(
      'inquiries',count(*) filter(where cohort),'customers',count(distinct customer_id) filter(where cohort),
      'received',count(*) filter(where received),'reassigned',count(*) filter(where reassigned),
      'assigned',count(*) filter(where cohort and first_at is not null),
      'unassigned',count(*) filter(where cohort and first_at is null),
      'median_minutes',percentile_cont(0.5) within group(order by extract(epoch from first_at-created_at)/60)
        filter(where cohort and first_at>=created_at),
      'lost',case when p_seller is null then (select count(*) from losses) else null end) from scope),
    'current',(select jsonb_build_object('portfolio',count(*) filter(where current_scope),
      'pending',case when p_seller is null then count(*) filter(where current_scope and owner_id is null) else null end,
      'awaiting_stock',count(*) filter(where current_scope and status='awaiting_stock'),
      'oldest_pending_at',case when p_seller is null then min(waiting_since) filter(where current_scope and owner_id is null) else null end,
      'states',(select coalesce(jsonb_agg(to_jsonb(t) order by t.status),'[]'::jsonb)
        from (select status,count(*) as count from scope where current_scope group by status) t)) from scope),
    'demand',(select coalesce(jsonb_agg(to_jsonb(d) order by d.count desc,d.label,d.vehicle_id),'[]'::jsonb) from demand d),
    'losses',case when p_seller is null then (select coalesce(jsonb_agg(to_jsonb(t) order by t.count desc,t.reason),'[]'::jsonb)
      from (select loss_reason as reason,count(*) as count from losses group by loss_reason) t) else '[]'::jsonb end
  ) into result;
  return result;
end; $$;
revoke all on function public.get_admin_report(date,date,uuid,text) from public,anon;
grant execute on function public.get_admin_report(date,date,uuid,text) to authenticated;

-- Paginación sólo del detalle, con el total calculado antes del límite.
create function public.list_admin_report_details(p_from date,p_to date,p_seller uuid default null,p_source text default 'whatsapp_bot',
  p_metric text default 'inquiries',p_page integer default 1,p_vehicle uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not private.is_enabled_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_page is null or p_page<1 or p_page>100000 or p_metric is null
    or p_metric not in ('inquiries','received','reassigned','portfolio','pending','awaiting_stock','lost','demand')
    or (p_seller is not null and p_metric in ('pending','lost')) then
    raise exception 'Invalid report detail' using errcode='22023';
  end if;
  with scope as materialized (select * from private.report_scope(p_from,p_to,p_seller,p_source)),
  selected as materialized (select s.lead_id,s.created_at from scope s where case p_metric
    when 'inquiries' then s.cohort when 'received' then s.received when 'reassigned' then s.reassigned
    when 'portfolio' then s.current_scope when 'pending' then s.current_scope and s.owner_id is null
    when 'awaiting_stock' then s.current_scope and s.status='awaiting_stock'
    when 'lost' then s.status='lost' and s.closed_at>=p_from::timestamp at time zone 'America/Buenos_Aires'
      and s.closed_at<(p_to+1)::timestamp at time zone 'America/Buenos_Aires'
    when 'demand' then s.current_scope and exists(select 1 from public.lead_interests i
      where i.lead_id=s.lead_id and i.status='active' and i.vehicle_id is not distinct from p_vehicle)
    else false end),
  page as (select l.id,l.reference_number,c.full_name,l.commercial_status,l.created_at
    from selected s join public.leads l on l.id=s.lead_id join public.customers c on c.id=l.customer_id
    order by s.created_at desc,s.lead_id limit 20 offset (p_page-1)*20)
  select jsonb_build_object('generated_at',statement_timestamp(),'total',(select count(*) from selected),
    'rows',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id),'[]'::jsonb) from page p)) into result;
  return result;
end; $$;
revoke all on function public.list_admin_report_details(date,date,uuid,text,text,integer,uuid) from public,anon;
grant execute on function public.list_admin_report_details(date,date,uuid,text,text,integer,uuid) to authenticated;
commit;
