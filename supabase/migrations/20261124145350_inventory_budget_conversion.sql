begin;

-- Sólo lectura. Un precio original por unidad; la tasa la aporta el servidor.
-- Compartido por catálogo y ficha para contar/filtrar antes de paginar.
create function public.search_inventory_units_budget(
  p_source text, p_vehicle uuid, p_year_min smallint, p_year_max smallint,
  p_transmission text, p_stock text, p_currency text,
  p_min_price numeric, p_max_price numeric, p_rate numeric)
returns table(id uuid, vehicle_id uuid, internal_code text, model_year smallint,
  version text, transmission text, mileage_km integer, listed_price numeric,
  currency text, status text, received_at date, updated_at timestamptz,
  created_at timestamptz, equivalent_price numeric)
language sql stable security invoker set search_path = '' as $$
  select u.id,u.vehicle_id,u.internal_code,u.model_year,u.version,u.transmission,
    u.mileage_km,u.listed_price,u.currency,u.status,u.received_at,u.updated_at,u.created_at,e.price
  from public.inventory_units u join public.vehicles v on v.id=u.vehicle_id
  cross join lateral (select case
    when p_currency is null then null
    when u.currency=p_currency then u.listed_price
    when p_currency='ARS' and u.currency='USD' then u.listed_price*p_rate
    when p_currency='USD' and u.currency='ARS' then u.listed_price/nullif(p_rate,0)
    end as price) e
  where v.source=p_source and p_source in ('real','demo')
    and (p_vehicle is null or u.vehicle_id=p_vehicle)
    and (p_year_min is null or (p_year_min between 1000 and 9999 and u.model_year>=p_year_min))
    and (p_year_max is null or (p_year_max between 1000 and 9999 and u.model_year<=p_year_max))
    and (p_year_min is null or p_year_max is null or p_year_min<=p_year_max)
    and (coalesce(p_transmission,'')='' or u.transmission_kind=p_transmission)
    and (coalesce(p_stock,'')<>'available' or u.status='available')
    and (p_currency is null or (p_currency in ('ARS','USD') and p_rate>0 and p_rate<'Infinity'::numeric and e.price is not null))
    and ((p_min_price is null and p_max_price is null) or p_currency in ('ARS','USD'))
    and (p_min_price is null or (p_min_price between 0 and 999999999999.99 and round(p_min_price,2)=p_min_price and e.price>=p_min_price))
    and (p_max_price is null or (p_max_price between 0 and 999999999999.99 and round(p_max_price,2)=p_max_price and e.price<=p_max_price))
    and (p_min_price is null or p_max_price is null or p_min_price<=p_max_price);
$$;
revoke all on function public.search_inventory_units_budget(text,uuid,smallint,smallint,text,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.search_inventory_units_budget(text,uuid,smallint,smallint,text,text,text,numeric,numeric,numeric) to authenticated;

create function public.search_vehicle_catalog_budget(
  p_query text, p_stock text, p_archived boolean, p_year_min smallint, p_year_max smallint,
  p_transmission text, p_currency text, p_min_price numeric, p_max_price numeric,
  p_source text, p_rate numeric)
returns table(id uuid, brand text, model text, archived_at timestamptz, updated_at timestamptz,
  units_count integer, available_count integer, matching_units integer)
language sql stable security invoker set search_path = '' as $$
  select c.id,c.brand,c.model,c.archived_at,c.updated_at,c.units_count,c.available_count,coalesce(m.n,0)::integer
  from public.vehicle_catalog c
  left join (
    select u.vehicle_id,count(*) as n
    from public.search_inventory_units_budget(p_source,null,p_year_min,p_year_max,p_transmission,p_stock,p_currency,p_min_price,p_max_price,p_rate) u
    group by u.vehicle_id
  ) m on m.vehicle_id=c.id
  where c.source=p_source and p_source in ('real','demo')
    and (c.archived_at is not null)=coalesce(p_archived,false)
    and (coalesce(p_query,'')='' or strpos(c.search_name,lower(btrim(p_query)))>0)
    and (coalesce(p_stock,'')<>'available' or c.available_count>0)
    and (coalesce(p_stock,'')<>'empty' or c.available_count=0)
    and ((p_year_min is null and p_year_max is null and coalesce(p_transmission,'')='' and p_currency is null and p_min_price is null and p_max_price is null) or m.n>0);
$$;
revoke all on function public.search_vehicle_catalog_budget(text,text,boolean,smallint,smallint,text,text,numeric,numeric,text,numeric) from public,anon;
grant execute on function public.search_vehicle_catalog_budget(text,text,boolean,smallint,smallint,text,text,numeric,numeric,text,numeric) to authenticated;

commit;
