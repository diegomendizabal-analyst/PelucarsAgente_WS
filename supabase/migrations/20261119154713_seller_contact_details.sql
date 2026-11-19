-- Contacto comercial independiente de Auth. No completa datos históricos ni cambia accesos.
begin;

alter table public.profiles add column contact_email text
  constraint profiles_contact_email_format check (contact_email is null or (
    length(contact_email) <= 254 and contact_email = btrim(contact_email)
    and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));

-- NOT VALID conserva las cuentas anteriores incompletas, pero exige contacto en
-- toda nueva inserción/edición de vendedores. Validar tras completar las existentes.
alter table public.profiles add constraint seller_contact_required
  check (role <> 'seller' or (contact_phone is not null and contact_email is not null)) not valid;

drop function public.list_managed_users();
drop function private.list_managed_users();
create function private.list_managed_users()
returns table (id uuid, full_name text, role text, contact_phone text, is_enabled boolean,
  accepts_assignments boolean, email text, contact_email text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query select p.id, p.full_name, p.role, p.contact_phone, p.is_enabled,
    p.accepts_assignments, u.email::text, p.contact_email
    from public.profiles p join auth.users u on u.id = p.id order by p.created_at, p.id;
end;
$$;
create function public.list_managed_users()
returns table (id uuid, full_name text, role text, contact_phone text, is_enabled boolean,
  accepts_assignments boolean, email text, contact_email text)
language sql security invoker set search_path = '' as $$ select * from private.list_managed_users(); $$;

-- Retirar contratos anteriores: no dejar una vía de edición sin contacto.
drop function public.register_seller(uuid, text, text);
drop function private.register_seller(uuid, text, text);
drop function public.update_seller(uuid, text, text, boolean);
drop function private.update_seller(uuid, text, text, boolean);

create function private.register_seller(p_id uuid, p_full_name text, p_contact_phone text, p_contact_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  actor := private.require_admin();
  insert into public.profiles(id, full_name, role, contact_phone, contact_email, is_enabled)
    values (p_id, btrim(p_full_name), 'seller', nullif(btrim(p_contact_phone), ''), nullif(btrim(p_contact_email), ''), true);
  insert into public.user_admin_events(subject_user_id, actor_id, action, changed_fields)
    values (p_id, actor, 'created', jsonb_build_object('role', 'seller', 'is_enabled', true,
      'full_name', btrim(p_full_name), 'contact_phone', btrim(p_contact_phone), 'contact_email', btrim(p_contact_email)));
  return p_id;
end;
$$;
create function private.update_seller(p_id uuid, p_full_name text, p_contact_phone text, p_is_enabled boolean, p_contact_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid; previous public.profiles; updated public.profiles;
begin
  actor := private.require_admin();
  select * into previous from public.profiles where id = p_id and role = 'seller' for update;
  if not found then raise exception 'Seller not found' using errcode = 'P0002'; end if;
  update public.profiles set full_name = btrim(p_full_name), contact_phone = nullif(btrim(p_contact_phone), ''),
    contact_email = nullif(btrim(p_contact_email), ''), is_enabled = p_is_enabled,
    accepts_assignments = case when p_is_enabled then accepts_assignments else false end,
    updated_at = now() where id = p_id returning * into updated;
  insert into public.user_admin_events(subject_user_id, actor_id, action, changed_fields)
    values (p_id, actor, case when previous.is_enabled = p_is_enabled then 'updated'
      when p_is_enabled then 'enabled' else 'disabled' end,
      jsonb_build_object('before', jsonb_build_object('full_name', previous.full_name,
        'contact_phone', previous.contact_phone, 'contact_email', previous.contact_email,
        'is_enabled', previous.is_enabled, 'accepts_assignments', previous.accepts_assignments),
        'after', jsonb_build_object('full_name', updated.full_name, 'contact_phone', updated.contact_phone,
        'contact_email', updated.contact_email, 'is_enabled', updated.is_enabled,
        'accepts_assignments', updated.accepts_assignments)));
end;
$$;
create function public.register_seller(p_id uuid, p_full_name text, p_contact_phone text, p_contact_email text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.register_seller(p_id, p_full_name, p_contact_phone, p_contact_email);
$$;
create function public.update_seller(p_id uuid, p_full_name text, p_contact_phone text, p_is_enabled boolean, p_contact_email text)
returns void language sql security invoker set search_path = '' as $$
  select private.update_seller(p_id, p_full_name, p_contact_phone, p_is_enabled, p_contact_email);
$$;

drop function public.bootstrap_account(uuid, text, text, text);
drop function private.bootstrap_account(uuid, text, text, text);
create function private.bootstrap_account(p_id uuid, p_full_name text, p_role text, p_contact_phone text, p_contact_email text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, role, contact_phone, contact_email, is_enabled)
    values (p_id, btrim(p_full_name), p_role, nullif(btrim(p_contact_phone), ''), nullif(btrim(p_contact_email), ''), true);
  insert into public.user_admin_events(subject_user_id, actor_id, action, changed_fields)
    values (p_id, p_id, 'bootstrap', jsonb_build_object('role', p_role, 'is_enabled', true,
      'full_name', btrim(p_full_name), 'contact_phone', nullif(btrim(p_contact_phone), ''),
      'contact_email', nullif(btrim(p_contact_email), '')));
  return p_id;
end;
$$;
create function public.bootstrap_account(p_id uuid, p_full_name text, p_role text, p_contact_phone text, p_contact_email text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.bootstrap_account(p_id, p_full_name, p_role, p_contact_phone, p_contact_email);
$$;

revoke all on function private.list_managed_users(), public.list_managed_users(),
  private.register_seller(uuid, text, text, text), public.register_seller(uuid, text, text, text),
  private.update_seller(uuid, text, text, boolean, text), public.update_seller(uuid, text, text, boolean, text)
  from public, anon;
grant execute on function private.list_managed_users(), public.list_managed_users(),
  private.register_seller(uuid, text, text, text), public.register_seller(uuid, text, text, text),
  private.update_seller(uuid, text, text, boolean, text), public.update_seller(uuid, text, text, boolean, text)
  to authenticated;
revoke all on function private.bootstrap_account(uuid, text, text, text, text),
  public.bootstrap_account(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function private.bootstrap_account(uuid, text, text, text, text),
  public.bootstrap_account(uuid, text, text, text, text) to service_role;

commit;
