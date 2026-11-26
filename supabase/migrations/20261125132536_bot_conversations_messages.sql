begin;

create table public.conversations (
  id uuid primary key,
  lead_id uuid not null references public.leads(id) on delete restrict,
  provider text not null check (length(btrim(provider)) > 0),
  business_phone_id text not null check (length(btrim(business_phone_id)) > 0),
  bot_state text not null default 'collecting'
    check (bot_state in ('collecting','waiting_assignment','handed_off','stopped')),
  started_at timestamptz not null default clock_timestamp(),
  unique (id, provider, business_phone_id)
);
create index conversations_by_lead on public.conversations(lead_id);

-- Posición de incorporación al diálogo: recibir un entrante o confirmar un envío.
-- Reservar un cupo no incorpora contenido al historial del cliente.
create sequence public.bot_history_position;
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  provider text not null,
  business_phone_id text not null,
  provider_message_id text check (length(btrim(provider_message_id)) > 0),
  sender_kind text not null check (sender_kind in ('customer','bot')),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz,
  history_position bigint unique,
  send_state text,
  bot_slot smallint check (bot_slot between 1 and 3),
  reply_kind text check (reply_kind in ('question','closing')),
  reply_to uuid,
  foreign key (conversation_id, provider, business_phone_id)
    references public.conversations(id, provider, business_phone_id),
  unique (conversation_id, id),
  foreign key (conversation_id, reply_to) references public.messages(conversation_id, id),
  unique (conversation_id, bot_slot),
  unique (reply_to),
  unique (provider, business_phone_id, provider_message_id),
  check (
    (sender_kind = 'customer' and provider_message_id is not null and history_position is not null
      and send_state is null and sent_at is null and bot_slot is null and reply_to is null and reply_kind is null)
    or
    (sender_kind = 'bot' and send_state is not null and bot_slot is not null and reply_to is not null
      and reply_kind is not null and (bot_slot < 3 or reply_kind = 'closing')
      and send_state in ('pending','sending','sent','failed','unknown')
      and (send_state = 'sent') = (sent_at is not null)
      and (send_state = 'sent') = (history_position is not null)
      and (send_state = 'sent') = (provider_message_id is not null))
  )
);
create index messages_history on public.messages(conversation_id, history_position)
  where history_position is not null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
create policy conversations_read on public.conversations for select to authenticated
  using (exists (select 1 from public.leads l where l.id = conversations.lead_id));
create policy messages_read on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = messages.conversation_id));

revoke all on public.conversations, public.messages from public, anon, authenticated, service_role;
grant select on public.conversations, public.messages to authenticated, service_role;
grant insert on public.conversations, public.messages to service_role;
grant update (bot_state) on public.conversations to service_role;
grant update (send_state, sent_at, provider_message_id, history_position) on public.messages to service_role;
revoke all on sequence public.bot_history_position from public, anon, authenticated, service_role;
grant usage on sequence public.bot_history_position to service_role;

