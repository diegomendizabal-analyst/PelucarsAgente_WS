begin;

-- D07. A contact/line owns the pause and budget; opportunities do not.
-- No caller-supplied time, timers, remote jobs or default processing thresholds.
create function private.bot_clock() returns timestamptz
language sql volatile security invoker set search_path='' as $$ select clock_timestamp() $$;
revoke all on function private.bot_clock() from public,anon,authenticated,service_role;

create table private.bot_contacts (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('demo','whatsapp_bot')),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  business_phone_id text not null check (length(btrim(business_phone_id)) > 0),
  current_cycle_id uuid,
  active_receipt_id uuid,
  pause_until timestamptz,
  needs_review boolean not null default false,
  unique(source,phone_e164,business_phone_id)
);
create table private.bot_cycles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references private.bot_contacts(id),
  started_at timestamptz not null default private.bot_clock(),
  closed_at timestamptz,
  closing_message_id uuid references public.messages(id),
  unique(contact_id,id)
);
alter table private.bot_contacts add foreign key(id,current_cycle_id)
  references private.bot_cycles(contact_id,id);
alter table public.conversations add column bot_cycle_id uuid references private.bot_cycles(id);
create index conversations_cycle on public.conversations(bot_cycle_id);
alter table public.messages add column bot_cycle_id uuid references private.bot_cycles(id);
create unique index messages_cycle_slot on public.messages(bot_cycle_id,bot_slot) where bot_slot is not null;

create table private.bot_receipts (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references private.bot_contacts(id),
  provider text not null check (length(btrim(provider)) > 0),
  business_phone_id text not null,
  provider_message_id text not null check (length(btrim(provider_message_id)) > 0),
  body text not null check (length(btrim(body)) > 0),
  received_at timestamptz not null default private.bot_clock(),
  history_position bigint not null unique default nextval('public.bot_history_position'),
  disposition text not null default 'pending' check(disposition in ('pending','processing','resolved','paused','review','noncommercial')),
  claimed_at timestamptz,
  decision text,
  requested_lead_id uuid,
  conversation_id uuid references public.conversations(id),
  message_id uuid references public.messages(id),
  unique(provider,business_phone_id,provider_message_id),
  unique(contact_id,id)
);
alter table private.bot_contacts add foreign key(id,active_receipt_id)
  references private.bot_receipts(contact_id,id);
create index bot_receipts_pending on private.bot_receipts(contact_id,history_position) where disposition='pending';
create index bot_receipts_claims on private.bot_receipts(business_phone_id,claimed_at) where claimed_at is not null;
create index bot_receipts_contact_claims on private.bot_receipts(contact_id,claimed_at) where claimed_at is not null;

-- Deployment must explicitly configure limits. Missing configuration denies AI.
-- Values in tests are test fixtures, not commercial/product defaults.
create table private.bot_processing_limits (
  source text not null check(source in ('demo','whatsapp_bot')),
  business_phone_id text not null,
  window_seconds integer not null check(window_seconds > 0),
  max_contact_claims integer not null check(max_contact_claims > 0),
  max_line_claims integer not null check(max_line_claims > 0),
  primary key(source,business_phone_id)
);
revoke all on private.bot_contacts,private.bot_cycles,private.bot_receipts,private.bot_processing_limits
  from public,anon,authenticated,service_role;
alter table private.bot_contacts enable row level security;
alter table private.bot_cycles enable row level security;
alter table private.bot_receipts enable row level security;
alter table private.bot_processing_limits enable row level security;

