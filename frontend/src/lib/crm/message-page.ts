import type { BotReadState, LeadMessage } from "./types";

export const messagePageSize = 20;
export type MessagePage = {
  messages: LeadMessage[]; hasMore: boolean; before: number | null;
  cutoff: number | null; beforeId: string | null; state: BotReadState;
};

// PostgREST returns descending immutable positions. Never use timestamps to
// place unconfirmed sends in the conversation, or offsets that new arrivals shift.
export function messagePage(rows: LeadMessage[], state: BotReadState, cutoff?: number, unconfirmed = false): MessagePage {
  const selected = rows.slice(0, messagePageSize);
  return {
    messages: unconfirmed ? selected : selected.toReversed(),
    hasMore: rows.length > messagePageSize,
    before: unconfirmed ? null : selected.at(-1)?.history_position ?? null,
    cutoff: cutoff ?? selected[0]?.history_position ?? null,
    beforeId: unconfirmed ? selected.at(-1)?.id ?? null : null,
    state,
  };
}

export function mergeMessages(previous: LeadMessage[], incoming: LeadMessage[], unconfirmed = false) {
  const unique = [...new Map([...previous, ...incoming].map(message => [message.id, message])).values()];
  return unconfirmed ? unique : unique.sort((a, b) => a.history_position! - b.history_position!);
}
