import { Suspense } from "react";
import Link from "next/link";
import { OpportunityFilters } from "@/components/crm-filters";
import Loading from "@/app/loading";
import { requireAccount } from "@/lib/auth/session";
import { crmPage, listLeads, listPending } from "@/lib/crm/data";
import { leadStatuses } from "@/lib/crm/types";
import { CrmError, CrmPagination, LeadRows, PendingRows } from "@/components/crm-views";
import { PageHeading } from "@/components/ui";
import { RefreshCrm } from "@/components/crm-controls";
type Search=Promise<Record<string,string | string[] | undefined>>;
export default function Home({searchParams}:{searchParams:Search}) { return <Suspense fallback={<Loading/>}><Inbox searchParams={searchParams}/></Suspense>; }
async function Inbox({searchParams}:{searchParams:Search}) {
  const [account,params]=await Promise.all([requireAccount(),searchParams]);
  const tab=params.tab==='mine' || (params.tab==='all' && account.role==='admin') ? params.tab : 'waiting';
  const page=crmPage(params.page);
  const status=tab!=='waiting' && typeof params.status==='string' && params.status in leadStatuses ? params.status : '';
  const privateWaiting=tab==='waiting' && account.role==='seller';
  const pending=privateWaiting ? await listPending(page) : null;
  const leads=!privateWaiting ? await listLeads({scope:tab,status,page}) : null;
  const error=pending?.error || leads?.error;
  return <><PageHeading eyebrow="GESTIÓN COMERCIAL" title="Oportunidades" description="Consultas en espera y oportunidades a tu cargo." action={<RefreshCrm/>}/>
    <section className="panel crm-inbox"><nav className="crm-tabs" aria-label="Bandejas"><Link href="/oportunidades" aria-current={tab==='waiting' ? 'page' : undefined}>En espera</Link><Link href="/oportunidades?tab=mine" aria-current={tab==='mine' ? 'page' : undefined}>Mis oportunidades</Link>{account.role==='admin' && <Link href="/oportunidades?tab=all" aria-current={tab==='all' ? 'page' : undefined}>Todas las oportunidades</Link>}</nav>
      {tab!=='waiting' && <OpportunityFilters tab={tab} status={status}/>}
      {error ? <CrmError/> : <>{pending ? <PendingRows rows={pending.rows}/> : <LeadRows rows={leads?.rows ?? []} waiting={tab==='waiting'}/>}<CrmPagination page={page} count={pending?.count ?? leads?.count ?? 0} href={next=>`/oportunidades?${new URLSearchParams({tab,status,page:String(next)})}`}/></>}
    </section></>;
}
