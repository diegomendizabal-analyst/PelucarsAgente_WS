-- Primera etapa: identidad y administración de vendedores. Sin datos iniciales.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  role text not null check (role in ('admin', 'seller')),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  is_enabled boolean not null default false,
  accepts_assignments boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disabled_not_available check (is_enabled or not accepts_assignments)
);

create table public.user_admin_events (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('bootstrap', 'created', 'updated', 'enabled', 'disabled')),
  changed_fields jsonb not null,
  occurred_at timestamptz not null default now()
);
create index user_admin_events_subject_time on public.user_admin_events(subject_user_id, occurred_at desc);
create index user_admin_events_actor on public.user_admin_events(actor_id);

alter table public.profiles enable row level security;
alter table public.user_admin_events enable row level security;
revoke all on public.profiles, public.user_admin_events from anon, authenticated;
grant select on public.profiles, public.user_admin_events to authenticated;
grant all on public.profiles, public.user_admin_events to service_role;

create function private.is_enabled_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin' and is_enabled);
$$;
revoke all on function private.is_enabled_admin() from public, anon;
grant execute on function private.is_enabled_admin() to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using ((id = (select auth.uid()) and is_enabled) or (select private.is_enabled_admin()));
create policy user_admin_events_read on public.user_admin_events for select to authenticated
using ((select private.is_enabled_admin()));

-- Revalida el actor en la transacción y lo bloquea frente a una deshabilitación concurrente.
create function private.require_admin() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  select id into actor from public.profiles
  where id = auth.uid() and role = 'admin' and is_enabled for share;
  if actor is null then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return actor;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

-- Correo en Auth como fuente única; esta proyección sólo se concede a administradores.
create function private.list_managed_users()
returns table (id uuid, full_name text, role text, contact_phone text, is_enabled boolean,
  accepts_assignments boolean, email text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query select p.id, p.full_name, p.role, p.contact_phone, p.is_enabled,
    p.accepts_assignments, u.email::text
    from public.profiles p join auth.users u on u.id = p.id order by p.created_at, p.id;
end;
$$;

-- Auth se crea primero en el servidor. Sin perfil, una cuenta no tiene acceso al CRM.
create function private.register_seller(p_id uuid, p_full_name text, p_contact_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  actor := private.require_admin();
  insert into public.profiles(id, full_name, role, contact_phone, is_enabled)
  values (p_id, btrim(p_full_name), 'seller', nullif(btrim(p_contact_phone), ''), true);
  insert into public.user_admin_events(subject_user_id, actor_id, action, changed_fields)
  values (p_id, actor, 'created', jsonb_build_object('role', 'seller', 'is_enabled', true,
    'full_name', btrim(p_full_name), 'contact_phone', nullif(btrim(p_contact_phone), '')));
  return p_id;
end;
$$;

create function private.update_seller(p_id uuid, p_full_name text, p_contact_phone text, p_is_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid; previous public.profiles; updated public.profiles;
begin
  actor := private.require_admin();
  select * into previous from public.profiles where id = p_id and role = 'seller' for update;
  if not found then raise exception 'Seller not found' using errcode = 'P0002'; end if;
  update public.profiles set full_name = btrim(p_full_name), contact_phone = nullif(btrim(p_contact_phone), ''),
    is_enabled = p_is_enabled, accepts_assignments = case when p_is_enabled then accepts_assignments else false end,
    updated_at = now() where id = p_id returning * into updated;
  insert into public.user_admin_events(subject_user_id, actor_id, action, changed_fields)
  values (p_id, actor, case when previous.is_enabled = p_is_enabled then 'updated'
    when p_is_enabled then 'enabled' else 'disabled' end,
    jsonb_build_object('before', jsonb_build_object('full_name', previous.full_name,
      'contact_phone', previous.contact_phone, 'is_enabled', previous.is_enabled,
      'accepts_assignments', previous.accepts_assignments),
      'after', jsonb_build_object('full_name', updated.full_name, 'contact_phone', updated.contact_phone,
      'is_enabled', updated.is_enabled, 'accepts_assignments', updated.accepts_assignments)));
end;
$$;

-- Alta inicial controlada desde una herramienta local. Nunca desde el navegador.
-- No cambia roles ni reescribe perfiles existentes. El evento identifica el bootstrap.
create function private.bootstrap_account(p_id uuid, p_full_name text, p_role text, p_contact_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, role, contact_phone, is_enabled)
    values (p_id, btrim(p_full_name), p_role, nullif(btrim(p_contact_phone), ''), true);
  insert into public.user_admin_events(subject_user_id, actor_id, action, changed_fields)
    values (p_id, p_id, 'bootstrap', jsonb_build_object('role', p_role, 'is_enabled', true,
      'full_name', btrim(p_full_name), 'contact_phone', nullif(btrim(p_contact_phone), '')));
  return p_id;
end;
$$;

-- RPC públicas sin privilegios elevados; implementaciones privilegiadas en schema privado.
create function public.list_managed_users()
returns table (id uuid, full_name text, role text, contact_phone text, is_enabled boolean,
  accepts_assignments boolean, email text)
language sql security invoker set search_path = '' as $$ select * from private.list_managed_users(); $$;
create function public.register_seller(p_id uuid, p_full_name text, p_contact_phone text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.register_seller(p_id, p_full_name, p_contact_phone);
$$;
create function public.update_seller(p_id uuid, p_full_name text, p_contact_phone text, p_is_enabled boolean)
returns void language sql security invoker set search_path = '' as $$
  select private.update_seller(p_id, p_full_name, p_contact_phone, p_is_enabled);
$$;
create function public.bootstrap_account(p_id uuid, p_full_name text, p_role text, p_contact_phone text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.bootstrap_account(p_id, p_full_name, p_role, p_contact_phone);
$$;

revoke all on function private.list_managed_users() from public, anon;
revoke all on function private.register_seller(uuid, text, text) from public, anon;
revoke all on function private.update_seller(uuid, text, text, boolean) from public, anon;
revoke all on function private.bootstrap_account(uuid, text, text, text) from public, anon, authenticated;
grant execute on function private.list_managed_users() to authenticated;
grant execute on function private.register_seller(uuid, text, text) to authenticated;
grant execute on function private.update_seller(uuid, text, text, boolean) to authenticated;
grant execute on function private.bootstrap_account(uuid, text, text, text) to service_role;
revoke all on function public.list_managed_users() from public, anon;
revoke all on function public.register_seller(uuid, text, text) from public, anon;
revoke all on function public.update_seller(uuid, text, text, boolean) from public, anon;
revoke all on function public.bootstrap_account(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.list_managed_users() to authenticated;
grant execute on function public.register_seller(uuid, text, text) to authenticated;
grant execute on function public.update_seller(uuid, text, text, boolean) to authenticated;
grant execute on function public.bootstrap_account(uuid, text, text, text) to service_role;

commit;
