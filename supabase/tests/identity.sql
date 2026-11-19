-- Pruebas transaccionales: no dejan usuarios ni perfiles al finalizar.
-- Ejecutar con rol de administración de base, después de la migración identity.
begin;
insert into auth.users(id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'rls-admin@pelucars.example', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'rls-seller@pelucars.example', '{"role":"admin"}'),
  ('33333333-3333-4333-8333-333333333333', 'rls-other@pelucars.example', '{}'),
  ('44444444-4444-4444-8444-444444444444', 'rls-new@pelucars.example', '{}');
insert into public.profiles(id, full_name, role, is_enabled, contact_phone, contact_email) values
  ('11111111-1111-4111-8111-111111111111', 'Prueba Admin', 'admin', true, null, null),
  ('22222222-2222-4222-8222-222222222222', 'Prueba Vendedor', 'seller', true, '+5491112345678', 'contacto-vendedor@pelucars.example'),
  ('33333333-3333-4333-8333-333333333333', 'Prueba Otro', 'seller', true, '+5491112345679', 'contacto-otro@pelucars.example');

set local role anon;
do $$ begin
  begin perform 1 from public.profiles; raise exception 'Anon leyó perfiles';
    exception when insufficient_privilege then null; end;
  begin perform public.list_managed_users(); raise exception 'Anon llamó listado administrativo';
    exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Vendedor ve otros perfiles'; end if;
  if (select role from public.profiles) <> 'seller' then raise exception 'Metadata alteró el rol'; end if;
  begin perform public.list_managed_users(); raise exception 'Vendedor listó datos privados';
    exception when insufficient_privilege then null; end;
  begin update public.profiles set role = 'admin' where id = auth.uid(); raise exception 'Vendedor se promovió';
    exception when insufficient_privilege then null; end;
  begin perform public.bootstrap_account(auth.uid(), 'Elevación', 'admin', null); raise exception 'Bootstrap público';
    exception when insufficient_privilege then null; end;
  begin perform public.register_seller('33333333-3333-4333-8333-333333333333', 'Alta indebida', null, null); raise exception 'Vendedor creó perfil';
    exception when insufficient_privilege then null; end;
  begin perform public.update_seller(auth.uid(), 'Cambio indebido', null, true, null); raise exception 'Vendedor editó perfil';
    exception when insufficient_privilege then null; end;
  if exists(select 1 from public.user_admin_events) then raise exception 'Vendedor ve auditoría'; end if;
end $$;
reset role;

-- Mantiene la misma identidad/JWT del vendedor después de deshabilitarlo.
update public.profiles set is_enabled = false where id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.profiles) then raise exception 'Cuenta deshabilitada conserva lectura'; end if;
  begin perform public.list_managed_users(); raise exception 'Cuenta deshabilitada administra';
    exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$ begin
  if (select count(*) from public.list_managed_users() where id in
    ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')) <> 3
    then raise exception 'Admin no puede listar equipo'; end if;
  begin perform public.register_seller('44444444-4444-4444-8444-444444444444', 'Nuevo vendedor', null, 'contacto@pelucars.example'); raise exception 'Alta sin teléfono';
    exception when check_violation then null; end;
  begin perform public.register_seller('44444444-4444-4444-8444-444444444444', 'Nuevo vendedor', '+5491112345678', null); raise exception 'Alta sin correo';
    exception when check_violation then null; end;
  perform public.register_seller('44444444-4444-4444-8444-444444444444', 'Nuevo vendedor', '+5491112345678', 'contacto@pelucars.example');
  if not exists(select 1 from public.list_managed_users() where id = '44444444-4444-4444-8444-444444444444'
    and contact_email = 'contacto@pelucars.example' and email = 'rls-new@pelucars.example') then raise exception 'Alta no conserva contacto separado'; end if;
  begin perform public.update_seller('22222222-2222-4222-8222-222222222222', 'Vendedor', null, true, 'contacto@pelucars.example'); raise exception 'Aceptó teléfono vacío';
    exception when check_violation then null; end;
  begin perform public.update_seller('22222222-2222-4222-8222-222222222222', 'Vendedor', '+5491112345678', true, '   '); raise exception 'Aceptó correo vacío';
    exception when check_violation then null; end;
  begin perform public.update_seller('22222222-2222-4222-8222-222222222222', 'Vendedor', '+5491112345678', true, 'invalido'); raise exception 'Aceptó correo inválido';
    exception when check_violation then null; end;
  perform public.update_seller('22222222-2222-4222-8222-222222222222', 'Vendedor rehabilitado', '+5491112345678', true, 'nuevo-contacto@pelucars.example');
  if not exists (select 1 from public.user_admin_events where subject_user_id = '22222222-2222-4222-8222-222222222222'
    and actor_id = auth.uid() and action = 'enabled') then raise exception 'Falta auditoría'; end if;
  if not exists(select 1 from public.list_managed_users() where id = '22222222-2222-4222-8222-222222222222'
    and contact_email = 'nuevo-contacto@pelucars.example' and email = 'rls-seller@pelucars.example') then raise exception 'Contacto modificó Auth o no fue guardado'; end if;
  if not exists(select 1 from public.user_admin_events where subject_user_id = '22222222-2222-4222-8222-222222222222'
    and changed_fields #>> '{after,contact_email}' = 'nuevo-contacto@pelucars.example') then raise exception 'Contacto sin auditoría'; end if;
  begin perform public.update_seller(auth.uid(), 'Admin', null, false, null); raise exception 'Se deshabilitó admin por API de vendedores';
    exception when no_data_found then null; end;
end $$;
reset role;
rollback;
select 'OK: permisos, contacto obligatorio en alta/edición, Auth independiente y auditoría; datos de prueba revertidos' as result;
