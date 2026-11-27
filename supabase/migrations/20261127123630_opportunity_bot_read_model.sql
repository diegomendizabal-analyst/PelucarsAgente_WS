begin;

-- The cutoff message determines freshness. evaluated_at is only a storage date.
create function public.get_current_lead_score(p_lead_id uuid, p_rules_version text)
returns table (id uuid, score smallint, rules_version text, evaluated_at timestamptz,
  cutoff_message_id uuid, cutoff_position bigint, cutoff_at timestamptz, result jsonb, evidence jsonb)
language sql stable security invoker set search_path = '' as $$
  select e.id,e.score,e.rules_version,e.evaluated_at,m.id,m.history_position,m.created_at,e.result,
    coalesce((select jsonb_agg(jsonb_build_object('signal_code',q.signal_code,'message_id',q.message_id,
      'quoted_text',q.quoted_text) order by q.signal_code,q.quote_index)
      from public.score_evidence q where q.evaluation_id = e.id),'[]'::jsonb)
  from public.score_evaluations e join public.messages m on m.id = e.evaluated_through_message_id
  where e.lead_id = p_lead_id and e.rules_version = p_rules_version
  order by m.history_position desc, e.id limit 1;
$$;
revoke all on function public.get_current_lead_score(uuid,text) from public, anon, authenticated;
grant execute on function public.get_current_lead_score(uuid,text) to authenticated;

-- Stable, pageable read model. Unsent bot messages retain their operational state;
-- they must not be presented as delivered dialogue. RLS applies to every relation.
create view public.lead_messages with (security_invoker = true) as
  select c.lead_id,m.id,m.conversation_id,m.sender_kind,m.body,m.history_position,
    m.send_state,m.created_at,m.sent_at,c.provider,c.bot_state
  from public.messages m join public.conversations c on c.id = m.conversation_id;
revoke all on public.lead_messages from public, anon, authenticated;
grant select on public.lead_messages to authenticated;

-- Compare all three criteria on the SAME available unit. No currency conversion,
-- trade-in valuation, fuzzy transmission matching or assertions about other traits.
create function public.get_lead_unit_matches(p_lead_id uuid, p_interest_ids uuid[])
returns table (interest_id uuid, available_count bigint, matching_count bigint, unknown_count bigint)
language sql stable security invoker set search_path = '' as $$
  select i.id,count(u.id),count(u.id) filter(where comparison.matches is true),
    count(u.id) filter(where comparison.matches is null)
  from public.lead_interests i join public.leads l on l.id = i.lead_id
  join public.vehicles v on v.id = i.vehicle_id
    and v.source = case l.source when 'demo' then 'demo' else 'real' end
  left join public.inventory_units u on u.vehicle_id = v.id and u.status = 'available'
  cross join lateral (select case
    when (i.year_min is not null and u.model_year < i.year_min)
      or (i.year_max is not null and u.model_year > i.year_max)
      or (i.transmission is not null and lower(btrim(u.transmission)) <> lower(btrim(i.transmission))) then false
    when l.budget_scope = 'valor_total' and u.currency = l.budget_currency
      and (u.listed_price > l.budget_max or u.listed_price < l.budget_min) then false
    when i.year_min is null or i.transmission is null or u.model_year is null or u.transmission is null
      or l.budget_scope is distinct from 'valor_total' or l.budget_max is null
      or l.budget_currency is null or u.listed_price is null or u.currency is distinct from l.budget_currency then null
    else true end as matches) comparison
  where i.lead_id = p_lead_id and i.id = any(p_interest_ids) and cardinality(p_interest_ids) <= 20
  group by i.id;
$$;
revoke all on function public.get_lead_unit_matches(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.get_lead_unit_matches(uuid,uuid[]) to authenticated;
commit;
