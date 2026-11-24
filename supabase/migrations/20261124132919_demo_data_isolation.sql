begin;
alter table public.vehicles add column source text not null default 'real' check(source in ('real','demo'));
create index vehicles_source on public.vehicles(source);
create or replace view public.vehicle_catalog with (security_invoker=true) as
 select v.id,v.brand,v.model,v.search_name,v.archived_at,v.updated_at,count(u.id)::integer as units_count,
 count(u.id) filter(where u.status='available')::integer as available_count,v.source
 from public.vehicles v left join public.inventory_units u on u.vehicle_id=v.id group by v.id;
drop function public.search_vehicle_catalog_range(text,text,boolean,smallint,smallint,text,text,numeric,numeric);
create function public.search_vehicle_catalog_range(p_query text, p_stock text, p_archived boolean, p_year_min smallint, p_year_max smallint,
  p_transmission text, p_currency text, p_min_price numeric, p_max_price numeric, p_source text default 'real')
returns table(id uuid, brand text, model text, archived_at timestamptz, updated_at timestamptz,
  units_count integer, available_count integer, matching_units integer)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.brand, c.model, c.archived_at, c.updated_at, c.units_count, c.available_count, m.n::integer
  from public.vehicle_catalog c
  cross join lateral (
    select count(*) as n from public.inventory_units u
    where u.vehicle_id = c.id
      and (p_year_min is null or u.model_year >= p_year_min)
      and (p_year_max is null or u.model_year <= p_year_max)
      and (coalesce(p_transmission, '') = '' or u.transmission_kind = p_transmission)
      and (coalesce(p_stock, '') <> 'available' or u.status = 'available')
      and (coalesce(p_currency, '') = '' or u.currency = p_currency)
      and (p_min_price is null or u.listed_price >= p_min_price)
      and (p_max_price is null or u.listed_price <= p_max_price)
  ) m
  where c.source = p_source and p_source in ('real','demo')
    and (c.archived_at is not null) = coalesce(p_archived, false)
    and (coalesce(p_query, '') = '' or strpos(c.search_name, lower(btrim(p_query))) > 0)
    and (coalesce(p_stock, '') <> 'available' or c.available_count > 0)
    and (coalesce(p_stock, '') <> 'empty' or c.available_count = 0)
    and (coalesce(p_currency, '') = '' or p_currency in ('ARS', 'USD'))
    and ((p_min_price is null and p_max_price is null) or p_currency in ('ARS', 'USD'))
    and (p_min_price is null or (p_min_price between 0 and 999999999999.99 and round(p_min_price,2) = p_min_price))
    and (p_max_price is null or (p_max_price between 0 and 999999999999.99 and round(p_max_price,2) = p_max_price))
    and (p_min_price is null or p_max_price is null or p_min_price <= p_max_price)
    and (p_year_min is null or p_year_min between 1000 and 9999)
    and (p_year_max is null or p_year_max between 1000 and 9999)
    and (p_year_min is null or p_year_max is null or p_year_min <= p_year_max)
    and ((p_year_min is null and p_year_max is null and coalesce(p_transmission, '') = '' and coalesce(p_currency, '') = '' and p_min_price is null and p_max_price is null) or m.n > 0);
$$;
revoke all on function public.search_vehicle_catalog_range(text,text,boolean,smallint,smallint,text,text,numeric,numeric,text) from public, anon;
grant execute on function public.search_vehicle_catalog_range(text,text,boolean,smallint,smallint,text,text,numeric,numeric,text) to authenticated;
create function public.inventory_filter_years_for_source(p_source text)
returns table(model_year smallint) language sql stable security invoker set search_path='' as $$
 select distinct u.model_year from public.inventory_units u join public.vehicles v on v.id=u.vehicle_id
 where v.source=p_source and p_source in ('real','demo') and u.model_year is not null order by u.model_year;
$$;
revoke all on function public.inventory_filter_years_for_source(text) from public,anon;
grant execute on function public.inventory_filter_years_for_source(text) to authenticated;

create view public.customer_directory_by_source with (security_invoker=true) as
 select c.id,c.full_name,c.phone_e164,c.created_at,c.updated_at,l.source,count(l.id)::integer as inquiry_count,
 max(l.created_at) as last_inquiry_at from public.customers c join public.leads l on l.customer_id=c.id group by c.id,l.source;
revoke all on public.customer_directory_by_source from public,anon;
grant select on public.customer_directory_by_source to authenticated;

create function private.list_pending_leads_for_source(p_source text)
returns table(id uuid,reference_number integer,waiting_since timestamptz,assignment_state text)
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_crm_actor();
 if p_source is null or p_source not in ('demo','whatsapp_bot') then raise exception 'Invalid source' using errcode='22023'; end if;
 return query select l.id,l.reference_number,l.waiting_since,'Sin asignar'::text from public.leads l
 where l.source=p_source and l.assigned_to is null and l.closed_at is null order by l.waiting_since,l.id;
end $$;
create function public.list_pending_leads_for_source(p_source text)
returns table(id uuid,reference_number integer,waiting_since timestamptz,assignment_state text)
language sql security invoker set search_path='' as $$ select * from private.list_pending_leads_for_source(p_source); $$;
revoke all on function private.list_pending_leads_for_source(text),public.list_pending_leads_for_source(text) from public,anon;
grant execute on function private.list_pending_leads_for_source(text),public.list_pending_leads_for_source(text) to authenticated;

-- Alta/edición administrativa conserva el conjunto; no reclasifica registros existentes.
create function private.save_vehicle_for_source(p_id uuid,p_brand text,p_model text,p_expected_updated_at timestamptz,p_source text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; previous public.vehicles; updated public.vehicles;
begin
 actor:=private.require_admin();
 if p_source is null or p_source not in ('real','demo') then raise exception 'Invalid source' using errcode='22023'; end if;
 if p_id is null then
  insert into public.vehicles(brand,model,created_by,source)
   values(regexp_replace(btrim(p_brand),'\s+',' ','g'),regexp_replace(btrim(p_model),'\s+',' ','g'),actor,p_source) returning * into updated;
 else
  select * into previous from public.vehicles where id=p_id and source=p_source for update;
  if not found then raise exception 'Vehicle unavailable' using errcode='P0002'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then raise exception 'Vehicle changed' using errcode='40001'; end if;
  if previous.archived_at is not null then raise exception 'Restore vehicle first' using errcode='23514'; end if;
  update public.vehicles set brand=regexp_replace(btrim(p_brand),'\s+',' ','g'),model=regexp_replace(btrim(p_model),'\s+',' ','g'),updated_at=clock_timestamp()
   where id=p_id returning * into updated;
 end if;
 insert into public.inventory_events(vehicle_id,actor_id,action,changes) values(updated.id,actor,case when p_id is null then 'vehicle_created' else 'vehicle_updated' end,
  jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(updated)));
 return updated.id;
end $$;
create function public.save_vehicle_for_source(p_id uuid,p_brand text,p_model text,p_expected_updated_at timestamptz,p_source text)
returns uuid language sql security invoker set search_path='' as $$ select private.save_vehicle_for_source(p_id,p_brand,p_model,p_expected_updated_at,p_source); $$;
revoke all on function private.save_vehicle_for_source(uuid,text,text,timestamptz,text),public.save_vehicle_for_source(uuid,text,text,timestamptz,text) from public,anon;
grant execute on function private.save_vehicle_for_source(uuid,text,text,timestamptz,text),public.save_vehicle_for_source(uuid,text,text,timestamptz,text) to authenticated;
commit;
