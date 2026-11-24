do $$ begin
  if (select count(*) from public.leads where source='demo')<>7 then raise exception 'Cantidad de consultas incorrecta'; end if;
  if (select count(*) from public.customers where id in ('d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000005'))<>5 then raise exception 'Cantidad de clientes incorrecta'; end if;
  if (select count(*) from public.leads where source='demo' and assigned_to is null)<>2 then raise exception 'La bandeja no tiene dos clientes nuevos'; end if;
  if (select assigned_to from public.leads where id='e2000001-0000-4000-8000-000000000001') is distinct from (select assigned_to from public.leads where id='e2000005-0000-4000-8000-000000000005') then raise exception 'Lucia no conserva responsable'; end if;
  if (select assigned_to from public.leads where id='e2000002-0000-4000-8000-000000000002') is distinct from (select assigned_to from public.leads where id='e2000004-0000-4000-8000-000000000004') then raise exception 'Mateo no conserva responsable'; end if;
  if (select count(*) from public.lead_notifications n join public.leads l on l.id=n.lead_id where l.source='demo' and n.read_at is null)<>2 then raise exception 'Faltan avisos recurrentes'; end if;
  if (select fingerprint from demo_untouched where entity='vehicles') is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(v) order by v.id)::text,'')) from public.vehicles v)
    or (select fingerprint from demo_untouched where entity='units') is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(u) order by u.id)::text,'')) from public.inventory_units u)
    or (select fingerprint from demo_untouched where entity='profiles') is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from public.profiles p) then raise exception 'Seed modifica inventario o cuentas'; end if;
end $$;
create temp table demo_seed_snapshot as select id,to_jsonb(l) as data from public.leads l where source='demo';
