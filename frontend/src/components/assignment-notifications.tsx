"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, RefreshCw, X } from "lucide-react";
import { readNotification } from "@/app/(crm)/notificaciones/actions";
import { crmDate, leadReference, type NotificationFeed } from "@/lib/crm/types";

export function AssignmentNotifications() {
  const router=useRouter(), pathname=usePathname();
  const details=useRef<HTMLDetailsElement>(null);
  const request=useRef<AbortController | null>(null);
  const [feed,setFeed]=useState<NotificationFeed>({rows:[],count:0,error:false});
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [opening,startTransition]=useTransition();
  const refresh=useCallback(async()=>{
    if(document.visibilityState!=="visible")return;
    request.current?.abort();
    const controller=new AbortController(); request.current=controller;
    try {
      const response=await fetch("/api/notificaciones",{cache:"no-store",signal:controller.signal});
      if(!response.ok || response.redirected)throw new Error("Notifications unavailable");
      const data=await response.json() as NotificationFeed;
      if(!controller.signal.aborted){setFeed(data);setMessage("");}
    } catch {
      if(!controller.signal.aborted){setFeed({rows:[],count:0,error:true});setMessage("No pudimos consultar los avisos. Intentá actualizar.");}
    } finally { if(!controller.signal.aborted)setLoading(false); }
  },[]);
  useEffect(()=>{
    // Los avisos no bloquean el primer render de la pantalla comercial.
    const initial=window.setTimeout(()=>void refresh(),0);
    const timer=window.setInterval(()=>void refresh(),45000);
    const visible=()=>void refresh();
    window.addEventListener("focus",visible); document.addEventListener("visibilitychange",visible);
    return ()=>{clearTimeout(initial);clearInterval(timer);request.current?.abort();window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};
  },[refresh,pathname]);
  function open(id:string) {
    startTransition(async()=>{
      const result=await readNotification(id);
      if(result.error){setMessage(result.error);return;}
      request.current?.abort();
      setFeed(current=>({...current,rows:current.rows.filter(row=>row.id!==id),count:Math.max(0,current.count-1)}));
      if(details.current)details.current.open=false;
      router.push(`/oportunidades/${result.id}`);
      void refresh();
    });
  }
  return <details className="assignment-notifications" ref={details} onKeyDown={event=>{if(event.key==='Escape' && details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}}}>
    <summary aria-label={`Notificaciones: ${feed.count} sin leer`}><Bell size={18} aria-hidden="true"/>{feed.count>0 && <span className="notification-count">{feed.count>99 ? '99+' : feed.count}</span>}</summary>
    <section className="notification-panel" aria-label="Notificaciones de asignación">
      <header><h2>Asignadas a vos</h2><button className="icon-button" aria-label="Cerrar notificaciones" onClick={()=>{if(details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}}}><X size={17}/></button></header>
      <p className="notification-help">Nuevas consultas y cambios de responsable. Se revisan cada 45 segundos mientras el panel está visible.</p>
      {message && <p role="alert" className="field-error">{message}</p>}
      {feed.rows.length ? <ul>{feed.rows.map(row=><li key={row.id}><button disabled={opening} onClick={()=>open(row.id)}><strong>{leadReference(row.leads.reference_number)}</strong><span>Tenés una oportunidad para atender</span><time dateTime={row.created_at}>{crmDate(row.created_at)}</time></button></li>)}</ul> : !feed.error && <p className="notification-empty">{loading ? 'Consultando avisos…' : 'No tenés asignaciones nuevas sin leer.'}</p>}
      <footer><Link href="/oportunidades?tab=mine" onClick={()=>{if(details.current)details.current.open=false;}}>Ir a Mis oportunidades</Link><button className="button secondary" onClick={()=>{setLoading(true);void refresh();}} disabled={loading || opening}><RefreshCw size={13}/>{loading ? 'Actualizando…' : 'Actualizar'}</button></footer>
    </section>
  </details>;
}
