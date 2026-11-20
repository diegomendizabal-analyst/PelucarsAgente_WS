-- Clientes y oportunidades reales. Sin seed ni recepción del bot en esta etapa.
begin;
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text check (full_name is null or length(btrim(full_name)) between 1 and 160),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete restrict,
  source text not null default 'whatsapp_bot' check (source = 'whatsapp_bot'),
  commercial_status text not null default 'new_inquiry' check (commercial_status in ('new_inquiry','follow_up','awaiting_stock','lost','sold')),
  summary text check (length(summary) <= 6000),
  budget_min numeric(14,2), budget_max numeric(14,2), budget_currency text,
  financing_needed boolean, trade_in_details text check (length(trade_in_details) <= 2000),
  purchase_timeframe text check (length(purchase_timeframe) <= 240),
  waiting_since timestamptz default now(), closed_at timestamptz,
  loss_reason text check (length(loss_reason) <= 1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint lead_budget_valid check ((budget_min is null or budget_min >= 0) and (budget_max is null or budget_max >= 0)
    and (budget_min is null or budget_max is null or budget_min <= budget_max)
    and (((budget_min is not null or budget_max is not null) and budget_currency is not null and budget_currency in ('ARS','USD'))
      or (budget_min is null and budget_max is null and budget_currency is null))),
  constraint lead_waiting_valid check ((assigned_to is null and waiting_since is not null) or (assigned_to is not null and waiting_since is null)),
  constraint lead_closed_valid check ((commercial_status in ('lost','sold')) = (closed_at is not null)),
  constraint lead_loss_reason_valid check ((commercial_status = 'lost' and loss_reason is not null and length(btrim(loss_reason)) > 0)
    or (commercial_status <> 'lost' and loss_reason is null))
);
create index leads_customer on public.leads(customer_id);
create index leads_assignee on public.leads(assigned_to,created_at desc,id);
create index leads_waiting on public.leads(waiting_since,id) where assigned_to is null and closed_at is null;
create table public.lead_interests (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete restrict,
  requested_text text not null check (length(btrim(requested_text)) between 1 and 2000),
  year_min smallint check (year_min between 1000 and 9999), year_max smallint check (year_max between 1000 and 9999),
  requested_version text check (length(requested_version) <= 120), transmission text check (length(transmission) <= 60),
  is_primary boolean not null default true, status text not null default 'active' check (status in ('active','replaced')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (year_min is null or year_max is null or year_min <= year_max)
);
create unique index lead_primary_interest on public.lead_interests(lead_id) where is_primary and status='active';
create index lead_interests_lead on public.lead_interests(lead_id,created_at);
create index lead_interests_vehicle on public.lead_interests(vehicle_id);
create table public.lead_assignments (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete restrict,
  previous_assignee_id uuid references public.profiles(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  actor_name text, previous_assignee_name text, assignee_name text not null,
  mode text not null check (mode in ('intake','manual_claim','admin_assignment','reassignment')),
  reason text check (length(reason) <= 1000), occurred_at timestamptz not null default now()
);
create index lead_assignments_lead on public.lead_assignments(lead_id,occurred_at desc);
create index lead_assignments_previous on public.lead_assignments(previous_assignee_id);
create index lead_assignments_assignee on public.lead_assignments(assignee_id);
create index lead_assignments_actor on public.lead_assignments(actor_id);
create table public.lead_status_history (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete restrict,
  old_value text, new_value text not null, actor_id uuid references public.profiles(id) on delete restrict,
  actor_name text, source text not null check (source in ('intake','user')), reason text,
  changed_at timestamptz not null default now()
);
create index lead_status_history_lead on public.lead_status_history(lead_id,changed_at desc);
create index lead_status_history_actor on public.lead_status_history(actor_id);

alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.lead_interests enable row level security;
alter table public.lead_assignments enable row level security;
alter table public.lead_status_history enable row level security;
revoke all on public.customers,public.leads,public.lead_interests,public.lead_assignments,public.lead_status_history from public,anon,authenticated;
grant select on public.customers,public.leads,public.lead_interests,public.lead_assignments,public.lead_status_history to authenticated;
grant all on public.customers,public.leads,public.lead_interests,public.lead_assignments,public.lead_status_history to service_role;
create policy leads_read on public.leads for select to authenticated using (
  (select private.is_enabled_admin()) or (assigned_to = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_enabled))
);
create policy customers_read on public.customers for select to authenticated using (
  (select private.is_enabled_admin()) or exists(select 1 from public.leads l where l.customer_id = customers.id)
);
create policy interests_read on public.lead_interests for select to authenticated using (exists(select 1 from public.leads l where l.id=lead_id));
create policy assignments_read on public.lead_assignments for select to authenticated using (exists(select 1 from public.leads l where l.id=lead_id));
create policy status_history_read on public.lead_status_history for select to authenticated using (exists(select 1 from public.leads l where l.id=lead_id));

-- Los agregados cuentan únicamente oportunidades visibles bajo RLS.
create view public.customer_directory with (security_invoker=true) as
  select c.id,c.full_name,c.phone_e164,c.created_at,c.updated_at,count(l.id)::integer as inquiry_count,
    max(l.created_at) as last_inquiry_at from public.customers c left join public.leads l on l.customer_id=c.id group by c.id;
revoke all on public.customer_directory from public,anon,authenticated;
grant select on public.customer_directory to authenticated;
create view public.lead_timeline with (security_invoker=true) as
  select id,lead_id,'assignment'::text as kind,previous_assignee_name as old_value,assignee_name as new_value,actor_name,reason,occurred_at from public.lead_assignments
  union all select id,lead_id,'status'::text,old_value,new_value,actor_name,reason,changed_at from public.lead_status_history;
revoke all on public.lead_timeline from public,anon,authenticated;
grant select on public.lead_timeline to authenticated;

-- El historial inicial no depende de que la futura integración recuerde escribirlo.
create function private.record_lead_intake() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.lead_status_history(lead_id,new_value,source) values(new.id,new.commercial_status,'intake');
  if new.assigned_to is not null then
    insert into public.lead_assignments(lead_id,assignee_id,assignee_name,mode)
      select new.id,p.id,p.full_name,'intake' from public.profiles p where p.id=new.assigned_to;
  end if;
  return new;
end; $$;
revoke all on function private.record_lead_intake() from public,anon,authenticated;
create trigger lead_intake_history after insert on public.leads for each row execute function private.record_lead_intake();

create function private.require_crm_actor() returns public.profiles language plpgsql security definer set search_path='' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and is_enabled for share;
  if not found then raise exception 'CRM access required' using errcode='42501'; end if;
  return actor;
end; $$;
revoke all on function private.require_crm_actor() from public,anon,authenticated;

-- Única proyección compartida. Ningún dato del cliente/interés/score entra en su resultado.
create function private.list_pending_leads() returns table(id uuid,waiting_since timestamptz,assignment_state text)
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_crm_actor();
  return query select l.id,l.waiting_since,'Sin asignar'::text from public.leads l
    where l.assigned_to is null and l.closed_at is null order by l.waiting_since,l.id;
end; $$;
create function public.list_pending_leads() returns table(id uuid,waiting_since timestamptz,assignment_state text)
language sql security invoker set search_path='' as $$ select * from private.list_pending_leads(); $$;

-- Sin tope provisional, autorizado para la demo. No interpreta accepts_assignments ni libera vendedores.
create function private.claim_lead(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.profiles; previous public.leads;
begin
  actor := private.require_crm_actor();
  select * into previous from public.leads where id=p_id for update;
  if not found or previous.assigned_to is not null or previous.closed_at is not null then
    raise exception 'Opportunity unavailable' using errcode='P0002';
  end if;
  update public.leads set assigned_to=actor.id,waiting_since=null,updated_at=clock_timestamp() where id=p_id;
  insert into public.lead_assignments(lead_id,assignee_id,assignee_name,actor_id,actor_name,mode)
    values(p_id,actor.id,actor.full_name,actor.id,actor.full_name,'manual_claim');
  return p_id;
end; $$;
create function public.claim_lead(p_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.claim_lead(p_id); $$;

create function private.assign_lead(p_id uuid,p_assignee uuid,p_reason text,p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; target public.profiles; previous public.leads;
begin
  actor := private.require_admin();
  select * into target from public.profiles where id=p_assignee and is_enabled for share;
  if not found then raise exception 'Assignee unavailable' using errcode='23514'; end if;
  select * into previous from public.leads where id=p_id for update;
  if not found then raise exception 'Opportunity unavailable' using errcode='P0002'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then raise exception 'Opportunity changed' using errcode='40001'; end if;
  if previous.closed_at is not null then raise exception 'Closed opportunity' using errcode='23514'; end if;
  if previous.assigned_to = target.id then return p_id; end if;
  if previous.assigned_to is not null and coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Reassignment reason required' using errcode='23514'; end if;
  update public.leads set assigned_to=target.id,waiting_since=null,updated_at=clock_timestamp() where id=p_id;
  insert into public.lead_assignments(lead_id,previous_assignee_id,assignee_id,actor_id,actor_name,previous_assignee_name,assignee_name,mode,reason)
    values(p_id,previous.assigned_to,target.id,actor,(select full_name from public.profiles where id=actor),
      (select full_name from public.profiles where id=previous.assigned_to),target.full_name,
      case when previous.assigned_to is null then 'admin_assignment' else 'reassignment' end,nullif(btrim(p_reason),''));
  return p_id;
end; $$;
create function public.assign_lead(p_id uuid,p_assignee uuid,p_reason text,p_expected_updated_at timestamptz)
returns uuid language sql security invoker set search_path='' as $$ select private.assign_lead(p_id,p_assignee,p_reason,p_expected_updated_at); $$;

create function private.set_lead_status(p_id uuid,p_status text,p_reason text,p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.profiles; previous public.leads;
begin
  actor := private.require_crm_actor();
  select * into previous from public.leads where id=p_id for update;
  if not found or (actor.role <> 'admin' and previous.assigned_to is distinct from actor.id) then
    raise exception 'Opportunity unavailable' using errcode='P0002'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then raise exception 'Opportunity changed' using errcode='40001'; end if;
  if previous.closed_at is not null or p_status is null or p_status not in ('new_inquiry','follow_up','awaiting_stock','lost') then
    raise exception 'Status operation unavailable' using errcode='23514'; end if;
  if p_reason is not null and length(p_reason)>1000 then raise exception 'Reason too long' using errcode='23514'; end if;
  if p_status='lost' and coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Loss reason required' using errcode='23514'; end if;
  if previous.commercial_status=p_status then return p_id; end if;
  update public.leads set commercial_status=p_status,closed_at=case when p_status='lost' then clock_timestamp() else null end,
    loss_reason=case when p_status='lost' then btrim(p_reason) else null end,updated_at=clock_timestamp() where id=p_id;
  insert into public.lead_status_history(lead_id,old_value,new_value,actor_id,actor_name,source,reason)
    values(p_id,previous.commercial_status,p_status,actor.id,actor.full_name,'user',nullif(btrim(p_reason),''));
  return p_id;
end; $$;
create function public.set_lead_status(p_id uuid,p_status text,p_reason text,p_expected_updated_at timestamptz)
returns uuid language sql security invoker set search_path='' as $$ select private.set_lead_status(p_id,p_status,p_reason,p_expected_updated_at); $$;

revoke all on function private.list_pending_leads(),public.list_pending_leads(),private.claim_lead(uuid),public.claim_lead(uuid),
  private.assign_lead(uuid,uuid,text,timestamptz),public.assign_lead(uuid,uuid,text,timestamptz),
  private.set_lead_status(uuid,text,text,timestamptz),public.set_lead_status(uuid,text,text,timestamptz) from public,anon;
grant execute on function private.list_pending_leads(),public.list_pending_leads(),private.claim_lead(uuid),public.claim_lead(uuid),
  private.assign_lead(uuid,uuid,text,timestamptz),public.assign_lead(uuid,uuid,text,timestamptz),
  private.set_lead_status(uuid,text,text,timestamptz),public.set_lead_status(uuid,text,text,timestamptz) to authenticated;
commit;