-- Preserve historical cycles and derive closure only from an actual closing reservation.
-- A stopped historical conversation without that evidence requires reconciliation.
insert into private.bot_contacts(source,phone_e164,business_phone_id)
select distinct l.source,u.phone_e164,c.business_phone_id from public.conversations c
join public.leads l on l.id=c.lead_id join public.customers u on u.id=l.customer_id;
insert into private.bot_cycles(id,contact_id,started_at,closed_at,closing_message_id)
select c.id,g.id,c.started_at,m.created_at,m.id from public.conversations c
join public.leads l on l.id=c.lead_id join public.customers u on u.id=l.customer_id
join private.bot_contacts g on (g.source,g.phone_e164,g.business_phone_id)=(l.source,u.phone_e164,c.business_phone_id)
left join public.messages m on m.conversation_id=c.id and m.reply_kind='closing';
update public.conversations set bot_cycle_id=id;
update public.messages m set bot_cycle_id=c.bot_cycle_id from public.conversations c where c.id=m.conversation_id;
update private.bot_contacts g set
  current_cycle_id=(select cy.id from private.bot_cycles cy where cy.contact_id=g.id order by cy.started_at desc,cy.id desc limit 1),
  pause_until=(select max(cy.closed_at)+interval '72 hours' from private.bot_cycles cy where cy.contact_id=g.id),
  needs_review=exists(select 1 from private.bot_cycles cy join public.conversations c on c.bot_cycle_id=cy.id
    where cy.contact_id=g.id and cy.closed_at is null and c.bot_state<>'collecting')
    or (select count(*) from private.bot_cycles cy where cy.contact_id=g.id and cy.closed_at is null)>1;

