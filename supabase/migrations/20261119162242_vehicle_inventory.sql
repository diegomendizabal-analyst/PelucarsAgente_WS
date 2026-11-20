-- Catálogo e inventario. Sin carga de datos, ventas ni integración externa.
begin;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (length(btrim(brand)) between 1 and 80),
  model text not null check (length(btrim(model)) between 1 and 120),
  search_name text generated always as (lower(brand || ' ' || model)) stored,
  origin text not null default 'admin' check (origin in ('admin', 'intake')),
  needs_review boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- La unicidad usa dos columnas: evita colisiones al concatenar marca y modelo.
create unique index vehicles_brand_model_key on public.vehicles
  (lower(regexp_replace(btrim(brand), '\s+', ' ', 'g')), lower(regexp_replace(btrim(model), '\s+', ' ', 'g')));
create index vehicles_created_by on public.vehicles(created_by);

create table public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  internal_code text not null check (length(btrim(internal_code)) between 1 and 40),
  model_year smallint check (model_year between 1000 and 9999),
  version text check (version is null or length(btrim(version)) between 1 and 120),
  transmission text check (transmission is null or length(btrim(transmission)) between 1 and 60),
  mileage_km integer check (mileage_km >= 0),
  listed_price numeric(14,2) check (listed_price > 0),
  currency text check (currency in ('ARS', 'USD')),
  status text not null default 'available' check (status in ('available', 'sold', 'withdrawn')),
  received_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_price_currency check ((listed_price is null) = (currency is null))
);
create unique index inventory_units_code_key on public.inventory_units(upper(btrim(internal_code)));
create index inventory_units_vehicle_status on public.inventory_units(vehicle_id, status);

create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  unit_id uuid references public.inventory_units(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('vehicle_created', 'vehicle_updated', 'vehicle_archived', 'vehicle_restored', 'unit_created', 'unit_updated')),
  changes jsonb not null,
  occurred_at timestamptz not null default now()
);
create index inventory_events_vehicle_time on public.inventory_events(vehicle_id, occurred_at desc);
create index inventory_events_unit on public.inventory_events(unit_id);
create index inventory_events_actor on public.inventory_events(actor_id);

alter table public.vehicles enable row level security;
alter table public.inventory_units enable row level security;
alter table public.inventory_events enable row level security;
revoke all on public.vehicles, public.inventory_units, public.inventory_events from anon, authenticated;
grant select on public.vehicles, public.inventory_units, public.inventory_events to authenticated;
grant all on public.vehicles, public.inventory_units, public.inventory_events to service_role;
create policy vehicles_read on public.vehicles for select to authenticated
  using (exists(select 1 from public.profiles where id = (select auth.uid()) and is_enabled));
create policy inventory_units_read on public.inventory_units for select to authenticated
  using (exists(select 1 from public.profiles where id = (select auth.uid()) and is_enabled));
create policy inventory_events_admin_read on public.inventory_events for select to authenticated
  using ((select private.is_enabled_admin()));

create view public.vehicle_catalog with (security_invoker = true) as
  select v.id, v.brand, v.model, v.search_name, v.archived_at, v.updated_at,
    count(u.id)::integer as units_count,
    count(u.id) filter(where u.status = 'available')::integer as available_count
  from public.vehicles v left join public.inventory_units u on u.vehicle_id = v.id
  group by v.id;
revoke all on public.vehicle_catalog from public, anon, authenticated;
grant select on public.vehicle_catalog to authenticated;

