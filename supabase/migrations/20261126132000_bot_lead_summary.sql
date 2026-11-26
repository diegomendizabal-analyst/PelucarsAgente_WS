begin;

-- Una fila por oportunidad, incluso si tiene varias conversaciones. La copia
-- exacta permite reconocer ediciones del CRM sin depender de updated_at.
create table private.bot_lead_summary_sources (
  lead_id uuid primary key references public.leads(id),
  message_id uuid not null unique references public.messages(id),
  applied_summary text not null
);
revoke all on private.bot_lead_summary_sources from public, anon, authenticated, service_role;
grant select, insert, update (message_id, applied_summary)
  on private.bot_lead_summary_sources to service_role;

create function public.save_bot_lead_summary(
  p_conversation_id uuid, p_message_id uuid, p_summary text
) returns table (lead_id uuid, source_message_id uuid, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare
  target_id uuid;
  current_summary text;
  incoming_position bigint;
  previous private.bot_lead_summary_sources;
  previous_position bigint;
begin
  if p_summary is null or p_summary !~ '[^[:space:]]' or length(p_summary) > 6000 then
    raise exception 'Invalid lead summary' using errcode = '22023';
  end if;

  select l.id, l.summary, m.history_position into target_id, current_summary, incoming_position
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    join public.leads l on l.id = c.lead_id
    where m.id = p_message_id and c.id = p_conversation_id and m.sender_kind = 'customer'
    for update of l;
  if not found then
    raise exception 'Expected an inbound message of this conversation' using errcode = '22023';
  end if;

  select s.* into previous from private.bot_lead_summary_sources s where s.lead_id = target_id;
  if found then
    select m.history_position into strict previous_position from public.messages m where m.id = previous.message_id;
    if incoming_position < previous_position then
      return query select target_id, previous.message_id, 'stale'::text;
      return;
    end if;
  end if;

  if current_summary is distinct from previous.applied_summary then
    raise exception 'Lead summary has an independent edit' using errcode = 'PT409';
  end if;
  if p_message_id = previous.message_id then
    if p_summary is distinct from previous.applied_summary then
      raise exception 'Different summary for the same message' using errcode = 'PT409';
    end if;
    return query select target_id, p_message_id, 'unchanged'::text;
    return;
  end if;

  insert into private.bot_lead_summary_sources (lead_id, message_id, applied_summary)
    values (target_id, p_message_id, p_summary)
    on conflict on constraint bot_lead_summary_sources_pkey do update
    set message_id = excluded.message_id, applied_summary = excluded.applied_summary;
  update public.leads set summary = p_summary, updated_at = clock_timestamp()
    where id = target_id and summary is distinct from p_summary;
  return query select target_id, p_message_id, 'applied'::text;
end $$;

revoke all on function public.save_bot_lead_summary(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.save_bot_lead_summary(uuid,uuid,text) to service_role;
commit;
