begin;

-- La evaluación del nodo «Calcular score» es inmutable. El resultado conserva
-- desglose, banda y limitaciones; cada grupo aporta sus puntos una sola vez.
create table public.score_evaluations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  evaluated_through_message_id uuid not null references public.messages(id),
  evaluated_at timestamptz not null default clock_timestamp(),
  extraction_model text,
  result jsonb not null,
  score smallint generated always as ((result->>'total')::smallint) stored not null check (score between 0 and 100),
  rules_version text generated always as (result->>'version_reglas') stored not null,
  rules_snapshot jsonb not null,
  unique (evaluated_through_message_id, rules_version)
);
create index score_evaluations_by_lead on public.score_evaluations (lead_id);

-- Los puntos están en result.desglose; dos citas de una señal no duplican su aporte.
create table public.score_evidence (
  evaluation_id uuid not null references public.score_evaluations(id),
  signal_code text not null,
  quote_index integer not null,
  message_id uuid not null references public.messages(id),
  quoted_text text not null,
  primary key (evaluation_id, signal_code, quote_index)
);

alter table public.score_evaluations enable row level security;
alter table public.score_evidence enable row level security;
create policy score_evaluations_read on public.score_evaluations for select to authenticated
  using (exists (select 1 from public.leads l where l.id = score_evaluations.lead_id));
create policy score_evidence_read on public.score_evidence for select to authenticated
  using (exists (select 1 from public.score_evaluations e where e.id = score_evidence.evaluation_id));

revoke all on public.score_evaluations, public.score_evidence from public, anon, authenticated, service_role;
grant select on public.score_evaluations, public.score_evidence to authenticated, service_role;

-- Sólo el servicio puede invocarla. El único camino de escritura valida la
-- pertenencia y el texto de cada cita antes de confirmar toda la evaluación.
create function public.save_bot_score(
  p_conversation_id uuid, p_message_id uuid, p_evaluation jsonb, p_extraction_model text default null
) returns table (evaluation_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
declare
  snapshot constant jsonb := '{
    "plazo":{"hasta_7_dias":30,"de_8_a_30_dias":20,"de_31_a_90_dias":10,"mas_de_90_dias":0,"sin_definir":0,"ambiguo":0,"no_informado":0},
    "intencion":{"reserva_compra":40,"visita_prueba":30,"propuesta_concreta":20,"consulta_general":0,"no_informada":0},
    "busqueda":{"vehiculo_o_caracteristicas":15,"sin_definir":0},
    "presupuesto":{"importe_finito_no_negativo_moneda_ARS_o_USD_y_alcance_valor_total_o_dinero_a_agregar":15,"incompleto":0},
    "bandas_desde":{"media":30,"alta":60},
    "evidencia":"obligatoria para cada grupo con puntos positivos"
  }';
  signals constant text[] := array['plazo','intencion','busqueda','presupuesto'];
  lead uuid;
  cutoff bigint;
  previous public.score_evaluations;
  saved uuid;
  signal text;
  detail jsonb;
  points integer;
  total integer := 0;
  quote text;
  ordinal integer;
  matches uuid[];
begin
  select c.lead_id, m.history_position into lead, cutoff
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where c.id = p_conversation_id and m.id = p_message_id and m.sender_kind = 'customer';
  if not found then
    raise exception 'Expected an inbound cutoff message of this conversation' using errcode = '22023';
  end if;
  if (p_evaluation->>'version_reglas') is distinct from 'pelucars_score_v1_prototipo'
     or jsonb_typeof(p_evaluation->'desglose') is distinct from 'object'
     or not (p_evaluation->'desglose' ?& signals)
     or (p_evaluation->'desglose') - signals <> '{}'::jsonb
     or jsonb_typeof(p_evaluation->'total') is distinct from 'number'
     or not coalesce((p_evaluation->>'total') ~ '^(100|[1-9]?[0-9])$', false)
     or jsonb_typeof(p_evaluation->'informacion_limitada') is distinct from 'boolean'
     or jsonb_typeof(p_evaluation->'motivos_limitacion') is distinct from 'array' then
    raise exception 'Invalid score version or result' using errcode = '22023';
  end if;

  insert into public.score_evaluations (lead_id, evaluated_through_message_id, extraction_model, result, rules_snapshot)
    values (lead, p_message_id, p_extraction_model, p_evaluation, snapshot)
    on conflict (evaluated_through_message_id, rules_version) do nothing returning id into saved;
  if not found then
    select e.* into strict previous from public.score_evaluations e
      where e.evaluated_through_message_id = p_message_id and e.rules_version = p_evaluation->>'version_reglas';
    if previous.result is distinct from p_evaluation or previous.extraction_model is distinct from p_extraction_model then
      raise exception 'Different score result for the same cutoff and version' using errcode = 'PT409';
    end if;
    return query select previous.id, 'unchanged'::text;
    return;
  end if;

  foreach signal in array signals loop
    detail := p_evaluation->'desglose'->signal;
    if jsonb_typeof(detail->'evidencias') is distinct from 'array'
       or jsonb_typeof(detail->'motivo') is distinct from 'string'
       or jsonb_typeof(detail->'puntos') is distinct from 'number'
       or not exists (select 1 from jsonb_each(snapshot->signal) s where s.value = detail->'puntos') then
      raise exception 'Invalid breakdown for signal %', signal using errcode = '22023';
    end if;
    points := (detail->>'puntos')::integer;
    total := total + points;
    ordinal := 0;
    for quote in select distinct (v #>> '{}') from jsonb_array_elements(detail->'evidencias') q(v)
      where jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '[^[:space:]]' order by 1
    loop
      select array_agg(m.id) into matches from public.messages m
        where m.conversation_id = p_conversation_id and m.sender_kind = 'customer'
          and m.history_position <= cutoff and strpos(m.body, quote) > 0;
      if coalesce(cardinality(matches), 0) <> 1 then
        raise exception 'Missing or ambiguous evidence for signal %', signal using errcode = '22023';
      end if;
      ordinal := ordinal + 1;
      insert into public.score_evidence (evaluation_id, signal_code, quote_index, message_id, quoted_text)
        values (saved, signal, ordinal, matches[1], quote);
    end loop;
    if exists (select 1 from jsonb_array_elements(detail->'evidencias') q(v) where jsonb_typeof(v) <> 'string')
       or (points > 0 and ordinal = 0) then
      raise exception 'Expected textual evidence for signal %', signal using errcode = '22023';
    end if;
  end loop;
  if (p_evaluation->'total') <> to_jsonb(total) or (p_evaluation->>'banda') is distinct from
       (case when total >= (snapshot->'bandas_desde'->>'alta')::integer then 'alta'
             when total >= (snapshot->'bandas_desde'->>'media')::integer then 'media' else 'baja' end) then
    raise exception 'Inconsistent score total or band' using errcode = '22023';
  end if;
  return query select saved, 'applied'::text;
end $$;
revoke all on function public.save_bot_score(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_bot_score(uuid,uuid,jsonb,text) to service_role;

commit;
