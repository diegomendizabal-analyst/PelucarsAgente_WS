"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { crmDate, type LeadMessage } from "@/lib/crm/types";
import { mergeMessages, type MessagePage } from "@/lib/crm/message-page";
import { Panel } from "./ui";

const sendLabels = {pending:"Pendiente de envío",sending:"Envío en curso, sin confirmación",sent:"Envío confirmado",failed:"Envío fallido",unknown:"Envío incierto"};
const clock = new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Buenos_Aires"});
const day = new Intl.DateTimeFormat("es-AR",{day:"numeric",month:"long",year:"numeric",timeZone:"America/Buenos_Aires"});

function Message({message}:{message:LeadMessage}) {
  const time = message.sent_at ?? message.created_at;
  return <article className={`op-bubble op-bubble-${message.sender_kind}`} data-message-id={message.id} data-position={message.history_position ?? undefined}>
    <strong>{message.sender_kind === "customer" ? "Cliente" : "Bot"}</strong>
    <p>{message.body}</p>
    <footer>{message.sender_kind === "bot" && <span>{message.send_state ? sendLabels[message.send_state] : "Sin confirmación de envío"}</span>}
      <time dateTime={time} title={crmDate(time)}>{clock.format(new Date(time))}</time></footer>
  </article>;
}

export function OpportunityConversation({leadId,initial,unconfirmed:initialUnconfirmed}:{leadId:string;initial:MessagePage;unconfirmed:MessagePage}) {
  const [conversation,setConversation] = useState(initial);
  const [unconfirmed,setUnconfirmed] = useState(initialUnconfirmed);
  const [loading,setLoading] = useState<"conversation" | "unconfirmed" | null>(null);
  const [notice,setNotice] = useState("");
  const [denied,setDenied] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const anchor = useRef<{height:number;top:number} | null>(null);
  const started = useRef(false);
  const active = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    const element = scroll.current;
    if(element) {
      if(anchor.current) element.scrollTop = anchor.current.top + element.scrollHeight - anchor.current.height;
      else if(!started.current) element.scrollTop = element.scrollHeight;
    }
    anchor.current = null; started.current = true;
  },[conversation.messages]);
  useLayoutEffect(() => () => active.current?.abort(),[]);

  async function load(unordered = false) {
    if(active.current) return;
    const page = unordered ? unconfirmed : conversation;
    const controller = new AbortController(); active.current = controller;
    setLoading(unordered ? "unconfirmed" : "conversation"); setNotice("");
    const params = unordered ? new URLSearchParams({kind:"unconfirmed",beforeId:page.beforeId!})
      : new URLSearchParams({before:String(page.before),cutoff:String(page.cutoff)});
    try {
      const response = await fetch(`/api/oportunidades/${leadId}/mensajes?${params}`,{cache:"no-store",signal:controller.signal});
      if(response.redirected || [401,403,404].includes(response.status)) {
        setDenied(true); setNotice("La oportunidad ya no está disponible en esta sesión. Volvé a oportunidades o iniciá sesión nuevamente."); return;
      }
      if(!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) throw new Error("read");
      const incoming:MessagePage = await response.json();
      if(incoming.state !== "ready") throw new Error("read");
      if(!unordered && scroll.current) anchor.current = {height:scroll.current.scrollHeight,top:scroll.current.scrollTop};
      const update = (current:MessagePage) => ({...incoming,messages:mergeMessages(current.messages,incoming.messages,unordered)});
      if(unordered) setUnconfirmed(update); else setConversation(update);
      setNotice(`${incoming.messages.length} mensajes cargados${unordered ? "." : " arriba. Se conservó la posición de lectura."}`);
    } catch {
      if(!controller.signal.aborted) setNotice("No pudimos leer más mensajes. Los ya cargados se conservan; podés reintentar.");
    } finally {
      active.current = null;
      if(!controller.signal.aborted) setLoading(null);
    }
  }

  const readNotice = (page:MessagePage) => page.state === "ready" ? null : <p className="crm-placeholder" role={page.state === "error" ? "alert" : "status"}>{page.state === "error" ? "No pudimos cargar la conversación. Usá Actualizar para reintentar." : "Conversación: integración pendiente de habilitar en la base."}</p>;
  return <Panel title="Conversación" description="Cliente y bot · del mensaje más antiguo al más reciente. Solo lectura.">
    <p className="op-chat-help">Se muestran los mensajes recientes. Usá Actualizar para consultar nuevos mensajes y cambios de envío.</p>
    <p className="op-chat-notice" role="status" aria-live="polite">{notice}</p>
    {!denied && <>
      {readNotice(conversation)}
      {conversation.state === "ready" && <>
        <div className="op-chat-toolbar">{conversation.hasMore ? <button type="button" className="button button-secondary" disabled={!!loading} onClick={() => load()}>{loading === "conversation" ? "Cargando anteriores…" : "Cargar mensajes anteriores"}</button> : <span>Inicio de la conversación disponible</span>}</div>
        <div className="op-chat-scroll" ref={scroll} tabIndex={0} role="region" aria-label="Mensajes de la conversación" aria-busy={loading === "conversation"}>
          {conversation.messages.length ? <ol className="op-chat-list">{conversation.messages.map((message,index) => {
            const date = day.format(new Date(message.sent_at ?? message.created_at));
            const previous = conversation.messages[index-1];
            const previousDate = previous ? day.format(new Date(previous.sent_at ?? previous.created_at)) : null;
            return <li key={message.id} className={`op-chat-row op-chat-row-${message.sender_kind}`}>
              {date !== previousDate && <span className="op-chat-date">{date}</span>}
              <Message message={message}/>
            </li>;
          })}</ol> : <p className="crm-placeholder">Todavía no hay mensajes con posición confirmada.</p>}
        </div>
      </>}
      {readNotice(unconfirmed)}
      {unconfirmed.state === "ready" && unconfirmed.messages.length > 0 && <details className="op-unconfirmed">
        <summary>Envíos sin posición confirmada ({unconfirmed.messages.length}{unconfirmed.hasMore ? "+" : ""})</summary>
        <p>No se incluyen en el orden del diálogo. La hora corresponde al registro del intento; no demuestra envío, entrega ni lectura.</p>
        <ul>{unconfirmed.messages.map(message => <li key={message.id}><Message message={message}/></li>)}</ul>
        {unconfirmed.hasMore && <button type="button" className="button button-secondary" disabled={!!loading} onClick={() => load(true)}>{loading === "unconfirmed" ? "Cargando…" : "Cargar más envíos sin confirmar"}</button>}
      </details>}
    </>}
  </Panel>;
}
