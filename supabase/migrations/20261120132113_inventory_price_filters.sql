-- Filtro de precios en moneda original. No modifica importes ni convierte monedas.
begin;
create index inventory_units_vehicle_price on public.inventory_units(vehicle_id, currency, listed_price);

-- Se conserva la firma de cinco argumentos para los clientes anteriores.
create function public.search_vehicle_catalog(p_query text, p_stock text, p_archived boolean, p_year smallint,
  p_transmission text, p_currency text, p_min_price numeric, p_max_price numeric)
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
      and (coalesce(p_currency, '') = '' or u.currency = p_currency)
      and (p_min_price is null or u.listed_price >= p_min_price)
      and (p_max_price is null or u.listed_price <= p_max_price)
  ) m
  where (c.archived_at is not null) = coalesce(p_archived, false)
    and (coalesce(p_query, '') = '' or strpos(c.search_name, lower(btrim(p_query))) > 0)
    and (coalesce(p_stock, '') <> 'available' or c.available_count > 0)
    and (coalesce(p_stock, '') <> 'empty' or c.available_count = 0)
    and (coalesce(p_currency, '') = '' or p_currency in ('ARS', 'USD'))
    and ((p_min_price is null and p_max_price is null) or p_currency in ('ARS', 'USD'))
    and (p_min_price is null or (p_min_price between 0 and 999999999999.99 and round(p_min_price,2) = p_min_price))
    and (p_max_price is null or (p_max_price between 0 and 999999999999.99 and round(p_max_price,2) = p_max_price))
    and (p_min_price is null or p_max_price is null or p_min_price <= p_max_price)
    and ((p_year is null and coalesce(p_transmission, '') = '' and coalesce(p_currency, '') = '' and p_min_price is null and p_max_price is null) or m.n > 0);
$$;
revoke all on function public.search_vehicle_catalog(text,text,boolean,smallint,text,text,numeric,numeric) from public, anon;
grant execute on function public.search_vehicle_catalog(text,text,boolean,smallint,text,text,numeric,numeric) to authenticated;
commit;
