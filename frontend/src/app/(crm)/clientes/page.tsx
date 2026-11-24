import { Suspense } from "react";
import { CustomerFilters } from "@/components/crm-filters";
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
    <CustomerFilters query={query}/>
    {data.error ? <CrmError/> : <><CustomerRows rows={data.rows}/><CrmPagination page={page} count={data.count} href={next=>`/clientes?${new URLSearchParams({q:query,page:String(next)})}`}/></>}
  </section></>;
}
