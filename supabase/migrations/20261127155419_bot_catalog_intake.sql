begin;

-- Bot intake has no human author. Preserve admin attribution; never select an
-- arbitrary administrator or create a service account to satisfy the old FK.
alter table public.vehicles alter column created_by drop not null;
alter table public.vehicles add constraint vehicles_creator_provenance
  check(created_by is not null or origin='intake');
alter table public.inventory_events alter column actor_id drop not null;
alter table public.inventory_events add constraint inventory_event_actor_provenance
  check(actor_id is not null or coalesce(action='vehicle_created' and unit_id is null and changes->>'actor'='bot',false));

create table private.bot_catalog_requests (
  message_id uuid primary key references public.messages(id),
  lead_id uuid not null references public.leads(id),
  request jsonb not null,
  vehicle_id uuid references public.vehicles(id),
  catalog_outcome text not null check(catalog_outcome in ('created','reused','unresolved','archived')),
  recorded_at timestamptz not null default clock_timestamp()
);
alter table private.bot_catalog_requests enable row level security;
revoke all on private.bot_catalog_requests from public,anon,authenticated,service_role;

-- Literal lexical coverage only; not a fuzzy matcher, alias resolver or model
-- classifier. Punctuation boundaries prevent "Ford" matching "Oxford".
create function private.catalog_literal_contains(p_text text,p_value text) returns boolean
language sql immutable security invoker set search_path='' as $$
  select nullif(regexp_replace(lower(p_value),'[^[:alnum:]]+',' ','g'),'') is not null
    and strpos(' '||regexp_replace(lower(p_text),'[^[:alnum:]]+',' ','g')||' ',
      ' '||regexp_replace(lower(p_value),'[^[:alnum:]]+',' ','g')||' ')>0;
$$;
revoke all on function private.catalog_literal_contains(text,text) from public,anon,authenticated,service_role;

-- Opt-in atomic entry point. The previous RPC remains read/link-only for catalogue
-- compatibility; callers must not first save details and later request creation.
create function public.save_bot_lead_details_with_catalog(
  p_conversation_id uuid,p_message_id uuid,p_extraction jsonb,
  p_attributes jsonb default '{}',p_provider_profile_name text default null,
  p_catalog_resolution jsonb default '{"status":"insufficient"}'
) returns table(lead_id uuid,source_message_id uuid,outcome text,vehicle_id uuid,catalog_outcome text)
language plpgsql security definer set search_path='' as $$
declare
  previous private.bot_catalog_requests;
  c public.conversations; l public.leads; incoming public.messages;
  saved record; source_record private.bot_lead_detail_sources; interest public.lead_interests;
  v public.vehicles; request jsonb; resolution text; quote text; evidence uuid;
  brand_value text; model_value text; catalog_source text; chosen uuid; result text;
