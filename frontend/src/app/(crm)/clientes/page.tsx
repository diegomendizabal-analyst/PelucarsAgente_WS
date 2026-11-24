import { Suspense } from "react";
import Form from "next/form";
import Loading from "@/app/loading";
import { crmPage,listCustomers } from "@/lib/crm/data";
import { CrmError,CrmPagination,CustomerRows } from "@/components/crm-views";
import { RefreshCrm } from "@/components/crm-controls";
import { PageHeading } from "@/components/ui";
export const metadata = { title: "Clientes" };
type Search=Promise<Record<string,string | string[] | undefined>>;
export default function Page({searchParams}:{searchParams:Search}) { return <Suspense fallback={<Loading/>}><Directory searchParams={searchParams}/></Suspense>; }
async function Directory({searchParams}:{searchParams:Search}) {
  const params=await searchParams; const page=crmPage(params.page); const query=typeof params.q==='string' ? params.q.trim().slice(0,160) : '';
  const data=await listCustomers(query,page);
  return <><PageHeading eyebrow="RELACIONES COMERCIALES" title="Clientes" description="Identidad e historial de consultas dentro de tu acceso autorizado." action={<RefreshCrm/>}/><section className="panel">
    <Form action="/clientes" className="crm-toolbar"><label>Buscar cliente<input name="q" type="search" defaultValue={query} key={query} maxLength={160} placeholder="Nombre o teléfono"/></label><button className="button secondary">Buscar</button></Form>
    {data.error ? <CrmError/> : <><CustomerRows rows={data.rows}/><CrmPagination page={page} count={data.count} href={next=>`/clientes?${new URLSearchParams({q:query,page:String(next)})}`}/></>}
  </section></>;
}
