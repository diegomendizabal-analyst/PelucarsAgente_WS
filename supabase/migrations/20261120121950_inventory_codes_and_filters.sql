-- Códigos internos automáticos; conserva identificadores y datos existentes.
begin;
create sequence private.inventory_unit_code_seq;
select setval('private.inventory_unit_code_seq', coalesce(max(substring(upper(btrim(internal_code)) from 5)::bigint), 0) + 1, false)
  from public.inventory_units where upper(btrim(internal_code)) ~ '^PEL-[0-9]{1,18}$';
revoke all on sequence private.inventory_unit_code_seq from public, anon, authenticated;
grant usage on sequence private.inventory_unit_code_seq to service_role;
alter table public.inventory_units alter column internal_code set default ('PEL-' || nextval('private.inventory_unit_code_seq')::text);

-- No se reescriben textos de transmisión históricos. Categorías para consulta.
alter table public.inventory_units add column transmission_kind text generated always as (
  case
    when transmission is null then null
    when lower(translate(btrim(transmission), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) in ('automatica', 'automatico', 'automatic', 'cvt', 'dsg') then 'automatic'
    when lower(translate(btrim(transmission), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) in ('manual', 'mecanica', 'mecanico') then 'manual'
    else 'other'
  end
) stored;
create index inventory_units_characteristics on public.inventory_units(model_year, transmission_kind, vehicle_id);

create function public.search_vehicle_catalog(p_query text, p_stock text, p_archived boolean, p_year smallint, p_transmission text)
returns table(id uuid, brand text, model text, archived_at timestamptz, updated_at timestamptz,
  units_count integer, available_count integer, matching_units integer)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.brand, c.model, c.archived_at, c.updated_at, c.units_count, c.available_count, m.n::integer
  from public.vehicle_catalog c
  cross join lateral (
    select count(*) as n from public.inventory_units u
    where u.vehicle_id = c.id
      and (p_year is null or u.model_year = p_year)
      and (coalesce(p_transmission, '') = '' or u.transmission_kind = p_transmission)
      and (coalesce(p_stock, '') <> 'available' or u.status = 'available')
  ) m
  where (c.archived_at is not null) = coalesce(p_archived, false)
    and (coalesce(p_query, '') = '' or strpos(c.search_name, lower(btrim(p_query))) > 0)
    and (coalesce(p_stock, '') <> 'available' or c.available_count > 0)
    and (coalesce(p_stock, '') <> 'empty' or c.available_count = 0)
    and ((p_year is null and coalesce(p_transmission, '') = '') or m.n > 0);
$$;
create function public.inventory_filter_years()
returns table(model_year smallint) language sql stable security invoker set search_path = '' as $$
  select distinct u.model_year from public.inventory_units u where u.model_year is not null order by u.model_year desc;
$$;
revoke all on function public.search_vehicle_catalog(text,text,boolean,smallint,text), public.inventory_filter_years() from public, anon;
grant execute on function public.search_vehicle_catalog(text,text,boolean,smallint,text), public.inventory_filter_years() to authenticated;

-- La implementación de save_inventory_unit se reemplaza abajo conservando su
-- firma para clientes anteriores. p_internal_code ya no altera la identidad.

create or replace function private.save_inventory_unit(p_id uuid, p_vehicle_id uuid, p_internal_code text,
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
    insert into public.inventory_units(vehicle_id, model_year, version, transmission, mileage_km, listed_price, currency, status, received_at)
      values (p_vehicle_id, p_model_year, nullif(btrim(p_version), ''), nullif(btrim(p_transmission), ''),
        p_mileage_km, p_listed_price, p_currency, p_status, p_received_at) returning * into updated;
  else
    select * into previous from public.inventory_units where id = p_id and vehicle_id = p_vehicle_id for update;
    if not found then raise exception 'Unit not found' using errcode = 'P0002'; end if;
    if previous.updated_at is distinct from p_expected_updated_at then raise exception 'Unit changed' using errcode = '40001'; end if;
    if previous.status = 'sold' then raise exception 'Sold unit is immutable here' using errcode = '23514'; end if;
    update public.inventory_units set model_year = p_model_year,
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


commit;