-- El llamador proporciona la identidad de la conversación y del lead ya resuelto.
create function public.receive_bot_message(
  p_conversation_id uuid, p_lead_id uuid, p_source text, p_phone_e164 text,
  p_provider text, p_business_phone_id text, p_provider_message_id text, p_body text
) returns table (conversation_id uuid, message_id uuid, history_position bigint, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  conversation public.conversations;
  message public.messages;
  inserted boolean;
begin
  perform 1 from public.leads l join public.customers c on c.id = l.customer_id
    where l.id = p_lead_id and l.source = p_source and c.phone_e164 = p_phone_e164;
  if not found then raise exception 'Lead, source or sender mismatch' using errcode = '22023'; end if;

  insert into public.conversations(id, lead_id, provider, business_phone_id)
    values (p_conversation_id, p_lead_id, p_provider, p_business_phone_id)
    on conflict (id) do nothing;
  select * into strict conversation from public.conversations where id = p_conversation_id for update;
  if (conversation.lead_id, conversation.provider, conversation.business_phone_id)
    is distinct from (p_lead_id, p_provider, p_business_phone_id) then
    raise exception 'Conversation routing mismatch' using errcode = '22023';
  end if;

  insert into public.messages(conversation_id, provider, business_phone_id, provider_message_id,
                              sender_kind, body, history_position)
    values (conversation.id, p_provider, p_business_phone_id, p_provider_message_id,
            'customer', p_body, nextval('public.bot_history_position'))
    on conflict (provider, business_phone_id, provider_message_id) do nothing
    returning * into message;
  inserted := found;
  if not inserted then
    select m.* into strict message from public.messages m
      where m.provider = p_provider and m.business_phone_id = p_business_phone_id
        and m.provider_message_id = p_provider_message_id;
    if (message.conversation_id, message.sender_kind, message.body)
      is distinct from (conversation.id, 'customer'::text, p_body) then
      raise exception 'External message identity conflict' using errcode = '22023';
    end if;
  end if;
  return query select conversation.id, message.id, message.history_position, inserted;
end $$;

create function public.bot_message_history(p_conversation_id uuid, p_before bigint default null,
  p_after bigint default 0, p_limit integer default 100)
returns table (message_id uuid, history_position bigint, sender_kind text, body text, occurred_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.history_position, m.sender_kind, m.body, coalesce(m.sent_at, m.created_at)
  from public.messages m where m.conversation_id = p_conversation_id
    and m.history_position > coalesce(p_after, 0)
    and (p_before is null or m.history_position < p_before)
  order by m.history_position limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

create function public.get_bot_conversation(p_conversation_id uuid)
returns table (conversation_id uuid, lead_id uuid, bot_state text, reserved_slots integer, sent_count integer)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.lead_id, c.bot_state, count(m.bot_slot)::integer,
         count(*) filter (where m.send_state = 'sent')::integer
  from public.conversations c left join public.messages m on m.conversation_id = c.id and m.bot_slot is not null
  where c.id = p_conversation_id group by c.id;
$$;

create function public.reserve_bot_reply(p_conversation_id uuid, p_reply_to uuid, p_body text,
  p_reply_kind text, p_expected_reserved_slots integer)
returns public.messages language plpgsql security invoker set search_path = '' as $$
declare
  conversation public.conversations;
  message public.messages;
  reserved_slots integer;
begin
  select * into strict conversation from public.conversations where id = p_conversation_id for update;
  perform 1 from public.messages where conversation_id = conversation.id and id = p_reply_to and sender_kind = 'customer';
  if not found then raise exception 'Expected inbound message in conversation' using errcode = '22023'; end if;
  select * into message from public.messages where reply_to = p_reply_to;
  if found then
    if (message.body, message.reply_kind) is distinct from (p_body, p_reply_kind) then
      raise exception 'Reply content or kind conflict' using errcode = '22023';
    end if;
    return message;
  end if;
  if p_expected_reserved_slots is null or p_expected_reserved_slots not between 0 and 3
     or p_reply_kind is null or p_reply_kind not in ('question','closing') then
    raise exception 'Invalid decision parameters' using errcode = '22023';
  end if;
  select count(bot_slot) into reserved_slots from public.messages
    where conversation_id = conversation.id and bot_slot is not null;
  if reserved_slots <> p_expected_reserved_slots or conversation.bot_state <> 'collecting' then
    raise exception 'Refresh conversation before deciding' using errcode = 'PT409';
  end if;
  if reserved_slots = 3 or (reserved_slots = 2 and p_reply_kind <> 'closing') then
    raise exception 'Third slot requires closing; maximum three slots' using errcode = '22023';
  end if;
  insert into public.messages(conversation_id, provider, business_phone_id, sender_kind, body,
                              send_state, bot_slot, reply_to, reply_kind)
    values (conversation.id, conversation.provider, conversation.business_phone_id, 'bot', p_body,
            'pending', reserved_slots + 1, p_reply_to, p_reply_kind)
    returning * into message;
  if p_reply_kind = 'closing' then
    update public.conversations set bot_state = 'waiting_assignment' where id = conversation.id;
  end if;
  return message;
end $$;

-- Sólo quien obtuvo claimed=true puede iniciar el intento externo.
create function public.claim_bot_reply(p_conversation_id uuid, p_message_id uuid)
returns table (message_id uuid, send_state text, claimed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  message public.messages;
  conversation_state text;
begin
  select bot_state into strict conversation_state from public.conversations where id = p_conversation_id for update;
  select * into strict message from public.messages where conversation_id = p_conversation_id
    and id = p_message_id and sender_kind = 'bot' for update;
  if message.send_state <> 'pending' or conversation_state in ('handed_off','stopped')
     or (conversation_state = 'waiting_assignment' and message.reply_kind = 'question') then
    return query select message.id, message.send_state, false;
    return;
  end if;
  update public.messages set send_state = 'sending' where id = message.id;
  return query select message.id, 'sending'::text, true;
end $$;

-- El resultado proviene de una confirmación externa o conciliación; esta RPC no envía.
create function public.record_bot_reply_result(p_conversation_id uuid, p_message_id uuid,
  p_state text, p_provider_message_id text default null)
returns public.messages language plpgsql security invoker set search_path = '' as $$
declare message public.messages;
begin
  perform 1 from public.conversations where id = p_conversation_id for update;
  select * into strict message from public.messages where conversation_id = p_conversation_id
    and id = p_message_id and sender_kind = 'bot' for update;
  if p_state is null or p_state not in ('sent','failed','unknown')
     or (p_state = 'sent') <> (p_provider_message_id is not null) then
    raise exception 'Invalid send result' using errcode = '22023';
  end if;
  if message.send_state = p_state and message.provider_message_id is not distinct from p_provider_message_id then
    return message;
  end if;
  if message.send_state not in ('sending','unknown') then raise exception 'Send result conflicts with current state' using errcode = '22023'; end if;
  update public.messages set send_state = p_state, provider_message_id = p_provider_message_id,
    sent_at = case when p_state = 'sent' then clock_timestamp() end,
    history_position = case when p_state = 'sent' then nextval('public.bot_history_position') end
    where id = message.id returning * into message;
  return message;
end $$;

create function public.set_bot_conversation_state(p_conversation_id uuid, p_expected text, p_state text)
returns text language plpgsql security invoker set search_path = '' as $$
declare current_state text;
begin
  select bot_state into strict current_state from public.conversations where id = p_conversation_id for update;
  if current_state = p_state then return current_state; end if;
  if current_state is distinct from p_expected then raise exception 'Conversation state conflict' using errcode = '22023'; end if;
  if not ((current_state = 'collecting' and p_state in ('waiting_assignment','stopped','handed_off'))
       or (current_state = 'waiting_assignment' and p_state in ('handed_off','stopped'))) then
    raise exception 'Invalid conversation transition' using errcode = '22023';
  end if;
  update public.conversations set bot_state = p_state where id = p_conversation_id;
  return p_state;
end $$;

revoke all on function public.receive_bot_message(uuid,uuid,text,text,text,text,text,text),
  public.reserve_bot_reply(uuid,uuid,text,text,integer), public.claim_bot_reply(uuid,uuid), public.record_bot_reply_result(uuid,uuid,text,text),
  public.set_bot_conversation_state(uuid,text,text), public.bot_message_history(uuid,bigint,bigint,integer)
  from public, anon, authenticated;
revoke all on function public.get_bot_conversation(uuid) from public, anon, authenticated;
grant execute on function public.receive_bot_message(uuid,uuid,text,text,text,text,text,text),
  public.reserve_bot_reply(uuid,uuid,text,text,integer), public.claim_bot_reply(uuid,uuid), public.record_bot_reply_result(uuid,uuid,text,text),
  public.set_bot_conversation_state(uuid,text,text) to service_role;
grant execute on function public.bot_message_history(uuid,bigint,bigint,integer), public.get_bot_conversation(uuid) to authenticated, service_role;

commit;