begin
  select * into strict c from public.conversations where id=p_conversation_id;
  select * into incoming from public.messages where id=p_message_id and conversation_id=c.id and sender_kind='customer';
  if not found then raise exception 'Expected inbound cutoff' using errcode='22023'; end if;
  request:=jsonb_build_object('conversation_id',p_conversation_id,'extraction',p_extraction,
    'attributes',p_attributes,'profile_name',p_provider_profile_name,'catalog_resolution',p_catalog_resolution);
  -- A completed request is an immutable response, including after D07 closure or
  -- later human edits. Replays never update the catalogue or current lead again.
  select * into previous from private.bot_catalog_requests where message_id=p_message_id;
  if found then
    if previous.request is distinct from request then raise exception 'Different catalogue request for cutoff' using errcode='PT409'; end if;
    return query select previous.lead_id,p_message_id,'unchanged'::text,previous.vehicle_id,previous.catalog_outcome; return;
  end if;
  if c.bot_cycle_id is null then raise exception 'Catalogue creation requires a managed D07 turn' using errcode='PT409'; end if;
  perform 1 from private.bot_contacts g join private.bot_cycles cy on cy.contact_id=g.id
    where cy.id=c.bot_cycle_id for update of g;
  -- Recheck idempotency after waiting, before eligibility: a concurrent successful
  -- transaction may also have closed the turn while this replay was blocked.
  select * into previous from private.bot_catalog_requests where message_id=p_message_id;
  if found then
    if previous.request is distinct from request then raise exception 'Different catalogue request for cutoff' using errcode='PT409'; end if;
    return query select previous.lead_id,p_message_id,'unchanged'::text,previous.vehicle_id,previous.catalog_outcome; return;
  end if;
  perform private.require_bot_turn(c.id,p_message_id);
  select * into strict l from public.leads where id=c.lead_id;
  catalog_source:=case l.source when 'demo' then 'demo' when 'whatsapp_bot' then 'real' end;
  if catalog_source is null then raise exception 'Unsupported opportunity source' using errcode='22023'; end if;
  if jsonb_typeof(p_catalog_resolution) is distinct from 'object' then
    raise exception 'Explicit catalogue resolution required' using errcode='22023';
  end if;
  resolution:=p_catalog_resolution->>'status';
  if resolution is null or resolution not in ('unambiguous','ambiguous','insufficient') then
    raise exception 'Invalid catalogue resolution' using errcode='22023';
  end if;
  if resolution='unambiguous' then
    if p_catalog_resolution-array['status','role','message_id','quote']<>'{}'::jsonb
      or (p_catalog_resolution->>'role') is distinct from 'sought_vehicle'
      or jsonb_typeof(p_catalog_resolution->'quote') is distinct from 'string'
      or not coalesce((p_catalog_resolution->>'message_id') ~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$',false)
      or jsonb_typeof(p_attributes->'marca') is distinct from 'string'
      or jsonb_typeof(p_attributes->'modelo') is distinct from 'string' then
      raise exception 'Unambiguous sought vehicle needs explicit attributes and evidence' using errcode='22023';
    end if;
    brand_value:=regexp_replace(btrim(p_attributes->>'marca'),'\s+',' ','g');
    model_value:=regexp_replace(btrim(p_attributes->>'modelo'),'\s+',' ','g');
    quote:=p_catalog_resolution->>'quote'; evidence:=(p_catalog_resolution->>'message_id')::uuid;
    if length(brand_value) not between 1 and 80 or length(model_value) not between 1 and 120
      or length(btrim(quote)) not between 1 and 2000
      or brand_value ~* '[/|;,?]|\m(o|u|or)\M' or model_value ~* '[/|;,?]|\m(o|u|or)\M'
      or not coalesce(private.catalog_literal_contains(quote,brand_value) and private.catalog_literal_contains(quote,model_value)
        and private.catalog_literal_contains(p_extraction->>'vehiculo_buscado',brand_value)
        and private.catalog_literal_contains(p_extraction->>'vehiculo_buscado',model_value),false) then
      raise exception 'Incomplete, alternative or unsupported catalogue identity' using errcode='22023';
    end if;
    perform 1 from public.messages m join public.conversations ec on ec.id=m.conversation_id
      where m.id=evidence and m.sender_kind='customer' and m.history_position<=incoming.history_position
        and ec.lead_id=c.lead_id and ec.provider=c.provider and ec.business_phone_id=c.business_phone_id
        and strpos(m.body,quote)>0;
    if not found then raise exception 'Evidence must be literal customer context within cutoff' using errcode='22023'; end if;
  elsif p_catalog_resolution-array['status']<>'{}'::jsonb then
    raise exception 'Unresolved catalogue input must not assert an identity' using errcode='22023';
  end if;

  select * into saved from public.save_bot_lead_details(c.id,p_message_id,p_extraction,p_attributes,p_provider_profile_name);
  if saved.outcome<>'applied' then
    -- In particular, never retrofit an old saved extraction with new catalogue
    -- evidence, nor create a model for a stale cutoff.
    return query select saved.lead_id,saved.source_message_id,saved.outcome,null::uuid,'not_applied'::text; return;
  end if;
  result:='unresolved';
  if resolution='unambiguous' then
    -- The existing expression index is the arbiter across bot and admin writers.
    -- DO NOTHING preserves display spelling, authors, timestamps and archive state.
    loop
      select * into v from public.vehicles where source=catalog_source
        and lower(regexp_replace(btrim(brand),'\s+',' ','g'))=lower(brand_value)
        and lower(regexp_replace(btrim(model),'\s+',' ','g'))=lower(model_value) for share;
      if found then result:=case when v.archived_at is null then 'reused' else 'archived' end; exit; end if;
      insert into public.vehicles(brand,model,source,origin,created_by,needs_review)
        values(brand_value,model_value,catalog_source,'intake',null,false)
        on conflict(source,(lower(regexp_replace(btrim(brand),'\s+',' ','g'))),
          (lower(regexp_replace(btrim(model),'\s+',' ','g')))) do nothing returning * into v;
      if found then
        result:='created';
        insert into public.inventory_events(vehicle_id,actor_id,action,changes)
          values(v.id,null,'vehicle_created',jsonb_build_object('actor','bot','source_message_id',p_message_id,
            'evidence_message_id',evidence,'quote',quote,'after',to_jsonb(v)));
        exit;
      end if;
      -- A conflicting uncommitted insert is visible to the next READ COMMITTED
      -- statement. Concurrent rename/delete is resolved by rechecking the key.
    end loop;
    if result<>'archived' then chosen:=v.id; end if;
  end if;
  select s.* into strict source_record from private.bot_lead_detail_sources s where s.lead_id=l.id;
  if source_record.interest_id is not null then
    update public.lead_interests set vehicle_id=chosen where id=source_record.interest_id returning * into interest;
    update private.bot_lead_detail_sources s set applied_interest=to_jsonb(interest) where s.lead_id=l.id;
  elsif chosen is not null then
    raise exception 'Catalogue identity requires a persisted interest' using errcode='22023';
  end if;
  insert into private.bot_catalog_requests(message_id,lead_id,request,vehicle_id,catalog_outcome)
    values(p_message_id,l.id,request,chosen,result);
  return query select l.id,p_message_id,'applied'::text,chosen,result;
end $$;
revoke all on function public.save_bot_lead_details_with_catalog(uuid,uuid,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_bot_lead_details_with_catalog(uuid,uuid,jsonb,jsonb,text,jsonb) to service_role;

commit;