-- Called only under the contact lock. Retains the original receipt position/time.
create function private.attach_bot_receipt(p_receipt uuid,p_conversation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r private.bot_receipts; c public.conversations; matching public.conversations;
begin
  select * into strict r from private.bot_receipts where id=p_receipt;
  if r.message_id is not null or p_conversation is null then return; end if;
  select * into strict c from public.conversations where id=p_conversation;
  if c.business_phone_id<>r.business_phone_id or not exists(select 1 from private.bot_cycles cy
    where cy.id=c.bot_cycle_id and cy.contact_id=r.contact_id) then
    raise exception 'Provider routing conflict' using errcode='22023';
  end if;
  if c.provider<>r.provider then
    select * into matching from public.conversations where bot_cycle_id=c.bot_cycle_id and lead_id=c.lead_id and provider=r.provider
      order by started_at,id limit 1;
    if found then c:=matching;
    else
      insert into public.conversations(id,lead_id,provider,business_phone_id,bot_cycle_id,bot_state)
        values(gen_random_uuid(),c.lead_id,r.provider,c.business_phone_id,c.bot_cycle_id,c.bot_state) returning * into c;
    end if;
  end if;
  insert into public.messages(id,conversation_id,provider,business_phone_id,provider_message_id,
    sender_kind,body,created_at,history_position,bot_cycle_id)
  values(r.id,c.id,r.provider,r.business_phone_id,r.provider_message_id,'customer',r.body,r.received_at,r.history_position,c.bot_cycle_id);
  update private.bot_receipts set conversation_id=c.id,message_id=r.id where id=r.id;
end $$;
revoke all on function private.attach_bot_receipt(uuid,uuid) from public,anon,authenticated,service_role;

create function public.receive_bot_contact_message(p_source text,p_phone_e164 text,p_provider text,
  p_business_phone_id text,p_provider_message_id text,p_body text)
returns table(receipt_id uuid,created boolean,disposition text,pause_until timestamptz)
language plpgsql security definer set search_path='' as $$
declare g private.bot_contacts; r private.bot_receipts; old public.messages; inserted boolean; target uuid;
begin
  insert into private.bot_contacts(source,phone_e164,business_phone_id)
    values(p_source,p_phone_e164,p_business_phone_id) on conflict do nothing;
  select * into strict g from private.bot_contacts
    where (source,phone_e164,business_phone_id)=(p_source,p_phone_e164,p_business_phone_id) for update;
  -- An old provider ID cannot become a fresh processing admission after rollout.
  select m.* into old from public.messages m where (m.provider,m.business_phone_id,m.provider_message_id)=
    (p_provider,p_business_phone_id,p_provider_message_id);
  if found and not exists(select 1 from private.bot_receipts r0 where r0.id=old.id) then
    if old.sender_kind<>'customer' or old.body is distinct from p_body or not exists(
      select 1 from public.conversations c join public.leads l on l.id=c.lead_id
      join public.customers u on u.id=l.customer_id where c.id=old.conversation_id
      and l.source=p_source and u.phone_e164=p_phone_e164) then
      raise exception 'External identity conflict' using errcode='22023';
    end if;
    return query select old.id,false,'historical'::text,g.pause_until; return;
  end if;
  insert into private.bot_receipts(contact_id,provider,business_phone_id,provider_message_id,body)
    values(g.id,p_provider,p_business_phone_id,p_provider_message_id,p_body)
    on conflict(provider,business_phone_id,provider_message_id) do nothing returning * into r;
  inserted:=found;
  if not inserted then
    select * into strict r from private.bot_receipts r0 where
      (r0.provider,r0.business_phone_id,r0.provider_message_id)=(p_provider,p_business_phone_id,p_provider_message_id);
    if (r.contact_id,r.body) is distinct from (g.id,p_body) then
      raise exception 'External identity conflict' using errcode='22023';
    end if;
  elsif g.needs_review or private.bot_clock()<g.pause_until then
    update private.bot_receipts set disposition=case when g.needs_review then 'review' else 'paused' end
      where id=r.id returning * into r;
    select c.id into target from public.conversations c where c.bot_cycle_id=g.current_cycle_id
      order by c.started_at desc,c.id desc limit 1;
    perform private.attach_bot_receipt(r.id,target);
  end if;
  return query select r.id,inserted,r.disposition,g.pause_until;
end $$;

-- One durable claim per receipt and one unfinished turn per contact. No automatic
-- retry lease: a worker crash is reconciled, never an excuse for duplicate AI/send.
create function public.claim_bot_contact_message(p_receipt_id uuid)
returns table(claimed boolean,reason text,receipt_id uuid,body text,pause_until timestamptz)
language plpgsql security definer set search_path='' as $$
declare r private.bot_receipts; g private.bot_contacts; lim private.bot_processing_limits; t timestamptz; target uuid;
begin
  select * into strict r from private.bot_receipts where id=p_receipt_id;
  select * into g from private.bot_contacts where id=r.contact_id;
  -- Consistent order: line limit, contact, receipt, conversation, lead.
  select * into lim from private.bot_processing_limits where source=g.source and business_phone_id=g.business_phone_id for update;
  select * into strict g from private.bot_contacts where id=r.contact_id for update;
  select * into strict r from private.bot_receipts where id=p_receipt_id for update;
  t:=private.bot_clock();
  if r.disposition<>'pending' then
    return query select false,r.disposition,r.id,null::text,g.pause_until; return;
  end if;
  if g.needs_review or t<g.pause_until then
    update private.bot_receipts set disposition=case when g.needs_review then 'review' else 'paused' end where id=r.id;
    select c.id into target from public.conversations c where c.bot_cycle_id=g.current_cycle_id
      order by c.started_at desc,c.id desc limit 1;
    perform private.attach_bot_receipt(r.id,target);
    return query select false,case when g.needs_review then 'review' else 'paused' end,r.id,null::text,g.pause_until; return;
  end if;
  if g.active_receipt_id is not null then
    return query select false,'busy'::text,r.id,null::text,g.pause_until; return;
  end if;
  if exists(select 1 from private.bot_receipts q where q.contact_id=g.id and q.disposition='pending' and q.history_position<r.history_position) then
    return query select false,'earlier_pending'::text,r.id,null::text,g.pause_until; return;
  end if;
  if lim.source is null then
    return query select false,'limits_not_configured'::text,r.id,null::text,g.pause_until; return;
  end if;
  if (select count(*) from private.bot_receipts q where q.contact_id=g.id
      and q.claimed_at>t-make_interval(secs=>lim.window_seconds))>=lim.max_contact_claims
    or (select count(*) from private.bot_receipts q join private.bot_contacts qg on qg.id=q.contact_id
      where qg.source=g.source and qg.business_phone_id=g.business_phone_id
      and q.claimed_at>t-make_interval(secs=>lim.window_seconds))>=lim.max_line_claims then
    return query select false,'processing_limit'::text,r.id,null::text,g.pause_until; return;
  end if;
  update private.bot_receipts set disposition='processing',claimed_at=t where id=r.id;
  update private.bot_contacts set active_receipt_id=r.id where id=g.id;
  return query select true,'claimed'::text,r.id,r.body,g.pause_until;
end $$;

create function public.resolve_bot_contact_message(p_receipt_id uuid,p_decision text,p_lead_id uuid default null)
returns table(outcome text,lead_id uuid,conversation_id uuid,message_id uuid,cycle_id uuid)
language plpgsql security definer set search_path='' as $$
declare r private.bot_receipts; g private.bot_contacts; cy private.bot_cycles; l public.leads;
  customer uuid; conv uuid; open_ids uuid[]; t timestamptz;
begin
  select * into strict r from private.bot_receipts where id=p_receipt_id;
  select * into strict g from private.bot_contacts where id=r.contact_id for update;
  select * into strict r from private.bot_receipts where id=p_receipt_id for update;
  if p_decision is null or p_decision not in ('same_search','new_search','additional_purchase','noncommercial','uncertain') then
    raise exception 'Invalid commercial routing decision' using errcode='22023';
  end if;
  if r.decision is not null then
    if (r.decision,r.requested_lead_id) is distinct from (p_decision,p_lead_id) then
      raise exception 'Different resolution for receipt' using errcode='PT409';
    end if;
    return query select r.disposition,c.lead_id,c.id,r.message_id,c.bot_cycle_id from
      (select 1) x left join public.conversations c on c.id=r.conversation_id; return;
  end if;
  if r.disposition<>'processing' or g.active_receipt_id is distinct from r.id then
    raise exception 'Processing claim required' using errcode='PT409';
  end if;
  t:=private.bot_clock();
  if g.needs_review or t<g.pause_until then raise exception 'Contact no longer eligible' using errcode='PT409'; end if;
  select * into cy from private.bot_cycles where id=g.current_cycle_id;
  if p_decision not in ('noncommercial','uncertain') then
    insert into public.customers(phone_e164) values(g.phone_e164) on conflict(phone_e164) do nothing;
  end if;
  -- Different business lines still share the same customer and open searches.
  -- Lock the customer before looking for/creating a lead, as the CRM intake does.
  select u.id into customer from public.customers u where u.phone_e164=g.phone_e164 for update;
  if p_lead_id is not null then
    select * into l from public.leads where id=p_lead_id and customer_id=customer and source=g.source for update;
    if not found then raise exception 'Lead does not belong to contact/source' using errcode='22023'; end if;
  end if;
  if p_decision in ('noncommercial','uncertain') then
    select c.id into conv from public.conversations c join public.leads cl on cl.id=c.lead_id
      where cl.customer_id=customer and cl.source=g.source and c.business_phone_id=g.business_phone_id
      and (p_lead_id is null or c.lead_id=p_lead_id) order by c.started_at desc,c.id desc limit 1;
    perform private.attach_bot_receipt(r.id,conv);
    update private.bot_receipts set disposition=case when p_decision='noncommercial' then 'noncommercial' else 'review' end,
      decision=p_decision,requested_lead_id=p_lead_id where id=r.id;
    update private.bot_contacts set active_receipt_id=null where id=g.id;
  else
    if p_decision<>'additional_purchase' then
      if p_lead_id is null then
        select array_agg(id) into open_ids from public.leads where customer_id=customer and source=g.source and closed_at is null;
        if cardinality(open_ids)>1 then raise exception 'Ambiguous open search; choose an explicit lead' using errcode='PT409'; end if;
        select * into l from public.leads where id=open_ids[1] for update;
      end if;
      if p_decision='same_search' and (l.id is null or l.closed_at is not null) then
        raise exception 'Same search requires an open opportunity' using errcode='22023';
      end if;
    end if;
    -- A preference change never creates another lead while the search stays open.
    if p_decision='additional_purchase' or l.id is null or l.closed_at is not null then
      insert into public.leads(customer_id,source) values(customer,g.source) returning * into l;
    end if;
    if cy.id is null or cy.closed_at is not null then
      insert into private.bot_cycles(contact_id) values(g.id) returning * into cy;
      update private.bot_contacts set current_cycle_id=cy.id where id=g.id;
    end if;
    select c.id into conv from public.conversations c where c.bot_cycle_id=cy.id and c.lead_id=l.id
      and c.provider=r.provider order by c.started_at,c.id limit 1;
    if conv is null then
      conv:=gen_random_uuid();
      insert into public.conversations(id,lead_id,provider,business_phone_id,bot_cycle_id)
        values(conv,l.id,r.provider,g.business_phone_id,cy.id);
    end if;
    perform private.attach_bot_receipt(r.id,conv);
    update private.bot_receipts set disposition='resolved',decision=p_decision,requested_lead_id=p_lead_id where id=r.id;
    -- active_receipt remains owned until reserve_bot_reply or complete_bot_contact_turn.
  end if;
  return query select q.disposition,c.lead_id,c.id,q.message_id,c.bot_cycle_id
    from private.bot_receipts q left join public.conversations c on c.id=q.conversation_id where q.id=r.id;
end $$;

create function public.complete_bot_contact_turn(p_receipt_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r private.bot_receipts; g private.bot_contacts;
begin
  select * into strict r from private.bot_receipts where id=p_receipt_id;
  select * into strict g from private.bot_contacts where id=r.contact_id for update;
  if r.disposition<>'resolved' then raise exception 'Resolve turn first' using errcode='PT409'; end if;
  if g.active_receipt_id=r.id then update private.bot_contacts set active_receipt_id=null where id=g.id; end if;
end $$;

-- Legacy intake cannot bypass an enrolled contact, including through another lead/provider.
alter function public.receive_bot_message(uuid,uuid,text,text,text,text,text,text) set schema private;
create function public.receive_bot_message(p_conversation_id uuid,p_lead_id uuid,p_source text,p_phone_e164 text,
  p_provider text,p_business_phone_id text,p_provider_message_id text,p_body text)
returns table(conversation_id uuid,message_id uuid,history_position bigint,created boolean)
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.leads l join public.customers c on c.id=l.customer_id
    where l.id=p_lead_id and l.source=p_source and c.phone_e164=p_phone_e164;
  if not found then raise exception 'Lead, source or sender mismatch' using errcode='22023'; end if;
  if p_source<>'demo' or exists(select 1 from private.bot_contacts where
    (source,phone_e164,business_phone_id)=(p_source,p_phone_e164,p_business_phone_id)) then
    raise exception 'Use D07 contact intake before processing' using errcode='PT409';
  end if;
  return query select * from private.receive_bot_message(p_conversation_id,p_lead_id,p_source,p_phone_e164,
    p_provider,p_business_phone_id,p_provider_message_id,p_body);
end $$;

-- Managed writes must belong to the current, exclusively claimed turn. This also
-- prevents delayed workers from extracting/scoring a muted or previous-cycle input.
create function private.require_bot_turn(p_conversation uuid,p_message uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.conversations; cy private.bot_cycles; g private.bot_contacts;
begin
  select * into strict c from public.conversations where id=p_conversation;
  if c.bot_cycle_id is null then
    if exists(select 1 from public.leads l join public.customers u on u.id=l.customer_id
      join private.bot_contacts gate on (gate.source,gate.phone_e164,gate.business_phone_id)=
        (l.source,u.phone_e164,c.business_phone_id) where l.id=c.lead_id) then
      raise exception 'Legacy conversation cannot bypass managed contact' using errcode='PT409';
    end if;
    return; -- isolated legacy demo compatibility
  end if;
  select * into strict cy from private.bot_cycles where id=c.bot_cycle_id;
  select * into strict g from private.bot_contacts where id=cy.contact_id for update;
  if g.needs_review or g.current_cycle_id<>cy.id or cy.closed_at is not null
    or private.bot_clock()<g.pause_until or not exists(select 1 from private.bot_receipts r
      where r.id=p_message and r.message_id=p_message and r.conversation_id=c.id
      and r.disposition='resolved' and g.active_receipt_id=r.id) then
    raise exception 'Turn is not eligible for processing' using errcode='PT409';
  end if;
  perform 1 from public.customers u join public.leads l on l.customer_id=u.id
    where l.id=c.lead_id for update of u;
  perform 1 from public.leads where id=c.lead_id and closed_at is null for update;
  if not found then raise exception 'Opportunity closed while processing' using errcode='PT409'; end if;
end $$;

alter function public.reserve_bot_reply(uuid,uuid,text,text,integer) set schema private;
create function public.reserve_bot_reply(p_conversation_id uuid,p_reply_to uuid,p_body text,p_reply_kind text,p_expected_reserved_slots integer)
returns public.messages language plpgsql security definer set search_path='' as $$
declare c public.conversations; cy private.bot_cycles; g private.bot_contacts; m public.messages;
  used integer; t timestamptz; pending uuid;
begin
  select * into strict c from public.conversations where id=p_conversation_id;
  if c.bot_cycle_id is null then
    perform private.require_bot_turn(c.id,p_reply_to);
    return private.reserve_bot_reply(p_conversation_id,p_reply_to,p_body,p_reply_kind,p_expected_reserved_slots);
  end if;
  select * into strict cy from private.bot_cycles where id=c.bot_cycle_id;
  select * into strict g from private.bot_contacts where id=cy.contact_id for update;
  select * into m from public.messages where reply_to=p_reply_to;
  if found then
    if (m.conversation_id,m.body,m.reply_kind) is distinct from (c.id,p_body,p_reply_kind) then
      raise exception 'Reply conflict' using errcode='22023';
    end if;
    return m;
  end if;
  perform private.require_bot_turn(c.id,p_reply_to);
  select count(*) into used from public.messages where bot_cycle_id=cy.id and bot_slot is not null;
  if p_expected_reserved_slots is distinct from used then raise exception 'Refresh cycle budget' using errcode='PT409'; end if;
  if p_reply_kind is null or p_reply_kind not in ('question','closing') or used>=3 or (used=2 and p_reply_kind<>'closing') then
    raise exception 'Maximum three reservations; third is closing' using errcode='22023';
  end if;
  insert into public.messages(conversation_id,provider,business_phone_id,sender_kind,body,send_state,bot_slot,reply_to,reply_kind,bot_cycle_id)
    values(c.id,c.provider,c.business_phone_id,'bot',p_body,'pending',used+1,p_reply_to,p_reply_kind,cy.id) returning * into m;
  if p_reply_kind='closing' then
    t:=private.bot_clock();
    update private.bot_cycles set closed_at=t,closing_message_id=m.id where id=cy.id;
    update private.bot_contacts set pause_until=t+interval '72 hours' where id=g.id;
    update public.conversations set bot_state='waiting_assignment' where bot_cycle_id=cy.id;
    -- Queued inputs are retained, never replayed into AI when the clock expires.
    for pending in update private.bot_receipts set disposition='paused' where contact_id=g.id and disposition='pending' returning id loop
      perform private.attach_bot_receipt(pending,c.id);
    end loop;
  end if;
  update private.bot_contacts set active_receipt_id=null where id=g.id;
  return m;
end $$;

alter function public.claim_bot_reply(uuid,uuid) set schema private;
create function public.claim_bot_reply(p_conversation_id uuid,p_message_id uuid)
returns table(message_id uuid,send_state text,claimed boolean)
language plpgsql security definer set search_path='' as $$
declare c public.conversations; cy private.bot_cycles; g private.bot_contacts; m public.messages;
begin
  select * into strict c from public.conversations where id=p_conversation_id;
  if c.bot_cycle_id is null then perform private.require_bot_turn(c.id,p_message_id); end if;
  if c.bot_cycle_id is not null then
    select * into strict cy from private.bot_cycles where id=c.bot_cycle_id;
    select * into strict g from private.bot_contacts where id=cy.contact_id for update;
    select * into strict m from public.messages where id=p_message_id and conversation_id=c.id;
    if g.current_cycle_id<>cy.id or g.needs_review or (cy.closed_at is not null and m.reply_kind<>'closing') then
      return query select m.id,m.send_state,false; return;
    end if;
  end if;
  return query select * from private.claim_bot_reply(p_conversation_id,p_message_id);
end $$;

alter function public.set_bot_conversation_state(uuid,text,text) set schema private;
create function public.set_bot_conversation_state(p_conversation_id uuid,p_expected text,p_state text)
returns text language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.conversations where id=p_conversation_id and bot_cycle_id is not null) then
    raise exception 'Managed cycles close through reserve_bot_reply' using errcode='PT409';
  end if;
  return private.set_bot_conversation_state(p_conversation_id,p_expected,p_state);
end $$;

-- An explicit current-cycle read prevents interpreting historical totals as a reset.
create function public.get_bot_contact_turn(p_receipt_id uuid)
returns table(disposition text,cycle_id uuid,lead_id uuid,conversation_id uuid,message_id uuid,
  reserved_slots integer,sent_count integer,closed_at timestamptz,pause_until timestamptz)
language sql stable security definer set search_path='' as $$
  select r.disposition,cy.id,c.lead_id,c.id,r.message_id,
    (select count(*)::integer from public.messages m where m.bot_cycle_id=cy.id and m.bot_slot is not null),
    (select count(*)::integer from public.messages m where m.bot_cycle_id=cy.id and m.send_state='sent'),cy.closed_at,g.pause_until
  from private.bot_receipts r join private.bot_contacts g on g.id=r.contact_id
  left join public.conversations c on c.id=r.conversation_id left join private.bot_cycles cy on cy.id=c.bot_cycle_id
  where r.id=p_receipt_id;
$$;

-- Event-driven draining only: callers invoke this after a received message/finished
-- turn. Paused/review/noncommercial receipts are never replayed as pending work.
create function public.list_bot_contact_queue(p_receipt_id uuid,p_limit integer default 20)
returns table(receipt_id uuid,history_position bigint)
language sql stable security definer set search_path='' as $$
  select q.id,q.history_position from private.bot_receipts target join private.bot_receipts q on q.contact_id=target.contact_id
  where target.id=p_receipt_id and q.disposition='pending' order by q.history_position
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;

-- Context across cycles of the same opportunity, including muted inputs, with a
-- fixed exclusive cutoff. Never joins another purchase/contact/line/source.
create function public.bot_opportunity_history(p_conversation_id uuid,p_before bigint,p_after bigint default 0,p_limit integer default 100)
returns table(message_id uuid,history_position bigint,sender_kind text,body text,occurred_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select m.id,m.history_position,m.sender_kind,m.body,coalesce(m.sent_at,m.created_at)
  from public.conversations target join public.conversations c on c.lead_id=target.lead_id
    and c.business_phone_id=target.business_phone_id and c.provider=target.provider
  join public.messages m on m.conversation_id=c.id where target.id=p_conversation_id
    and m.history_position>coalesce(p_after,0) and m.history_position<p_before
  order by m.history_position limit greatest(1,least(coalesce(p_limit,100),500));
$$;

-- Protected existing implementations remain callable only by their wrappers.
alter function public.save_bot_lead_summary(uuid,uuid,text) set schema private;
alter function public.save_bot_lead_details(uuid,uuid,jsonb,jsonb,text) set schema private;
alter function public.save_bot_score(uuid,uuid,jsonb,text) set schema private;
-- Same rules, same literal/unique evidence validation; managed cycles share only the same opportunity context.
create or replace function private.save_bot_score(
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
        where (m.conversation_id = p_conversation_id or exists (
          select 1 from public.conversations origin join public.conversations target
            on target.id=p_conversation_id and target.bot_cycle_id is not null
            and origin.lead_id=target.lead_id and origin.provider=target.provider
            and origin.business_phone_id=target.business_phone_id
          where origin.id=m.conversation_id)) and m.sender_kind = 'customer'
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

create function public.save_bot_lead_summary(p_conversation_id uuid,p_message_id uuid,p_summary text)
returns table(lead_id uuid,source_message_id uuid,outcome text)
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from private.bot_lead_summary_sources where message_id=p_message_id) then
    perform private.require_bot_turn(p_conversation_id,p_message_id);
  end if;
  return query select * from private.save_bot_lead_summary(p_conversation_id,p_message_id,p_summary);
end $$;
create function public.save_bot_lead_details(p_conversation_id uuid,p_message_id uuid,p_extraction jsonb,p_attributes jsonb default '{}',p_provider_profile_name text default null)
returns table(lead_id uuid,source_message_id uuid,outcome text)
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from private.bot_lead_detail_sources where message_id=p_message_id) then
    perform private.require_bot_turn(p_conversation_id,p_message_id);
  end if;
  return query select * from private.save_bot_lead_details(p_conversation_id,p_message_id,p_extraction,p_attributes,p_provider_profile_name);
end $$;
create function public.save_bot_score(p_conversation_id uuid,p_message_id uuid,p_evaluation jsonb,p_extraction_model text default null)
returns table(evaluation_id uuid,outcome text)
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.score_evaluations where evaluated_through_message_id=p_message_id
    and rules_version=p_evaluation->>'version_reglas') then
    perform private.require_bot_turn(p_conversation_id,p_message_id);
  end if;
  return query select * from private.save_bot_score(p_conversation_id,p_message_id,p_evaluation,p_extraction_model);
end $$;

revoke all on function private.receive_bot_message(uuid,uuid,text,text,text,text,text,text),
  private.reserve_bot_reply(uuid,uuid,text,text,integer),private.claim_bot_reply(uuid,uuid),
  private.set_bot_conversation_state(uuid,text,text),private.require_bot_turn(uuid,uuid),
  private.save_bot_lead_summary(uuid,uuid,text),private.save_bot_lead_details(uuid,uuid,jsonb,jsonb,text),
  private.save_bot_score(uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.receive_bot_contact_message(text,text,text,text,text,text),
  public.claim_bot_contact_message(uuid),public.resolve_bot_contact_message(uuid,text,uuid),
  public.complete_bot_contact_turn(uuid),public.get_bot_contact_turn(uuid),public.list_bot_contact_queue(uuid,integer),
  public.receive_bot_message(uuid,uuid,text,text,text,text,text,text),public.reserve_bot_reply(uuid,uuid,text,text,integer),
  public.claim_bot_reply(uuid,uuid),public.set_bot_conversation_state(uuid,text,text),
  public.save_bot_lead_summary(uuid,uuid,text),public.save_bot_lead_details(uuid,uuid,jsonb,jsonb,text),
  public.save_bot_score(uuid,uuid,jsonb,text),public.bot_opportunity_history(uuid,bigint,bigint,integer)
  from public,anon,authenticated;
grant execute on function public.receive_bot_contact_message(text,text,text,text,text,text),
  public.claim_bot_contact_message(uuid),public.resolve_bot_contact_message(uuid,text,uuid),
  public.complete_bot_contact_turn(uuid),public.get_bot_contact_turn(uuid),public.list_bot_contact_queue(uuid,integer),
  public.receive_bot_message(uuid,uuid,text,text,text,text,text,text),public.reserve_bot_reply(uuid,uuid,text,text,integer),
  public.claim_bot_reply(uuid,uuid),public.set_bot_conversation_state(uuid,text,text),
  public.save_bot_lead_summary(uuid,uuid,text),public.save_bot_lead_details(uuid,uuid,jsonb,jsonb,text),
  public.save_bot_score(uuid,uuid,jsonb,text),public.bot_opportunity_history(uuid,bigint,bigint,integer) to service_role;

-- Managed routing and cycle budgets cannot be bypassed with direct table writes.
revoke insert,update on public.conversations,public.messages from service_role;
revoke update(bot_state) on public.conversations from service_role;
revoke update(send_state,sent_at,provider_message_id,history_position) on public.messages from service_role;
alter function public.record_bot_reply_result(uuid,uuid,text,text) security definer;

commit;
