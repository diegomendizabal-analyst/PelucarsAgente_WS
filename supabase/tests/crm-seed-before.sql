begin;
create temp table demo_untouched as
select 'vehicles' as entity, md5(coalesce(jsonb_agg(to_jsonb(v) order by v.id)::text,'')) as fingerprint from public.vehicles v
union all select 'units', md5(coalesce(jsonb_agg(to_jsonb(u) order by u.id)::text,'')) from public.inventory_units u
union all select 'profiles', md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from public.profiles p;
