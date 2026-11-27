begin;

-- Preserve incomplete budgets (amount without currency, or currency without amount).
-- Existing ranges keep their meaning. An extracted amount is an upper budget limit.
alter table public.leads drop constraint lead_budget_valid;
alter table public.leads add constraint lead_budget_valid check (
  (budget_min is null or budget_min >= 0) and (budget_max is null or budget_max >= 0)
  and (budget_min is null or budget_max is null or budget_min <= budget_max)
  and (budget_currency is null or budget_currency in ('ARS','USD'))
);
alter table public.leads
  add column budget_scope text check (budget_scope in ('valor_total','dinero_a_agregar')),
  add column trade_in_decision text check (trade_in_decision in ('confirmada','descartada','indecisa','no_informada'));
alter table public.customers add column provider_profile_name text check (length(provider_profile_name) between 1 and 160);
alter table public.lead_interests
  add column requested_brand text check (length(requested_brand) <= 120),
  add column requested_model text check (length(requested_model) <= 120),
  add column characteristics text[] not null default '{}';

-- Name provenance is removed when the team changes the automatically filled name.
create function private.clear_provider_name_origin() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.full_name is distinct from old.full_name
     and new.provider_profile_name is not distinct from old.provider_profile_name then
    new.provider_profile_name := null;
  end if;
  return new;
end $$;
revoke all on function private.clear_provider_name_origin() from public, anon, authenticated;
create trigger customer_name_origin before update on public.customers
  for each row execute function private.clear_provider_name_origin();

create table private.bot_lead_detail_sources (
  lead_id uuid primary key references public.leads(id),
  message_id uuid not null unique references public.messages(id),
  request jsonb not null,
  applied_fields jsonb not null,
  interest_id uuid references public.lead_interests(id),
  applied_interest jsonb
);
revoke all on private.bot_lead_detail_sources from public, anon, authenticated, service_role;
grant select, insert, update on private.bot_lead_detail_sources to service_role;

create function private.bot_commercial_fields(l public.leads) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('budget_min',l.budget_min,'budget_max',l.budget_max,
    'budget_currency',l.budget_currency,'budget_scope',l.budget_scope,
    'trade_in_decision',l.trade_in_decision,'trade_in_details',l.trade_in_details,
    'purchase_timeframe',l.purchase_timeframe,'financing_needed',l.financing_needed);
$$;
revoke all on function private.bot_commercial_fields(public.leads) from public, anon, authenticated;
grant execute on function private.bot_commercial_fields(public.leads) to service_role;

