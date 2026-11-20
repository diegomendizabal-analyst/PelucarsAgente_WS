"use client";
import { useActionState, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { assignOpportunity, changeOpportunityStatus, claimOpportunity } from "@/app/(crm)/oportunidades/actions";
import { crmErrors, statusSchema } from "@/lib/crm/validation";
import { leadStatuses, type CrmFormState, type Lead } from "@/lib/crm/types";
import { RequiredMark } from "./ui";

export function RefreshCrm() {
  const router=useRouter(); const [pending,startTransition]=useTransition();
  return <button type="button" className="button secondary" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}><RefreshCw size={15} aria-hidden="true" />{pending ? "Actualizando…" : "Actualizar"}</button>;
}
export function ClaimLead({id}:{id:string}) {
  const [state,action,pending]=useActionState(claimOpportunity,{});
  return <form action={action} className="crm-claim"><input type="hidden" name="id" value={id}/><button className="button primary" disabled={pending}>{pending ? "Tomando…" : "Tomar oportunidad"}</button>{state.error && <p className="field-error" role="alert">{state.error}</p>}</form>;
}
function Feedback({state}:{state:CrmFormState}) { return <>{state.error && <p role="alert" className="form-feedback error">{state.error}</p>}{state.success && <p role="status" className="form-feedback">{state.success}</p>}</>; }
export function ManageLead({lead,assignees,admin}:{lead:Lead;assignees:{id:string;full_name:string;role:string}[];admin:boolean}) {
  const [assignState,assignAction,assignPending]=useActionState(assignOpportunity,{});
  const [statusState,statusAction,statusPending]=useActionState(changeOpportunityStatus,{});
  const [status,setStatus]=useState(lead.commercial_status);
  const [assignee,setAssignee]=useState(lead.assigned_to ?? "");
  const [localErrors,setLocalErrors]=useState<Record<string,string> | null>(null);
  const errors=localErrors ?? statusState.fieldErrors ?? {};
  function validateStatus(event:FormEvent<HTMLFormElement>) {
    const parsed=statusSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) { event.preventDefault(); const fields=crmErrors(parsed.error); setLocalErrors(fields); const target=event.currentTarget.elements.namedItem(Object.keys(fields)[0]); if(target instanceof HTMLElement)target.focus(); }
    else setLocalErrors(null);
  }
  const identity=<><input type="hidden" name="id" value={lead.id}/><input type="hidden" name="updated_at" value={lead.updated_at}/></>;
  return <section className="panel crm-management"><div className="panel-heading"><h2>Gestión de la oportunidad</h2></div><div className="panel-body">
    <p className="crm-responsible"><span>Responsable actual</span><strong>{lead.responsible?.full_name ?? "Sin asignar"}</strong></p>
    {lead.closed_at ? <p className="field-help">Oportunidad cerrada. La reapertura y la corrección de ventas quedan pendientes de definición.</p> : <>
      {admin && <form action={assignAction} className="form-stack crm-management-form" aria-busy={assignPending}>{identity}
        <label><span>Responsable <RequiredMark/></span><select name="assignee" required value={assignee} disabled={assignPending} onChange={event=>setAssignee(event.target.value)}><option value="">Elegí un responsable</option>{assignees.map(person=><option key={person.id} value={person.id}>{person.full_name}{person.role==='admin' ? ' · Admin' : ''}</option>)}</select></label>
        <label><span>Motivo {lead.assigned_to && assignee !== lead.assigned_to && <RequiredMark/>}</span><textarea name="reason" maxLength={1000} required={!!lead.assigned_to && assignee !== lead.assigned_to} disabled={assignPending} placeholder="Necesario al cambiar de responsable" rows={2}/></label>
        <button className="button secondary" disabled={assignPending || !assignee || assignee===lead.assigned_to}>{assignPending ? "Asignando…" : lead.assigned_to ? "Reasignar" : "Asignar responsable"}</button><Feedback state={assignState}/>
      </form>}
      <form action={statusAction} noValidate onSubmit={validateStatus} className="form-stack crm-management-form" aria-busy={statusPending}>{identity}
        <label><span>Estado <RequiredMark/></span><select name="status" required value={status} disabled={statusPending} onChange={event=>{setStatus(event.target.value as Lead["commercial_status"]);setLocalErrors(null);}}>{Object.entries(leadStatuses).filter(([key])=>key!=="sold").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label><span>Motivo {status==='lost' && <RequiredMark/>}</span><textarea name="reason" rows={3} maxLength={1000} required={status==='lost'} aria-invalid={!!errors.reason} aria-describedby={errors.reason ? "lead-reason-error" : undefined} disabled={statusPending} placeholder={status==='lost' ? "Explicá por qué se perdió la oportunidad" : "Contexto del cambio, si corresponde"}/>{errors.reason && <span className="field-error" id="lead-reason-error" role="alert">{errors.reason}</span>}</label>
        <button className="button primary" disabled={statusPending || status===lead.commercial_status}>{statusPending ? "Guardando…" : "Actualizar estado"}</button><Feedback state={statusState}/>
        <p className="field-help">Vendido se habilitará con el registro de ventas. Cambiar de estado no modifica la disponibilidad del vendedor.</p>
      </form>
    </>}
  </div></section>;
}
