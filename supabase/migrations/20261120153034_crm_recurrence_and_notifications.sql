begin;
-- Referencia de presentación estable; el UUID sigue siendo la clave de las operaciones.
alter table public.leads add column reference_number integer generated always as identity;
alter table public.leads add constraint leads_reference_unique unique(reference_number);
grant usage, select on sequence public.leads_reference_number_seq to service_role;
create index leads_customer_recent on public.leads(customer_id,created_at desc,id desc);

-- Sólo continuidad de un cliente existente. No reparte clientes nuevos por disponibilidad.
create function private.assign_returning_customer() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_owner uuid; enabled_owner uuid;
begin
  -- Serializa ingresos del mismo cliente y evita elegir dos históricos diferentes en paralelo.
  perform 1 from public.customers where id=new.customer_id for update;
  if new.assigned_to is null then
    select l.assigned_to into previous_owner from public.leads l
      where l.customer_id=new.customer_id order by l.created_at desc,l.id desc limit 1;
    if previous_owner is not null then
      select p.id into enabled_owner from public.profiles p where p.id=previous_owner and p.is_enabled for share;
      if enabled_owner is not null then
        new.assigned_to := enabled_owner;
        new.waiting_since := null;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.assign_returning_customer() from public,anon,authenticated;
create trigger lead_returning_customer before insert on public.leads for each row execute function private.assign_returning_customer();

drop function public.list_pending_leads();
drop function private.list_pending_leads();
create function private.list_pending_leads() returns table(id uuid,reference_number integer,waiting_since timestamptz,assignment_state text)
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_crm_actor();
  return query select l.id,l.reference_number,l.waiting_since,'Sin asignar'::text from public.leads l
    where l.assigned_to is null and l.closed_at is null order by l.waiting_since,l.id;
end $$;
create function public.list_pending_leads() returns table(id uuid,reference_number integer,waiting_since timestamptz,assignment_state text)
language sql security invoker set search_path='' as $$ select * from private.list_pending_leads(); $$;
revoke all on function private.list_pending_leads(),public.list_pending_leads() from public,anon;
grant execute on function private.list_pending_leads(),public.list_pending_leads() to authenticated;

create table public.lead_notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  assignment_id uuid not null unique references public.lead_assignments(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), read_at timestamptz
);
create index lead_notifications_lead on public.lead_notifications(lead_id);
create index lead_notifications_recipient on public.lead_notifications(recipient_id,created_at desc);
alter table public.lead_notifications enable row level security;
revoke all on public.lead_notifications from public,anon,authenticated;
grant select on public.lead_notifications to authenticated;
grant all on public.lead_notifications to service_role;
create policy notifications_read on public.lead_notifications for select to authenticated using (
  recipient_id=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_enabled)
  and exists(select 1 from public.leads l where l.id=lead_id and l.assigned_to=(select auth.uid()))
);
create function private.notify_lead_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Al cambiar el responsable, no reaparecen avisos anteriores si luego vuelve a él.
  update public.lead_notifications set read_at=coalesce(read_at,now()) where lead_id=new.lead_id;
  -- Una toma voluntaria propia ya tiene confirmación en pantalla.
  if new.actor_id is distinct from new.assignee_id then
    insert into public.lead_notifications(lead_id,assignment_id,recipient_id) values(new.lead_id,new.id,new.assignee_id);
  end if;
  return new;
end $$;
revoke all on function private.notify_lead_assignment() from public,anon,authenticated;
create trigger lead_assignment_notification after insert on public.lead_assignments for each row execute function private.notify_lead_assignment();

create function private.read_lead_notification(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor public.profiles; target public.lead_notifications; current_owner uuid;
begin
  actor := private.require_crm_actor();
  select * into target from public.lead_notifications where id=p_id and recipient_id=actor.id;
  if not found then raise exception 'Notification unavailable' using errcode='P0002'; end if;
  -- Mismo orden de bloqueo que la asignación: oportunidad antes del aviso.
  select assigned_to into current_owner from public.leads where id=target.lead_id for share;
  if current_owner is distinct from actor.id then raise exception 'Notification unavailable' using errcode='P0002'; end if;
  update public.lead_notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_id;
  return target.lead_id;
end $$;
create function public.read_lead_notification(p_id uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.read_lead_notification(p_id); $$;
revoke all on function private.read_lead_notification(uuid),public.read_lead_notification(uuid) from public,anon;
grant execute on function private.read_lead_notification(uuid),public.read_lead_notification(uuid) to authenticated;
commit;