-- Same cutoff/retry contract as save_bot_lead_summary; no routing or assignment.
-- p_extraction is the existing extractor output. Attributes are optional, explicit
-- structured values supplied upstream; this function never parses the summary.
create function public.save_bot_lead_details(
  p_conversation_id uuid, p_message_id uuid, p_extraction jsonb,
  p_attributes jsonb default '{}', p_provider_profile_name text default null
) returns table (lead_id uuid, source_message_id uuid, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare
  l public.leads;
  previous private.bot_lead_detail_sources;
  old_interest public.lead_interests;
  new_interest public.lead_interests;
  position bigint;
  previous_position bigint;
  summary_result record;
  request jsonb;
  desired jsonb;
  key text;
  decision text;
  requested text;
  characteristics text[];
  matches uuid[];
  requested_brand_value text;
  requested_model_value text;
  min_year smallint;
  transmission text;
begin
  if jsonb_typeof(p_extraction) is distinct from 'object'
     or not (p_extraction ?& array['vehiculo_buscado','caracteristicas','presupuesto_importe',
       'presupuesto_moneda','presupuesto_alcance','tiene_usado','decision_entrega_usado',
       'usado_detalle','plazo_compra','necesita_financiacion','resumen_consulta'])
     or jsonb_typeof(p_attributes) is distinct from 'object'
     or p_attributes - array['marca','modelo','anio_minimo','transmision'] <> '{}'::jsonb then
    raise exception 'Invalid extraction or attributes' using errcode = '22023';
  end if;
  foreach key in array array['vehiculo_buscado','presupuesto_moneda','presupuesto_alcance','usado_detalle','plazo_compra'] loop
    if jsonb_typeof(p_extraction->key) not in ('string','null') then
      raise exception 'Expected nullable text: %', key using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(p_extraction->'caracteristicas') is distinct from 'array' then
    raise exception 'Expected characteristics array' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_extraction->'caracteristicas') e(v)
    where jsonb_typeof(v) <> 'string' or length(v #>> '{}') not between 1 and 500)
    or jsonb_array_length(p_extraction->'caracteristicas') > 30 then
    raise exception 'Invalid characteristics' using errcode = '22023';
  end if;
  if jsonb_typeof(p_extraction->'presupuesto_importe') not in ('number','null')
     or jsonb_typeof(p_extraction->'necesita_financiacion') not in ('boolean','null')
     or (p_extraction->>'presupuesto_moneda') not in ('ARS','USD')
     or (p_extraction->>'presupuesto_alcance') not in ('valor_total','dinero_a_agregar') then
    raise exception 'Invalid budget or financing' using errcode = '22023';
  end if;
  if p_extraction->>'presupuesto_importe' is not null and
    ((p_extraction->>'presupuesto_importe')::numeric < 0
     or (p_extraction->>'presupuesto_importe')::numeric > 999999999999.99
     or trunc((p_extraction->>'presupuesto_importe')::numeric,2) <> (p_extraction->>'presupuesto_importe')::numeric) then
    raise exception 'Invalid budget precision or range' using errcode = '22023';
  end if;
  decision := p_extraction->>'decision_entrega_usado';
  if decision is null or decision not in ('confirmada','descartada','indecisa','no_informada')
     or p_extraction->'tiene_usado' is distinct from
       (case decision when 'confirmada' then 'true'::jsonb when 'descartada' then 'false'::jsonb else 'null'::jsonb end) then
    raise exception 'Inconsistent trade-in decision' using errcode = '22023';
  end if;
  foreach key in array array['marca','modelo','transmision'] loop
    if p_attributes ? key and jsonb_typeof(p_attributes->key) not in ('string','null') then
      raise exception 'Invalid search attribute: %', key using errcode = '22023';
    end if;
  end loop;
  if p_attributes->>'anio_minimo' is not null and
    (jsonb_typeof(p_attributes->'anio_minimo') <> 'number' or (p_attributes->>'anio_minimo') !~ '^[1-9][0-9]{3}$') then
    raise exception 'Invalid minimum year' using errcode = '22023';
  end if;
  if p_provider_profile_name is not null and length(btrim(p_provider_profile_name)) not between 1 and 160 then
    raise exception 'Invalid provider profile name' using errcode = '22023';
  end if;
  if jsonb_typeof(p_extraction->'resumen_consulta') is distinct from 'string' then
    raise exception 'Invalid summary' using errcode = '22023';
  end if;

  select lead.* into l from public.leads lead
    join public.conversations c on c.lead_id = lead.id
    join public.messages m on m.conversation_id = c.id
    where c.id = p_conversation_id and m.id = p_message_id and m.sender_kind = 'customer'
    for update of lead;
  if not found then raise exception 'Expected inbound cutoff of this conversation' using errcode = '22023'; end if;
  select m.history_position into strict position from public.messages m where m.id = p_message_id;
  select s.* into previous from private.bot_lead_detail_sources s where s.lead_id = l.id;
  if found then
    select m.history_position into strict previous_position from public.messages m where m.id = previous.message_id;
    if position < previous_position then
      return query select l.id, previous.message_id, 'stale'::text; return;
    end if;
  end if;

  request := jsonb_build_object('extraction',p_extraction,'attributes',p_attributes,'profile_name',p_provider_profile_name);
  if previous.message_id = p_message_id and previous.request is distinct from request then
    raise exception 'Different extraction for the same cutoff' using errcode = 'PT409';
  end if;
  if previous.message_id is not null then
    if private.bot_commercial_fields(l) is distinct from previous.applied_fields then
      raise exception 'Commercial fields have an independent edit' using errcode = 'PT409';
    end if;
  elsif exists (select 1 from jsonb_each(private.bot_commercial_fields(l)) e where e.value <> 'null'::jsonb) then
    raise exception 'Existing commercial fields require reconciliation' using errcode = 'PT409';
  end if;
  if previous.interest_id is not null then
    select i.* into old_interest from public.lead_interests i where i.id = previous.interest_id for update;
    if to_jsonb(old_interest) is distinct from previous.applied_interest then
      raise exception 'Interest has an independent edit' using errcode = 'PT409';
    end if;
  end if;
  if exists (select 1 from public.lead_interests i where i.lead_id = l.id and i.status = 'active'
    and i.id is distinct from previous.interest_id) then
    raise exception 'Existing interests require reconciliation' using errcode = 'PT409';
  end if;

  -- Reuse summary validation, stale protection and manual-edit detection atomically.
  select * into summary_result from public.save_bot_lead_summary(p_conversation_id,p_message_id,p_extraction->>'resumen_consulta');
  if summary_result.outcome = 'stale' then
    return query select l.id, summary_result.source_message_id, 'stale'::text; return;
  end if;
  if previous.message_id = p_message_id then
    return query select l.id, p_message_id, 'unchanged'::text; return;
  end if;

  characteristics := array(select jsonb_array_elements_text(p_extraction->'caracteristicas'));
  requested := case when nullif(btrim(p_extraction->>'vehiculo_buscado'),'') is not null then p_extraction->>'vehiculo_buscado' else nullif(array_to_string(characteristics,' · '),'') end;
  requested_brand_value := nullif(btrim(p_attributes->>'marca'),''); requested_model_value := nullif(btrim(p_attributes->>'modelo'),'');
  min_year := (p_attributes->>'anio_minimo')::smallint;
  transmission := nullif(btrim(p_attributes->>'transmision'),'');
  if requested is null and (requested_brand_value is not null or requested_model_value is not null or min_year is not null or transmission is not null) then
    raise exception 'Structured attributes need original requested text' using errcode = '22023';
  end if;
  -- Exact normalization only. Never fuzzy match or cross demo/real boundaries.
  select array_agg(v.id) into matches from public.vehicles v
    where v.source = case l.source when 'demo' then 'demo' else 'real' end
      and lower(regexp_replace(btrim(v.brand),'\s+',' ','g')) = lower(regexp_replace(requested_brand_value,'\s+',' ','g'))
      and lower(regexp_replace(btrim(v.model),'\s+',' ','g')) = lower(regexp_replace(requested_model_value,'\s+',' ','g'));
  desired := jsonb_build_object('requested_text',requested,'requested_brand',requested_brand_value,'requested_model',requested_model_value,
    'year_min',min_year,'transmission',transmission,'characteristics',to_jsonb(characteristics),
    'vehicle_id',case when cardinality(matches) = 1 then matches[1] else null end);
  if old_interest.id is not null and
    (select jsonb_object_agg(e.key,e.value) from jsonb_each(to_jsonb(old_interest)) e where desired ? e.key) = desired then
    new_interest := old_interest;
  else
    if old_interest.id is not null then
      update public.lead_interests set status = 'replaced', updated_at = clock_timestamp() where id = old_interest.id;
    end if;
    if requested is not null then
      insert into public.lead_interests(lead_id,requested_text,requested_brand,requested_model,year_min,transmission,characteristics,vehicle_id)
        values(l.id,requested,requested_brand_value,requested_model_value,min_year,transmission,characteristics,
          case when cardinality(matches) = 1 then matches[1] else null end) returning * into new_interest;
    end if;
  end if;

  update public.leads set budget_min = null, budget_max = (p_extraction->>'presupuesto_importe')::numeric,
    budget_currency = p_extraction->>'presupuesto_moneda', budget_scope = p_extraction->>'presupuesto_alcance',
    trade_in_decision = decision, trade_in_details = p_extraction->>'usado_detalle',
    purchase_timeframe = p_extraction->>'plazo_compra', financing_needed = (p_extraction->>'necesita_financiacion')::boolean,
    updated_at = clock_timestamp() where id = l.id returning * into l;
  -- Row locking by UPDATE handles simultaneous opportunities for the same customer.
  if p_provider_profile_name is not null then
    update public.customers set full_name = btrim(p_provider_profile_name), provider_profile_name = btrim(p_provider_profile_name),
      updated_at = clock_timestamp() where id = l.customer_id and nullif(btrim(full_name),'') is null;
  end if;
  insert into private.bot_lead_detail_sources(lead_id,message_id,request,applied_fields,interest_id,applied_interest)
    values(l.id,p_message_id,request,private.bot_commercial_fields(l),new_interest.id,
      case when new_interest.id is not null then to_jsonb(new_interest) end)
    on conflict on constraint bot_lead_detail_sources_pkey do update set message_id = excluded.message_id,
      request = excluded.request, applied_fields = excluded.applied_fields,
      interest_id = excluded.interest_id, applied_interest = excluded.applied_interest;
  return query select l.id, p_message_id, 'applied'::text;
end $$;
revoke all on function public.save_bot_lead_details(uuid,uuid,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_bot_lead_details(uuid,uuid,jsonb,jsonb,text) to service_role;
commit;
