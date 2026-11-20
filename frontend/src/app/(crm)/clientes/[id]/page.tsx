import { Suspense } from "react";
import Loading from "@/app/loading";
import { CustomerDetail } from "@/components/crm-detail";

export const metadata = { title: "Historial del cliente" };
export default function Page(props: { params: Promise<{ id: string }>; searchParams:Promise<Record<string,string | string[] | undefined>> }) {
  return <Suspense fallback={<Loading />}><CustomerDetail {...props} /></Suspense>;
}