create function private.save_vehicle(p_id uuid, p_brand text, p_model text, p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; previous public.vehicles; updated public.vehicles;
begin
  actor := private.require_admin();
  if p_id is null then
    insert into public.vehicles(brand, model, created_by)
      values (regexp_replace(btrim(p_brand), '\s+', ' ', 'g'), regexp_replace(btrim(p_model), '\s+', ' ', 'g'), actor)
      returning * into updated;
  else
    select * into previous from public.vehicles where id = p_id for update;
    if not found then raise exception 'Vehicle not found' using errcode = 'P0002'; end if;
    if previous.updated_at is distinct from p_expected_updated_at then raise exception 'Vehicle changed' using errcode = '40001'; end if;
    if previous.archived_at is not null then raise exception 'Restore vehicle before editing' using errcode = '23514'; end if;
    update public.vehicles set brand = regexp_replace(btrim(p_brand), '\s+', ' ', 'g'),
      model = regexp_replace(btrim(p_model), '\s+', ' ', 'g'), updated_at = clock_timestamp()
      where id = p_id returning * into updated;
  end if;
  insert into public.inventory_events(vehicle_id, actor_id, action, changes)
    values (updated.id, actor, case when p_id is null then 'vehicle_created' else 'vehicle_updated' end,
      jsonb_build_object('before', to_jsonb(previous), 'after', to_jsonb(updated)));
  return updated.id;
end;
$$;

create function private.set_vehicle_archived(p_id uuid, p_archived boolean, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid; previous public.vehicles;
begin
  actor := private.require_admin();
  select * into previous from public.vehicles where id = p_id for update;
  if not found then raise exception 'Vehicle not found' using errcode = 'P0002'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then raise exception 'Vehicle changed' using errcode = '40001'; end if;
  if p_archived is null then raise exception 'Archive state required' using errcode = '23514'; end if;
  if p_archived and exists(select 1 from public.inventory_units where vehicle_id = p_id and status = 'available') then
    raise exception 'Vehicle has available units' using errcode = '23514';
  end if;
  update public.vehicles set archived_at = case when p_archived then clock_timestamp() else null end,
    updated_at = clock_timestamp() where id = p_id;
  insert into public.inventory_events(vehicle_id, actor_id, action, changes)
    values (p_id, actor, case when p_archived then 'vehicle_archived' else 'vehicle_restored' end,
      jsonb_build_object('archived', p_archived));
end;
$$;

create function private.save_inventory_unit(p_id uuid, p_vehicle_id uuid, p_internal_code text,
  p_model_year smallint, p_version text, p_transmission text, p_mileage_km integer,
  p_listed_price numeric, p_currency text, p_status text, p_received_at date, p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; parent public.vehicles; previous public.inventory_units; updated public.inventory_units;
begin
  actor := private.require_admin();
  -- Todas las escrituras de stock bloquean primero su ficha: serializa contra la baja.
  select * into parent from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'Vehicle not found' using errcode = 'P0002'; end if;
  if parent.archived_at is not null then raise exception 'Vehicle archived' using errcode = '23514'; end if;
  if p_status is null or p_status not in ('available', 'withdrawn') then raise exception 'Sales are a separate operation' using errcode = '23514'; end if;
  if p_listed_price is not null and p_listed_price <> round(p_listed_price, 2) then raise exception 'Only two decimal places' using errcode = '23514'; end if;
  if p_id is null then
    insert into public.inventory_units(vehicle_id, internal_code, model_year, version, transmission, mileage_km, listed_price, currency, status, received_at)
      values (p_vehicle_id, upper(btrim(p_internal_code)), p_model_year, nullif(btrim(p_version), ''), nullif(btrim(p_transmission), ''),
        p_mileage_km, p_listed_price, p_currency, p_status, p_received_at) returning * into updated;
  else
    select * into previous from public.inventory_units where id = p_id and vehicle_id = p_vehicle_id for update;
    if not found then raise exception 'Unit not found' using errcode = 'P0002'; end if;
    if previous.updated_at is distinct from p_expected_updated_at then raise exception 'Unit changed' using errcode = '40001'; end if;
    if previous.status = 'sold' then raise exception 'Sold unit is immutable here' using errcode = '23514'; end if;
    update public.inventory_units set internal_code = upper(btrim(p_internal_code)), model_year = p_model_year,
      version = nullif(btrim(p_version), ''), transmission = nullif(btrim(p_transmission), ''), mileage_km = p_mileage_km,
      listed_price = p_listed_price, currency = p_currency, status = p_status, received_at = p_received_at,
      updated_at = clock_timestamp() where id = p_id returning * into updated;
  end if;
  insert into public.inventory_events(vehicle_id, unit_id, actor_id, action, changes)
    values (p_vehicle_id, updated.id, actor, case when p_id is null then 'unit_created' else 'unit_updated' end,
      jsonb_build_object('before', to_jsonb(previous), 'after', to_jsonb(updated)));
  return updated.id;
end;
$$;

create function public.save_vehicle(p_id uuid, p_brand text, p_model text, p_expected_updated_at timestamptz)
returns uuid language sql security invoker set search_path = '' as $$ select private.save_vehicle(p_id, p_brand, p_model, p_expected_updated_at); $$;
create function public.set_vehicle_archived(p_id uuid, p_archived boolean, p_expected_updated_at timestamptz)
returns void language sql security invoker set search_path = '' as $$ select private.set_vehicle_archived(p_id, p_archived, p_expected_updated_at); $$;
create function public.save_inventory_unit(p_id uuid, p_vehicle_id uuid, p_internal_code text,
  p_model_year smallint, p_version text, p_transmission text, p_mileage_km integer,
  p_listed_price numeric, p_currency text, p_status text, p_received_at date, p_expected_updated_at timestamptz)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_inventory_unit(p_id, p_vehicle_id, p_internal_code, p_model_year, p_version,
    p_transmission, p_mileage_km, p_listed_price, p_currency, p_status, p_received_at, p_expected_updated_at);
$$;

revoke all on function private.save_vehicle(uuid,text,text,timestamptz), public.save_vehicle(uuid,text,text,timestamptz),
  private.set_vehicle_archived(uuid,boolean,timestamptz), public.set_vehicle_archived(uuid,boolean,timestamptz),
  private.save_inventory_unit(uuid,uuid,text,smallint,text,text,integer,numeric,text,text,date,timestamptz),
  public.save_inventory_unit(uuid,uuid,text,smallint,text,text,integer,numeric,text,text,date,timestamptz) from public, anon;
grant execute on function private.save_vehicle(uuid,text,text,timestamptz), public.save_vehicle(uuid,text,text,timestamptz),
  private.set_vehicle_archived(uuid,boolean,timestamptz), public.set_vehicle_archived(uuid,boolean,timestamptz),
  private.save_inventory_unit(uuid,uuid,text,smallint,text,text,integer,numeric,text,text,date,timestamptz),
  public.save_inventory_unit(uuid,uuid,text,smallint,text,text,integer,numeric,text,text,date,timestamptz) to authenticated;
commit;
