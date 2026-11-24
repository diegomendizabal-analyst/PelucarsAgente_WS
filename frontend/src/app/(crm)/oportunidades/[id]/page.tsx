import { Suspense } from "react";
import Loading from "@/app/loading";
import { OpportunityDetail } from "@/components/crm-detail";

export const metadata = { title: "Ficha de oportunidad" };
export default function Page(props: { params: Promise<{ id: string }>; searchParams:Promise<Record<string,string | string[] | undefined>> }) {
  return <Suspense fallback={<Loading />}><OpportunityDetail {...props} /></Suspense>;
}
